// R17 (primera entrega) — Perfiles técnicos versionados por equipo, PU común por fabricante, contrapartidas y
// paquete aerodinámico por circuito (contrato aprobado por el usuario el 01/10/2026). Coeficientes de calibración.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { TEAM_PROFILES, resolveTechnical, PACKAGES, packageFor } = await server.ssrLoadModule('/src/data/teamProfiles.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { topSpeedKmh } = await server.ssrLoadModule('/src/simulation/AeroModel.ts');
  const make = await raceFactory(server);

  // Una vuelta lanzada de un coche solo; `setup` ajusta el coche antes de correr.
  const lapTime = (circuit, setup) => {
    const sim = make(circuit, 1), car = sim.cars[0];
    Object.assign(car, { progress: 1, trackT: 0, currentLap: 1, currentSpeedKmh: 250 });
    setup?.(car, sim);
    sim.setSeed(17); sim.setFixedStep(0.02);
    while (car.currentLap < 2) sim.update(1 / 60);
    const t0 = sim.raceTimeSec;
    while (car.currentLap < 3) sim.update(1 / 60);
    return sim.raceTimeSec - t0;
  };

  await test('R17: perfiles versionados con PU común por fabricante', () => {
    const ids = Object.keys(TEAMS);
    assert(ids.length === 10 && ids.every(id => TEAM_PROFILES[id]), 'R17: los diez equipos tienen perfil técnico');
    for (const id of ids) {
      const p = TEAM_PROFILES[id];
      const params = [...Object.values(p.chassis)];
      assert(/^2025\.\d+$/.test(p.version) && p.pu && params.every(v => typeof v.value === 'number' && v.origin === 'calibracion' && v.note),
        `R17: ${id} declara versión, PU y origen de cada parámetro`);
    }
    const bySupplier = {};
    for (const id of ids) (bySupplier[TEAM_PROFILES[id].pu.supplier] ??= []).push(TEAM_PROFILES[id].pu);
    for (const [supplier, list] of Object.entries(bySupplier)) {
      assert(list.every(pu => JSON.stringify(pu) === JSON.stringify(list[0])), `R17: los clientes de ${supplier} tienen la misma PU que el oficial`, String(list.length));
    }
  });

  await test('R17: el perfil se resuelve una vez y sustituye al rating antiguo', () => {
    const base = lapTime('barcelona');
    const oldRating = lapTime('barcelona', car => { car.team.carPerformance = 0.5; });
    assert(oldRating === base, 'R17: cambiar team.carPerformance tras iniciar no altera la vuelta', `${oldRating.toFixed(3)} / ${base.toFixed(3)}`);
    const profiled = lapTime('barcelona', car => { car.technical.fastCornerGrip *= 0.98; });
    assert(profiled > base, 'R17: cambiar el perfil resuelto sí altera la vuelta', `${profiled.toFixed(3)} / ${base.toFixed(3)}`);
  });

  await test('R17: baja carga frente a alta carga', () => {
    const low = resolveTechnical('ferrari', 'barcelona', 'baja'), high = resolveTechnical('ferrari', 'barcelona', 'alta');
    const input = t => ({ massKg: 850, powerKw: t.iceKw + 60, drsOpen: false, slipstream: 0, dragFactor: t.dragFactor });
    assert(topSpeedKmh(input(low)) > topSpeedKmh(input(high)), 'R17: baja carga tiene más punta', `${topSpeedKmh(input(low)).toFixed(1)} / ${topSpeedKmh(input(high)).toFixed(1)} km/h`);
    assert(low.fastCornerGrip < high.fastCornerGrip, 'R17: baja carga tiene menos paso por curva rápida');
    assert(Object.keys(PACKAGES).every(k => {
      const p = resolveTechnical('ferrari', 'barcelona', k);
      return !(p.dragFactor < high.dragFactor && p.fastCornerGrip > high.fastCornerGrip) || k === 'alta';
    }), 'R17: ningún paquete tiene a la vez menos drag y más carga que otro');
  });

  await test('R17: el paquete adecuado depende del circuito', () => {
    assert(packageFor('monza') === 'baja' && packageFor('monaco') === 'alta' && packageFor('barcelona') === 'media',
      'R17: Monza baja carga, Mónaco alta, Barcelona media');
    const withPkg = pkg => (car, sim) => { car.technical = resolveTechnical(car.team.id, sim.circuitId, pkg); };
    const monzaLow = lapTime('monza', withPkg('baja')), monzaHigh = lapTime('monza', withPkg('alta'));
    const monacoLow = lapTime('monaco', withPkg('baja')), monacoHigh = lapTime('monaco', withPkg('alta'));
    assert(monzaLow < monzaHigh, 'R17: en Monza la baja carga es más rápida', `${monzaLow.toFixed(3)} / ${monzaHigh.toFixed(3)} s`);
    assert(monacoHigh < monacoLow, 'R17: en Mónaco la alta carga es más rápida', `${monacoHigh.toFixed(3)} / ${monacoLow.toFixed(3)} s`);
  });

  await test('R17: la identidad sale de los parámetros, no del nombre', () => {
    const fast = resolveTechnical('mclaren', 'barcelona'), slow = resolveTechnical('sauber', 'barcelona');
    const asTeam = (teamId, technical) => car => { car.team = structuredClone(TEAMS[teamId]); car.technical = structuredClone(technical); };
    const mclarenFast = lapTime('barcelona', asTeam('mclaren', fast)), sauberSlow = lapTime('barcelona', asTeam('sauber', slow));
    const mclarenSlow = lapTime('barcelona', asTeam('mclaren', slow)), sauberFast = lapTime('barcelona', asTeam('sauber', fast));
    assert(mclarenFast < sauberSlow, 'R17: el perfil McLaren es más rápido que el Sauber con el mismo piloto', `${mclarenFast.toFixed(3)} / ${sauberSlow.toFixed(3)} s`);
    assert(Math.abs(mclarenSlow - sauberSlow) < 1e-9 && Math.abs(sauberFast - mclarenFast) < 1e-9, 'R17: intercambiar perfiles intercambia los tiempos');
  });

  await test('R17: refrigeración y neumáticos con contrapartida', () => {
    const base = resolveTechnical('mercedes', 'barcelona');
    const cool = { ...base, cooling: base.cooling * 1.2, dragFactor: base.dragFactor * (1 + 0.2 * 0.05) };
    const engineTemp = technical => {
      const sim = make('barcelona', 2), [car, lead] = sim.cars;
      lead.team = structuredClone(car.team); lead.driver = { ...structuredClone(car.driver), id: 'lead', code: 'LED' };
      const pl = 3.1 + 0.4 * (250 / 3.6) / sim.activeTrack.lapLengthMeters;
      Object.assign(car, { progress: 3.1, trackT: 0.1, currentLap: 3, currentSpeedKmh: 250, technical: structuredClone(technical) });
      Object.assign(lead, { progress: pl, trackT: pl % 1, currentLap: 3, currentSpeedKmh: 250 });
      sim.setSeed(17); sim.setFixedStep(0.02);
      while (sim.raceTimeSec < 60) sim.update(1 / 60);
      return car.engineTempCelsius;
    };
    assert(engineTemp(cool) < engineTemp(base), 'R17: más refrigeración enfría el motor en estela');
    const input = t => ({ massKg: 850, powerKw: t.iceKw + 60, drsOpen: false, slipstream: 0, dragFactor: t.dragFactor });
    assert(topSpeedKmh(input(cool)) < topSpeedKmh(input(base)), 'R17: más refrigeración cuesta punta (drag)');

    const warm = { ...base, tyreHeat: base.tyreHeat * 1.3, tyreWear: base.tyreWear * 1.15 };
    const outLap = technical => {
      const sim = make('barcelona', 1), car = sim.cars[0];
      Object.assign(car, { progress: 1.999, trackT: 0.999, currentLap: 1, currentSpeedKmh: 250, technical: structuredClone(technical) });
      sim.setSeed(17); sim.setFixedStep(0.02);
      while (car.lapHistory.length < 1) sim.update(1 / 60);
      return { time: car.lapHistory[0].lapTime, health: car.tires.health };
    };
    const normal = outLap(base), hot = outLap(warm);
    assert(hot.time < normal.time, 'R17: calentar antes el neumático hace la out-lap más rápida', `${hot.time.toFixed(3)} / ${normal.time.toFixed(3)} s`);
    assert(hot.health < normal.health, 'R17: y desgasta más', `${hot.health.toFixed(2)} / ${normal.health.toFixed(2)} %`);
  });
}
