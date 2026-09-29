# Auditoría de tests — sprint 2.8 y aplicación

Fecha: 28/09/2026. Revisión de tests; no modifica estados del dashboard ni autoriza implementación.

**53 módulos; 444 PASS, 83 FAIL; 527 aserciones ejecutadas.** Las 327 aserciones previas siguen pasando; se añadieron 200 aserciones de contrato. El ejecutor supera además 4 tests propios. Cero excepciones de módulo o errores de carga en el resultado final. Los fallos se conservan como FAIL (salida 1), sin skips ni rebajas de expectativas.

Resultados consolidados en [results/latest.json](results/latest.json): ejecución integral y repetición únicamente de resources tras añadir el caso térmico. Se comprobaron hashes de 75 archivos protegidos: src, planificación, índices, package.json, scripts y workflow sin cambios respecto al comienzo de esta revisión. Las modificaciones locales previas en RaceSimulation.ts y f1.ts se conservaron.

## Resultados por módulo

Presente significa que existe comportamiento para los casos ejecutados; no equivale a tarea íntegramente validada. Los estados de esta tabla son hallazgos de auditoría y no sustituyen las casillas del sprint.

| Módulo | Tarea | PASS | FAIL | Funcionalidad observada |
| --- | --- | ---: | ---: | --- |
| safety-car | C1, C2, C3, C4 | 10 | 0 | Presente para los casos de regresión ejecutados. |
| pit-stop | A3, A4, A5, A6 | 9 | 0 | Presente para los casos de regresión ejecutados. |
| race-state | C5, C6, C7, A1, A2 | 4 | 0 | Presente para los casos de regresión ejecutados. |
| car-rendering | M1, M2, M3 | 3 | 0 | Presente para los casos de regresión ejecutados. |
| tires-strategy | M4, M5, M9, M10 | 7 | 0 | Presente para los casos de regresión ejecutados. |
| teams-sectors | M6, M7, M8 | 8 | 0 | Presente para los casos de regresión ejecutados. |
| robustness | B1, B3, B4, B5 | 5 | 0 | Presente para los casos de regresión ejecutados. |
| track-geometry | Q1, Q2 | 8 | 0 | Presente para los casos de regresión ejecutados. |
| geometry-rendering | Q1, Q2 | 26 | 0 | Presente para los casos de regresión ejecutados. |
| pit-lane | Q3, Q11-1 | 40 | 0 | Presente para los casos de regresión ejecutados. |
| world-position | Q4 | 28 | 0 | Presente para los casos de regresión ejecutados. |
| documentation | General | 4 | 0 | Presente para los casos de regresión ejecutados. |
| finish-line | Q5 | 80 | 0 | Presente para los casos de regresión ejecutados. |
| scenarios | Q6 | 14 | 0 | Parcial: Barcelona/Mónaco específicos; no acredita identidad artística completa. |
| box-orders | Q9, Q10 | 65 | 0 | Presente para los casos de regresión ejecutados. |
| double-stack | Q11 | 8 | 0 | Presente para los casos de regresión ejecutados. |
| pace | Q12 | 6 | 0 | Presente en motor; comparación histórica entre coches distintos. |
| rejoin | Q13 | 2 | 0 | Parcial: pérdida nominal y recargo de cola. |
| track-width | Q7 | 4 | 4 | Parcial: anchuras variables; discontinuidad y cambio de huella. |
| racing-line | Q8 | 11 | 4 | Parcial: goma y bonus existen; offsets reales, reset y FPS fallan. |
| pace-contract | Q12 | 9 | 0 | Presente en motor; cinco vueltas con mismo piloto y recursos. |
| rejoin-contract | Q13 | 3 | 2 | Parcial: devuelve posición actual, no reincorporación calculada. |
| neutralization-motion | Q14 | 1 | 4 | Ausente el contrato sin saltos; existen ramas SC/roja previas. |
| blue-flags | Q15 | 7 | 2 | Parcial: la aproximación de un líder doblando no activa la señal. |
| resources | Q16 | 5 | 11 | Parcial: consumo existente; sin agotamiento real ni ERS dinámico; calor sin efecto previo. |
| luck-rewards | Q17 | 10 | 3 | Ausente recompensa legal en pista; la actual cambia neumáticos. |
| reset-lifecycle | Q18 | 2 | 4 | Parcial: IDs/eventos persisten; mínimo urbano ausente. |
| drs-permissions | Q19 | 7 | 4 | Ausente detección/permiso persistente; activación instantánea previa. |
| scenario-monza | Q6.1 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-silverstone | Q6.2 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-spa | Q6.3 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-spielberg | Q6.4 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-interlagos | Q6.5 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-suzuka | Q6.6 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-zandvoort | Q6.7 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-las-vegas | Q6.8 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-bahrain | Q6.9 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-baku | Q6.10 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-melbourne | Q6.11 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-miami | Q6.12 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-shanghai | Q6.13 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-jeddah | Q6.14 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-marina-bay | Q6.15 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-lusail | Q6.16 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-yas-marina | Q6.17 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-hungaroring | Q6.18 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-mexico-city | Q6.19 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-montreal | Q6.20 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| scenario-austin | Q6.21 | 1 | 2 | Ausente escenario específico; fallback con geometría genérica. |
| box-ui | Q9, Q10, Q11 | 6 | 0 | Presente: SSR de órdenes/compromiso y panel dual. |
| race-ui | General | 7 | 0 | Presente: SSR de HUD, clasificación y telemetría. |
| scenario-rendering | Q6 | 24 | 0 | Presente: capas dibujadas y cambio de circuito comprobados. |
| racing-line-geometry | Q8 | 0 | 3 | Parcial: signo del ápice y centro visual/físico incoherentes. |

## Hallazgos y revisión de calidad

- Q1–Q5: se conservaron geometría, huella, boxes, posición común, cámara/clic, meta y legibilidad. Los casos Canvas miden operaciones reales; algunos tests M1–M3 siguen siendo inspecciones de comentarios/código, no acreditan por sí solos el aspecto visual.
- Q6: 14 regresiones de datos y 24 aserciones nuevas sobre dibujo real de grava, coordenadas, zoom, rotación y cambios Barcelona→Mónaco→Barcelona. Q6.1–Q6.21 tienen módulos independientes: existe circuito y generación genérica, pero falta el escenario propio con pianos/barreras específicos. Las casillas históricas se conservan sin corregirlas.
- Q7: se reproduce discontinuidad al cambiar ancho/capacidad y tamaño físico variable. Los 8 casos nuevos incluyen Barcelona, Mónaco y fronteras sintéticas en tramo/meta; no son mediciones oficiales.
- Q8: se comprueban depósito real, saturación, pausa, boxes, cambio de GP, reset, movimiento, neumáticos y partición temporal. Fallan signos/offsets, reset y distribución a distintos FPS; el centro visual del engomado difiere del centro físico de un coche sobre esa trazada. La tolerancia temporal es 1% del depósito total, explícita y fijada en el test.
- Q9/Q10/Q11-1: se preservan órdenes, cinco compuestos, cancelación, compromiso, cruces y servicio real. Q11 mantiene cola/servicio, aislamiento entre equipos y reset, con SSR adicional para los dos pilotos. La prueba de retirada histórica no demuestra por sí sola liberación completa del cajón.
- Q12: las seis comprobaciones históricas no bastaban: comparaban pilotos distintos y simulaban una parada alterando flags. Las nueve nuevas comparan el mismo piloto durante cinco vueltas reales, consumo, desgaste, tiempos, aislamiento, pausa y reset. Pasan. Esto no acredita controles UI de ritmo ni todas las causas de limitación efectiva.
- Q13: eliminado catch vacío que ocultaba errores. Los dos tests previos pasaban con un predictor que devolvía la posición actual. Los nuevos lo contrastan con tráfico y una parada real: predice P1 y sale P2. Consulta sin mutación y exclusión del retirado comprobadas.
- Q14: observación de cada escritura de progress en el fixture para detectar retrocesos ocultos entre subpasos x16/x32; falla bajo SC y reanudación roja. No se alteró el motor ni el contrato histórico de spawn C3.
- Q15: líder una vuelta por delante y físicamente detrás, meta, misma vuelta, líder ya pasado, boxes, retirados, retirada de señal y neutralizaciones. Fallan los dos casos positivos de doblaje.
- Q16: ocho fallos de combustible por mínimo artificial de 0.5 kg; también fallan ERS dinámico, propulsión sin combustible y pérdida térmica anterior a integración. El test usa telemetry.batterySoc, la salida real, y no un campo inventado. Consumo por partición temporal y rango SOC pasan.
- Q17: tiradas 1/10/20 cambian ruedas en pista. Se validan combustible conservado, idempotencia, ID ajeno y retirado; no se inventó un catálogo de premios nuevo.
- Q18: incidentes provocados por update del motor, sin llamar al reset helper como sustituto de initRace. Persisten IDs y eventos D20 al reiniciar/cambiar GP; SC de Mónaco no alcanza el mínimo personalizado del backlog.
- Q19: se expone divergencia del umbral 1s del helper y apertura del motor sin detección previa. Neutralizaciones y reset cierran el flap. No se atribuye legalidad completa a estos resultados.

## Límites de cobertura que no deben darse por aprobados

Esta revisión añade pruebas ejecutables para todas las Q y sus ampliaciones, pero no afirma cobertura exhaustiva de cada frase de aceptación. Antes de implementar un cambio en los siguientes contratos hay que completar y acordar sus fixtures, conforme a AGENTS.md:

- Q6: identidad de edificios/gradas, procedencia de arte, lateralidad completa de polígonos, oclusiones y benchmark. Q7: decisión de adelantamiento con dos/tres huellas en estrechamiento. Q8: secuencia completa exterior–ápice–exterior en enlazadas y distancias equivalentes a distintas velocidades.
- Q11/Q12: interacción real de controles, prioridad en llegadas exactamente simultáneas, liberación al retirar ocupante, persistencia tras servicio real y respuesta a todas las limitaciones del modo efectivo.
- Q13: incertidumbre/fuente visible, doblados, SC, detección de tráfico al cruzar meta y marcador compartido de minimapa/tower.
- Q14: integral longitudinal completa, parking/fast lane bajo roja, formación y ausencia de deadlock. Q15: varios líderes, cesión lateral segura y frenada gradual en tramos estrechos.
- Q16: libro energético todavía inexistente; no se simulan como si existiesen sus flujos kW/MJ, límites por vuelta/boxes ni conservación integral. Esos contratos necesitan tests propios antes de implementar el libro.
- Q17/Q18: premios diferidos durante servicio, evento sustituido, timers reales, igual tirada con distinto ID, clic/timeout simultáneo, desmontaje y StrictMode. SSR no ejecuta esos efectos.
- Q19: contrato de datos de detección y permisos aún ausente; faltan fixtures acordados para detectar a 0.8s y abrir después a 1.3s, detecciones compartidas/independientes, adelantamiento, frenada, libres/clasificación y cruces múltiples de detección/activación. No se crearon propiedades/API ficticias para presentar esos casos como cubiertos.

Las reglas se guardaron en AGENTS.md y se alinearon en los archivos de instrucciones existentes. No se editaron DASHBOARD.md, index.html, dashboard_visual.html ni sus checks.
