# Plan de mejoras para la continuidad del formulario

> Documento de continuidad: al retomar el proyecto, leer este archivo antes de implementar las correcciones. Este análisis se guardó sin modificar todavía la página ni el formulario.

Leí completo `docs/PROMTP.pdf` y revisé el formulario actual, sus estilos y las capturas de los prototipos.

## Estado de implementación guardado — 14 de noviembre de 2026

Este bloque contiene el estado vigente del proyecto. El diagnóstico original se conserva debajo únicamente como referencia histórica.

### Avance consolidado

- La primera pregunta tiene el título separado del mapa, el formulario centrado y una jerarquía estable.
- El mapa está integrado con el paisaje, con una leyenda cartográfica ligera y menos tarjetas, sombras y bordes.
- Las tres preguntas comparten el mismo ancho, encabezado editorial, fondo, progreso y superficie de trabajo.
- Las preguntas 2 y 3 tienen una distribución interior más compacta, imágenes grandes y menos espacio vacío.
- El paisaje montañoso con el lago Titicaca permanece detrás del formulario.
- Julián está situado abajo a la derecha, detrás del contenido, con parpadeo y luz del celular; las aves siguen activas.
- La transición intermedia que mostraba “Primera pregunta” fue eliminada por decisión de diseño. El botón final lleva directamente al formulario después de la animación de la pala.
- Las etiquetas flotantes Papa, Quinua y Haba fueron retiradas de la escena principal.
- El cierre “Comienza tu nueva experiencia agrícola” está centrado y utiliza un degradado claro con respaldo oscuro para conservar el contraste.
- El botón final dice “Iniciar”, usa la tipografía `Newsreader` y tiene un efecto magnético para cursor. En táctil y con movimiento reducido permanece estable.
- El formulario inferior permanece completamente oculto hasta pulsar “Iniciar”; no aparece por desplazamiento ni al abrir directamente su ancla.

### Punto 4 — Completado

Se redujeron las “tarjetas dentro de tarjetas” y se unificó el diseño de las tres preguntas alrededor del sistema visual de la pregunta 1.

### Punto 5 — Completado

[Objetivo]

Dar más personalidad a las preguntas 2 y 3 mediante controles visuales relacionados con la agricultura.

[Estado actual]

Completado el 14 de noviembre de 2026. La pregunta 2 usa un selector visual de semillas con controles de radio nativos, imágenes y descripción breve. La pregunta 3 muestra la secuencia dinámica `cultivo anterior → descanso del suelo → próxima siembra`. Ambos estados se restauran desde `sessionStorage` y conservan la navegación y el resumen final.

[Alcance]

- Cambiar:
  - Pregunta 2: sustituir el selector desplegable por una selección visual de semillas con imagen, nombre y descripción.
  - Pregunta 2: destacar claramente la opción elegida y conservar el estado actual del formulario.
  - Pregunta 3: representar la rotación como una secuencia visual: `cultivo anterior → descanso del suelo → próxima siembra`.
  - Integrar ambas interacciones con la lógica y el almacenamiento existentes.
- No cambiar:
  - El paisaje, Julián y las aves.
  - La estructura editorial compartida por las tres preguntas.
  - El mapa y la lógica de la pregunta 1.
  - La navegación y el resumen final.

[Restricciones]

Evitar tarjetas genéricas o una apariencia de catálogo comercial. Las imágenes deben tener presencia suficiente y los controles deben funcionar con teclado, táctil y movimiento reducido.

[Criterios de finalización]

- La pregunta 2 permite elegir una semilla sin depender de un desplegable tradicional.
- La pregunta 3 explica visualmente el propósito de la rotación.
- Los estados de selección, avance, regreso y resumen final siguen funcionando.
- No hay desbordamientos en escritorio ni móvil.
- La accesibilidad de teclado, foco y movimiento reducido queda verificada.

[Informe]

Orden previsto de ejecución:

1. Diseñar e implementar el selector visual de semillas.
2. Conectarlo con la lógica y `sessionStorage` existentes.
3. Construir la secuencia visual de rotación.
4. Verificar navegación, selección, accesibilidad y responsive.

### Archivos principales del estado actual

- `index.html`: estructura de la historia y las tres preguntas.
- `css/refinements.css`: cierre de la historia, botón magnético y estilos complementarios.
- `js/script.js`: animación principal, botón magnético y entrada al formulario.
- `css/onboarding.css`: paisaje y sistema visual compartido del formulario.
- `js/onboarding.js`: navegación, selección y almacenamiento de respuestas.

## Diagnóstico

El formulario no está mal diseñado, pero se siente como una aplicación distinta después de la portada:

- La portada es narrativa, atmosférica y protagonizada por Julián.
- Al entrar al formulario, Julián desaparece y la experiencia se convierte en un panel beige con controles.
- La primera pregunta tiene fuerza por el mapa, pero las preguntas 2 y 3 vuelven a una composición de “tarjeta de formulario”.
- El progreso con círculos y las cajas repetidas se acercan visualmente a un dashboard, algo que el propio PDF pide evitar.
- En algunas capturas el título queda oculto detrás de las opciones del mapa. Esto rompe la jerarquía y hace que el formulario parezca ensamblado por capas.
- Se usan demasiados contenedores claros sobre otro fondo claro. Hay poca profundidad, contraste y ritmo visual.

## Qué conviene tomar del PDF

El PDF propone una estética cinematográfica editorial: títulos grandes, composición asimétrica, profundidad, parallax, iluminación ambiental, pocos contenedores y transiciones suaves.

Sin embargo, no recomiendo copiar literalmente su paleta azul noche, violeta y coral. La portada actual ya tiene una identidad propia: acuarela, altiplano, marfil, tierra, gris y rojo. Cambiar el formulario a un ambiente nocturno haría todavía más evidente la separación.

La mejor dirección sería una versión “editorial cinematográfica del altiplano”: aplicar los principios del PDF utilizando la identidad visual que ya tiene la portada.

## Mejoras prioritarias

### 1. Crear una transición real entre historia y formulario

Esta es la mejora más importante.

Al terminar la historia, el paisaje no debería desaparecer bruscamente. Podría permanecer fijo mientras:

- Julián guarda el celular o toma la pala usando las poses que ya existen en `assets`.
- El texto “Comienza tu nueva experiencia agrícola” se transforma en “Primera pregunta”.
- La cámara baja visualmente hacia el terreno.
- El mapa aparece desde el paisaje, como una interpretación del territorio que Julián está observando.

Así el usuario no siente que salió de la historia para abrir un formulario: siente que la historia continúa.

### 2. Mantener a Julián durante las tres preguntas

El PDF pide “el mismo viajero con un leve movimiento”. Ya existen suficientes poses del agricultor para hacerlo sin generar otro personaje.

Podría aparecer:

- En la pregunta 1, observando el territorio o el mapa.
- En la pregunta 2, sosteniendo o mirando la semilla elegida.
- En la pregunta 3, trabajando el suelo o marcando un surco.

Debe funcionar como presencia narrativa secundaria, no como decoración grande que compita con los campos.

### 3. Convertir las preguntas en capítulos visuales

Las tres preguntas deberían compartir una estructura narrativa:

1. **Tu territorio** — paisaje y mapa.
2. **Tu próxima siembra** — semillas y futuro.
3. **La memoria del suelo** — rotación e historial.

El indicador superior podría dejar de parecer un stepper de aplicación y convertirse en tres pequeños capítulos editoriales, unidos por una línea semejante a un surco.

### 4. Reducir las “tarjetas dentro de tarjetas”

El mapa ya es el elemento principal. No necesita estar dentro de tantos bordes y fondos.

Recomiendo:

- Un mapa más integrado con el paisaje.
- Opciones de zona más ligeras, semejantes a una leyenda cartográfica.
- El panel “Tu selección” como una anotación editorial sobre el mapa.
- Menos sombras y bordes; más separación mediante escala, posición y contraste.

Esto coincide directamente con la instrucción del PDF de evitar tarjetas genéricas y contenedores innecesarios.

### 5. Dar más personalidad a las preguntas 2 y 3

Actualmente dependen demasiado de un selector tradicional y una caja informativa.

Para “¿Qué deseas sembrar?” sería mejor mostrar una selección visual:

- Fotografía o ilustración de cada semilla.
- Nombre y una breve característica.
- Una opción protagonista y las demás como una banda desplazable.
- Al seleccionar, la semilla puede elevarse suavemente y aparecer una pequeña descripción.

Para “¿Qué sembraste antes?” se puede utilizar una visualización sencilla de rotación:

`Cultivo anterior → descanso del suelo → próxima siembra`

Esto haría que la tercera pregunta explique el propósito de la respuesta y no parezca solamente otro campo de texto.

### 6. Corregir la jerarquía de la primera pregunta

El título “¿En qué zona está tu parcela?” debe tener su propio espacio y nunca quedar detrás de las opciones.

La composición más sólida sería:

- Título monumental en la parte superior izquierda.
- Explicación breve al costado.
- Mapa debajo, ocupando la mayor parte de la pantalla.
- Leyenda de zonas sobre un borde del mapa, sin cubrir el título.
- Confirmación anclada en la esquina inferior derecha.

### 7. Ajustar botones al estilo editorial

Los botones actuales son bastante redondeados. El PDF pide botones rectos o ligeramente redondeados.

Podrían ser:

- Fondo carbón o marfil.
- Radio pequeño, de aproximadamente 6–10 px.
- Flecha separada por una línea fina.
- Hover con desplazamiento leve de la flecha.
- Sin elevaciones pronunciadas ni efectos brillantes.

### 8. Añadir profundidad sin sobrecargar

Podemos introducir:

- Viñeta muy suave en los bordes.
- Papel y acuarela con diferentes velocidades de parallax.
- Niebla o luz ambiental tenue.
- Sombras largas y difuminadas.
- Movimiento mínimo del paisaje.
- Transiciones por fundido y desplazamientos de 15–25 px.

No hace falta agregar muchos objetos. La profundidad debería venir de las capas, no de más componentes.

## Dirección que recomiendo

Mantendría la estética actual de la portada y la llevaría al formulario con este concepto:

> “El formulario es la continuación del recorrido de Julián por su parcela, no una interfaz colocada debajo de la historia”.

La prioridad debería ser:

1. Transición portada–formulario.
2. Permanencia de Julián y el paisaje.
3. Corregir el solapamiento del título.
4. Unificar visualmente las tres preguntas.
5. Rediseñar los selectores de semillas.
6. Refinar botones, progreso y microanimaciones.

Con esas decisiones el formulario dejaría de sentirse soso sin convertirlo en una landing genérica ni romper la identidad que ya construyó la página principal.
