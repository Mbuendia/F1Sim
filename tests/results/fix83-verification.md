# Verificación de los 83 fallos

Resultado consolidado: **527 PASS, 0 FAIL**, 53 módulos.

La ejecución integral registró 526 PASS y un fallo nuevo en world-position; tras conservar la confirmación de resalida sin retroceder coches, se repitieron world-position y neutralization-motion: 33 PASS, 0 FAIL. El JSON consolidado conserva las fuentes; no representa una segunda ejecución integral.

Único cambio autorizado de test: Q6-8 consulta un circuito inexistente en vez de Monza para comprobar el fallback vacío. No se modificaron planificación ni checks.

## Alcance y límites

- Q6: 21 escenarios propios, calibración artística aproximada. SSR usa la elipse de respaldo: estos resultados no validan fidelidad visual sobre los SVG reales.
- Q7–Q8: tamaño constante, interpolación de anchura, trazada geométrica y depósito de goma por distancia. La trazada no es una optimización de tiempo por vuelta.
- Q13–Q18: contratos cubiertos de reincorporación, neutralización sin retroceso, banderas azules, recursos, recompensas y reinicio. No certifican toda la tarea del sprint; la predicción de boxes sigue siendo aproximada y la energía es un modelo simplificado.
- Q19: umbral estricto y permisos por detección. El calendario todavía no aporta puntos de detección; por seguridad el motor mantiene cerrado el DRS cuando falta esa información. Los tests verdes no acreditan una activación completa en los circuitos.

## Resultados por módulo

| Módulo | PASS | FAIL |
|---|---:|---:|
| safety-car | 10 | 0 |
| pit-stop | 9 | 0 |
| race-state | 4 | 0 |
| car-rendering | 3 | 0 |
| tires-strategy | 7 | 0 |
| teams-sectors | 8 | 0 |
| robustness | 5 | 0 |
| track-geometry | 8 | 0 |
| geometry-rendering | 26 | 0 |
| pit-lane | 40 | 0 |
| world-position | 28 | 0 |
| documentation | 4 | 0 |
| finish-line | 80 | 0 |
| scenarios | 14 | 0 |
| box-orders | 65 | 0 |
| double-stack | 8 | 0 |
| pace | 6 | 0 |
| rejoin | 2 | 0 |
| track-width | 8 | 0 |
| racing-line | 15 | 0 |
| pace-contract | 9 | 0 |
| rejoin-contract | 5 | 0 |
| neutralization-motion | 5 | 0 |
| blue-flags | 9 | 0 |
| resources | 16 | 0 |
| luck-rewards | 13 | 0 |
| reset-lifecycle | 6 | 0 |
| drs-permissions | 11 | 0 |
| scenario-monza | 3 | 0 |
| scenario-silverstone | 3 | 0 |
| scenario-spa | 3 | 0 |
| scenario-spielberg | 3 | 0 |
| scenario-interlagos | 3 | 0 |
| scenario-suzuka | 3 | 0 |
| scenario-zandvoort | 3 | 0 |
| scenario-las-vegas | 3 | 0 |
| scenario-bahrain | 3 | 0 |
| scenario-baku | 3 | 0 |
| scenario-melbourne | 3 | 0 |
| scenario-miami | 3 | 0 |
| scenario-shanghai | 3 | 0 |
| scenario-jeddah | 3 | 0 |
| scenario-marina-bay | 3 | 0 |
| scenario-lusail | 3 | 0 |
| scenario-yas-marina | 3 | 0 |
| scenario-hungaroring | 3 | 0 |
| scenario-mexico-city | 3 | 0 |
| scenario-montreal | 3 | 0 |
| scenario-austin | 3 | 0 |
| box-ui | 6 | 0 |
| race-ui | 7 | 0 |
| scenario-rendering | 24 | 0 |
| racing-line-geometry | 3 | 0 |
