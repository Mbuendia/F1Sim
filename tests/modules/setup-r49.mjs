// R49 — Setup, parc fermé y salida desde boxes (contrato aprobado por el usuario el 07/10/2026).
//  1. Setup: neutro = motor idéntico; cada ajuste tiene ganancia y contrapartida; efecto en el sentido esperado en
//     circuitos opuestos; la clasificación usa el setup del piloto.
//  2. Parc fermé: sin cambios o con un punto de ala no hay sanción; lo demás obliga a salir desde el pit lane y dice
//     por qué; sin clasificación no hay parc fermé; la parrilla se cierra.
//  3. Salida desde boxes: espera parado con el semáforo en rojo hasta que pasa el último coche, se incorpora detrás de
//     todos, no cuenta como parada, completa las mismas vueltas; en los 23 circuitos; guardar y cargar esperando.
//  4. Interfaz: panel de setup y declaración en la pantalla de clasificación.
// Decisiones del usuario: la relación de cambio se mantiene como diseño del juego (en la F1 real es fija toda la
// temporada); en parc fermé se permite un punto de carga aerodinámica; la IA corre con el setup neutro.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const setup = await server.ssrLoadModule('/src/simulation/Setup.ts');
  const aero = await server.ssrLoadModule('/src/simulation/AeroModel.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const { resolveTechnical } = await server.ssrLoadModule('/src/data/teamProfiles.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { applyGridPenalties } = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const { runQualifying } = await server.ssrLoadModule('/src/simulation/Qualifying.ts');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const NEUTRAL = setup.NEUTRAL_SETUP;

  // Lo que el motor sortea al preparar la parrilla (fuera de la semilla) se fija, para comparar carreras montadas aparte.
  const settle = sim => { sim.lightsRandomDelay = 1.2; sim.cars.forEach(c => { c.raceDayLuckFactor = 0; }); return sim; };
  const stepTo = (sim, steps) => { while (sim.fixedStepCount < steps) sim.update(1 / 60); };
  const canonical = value => (Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value);
  const fingerprint = sim => {
    const snapshot = snap.createSnapshot(sim);
    snapshot.specials = snapshot.specials.map(entry => JSON.stringify(entry)).sort();
    snapshot.diagnostics = [...snapshot.diagnostics].sort();
    return JSON.stringify(canonical(snapshot))
      .replace(/"timestamp":\d+/g, '"timestamp":0').replace(/dnf_(\d+)_\d+/g, 'dnf_$1').replace(/d20_\d+_/g, 'd20_');
  };

  // ── 1. Setup ──
  const longitudinal = tech => ({ massKg: 850, powerKw: tech.iceKw + 60, slipstream: 0, dragFactor: tech.dragFactor, gearDrive: tech.gearDrive, revLimitFactor: tech.revLimitFactor });
  const top = (tech, drsOpen = false) => aero.topSpeedKmh({ ...longitudinal(tech), drsOpen });
  const sprint = tech => {   // segundos de 160 a 260 km/h a fondo
    let v = 160, t = 0;
    while (v < 260 && t < 60) { v += aero.longitudinalAccel({ ...longitudinal(tech), drsOpen: false, speedKmh: v }) * 3.6 * 0.01; t += 0.01; }
    return t;
  };

  await test('R49: con el setup neutro el motor es idéntico', () => {
    const base = resolveTechnical('mclaren', 'barcelona');
    assert(JSON.stringify(setup.applySetup(base, NEUTRAL)) === JSON.stringify(base) && JSON.stringify(setup.applySetup(base, undefined)) === JSON.stringify(base),
      'R49: el perfil técnico no cambia con el setup neutro ni sin setup');
    assert(NEUTRAL.wing === 0 && NEUTRAL.stiffness === 0 && NEUTRAL.gearing === 0, 'R49: setup neutro = carga y rigidez de referencia y relación larga');
    const race = withSetup => {
      const sim = settle(make('barcelona', 6));
      sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
      sim.setSeed(49); sim.setFixedStep(0.02);
      if (withSetup) sim.setCarSetups(withSetup(sim));
      stepTo(sim, 3000);
      return fingerprint(sim);
    };
    const plain = race(null);
    assert(race(sim => Object.fromEntries(sim.cars.map(c => [c.driver.id, { ...NEUTRAL }]))) === plain, 'R49: la carrera con setups neutros es la misma, paso a paso');
    assert(race(() => ({})) === plain, 'R49: la carrera sin setups es la misma');
    assert(race(sim => ({ [sim.cars[2].driver.id]: { wing: 2, stiffness: -1, gearing: 2 } })) !== plain, 'R49: un setup distinto sí cambia la carrera');
  });

  await test('R49: cada ajuste tiene ganancia y contrapartida', () => {
    const base = resolveTechnical('mclaren', 'barcelona');
    const tune = change => setup.applySetup(base, { ...NEUTRAL, ...change });
    for (const n of [1, 2]) {
      const more = tune({ wing: n }), less = tune({ wing: -n });
      assert(more.fastCornerGrip > base.fastCornerGrip && top(more) < top(base), `R49: +${n} de carga → más paso por curva rápida y menos punta`, `${more.fastCornerGrip} · ${top(more).toFixed(1)} km/h`);
      assert(less.fastCornerGrip < base.fastCornerGrip && top(less) > top(base), `R49: −${n} de carga → menos paso por curva rápida y más punta`);
      assert(more.slowCornerGrip === base.slowCornerGrip && more.tyreWear === base.tyreWear, 'R49: la carga no toca el agarre mecánico ni el desgaste');
      const stiff = tune({ stiffness: n }), soft = tune({ stiffness: -n });
      assert(stiff.fastCornerGrip > base.fastCornerGrip && stiff.slowCornerGrip < base.slowCornerGrip && stiff.tyreWear > base.tyreWear,
        `R49: +${n} de rigidez → más curva rápida, menos curva lenta y más desgaste`);
      assert(soft.fastCornerGrip < base.fastCornerGrip && soft.slowCornerGrip > base.slowCornerGrip && soft.tyreWear < base.tyreWear,
        `R49: −${n} de rigidez → menos curva rápida, más curva lenta y menos desgaste`);
      assert(stiff.dragFactor === base.dragFactor, 'R49: la rigidez no toca el drag');
      const short = tune({ gearing: n });
      assert(sprint(short) < sprint(base) && top(short, true) < top(base, true), `R49: relación ${n === 1 ? 'media' : 'corta'} → acelera antes de 160 a 260 km/h y pierde punta con DRS`,
        `${sprint(short).toFixed(2)} s frente a ${sprint(base).toFixed(2)} s · ${top(short, true).toFixed(1)} frente a ${top(base, true).toFixed(1)} km/h`);
      assert(short.fastCornerGrip === base.fastCornerGrip && short.slowCornerGrip === base.slowCornerGrip, 'R49: la relación de cambio no toca el paso por curva');
    }
    assert(sprint(tune({ gearing: 2 })) < sprint(tune({ gearing: 1 })) && top(tune({ gearing: 2 })) < top(base) && top(tune({ gearing: 2 }), true) < top(tune({ gearing: 1 }), true),
      'R49: la relación corta acelera más que la media y pierde punta incluso sin DRS');
    for (const key of ['wing', 'stiffness', 'gearing']) {
      for (const n of [-2, -1, 1, 2]) assert(tune({ [key]: n }).iceKw === base.iceKw, `R49: ${key} ${n} no toca la unidad de potencia`);
    }
    assert(JSON.stringify(setup.normalizeSetup({ wing: 9, stiffness: -7, gearing: -1 })) === JSON.stringify({ wing: 2, stiffness: -2, gearing: 0 })
      && JSON.stringify(setup.normalizeSetup({ wing: 0.6, gearing: 5 })) === JSON.stringify({ wing: 1, stiffness: 0, gearing: 2 }),
      'R49: los valores fuera de rango se acotan y los intermedios se redondean');
    assert(typeof setup.GEARING_NOTE === 'string' && /dise[ñn]o del juego/i.test(setup.GEARING_NOTE), 'R49: la relación de cambio queda declarada como diseño del juego');
  });

  await test('R49: el efecto va en el sentido esperado en circuitos opuestos y llega a la clasificación', () => {
    const lapWith = (circuit, change) => {
      const sim = new RaceSimulation(circuit);
      const id = sim.cars[0].driver.id;
      sim.setCarSetups({ [id]: { ...NEUTRAL, ...change } });
      return RejoinModel.lapProfile(sim.activeTrack, sim.cars[0], null).lapTime;
    };
    assert(lapWith('monza', { wing: 2 }) > lapWith('monza', { wing: -2 }) + 0.3, 'R49: en Monza, más carga es más lenta', `${lapWith('monza', { wing: 2 }).toFixed(2)} / ${lapWith('monza', { wing: -2 }).toFixed(2)}`);
    assert(lapWith('monaco', { wing: 2 }) < lapWith('monaco', { wing: -2 }), 'R49: en Mónaco, más carga es más rápida', `${lapWith('monaco', { wing: 2 }).toFixed(2)} / ${lapWith('monaco', { wing: -2 }).toFixed(2)}`);
    assert(lapWith('silverstone', { stiffness: 2 }) < lapWith('silverstone', { stiffness: -2 }), 'R49: en Silverstone, más rigidez es más rápida');
    assert(lapWith('monaco', { stiffness: -2 }) < lapWith('monaco', { stiffness: 2 }), 'R49: en Mónaco, menos rigidez es más rápida');
    assert(lapWith('monza', { gearing: 2 }) > lapWith('monza', { gearing: 0 }), 'R49: en Monza, la relación corta es más lenta', `${lapWith('monza', { gearing: 2 }).toFixed(2)} / ${lapWith('monza', { gearing: 0 }).toFixed(2)}`);
    assert(lapWith('monaco', { gearing: 2 }) < lapWith('monaco', { gearing: 0 }), 'R49: en Mónaco, la relación corta es más rápida', `${lapWith('monaco', { gearing: 2 }).toFixed(2)} / ${lapWith('monaco', { gearing: 0 }).toFixed(2)}`);

    const sim = new RaceSimulation('monza');
    const before = sim.qualifyingEntrants();
    sim.setCarSetups({ alonso: { wing: 2, stiffness: 0, gearing: 0 } });
    const after = sim.qualifyingEntrants();
    const lapOf = (list, id) => list.find(e => e.driverId === id).referenceLapSec;
    assert(lapOf(after, 'alonso') > lapOf(before, 'alonso'), 'R49: la clasificación usa el setup del piloto', `${lapOf(before, 'alonso').toFixed(2)} → ${lapOf(after, 'alonso').toFixed(2)}`);
    assert(after.every(e => e.driverId === 'alonso' || e.referenceLapSec === lapOf(before, e.driverId)), 'R49: el setup de un piloto no cambia la clasificación de los demás');
    const grid = seed => runQualifying(sim.qualifyingEntrants(), seed).grid.findIndex(s => s.driverId === 'alonso');
    const slow = grid(7);
    sim.setCarSetups({ alonso: { wing: -2, stiffness: 0, gearing: 0 } });
    assert(grid(7) <= slow, 'R49: con mejor setup para el circuito no clasifica peor', `${grid(7) + 1} frente a ${slow + 1}`);
    // El setup se conserva al preparar otra carrera y se quita al dejarlo neutro.
    sim.setCircuit('monaco');
    const tuned = sim.cars.find(c => c.driver.id === 'alonso').technical;
    assert(tuned.fastCornerGrip < resolveTechnical(tuned.teamId, 'monaco').fastCornerGrip, 'R49: el setup sigue aplicado al cambiar de circuito');
    sim.setCarSetups({});
    const reset = sim.cars.find(c => c.driver.id === 'alonso').technical;
    assert(JSON.stringify(reset) === JSON.stringify(resolveTechnical(reset.teamId, 'monaco')), 'R49: sin setup vuelve el perfil de referencia');
  });

  // ── 2. Parc fermé ──
  await test('R49: parc fermé — cambios permitidos y prohibidos', () => {
    const quali = { wing: 0, stiffness: 1, gearing: 1 };
    const same = setup.parcFermeCheck(quali, { ...quali });
    assert(same.allowed && same.changes.length === 0 && same.breaches.length === 0, 'R49: sin cambios no hay sanción');
    for (const wing of [1, -1]) {
      const check = setup.parcFermeCheck(quali, { ...quali, wing });
      assert(check.allowed && check.breaches.length === 0 && check.changes.length === 1 && /carga|ala|aler[oó]n/i.test(check.changes[0]), `R49: un punto de carga (${wing}) está permitido y se anota`, check.changes.join(' | '));
    }
    const cases = {
      'dos puntos de carga': [{ ...quali, wing: 2 }, /carga/i],
      'rigidez': [{ ...quali, stiffness: 0 }, /rigidez/i],
      'relación de cambio': [{ ...quali, gearing: 0 }, /cambio/i],
    };
    for (const [label, [race, pattern]] of Object.entries(cases)) {
      const check = setup.parcFermeCheck(quali, race);
      assert(!check.allowed && check.breaches.length === 1 && pattern.test(check.breaches[0]), `R49: cambiar ${label} obliga a salir desde el pit lane y dice por qué`, check.breaches.join(' | '));
    }
    const all = setup.parcFermeCheck(quali, { wing: -2, stiffness: -1, gearing: 2 });
    assert(!all.allowed && all.breaches.length === 3, 'R49: se listan todos los cambios prohibidos', all.breaches.join(' | '));
    const mixed = setup.parcFermeCheck(quali, { ...quali, wing: 1, stiffness: 2 });
    assert(!mixed.allowed && mixed.breaches.length === 1 && mixed.changes.length === 1, 'R49: un cambio permitido no tapa uno prohibido');
    const free = setup.parcFermeCheck(null, { wing: 2, stiffness: -2, gearing: 2 });
    assert(free.allowed && free.breaches.length === 0, 'R49: sin clasificación (GP directo) no hay parc fermé');
  });

  await test('R49: quien sale desde boxes deja su puesto y la parrilla se cierra', () => {
    const order = ['a', 'b', 'c', 'd', 'e'];
    const one = setup.withPitLaneStarts(order, [{ driverId: 'b', reason: 'Cambio de rigidez en parc fermé' }]);
    assert(one.order.join() === 'a,c,d,e,b', 'R49: el resto sube un puesto y el coche pasa al final', one.order.join());
    assert(one.pitLane.length === 1 && one.pitLane[0].driverId === 'b' && one.pitLane[0].from === 2 && /rigidez/i.test(one.pitLane[0].reason), 'R49: queda declarado con su puesto de clasificación y el motivo', JSON.stringify(one.pitLane));
    const two = setup.withPitLaneStarts(order, [{ driverId: 'd', reason: 'x' }, { driverId: 'a', reason: 'y' }]);
    assert(two.order.join() === 'b,c,e,a,d' && two.pitLane.map(p => p.driverId).join() === 'a,d', 'R49: dos coches salen desde boxes en su orden de clasificación', two.order.join());
    const none = setup.withPitLaneStarts(order, []);
    assert(none.order.join() === order.join() && none.pitLane.length === 0, 'R49: sin salidas desde boxes la parrilla no cambia');
    assert(setup.withPitLaneStarts(order, [{ driverId: 'zz', reason: 'x' }]).order.join() === order.join(), 'R49: un piloto que no está en la parrilla se ignora');
    // Con sanciones de componentes (R19): primero se recolocan, después sale del pit lane quien deba.
    const penalized = applyGridPenalties(order, [{ driverId: 'a', places: 2 }, { driverId: 'c', places: 1 }]);
    const both = setup.withPitLaneStarts(penalized.order, [{ driverId: 'c', reason: 'x' }]);
    assert(both.order[both.order.length - 1] === 'c' && both.order.filter(id => id !== 'c').join() === penalized.order.filter(id => id !== 'c').join(),
      'R49: junto a las sanciones de componentes, la salida desde boxes manda', `${penalized.order.join()} → ${both.order.join()}`);
  });

  // ── 3. Salida desde boxes ──
  const exitProgressOf = track => (track.pitExitT < 0.5 ? track.pitExitT : track.pitExitT - 1);
  const laneOf = track => {
    const len = track.pitExitT > track.pitEntryT ? track.pitExitT - track.pitEntryT : 1 - track.pitEntryT + track.pitExitT;
    return { len, meters: len * track.lapLengthMeters };
  };
  const gridRace = (circuit, starters, seed = 49) => {
    const sim = new RaceSimulation(circuit);
    sim.setSeed(seed); sim.setFixedStep(0.02);
    sim.setPitLaneStarters(starters);
    return settle(sim);
  };
  const carOf = (sim, driverId) => sim.cars.find(c => c.driver.id === driverId);
  /** Corre hasta que el coche se incorpora a la pista; devuelve lo observado por el camino. */
  const runToJoin = (sim, driverId, maxSteps = 6000) => {
    const car = carOf(sim, driverId), exit = exitProgressOf(sim.activeTrack), lane = laneOf(sim.activeTrack);
    const limitEnd = PitStopModel.limitFractions(lane.meters).end;
    const seen = { joined: false, movedOnRed: false, greenStep: null, fieldPassedAtGreen: null, worstPosition: Infinity, maxLimitedKmh: 0, othersAhead: null, joinStep: null };
    const start = car.progress;
    sim.lightState = 'racing';
    sim.onFixedStep = () => {
      if (seen.joined) return;
      const others = sim.cars.filter(c => c !== car && c.status !== 'out');
      if (sim.pitExitLight === 'rojo') { if (car.progress !== start || car.currentSpeedKmh !== 0) seen.movedOnRed = true; }
      else if (seen.greenStep === null) { seen.greenStep = sim.fixedStepCount; seen.fieldPassedAtGreen = others.filter(c => !c.startedFromPitLane).every(c => c.progress >= exit); }
      if (car.isInPitLane) {
        seen.worstPosition = Math.min(seen.worstPosition, car.currentPosition - others.filter(c => !c.pitLaneStart).length);
        if (car.pitStop.pitLaneProgress < limitEnd) seen.maxLimitedKmh = Math.max(seen.maxLimitedKmh, car.currentSpeedKmh);
      } else {
        seen.joined = true; seen.joinStep = sim.fixedStepCount;
        seen.othersAhead = others.filter(c => !c.pitLaneStart).every(c => c.progress > car.progress);
      }
    };
    const limit = sim.fixedStepCount + maxSteps;
    while (!seen.joined && sim.fixedStepCount < limit) sim.update(1 / 60);
    sim.onFixedStep = null;
    return seen;
  };

  await test('R49: el coche que sale desde boxes espera en el pit lane y la parrilla se cierra', () => {
    const plain = new RaceSimulation('barcelona');
    const expected = plain.cars.map(c => c.driver.id).filter(id => id !== 'alonso');
    const sim = gridRace('barcelona', ['alonso', 'piloto-que-no-existe']);
    const car = carOf(sim, 'alonso'), grid = sim.cars.filter(c => c !== car);
    assert(sim.cars.length === 20 && sim.cars[19] === car && car.gridPosition === 20, 'R49: sale último, con el último puesto', `${sim.cars.indexOf(car)} · P${car.gridPosition}`);
    assert(car.isInPitLane && car.currentSpeedKmh === 0 && car.pitLaneStart === 'espera' && car.startedFromPitLane === true && !car.pitStop.isPitting, 'R49: espera parado en el pit lane');
    assert(grid.map(c => c.driver.id).join() === expected.join() && grid.every((c, i) => c.gridPosition === i + 1 && Math.abs(c.progress + (i + 1) * 0.0035) < 1e-12 && !c.isInPitLane && !c.startedFromPitLane),
      'R49: los demás conservan su orden y ocupan los 19 primeros puestos sin hueco');
    assert(sim.pitExitLight === 'rojo', 'R49: semáforo del pit lane en rojo antes de la salida');
    sim.update(1 / 60);
    assert(car.currentPosition === 20, 'R49: figura último aunque esté más adelante en el pit lane', String(car.currentPosition));

    // Vuelta de formación: el coche no se mueve y la parrilla se forma sin hueco.
    const before = car.progress;
    sim.startRaceSequence();
    for (let i = 0; i < 40000 && sim.lightState !== 'grid-ready'; i++) sim.update(1 / 60);
    sim.update(1 / 60);   // un paso más: en «parrilla lista» los coches ya figuran parados
    assert(sim.lightState === 'grid-ready', 'R49: la vuelta de formación termina con el coche en boxes', sim.lightState);
    assert(car.progress === before && car.currentSpeedKmh === 0 && car.isInPitLane && car.pitLaneStart === 'espera', 'R49: no hace la vuelta de formación');
    assert(grid.every((c, i) => Math.abs(c.progress + (i + 1) * 0.0035) < 1e-9 && c.currentSpeedKmh === 0), 'R49: la parrilla se forma en los 19 primeros puestos');

    const back = gridRace('barcelona', ['alonso']);
    back.setPitLaneStarters([]);
    assert(back.cars.map(c => c.driver.id).join() === plain.cars.map(c => c.driver.id).join() && back.cars.every(c => !c.isInPitLane && !c.pitLaneStart && !c.startedFromPitLane),
      'R49: sin salidas desde boxes vuelve la parrilla normal');
  });

  await test('R49: sale con el semáforo en verde, detrás de todos y sin contar como parada', () => {
    const sim = gridRace('barcelona', ['alonso']);
    const car = carOf(sim, 'alonso');
    const seen = runToJoin(sim, 'alonso');
    assert(seen.joined, 'R49: el coche se incorpora a la pista');
    assert(!seen.movedOnRed, 'R49: con el semáforo en rojo no se mueve');
    assert(seen.greenStep !== null && seen.fieldPassedAtGreen === true, 'R49: el semáforo se pone en verde cuando el último coche ha pasado la salida de boxes');
    assert(seen.othersAhead === true, 'R49: al incorporarse tiene a todos por delante');
    assert(seen.worstPosition >= 1, 'R49: mientras está en el pit lane nunca figura por delante de un coche de la parrilla', String(seen.worstPosition));
    assert(seen.maxLimitedKmh <= PitStopModel.PIT_SPEED_LIMIT_KMH + 0.5, 'R49: respeta el limitador hasta la línea', `${seen.maxLimitedKmh.toFixed(1)} km/h`);
    assert(car.pitLaneStart === undefined && car.startedFromPitLane === true && sim.pitExitLight === 'verde', 'R49: termina el procedimiento y queda anotado que salió desde boxes');
    assert(car.pitStop.totalPitStops === 0 && (car.pitStop.stopLog ?? []).length === 0 && (car.pitStop.infractions ?? []).length === 0 && sim.stewards.decisions.every(d => d.carId !== car.id),
      'R49: no cuenta como parada ni genera infracción');

    // Carrera corta completa: mismas vueltas que el resto.
    const short = gridRace('barcelona', ['alonso']);
    short.totalLaps = 3;
    short.lightState = 'racing';
    for (let i = 0; i < 40000 && !short.isFinished; i++) short.update(1 / 60);
    const starter = carOf(short, 'alonso'), winner = short.cars.find(c => c.currentPosition === 1);
    assert(short.isFinished && starter.status === 'finished' && starter.currentLap === winner.currentLap && starter.currentLap === 3, 'R49: completa las mismas vueltas que el ganador', `${starter.status} · ${starter.currentLap}/${winner.currentLap}`);
    assert(starter.lapHistory.length === winner.lapHistory.length, 'R49: se le cronometran las mismas vueltas', `${starter.lapHistory.length}/${winner.lapHistory.length}`);
    const row = short.getRaceResult().rows.find(r => r.driverCode === starter.driver.code);
    assert(row && row.status === 'clasificado', 'R49: se clasifica con normalidad', JSON.stringify(row?.status));
  });

  await test('R49: dos coches salen en orden y un retirado en la parrilla no bloquea el semáforo', () => {
    const sim = gridRace('barcelona', ['stroll', 'alonso']);
    const lane = laneOf(sim.activeTrack);
    const waiting = sim.cars.filter(c => c.pitLaneStart);
    // El orden de salida es el de la parrilla, no el de la lista.
    const [first, second] = waiting;
    assert(waiting.length === 2 && first.progress > second.progress && (first.progress - second.progress) * sim.activeTrack.lapLengthMeters >= 7, 'R49: esperan en fila, separados',
      `${((first.progress - second.progress) * sim.activeTrack.lapLengthMeters).toFixed(1)} m`);
    assert(sim.cars.indexOf(first) === 18 && sim.cars.indexOf(second) === 19 && sim.cars.slice(0, 18).every((c, i) => c.gridPosition === i + 1), 'R49: 18 coches en la parrilla y dos al final');
    let minGapM = Infinity, order = [];
    sim.lightState = 'racing';
    sim.onFixedStep = () => {
      if (first.isInPitLane || second.isInPitLane) minGapM = Math.min(minGapM, (first.progress - second.progress) * sim.activeTrack.lapLengthMeters);
      for (const car of [first, second]) if (!car.isInPitLane && !order.includes(car)) order.push(car);
    };
    for (let i = 0; i < 6000 && order.length < 2; i++) sim.update(1 / 60);
    sim.onFixedStep = null;
    assert(order.length === 2 && order[0] === first, 'R49: se incorporan en el orden de la fila');
    assert(minGapM >= 5, 'R49: no se solapan en el pit lane', `${minGapM.toFixed(1)} m`);
    assert(sim.cars.filter(c => !c.startedFromPitLane && c.status !== 'out').every(c => c.progress > first.progress), 'R49: los dos salen detrás de toda la parrilla');
    assert(lane.meters > 100, 'R49: el pit lane de la prueba tiene longitud real');

    const stalled = gridRace('barcelona', ['alonso']);
    stalled.cars[5].status = 'out';
    const seen = runToJoin(stalled, 'alonso');
    assert(seen.joined && seen.greenStep !== null, 'R49: con un coche retirado en la parrilla el semáforo también se pone en verde');
  });

  await test('R49: la salida desde boxes funciona en los 23 circuitos', () => {
    const kinds = { 'salida tras la meta': null, 'salida antes de la meta': null, 'pit lane entero tras la meta': null };
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const sim = gridRace(id, ['alonso']);
      const track = sim.activeTrack, car = carOf(sim, 'alonso');
      const kind = track.pitExitT > 0.5 ? 'salida antes de la meta' : track.pitEntryT < track.pitExitT ? 'pit lane entero tras la meta' : 'salida tras la meta';
      const seen = runToJoin(sim, 'alonso');
      assert(seen.joined && !seen.movedOnRed && seen.fieldPassedAtGreen === true && seen.othersAhead === true && seen.worstPosition >= 1,
        `R49: ${id} — espera, sale en verde y se incorpora detrás de todos`, JSON.stringify(seen));
      assert((car.pitStop.infractions ?? []).length === 0 && car.pitStop.totalPitStops === 0, `R49: ${id} — sin infracción ni parada`);
      if (kinds[kind] === null) {
        // Una vuelta completa por cada tipo de pit lane: el contador de vueltas arranca bien.
        const lapsBefore = sim.cars.filter(c => c !== car && c.status === 'running').map(c => c.currentLap);
        for (let i = 0; i < 9000 && car.progress < 1.05 && car.status === 'running'; i++) sim.update(1 / 60);
        const peers = sim.cars.filter(c => c !== car && c.status === 'running' && c.progress >= 1.05 && c.progress < 2);
        assert(car.progress >= 1.05 && car.currentLap === 1 && peers.every(c => c.currentLap === 1), `R49: ${id} (${kind}) — completa la primera vuelta con el mismo contador que los demás`,
          `${car.currentLap} · ${car.progress.toFixed(3)} · antes ${Math.max(...lapsBefore)}`);
        kinds[kind] = id;
      }
    }
    assert(Object.values(kinds).every(Boolean), 'R49: probados los tres tipos de pit lane', JSON.stringify(kinds));
  });

  await test('R49: guardar con el coche esperando y cargar da la misma continuación; sin salidas desde boxes nada cambia', () => {
    const reference = gridRace('barcelona', ['alonso']);
    reference.lightState = 'racing';
    stepTo(reference, 2500);
    const original = gridRace('barcelona', ['alonso']);
    original.lightState = 'racing';
    stepTo(original, 100);
    assert(carOf(original, 'alonso').pitLaneStart === 'espera', 'R49: se guarda con el coche esperando en el pit lane');
    const target = new RaceSimulation('monza');
    const outcome = snap.restoreSnapshot(target, JSON.stringify(snap.createSnapshot(original)));
    assert(outcome.ok && carOf(target, 'alonso').pitLaneStart === 'espera' && target.pitExitLight === 'rojo', 'R49: se carga con el coche esperando y el semáforo en rojo', outcome.errors.join(' | '));
    stepTo(target, 2500);
    assert(fingerprint(target) === fingerprint(reference), 'R49: continuación idéntica tras cargar');
    // Reiniciar la carrera cargada conserva la salida desde boxes y el setup.
    target.initRace();
    assert(carOf(target, 'alonso').pitLaneStart === 'espera', 'R49: al reiniciar, el coche vuelve a salir desde boxes');

    const run = touch => {
      const sim = new RaceSimulation('barcelona');
      sim.setSeed(4949); sim.setFixedStep(0.02);
      if (touch) sim.setPitLaneStarters([]);
      settle(sim).lightState = 'racing';
      stepTo(sim, 1500);
      return fingerprint(sim);
    };
    assert(run(true) === run(false), 'R49: sin salidas desde boxes la carrera es la misma');
  });

  // ── 4. Interfaz ──
  await test('R49: panel de setup y declaración en la clasificación', async () => {
    const { SetupPanel } = await server.ssrLoadModule('/src/components/SetupPanel.tsx');
    const { QualifyingResults } = await server.ssrLoadModule('/src/components/QualifyingResults.tsx');
    const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
    const drivers = [DRIVERS.alonso, DRIVERS.stroll];
    const noop = () => {};
    const paddock = renderToStaticMarkup(createElement(SetupPanel, { drivers, setups: { alonso: { wing: 1, stiffness: -1, gearing: 2 } }, onChange: noop }));
    assert(paddock.includes('Setup') && paddock.includes(DRIVERS.alonso.code) && paddock.includes(DRIVERS.stroll.code), 'R49: el panel muestra el setup de los dos pilotos');
    for (const label of ['Carga aerodinámica', 'Rigidez', 'Relación de cambio']) assert(paddock.includes(label), `R49: el panel tiene «${label}»`);
    assert(/curva rápida/i.test(paddock) && /punta/i.test(paddock) && /desgaste/i.test(paddock) && /dise[ñn]o del juego/i.test(paddock), 'R49: cada ajuste explica su efecto y la relación de cambio se declara como diseño del juego');
    assert(!/parc ferm[eé]/i.test(paddock), 'R49: en el paddock no hay parc fermé');

    const quali = { alonso: { wing: 0, stiffness: 0, gearing: 0 }, stroll: { wing: 0, stiffness: 0, gearing: 0 } };
    const closed = renderToStaticMarkup(createElement(SetupPanel, { drivers, parcFerme: quali, onChange: noop,
      setups: { alonso: { wing: 1, stiffness: 0, gearing: 0 }, stroll: { wing: 0, stiffness: 2, gearing: 0 } } }));
    assert(/parc ferm[eé]/i.test(closed) && /permitido/i.test(closed) && /salir desde el pit lane/i.test(closed) && /rigidez/i.test(closed),
      'R49: en parc fermé dice qué cambio está permitido y cuál obliga a salir desde el pit lane');

    const sim = new RaceSimulation('barcelona');
    const result = runQualifying(sim.qualifyingEntrants(), 5);
    const html = renderToStaticMarkup(createElement(QualifyingResults, { result, pitLaneStarts: [{ driverId: 'stroll', from: 12, reason: 'Cambio de rigidez en parc fermé' }] }));
    assert(/sale desde el pit lane/i.test(html) && html.includes('Cambio de rigidez en parc fermé'), 'R49: la clasificación declara la salida desde el pit lane con su motivo');
    assert(!/sale desde el pit lane/i.test(renderToStaticMarkup(createElement(QualifyingResults, { result }))), 'R49: sin salidas desde boxes no se declara nada');
  });
}
