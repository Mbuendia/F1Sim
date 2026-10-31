# Alturas de los circuitos (CR8, 31/10/2026)

Valoración pedida por el usuario el 28/10/2026, antes de CK5 (relieve en 3D) y CK6 (pendientes en el motor). Hoy todos los
circuitos tienen el mismo desnivel inventado (`elevationChangeMeters: 25`) y el juego es plano, salvo los puentes.

## Fuentes y licencias

- **Trazado real:** GeoJSON de [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), licencia **MIT**
  (© 2019-2025 Tomislav Bacinger). Un trazado por circuito, en coordenadas reales.
- **Altura:** modelos de elevación abiertos consultados por la API pública de **OpenTopoData** (gratuita, sin cuenta):
  - **SRTM** de 30 m (NASA/USGS, dominio público), en todos los circuitos;
  - **EU-DEM** v1.1 de 25 m (Copernicus, uso libre citando: «Produced using Copernicus data and information funded by
    the European Union - EU-DEM layers»), en los circuitos europeos.
- Nada sale de Google ni de las imágenes de los modelos de pago.
- Scripts de medición en `scratch/cr8/` (`medir.mjs` y `perfil-monaco.mjs`); los datos crudos, en `scratch/cr8/alturas.json`.

**Límite de los datos:** SRTM y EU-DEM miden la superficie, **edificios y árboles incluidos**. En los circuitos de
campo abierto aciertan: Spa sale con 103 m frente a unos 102 reales. En los urbanos suben de más por los edificios
(Marina Bay, Las Vegas y Baku), y con 30 m de resolución no ven detalles pequeños, como los peraltes de Zandvoort o la
loma de la curva 1 de Austin.

## Valoración por circuito

Medido: desnivel del trazado con SRTM, 100 puntos por vuelta y mediana de cada tres; Mónaco, con el perfil de la
prueba. Publicado: solo donde la cifra es conocida y fiable; si no, n/d. Categoría según lo medido: mucho (40 m o
más), medio (15–40 m), casi plano (menos de 15 m).

| Circuito | Medido (m) | Publicado (m) | Categoría | Lo que chocaría con el relieve |
|---|---|---|---|---|
| `spa` | 103 | 102 | mucho | Eau Rouge–Raidillon (la subida más empinada del calendario), pit lane en bajada, gradas en ladera, bosque en pendiente |
| `monaco` | 45.6 | 42 | mucho | túnel bajo el hotel, edificios a pie de pista en todo el trazado, puerto a nivel del mar, pit lane junto al puerto |
| `spielberg` | 61 | 65 | mucho | subida de la recta a la curva 3, gradas en ladera, pit lane en la parte baja |
| `interlagos` | 42 | 43 | mucho | cuenco con la recta de meta en subida, pit lane en pendiente, gradas en el talud |
| `suzuka` | 43 | 40 | mucho | puente del cruce en ocho (el tramo de abajo y el de arriba), noria y gradas en ladera |
| `barcelona` | 32 | 30 | medio | recta de meta en bajada hacia la curva 1, pit lane, gradas en el talud |
| `hungaroring` | 35 | n/d | medio | valle con gradas naturales en la ladera, pit lane en la parte baja |
| `baku` | 35 | n/d | medio | subida de la ciudad vieja (castillo, calles estrechas); el dato sube de más por los edificios |
| `marina-bay` | 33 | n/d | medio | dato inflado por los rascacielos (el trazado es casi plano); puentes y bahía |
| `austin` | 31 | 41 | medio | loma de la curva 1 (SRTM la suaviza: medido por debajo del real), torre de observación |
| `las-vegas` | 23 | n/d | medio | dato inflado por los casinos y la esfera (el trazado es casi plano); edificios a pie de pista |
| `bahrain` | 22 | n/d | medio | desierto con lomas suaves, gradas y torre junto a la meta |
| `mexico-city` | 20 | n/d | medio | estadio con gradas alrededor de la pista; parte del dato son las gradas |
| `monza` | 16 | n/d | medio | parque con árboles (suben el dato), peraltes viejos, puente de la curva Grande |
| `silverstone` | 13 | n/d | casi plano | antiguo aeródromo; edificio de boxes y gradas |
| `melbourne` | 11 | n/d | casi plano | lago y parque; nada que lo justifique |
| `jeddah` | 10 | n/d | casi plano | paseo marítimo; muros a pie de pista |
| `montreal` | 10 | n/d | casi plano | isla con lago de remo; puente y muro de los campeones |
| `lusail` | 8 | n/d | casi plano | desierto llano |
| `yas-marina` | 8 | n/d | casi plano | túnel de salida del pit lane, hotel sobre la pista, puerto deportivo |
| `zandvoort` | 7 | n/d | casi plano | peraltes en las dunas (SRTM no los ve con 30 m); dunas alrededor |
| `miami` | 7 | n/d | casi plano | aparcamientos del estadio; puente sobre la autopista |
| `shanghai` | 5 | n/d | casi plano | llano con lago; puente sobre la meta y edificios del paddock |

**Ganan de verdad:** Spa, Mónaco, Spielberg, Interlagos y Suzuka, además de Austin por su cifra publicada (41 m). En
esos seis el relieve se notaría en las cámaras bajas y en la tele. Los casi planos no cambian. En los de categoría
media sin cifra publicada (Marina Bay, Las Vegas, México) el dato está inflado por edificios y gradas: no merece la pena.

## Prueba en Mónaco

Perfil en `docs/design/cr8/monaco-perfil.json` y gráfica en `docs/design/cr8/monaco-perfil.png` (y `.svg`).

- **Cómo se hizo:**
  - 300 puntos de la vuelta real, uno cada 11 m, consultados en SRTM y en EU-DEM.
  - De cada punto se toma el menor de los dos modelos, porque los dos suben con los edificios. Donde no hay dato
    (el mar), el puerto va a 2 m.
  - Para quitar los picos de los edificios, una apertura de 150 m, porque en Mónaco las manzanas miden de 50 a 100 m;
    después, una media móvil de 80 m.
  - El túnel va de la salida del Portier a la nueva chicane, unos 430 m. Ahí la medida da el hotel de encima, así que
    la altura se interpola en línea recta entre la entrada y la salida y esos puntos quedan marcados (`tunnel`).
- **Resultado:**
  - Desnivel de **45,6 m** frente a unos 42 reales (+9 %).
  - La subida de Sainte Dévote al Casino es de unos 39 m; después baja por Mirabeau y Loews hasta el túnel, y el
    tramo del puerto (Tabac, Piscina, Rascasse) queda llano, a 2–10 m.
  - Ninguna pendiente pasa del 20 %.
- **Encaje con el juego:**
  - El trazado real se encaja con el del juego girándolo, escalándolo y reflejándolo (el del juego está en espejo
    vertical, como el SVG del que sale); el error medio es de 4,9 m.
  - Cada uno de los 1.757 puntos del trazado del juego toma la altura del punto real más cercano (`game` en el JSON),
    y la vuelta empieza en la meta del juego. Es decir: el relieve real se puede llevar al juego sin tocar su trazado.
- **Lo que falla:**
  - Aún queda algo de edificio: el Casino sale algo alto (unos 47 m) y hay un bulto de unos 8 m cerca de la Rascasse que no es
    real.
  - A la salida del túnel la medida sube a unos 14 m, cuando debería seguir cerca del mar.
  - Con datos abiertos basta para el aspecto general, pero no para la calle exacta. Para Mónaco, y para cualquier
    circuito urbano, hacen falta además unos pocos **puntos de control** corregidos a mano con alturas publicadas
    (Casino, Portier, salida del túnel, Rascasse).

## Coste

**En el 3D (CK5):**
- **Suelo:** hoy es plano. Con relieve sería una rejilla de alturas por circuito, por ejemplo de 4 m en la franja de
  400 m alrededor de la pista: unos 60.000–120.000 triángulos según el circuito, en una sola malla. Sumaría 1 llamada
  de dibujo, porque sustituye al suelo actual, y 150–300 KB de datos de altura por circuito (comprimidos, menos).
- **Pista, pianos, escapatorias y franjas del kit:** ya son tiras de puntos; basta con darles la altura de cada punto,
  sin llamadas de dibujo nuevas.
- **Piezas del kit:** ya aceptan altura (`z` en `KitInstance`, de CK4). Habría que apoyarlas en la pendiente y ver las
  gradas en ladera. Ni triángulos ni llamadas nuevas.
- **Lo delicado:** puentes y túneles (Suzuka, Mónaco, el pit lane de Yas Marina), el pit lane en pendiente, el agua
  (que debe quedar horizontal), la cámara de persecución y el reparto de las sombras.
- Dentro del presupuesto de PF8: 250 llamadas por circuito, con margen (Shanghái va en 43). Lo que más pesa son los
  datos del suelo, que entrarían en `offlineCoreKB` (hoy 7.629 de 7.900 KB) si se guardan para jugar sin conexión.

**En el motor (CK6):**
- Que las cuestas cambien la velocidad (la gravedad a lo largo de la pendiente), la frenada y el agarre en las
  crestas cambia los tiempos de vuelta de todos los circuitos con desnivel.
- Con la misma semilla saldría la misma carrera dentro de la nueva versión, pero no la de antes. El banco de
  referencia R27 tendría que rehacerse, y eso solo se hace con autorización.
- Las partidas guardadas siguen siendo compatibles si las alturas salen de los datos del circuito y no se guardan en
  la partida. El multijugador necesita que los dos lados tengan los mismos datos de altura (misma versión).
- Hay que reajustar las curvas de referencia (UX18) y la estrategia. El jugador lo vería poco: la carrera se dirige
  desde el muro, no se conduce.

## Recomendación

Opciones para CK5 y CK6:

- **A (recomendada):** CK5 solo en 3D y solo en los seis de mucho desnivel (Spa, Mónaco, Spielberg, Interlagos, Suzuka
  y Austin), con el proceso de esta prueba más puntos de control a mano en Mónaco. CK6 se aparca: cambiar el motor
  rehace R27 y los equilibrios a cambio de un efecto que en un juego de gestión casi no se ve.
- **B:** CK5 en 3D en los 22 circuitos con datos (los urbanos, aplanados donde los edificios inflan el dato) y CK6 solo
  en los seis de mucho desnivel, con el banco R27 rehecho con autorización.
- **C:** CK5 y CK6 completos en todos los circuitos. Es lo más caro (suelo, pit lanes, túneles, R27, reequilibrar curvas
  y estrategia) y lo que menos se nota en los circuitos llanos.

La decisión del usuario se anota en las fichas de CK5 y CK6.
