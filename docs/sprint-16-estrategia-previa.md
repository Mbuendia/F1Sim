# Sprint 16 — Estrategia antes de la carrera: ajuste fino y estrategia óptima (propuesta del 29/10/2026)

> Documento para crear el sprint en `DASHBOARD.md`. Las líneas de tarea siguen el formato que leen `npm run sync:tasks` y `npm run dashboard`. Al pasarlo al dashboard hacen falta, además, la fila de la tabla de la sección 2 y la línea del prefijo `ES` en `sprintOf` (`scripts/build-dashboard.mjs`). Nada está implementado y ninguna tarea tiene contrato de tests.

**Fuente:** vídeo «Building an F1 Strategy from the Bare Basics», de Chain Bear (YouTube, 19/10/2026, 15:32, https://www.youtube.com/watch?v=TNQuUZYHJdE). Transcripción automática revisada entera el 29/10/2026. Las cifras de tiempos del vídeo están medidas a mano con cronómetro por el autor: sirven de orden de magnitud, no de dato.

**Origen:** el 29/10/2026 el usuario pide un sprint para entrar en detalle en la estrategia antes de la carrera, que el juego marque las estrategias «óptimas» y que use lo que explica el vídeo.

**Objetivo:** antes de la salida, el jugador ve las estrategias posibles para su coche en ese circuito, con el tiempo total de cada una, la óptima marcada y las alternativas para cuando la carrera se tuerza (Safety Car, lluvia, tráfico, desgaste distinto). Puede ajustarla a mano y el programa queda cargado en el muro (`programPitStops`, R08).

---

## 1. Qué explica el vídeo y cómo encaja en el juego

| # | Idea del vídeo | Qué significa para el juego |
|---|----------------|-----------------------------|
| 1 | **Tiempo total = suma de las vueltas de cada tanda + paradas × pérdida en boxes.** La estrategia es buscar la combinación que da el tiempo mínimo. | Base del optimizador (ES3). |
| 2 | **Regla de dos compuestos:** en seco hay que usar al menos dos. Sin ella, lo más rápido sería ir siempre con el blando. | Ya está en el motor (`TireCompliance`). El optimizador solo propone estrategias legales y con juegos en stock (`availableSets`). |
| 3 | **Vida del neumático:** el blando es más rápido, pero no aguanta. Con dos paradas se puede ir más tiempo con el blando. | Curva de cada compuesto por circuito (ES1). |
| 4 | **Punto de cruce entre una y dos paradas:** las dos estrategias empatan cuando la pérdida en boxes es igual a lo que la segunda gana en pista. Si la parada cuesta menos, dos paradas; si cuesta más, una. Ejemplo del vídeo: una parada = 36 + P, dos paradas = 32 + 2P → empatan con P = 4. | Se enseña en la pantalla: «dos paradas compensan si la parada cuesta menos de X s» (ES3). |
| 5 | **Pérdida en boxes (pit delta):** tiempo por el pit lane menos tiempo por la pista en el mismo tramo, de la entrada a la primera frenada tras salir. Cambia con el límite de velocidad, la longitud del carril y las curvas que se salta. Medidas del vídeo: Monza ≈ 22 s, Mónaco ≈ 19,5 s, Silverstone ≈ 23 s. | El motor ya la calcula con el coche y el circuito reales (`RejoinModel.pitLossSec`), y cada circuito tiene además el dato `pitLaneTimeLossSec` (Monza 24,1, Mónaco 22,0, Silverstone 20,5). Hay que decidir cuál manda y que coincidan (ES2). |
| 6 | **Degradación:** el neumático aguanta unas vueltas, luego pierde tiempo cada vuelta y al final se cae. El medio empieza más lento pero degrada menos: a partir de cierta vuelta es más rápido que un blando gastado. Con degradación, la mejor parada ya no está en el límite del blando (en el ejemplo, 9 vueltas de blando y 11 de medio). | Curva con fase plana, degradación y caída (ES1), sacada del motor real, no inventada. |
| 7 | **Combustible:** el coche pesa más al principio y va más lento. Con el coche pesado el blando se gasta antes: un blando al final dura más que al principio. Los equipos cargan algo menos de combustible y piden al piloto que ahorre a mitad de carrera. | Efecto del peso en la curva (ES1) y carga inicial como decisión opcional (ES8). |
| 8 | **Blando o medio en la salida:** el blando agarra más desde parado y ayuda a ganar o defender puestos en la primera vuelta, que valen mucho si cuesta adelantar. A cambio dura menos con el coche lleno. | Valor de la posición en pista en la salida (ES5). |
| 9 | **Otros coches:** el plan de papel no vale si vas detrás de uno más lento. Hacen falta planes B, C y D, y buscar aire limpio. | Árbol de planes alternativos con sus disparadores (ES6). |
| 10 | **Dónde sales al parar:** hueco con el líder + pérdida en boxes = dónde caes. Parar cuando sales en hueco limpio, no detrás de un grupo peleando. | Ya existe en carrera (ventana de parada, T4.15, `PitWindow.ts`). Se reutiliza en el plan como «vuelta de parada flexible ± N vueltas» (ES6). |
| 11 | **Safety Car y VSC abaratan la parada:** en Mónaco se pierden ≈ 14 s con VSC y ≈ 11-12 s con Safety Car, frente a 19,5 s en verde. Si el riesgo de Safety Car es alto, puede compensar alargar la tanda esperándolo: equilibrio entre riesgo y recompensa. | Pérdida en boxes con VSC y SC (ES2) y valor esperado según la probabilidad del circuito (ES4). Hoy la probabilidad de Safety Car es 45 % en los 23 circuitos: dato de relleno. |
| 12 | **Lluvia:** no hay un único modelo de mojado. El blando es el mejor hasta que hay un poco de agua y luego se hunde; el intermedio manda con agua media y se sobrecalienta en seco; el de lluvia solo con mucha agua. Un piloto hábil puede aguantar con secos una llovizna corta y ahorrarse una parada. | Puntos de cruce por cantidad de agua (ya hay `tyreWaterGrip`) y plan de lluvia según la previsión (ES7). |
| 13 | **Desfase con el rival: undercut y overcut.** Undercut: parar antes para aprovechar el neumático nuevo y salir delante. Overcut: alargar para tener neumáticos mucho mejores al final; más difícil donde cuesta adelantar. | Plan relativo a un rival y ganancia estimada de undercut por circuito (ES9). En carrera ya está el aviso de riesgo de undercut (`undercutRisk`). |

### Qué no cubre el vídeo y hay que decidir en el juego

* **El tráfico de toda la parrilla.** El vídeo lo trata a mano. El optimizador trabaja con el coche solo; el tráfico entra como coste estimado (ES5, ES6) y no como simulación completa, salvo que el usuario lo pida (ver ES11).
* **Variabilidad.** El vídeo da un tiempo por estrategia. En el juego conviene dar también el margen (mejor y peor caso) para que «óptima» no sea engañosa cuando dos estrategias están a menos de un segundo.

---

## 2. Lo que ya tiene el motor (comprobado en el código el 29/10/2026)

* **Paradas programadas:** `programPitStops` y `issuePlannedStop` en `src/simulation/race/wall.ts` (R08). Aceptan una lista de vuelta y compuesto y rechazan el programa si faltan juegos. Es la salida natural del planificador.
* **Pérdida en boxes calculada:** `RejoinModel.pitLossSec(track, car, capKmh, serviceSec)` simula el paso por el carril frente a la pista, con el coche real y con límite de velocidad opcional (`capKmh`), lo que permite medir verde, VSC y Safety Car. El tiempo medio de servicio es `MEAN_SERVICE_SEC` (≈ 2,9 s).
* **Datos de circuito** (`src/data/circuits.ts`): `pitLaneTimeLossSec`, `rainProbabilityPercent`, `asphaltAbrasion`, `tireStressLevel`, `asphaltGripLevel`, `safetyCarProbabilityPercent` (45 % en todos) y un texto `strategy` que se ve en la ficha del circuito (UX12, pestaña Estrategia).
* **Neumáticos:** `TireModel` con `nominalLaps` (blando 15, medio 24, duro 38), agarre base y caída al final de la vida (`cliffMultiplier`). `PitWindow.ts` usa otras vidas de referencia (`TYRE_LIFE_LAPS`: 16, 26 y 38): **dos tablas que no coinciden**; ES1 las une.
* **Estratega de la IA** (`Strategist.ts`, R25): elige compuesto por «el más blando que llega al final» y para por salud del neumático. No compara estrategias ni calcula un tiempo total.
* **Combustible:** `FuelModel`, consumo por vuelta con `RejoinModel.lapFuelKg` y carga inicial como regla de juego (`initialFuelKg` en `src/rules/ruleSets.ts`), igual para todos.
* **En carrera:** ventana de parada (dónde sales y con qué huecos) y aviso de undercut (T4.15), línea de tandas (`StintTimeline`, V4).
* **Sprint 15, MJ11:** pantalla de planificación antes de la carrera con escena de Blender. Este sprint pone el contenido (cálculos y ajuste) y MJ11 el aspecto: ver «Orden y dependencias».

---

## 3. Tareas

* **ES1 — Curva de cada compuesto en cada circuito:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* para cada circuito y compuesto, el tiempo de vuelta según las vueltas del juego y la carga de combustible: fase en la que apenas pierde, degradación por vuelta y caída final (ideas 3, 6 y 7 del vídeo). Se mide con el propio motor, simulando tandas sin rivales en segundo plano y guardando el resultado por circuito, para que el plan diga lo mismo que luego pasa en pista. Tiene en cuenta abrasión y estrés del circuito, la temperatura prevista y que el blando con el coche lleno dura menos. Une las dos tablas de vida que hoy no coinciden (`nominalLaps` y `TYRE_LIFE_LAPS`).
  * *Por qué primero:* todo lo demás suma estas curvas. Si no salen del motor, la estrategia «óptima» no lo sería en carrera.
  * *A decidir:* si las curvas se calculan al construir el juego (rápido de abrir, hay que regenerarlas si cambia el motor) o al abrir la pantalla (siempre al día, tarda más; en un Worker como el motor de N2).

* **ES2 — Pérdida en boxes en verde, con VSC y con Safety Car:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* para cada circuito, cuánto cuesta parar con bandera verde, con VSC y con Safety Car, con `RejoinModel.pitLossSec` y el límite de velocidad de cada caso (idea 11). Revisar `pitLaneTimeLossSec` contra lo que calcula el motor (Monza 24,1 s en datos frente a ≈ 22 s del vídeo; Silverstone 20,5 s frente a ≈ 23 s) y dejar una sola fuente. Se enseña en la ficha del circuito y en la pantalla de estrategia.

* **ES3 — Optimizador de estrategia y estrategia óptima marcada:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* recorre todas las estrategias legales de una a tres paradas (orden de compuestos y vuelta de cada parada, con los juegos que quedan en stock y la regla de dos compuestos) y calcula el tiempo total de cada una con ES1 y ES2 (ideas 1, 2 y 4). Devuelve la lista ordenada con la óptima marcada, la diferencia de cada una con la óptima y el **punto de cruce**: «dos paradas compensan si la parada cuesta menos de X s». Si dos estrategias están a menos de un margen (a decidir, propuesto 1 s), las marca como empatadas en lugar de elegir una por décimas.
  * *Sale en pantalla:* tiempo total, número de paradas, vueltas de cada tanda y compuestos; la óptima destacada.
  * *Rendimiento:* en 70 vueltas con tres paradas salen decenas de miles de combinaciones; se recorre por tramos y se descartan pronto las que no pueden ganar, sin bloquear la pantalla.

* **ES4 — Riesgo de Safety Car y estrategia robusta:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* probabilidad de Safety Car y de VSC real por circuito (hoy 45 % en los 23, dato de relleno; buscar fuente abierta de históricos y anotarla) y, con ella, el tiempo esperado de cada estrategia: además de la «óptima sin incidencias», la **óptima esperada**, que puede alargar la primera tanda para aprovechar un Safety Car (idea 11). Se enseñan las dos si no coinciden, con una frase que explique por qué: «en Mónaco compensa alargar: 6 de cada 10 carreras tienen Safety Car».
  * *A decidir:* si el valor esperado se calcula con fórmula (rápido) o simulando muchas carreras con Safety Car aleatorio (más fiel, más lento).

* **ES5 — Neumático de salida y posición en pista:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* elegir con qué compuesto se sale (idea 8): el blando gana puestos en la salida y en la primera vuelta, pero dura menos con el coche lleno. El optimizador suma un valor a ganar o perder puestos según lo difícil que sea adelantar en ese circuito (zonas de DRS y tipo de circuito) y la posición de parrilla. Se enseña: «saliendo con blando ganas de media N puestos; con medio pierdes M segundos menos en la primera tanda».
  * *A decidir:* de dónde sale la ganancia en la salida (medida en el motor con salidas simuladas, recomendado, o un valor fijo por circuito).

* **ES6 — Planes B, C y D:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* además del plan A, alternativas preparadas con su disparador (idea 9): Safety Car antes de la ventana (parar ya), atascado detrás de un coche más lento (adelantar la parada para salir en aire limpio, con la ventana de parada de T4.15), neumático que se gasta más de lo previsto (pasar a una parada más) y lluvia (ES7). En carrera, cuando se cumple un disparador, el muro avisa y ofrece cambiar al plan con un toque, por la misma vía que las órdenes del jugador. Cada parada del plan lleva una ventana de ± N vueltas, no una vuelta fija.

* **ES7 — Plan de lluvia:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* con la previsión del tiempo (T3.2) y el agarre por agua de cada compuesto (`tyreWaterGrip`, T3.3), los puntos de cruce secos → intermedios → lluvia y la vuelta prevista para cambiar (idea 12). Si la lluvia prevista es corta y ligera, valorar no parar (según la habilidad del piloto en mojado, que ya tiene el juego) y ahorrarse una parada.

* **ES8 — Carga de combustible:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* permitir salir con menos combustible del necesario para ir más ligero y compensar ahorrando en mitad de la carrera (idea 7). Hoy la carga es una regla igual para todos (`initialFuelKg`), así que es un cambio de reglas: el plan enseña la ganancia por vuelta del peso, las vueltas de ahorro que harían falta y el riesgo de quedarse sin combustible.
  * *A decidir con el usuario:* si entra en el sprint. Es la tarea con más riesgo de cambiar el equilibrio de las carreras; se puede dejar fuera sin afectar a las demás.

* **ES9 — Undercut y overcut contra un rival:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* elegir un rival de referencia (el de delante en parrilla, por ejemplo) y ver cuánto se gana parando N vueltas antes que él (undercut) o después (overcut) en ese circuito, con ES1 y ES2 (idea 13). El plan puede quedar escrito como «parar 2 vueltas antes que X». En carrera se apoya en el aviso de undercut que ya existe.

* **ES10 — Pantalla de ajuste de la estrategia:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* la pantalla antes de la salida para revisar y ajustar el plan: tandas en una barra por vueltas con el color de cada compuesto (como los bloques del vídeo), la lista de ES3 con la óptima marcada, el punto de cruce, los planes B a D y, al mover a mano una parada o cambiar un compuesto, el tiempo nuevo y la diferencia con la óptima al momento. Al aceptar, el plan se carga en el muro con `programPitStops`. En multijugador, un plan por coche del equipo y nada visible de los demás equipos. Funciona en el móvil (Sprint 15) y es el contenido de MJ11.

* **ES11 — Estrategias de los rivales:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* que los equipos de la IA elijan su plan con el mismo optimizador, sin hacer todos lo mismo: unos la óptima, otros una alternativa cercana o el desfase con su rival directo, según el carácter del equipo. El estratega de la IA (`Strategist.ts`, R25) sigue decidiendo en carrera con su información observable, pero parte de su plan. Así el jugador ve estrategias distintas en pista y los planes B tienen sentido.

* **ES12 — Comprobar que la óptima gana de verdad:** `[ ] PENDIENTE — PROPUESTA 29/10/2026; CONTRATO DE TESTS POR PROPONER`
  * *Qué:* banco de pruebas que corre la óptima y sus alternativas en el motor real en varios circuitos (propuestos: Mónaco, Monza, Silverstone y Barcelona) y compara el tiempo previsto con el que sale. La previsión y la carrera deben coincidir dentro de un margen a acordar y la óptima no puede perder de media contra las demás. Con el resultado, la revisión del usuario.

---

## 4. Orden y dependencias

* **Orden propuesto:** ES1 → ES2 → ES3 → ES4 → ES5 → ES9 → ES6 → ES7 → ES10 → ES11 → ES12 (ES8 si el usuario la mete, después de ES3).
* ES1 y ES2 son la base: sin ellas el resto adivina. ES3 es la primera entrega que se puede ver (lista de estrategias con la óptima marcada, aunque sea sin pantalla nueva).
* **Con el Sprint 15:** MJ11 hace la pantalla con la escena de Blender y ES10 lo que hay dentro. Dos opciones para el usuario:
  * **A (recomendada):** el Sprint 16 va justo antes que MJ11, o MJ11 pasa a este sprint, para hacer la pantalla una sola vez con su contenido.
  * **B:** MJ11 se hace primero con un plan simple y ES10 la amplía después.

## 5. Fuera del alcance

* Simular la carrera completa con todos los rivales para cada estrategia (demasiado lenta para la pantalla previa). El tráfico entra como coste estimado.
* Cambiar el modelo de neumáticos o de combustible del motor: el sprint mide lo que hay. Si ES12 descubre que algo no cuadra, se apunta como tarea aparte.
* Estrategias de varias carreras (ahorro de juegos para la siguiente, Sprint 12).

## 6. Para pasarlo al `DASHBOARD.md`

Fila de la tabla de la sección 2:

```
| **Sprint 16** | **Estrategia antes de la carrera: curvas de neumático medidas en el motor, pérdida en boxes en verde, VSC y Safety Car, optimizador con la estrategia óptima marcada, riesgo de Safety Car, neumático de salida, planes B a D, plan de lluvia, carga de combustible, undercut y overcut, pantalla de ajuste, estrategias de los rivales y comprobación en el motor (ES1-ES12)** | ⏳ **PLANIFICADO el 29/10/2026; ninguna tarea con contrato de tests** |
```

Línea para `sprintOf` en `scripts/build-dashboard.mjs`:

```js
if (/^ES\d/.test(id)) return 'Sprint 16';
```

La sección 3 entera va como `### 7.18 Sprint 16 — Estrategia antes de la carrera (planificado el 29/10/2026)`, después de la 7.17. Luego `npm run sync:tasks`, `npm run dashboard` y `node test-suite.mjs --module documentation`.
