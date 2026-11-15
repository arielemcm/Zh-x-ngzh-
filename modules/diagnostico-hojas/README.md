# Diagnóstico visual de hojas

Módulo para encender la cámara de la computadora o subir una fotografía, comprobar la calidad visual de la imagen y estimar el estado de una hoja de papa.

## Ejecutar

La forma recomendada es hacer doble clic en `INICIAR_PROYECTO.bat`, ubicado en la carpeta principal. El lanzador inicia el servidor, prepara el modelo y abre:

```text
http://127.0.0.1:8001
```

Desde la carpeta principal también se puede iniciar manualmente:

```powershell
.\env\Scripts\python.exe .\modules\diagnostico-hojas\server.py
```

La portada incluye el botón **Revisar hoja**. El acceso directo al módulo es:

```text
http://127.0.0.1:8001/modules/diagnostico-hojas/
```

## Uso

1. Enciende la cámara o pulsa **Subir imagen**.
2. Toma o selecciona una fotografía JPG, PNG o WebP de hasta 15 MB.
3. Espera el resultado: estado estimado, confianza y alternativas.
4. Guarda la fotografía o selecciona **Tomar otra**.

Las fotografías guardadas por el servidor permanecen en `modules/diagnostico-hojas/uploads/`. Si el servidor no está disponible, el navegador permite descargar la foto localmente.

## Modelos

La clasificación principal se ejecuta en el navegador con TensorFlow.js. El GraphModel convertido está en `modelo-web/`, sus etiquetas están en `model-labels.json` y TensorFlow.js está en `vendor/`.

`modelo-web/model-embedded.js` integra el modelo para que **Subir imagen** también funcione al abrir el HTML directamente mediante `file://`. Si se reemplaza o reconvierte el modelo, la copia integrada se regenera desde la carpeta principal con:

```powershell
node modules/diagnostico-hojas/build-embedded-model.mjs
```

El servidor conserva `/api/predict` como respaldo y carga el modelo original desde `models/papa-clasificador-keras/`. En un alojamiento estático se debe publicar el proyecto completo, incluidos `modules/diagnostico-hojas/modelo-web/`, `vendor/` y los recursos compartidos de `assets/`.

El orden actual de clases es:

1. Tizón temprano.
2. Tizón tardío.
3. Hoja sana.

Este orden debe coincidir con `class_names` utilizado durante el entrenamiento. La predicción es orientativa y no reemplaza el diagnóstico de un especialista.

## Docker

Para ejecutar el servidor en un contenedor:

```powershell
docker compose up --build
```

Después abre `http://127.0.0.1:8001`. El servicio respeta las variables `HOST` y `PORT` proporcionadas por la plataforma.

Antes de clasificar, el navegador evalúa si la hoja se distingue con suficiente color, textura y detalle. Esta revisión genera recomendaciones, pero no bloquea el análisis del modelo.
