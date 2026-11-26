# ES12 — ¿Gana de verdad la óptima?

*Sprint 16 · 26/11/2026*

## El banco

`scripts/strategy-bench.mjs` (con `src/simulation/StrategyBench.ts`): en Mónaco, Monza, Silverstone y Barcelona, el coche
del jugador sale desde P10 con la óptima del optimizador y las 3 siguientes. Cada una se corre con el coche solo
(semilla 11) y con la parrilla completa, los rivales con sus planes de ES11 (semillas 11, 23, 37 y 51; en Mónaco, 8 semillas, porque allí el azar pesa más). El tiempo real va
desde que se apaga el semáforo hasta la meta. Unos 40 minutos (más 25 para las 8 de Mónaco); los resultados están en `docs/es12-banco.json`.

**Semilla.** La preparación de la carrera se hace al crear la simulación, antes de fijar la semilla, y usaba azar sin
semilla: la misma carrera daba tiempos distintos (hasta ±25 s). El banco rehace la preparación con la semilla (como las
huellas de carrera) y ahora la misma carrera sale idéntica.

## Lo que el modelo no contaba: calibración

Con el coche solo, la carrera tardaba entre un 0,3 % y un 1,15 % más que la previsión. Vuelta a vuelta salía de tres cosas
que el optimizador no cuenta:

- **El ritmo del coche:** las curvas de ES1 se midieron con el primer coche de la parrilla; el de P10 va unas décimas por
  vuelta más lento (de 0,2 s en Mónaco a 0,7 s en Monza y Silverstone).
- **La salida parada:** la primera vuelta cuesta unos 4 s más.
- **La vuelta de salida de boxes con el neumático frío:** de 0 a 1,7 s más por parada.

El optimizador acepta ahora esos tres datos (`paceOffsetSec`, `startLossSec`, `outLapSec`; sin ellos, 0, como antes). El
banco los mide para su coche en cada circuito con una carrera completa en solitario con la 5.ª estrategia del optimizador
(que no se compara) y los usa en la previsión:

| Circuito | Ritmo (s/vuelta) | Salida (s) | Vuelta fría (s/parada) |
|---|---|---|---|
| Mónaco | 0,20 | 3,7 | 0,6 |
| Monza | 0,73 | 4,4 | 0,0 |
| Silverstone | 0,71 | 4,5 | 1,2 |
| Barcelona | 0,53 | 4,6 | 1,7 |

## Con el coche solo: ¿acierta el modelo?

| Circuito | Óptima | 2.ª | 3.ª | 4.ª |
|---|---|---|---|---|
| Mónaco | +0,07 % | −0,02 % | +0,03 % | −0,09 % |
| Monza | +0,16 % | +0,15 % | +0,14 % | +0,14 % |
| Silverstone | +0,02 % | +0,06 % | +0,02 % | +0,06 % |
| Barcelona | +0,04 % | +0,19 % | +0,19 % | −0,01 % |

Con la calibración, todas a menos del 0,2 %.

## Con la parrilla: ¿gana la óptima?

Tiempo de cada carrera (s) por semilla 11 / 23 / 37 / 51 (x: sin acabar):

| Circuito | Óptima | 2.ª | 3.ª | 4.ª |
|---|---|---|---|---|
| Mónaco | 5750 / 5751 / 5807 / 6391 | 5760 / x / 5762 / 5773 | 5752 / 6115 / 5793 / 6388 | 5762 / 5768 / 5766 / 6392 |
| Monza | 4371 / 4317 / 4396 / 4721 | 4377 / 4330 / 4409 / 4731 | 4381 / 4328 / 4402 / 4726 | 4379 / 4331 / 4402 / 4384 |
| Silverstone | 4700 / 4651 / 4728 / 5031 | 4693 / 4663 / 4728 / 4716 | 4702 / 4654 / 4731 / 5034 | 4697 / 4658 / 4728 / 5034 |
| Barcelona | 5005 / 5032 / 5029 / 5005 | 4991 / 5033 / 5030 / 5309 | 5005 / 5042 / 5059 / 5309 | 5008 / 5039 / 5031 / 5307 |

Con la parrilla, el azar de carrera pesa mucho más que la diferencia entre estrategias: con la semilla 51 hay un incidente
grande que suma unos 300 s a casi todas, y la estrategia que por suerte está parando en ese momento se lo ahorra. Por eso
la media (lo que pide el contrato) sale dominada por la suerte: la óptima pierde de media en Mónaco, Monza y Silverstone.

Comparando carrera a carrera con la misma semilla (solo las que acaban las dos; mediana de las diferencias, óptima menos
alternativa; negativo: gana la óptima):

| Circuito | frente a la 2.ª | frente a la 3.ª | frente a la 4.ª |
|---|---|---|---|
| Mónaco (8 semillas) | +3,1 (5 parejas) | −0,7 (7) | −8,0 (6) |
| Monza | −11,3 | −7,9 | −6,4 |
| Silverstone | +3,5 | −3,0 | −1,9 |
| Barcelona | −1,0 | −20,4 | −5,6 |

La óptima gana o empata (a menos de 5 s) en las 12 comparaciones.

**Tráfico.** Con la parrilla, la carrera de la óptima tarda de mediana lo previsto o poco más (Mónaco +18 s, Monza +6 s,
Silverstone 0 s) y en Barcelona 58 s menos (con rivales delante, el rebufo ayuda en las rectas). El optimizador cuenta la
carrera sin tráfico; el efecto del tráfico en la salida ya va en la previsión (ES5), pero no el de después de cada parada
ni el desgaste mayor del neumático rodando en grupo (ES11). Queda apuntado como tarea para el plan del jugador.

## Qué queda del contrato

- Caso 2 (con el coche solo, a menos del 1 %): **cumple** con la calibración (todas a menos del 0,2 %).
- Caso 3: el usuario decide medirlo por parejas con la mediana (26/11/2026, «Por parejas, con la mediana»), con empate hasta
  5 s y al menos 3 parejas: **cumple** en los cuatro circuitos.
