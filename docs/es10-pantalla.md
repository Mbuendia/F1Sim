# ES10 — Pantalla de ajuste de la estrategia

*Sprint 16 · 26/11/2026*

El plan de carrera (MJ11) ya tenía el editor del plan y, de ES3 a ES9, las mejores estrategias, la ventana de cada parada,
los planes de reserva, la salida, el riesgo de Safety Car, la lluvia y el undercut. ES10 lo ordena y añade lo que faltaba.

## Pestañas

Cada coche tiene cuatro pestañas, para que en el móvil no sea una sola columna interminable:

- **Plan:** la barra de tandas, el tiempo del plan, el neumático de salida, las paradas (con su ventana) y el ritmo.
- **Estrategias:** las cinco mejores (ES3), la óptima con Safety Car (ES4), el punto de cruce y la salida (ES5).
- **Reserva:** el plan de lluvia (ES7) y los planes B, C y D (ES6).
- **Rival:** el undercut y el overcut contra el rival de referencia (ES9). Sin rivales a la vista, no sale.

## Barra de tandas

`StintBar` (en `src/components/RacePlanScreen.tsx`): un tramo por tanda, de ancho proporcional a sus vueltas y con el
color de su compuesto (letra y vueltas dentro), y la ventana de cada parada marcada encima con una franja de rayas.

## Tiempo del plan al momento

`evaluatePlan` (en `src/simulation/StrategyOptimizer.ts`) calcula el plan del jugador con el mismo cálculo que el
optimizador: curvas de ES1, paradas de ES2, combustible, salida de ES5 (con la posición de salida) y riesgo de Safety Car de
ES4. Debajo de la barra sale el tiempo previsto y la diferencia con la óptima («+0,9 s sobre la óptima» o «es la
óptima»), y cambia en cuanto se mueve una parada o se cambia un compuesto. Si una tanda pasa de la vida de su neumático,
se avisa («El medio no llega a la vuelta 30: dura unas 27 vueltas»).

## Lo demás

- Al dar la salida, el plan entra en el motor como hasta ahora (`planStops`), con hasta tres paradas.
- En multijugador el invitado solo ve sus coches; de los rivales solo se ve su código y su posición de salida.
- En el móvil (375 px) ninguna pestaña desborda ni corta botones (comprobado en una partida con la sonda de desbordes).
