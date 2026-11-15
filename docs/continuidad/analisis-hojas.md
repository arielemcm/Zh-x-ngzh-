# Punto exacto para continuar: análisis de hojas

> Nota de estructura (15 de noviembre de 2026): este documento conserva referencias históricas para explicar el trabajo realizado. La ruta activa actual es `modules/diagnostico-hojas/`, el modelo del servidor está en `models/papa-clasificador-keras/` y la guía vigente está en `modules/diagnostico-hojas/README.md`.

Fecha del punto de control: 15 de noviembre de 2026, 05:10 (America/La_Paz).

## Actualización de cierre — 15 de noviembre de 2026

La migración a TensorFlow.js quedó completada. `modules/diagnostico-hojas/modelo-web/` contiene el GraphModel y sus tres archivos de pesos; `vendor/tf.min.js` contiene TensorFlow.js 4.22.0. La interfaz carga el modelo una sola vez, recorta y redimensiona a 224 × 224, comprueba localmente la apariencia de hoja, aplica la normalización de MobileNetV2 y clasifica las tres clases en el navegador. `/api/predict` permanece únicamente como respaldo y el guardado descarga la foto localmente cuando `/api/uploads` no está disponible.

Para el uso directo mediante `file://`, el modelo y las etiquetas también están empaquetados en `modelo-web/model-embedded.js`. Así se evita el bloqueo del navegador a `fetch` sobre archivos locales. El archivo se regenera con `node modules/diagnostico-hojas/build-embedded-model.mjs`.

Se verificó la carga desde `server.py` y desde un servidor de archivos estáticos. Las probabilidades del GraphModel coincidieron con las del modelo Python con una diferencia menor a 0,000001. El control visual de hoja quedó como advertencia y no como bloqueo: el modelo siempre entrega una clasificación para toda imagen válida.

## Objetivo pendiente

Evitar definitivamente el mensaje recurrente **“Análisis no disponible”**. La causa comprobada es que la interfaz llama a `/api/predict`, pero el servidor Python deja de estar activo. La solución elegida es ejecutar el modelo directamente en el navegador con TensorFlow.js, sin depender de un puerto ni de una consola abierta.

## Estado confirmado

- El modelo Keras original sí funciona desde Python.
- La clasificación de una imagen con hoja devolvió correctamente “Posible tizón tardío”.
- Una imagen sin hoja devuelve `leaf_not_detected` y la interfaz muestra una indicación breve.
- La conversión directa del modelo falló porque contiene una capa de entrenamiento `aumento_datos` con `RandomFlip`, `RandomRotation` y `RandomZoom`.
- Ya se construyó y exportó una versión exclusiva para inferencia, omitiendo `aumento_datos` y conservando MobileNetV2, pooling, dropout en modo inferencia y la capa Dense con sus pesos.

## Artefacto listo para continuar

La versión limpia exportada está en:

`C:\Users\NATHALY\AppData\Local\Temp\papa-inference-saved`

Se verificó que contiene:

- `saved_model.pb`
- `fingerprint.pb`
- `assets/`
- `variables/`

La carpeta `captura-camara-pc/modelo-web` todavía no contiene el modelo final convertido.

## Cambios y dependencias de la sesión

Dentro de `env` se instalaron únicamente como herramientas de conversión:

- `tensorflowjs==4.22.0 --no-deps`
- `tf-keras==2.20.1 --no-deps`

No deben agregarse a `captura-camara-pc/requirements.txt`; no serán necesarios para ejecutar la aplicación una vez convertido el modelo.

TensorFlow.js importa opcionalmente `tensorflow_decision_forests`, `tensorflow_hub` y `jax`, aunque no se usan para este modelo. Se comprobó que pueden suplirse temporalmente con módulos simulados al invocar el conversor.

## Siguiente paso exacto

1. Convertir `C:\Users\NATHALY\AppData\Local\Temp\papa-inference-saved` a `captura-camara-pc/modelo-web` usando el mismo envoltorio temporal de módulos simulados empleado en la sesión.
2. Verificar que se generen `model.json` y los archivos `.bin`.
3. Incorporar localmente `tf.min.js` de TensorFlow.js 4.22.0 en `captura-camara-pc/vendor/`.
4. Añadir el script a `captura-camara-pc/index.html` antes de `app.js`.
5. Modificar `captura-camara-pc/app.js` para:
   - cargar `modelo-web/model.json` una sola vez;
   - recortar la imagen al centro y redimensionarla a 224 × 224;
   - comprobar en el navegador que haya una hoja;
   - normalizar con MobileNetV2: `pixel / 127.5 - 1`;
   - ejecutar el GraphModel y mapear las tres clases de `model-labels.json`;
   - mantener como respaldo opcional `/api/predict`, pero no depender de él;
   - descargar la foto localmente si `/api/uploads` no existe.
6. Permitir en `server.py` servir de forma segura `modelo-web/` y `vendor/` cuando se use el servidor integrado.
7. Probar tanto una hoja real como una imagen sin hoja y comparar la salida web con Python.

## Archivos relevantes ya modificados antes de este punto

- `captura-camara-pc/app.js`
- `captura-camara-pc/index.html`
- `captura-camara-pc/server.py`
- `captura-camara-pc/model-labels.json`
- `captura-camara-pc/requirements.txt`
- `INICIAR_PROYECTO.bat`
- `Dockerfile`
- `compose.yaml`
- `.dockerignore`

Al retomar, leer este archivo primero y continuar desde la conversión del SavedModel limpio; no repetir el diagnóstico inicial.
