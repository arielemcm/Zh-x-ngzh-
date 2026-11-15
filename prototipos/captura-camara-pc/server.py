from __future__ import annotations

import argparse
import io
import json
import mimetypes
import os
import uuid
from datetime import datetime
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

from PIL import Image, UnidentifiedImageError


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
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


class Handler(BaseHTTPRequestHandler):
    def send_bytes(self, payload: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, data: object, status: int = 200) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_bytes(payload, "application/json; charset=utf-8", status)

    def serve_project_file(self, name: str, content_type: str) -> None:
        target = BASE_DIR / name
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.send_bytes(target.read_bytes(), content_type)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            self.serve_project_file("index.html", "text/html; charset=utf-8")
            return
        if path == "/app.js":
            self.serve_project_file("app.js", "text/javascript; charset=utf-8")
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
        if urlparse(self.path).path != "/api/uploads":
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
        except (ValueError, OSError) as error:
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
