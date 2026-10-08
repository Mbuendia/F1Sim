// R28 (solo esquema) — Snapshot versionado de carrera (contrato aprobado por el usuario el 01/10/2026).
// Cargar/continuar, migraciones y botones llegan con R48 (tests en save-load-r48); el esquema pasa a la versión 2
// (comprobación de versión actualizada con autorización del usuario el 07/10/2026).
//  1. Declara esquema, versión, perfil, circuito, reloj, semilla, estado del azar y todos los coches.
//  2. JSON puro, sin geometría, canvas ni timers.  3. Tomarlo no altera la carrera.
//  4. El estado guardado de un flujo reproduce sus números siguientes.  5. Validador con diagnóstico.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { createSnapshot, validateSnapshot, SNAPSHOT_SCHEMA, SNAPSHOT_VERSION } = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { mulberry32, rngState } = await server.ssrLoadModule('/src/simulation/Random.ts');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;

  const seededRace = (cars = 6) => {
    const sim = make('barcelona', cars);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(42); sim.setFixedStep(0.02);
    return sim;
  };
  const runTo = (sim, steps) => { while (sim.fixedStepCount < steps) sim.update(1 / 60); };

  await test('R28: el snapshot declara versión, referencias, reloj, azar y coches', () => {
    const sim = seededRace();
    runTo(sim, 300);
    const snap = createSnapshot(sim);
    assert(snap.schema === SNAPSHOT_SCHEMA && snap.version === SNAPSHOT_VERSION && SNAPSHOT_VERSION === 2, 'R28: esquema y versión 2');
    assert(snap.ruleSetId === sim.rules.id && snap.circuitId === 'barcelona', 'R28: referencias al perfil de reglas y al circuito', `${snap.ruleSetId} / ${snap.circuitId}`);
    const c = snap.clock;
    assert(c && c.raceTimeSec === sim.raceTimeSec && c.fixedStepSec === 0.02 && c.fixedStepCount === sim.fixedStepCount
      && typeof c.stepAccumulator === 'number' && c.lightState === 'racing', 'R28: reloj completo (tiempo, paso fijo, acumulador, pasos, semáforos)');
    assert(snap.rng && snap.rng.seed === 42, 'R28: semilla guardada');
    const keys = ['motor', ...sim.cars.map(car => `coche-${car.id}`)];
    assert(keys.every(k => Number.isInteger(snap.rng.streams[k]) && snap.rng.streams[k] >= 0 && snap.rng.streams[k] < 2 ** 32),
      'R28: estado de cada flujo de azar (motor y uno por coche)', Object.keys(snap.rng.streams).join(', '));
    assert(snap.state.cars.length === sim.cars.length && snap.state.cars.every(car => car.pitStop && car.tires && car.energy),
      'R28: todos los coches con boxes, neumáticos y energía');
    for (const part of ['flags', 'safetyCar', 'incidents', 'drsPermissions', 'timing', 'counters', 'weather']) {
      assert(snap.state[part] !== undefined, `R28: incluye ${part}`);
    }
  });

  await test('R28: JSON puro, sin geometría, canvas ni timers', () => {
    const sim = seededRace();
    runTo(sim, 300);
    const snap = createSnapshot(sim);
    const text = JSON.stringify(snap);
    assert(JSON.stringify(JSON.parse(text)) === text && JSON.stringify(snap, null, 0) === text, 'R28: ida y vuelta por JSON sin cambios');
    let bad = [];
    const walk = (value, path) => {
      if (typeof value === 'function' || value instanceof Map || value instanceof Set) bad.push(path);
      else if (typeof value === 'number' && !Number.isFinite(value)) bad.push(path);
      else if (value === undefined) bad.push(path);
      else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    };
    walk(snap, 'snap');
    assert(bad.length === 0, 'R28: sin funciones, Map, Set, NaN, Infinity ni undefined', bad.slice(0, 5).join(', '));
    assert(!/"(points|pitLanePoints|corners|bounds|canvas|onFixedStep)"/.test(text), 'R28: la geometría y los callbacks no se guardan (se reconstruyen)');
  });

  await test('R28: tomar un snapshot no altera la carrera', () => {
    const result = withSnapshot => {
      const sim = seededRace();
      runTo(sim, 1500);
      if (withSnapshot) createSnapshot(sim);
      runTo(sim, 3000);
      return JSON.stringify(sim.cars.map(c => [c.id, c.progress, c.currentPosition, c.lapHistory.map(l => l.lapTime)]));
    };
    assert(result(true) === result(false), 'R28: misma carrera con y sin snapshot intermedio');
  });

  await test('R28: el estado guardado del azar reproduce los números siguientes', () => {
    const original = mulberry32(1234);
    for (let i = 0; i < 17; i++) original();
    const copy = mulberry32(rngState(original));
    const a = Array.from({ length: 5 }, () => original()), b = Array.from({ length: 5 }, () => copy());
    assert(a.every((v, i) => v === b[i]), 'R28: el flujo recreado desde su estado continúa igual');
    const sim = seededRace(2);
    runTo(sim, 200);
    const snap = createSnapshot(sim);
    const again = seededRace(2);
    runTo(again, 200);
    assert(JSON.stringify(createSnapshot(again).rng) === JSON.stringify(snap.rng), 'R28: misma semilla y pasos → mismo estado del azar');
  });

  await test('R28: el validador acepta estados clave y rechaza con diagnóstico', () => {
    const fresh = make('barcelona', 3); fresh.lightState = 'idle';
    const sc = seededRace(); runTo(sc, 100); sc.deploySafetyCar('Prueba');
    const pit = seededRace(); runTo(pit, 100); Object.assign(pit.cars[1], { isInPitLane: true }); pit.cars[1].pitStop.isPitting = true;
    const done = seededRace(); runTo(done, 100); done.isFinished = true; done.cars.forEach(c => { c.status = 'finished'; });
    for (const [label, sim] of [['antes de la salida', fresh], ['con Safety Car', sc], ['en boxes', pit], ['carrera terminada', done]]) {
      const errors = validateSnapshot(createSnapshot(sim));
      assert(errors.length === 0, `R28: válido ${label}`, errors.join(' | '));
    }
    const base = createSnapshot(sc);
    const broken = mutate => { const copy = structuredClone(base); mutate(copy); return validateSnapshot(copy); };
    const future = broken(s => { s.version = 99; });
    assert(future.some(e => /99/.test(e) && /1/.test(e)), 'R28: versión desconocida → error que nombra la recibida y la soportada', future.join(' | '));
    const cases = {
      'sin reloj': s => { delete s.clock; },
      'sin azar': s => { delete s.rng; },
      'sin coches': s => { s.state.cars = []; },
      'perfil inexistente': s => { s.ruleSetId = 'fia-1950'; },
      'circuito inexistente': s => { s.circuitId = 'atlantida'; },
      'otro esquema': s => { s.schema = 'otra-cosa'; },
    };
    for (const [label, mutate] of Object.entries(cases)) {
      assert(broken(mutate).length > 0, `R28: el validador rechaza «${label}»`);
    }
  });
}
