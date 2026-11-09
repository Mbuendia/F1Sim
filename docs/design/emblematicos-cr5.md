# CR5: Shanghái y Yas Marina con sus edificios emblemáticos

Sprint 10.5, 07/11/2026. Contrato en `tests/modules/landmarks-cr5.mjs` y ficha de CR5 en `DASHBOARD.md`.
Código: `src/scene3d/landmarksCr5.ts` (colocación), `src/scene3d/yasCanopy.ts` (luces de la cubierta),
`src/scene3d/osmScenery.ts` (agua de OpenStreetMap) y `scripts/blender/cr5-models.py` (modelos).

## Shanghái

- **Tribuna principal** (`shanghai-tribuna.glb`, unos 327 × 52 × 31 m): dos gradas con asientos rojos y azules, muro
  trasero con aletas y la cubierta con sus agujeros redondos. Enfrente de los boxes, a lo largo de la recta.
- **Las dos alas** (`shanghai-ala.glb` y `shanghai-ala-torre.glb`): cruzan la recta a 18 m de altura con plantas de
  cristal y cubierta curva, cada una en un extremo de la tribuna y apoyada en su torre. El centro de cada ala sale de
  OpenStreetMap.
- **Pabellones de los equipos** (`shanghai-pabellon.glb`): diez, sobre pilotes en el lago del paddock, cada uno con la
  franja de su equipo y su pasarela (`shanghai-pasarela.glb`) hasta tierra. Las posiciones son los edificios de
  OpenStreetMap, metidas unos metros en el agua.
- **Agua:** el lago del paddock es [relation/2094966](https://www.openstreetmap.org/relation/2094966) y el estanque
  [way/156346160](https://www.openstreetmap.org/way/156346160). Fuera el lago inventado y el puente único de la meta.

### Lo que se tomó del modelo de referencia

El usuario dio `shanghai_international_circuit_2018_layout.glb` (Dave Love, CC BY 4.0) como referencia. Se miró en
Blender (vistas en planta y en perspectiva) para sacar proporciones y formas: las dos gradas y el reparto de colores de
los asientos, la cubierta con agujeros redondos, la altura y el grosor de las alas, las plantas de cristal, la curva
del techo y las torres, y los pabellones sobre pilotes con tejado a cuatro aguas. No se copió su geometría: todos los
modelos están hechos de cero en Blender para F1Sim.

## Yas Marina

- **Hotel** ([relation/2541470](https://www.openstreetmap.org/relation/2541470)): dos edificios, uno a cada lado de la
  pista (`yas-hotel-a.glb` del lado del puerto y `yas-hotel-b.glb` del lado del circuito), con ventanas que se encienden
  de noche, y el puente entre ellos sobre la pista (`yas-hotel-puente.glb`, 14 m libres).
- **Cubierta de rejilla** (`yas-hotel-cubierta.glb`, 240 × 130 m, unos 16.000 triángulos): malla de rombos de 8 m sobre
  los dos edificios y la pista. Lleva unos 900 paneles de LED que cambian de color con secuencias lentas
  (`yasCanopy.ts`). En calidad alta su luz tiñe la pista y los coches que pasan por debajo; en móvil esa luz va apagada
  para no gastar.
- **Bloom:** solo de noche y solo en calidad alta (PC). En móvil la calidad por defecto nunca es alta.
- **Pasarela del pit lane** (`pasarela-pit.glb`), sobre el pit lane de OpenStreetMap [way/176695253](https://www.openstreetmap.org/way/176695253):
  cruza el carril de boxes con 6 m libres en el tramo de salida hacia el túnel; la
  pasarela en sí no está dibujada en OpenStreetMap, así que va donde el carril se aleja de la pista, pasado el edificio
  de boxes.
- **Puerto:** el agua es la de OpenStreetMap (fuera la dársena redonda inventada), con pantalanes (`pantalan.glb`) y los
  barcos amarrados a sus dedos, todos sobre agua real. La torre de control no se mueve.

## Rendimiento (`?rendimiento=prueba&circuito=…`)

Medido el 07/11/2026 con la prueba PF1 (semilla 2026, persecución, 30 s), a la que se añadió `&circuito=` para estos
dos circuitos. PC: el del usuario, con Chrome y la gráfica NVIDIA RTX 4060. Móvil: el mismo Chrome emulando un móvil
(412 × 915, procesador 4× más lento); falta medirlo en un móvil de verdad.

- Shanghái: 277 fps en el PC y 46 fps en el móvil emulado.
- Yas Marina: 182 fps en el PC y 31 fps en el móvil emulado (entre 31 y 34 en dos pasadas; justo, por eso la luz de la
  cubierta va apagada en móvil).
- Yas Marina de noche con bloom, bajo el hotel: 78 fps en el PC.
- Referencia: Barcelona da 51 fps en el mismo móvil emulado.

## Capturas

En `docs/design/cr5-emblematicos/`: para cada circuito, una vista general lejana y una persecución por la zona cambiada,
más las de detalle (a bordo, tele, pabellones, helicóptero, puerto y pasarela). Yas Marina, de noche (19:10).

## Fuentes

Solo OpenStreetMap (© colaboradores de OpenStreetMap, ODbL) y el modelo de referencia que dio el usuario. Sin Google y
sin modelos de pago.
