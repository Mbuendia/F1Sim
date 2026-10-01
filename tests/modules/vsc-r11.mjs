// R11 (primera entrega) — VSC con referencia (delta) por coche, final anunciado y transiciones (contrato aprobado por
// el usuario el 01/10/2026). S56: delta mínimo, aviso de final y verde 10–15 s después, sin reagrupar. Perfil de
// referencia: vuelta estable del coche con tope de 160 km/h (calibración, el mismo que usa el predictor de boxes).
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  const vscRace = (cars = 3, fps = 60, durationSec = 60) => {
    const sim = make('barcelona', cars);
    const L = sim.activeTrack.lapLengthMeters;
    sim.cars.forEach((c, i) => {
      const p = 3.2 - i * 120 / L;
      Object.assign(c, { progress: p, trackT: p % 1, currentLap: 3, currentSpeedKmh: 250, pitStop: { ...c.pitStop, scheduledLap: 0 } });
    });
    sim.setSeed(11); sim.setFixedStep(0.02);
    for (let i = 0; i < 300; i++) sim.update(1 / fps);
    sim.startVirtualSafetyCar(durationSec);
    return { sim, L };
  };

  await test('R11: delta por coche y velocidad reducida', () => {
    const green = make('barcelona', 1), gc = green.cars[0];
    Object.assign(gc, { progress: 3.2, trackT: 0.2, currentLap: 3, currentSpeedKmh: 250 });
    green.setSeed(11); green.setFixedStep(0.02);
    const g0 = gc.progress; for (let i = 0; i < 1800; i++) green.update(1 / 60);
    const { sim } = vscRace();
    const p0 = sim.cars.map(c => c.progress);
    let minDelta = Infinity;
    sim.onFixedStep = () => { for (const c of sim.cars) if (c.vscDeltaSec !== undefined) minDelta = Math.min(minDelta, c.vscDeltaSec); };
    for (let i = 0; i < 1800; i++) sim.update(1 / 60);
    assert(minDelta >= -0.05, 'R11: ningún coche por delante de su referencia', `${minDelta.toFixed(3)} s`);
    assert(sim.cars[0].progress - p0[0] < gc.progress - g0, 'R11: bajo VSC se avanza menos que en verde');
  });

  await test('R11: los huecos no se agrupan', () => {
    // Hueco en tiempo con los lazos de cronometraje (R02): en metros oscila con la velocidad local de cada coche
    // (corrección autorizada por el usuario el 01/10/2026).
    const { sim } = vscRace();
    const gap = () => sim.timing.gapAtLastCommonLoop(sim.cars[2].id, sim.cars[0].id);
    const start = gap();
    for (let i = 0; i < 1500; i++) sim.update(1 / 60);
    const end = gap();
    assert(Math.abs(end - start) / start < 0.10, 'R11: el hueco cambia menos de un 10 %', `${start.toFixed(2)} → ${end.toFixed(2)} s`);
  });

  await test('R11: quien pierde tiempo no lo recupera', () => {
    const { sim, L } = vscRace(2);
    const [a, b] = sim.cars;
    for (let i = 0; i < 300; i++) sim.update(1 / 60);
    const before = (a.progress - b.progress) * L;
    b.currentSpeedKmh = 30;
    let ahead = false;
    sim.onFixedStep = () => { if ((b.vscDeltaSec ?? 0) < -0.05) ahead = true; };
    for (let i = 0; i < 1500; i++) sim.update(1 / 60);
    const after = (a.progress - b.progress) * L;
    assert(!ahead, 'R11: tras frenar, nunca supera a su referencia');
    assert(after > before + 5, 'R11: el tiempo perdido no se recupera (el hueco crece)', `${before.toFixed(1)} → ${after.toFixed(1)} m`);
  });

  await test('R11: final anunciado y verde 10–15 s después, reproducible', () => {
    const ending = fps => {
      const { sim } = vscRace(3, fps);
      sim.endVirtualSafetyCar();
      const announced = sim.vscLog.find(l => l.phase === 'final');
      while (sim.raceFlagState === 'vsc' && sim.raceTimeSec < 2000) sim.update(1 / fps);
      const greenLog = sim.vscLog.find(l => l.phase === 'verde');
      return { announced, green: greenLog, sim };
    };
    const a = ending(60);
    assert(a.announced && /VSC ending/i.test(a.announced.message), 'R11: se anuncia «VSC ending»');
    const wait = a.green.time - a.announced.time;
    assert(wait >= 10 - 0.02 && wait <= 15 + 0.02, 'R11: la verde llega entre 10 y 15 s después', `${wait.toFixed(2)} s`);
    const b30 = ending(30), b144 = ending(144);
    const w = r => (r.green.time - r.announced.time).toFixed(6);
    assert(w(b30) === w(a) && w(b144) === w(a), 'R11: misma espera a 30, 60 y 144 FPS con la misma semilla', `${w(b30)} / ${w(a)} / ${w(b144)}`);
    assert(a.sim.drsDisabledLaps === 0, 'R11: sin espera de DRS tras el VSC');
  });

  await test('R11: infracción por delta negativo', () => {
    const { sim, L } = vscRace(1);
    for (let i = 0; i < 120; i++) sim.update(1 / 60);
    const car = sim.cars[0];
    car.progress += 30 / L; car.trackT = car.progress % 1;
    for (let i = 0; i < 600; i++) sim.update(1 / 60);
    const infraction = (car.infractions ?? []).find(x => x.type === 'delta-vsc');
    assert(infraction && infraction.value < -0.05, 'R11: se registra la infracción de delta', infraction ? `${infraction.value.toFixed(2)} s` : 'sin infracción');
    assert(car.vscDeltaSec >= -0.05, 'R11: el coche vuelve a quedar detrás de su referencia', `${car.vscDeltaSec.toFixed(3)} s`);
  });

  await test('R11: VSC → SC limpia el VSC y conserva el reloj', () => {
    const { sim } = vscRace();
    sim.endVirtualSafetyCar();
    const t0 = sim.raceTimeSec;
    sim.deploySafetyCar('Escalada');
    let monotonic = true, last = sim.raceTimeSec;
    for (let i = 0; i < 300; i++) { sim.update(1 / 60); if (sim.raceTimeSec < last) monotonic = false; last = sim.raceTimeSec; }
    assert(!sim.vscActive && sim.vscState.phase === null && sim.raceFlagState === 'sc', 'R11: el SC sustituye al VSC y limpia su aviso de final');
    assert(monotonic && sim.raceTimeSec > t0, 'R11: el reloj de carrera sigue avanzando');
    assert(sim.cars.every(c => c.vscRef === undefined), 'R11: sin referencias de VSC pendientes');
  });

  await test('R11: boxes bajo VSC', () => {
    // VSC de 300 s para que dure toda la parada (antes 60 s; corrección autorizada por el usuario el 01/10/2026).
    const { sim, L } = vscRace(1, 60, 300);
    const car = sim.cars[0];
    sim.issueBoxOrder(car.id, 'hard');
    let inLaneRef = false, entered = false;
    for (let i = 0; i < 40000 && !(entered && !car.isInPitLane); i++) {
      sim.update(1 / 60);
      if (car.isInPitLane) { entered = true; if (car.vscRef !== undefined) inLaneRef = true; }
    }
    assert(entered && car.pitStop.totalPitStops === 1, 'R11: se puede parar bajo VSC');
    assert(!inLaneRef, 'R11: en el pit lane no se aplica el delta');
    sim.update(1 / 60);
    // Aserción cambiada con autorización del usuario (01/10/2026): delta continuo, la referencia arranca desde el coche
    // con a lo sumo el margen de recuperación (1 s).
    assert(car.vscDeltaSec >= 0 && car.vscDeltaSec <= 1.05, 'R11: al salir, la referencia arranca desde el coche con a lo sumo 1 s de margen', String(car.vscDeltaSec));
  });
}
