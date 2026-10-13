import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { raceFactory } = await import('../tests/support/race.mjs');
const make = await raceFactory(server);
const scene = (setup) => {
  const sim = make(process.argv[2] ?? 'monza', 3);
  sim.setSeed(14); sim.setFixedStep(0.02);
  const [a, b, c] = sim.cars;
  b.driver = { ...structuredClone(a.driver), id: b.driver.id, code: b.driver.code, number: b.driver.number };
  b.team = structuredClone(a.team); b.technical = structuredClone(a.technical);
  const lap = sim.activeTrack.lapLengthMeters;
  a.progress = 2.2; b.progress = 2.2 - 12 / lap; c.progress = 2.2 - 900 / lap;
  for (const car of sim.cars) { car.trackT = ((car.progress % 1) + 1) % 1; }
  setup?.(sim, a, b, c);
  return { sim, a, b, c, lap };
};
const slow = (car, sim) => { sim.issuePaceOrder(car.id, 'save'); for (const other of sim.cars) if (other.id !== car.id) sim.issuePaceOrder(other.id, 'push'); };
const run = (label, setup, seconds = Number(process.argv[3] ?? 150)) => {
  const { sim, a, b, lap } = scene(setup);
  let passedAt = null, maxJump = 0, last = a.progress;
  for (let i = 0; i < seconds / 0.02; i++) {
    sim.update(0.02);
    maxJump = Math.max(maxJump, Math.abs(a.progress - last) * lap); last = a.progress;
    if (passedAt === null && b.progress > a.progress) passedAt = i * 0.02;
  }
  console.log(label, 'B pasa a A en', passedAt, 's; hueco final', ((b.progress - a.progress) * lap).toFixed(1), 'm; orden', JSON.stringify(sim.getTeamOrder(a.driver.teamId)), 'avisos', JSON.stringify(sim.teamOrderNotices), 'salto máx A', maxJump.toFixed(2), 'paces', a.paceIndex?.toFixed(4), b.paceIndex?.toFixed(4), 'ema', [...sim.teamOrderPace.entries()].map(([k,v])=>k+':'+v.toFixed(4)).join(), 'streak', [...sim.teamOrderStreak.entries()].join('|'), 'ahead', sim.cars.map(c=>c.id+'>'+c.carAheadId).join(), 'swapped', [...sim.teamOrderSwapped].join());
};
run('libre, iguales        ');
run('dejar pasar, iguales  ', (sim, a, b) => sim.setTeamOrder(a.driver.teamId, 'dejar-pasar', b.id));
run('libre, B más rápido   ', (sim, a) => { slow(a, sim); });
run('mantener, B más rápido', (sim, a) => { slow(a, sim); sim.setTeamOrder(a.driver.teamId, 'mantener'); });
run('auto, B más rápido    ', (sim, a) => { slow(a, sim); sim.autoTeamOrders = true; });
run('auto jugador          ', (sim, a, b) => { slow(a, sim); sim.autoTeamOrders = true; sim.setPlayerCars([a.driver.id, b.driver.id]); });
const worn = car => { for (const k of ['health','healthFL','healthFR','healthRL','healthRR']) car.tires[k] = 55; };
run('gastado libre         ', (sim, a) => { worn(a); });
run('gastado auto          ', (sim, a) => { worn(a); sim.autoTeamOrders = true; });
run('iguales auto          ', (sim, a) => { sim.autoTeamOrders = true; });
await server.close();
