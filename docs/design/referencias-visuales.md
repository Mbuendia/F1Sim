# Referencias visuales para F1Sim

Revisión: 30/09/2026. Complementa el acuerdo de `grill-redesign.md`; las medidas y tratamientos nuevos son propuestas para validar, no cambios implementados.

## Alcance y evidencia

Este documento conserva la primera revisión de páginas públicas y capturas. La prueba posterior de flujos autenticados y carrera está documentada por separado en [playtest-managers.md](playtest-managers.md), para no mezclar observaciones estáticas con comportamiento comprobado.

La comparación con F1Sim parte del código y del brief revisados en esta sesión; todavía falta inspección visual de su ejecución actual. La evaluación utiliza jerarquía, legibilidad, carga informativa y correspondencia entre dato y acción. El [análisis heurístico de Research Skills Framework](https://www.researchskills.net/craft-skills/heuristic-analysis) sirve de referencia metodológica; no sustituye pruebas con jugadores.

## Qué aporta cada referencia

| Referencia observada | Evidencia visual | Aplicación propuesta |
| --- | --- | --- |
| [iGP Manager — Features](https://igpmanager.com/features/) | La captura publicada mantiene una gran superficie de pista y agrupa controles en los bordes; la página promocional combina imágenes grandes con bloques de explicación. | Dar prioridad espacial al circuito y agrupar acciones relacionadas. No trasladar la estructura promocional a la carrera. |
| [Race Manager](https://racemanager.ru/en) | Fondo de circuito oscurecido, titular de gran tamaño y acción principal destacada. | Portada con rueda ambiental, texto contrastado y un acceso claro al paddock. Evitar que la escala del titular desplace el botón fuera del primer encuadre. |
| [F1 Manager — portada](https://www.f1manager.com/) | Identidad deportiva consistente, contraste oscuro/blanco/rojo, marca y contenido audiovisual destacados. | Jerarquía de marca y acción en la portada; identidad común entre pantallas. |
| [F1 Manager — galería, Launch Screenshot 01](https://www.f1manager.com/gallery) | Clasificación lateral, bloques separados para ambos pilotos abajo, controles de tiempo centrales y condiciones de pista en la derecha. Los datos se agrupan sobre superficies oscuras. | Mejor referencia para organizar la carrera. Adaptar la agrupación al Canvas 2D y al acuerdo de reservar espacio al muro, en vez de copiar sus superposiciones o tamaños de texto. |

Captura oficial identificada en la galería: [Launch Screenshot 01](https://cms-cdn.zaonce.net/2024-07/vlt24_screenshot_01_race_a.jpg). Las capturas consultadas no demuestran por sí mismas que un panel se pueda plegar ni cómo conserva su estado.

## Cambios recomendados para F1Sim, por prioridad

### 1. Distribución estable y circuito despejado

Prioridad P0. Barra superior para vuelta, bandera, pausa/velocidad y cámara; clasificación compacta a la izquierda; circuito en el centro; muro en una franja inferior con espacio propio. La consulta secundaria permanece cerrada inicialmente.

Al abrir detalle en una pantalla estrecha, sustituye la clasificación con un regreso explícito, conforme a lo acordado. En una pantalla amplia puede ocupar espacio adicional únicamente después de comprobar que el circuito y los controles mantienen tamaño útil.

Punto de partida de maqueta, no contrato de medidas: clasificación de 220–240 px, barra de 48–56 px y muro de 140–160 px. Veinte filas de 28–30 px, más cabecera, caben en los 712–720 px que quedan bajo la barra en una pantalla de 768 px de alto si la clasificación ocupa toda esa altura. No prolongar la franja del muro bajo la clasificación. Verificar todos los textos reales antes de fijar dimensiones.

### 2. Reunir el estado y las órdenes de cada piloto

Prioridad P0. Dos bloques equivalentes en el muro, con identidad, posición, diferencia relevante, neumático/estado y acceso a ritmo y boxes. Misma alineación y orden de lectura en ambos.

El dock actual debe dejar de repetir esos mismos resúmenes del equipo. Mantener sus capacidades mediante una consulta del coche seleccionado; velocidad instantánea, chasis, detalle de ERS/DRS y rivales cercanos no necesitan ocupar permanentemente una segunda franja completa. Cuando la consulta sea de un rival, identificarlo explícitamente y mantener las órdenes ligadas a los pilotos propios.

El principio es agrupar por decisión del jugador. No dar a cada componente existente una caja permanente simplemente porque ya existe en código.

### 3. Separar transparencia ambiental y superficies de lectura

Prioridad P1. La portada admite rueda y capas translúcidas. La clasificación y el muro necesitan superficies casi opacas para que el asfalto, pianos y coches no alteren la lectura.

Propuesta de paleta para ensayar: fondo `#0D1117`, panel `#171D26`, panel elevado `#222A35`, texto principal `#F2F4F7` y secundario `#B4BECC`. El rojo sirve para la acción principal; los estados tienen su propia semántica. Validar contraste de cada combinación y estado, incluidas acciones deshabilitadas. No declarar accesibilidad a partir de estos hexadecimales.

### 4. Corregir la tipografía operativa antes de añadir decoración

Prioridad P1. Reservar Orbitron para marca o títulos breves. Probar Rajdhani a 16 px en controles y cifras, comparándola con la sans serif ya disponible para párrafos y etiquetas. Cifras tabulares, unidades junto al valor y etiquetas secundarias de al menos 14 px como referencia.

Reducir mayúsculas en frases, espaciado excesivo entre letras, brillos y contornos duplicados. La clasificación puede ser densa por su alineación y columnas bien elegidas, sin recurrir a texto diminuto.

### 5. Portada con rueda ambiental y una única acción dominante

Prioridad P1. Rueda desplazada hacia la derecha, parcialmente recortada por el encuadre; marca y texto breve hacia la izquierda o centro-izquierda. Degradado localizado detrás del contenido, sin volver semitransparentes las letras.

Mantener el selector de cinco compuestos como control secundario identificable. Botón «Entrar al paddock» visible sin desplazamiento en los tamaños objetivo. Mantener giro y respuesta al puntero con alternativa de movimiento reducido. No entrar al pulsar fondo/rueda, según la decisión aceptada. Reducir partículas para no superponer dos focos de movimiento.

### 6. Paddock organizado alrededor de la selección

Prioridad P1. Una composición principal con el piloto elegido y el circuito, su trazado y los datos imprescindibles antes de entrar. Lista de pilotos y circuitos disponible sin convertir todas sus fichas en paneles permanentes.

Identificar selección mediante nombre, borde y estado, no solamente color de equipo. Atributos, estadísticas e historial se consultan aparte. «Entrar a pista» permanece en una ubicación estable mientras se cambia la selección.

### 7. Señales que destaquen por excepción

Prioridad P1. Reservar animación y contraste fuerte para cambios relevantes: orden aceptada, entrada en boxes, cambio de bandera o decisión pendiente. Ritmo y compuesto activos deben reconocerse sin animación continua.

Los avisos breves utilizan una zona estable; las incidencias propias también se reflejan junto al piloto. Conservar por ahora el comportamiento temporizado del D20. No abrir paneles automáticamente ni hacer que una notificación desplace un control bajo el puntero.

### 8. Desarrollo accesible desde un menú secundario

Prioridad P0 por su bajo coste visual y alta claridad. «Herramientas de desarrollo» cerrado por defecto dentro del menú de carrera; ahí permanecen desplegar/retirar SC y forzar bandera roja. El estado real de carrera siempre pertenece a la barra principal.

## Qué no trasladaría de las referencias

- Cabeceras comerciales largas, noticias, comparadores y múltiples llamadas comerciales dentro del juego.
- Todos los paneles de una captura de escritorio grande a una pantalla de 1024×768.
- El tamaño reducido de los textos de un HUD promocional como referencia de legibilidad.
- Transparencia uniforme en datos sobre una pista en movimiento.
- Recursos gráficos ajenos o un cambio a carreras 3D: las referencias orientan la composición, no amplían el alcance del motor.

## Comprobación antes de implementación

Preparar maquetas de portada y carrera en los cuatro tamaños acordados. Usar estados reales: carrera tranquila, consulta de rival, preparación de boxes y SC/bandera roja. Verificar que el jugador puede localizar sus dos pilotos, ordenar boxes y volver de una consulta sin buscar un panel desplazado.

Después, contrastar el contrato ejecutable con tests existentes y añadir la cobertura pendiente en la fase autorizada. Esta revisión solo añade documentación; no modifica aplicación, dependencias, tests ni casillas del sprint.
