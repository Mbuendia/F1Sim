// ES2 — Pérdida en boxes calibrada con la realidad (Sprint 16). Contrato aprobado por el usuario el 20/11/2026 («Sí,
// adelante»):
//  1. En los 23 circuitos, la pérdida del motor en verde queda a menos de 1 s de la cifra real de la ficha.
//     [Excepción autorizada por el usuario el 20/11/2026 («Excepción documentada»)] Yas Marina se queda corta aun con todo
//     el carril limitado (la salida por el túnel se hace a fondo): se le pide quedar a menos de 2 s y no pasar de la real.
//  2. Con VSC la pérdida es menor que en verde, y con SC menor aún, en todos los circuitos.
//  3. Las líneas del limitador del pit lane son las mismas que usa el motor (el juego no dibuja las líneas: se comprueba
//     que el motor, la cuenta de la pérdida y el dibujo de la zona de trabajo salen de pitLaneZones, y que la zona de
//     trabajo queda dentro del tramo limitado).
//  4. La ficha, el muro y el estratega usan la misma cifra, la del motor.
//  5. Un documento explica la calibración y cómo volver a lanzarla.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const data = JSON.parse(readFileSync('src/data/pitLaneCalibration.json', 'utf8'));
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const { pitLaneZones } = await server.ssrLoadModule('/src/utils/pitLaneZones.ts');
  const P = await server.ssrLoadModule('/src/data/pitLoss.ts');
  const F = await server.ssrLoadModule('/src/freeRace/freeRace.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const sims = Object.fromEntries(ids.map(id => [id, new RaceSimulation(id)]));
  const loss = (id, cap) => RejoinModel.pitLossSec(sims[id].activeTrack, sims[id].cars[0], cap, RejoinModel.MEAN_SERVICE_SEC);

  await test('ES2.1: la pérdida en verde cuadra con la real', () => {
    const rows = ids.map(id => ({ id, motor: Math.round(loss(id, null) * 10) / 10, real: OFFICIAL_CIRCUITS[id].pitLaneTimeLossSec, guardada: data[id]?.lossSec }));
    const EXCEPTIONS = { 'yas-marina': 2 };
    const off = rows.filter(r => EXCEPTIONS[r.id] ? (r.real - r.motor > EXCEPTIONS[r.id] || r.motor > r.real + 1) : Math.abs(r.motor - r.real) > 1);
    const stale = rows.filter(r => r.guardada === undefined || Math.abs(r.motor - r.guardada) > 0.15);
    assert(off.length === 0 && stale.length === 0, 'ES2: en los 23 circuitos, la pérdida de parar en verde (servicio medio) del motor queda a menos de 1 s de la real de la ficha (Yas Marina, excepción documentada: a menos de 2 s por debajo), y coincide con la guardada (si no, hay que lanzar scripts/calibrate-pit-lane.mjs)',
      JSON.stringify({ fuera: off, desfasadas: stale.map(r => r.id) }));
  });

  await test('ES2.2: con VSC se pierde menos, y con Safety Car menos aún', () => {
    const bad = ids.filter(id => { const g = loss(id, null), v = loss(id, 160), s = loss(id, 120); return !(v < g - 1 && s < v - 1); });
    const saved = ids.filter(id => !(data[id]?.vscLossSec < data[id]?.lossSec && data[id]?.scLossSec < data[id]?.vscLossSec));
    assert(bad.length === 0 && saved.length === 0, 'ES2: en todos los circuitos, parar con VSC (160 km/h) cuesta más de 1 s menos que en verde, y con Safety Car (120 km/h) más de 1 s menos que con VSC',
      JSON.stringify({ bad, saved }));
  });

  await test('ES2.3: las mismas líneas del limitador para todo', () => {
    const same = ids.every(id => {
      const t = sims[id].activeTrack, z = pitLaneZones(t), lane = PitStopModel.laneLengthMeters(t), f = PitStopModel.limitFractions(lane, t);
      return f.start === z.limitStart && f.end === z.limitEnd && z.limitStart < z.serviceFrom && z.serviceTo < z.limitEnd && z.boxFrom >= z.serviceFrom && z.boxTo <= z.serviceTo;
    });
    const calibrated = ids.every(id => sims[id].activeTrack.pitLimitLineM === data[id]?.limitLineM);
    const rejoin = src('src/simulation/RejoinModel.ts');
    const pit = src('src/simulation/PitStopModel.ts');
    const sources = rejoin.includes('PitStopModel.limitFractions(laneMeters, track)') && rejoin.includes('PitStopModel.approachSpeed(')
      && pit.includes('this.approachSpeed(') && src('src/utils/pitLaneGeometry.ts').includes('pitLaneZones(track)');
    const speed = sims.monaco.activeTrack.pitSpeedKmh === 60 && PitStopModel.speedLimit(sims.monaco.activeTrack) === 60 && PitStopModel.speedLimit(sims.spa.activeTrack) === 80;
    assert(same && calibrated && sources && speed, 'ES2: en cada circuito, el motor, la cuenta de la pérdida y el dibujo usan las mismas líneas calibradas (pitLaneZones), con la zona de trabajo dentro del tramo limitado; Mónaco a 60 km/h',
      JSON.stringify({ same, calibrated, sources, speed }));
  });

  await test('ES2.4: una sola cifra en la ficha, el muro y el plan', () => {
    const card = ids.every(id => F.circuitCard(OFFICIAL_CIRCUITS[id]).pitLossSec === data[id].lossSec && P.pitLossFor(id)?.lossSec === data[id].lossSec);
    const sheet = src('src/components/CircuitSheet.tsx').includes("['Paso por el pit lane', `${info.pitLossSec.toLocaleString('es-ES')} s`]");
    const home = (src('src/components/HomeScreen.tsx').match(/pitLossSecFor\(inspectedCircuit\.id/g) ?? []).length === 2 && !/Límite: 80 km\/h/.test(src('src/components/HomeScreen.tsx'));
    const wall = src('src/simulation/race/wall.ts');
    const live = wall.includes('const pitLossSec = RejoinModel.pitLossSec(sim.activeTrack, car, capKmh, serviceSec);') && wall.includes('const cardLoss = pitLossSecFor(sim.circuitId');
    assert(card && sheet && home && live, 'ES2: la ficha del circuito, la pantalla de inicio, la carrera libre y el muro enseñan la pérdida que mide el motor; el muro y el estratega la calculan con el mismo modelo',
      JSON.stringify({ card, sheet, home, live }));
  });

  await test('ES2.5: documento de la calibración', () => {
    const doc = existsSync('docs/es2-boxes.md') ? src('docs/es2-boxes.md') : '';
    const ok = ['Barcelona', 'Mónaco', 'Silverstone'].every(n => doc.includes(n)) && /scripts\/calibrate-pit-lane\.mjs/.test(doc);
    assert(ok, 'ES2: docs/es2-boxes.md explica la calibración (Barcelona, Mónaco, Silverstone) y cómo volver a lanzarla', String(ok));
  });
}
