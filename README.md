# Tu Tío Sapo — asistente agrícola de Achacachi

Aplicación local en español para explorar el territorio de Achacachi, consultar orientación agrícola, revisar hojas de papa y planificar el traslado de cosechas. El proyecto combina páginas HTML/JavaScript con dos servidores Python: Flask para la portada y el chat, y un servidor integrado para diagnóstico y logística.

## Funciones

- **Portada principal:** relato visual con controles de clima, mapa ecológico de Achacachi, selección de zona y recomendaciones de cultivo/rotación.
- **Revisar hoja:** permite tomar una foto con la cámara o cargar una imagen JPG, PNG o WebP. El modelo TensorFlow.js clasifica tres estados: tizón temprano, tizón tardío y hoja aparentemente sana. El resultado es orientativo.
- **Llevar cosecha:** compara mercados, demanda, producción y costos estimados; prepara destinos y viajes desde Achacachi.
- **Tío Sapo:** chat con Ollama y el modelo `mistral`. Recoge cultivo, zona y cultivo anterior antes de generar orientación agrícola.
- **Mapa:** presenta las zonas Ribera, Llanura/Planicie y Puna, junto con límites, curvas de nivel, lago y sombreado del relieve.

## Servidores y direcciones

El proyecto usa dos servidores que cumplen funciones distintas:

| Servidor | Dirección base | Uso |
|---|---|---|
| Flask (`app.py`) | `http://127.0.0.1:5000/` | Muestra el `index.html` de la raíz y ofrece el chat en `/tio-sapo`. También dispone de rutas para abrir los módulos. |
| Servidor integrado (`modules/diagnostico-hojas/server.py`) | `http://127.0.0.1:8001/` | Sirve la portada y los archivos del proyecto, ejecuta el respaldo de diagnóstico y proporciona las API de cargas y logística. |

Rutas de Flask:

- `/` — portada, servida desde el `index.html` que está junto a `app.py`.
- `/tio-sapo` — chat agrícola (`templates/index.html`).
- `/revisar-hoja` — redirección al módulo de diagnóstico.
- `/llevar-cosecha` — redirección al formulario de cosecha.
- `/api/chat` — API del chat.

Para usar todas las funciones, inicia ambos servidores en terminales distintas. La página de cosecha busca primero su API en el mismo origen y luego en el servidor de `8001`.

## Requisitos

- Windows, PowerShell y Python 3.10 o posterior. Python 3.12 es la versión usada por la imagen Docker.
- Ollama instalado y el modelo `mistral` descargado para usar el chat.
- Para rutas por carretera, conexión a Internet para consultar OSRM/OpenStreetMap. El motor tiene un cálculo geográfico de respaldo.
- Los modelos, CSV históricos y recursos locales incluidos en el proyecto.

## Instalación local

Desde la carpeta raíz del proyecto, crea el entorno y carga las dependencias de ambos servidores:
pip install -r requirements.txt


```powershell
python -m venv env
.\env\Scripts\python.exe -m pip install --upgrade pip
.\env\Scripts\python.exe -m pip install -r modules/diagnostico-hojas/requirements.txt -r predicciones/requirements.txt Flask ollama joblib
```

Instala Ollama por separado y descarga el modelo que `app.py` solicita:

```powershell
ollama pull mistral
```

## Iniciar el proyecto

Abre dos terminales PowerShell en la carpeta raíz.

**Terminal 1 — servidor de módulos en el puerto 8001:**

```powershell
.\env\Scripts\python.exe .\modules\diagnostico-hojas\server.py
```

**Terminal 2 — Flask, portada y chat en el puerto 5000:**

```powershell
.\env\Scripts\python.exe .\app.py
```

Abre `http://127.0.0.1:5000/` para ver primero la portada raíz. Desde allí, el acceso al chat está en `http://127.0.0.1:5000/tio-sapo`. También puedes abrir la portada servida por el servidor de módulos en `http://127.0.0.1:8001/`.

Detén cada servidor con `Ctrl+C` en su terminal.

### Lanzador de Windows

`INICIAR_PROYECTO.bat` inicia el servidor integrado del puerto `8001`, espera a que la API logística responda y abre la portada. Este lanzador no inicia `app.py`; para usar el chat de Tío Sapo también inicia Flask en una segunda terminal con el comando anterior.

### Docker

El contenedor ejecuta solamente el servidor integrado del puerto `8001`:

```powershell
docker compose up --build
```

Después abre `http://127.0.0.1:8001/`. Docker Compose no inicia el chat Flask de `app.py`.

## Datos ambientales y fuentes satelitales

El sistema **no descarga imágenes satelitales en cada consulta**. La predicción agrícola usa CSV locales con series históricas de 2013 a 2024 y genera pronósticos mensuales SARIMAX al importar `predicciones/modeloprediccion.py`.

| Insumo local | Uso en el código | Fuente / referencia |
|---|---|---|
| `predicciones/nasapower/` | Temperatura mínima y máxima, humedad del suelo en raíz (`GWETROOT`) y humedad relativa (`RH2M`). | [NASA POWER: fuentes meteorológicas](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/). Los parámetros meteorológicos de POWER se basan en datos de reanálisis/modelación, incluyendo MERRA-2; no son una medición satelital puntual en vivo. |
| `predicciones/chirps/` | Precipitación histórica por zona. | [CHIRPS, Climate Hazards Center de UC Santa Barbara](https://www.chc.ucsb.edu/data/chirps3). CHIRPS combina estimaciones de precipitación basadas en satélite con observaciones de estaciones. La versión concreta de los CSV locales no está indicada en el código. |
| `predicciones/resultados_MODIS/` | Índice de vegetación NDVI por zona. | [Índices de vegetación MODIS de NASA](https://modis.gsfc.nasa.gov/data/dataprod/mod13.php). |
| `predicciones/resultados_pendiente/` | Pendiente media usada como variable topográfica; los archivos se identifican como SRTM. | [Datos de elevación SRTM, USGS](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm). |

La carpeta `predicciones/resultados_HLS/` conserva datos HLS, pero el pipeline actual de `modeloprediccion.py` consume POWER, CHIRPS, MODIS y pendiente; no lee HLS. Si falta una fuente o falla el ajuste SARIMAX, el código usa valores de respaldo. Las fechas de pronóstico también deben revisarse al preparar una nueva campaña.

## Modelos y cálculos

- `models/model_<Cultivo>_<ZONA>.pkl`: modelos de rendimiento por cultivo y zona, leídos por `app.py` con `joblib`.
- `models/papa-clasificador-keras/`: clasificador Keras disponible como respaldo del análisis de hojas del servidor.
- `modules/diagnostico-hojas/modelo-web/`: modelo TensorFlow.js usado por el navegador; `model-embedded.js` permite cargarlo integrado.
- `predicciones/modeloprediccion.py`: construye pronósticos mensuales de variables ambientales con SARIMAX a partir de los CSV locales.
- `modelo_bayesiano.py`: aplica umbrales de lluvia, humedad radicular y temperatura mínima para evaluar la siembra.
- `motor_rotacion.py`: compara secuencias de cultivo y reglas de rotación.
- `modules/logistica/`: planificador heurístico; no es un modelo de aprendizaje automático.

## Limitaciones de los datos

- Los precios y la demanda de `modules/logistica/demanda_precios.csv` son demostrativos; no deben tomarse como cotizaciones actuales.
- La producción proviene de una tabla de campañas locales cuya institución de origen no está identificada en `fuentes.csv`.
- Los mercados y algunas coordenadas son aproximados. OSRM usa el perfil general `driving`, que no modela restricciones particulares de camiones. Cuando OSRM no está disponible, se informa y utiliza una distancia estimada.
- Las recomendaciones y clasificaciones son orientativas; no sustituyen una visita técnica ni una inspección agronómica.
- Si faltan archivos de entrada o modelos, algunas funciones pueden devolver valores de respaldo o indicar que no hay predicción disponible.

## Estructura principal

```text
app.py                         Flask: portada, chat y rutas de navegación
index.html                     Portada principal del proyecto
templates/index.html           Interfaz del chat Tío Sapo
static/                        Recursos del chat Flask
modules/diagnostico-hojas/     Diagnóstico de hojas y servidor integrado
modules/formulario-cosecha/    Interfaz de planificación de cosecha
modules/logistica/             Motor logístico, mercados y parámetros
modules/mapa/                  Mapa y capas/datos geográficos
predicciones/                  CSV ambientales y pipeline SARIMAX
models/                        Modelos de rendimiento y clasificador Keras
data/                          Datos agrícolas y documentos estructurados
assets/                         Imágenes compartidas del proyecto
css/, js/                      Estilos y scripts de la portada
docs/                          Arquitectura, continuidad y evidencias
prototipos/                    Interfaces de exploración y referencia
```

Más detalles de cada módulo están en `modules/diagnostico-hojas/README.md`, `modules/logistica/README.md` y `docs/ESTRUCTURA_PROYECTO.md`.