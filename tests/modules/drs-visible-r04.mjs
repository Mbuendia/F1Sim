// R04 — Integración y lectura visual del DRS (contrato aprobado por el usuario el 07/10/2026).
//  1. Por el motor, cada escenario de Q19 deja un estado visible (sin permiso, permiso obtenido, abierto o bloqueado)
//     con su motivo, el rival y el hueco medido en la detección.
//  2. Contador real de usos: una vez por apertura y nunca fuera de zona.
//  3. Flap: abre y cierra en menos de 0,4 s según el estado real.
//  4. La pista dibuja el punto de detección y el tramo de activación de cada zona.
//  5. El panel del coche muestra estado, motivo, hueco detectado y usos.
//  6. Lo nuevo se guarda y se carga; las partidas antiguas siguen cargando.
//  7. Los tiempos por vuelta no cambian: lo comprueba el banco de la suite, sin regenerar su referencia.
//  8. Revisión en el navegador de un adelantamiento antes y después de la detección (manual; en el dashboard).
// Decisiones del usuario: la transición del flap solo se ve (la física no cambia); la función antigua `evaluateDRS`
// se quita y queda una sola implementación (la de Q19).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const drs = await server.ssrLoadModule('/src/simulation/DRSModel.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const markers = await server.ssrLoadModule('/src/renderer/drsMarkers.ts');
  const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { buildWeatherScenario } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/snapshot-v1.json', import.meta.url), 'utf8'));
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const frac = x => ((x % 1) + 1) % 1;

  // Pista plana sintética (como en los casos de Q19): sin frenadas, con las zonas y la detección indicadas.
  const synthetic = (sim, { detectionT, zones, braking = [] }) => {
    const pts = sim.activeTrack.points, n = pts.length;
    const within = (t, [a, b]) => (a <= b ? t >= a && t < b : t >= a || t < b);
    pts.forEach((p, i) => {
      const t = i / n, zone = zones.findIndex(range => within(t, range));
      Object.assign(p, {
        isBrakingZone: braking.some(range => within(t, range)), speedLimitFactor: 1, idealLineOffset: 0,
        isDrsZone: zone >= 0, drsZoneId: zone >= 0 ? zone + 1 : undefined,
      });
    });
    sim.activeTrack.drsDetections = [{ id: 'SYN', t: detectionT, zoneIds: zones.map((_, i) => i + 1), source: 'calibrated' }];
  };
  // Dos coches iguales a 300 km/h: el de delante cruza la detección primero y el perseguidor `gapSec` después.
  const pair = (sim, detectionT, gapSec, { lapped = false, lap = 3 } = {}) => {
    const [ahead, chaser] = sim.cars, L = sim.activeTrack.lapLengthMeters, v = 300;
    chaser.team = structuredClone(ahead.team); chaser.driver = { ...structuredClone(ahead.driver), id: 'chaser', code: 'CHS' };
    const aheadOnTrack = lap + frac(detectionT - 0.003);
    const chaserP = aheadOnTrack - gapSec * (v / 3.6) / L;
    const aheadP = aheadOnTrack - (lapped ? 1 : 0);
    for (const [c, p, l] of [[chaser, chaserP, lap], [ahead, aheadP, lapped ? lap - 1 : lap]]) {
      Object.assign(c, { progress: p, trackT: frac(p), currentLap: l, currentSpeedKmh: v });
    }
    ahead.currentPosition = lapped ? 2 : 1; chaser.currentPosition = lapped ? 1 : 2;
    return { ahead, chaser };
  };
  /** Avanza y devuelve lo que se vio del coche en cada tramo de la vuelta. */
  const watch = (sim, car, seconds, onStep = () => {}) => {
    const seen = [], end = sim.raceTimeSec + seconds;
    while (sim.raceTimeSec < end) {
      sim.update(0.02);
      onStep();
      seen.push({ t: frac(car.progress), open: car.drsActive, uses: car.drsUses, status: car.drsStatus && { ...car.drsStatus }, changedAt: car.drsChangedAt, time: sim.raceTimeSec });
    }
    return seen;
  };
  const between = (seen, a, b) => seen.filter(s => s.t >= a && s.t < b);
  const states = list => [...new Set(list.map(s => s.status?.state))].join('+');

  await fixedRandom(0.99, async () => {
    await test('R04: a menos de 1 s en la detección: permiso obtenido y apertura en su zona', () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const { ahead, chaser } = pair(sim, 0.2, 0.8);
      const first = watch(sim, chaser, 0.1);
      assert(first.every(s => s.status?.state === 'sin-permiso' && s.status.gapSec === null && /detección/i.test(s.status.reason)),
        'R04: antes de pasar por la detección no hay permiso y se dice por qué', JSON.stringify(first.at(-1)?.status));
      let rival = null;
      const seen = watch(sim, chaser, 22, () => { if (!rival && frac(chaser.progress) > 0.215) rival = { ...ahead.drsStatus }; });
      const granted = between(seen, 0.21, 0.245), zone = between(seen, 0.26, 0.44);
      assert(granted.length > 0 && states(granted) === 'permiso', 'R04: tras la detección, permiso obtenido antes de llegar a la zona', states(granted));
      const reading = granted[0].status;
      assert(reading.gapSec > 0.5 && reading.gapSec < 1 && reading.aheadCarId === ahead.id && reading.detectionId === 'SYN' && reading.zoneId === 1,
        'R04: el permiso guarda el hueco medido, el rival y la detección', JSON.stringify(reading));
      assert(reading.reason.includes(ahead.driver.code) && reading.reason.includes(reading.gapSec.toFixed(2).replace('.', ',')), 'R04: el motivo nombra al rival y el hueco medido', reading.reason);
      assert(zone.length > 0 && states(zone) === 'abierto' && zone.every(s => s.open), 'R04: en la zona el estado es abierto', states(zone));
      assert(chaser.drsUses === 1 && seen.some(s => s.uses === 0), 'R04: la apertura cuenta un uso', String(chaser.drsUses));
      const after = between(seen, 0.46, 0.6);
      assert(after.length > 0 && after.every(s => !s.open && s.status.state === 'sin-permiso' && /próxima detección/.test(s.status.reason) && s.status.gapSec === null) && chaser.drsUses === 1,
        'R04: al salir de la zona se cierra, no se cuenta otro uso y queda a la espera de la próxima detección', JSON.stringify(after[0]?.status));
      assert(rival && rival.state === 'sin-permiso' && rival.gapSec === null && /sin coche delante/i.test(rival.reason) && (ahead.drsUses ?? 0) === 0,
        'R04: el coche sin nadie delante en la detección no tiene permiso', JSON.stringify(rival));
    });

    await test('R04: a 1 s o más: sin permiso, con el hueco medido', () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const { ahead, chaser } = pair(sim, 0.2, 1.2);
      const seen = watch(sim, chaser, 14);
      const after = between(seen, 0.21, 0.44);
      assert(after.length > 0 && states(after) === 'sin-permiso' && after.every(s => !s.open), 'R04: detectado a más de 1 s no hay permiso ni apertura', states(after));
      const reading = after[0].status;
      assert(reading.gapSec >= 1 && reading.gapSec < 1.6 && reading.aheadCarId === ahead.id && reading.reason.includes(ahead.driver.code) && /menos de 1/.test(reading.reason),
        'R04: se enseña el hueco medido, el rival y el umbral', JSON.stringify(reading));
      assert((chaser.drsUses ?? 0) === 0, 'R04: sin permiso no hay usos');
    });

    await test('R04: el permiso persiste aunque cambie el hueco después de la detección', () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const { ahead, chaser } = pair(sim, 0.2, 0.8);
      let moved = false;
      const seen = watch(sim, chaser, 14, () => {
        if (!moved && frac(chaser.progress) > 0.21) { moved = true; ahead.progress += 0.05; ahead.trackT = frac(ahead.progress); }
      });
      const zone = between(seen, 0.26, 0.44);
      assert(moved && zone.length > 0 && states(zone) === 'abierto' && zone.every(s => s.status.gapSec < 1), 'R04: con el rival ya lejos, el permiso de la detección sigue valiendo', states(zone));
    });

    await test('R04: la primera frenada cierra el flap y no se reabre en esa zona', () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0.2, zones: [[0.25, 0.45]], braking: [[0.33, 0.35]] });
      const { chaser } = pair(sim, 0.2, 0.8);
      const seen = watch(sim, chaser, 14);
      const before = between(seen, 0.26, 0.325), rest = between(seen, 0.355, 0.44);
      assert(before.length > 0 && states(before) === 'abierto', 'R04 (preparación): abre antes de la frenada', states(before));
      assert(rest.length > 0 && rest.every(s => !s.open) && states(rest) === 'sin-permiso' && rest.every(s => /frenada/i.test(s.status.reason)),
        'R04: tras la frenada queda cerrado hasta el final de la zona, con su motivo', `${states(rest)} · ${rest[0]?.status?.reason}`);
      assert(chaser.drsUses === 1, 'R04: una apertura, un uso', String(chaser.drsUses));
    });

    await test('R04: bloqueos de Dirección de Carrera con su motivo', () => {
      // Primera vuelta.
      const lapOne = make('barcelona', 2);
      synthetic(lapOne, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const first = pair(lapOne, 0.2, 0.8, { lap: 1 });
      const seen = watch(lapOne, first.chaser, 12);
      const zone = between(seen, 0.26, 0.44);
      assert(zone.length > 0 && states(zone) === 'bloqueado' && zone.every(s => !s.open && /primera vuelta/i.test(s.status.reason)) && (first.chaser.drsUses ?? 0) === 0,
        'R04: en la primera vuelta el DRS está bloqueado aunque el hueco sea menor de 1 s', `${states(zone)} · ${zone[0]?.status?.reason}`);
      assert(zone.every(s => s.status.gapSec > 0.5 && s.status.gapSec < 1), 'R04: el hueco medido se sigue enseñando estando bloqueado');

      // Banderas y neutralizaciones: un paso con la bandera puesta.
      for (const [flag, expected] of [['sc', /Safety Car/], ['vsc', /Virtual Safety Car/], ['red', /roja/i]]) {
        const sim = make('barcelona', 2);
        synthetic(sim, { detectionT: 0.2, zones: [[0, 1]] });
        const car = sim.cars[0];
        Object.assign(car, { currentLap: 3, progress: 3.3, trackT: 0.3 });
        sim.raceFlagState = flag; car.drsActive = true;
        sim.update(0.001);
        assert(!car.drsActive && car.drsStatus.state === 'bloqueado' && expected.test(car.drsStatus.reason), `R04: bloqueado bajo ${flag}, con su motivo`, JSON.stringify(car.drsStatus));
      }

      // Espera tras el Safety Car.
      const waiting = make('barcelona', 2);
      synthetic(waiting, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const held = pair(waiting, 0.2, 0.8);
      waiting.drsDisabledLaps = 1;
      const heldZone = between(watch(waiting, held.chaser, 12), 0.26, 0.44);
      assert(heldZone.length > 0 && states(heldZone) === 'bloqueado' && heldZone.every(s => !s.open && /Safety Car/.test(s.status.reason) && /vuelta/.test(s.status.reason)),
        'R04: bloqueado durante la espera tras el Safety Car', `${states(heldZone)} · ${heldZone[0]?.status?.reason}`);

      // Pista mojada.
      const wet = make('barcelona', 2);
      wet.setWeatherScenario(buildWeatherScenario('mojado-inicial', 3000));
      for (let i = 0; i < 6000 && !wet.weatherDrsBlocked(); i++) wet.update(0.05);
      assert(wet.weatherDrsBlocked(), 'R04 (preparación): pista mojada, Dirección de Carrera desactiva el DRS');
      synthetic(wet, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const soaked = pair(wet, 0.2, 0.8);
      const wetSeen = watch(wet, soaked.chaser, 6);
      assert(wetSeen.every(s => !s.open) && wetSeen.at(-1).status.state === 'bloqueado' && /mojada|visibilidad/i.test(wetSeen.at(-1).status.reason),
        'R04: bloqueado con pista mojada, con su motivo', JSON.stringify(wetSeen.at(-1).status));
    });

    await test('R04: doblado por delante y detección compartida por dos zonas', () => {
      const lapping = make('barcelona', 2);
      synthetic(lapping, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const { ahead: lapped, chaser: leader } = pair(lapping, 0.2, 0.8, { lapped: true });
      const seen = watch(lapping, leader, 12);
      const granted = between(seen, 0.21, 0.245);
      assert(granted.length > 0 && states(granted) === 'permiso' && granted[0].status.aheadCarId === lapped.id && leader.drsUses === 1,
        'R04: el líder a menos de 1 s de un doblado obtiene permiso y lo usa', JSON.stringify(granted[0]?.status));

      const shared = make('barcelona', 2);
      synthetic(shared, { detectionT: 0.2, zones: [[0.25, 0.33], [0.4, 0.5]] });
      const { chaser } = pair(shared, 0.2, 0.8);
      const both = watch(shared, chaser, 18);
      const one = between(both, 0.26, 0.32), gap = between(both, 0.34, 0.39), two = between(both, 0.41, 0.49);
      assert(states(one) === 'abierto' && one.every(s => s.status.zoneId === 1), 'R04: abre en la primera zona de la detección', states(one));
      assert(gap.length > 0 && gap.every(s => !s.open) && states(gap) === 'permiso', 'R04: entre las dos zonas conserva el permiso', states(gap));
      assert(states(two) === 'abierto' && two.every(s => s.status.zoneId === 2) && chaser.drsUses === 2, 'R04: abre también en la segunda zona y cuenta dos usos', `${states(two)} · ${chaser.drsUses}`);
    });

    await test('R04: umbral estricto de 1 s medido en la detección', () => {
      for (const gap of [0.999, 1, 1.001]) {
        const sim = make('barcelona', 2), [ahead, chaser] = sim.cars;
        synthetic(sim, { detectionT: 0.9, zones: [[0, 0.8]] });
        // Cruces exactos de una detección: el de delante en t = 10 s y el perseguidor `gap` segundos después.
        const detection = [{ id: 'UMBRAL', t: 0.25, zoneIds: [1], source: 'calibrated' }];
        sim.drsPermissions.record([{ id: ahead.id, from: 0.125, to: 0.375, onTrack: true }], detection, 9.5, 1);
        sim.drsPermissions.record([{ id: chaser.id, from: 0.125, to: 0.375, onTrack: true }], detection, 9.5 + gap, 1);
        Object.assign(chaser, { currentLap: 3, progress: 3.3, trackT: 0.3, currentSpeedKmh: 300 });
        sim.update(0.001);
        assert(chaser.drsActive === (gap < 1) && chaser.drsStatus.state === (gap < 1 ? 'abierto' : 'sin-permiso') && Math.abs(chaser.drsStatus.gapSec - gap) < 1e-9,
          `R04: el motor aplica el umbral estricto a ${gap} s`, JSON.stringify(chaser.drsStatus));
      }
    });
  });

  await test('R04: contador real de usos en carrera, nunca fuera de zona', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = new RaceSimulation('barcelona');
      sim.lightState = 'racing'; sim.isPaused = false;
      const openings = new Map(sim.cars.map(car => [car.id, 0])), wasOpen = new Map();
      let outside = 0, withReason = true;
      for (let step = 0; step < 20000 && sim.cars[0].currentLap < 5; step++) {
        sim.update(0.05);
        for (const car of sim.cars) {
          if (car.drsActive && !wasOpen.get(car.id)) openings.set(car.id, openings.get(car.id) + 1);
          wasOpen.set(car.id, car.drsActive);
          const n = sim.activeTrack.points.length, point = sim.activeTrack.points[Math.floor(car.trackT * n) % n];
          if (car.drsActive && !point.isDrsZone) outside++;
          withReason &&= Boolean(car.drsStatus && car.drsStatus.reason && ['sin-permiso', 'permiso', 'abierto', 'bloqueado'].includes(car.drsStatus.state))
            && (car.drsStatus.state === 'abierto') === car.drsActive;
        }
      }
      const total = [...openings.values()].reduce((a, b) => a + b, 0);
      assert(total > 0, 'R04 (preparación): en carrera real hay aperturas de DRS', String(total));
      assert(sim.cars.every(car => (car.drsUses ?? 0) === openings.get(car.id)), 'R04: el contador de cada coche coincide con sus aperturas reales',
        sim.cars.filter(car => (car.drsUses ?? 0) !== openings.get(car.id)).map(car => `${car.driver.code} ${car.drsUses}/${openings.get(car.id)}`).join(' · '));
      assert(sim.cars.every(car => car.stats.drsUses === (car.drsUses ?? 0)), 'R04: la telemetría lleva el mismo contador');
      assert(outside === 0, 'R04: el DRS nunca está abierto fuera de una zona', String(outside));
      assert(withReason, 'R04: en todo momento cada coche tiene estado y motivo, y «abierto» coincide con el flap');
    } finally { Math.random = originalRandom; }
  });

  await test('R04: el flap abre y cierra en menos de 0,4 s según el estado real', async () => {
    assert(drs.DRS_FLAP_SECONDS > 0 && drs.DRS_FLAP_SECONDS < 0.4, 'R04: transición menor de 0,4 s (T3.10.10)', String(drs.DRS_FLAP_SECONDS));
    const T = drs.DRS_FLAP_SECONDS;
    assert(drs.flapOpenness(true, 10, 10) === 0 && Math.abs(drs.flapOpenness(true, 10, 10 + T / 2) - 0.5) < 1e-9 && drs.flapOpenness(true, 10, 10 + T) === 1 && drs.flapOpenness(true, 10, 99) === 1,
      'R04: al abrir pasa de cerrado a abierto de forma progresiva');
    assert(drs.flapOpenness(false, 20, 20) === 1 && Math.abs(drs.flapOpenness(false, 20, 20 + T / 2) - 0.5) < 1e-9 && drs.flapOpenness(false, 20, 20 + T) === 0, 'R04: al cerrar, lo mismo al revés');
    assert(drs.flapOpenness(true, undefined, 5) === 1 && drs.flapOpenness(false, undefined, 5) === 0, 'R04: sin instante de cambio conocido, el flap está en su posición final');

    await fixedRandom(0.99, async () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0.2, zones: [[0.25, 0.45]] });
      const { chaser } = pair(sim, 0.2, 0.8);
      const seen = watch(sim, chaser, 14);
      const opened = seen.findIndex(s => s.open), closed = seen.findIndex((s, i) => i > opened && !s.open);
      assert(opened > 0 && closed > opened, 'R04 (preparación): el coche abre y cierra el DRS');
      assert(Math.abs(seen[opened].changedAt - seen[opened].time) < 0.021 && seen[closed - 1].changedAt === seen[opened].changedAt, 'R04: el motor anota el instante en que abre');
      assert(Math.abs(seen[closed].changedAt - seen[closed].time) < 0.021, 'R04: y el instante en que cierra');
    });

    // En pista: el verde del alerón aparece y desaparece con la transición.
    const car = new RaceSimulation('barcelona').cars[0];
    const greens = (drsActive, changedAt, now) => {
      const calls = [];
      const state = { fillStyle: '', globalAlpha: 1 };
      const ctx = new Proxy({}, {
        get: (_, key) => (key in state ? state[key] : (...args) => { if (['fillRect', 'roundRect', 'fill'].includes(key)) calls.push({ key, ...state, args }); }),
        set: (_, key, value) => { state[key] = value; return true; },
      });
      CarRenderer.drawSingleCar(ctx, 300, 200, 0, { ...car, status: 'running', drsActive, drsChangedAt: changedAt }, 3, false, CarRenderer.getCarDimensions(3, 12, 3), 1,
        { wetMm: 0, timeSec: now, distanceM: 0 });
      return calls.filter(call => call.fillStyle === '#00ff66').map(call => call.globalAlpha);
    };
    const mid = greens(true, 10, 10 + T / 2), full = greens(true, 10, 10 + T), start = greens(true, 10, 10), closing = greens(false, 10, 10 + T / 2), shut = greens(false, 10, 10 + T);
    assert(mid.length > 0 && mid.every(alpha => Math.abs(alpha - 0.5) < 0.01), 'R04: a media transición el alerón se ve a medio abrir', mid.join());
    assert(full.length > 0 && full.every(alpha => alpha === 1) && start.every(alpha => alpha === 0), 'R04: abierto del todo al terminar la transición');
    assert(closing.length > 0 && closing.every(alpha => Math.abs(alpha - 0.5) < 0.01) && shut.length === 0, 'R04: al cerrar, el verde se va en el mismo tiempo');
  });

  await test('R04: la pista dibuja la detección y el tramo de activación de cada zona', () => {
    const track = new RaceSimulation('barcelona').activeTrack, n = track.points.length;
    const data = markers.drsMarkers(track);
    const zoneIds = [...new Set(track.points.filter(p => p.isDrsZone).map(p => p.drsZoneId))].sort();
    assert(data.zones.length === zoneIds.length && data.zones.map(z => z.id).sort().join() === zoneIds.join() && zoneIds.length >= 1, 'R04: un tramo por cada zona del circuito', JSON.stringify(data.zones.map(z => z.id)));
    assert(data.zones.every(zone => {
      const count = track.points.filter(p => p.drsZoneId === zone.id).length;
      const start = Math.round(zone.startT * n) % n, before = (start - 1 + n) % n;
      return zone.points.length === count && track.points[start].drsZoneId === zone.id && track.points[before].drsZoneId !== zone.id;
    }), 'R04: cada tramo recorre su zona entera desde donde empieza la activación');
    assert(data.detections.length === track.drsDetections.length && data.detections.every((d, i) => {
      const ref = track.drsDetections[i], p = track.points[Math.floor(ref.t * n) % n];
      return d.id === ref.id && d.t === ref.t && Math.hypot(d.x - p.x, d.y - p.y) < 30 && JSON.stringify(d.zoneIds) === JSON.stringify(ref.zoneIds);
    }), 'R04: un punto de detección por cada detección del circuito, en su sitio');

    // Zona que cruza la línea de meta: un solo tramo continuo.
    const wrapped = structuredClone(track);
    wrapped.points.forEach((p, i) => { const t = i / n, inside = t >= 0.95 || t < 0.06; p.isDrsZone = inside; p.drsZoneId = inside ? 1 : undefined; });
    const wrap = markers.drsMarkers(wrapped).zones;
    assert(wrap.length === 1 && wrap[0].startT > wrap[0].endT && wrap[0].points.length === wrapped.points.filter(p => p.isDrsZone).length, 'R04: una zona que cruza la meta es un solo tramo');

    const texts = [], strokes = [];
    const ctx = new Proxy({ measureText: text => ({ width: String(text).length * 6 }) }, {
      get: (target, key) => target[key] ?? ((...args) => { if (key === 'fillText') texts.push(args[0]); if (key === 'stroke') strokes.push(1); }),
      set: () => true,
    });
    const camera = { zoom: 2, rotation: 0, screenWidth: 4000, screenHeight: 4000, worldToScreen: (x, y) => ({ x: x * 2 + 2000, y: y * 2 + 2000 }) };
    TrackRenderer.renderDrsMarkers(ctx, track, camera);
    assert(data.zones.every(zone => texts.some(text => new RegExp(`DRS ${zone.id}\\b`).test(text))), 'R04: cada tramo de activación lleva su rótulo', texts.join(' | '));
    assert(texts.filter(text => /DETECCIÓN/.test(text)).length === data.detections.length, 'R04: cada punto de detección lleva su rótulo', texts.join(' | '));
    assert(strokes.length >= data.zones.length + data.detections.length, 'R04: tramos y detecciones se trazan sobre la pista');
    assert(/TrackRenderer\.renderDrsMarkers\(/.test(source('src/components/RaceCanvas.tsx')), 'R04: la carrera pinta las marcas de DRS sobre la pista');
  });

  await test('R04: el panel del coche muestra estado, motivo, hueco y usos', async () => {
    const { DrsStatusBadge } = await server.ssrLoadModule('/src/components/DrsStatusBadge.tsx');
    const render = props => renderToStaticMarkup(createElement(DrsStatusBadge, props));
    const base = { gapSec: 0.62, aheadCarId: 1, zoneId: 1, detectionId: 'D1' };
    const cases = [
      ['sin-permiso', 'Sin permiso', 'A 1,34 s de VER en la detección (hace falta menos de 1 s)'],
      ['permiso', 'Permiso obtenido', 'A 0,62 s de VER en la detección'],
      ['abierto', 'DRS abierto', 'A 0,62 s de VER en la detección'],
      ['bloqueado', 'Bloqueado', 'Safety Car'],
    ];
    for (const [state, label, reason] of cases) {
      const html = render({ status: { ...base, state, reason }, uses: 3 });
      assert(html.includes(label) && html.includes(reason) && html.includes(`data-drs-state="${state}"`) && /Usos: 3/.test(html), `R04: el panel muestra «${label}» con su motivo y los usos`, html);
    }
    const none = render({ status: undefined, uses: 0 });
    assert(/Sin permiso/.test(none) && /Usos: 0/.test(none), 'R04: sin estado aún, el panel no se rompe');
    assert(/DrsStatusBadge/.test(source('src/components/BottomTelemetryDock.tsx')), 'R04: el panel de detalle del coche usa esta lectura del DRS');
  });

  await test('R04: lo nuevo se guarda y se carga', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = make('barcelona', 6);
      sim.lightsRandomDelay = 1.2;
      sim.cars.forEach((c, i) => { c.raceDayLuckFactor = 0; c.progress = 2.2 - i * 0.004; c.trackT = frac(c.progress); });
      sim.setSeed(4); sim.setFixedStep(0.02);
      while (sim.fixedStepCount < 30000 && !(sim.cars.some(c => c.drsUses > 0) && sim.cars.some(c => c.drsActive))) sim.update(1 / 60);
      assert(sim.cars.some(c => c.drsUses > 0) && sim.cars.some(c => c.drsActive), 'R04 (preparación): carrera con DRS usado y un flap abierto');
      const text = JSON.stringify(snap.createSnapshot(sim));
      const target = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(target, text);
      assert(outcome.ok, 'R04: la carrera con el estado nuevo del DRS se carga', outcome.errors?.join(' · '));
      const view = s => JSON.stringify(s.cars.map(c => [c.id, c.drsActive, c.drsUses, c.drsChangedAt, c.drsStatus]));
      assert(view(target) === view(sim), 'R04: usos, instante de cambio, estado y motivo vuelven tal cual');
      assert(JSON.stringify(target.drsPermissions.serialize()) === JSON.stringify(sim.drsPermissions.serialize()), 'R04: los huecos medidos en las detecciones también');
      for (let i = 0; i < 1500; i++) { sim.update(1 / 60); target.update(1 / 60); }
      assert(view(target) === view(sim), 'R04: la carrera cargada sigue igual que la original');
    } finally { Math.random = originalRandom; }

    for (const key of ['verde', 'safetyCar']) {
      const old = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(old, JSON.stringify(fixture[key]));
      assert(outcome.ok, `R04: la partida antigua (${key}) sigue cargando`, outcome.errors?.join(' · '));
      for (let i = 0; i < 200; i++) old.update(1 / 60);
      assert(old.cars.every(c => Number.isInteger(c.drsUses) && c.drsStatus && typeof c.drsStatus.reason === 'string'), `R04: tras cargarla (${key}), cada coche tiene contador y estado de DRS`);
    }
  });

  await test('R04: una sola implementación del DRS', () => {
    const model = source('src/simulation/DRSModel.ts');
    assert(!/evaluateDRS|speedBoostMultiplier|class DRSModel/.test(model) && drs.DRSModel === undefined, 'R04: desaparece la función antigua con su multiplicador de velocidad');
    assert(typeof drs.DrsPermissions === 'function' && typeof drs.drsStatus === 'function' && typeof drs.flapOpenness === 'function', 'R04: el módulo del DRS ofrece permisos, estado visible y flap');
    const engine = source('src/simulation/RaceSimulation.ts');
    assert(/drsStatus\(/.test(engine) && /this\.drsPermissions\.reading\(/.test(engine), 'R04: el motor construye el estado visible con lo medido en la detección');
  });
}
