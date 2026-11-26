# ES7 — Plan de lluvia

*Sprint 16 · 26/11/2026*

## Puntos de cruce

`src/simulation/RainPlan.ts` (`wetPace`, `crossoverMm`, `rainCrossovers`) usa la misma fórmula que el motor (carStep):
el ritmo de un neumático con agua es el multiplicador de su compuesto por su agarre con agua frente al suyo en seco, con
la parte que recuperan los puntos de lluvia del piloto. El punto de cruce es el agua con la que dos neumáticos van igual:

| Cruce | Sin puntos de lluvia | Con 10 puntos |
|---|---|---|
| Medio → intermedio | 0,23 mm | 0,29 mm |
| Intermedio → lluvia | 2,12 mm | 2,36 mm |

Con más puntos de lluvia, el piloto aguanta más antes de cambiar.

## El plan

- **Agua de cada vuelta** (`waterByLap`): con la previsión del radar (20 minutos por delante, en tramos de 5) y el modelo de
  agua del motor: sube con la lluvia prevista y, sin lluvia, baja con el secado (más con la pista caliente). Más allá
  del radar se supone lo que diga su último tramo.
- **El mejor plan** (`rainPlan`): compara aguantar con el neumático montado con cambiar una o dos veces (a intermedio o
  lluvia y, si se seca, a seco), en todas las vueltas posibles, con la pérdida en boxes de ES2 por parada. Si se acaba
  con un neumático que no es el mejor para el agua del final, se suma otra parada.
- **No parar:** con una lluvia corta y ligera, aguantar con slicks pierde menos que dos paradas y el plan dice «mejor
  no parar».

Ejemplos (vuelta de 80 s, parada de 22 s, desde la vuelta 10): con 4 mm/h durante 5 minutos, no parar; con 10 mm/h
durante 10 minutos, intermedios en la vuelta 13 y seco en la 26 (con 10 puntos de lluvia, intermedios en la 14); con
25 mm/h durante 15 minutos, neumáticos de lluvia en la vuelta 13.

## Dónde se ve

- **Plan de carrera:** si la previsión de la salida trae lluvia que cambie el neumático óptimo, la frase del plan de
  lluvia de cada coche.
- **En carrera:** en cada vuelta, en los coches del jugador, si conviene cambiar en las próximas vueltas el muro propone
  «Plan lluvia» con las paradas (y, si se vuelve a seco, con el compuesto de la siguiente parada de seco, que sobra).
  Aceptarlo las programa; si deja de convenir, la propuesta se retira.
