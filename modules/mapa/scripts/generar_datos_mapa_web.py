from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import box, shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "datos_trabajo"
OUTPUT = ROOT / "map-data.js"

XMIN, XMAX = 506_000.0, 560_000.0
YMIN, YMAX = 8_202_000.0, 8_253_000.0
WIDTH = 1000.0
SCALE = WIDTH / (XMAX - XMIN)
HEIGHT = (YMAX - YMIN) * SCALE


def read_features(filename: str):
    with (WORK / filename).open(encoding="utf-8") as source:
        return json.load(source)["features"]


def point(x: float, y: float) -> tuple[float, float]:
    return (x - XMIN) * SCALE, (YMAX - y) * SCALE


def ring_path(coords) -> str:
    coords = list(coords)
    if not coords:
        return ""
    first_x, first_y = point(*coords[0])
    commands = [f"M{first_x:.2f},{first_y:.2f}"]
    commands.extend(f"L{x:.2f},{y:.2f}" for x, y in (point(*coord) for coord in coords[1:]))
    commands.append("Z")
    return "".join(commands)


def polygon_path(geometry) -> str:
    if geometry.is_empty:
        return ""
    polygons = geometry.geoms if geometry.geom_type == "MultiPolygon" else [geometry]
    commands = []
    for polygon in polygons:
        commands.append(ring_path(polygon.exterior.coords))
        commands.extend(ring_path(interior.coords) for interior in polygon.interiors)
    return "".join(commands)


def line_paths(geometry) -> list[str]:
    lines = geometry.geoms if geometry.geom_type == "MultiLineString" else [geometry]
    output = []
    for line in lines:
        coords = list(line.coords)
        if len(coords) < 2:
            continue
        x, y = point(*coords[0])
        output.append(f"M{x:.2f},{y:.2f}" + "".join(f"L{px:.2f},{py:.2f}" for px, py in (point(*coord) for coord in coords[1:])))
    return output


def main():
    frame = box(XMIN, YMIN, XMAX, YMAX)
    zone_names = {
        1: ("ribera", "Ribera lacustre"),
        2: ("llanura", "Llanura altiplánica"),
        3: ("puna", "Puna alta"),
    }

    zones = []
    for feature in read_features("zonas_ecologicas_utm.geojson"):
        code = int(feature["properties"]["codigo"])
        slug, label = zone_names[code]
        geometry = shape(feature["geometry"]).simplify(55, preserve_topology=True)
        zones.append({"id": slug, "label": label, "path": polygon_path(geometry)})

    boundary = shape(read_features("limite_achacachi_utm.geojson")[0]["geometry"]).simplify(30, preserve_topology=True)
    lake_geometries = [shape(feature["geometry"]).intersection(frame) for feature in read_features("lago_titicaca_utm.geojson")]
    lake = unary_union(lake_geometries).simplify(90, preserve_topology=True)

    contours = {"4000": [], "4500": []}
    for feature in read_features("curvas_umbral_utm.geojson"):
        elevation = str(round(float(feature["properties"]["elev"])))
        geometry = shape(feature["geometry"]).simplify(65, preserve_topology=True)
        contours[elevation].extend(line_paths(geometry))

    raster_x, raster_y = point(513_600, 8_248_140)
    raster_right, raster_bottom = point(554_910, 8_208_030)

    payload = {
        "viewBox": f"0 0 {WIDTH:.0f} {HEIGHT:.2f}",
        "zones": zones,
        "boundary": polygon_path(boundary),
        "lake": polygon_path(lake),
        "contours": contours,
        "hillshade": {
            "x": round(raster_x, 2),
            "y": round(raster_y, 2),
            "width": round(raster_right - raster_x, 2),
            "height": round(raster_bottom - raster_y, 2),
            "href": "datos_trabajo/hillshade_achacachi.png",
        },
    }
    OUTPUT.write_text(
        "window.ACHACACHI_MAP_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
