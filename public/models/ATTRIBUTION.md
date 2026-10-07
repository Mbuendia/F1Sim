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

## `safety-car.glb`

- **Obra original:** «2019 Mercedes-Benz AMG GTR Safety Car»
- **Autor:** OUTPISTON — https://sketchfab.com/outpiston
- **Origen:** https://sketchfab.com/3d-models/2019-mercedes-benz-amg-gtr-safety-car-5bfaf6b31d084dde80dae723b52998bc
- **Licencia:** CC BY-NC-SA 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/
- **Condiciones:** solo uso **no comercial**; esta versión modificada se comparte con la misma licencia.
- **Cambios:** se han quitado las texturas, los emblemas y los rótulos de marcas; materiales planos; ruedas y barra de
  luces como piezas aparte con animación de giro; superficies para rótulos (los pone el juego).

Los archivos se preparan en Blender y se terminan con `node scripts/finalize-models.mjs`, que une la animación de las
ruedas en un clip y escribe esta atribución dentro de cada `.glb`.
