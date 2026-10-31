// CR2 (segunda parte) — Salida de boxes de Yas Marina (Sprint 10.5). Contrato acordado con el usuario el 31/10/2026
// (ficha de CR2 en DASHBOARD.md):
//  1. src/utils/pitLaneZones.ts: pitLaneZones(track) → { boxFrom, boxTo, limitStart, limitEnd } en fracciones del pit
//     lane, la única fuente para el motor y el dibujo. Yas Marina: cajones en la recta, hasta 110 m antes del cruce; fin del
//     limitador justo antes de la rampa de bajada y después del último cajón. Los demás, como siempre.
//  2. Motor: cada coche para delante de su cajón dibujado (3 m); 80 km/h hasta la nueva línea y aceleración después,
//     sin exceso de velocidad; el drive-through usa la misma línea.
//  3. Pérdida de la parada en Yas Marina: 33,66 s medidos antes del cambio (RejoinModel.pitLossSec, coche 0, servicio
//     medio, 31/10/2026); después, 5 s menos como mínimo, con la previsión usando la misma línea.
//  4. Nada más cambia: los demás circuitos con las zonas de siempre; misma semilla, misma carrera en Yas Marina.
//  5. Captura de los coches parados delante de su cajón.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { raceFactory } from '../support/race.mjs';

const LOSS_BEFORE_S = 33.66;
const SHOTS = 'docs/design/cr2-yas-tunel';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { PitStopModel } = await load('/src/simulation/PitStopModel.ts');
  const { RejoinModel } = await load('/src/simulation/RejoinModel.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const { calculateCarWorldPosition } = await load('/src/utils/carPosition.ts');
  const { TEAMS } = await load('/src/data/teams.ts');
  const has = existsSync('src/utils/pitLaneZones.ts');
  const Z = has ? await load('/src/utils/pitLaneZones.ts') : {};
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const track = new RaceSimulation('yas-marina').activeTrack;
  const laneM = PitStopModel.laneLengthMeters(track);
  const geo = getPitLaneGeometry(track), lane = geo.fastLane;
  const cum = [0]; for (let k = 1; k < lane.length; k++) cum.push(cum[k - 1] + Math.hypot(lane[k].x - lane[k - 1].x, lane[k].y - lane[k - 1].y));
  const axisDist = q => { let m = Infinity; for (const p of track.points) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)); return m; };
  let cross = -1; for (let k = Math.floor(lane.length * 0.3); k < Math.floor(lane.length * 0.9); k++) if (cross < 0 || axisDist(lane[k]) < axisDist(lane[cross])) cross = k;
  const frac = k => cum[k] / cum.at(-1);
  const zones = has ? Z.pitLaneZones(track) : null;

  await test('CR2-S.1: zonas del pit lane, una sola fuente', async () => {
    assert(has && typeof Z.pitLaneZones === 'function', 'CR2: existe src/utils/pitLaneZones.ts con pitLaneZones');
    if (!zones) return;
    const { pitTunnelFor } = await load('/src/scene3d/pitTunnel.ts');
    const rampStart = frac(pitTunnelFor('yas-marina').span[0]);
    assert(zones.boxTo <= frac(cross) - 110 / cum.at(-1) + 1e-9, 'CR2: en Yas Marina los cajones acaban 110 m antes del cruce', `cajones hasta ${(zones.boxTo * cum.at(-1)).toFixed(0)} m, cruce a ${cum[cross].toFixed(0)} m`);
    assert(zones.limitEnd > zones.boxTo && zones.limitEnd <= rampStart + 1e-9, 'CR2: el limitador acaba después del último cajón y antes de la rampa de bajada', `fin ${(zones.limitEnd * cum.at(-1)).toFixed(0)} m, rampa ${(rampStart * cum.at(-1)).toFixed(0)} m`);
    const changed = [];
    for (const id of ids.filter(i => i !== 'yas-marina')) {
      const t = new RaceSimulation(id).activeTrack, z = Z.pitLaneZones(t), f = Math.min(0.3, PitStopModel.LIMIT_LINE_M / Math.max(1, PitStopModel.laneLengthMeters(t)));
      if (Math.abs(z.boxFrom - 0.3) > 1e-9 || Math.abs(z.boxTo - 0.7) > 1e-9 || Math.abs(z.limitStart - f) > 1e-9 || Math.abs(z.limitEnd - (1 - f)) > 1e-9) changed.push(id);
    }
    assert(changed.length === 0, 'CR2: los demás circuitos, con las zonas de siempre', changed.join(', ') || 'ok');
    const src = ['src/simulation/PitStopModel.ts', 'src/utils/pitLaneGeometry.ts', 'src/simulation/RejoinModel.ts'].map(f => readFileSync(f, 'utf8'));
    assert(src.every(s => /pitLaneZones/.test(s)), 'CR2: el motor, el dibujo y la previsión leen pitLaneZones');
  });

  await test('CR2-S.2: el motor para delante del cajón y acelera tras la línea', () => {
    if (!zones) { assert(false, 'CR2: faltan las zonas'); return; }
    const teams = Object.keys(TEAMS), off = [];
    const len = RejoinModel.pitLaneLength(track);
    teams.forEach((teamId, i) => {
      const box = PitStopModel.getBoxProgress({ driver: { teamId } }, track);
      const p = calculateCarWorldPosition({ progress: track.pitEntryT + box * len, isInPitLane: true, lateralOffset: 0 }, track);
      const c = geo.boxes[i].center; let m = Infinity, bk = 0; lane.forEach((q, k) => { const d = Math.hypot(q.x - c.x, q.y - c.y); if (d < m) { m = d; bk = k; } });
      const d = Math.hypot(p.worldX - lane[bk].x, p.worldY - lane[bk].y);
      if (d > 3) off.push(`${teamId} a ${d.toFixed(1)} m`);
    });
    assert(off.length === 0, 'CR2: cada coche para delante de su cajón dibujado (3 m como mucho)', off.join(', ') || 'ok');
    assert(Math.abs(PitStopModel.limitFractions(laneM, track).end - zones.limitEnd) < 1e-9, 'CR2: el motor usa el nuevo fin del limitador');
    // Carrera corta: un coche entra a boxes y se mide la velocidad por el carril.
    const make = raceFactory(server);
    return make.then(factory => {
      const sim = factory('yas-marina', 1), car = sim.cars[0];
      car.progress = 1 + track.pitEntryT - 0.03; car.trackT = ((car.progress % 1) + 1) % 1;
      sim.setSeed(2025); sim.setFixedStep(0.02);
      sim.issueBoxOrder(car.id, 'hard');
      let after = 0, before = 0, stopped = false;
      for (let s = 0; s < 6000 && !(stopped && !car.isInPitLane && car.pitStop.totalPitStops > 0); s++) {
        sim.update(0.02);
        if (car.isInPitLane && car.currentSpeedKmh === 0) stopped = true;
        const lp = car.pitStop.pitLaneProgress ?? 0;
        if (car.isInPitLane && stopped && lp > zones.limitEnd + 0.03) after = Math.max(after, car.currentSpeedKmh);
        if (car.isInPitLane && stopped && lp > zones.boxTo && lp < zones.limitEnd - 0.01) before = Math.max(before, car.currentSpeedKmh);
      }
      const infractions = (car.pitStop.infractions ?? []).filter(x => x.type === 'exceso-velocidad');
      assert(stopped && before <= PitStopModel.PIT_SPEED_LIMIT_KMH + 0.5 && after > PitStopModel.PIT_SPEED_LIMIT_KMH + 20, 'CR2: a 80 km/h hasta la línea y acelerando después', `antes ${before.toFixed(0)} km/h, después ${after.toFixed(0)} km/h`);
      assert(infractions.length === 0, 'CR2: sin exceso de velocidad al pasar la línea', `${infractions.length}`);
      const pitSrc = readFileSync('src/simulation/PitStopModel.ts', 'utf8');
      assert(/limitFractions\(dtLaneMeters, [^)]+\)/.test(pitSrc), 'CR2: el drive-through usa la misma línea');
    });
  });

  await test('CR2-S.3: la parada cuesta menos', () => {
    const car = new RaceSimulation('yas-marina').cars[0];
    const fresh = new RaceSimulation('yas-marina').activeTrack;
    const loss = RejoinModel.pitLossSec(fresh, car, null, RejoinModel.MEAN_SERVICE_SEC);
    assert(loss <= LOSS_BEFORE_S - 5, `CR2: la pérdida en Yas Marina baja 5 s o más (antes ${LOSS_BEFORE_S} s)`, `${loss.toFixed(2)} s`);
    const src = readFileSync('src/simulation/RejoinModel.ts', 'utf8');
    assert(/limitFractions\(laneMeters, track\)/.test(src) && /getBoxProgress\([^)]*track\)/.test(src), 'CR2: la previsión de reincorporación usa la misma línea y los mismos cajones');
  });

  await test('CR2-S.4: misma semilla, misma carrera en Yas Marina', async () => {
    const factory = await raceFactory(server);
    const runOnce = () => {
      const sim = factory('yas-marina', 3);
      sim.setSeed(7); sim.setFixedStep(0.02);
      sim.issueBoxOrder(sim.cars[1].id, 'medium');
      for (let s = 0; s < 3000; s++) sim.update(0.02);
      return JSON.stringify(sim.cars.map(c => [c.progress.toFixed(9), c.pitStop.totalPitStops, c.currentSpeedKmh.toFixed(6)]));
    };
    assert(runOnce() === runOnce(), 'CR2: dos carreras con la misma semilla salen iguales');
  });

  await test('CR2-S.5: captura de la parada', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    assert(shots.some(f => /^juego-parada.*\.(jpg|png)$/.test(f)), `CR2: captura de los coches parados delante de su cajón en ${SHOTS}/`, shots.filter(f => /parada/.test(f)).join(', ') || 'no hay');
  });
}
