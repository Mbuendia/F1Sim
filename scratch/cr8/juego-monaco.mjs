import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
const t = new RaceSimulation('monaco').activeTrack;
writeFileSync('scratch/cr8/juego-monaco.json', JSON.stringify({ lap: t.lapLengthMeters, pts: t.points.map(p => [+p.x.toFixed(2), +p.y.toFixed(2)]) }));
console.log(t.points.length, t.lapLengthMeters);
await server.close();
