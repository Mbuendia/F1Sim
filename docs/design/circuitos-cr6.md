# CR6 — Revisión de los circuitos (Sprint 10.5)

Fuentes: datos de [OpenStreetMap](https://www.openstreetmap.org/copyright) (© OpenStreetMap contributors, ODbL), ya en
coordenadas del juego en las fichas de CR1 (`docs/design/cr1/<id>.json`) y en `src/data/osmScenery/<id>.json`
(`node scripts/osm-scenery.mjs`); fotos de referencia de Wikimedia Commons cuando hacen falta. Nada de Google ni de modelos
de pago. Mónaco queda fuera (CR4 cerrado).

## Reglas comunes (tanda 0)

- **Agua:** la real de OpenStreetMap, recortada a 450 m del circuito y con sus islas metidas en el contorno; sin agua
  inventada (`detailWater` ya no se usa con el kit).
- **Nada sobre el agua:** se quitan los objetos y las piezas del kit que la pisan; flotan solo barcos (enteros sobre el
  agua), pantalanes y puentes. Las gradas del kit que no caben en la orilla pasan a la pequeña.
- **Árboles:** palmeras, pinos y árboles del kit donde OpenStreetMap tiene bosque, arbolado o hileras (rejilla de 30 m,
  1 de cada pocos si son muchos); donde no hay arbolado, ninguno.
- **Edificios reales:** los de OpenStreetMap a 150 m de la pista, con su huella y su altura (`height`,
  `building:levels` × 3,2 m + 1, o según su tipo), en una sola malla por circuito y con fachada por ciudad
  (`realBuildings.ts`, 14 estilos). Los edificios genéricos de los urbanos ya no se ponen. El kit no mete piezas dentro.
- **Puentes:** cada puente de OpenStreetMap que cruza la pista es un objeto `bridge` con su `osm`, el modelo de Blender de
  su tipo (`puente-carretera`, `monorrail`, `pasarela`) y un rótulo de parodia.
- **Pasos bajo la pista:** los que se abren a la vista llevan sus dos bocas (`boca-tunel`, una a cada lado, a
  semiancho + 6 m del eje); los que van bajo edificios, a dos niveles o más, por un centro comercial o son alcantarillas,
  no (justificados en cada circuito).

## `montreal`

Montreal — tanda 1.

Revisión propia (tanda 1). Capturas en `docs/design/cr6-circuitos/montreal-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** el bassin olympique, el lac des Régates y el San Lorenzo son los de OpenStreetMap (antes se pintaba el 6 % del agua a 300 m de la pista; CR1 ya no marca diferencia).
- **Resuelto (objetos):** de 36 objetos sobre agua real a ninguno, salvo la planta del casino (justificado abajo); lo que pisaba el agua se quita o pasa a la orilla.
- **Resuelto (puentes):** los 6 puentes de OpenStreetMap que cruzan la pista, cada uno con su modelo según el tipo y rótulo de parodia (antes había 1).
- **Resuelto (arboles):** 158 pinos donde OpenStreetMap tiene bosque y arbolado en las islas (antes 12).
- **Resuelto (iconos):** la Biosfera ([way/26288030](https://www.openstreetmap.org/way/26288030)) y el casino ([way/26698931](https://www.openstreetmap.org/way/26698931)) en su sitio real, con el centro, el giro y la planta de su huella; antes iban a una distancia fija de la pista.
- **Justificado (objetos):** el casino está en su sitio real ([way/26698931](https://www.openstreetmap.org/way/26698931)); su planta rectangular pisa los estanques pequeños que lo rodean ([way/697836070](https://www.openstreetmap.org/way/697836070), [way/697836071](https://www.openstreetmap.org/way/697836071), [way/697836072](https://www.openstreetmap.org/way/697836072)), que el juego no pinta por pequeños. Más pequeño no cabe sin mojarse: el centro del edificio está entre ellos.
- **Blender:** `public/models/scenery/casino-montreal.glb` (nuevo: núcleo de cristal, forjados, aletas de aluminio inclinadas, el cubo de cristal con su pasarela, marquesina y luces) y `public/models/scenery/biosfera.glb`.
- Rendimiento tras la tanda 1 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 230 fps en PC y 40 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 43 edificios reales levantados; 6 puentes y 0 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque están donde va el edificio de boxes del juego: way/42229671.
  - Justificado (edificios): 1 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/439917766.
  - Justificado (edificios): 1 no se levantan porque tocan el pit lane: way/1243714693.
  - Justificado (edificios): 2 no se levantan porque tocan la pista: way/1244170828, way/1244212436.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/433148456.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 280 fps en PC y 55 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `melbourne`

Melbourne — tanda 1.

Revisión propia (tanda 1). Capturas en `docs/design/cr6-circuitos/melbourne-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** el lago de Albert Park entero, el de OpenStreetMap (antes se pintaba el 14 %).
- **Resuelto (agua):** fuera el lago inventado (unos 50 000 m² donde no hay agua).
- **Resuelto (objetos):** de 41 objetos sobre agua real a ninguno.
- **Resuelto (tuneles):** los 2 pasos bajo la pista de OpenStreetMap, con su boca a cada lado.
- **Resuelto (edificios):** 136 edificios de OpenStreetMap levantados con su huella y su altura (antes 24 cajas); fuera las torres inventadas junto al lago.
- **Resuelto (arboles):** los árboles del kit van donde OpenStreetMap marca árboles (1572 sueltos en el parque) y primero los más cercanos a la pista: 889 en calidad alta (antes 500 repartidos), que se ven desde las cámaras.
- **Resuelto (iconos):** el cobertizo de remo del lago ([way/208150115](https://www.openstreetmap.org/way/208150115)) en su sitio real, con su pantalán.
- **Blender:** `public/models/scenery/cobertizo-remo.glb` (nuevo: cobertizo de madera a dos aguas, porche, pantalán y botes).
- Rendimiento tras la tanda 1 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 202 fps en PC y 41 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 136 edificios reales levantados; 0 puentes y 2 pasos con bocas.
  - Justificado (edificios): 5 no se levantan porque están donde va el edificio de boxes del juego: way/321789092, way/321789093, way/321789094, way/321789095, way/321789097.
  - Justificado (edificios): 1 no se levantan porque tocan el pit lane: way/993669986.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/45379972.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 244 fps en PC y 43 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `marina-bay`

Marina Bay (Singapur) — tanda 1.

Revisión propia (tanda 1). Capturas en `docs/design/cr6-circuitos/marina-bay-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** la bahía, el río Singapur y el puerto, los de OpenStreetMap (antes se pintaba el 6 %).
- **Resuelto (agua):** fuera el agua inventada (unos 164 000 m² donde no hay).
- **Resuelto (objetos):** ningún objeto sobre agua real (antes 1).
- **Resuelto (tuneles):** 13 pasos bajo la pista con su boca a cada lado; los 8 que no se ven (pasillos de centros comerciales y los que van a dos niveles bajo tierra) quedan justificados abajo, uno por uno. CR1 sigue contando 23 contra 15 por ellos. Desde el 09/11 las bocas van con su planta entera 4 m detrás de las vallas y fuera del pit lane; los pasos cuyas bocas no caben así quedan justificados en las reglas comunes de abajo.
- **Resuelto (puentes):** los 15 puentes de OpenStreetMap que cruzan la pista, con su modelo y rótulo de parodia (antes 1).
- **Resuelto (iconos):** el hotel de las tres torres ([way/116800998](https://www.openstreetmap.org/way/116800998)), la noria ([way/230082125](https://www.openstreetmap.org/way/230082125)) y las dos cúpulas de la Esplanade ([way/256163011](https://www.openstreetmap.org/way/256163011), [way/256163012](https://www.openstreetmap.org/way/256163012)) en su sitio real; las palmeras, donde OpenStreetMap tiene árboles (ya no hace falta el mínimo de 10).
- **Blender:** `public/models/scenery/esplanade-domo.glb` (nuevo: zócalo de piedra, cúpula de cristal y unas 250 lamas triangulares de aluminio), con `public/models/scenery/marina-bay-sands.glb` y `public/models/scenery/noria.glb`.
- Rendimiento tras la tanda 1 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 165 fps en PC y 36 fps en móvil (pantalla de móvil y CPU 4 veces más lenta). Mediana de 3 pasadas: con los iconos y las 190 palmeras bajaba a 30 en móvil, así que en calidad media, de noche, el sol ya no echa sombra (a un cuarto de fuerza apenas se veía) y los árboles tampoco.

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 80 edificios reales levantados; 15 puentes y 13 pasos con bocas.
  - Justificado (edificios): 7 no se levantan porque tocan la pista: way/155987124, way/166311281, way/303311927, way/393090492, way/1492514975, relation/5901695, relation/5901695.
  - Justificado (edificios): 1 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/452647616.
  - Justificado (edificios): 2 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/170960936, way/393118061.
  - Justificado (tuneles): [way/460428751](https://www.openstreetmap.org/way/460428751) sin bocas, pasillo subterráneo de un centro comercial.
  - Justificado (tuneles): [way/460428756](https://www.openstreetmap.org/way/460428756) sin bocas, pasillo subterráneo de un centro comercial.
  - Justificado (tuneles): [way/460428764](https://www.openstreetmap.org/way/460428764) sin bocas, pasillo subterráneo de un centro comercial.
  - Justificado (tuneles): [way/460428767](https://www.openstreetmap.org/way/460428767) sin bocas, pasillo subterráneo de un centro comercial.
  - Justificado (tuneles): [way/743602039](https://www.openstreetmap.org/way/743602039) sin bocas, porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito).
  - Justificado (tuneles): [way/1061016030](https://www.openstreetmap.org/way/1061016030) sin bocas, pasillo subterráneo de un centro comercial.
  - Justificado (tuneles): [way/1313175993](https://www.openstreetmap.org/way/1313175993) sin bocas, va a 2 niveles bajo tierra.
  - Justificado (tuneles): [way/1314801297](https://www.openstreetmap.org/way/1314801297) sin bocas, va a 2 niveles bajo tierra.
  - Justificado (tuneles): [way/1314801318](https://www.openstreetmap.org/way/1314801318) sin bocas, va a 2 niveles bajo tierra.
  - Justificado (tuneles): [way/1545634125](https://www.openstreetmap.org/way/1545634125) sin bocas, porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito).
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 194 fps en PC y 37 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `miami`

Miami — tanda 1.

Revisión propia (tanda 1). Capturas en `docs/design/cr6-circuitos/miami-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** los canales y lagos de alrededor, los de OpenStreetMap (antes se pintaba el 0 % del agua real a 300 m).
- **Resuelto (agua):** fuera el puerto inventado (unos 28 000 m² donde no hay agua).
- **Resuelto (objetos):** ningún objeto sobre agua real (antes 2).
- **Resuelto (barcos):** fuera los 8 yates del puerto falso, que acababan en los lagos: OpenStreetMap no tiene puerto ahí.
- **Resuelto (puentes):** los 5 puentes de OpenStreetMap que cruzan la pista, con su modelo y rótulo de parodia (antes 1).
- **Resuelto (arboles):** 162 palmeras donde OpenStreetMap tiene arbolado (antes 12).
- **Resuelto (iconos):** el estadio ([way/171419981](https://www.openstreetmap.org/way/171419981)) en su sitio real dentro del circuito, con su modelo propio en lugar del genérico (`estadio.glb`, que ya no se usa y se borra).
- **Blender:** `public/models/scenery/estadio-miami.glb` (nuevo: campo, 40 tramos de gradas escalonadas en verde azulado y naranja, fachada, anillo de cubierta blanco con 4 mástiles y tirantes, marcadores).
- Rendimiento tras la tanda 1 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 186 fps en PC y 38 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 74 edificios reales levantados; 5 puentes y 0 pasos con bocas.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 226 fps en PC y 46 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `las-vegas`

Las Vegas — tanda 2.

Revisión propia (tanda 2). Capturas en `docs/design/cr6-circuitos/las-vegas-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** los lagos y estanques de los hoteles, los de OpenStreetMap: el juego pinta el 100 % del agua real a 300 m de la pista (antes el 0 %).
- **Resuelto (objetos):** de 9 objetos sobre agua real a ninguno, salvo las fuentes del lago (justificado abajo).
- **Resuelto (puentes):** los 10 puentes de OpenStreetMap que cruzan la pista, cada uno con su modelo según el tipo y rótulo de parodia (antes había 1).
- **Resuelto (edificios):** 203 edificios de OpenStreetMap levantados con su huella y su altura (antes 26 cajas a menos de 150 m). Siguen las torres altas del Strip que pide scenery-3d-5.
- **Resuelto (iconos):** la Esfera ([way/976405284](https://www.openstreetmap.org/way/976405284)), la torre Eiffel ([way/27831699](https://www.openstreetmap.org/way/27831699)) con el globo de enfrente ([way/364846544](https://www.openstreetmap.org/way/364846544)), el hotel del lago ([way/25723909](https://www.openstreetmap.org/way/25723909)) y sus fuentes ([way/22971030](https://www.openstreetmap.org/way/22971030)) en su sitio real, con el centro, el giro y la planta de su huella; antes la Esfera y la torre iban a una distancia fija de la pista.
- **Justificado (objetos):** las fuentes van dentro del lago del hotel ([way/22971030](https://www.openstreetmap.org/way/22971030)), que es donde están: son chorros de agua sobre el agua.
- **Blender:** `public/models/scenery/hotel-lago.glb` (nuevo: torre curva crema de 15 tramos escalonados, tejados de teja, bandas de ventanas encendidas de noche, zócalo del casino y farolas del paseo), `public/models/scenery/fuentes-lago.glb` (nuevo: 36 chorros altos en ola hasta 70 m con su bruma, fila de chorros bajos y barandilla), `public/models/scenery/globo-paris.glb` (nuevo: marquesina, cesta y globo con anillos de luces y gajos dorados), con `public/models/scenery/esfera.glb` y `public/models/scenery/torre-eiffel.glb`.
- Rendimiento tras la tanda 2 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 189 fps en PC y 33 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 203 edificios reales levantados; 10 puentes y 0 pasos con bocas.
  - Justificado (edificios): 6 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/33974140, way/95223232, way/182464622, way/385356660, way/1085922690, relation/1599958.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 163 fps en PC y 33 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `suzuka`

Suzuka — tanda 2.

Revisión propia (tanda 2). Capturas en `docs/design/cr6-circuitos/suzuka-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** el agua del parque y de alrededor, la de OpenStreetMap: el juego pinta el 100 % del agua real a 300 m de la pista (antes el 0 %).
- **Resuelto (objetos):** de 10 objetos sobre agua real a ninguno.
- **Resuelto (tuneles):** 8 de los 12 pasos bajo la pista de OpenStreetMap (la carretera 三行庄野線 y los demás pasos), con su boca a cada lado (antes ninguno). Desde el 09/11 las bocas van con su planta entera 4 m detrás de las vallas y fuera del pit lane; los pasos cuyas bocas no caben así quedan justificados en las reglas comunes de abajo.
- **Resuelto (edificios):** 122 edificios de OpenStreetMap levantados con su huella y su altura (antes 1).
- **Resuelto (iconos):** la noria del parque de atracciones ([way/184107083](https://www.openstreetmap.org/way/184107083)) en su sitio real, detrás de la recta, con su modelo propio; antes iba a una distancia fija de la pista.
- **Blender:** `public/models/scenery/noria-suzuka.glb` (nuevo: dos llantas blancas con 48 radios, luces en la llanta, 32 cabinas de colores, caballetes en A y la estación de subida).
- Rendimiento tras la tanda 2 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 223 fps en PC y 55 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 122 edificios reales levantados; 1 puentes y 8 pasos con bocas.
  - Justificado (edificios): 2 no se levantan porque tocan la pista: way/184419751, way/469591633.
  - Justificado (edificios): 1 no se levantan porque están donde va el edificio de boxes del juego: way/184429429.
  - Justificado (edificios): 7 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/183394069, way/183394522, way/183394524, way/184107052, way/184120096, way/184120100, way/469650857.
  - Justificado (tuneles): [way/183969196](https://www.openstreetmap.org/way/183969196) sin bocas, corre junto a la pista y sus dos bocas quedarían del mismo lado.
  - Justificado (tuneles): [way/467945733](https://www.openstreetmap.org/way/467945733) sin bocas, porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito).
  - Justificado (tuneles): [way/469010265](https://www.openstreetmap.org/way/469010265) sin bocas, porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito).
  - Justificado (tuneles): [way/941604835](https://www.openstreetmap.org/way/941604835) sin bocas, porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito).
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 232 fps en PC y 44 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `baku`

Bakú — tanda 2.

Revisión propia (tanda 2). Capturas en `docs/design/cr6-circuitos/baku-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** el mar Caspio y el agua del bulevar, la de OpenStreetMap: el juego pinta el 100 % del agua real a 300 m de la pista (antes el 40 %).
- **Resuelto (agua):** fuera el agua inventada (unos 140 000 m² donde no hay).
- **Resuelto (objetos):** de 3 objetos sobre agua real a ninguno.
- **Resuelto (tuneles):** 4 pasos bajo la pista con su boca a cada lado (antes ninguno); los otros 2 corren junto a la pista y no se ven, justificados en las reglas comunes de abajo. CR1 sigue contando 7 contra 5 por ellos. Desde el 09/11 las bocas van con su planta entera 4 m detrás de las vallas y fuera del pit lane; los pasos cuyas bocas no caben así quedan justificados en las reglas comunes de abajo.
- **Resuelto (puentes):** los 2 puentes de OpenStreetMap que cruzan la pista, con su modelo y rótulo de parodia (antes 1).
- **Resuelto (edificios):** 595 edificios de OpenStreetMap levantados con su huella y su altura (antes 18 cajas). La muralla de la ciudad vieja sigue.
- **Resuelto (iconos):** la Torre de la Doncella ([way/299418016](https://www.openstreetmap.org/way/299418016)), las Flame Towers en la colina ([way/253081850](https://www.openstreetmap.org/way/253081850), [way/253082095](https://www.openstreetmap.org/way/253082095), [way/253081914](https://www.openstreetmap.org/way/253081914)), la Casa de Gobierno ([way/152809510](https://www.openstreetmap.org/way/152809510)) y el museo de la alfombra ([way/253082269](https://www.openstreetmap.org/way/253082269)) en su sitio real; antes la torre y las Flame Towers iban a una distancia fija de la pista.
- **Blender:** `public/models/scenery/casa-gobierno.glb` (nuevo: palacio de piedra arenisca en torno a un patio, pórtico de columnas, torre escalonada con aguja, torres de esquina con tejado verde y ventanas), `public/models/scenery/museo-alfombra.glb` (nuevo: rollo de alfombra de planta curva con bandas roja, crema y azul, testeros de cristal y la punta desenrollada), con `public/models/scenery/torre-doncella.glb` y `public/models/scenery/flame-towers.glb`.
- Rendimiento tras la tanda 2 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 207 fps en PC y 56 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 595 edificios reales levantados; 2 puentes y 4 pasos con bocas.
  - Justificado (edificios): 12 no se levantan porque tocan la pista: way/133641453, way/133847240, way/152190848, way/249200550, way/299424046, way/307928469, way/327765450, way/694786373, way/1445714287, way/1502989778, relation/2072750, relation/3793138.
  - Justificado (edificios): 4 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/152191870, way/286018691, way/1413599169, way/1413599170.
  - Justificado (edificios): 3 no se levantan porque tocan el pit lane: way/152192676, way/822375069, way/1414182639.
  - Justificado (edificios): 3 no se levantan porque están donde va el edificio de boxes del juego: way/715443020, way/1413368983, way/1414182643.
  - Justificado (edificios): 8 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/152192129, way/249199845, way/286018683, way/286018693, way/385595163, way/465973262, relation/5737121, relation/19362909.
  - Justificado (tuneles): [way/25405194](https://www.openstreetmap.org/way/25405194) sin bocas, corre junto a la pista y sus dos bocas quedarían del mismo lado.
  - Justificado (tuneles): [way/626012957](https://www.openstreetmap.org/way/626012957) sin bocas, porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito).
  - Justificado (tuneles): [way/686457580](https://www.openstreetmap.org/way/686457580) sin bocas, corre junto a la pista y sus dos bocas quedarían del mismo lado.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 234 fps en PC y 42 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `zandvoort`

Zandvoort — tanda 2.

Revisión propia (tanda 2). Capturas en `docs/design/cr6-circuitos/zandvoort-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** el agua de alrededor, la de OpenStreetMap: el juego pinta el 100 % del agua real a 300 m de la pista (antes el 37 %).
- **Resuelto (agua):** fuera el agua inventada (unos 205 000 m² donde no hay).
- **Resuelto (objetos):** de 12 objetos sobre agua real a ninguno.
- **Resuelto (tuneles):** los 3 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 94 edificios de OpenStreetMap levantados con su huella y su altura (antes ninguno a menos de 150 m). Las dunas siguen.
- **Resuelto (iconos):** la torre del radar de costa ([node/2109645438](https://www.openstreetmap.org/node/2109645438), 50 m) en su sitio real.
- **Blender:** `public/models/scenery/torre-radar.glb` (nuevo: celosía de acero en pirámide con cruces, dos plataformas, escalera, caseta roja y blanca y la antena de radar con su luz).
- Rendimiento tras la tanda 2 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 182 fps en PC y 57 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 94 edificios reales levantados; 1 puentes y 3 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque tocan el pit lane: way/1292844577.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 212 fps en PC y 42 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `shanghai`

Shanghái — tanda 3.

Revisión propia (tanda 3). Capturas en `docs/design/cr6-circuitos/shanghai-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

Referencia: el modelo `shanghai_international_circuit_2018_layout.glb` (Dave Love, CC BY 4.0, solo mirado; no se copia su geometría), el mismo de CR5. Lo que tenía y faltaba en el juego eran las gradas de las curvas 1 y 2, con su cubierta curva, y las de la horquilla, con sus sombrillas en flor de loto.

- **Resuelto (agua):** los lagos del recinto, los de OpenStreetMap: el juego pinta el 99 % del agua real a 300 m de la pista (antes el 9 %).
- **Justificado (objetos):** de 16 objetos sobre agua real a 10: son los pabellones de los equipos sobre el lago del paddock y sus pasarelas (CR5), que en la referencia también están sobre el agua, sobre pilotes.
- **Resuelto (tuneles):** los 2 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (arboles):** fuera los 220 árboles inventados junto a la pista; ahora solo donde OpenStreetMap tiene arbolado.
- **Arreglos del 09/11 (a petición del usuario):** fuera los dos techos `techo_tribuna` del kit sobre la tribuna principal, que desde lejos parecían esferas blancas (shanghai-ck4 cambiado con su permiso). Se probó un árbol 3D en lugar de los del kit y el usuario prefirió los del kit, mejorados: los tres árboles del kit (en todos los circuitos que los llevan) están rehechos en Blender (`scripts/blender/kit-arboles.py`) con la misma foto a 512 px, tres planos cruzados y dos de copa para que desde arriba se vea follaje, cara y revés con normales de copa para que no salgan negros, y sin que la copa toque el agua real.
- **Resuelto (edificios):** 63 edificios de OpenStreetMap levantados con su huella y su altura.
- **Resuelto (iconos):** las gradas de las curvas 1 y 2 en su sitio real, B1 ([way/156341844](https://www.openstreetmap.org/way/156341844)), B2 ([way/156341848](https://www.openstreetmap.org/way/156341848), la curva) y B3 ([way/156341851](https://www.openstreetmap.org/way/156341851)), en 30 tramos; y las de la horquilla, H ([way/1372223261](https://www.openstreetmap.org/way/1372223261)) y K ([way/1372223262](https://www.openstreetmap.org/way/1372223262)), en 40 tramos. Las gradas van en tramos de unos 16 m que siguen la planta de OpenStreetMap, curvas incluidas (la línea media sale de emparejar los dos lados largos de la huella); si un tramo pisa el margen de la pista, se recorta por delante.
- **Blender:** `public/models/scenery/grada-cubierta-sh.glb` (nuevo: 14 filas de asientos rojos y azules, pasillo de escalera, muro de atrás y la cubierta blanca en voladizo que se curva hacia arriba, con pilar, cercha, canalón y focos), `public/models/scenery/grada-sombrillas.glb` (nuevo: 9 filas y una sombrilla de embudo con diez pétalos sobre su mástil por tramo), con los de CR5 (`public/models/scenery/shanghai-tribuna.glb`, `public/models/scenery/shanghai-ala.glb`, `public/models/scenery/shanghai-pabellon.glb`).
- Rendimiento tras la tanda 3 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 290 fps en PC y 53 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 4 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 63 edificios reales levantados; 0 puentes y 2 pasos con bocas.
  - Justificado (edificios): 2 no se levantan porque están donde va el edificio de boxes del juego: way/156328694, way/156346097.
  - Justificado (edificios): 4 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/156346094, way/156346179, way/156346191, way/156346195.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/157875750.
  - Justificado (objetos): los pabellones de los equipos van sobre pilotes en el lago ([relation/2094966](https://www.openstreetmap.org/relation/2094966)), como en el modelo de referencia (CR5).
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 228 fps en PC y 44 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `yas-marina`

Yas Marina (Abu Dabi) — tanda 3.

Revisión propia (tanda 3). Capturas en `docs/design/cr6-circuitos/yas-marina-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** el puerto y los canales, los de OpenStreetMap: el juego pinta el 100 % del agua real a 300 m de la pista (antes el 0 %).
- **Justificado (objetos):** de 14 objetos sobre agua real a 7: son los pantalanes y los yates del puerto (CR5), que van en el agua.
- **Resuelto (barcos):** los barcos, todos en el agua real del puerto (antes 14 en tierra).
- **Resuelto (tuneles):** los pasos bajo la pista de OpenStreetMap (el del pit lane y el acceso a la tribuna principal entre ellos), 8 con su boca a cada lado (antes 1).
- **Resuelto (puentes):** los 5 puentes de OpenStreetMap que cruzan la pista, con su modelo (antes 2).
- **Resuelto (edificios):** 98 edificios de OpenStreetMap levantados con su huella y su altura (antes 1).
- **Resuelto (iconos):** las cuatro gradas de OpenStreetMap en su sitio real con su toldo de vela: la del norte, en U alrededor de la horquilla ([way/168411369](https://www.openstreetmap.org/way/168411369), 30 tramos), la del oeste, en L ([way/133907352](https://www.openstreetmap.org/way/133907352)), la de la marina ([way/133907079](https://www.openstreetmap.org/way/133907079)) y la del sur ([way/133907081](https://www.openstreetmap.org/way/133907081)). Las gradas van en tramos de unos 16 m que siguen la planta de OpenStreetMap, curvas incluidas (la línea media sale de emparejar los dos lados largos de la huella); si un tramo pisa el margen de la pista, se recorta por delante. El hotel, la cubierta de rejilla y el puerto siguen como en CR5.
- **Blender:** `public/models/scenery/grada-vela.glb` (nuevo: 12 filas de asientos, pasillo de escalera, toldo blanco de vela tensada alto atrás sobre su mástil y bajo delante, tirantes y luces bajo la vela para la carrera de noche), con los de CR5 (`public/models/scenery/yas-hotel-a.glb`, `public/models/scenery/yas-hotel-cubierta.glb`, `public/models/scenery/pantalan.glb`).
- Rendimiento tras la tanda 3 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 186 fps en PC y 38 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 4 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 98 edificios reales levantados; 5 puentes y 8 pasos con bocas.
  - Justificado (edificios): 4 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/188732698, way/188732717, way/188732720, way/188732721.
  - Justificado (edificios): 1 no se levantan porque están donde va el edificio de boxes del juego: way/1270594556.
  - Justificado (edificios): 1 no se levantan porque tocan el pit lane: way/1574992885.
  - Justificado (edificios): 1 no se levantan porque tocan la pista: relation/2541470.
  - Justificado (objetos): los pantalanes del puerto flotan y el edificio del hotel del lado del puerto ([relation/2541470](https://www.openstreetmap.org/relation/2541470)) se asoma al agua, como el real (CR5).
  - Justificado (arboles): los 92 árboles están sobre arbolado real, pero solo 3 de los 10 trozos de arbolado mapeado a 150 m tienen árbol cerca. Se revisa en la tanda 3.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 161 fps en PC y 33 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `jeddah`

Yeda — tanda 3.

Revisión propia (tanda 3). Capturas en `docs/design/cr6-circuitos/jeddah-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

Referencias públicas: OpenStreetMap casi no tiene edificios junto a la cornisa (unos 20 en 300 m), así que la mezquita se modeló con fotos de Wikimedia Commons: https://commons.wikimedia.org/wiki/Category:Al-Rahmah_Mosque (y la cornisa, https://commons.wikimedia.org/wiki/Category:Jeddah_Corniche). Su sitio, el nodo https://www.openstreetmap.org/node/539501874; el de la fuente del rey Fahd, https://www.openstreetmap.org/node/3098654094.

- **Resuelto (agua):** el mar Rojo y las lagunas, los de OpenStreetMap: el juego pinta el 100 % del agua real a 300 m de la pista (antes el 35 %).
- **Resuelto (agua):** fuera el agua inventada (unos 137 000 m² donde no hay).
- **Justificado (objetos):** queda 1 objeto sobre agua real, y es a propósito: la mezquita flotante va sobre pilotes en el mar, donde está, y la fuente es un chorro en el mar.
- **Justificado (tuneles):** CR1 cuenta 1 paso contra 0, pero no es un paso bajo la pista: es un tramo de 21 m de la propia pista (highway=raceway, layer −1, [way/1257884704](https://www.openstreetmap.org/way/1257884704)) que pasa bajo un puente. No hay nada que abrir.
- **Resuelto (puentes):** los 3 puentes de OpenStreetMap que cruzan la pista (la carretera y las dos pasarelas), con su modelo (antes 1).
- **Resuelto (iconos):** la mezquita flotante de Al-Rahmah en su sitio real ([node/539501874](https://www.openstreetmap.org/node/539501874)), sobre el mar junto a la cornisa. La fuente del rey Fahd está a unos 13 km al sur ([node/3098654094](https://www.openstreetmap.org/node/3098654094)), fuera del escenario: antes iba en un punto cualquiera del mar; ahora va en el mar lo más lejos posible hacia su sitio real (scenery-3d-5 pide que esté en el mar y pase de 100 m).
- **Blender:** `public/models/scenery/mezquita-rahma.glb` (nuevo: pilotes, plataforma con paseo y barandilla, sala blanca con arcadas de arcos en las cuatro fachadas y luz cálida bajo ellos, tambor con ventanas, cúpula central turquesa con remate dorado, cúpulas de esquina y cupulillas del pretil, y el alminar con su balcón), con `public/models/scenery/fuente.glb`.
- Rendimiento tras la tanda 3 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 217 fps en PC y 43 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 4 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 7 edificios reales levantados; 3 puentes y 0 pasos con bocas.
  - Justificado (edificios): 2 no se levantan porque tocan la pista: way/1257884698, way/1257884705.
  - Justificado (edificios): 1 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/1258945369.
  - Justificado (tuneles): [way/1257884704](https://www.openstreetmap.org/way/1257884704) sin bocas, no cruza el eje del juego.
  - Justificado (objetos): la fuente del rey Fahd está en el mar, como la real ([Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:King_Fahd%27s_Fountain)).
  - Justificado (arboles): OpenStreetMap no tiene arbolado mapeado junto a la pista; se dejan las palmeras de antes, que sí hay en la realidad.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 177 fps en PC y 35 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `interlagos`

Interlagos — tanda 3.

Revisión propia (tanda 3). Capturas en `docs/design/cr6-circuitos/interlagos-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (agua):** los lagos de Interlagos, los de OpenStreetMap: el juego pinta el 100 % del agua real a 300 m de la pista (antes el 0 %).
- **Resuelto (agua):** fuera el agua inventada (unos 53 000 m² donde no hay).
- **Resuelto (objetos):** de 9 objetos sobre agua real a ninguno.
- **Resuelto (tuneles):** los 2 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 351 edificios de OpenStreetMap levantados con su huella y su altura (antes 9 cajas). Siguen los rascacielos de São Paulo al fondo que pide scenery-3d-5.
- **Resuelto (iconos):** el edificio de boxes del kartódromo Ayrton Senna, en el interior del circuito, junto a la calle de boxes del kartódromo ([way/542523199](https://www.openstreetmap.org/way/542523199)) y paralelo a ella. OpenStreetMap llama «Kartódromo Ayrton Senna» también a un helipuerto ([way/563180515](https://www.openstreetmap.org/way/563180515)); no es el kartódromo y no se usa.
- **Blender:** `public/models/scenery/kartodromo.glb` (nuevo: planta baja con 12 garajes de persiana, planta alta acristalada con balcón corrido, cubierta con alero y luces, franja verde y amarilla y la torre de control en un extremo).
- Rendimiento tras la tanda 3 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 264 fps en PC y 50 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 4 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 351 edificios reales levantados; 1 puentes y 2 pasos con bocas.
  - Justificado (edificios): 7 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/138539197, way/619077918, way/619082960, way/619083004, way/619083093, way/619083229, way/619083232.
  - Justificado (edificios): 2 no se levantan porque están donde va el edificio de boxes del juego: way/190167517, way/191577975.
  - Justificado (edificios): 2 no se levantan porque tocan la pista: way/191577976, way/1262772379.
  - Justificado (edificios): 1 no se levantan porque tocan el pit lane: way/1262374301.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/1563340820.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 214 fps en PC y 41 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `silverstone`

Silverstone — tanda 4.

Revisión propia (tanda 4). Capturas en `docs/design/cr6-circuitos/silverstone-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (objetos):** de 4 objetos sobre agua real a ninguno (los estanques del recinto, ahora pintados con su forma de OpenStreetMap).
- **Resuelto (tuneles):** los 2 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 130 edificios de OpenStreetMap levantados con su huella y su altura (antes 1).
- **Resuelto (puentes):** los 6 puentes de OpenStreetMap que cruzan la pista, con su modelo (antes 1).
- **Resuelto (iconos):** The Wing, el edificio de boxes, con el giro y el largo de su huella real ([way/227332429](https://www.openstreetmap.org/way/227332429), 375 m). La huella cubre también los garajes, que en el juego son el edificio de boxes del kit: The Wing va justo detrás de ellos, unos 40 m apartado de su sitio, sin tocar el edificio de boxes del kit en ningún punto (se mira cada 6 m de su largo, también donde los boxes se curvan hacia Wellington). Antes era una caja de 200 m en un punto cualquiera junto a la recta.
- **Resuelto (iconos):** las 18 gradas con nombre de OpenStreetMap en su sitio real, en 111 tramos: Becketts ([way/227342446](https://www.openstreetmap.org/way/227342446)), Luffield ([way/227342456](https://www.openstreetmap.org/way/227342456)), Woodcote A y B, Abbey ([way/227342458](https://www.openstreetmap.org/way/227342458)), Farm Curve, Hamilton Straight, National Pit Straight, Village, Chapel, The View, las cuatro de Copse y las dos de Stirling. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en la tanda 3); si un tramo pisa el margen de la pista, se recorta por delante.
- **Blender:** `public/models/scenery/ala-silverstone.glb` (nuevo: planta baja oscura, dos plantas acristaladas con forjados blancos y lamas verticales en la fachada de la pista, terraza con barandilla, el puente del centro de prensa más alto en medio y la cubierta en forma de ala, de perfil aerodinámico y borde redondeado hacia la pista, que ondula a lo largo del edificio, con soportes y luces bajo el borde), `public/models/scenery/grada-silverstone.glb` (nuevo: 12 filas de asientos azules y blancos, pasillo de escalera, barandilla, chapa nervada detrás y cubierta plana en voladizo colgada de un mástil con tirantes, con correas y luces). Sale el modelo antiguo de The Wing (the-wing.glb).
- Rendimiento tras la tanda 4 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 260 fps en PC y 47 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 130 edificios reales levantados; 6 puentes y 2 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque están donde va el edificio de boxes del juego: way/227342455.
  - Justificado (edificios): 3 no se levantan porque tocan la pista: way/507976158, way/507977621, way/1412628537.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/227342443.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 216 fps en PC y 39 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `spa`

Spa-Francorchamps — tanda 4.

Revisión propia (tanda 4). Capturas en `docs/design/cr6-circuitos/spa-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (tuneles):** 8 de los 9 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno). Desde el 09/11 las bocas van con su planta entera 4 m detrás de las vallas y fuera del pit lane; los pasos cuyas bocas no caben así quedan justificados en las reglas comunes de abajo.
- **Resuelto (edificios):** 128 edificios de OpenStreetMap levantados con su huella y su altura (antes 1).
- **Resuelto (iconos):** la tribuna de Eau Rouge es ahora la del Raidillon de OpenStreetMap ([way/1134053908](https://www.openstreetmap.org/way/1134053908)), con su planta, en 8 tramos (antes, una grada genérica en un punto cualquiera de la curva 2). Con ella, las gradas con nombre: la de la RX ([way/868882525](https://www.openstreetmap.org/way/868882525)), las dos de Endurance ([way/1353159436](https://www.openstreetmap.org/way/1353159436), [way/77352249](https://www.openstreetmap.org/way/77352249)), la tribuna F1 del sur ([way/174882363](https://www.openstreetmap.org/way/174882363)) y la Silver 1 ([way/1353159437](https://www.openstreetmap.org/way/1353159437)): 6 gradas en 61 tramos. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en la tanda 3); si un tramo pisa el margen de la pista, se recorta por delante.
- **Justificado (iconos):** la gran grada F1 de la recta de meta ([way/77352246](https://www.openstreetmap.org/way/77352246), 311 m) no se pone: en el juego el pit lane y su edificio de boxes pasan por donde ella está (a 10 m), y el trazado del pit lane no se toca en CR6. Sigue el bosque de las Ardenas de la tanda 0.
- **Blender:** `public/models/scenery/grada-spa.glb` (nuevo: 10 filas de asientos grises y rojos, barandilla, muro de atrás de tablas de madera y tejadillo de chapa verde oscuro a dos aguas sobre pilares finos, con sus pares, la viga delantera y la cruz de San Andrés).
- Rendimiento tras la tanda 4 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 212 fps en PC y 40 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 128 edificios reales levantados; 1 puentes y 8 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque tocan la pista: way/1509741672.
  - Justificado (tuneles): [way/74783502](https://www.openstreetmap.org/way/74783502) sin bocas, porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito).
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 187 fps en PC y 39 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `monza`

Monza — tanda 4.

Revisión propia (tanda 4). Capturas en `docs/design/cr6-circuitos/monza-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (tuneles):** los 9 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 38 edificios de OpenStreetMap levantados con su huella y su altura (antes 1).
- **Resuelto (puentes):** los 4 puentes de OpenStreetMap que cruzan la pista (entre ellos los del óvalo antiguo), con su modelo (antes 2).
- **Resuelto (iconos):** el peralte del óvalo antiguo por su trazado real: las dos curvas, la Sopraelevata Nord ([way/19982933](https://www.openstreetmap.org/way/19982933) y sus tramos) y la Sud ([way/19983025](https://www.openstreetmap.org/way/19983025) y sus tramos), en 100 tramos de 20 m que siguen la curva (de 120; los que pisarían la pista nueva o su margen se quedan fuera, que es donde la pista pasa por debajo o al lado). Antes era una pieza de 260 m en un sitio inventado.
- **Resuelto (iconos):** el podio, en su sitio real (el edificio «Podio» de OpenStreetMap, [way/219396377](https://www.openstreetmap.org/way/219396377)): vuela sobre la recta a la altura de la meta (antes, 160 m después).
- **Resuelto (iconos):** las 12 gradas con nombre de OpenStreetMap en su sitio real, en 68 tramos: la Centrale ([way/193647796](https://www.openstreetmap.org/way/193647796)), las dos Laterali de la recta, la de la Prima Variante ([way/231026019](https://www.openstreetmap.org/way/231026019)), Vedano, la Parabolica, las tres de Alta Velocità, la Piscina, Ascari y la Laterale Parabolica. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en la tanda 3); si un tramo pisa el margen de la pista, se recorta por delante.
- **Blender:** `public/models/scenery/peralte-tramo.glb` (nuevo: losa de hormigón viejo curvada que sube casi vertical hacia fuera, juntas de dilatación, pilares y vigas bajo la parte alta, terraplén de hierba bajo la baja, pretil, valla oxidada arriba y manchas de musgo), `public/models/scenery/grada-monza.glb` (nuevo: 11 filas de asientos rojos y grises, barandilla, ventanas en el muro de atrás y la cubierta de losa fina de hormigón en voladizo sobre pilares con capitel y nervios, con la franja verde de la cornisa). Sale el modelo antiguo de una pieza (peralte.glb).
- Rendimiento tras la tanda 4 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 207 fps en PC y 37 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 38 edificios reales levantados; 4 puentes y 9 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque están donde va el edificio de boxes del juego: way/194458106.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 218 fps en PC y 39 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `barcelona`

Barcelona — tanda 4.

Revisión propia (tanda 4). Capturas en `docs/design/cr6-circuitos/barcelona-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (tuneles):** los 6 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 55 edificios de OpenStreetMap levantados con su huella y su altura (antes 1).
- **Resuelto (puentes):** los 2 puentes de OpenStreetMap que cruzan la pista, con su modelo (antes 1).
- **Resuelto (iconos):** el graderío principal, enfrente de los boxes, en su sitio real ([way/33742643](https://www.openstreetmap.org/way/33742643), 289 m) y en 18 tramos, con su gran cubierta; y las gradas con letra de OpenStreetMap: G ([way/152007381](https://www.openstreetmap.org/way/152007381)), J, N, F, M, L, K, E, B y H: 11 gradas en 85 tramos en total. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en la tanda 3); si un tramo pisa el margen de la pista, se recorta por delante.
- **Justificado (iconos):** la torre de control sigue junto a la recta donde estaba: OpenStreetMap no tiene una huella para ella (scenery-3d-5 la pide).
- **Blender:** `public/models/scenery/grada-principal-bcn.glb` (nuevo: grada baja de 9 filas, fila de palcos acristalados con su voladizo y barandilla, grada alta de 8 filas, muro de atrás con ventanales y la gran cubierta blanca colgada de un pórtico de celosía, con luces; asientos rojos, amarillos y azules), `public/models/scenery/grada-bcn.glb` (nuevo: 11 filas descubiertas en franjas de colores, pasarela de arriba con barandilla y torre de megafonía con foco).
- Rendimiento tras la tanda 4 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 190 fps en PC y 37 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 55 edificios reales levantados; 2 puentes y 6 pasos con bocas.
  - Justificado (edificios): 2 no se levantan porque están donde va el edificio de boxes del juego: way/151609932, way/152034063.
  - Justificado (edificios): 3 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/152007400, way/1167920784, way/1167920785.
  - Justificado (edificios): 1 no se levantan porque tocan la pista: way/1372681544.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/151594583.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 230 fps en PC y 45 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `spielberg`

Spielberg — tanda 5.

Revisión propia (tanda 5). Capturas en `docs/design/cr6-circuitos/spielberg-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (tuneles):** los 4 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 22 edificios de OpenStreetMap levantados con su huella y su altura (antes 0). Los edificios del recinto llevan el estilo de fachada `circuito` (naves de chapa clara y oficinas con banda de vidrio), no el de casas.
- **Resuelto (iconos):** el toro de acero de la colina, en su sitio real ([node/5443064309](https://www.openstreetmap.org/node/5443064309)), mirando a la pista desde la ladera.
- **Resuelto (iconos):** las 9 gradas de OpenStreetMap en su sitio real, en 98 tramos: la de salida ([way/312030921](https://www.openstreetmap.org/way/312030921)), la de Estiria ([way/312030917](https://www.openstreetmap.org/way/312030917)), las dos de la curva 3 bajo el toro ([way/118364945](https://www.openstreetmap.org/way/118364945), [way/604402038](https://www.openstreetmap.org/way/604402038)), la norte, la este, la de la curva 10, la del centro y la de la 13. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en las tandas 3 y 4); si un tramo pisa el margen de la pista, se recorta por delante.
- **Blender:** `public/models/scenery/grada-spielberg.glb` (nuevo: 11 filas de asientos gris plata y azules, muro de atrás de lamas de alerce y cubierta de chapa gris clara a un agua sobre pórticos de acero en A, con el borde levantado hacia la pista y luces debajo).
- Rendimiento tras la tanda 5 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 243 fps en PC y 47 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 22 edificios reales levantados; 0 puentes y 4 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque tocan el pit lane: way/118364939.
  - Justificado (edificios): 1 no se levantan porque están donde va el edificio de boxes del juego: way/194684180.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 231 fps en PC y 45 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `bahrain`

Baréin — tanda 5.

Revisión propia (tanda 5). Capturas en `docs/design/cr6-circuitos/bahrain-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (objetos):** de 1 objeto sobre agua real a ninguno (el agua del recinto, ahora pintada con su forma de OpenStreetMap; ningún objeto del juego cae en ella).
- **Resuelto (tuneles):** los 6 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 145 edificios de OpenStreetMap levantados con su huella y su altura (antes 1). Los edificios del recinto llevan el estilo de fachada `circuito` (naves de chapa clara y oficinas con banda de vidrio), no el de casas.
- **Resuelto (iconos):** la torre de Sakhir en su sitio real ([way/187123438](https://www.openstreetmap.org/way/187123438)), con su huella de 36 m y sus 71 m de alto (antes, un modelo más simple de la torre fuera de su sitio). Junto a ella, las gradas de OpenStreetMap: la principal ([way/187123419](https://www.openstreetmap.org/way/187123419)), la de la primera curva ([way/271535967](https://www.openstreetmap.org/way/271535967)), la B, la C, las tres de la universidad y las dos de la victoria: 9 gradas en 71 tramos. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en las tandas 3 y 4); si un tramo pisa el margen de la pista, se recorta por delante. Siguen las dunas de la tanda 0.
- **Blender:** `public/models/scenery/torre-sakhir.glb` (nuevo: podio de dos plantas, fuste color arena con aletas verticales, siete plantas acristaladas que se abren como una copa, cada una con su forjado claro, y la carpa blanca en pico sobre el mirador), `public/models/scenery/grada-bahrain.glb` (nuevo: 12 filas de asientos rojos y blancos sobre hormigón color arena, celosía en el muro de atrás y, en cada tramo, un toldo blanco de carpa con su pico sobre cuatro postes con sus vientos; luces de noche). Sale el modelo antiguo de la torre.
- Rendimiento tras la tanda 5 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 172 fps en PC y 38 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 145 edificios reales levantados; 0 puentes y 6 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/187123413.
  - Justificado (edificios): 10 no se levantan porque están donde va el edificio de boxes del juego: way/1357566097, way/1487598824, way/1487598825, way/1487598826, way/1487598827, way/1487598828, way/1489399038, way/1489399039, way/1489399040, way/1489399041.
  - Justificado (edificios): 5 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/1487582961, way/1487582962, way/1487582967, way/1487582968, relation/20311525.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 175 fps en PC y 34 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `lusail`

Lusail — tanda 5.

Revisión propia (tanda 5). Capturas en `docs/design/cr6-circuitos/lusail-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (tuneles):** los 3 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 110 edificios de OpenStreetMap levantados con su huella y su altura (antes 0). Los edificios del recinto llevan el estilo de fachada `circuito` (naves de chapa clara y oficinas con banda de vidrio), no el de casas.
- **Resuelto (iconos):** la tribuna principal, enfrente de los boxes, en su sitio real ([way/152483596](https://www.openstreetmap.org/way/152483596)) y en 26 tramos que siguen su planta, con su cubierta ondulada. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en las tandas 3 y 4); si un tramo pisa el margen de la pista, se recorta por delante. Siguen las dunas y las palmeras de la tanda 0.
- **Blender:** `public/models/scenery/grada-lusail.glb` (nuevo: 13 filas de asientos granates y blancos, palcos acristalados detrás y la cubierta blanca en voladizo, una onda por tramo para que la cubierta entera ondule, sobre costillas curvas de acero, con la línea de luces de la carrera de noche).
- Rendimiento tras la tanda 5 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 189 fps en PC y 35 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 110 edificios reales levantados; 0 puentes y 3 pasos con bocas.
  - Justificado (edificios): 2 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/152483597, way/1316027519.
  - Justificado (edificios): 3 no se levantan porque están donde va el edificio de boxes del juego: way/1037707301, way/1316039486, way/1316199218.
  - Justificado (edificios): 3 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/1316027509, way/1316027510, way/1442338650.
  - Justificado (arboles): OpenStreetMap no tiene arbolado mapeado junto a la pista; se dejan las palmeras de antes, que sí hay en la realidad.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 165 fps en PC y 32 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `hungaroring`

Hungaroring — tanda 5.

Revisión propia (tanda 5). Capturas en `docs/design/cr6-circuitos/hungaroring-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (tuneles):** los 1 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 27 edificios de OpenStreetMap levantados con su huella y su altura (antes 0). Los edificios del recinto llevan el estilo de fachada `circuito` (naves de chapa clara y oficinas con banda de vidrio), no el de casas.
- **Resuelto (puentes):** los 2 puentes de OpenStreetMap que cruzan la pista, con su modelo (antes 1).
- **Resuelto (iconos):** la tribuna principal, en la recta de meta, en su sitio real ([way/230979479](https://www.openstreetmap.org/way/230979479)) y en 17 tramos que siguen su planta. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en las tandas 3 y 4); si un tramo pisa el margen de la pista, se recorta por delante.
- **Blender:** `public/models/scenery/grada-hungaroring.glb` (nuevo: 12 filas con los asientos en franjas rojas, blancas y verdes, pasillo con barandilla a media altura, muro de atrás de bloque gris con ventanas y la cubierta blanca plana sobre pilares en V, con luces debajo).
- Rendimiento tras la tanda 5 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 198 fps en PC y 36 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 27 edificios reales levantados; 2 puentes y 1 pasos con bocas.
  - Justificado (edificios): 2 no se levantan porque tocan el pit lane: way/123905481, way/231443446.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/294740484.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 212 fps en PC y 46 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `mexico-city`

Ciudad de México — tanda 5.

Revisión propia (tanda 5). Capturas en `docs/design/cr6-circuitos/mexico-city-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (tuneles):** los 1 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 132 edificios de OpenStreetMap levantados con su huella y su altura (antes 0).
- **Resuelto (puentes):** los 6 puentes de OpenStreetMap que cruzan la pista, con su modelo (antes 1).
- **Resuelto (iconos):** el Palacio de los Deportes en su sitio real ([relation/20951534](https://www.openstreetmap.org/relation/20951534)), con su cúpula de 160 m de cobre en facetas.
- **Resuelto (iconos):** las gradas del estadio de OpenStreetMap en su sitio real: las dos plateas altas ([way/828705060](https://www.openstreetmap.org/way/828705060), [way/1313865160](https://www.openstreetmap.org/way/1313865160)), las dos bermas ([way/828705068](https://www.openstreetmap.org/way/828705068), [way/828705069](https://www.openstreetmap.org/way/828705069)) y la de los jardines ([way/828705076](https://www.openstreetmap.org/way/828705076)): 5 gradas en 30 tramos. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en las tandas 3 y 4); si un tramo pisa el margen de la pista, se recorta por delante.
- **Justificado (iconos):** el palco central del estadio ([way/828705061](https://www.openstreetmap.org/way/828705061)) no se pone: su sitio lo ocupa el estadio del kit del juego, que ya tiene grada ahí.
- **Blender:** `public/models/scenery/palacio-deportes.glb` (nuevo: cúpula de 160 m en facetas de cobre de dos tonos, anillo blanco en la base, entradas acristaladas y linterna arriba). Las gradas usan `public/models/scenery/grada-hungaroring.glb` con sus asientos de colores.
- Rendimiento tras la tanda 5 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 185 fps en PC y 33 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 132 edificios reales levantados; 6 puentes y 1 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/828705077.
  - Justificado (edificios): 1 no se levantan porque tocan la pista: way/1315400019.
  - Justificado (edificios): 1 no se levantan porque están en el juego pero no se dibujan, porque una grada de la recta o la torre del kit ocupan su sitio: way/1191967010.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 234 fps en PC y 37 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

## `austin`

Austin — tanda 5.

Revisión propia (tanda 5). Capturas en `docs/design/cr6-circuitos/austin-*`: antes y después (general, dos persecuciones y a bordo) y, solo después, cada icono de cerca y en persecución al pasar por él.

- **Resuelto (objetos):** de 1 objeto sobre agua real a ninguno (el agua del recinto, ahora pintada con su forma de OpenStreetMap; ningún objeto del juego cae en ella).
- **Resuelto (tuneles):** los 3 pasos bajo la pista de OpenStreetMap, con su boca a cada lado (antes ninguno).
- **Resuelto (edificios):** 28 edificios de OpenStreetMap levantados con su huella y su altura (antes 1). Los edificios del recinto llevan el estilo de fachada `circuito` (naves de chapa clara y oficinas con banda de vidrio), no el de casas.
- **Resuelto (puentes):** los 3 puentes de OpenStreetMap que cruzan la pista, con su modelo (antes 1).
- **Resuelto (iconos):** la torre de observación en su sitio real ([node/7911006730](https://www.openstreetmap.org/node/7911006730)), con sus 76 m, el ascensor de vidrio y el velo de cables rojos (antes, un modelo más pesado).
- **Resuelto (iconos):** las gradas de OpenStreetMap en su sitio real: la de la curva 15 ([way/460658892](https://www.openstreetmap.org/way/460658892)) y las siete numeradas ([way/460658889](https://www.openstreetmap.org/way/460658889), [way/460658890](https://www.openstreetmap.org/way/460658890), [way/460658891](https://www.openstreetmap.org/way/460658891), [way/460683347](https://www.openstreetmap.org/way/460683347), [way/998801547](https://www.openstreetmap.org/way/998801547), [way/998801549](https://www.openstreetmap.org/way/998801549), [way/1183793500](https://www.openstreetmap.org/way/1183793500)): 8 gradas en 61 tramos. Cada grada va en tramos de unos 16 m que siguen su planta de OpenStreetMap (como en las tandas 3 y 4); si un tramo pisa el margen de la pista, se recorta por delante.
- **Blender:** `public/models/scenery/torre-cota.glb` (rehecho: fuste blanco con el ascensor, mirador circular acristalado y el velo rojo de 18 pares de cables que se cruzan; 33 KB frente a unos 121 KB del anterior), `public/models/scenery/grada-austin.glb` (nuevo: gradas de aluminio descubiertas de 14 filas sobre estructura de acero vista, con escalera en medio, barandilla y una vela de sombra roja tensada en lo alto de cada tramo).
- Rendimiento tras la tanda 5 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 190 fps en PC y 38 fps en móvil (pantalla de móvil y CPU 4 veces más lenta; mediana de 3 pasadas en móvil).

<!-- tanda 0 -->
Reglas comunes (tanda 0, medidas con `scratch/cr56/diag-cr6.mjs`):

  - 28 edificios reales levantados; 3 puentes y 3 pasos con bocas.
  - Justificado (edificios): 1 no se levantan porque están donde va el edificio de boxes del juego: way/460658886.
  - Justificado (edificios): 2 no se levantan porque están bajo un icono, una grada o el paddock del juego: way/847781224, way/998801550.
  - Rendimiento tras la tanda 0 (`?rendimiento=prueba`, RTX 4060, 30 s en persecución): 216 fps en PC y 46 fps en móvil (pantalla de móvil y CPU 4 veces más lenta).

