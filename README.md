# Experiencia agrícola interactiva

Prototipo web que acompaña al usuario desde una historia parallax hasta un onboarding agrícola interactivo.

## Contenido principal

- Historia parallax con cambios de clima y animación del agricultor.
- Mapa interactivo del municipio de Achacachi.
- Selección de ribera lacustre, llanura altiplánica o puna alta.
- Onboarding de tres preguntas dentro de una misma ventana.
- Diseño adaptable para escritorio y móvil.

## Abrir el proyecto

La entrada principal es `indexprincipal.html`. Se recomienda servir la carpeta con un servidor estático:

```powershell
python -m http.server 8000
```

Después abre `http://localhost:8000/indexprincipal.html`.

## Rama de colaboración

El desarrollo integrado se encuentra en `proyecto-agricola-onboarding`.

Los datos GIS fuente y archivos intermedios pesados no se incluyen en Git. El recurso `parte del mapa/datos_trabajo/hillshade_achacachi.png`, necesario para visualizar el mapa, sí está versionado.
