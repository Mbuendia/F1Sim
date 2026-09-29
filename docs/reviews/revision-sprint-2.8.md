# Revisión personal — Sprint 2.8

29/09/2026. La aceptación de cada punto no modifica las casillas del dashboard. Correcciones parciales no equivalen a tareas completas. Q13/Q19 son evidencia técnica; 2.9 y móvil no están implementados.

## Q12 — Modos de ritmo de ambos pilotos

Estado de entrega: Revisión principal.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Entra a una carrera y confirma la salida. Pon ALO en Push y STR en Save; pausa y reanuda. Si quieres comprobar una neutralización controlada, usa TEST SC en una carrera de prueba.
- Esperado: Cada piloto mantiene su orden. El muro muestra pedido y efectivo; con SC, Push queda limitado a Save y explica Safety Car. Al volver a verde recupera la orden.
- Evidencia: 48 pruebas Q12/boxes/recursos y 35 de banderas: 83 PASS, 0 FAIL; build correcto. Clics reales comprobados.
- Límite: La diferencia exacta de −0,3/+0,4 s por vuelta no está acreditada. El rediseño del muro pertenece a 2.9.
- Mis notas:

## Q9 — Compuesto de la parada

Estado de entrega: Función existente.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Durante carrera, elige un compuesto y pulsa BOX para uno de tus pilotos. Espera hasta completar el servicio.
- Esperado: El compuesto montado coincide con el solicitado; aparece acuse y aumenta el contador de paradas. El cambio no ocurre al pulsar BOX.
- Evidencia: Módulos box-orders, pit-stop y box-ui.
- Límite: Revisión de regresión: figuraba completada anteriormente.
- Mis notas:

## Q10 — Cancelar antes del compromiso

Estado de entrega: Función existente.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Solicita boxes lejos de la entrada y pulsa Stay out. Repite y espera a que aparezca CONFIRMADA.
- Esperado: Antes del compromiso puedes cancelar; después quedan bloqueados cambio y cancelación. Una orden cancelada no reaparece sola.
- Evidencia: Módulos box-orders y box-ui.
- Límite: Una emergencia por pinchazo/desgaste puede causar una parada independiente.
- Mis notas:

## Q11 — Dos pilotos y doble parada

Estado de entrega: Función existente.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Da órdenes distintas a ambos pilotos. En una carrera de prueba, llama a los dos para que coincidan en el cajón.
- Esperado: Controles independientes, compuesto respetado por piloto y segundo coche esperando si el cajón está ocupado.
- Evidencia: Módulos double-stack, box-ui y pit-stop.
- Límite: La coincidencia depende del tráfico; no se garantiza doble parada solo por pulsar ambos botones.
- Mis notas:

## Q1–Q5 — Coches, boxes, cámara y etiquetas

Estado de entrega: Regresión de funciones aprobadas.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: En Barcelona y Mónaco, cambia zoom, rota, selecciona un coche y síguelo durante una parada.
- Esperado: Tamaño coherente con el zoom, entrada/salida de boxes continuas, cámara/clic alineados y etiquetas legibles sin doble escalado.
- Evidencia: Módulos geometry-rendering, pit-lane, world-position y finish-line.
- Límite: Ya existían aprobaciones anteriores: esta tarjeta permite comprobar que los cambios posteriores no las rompen.
- Mis notas:

## Q6 — Barcelona y Mónaco

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Abre los dos circuitos, recorre sus tramos y compara pianos, escapatorias y barreras con distintos zooms.
- Esperado: Aspecto diferenciado, superficies sin cubrir pista/boxes y barreras/pianos sin huecos visuales incoherentes.
- Evidencia: Módulos scenarios y scenario-rendering.
- Límite: Revisar apariencia real: las pruebas SSR no certifican la fidelidad del SVG mostrado en navegador.
- Mis notas:

## Q7 — Anchura y tamaño del coche

Estado de entrega: Corrección parcial.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Observa coches al atravesar cambios de anchura, manteniendo fijo el zoom.
- Esperado: El coche no se agranda al entrar en un tramo ancho; la posición lateral no salta al cambiar de muestra.
- Evidencia: Módulo track-width.
- Límite: Estos casos verdes no certifican todas las capacidades de adelantamiento ni todos los anchos de cada circuito.
- Mis notas:

## Q8 — Trazada y goma

Estado de entrega: Corrección parcial.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Observa curvas izquierdas/derechas y varias vueltas; pausa y reinicia la carrera.
- Esperado: La banda de goma coincide con la trazada, no crece durante pausa y se limpia al reiniciar.
- Evidencia: Módulos racing-line y racing-line-geometry.
- Límite: Trazada geométrica aproximada; evolución gradual, no necesariamente visible en una sola vuelta. No acredita una trazada óptima.
- Mis notas:

## Q14 — SC y reanudación sin retrocesos

Estado de entrega: Corrección parcial.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: En una carrera de prueba activa SC; observa a 1x y 16x. Prueba también bandera roja y reanudación.
- Esperado: Los coches conservan distancia recorrida; no saltan hacia atrás para ordenar el grupo ni reciben neumáticos nuevos al reanudar.
- Evidencia: Módulo neutralization-motion y regresión world-position.
- Límite: No cierra todo Q14: la circulación/reglamentación completa de neutralizaciones sigue pendiente.
- Mis notas:

## Q15 — Banderas azules al aproximarse un líder

Estado de entrega: Corrección parcial.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: En una carrera larga observa a un líder alcanzando a un doblado por detrás, también cerca de meta.
- Esperado: La indicación corresponde a la aproximación física; no exige ceder durante SC/VSC.
- Evidencia: Módulo blue-flags.
- Límite: El caso puede tardar en producirse. Si no aparece, marca Bloqueada, no Aprobada.
- Mis notas:

## Q16 — Combustible, batería y temperatura

Estado de entrega: Corrección parcial.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Compara el mismo piloto en carreras independientes con Push y Save; observa consumo, batería y temperatura donde estén visibles.
- Esperado: Los recursos evolucionan; Push cuesta más que Save. Un depósito vacío no genera combustible ni propulsión desde parado.
- Evidencia: Módulo resources y comparaciones de cinco vueltas en pace-contract.
- Límite: ERS simplificado. Algunos límites requieren pruebas del motor y no un control visible; no se presenta Q16 completo.
- Mis notas:

## Q17 — Evento D20 sin recursos mágicos

Estado de entrega: Corrección parcial.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Cuando aparezca un evento D20, anota neumáticos/temperaturas antes de aceptarlo y después.
- Esperado: Aceptar ofrece información táctica; no monta gomas nuevas ni enfría instantáneamente el coche en pista.
- Evidencia: Módulo luck-rewards.
- Límite: No equivale a completar el catálogo de recompensas ni todo el equilibrio del D20.
- Mis notas:

## Q18 — Reinicio y cambio de circuito

Estado de entrega: Corrección parcial.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Tras dar órdenes y generar un evento, reinicia; vuelve al paddock y cambia de circuito.
- Esperado: Se limpian órdenes previas, goma y evento D20; no se hereda el estado de la carrera anterior.
- Evidencia: Módulo reset-lifecycle; Q12 comprueba reinicio de órdenes.
- Límite: No acredita toda la auditoría de timers React ni toda la reconciliación documental de Q18.
- Mis notas:

## Q13 — Predictor de reincorporación

Estado de entrega: Solo evidencia técnica.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Revisa el informe de tests; el marcador completo de torre/minimapa todavía no forma parte de una entrega terminada.
- Esperado: Existe un cálculo aproximado de pérdida y posición que considera tráfico en los casos probados.
- Evidencia: Módulos rejoin y rejoin-contract.
- Límite: Q13 sigue pendiente como funcionalidad completa. No marcar la tarea completa aprobada por este cálculo aislado.
- Mis notas:

## Q19 — Permisos DRS y cierre al frenar

Estado de entrega: Solo evidencia técnica.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Consulta el informe drs-braking-after.json. La detección positiva se probó con coordenadas sintéticas, no con datos oficiales de circuito.
- Esperado: Permiso por detección, umbral estricto, persistencia y cierre hasta salir de la zona tras frenar.
- Evidencia: 27 PASS entre drs-detection y drs-permissions.
- Límite: Faltan puntos de detección del calendario: el DRS permanece cerrado donde faltan. Q19 no está terminado.
- Mis notas:

## Q6.1 — Escenario Monza

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Monza y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.2 — Escenario Silverstone

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Silverstone y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.3 — Escenario Spa

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Spa y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.4 — Escenario Spielberg

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Spielberg y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.5 — Escenario Interlagos

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Interlagos y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.6 — Escenario Suzuka

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Suzuka y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.7 — Escenario Zandvoort

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Zandvoort y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.8 — Escenario Las Vegas

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Las Vegas y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.9 — Escenario Bahrain

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Bahrain y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.10 — Escenario Baku

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Baku y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.11 — Escenario Melbourne

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Melbourne y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.12 — Escenario Miami

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Miami y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.13 — Escenario Shanghai

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Shanghai y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.14 — Escenario Jeddah

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Jeddah y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.15 — Escenario Marina Bay

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Marina Bay y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.16 — Escenario Lusail

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Lusail y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.17 — Escenario Yas Marina

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Yas Marina y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.18 — Escenario Hungaroring

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Hungaroring y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.19 — Escenario Mexico City

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Mexico City y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.20 — Escenario Montreal

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Montreal y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:

## Q6.21 — Escenario Austin

Estado de entrega: Revisión visual.

- [ ] Revisado por mí
- Resultado: pendiente / aprobado / necesita cambios / bloqueado
- Prueba: Selecciona Austin y entra a pista. Revisa la vuelta completa con zoom general y cercano.
- Esperado: Pianos y barreras propios visibles; superficies coherentes y pista/boxes utilizables sin obstrucciones visuales.
- Evidencia: Módulo específico de escenario: 3 PASS por circuito (63 entre los 21).
- Límite: Perfil artístico aproximado: no certifica fidelidad topográfica ni edificios. La aprobación aquí es visual, no cierre automático del alcance completo del sprint.
- Mis notas:
