# Formulario de cosecha y transporte

Interfaz integrada para planificar la distribución de una cosecha desde Achacachi. El formulario obtiene el catálogo desde `/api/logistica/catalogo` y envía los datos a `/api/logistica/planificar`.

Debe abrirse mediante `INICIAR_PROYECTO.bat` o ejecutando el servidor principal. Abrir el HTML directamente no permite utilizar la API.

El cálculo utiliza:

- Producción histórica de `modules/logistica/produccion_achacachi.csv`.
- Mercados de `modules/logistica/mercados_bolivia.csv`.
- Demanda, precios y costos de `modules/logistica/demanda_precios.csv`.
- Rutas de OSRM/OpenStreetMap con estimación geográfica automática como respaldo.

La demanda, los precios y los costos comerciales incluidos actualmente están marcados como simulados. La interfaz lo informa antes de calcular y los resultados no deben utilizarse como cotización comercial sin reemplazar esos datos.
