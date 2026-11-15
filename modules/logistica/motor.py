
# -*- coding: utf-8 -*-
"""Planificador inicial de distribución agrícola desde Achacachi hacia Bolivia.

El modo DEMO usa distancias y velocidades simuladas. El modo OSRM consulta
una matriz de rutas por carretera basada en OpenStreetMap. OSRM usa perfil
carro (no garantiza restricciones ni tiempos específicos para camiones).
"""

from __future__ import annotations

import csv
import html
import json
import math
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

BASE = Path(__file__).resolve().parent
CONFIG_FILE = BASE / "parametros.json"
PRODUCTION_FILE = BASE / "produccion_achacachi.csv"
MARKETS_FILE = BASE / "mercados_bolivia.csv"
DEMAND_FILE = BASE / "demanda_precios.csv"
RESULTS_DIR = BASE / "resultados"
OSRM_CACHE_SECONDS = 6 * 60 * 60
_OSRM_CACHE: dict[tuple[tuple[float, float], ...], tuple[float, tuple]] = {}
_OSRM_CACHE_LOCK = threading.Lock()

# Punto de referencia aproximado del centro urbano de Achacachi.
# Debe sustituirse por el punto real de carga o almacén.
ORIGIN = {
    "ID": "ACHACACHI",
    "Mercado": "Achacachi",
    "Departamento": "La Paz",
    "Latitud": -16.0560,
    "Longitud": -68.6830,
    "Altitud_m": 3854.0,
    "Calidad_coordenadas": "APROXIMADA_CIUDAD",
    "Calidad_altitud": "REFERENCIA_APROXIMADA",
}

PRODUCT_COLUMN_MAP = {
    "Papa": "Papa_t",
    "Alfalfa": "Alfalfa_t",
    "Avena": "Avena_t",
    "Haba": "Haba_t",
    "Oca": "Oca_t",
    "Cebolla": "Cebolla_t",
    "Prod_7": "Prod_7_t",
}

REQUIRED_DEMAND_COLUMNS = [
    "Producto",
    "Mercado",
    "Demanda_max_t",
    "Precio_venta_bs_t",
    "Costo_produccion_bs_t",
    "Costo_manejo_bs_t",
    "Calidad_dato",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        if not reader.fieldnames:
            raise ValueError(
                f"El archivo está vacío o no tiene encabezados: {path}"
            )

        return list(reader)


def write_csv(
    path: Path,
    rows: list[dict[str, Any]],
    fieldnames: list[str]
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
            extrasaction="ignore"
        )
        writer.writeheader()

        for row in rows:
            writer.writerow(row)


def number(value: Any, field: str) -> float:
    """Admite punto decimal y coma decimal en archivos editados en Excel."""
    raw = str(value).strip()

    if not raw:
        raise ValueError(f"Falta un valor numérico en '{field}'.")

    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".")
    else:
        raw = raw.replace(",", ".")

    try:
        result = float(raw)
    except ValueError as exc:
        raise ValueError(
            f"Valor no numérico en '{field}': {value}"
        ) from exc

    if not math.isfinite(result):
        raise ValueError(f"Valor no válido en '{field}': {value}")

    return result


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_production(campaign: str) -> tuple[dict[str, float], int]:
    rows = read_csv(PRODUCTION_FILE)

    selected = next(
        (
            row for row in rows
            if row["Campana"].strip() == campaign
        ),
        None
    )

    if selected is None:
        available = ", ".join(row["Campana"] for row in rows)
        raise ValueError(
            f"Campaña '{campaign}' no encontrada. Disponibles: {available}"
        )

    production: dict[str, float] = {}

    for product, column in PRODUCT_COLUMN_MAP.items():
        production[product] = number(selected[column], column)

        if production[product] < 0:
            raise ValueError(
                f"La producción de {product} no puede ser negativa."
            )

    crisis_flag = int(
        number(selected.get("Es_Crisis", "0"), "Es_Crisis")
    )

    return production, crisis_flag


def load_markets() -> list[dict[str, Any]]:
    rows = read_csv(MARKETS_FILE)
    markets: list[dict[str, Any]] = []

    for row in rows:
        markets.append({
            "id": row["ID"].strip(),
            "name": row["Mercado"].strip(),
            "department": row["Departamento"].strip(),
            "lat": number(row["Latitud"], "Latitud"),
            "lon": number(row["Longitud"], "Longitud"),
            "altitude": number(row["Altitud_m"], "Altitud_m"),
            "coord_quality": row.get(
                "Calidad_coordenadas", "SIN_VERIFICAR"
            ),
            "altitude_quality": row.get(
                "Calidad_altitud", "SIN_VERIFICAR"
            ),
        })

    return markets


def load_demand_data() -> list[dict[str, Any]]:
    rows = read_csv(DEMAND_FILE)

    missing = [
        column for column in REQUIRED_DEMAND_COLUMNS
        if column not in rows[0]
    ] if rows else REQUIRED_DEMAND_COLUMNS

    if missing:
        raise ValueError(
            "Faltan columnas en demanda_precios.csv: "
            + ", ".join(missing)
        )

    parsed = []

    for row in rows:
        parsed.append({
            "product": row["Producto"].strip(),
            "market": row["Mercado"].strip(),
            "demand": number(row["Demanda_max_t"], "Demanda_max_t"),
            "sale_price": number(
                row["Precio_venta_bs_t"], "Precio_venta_bs_t"
            ),
            "production_cost": number(
                row["Costo_produccion_bs_t"], "Costo_produccion_bs_t"
            ),
            "handling_cost": number(
                row["Costo_manejo_bs_t"], "Costo_manejo_bs_t"
            ),
            "quality": row["Calidad_dato"].strip().upper(),
            "source_note": row.get("Fuente_observaciones", ""),
        })

        if parsed[-1]["demand"] < 0:
            raise ValueError("Demanda_max_t no puede ser negativa.")

    return parsed


def haversine_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    radius = 6371.0088

    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    )

    return 2 * radius * math.asin(math.sqrt(a))


def build_demo_matrix(
    nodes: list[dict[str, Any]],
    settings: dict[str, Any]
):
    n = len(nodes)

    factor = float(settings["factor_desvio_demo_carretera"])
    speed = float(settings["velocidad_demo_kmh"])

    distances = [
        [0.0 for _ in range(n)]
        for _ in range(n)
    ]

    durations = [
        [0.0 for _ in range(n)]
        for _ in range(n)
    ]

    for i in range(n):
        for j in range(n):
            if i == j:
                continue

            km = (
                haversine_km(
                    nodes[i]["lat"],
                    nodes[i]["lon"],
                    nodes[j]["lat"],
                    nodes[j]["lon"]
                )
                * factor
            )

            distances[i][j] = km
            durations[i][j] = (km / speed) * 3600.0

    return (
        distances,
        durations,
        "SIMULADO_DISTANCIA_GEOGRAFICA",
        "SIMULADO"
    )


def build_osrm_matrix(nodes: list[dict[str, Any]]):
    cache_key = tuple(
        (round(float(node["lat"]), 6), round(float(node["lon"]), 6))
        for node in nodes
    )
    with _OSRM_CACHE_LOCK:
        cached = _OSRM_CACHE.get(cache_key)
        if cached and time.monotonic() - cached[0] < OSRM_CACHE_SECONDS:
            return cached[1]

    coordinates = ";".join(
        f'{node["lon"]:.6f},{node["lat"]:.6f}'
        for node in nodes
    )

    url = (
        "https://router.project-osrm.org/table/v1/driving/"
        f"{coordinates}"
    )

    headers = {
        "User-Agent": "BoliviaAgrologisticaEducativa/1.0"
    }

    response = requests.get(
        url,
        params={"annotations": "distance,duration"},
        headers=headers,
        timeout=(5, 20),
    )

    response.raise_for_status()
    payload = response.json()

    if payload.get("code") != "Ok":
        raise RuntimeError(
            "OSRM no pudo construir la matriz: "
            + str(payload.get("code", "sin código"))
        )

    raw_distances = payload.get("distances")
    raw_durations = payload.get("durations")

    if not raw_distances or not raw_durations:
        raise RuntimeError("OSRM devolvió una matriz vacía.")

    distances = [
        [
            math.inf if value is None else float(value) / 1000.0
            for value in row
        ]
        for row in raw_distances
    ]

    durations = [
        [
            math.inf if value is None else float(value)
            for value in row
        ]
        for row in raw_durations
    ]

    result = (
        distances,
        durations,
        "OSRM_OPENSTREETMAP_PERFIL_DRIVING",
        "ESTIMACION_RED_VIAL"
    )
    with _OSRM_CACHE_LOCK:
        _OSRM_CACHE[cache_key] = (time.monotonic(), result)
    return result


def save_matrix(nodes, distances, durations, source: str) -> None:
    rows = []

    for i, origin in enumerate(nodes):
        for j, destination in enumerate(nodes):
            km = distances[i][j]
            sec = durations[i][j]

            rows.append({
                "Origen": origin["name"],
                "Destino": destination["name"],
                "Distancia_km": (
                    "" if math.isinf(km) else round(km, 3)
                ),
                "Tiempo_h": (
                    "" if math.isinf(sec) else round(sec / 3600, 3)
                ),
                "Fuente": source,
            })

    write_csv(
        RESULTS_DIR / "matriz_rutas.csv",
        rows,
        [
            "Origen",
            "Destino",
            "Distancia_km",
            "Tiempo_h",
            "Fuente"
        ],
    )


def path_distance(path: list[int], distances) -> float:
    total = 0.0
    sequence = [0] + path + [0]

    for a, b in zip(sequence, sequence[1:]):
        value = distances[a][b]

        if math.isinf(value):
            return math.inf

        total += value

    return total


def path_duration(path: list[int], durations, factor: float) -> float:
    total = 0.0
    sequence = [0] + path + [0]

    for a, b in zip(sequence, sequence[1:]):
        value = durations[a][b]

        if math.isinf(value):
            return math.inf

        total += value

    return total * factor


def best_insertion(
    current_path: list[int],
    candidate: int,
    distances
) -> tuple[list[int], float]:
    best_path = None
    best_distance = math.inf

    for position in range(len(current_path) + 1):
        new_path = (
            current_path[:position]
            + [candidate]
            + current_path[position:]
        )

        distance = path_distance(new_path, distances)

        if distance < best_distance:
            best_path = new_path
            best_distance = distance

    if best_path is None:
        raise RuntimeError("No se pudo insertar el mercado en la ruta.")

    return best_path, best_distance


def route_altitude_metrics(path: list[int], nodes):
    origin_altitude = nodes[0].get(
        "altitude",
        nodes[0].get("Altitud_m")
    )

    sequence = (
        [origin_altitude]
        + [nodes[index]["altitude"] for index in path]
        + [origin_altitude]
    )

    minimum = min(sequence)
    maximum = max(sequence)

    variation = sum(
        abs(b - a)
        for a, b in zip(sequence, sequence[1:])
    )

    return minimum, maximum, variation


def route_string(
    path: list[int],
    deliveries: dict[int, float],
    nodes
) -> str:
    return " -> ".join(
        f'{nodes[index]["name"]} ({deliveries[index]:.1f} t)'
        for index in path
    )


def plan_one_product(
    product: str,
    production_t: float,
    campaign: str,
    markets: list[dict[str, Any]],
    demand_rows: list[dict[str, Any]],
    distances,
    durations,
    route_source: str,
    route_quality: str,
    settings: dict[str, Any],
    available_override_t: float | None = None,
):
    capacity = float(settings["capacidad_camion_t"])
    commercial_percent = float(
        settings["porcentaje_comercializable"]
    )

    available = (
        float(available_override_t)
        if available_override_t is not None
        else production_t * commercial_percent / 100.0
    )

    remaining_supply = available

    diesel_price = float(settings["precio_diesel_bs_litro"])
    fuel_consumption = float(settings["consumo_litros_100km"])
    fixed_cost = float(settings["costo_fijo_por_viaje_bs"])
    osrm_time_factor = float(settings["factor_tiempo_camion_osrm"])
    max_trips = int(settings["max_viajes_por_producto"])

    market_index = {
        market["name"]: index + 1
        for index, market in enumerate(markets)
    }

    pending: dict[int, float] = {}
    unit_margin: dict[int, float] = {}
    sale_price: dict[int, float] = {}
    production_cost: dict[int, float] = {}
    handling_cost: dict[int, float] = {}
    quality_by_index: dict[int, str] = {}
    note_by_index: dict[int, str] = {}

    for row in demand_rows:
        if row["product"] != product:
            continue

        if row["market"] not in market_index:
            continue

        index = market_index[row["market"]]

        if row["market"] in [m["name"] for m in markets]:
            pending[index] = row["demand"]
            sale_price[index] = row["sale_price"]
            production_cost[index] = row["production_cost"]
            handling_cost[index] = row["handling_cost"]

            unit_margin[index] = (
                row["sale_price"]
                - row["production_cost"]
                - row["handling_cost"]
            )

            quality_by_index[index] = row["quality"]
            note_by_index[index] = row["source_note"]

    trip_rows = []

    delivered_by_market = {
        market["name"]: 0.0
        for market in markets
    }

    total_delivered = 0.0
    trip_number = 0

    while remaining_supply > 1e-6 and trip_number < max_trips:

        # Elegir el primer destino con mayor contribución neta por tonelada.
        first_options = []

        for index, demand_left in pending.items():
            if demand_left <= 1e-6:
                continue

            quantity = min(
                capacity,
                remaining_supply,
                demand_left
            )

            if quantity <= 1e-6:
                continue

            distance = path_distance([index], distances)

            if math.isinf(distance):
                continue

            transport = (
                distance * fuel_consumption / 100.0 * diesel_price
                + fixed_cost
            )

            margin = quantity * unit_margin[index]
            net = margin - transport

            if net > 0:
                first_options.append((
                    net / quantity,
                    net,
                    index,
                    quantity,
                    distance,
                    transport
                ))

        if not first_options:
            break

        first_options.sort(reverse=True)

        _, _, first_index, first_quantity, _, _ = first_options[0]

        path = [first_index]
        deliveries = {first_index: first_quantity}

        capacity_left = capacity - first_quantity
        supply_left_for_trip = remaining_supply - first_quantity

        pending[first_index] -= first_quantity
        remaining_supply -= first_quantity

        current_distance = path_distance(path, distances)

        current_transport_cost = (
            current_distance * fuel_consumption / 100.0 * diesel_price
            + fixed_cost
        )

        # Agregar otros mercados si caben en el camión y el margen
        # adicional cubre el desvío de combustible.
        while capacity_left > 1e-6 and supply_left_for_trip > 1e-6:

            candidates = []
            used = set(path)

            for index, demand_left in pending.items():
                if index in used or demand_left <= 1e-6:
                    continue

                quantity = min(
                    capacity_left,
                    supply_left_for_trip,
                    demand_left
                )

                if quantity <= 1e-6:
                    continue

                new_path, new_distance = best_insertion(
                    path,
                    index,
                    distances
                )

                if math.isinf(new_distance):
                    continue

                added_km = max(
                    0.0,
                    new_distance - current_distance
                )

                added_transport = (
                    added_km * fuel_consumption / 100.0 * diesel_price
                )

                added_margin = quantity * unit_margin[index]
                incremental_net = added_margin - added_transport

                if incremental_net > 0:
                    candidates.append((
                        incremental_net / quantity,
                        incremental_net,
                        index,
                        quantity,
                        new_path,
                        new_distance
                    ))

            if not candidates:
                break

            candidates.sort(
                reverse=True,
                key=lambda item: (item[0], item[1])
            )

            (
                _,
                _,
                chosen_index,
                quantity,
                new_path,
                new_distance
            ) = candidates[0]

            path = new_path
            deliveries[chosen_index] = quantity

            pending[chosen_index] -= quantity
            remaining_supply -= quantity
            capacity_left -= quantity
            supply_left_for_trip -= quantity

            current_distance = new_distance

            current_transport_cost = (
                current_distance
                * fuel_consumption / 100.0
                * diesel_price
                + fixed_cost
            )

        load = sum(deliveries.values())

        route_hours = (
            path_duration(
                path,
                durations,
                osrm_time_factor if route_quality != "SIMULADO" else 1.0
            ) / 3600.0
        )

        fuel_liters = current_distance * fuel_consumption / 100.0
        fuel_cost = fuel_liters * diesel_price

        gross_revenue = sum(
            deliveries[i] * sale_price[i]
            for i in deliveries
        )

        cost_production = sum(
            deliveries[i] * production_cost[i]
            for i in deliveries
        )

        cost_handling = sum(
            deliveries[i] * handling_cost[i]
            for i in deliveries
        )

        contribution_before_transport = (
            gross_revenue
            - cost_production
            - cost_handling
        )

        net_after_listed_costs = (
            contribution_before_transport
            - fuel_cost
            - fixed_cost
        )

        min_alt, max_alt, altitude_variation = route_altitude_metrics(
            path,
            [ORIGIN] + markets
        )

        quality_values = [
            quality_by_index[i]
            for i in deliveries
        ]

        all_observed = all(
            value.startswith("OBSERVADO")
            for value in quality_values
        )

        overall_quality = (
            "OBSERVADO"
            if all_observed and route_quality != "SIMULADO"
            else "SIMULADO_O_MIXTO"
        )

        stop_names = route_string(
            path,
            deliveries,
            [ORIGIN] + markets
        )

        route_nodes = [ORIGIN] + markets
        route_sequence = [0] + path + [0]
        route_legs = []
        for origin_index, destination_index in zip(
            route_sequence,
            route_sequence[1:],
        ):
            leg_distance = distances[origin_index][destination_index]
            leg_duration = durations[origin_index][destination_index]
            route_legs.append({
                "origen": route_nodes[origin_index].get(
                    "name", route_nodes[origin_index].get("Mercado")
                ),
                "destino": route_nodes[destination_index].get(
                    "name", route_nodes[destination_index].get("Mercado")
                ),
                "distancia_km": round(leg_distance, 2),
                "tiempo_min": round(
                    leg_duration
                    * (osrm_time_factor if route_quality != "SIMULADO" else 1.0)
                    / 60.0,
                    1,
                ),
                "resumen_carreteras": (
                    "Red vial OSRM/OpenStreetMap"
                    if route_quality != "SIMULADO"
                    else "Estimación geográfica de respaldo"
                ),
            })

        waypoint_coordinates = "%7C".join(
            f'{route_nodes[index]["lat"]:.6f},{route_nodes[index]["lon"]:.6f}'
            for index in path
        )
        map_url = (
            "https://www.google.com/maps/dir/?api=1"
            f'&origin={ORIGIN["Latitud"]:.6f},{ORIGIN["Longitud"]:.6f}'
            f'&destination={ORIGIN["Latitud"]:.6f},{ORIGIN["Longitud"]:.6f}'
            f"&waypoints={waypoint_coordinates}&travelmode=driving"
        )

        trip_number += 1

        trip_rows.append({
            "Campana": campaign,
            "Producto": product,
            "Viaje": trip_number,
            "Entregas": stop_names,
            "Tramos": route_legs,
            "Mapa_URL": map_url,
            "Numero_mercados": len(path),
            "Carga_t": round(load, 3),
            "Ocupacion_pct": round(load / capacity * 100, 2),
            "Distancia_ida_vuelta_km": round(current_distance, 2),
            "Tiempo_estimado_h": (
                round(route_hours, 2)
                if math.isfinite(route_hours)
                else ""
            ),
            "Combustible_l": round(fuel_liters, 2),
            "Costo_diesel_bs": round(fuel_cost, 2),
            "Costo_fijo_viaje_bs": round(fixed_cost, 2),
            "Ingresos_bs": round(gross_revenue, 2),
            "Costo_produccion_bs": round(cost_production, 2),
            "Costo_manejo_bs": round(cost_handling, 2),
            "Margen_antes_transporte_bs": round(
                contribution_before_transport, 2
            ),
            "Resultado_despues_costos_listados_bs": round(
                net_after_listed_costs, 2
            ),
            "Altitud_min_puntos_m": round(min_alt, 0),
            "Altitud_max_puntos_m": round(max_alt, 0),
            "Desnivel_acumulado_entre_puntos_m": round(
                altitude_variation, 0
            ),
            "Fuente_ruta": route_source,
            "Calidad_datos": overall_quality,
        })

        for index, quantity in deliveries.items():
            market_name = [
                m["name"] for m in markets
            ][index - 1]

            delivered_by_market[market_name] += quantity

        total_delivered += load

    unsold = max(0.0, available - total_delivered)

    total_production = production_t

    total_fuel_cost = sum(
        float(row["Costo_diesel_bs"])
        for row in trip_rows
    )

    total_income = sum(
        float(row["Ingresos_bs"])
        for row in trip_rows
    )

    total_prod_cost = sum(
        float(row["Costo_produccion_bs"])
        for row in trip_rows
    )

    total_handling = sum(
        float(row["Costo_manejo_bs"])
        for row in trip_rows
    )

    total_fixed = sum(
        float(row["Costo_fijo_viaje_bs"])
        for row in trip_rows
    )

    total_margin = (
        total_income
        - total_prod_cost
        - total_handling
    )

    total_net = (
        total_margin
        - total_fuel_cost
        - total_fixed
    )

    result = {
        "Campana": campaign,
        "Producto": product,
        "Produccion_total_t": round(total_production, 2),
        "Porcentaje_comercializable": (
            commercial_percent
            if available_override_t is None
            else "NO_APLICA_CANTIDAD_DECLARADA"
        ),
        "Disponible_para_venta_t": round(available, 2),
        "Cantidad_solicitada_t": round(available, 2),
        "Entregado_t": round(total_delivered, 2),
        "Sin_asignar_t": round(unsold, 2),
        "Viajes_estimados": len(trip_rows),
        "Carga_media_t": (
            round(total_delivered / len(trip_rows), 2)
            if trip_rows else 0
        ),
        "Combustible_total_l": round(
            sum(float(row["Combustible_l"]) for row in trip_rows),
            2
        ),
        "Costo_diesel_total_bs": round(total_fuel_cost, 2),
        "Ingresos_estimados_bs": round(total_income, 2),
        "Margen_antes_transporte_bs": round(total_margin, 2),
        "Resultado_despues_costos_listados_bs": round(
            total_net, 2
        ),
        "Calidad_datos": (
            "SIMULADO_O_MIXTO"
            if any(
                row["Calidad_datos"] != "OBSERVADO"
                for row in trip_rows
            )
            else "OBSERVADO"
        ),
    }

    market_rows = []

    for market in markets:
        demand_value = next(
            (
                row["demand"]
                for row in demand_rows
                if row["product"] == product
                and row["market"] == market["name"]
            ),
            0
        )

        delivered = delivered_by_market[market["name"]]

        market_rows.append({
            "Campana": campaign,
            "Producto": product,
            "Mercado": market["name"],
            "Demanda_max_t": round(demand_value, 2),
            "Entregado_t": round(delivered, 2),
            "No_atendido_t": round(
                max(0.0, demand_value - delivered),
                2
            ),
        })

    return result, trip_rows, market_rows


def write_html_report(
    summary_rows,
    trip_rows,
    campaign,
    mode,
    route_source,
    warnings
):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    generated = datetime.now().strftime("%Y-%m-%d %H:%M")

    def table(rows, columns):
        if not rows:
            return "<p>No hay registros para mostrar.</p>"

        header = "".join(
            f"<th>{html.escape(column)}</th>"
            for column in columns
        )

        body = []

        for row in rows:
            cells = "".join(
                f"<td>{html.escape(str(row.get(column, '')))}</td>"
                for column in columns
            )
            body.append(f"<tr>{cells}</tr>")

        return (
            "<div class='table-wrap'>"
            "<table><thead><tr>"
            + header
            + "</tr></thead><tbody>"
            + "".join(body)
            + "</tbody></table></div>"
        )

    summary_cols = [
        "Producto",
        "Produccion_total_t",
        "Disponible_para_venta_t",
        "Entregado_t",
        "Sin_asignar_t",
        "Viajes_estimados",
        "Costo_diesel_total_bs",
        "Resultado_despues_costos_listados_bs",
        "Calidad_datos",
    ]

    trip_cols = [
        "Producto",
        "Viaje",
        "Entregas",
        "Carga_t",
        "Distancia_ida_vuelta_km",
        "Tiempo_estimado_h",
        "Costo_diesel_bs",
        "Resultado_despues_costos_listados_bs",
        "Calidad_datos",
    ]

    warning_html = "".join(
        f"<li>{html.escape(item)}</li>"
        for item in warnings
    )

    is_demo = mode == "demo"

    banner = (
        "MODO DEMOSTRACIÓN: las demandas, precios y rutas son simulados."
        if is_demo
        else
        "Rutas consultadas mediante OSRM; los precios y demandas "
        "siguen dependiendo del archivo de entrada."
    )

    page = f"""<!doctype html>
<html lang='es'>
<head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width, initial-scale=1'>
<title>Planificación agrologística - Achacachi</title>
<style>
body{{font-family:Arial,sans-serif;margin:28px;color:#20252b;line-height:1.45;background:#f7f8fa}}
main{{max-width:1250px;margin:auto;background:white;padding:26px;border-radius:12px}}
h1{{margin-bottom:4px}}
.muted{{color:#68727d}}
.alert{{padding:12px 15px;background:#fff2d7;border-left:4px solid #d69a26;margin:18px 0}}
.table-wrap{{overflow-x:auto;margin:12px 0 24px}}
table{{border-collapse:collapse;width:100%;font-size:13px}}
th,td{{padding:8px;border-bottom:1px solid #e3e6e9;text-align:left;white-space:nowrap}}
th{{background:#edf1f4}}
li{{margin:7px 0}}
.small{{font-size:13px;color:#64707b}}
</style>
</head>
<body>
<main>
<h1>Planificación agrologística desde Achacachi</h1>
<p class='muted'>
Campaña {html.escape(campaign)} · Generado: {generated} ·
Modo: {html.escape(mode.upper())}
</p>
<div class='alert'><strong>{html.escape(banner)}</strong></div>
<h2>Resumen por producto</h2>
{table(summary_rows, summary_cols)}
<h2>Rutas y viajes calculados</h2>
{table(trip_rows, trip_cols)}
<h2>Advertencias y alcance</h2>
<ul>{warning_html}</ul>
<p class='small'>
El resultado económico resta costo de producción declarado,
manejo, combustible y costo fijo de viaje configurado.
No incluye automáticamente salarios, mantenimiento, seguros,
peajes, almacenamiento, mermas, impuestos ni comisiones si esos
valores no se incorporan en los datos.
</p>
<p class='small'>
Altitud: se informa el rango y la variación entre las altitudes
aproximadas de origen y mercados visitados. No es un perfil
topográfico continuo de la carretera ni se usa para corregir
el consumo de combustible.
</p>
<p class='small'>
En modo OSRM, la matriz utiliza el perfil de conducción general
de OSRM/OpenStreetMap. No garantiza que una vía sea transitable
o legal para un camión específico, ni incorpora restricciones
de peso, altura, horarios o estado real de la carretera.
</p>
</main>
</body>
</html>"""

    (RESULTS_DIR / "reporte.html").write_text(
        page,
        encoding="utf-8"
    )
