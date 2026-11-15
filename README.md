# Asistente agrícola de Achacachi

Experiencia interactiva para registrar información agrícola, consultar el mapa ecológico de Achacachi y analizar visualmente hojas de papa.

## Iniciar el proyecto

La opción recomendada es ejecutar `INICIAR_PROYECTO.bat`. Este lanzador inicia el servidor con el modelo de diagnóstico y abre la portada en:

```text
http://127.0.0.1:8001
```

Para revisar solamente la interfaz estática también se puede usar:

```powershell
.\env\Scripts\python.exe -m http.server 8000
```

y abrir `http://127.0.0.1:8000`.

## Estructura activa

- `index.html`: entrada principal del sistema.
- `css/` y `js/`: estilos y comportamiento compartidos por la portada.
- `assets/`: imágenes de paisajes, personajes y semillas.
- `modules/diagnostico-hojas/`: cámara, carga de imágenes y análisis de hojas.
- `modules/mapa/`: mapa interactivo, fuentes GIS y scripts de generación.
- `modules/formulario-cosecha/`: interfaz para calcular destinos y transporte de la cosecha.
- `modules/logistica/`: motor de planificación, mercados, producción y parámetros de transporte.
- `data/agricultura/`: información agrícola consumida por la interfaz.
- `models/papa-clasificador-keras/`: modelo original utilizado por el servidor.
- `tests/browser/`: verificaciones automatizadas de la interfaz.
- `docs/`: continuidad, referencias y evidencias visuales.
- `prototipos/`: pruebas que no forman parte de la aplicación activa.
- `archivo/`: versiones anteriores conservadas como referencia.
- `env/`: entorno virtual local de Python.

La responsabilidad de cada carpeta y las reglas para incorporar archivos nuevos están detalladas en `docs/ESTRUCTURA_PROYECTO.md`.

## Dependencias principales

La portada carga primero `modules/mapa/map-data.js` y `modules/mapa/script.js`; después carga los scripts de la experiencia principal desde `js/`. El recomendador consulta `data/agricultura/informacion_agricola_la_paz.json`.

El diagnóstico de hojas funciona en el navegador con el modelo de `modules/diagnostico-hojas/modelo-web/`. Cuando se usa el servidor integrado, también dispone del modelo Keras ubicado en `models/papa-clasificador-keras/` como respaldo.

El formulario de cosecha consulta el motor de `modules/logistica/` mediante la API interna del mismo servidor. Las rutas se obtienen de OSRM/OpenStreetMap; si el servicio no responde se utiliza una estimación de respaldo. Los precios y la demanda incluidos actualmente siguen siendo demostrativos.

## Documentación

- `modules/diagnostico-hojas/README.md`: uso del análisis de hojas.
- `docs/ESTRUCTURA_PROYECTO.md`: arquitectura de carpetas.
- `docs/continuidad/`: decisiones y puntos de continuidad.
- `docs/evidencias/`: capturas organizadas por componente.
