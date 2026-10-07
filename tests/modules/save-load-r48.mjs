// R48 — Cargar y continuar una partida (contrato aprobado por el usuario el 07/10/2026).
//  1. Continuación idéntica: guardar → texto JSON → cargar en otra instancia → continuar da el mismo estado completo
//     que la carrera que nunca se guardó (verde, boxes, Safety Car, VSC, bandera roja, lluvia, parrilla, terminada y
//     parrilla completa de 20 coches sobre una instancia que estaba en otro circuito).
//  2. Cargar dos veces da la misma continuación; un guardado rechazado no toca la carrera en curso.
//  3. Migración: un guardado v1 real se migra (verde, amarilla o Safety Car) o se rechaza con diagnóstico (VSC, roja);
//     versión futura y JSON corrupto se rechazan.
//  4. Ranuras con nombre, autoguardado, almacenamiento lleno, exportar/importar y carrera profesional completa.
//  5. Interfaz: panel «Partidas» y «Guardar partida» en el menú de carrera.
// Decisiones del usuario: snapshot v2 (el test de R28 pasa a comprobar la versión 2), autoguardado cada 30 s y al salir,
// y semilla propia por carrera en la aplicación.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const saves = await server.ssrLoadModule('/src/simulation/SaveGame.ts');
  const { buildWeatherScenario } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const make = await raceFactory(server);
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/snapshot-v1.json', import.meta.url), 'utf8'));
  const frac = x => ((x % 1) + 1) % 1;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Lo que el motor sortea al preparar la parrilla (fuera de la semilla) se fija, para que dos carreras montadas por
  // separado sean la misma.
  const settle = sim => { sim.lightsRandomDelay = 1.2; sim.cars.forEach(c => { c.raceDayLuckFactor = 0; }); return sim; };
  const seeded = (cars = 6, seed = 48) => {
    const sim = settle(make('barcelona', cars));
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(seed); sim.setFixedStep(0.02);
    return sim;
  };
  const stepTo = (sim, steps) => { while (sim.fixedStepCount < steps) sim.update(1 / 60); };
  const until = (sim, done, maxSteps = 60000) => {
    const limit = sim.fixedStepCount + maxSteps;
    while (!done() && sim.fixedStepCount < limit) sim.update(1 / 60);
    return done();
  };
  // Estado completo comparable: el snapshot con las claves ordenadas (el orden en que un objeto ganó sus campos no es
  // estado) y sin las marcas de reloj real de los avisos (ids de DNF y D20).
  const canonical = value => (Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value);
  const fingerprint = sim => {
    const snapshot = snap.createSnapshot(sim);
    snapshot.specials = snapshot.specials.map(entry => JSON.stringify(entry)).sort();
    snapshot.diagnostics = [...snapshot.diagnostics].sort();
    return JSON.stringify(canonical(snapshot))
      .replace(/"timestamp":\d+/g, '"timestamp":0').replace(/dnf_(\d+)_\d+/g, 'dnf_$1').replace(/d20_\d+_/g, 'd20_');
  };
  const firstDiff = (a, b, path = 'snapshot') => {
    if (a === b) return null;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const found = firstDiff(a[key], b[key], `${path}.${key}`);
      if (found) return found;
    }
    return null;
  };
  const same = (a, b) => (a === b ? '' : firstDiff(JSON.parse(a), JSON.parse(b)) ?? 'distinto');
  /** Guarda como texto y carga en otra instancia (nueva, o la indicada). */
  const reload = (sim, target = new RaceSimulation('barcelona')) => {
    const text = JSON.stringify(snap.createSnapshot(sim));
    const outcome = snap.restoreSnapshot(target, text);
    return { target, outcome, text };
  };

  // Cada momento lleva la carrera hasta el punto de guardado y dice cuántos pasos se continúa después.
  const MOMENTS = {
    'en verde': { reach: sim => { stepTo(sim, 1500); return true; }, more: 8000 },
    'con un coche parado en boxes': {
      reach: sim => { sim.issueBoxOrder(sim.cars[1].id, 'hard'); return until(sim, () => sim.cars[1].status === 'pit' && sim.cars[1].pitStop.currentStopTimer > 0); },
      more: 8000,
    },
    'bajo Safety Car': {
      reach: sim => { stepTo(sim, 300); sim.deploySafetyCar('Prueba', { targetLaps: 1 }); stepTo(sim, 1800); return sim.safetyCar.isDeployed; },
      more: 14000,
    },
    'bajo VSC': {
      reach: sim => { stepTo(sim, 300); sim.startVirtualSafetyCar(60); stepTo(sim, 800); return sim.vscActive; },
      more: 8000,
    },
    'con bandera roja suspendida': {
      reach: sim => { stepTo(sim, 300); sim.startRedFlag('Prueba'); return until(sim, () => sim.redFlag.phase === 'detenida' || sim.redFlag.phase === 'aviso'); },
      more: 12000,
    },
    'con lluvia': {
      reach: sim => { sim.setWeatherScenario(buildWeatherScenario('mojado-inicial', 3000)); stepTo(sim, 1500); return sim.weatherModel.meanDepth() > 0.5; },
      more: 8000,
    },
  };

  await test('R48: cargar da la misma continuación que no haber guardado', () => {
    for (const [label, moment] of Object.entries(MOMENTS)) {
      const reference = seeded();
      assert(moment.reach(reference), `R48: se alcanza el momento «${label}»`);
      const savedAt = reference.fixedStepCount;
      stepTo(reference, savedAt + moment.more);
      const expected = fingerprint(reference);

      const original = seeded();
      moment.reach(original);
      const { target, outcome } = reload(original);
      assert(outcome.ok && outcome.errors.length === 0, `R48: el guardado «${label}» se carga`, outcome.errors.join(' | '));
      assert(target.fixedStepCount === savedAt && fingerprint(target) === fingerprint(original), `R48: recién cargada, la carrera «${label}» es la guardada`,
        same(fingerprint(target), fingerprint(original)));
      stepTo(target, savedAt + moment.more);
      assert(fingerprint(target) === expected, `R48: continuación idéntica «${label}»`, same(fingerprint(target), expected));
    }
    const a = seeded(6, 48), b = seeded(6, 49);
    stepTo(a, 3000); stepTo(b, 3000);
    assert(fingerprint(a) !== fingerprint(b), 'R48: la comparación distingue carreras distintas (otra semilla)');
  });

  await test('R48: guardar en la parrilla y salir después', async () => {
    const grid = () => {
      const sim = seeded();
      sim.cars.forEach((c, i) => { Object.assign(c, { progress: -((i + 1) * 0.0035), currentSpeedKmh: 0, currentLap: 0 }); c.trackT = frac(c.progress); });
      sim.lightState = 'grid-ready';
      sim.update(1 / 60);
      return sim;
    };
    const reference = grid(), original = grid();
    const { target, outcome } = reload(original);
    assert(outcome.ok && target.lightState === 'grid-ready', 'R48: la parrilla se carga lista para salir', outcome.errors.join(' | '));
    for (const sim of [reference, target]) {
      sim.confirmRaceStart();
      for (let i = 0; i < 4000 && sim.lightState !== 'lights-out'; i++) sim.update(1 / 60);
    }
    assert(reference.lightState === 'lights-out' && target.lightState === 'lights-out' && reference.fixedStepCount === target.fixedStepCount,
      'R48: los semáforos se apagan en el mismo paso', `${reference.fixedStepCount} / ${target.fixedStepCount}`);
    await sleep(700);
    const from = reference.fixedStepCount;
    stepTo(reference, from + 3000); stepTo(target, from + 3000);
    assert(reference.lightState === 'racing' && fingerprint(target) === fingerprint(reference), 'R48: misma salida y mismas primeras curvas', same(fingerprint(target), fingerprint(reference)));
  });

  await test('R48: una carrera terminada se carga con el mismo resultado', () => {
    const finished = () => {
      const sim = seeded();
      sim.totalLaps = 4;
      return until(sim, () => sim.isFinished, 40000) ? sim : null;
    };
    const original = finished();
    assert(original !== null, 'R48: la carrera corta termina');
    const { target, outcome } = reload(original);
    assert(outcome.ok && target.isFinished && target.totalLaps === 4, 'R48: se carga terminada', outcome.errors.join(' | '));
    assert(JSON.stringify(target.getRaceResult()) === JSON.stringify(original.getRaceResult()), 'R48: mismo resultado provisional');
    assert(target.podiumCars.map(c => c.id).join() === original.podiumCars.map(c => c.id).join() && target.podiumCars.every(c => target.cars.includes(c)),
      'R48: mismo podio, con los coches de la carrera cargada');
    assert(JSON.stringify(target.confirmResult()) === JSON.stringify(original.confirmResult()), 'R48: mismo resultado final al confirmarlo');
  });

  await test('R48: parrilla completa sobre una instancia que estaba en otro circuito', () => {
    const full = () => {
      const sim = settle(new RaceSimulation('barcelona'));
      sim.setSeed(4848); sim.setFixedStep(0.02); sim.lightState = 'racing';
      return sim;
    };
    const reference = full();
    stepTo(reference, 4000);
    const expected = fingerprint(reference);
    const original = full();
    stepTo(original, 1500);
    const other = new RaceSimulation('monza');
    other.setSeed(7); other.setFixedStep(0.02); other.lightState = 'racing';
    stepTo(other, 200);
    const { target, outcome } = reload(original, other);
    assert(outcome.ok && target.circuitId === 'barcelona' && target.cars.length === 20, 'R48: parrilla completa (20 coches) cargada en Barcelona', `${target.cars.length} coches · ${outcome.errors.join(' | ')}`);
    assert(target.activeTrack.lapLengthMeters === original.activeTrack.lapLengthMeters, 'R48: el trazado es el del guardado');
    stepTo(target, 4000);
    assert(fingerprint(target) === expected, 'R48: continuación idéntica con la parrilla completa', same(fingerprint(target), expected));
  });

  await test('R48: cargar dos veces da lo mismo y un guardado rechazado no toca la carrera', () => {
    const original = seeded();
    stepTo(original, 1200);
    const text = JSON.stringify(snap.createSnapshot(original));
    const first = new RaceSimulation('barcelona'), second = new RaceSimulation('barcelona');
    snap.restoreSnapshot(first, text); snap.restoreSnapshot(second, text);
    stepTo(first, 4000);
    stepTo(second, 2500);
    // Volver a cargar el mismo guardado sobre una carrera ya avanzada: empieza otra vez desde el punto guardado.
    assert(snap.restoreSnapshot(second, text).ok && second.fixedStepCount === original.fixedStepCount, 'R48: recargar vuelve al punto guardado');
    stepTo(second, 4000);
    assert(fingerprint(first) === fingerprint(second), 'R48: el mismo guardado da siempre la misma continuación', same(fingerprint(first), fingerprint(second)));

    const running = seeded();
    stepTo(running, 900);
    const before = fingerprint(running);
    const good = JSON.parse(text);
    const rejected = {
      'texto que no es JSON': '{"schema":"f1sim-carrera",',
      'versión futura': JSON.stringify({ ...good, version: 99 }),
      'otro esquema': JSON.stringify({ ...good, schema: 'otra-cosa' }),
      'sin coches': JSON.stringify({ ...good, state: { ...good.state, cars: [] } }),
      'circuito inexistente': JSON.stringify({ ...good, circuitId: 'atlantida' }),
      'coche sin neumáticos': JSON.stringify({ ...good, state: { ...good.state, cars: good.state.cars.map((c, i) => (i === 2 ? { ...c, tires: undefined } : c)) } }),
    };
    for (const [label, input] of Object.entries(rejected)) {
      const outcome = snap.restoreSnapshot(running, input);
      assert(!outcome.ok && outcome.errors.length > 0 && outcome.errors.every(e => typeof e === 'string' && e.length > 8), `R48: se rechaza «${label}» con diagnóstico`, outcome.errors.join(' | '));
      assert(fingerprint(running) === before, `R48: la carrera en curso no cambia al rechazar «${label}»`);
    }
    const reference = seeded();
    stepTo(reference, 2000); stepTo(running, 2000);
    assert(fingerprint(running) === fingerprint(reference), 'R48: tras los rechazos la carrera sigue igual que si no se hubiera intentado cargar');
  });

  await test('R48: migración de guardados v1', () => {
    assert(snap.SNAPSHOT_VERSION === 2 && fixture.verde.version === 1 && fixture.safetyCar.version === 1, 'R48: esquema actual v2 y fixture v1');
    for (const key of ['verde', 'safetyCar']) {
      const migrated = snap.migrateSnapshot(structuredClone(fixture[key]));
      assert(migrated.snapshot && migrated.errors.length === 0 && migrated.snapshot.version === snap.SNAPSHOT_VERSION, `R48: el guardado v1 «${key}» se migra a la versión actual`, migrated.errors.join(' | '));
      assert(snap.validateSnapshot(migrated.snapshot).length === 0, `R48: el migrado «${key}» es válido`, snap.validateSnapshot(migrated.snapshot).join(' | '));
      const notes = migrated.diagnostics.join(' | ');
      assert(/versión 1/i.test(notes) && /sanciones/i.test(notes) && /agua/i.test(notes) && /goma/i.test(notes), `R48: el diagnóstico de «${key}» dice qué se reinicia`, notes);
      const sim = new RaceSimulation('monza');
      const outcome = snap.restoreSnapshot(sim, JSON.stringify(fixture[key]));
      assert(outcome.ok && outcome.diagnostics.length > 0, `R48: el guardado v1 «${key}» se carga avisando`, outcome.errors.join(' | '));
      assert(sim.circuitId === 'barcelona' && sim.cars.length === 3 && sim.raceTimeSec === fixture[key].clock.raceTimeSec && sim.fixedStepCount === fixture[key].clock.fixedStepCount,
        `R48: «${key}» conserva circuito, coches y reloj`);
      const progress = sim.cars.map(c => c.progress);
      stepTo(sim, sim.fixedStepCount + 1500);
      assert(sim.cars.every((c, i) => c.progress > progress[i] && Number.isFinite(c.progress) && Number.isFinite(c.currentSpeedKmh)), `R48: la carrera v1 «${key}» continúa`);
      if (key === 'safetyCar') assert(fixture[key].state.safetyCar.isDeployed && sim.raceFlagState !== 'red', 'R48: el Safety Car del guardado v1 sigue su procedimiento', sim.raceFlagState);
    }
    const withVsc = structuredClone(fixture.verde); withVsc.state.flags.vscActive = true; withVsc.state.flags.raceFlagState = 'vsc';
    const withRed = structuredClone(fixture.verde); withRed.state.flags.raceFlagState = 'red';
    const vsc = snap.migrateSnapshot(withVsc), red = snap.migrateSnapshot(withRed);
    assert(vsc.snapshot === null && vsc.errors.some(e => /VSC/.test(e) && /versión 1/i.test(e)), 'R48: v1 con VSC en curso se rechaza con diagnóstico', vsc.errors.join(' | '));
    assert(red.snapshot === null && red.errors.some(e => /bandera roja/i.test(e) && /versión 1/i.test(e)), 'R48: v1 con bandera roja se rechaza con diagnóstico', red.errors.join(' | '));
    const future = snap.migrateSnapshot({ ...structuredClone(fixture.verde), version: 99 });
    assert(future.snapshot === null && future.errors.some(e => /99/.test(e) && /1/.test(e) && /2/.test(e)), 'R48: versión futura rechazada nombrando la recibida y las que se leen', future.errors.join(' | '));
    const current = snap.migrateSnapshot(snap.createSnapshot(seeded(2)));
    assert(current.snapshot && current.diagnostics.length === 0, 'R48: un guardado de la versión actual no se migra ni avisa');
  });

  // ── Ranuras ──
  const memoryStorage = (limitChars = Infinity) => {
    const data = new Map();
    const used = skip => [...data].reduce((sum, [key, value]) => sum + (key === skip ? 0 : key.length + value.length), 0);
    return {
      data,
      getItem: key => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => {
        if (used(key) + key.length + String(value).length > limitChars) { const error = new Error('QuotaExceededError'); error.name = 'QuotaExceededError'; throw error; }
        data.set(key, String(value));
      },
      removeItem: key => { data.delete(key); },
    };
  };
  const career = () => ({
    championship: { version: 1, races: [{ id: 'gp_1', circuitId: 'barcelona', format: 'gp', rows: [{ driverCode: 'ALO', driverName: 'Fernando Alonso', teamId: 'aston_martin', teamName: 'Aston Martin', position: 1, points: 25 }] }] },
    development: { version: 1, attributes: { alonso: { overtake: 91, defence: 95 } }, focus: { alonso: 'lluvia' }, lastGains: { alonso: { overtake: 0.4 } }, races: 1 },
    components: { version: 1, race: 1, units: [{ driverId: 'alonso', type: 'ICE', serial: 'ALO-ICE-1', races: 1, km: 307.2, fitted: true }], history: [{ driverId: 'alonso', type: 'ICE', serial: 'ALO-ICE-5', places: 10, race: 0 }] },
    program: { version: 1, catalog: '2026.1', teams: { aston_martin: { projects: [{ id: 'p1', key: 'suelo', startRace: 0, readyRace: 3 }], installed: [{ key: 'alerones', firstDriverId: 'alonso', fromRace: 0 }] } } },
    archive: [{ season: 1, races: 24, champion: 'VER', constructorsChampion: 'McLaren' }],
    history: [{ id: 'gp_1', dateFormatted: '07 oct, 12:00', trackName: 'Barcelona', winnerName: 'Fernando Alonso', winnerTeam: 'Aston Martin', winnerTeamColor: '#229971', p2Name: 'A', p3Name: 'B', userDriverName: 'Fernando Alonso', userDriverPos: 1, winnerStrategy: 'MEDIUM ➔ HARD', totalRaceTime: '01:27:10' }],
  });
  const selection = { driverId: 'alonso', circuitId: 'monza', raceFormat: 'clasificacion', weatherScenarioId: 'tormenta', luckVariant: false };
  const raceSnapshot = () => { const sim = seeded(4); stepTo(sim, 600); return snap.createSnapshot(sim); };

  await test('R48: ranuras con nombre, autoguardado y almacenamiento lleno', () => {
    const storage = memoryStorage();
    const store = new saves.SaveStore(storage);
    assert(store.list().length === 0, 'R48: sin partidas al empezar');
    const plain = saves.createSave({ name: '  Temporada 1 ', savedAt: '2026-10-07T10:00:00.000Z', career: career(), selection, race: null });
    const racing = saves.createSave({ name: 'Con carrera', savedAt: '2026-10-07T11:30:00.000Z', career: career(), selection, race: raceSnapshot() });
    assert(plain.name === 'Temporada 1' && plain.schema === saves.SAVE_SCHEMA && plain.version === saves.SAVE_VERSION, 'R48: la partida declara esquema, versión y nombre limpio');
    assert(store.save(plain).ok && store.save(racing).ok, 'R48: se guardan dos ranuras');
    const list = store.list();
    assert(list.length === 2 && list[0].name === 'Con carrera' && list[1].name === 'Temporada 1', 'R48: listado con la más reciente primero', list.map(s => s.name).join());
    assert(list[1].raceNumber === 2 && list[1].raceInProgress === null && list[1].savedAt === '2026-10-07T10:00:00.000Z' && list[1].auto === false, 'R48: resumen sin carrera en curso', JSON.stringify(list[1]));
    const progress = list[0].raceInProgress;
    assert(progress && progress.circuitId === 'barcelona' && progress.totalLaps === 100 && progress.lap === racing.race.state.flags.leaderLap, 'R48: resumen con la carrera en curso (circuito y vuelta)', JSON.stringify(progress));

    const loaded = store.load(list[0].id);
    assert(loaded.save && loaded.errors.length === 0 && JSON.stringify(loaded.save) === JSON.stringify(racing), 'R48: la ranura cargada es la guardada, con su carrera', loaded.errors.join(' | '));
    const sim = new RaceSimulation('barcelona');
    assert(snap.restoreSnapshot(sim, loaded.save.race).ok && sim.cars.length === 4, 'R48: la carrera de la ranura se puede continuar');
    const back = store.load(list[1].id).save;
    for (const part of ['championship', 'development', 'components', 'program', 'archive', 'history']) {
      assert(JSON.stringify(back.career[part]) === JSON.stringify(career()[part]), `R48: la carrera profesional vuelve idéntica (${part})`);
    }
    assert(JSON.stringify(back.selection) === JSON.stringify(selection), 'R48: vuelve la selección de piloto, circuito, formato, meteorología y variante');

    const next = career(); next.championship.races.push({ ...next.championship.races[0], id: 'gp_2' });
    assert(store.save(saves.createSave({ name: 'Temporada 1', savedAt: '2026-10-07T12:00:00.000Z', career: next, selection, race: null })).ok, 'R48: sobrescribir una ranura');
    assert(store.list().length === 2 && store.list()[0].name === 'Temporada 1' && store.list()[0].raceNumber === 3, 'R48: la ranura sobrescrita no se duplica y pasa a ser la más reciente');
    for (const name of ['', '   ']) {
      const outcome = store.save(saves.createSave({ name, savedAt: '2026-10-07T12:05:00.000Z', career: career(), selection, race: null }));
      assert(!outcome.ok && /nombre/i.test(outcome.error), 'R48: el nombre vacío se rechaza', outcome.error);
    }
    assert(store.list().length === 2, 'R48: un guardado rechazado no crea ranura');

    assert(store.save(saves.createSave({ name: 'x', savedAt: '2026-10-07T12:10:00.000Z', career: career(), selection, race: raceSnapshot() }), { auto: true }).ok, 'R48: autoguardado');
    assert(store.save(saves.createSave({ name: 'y', savedAt: '2026-10-07T12:11:00.000Z', career: career(), selection, race: raceSnapshot() }), { auto: true }).ok, 'R48: autoguardado repetido');
    const withAuto = store.list();
    assert(withAuto.length === 3 && withAuto.filter(s => s.auto).length === 1 && withAuto[0].auto && withAuto[0].id === saves.AUTOSAVE_ID && withAuto[0].raceInProgress !== null,
      'R48: una sola ranura automática, aparte de las manuales', withAuto.map(s => `${s.name}:${s.auto}`).join());
    store.remove(saves.AUTOSAVE_ID);
    const manual = store.list().find(s => s.name === 'Con carrera');
    store.remove(manual.id);
    assert(store.list().length === 1 && store.list()[0].name === 'Temporada 1', 'R48: borrar ranuras');
    const gone = store.load(manual.id);
    assert(gone.save === null && gone.errors.length > 0, 'R48: cargar una ranura borrada da diagnóstico', gone.errors.join(' | '));

    // Almacenamiento lleno: cabe la partida pequeña, no la que lleva carrera.
    const small = saves.createSave({ name: 'Pequeña', savedAt: '2026-10-07T13:00:00.000Z', career: career(), selection, race: null });
    const tight = memoryStorage(JSON.stringify(small).length + 2000);
    const tightStore = new saves.SaveStore(tight);
    assert(tightStore.save(small).ok, 'R48: la partida pequeña cabe');
    const big = tightStore.save(saves.createSave({ name: 'Grande', savedAt: '2026-10-07T13:05:00.000Z', career: career(), selection, race: raceSnapshot() }));
    assert(!big.ok && /espacio/i.test(big.error), 'R48: sin espacio, el guardado falla con diagnóstico', big.error);
    const overwrite = tightStore.save(saves.createSave({ name: 'Pequeña', savedAt: '2026-10-07T13:06:00.000Z', career: career(), selection, race: raceSnapshot() }));
    assert(!overwrite.ok, 'R48: tampoco cabe al sobrescribir');
    const kept = tightStore.list();
    assert(kept.length === 1 && kept[0].name === 'Pequeña' && kept[0].savedAt === '2026-10-07T13:00:00.000Z'
      && JSON.stringify(tightStore.load(kept[0].id).save) === JSON.stringify(small), 'R48: la partida que había sigue intacta tras los fallos');
  });

  await test('R48: exportar e importar una partida', () => {
    const save = saves.createSave({ name: 'Para exportar', savedAt: '2026-10-07T10:00:00.000Z', career: career(), selection, race: raceSnapshot() });
    const text = saves.exportSave(save);
    const imported = saves.importSave(text);
    assert(typeof text === 'string' && imported.save && imported.errors.length === 0 && JSON.stringify(imported.save) === JSON.stringify(save), 'R48: exportar → importar devuelve la misma partida', imported.errors.join(' | '));
    const old = saves.importSave(JSON.stringify({ ...save, race: fixture.verde }));
    assert(old.save && old.save.race.version === snap.SNAPSHOT_VERSION && old.diagnostics.length > 0, 'R48: una partida con carrera v1 se importa migrada y avisando', old.errors.join(' | '));
    const bad = {
      'texto que no es JSON': 'hola',
      'otro tipo de archivo': JSON.stringify({ schema: 'otra-cosa', version: 1 }),
      'versión futura de partida': JSON.stringify({ ...save, version: 99 }),
      'sin campeonato': JSON.stringify({ ...save, career: { ...save.career, championship: undefined } }),
      'carrera ilegible': JSON.stringify({ ...save, race: { ...save.race, state: { ...save.race.state, cars: [] } } }),
    };
    for (const [label, input] of Object.entries(bad)) {
      const outcome = saves.importSave(input);
      assert(outcome.save === null && outcome.errors.length > 0, `R48: importar «${label}» se rechaza con diagnóstico`, outcome.errors.join(' | '));
    }
  });

  await test('R48: panel de partidas y guardar desde el menú de carrera', async () => {
    const { SaveGamePanel } = await server.ssrLoadModule('/src/components/SaveGamePanel.tsx');
    const { RaceMenu } = await server.ssrLoadModule('/src/components/RaceMenu.tsx');
    const store = new saves.SaveStore(memoryStorage());
    store.save(saves.createSave({ name: 'Temporada 1', savedAt: '2026-10-07T10:00:00.000Z', career: career(), selection, race: null }));
    store.save(saves.createSave({ name: 'auto', savedAt: '2026-10-07T11:30:00.000Z', career: career(), selection, race: raceSnapshot() }), { auto: true });
    const noop = () => {};
    const html = renderToStaticMarkup(createElement(SaveGamePanel, { slots: store.list(), currentName: 'Temporada 1', onSave: noop, onLoad: noop, onExport: noop, onImport: noop, onDelete: noop }));
    assert(html.includes('Partidas') && html.includes('Temporada 1') && html.includes('Autoguardado') && /07\/10\/2026/.test(html), 'R48: el panel lista las ranuras con nombre y fecha');
    assert(/Carrera 2 de 24/.test(html) && /Carrera en curso/i.test(html) && /Barcelona/i.test(html) && /vuelta \d+ de 100/i.test(html), 'R48: cada ranura dice la carrera del calendario y la carrera en curso');
    for (const action of ['Guardar', 'Cargar', 'Continuar carrera', 'Exportar', 'Importar', 'Borrar']) {
      assert(html.includes(action), `R48: el panel ofrece «${action}»`);
    }
    const menu = renderToStaticMarkup(createElement(RaceMenu, { safetyCarDeployed: false, onToggleSafetyCarTest: noop, onRedFlagTest: noop, defaultOpen: true, onSaveGame: noop, saveName: 'Temporada 1' }));
    assert(menu.includes('Guardar partida') && menu.includes('Temporada 1'), 'R48: el menú de carrera ofrece guardar la partida con su nombre');
  });
}
