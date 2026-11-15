"""Genera el índice de embeddings del PTDI de Achacachi.

Uso:
    py data/convertir_embeddings.py                 # API de Gemini (rápido)
    py data/convertir_embeddings.py --local         # sentence-transformers (lento, sin API)
    py data/convertir_embeddings.py --limite 20     # prueba rápida

El índice resultante (data/indice_embeddings.json) lo consume `utils/busqueda.py`.
"""
import argparse
import json
import sys
import time
from pathlib import Path

RAIZ_PROYECTO = Path(__file__).resolve().parent.parent
if str(RAIZ_PROYECTO) not in sys.path:
    sys.path.insert(0, str(RAIZ_PROYECTO))

import config
from providers.embeddings import vectorizar_api, vectorizar_local
from utils.texto import cargar_paginas_json, dividir_en_fragmentos


def construir_fragmentos(paginas, tamano: int = None, minimo: int = 80) -> list[dict]:
    tamano = tamano or config.TAMANO_FRAGMENTO
    fragmentos = []
    for pagina in paginas:
        for posicion, texto in enumerate(dividir_en_fragmentos(pagina.texto, tamano)):
            texto = texto.strip()
            if len(texto) < minimo:
                continue
            fragmentos.append({"pagina": pagina.numero, "posicion": posicion, "texto": texto})
    return fragmentos


def _vectores_existentes(salida: Path, total_esperado: int) -> list[list[float]]:
    """Devuelve los vectores ya calculados si el índice previo coincide con el documento."""
    if not salida.exists():
        return []
    try:
        with salida.open("r", encoding="utf-8") as archivo:
            datos = json.load(archivo)
    except Exception:
        return []

    registros = datos.get("fragmentos", [])
    if datos.get("total_fragmentos") != total_esperado or len(registros) > total_esperado:
        return []

    vectores = [r.get("vector") for r in registros]
    if not vectores or any(not v for v in vectores):
        return []
    print(f"[Info] Reutilizando {len(vectores)} vectores de {salida.name}.")
    return vectores


def _guardar(
    salida: Path,
    proveedor: str,
    modelo: str,
    vectores: list[list[float]],
    fragmentos: list[dict],
    tamano: int,
    completo: bool = False,
):
    registros = []
    for fragmento, vector in zip(fragmentos[: len(vectores)], vectores):
        registros.append(
            {
                "pagina": fragmento["pagina"],
                "posicion": fragmento["posicion"],
                "texto": fragmento["texto"],
                "vector": [round(v, 6) for v in vector],
            }
        )

    datos = {
        "proveedor": proveedor,
        "modelo": modelo,
        "dimension": len(vectores[0]) if vectores else 0,
        "tamano_fragmento": tamano or config.TAMANO_FRAGMENTO,
        "solapamiento": config.SOLAPAMIENTO,
        "total_fragmentos": len(fragmentos),
        "total_paginas": len({f["pagina"] for f in fragmentos}),
        "completo": completo,
        "fragmentos": registros,
    }

    salida.parent.mkdir(parents=True, exist_ok=True)
    temporal = salida.with_suffix(".tmp")
    with temporal.open("w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, ensure_ascii=False)
    temporal.replace(salida)


def generar_indice(
    salida: Path = None,
    proveedor: str = None,
    modelo: str = None,
    dimension: int = None,
    tamano: int = None,
    limite: int = None,
) -> Path:
    proveedor = (proveedor or config.PROVEEDOR_EMBEDDINGS).lower()
    salida = salida or config.RUTA_INDICE_EMBEDDINGS
    dimension = dimension or config.DIMENSION_EMBEDDINGS

    if proveedor == "local":
        modelo = modelo or config.MODELO_EMBEDDINGS_LOCAL
    else:
        proveedor = "gemini"
        modelo = modelo or config.MODELO_EMBEDDINGS_API

    paginas = cargar_paginas_json()
    fragmentos = construir_fragmentos(paginas, tamano)
    if limite:
        fragmentos = fragmentos[:limite]

    vectores_previos = _vectores_existentes(salida, len(fragmentos))
    pendientes = [i for i, f in enumerate(fragmentos) if i >= len(vectores_previos)]
    print(
        f"[Info] {len(fragmentos)} fragmentos con {proveedor} ({modelo}); "
        f"{len(pendientes)} pendientes por vectorizar."
    )

    inicio = time.time()
    if pendientes:
        if proveedor == "local":
            nuevos = vectorizar_local(
                [fragmentos[i]["texto"] for i in pendientes], modelo_nombre=modelo
            )
            vectores_previos.extend(nuevos)
        else:
            lote = config.LOTE_EMBEDDINGS_API
            for indice, desde in enumerate(range(0, len(pendientes), lote)):
                grupo = pendientes[desde : desde + lote]
                nuevos = vectorizar_api(
                    [fragmentos[i]["texto"] for i in grupo],
                    dimension=dimension,
                    modelo=modelo,
                    lote=lote,
                    mostrar_progreso=False,
                )
                vectores_previos.extend(nuevos)
                print(
                    f"[Info] Embeddings API: {len(vectores_previos)}/{len(fragmentos)} textos "
                    f"({time.time() - inicio:.0f}s)",
                    flush=True,
                )
                _guardar(salida, proveedor, modelo, vectores_previos, fragmentos, tamano)

    if len(vectores_previos) != len(fragmentos):
        raise RuntimeError(
            f"Se pidieron {len(fragmentos)} vectores y se obtuvieron {len(vectores_previos)}."
        )

    dimension_real = len(vectores_previos[0])
    print(f"[Info] {len(vectores_previos)} vectores de {dimension_real} dimensiones en {time.time() - inicio:.1f}s.")

    _guardar(salida, proveedor, modelo, vectores_previos, fragmentos, tamano, completo=True)
    print(f"[Info] Índice guardado en {salida} ({salida.stat().st_size / (1024 * 1024):.1f} MB)")
    return salida


def main():
    analizador = argparse.ArgumentParser(description="Genera el índice de embeddings del PTDI Achacachi")
    analizador.add_argument("--local", action="store_true", help="Usar sentence-transformers en local")
    analizador.add_argument("--modelo", default=None, help="Modelo de embeddings")
    analizador.add_argument("--salida", default=None, help="Ruta del JSON de salida")
    analizador.add_argument("--dimension", type=int, default=None, help="Dimensiones del vector (API)")
    analizador.add_argument("--tamano", type=int, default=None, help="Caracteres por fragmento")
    analizador.add_argument("--limite", type=int, default=None, help="Limitar fragmentos (pruebas)")
    argumentos = analizador.parse_args()

    try:
        generar_indice(
            salida=Path(argumentos.salida) if argumentos.salida else None,
            proveedor="local" if argumentos.local else None,
            modelo=argumentos.modelo,
            dimension=argumentos.dimension,
            tamano=argumentos.tamano,
            limite=argumentos.limite,
        )
    except Exception as error:
        print(f"[Error] {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()