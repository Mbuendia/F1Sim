// [G11] Exporta la geometría fija de cada circuito (las mismas capas que pinta el juego, `trackLayers.ts`) como mallas
// listas para Blender: una lista de piezas por color, con vértices en metros y caras. Blender las convierte en objetos y
// las guarda como .blend y .glb (`scripts/blender-build-circuits.py`).
// Uso: node scripts/export-circuit-meshes.mjs   → scratch/g11/<circuito>.json
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = `${root}scratch/g11/`;
mkdirSync(out, { recursive: true });
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const { buildTrackLayers } = await server.ssrLoadModule('/src/renderer/trackLayers.ts');
  for (const [id, spec] of Object.entries(OFFICIAL_CIRCUITS)) {
    const track = buildTrackFromSvg(spec);
    const { shapes } = buildTrackLayers(track, id);
    // Centro del circuito en el origen; Y hacia arriba en Blender (en el juego crece hacia abajo).
    const cx = (track.bounds.minX + track.bounds.maxX) / 2, cy = (track.bounds.minY + track.bounds.maxY) / 2;
    const pieces = new Map();
    const piece = (color, alpha, layer) => {
      const key = `${color}|${alpha}|${layer}`;
      if (!pieces.has(key)) pieces.set(key, { color, alpha, layer, verts: [], faces: [] });
      return pieces.get(key);
    };
    let layer = 0, previousKind = '';
    shapes.forEach(shape => {
      // Cada cambio de tipo de forma sube un centímetro: las capas no parpadean unas sobre otras.
      // (rellenos de cuatro puntos —pianos, meta— y rellenos grandes —escapatorias, boxes— van en capas distintas).
      const kind = shape.kind === 'fill' ? `fill|${shape.points.length === 4}` : `stroke|${shape.color}|${shape.width}`;
      if (kind !== previousKind) { layer++; previousKind = kind; }
      const target = piece(shape.color, shape.alpha ?? 1, layer);
      const z = layer * 0.01, base = target.verts.length;
      const P = shape.points.map(p => [p.x - cx, -(p.y - cy)]);
      if (shape.kind === 'fill') {
        for (const [x, y] of P) target.verts.push([x, y, z]);
        target.faces.push(P.map((_, i) => base + i));
        return;
      }
      // Trazo: una cinta del ancho indicado, con la normal media en cada vértice. Las líneas finas tienen 25 cm o menos.
      const n = P.length, closed = Boolean(shape.closed), half = shape.width / 2;
      for (let i = 0; i < n; i++) {
        const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / length * half, ny = (b[0] - a[0]) / length * half;
        target.verts.push([P[i][0] + nx, P[i][1] + ny, z], [P[i][0] - nx, P[i][1] - ny, z]);
      }
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const j = (i + 1) % n;
        target.faces.push([base + 2 * i, base + 2 * j, base + 2 * j + 1, base + 2 * i + 1]);
      }
    });
    const round = v => Math.round(v * 1000) / 1000;
    const data = {
      id, name: spec.name, lapLengthMeters: spec.lapLengthMeters, trackWidthMeters: track.trackWidthMeters,
      pieces: [...pieces.values()].map(p => ({ ...p, verts: p.verts.map(v => v.map(round)) })),
    };
    writeFileSync(`${out}${id}.json`, JSON.stringify(data));
    console.log(id.padEnd(13), `${data.pieces.length} piezas`, `${data.pieces.reduce((s, p) => s + p.verts.length, 0)} vértices`);
  }
} finally {
  await server.close();
}
