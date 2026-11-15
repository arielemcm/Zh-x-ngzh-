# Reestructuración de carpetas

Fecha: 15 de noviembre de 2026.

## Objetivo

Separar la aplicación activa, sus módulos, datos, modelos, pruebas, documentación y material histórico sin perder archivos ni modificar el comportamiento del sistema.

## Movimientos principales

| Antes | Ahora |
| --- | --- |
| `captura-camara-pc/` | `modules/diagnostico-hojas/` |
| `mapa/` | `modules/mapa/` |
| `mejor_modelo_papa.keras/` | `models/papa-clasificador-keras/` |
| `informacion_agricola_la_paz.json` | `data/agricultura/informacion_agricola_la_paz.json` |
| `capturas/` | `docs/evidencias/principal/` |
| capturas sueltas del diagnóstico | `docs/evidencias/diagnostico-hojas/` |
| imágenes de incidencias en `tests/` | `docs/evidencias/incidencias/` |
| pruebas `.mjs` en `tests/` | `tests/browser/` |
| documentos de continuidad sueltos | `docs/continuidad/` |

## Referencias actualizadas

Se ajustaron las rutas utilizadas por la portada, el recomendador, el diagnóstico de hojas, el servidor Python, Docker, el lanzador de Windows, las pruebas de navegador y los README.

El servidor conserva `/captura-camara-pc/` como alias temporal para no romper marcadores antiguos. La ruta oficial es `/modules/diagnostico-hojas/`.

## Verificación de integridad

Antes de mover los archivos se generó un inventario con tamaño y SHA-256. Después de la reorganización se comprobaron los 123 archivos incluidos:

- Los 123 archivos permanecen en la nueva estructura.
- 115 conservaron exactamente su tamaño y hash.
- 8 cambiaron de manera intencional porque sus referencias internas debían apuntar a las rutas nuevas: el servidor, el HTML y CSS del diagnóstico, su README, tres pruebas de navegador y el documento de continuidad.
- El modelo Keras, el GraphModel, sus pesos, los datos agrícolas, las fuentes GIS, las imágenes y la fotografía guardada conservaron su contenido.

## Pruebas realizadas

- Sintaxis de 11 archivos JavaScript/MJS.
- Lectura de 5 archivos JSON.
- Compilación sintáctica del servidor y los scripts Python del mapa.
- Regeneración reproducible de `model-embedded.js`.
- Carga estática de la portada, diagnóstico, mapa, datos, estilos, recursos y modelo web.
- Carga mediante el servidor integrado y confirmación del modelo Keras en estado `ready` con sus tres clases.
- Acceso a la fotografía previamente guardada y a la ruta antigua de compatibilidad.

Docker no estaba instalado en el equipo durante esta comprobación, por lo que no se ejecutó `docker compose config`; sus rutas sí fueron actualizadas de acuerdo con la estructura vigente.

## Limpieza

Se eliminaron perfiles temporales de Chrome, cachés de Python y carpetas temporales regenerables. No se eliminaron datos, modelos, fotografías guardadas, fuentes GIS, prototipos ni archivos históricos.
