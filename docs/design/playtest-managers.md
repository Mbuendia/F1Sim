# Playtest comparativo: iGP Manager, Race Manager y F1Sim

Fecha: 30/09/2026. Prueba de escritorio en navegador, realizada con cuentas autenticadas y recursos virtuales gratuitos. Este informe amplía `referencias-visuales.md`: aquí se distinguen los flujos realmente ejecutados de los que quedaron bloqueados.

## Cobertura real

| Producto | Flujo | Estado | Evidencia observada |
| --- | --- | --- | --- |
| F1Sim | Portada, selector de compuesto, paddock, selección de circuito, formación, salida y carrera | Probado | La rueda responde al compuesto y la entrada al paddock es clara. En carrera, telemetría, muro y dock pueden cubrir gran parte del circuito; ocultar telemetría mejora mucho la lectura. |
| F1Sim | Selección de coche y orden de neumático | Probado | Seleccionar un rival cambia el seguimiento y el dock. El muro mantiene los dos coches propios. Cambiar el compuesto de ALO actualiza su estado antes de enviar la orden. |
| iGP Manager | Inicio, selección de carrera, sprint, coches, equipo y tutorial de personal | Probado | Navegación global por cinco áreas, fichas detalladas bajo demanda y tutorial contextual sobre el control real. La pantalla sprint muestra próximas salidas, participantes, premio y características de pista. |
| iGP Manager | Carrera pública | Bloqueado | La inscripción mostraba coste 0, pero la cuenta tenía saldo virtual negativo y el juego respondió que no había dinero suficiente. |
| iGP Manager | Sala privada | Parcial | Se creó una sala de Austria de 9 vueltas y se completó su tutorial de combustible, neumáticos y condición. La salida requería más mánagers; no se enviaron invitaciones. |
| Race Manager | Alta del equipo, liga, patrocinio, investigación, mejora del coche y sede | Probado | Se creó `F1Sim Test` con base en España, se unió a Horizon Racing y se completó la licencia de principiante, 8/8. |
| Race Manager | Práctica, estrategia y sprint contra nueve bots | Probado | Vuelta de práctica con neumático blando, stint de cinco vueltas, cámara con zoom/restauración y órdenes en vivo de ritmo y ERS. Kessel terminó P10, a 28,775 s. |
| Race Manager | Preparación completa de un GP | Probado | Práctica en lluvia para ambos pilotos, tiempos y consumo visibles, y dos estrategias de 60 vueltas confirmadas. El juego habilita la estrategia de cada coche después de registrar su práctica. |

Cambios persistentes realizados en Race Manager: equipo y liga creados, patrocinador Speed Tires firmado, investigación de aerodinámica iniciada, motor en mejora, estación meteorológica en construcción y licencia de mánager completada. Para el siguiente GP quedaron ambos pilotos con dos stints de 30 vueltas, neumático intermedio y motor en modo equilibrado; Kessel marcó 2:02.601 y Saleh 2:01.987 en práctica. No se hicieron compras con dinero real ni se enviaron mensajes a otros jugadores.

## Hallazgos, por prioridad

### P0 — La carrera de F1Sim pierde demasiada pista útil

**Qué ve el jugador.** Con telemetría, muro y dock abiertos, el circuito queda fragmentado por varias capas. A 1280 × 720 el problema domina la experiencia. Al ocultar telemetría, la pista vuelve a ser legible, lo que demuestra que el render no es el problema principal: lo es la ocupación persistente de la interfaz.

**Reproducción.** Portada → Entrar al paddock → Entrar en pista → iniciar carrera → abrir telemetría y muro.

**Comparación.** Race Manager reserva una columna estrecha para posiciones y un bloque único de órdenes abajo. La ayuda se puede plegar; al hacerlo, la mayor parte del encuadre vuelve a ser pista. iGP también concentra cada decisión en pantallas o fichas concretas.

**Adaptación.** Implementar una composición estable: clasificación compacta a la izquierda, estado global arriba y muro propio abajo. Telemetría detallada cerrada inicialmente y sustituyendo otra región secundaria cuando se abra. Mantener el Canvas visible como superficie dominante.

### P0 — Estado y órdenes del mismo piloto deben vivir juntos

**Qué ve el jugador.** F1Sim reparte contexto entre clasificación, etiquetas sobre el circuito, muro y dock. Al seguir a VER, el dock cambia a VER mientras el muro continúa mostrando ALO y STR. Es funcional, pero obliga a reconstruir mentalmente quién recibe cada orden.

**Comparación.** Race Manager agrupa en una sola franja identidad, posición, condición, neumático, temperatura, boxes, ritmo y ERS. El botón activo cambia de color y la energía responde inmediatamente. iGP presenta ambos pilotos juntos en el resumen y abre sus atributos, historial y contrato solo al pedirlos.

**Adaptación.** Mantener dos bloques equivalentes para ALO y STR con neumático, condición, hueco relevante, ritmo y boxes. El seguimiento de un rival debe ser una capa de cámara claramente separada, sin convertirlo en destinatario de órdenes.

### P1 — Enseñar sobre la acción, no antes de llegar a ella

**Qué ve el jugador.** Race Manager guía cada paso con un objetivo visible, resalta el control exacto y confirma el resultado. En práctica, una vuelta devuelve tiempo, desgaste y combustible estimados, además de seis mensajes junto a los ajustes. El coste es una iniciación larga: liga, patrocinador, investigación, coche y sede antes del debut.

**Adaptación.** Llevar al jugador de F1Sim a pista pronto. Mostrar ayudas breves la primera vez que se abre ritmo, ERS o boxes, ancladas al control y con confirmación visual. Evitar una secuencia obligatoria de modales o tareas económicas.

### P1 — La información secundaria debe cerrarse de verdad

**Qué ve el jugador.** La parrilla, los consejos y la telemetría enriquecen la decisión, pero en Race Manager la parrilla inicial y la clasificación duplican información hasta que empieza la carrera; los consejos ocupan un cuarto de pantalla hasta plegarlos. iGP evita parte de esa acumulación mediante pestañas y diálogos.

**Adaptación.** Una sola representación persistente de posiciones. Detalles de neumáticos, eventos, sectores y estadísticas aparecen bajo demanda y conservan el estado durante la carrera. Al abrir un detalle en pantalla estrecha, sustituye otro panel y ofrece regreso explícito.

### P1 — La preparación debe conectar pronóstico, decisión y consecuencia

**Qué ve el jugador.** Race Manager presenta circuito, clima y formato junto a piloto, setup y estrategia. La práctica devuelve una estimación utilizable; la estrategia muestra vueltas cubiertas, stint y desgaste previsto antes de confirmar. iGP resume combustible estimado y seis compuestos en la sala.

**Adaptación.** En F1Sim, reunir antes de la salida: clima, compuesto, vueltas previstas, desgaste esperado y coste de la parada. Evitar desplegar datos del coche o del circuito que no cambien la decisión inmediata.

### P2 — Controles de cámara pequeños, previsibles y reversibles

**Qué ve el jugador.** Race Manager ofrece zoom +, zoom − y restaurar en la barra superior. La vuelta al encuadre general es explícita.

**Adaptación.** Mantener seguimiento, zoom y restauración en un grupo compacto. Hacer visible qué coche está seguido y conservar la selección al abrir o cerrar paneles.

### P2 — La profundidad de gestión no debe invadir la carrera

iGP y Race Manager dedican áreas completas a personal, contratos, investigación, patrocinadores y sede. Es profundidad útil para su propuesta, pero trasladarla al HUD de F1Sim aumentaría la saturación.

**Adaptación.** Paddock como resumen con selección de piloto y circuito; estadísticas completas en detalle. Los controles de prueba (SC, bandera roja y equivalentes) en un menú secundario de desarrollo, cerrado inicialmente y fuera del flujo principal.

## Dirección visual recomendada

- Mantener grafito, blanco y rojo como sistema principal. Usar color de compuesto y estados únicamente donde comunican una decisión.
- Portada con la rueda grande y funcional como fondo, menor contraste y presencia; contenido frontal translúcido, texto opaco y una sola acción principal.
- En carrera, superficies oscuras más opacas y compactas para asegurar lectura sobre el circuito. Reservar la transparencia intensa para la portada.
- Tipografía con jerarquía clara y cuerpo mínimo legible; evitar mayúsculas condensadas en textos largos.
- Animar cambios de orden, selección y alerta con transiciones breves. Evitar movimiento ambiental permanente en paneles de decisión.

## Contrato propuesto antes de implementar

Estas recomendaciones todavía no modifican la aplicación. Conforme a las reglas del proyecto, la siguiente fase debe acordar tests ejecutables para: composición inicial de paneles, conservación del coche seguido, destinatario de órdenes, apertura exclusiva de detalles, persistencia durante una carrera, reinicio en carrera nueva y ocultación del menú de desarrollo.
