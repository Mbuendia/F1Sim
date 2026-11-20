# ES3 — Optimizador de estrategia

*Sprint 16 · 20/11/2026*

## Qué hace

`src/simulation/StrategyOptimizer.ts` (`optimizeStrategy`) prueba todas las estrategias de seco legales de una a tres
paradas y las ordena de la mejor a la peor:

- **Legales:** al menos dos compuestos distintos; cada tanda con un juego distinto, de los que tiene el equipo (sin
  inventario, el reparto de siempre: 8 blandos, 3 medios y 2 duros, todos nuevos); un juego usado empieza con sus
  vueltas encima; ninguna tanda pasa de la caída del neumático; en Mónaco, tres juegos (dos paradas como mínimo).
- **Tiempo de cada vuelta:** la mejor vuelta del compuesto, más la degradación por cada vuelta pasada la fase plana
  (curvas medidas en el motor, ES1), más lo que pesa el combustible que queda (igual en todas las estrategias).
- **Cada parada:** la pérdida en boxes medida en el circuito (ES2).
- **Las vueltas de parada:** para cada orden de compuestos se busca el reparto exacto que da el menor tiempo, por tramos
  (programación dinámica). Tarda unos milisegundos, así que no hace falta llevarlo a segundo plano.
- **Empates:** las que quedan a menos de 1 s de la óptima. Las mismas tandas en otro orden cuestan lo mismo y solo se
  enseña una.
- **Punto de cruce:** entre la mejor de N paradas y la mejor de N + 1, la pérdida por parada por debajo de la cual
  compensa la de más paradas («3 paradas compensan frente a 2 si la parada cuesta menos de 35,6 s»).

## Dónde se ve

- **Plan de carrera:** en cada coche, las cinco mejores estrategias con su inventario, la óptima destacada, la
  diferencia de las demás y el punto de cruce. «Usar esta» pone en el plan el neumático de salida y las paradas. El
  plan admite ahora hasta tres paradas.
- **Ficha del circuito y carrera libre:** la estrategia óptima y el tiempo previsto de carrera salen del optimizador
  (antes, una regla fija según la abrasión del asfalto).

## Lo que sale con las curvas de ahora

| Circuito | Óptima | Cruce |
|---|---|---|
| Barcelona | 3 paradas: blando 15 → blando 15 → blando 15 → medio 21 | 3 compensan frente a 2 por debajo de 35,6 s (la parada cuesta 22,4 s) |
| Monza | 2 paradas: blando 14 → blando 14 → medio 25 | 2 frente a 1 por debajo de 28,9 s; 3 frente a 2 por debajo de 11,2 s |
| Mónaco | 3 paradas: medio 24 → medio 24 → blando 15 → blando 15 | 3 frente a 2 por debajo de 54,5 s |

En 22 de los 23 circuitos la óptima es de tres paradas. Es lo que dice el motor: en sus curvas el blando es más de
1 s por vuelta más rápido que el medio y apenas se degrada (unos 0,09 s por vuelta en Barcelona) hasta la caída, así
que compensa parar mucho. En la realidad el salto entre compuestos es menor y la degradación mayor, y lo normal es
una o dos paradas. Ajustar el modelo de neumáticos a la realidad queda fuera de ES3.

## Cómo se prueba

`tests/modules/strategy-optimizer-es3.mjs`: estrategias legales en los 23 circuitos; la óptima coincide con una búsqueda
que prueba todas las combinaciones una a una (Monza con 24 vueltas); el tiempo cuadra con la suma a mano; empates y
punto de cruce; la pantalla del plan y «Usar esta»; la ficha y la carrera libre.
