# Q20 — Referencias de boxes desde OpenStreetMap

Herramienta que generó `tests/fixtures/pit-lane-references.json`. Datos OSM © colaboradores de OpenStreetMap (ODbL).

1. `circuits.json`: id, coordenadas, sentido, SVG y valores de boxes configurados (extraídos de `src/data/circuits.ts`).
2. `find-rels.cjs` → `relations.json`: relaciones `type=circuit` de cada circuito (API OSM 0.6; Overpass no respondía).
3. `dl-rels.cjs` → `rel/<id>.xml`: relación completa. Los bbox `<id>.xml` y `tile-<id>-*.xml` se descargan aparte con `/api/0.6/map`.
4. `build.cjs` → `../q20-data.json`: nube de pista y ruta del pit lane por circuito (la relación elegida está en `CHOICE`). `meta.cjs` → `../q20-meta.json`.
5. `../q20-align.mjs`, en el navegador con `npm run dev`: `(await import('/F1Sim/scratch/q20-align.mjs')).run([...ids])` ajusta OSM a la pista de `buildTrackFromSvg` y `draw(ids)` dibuja la superposición (`../q20-superposicion.jpg`).
6. `../q20-results.json` (resultado del paso 5) + `../q20-fixture.cjs` → fixture con criterios y motivos.

Las descargas XML (~88 MB) no se versionan.
