// Exporta los 23 circuitos (trazado, curvas, pit lane y escenario actual) a JSON para la maqueta de CK2 en Blender.
// Uso: node scratch/ck2-export-circuits.mjs <carpeta de salida>
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, entries: [] }, cacheDir: 'node_modules/.vite-ck2' });
const load = p => server.ssrLoadModule(p);
const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
const { buildTrackFromSvg } = await load('/src/utils/svgTrackParser.ts');
const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
const { getScenario } = await load('/src/data/scenarioRegistry.ts');
const { sceneryFor } = await load('/src/scene3d/scenery.ts');

const r = v => Math.round(v * 10) / 10;
const pts = a => a.map(p => [r(p.x), r(p.y)]);
const index = [];
for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
  const track = buildTrackFromSvg(OFFICIAL_CIRCUITS[id]);
  const pit = getPitLaneGeometry(track);
  const sc = getScenario(id);
  const scenery = sceneryFor(track, id);
  const data = {
    id, name: track.name, lap: track.lapLengthMeters, width: track.trackWidthMeters, trackType: sc.trackType,
    points: pts(track.points),
    corners: track.corners.map(c => ({ n: c.number, name: c.name, t: c.t, kmh: c.apexSpeedKmh, gear: c.gear })),
    pit: { fastLane: pts(pit.fastLane), walls: pit.walls.map(pts), service: pts(pit.serviceArea), boxes: pit.boxes.map(b => pts(b.corners)) },
    pitBuilding: scenery.pitBuilding ? { points: pts(scenery.pitBuilding.points), depth: scenery.pitBuilding.depth, height: scenery.pitBuilding.height, front: scenery.pitBuilding.front } : null,
    street: scenery.street,
    infield: scenery.infield.map(pts), water: scenery.water.map(pts),
    items: scenery.items.filter(i => ['landmark', 'bridge', 'building', 'yacht', 'dune'].includes(i.kind))
      .map(i => ({ kind: i.kind, model: i.model, x: r(i.x), y: r(i.y), heading: i.heading, length: i.length, width: i.width, height: i.height, clearance: i.clearance ?? 0, tint: i.tint ?? null })),
  };
  writeFileSync(join(out, `${id}.json`), JSON.stringify(data));
  index.push({ id, name: track.name, lap: Math.round(track.lapLengthMeters), points: track.points.length, corners: track.corners.length, type: sc.trackType, items: data.items.length });
}
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1));
console.log(index.map(c => `${c.id.padEnd(14)} ${c.type.padEnd(9)} ${String(c.lap).padStart(5)} m  ${c.points} pts  ${c.corners} curvas  ${c.items} piezas`).join('\n'));
await server.close();
