# Auditoría Q12–Q19 (Sprint 2.8) — 30/09/2026

Contraste de los criterios de aceptación de `DASHBOARD.md` con los tests existentes y con el comportamiento real del motor.
Estado de partida: los 13 módulos de contrato de Q12–Q19 pasan (109 PASS / 0 FAIL) y la suite completa está en verde (965/0),
pero el dashboard mantiene las ocho tareas como pendientes. Evidencia reproducible con `scratch/audit-drs.mjs` y
`scratch/audit-pace.mjs`.

## Resumen

| Tarea | Cubierto y verificado | Hueco principal | Gravedad |
|---|---|---|---|
| Q12 Ritmo | Órdenes persistentes, pedido/efectivo, SC/VSC, compañero, pausa/reset, UI | Calibración ~8× el objetivo | Media |
| Q13 Reincorporación | Predictor del motor (`getRejoinProjection`) y escenario controlado | **Ningún componente lo muestra** | Alta |
| Q14 Neutralización | SC sin recolocar coches a x1/x16/x32; roja conserva distancia y recursos | SC aparece por asignación directa; escenarios ampliados sin test | Media |
| Q15 Banderas azules | Señal correcta (líder detrás, meta, misma vuelta, pit, retirados, SC/VSC) | Cesión gradual y casos "dos líderes"/curva sin test | Baja |
| Q16 Recursos | Combustible finito, SOC real, térmica antes de integrar | **SOC/ERS no se muestra en ninguna pantalla**; límites FIA MJ/kW sin test | Alta |
| Q17 D20 | No cambia ruedas ni crea combustible; idempotente | **El modal dice "Compuesto Óptimo Equipado (100 % salud)"** aunque solo es un consejo | Media |
| Q18 Reset | IDs de incidentes, SC urbano ≥ 10 vueltas, D20 limpio al reiniciar/cambiar GP | Recompensa aplicada dentro de un actualizador de `setState` | Media |
| Q19 DRS | Lógica de permisos por detección muy cubierta (fixtures sintéticos) | **Ningún circuito tiene puntos de detección: el DRS no se abre nunca** | Crítica |

## Detalle por tarea

### Q12 — Modos de ritmo
- **Hecho:** 26 aserciones (pace, pace-orders, pace-contract, pace-ui). El muro muestra pedido/efectivo y motivo (visto en carrera).
- **Hueco:** calibración. Mismo piloto, pista libre, media de 5 vueltas frente a Balanced:
  Barcelona Push −2,49 s / Save +2,80 s; Monza −3,25 s / +3,47 s. Objetivo del dashboard: −0,3 s / +0,4 s.
- **Observación fuera de alcance:** la vuelta Balanced dura 96 s en Barcelona y 117 s en Monza (reales ≈ 78–81 s).
- **Test propuesto:** diferencia media en 5 vueltas, Push −0,3 ± 0,15 s y Save +0,4 ± 0,2 s (tolerancias a acordar).

### Q13 — Predictor de reincorporación
- **Hecho:** cálculo en el motor (pérdida en boxes, servicio, double stack), no mueve coches, excluye retirados, coincide con una reincorporación controlada.
- **Hueco (ampliación confirmada el 29/09):** no hay marcador en clasificación ni minimapa (`getRejoinProjection` no se usa en `src/components` ni en `src/renderer`).
- **Tests propuestos:** clasificación con piloto objetivo muestra la posición estimada (`data-rejoin-projection`) marcada como estimación y con su fuente; minimapa dibuja el marcador en la posición proyectada; estado "no disponible" con motivo (retirado, sin datos); la pausa lo conserva; reset/cambio de GP lo elimina.

### Q14 — Movimiento en neutralizaciones
- **Hecho:** sin recolocación ni retroceso bajo SC a x1/x16/x32; reanudación de roja conserva distancia y no crea recursos.
- **Huecos:** el coche de seguridad se coloca con `sc.progress = …` al desplegarse y al recogerse (`SafetyCarModel.ts:71` y `:119`); la aceptación ampliada (formación, SC que alcanza al líder, pelotón de doblados, roja antes/después de boxes, relanzamiento, distancia = ∫v·dt) no tiene tests. Menor: al aparcar en parrilla (`RaceSimulation.ts:1162`) hay un ajuste final de `progress` y lateral.
- **Decisión necesaria:** cómo debe aparecer el SC (salida del pit lane y alcance físico del líder, o aparición directa como ahora).
- **Tests propuestos:** para cada coche, distancia recorrida = ∫v·dt (tolerancia) durante despliegue→relanzamiento; posición del SC continua; escenarios del dashboard.

### Q15 — Banderas azules
- **Hecho:** señal correcta en los casos principales y se apaga al desaparecer la causa.
- **Estado del código:** el doblado reduce su velocidad objetivo un 15 % y se abre al exterior; con el límite lateral de Q20 la transición es gradual.
- **Tests propuestos:** cesión progresiva (sin salto de velocidad ni lateral), dos líderes próximos, curva estrecha.

### Q16 — ERS, combustible y térmica
- **Hecho:** combustible finito sin reserva, SOC real (varía entre 0 y 100 % en 6 vueltas), térmica aplicada antes de integrar.
- **Hueco que explica "no cambiaba nada y no lo encontraba":** `telemetry.batterySoc` y `ersDeploying` no se muestran en ninguna pantalla.
- **Huecos adicionales:** límites FIA (recarga ≤ 2 MJ/vuelta, despliegue ≤ 4 MJ/vuelta, MGU-K ±120 kW) y "cambio de modo no crea energía" sin test.
- **Tests propuestos:** el dock/panel muestra SOC y estado de despliegue desde la telemetría; energía por vuelta dentro de límites; cambio de modo sin creación de energía.

### Q17 — D20
- **Hecho:** la recompensa ya no cambia ruedas ni crea combustible; idempotente; ID ajeno y retirado sin recursos.
- **Hueco:** el modal sigue mostrando "Compuesto Óptimo Equipado: … (100 % SALUD)", como si montara ruedas nuevas; el efecto real es un consejo para la próxima parada.
- **Decisión necesaria:** catálogo de beneficios legales (preparación de boxes, información del ingeniero…), pendiente de refinar según el dashboard.
- **Test propuesto:** el modal no afirma equipar neumáticos y presenta el compuesto como recomendación.

### Q18 — Ciclo de vida y reset
- **Hecho:** IDs de incidentes reiniciados, SC urbano ≥ 10 vueltas, evento D20 eliminado al reiniciar o cambiar de GP.
- **Hueco:** `D20LuckModal` llama a `onApplyReward` dentro del actualizador de `setCountdown` (efecto dentro de un actualizador; React lo ejecuta dos veces en StrictMode). El motor lo tolera por idempotencia, pero el defecto sigue.
- **Limitación de la suite:** no hay entorno DOM (solo SSR), así que no se pueden ejecutar efectos ni temporizadores de React.
- **Decisión necesaria:** forma de probarlo (aserción estructural sobre el código, como en visual-icons, o añadir un entorno DOM de pruebas).

### Q19 — DRS
- **Hecho:** umbral estricto 1 s, permiso persistente por detección, detección compartida, cierre por freno y por banderas, orden temporal de cruces, reset.
- **Hueco crítico:** `drsDetections` no está definido en ningún circuito y el motor pasa una lista vacía. En carreras reales de 6 vueltas en Barcelona, Monza y Bahrain: **0 pasos con DRS abierto**. El indicador DRS del chasis (Q22) tampoco se verá nunca abierto.
- **Decisión necesaria:** fuente de los puntos de detección. El dashboard prohíbe inventarlos restando una distancia fija; las notas de evento de la FIA los publican. Alternativa: geometría provisional registrada explícitamente como estimada.
- **Tests propuestos:** fixture de detecciones por circuito con fuente (como `pit-lane-references.json`); en carrera real se abre el DRS para un coche a < 1 s en la detección; casos del dashboard aún sin test (líder detrás de doblado, zona que cruza meta, pasos grandes, libres/clasificación).

## Prioridad sugerida

1. **Q19** — el DRS no funciona en el juego (necesita decidir la fuente de detecciones).
2. **Q16** y **Q13** — funcionalidad hecha pero invisible para el jugador.
3. **Q17** — texto del modal contradice el efecto (cambio pequeño).
4. **Q12** — recalibrar magnitudes.
5. **Q18**, **Q14**, **Q15** — ciclo de vida y escenarios ampliados.
