# Modelos 3D de terceros

Los dos modelos de esta carpeta son obras de otros autores, publicadas en Sketchfab con licencia Creative Commons y
**modificadas** para F1Sim. Cada archivo conserva su licencia; el resto del repositorio no queda bajo ellas.

## `f1-car.glb`

- **Obra original:** «2025 F1 CAR»
- **Autor:** Abu Saif — https://sketchfab.com/abuhossain844
- **Origen:** https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898
- **Licencia:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Cambios (CA2, 07/11/2026):** reducido de 3,1 millones a unos 94 000 triángulos; girado con el morro hacia +X, escalado
  a 5,7 m y sin las luces LED; ruedas separadas con animación de giro; zonas de pintura por material (principal,
  secundaria y carbono); la franja amarilla del neumático pasa a ser la banda del compuesto; superficies para el dorsal
  y los patrocinadores (ficticios, los pone el juego).
## `f1-car-lod.glb`

- **Obra original:** «2025 F1 CAR»
- **Autor:** Abu Saif — https://sketchfab.com/abuhossain844
- **Origen:** https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898
- **Licencia:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Cambios (CA2, 07/11/2026):** a partir de `f1-car.glb`, versión lejana de unos 8 000 triángulos con las mismas zonas de
  pintura, banda del compuesto y superficies de rótulos. El juego la usa para los coches que se ven de lejos.
## `f1-car-piezas.glb`

- **Obra original:** «2025 F1 CAR»
- **Autor:** Abu Saif — https://sketchfab.com/abuhossain844
- **Origen:** https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898
- **Licencia:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Cambios (CA2, 07/11/2026):** a partir de `f1-car.glb`, el cuerpo se separa en piezas con nombre (`ala_delantera`,
  `ala_trasera`, `suelo`, `pontones`, `tapa_motor` y `chasis`), las ruedas cuelgan de `ruedas`, sin superficies de
  rótulos y con unos 54 000 triángulos. Lo usa el centro de temporada para resaltar la pieza que cambia cada mejora.

El coche de 2026 que usaba el juego hasta el 07/11/2026 («F1 2026 concept (polygon model)», de Qvist_designs,
https://sketchfab.com/Qvist_Designs, CC BY 4.0) se guarda en `assets/epoca-2026/`, fuera de lo que se publica, para la
época 2026 de las temporadas largas.
## `safety-car.glb`

- **Obra original:** «2019 Mercedes-Benz AMG GTR Safety Car»
- **Autor:** OUTPISTON — https://sketchfab.com/outpiston
- **Origen:** https://sketchfab.com/3d-models/2019-mercedes-benz-amg-gtr-safety-car-5bfaf6b31d084dde80dae723b52998bc
- **Licencia:** CC BY-NC-SA 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/
- **Condiciones:** solo uso **no comercial**; esta versión modificada se comparte con la misma licencia.
- **Cambios:** se han quitado las texturas, los emblemas y los rótulos de marcas; materiales planos; ruedas y barra de
  luces como piezas aparte con animación de giro; superficies para rótulos (los pone el juego).

El juego usa estos modelos en el visor 3D del paddock, en el aviso de Safety Car y, vistos desde arriba, para pintar
los coches y el Safety Car en la pista. El crédito visible va junto al visor del paddock y en el aviso de Safety Car.

Los archivos se preparan en Blender y se terminan con `node scripts/finalize-models.mjs`, que une la animación de las
ruedas en un clip y escribe esta atribución dentro de cada `.glb`.

## Kit de piezas de circuito (`kit/`)

- **Obra original:** «Shanghai International Circuit 2018 layout»
- **Autor:** Dave Love — https://sketchfab.com/Tyler_Dave
- **Origen:** https://sketchfab.com/3d-models/shanghai-international-circuit-2018-layout-4d3365f4de6442a5ae56e8807c518c4f
- **Licencia:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Cambios (CK2, 29–30/10/2026):** el circuito se parte en Blender en 31 piezas sueltas (23 comunes para todos los
  circuitos y 8 propias de Shanghái): guardarraíl, muro de neumáticos, valla alta, gradas, grúa, farolas, torre de
  posiciones, vehículos, árboles y edificios del paddock, entre otras. Se limpian (fuera trozos de piezas vecinas y las
  letras del distrito), se reducen, se ponen con el origen en el centro de la base y el largo en X, y sus texturas se
  hornean en dos atlas propios (`kit-comun.webp` y `kit-shanghai.webp`). Toda la publicidad real se sustituye por
  patrocinadores de parodia. La grada pequeña y el cartel de metros son nuevos, hechos para F1Sim.
- **Archivos:** `bloque_hormigon.glb`, `camion.glb`, `carpa.glb`, `cartel_metros.glb`, `cartel_pequeno.glb`, `coche_aparcado.glb`, `coche_medico.glb`, `edificio_b.glb`, `edificio_boxes.glb`, `estructura_b.glb`, `estructura_c.glb`, `farola.glb`, `grada_pequena.glb`, `grada_roja.glb`, `grua.glb`, `marcador.glb`, `marquesina.glb`, `pabellon.glb`, `pancarta.glb`, `poste_luz.glb`, `refugio_comisarios.glb`, `techo_tribuna.glb`, `torre_posiciones.glb`, `valla_publi.glb`. Desde CR3 (07/11/2026), el guardarraíl, la valla alta, el muro de neumáticos, la grada común y los tres árboles salen del modelo de Montreal (abajo).

## Kit de piezas de circuito sacadas del modelo de Montreal (`kit/`, CR3)

- **Obra original:** «Circuit Gilles Villeneuve Montreal 2019 layout»
- **Autor:** Dave Love — https://sketchfab.com/Tyler_Dave
- **Origen:** https://sketchfab.com/3d-models/circuit-gilles-villeneuve-montreal-2019-layout-5875d33d5ddb44f4a6c1188ed6776fa8
- **Licencia:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Cambios (CR3, 07/11/2026):** de una copia del modelo del usuario se recortan en Blender once piezas de tramos rectos
  (guardarraíl, valla de malla, muro de neumáticos, bloque de piano, grava, escapatoria pintada, línea pintada, un módulo
  de grada y tres árboles), en metros y con el origen en la base; la grada se aligera de 6.027 a 876 triángulos. Cada
  pieza lleva su textura reducida a 512 px como mucho (`montreal-*.webp`). El modelo trae una textura con logotipos de
  patrocinadores reales: no se usa; de ella solo sale un recorte de chapa sin marcas para la grada. Revisión de las 23
  texturas en `docs/design/kit-montreal.md`.
- **Archivos:** `arbol_a.glb`, `arbol_b.glb`, `arbol_c.glb`, `escapatoria.glb`, `grada_comun.glb`, `grava.glb`, `guardarrail.glb`, `marcas_suelo.glb`, `muro_neumaticos.glb`, `pianos.glb`, `valla_alta.glb`.

## Modelos propios (`kit/` y `scenery/`)

Cada uno de estos modelos está hecho en Blender para F1Sim, sin partir de obras de terceros: son del proyecto, sin licencia
ajena y sin marcas reales (los rótulos que llevan son de patrocinadores de parodia y los pone el juego).

- **Mecánico:** `mecanico.glb` (CA7, 07/11/2026): persona en mono y casco con esqueleto de 13 huesos y siete animaciones (correr, esperar, pistola, quitar y poner rueda, gato y sujetar); el juego le pone los colores de cada equipo.
- **Ruedas:** `ruedas.glb` (CA3, 07/11/2026): los cinco compuestos con la banda de su color, la marca Pirulí en relieve en el flanco, llanta de 10 radios y freno; las cinco comparten la misma geometría.
- **Kit:** `kit/arcada_tunel.glb` (arcos del túnel de Mónaco, CR4).
- **Árboles del kit (09/11/2026):** la geometría de `kit/arbol_a.glb`, `kit/arbol_b.glb` y `kit/arbol_c.glb` está rehecha en Blender para F1Sim (`scripts/blender/kit-arboles.py`); la foto de los árboles (`kit/montreal-arboles.webp`) sigue siendo la del modelo de Montreal de Dave Love (CC BY 4.0), como dice su apartado.
- **Emblemáticos de Shanghái y Yas Marina (CR5, 07/11/2026):** `scenery/shanghai-tribuna.glb`, `scenery/shanghai-ala.glb`, `scenery/shanghai-ala-torre.glb`, `scenery/shanghai-pabellon.glb`, `scenery/shanghai-pasarela.glb`, `scenery/yas-hotel-a.glb`, `scenery/yas-hotel-b.glb`, `scenery/yas-hotel-puente.glb`, `scenery/yas-hotel-cubierta.glb`, `scenery/pasarela-pit.glb` y `scenery/pantalan.glb`, hechos en Blender por `scripts/blender/cr5-models.py`. Las formas y medidas de Shanghái se tomaron mirando el modelo de referencia *Shanghai International Circuit 2018 layout* de Dave Love (CC BY 4.0); no se copió su geometría. Las posiciones salen de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL).
- **Puentes, pasos e iconos de CR6 (08/11/2026):** `scenery/puente-carretera.glb`, `scenery/monorrail.glb`, `scenery/boca-tunel.glb`, `scenery/casino-montreal.glb`, `scenery/cobertizo-remo.glb`, `scenery/esplanade-domo.glb`, `scenery/estadio-miami.glb`, `scenery/noria-suzuka.glb`, `scenery/globo-paris.glb`, `scenery/hotel-lago.glb`, `scenery/fuentes-lago.glb`, `scenery/casa-gobierno.glb`, `scenery/museo-alfombra.glb`, `scenery/torre-radar.glb`, `scenery/grada-cubierta-sh.glb`, `scenery/grada-sombrillas.glb`, `scenery/grada-vela.glb`, `scenery/kartodromo.glb`, `scenery/mezquita-rahma.glb` (esta, a partir de fotos de Wikimedia Commons, Category:Al-Rahmah_Mosque), `scenery/ala-silverstone.glb`, `scenery/peralte-tramo.glb`, `scenery/grada-silverstone.glb`, `scenery/grada-spa.glb`, `scenery/grada-monza.glb`, `scenery/grada-principal-bcn.glb`, `scenery/grada-bcn.glb`, `scenery/grada-spielberg.glb`, `scenery/grada-bahrain.glb`, `scenery/grada-lusail.glb`, `scenery/grada-hungaroring.glb`, `scenery/grada-austin.glb`, `scenery/torre-sakhir.glb`, `scenery/torre-cota.glb` (esta, a partir de fotos de Wikimedia Commons, Category:Observation Tower (Circuit of the Americas)) y `scenery/palacio-deportes.glb`, hechos en Blender para F1Sim por `scripts/blender/cr6-models.py`. Posiciones, giros y plantas de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL); sin marcas reales.
- **Edificios con su aspecto real (CR12, 13/11/2026):** `scenery/boca-tunel.glb` (rehecha: la boca de los pasos bajo la pista como una abertura en un talud), `scenery/centro-acuatico-melbourne.glb` y `scenery/canal-olimpico-montreal.glb`, hechos en Blender para F1Sim por `scripts/blender/cr12-models.py`. Las formas se tomaron mirando una foto de Wikimedia Commons y las fichas públicas de cada edificio (referencias en `docs/design/edificios-cr12.md`); no se copió geometría. Posiciones y plantas de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL); sin marcas reales.
- **Escenario:** `scenery/billboard.glb`, `scenery/biosfera.glb`, `scenery/building.glb`, `scenery/casino.glb`, `scenery/city-wall.glb`, `scenery/dune.glb`, `scenery/esfera.glb`, `scenery/farola.glb`, `scenery/flame-towers.glb`, `scenery/floodlight.glb`, `scenery/fuente.glb`, `scenery/grandstand.glb`, `scenery/grua.glb`, `scenery/marina-bay-sands.glb`, `scenery/motorhome.glb`, `scenery/muro-piedra.glb`, `scenery/noria.glb`, `scenery/paddock.glb`, `scenery/palm.glb`, `scenery/pasarela.glb`, `scenery/pine.glb`, `scenery/pit-building.glb`, `scenery/podio-monza.glb`, `scenery/toro.glb`, `scenery/sombrilla.glb`, `scenery/start-gantry.glb`, `scenery/torre-control.glb`, `scenery/torre-doncella.glb`, `scenery/torre-eiffel.glb`, `scenery/tree.glb`, `scenery/vip-lounge.glb`, `scenery/yacht-large.glb`, `scenery/yacht.glb`, `scenery/yas-tower.glb`.

## Imágenes del centro de temporada (`public/hub/`)

`tunel.webp`, `simulador.webp`, `produccion.webp`, `banco.webp` y `sede.webp` están hechas para F1Sim en Blender
(28/10/2026), con estilo propio y sin marcas reales; el coche que aparece en ellas es `f1-car.glb` sin librea. Son del
proyecto, sin licencia de terceros.
