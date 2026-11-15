from __future__ import annotations

import argparse
import io
import json
import mimetypes
import os
import sys
import tempfile
import threading
import uuid
import zipfile
from datetime import datetime
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

from PIL import Image, ImageOps, UnidentifiedImageError


BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

try:
    from modules.logistica import main as logistics_app
    _LOGISTICS_IMPORT_ERROR = None
except Exception as error:
    logistics_app = None
    _LOGISTICS_IMPORT_ERROR = str(error)

MIME_OVERRIDES = {
    ".bin": "application/octet-stream",
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}
UPLOAD_DIR = BASE_DIR / "uploads"
MODEL_DIR = PROJECT_DIR / "models" / "papa-clasificador-keras"
MODEL_LABELS_FILE = BASE_DIR / "model-labels.json"
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_LOGISTICS_REQUEST_BYTES = 64 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MODEL_INPUT_SIZE = (224, 224)
_MODEL = None
_MODEL_LOCK = threading.Lock()
_MODEL_STATE = {"status": "pending", "error": None}


class LeafNotDetectedError(ValueError):
    pass


def load_model_labels() -> list[dict[str, str]]:
    data = json.loads(MODEL_LABELS_FILE.read_text(encoding="utf-8"))
    classes = data.get("classes", [])
    if len(classes) != 3:
        raise RuntimeError("El archivo model-labels.json debe contener exactamente tres clases.")
    return classes


def load_potato_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    with _MODEL_LOCK:
        if _MODEL is not None:
            return _MODEL
        _MODEL_STATE.update(status="loading", error=None)
        try:
            required_files = ("config.json", "metadata.json", "model.weights.h5")
            missing = [name for name in required_files if not (MODEL_DIR / name).is_file()]
            if missing:
                raise RuntimeError(f"El modelo está incompleto. Faltan: {', '.join(missing)}.")

            try:
                import keras
            except ImportError as error:
                raise RuntimeError(
                    "Keras y TensorFlow no están instalados. Ejecuta pip install -r modules/diagnostico-hojas/requirements.txt."
                ) from error

            temporary_path = ""
            try:
                with tempfile.NamedTemporaryFile(suffix=".keras", delete=False) as temporary:
                    temporary_path = temporary.name
                with zipfile.ZipFile(temporary_path, "w", zipfile.ZIP_STORED) as archive:
                    for name in required_files:
                        archive.write(MODEL_DIR / name, arcname=name)
                _MODEL = keras.models.load_model(temporary_path, compile=False, safe_mode=True)
            finally:
                if temporary_path:
                    Path(temporary_path).unlink(missing_ok=True)
            _MODEL_STATE.update(status="ready", error=None)
        except Exception as error:
            _MODEL_STATE.update(status="error", error=str(error))
            raise
        return _MODEL


def warm_up_model() -> None:
    try:
        import numpy as np

        model = load_potato_model()
        with _MODEL_LOCK:
            model.predict(np.zeros((1, 224, 224, 3), dtype=np.float32), verbose=0)
        print("Modelo de papa preparado")
    except Exception as error:
        print(f"No se pudo preparar el modelo: {error}")


def check_leaf_appearance(tensor) -> dict[str, float | bool]:
    import numpy as np

    red, green, blue = tensor[:, :, 0], tensor[:, :, 1], tensor[:, :, 2]
    excess_green = 2 * green - red - blue
    vegetation = (
        (excess_green > 18)
        & (green > 38)
        & (green < 248)
        & (green > red * 1.02)
        & (green > blue * 1.02)
    )
    grayscale = 0.299 * red + 0.587 * green + 0.114 * blue
    edge_level = (
        np.abs(np.diff(grayscale, axis=0)).mean()
        + np.abs(np.diff(grayscale, axis=1)).mean()
    ) / 2
    center = vegetation[40:184, 40:184]
    green_ratio = float(vegetation.mean())
    center_green_ratio = float(center.mean())
    texture = float(grayscale.std())
    detected = (
        green_ratio >= float(os.environ.get("LEAF_MIN_GREEN_RATIO", "0.10"))
        and center_green_ratio >= float(os.environ.get("LEAF_MIN_CENTER_RATIO", "0.12"))
        and texture >= float(os.environ.get("LEAF_MIN_TEXTURE", "12"))
        and float(edge_level) >= float(os.environ.get("LEAF_MIN_EDGE", "2.5"))
    )
    return {
        "detected": bool(detected),
        "greenRatio": round(green_ratio, 4),
        "centerGreenRatio": round(center_green_ratio, 4),
        "texture": round(texture, 2),
        "edgeLevel": round(float(edge_level), 2),
    }


def classify_leaf(payload: bytes) -> dict[str, object]:
    try:
        import numpy as np
        from keras.applications.mobilenet_v2 import preprocess_input
    except ImportError as error:
        raise RuntimeError(
            "Las dependencias del modelo no están instaladas. Ejecuta pip install -r modules/diagnostico-hojas/requirements.txt."
        ) from error

    labels = load_model_labels()
    model = load_potato_model()
    with Image.open(io.BytesIO(payload)) as source:
        image = ImageOps.fit(source.convert("RGB"), MODEL_INPUT_SIZE, method=Image.Resampling.LANCZOS)
        tensor = np.asarray(image, dtype=np.float32)
    leaf_check = check_leaf_appearance(tensor)
    batch = preprocess_input(np.expand_dims(tensor, axis=0))
    with _MODEL_LOCK:
        probabilities = model.predict(batch, verbose=0)[0]

    ranked = sorted(
        (
            {
                "id": label["id"],
                "name": label["name"],
                "description": label["description"],
                "confidence": round(float(probability), 6),
            }
            for label, probability in zip(labels, probabilities, strict=True)
        ),
        key=lambda item: item["confidence"],
        reverse=True,
    )
    return {
        "ok": True,
        "prediction": ranked[0],
        "alternatives": ranked[1:],
        "inputSize": [*MODEL_INPUT_SIZE, 3],
        "leafCheck": leaf_check,
        "disclaimer": (
            "Orientación automática. Ante dudas, consulta a un técnico."
            if leaf_check["detected"]
            else "La hoja no se distinguió con claridad, pero el modelo realizó el análisis. "
            "Orientación automática. Ante dudas, consulta a un técnico."
        ),
    }


def parse_upload(content_type: str, body: bytes) -> tuple[str, str, bytes]:
    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + body
    )
    if not message.is_multipart():
        raise ValueError("La solicitud no contiene un formulario válido.")

    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") != "foto":
            continue
        return (
            part.get_filename() or "foto.jpg",
            part.get_content_type().lower(),
            part.get_payload(decode=True) or b"",
        )
    raise ValueError("No se recibió ninguna fotografía.")


def validate_image(media_type: str, payload: bytes) -> str:
    if not payload:
        raise ValueError("La fotografía está vacía.")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise ValueError("La fotografía supera el límite de 15 MB.")
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError("El archivo recibido no es una imagen compatible.")
    try:
        with Image.open(io.BytesIO(payload)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError) as error:
        raise ValueError("El contenido no corresponde a una imagen válida.") from error
    return ALLOWED_IMAGE_TYPES[media_type]


def read_json_request(handler: BaseHTTPRequestHandler) -> dict:
    content_type = handler.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        raise ValueError("La planificación debe enviarse como application/json.")
    try:
        content_length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as error:
        raise ValueError("El tamaño de la solicitud no es válido.") from error
    if content_length <= 0 or content_length > MAX_LOGISTICS_REQUEST_BYTES:
        raise ValueError("La solicitud está vacía o supera el tamaño permitido.")
    try:
        data = json.loads(handler.rfile.read(content_length).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("No se pudo interpretar la planificación enviada.") from error
    if not isinstance(data, dict):
        raise ValueError("La planificación debe ser un objeto JSON.")
    return data


def allowed_local_origin(origin: str | None) -> str | None:
    """Allow the harvest form to use the API from another local development port."""
    if origin == "null":
        return origin
    if not origin:
        return None
    parsed_origin = urlparse(origin)
    if (
        parsed_origin.scheme in {"http", "https"}
        and parsed_origin.hostname in {"127.0.0.1", "localhost", "::1"}
    ):
        return origin
    return None


class Handler(BaseHTTPRequestHandler):
    def send_bytes(self, payload: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if urlparse(self.path).path.startswith("/api/"):
            cors_origin = allowed_local_origin(self.headers.get("Origin"))
            if cors_origin:
                self.send_header("Access-Control-Allow-Origin", cors_origin)
                self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, data: object, status: int = 200) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_bytes(payload, "application/json; charset=utf-8", status)

    def serve_file(self, target: Path, content_type: str | None = None) -> None:
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        resolved_type = (
            content_type
            or MIME_OVERRIDES.get(target.suffix.lower())
            or mimetypes.guess_type(target.name)[0]
            or "application/octet-stream"
        )
        if "charset=" not in resolved_type and (
            resolved_type.startswith("text/")
            or resolved_type in {"application/javascript", "application/json"}
        ):
            resolved_type = f"{resolved_type}; charset=utf-8"
        self.send_bytes(target.read_bytes(), resolved_type)

    def do_OPTIONS(self) -> None:
        path = urlparse(self.path).path
        if not path.startswith("/api/logistica/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        requested_origin = self.headers.get("Origin")
        cors_origin = allowed_local_origin(requested_origin)
        if requested_origin and not cors_origin:
            self.send_error(HTTPStatus.FORBIDDEN)
            return

        self.send_response(HTTPStatus.NO_CONTENT)
        if cors_origin:
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        if path in {"/formulario-cosecha", "/formulario-cosecha/"} or path.startswith(
            "/formulario-cosecha/"
        ):
            suffix = path.removeprefix("/formulario-cosecha")
            target = f"/modules/formulario-cosecha{suffix or '/'}"
            if parsed_url.query:
                target = f"{target}?{parsed_url.query}"
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", target)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path in {"/", "/index.html"}:
            self.serve_file(PROJECT_DIR / "index.html", "text/html; charset=utf-8")
            return
        module_routes = ("/modules/diagnostico-hojas", "/captura-camara-pc")
        if path in {
            "/modules/diagnostico-hojas",
            "/modules/diagnostico-hojas/",
            "/modules/diagnostico-hojas/index.html",
            "/captura-camara-pc",
            "/captura-camara-pc/",
            "/captura-camara-pc/index.html",
        }:
            self.serve_file(BASE_DIR / "index.html", "text/html; charset=utf-8")
            return
        module_filename = next(
            (path.removeprefix(route + "/") for route in module_routes if path.startswith(route + "/")),
            "",
        )
        if module_filename in {
            "app.js",
            "styles.css",
            "experience.css",
            "model-labels.json",
        }:
            self.serve_file(BASE_DIR / module_filename)
            return
        web_model_asset = module_filename.startswith(("modelo-web/", "vendor/"))
        if web_model_asset:
            target = (BASE_DIR / module_filename).resolve()
            allowed_roots = (
                (BASE_DIR / "modelo-web").resolve(),
                (BASE_DIR / "vendor").resolve(),
            )
            if not any(target.is_relative_to(root) for root in allowed_roots):
                self.send_error(HTTPStatus.FORBIDDEN)
                return
            self.serve_file(target)
            return
        project_asset = path.startswith((
            "/assets/",
            "/css/",
            "/js/",
            "/modules/mapa/",
            "/modules/formulario-cosecha/",
            "/data/agricultura/",
            "/ayudante%20de%20pagina/",
            "/ayudante de pagina/",
        ))
        if project_asset:
            target = (PROJECT_DIR / unquote(path.lstrip("/"))).resolve()
            if not target.is_relative_to(PROJECT_DIR.resolve()):
                self.send_error(HTTPStatus.FORBIDDEN)
                return
            self.serve_file(target)
            return
        if path == "/api/logistica/catalogo":
            if logistics_app is None:
                self.send_json(
                    {"ok": False, "error": f"El motor logístico no está disponible: {_LOGISTICS_IMPORT_ERROR}"},
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return
            try:
                campaign = parse_qs(parsed_url.query).get("campana", [None])[0]
                catalog = logistics_app.get_catalog(campaign)
                self.send_json({"ok": True, **catalog})
            except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
                self.send_json({"ok": False, "error": str(error)}, HTTPStatus.BAD_REQUEST)
            return
        if path == "/api/logistica/estado":
            self.send_json(
                {
                    "ok": logistics_app is not None,
                    "available": logistics_app is not None,
                    "error": _LOGISTICS_IMPORT_ERROR,
                },
                HTTPStatus.OK if logistics_app is not None else HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        if path == "/api/uploads":
            files = sorted(
                (item for item in UPLOAD_DIR.glob("*") if item.is_file() and item.name != ".gitkeep"),
                key=lambda item: item.stat().st_mtime,
                reverse=True,
            )
            self.send_json(
                [
                    {
                        "name": file.name,
                        "url": f"/uploads/{quote(file.name)}",
                        "size": file.stat().st_size,
                    }
                    for file in files[:20]
                ]
            )
            return
        if path == "/api/model":
            try:
                labels = load_model_labels()
                self.send_json(
                    {
                        "ok": True,
                        "available": MODEL_DIR.is_dir(),
                        "status": _MODEL_STATE["status"],
                        "error": _MODEL_STATE["error"],
                        "inputSize": [*MODEL_INPUT_SIZE, 3],
                        "classes": [label["name"] for label in labels],
                    }
                )
            except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
                self.send_json({"ok": False, "error": str(error)}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if path.startswith("/uploads/"):
            filename = Path(unquote(path.removeprefix("/uploads/"))).name
            target = UPLOAD_DIR / filename
            if not target.is_file() or filename == ".gitkeep":
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_bytes(target.read_bytes(), content_type)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/logistica/planificar":
            if logistics_app is None:
                self.send_json(
                    {"ok": False, "error": f"El motor logístico no está disponible: {_LOGISTICS_IMPORT_ERROR}"},
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return
            try:
                request_data = read_json_request(self)
                result = logistics_app.run_planning(
                    request_data,
                    persist_results=False,
                    allow_route_fallback=True,
                )
                self.send_json({"ok": True, **result})
            except ValueError as error:
                self.send_json({"ok": False, "error": str(error)}, HTTPStatus.BAD_REQUEST)
            except Exception as error:
                self.send_json(
                    {"ok": False, "error": f"No se pudo completar la planificación: {error}"},
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
            return
        if path not in {"/api/uploads", "/api/predict"}:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_UPLOAD_BYTES + 1024 * 1024:
                raise ValueError("La carga está vacía o supera el límite permitido.")
            body = self.rfile.read(content_length)
            original_name, media_type, payload = parse_upload(
                self.headers.get("Content-Type", ""), body
            )
            extension = validate_image(media_type, payload)
            if path == "/api/predict":
                self.send_json(classify_leaf(payload))
                return
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            filename = f"foto-{timestamp}-{uuid.uuid4().hex[:8]}{extension}"
            (UPLOAD_DIR / filename).write_bytes(payload)
            self.send_json(
                {
                    "ok": True,
                    "originalName": original_name,
                    "filename": filename,
                    "url": f"/uploads/{quote(filename)}",
                    "size": len(payload),
                },
                HTTPStatus.CREATED,
            )
        except LeafNotDetectedError as error:
            self.send_json(
                {
                    "ok": False,
                    "code": "leaf_not_detected",
                    "error": str(error),
                    "suggestion": "Centra una sola hoja y toma otra foto.",
                },
                HTTPStatus.UNPROCESSABLE_ENTITY,
            )
        except RuntimeError as error:
            self.send_json({"ok": False, "error": str(error)}, HTTPStatus.SERVICE_UNAVAILABLE)
        except (ValueError, OSError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "error": str(error)}, HTTPStatus.BAD_REQUEST)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Captura con la cámara de la computadora")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8001")))
    options = parser.parse_args()

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((options.host, options.port), Handler)
    threading.Thread(target=warm_up_model, name="potato-model-warmup", daemon=True).start()
    print("Cámara de la computadora activa")
    print(f"Abre: http://127.0.0.1:{options.port}")
    print("Presiona Ctrl+C para detenerla.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
