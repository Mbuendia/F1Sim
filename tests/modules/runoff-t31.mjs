// T3.1 — Escapatorias y muros (contrato aprobado por el usuario el 08/10/2026).
//  1. La superficie del punto del accidente sale de los tramos del circuito; a cada lado de un límite sale la suya; en
//     un urbano, muro.
//  2. Duración del Safety Car en el perfil personalizado: muro en urbano 10-12 vueltas, muro en no urbano 4-6, grava o
//     hierba 2-3, con el azar del motor (misma semilla, misma duración).
//  3. Escapatoria de asfalto: un accidente normal no retira el coche; pierde 4-8 s y sigue, con amarilla local.
//  4. Con dos incidentes manda el que pide más vueltas y uno posterior nunca acorta el Safety Car.
//  5. La bandera roja sigue saliendo igual.
//  6. El perfil FIA 2025 sigue sin mínimo de vueltas.
//  7. Queda registrado por qué se eligió esa duración.
//  8. Se guarda y se carga.
//  9. Revisión en el navegador (manual; en el dashboard).
// Decisiones del usuario: no se añaden muros nuevos a los circuitos (el muro en un permanente se prueba con un tramo de
// test) y en asfalto el coche pierde tiempo y sigue.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const runoff = await server.ssrLoadModule('/src/simulation/Runoff.ts');
  const { getScenario } = await server.ssrLoadModule('/src/data/scenarioRegistry.ts');
  const { getRuleSet } = await server.ssrLoadModule('/src/rules/ruleSets.ts');
  const { marshalSectorOf } = await server.ssrLoadModule('/src/simulation/RaceControl.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const zone = (startT, endT, surface) => ({ startT, endT, side: 'both', surface, widthMultiplier: 1 });
  const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

  /** Carrera con un coche en cada punto de `positions` (vuelta 5); `zones` sustituye los tramos del circuito. */
  const race = (circuit, positions, { zones = null, seed = 7, fia = false } = {}) => {
    const sim = make(circuit, positions.length);
    sim.cars.forEach((car, i) => Object.assign(car, { progress: 5 + positions[i], trackT: positions[i], currentLap: 5, currentSpeedKmh: 180 }));
    if (fia) sim.setRuleSet(getRuleSet('fia-2025'));
    if (zones) sim.setRunoffZones(zones);
    sim.setSeed(seed); sim.setFixedStep(0.02);
    return sim;
  };
  /** Vueltas de Safety Car que pide un accidente con abandono en `t`, para cada semilla. */
  const scLaps = (circuit, t, options = {}) => SEEDS.map(seed => {
    const sim = race(circuit, [t + 0.3, t + 0.15, t], { ...options, seed });
    sim.reportIncident(sim.cars[2], 'crash');
    return sim.raceFlagState === 'sc' ? sim.safetyCar.targetLaps : -1;
  });
  const within = (values, low, high) => values.every(v => Number.isInteger(v) && v >= low && v <= high);
  const run = (sim, seconds) => { const end = sim.raceTimeSec + seconds; while (sim.raceTimeSec < end) sim.update(1 / 60); };

  await test('T3.1: superficie del punto del accidente', () => {
    const barcelona = getScenario('barcelona');
    assert(runoff.surfaceAt(barcelona, 0.099) === 'asphalt' && runoff.surfaceAt(barcelona, 0.101) === 'gravel', 'T3.1: a cada lado del final de un tramo sale su superficie',
      `${runoff.surfaceAt(barcelona, 0.099)} / ${runoff.surfaceAt(barcelona, 0.101)}`);
    assert(runoff.surfaceAt(barcelona, 0.349) === 'gravel' && runoff.surfaceAt(barcelona, 0.351) === 'asphalt', 'T3.1: y a cada lado del principio de otro');
    assert([0, 0.2, 0.5, 0.9].every(t => runoff.surfaceAt(getScenario('monaco'), t) === 'wall' && runoff.surfaceAt(getScenario('baku'), t) === 'wall'), 'T3.1: en un circuito urbano, muro');
    assert(runoff.surfaceAt(getScenario('silverstone'), 0.5) === 'grass', 'T3.1: fuera de los tramos marcados vale la superficie general del circuito');

    const sim = race('barcelona', [0.5, 0.35, 0.2]);
    assert(sim.runoffSurfaceAt(0.099) === 'asphalt' && sim.runoffSurfaceAt(0.101) === 'gravel', 'T3.1: el motor usa los tramos del circuito');
    sim.reportIncident(sim.cars[2], 'crash');
    assert(sim.incidents.at(-1).surface === 'gravel' && /GRAVA/.test(sim.cars[2].dnfReason), 'T3.1: el incidente queda registrado con su superficie', `${sim.incidents.at(-1).surface} · ${sim.cars[2].dnfReason}`);

    const street = race('monaco', [0.75, 0.6, 0.45], { zones: [zone(0.4, 0.5, 'asphalt')] });
    assert(street.runoffSurfaceAt(0.45) === 'asphalt' && street.runoffSurfaceAt(0.39) === 'wall' && street.runoffSurfaceAt(0.51) === 'wall', 'T3.1: un tramo de asfalto en un urbano manda sobre el tipo de circuito');
    street.setRunoffZones(null);
    assert(street.runoffSurfaceAt(0.45) === 'wall' && getScenario('monaco').runoffZones.length === 0, 'T3.1: los tramos de test no tocan los datos del circuito');
  });

  await test('T3.1: duración del Safety Car según la superficie', () => {
    const streetWall = scLaps('monaco', 0.3);
    assert(within(streetWall, 10, 12) && new Set(streetWall).size > 1, 'T3.1: muro en urbano, de 10 a 12 vueltas', streetWall.join(','));
    const gravel = scLaps('barcelona', 0.2);
    assert(within(gravel, 2, 3) && new Set(gravel).size > 1, 'T3.1: grava, 2 o 3 vueltas', gravel.join(','));
    assert(within(scLaps('silverstone', 0.5), 2, 3), 'T3.1: hierba, 2 o 3 vueltas');
    const wall = scLaps('barcelona', 0.2, { zones: [zone(0.18, 0.22, 'wall')] });
    assert(within(wall, 4, 6) && new Set(wall).size > 1, 'T3.1: muro en un circuito no urbano, de 4 a 6 vueltas', wall.join(','));
    assert(within(scLaps('monaco', 0.3, { zones: [zone(0.25, 0.35, 'asphalt')] }), 2, 3), 'T3.1: asfalto en un urbano, 2 o 3 vueltas (manda la superficie del punto)');
    assert(within(scLaps('monaco', 0.3, { zones: [zone(0.25, 0.35, 'gravel')] }), 2, 3), 'T3.1: grava en un urbano, 2 o 3 vueltas');
    assert(JSON.stringify(streetWall) === JSON.stringify(scLaps('monaco', 0.3)) && JSON.stringify(gravel) === JSON.stringify(scLaps('barcelona', 0.2))
      && JSON.stringify(wall) === JSON.stringify(scLaps('barcelona', 0.2, { zones: [zone(0.18, 0.22, 'wall')] })), 'T3.1: misma semilla, misma duración');
  });

  await test('T3.1: en una escapatoria de asfalto el coche pierde tiempo y sigue', () => {
    const T = 0.38; // Barcelona: tramo de asfalto de 0,35 a 0,42.
    const solo = crash => {
      const sim = race('barcelona', [T], { seed: 31 });
      const outcome = crash ? sim.reportCrash(sim.cars[0]) : null;
      return { sim, car: sim.cars[0], outcome };
    };
    const { sim, car, outcome } = solo(true);
    const incident = sim.incidents.at(-1);
    assert(outcome === 'salida' && car.status === 'running' && car.offTrack && car.offTrack.lossSec >= 4 && car.offTrack.lossSec <= 8, 'T3.1: un accidente normal en asfalto no retira el coche; pierde de 4 a 8 s', JSON.stringify(car.offTrack ?? null));
    assert(incident && incident.type === 'spin' && incident.surface === 'asphalt' && /SALIDA DE PISTA/i.test(incident.reason) && !incident.isCleared, 'T3.1: queda como salida de pista en asfalto', JSON.stringify(incident ?? null));
    assert(sim.localFlags().get(marshalSectorOf(T)) === 'yellow' && !sim.safetyCar.isDeployed && !sim.vscActive && !['sc', 'vsc', 'red'].includes(sim.raceFlagState), 'T3.1: solo amarilla local, sin neutralización');
    const lossSec = car.offTrack.lossSec;
    const twin = solo(false);
    const timeTo = (s, c) => { while (c.progress < 5 + T + 0.5 && s.raceTimeSec < 300) s.update(1 / 60); return s.raceTimeSec; };
    const lost = timeTo(sim, car) - timeTo(twin.sim, twin.car);
    assert(car.status === 'running' && !car.offTrack && Math.abs(lost - lossSec) <= 1.5 && lost >= 3 && lost <= 9.5, 'T3.1: vuelve a pista habiendo perdido ese tiempo', `sorteado ${lossSec.toFixed(2)} s, perdido ${lost.toFixed(2)} s`);
    assert(sim.incidents.every(i => i.isCleared) && sim.localFlags().size === 0 && !sim.safetyCar.isDeployed, 'T3.1: la amarilla se retira y no llega a salir el Safety Car');

    // Los que vienen detrás lo pasan sin quedarse bloqueados por la amarilla: un tren de cuatro coches a 25 m.
    const train = crash => {
      const sim2 = make('barcelona', 5), L = sim2.activeTrack.lapLengthMeters;
      sim2.cars.forEach((c, i) => Object.assign(c, { progress: 5 + T - i * 25 / L, trackT: T - i * 25 / L, currentLap: 5, currentSpeedKmh: 180 }));
      sim2.setSeed(31); sim2.setFixedStep(0.02);
      if (crash) sim2.reportCrash(sim2.cars[0]);
      return sim2;
    };
    const crashed = train(true), clean = train(false);
    let allPassedAt = null;
    while (crashed.raceTimeSec < 20 && allPassedAt === null) { crashed.update(1 / 60); if (crashed.cars.slice(1).every(c => c.progress > crashed.cars[0].progress)) allPassedAt = crashed.raceTimeSec; }
    const arrival = s => { const times = new Map(); while (times.size < 4 && s.raceTimeSec < 300) { s.update(1 / 60); for (const c of s.cars.slice(1)) if (!times.has(c.id) && c.progress >= 5 + T + 0.5) times.set(c.id, s.raceTimeSec); } return times; };
    const withCrash = arrival(crashed), without = arrival(clean);
    const followersLost = crashed.cars.slice(1).map(c => withCrash.get(c.id) - without.get(c.id));
    assert(allPassedAt !== null && allPassedAt < 6 && followersLost.every(lost => lost < 2), 'T3.1: los coches de detrás lo adelantan y no pierden el tiempo con él',
      `pasan todos a los ${allPassedAt?.toFixed(1)} s; pierden ${followersLost.map(lost => lost.toFixed(2)).join(', ')} s`);

    // En grava, hierba o muro el mismo accidente es abandono.
    const stuck = race('barcelona', [0.5, 0.35, 0.2]);
    assert(stuck.reportCrash(stuck.cars[2]) === 'abandono' && stuck.cars[2].status === 'out' && !stuck.cars[2].offTrack && stuck.raceFlagState === 'sc', 'T3.1: en grava el coche se queda y sale el Safety Car');

    // El sorteo de averías y accidentes del motor sigue el mismo camino.
    const draw = (circuit, t) => SEEDS.concat(SEEDS.map(s => s + 100), SEEDS.map(s => s + 200), SEEDS.map(s => s + 300), SEEDS.map(s => s + 400)).map(seed => {
      const one = race(circuit, [t], { seed });
      one.cars[0].failureFactor = 1e9;
      one.update(0.02);
      return { status: one.cars[0].status, reason: one.cars[0].dnfReason ?? '', off: Boolean(one.cars[0].offTrack) };
    });
    const onAsphalt = draw('barcelona', T), onGravel = draw('barcelona', 0.2), onWall = draw('monaco', 0.3);
    assert(onAsphalt.some(o => o.off && o.status === 'running') && onAsphalt.every(o => o.off || o.status === 'out') && !onAsphalt.some(o => /MURO|GRAVA|HIERBA|ESCAPATORIA/.test(o.reason)),
      'T3.1: en carrera, un accidente normal en asfalto es una salida de pista y no un abandono', JSON.stringify(onAsphalt.filter(o => !o.off).map(o => o.reason).slice(0, 6)));
    assert(!onGravel.some(o => o.off) && onGravel.some(o => /GRAVA/.test(o.reason)) && onGravel.every(o => o.status === 'out'), 'T3.1: en grava, abandono atrapado en la grava');
    assert(!onWall.some(o => o.off) && onWall.some(o => /MURO/.test(o.reason)) && onWall.every(o => o.status === 'out'), 'T3.1: en un urbano, abandono contra el muro');
  });

  await test('T3.1: dos incidentes', () => {
    // Mónaco con un tramo de grava de test: primero el incidente corto, después el muro.
    const zones = [zone(0.15, 0.25, 'gravel')];
    const positions = [0.9, 0.8, 0.7, 0.5, 0.2];
    const short = race('monaco', positions, { zones });
    short.reportIncident(short.cars[4], 'crash');
    const first = short.safetyCar.targetLaps;
    run(short, 1);
    short.reportIncident(short.cars[3], 'crash');
    const sc = short.safetyCar;
    assert(short.raceFlagState === 'sc' && first >= 2 && first <= 3 && sc.targetLaps >= sc.lapCount + 10 && sc.targetLaps <= sc.lapCount + 12,
      'T3.1: un muro posterior alarga el Safety Car hasta lo que pide', `${first} → ${sc.targetLaps} (vuelta ${sc.lapCount} del SC)`);
    assert(sc.durationLog.length === 2 && sc.durationLog[0].surface === 'gravel' && sc.durationLog[1].surface === 'wall', 'T3.1: los dos incidentes quedan registrados');

    const long = race('monaco', positions, { zones });
    long.reportIncident(long.cars[3], 'crash');
    const before = long.safetyCar.targetLaps;
    run(long, 1);
    long.reportIncident(long.cars[4], 'crash');
    assert(long.raceFlagState === 'sc' && before >= 10 && long.safetyCar.targetLaps === before && long.safetyCar.durationLog.length === 2, 'T3.1: un incidente posterior que pide menos no acorta el Safety Car', `${before} → ${long.safetyCar.targetLaps}`);

    // Hasta el final: el Safety Car no se retira antes de cumplir lo que pidió el segundo incidente.
    const full = race('barcelona', positions, { zones: [zone(0.45, 0.55, 'wall')] });
    full.reportIncident(full.cars[4], 'crash');
    run(full, 1);
    full.reportIncident(full.cars[3], 'crash');
    const target = full.safetyCar.targetLaps;
    let leftAtLap = null;
    while (full.raceTimeSec < 3500 && leftAtLap === null) {
      full.update(1 / 60);
      if (full.safetyCar.phase === 'retirada' || !full.safetyCar.isDeployed) leftAtLap = full.safetyCar.lapCount;
    }
    assert(target >= 4 && leftAtLap !== null && leftAtLap >= target, 'T3.1: el Safety Car cumple las vueltas del incidente que más pide', `pedía ${target}, se retira en la ${leftAtLap}`);
  });

  await test('T3.1: bandera roja y perfil FIA', () => {
    const grave = race('barcelona', [0.9, 0.8, 0.38]);
    grave.reportIncident(grave.cars[2], 'major_crash');
    assert(grave.raceFlagState === 'red' && grave.incidents.at(-1).surface === 'asphalt', 'T3.1: un accidente grave saca la roja también en asfalto');
    const same = race('barcelona', [0.9, 0.8, 0.7, 0.15, 0.1]);
    same.reportIncident(same.cars[4], 'crash');
    same.reportIncident(same.cars[3], 'crash');
    assert(same.incidents[0].sector === same.incidents[1].sector && same.raceFlagState === 'red', 'T3.1: dos coches parados en el mismo sector siguen sacando la roja');
    // Una salida de pista no es un coche parado: no cuenta para la roja.
    const wide = race('barcelona', [0.9, 0.8, 0.7, 0.41, 0.38]);
    wide.reportCrash(wide.cars[4]);
    wide.reportIncident(wide.cars[3], 'crash');
    assert(wide.incidents[0].sector === wide.incidents[1].sector && wide.raceFlagState === 'sc' && wide.cars[4].status === 'running', 'T3.1: una salida de pista no suma para la bandera roja', wide.raceFlagState);

    const fia = race('monaco', [0.9, 0.8, 0.7, 0.5, 0.2], { fia: true });
    fia.reportIncident(fia.cars[4], 'crash');
    const afterFirst = fia.safetyCar.targetLaps;
    run(fia, 1);
    fia.reportIncident(fia.cars[3], 'crash');
    assert(fia.raceFlagState === 'sc' && afterFirst === 0 && fia.safetyCar.targetLaps === 0 && /FIA/.test(fia.safetyCar.durationLog[0].text), 'T3.1: con el perfil FIA 2025 no hay mínimo de vueltas', `${afterFirst}, ${fia.safetyCar.targetLaps}`);
  });

  await test('T3.1: motivo registrado, guardar y cargar', () => {
    const sim = race('monaco', [0.9, 0.8, 0.3]);
    sim.reportIncident(sim.cars[2], 'crash');
    const sc = sim.safetyCar, entry = sc.durationLog?.[0];
    assert(entry && entry.surface === 'wall' && entry.laps >= 10 && entry.laps <= 12 && entry.targetLaps === sc.targetLaps && entry.incidentId === sim.incidents[0].id
      && /muro/i.test(entry.text) && /urbano/i.test(entry.text) && entry.text.includes(String(entry.laps)), 'T3.1: queda registrado por qué se eligió esa duración', JSON.stringify(entry ?? null));
    assert(sc.triggerReason.includes(entry.text) && (sc.phaseLog ?? []).some(p => p.message.includes(entry.text)), 'T3.1: el motivo se ve en el aviso del Safety Car', sc.triggerReason);
    const gravel = race('barcelona', [0.9, 0.8, 0.2]);
    gravel.reportIncident(gravel.cars[2], 'crash');
    assert(/grava/i.test(gravel.safetyCar.durationLog[0].text) && !/muro/i.test(gravel.safetyCar.durationLog[0].text), 'T3.1: y dice la superficie que tocó', gravel.safetyCar.durationLog[0].text);

    const target = new RaceSimulation('monaco');
    const outcome = snap.restoreSnapshot(target, JSON.stringify(snap.createSnapshot(sim)));
    assert(outcome.ok && target.safetyCar.targetLaps === sc.targetLaps && JSON.stringify(target.safetyCar.durationLog) === JSON.stringify(sc.durationLog) && target.incidents[0].surface === 'wall',
      'T3.1: la duración, su motivo y la superficie vuelven con la partida', outcome.errors?.join(' · '));

    // Una salida de pista a medias sigue igual tras cargar.
    const live = race('barcelona', [0.38], { seed: 31 });
    live.reportCrash(live.cars[0]);
    run(live, 2);
    const loaded = new RaceSimulation('barcelona');
    const second = snap.restoreSnapshot(loaded, JSON.stringify(snap.createSnapshot(live)));
    const car = loaded.cars[0];
    assert(second.ok && car.offTrack && car.offTrack.lossSec === live.cars[0].offTrack.lossSec, 'T3.1: la salida de pista en curso se guarda', second.errors?.join(' · '));
    run(live, 30); run(loaded, 30);
    assert(!car.offTrack && car.status === 'running' && Math.abs(car.progress - live.cars[0].progress) < 1e-9, 'T3.1: y continúa igual que en la carrera original', `${car.progress} / ${live.cars[0].progress}`);
  });
}
