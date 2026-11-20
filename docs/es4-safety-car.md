# ES4 — Riesgo de Safety Car y estrategia robusta

*Sprint 16 · 20/11/2026*

## Probabilidades reales

Antes, los 23 circuitos tenían un 45 % de Safety Car, un dato de relleno. Ahora cada uno tiene el porcentaje real de
carreras recientes con al menos un Safety Car y con al menos un VSC (coche de seguridad virtual). La fuente son las
previas «Need to know» de formula1.com: la de la temporada 2026 donde existe, y la de 2025 en Baréin, Yeda, Lusail y
Yas Marina (en 2026 esas carreras cambian o no tienen previa). Los datos están en `src/data/safetyCarOdds.ts`, con el
enlace a cada previa, y la ficha de cada circuito (`src/data/circuits.ts`) los toma de ahí.

| Circuito | Safety Car | VSC | Carreras |
|---|---|---|---|
| Barcelona | 50 % | 13 % | 8 |
| Monza | 50 % | 38 % | 8 |
| Silverstone | 78 % | 22 % | 9 |
| Spa | 50 % | 0 % | 8 |
| Mónaco | 29 % | 43 % | 7 |
| Spielberg | 50 % | 40 % | 10 |
| Interlagos | 86 % | 57 % | 7 |
| Suzuka | 50 % | 33 % | 6 |
| Zandvoort | 60 % | 60 % | 5 |
| Las Vegas | 33 % | 67 % | 3 |
| Baréin | 63 % | 50 % | 8 |
| Bakú | 67 % | 50 % | 6 |
| Melbourne | 67 % | 67 % | 6 |
| Miami | 50 % | 75 % | 4 |
| Shanghái | 50 % | 50 % | 4 |
| Yeda | 100 % | 50 % | sin dato (desde 2021) |
| Marina Bay | 67 % | 33 % | 6 |
| Lusail | 67 % | 67 % | sin dato (desde 2021) |
| Yas Marina | 38 % | 50 % | sin dato |
| Hungaroring | 13 % | 25 % | 8 |
| Ciudad de México | 60 % | 60 % | 5 |
| Montreal | 83 % | 33 % | 6 |
| Austin | 29 % | 43 % | 7 |

La media de Safety Car es del 56 %. Mónaco, contra lo que cabría esperar de un urbano, solo ha tenido Safety Car en 2
de sus 7 últimas carreras (29 %), aunque sí VSC en 3.

## Tiempo esperado de cada estrategia

`src/simulation/StrategyOptimizer.ts` (`expectedSecOf`, `neutralizationGain`):

- Se recorre cada vuelta de la carrera como si en ella saliera un Safety Car (o un VSC). Todas las vueltas pesan lo
  mismo y se cuenta una neutralización por carrera como mucho.
- En esa vuelta, el coche adelanta o retrasa a ella la parada que mejor le venga, sin pasar de la caída del neumático.
  Gana lo que va de parar en verde a parar con Safety Car o VSC (pérdidas medidas en ES2), menos lo que cuesta mover las
  dos tandas (curvas de ES1). Si no le compensa mover ninguna, no gana nada.
- El tiempo esperado es el de sin incidencias menos la ganancia media con Safety Car por su probabilidad, y menos la
  ganancia media con VSC por la suya.
- La **óptima esperada** es la de menor tiempo esperado. Si no es la óptima sin incidencias, se enseñan las dos, con
  una frase («Contando con el Safety Car compensa…: 10 de cada 10 carreras aquí tienen Safety Car…»). Si coinciden, se
  dice que la óptima sigue siendo la misma.

## Lo que sale con las curvas de ahora

Con las probabilidades reales, la óptima esperada coincide con la óptima sin incidencias en los 23 circuitos: las
estrategias de tres paradas que salen con las curvas del motor (ES3) ya tienen una parada cerca de cualquier vuelta y
aprovechan casi cualquier neutralización. Solo con mucho más riesgo cambia: en Las Vegas con Safety Car y VSC en todas
las carreras, compensa una de dos paradas. Si el modelo de neumáticos se ajusta a la realidad (menos diferencia entre
compuestos y más degradación), las estrategias de una y dos paradas se acercan y el riesgo pesará más.

## Dónde se ve

- **Plan de carrera:** si no coincide, la óptima con Safety Car aparece en la lista con su «Usar esta», y debajo la
  frase del riesgo.
- **Ficha del circuito:** la frase del riesgo y las probabilidades de Safety Car y VSC.
- **Pantalla de inicio y carrera libre:** las probabilidades reales de Safety Car y VSC.
