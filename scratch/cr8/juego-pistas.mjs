// [CK5] Trazados del juego (puntos, ancho, límites) de los seis circuitos con relieve, para encajarlos con los reales.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
const { overpassFor } = await server.ssrLoadModule('/src/renderer/overpass.ts');
const out = {};
for (const id of ['spa', 'monaco', 'spielberg', 'interlagos', 'suzuka', 'austin']) {
  const t = new RaceSimulation(id).activeTrack;
  out[id] = { lap: t.lapLengthMeters, width: t.trackWidthMeters, bounds: t.bounds, overpass: overpassFor(id), pts: t.points.map(p => [+p.x.toFixed(2), +p.y.toFixed(2)]) };
  console.log(id, t.points.length, t.lapLengthMeters, JSON.stringify(t.bounds));
}
writeFileSync('scratch/cr8/juego-pistas.json', JSON.stringify(out));
await server.close();
