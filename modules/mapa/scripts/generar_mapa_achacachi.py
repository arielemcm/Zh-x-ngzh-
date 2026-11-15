from __future__ import annotations

import json
from pathlib import Path

import matplotlib.patheffects as pe
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import Patch, Polygon as MplPolygon
from PIL import Image, PngImagePlugin
from shapely.geometry import shape


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "datos_trabajo"
OUT = ROOT / "salidas" / "mapa_zonas_achacachi.png"

XMIN, XMAX = 506_000, 560_000
YMIN, YMAX = 8_202_000, 8_253_000
RASTER_EXTENT = (513_600, 554_910, 8_208_030, 8_248_140)

COLORS = {
    "Ribera lacustre": "#44BFA8",
    "Llanura altiplanica": "#D6A95D",
    "Puna alta (incluye piso nival)": "#9A7BC1",
}


def read_features(name: str):
    with (WORK / name).open(encoding="utf-8") as src:
        return json.load(src)["features"]


def iter_parts(geom):
    if geom.geom_type.startswith("Multi") or geom.geom_type == "GeometryCollection":
        yield from geom.geoms
    else:
        yield geom


def draw_polygon(ax, geom, **kwargs):
    artists = []
    for part in iter_parts(geom):
        if part.is_empty or part.geom_type != "Polygon":
            continue
        artist = MplPolygon(list(part.exterior.coords), closed=True, **kwargs)
        ax.add_patch(artist)
        artists.append(artist)
    return artists


def draw_line(ax, geom, **kwargs):
    for part in iter_parts(geom):
        if part.is_empty:
            continue
        if part.geom_type == "LineString":
            xs, ys = part.xy
            ax.plot(xs, ys, **kwargs)
        elif part.geom_type == "Polygon":
            xs, ys = part.exterior.xy
            ax.plot(xs, ys, **kwargs)


def label(ax, x, y, text, **kwargs):
    effects = [pe.Stroke(linewidth=3.2, foreground="white", alpha=0.92), pe.Normal()]
    return ax.text(x, y, text, path_effects=effects, **kwargs)


def main():
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "axes.facecolor": "#EFE9DC",
    })
    fig = plt.figure(figsize=(14, 11), facecolor="#F6F2E9")
    ax = fig.add_axes([0.055, 0.13, 0.70, 0.75])
    side = fig.add_axes([0.785, 0.14, 0.19, 0.71])
    side.axis("off")

    ax.set_xlim(XMIN, XMAX)
    ax.set_ylim(YMIN, YMAX)
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_color("#493F35")
        spine.set_linewidth(1.2)

    lake = shape(read_features("lago_titicaca_utm.geojson")[0]["geometry"])
    draw_polygon(ax, lake, facecolor="#82C8E6", edgecolor="#4D9DBE", linewidth=0.8, zorder=1)

    boundary = shape(read_features("limite_achacachi_utm.geojson")[0]["geometry"])
    hillshade = Image.open(WORK / "hillshade_achacachi.png").convert("L")
    hill = ax.imshow(
        hillshade,
        extent=RASTER_EXTENT,
        cmap="gray",
        vmin=20,
        vmax=250,
        alpha=0.56,
        zorder=2,
    )
    clips = draw_polygon(ax, boundary, facecolor="none", edgecolor="none")
    if clips:
        hill.set_clip_path(clips[0])

    zone_features = read_features("zonas_ecologicas_utm.geojson")
    for feature in zone_features:
        zone = feature["properties"]["zona"]
        draw_polygon(
            ax,
            shape(feature["geometry"]),
            facecolor=COLORS[zone],
            edgecolor="#FFFFFF",
            linewidth=0.35,
            alpha=0.60,
            zorder=3,
        )

    transition = shape(read_features("transicion_utm.geojson")[0]["geometry"])
    draw_polygon(
        ax,
        transition,
        facecolor="none",
        edgecolor="#66546F",
        linewidth=0.45,
        hatch="////",
        alpha=0.34,
        zorder=4,
    )

    for feature in read_features("curvas_umbral_utm.geojson"):
        elev = round(float(feature["properties"]["elev"]))
        style = (0, (6, 4)) if elev == 4000 else (0, (1.5, 3.2))
        draw_line(
            ax,
            shape(feature["geometry"]),
            color="#4E4059",
            linewidth=1.1 if elev == 4000 else 0.9,
            linestyle=style,
            alpha=0.82,
            zorder=5,
        )

    draw_line(ax, boundary, color="#27241F", linewidth=2.1, zorder=6)

    label(ax, 534_000, 8_226_500, "ACHACACHI", fontsize=12, weight="bold", color="#1E2927", ha="center", zorder=8)
    ax.scatter([534_000], [8_225_100], s=24, color="#26231F", edgecolor="white", linewidth=0.7, zorder=8)
    label(ax, 509_000, 8_225_000, "Lago Titicaca", fontsize=12, style="italic", color="#226A8C", rotation=82, ha="center", zorder=8)
    label(ax, 551_000, 8_239_000, "Cordillera Real", fontsize=11, style="italic", color="#4E4059", rotation=72, ha="center", zorder=8)

    # Norte
    nx, ny = 557_000, 8_246_000
    ax.annotate("", xy=(nx, ny), xytext=(nx, ny - 5_000), arrowprops=dict(facecolor="#24211D", edgecolor="white", width=5, headwidth=17, headlength=21), zorder=9)
    label(ax, nx, ny + 1_100, "N", fontsize=14, weight="bold", ha="center", color="#24211D", zorder=9)

    # Escala grafica de 10 km
    sx, sy, length = 514_500, 8_205_000, 10_000
    ax.plot([sx, sx + length], [sy, sy], color="white", linewidth=6, zorder=9)
    ax.plot([sx, sx + length], [sy, sy], color="#24211D", linewidth=3, zorder=10)
    for xx in (sx, sx + length / 2, sx + length):
        ax.plot([xx, xx], [sy - 350, sy + 350], color="#24211D", linewidth=1.6, zorder=10)
    label(ax, sx, sy + 850, "0", fontsize=8, ha="center", color="#24211D", zorder=10)
    label(ax, sx + length / 2, sy + 850, "5", fontsize=8, ha="center", color="#24211D", zorder=10)
    label(ax, sx + length, sy + 850, "10 km", fontsize=8, ha="center", color="#24211D", zorder=10)

    fig.text(0.055, 0.936, "Zonas ecológicas del municipio de Achacachi", fontsize=24, weight="bold", color="#27241F")
    fig.text(0.057, 0.907, "Ribera lacustre · llanura altiplánica · puna alta", fontsize=12.5, color="#655C50")

    side.text(0, 0.98, "LEYENDA", fontsize=13, weight="bold", color="#27241F", va="top")
    handles = [
        Patch(facecolor=COLORS["Ribera lacustre"], edgecolor="#FFFFFF", alpha=0.72, label="Ribera lacustre"),
        Patch(facecolor=COLORS["Llanura altiplanica"], edgecolor="#FFFFFF", alpha=0.72, label="Llanura altiplánica"),
        Patch(facecolor=COLORS["Puna alta (incluye piso nival)"], edgecolor="#FFFFFF", alpha=0.72, label="Puna alta y piso nival"),
        Patch(facecolor="none", edgecolor="#66546F", hatch="////", label="Transición interpretada\n4.000–4.500 m"),
        Line2D([0], [0], color="#4E4059", lw=1.2, linestyle=(0, (6, 4)), label="Umbral 4.000 m"),
        Line2D([0], [0], color="#4E4059", lw=1.0, linestyle=(0, (1.5, 3.2)), label="Umbral 4.500 m"),
        Line2D([0], [0], color="#27241F", lw=2.1, label="Límite municipal"),
        Patch(facecolor="#82C8E6", edgecolor="#4D9DBE", label="Lago Titicaca"),
    ]
    side.legend(handles=handles, loc="upper left", bbox_to_anchor=(-0.03, 0.91), frameon=False, fontsize=9.4, handlelength=2.7, labelspacing=1.05)

    side.text(0, 0.47, "CRITERIOS", fontsize=11.5, weight="bold", color="#27241F")
    side.text(
        0,
        0.44,
        "Ribera: ≤ 3.900 m y hasta 4 km\nde la costa.\n\nLlanura: < 4.000 m, excluida la ribera.\n\nPuna alta: desde 4.000 m; el PTDI la\ndescribe explícitamente desde aprox.\n4.500–4.800 m e incluye el piso nival.",
        fontsize=8.9,
        color="#4C463E",
        va="top",
        linespacing=1.35,
    )
    side.text(0, 0.18, "NOTA DE INTERPRETACIÓN", fontsize=10.4, weight="bold", color="#27241F")
    side.text(
        0,
        0.15,
        "La anchura de la ribera y la transición\n4.000–4.500 m no cuentan con polígonos\noficiales localizados. Se muestran como\ndelimitación interpretada y límites por\nverificar en campo o con cartografía oficial.",
        fontsize=8.5,
        color="#4C463E",
        va="top",
        linespacing=1.35,
    )

    fig.text(
        0.055,
        0.055,
        "Fuentes: GAM Achacachi, PTDI 2021–2025 (Mapa 7 y pisos ecológicos); límite municipal SDSN Bolivia/GeoBolivia;\nCopernicus DEM GLO-30; cuerpos de agua Natural Earth. Relieve: hillshade multidireccional. CRS: WGS 84 / UTM 19S (EPSG:32719).",
        fontsize=8.2,
        color="#5A5248",
        linespacing=1.35,
    )
    fig.text(0.975, 0.055, "Elaboración cartográfica: noviembre de 2026", fontsize=8.2, color="#5A5248", ha="right")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=300, facecolor=fig.get_facecolor(), bbox_inches="tight", pad_inches=0.16)
    plt.close(fig)

    # Metadatos legibles sin alterar la imagen.
    image = Image.open(OUT)
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Title", "Zonas ecológicas del municipio de Achacachi")
    metadata.add_text("CRS", "EPSG:32719 - WGS 84 / UTM zone 19S")
    metadata.add_text("Method", "Delimitación interpretada con PTDI, DEM GLO-30 y distancia a la costa")
    metadata.add_text("Sources", "PTDI Achacachi 2021-2025; SDSN Bolivia/GeoBolivia; Copernicus DEM GLO-30; Natural Earth")
    image.save(OUT, pnginfo=metadata, dpi=(300, 300))
    print(OUT)


if __name__ == "__main__":
    main()
