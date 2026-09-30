// Q19 — Casos ampliados del DRS por el camino real de RaceSimulation (geometría SINTÉTICA, no planos de evento):
//  - líder que detecta a < 1 s de un doblado recibe DRS (S22.1: cualquier coche por delante en la detección);
//  - zona que cruza la línea de meta: abre antes de la línea, sigue abierta al cruzarla y cierra al salir de la zona;
//  - detección situada en la propia línea de meta;
//  - pasos grandes (x1 frente a x32): mismo resultado de permiso con 0,8 s y denegación con 1,2 s.
// Libres/clasificación no existen en el juego (solo carrera): la restricción de proximidad se aplica siempre (ver R18).
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;

  // Pista plana sintética: sin frenadas; zona DRS 1 en [zoneStart, zoneEnd) (puede cruzar meta); una detección.
  const synthetic = (sim, { detectionT, zoneStart, zoneEnd }) => {
    const pts = sim.activeTrack.points, n = pts.length;
    const inZone = t => zoneStart <= zoneEnd ? t >= zoneStart && t < zoneEnd : t >= zoneStart || t < zoneEnd;
    pts.forEach((p, i) => Object.assign(p, {
      isBrakingZone: false, speedLimitFactor: 1, idealLineOffset: 0,
      isDrsZone: inZone(i / n), drsZoneId: inZone(i / n) ? 1 : undefined,
    }));
    sim.activeTrack.drsDetections = [{ id: 'SYN', t: detectionT, zoneIds: [1], source: 'calibrated' }];
  };
  // Dos coches a 300 km/h: `ahead` por delante `gapSec` segundos en pista; el perseguidor justo antes de la detección.
  const pair = (sim, detectionT, gapSec, { lapped = false } = {}) => {
    const [ahead, chaser] = sim.cars, L = sim.activeTrack.lapLengthMeters, v = 300;
    // Mismo coche/equipo para que ambos vayan igual de rápido y el hueco se mantenga.
    chaser.team = structuredClone(ahead.team); chaser.driver = { ...structuredClone(ahead.driver), id: 'chaser', code: 'CHS' };
    // Ambos antes de la detección: el de delante la cruza primero y queda registrado como rival observado.
    const aheadOnTrack = 3 + frac(detectionT - 0.003);
    const chaserP = aheadOnTrack - gapSec * (v / 3.6) / L;
    const aheadP = aheadOnTrack - (lapped ? 1 : 0);
    for (const [c, p, lap] of [[chaser, chaserP, 3], [ahead, aheadP, lapped ? 2 : 3]]) {
      Object.assign(c, { progress: p, trackT: frac(p), currentLap: lap, currentSpeedKmh: v });
    }
    ahead.currentPosition = lapped ? 2 : 1; chaser.currentPosition = lapped ? 1 : 2;
    return { ahead, chaser };
  };
  const runFor = (sim, seconds, step, onStep = () => {}) => {
    const end = sim.raceTimeSec + seconds;
    while (sim.raceTimeSec < end) { sim.update(step); onStep(); }
  };

  await fixedRandom(0.99, async () => {
    await test('Q19: el líder a menos de 1 s de un doblado en la detección recibe DRS', () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0.2, zoneStart: 0.25, zoneEnd: 0.45 });
      const { ahead: lapped, chaser: leader } = pair(sim, 0.2, 0.8, { lapped: true });
      let opened = false;
      runFor(sim, 12, 0.02, () => { opened ||= leader.drsActive; });
      assert(leader.progress > lapped.progress + 0.5, 'Q19: fixture: el que persigue es el líder y el de delante va doblado');
      assert(opened, 'Q19: el líder detrás de un doblado a < 1 s abre el DRS en su zona');
    });

    await test('Q19: zona que cruza la línea de meta sigue abierta al cruzarla y cierra al salir', () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0.9, zoneStart: 0.95, zoneEnd: 0.06 });
      const { chaser } = pair(sim, 0.9, 0.8);
      let openedBeforeLine = false, openAcrossLine = false, closedAfterZone = null, lapChanged = false;
      let lastLap = Math.floor(chaser.progress);
      runFor(sim, 14, 0.02, () => {
        const t = frac(chaser.progress), lap = Math.floor(chaser.progress);
        if (t >= 0.95 && chaser.drsActive) openedBeforeLine = true;
        if (lap > lastLap) { lapChanged = true; lastLap = lap; }
        if (lapChanged && t < 0.05 && t > 0.001 && chaser.drsActive) openAcrossLine = true;
        if (lapChanged && t >= 0.07 && t < 0.3 && closedAfterZone === null) closedAfterZone = !chaser.drsActive;
      });
      assert(openedBeforeLine, 'Q19: abre en la parte de la zona anterior a la línea');
      assert(openAcrossLine, 'Q19: sigue abierto al cruzar la línea (misma zona, sin reiniciar)');
      assert(closedAfterZone === true, 'Q19: cierra al salir de la zona tras la línea');
    });

    await test('Q19: detección en la propia línea de meta', () => {
      const sim = make('barcelona', 2);
      synthetic(sim, { detectionT: 0, zoneStart: 0.05, zoneEnd: 0.3 });
      const { chaser } = pair(sim, 0, 0.8);
      let opened = false;
      runFor(sim, 12, 0.02, () => { opened ||= chaser.drsActive; });
      assert(opened, 'Q19: una detección en t = 0 se registra al cruzar la línea');
    });

    for (const [label, speed] of [['x1', 1], ['x32', 32]]) {
      await test(`Q19: pasos grandes (${label}) conservan el criterio de 1 s`, () => {
        const outcome = {};
        for (const gap of [0.8, 1.2]) {
          const sim = make('barcelona', 2);
          synthetic(sim, { detectionT: 0.2, zoneStart: 0.22, zoneEnd: 0.6 });
          const { chaser } = pair(sim, 0.2, gap);
          sim.setSpeed(speed);
          let opened = false;
          // Frames de 0,1 s reales: a x32 cada frame avanza 8 s simulados en subpasos.
          runFor(sim, 20, 0.1, () => { opened ||= chaser.drsActive; });
          outcome[gap] = opened;
        }
        assert(outcome[0.8] === true, `Q19 ${label}: detectado a 0,8 s abre el DRS`);
        assert(outcome[1.2] === false, `Q19 ${label}: detectado a 1,2 s no lo abre`);
      });
    }
  });
}
