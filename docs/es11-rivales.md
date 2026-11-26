# ES11 — Estrategias de los rivales

*Sprint 16 · 26/11/2026*

## Antes de la salida

`assignRivalPlans` (en `src/simulation/race/startAndResult.ts`), en las carreras del juego y en seco: cada coche de la IA
(no los del jugador) elige su plan con el mismo optimizador que el jugador, con su posición de salida y sus juegos, monta
el neumático de salida de su plan y deja programadas sus paradas. En el sprint o con la pista mojada no hay plan, como
antes.

## Estilos (`src/simulation/RivalPlans.ts`)

Cada equipo tiene un estilo para la carrera:

- **óptima:** la mejor estrategia;
- **alternativa:** otra de las cinco mejores, a menos de 10 s de la óptima;
- **desfase:** la óptima con la primera parada 2 o 3 vueltas antes o después, para no parar a la vez que su rival;
- **conservadora:** la mejor con una parada menos.

El estilo sale del tercio de la parrilla desde el que sale el mejor coche del equipo, con azar de la semilla (con la misma
semilla, los mismos planes):

| Tercio | óptima | alternativa | desfase | conservadora |
|---|---|---|---|---|
| Delante | 70 % | 30 % | — | — |
| En medio | 40 % | 30 % | 30 % | — |
| Detrás | 20 % | 30 % | 25 % | 25 % |

Si el estilo no se puede aplicar (no hay una alternativa cercana, ni una parada menos, ni sitio para desfasar sin pasar de
la vida del neumático), el coche va a la óptima.

## Margen por tráfico

Las curvas de ES1 se midieron con el coche solo. En carrera, con tráfico, el neumático dura menos: en las primeras
pruebas los que salían atrás con blando paraban 1 a 4 vueltas antes de su plan (se cumplía el 70 % de las paradas). Los
coches planean con la vida recortada según desde dónde salen: delante, la medida; en medio, el 90 %; detrás, el 80 %.
Así se cumplen el 100 % de las paradas en Silverstone y Barcelona y el 92 % en Monza. El plan del jugador sigue usando las
curvas sin recortar.

## En carrera

- Las paradas del plan las emite el propio coche al llegar su vuelta, como órdenes de la IA.
- El estratega de la IA sigue mirando lo que ve: no para por desgaste si su parada programada llega antes de que se
  acabe el neumático, pero un Safety Car, la lluvia, un pinchazo o un neumático crítico siguen mandando.
- Si para antes de su plan por uno de esos motivos y la pista está seca, rehace el resto con el optimizador desde esa
  parada (antes se quedaba sin plan).
