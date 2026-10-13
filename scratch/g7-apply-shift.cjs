// [G7] Mueve la línea de meta de cada circuito a su sitio real y desplaza con ella todos los datos anclados a la
// vuelta (boxes, DRS, escenarios), que conservan su posición sobre el terreno. Entrada: `scratch/g7-line-shifts.json`
// (lo escribe `node scripts/align-circuit-references.mjs --write`). Se aplica una sola vez: después, el ajuste da ~0 m.
const fs = require('fs');
const shifts = JSON.parse(fs.readFileSync('scratch/g7-line-shifts.json', 'utf8'));
const edit = (file, fn) => { const raw = fs.readFileSync(file, 'utf8'); const crlf = raw.includes('\r\n');
  const out = fn(raw.replace(/\r\n/g, '\n')); fs.writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out, 'utf8'); };
const norm = t => ((t % 1) + 1) % 1;
const r4 = t => { const v = Math.round(norm(t) * 10000) / 10000; return v >= 1 ? 0 : v; };
const MIN_SHIFT_M = 15;

edit('src/data/circuits.ts', s => {
  for (const [id, { lineT, startOffsetT }] of Object.entries(shifts)) {
    const start = s.indexOf(`    id: '${id}',`);
    if (start < 0) throw new Error(id);
    // El bloque del circuito empieza en la línea anterior a `id:` y acaba en el siguiente `id:`.
    const next = s.indexOf(`    id: '`, start + 10);
    const end = next < 0 ? s.length : s.lastIndexOf('\n', s.lastIndexOf('{', next));
    let block = s.slice(start, end);
    const L = +/lapLengthMeters: (\d+)/.exec(block)[1];
    const d = lineT > 0.5 ? lineT - 1 : lineT;
    if (Math.abs(d * L) < MIN_SHIFT_M) { console.log(id.padEnd(13), 'sin cambio', Math.round(d * L), 'm'); continue; }
    block = block.replace(/\b(pitEntryT|pitCommitmentT|pitExitT|startT|endT): ([0-9.]+)/g, (_, k, v) => `${k}: ${r4(+v - lineT)}`);
    block = block.replace(/(\{ id: 'D[^']*', t: )([0-9.]+)/g, (_, a, v) => `${a}${r4(+v - lineT)}`);
    if (/startOffsetT: [0-9.]+/.test(block)) block = block.replace(/startOffsetT: [0-9.]+/, `startOffsetT: ${r4(startOffsetT)}`);
    else block = block.replace(/(\n\s*)(pitExitT: [0-9.]+,)/, `$1$2$1startOffsetT: ${r4(startOffsetT)},`);
    if (!/startOffsetT/.test(block)) throw new Error('startOffsetT ' + id);
    s = s.slice(0, start) + block + s.slice(end);
    console.log(id.padEnd(13), 'meta movida', Math.round(d * L), 'm');
  }
  return s;
});

const moved = id => { const s = shifts[id]; return s ? s.lineT : 0; };
// Intervalo desplazado; si cruza la meta se parte en dos.
const interval = (a, b, d) => { const x = r4(a - d), y = r4(b - d) || (b - d === 0 ? 0 : 1); return x <= y ? [[x, y]] : [[x, 1], [0, y]]; };

edit('src/data/scenarioCalendar.ts', s => s.replace(/^  ('?[a-z-]+'?): (\{ type:[^\n]*\n\s*bends: \[)([^\]]*)(\], barriers: \[)(.*)(\] \},)$/gm, (all, key, head, bends, mid, barriers, tail) => {
  const id = key.replace(/'/g, ''), d = moved(id);
  if (!d) return all;
  const newBends = bends.split(',').map(v => r4(+v - d)).sort((a, b) => a - b).join(', ');
  const newBarriers = [...barriers.matchAll(/\[([0-9.]+), ([0-9.]+)\]/g)].flatMap(m => interval(+m[1], +m[2], d)).sort((a, b) => a[0] - b[0]).map(([a, b]) => `[${a}, ${b}]`).join(', ');
  return `  ${key}: ${head}${newBends}${mid}${newBarriers}${tail}`;
}));

for (const [file, id] of [['src/data/scenarioBarcelona.ts', 'barcelona'], ['src/data/scenarioMonaco.ts', 'monaco']]) {
  const d = moved(id);
  if (!d) continue;
  edit(file, s => s.replace(/^(\s*)\{ startT: ([0-9.]+), endT: ([0-9.]+),(.*)$/gm, (_, indent, a, b, rest) =>
    interval(+a, +b, d).map(([x, y]) => `${indent}{ startT: ${x}, endT: ${y},${rest}`).join('\n')));
}
console.log('hecho');
