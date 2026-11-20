# ES1 — Curvas de los neumáticos medidas con el motor (20/11/2026)

Cada curva sale de una tanda con un coche solo, sin rivales, con el depósito casi vacío (5 kg) y un juego nuevo, en el propio motor del juego. Se regeneran con `node scripts/build-tyre-curves.mjs` (unos 50 s los 23 circuitos) y quedan en `src/data/tyreCurves.json` (las fases, lo que usa el juego) y `src/data/tyreCurveLaps.json` (los tiempos de cada vuelta, aparte para no pesar en lo que se guarda al instalar); el test `tyre-curves-es1` vuelve a medir Bahréin y avisa si el motor ha cambiado.

- **Fase plana:** vueltas del neumático en las que pierde menos de 0,15 s respecto a su mejor vuelta.
- **Degradación:** lo que pierde por vuelta entre la fase plana y la caída.
- **Caída:** la vuelta en la que pierde de golpe más de 0,6 s o le queda menos del 25 % de vida. Es la vida que usan el muro, la ventana de paradas y los libres.
- **Combustible:** lo que cuesta cada kg por vuelta (de 105 a 5 kg, con el medio).

Todos los circuitos tienen el mismo estrés de neumáticos en los datos («Media»); la vida cambia por el trazado: el medio dura de 19 a 30 vueltas.

## Bahréin

Combustible: 1,66 s por cada 100 kg.

| Compuesto | Mejor vuelta | Fase plana | Degradación | Caída |
|---|---|---|---|---|
| Blando | 92,94 s | 3 vueltas | 0,130 s/vuelta | vuelta 12 |
| Medio | 94,20 s | 3 vueltas | 0,061 s/vuelta | vuelta 21 |
| Duro | 95,29 s | 3 vueltas | 0,029 s/vuelta | vuelta 36 |

Tiempos de cada vuelta (medio): 94,20 · 94,48 · 94,45 · 94,45 · 94,50 · 94,50 · 94,55 · 94,56 · 94,68 · 94,75 · 94,78 · 94,91 · 94,97 · 95,04 · 95,11 · 95,22 · 95,33 · 95,36 · 95,46 · 95,77 · 96,17 · 96,64 · 97,19

## Mónaco

Combustible: 1,35 s por cada 100 kg.

| Compuesto | Mejor vuelta | Fase plana | Degradación | Caída |
|---|---|---|---|---|
| Blando | 71,28 s | 7 vueltas | 0,105 s/vuelta | vuelta 15 |
| Medio | 72,55 s | 11 vueltas | 0,058 s/vuelta | vuelta 27 |
| Duro | 73,63 s | 22 vueltas | 0,031 s/vuelta | vuelta 46 |

Tiempos de cada vuelta (medio): 72,55 · 72,60 · 72,55 · 72,60 · 72,63 · 72,60 · 72,60 · 72,68 · 72,67 · 72,70 · 72,70 · 72,78 · 72,83 · 72,90 · 72,95 · 73,01 · 73,07 · 73,10 · 73,20 · 73,25 · 73,31 · 73,31 · 73,45 · 73,51 · 73,53 · 73,72 · 74,03 · 74,37 · 74,75 · 75,15 · 75,72

## Spa

Combustible: 1,84 s por cada 100 kg.

| Compuesto | Mejor vuelta | Fase plana | Degradación | Caída |
|---|---|---|---|---|
| Blando | 103,95 s | 5 vueltas | 0,149 s/vuelta | vuelta 11 |
| Medio | 105,00 s | 8 vueltas | 0,085 s/vuelta | vuelta 19 |
| Duro | 106,09 s | 14 vueltas | 0,047 s/vuelta | vuelta 33 |

Tiempos de cada vuelta (medio): 105,00 · 105,09 · 105,10 · 105,10 · 105,11 · 105,14 · 105,20 · 105,26 · 105,40 · 105,44 · 105,51 · 105,65 · 105,76 · 105,80 · 105,86 · 105,95 · 106,11 · 106,42 · 106,91 · 107,43

## Los 23 circuitos (vuelta de la caída)

| Circuito | Blando | Medio | Duro |
|---|---|---|---|
| barcelona | 15 | 27 | 46 |
| monaco | 15 | 27 | 46 |
| bahrain | 12 | 21 | 36 |
| spa | 11 | 19 | 33 |
| monza | 14 | 25 | 44 |
| silverstone | 13 | 23 | 39 |
| spielberg | 17 | 30 | 51 |
| interlagos | 16 | 28 | 48 |
| suzuka | 13 | 22 | 39 |
| zandvoort | 16 | 28 | 48 |
| las-vegas | 12 | 22 | 37 |
| baku | 11 | 20 | 34 |
| melbourne | 14 | 25 | 43 |
| miami | 13 | 22 | 39 |
| shanghai | 12 | 21 | 36 |
| jeddah | 12 | 22 | 38 |
| marina-bay | 12 | 22 | 37 |
| lusail | 14 | 25 | 43 |
| yas-marina | 13 | 23 | 40 |
| hungaroring | 14 | 25 | 44 |
| mexico-city | 14 | 25 | 43 |
| montreal | 15 | 27 | 47 |
| austin | 12 | 21 | 35 |
