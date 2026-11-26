# ES6 — Planes B, C y D

*Sprint 16 · 26/11/2026*

## Ventana de cada parada

`stopWindows` (en `src/simulation/StrategyOptimizer.ts`): para cada parada del plan, las vueltas a las que se puede
adelantar o retrasar (sola, sin mover las demás) perdiendo menos de 1 s en neumáticos y sin pasar de la caída. El plan de
carrera la enseña junto a la vuelta («Vuelta 24 (21–27)»). Con las curvas de ahora, una tanda de blando llega justo a su
caída y su parada no tiene margen; con medio y duro sí suele haberlo.

## El optimizador a mitad de carrera

`optimizeStrategy` acepta el neumático montado y sus vueltas (`current`), los compuestos ya usados (`usedCompounds`) y un
mínimo de paradas (`minStops`): la primera tanda es la del juego montado, el montado no cuenta para cambiar y, si ya se
han usado dos compuestos, puede no haber más paradas.

## Los planes (`src/simulation/BackupPlans.ts`)

- **Plan B · Safety Car antes de la ventana.** Si sale un Safety Car o un VSC antes de que se abra la ventana de la
  próxima parada: parar ya y rehacer el resto de la carrera con el optimizador.
- **Plan C · Atascado.** Si el coche va 3 vueltas seguidas a menos de 1 s del mismo coche sin pasarlo, y está dentro de la
  ventana de la próxima parada: adelantarla a esa vuelta para salir a aire limpio.
- **Plan D · Más desgaste.** Con 3 vueltas o más en el juego, si por lo que se gasta va a durar menos del 80 % de la vida
  medida en el circuito (ES1) y no llega a la próxima parada: una parada más, rehaciendo la carrera con las curvas
  recortadas a lo que dura en este coche.
- La lluvia va aparte (ES7).

Las cifras (1 s, 3 vueltas, 80 %) son diseño del juego (`BACKUP`).

## Antes de la salida y en carrera

- **Plan de carrera:** cada coche enseña sus planes de reserva con el disparador y un ejemplo («con Safety Car en la
  vuelta 18: parar en la 18 (blando)…»).
- **En carrera:** en los coches del jugador sin delegar, el estratega del muro mira los disparadores y propone el plan
  («Plan B: Safety Car en la vuelta 10, antes de la ventana… Nuevo plan: parar en la 10…»). Aceptarlo pone sus paradas en
  el plan del coche, como una orden del jugador; descartarlo hace que no vuelva hasta la vuelta siguiente. En los coches
  delegados el estratega sigue como hasta ahora.
- El motor admite ahora planes de hasta tres paradas (antes dos, y «Usar esta» con tres se rechazaba al dar la salida).
