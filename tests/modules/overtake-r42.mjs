// R42 — Adelantar en verde: la decisión es relativa al coche de delante, no un umbral absoluto de ritmo (contrato
// aprobado por el usuario el 02/10/2026). Umbrales de ventaja: calibración del juego. Zonas: las actuales.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { IncidentModel } = await server.ssrLoadModule('/src/simulation/IncidentModel.ts');
  const { marshalSectorOf } = await server.ssrLoadModule('/src/simulation/RaceControl.ts');

  // Dos coches idénticos (equipo, piloto y perfil técnico): `ahead` en la fracción t y `behind` a gapM metros.
  const pair = (t, gapM, speedKmh = 200) => {
    const sim = make('barcelona', 2), [ahead, behind] = sim.cars;
    const L = sim.activeTrack.lapLengthMeters;
    behind.team = structuredClone(ahead.team);
    behind.driver = structuredClone(ahead.driver);
    behind.technical = ahead.technical ? structuredClone(ahead.technical) : undefined;
    const pb = 3 + t - gapM / L;
    Object.assign(ahead, { progress: 3 + t, trackT: t, currentLap: 3, currentSpeedKmh: speedKmh });
    Object.assign(behind, { progress: pb, trackT: ((pb % 1) + 1) % 1, currentLap: Math.floor(pb), currentSpeedKmh: speedKmh });
    sim.setSeed(42); sim.setFixedStep(0.02);
    return { sim, L, ahead, behind };
  };
  const setTyres = (car, compound, health) =>
    Object.assign(car.tires, { compound, health, healthFL: health, healthFR: health, healthRL: health, healthRR: health });
  // Blando nuevo detrás de un duro al 35 % (el de delante es del jugador: decide no parar).
  const tyreAdvantage = (t, gapM = 55) => {
    const s = pair(t, gapM);
    setTyres(s.ahead, 'hard', 35); setTyres(s.behind, 'soft', 100);
    s.ahead.pitStop.playerControlled = true;
    return s;
  };
  // Coche con pinchazo delante y coche sano a 15 m.
  const puncture = t => {
    const s = pair(t, 15, 150);
    Object.assign(s.ahead, { currentSpeedKmh: 70, hasPuncture: true });
    s.ahead.tires.healthRR = 0;
    return s;
  };
  const onTrack = c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting;
  // Avanza hasta `stop` y devuelve los pasos fijos en los que `behind` supera a `ahead` con ambos en pista, y dónde
  // estuvo `behind` con la maniobra activa.
  const watch = (s, stop, limitSec = 900) => {
    const { sim, ahead, behind } = s;
    const passes = [], manoeuvreT = [];
    let wasBehind = behind.progress < ahead.progress;
    sim.onFixedStep = () => {
      if (!onTrack(ahead) || !onTrack(behind)) return;
      if (behind.isOvertaking) manoeuvreT.push(behind.trackT);
      const isBehind = behind.progress < ahead.progress;
      if (wasBehind !== isBehind) passes.push({ step: sim.fixedStepCount, t: behind.trackT, by: isBehind ? 'ahead' : 'behind' });
      wasBehind = isBehind;
    };
    while (!stop(passes) && sim.raceTimeSec < limitSec) sim.update(1 / 60);
    return { passes, manoeuvreT };
  };

  await test('R42: entre coches idénticos no hay adelantamientos gratuitos', () => {
    const s = pair(0.2, 55);
    const lap0 = s.ahead.currentLap;
    const { passes } = watch(s, () => s.ahead.currentLap >= lap0 + 5);
    assert(s.ahead.currentLap >= lap0 + 5, 'R42: se completan 5 vueltas en verde', String(s.ahead.currentLap - lap0));
    assert(passes.length === 0, 'R42: 0 cambios de posición entre coches idénticos', String(passes.length));
  });

  await test('R42: con ventaja real de neumáticos se adelanta en zona permitida', () => {
    const s = tyreAdvantage(0.2);
    const lap0 = s.behind.currentLap;
    const { passes, manoeuvreT } = watch(s, p => p.length > 0 || s.behind.currentLap > lap0 + 3);
    assert(passes.length === 1 && passes[0].by === 'behind' && s.behind.currentLap <= lap0 + 3, 'R42: el blando nuevo pasa al duro gastado en ≤ 3 vueltas',
      `${passes.length} adelantamientos, vuelta +${s.behind.currentLap - lap0}`);
    assert(manoeuvreT.length > 0 && manoeuvreT.every(t => s.sim.isOvertakingAllowedZone(t)), 'R42: la maniobra solo está activa en zona permitida',
      String(manoeuvreT.find(t => !s.sim.isOvertakingAllowedZone(t)) ?? ''));
  });

  await test('R42: un coche con pinchazo se supera también fuera de zona', () => {
    const s = puncture(0.15);
    const { passes } = watch(s, p => p.length > 0, 60);
    assert(passes.length === 1 && passes[0].by === 'behind', 'R42: lo pasa en menos de una vuelta', String(passes.length));
    assert(passes.length === 1 && !s.sim.isOvertakingAllowedZone(passes[0].t), 'R42: fuera de zona, por la gran diferencia de velocidad',
      String(passes[0]?.t));
  });

  await test('R42: R09 sigue impidiéndolo bajo amarilla local, VSC y SC', () => {
    for (const [name, build] of [['neumáticos', tyreAdvantage], ['pinchazo', puncture]]) {
      // Amarilla local en una zona de adelantamiento: sin maniobra mientras el perseguidor está en el sector.
      const y = build(0.45, 15);
      y.sim.incidents.push(IncidentModel.registerIncident({ id: 99, driver: { code: 'INC' }, trackT: 0.455 }, 'crash', y.sim.activeTrack));
      const sector = marshalSectorOf(0.45);
      let inside = 0, attempted = false;
      while (marshalSectorOf(y.behind.trackT) === sector && y.sim.raceTimeSec < 40) {
        y.sim.update(1 / 60);
        if (marshalSectorOf(y.behind.trackT) !== sector) break;
        inside++;
        if (y.behind.isOvertaking || y.behind.progress > y.ahead.progress) attempted = true;
      }
      assert(inside > 0 && !attempted, `R42: ${name} — sin adelantamiento en el sector con amarilla`);

      for (const flag of ['vsc', 'sc']) {
        const s = build(0.15, 15);
        if (flag === 'vsc') s.sim.startVirtualSafetyCar(300); else s.sim.deploySafetyCar('Prueba');
        const { passes, manoeuvreT } = watch(s, () => s.sim.raceTimeSec >= 60 || !onTrack(s.ahead), 60);
        assert(passes.length === 0 && manoeuvreT.length === 0, `R42: ${name} — sin adelantamiento bajo ${flag.toUpperCase()}`,
          `${passes.length} adelantamientos`);
      }
    }
  });

  await test('R42: misma semilla, mismos adelantamientos', () => {
    const once = () => {
      const s = tyreAdvantage(0.2);
      const lap0 = s.behind.currentLap;
      return JSON.stringify(watch(s, p => p.length > 0 || s.behind.currentLap > lap0 + 3).passes);
    };
    assert(once() === once(), 'R42: el adelantamiento ocurre en el mismo paso y lugar');
  });
}
