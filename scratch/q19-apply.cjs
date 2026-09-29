// Q19: escribe en src/data/circuits.ts las zonas DRS (activación oficial) y los puntos de detección FIA 2025
// calculados por scratch/q19-drs.mjs (scratch/q19-drs-result.json).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const file = path.join(root, 'src/data/circuits.ts');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'q19-drs-result.json'), 'utf8'));
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');

const fmt = v => v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0');
for (const [id, r] of Object.entries(R)) {
  const start = s.search(new RegExp('\\n  \'?' + id + '\'?: \\{'));
  if (start < 0) throw new Error('sin bloque ' + id);
  const next = s.slice(start + 5).search(/\n  '?[a-z-]+'?: \{/);
  const end = next < 0 ? s.length : start + 5 + next;
  let block = s.slice(start, end);
  const zones = r.drsZoneSpecs.map(z => `      { id: ${z.id}, name: ${JSON.stringify(z.name)}, startT: ${fmt(z.startT)}, endT: ${fmt(z.endT)} }`).join(',\n');
  const detections = r.drsDetections.map(d => `      { id: '${d.id}', t: ${fmt(d.t)}, zoneIds: [${d.zoneIds.join(', ')}], source: '${d.source}' }`).join(',\n');
  const zoneRe = /(\n\s*)drsZoneSpecs: \[[\s\S]*?\n\s*\],?/;
  if (!zoneRe.test(block)) throw new Error(id + ' sin drsZoneSpecs');
  block = block.replace(/\n\s*drsDetections: \[[\s\S]*?\n\s*\],?/, '');
  block = block.replace(zoneRe, (_, indent) =>
    `${indent}// Q19: activación y detección oficiales (plano FIA 2025 · ${r.event}); fin de zona en la frenada siguiente.` +
    `${indent}drsZoneSpecs: [\n${zones}\n    ],` +
    `${indent}drsDetections: [\n${detections}\n    ],`);
  block = block.replace(/(drsZones: )\d+/, `$1${r.drsZoneSpecs.length}`);
  s = s.slice(0, start) + block + s.slice(end);
  console.log(id.padEnd(12), r.drsZoneSpecs.length, 'zonas,', r.drsDetections.length, 'detecciones');
}
fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
