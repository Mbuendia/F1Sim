// [PF5] Huella de tres carreras completas (sprints): el estado entero del motor al acabar (createSnapshot), resumido con
// SHA-256. Si el motor se reorganiza sin cambiar nada, las huellas no cambian ni en un bit.
import { createHash } from 'node:crypto';

export const FINGERPRINT_RACES = [
  { id: 'monza-seco', circuit: 'monza', seed: 4242, weather: 'seco' },
  { id: 'monaco-lluvia-sc', circuit: 'monaco', seed: 7, weather: 'chubasco', safetyCarAtLap: 3 },
  { id: 'spa-vsc-roja-ordenes', circuit: 'spa', seed: 99, weather: 'nubes', vscAtLap: 2, redFlagAtLap: 4, teamOrder: true, boxOrderAtLap: 3 },
];

export async function raceFingerprints(server) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const auto = await server.ssrLoadModule('/src/simulation/AutoRace.ts');
  const { createSnapshot } = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { buildWeatherScenario } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const out = {};
  for (const race of FINGERPRINT_RACES) {
    const sim = new RaceSimulation(race.circuit);
    sim.seededPreparation = true;
    sim.setSeed(race.seed);
    sim.setRaceFormat('sprint');
    sim.setCircuit(race.circuit);
    sim.setPlayerCars(['alonso', 'stroll']);
    sim.luckVariantEnabled = true;
    sim.setWeatherScenario(buildWeatherScenario(race.weather, 40 * 60));
    auto.startAutoRace(sim, []);
    const done = { sc: false, vsc: false, red: false, order: false, box: false };
    const leaderLap = () => Math.max(...sim.cars.map(c => c.currentLap));
    let guard = 0;
    while (!auto.autoRaceDone(sim) && guard++ < 20000) {
      auto.advanceAutoRace(sim, 1e9, 20);
      const lap = leaderLap();
      if (race.safetyCarAtLap && !done.sc && lap >= race.safetyCarAtLap && sim.lightState === 'racing') { done.sc = true; sim.deploySafetyCar('Huella PF5'); }
      if (race.vscAtLap && !done.vsc && lap >= race.vscAtLap && sim.lightState === 'racing') { done.vsc = true; sim.startVirtualSafetyCar(40); }
      if (race.redFlagAtLap && !done.red && lap >= race.redFlagAtLap && !sim.vscActive && sim.lightState === 'racing') { done.red = true; sim.startRedFlag('Huella PF5'); }
      if (race.teamOrder && !done.order && lap >= 2) { const car = sim.cars.find(c => c.driver.id === 'alonso'); if (car) { done.order = true; sim.setTeamOrder(car.team.id, 'mantener'); } }
      if (race.boxOrderAtLap && !done.box && lap >= race.boxOrderAtLap && sim.raceFlagState === 'green') { const car = sim.cars.find(c => c.driver.id === 'stroll'); if (car && car.status === 'running') { done.box = true; sim.issueBoxOrder(car.id, 'hard'); } }
    }
    const snapshot = createSnapshot(sim);
    out[race.id] = { hash: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), finished: auto.autoRaceDone(sim), raceTimeSec: sim.raceTimeSec, done };
  }
  return out;
}
