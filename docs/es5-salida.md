# ES5 — Neumático de salida y posición en pista

*Sprint 16 · 26/11/2026*

## Qué se mide

`src/simulation/StartGains.ts` simula salidas con el propio motor: la parrilla completa, la vuelta de formación, el
semáforo y cinco vueltas. Nuestro coche sale desde **P3**, **P10** y **P17** (delante, en medio y detrás) con blando,
medio y duro; los rivales salen con el neumático que elige el motor. De cada caso se apunta:

- los puestos ganados (o perdidos) al acabar la primera vuelta y la quinta;
- los segundos que se pierden (o se ganan, con el rebufo) en el tráfico en esas cinco vueltas, frente a la misma salida
  con el coche solo en pista.

La salida del motor no depende de la semilla (con 11, 23 y 37 sale exactamente lo mismo), así que basta una
simulación por caso.

## Cómo volver a medir

```
node scripts/build-start-gains.mjs [circuito…]
```

Unos 30 s por circuito (unos 12 minutos los 23). Guarda `src/data/startGains.json`. Hay que relanzarlo si cambia la
salida, los neumáticos o el tráfico del motor: el test `start-tyre-es5` vuelve a medir un caso y avisa si no coincide.

## Cómo se usa

- `src/data/startGains.ts` (`startEffect`): el efecto de un compuesto desde una posición, interpolado entre P3, P10 y
  P17 (fuera de ese rango, la más cercana).
- El optimizador (`optimizeStrategy` con `gridPosition`) suma a cada estrategia los segundos de tráfico medidos para
  su neumático de salida. Sin posición de salida da lo mismo que antes (ES3 y ES4).
- **Plan de carrera:** cada coche ordena las estrategias con su posición de salida y enseña la frase de la salida
  («Saliendo desde P10, en la primera vuelta: con blando gana 5 puestos…»).
- **Ficha del circuito:** la misma frase para P10.

## Lo que sale

Los rivales salen con medio, así que el medio ni gana ni pierde puestos. El blando gana varios (desde P10, 5 en
Barcelona y 7 en Monza) porque en el motor es más de 1 s por vuelta más rápido y entra antes en temperatura; el duro
puede perder muchos (10 en Barcelona) por salir frío. Los segundos de tráfico son pequeños y a veces negativos: con la
parrilla delante, el rebufo ayuda.
