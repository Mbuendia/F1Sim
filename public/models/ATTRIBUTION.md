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
- **Archivos:** `arbol_a.glb`, `arbol_b.glb`, `arbol_c.glb`, `bloque_hormigon.glb`, `camion.glb`, `carpa.glb`, `cartel_metros.glb`, `cartel_pequeno.glb`, `coche_aparcado.glb`, `coche_medico.glb`, `edificio_b.glb`, `edificio_boxes.glb`, `estructura_b.glb`, `estructura_c.glb`, `farola.glb`, `grada_comun.glb`, `grada_pequena.glb`, `grada_roja.glb`, `grua.glb`, `guardarrail.glb`, `marcador.glb`, `marquesina.glb`, `muro_neumaticos.glb`, `pabellon.glb`, `pancarta.glb`, `poste_luz.glb`, `refugio_comisarios.glb`, `techo_tribuna.glb`, `torre_posiciones.glb`, `valla_alta.glb`, `valla_publi.glb`.

## Modelos propios (`kit/` y `scenery/`)

Cada uno de estos modelos está hecho en Blender para F1Sim, sin partir de obras de terceros: son del proyecto, sin licencia
ajena y sin marcas reales (los rótulos que llevan son de patrocinadores de parodia y los pone el juego).

- **Ruedas:** `ruedas.glb` (CA3, 07/11/2026): los cinco compuestos con la banda de su color, la marca Pirulí en relieve en el flanco, llanta de 10 radios y freno; las cinco comparten la misma geometría.
- **Kit:** `kit/arcada_tunel.glb` (arcos del túnel de Mónaco, CR4).
- **Escenario:** `scenery/billboard.glb`, `scenery/biosfera.glb`, `scenery/building.glb`, `scenery/casino.glb`, `scenery/city-wall.glb`, `scenery/dune.glb`, `scenery/esfera.glb`, `scenery/estadio.glb`, `scenery/farola.glb`, `scenery/flame-towers.glb`, `scenery/floodlight.glb`, `scenery/fuente.glb`, `scenery/grandstand.glb`, `scenery/grua.glb`, `scenery/marina-bay-sands.glb`, `scenery/motorhome.glb`, `scenery/muro-piedra.glb`, `scenery/noria.glb`, `scenery/paddock.glb`, `scenery/palm.glb`, `scenery/pasarela.glb`, `scenery/peralte.glb`, `scenery/pine.glb`, `scenery/pit-building.glb`, `scenery/podio-monza.glb`, `scenery/toro.glb`, `scenery/shanghai-bridge.glb`, `scenery/sombrilla.glb`, `scenery/start-gantry.glb`, `scenery/the-wing.glb`, `scenery/torre-control.glb`, `scenery/torre-cota.glb`, `scenery/torre-doncella.glb`, `scenery/torre-eiffel.glb`, `scenery/torre-sakhir.glb`, `scenery/tree.glb`, `scenery/vip-lounge.glb`, `scenery/yacht-large.glb`, `scenery/yacht.glb`, `scenery/yas-hotel.glb`, `scenery/yas-tower.glb`.

## Imágenes del centro de temporada (`public/hub/`)

`tunel.webp`, `simulador.webp`, `produccion.webp`, `banco.webp` y `sede.webp` están hechas para F1Sim en Blender
(28/10/2026), con estilo propio y sin marcas reales; el coche que aparece en ellas es `f1-car.glb` sin librea. Son del
proyecto, sin licencia de terceros.
