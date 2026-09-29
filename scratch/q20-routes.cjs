// Genera src/data/pitLaneRoutes.json desde scratch/q20-routes-raw.json (salida de pitRoutesSvg en q20-align.mjs).
const fs = require('fs');
const raw = require('./q20-routes-raw.json');
const refs = require('../tests/fixtures/pit-lane-references.json');
const meta = require('./q20-meta.json');
const out = {
  _nota: 'Q20: trazado real del pit lane (OpenStreetMap, ODbL) en coordenadas del SVG de cada circuito, desde la separación hasta la reincorporación. buildTrackFromSvg lo transforma igual que la pista. Origen y ajuste: tests/fixtures/pit-lane-references.json; generado con scratch/q20-align.mjs (pitRoutesSvg) y scratch/q20-routes.cjs.',
};
for (const [id, points] of Object.entries(raw)) {
  if (refs[id]?.status !== 'VERIFICADO') throw new Error(`Sin referencia verificada: ${id}`);
  out[id] = { osmWays: meta[id].pitWays, points };
}
fs.writeFileSync('../src/data/pitLaneRoutes.json', JSON.stringify(out) + '\n');
console.log(Object.keys(out).length - 1, 'rutas');
