// [G7] Las referencias de boxes (Q20) y de DRS (Q19) guardan posiciones como fracción de vuelta desde la meta.
// Al mover la meta a su sitio real (scratch/g7-apply-shift.cjs), esas posiciones se desplazan lo mismo: el punto del
// terreno no cambia. El desfase de cada circuito sale de comparar `startOffsetT` de circuits.ts con el de git HEAD.
// Uso (una sola vez): node scratch/g7-shift-fixtures.cjs
const fs = require('fs');
const { execSync } = require('child_process');
const starts = text => {
  const out = {};
  for (const m of text.matchAll(/    id: '([a-z-]+)',([\s\S]*?)(?=\n    id: '|$)/g)) {
    const s = /startOffsetT: ([0-9.]+)/.exec(m[2]);
    out[m[1]] = s ? +s[1] : 0;
  }
  return out;
};
const before = starts(execSync('git show HEAD:src/data/circuits.ts', { encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r\n/g, '\n'));
const after = starts(fs.readFileSync('src/data/circuits.ts', 'utf8').replace(/\r\n/g, '\n'));
const norm = t => ((t % 1) + 1) % 1;
const r4 = t => { const v = Math.round(norm(t) * 10000) / 10000; return v >= 1 ? 0 : v; };
const KEYS = new Set(['t', 'entryT', 'exitT', 'startT', 'endT', 'commitmentT']);
const walk = (node, d) => {
  if (Array.isArray(node)) return node.map(x => walk(x, d));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, typeof v === 'number' && KEYS.has(k) ? r4(v - d) : walk(v, d)]));
  }
  return node;
};
for (const file of ['tests/fixtures/pit-lane-references.json', 'tests/fixtures/drs-references.json']) {
  const raw = fs.readFileSync(file, 'utf8'), crlf = raw.includes('\r\n');
  const data = JSON.parse(raw);
  if (data._metaG7) { console.log(file, 'ya desplazado'); continue; }
  for (const id of Object.keys(data)) {
    if (id.startsWith('_') || !(id in after)) continue;
    const d = norm(after[id] - before[id]);
    if (d !== 0) data[id] = walk(data[id], d);
  }
  const out = { _metaG7: 'Sprint 4.5 (13/10/2026): las fracciones de vuelta se cuentan desde la meta real de cada circuito (antes, desde la meta anterior del juego); el punto del terreno de cada referencia no ha cambiado.', ...data };
  const text = JSON.stringify(out, null, 2) + '\n';
  fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text);
  console.log(file, 'desplazado');
}
