// Q13: prototipo del predictor físico (pit lane a 80 km/h + servicio − tramo en pista) frente a la pérdida medida.
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
Math.random = () => 0.5;
const SERVICE = 2.6; // Math.random 0.5 → 2.2+0.5*0.8 = 2.6
const vTarget = (f, car, cap) => {
  let v = f >= .9 ? 338 + (car.team.carPerformance - .88) * 120 : f >= .65 ? 190 + (f - .65) * 450 : f >= .4 ? 120 + (f - .4) * 280 : 68 + (f - .2) * 240;
  return cap ? Math.min(v, cap) : v;
};
const model = (sim, car, cap) => {
  const tr = sim.activeTrack, pts = tr.points, n = pts.length, L = tr.lapLengthMeters;
  const len = tr.pitExitT > tr.pitEntryT ? tr.pitExitT - tr.pitEntryT : 1 - tr.pitEntryT + tr.pitExitT;
  const skill = .55 * car.driver.talentRating + .25 * car.driver.palmaresScore + .2 * car.driver.consistency;
  const pace = car.team.carPerformance * (.92 + .08 * skill);
  const accel = (50 + (car.team.horsepower - 1000) * .4) * pace;
  const target = t => { const f = pts[Math.floor((((t % 1) + 1) % 1) * n) % n].speedLimitFactor; return vTarget(f, car, null) * (f >= .9 ? pace : pace) ; };
  const cap_ = v => cap ? Math.min(v, cap) : v;
  const trackStep = (st, dt) => { const tg = cap_(target(st.p)); const pt = pts[Math.floor((((st.p % 1) + 1) % 1) * n) % n];
    if (tg < st.v) st.v -= Math.min(st.v - tg, (pt.isBrakingZone ? 180 : 120) * dt); else st.v += Math.min(tg - st.v, accel * dt);
    st.p += dt * st.v / 3.6 / L; };
  const box = .45; const dt = .02;
  const v0 = cap_(target(tr.pitEntryT));
  const ghost = { p: 0, v: v0 }, pit = { p: 0, v: v0, stop: 0, served: false, out: false };
  const e = tr.pitEntryT; ghost.p = e; pit.p = e;
  let t = 0, after = 0; const X = e + len + 0.15; let tg = null, tp = null;
  while ((tg === null || tp === null) && t < 400) {
    trackStep(ghost, dt);
    if (!pit.out) {
      const lp = Math.min(1, (pit.p - e) / len);
      if (lp >= 1) { pit.out = true; }
      else if (lp < box) pit.v = lp < .05 ? Math.max(80, pit.v - dt * 280) : 80;
      else if (pit.stop < SERVICE) { pit.stop += dt; pit.v = 0; }
      else { if (!pit.served) { pit.served = true; pit.v = 20; } pit.v = lp > .95 ? Math.min(260, pit.v + dt * 200) : Math.min(80, pit.v + dt * 100); }
      if (!pit.out) pit.p += dt * pit.v / 3.6 / L;
    } else { trackStep(pit, dt); after += dt; }
    t += dt;
    if (tg === null && ghost.p >= X) tg = t; if (tp === null && pit.p >= X) tp = t;
  }
  return { lossSec: tp - tg };
};
const run = (circuit, flag, pit, start) => {
  const sim = new RaceSimulation(circuit); sim.cars = structuredClone(sim.cars.slice(0, 1)); const car = sim.cars[0];
  sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 100;
  car.progress = start; car.trackT = start % 1; car.currentLap = 2; car.currentSpeedKmh = 200; car.pitStop.scheduledLap = 0; car.raceDayLuckFactor = 0;
  if (flag === 'sc') { Object.assign(sim.safetyCar, { isDeployed: true, mode: 'leading', progress: start + 0.3, trackT: (start + .3) % 1, currentSpeedKmh: 120, lapCount: 0, targetLaps: 999 }); sim.raceFlagState = 'sc'; }
  const m = model(sim, car, flag === 'sc' ? 120 : flag === 'vsc' ? 160 : null);
  if (pit) sim.issueBoxOrder(car.id, 'hard');
  const tr = sim.activeTrack; const len = tr.pitExitT > tr.pitEntryT ? tr.pitExitT - tr.pitEntryT : 1 - tr.pitEntryT + tr.pitExitT;
  const X = Math.floor(start) + tr.pitEntryT + (tr.pitEntryT < start % 1 ? 1 : 0) + len + 0.15; let tx = null;
  while (tx === null && sim.raceTimeSec < 400) { if (flag === 'vsc') { sim.vscActive = true; sim.raceFlagState = 'vsc'; } sim.update(0.02); if (car.progress >= X) tx = sim.raceTimeSec; }
  return { tx, stops: car.pitStop.totalPitStops, m };
};
for (const c of (process.argv[2] || 'barcelona,monza,monaco,bahrain,spa,marina-bay').split(',')) {
  const sim = new RaceSimulation(c); const start = 2 + ((sim.activeTrack.pitEntryT - 0.35) + 1) % 1;
  const row = [];
  for (const flag of ['green','vsc']) {
    const a = run(c, flag, true, start), b = run(c, flag, false, start);
    row.push(`${flag} real ${(a.tx - b.tx).toFixed(2)}s modelo ${a.m.lossSec.toFixed(2)}s st${a.stops}`);
  }
  console.log(c.padEnd(11), row.join(' | '));
}
await server.close();
