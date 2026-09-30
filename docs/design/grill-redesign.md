# Rediseño de F1Sim — entrevista y decisiones

Fecha: 30/09/2026. Referencia revisada: main, ffe2094.

Estado: cuatro rondas aceptadas por el usuario. Definición funcional y dirección visual acordadas; implementación y validación visual pendientes.

Revisión posterior de referencias solicitadas: [comparativa visual de iGP Manager, Race Manager y F1 Manager](./referencias-visuales.md). Complementa estas decisiones con observaciones verificadas y propuestas de composición; sus medidas y ajustes adicionales siguen pendientes de validación en maqueta.

## Decisiones aceptadas

El usuario acepta las recomendaciones de la primera ronda de GrillMe:

1. Priorizar la situación de ambos pilotos frente a sus rivales, neumáticos y próxima parada, y estado de carrera. Sectores, historial y detalle mecánico quedan bajo demanda.
2. Asistencia discreta: cifras esenciales y explicaciones breves basadas en datos reales de la simulación.
3. Estética de muro de competición sobrio, técnico y legible, con recursos de retransmisión para acontecimientos. Tipografía decorativa y animaciones reservadas para momentos concretos.

Se mantienen los acuerdos del brief existente: circuito protagonista, órdenes de ambos pilotos accesibles, funciones y atajos conservados, español y escritorio como alcance. Ocultar significa reducir presencia por defecto; no eliminar capacidades.

## Evidencia revisada

- App abre ambos laterales por defecto. Sus anchuras base suman 670 px (310 + 360); a 1366 px el área central dispone de 696 px antes de considerar sus superposiciones.
- El muro y el dock inferior comparten una capa posicionada sobre el circuito.
- Los laterales ya se pueden plegar. La propuesta debe mejorar la jerarquía inicial y la recuperación del detalle, además de ofrecer cierre.
- BoxControls ya muestra ambos pilotos y conserva selecciones de compuesto por coche mientras permanece montado.
- RightStatsPanel ofrece telemetría y tiempo/pista. Su radar dibuja nubes procedurales: no debe interpretarse como una predicción meteorológica real.

Esta evidencia procede del código y del brief; todavía no se ha realizado una nueva inspección visual en navegador.

## Segunda ronda aceptada

El usuario acepta expresamente las tres recomendaciones:

1. Clasificación completa de los 20 pilotos en formato compacto: posición, identificación, compuesto y diferencia. El detalle se abre al seleccionar un coche.
2. Resumen de ambos pilotos y acceso directo a ritmo y boxes; abrir los ajustes de parada en espacio reservado al muro, sin cubrir el coche seguido ni el Safety Car. Consultar un rival nunca cambia el destinatario de las órdenes del equipo.
3. Avisos compactos sin desplazar controles ni robar foco; acceso voluntario al detalle. Conservar por ahora las decisiones y tiempos de los eventos existentes, incluido D20.

## Tercera ronda aceptada

El usuario acepta expresamente las tres recomendaciones:

1. Consulta en pantallas estrechas: el detalle sustituye temporalmente la clasificación, con retorno explícito, en vez de añadir un tercer panel permanente. En pantallas amplias podrá coexistir si las medidas reales garantizan legibilidad y visibilidad del circuito.
2. Continuidad de consulta: conservar el coche consultado, la pestaña y las selecciones al cerrar y reabrir un panel durante la misma carrera; iniciar una carrera nueva con la vista esencial. Abrir/cerrar no pausa ni cambia la velocidad de la simulación.
3. Portada y paddock: incluirlos en el diseño global con la misma identidad visual. Mantener la portada y su acceso al paddock; priorizar selección de piloto/circuito y entrada a pista en el paddock, llevando atributos, estadísticas e historial a consultas secundarias.

### Petición expresa para la portada

Conservar la rueda y su funcionalidad, situándola grande al fondo. Darle más fuerza visual pero menos protagonismo frente al contenido de la app, que aparece por delante de manera transparente.

Composición aceptada: rueda tridimensional sobredimensionada, desplazada hacia un lateral y parcialmente fuera del encuadre, con iluminación controlada; capa frontal translúcida y degradado oscuro localizado, con textos y botón completamente legibles. No aplicar transparencia al conjunto del texto.

Comportamiento actual verificado en LandingPage/F1Wheel3D: giro automático, inclinación con el puntero, respuesta al pasar sobre la rueda, selector de cinco compuestos y transición de entrada. El clic en la rueda o el fondo entra al paddock; Enter y Espacio también. El selector de compuestos detiene la propagación del clic para no navegar.

## Cuarta ronda aceptada

El usuario acepta expresamente las tres recomendaciones:

1. Navegación de portada: conservar animación, reacción al puntero, selector de compuestos y transición, pero limitar la navegación al botón y atajos existentes, sin interferir con controles enfocados. Se acepta retirar la entrada por clic en la rueda o el fondo.
2. Identidad visual concreta: grafito oscuro, texto marfil/blanco suave y rojo para la acción principal, conservando colores semánticos de equipos, neumáticos y banderas. Mayor contraste y escala para marca/entrada; rueda oscurecida detrás del texto; sin acumulación de partículas, resplandores o animaciones decorativas.
3. Jerarquía de avisos de carrera: vuelta/estado/bandera y pausa/velocidad en una barra estable; estados propios junto a cada piloto; una zona de avisos breves con prioridad para situaciones que requieren atención y acceso al detalle sin aperturas automáticas. Mantener las decisiones temporizadas existentes, incluido D20.

### Herramientas de prueba fuera de la vista principal

Petición expresa del usuario: conservar los botones existentes de prueba, como SC y bandera roja, pero llevarlos a un lugar menos visible.

Ubicación propuesta dentro del diseño acordado: menú secundario de carrera → «Herramientas de desarrollo», cerrado por defecto. El acceso secundario debe tener nombre accesible; los botones de pruebas no aparecen en la barra principal, en el muro ni en los avisos de carrera.

Controles encontrados en App.tsx: desplegar/retirar Safety Car y forzar bandera roja. Se conserva su comportamiento actual y sus llamadas a la simulación. Abrir el menú no ejecuta pruebas; cada acción requiere pulsar su botón identificado como prueba. Los estados reales de SC y bandera roja siguen visibles en la barra de carrera. Esta organización no elimina las herramientas ni requiere introducir nuevas funciones de simulación.

## Síntesis funcional para el rediseño

| Área | Vista inicial | Acceso secundario |
| --- | --- | --- |
| Portada | Marca, entrada al paddock, rueda grande al fondo e interacción de compuestos | Sin información técnica de desarrollo compitiendo con la entrada |
| Paddock | Selección de piloto, circuito y entrada a pista | Fichas, atributos, estadísticas e historial |
| Carrera | Circuito, clasificación compacta de 20 pilotos, barra de estado y muro de ambos pilotos | Detalle del coche consultado, sectores, telemetría e historial |
| Muro | Resumen por piloto y acceso directo a ritmo/boxes | Ajustes de parada en el espacio reservado al muro |
| Avisos | Estado general estable y mensajes breves pertinentes | Consulta voluntaria del detalle; eventos temporizados conservados |
| Desarrollo | Menú secundario cerrado | Botones de prueba existentes, con etiquetas explícitas |

La consulta de un rival y las órdenes del equipo son contextos separados. Los ajustes de presentación no alteran las reglas de carrera ni la física. Los datos desconocidos o no disponibles se muestran como tales; la asistencia discreta no inventa predicciones ni interpreta el radar procedural como previsión real.

## Validación propuesta del diseño

Validar distribución en 1024×768, 1366×768, 1440×900 y 1920×1080 antes de dar por resuelta la falta de espacio. Las cuatro rondas aceptadas constituyen el acuerdo de diseño; queda pendiente definir y acordar el contrato ejecutable antes de implementar.

Criterios observables para ese contrato:

- Sin recortes de controles ni desplazamiento horizontal en los tamaños acordados; texto operativo de referencia de al menos 14 px.
- Coche seguido y SC visibles con el muro abierto; el contenido del muro ocupa espacio reservado.
- Clasificación completa accesible y regreso explícito desde el detalle cuando la sustituye.
- Consultar un rival no cambia el destinatario de ritmo/boxes; órdenes de ambos pilotos accesibles mediante ratón y teclado.
- Cerrar/reabrir consultas conserva piloto y pestaña, sin modificar pausa, velocidad ni selecciones de órdenes. Una carrera nueva comienza con la vista esencial.
- Avisos ordinarios sin robo de foco ni desplazamiento de controles. D20 conserva decisiones y tiempos.
- Rueda con giro, respuesta al puntero, cinco compuestos y transición; fondo sin navegación accidental. Botón y atajos funcionales, sin capturar el teclado de otros controles.
- Herramientas de prueba ocultas inicialmente, recuperables desde su menú; abrirlo no despliega SC ni provoca bandera roja. Las acciones conservan sus efectos actuales.
- Contraste, foco visible y alternativa de movimiento reducido; el color no es el único identificador de compuestos o banderas.
- Revisión real de portada, paddock, Barcelona/Mónaco y estados de carrera. Las pruebas SSR no sustituyen la interacción ni la inspección del Canvas/WebGL.

Archivos previsibles: App.tsx/App.module.css, estilos globales, LandingPage/F1Wheel3D, HomeScreen, Leaderboard, BoxControls/PaceControls, BottomTelemetryDock y RightStatsPanel. Mantener React, CSS Modules, animejs y Three existentes; no introducir dependencias por la propuesta visual.

Módulos existentes localizados para preparar la fase de tests: race-ui, box-ui, pace-ui, sc-deploy y modal-lifecycle; ampliar a consumidores pertinentes según cada cambio. La cobertura concreta de navegación de portada, persistencia de paneles y menú de desarrollo debe revisarse y completarse antes de implementar. En esta entrevista no se han ejecutado tests; no se declara ningún PASS.

## Alcance de esta fase

Entrevista y definición del diseño. Sin cambios en aplicación, motor, tests ni estados del sprint. El contrato ejecutable y la autorización de implementación se resolverán antes de escribir funcionalidades, conforme a AGENTS.md.
