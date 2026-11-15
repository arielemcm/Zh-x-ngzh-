# Estructura del proyecto

Esta organización separa el código que se ejecuta, los datos, los modelos, la documentación y los archivos históricos. El objetivo es que una captura o un experimento no se confunda con una dependencia de producción.

```text
proyecto/
├── index.html
├── css/                         Estilos de la portada
├── js/                          Lógica de la portada
├── assets/                      Recursos visuales compartidos
├── modules/
│   ├── diagnostico-hojas/       Cámara y análisis de hojas
│   └── mapa/                    Mapa y procesamiento geográfico
├── data/
│   └── agricultura/             Datos consumidos por la aplicación
├── models/
│   └── papa-clasificador-keras/ Modelo original del servidor
├── tests/
│   └── browser/                 Pruebas de interfaz
├── docs/
│   ├── continuidad/             Decisiones y puntos de trabajo
│   ├── referencias/             Material externo de consulta
│   └── evidencias/              Capturas de verificación
├── prototipos/                  Experimentos no activos
└── archivo/                     Versiones anteriores
```

## Responsabilidad de cada área

- La raíz contiene solamente entradas y configuración global: `index.html`, `Dockerfile`, `compose.yaml`, el lanzador y los archivos de documentación general.
- `modules/` contiene funciones completas que pueden evolucionar de forma independiente, pero se integran con la portada.
- `data/` guarda información que la aplicación lee. No contiene imágenes de diseño ni resultados temporales.
- `models/` guarda modelos de aprendizaje automático originales. Las versiones preparadas para el navegador permanecen dentro del módulo que las consume.
- `docs/evidencias/` conserva capturas; ninguna captura debe ser necesaria para ejecutar la aplicación.
- `tests/` contiene automatización, no datos de producción.
- `prototipos/` y `archivo/` no se cargan desde la aplicación activa.

## Reglas para mantener el orden

1. Una nueva función completa debe entrar en `modules/<nombre>/`.
2. Los recursos reutilizados por varias pantallas deben ir en `assets/`.
3. Los datos consumidos en tiempo de ejecución deben ir en `data/` y usar nombres descriptivos.
4. Las capturas de revisión deben ir en `docs/evidencias/<componente>/`.
5. Los archivos temporales, perfiles del navegador, cachés y `__pycache__` no deben versionarse.
6. Al mover una ruta se deben actualizar conjuntamente HTML, JavaScript, servidor, pruebas, Docker y documentación.

## Rutas críticas

- Portada: `/index.html`
- Diagnóstico: `/modules/diagnostico-hojas/`
- Mapa integrado: `/modules/mapa/map-data.js` y `/modules/mapa/script.js`
- Datos agrícolas: `/data/agricultura/informacion_agricola_la_paz.json`
- Modelo del servidor: `/models/papa-clasificador-keras/`

El servidor de diagnóstico mantiene temporalmente la ruta antigua `/captura-camara-pc/` como compatibilidad, pero el código activo y la documentación utilizan la ruta nueva.
