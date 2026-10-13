// [G7] Referencias reales de meta y curvas por circuito (Sprint 4.5).
// Fuente: API pública de MultiViewer (`https://api.multiviewer.app/api/v1/circuits/<clave>/2025`), que da el trazado
// de una vuelta real en décimas de metro empezando en la línea de meta, y la distancia de cada curva numerada a la meta.
// Los archivos descargados están en `scratch/g-multiviewer/`. El script ajusta ese trazado al eje del juego (giro,
// simetría y desfase que minimizan la distancia entre los dos) y de ahí saca dónde cae la meta real sobre nuestro eje.
// Uso: node scripts/align-circuit-references.mjs [--write]
//   --write  escribe `scratch/g7-line-shifts.json` (desfase de la meta, para `scratch/g7-apply-shift.cjs`), `tests/fixtures/finish-line-references.json` y `src/data/circuitReferences.json`.
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const N = 1440;

function resample(points, count) {
  const n = points.length, lengths = [];
  let total = 0;
  for (let i = 0; i < n; i++) { const a = points[i], b = points[(i + 1) % n]; lengths.push(Math.hypot(b.x - a.x, b.y - a.y)); total += lengths[i]; }
  const out = [];
  let i = 0, start = 0;
  for (let k = 0; k < count; k++) {
    const target = k * total / count;
    while (start + lengths[i] < target && i < n - 1) { start += lengths[i]; i++; }
    const f = lengths[i] > 1e-9 ? (target - start) / lengths[i] : 0, a = points[i], b = points[(i + 1) % n];
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return { points: out, total };
}
function centered(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length, cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return points.map(p => ({ x: p.x - cx, y: p.y - cy }));
}

const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const fixture = {}, data = {}, rows = [], shifts = {};
  for (const [id, spec] of Object.entries(OFFICIAL_CIRCUITS)) {
    const mv = JSON.parse(readFileSync(`${root}scratch/g-multiviewer/${id}.json`, 'utf8'));
    const track = buildTrackFromSvg(spec);
    const ours = centered(resample(track.points, N).points);
    const real = resample(mv.x.map((x, i) => ({ x: x / 10, y: mv.y[i] / 10 })), N);
    let best = { error: Infinity };
    for (const mirror of [1, -1]) {
      for (const reverse of [false, true]) {
        let ref = centered(real.points.map(p => ({ x: p.x, y: p.y * mirror })));
        if (reverse) ref = [ref[0], ...ref.slice(1).reverse()];
        const energy = ours.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0) + ref.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0);
        for (let shift = 0; shift < N; shift++) {
          let c = 0, s = 0;
          for (let i = 0; i < N; i++) { const a = ours[i], b = ref[(i + shift) % N]; c += a.x * b.x + a.y * b.y; s += b.x * a.y - b.y * a.x; }
          const error = energy - 2 * Math.hypot(c, s);
          if (error < best.error) best = { error, shift, mirror, reverse };
        }
      }
    }
    // El punto 0 del trazado real (la meta) cae sobre nuestra muestra -shift.
    const lineT = ((-best.shift / N) % 1 + 1) % 1;
    const rmsM = Math.sqrt(Math.max(0, best.error) / N);
    const L = spec.lapLengthMeters;
    const offsetM = lineT > 0.5 ? (lineT - 1) * L : lineT * L;
    const lineToPitExitM = (((track.pitExitT - lineT) % 1) + 1) % 1 * L;
    const startOffsetT = (((spec.startOffsetT ?? 0) + lineT) % 1 + 1) % 1;
    fixture[id] = { lineToPitExitM: Math.round(lineToPitExitM), fitRmsM: Math.round(rmsM * 10) / 10, year: mv.year };
    data[id] = {
      year: mv.year, lapLengthM: Math.round(real.total),
      corners: mv.corners.map(c => ({ number: c.number, letter: c.letter || undefined, t: Math.round(c.length / 10 / real.total * 10000) / 10000 })),
    };
    shifts[id] = { lineT, startOffsetT };
    rows.push({ id, año: mv.year, 'ajuste (m)': +rmsM.toFixed(1), invertido: best.reverse, 'meta real respecto a la nuestra (m)': Math.round(offsetM), startOffsetT: +startOffsetT.toFixed(4), 'antes': spec.startOffsetT ?? 0 });
  }
  console.table(rows);
  if (process.argv.includes('--write')) {
    const note = 'Meta real: distancia (m) de la línea de meta a la salida de boxes a lo largo de la pista, con la meta del trazado de MultiViewer ajustado al eje del juego (scripts/align-circuit-references.mjs).';
    writeFileSync(`${root}tests/fixtures/finish-line-references.json`, JSON.stringify({ _nota: note, ...fixture }, null, 2) + '\n');
    writeFileSync(`${root}src/data/circuitReferences.json`, JSON.stringify(data, null, 1) + '\n');
    writeFileSync(`${root}scratch/g7-line-shifts.json`, JSON.stringify(shifts, null, 1) + String.fromCharCode(10));
    console.log('Referencias escritas.');
  }
} finally {
  await server.close();
}
