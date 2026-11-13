# CR12 — Edificios con su aspecto real (Sprint 10.5)

Fecha: 13/11/2026. Origen: la revisión de CR10 del usuario («muchos siguen teniendo edificios que parecen viviendas»).

## Qué pasaba

CR6 levantó los edificios reales de OpenStreetMap con su huella y su altura, pero todos con el mismo aspecto: la fachada
de ventanas del estilo de la ciudad y un tejado plano de color. Un polideportivo de 31.000 m², una marquesina o una grada
salían como un bloque de pisos.

## Regla: el uso de cada edificio

`scripts/osm-scenery.mjs` (`useOf`) da a cada edificio un uso a partir de sus etiquetas de OpenStreetMap y de su tamaño, y
lo guarda en `src/data/osmScenery/<id>.json` (`use`):

| Uso | Cuándo | Cómo se pinta |
|---|---|---|
| `grada` | `leisure=bleachers`, `grandstand=yes` o `building=grandstand` / `bleachers` | No es una caja: tramos de grada que siguen su planta (`segments`), puestos por el escenario |
| `cubierta` | `building=roof` o `carport` | Una losa de medio metro sobre pilares, sin paredes |
| `nave` | Industrial, almacén, comercio, polideportivo, garajes, hangar, estadio, aparcamiento, estación; o cualquier edificio de 2.500 m² o más y 25 m de alto como mucho que no sea de viviendas, hotel u oficinas | Paredes de panel liso y cubierta de chapa gris, sin ventanas por planta ni teja |
| `ciudad` | El resto | La fachada de su ciudad, como antes |

En los 22 circuitos con kit: 18 gradas (todas en Suzuka), 87 cubiertas, 206 naves y 2.488 edificios de ciudad.

`buildingLook` (`src/scene3d/realBuildings.ts`) dice cómo se pinta cada uno; todos siguen en una sola malla por circuito,
así que no hay llamadas de dibujo nuevas.

## Modelos propios

Hechos en Blender 5.2 con `scripts/blender/cr12-models.py`, estilo propio y sin marcas reales. Las referencias sirven solo
para la forma y los colores: no se copia geometría ni se usa ninguna foto en el juego.

| Modelo | Dónde | Referencias |
|---|---|---|
| `scenery/boca-tunel.glb` | Las bocas de los pasos bajo la pista de todos los circuitos (Eau Rouge entre ellas). Antes era un pórtico suelto; ahora es una abertura en un talud de tierra, con muros de acompañamiento y quitamiedos | Las plantas de los pasos, de OpenStreetMap |
| `scenery/centro-acuatico-melbourne.glb` | El centro deportivo y acuático de Albert Park ([way/154881920](https://www.openstreetmap.org/way/154881920)) y la cubierta de su piscina exterior ([way/321791822](https://www.openstreetmap.org/way/321791822)) | Foto exterior de Wikimedia Commons, [Melbourne sports and aquatic centre from albert park lake.jpg](https://commons.wikimedia.org/wiki/File:Melbourne_sports_and_aquatic_centre_from_albert_park_lake.jpg): naves bajas de chapa gris con cubiertas claras y la nave alta oscura con mástiles blancos y lona en picos. Sobre la cubierta de lona y sus mástiles, la ficha de [LSAA](https://lsaa.org/projects/large-fabric-structures/100-melbourne-sports-aquatic-centre) |
| `scenery/canal-olimpico-montreal.glb` | El edificio de los atletas del canal olímpico de remo ([way/46866696](https://www.openstreetmap.org/way/46866696)) y sus gradas, el edificio largo junto a la horquilla ([way/115814115](https://www.openstreetmap.org/way/115814115)) | La ficha del [Bassin olympique](https://www.parcjeandrapeau.com/fr/bassin-olympique-montreal/) del Parc Jean-Drapeau (barrio de los atletas, pabellón de administración, gradas, hangares y torre de llegada) y la categoría de Wikimedia Commons [Olympic Basin of Montreal](https://commons.wikimedia.org/wiki/Category:Olympic_Basin_of_Montreal) |

Fuentes de datos: © colaboradores de OpenStreetMap (ODbL). Nada de mapas ni modelos de pago.

## Lo que queda sin resolver

- **Horquilla de Suzuka:** los edificios de detrás no tienen nombre ni tipo en OpenStreetMap y siguen con el estilo de
  ciudad. Las 18 gradas de Suzuka que salían como edificios sí pasan a ser gradas.
- **Gradas del canal de Montreal:** el modelo queda con los escalones hacia la pista; las reales miran al canal.
- **Naves:** van lisas, sin detalle. Si alguna se ve mucho y queda pobre, se le puede hacer modelo propio.

## Capturas

`docs/design/cr12-edificios/`: antes y después de Melbourne, Montreal, Suzuka (dos vistas) y Eau Rouge.
