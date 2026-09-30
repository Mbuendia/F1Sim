# Plan de implementación del rediseño de F1Sim

Contexto transferible a una IA implementadora · 30/09/2026

## Encargo y fuentes de verdad

Rediseñar la **experiencia de escritorio** de F1Sim según [las decisiones aceptadas](grill-redesign.md), [el playtest autenticado](playtest-managers.md) y [las referencias visuales](referencias-visuales.md). La meta es que el circuito ocupe la mayor parte del espacio, que el director de equipo encuentre de inmediato las órdenes de sus dos pilotos y que el resto de información esté disponible bajo demanda. Conservar la rueda interactiva de la portada como fondo visual grande y discreto. Mantener los controles de prueba de SC y bandera roja en un menú secundario cerrado por defecto.

Este trabajo corresponde al bloque **R29–R34** del Sprint 2.9 y resuelve **R39** dentro de R30/R31. Consultar `DASHBOARD.md` para su estado vigente antes de editar; no marcar tareas o sprints completos sin cumplir sus criterios. La consulta móvil MOB01, la física y reglas nuevas R01–R28, nuevos escenarios, cuentas, economía y carreras 3D quedan fuera del alcance de este rediseño. No importar diseños, imágenes o código de los juegos comparados.

`AGENTS.md` rige el trabajo: localizar y acordar el contrato de tests antes de modificar funcionalidad; escribir los tests ejecutables que falten, demostrar el fallo esperado y **separar esa fase de la implementación**. Durante la implementación no alterar tests acordados para conseguir un PASS. Validar módulos afectados y consumidores; usar `--all` al integrar el bloque transversal. La IA puede preparar código y pruebas en fases revisables, pero debe detener la escritura de implementación hasta que el contrato de tests haya sido revisado con el usuario conforme a esa regla. Las decisiones de diseño recogidas en `grill-redesign.md` ya están aceptadas: no reabrirlas.

## Resultado que debe quedar al final

| Superficie | Vista habitual | Detalle accesible |
| --- | --- | --- |
| Portada | Rueda 3D grande al fondo, marca y botón «Entrar al paddock» dominantes, cinco compuestos reconocibles | Sin navegación por clic en fondo o rueda; Enter/Espacio solo cuando no interfieran con un control enfocado |
| Paddock | Piloto y circuito seleccionados, trazado, clima o datos disponibles para decidir y botón estable «Entrar a pista» | Atributos, estadísticas e historial en consulta voluntaria |
| Carrera | Circuito, barra de vuelta/estado/bandera/pausa/velocidad/cámara, clasificación de 20 coches y muro de dos pilotos | Telemetría, sectores, historial y coche consultado en un panel secundario cerrable |
| Muro | Dos bloques equivalentes con identidad, posición, diferencia útil, neumático/condición, ritmo y acceso a boxes | Selector y confirmación de parada para cada coche dentro del espacio del muro; datos técnicos extensos aparte |
| Desarrollo | Ningún botón de prueba en barra o muro | «Herramientas de desarrollo» → desplegar/retirar SC y forzar bandera roja, etiquetados como pruebas |

La clasificación es la única lista persistente de posiciones. El detalle de un rival no cambia el destinatario de las órdenes del equipo. Abrir o cerrar consultas no pausa, no altera la velocidad, no reinicia selecciones ni mueve controles esenciales. Una carrera nueva vuelve a la vista esencial. El estado real de SC/VSC/roja permanece visible aunque sus herramientas manuales estén ocultas.

## Mapa del código actual

- `src/App.tsx` posee las vistas `landing/home/race`, el coche seleccionado, ambos laterales, cámara, pausa, velocidad y estado de carrera. `App.module.css` usa laterales rígidos de 310 y 360 px; `bottomDockWrapper` se superpone al Canvas. Aquí debe definirse la composición de áreas y el estado de consulta, sin introducir un segundo estado de simulación.
- `src/components/Leaderboard.tsx` ordena una copia de los coches y muestra posición, piloto, neumático y diferencia. Conservar las 20 filas y la selección de seguimiento. Revisar su accesibilidad: hoy las filas clicables son `div`.
- `src/components/BoxControls.tsx` ya presenta los dos pilotos y conserva compuestos por ID mientras está montado. Reutilizar su lógica de disponibilidad, orden, cancelación, bloqueo y mensajes. `PaceControls.tsx` conserva la orden de ritmo. Evitar que mover o desmontar el muro borre elecciones a mitad de carrera.
- `src/components/BottomTelemetryDock.tsx` muestra velocidad, chasis, neumáticos, ERS/DRS y rivales próximos; ahora repite datos del muro y ocupa otra franja. Reubicar sus capacidades en detalle voluntario o conservar solo un resumen no duplicado.
- `src/components/RightStatsPanel.tsx` contiene telemetría y pista. Su radar procedural no es un pronóstico real. Mostrar datos no disponibles como tales; no inventar predicciones meteorológicas ni estimaciones de parada. `RaceFlagsHUD.tsx`, `SpeedControls.tsx`, `StartLights.tsx` y modales DNF/D20 tienen estados existentes que la nueva composición debe respetar.
- `src/components/LandingPage.tsx` navega al pulsar el contenedor y registra Enter/Espacio globales; pasa `onEnter` a `F1Wheel3D.tsx`, cuyo Canvas también navega por clic. Retirar esas entradas accidentales, conservar giro, inclinación, cinco compuestos y transición. Revisar `LandingPage.module.css` y `F1Wheel3D.module.css` para jerarquía, recorte de rueda y movimiento reducido.
- `src/components/HomeScreen.tsx` tiene lista de pilotos/circuitos, detalle central, resumen lateral e historial inicial. Reorganizar la vista para que selección, trazado y entrada sean primeros; conservar el acceso a los datos actuales. Revisar `HomeScreen.module.css`.
- `src/renderer/Camera.ts` ya ofrece modos, `zoomBy`, seguimiento y `resetToFullTrack`. Aprovecharlo para controles agrupados y restauración explícita; comprobar el encuadre **después** de reservar espacio al muro y a la barra, sobre todo con un coche o SC seguido.
- `src/App.tsx` contiene los dos manejadores de prueba manual de SC y bandera roja. Mover la **presentación** de esos botones sin cambiar sus efectos ni los temporizadores de la simulación. Conservar el comportamiento de D20 y los flujos de formación, salida, pausa, reinicio y podio.

## Secuencia de ejecución

### 0. R29: inventario y contrato de pruebas

Antes de tocar la UI, registrar una matriz de cada función existente → acceso nuevo → atajo actual → componente → caso de prueba. Incluir selección de piloto/circuito, cinco compuestos, entrada y salida de carrera, formación/salida, 20 posiciones, seguimiento, cámara/zoom/restauración, pausa y velocidades, órdenes de ritmo/boxes de ambos pilotos, telemetría, historial, banderas, avisos, D20, reinicio y herramientas manuales. Marcar cualquier mecánica que aún no exista; el rediseño no debe inventarla.

Revisar `tests/modules/race-ui.mjs`, `box-ui.mjs`, `pace-ui.mjs`, `sc-deploy.mjs` y `modal-lifecycle.mjs`; sus pruebas React actuales son sobre todo SSR y no verifican clics, foco ni solapes. Preparar casos de navegador para portada, navegación de paddock, paneles y herramientas de desarrollo, además de las aserciones SSR útiles. Registrar los tests nuevos en `tests/catalog.mjs` con el ID de tarea pertinente. Ejecutarlos **antes de la implementación** y guardar el fallo que confirma el requisito. Presentar el contrato ejecutable para revisión del usuario; después de acordarlo comienza la fase de implementación.

### 1. R30/R39: geometría de carrera y circuito libre

Crear áreas estables para barra superior, clasificación, Canvas y muro, evitando que el muro se dibuje encima del coche seguido o del Safety Car. La referencia inicial de 220–240 px para clasificación, 48–56 px para barra y 140–160 px para muro es una hipótesis de maqueta: ajustar con contenido real en 1024×768, 1366×768, 1440×900 y 1920×1080. Ningún control puede quedar recortado ni aparecer scroll horizontal de la página. Conservar un modo de plegar sin perder acceso a órdenes.

Actualizar el tamaño y encuadre efectivos del Canvas/cámara cuando cambien los paneles. Inspeccionar Barcelona y Mónaco con vista general, coche seguido y SC. Comprobar mediante rectángulos medidos y capturas que el objetivo seguido queda fuera de paneles; un test SSR no acredita este criterio.

### 2. R31: muro de dos pilotos y consulta secundaria

Convertir `BoxControls` en dos bloques operativos equivalentes. Mantener el compuesto montado separado del compuesto solicitado, acuse de orden y estados aceptada/comprometida/ejecutada/cancelada. Mantener la selección y los controles de ambos coches aunque se consulte a un rival. Trasladar la telemetría extensa y los rivales próximos del dock al detalle voluntario. La clasificación de 20 pilotos mantiene sus columnas compactas; al seleccionar un coche, abrir detalle sin crear una segunda lista permanente.

En pantallas estrechas, el detalle sustituye temporalmente la clasificación y tiene «Volver a posiciones»; en las amplias puede coexistir solo si el circuito sigue siendo útil. Conservar coche consultado y pestaña al cerrar/reabrir durante la misma carrera. Reiniciar la consulta y las selecciones pertinentes al iniciar una nueva carrera, sin cambiar la lógica del motor. No usar el coche consultado como objetivo implícito de `BOX` o ritmo.

### 3. R32: estado de carrera, avisos y menú de desarrollo

Consolidar vuelta, bandera, formación/salida, pausa/velocidad y cámara en la barra. La etiqueta de pausa debe mostrar la acción disponible («Pausar» o «Reanudar»). Si no hay diferencia o posición relativa durante formación, indicar ausencia de dato en lugar de declarar «líder» o «último». Reservar una zona estable para avisos breves y hacer visible una incidencia propia junto a su piloto. Conservar modales y tiempos de D20.

Mover SC y bandera roja a «Herramientas de desarrollo» dentro de un menú secundario cerrado inicialmente. Abrir el menú no ejecuta nada; cada botón conserva su llamada actual y muestra claramente que es una prueba. El estado real de bandera/SC sigue en el HUD habitual.

### 4. R30/R33: portada, paddock y sistema visual

Situar la rueda 3D sobredimensionada hacia un lateral, recortada y oscurecida detrás del contenido frontal. Usar una capa translúcida localizada con texto opaco y botón visible sin desplazarse. Conservar la respuesta del compuesto y transición. Reducir partículas y ofrecer alternativa `prefers-reduced-motion`. La rueda y el fondo no activan la entrada; Enter/Espacio solo cuando el foco no esté en un control que tenga su propia acción.

En el paddock, mostrar primero selección activa de piloto/circuito, trazado y entrada estable; fichas, estrategia, estadísticas e historial bajo demanda. Identificar la selección con texto y estado además del color. Usar grafito, blanco suave y rojo de acción; mantener colores semánticos de neumáticos, equipos y banderas. Probar las paletas sugeridas en `referencias-visuales.md` en lugar de tratarlas como valores obligatorios. Reservar Orbitron para marca/títulos cortos; preferir texto operativo legible, de referencia ≥14 px, cifras tabulares, contraste normal ≥4.5:1, foco visible y estados comprensibles sin depender solo del color.

### 5. R34: aceptación de extremo a extremo

Recorrer portada → paddock → formación → salida → carrera → boxes/ritmo → neutralización → final/reinicio en navegador real. Probar selección de rival y vuelta a posiciones sin alterar órdenes; cerrar/reabrir consultas; teclado y puntero; movimiento reducido y zoom del navegador al 200 %. Hacer capturas de los cuatro tamaños, Barcelona/Mónaco, carrera tranquila, consulta de rival, boxes y SC/roja. Comparar la pista libre y la legibilidad con el estado inicial del playtest. Registrar cualquier límite observado, especialmente datos no disponibles.

Ejecutar los módulos funcionales afectados con `node test-suite.mjs --module ID` y sus consumidores. Al integrar el cambio transversal, ejecutar `node test-suite.mjs --all`, `npm run check:tasks`, `npm run build` y `git diff --check`. Registrar por módulo funcionalidad presente/parcial/ausente y PASS/FAIL; no llamar PASS a lo no ejecutado. Solicitar revisión visual del usuario antes de cerrar R34. Actualizar `DASHBOARD.md` solo por los estados realmente completados y sincronizar `index.html` con `npm run sync:tasks` si cambian tareas o casillas.

## Criterios que no se deben negociar durante la implementación

1. Conservar 20 posiciones accesibles y órdenes independientes de los dos pilotos, también al seguir un rival.
2. Ningún panel ni muro debe ocultar el coche seguido o el SC en los cuatro tamaños objetivo; cámara y restauración siguen funcionando.
3. Abrir/cerrar detalles no cambia pausa, velocidad, coche consultado, pestaña ni compuesto preparado durante una carrera. Nueva carrera vuelve a vista esencial.
4. Fondo/rueda no inician navegación; botón y atajos sí. Mantener cinco compuestos, giro y respuesta al puntero con movimiento reducido.
5. Herramientas SC/roja ocultas inicialmente y recuperables; sus efectos, estados reales y temporizadores existentes no cambian.
6. Avisos no roban foco ni desplazan controles. D20 conserva sus decisiones y tiempos.
7. No añadir dependencias de diseño ni ampliar el motor por necesidades de presentación. Los números estimados deben proceder de modelos existentes o figurar como no disponibles.

## Instrucción breve para pegar en otra IA

> Implementa el rediseño de escritorio de F1Sim descrito en `docs/design/plan-implementacion-ui.md`. Lee antes `AGENTS.md`, `DASHBOARD.md`, `docs/design/grill-redesign.md`, `docs/design/playtest-managers.md` y `docs/design/referencias-visuales.md`. Limita el trabajo a R29–R34 y R39. Comienza por la matriz funcional y tests ejecutables; demuestra sus fallos y presenta el contrato al usuario antes de modificar la funcionalidad, conforme a AGENTS.md. Después implementa las fases en orden, conservando simulación, atajos y órdenes de los dos pilotos. Valida módulos pertinentes, build y el bloque transversal completo; revisa la UI real en los cuatro tamaños acordados y Barcelona/Mónaco. Registra hallazgos, resultados y archivos cambiados. No marques una tarea completa ni publiques cambios sin sus criterios de aceptación y el OK que exija el proyecto.
