# VS3 — Temperatura de pista en el agarre y el desgaste (Sprint 11)

Fecha: 13/11/2026.

## Qué pasaba

Todos los circuitos salían con el asfalto a 38,5 °C (±1,5 °C de oscilación, menos lo que enfrían las nubes). Los
neumáticos ya tenían temperatura por rueda y una ventana de trabajo por compuesto, pero el asfalto no entraba en la
cuenta.

## Qué cambia

- **Cada circuito tiene su temperatura de salida** (`src/simulation/TrackTemperature.ts`), de 18 °C en Las Vegas a 50 °C
  en el Hungaroring. Es una calibración del juego, no una tabla oficial.
- **Baja durante la carrera:** 2,5 °C por hora de día y 1,5 °C por hora de noche. El agua en pista la enfría 5 °C por
  milímetro, hasta 8 °C. Las nubes siguen enfriándola como antes.
- **El asfalto calienta o enfría la goma** (`TireModel.trackHeat`): por cada grado que el asfalto está por encima de
  38,5 °C, el neumático gana 0,9 °C; por cada grado por debajo, pierde 0,2 °C. El frío pesa menos porque la goma genera
  su propio calor al rodar; el calor del asfalto se le suma entero.
- **Lo demás sale de lo que ya había:** fuera de su ventana el neumático pierde agarre, y por encima se desgasta más.
  Con asfalto caliente el blando (ventana hasta 110 °C) se pasa antes que el duro (hasta 120 °C); con asfalto frío al
  duro (desde 95 °C) le cuesta más entrar que al blando (desde 85 °C).
- **El jugador lo ve:** el panel del tiempo dice «Pista fría» (menos de 30 °C), «Pista normal» o «Pista caliente» (más
  de 45 °C), y al pasar el ratón, qué supone para los neumáticos.

A 38,5 °C la carrera es exactamente la de antes: forzando esa temperatura salen las mismas huellas de carrera que había
antes de VS3 (lo comprueba `tests/modules/track-temp-vs3.mjs`).

## Efecto medido en una tanda

Tanda de banco (vuelta de 90 s, 60 % de recta y 40 % de curvas, ritmo normal), entre la pista más fría (−20,5 °C
respecto a la referencia) y la más caliente (+11,5 °C):

| Medida | Resultado | Límite del contrato |
|---|---|---|
| Diferencia de tiempo por vuelta | 0,46 s como mucho | 0,6 s |
| Desgaste del blando con pista caliente | un 5,6 % más | 25 % |
| Desgaste del duro con pista caliente | igual | — |
| Duro en la vuelta de salida de boxes, con pista fría | pierde 0,56 s | — |
| Blando en la vuelta de salida de boxes, con pista fría | pierde 0,06 s | — |

## Antes y después en tres circuitos

Carrera completa en seco, sin jugador, media de dos semillas (2025 y 77). «Antes» es la misma carrera forzando 38,5 °C.

| Circuito | | Pista al salir | Pista al acabar | Mejor vuelta (media de los 20) | Paradas por coche | Duración |
|---|---|---|---|---|---|---|
| Las Vegas (fría) | Antes | 37,8 °C | 38,0 °C | 93,64 s | 1,0 | 79,3 min |
| | Después | 17,3 °C | 15,6 °C | 93,59 s | 1,0 | 79,5 min |
| Montreal (normal) | Antes | 37,8 °C | 37,9 °C | 73,90 s | 1,0 | 87,8 min |
| | Después | 37,3 °C | 35,2 °C | 74,08 s | 1,0 | 90,3 min |
| Hungaroring (caliente) | Antes | 37,8 °C | 38,1 °C | 78,18 s | 1,0 | 94,1 min |
| | Después | 49,3 °C | 45,2 °C | 78,14 s | 1,0 | 96,2 min |

Lectura: la mejor vuelta apenas cambia (centésimas) y el número de paradas, nada. La duración de la carrera sí cambia
en Montreal y el Hungaroring (unos dos minutos), pero con dos semillas no se puede atribuir a la temperatura: en cuanto
una carrera deja de ser idéntica, cambian sus incidentes y sus neutralizaciones, y eso mueve minutos. El efecto de VS3
es pequeño a ritmo normal y crece cuando se aprieta (modos de motor y agresividad altos calientan más la goma).

## Lo que queda sin resolver

- **El estratega de los rivales no mira la temperatura** al elegir compuesto: sigue eligiendo como antes. Los tests de
  estrategia de neumáticos siguen en verde.
- **El desgaste medio por carrera** no está en la tabla: el motor no lo resume y la tanda de banco es la medida fiable.
