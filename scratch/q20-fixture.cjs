// Genera tests/fixtures/pit-lane-references.json desde el ajuste OSM → pista del juego (scratch/q20-align.mjs).
const fs = require('fs');
const R = require('./q20-results.json'), M = require('./q20-meta.json'), C = Object.fromEntries(require('./q20-osm/circuits.json').map(c => [c.id, c]));
const REASONS = {
  spielberg: 'Residuo local de la entrada 5,9 m (> 5 m): el SVG spielberg-3 se desvía de la geometría real junto a la entrada de boxes.',
  'las-vegas': 'Diferencia entre ajuste global y local 0,0021 vueltas en entrada y salida (> 0,002): posición a lo largo de la recta no concluyente.',
  bahrain: 'Residuo local 9-11 m: el SVG bahrain-1 no coincide con la geometría real en la zona de boxes.',
  baku: 'Residuo local 16-19 m; la relación OSM está formada por ejes de calles públicas (calzadas dobles), no por el eje de la pista.',
  miami: 'Residuo local 6-8 m: la pista OSM disponible mezcla vías auxiliares con el nombre del circuito y el ajuste no es concluyente.',
  shanghai: 'Residuo local 8-11 m y extremos a ~17 m de la pista del juego: el SVG shanghai-1 se desvía en la recta de boxes.',
  jeddah: 'Sin relación de circuito en OSM y con aviso fixme (un tramo dibujado ~234 m más largo); salida con residuo 11 m.',
  'yas-marina': 'La salida de boxes (túnel) queda a 20,6 m de la pista del juego (> 15 m): el SVG yas-marina-2 se desvía en la reincorporación.',
  'mexico-city': 'Escala global -4,3 % respecto a lapLengthMeters y residuo local de la entrada 5,2 m (> 5 m).',
  austin: 'Residuo local de la entrada 8,5 m y diferencia global/local de la salida 0,0038 vueltas: el SVG austin-1 se desvía cerca de boxes.',
};
const out = {
  _nota: 'Q20: referencias VERIFICABLES del pit lane real. entryT/exitT son la fracción de vuelta (0-1) sobre la pista que construye el juego con buildTrackFromSvg (750 muestras por longitud del path SVG, orientada según direction y desplazada por startOffsetT) de los puntos donde el pit lane se separa y se reincorpora a la pista (Reglamento Deportivo F1 FIA 2025, Issue 5, art. 34.1-34.2: pit entry road / pit exit road). Geometría real: OpenStreetMap (ODbL). Método: ajuste de semejanza OSM→mundo del juego (ICP, escala inicial por lapLengthMeters) y ajuste local rígido en ±400 m de cada extremo; t por proyección. Criterio VERIFICADO: residuo mediano local <= 5 m, extremo a <= 15 m de la pista del juego y |t global - t local| <= 0,002 vueltas; pit lane con sentido coherente con la carrera. Circuitos que no cumplen: PENDIENTE_REFERENCIA con motivo y valores candidatos solo informativos. La tolerancia vive en tests/modules/pit-route.mjs y no debe relajarse para acomodar el dibujo.',
};
for (const [id, v] of Object.entries(R)) {
  const [rot, sc, fit, cov, enT, enR, enD, enDT, exT, exR, exD, exDT, oneway] = v, m = M[id], c = C[id];
  const verified = !REASONS[id];
  const src = m.relation ? `OpenStreetMap relación ${m.relation} (type=circuit)` : 'OpenStreetMap vías highway=raceway "Jeddah Corniche Circuit" (sin relación de circuito)';
  const entry = {
    status: verified ? 'VERIFICADO' : 'PENDIENTE_REFERENCIA',
    source: `${src}; pit lane: vías ${m.pitWays.join(', ')} (${m.pitSource}); definición de entrada/salida: FIA 2025 F1 Sporting Regulations Issue 5 art. 34.1-34.2.`,
    edition: m.relVersion ? `OSM relación v${m.relVersion.version} (${m.relVersion.timestamp.slice(0, 10)}), descargada 2026-09-29` : 'OSM descargado 2026-09-29',
    direction: `${c.dir}; sentido del pit lane ${oneway ? 'según oneway=yes de OSM' : 'deducido del sentido de carrera (vías OSM sin oneway)'}, coherente con la pista del juego`,
    svgTransform: `OSM (proyección equirectangular local en ${c.lat},${c.lon}, metros, y hacia abajo) → mundo de ${c.svg}: rotación ${rot}°, sin reflexión, escala x${sc} respecto a lapLengthMeters=${c.len}; ajuste global mediana ${fit} m (cobertura p95 ${cov} m)`,
    entryT: verified ? enT : null,
    exitT: verified ? exT : null,
    evidence: { entry: { t: enT, localResidualM: enR, distanceToTrackM: enD, globalLocalDeltaT: enDT }, exit: { t: exT, localResidualM: exR, distanceToTrackM: exD, globalLocalDeltaT: exDT } },
  };
  if (!verified) entry.reason = REASONS[id];
  out[id] = entry;
}
fs.writeFileSync('../tests/fixtures/pit-lane-references.json', JSON.stringify(out, null, 2) + '\n');
console.log(Object.entries(out).filter(([k]) => k !== '_nota').map(([k, v]) => `${v.status.padEnd(20)} ${k.padEnd(12)} ${v.entryT} ${v.exitT}`).join('\n'));
