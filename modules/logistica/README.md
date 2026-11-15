# Motor agrologístico

Planificador heurístico de distribución agrícola desde Achacachi. No es un modelo de aprendizaje automático: compara margen, demanda, capacidad y costo de transporte, y construye viajes rentables mediante inserción de destinos.

## Integración activa

El servidor de `modules/diagnostico-hojas/server.py` importa este paquete y publica:

- `GET /api/logistica/estado`
- `GET /api/logistica/catalogo`
- `POST /api/logistica/planificar`

La interfaz activa está en `modules/formulario-cosecha/`. `modules/logistica/index.html` se conserva como interfaz autónoma de referencia.

## Fuentes

- `produccion_achacachi.csv`: campañas y producción por cultivo.
- `mercados_bolivia.csv`: centros urbanos y coordenadas aproximadas.
- `demanda_precios.csv`: demanda, precios y costos. En la versión actual, sus 70 registros son simulados.
- `parametros.json`: capacidad, consumo, diésel y límites del planificador.
- `fuentes.csv`: procedencia y limitaciones declaradas.

## Rutas

El modo principal consulta la matriz de OSRM/OpenStreetMap y conserva el resultado en memoria durante seis horas para evitar solicitudes repetidas. Si OSRM falla o supera el tiempo de espera, la API integrada utiliza automáticamente una estimación geográfica y lo advierte en la respuesta.

El perfil de OSRM es `driving`; no representa restricciones específicas de peso, altura o circulación de camiones.

## Entorno

No se debe utilizar ni versionar `modules/logistica/env/`, porque los entornos virtuales no son portables entre computadoras. Las dependencias necesarias están en `modules/diagnostico-hojas/requirements.txt` y se instalan junto con el servidor principal.
