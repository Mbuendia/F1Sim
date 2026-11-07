// CA5 — Cambio de ruedas en 3D (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. La parada tiene sus fases (llegada, gato arriba, ruedas fuera, ruedas dentro, gato abajo, salida) y dura lo mismo
//     que la del motor, con 0,05 s de margen.
//  2. Si una rueda se atasca, solo esa tarda más.
//  3. Las ruedas que salen llevan el compuesto viejo y las que entran el nuevo.
//  4. Sin teletransportes: la posición sigue saliendo del motor.
//  5. Una cámara de boxes para verlo y captura para el visto bueno (en `docs/design/ca5-parada/`).
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const PHASES = ['llegada', 'gato-arriba', 'ruedas-fuera', 'ruedas-dentro', 'gato-abajo', 'salida'];

export default async function run({ server, assert, test }) {
  const anim = await server.ssrLoadModule('/src/scene3d/pitStopAnimation.ts').catch(() => ({}));
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const ok = typeof anim.pitStopTimeline === 'function' && typeof anim.pitStopPose === 'function';
  const cases = [];
  for (let i = 0; i < 60; i++) {
    const crew = [undefined, { timeFactor: 0.9, errorFactor: 0.6 }, { timeFactor: 1.05, errorFactor: 1.8 }][i % 3];
    cases.push({ ...PitStopModel.serviceOutcome(i / 60, ((i * 37) % 100) / 100, crew), crew });
  }

  await test('CA5: fases de la parada con la duración del motor', () => {
    const bad = [];
    if (!ok) bad.push('sin pitStopTimeline/pitStopPose');
    else for (const c of cases) {
      const tl = anim.pitStopTimeline({ duration: c.seconds, cause: c.cause, wheel: c.wheel, timeFactor: c.crew?.timeFactor ?? 1 });
      const names = tl.phases.map(p => p.name);
      if (JSON.stringify(names) !== JSON.stringify(PHASES)) { bad.push(`fases ${names.join(',')}`); continue; }
      if (Math.abs(tl.phases[0].start) > 1e-9) bad.push('no empieza en 0');
      tl.phases.forEach((p, k) => { if (p.end < p.start || (k && Math.abs(p.start - tl.phases[k - 1].end) > 1e-9)) bad.push(`${p.name} no encadena`); });
      if (Math.abs(tl.phases.at(-1).end - c.seconds) > 0.05) bad.push(`${c.seconds} s → ${tl.phases.at(-1).end.toFixed(2)} s`);
    }
    assert(bad.length === 0, 'CA5: llegada, gato arriba, ruedas fuera, ruedas dentro, gato abajo y salida, seguidas y con la duración de la parada del motor (±0,05 s)', bad.slice(0, 6).join(' | '));
  });

  await test('CA5: solo la rueda atascada tarda más', () => {
    const bad = [];
    for (const c of ok ? cases : []) {
      const tl = anim.pitStopTimeline({ duration: c.seconds, cause: c.cause, wheel: c.wheel, timeFactor: c.crew?.timeFactor ?? 1 });
      const ends = tl.wheels.map(w => w.in[1]);
      if (c.cause === 'rueda-atascada') {
        const others = ends.filter((_, k) => k !== c.wheel);
        if (others.some(e => Math.abs(e - others[0]) > 1e-6)) bad.push('las otras no acaban juntas');
        if (!(ends[c.wheel] > Math.max(...others) + 0.3)) bad.push(`la atascada (${c.wheel}) acaba en ${ends[c.wheel].toFixed(2)} y las otras en ${others[0].toFixed(2)}`);
      } else if (ends.some(e => Math.abs(e - ends[0]) > 1e-6)) bad.push(`${c.cause}: las cuatro no acaban juntas`);
    }
    assert(ok && bad.length === 0, 'CA5: con una rueda atascada, esa rueda tarda más y las otras tres acaban a su hora; si no, las cuatro a la vez', bad.slice(0, 6).join(' | '));
  });

  await test('CA5: compuesto viejo fuera, nuevo dentro', () => {
    const bad = [];
    if (ok) {
      const tl = anim.pitStopTimeline({ duration: 2.4, cause: 'normal', timeFactor: 1 });
      const at = t => anim.pitStopPose(tl, t, 'medium', 'hard');
      const p0 = at(0), out = at((tl.wheels[0].out[0] + tl.wheels[0].out[1]) / 2), inn = at(tl.wheels[0].in[1] - 0.01), end = at(2.4);
      if (p0.jack !== 0 || end.jack !== 0) bad.push('el gato no empieza ni acaba abajo');
      if (!(out.jack > 0.9)) bad.push('el coche no está levantado al cambiar las ruedas');
      if (!out.wheels.every(w => w.compound === 'medium' && w.off > 0)) bad.push(`al salir: ${JSON.stringify(out.wheels)}`);
      if (!inn.wheels.every(w => w.compound === 'hard')) bad.push(`al entrar: ${JSON.stringify(inn.wheels)}`);
      if (!end.wheels.every(w => w.off === 0 && w.compound === 'hard')) bad.push('al acabar no están montadas las nuevas');
    } else bad.push('sin módulo');
    assert(bad.length === 0, 'CA5: las ruedas que salen llevan el compuesto viejo, las que entran el nuevo, con el coche levantado', bad.join(' | '));
  });

  await test('CA5: sin teletransportes', async () => {
    const pose = ok ? anim.pitStopPose(anim.pitStopTimeline({ duration: 2.4, cause: 'normal', timeFactor: 1 }), 1, 'medium', 'hard') : {};
    const keys = Object.keys(pose);
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(ok && !keys.some(k => ['x', 'y', 'worldX', 'worldY', 'progress', 'trackT'].includes(k))
      && /applyPitPose\(/.test(scene) && /holder\.position\.copy\(W\(car\.worldX, car\.worldY, z\)\)/.test(scene),
      'CA5: la animación solo levanta el coche y mueve sus ruedas; la posición sigue siendo la del motor', keys.join(','));
    const { slowView } = await server.ssrLoadModule('/src/engine/RaceView.ts');
    const { raceFactory, advance } = await import('../support/race.mjs');
    const sim = (await raceFactory(server))('barcelona', 1), car = sim.cars[0];
    car.pitStop.scheduledLap = car.currentLap; car.pitStop.targetCompound = 'hard';
    let seen = null, steps = 0;
    while (!seen && steps++ < 6000) { advance(sim, 0.1, 0.05); const s = slowView(sim).cars[0].stop; if (s) seen = { s, t: sim.raceTimeSec, timer: car.pitStop.currentStopTimer }; }
    assert(seen && Math.abs(seen.s.duration - car.pitStop.stopDuration) < 1e-9 && Math.abs((seen.t - seen.s.start) - seen.timer) < 0.06 && seen.s.from && seen.s.to === 'hard',
      'CA5: la vista de la carrera da a la escena la parada en curso (inicio, duración, motivo y compuestos) de cada coche', JSON.stringify(seen));
  });

  await test('CA5: cámara de boxes y captura', async () => {
    const cams = await server.ssrLoadModule('/src/scene3d/cameras.ts');
    const pose = { x: 100, y: 50, heading: 0.4, t: 0.1, z: 0, inBox: true };
    const v = typeof cams.pitBoxView === 'function' ? cams.pitBoxView(pose) : null;
    const d = v ? Math.hypot(v.position.x - pose.x, v.position.y - pose.y) : 0;
    const director = readFileSync('src/scene3d/director3d.ts', 'utf8');
    assert(v && d > 3 && d < 15 && Math.hypot(v.target.x - pose.x, v.target.y - pose.y) < 2 && /pitBoxView\(/.test(director),
      'CA5: con el coche parado en su box, la realización pasa a una cámara de boxes cerca del coche', v ? `${d.toFixed(1)} m` : 'sin pitBoxView');
    const dir = 'docs/design/ca5-parada';
    const files = existsSync(dir) ? readdirSync(dir).filter(f => /\.(png|jpg)$/.test(f)) : [];
    assert(files.length >= 3, 'CA5: capturas de la parada en docs/design/ca5-parada/ (al menos tres momentos)', files.join(', '));
  });
}
