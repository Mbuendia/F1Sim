import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
for (const c of ['barcelona', 'monaco', 'suzuka']) {
  const p = new RaceSimulation(c).activeTrack.points;
  const xs = p.map(q => q.x), ys = p.map(q => q.y);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2, a = (Math.max(...xs) - Math.min(...xs)) / 2, b = (Math.max(...ys) - Math.min(...ys)) / 2;
  console.log(c, 'desviación respecto a elipse:', Math.max(...p.map(q => Math.abs(((q.x - cx) / a) ** 2 + ((q.y - cy) / b) ** 2 - 1))).toFixed(3), 'p0', Math.round(p[0].x), Math.round(p[0].y));
}
await server.close();
