import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
for (const c of ['barcelona','monza','silverstone','spa','monaco','interlagos','suzuka','zandvoort','melbourne','marina-bay','lusail','hungaroring','montreal']) {
  const t = new RaceSimulation(c).activeTrack, r = t.pitLanePoints, P = t.points;
  let len = 0; for (let i = 1; i < r.length; i++) len += Math.hypot(r[i].x - r[i-1].x, r[i].y - r[i-1].y);
  let per = 0; for (let i = 0; i < P.length; i++) per += Math.hypot(P[(i+1)%P.length].x - P[i].x, P[(i+1)%P.length].y - P[i].y);
  const span = ((t.pitExitT - t.pitEntryT) % 1 + 1) % 1;
  const turns = r.slice(2).map((p, i) => { const a = Math.atan2(r[i+1].y - r[i].y, r[i+1].x - r[i].x), b = Math.atan2(p.y - r[i+1].y, p.x - r[i+1].x); let d = b - a; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return Math.abs(d) * 180 / Math.PI; });
  console.log(c.padEnd(12), 'ruta/pista', (len / (span * per)).toFixed(3), 'puntos', r.length, 'giro máx', Math.max(...turns).toFixed(1) + '°');
}
await server.close();
