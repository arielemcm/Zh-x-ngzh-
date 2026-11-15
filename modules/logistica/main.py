
# -*- coding: utf-8 -*-
"""Aplicación local de simulación agrologística desde Achacachi.

Ejecutar con: python main.py
Abre un formulario HTML y utiliza el motor matemático de motor.py.
No utiliza chatbot, agente de IA ni n8n.
"""
from __future__ import annotations

import json
import math
import mimetypes
import threading
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

try:
    from . import motor
except ImportError:  # Permite seguir ejecutando: python modules/logistica/main.py
    import motor

BASE = Path(__file__).resolve().parent
WEB_FILE = BASE / "index.html"
RESULTS_DIR = BASE / "resultados"
motor.RESULTS_DIR = RESULTS_DIR
HOST = "127.0.0.1"
PORT = 8000


def read_json_body(handler: BaseHTTPRequestHandler) -> dict:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        raise ValueError("Tamaño de solicitud no válido.")
    if length <= 0 or length > 1_000_000:
        raise ValueError("La solicitud está vacía o supera el tamaño permitido.")
    try:
        data = json.loads(handler.rfile.read(length).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("No se pudo interpretar el formulario enviado.")
    if not isinstance(data, dict):
        raise ValueError("Los datos del formulario deben ser un objeto JSON.")
    return data


def as_float(data: dict, key: str, label: str, minimum: float = 0.0) -> float:
    value = data.get(key)
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Introduce un valor numérico válido para: {label}.")
    if not math.isfinite(result) or result < minimum:
        raise ValueError(f"{label} debe ser igual o mayor que {minimum}.")
    return result


def get_catalog(campaign: str | None = None) -> dict:
    production_rows = motor.read_csv(motor.PRODUCTION_FILE)
    campaigns = [row["Campana"] for row in production_rows]
    selected_campaign = campaign if campaign in campaigns else campaigns[-1]
    production, crisis = motor.load_production(selected_campaign)
    markets = motor.load_markets()
    return {
        "campaigns": campaigns,
        "selected_campaign": selected_campaign,
        "products": list(motor.PRODUCT_COLUMN_MAP.keys()),
        "production": production,
        "production_total": round(sum(production.values()), 2),
        "crisis": crisis,
        "markets": [
            {
                "id": market["id"],
                "name": market["name"],
                "department": market["department"],
                "altitude": market["altitude"],
                "coord_quality": market["coord_quality"],
            }
            for market in markets
        ],
        "defaults": motor.load_json(motor.CONFIG_FILE),
        "demand_quality": sorted({row["quality"] for row in motor.load_demand_data()}),
    }


def save_result_files(
    summary: dict,
    trips: list[dict],
    market_rows: list[dict],
    nodes: list[dict],
    distances,
    durations,
    route_source: str,
    warnings: list[str],
) -> dict:

    market_fields = [
        "Campana",
        "Producto",
        "Mercado",
        "Demanda_max_t",
        "Entregado_t",
        "No_atendido_t",
        "Distancia_desde_Achacachi_km",
        "Tiempo_desde_Achacachi_h",
    ]

    # resto del código...
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    motor.save_matrix(nodes, distances, durations, route_source)

    motor.write_csv(
        RESULTS_DIR / "resumen_por_producto.csv",
        [summary],
        list(summary.keys()),
    )

    trip_fields = list(trips[0].keys()) if trips else [
        "Campana", "Producto", "Viaje", "Entregas", "Carga_t",
        "Distancia_ida_vuelta_km", "Tiempo_estimado_h", "Costo_diesel_bs",
    ]
    motor.write_csv(
        RESULTS_DIR / "rutas_y_viajes.csv",
        trips,
        trip_fields,
    )

    motor.write_csv(
        RESULTS_DIR / "entregas_por_mercado.csv",
        market_rows,
        market_fields,
    )

    (RESULTS_DIR / "advertencias_y_supuestos.txt").write_text(
        "\n".join(f"- {warning}" for warning in warnings),
        encoding="utf-8",
    )

    motor.write_html_report(
        [summary],
        trips,
        summary["Campana"],
        "demo" if summary["Modo_rutas"] == "DEMO_SIMULADO" else "osrm",
        route_source,
        warnings,
    )

    return {
        "summary": "resumen_por_producto.csv",
        "trips": "rutas_y_viajes.csv",
        "markets": "entregas_por_mercado.csv",
        "matrix": "matriz_rutas.csv",
        "report": "reporte.html",
        "warnings": "advertencias_y_supuestos.txt",
    }


def run_planning(
    data: dict,
    *,
    persist_results: bool = True,
    allow_route_fallback: bool = False,
) -> dict:
    campaign = str(data.get("campaign", "")).strip()
    product = str(data.get("product", "")).strip()

    if not campaign or not product:
        raise ValueError("Selecciona una campaña y un producto.")

    production_by_product, crisis_flag = motor.load_production(campaign)

    if product not in production_by_product:
        raise ValueError("El producto seleccionado no existe en la campaña.")

    quantity = as_float(
        data, "quantity_t", "Las toneladas a transportar", 0.01
    )

    if quantity > production_by_product[product] + 1e-6:
        raise ValueError(
            f"Solicitas {quantity:,.2f} t, pero la producción registrada de {product} "
            f"en {campaign} es {production_by_product[product]:,.2f} t. "
            "Reduce la cantidad o selecciona otra campaña."
        )

    capacity = as_float(
        data, "truck_capacity_t", "La capacidad útil del camión", 0.1
    )

    trucks_value = as_float(
        data, "trucks_available", "La cantidad de camiones", 1
    )
    if not trucks_value.is_integer():
        raise ValueError("La cantidad de camiones debe ser un número entero.")
    trucks_available = int(trucks_value)

    if trucks_available < 1:
        raise ValueError("Debe haber al menos un camión disponible.")

    deadline_days = as_float(
        data, "deadline_days", "El plazo en días", 1
    )
    hours_per_day = as_float(
        data, "hours_per_day", "Las horas de trabajo por día", 1
    )
    diesel_price = as_float(
        data, "diesel_price", "El precio del diésel", 0
    )
    fuel_consumption = as_float(
        data, "fuel_consumption", "El consumo de combustible", 0
    )
    demo_speed = as_float(
        data, "demo_speed", "La velocidad media de demostración", 1
    )

    mode = str(data.get("route_mode", "demo")).lower()

    if mode not in {"demo", "osrm"}:
        raise ValueError("Selecciona un modo de rutas válido.")

    if data.get("accept_simulated") is not True:
        raise ValueError(
            "Debes confirmar que los precios y la demanda iniciales son simulados."
        )

    selected_ids = data.get("markets", [])

    if not isinstance(selected_ids, list) or not selected_ids:
        raise ValueError("Selecciona al menos una ciudad de destino.")

    all_markets = motor.load_markets()
    wanted = {str(value) for value in selected_ids}
    markets = [
        market for market in all_markets
        if market["id"] in wanted
    ]

    if len(markets) != len(wanted):
        raise ValueError(
            "Uno o más destinos seleccionados no están en el catálogo."
        )

    settings = motor.load_json(motor.CONFIG_FILE)
    settings["capacidad_camion_t"] = capacity
    settings["precio_diesel_bs_litro"] = diesel_price
    settings["consumo_litros_100km"] = fuel_consumption
    settings["velocidad_demo_kmh"] = demo_speed

    nodes = [
        dict(
            motor.ORIGIN,
            name=motor.ORIGIN["Mercado"],
            lat=motor.ORIGIN["Latitud"],
            lon=motor.ORIGIN["Longitud"],
            altitude=motor.ORIGIN["Altitud_m"],
        )
    ]

    nodes.extend(
        dict(market, name=market["name"])
        for market in markets
    )

    route_fallback_error = None
    if mode == "demo":
        distances, durations, route_source, route_quality = (
            motor.build_demo_matrix(nodes, settings)
        )
        route_mode_label = "DEMO_SIMULADO"
    else:
        try:
            distances, durations, route_source, route_quality = (
                motor.build_osrm_matrix(nodes)
            )
            route_mode_label = "OSRM_ESTIMACION_CARRETERA"
        except Exception as error:
            if not allow_route_fallback:
                raise
            distances, durations, route_source, route_quality = (
                motor.build_demo_matrix(nodes, settings)
            )
            route_mode_label = "DEMO_RESPALDO_OSRM"
            route_fallback_error = str(error)

    demand_rows = [
        row for row in motor.load_demand_data()
        if row["product"] == product
        and row["market"] in {market["name"] for market in markets}
    ]

    summary, trips, market_rows = motor.plan_one_product(
        product=product,
        production_t=production_by_product[product],
        campaign=campaign,
        markets=markets,
        demand_rows=demand_rows,
        distances=distances,
        durations=durations,
        route_source=route_source,
        route_quality=route_quality,
        settings=settings,
        available_override_t=quantity,
    )

    # Distancia y tiempo desde Achacachi hasta cada mercado.
    market_positions = {
        market["name"]: index + 1
        for index, market in enumerate(markets)
    }

    for row in market_rows:
        index = market_positions[row["Mercado"]]

        km = distances[0][index]
        seconds = durations[0][index]

        row["Distancia_desde_Achacachi_km"] = (
            round(km, 2) if math.isfinite(km) else ""
        )

        row["Tiempo_desde_Achacachi_h"] = (
            round(seconds / 3600, 2)
            if math.isfinite(seconds) else ""
        )

    total_hours = sum(
        float(row.get("Tiempo_estimado_h") or 0)
        for row in trips
    )
    total_km = sum(
        float(row.get("Distancia_ida_vuelta_km") or 0)
        for row in trips
    )
    total_fuel = sum(
        float(row.get("Combustible_l") or 0)
        for row in trips
    )

    required_trucks = (
        max(1, math.ceil(total_hours / (deadline_days * hours_per_day)))
        if total_hours else 0
    )

    estimated_days = (
        total_hours / (trucks_available * hours_per_day)
        if total_hours else 0
    )

    summary.update({
        "Modo_rutas": route_mode_label,
        "Camiones_disponibles": trucks_available,
        "Capacidad_camion_t": capacity,
        "Plazo_dias": deadline_days,
        "Horas_trabajo_diarias": hours_per_day,
        "Horas_ruta_totales_estimadas": round(total_hours, 2),
        "Dias_estimados_con_flota_declarada": round(estimated_days, 2),
        "Camiones_minimos_aprox_para_plazo": required_trucks,
        "Distancia_total_km": round(total_km, 2),
        "Combustible_total_l": round(total_fuel, 2),
    })

    warnings = [
        "La producción histórica procede de la tabla proporcionada por el usuario; conserva la fuente original para documentarla.",
        "La demanda, los precios y los costos comerciales incluidos en esta versión son SIMULADOS. Los resultados económicos son demostrativos.",
        "Las coordenadas y altitudes de los mercados son aproximadas y representan puntos urbanos de referencia.",
        "En modo DEMO, las distancias se aproximan con distancia geográfica multiplicada por un factor de carretera y el tiempo se estima con la velocidad introducida. No son rutas reales.",
        "En modo OSRM, las distancias y duraciones proceden de una red vial OpenStreetMap con perfil general de conducción; no garantizan restricciones para camiones.",
        "Los días y camiones mínimos son aproximaciones basadas en horas de recorrido. No incluyen carga, descarga, espera, descanso, mantenimiento ni restricciones horarias.",
        "El planificador es una heurística constructiva: propone recorridos y no garantiza el óptimo matemático global.",
        "El consumo de combustible, el precio del diésel y los costos de manejo deben contrastarse con datos reales antes de tomar decisiones comerciales.",
    ]

    if route_fallback_error:
        warnings.insert(
            0,
            "OSRM no respondió; se utilizó una estimación geográfica de respaldo para completar el cálculo.",
        )

    if crisis_flag:
        warnings.append(
            "La campaña seleccionada tiene Es_Crisis = 1 según la tabla proporcionada."
        )

    if summary["Sin_asignar_t"] > 0.01:
        warnings.append(
            f"Quedaron {summary['Sin_asignar_t']:.2f} t sin asignar por los límites de demanda y/o margen de los mercados seleccionados."
        )

    if required_trucks > trucks_available:
        warnings.append(
            f"Con las horas de recorrido estimadas, el plazo podría requerir aproximadamente {required_trucks} camiones; declaraste {trucks_available}."
        )

    files = {}
    if persist_results:
        files = save_result_files(
            summary, trips, market_rows, nodes,
            distances, durations, route_source, warnings
        )

    return {
        "summary": summary,
        "trips": trips,
        "markets": market_rows,
        "warnings": warnings,
        "route_source": route_source,
        "route_fallback": route_fallback_error is not None,
        "files": files,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }


class AppHandler(BaseHTTPRequestHandler):
    server_version = "AgroLogisticaLocal/1.0"

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def send_json(self, payload: dict, status: int = 200):
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            allow_nan=False
        ).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/":
            content = WEB_FILE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        if parsed.path == "/api/catalogo":
            query = parse_qs(parsed.query)
            campaign = query.get("campana", [None])[0]

            try:
                self.send_json(get_catalog(campaign))
            except Exception as error:
                self.send_json({"error": str(error)}, 500)
            return

        if parsed.path == "/health":
            self.send_json({
                "status": "ok",
                "application": "AgroLogistica_Formulario"
            })
            return

        if parsed.path.startswith("/descargar/"):
            name = parsed.path.rsplit("/", 1)[-1]

            allowed = {
                "resumen_por_producto.csv",
                "rutas_y_viajes.csv",
                "entregas_por_mercado.csv",
                "matriz_rutas.csv",
                "reporte.html",
                "advertencias_y_supuestos.txt",
            }

            if name not in allowed or not (RESULTS_DIR / name).exists():
                self.send_json({
                    "error": "Archivo no encontrado. Ejecuta primero una simulación."
                }, 404)
                return

            path = RESULTS_DIR / name
            content = path.read_bytes()
            content_type = (
                mimetypes.guess_type(path.name)[0]
                or "application/octet-stream"
            )

            self.send_response(200)
            self.send_header(
                "Content-Type",
                f"{content_type}; charset=utf-8"
            )
            self.send_header(
                "Content-Disposition",
                f'attachment; filename="{name}"'
            )
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        self.send_error(404, "Ruta no encontrada")

    def do_POST(self):
        if urlparse(self.path).path != "/api/planificar":
            self.send_error(404, "Ruta no encontrada")
            return

        try:
            data = read_json_body(self)
            result = run_planning(data)
            self.send_json(result)

        except ValueError as error:
            self.send_json({"error": str(error)}, 400)

        except Exception as error:
            self.send_json({
                "error": f"No se pudo completar la simulación: {error}"
            }, 500)

def main():
    if not WEB_FILE.exists():
        raise FileNotFoundError(
            f"No se encontró la interfaz: {WEB_FILE}"
        )

    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    url = f"http://{HOST}:{PORT}"

    print("\n==============================================")
    print("AGROLOGÍSTICA DESDE ACHACACHI")
    print("==============================================")
    print(f"Formulario disponible en: {url}")
    print("Origen fijo: Achacachi, La Paz")
    print("Cierra esta ventana o presiona Ctrl+C para detener el programa.")
    print("==============================================\n")

    threading.Timer(
        0.8,
        lambda: webbrowser.open(url)
    ).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrando aplicación...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
