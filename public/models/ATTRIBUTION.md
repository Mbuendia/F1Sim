# Modelos 3D de terceros

Los dos modelos de esta carpeta son obras de otros autores, publicadas en Sketchfab con licencia Creative Commons y
**modificadas** para F1Sim. Cada archivo conserva su licencia; el resto del repositorio no queda bajo ellas.

## `f1-car.glb`

- **Obra original:** «F1 2026 concept (polygon model)»
- **Autor:** Qvist_designs — https://sketchfab.com/Qvist_Designs
- **Origen:** https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42
- **Licencia:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Cambios:** reducido de 1,16 millones a unos 127 000 triángulos; pasado a metros con el morro hacia +X; ruedas
  separadas con animación de giro; zonas de pintura por material (principal, secundaria y carbono); banda del compuesto
  en los neumáticos; superficies para el dorsal y los patrocinadores (ficticios, los pone el juego).

## `f1-car-piezas.glb`

- **Obra original y licencia:** las mismas de `f1-car.glb` (Qvist_designs, CC BY 4.0).
- **Cambios (UX10, 28/10/2026):** a partir de `f1-car.glb`, el cuerpo se separa en Blender en piezas con nombre
  (`ala_delantera`, `ala_trasera`, `suelo`, `pontones`, `tapa_motor` y `chasis`), las ruedas cuelgan de `ruedas`, se
  quitan las superficies de rótulos y se reduce a unos 67 000 triángulos. Lo usa el centro de temporada para resaltar
  la pieza que cambia cada mejora.

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

## Imágenes del centro de temporada (`public/hub/`)

`tunel.webp`, `simulador.webp`, `produccion.webp`, `banco.webp` y `sede.webp` están hechas para F1Sim en Blender
(28/10/2026), con estilo propio y sin marcas reales; el coche que aparece en ellas es `f1-car.glb` sin librea. Son del
proyecto, sin licencia de terceros.
