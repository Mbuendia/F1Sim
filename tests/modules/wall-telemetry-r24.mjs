// R24 — Telemetría y mensajes de muro basados en eventos (contrato aprobado por el usuario el 08/10/2026).
//  1. Registro real de cambios de posición por coche, cada uno clasificado como adelantamiento en pista, boxes o
//     abandono; la suma de sus cambios da siempre parrilla menos posición actual.
//  2. Vueltas reales en cada ritmo (ataque, normal, ahorro): suman las vueltas completadas.
//  3. Lectura del muro por coche (hueco delante y detrás, DRS, energía, combustible, neumáticos, delta del VSC,
//     sanciones y mejoras); cada cifra coincide con el motor.
//  4. La torre y el minimapa usan esa misma lectura para DRS, boxes y sanciones.
//  5. Avisos del muro: como máximo tres a la vez, por prioridad, sin repetirse mientras dure la causa y sin citar
//     artículos.
//  6. Desaparecen las cifras ficticias.
//  7. Lo nuevo se guarda y se carga; las partidas antiguas cargan.
//  8. Los tiempos por vuelta no cambian: lo comprueba el banco de la suite, sin regenerar su referencia.
//  9. Revisión en el navegador (manual; en el dashboard).
// Decisiones del usuario: los daños quedan fuera (el motor no los modela); la lectura va en el panel de detalle.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const wall = await server.ssrLoadModule('/src/simulation/Wall.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const { availableSets } = await server.ssrLoadModule('/src/simulation/TireInventory.ts');
  const { PROJECTS } = await server.ssrLoadModule('/src/simulation/Development.ts');
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/snapshot-v1.json', import.meta.url), 'utf8'));
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const frac = x => ((x % 1) + 1) % 1;
  const sum = log => log.reduce((total, move) => total + move.delta, 0);
  const consistent = sim => sim.cars.every(car => car.gridPosition - car.currentPosition === sum(car.positionLog)
    && JSON.stringify(wall.moveTotals(car.positionLog)) === JSON.stringify(car.moves));

  await fixedRandom(0.99, async () => {
    await test('R24: cambios de posición clasificados', () => {
      const sim = make('barcelona', 3);
      sim.cars.forEach((car, i) => Object.assign(car, { progress: 2.3 - i * 0.01, trackT: frac(2.3 - i * 0.01), currentLap: 2 }));
      sim.update(0.02);
      const [a, b, c] = sim.cars;
      assert(sim.cars.map(car => car.currentPosition).join() === '1,2,3' && sim.cars.every(car => car.positionLog.length === 0), 'R24 (preparación): tres coches en orden, sin cambios');

      // B pasa a A en pista.
      b.progress = a.progress + 0.002; b.trackT = frac(b.progress);
      sim.update(0.02);
      assert(b.currentPosition === 1 && a.currentPosition === 2, 'R24 (preparación): B adelanta a A');
      const gain = b.positionLog.at(-1), loss = a.positionLog.at(-1);
      assert(gain.kind === 'pista' && gain.delta === 1 && gain.otherCarId === a.id && loss.kind === 'pista' && loss.delta === -1 && loss.otherCarId === b.id,
        'R24: un adelantamiento en pista queda anotado en los dos coches', JSON.stringify([gain, loss]));
      assert(gain.lap === b.currentLap && Math.abs(gain.timeSec - sim.raceTimeSec) < 0.05, 'R24: con su vuelta y su instante');

      // C gana el puesto a A mientras A está en boxes.
      a.isInPitLane = true;
      c.progress = a.progress + 0.0005; c.trackT = frac(c.progress);
      sim.update(0.02);
      assert(c.currentPosition === 2 && a.currentPosition === 3 && c.positionLog.at(-1).kind === 'boxes' && a.positionLog.at(-1).kind === 'boxes' && a.positionLog.at(-1).delta === -1,
        'R24: un puesto ganado con el rival en boxes es de boxes, no un adelantamiento', JSON.stringify(c.positionLog.at(-1)));
      a.isInPitLane = false;

      // B se retira: A y C ganan un puesto por abandono.
      b.status = 'out';
      sim.update(0.02);
      assert(b.currentPosition === 3 && c.positionLog.at(-1).kind === 'abandono' && a.positionLog.at(-1).kind === 'abandono' && b.positionLog.filter(m => m.kind === 'abandono').length === 2,
        'R24: los puestos ganados por un abandono se anotan como abandono', JSON.stringify(sim.cars.map(car => car.positionLog.at(-1))));

      assert(consistent(sim), 'R24: la suma de los cambios de cada coche da parrilla menos posición, y sus totales salen del registro');
      assert(b.moves.pista.gained === 1 && a.moves.pista.lost === 1 && c.moves.boxes.gained === 1 && a.moves.boxes.lost === 1 && c.moves.abandono.gained === 1,
        'R24: totales por tipo', JSON.stringify(sim.cars.map(car => car.moves)));
      assert(b.stats.overtakesMade === 1 && c.stats.overtakesMade === 0 && a.stats.overtakesMade === 0, 'R24: «adelantamientos» cuenta solo los hechos en pista');
    });

    await test('R24: vueltas reales en cada ritmo', () => {
      const sim = make('barcelona', 1), car = sim.cars[0];
      Object.assign(car, { progress: 2.98, trackT: 0.98, currentLap: 2 });
      const lapsDone = () => car.paceLaps.push + car.paceLaps.balanced + car.paceLaps.save;
      const runLaps = (mode, laps) => {
        car.paceMode = mode;
        const target = car.currentLap + laps;
        for (let i = 0; i < 40000 && car.currentLap < target; i++) sim.update(0.05);
      };
      runLaps('balanced', 1);
      const start = car.currentLap, base = lapsDone();
      runLaps('push', 2);
      assert(car.paceLaps.push === 2, 'R24: dos vueltas en ataque cuentan dos', JSON.stringify(car.paceLaps));
      runLaps('save', 1);
      assert(car.paceLaps.save === 1 && car.paceLaps.push === 2, 'R24: una vuelta en ahorro cuenta una', JSON.stringify(car.paceLaps));
      assert(lapsDone() - base === car.currentLap - start, 'R24: las vueltas por ritmo suman las completadas');
      assert(car.stats.pushLaps === car.paceLaps.push && car.stats.savingLaps === car.paceLaps.save, 'R24: la telemetría lleva esas mismas cuentas');
    });
  });

  await test('R24: lectura del muro igual que el motor', async () => {
    const original = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = new RaceSimulation('barcelona');
      sim.lightState = 'racing'; sim.isPaused = false;
      sim.setTechnicalUpgrades({ [sim.cars[7].driver.id]: ['suelo'] });
      for (let step = 0; step < 30000 && (sim.cars[0].currentLap < 4 || !sim.cars.some(c => c.positionLog.length > 0)); step++) sim.update(0.05);
      assert(consistent(sim), 'R24: en carrera real, el registro de cada coche explica su posición',
        sim.cars.filter(car => car.gridPosition - car.currentPosition !== sum(car.positionLog)).map(car => car.driver.code).join());
      assert(sim.cars.some(car => car.positionLog.length > 0), 'R24 (preparación): hay cambios de posición en la carrera');

      const ordered = [...sim.cars].sort((x, y) => x.currentPosition - y.currentPosition);
      const car = ordered[7], ahead = ordered[6], behind = ordered[8];
      const reading = sim.getWallReading(car.id);
      assert(reading.code === car.driver.code && reading.position === car.currentPosition, 'R24: la lectura es la del coche pedido');
      assert(reading.gapAheadSec === car.gapToCarAheadSec && reading.aheadCode === ahead.driver.code, 'R24: hueco real con el de delante', `${reading.gapAheadSec} / ${car.gapToCarAheadSec}`);
      assert(reading.gapBehindSec === behind.gapToCarAheadSec && reading.behindCode === behind.driver.code, 'R24: hueco real con el de detrás');
      const leader = sim.getWallReading(ordered[0].id);
      assert(leader.gapAheadSec === null && leader.aheadCode === null, 'R24: el líder no tiene a nadie delante');
      assert(JSON.stringify(reading.drs) === JSON.stringify(car.drsStatus) && reading.drsUses === car.drsUses, 'R24: DRS con su motivo, el mismo que decide el motor (R04)');
      assert(reading.energy.storedMJ === car.energy.storedMJ && reading.energy.recoveredLapMJ === car.energy.recoveredMJ && reading.energy.deployedLapMJ === car.energy.deployedMJ
        && reading.energy.percent === car.telemetry.batterySoc, 'R24: energía guardada, recuperada y desplegada en la vuelta');
      const perLap = RejoinModel.lapFuelKg(sim.activeTrack, car), toGo = Math.max(0, sim.totalLaps - car.progress);
      assert(reading.fuel.kg === car.fuelKg && Math.abs(reading.fuel.lapsOfFuel - car.fuelKg / perLap) < 1e-9 && Math.abs(reading.fuel.lapsToGo - toGo) < 1e-9
        && Math.abs(reading.fuel.reserveLaps - (car.fuelKg / perLap - toGo)) < 1e-9, 'R24: combustible, vueltas que da y reserva respecto a las que faltan', JSON.stringify(reading.fuel));
      assert(reading.tyres.compound === car.tires.compound && reading.tyres.health === car.tires.health
        && ['soft', 'medium', 'hard'].every(compound => reading.tyres.available[compound] === availableSets(car.tireInventory, compound)), 'R24: neumáticos montados y juegos disponibles');
      const compliance = sim.getTireCompliance(car.id);
      assert((reading.tyres.ruleWarning === null) === compliance.satisfied && (compliance.satisfied || (/compuesto/i.test(reading.tyres.ruleWarning) && !/S30/.test(reading.tyres.ruleWarning))),
        'R24: la regla de compuestos pendiente se dice sin citar el artículo', String(reading.tyres.ruleWarning));
      assert(reading.vscDeltaSec === null && reading.penalties.length === 0 && reading.pit === false, 'R24: sin VSC ni sanciones, no se enseñan');
      assert(JSON.stringify(reading.moves) === JSON.stringify(car.moves) && JSON.stringify(reading.paceLaps) === JSON.stringify(car.paceLaps), 'R24: cambios de posición y vueltas por ritmo, los del registro');
      const upgraded = sim.getWallReading(sim.cars[7].id);
      assert(upgraded.upgrades.length === 1 && upgraded.upgrades[0] === PROJECTS.suelo.label && sim.getWallReading(sim.cars[8].id).upgrades.length === 0, 'R24: mejoras montadas en ese coche');

      // Sanción pendiente: aparece en la lectura y en la marca común del coche.
      sim.imposePenalty(car.id, 'time-5', 'S33.3', 'Exceso de velocidad en el pit lane');
      sim.update(0.05);
      const penalized = sim.getWallReading(car.id);
      assert(penalized.penalties.length === 1 && /5 s/.test(penalized.penalties[0]) && /pit lane/i.test(penalized.penalties[0]) && !/S33/.test(penalized.penalties[0]), 'R24: sanción pendiente con su motivo, sin el artículo', penalized.penalties.join());
      assert(wall.carFlags(car).penalty && /5 s/.test(wall.carFlags(car).penalty), 'R24: la marca común del coche lleva la sanción pendiente', JSON.stringify(wall.carFlags(car)));

      // Bajo VSC, el delta es el del motor.
      sim.raceFlagState = 'vsc'; sim.vscActive = true; sim.vscTimer = 0; sim.vscDuration = 60; sim.incidents = [];
      for (let i = 0; i < 100; i++) sim.update(0.05);
      const under = sim.cars.find(c => typeof c.vscDeltaSec === 'number');
      assert(under && sim.getWallReading(under.id).vscDeltaSec === under.vscDeltaSec, 'R24: delta del VSC, el que usa el motor');
      assert(sim.getWallReading(99999) === null, 'R24: sin coche no hay lectura');

      // Panel de detalle.
      const { WallPanel } = await server.ssrLoadModule('/src/components/WallPanel.tsx');
      const html = renderToStaticMarkup(createElement(WallPanel, { reading: penalized }));
      assert(/Muro/.test(html) && html.includes(ahead.driver.code) && html.includes(behind.driver.code) && /Combustible/.test(html) && /reserva/i.test(html) && /Neumáticos/.test(html)
        && /Energía/.test(html) && /Sanci/.test(html) && /5 s/.test(html), 'R24: el panel de detalle enseña la lectura del muro');
      assert(/En pista/.test(html) && /En boxes/.test(html) && /Ataque/.test(html) && /Ahorro/.test(html), 'R24: con los cambios de posición por tipo y las vueltas por ritmo');
      assert(renderToStaticMarkup(createElement(WallPanel, { reading: null })) === '', 'R24: sin lectura no se pinta nada');
    } finally { Math.random = original; }
  });

  await test('R24: la torre y el minimapa usan la misma lectura', async () => {
    const sim = new RaceSimulation('barcelona');
    const [open, granted, pitting, plain] = sim.cars;
    open.drsActive = true; open.drsStatus = { state: 'abierto', reason: 'A 0,40 s de NOR en la detección', gapSec: 0.4, aheadCarId: 1, zoneId: 1, detectionId: 'D1' };
    granted.drsStatus = { state: 'permiso', reason: 'A 0,60 s', gapSec: 0.6, aheadCarId: 2, zoneId: 1, detectionId: 'D1' };
    pitting.isInPitLane = true;
    plain.penaltyNote = '5 s: exceso de velocidad en el pit lane';
    assert(wall.carFlags(open).drs === 'abierto' && wall.carFlags(granted).drs === 'permiso' && wall.carFlags(plain).drs === null, 'R24: marca de DRS abierto o con permiso');
    assert(wall.carFlags(pitting).inPit === true && wall.carFlags(open).inPit === false && wall.carFlags(plain).penalty === plain.penaltyNote && wall.carFlags(open).penalty === null, 'R24: marca de boxes y de sanción');

    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const html = renderToStaticMarkup(createElement(Leaderboard, { cars: sim.cars, selectedCarId: null, onSelectCar: () => {}, fastestLapDriverName: null, leaderLap: 1 }));
    assert((html.match(/data-flag-drs="abierto"/g) ?? []).length === 1 && (html.match(/data-flag-drs="permiso"/g) ?? []).length === 1, 'R24: la torre marca el DRS abierto y el permiso con esa lectura');
    assert((html.match(/data-flag-penalty=/g) ?? []).length === 1 && (html.match(/data-flag-pit="true"/g) ?? []).length === 1, 'R24: y la sanción pendiente y los boxes');
    for (const file of ['src/components/Leaderboard.tsx', 'src/renderer/MinimapRenderer.ts', 'src/components/WallPanel.tsx']) {
      assert(/carFlags\(/.test(source(file)) || /flags/.test(source(file)) && /carFlags/.test(source(file)), `R24: ${file} usa la marca común del coche`);
    }
  });

  await test('R24: avisos del muro con prioridad y sin repetirse', () => {
    const reading = (code, extra) => ({
      carId: code.charCodeAt(0), code, position: 5, gapAheadSec: 1, aheadCode: 'X', gapBehindSec: 1, behindCode: 'Y', drs: undefined, drsUses: 0,
      energy: { storedMJ: 2, percent: 50, recoveredLapMJ: 1, deployedLapMJ: 1 },
      fuel: { kg: 40, lapsOfFuel: 30, lapsToGo: 20, reserveLaps: 10 },
      tyres: { compound: 'medium', health: 80, available: { soft: 1, medium: 1, hard: 1 }, ruleWarning: null },
      vscDeltaSec: null, penalties: [], upgrades: [], moves: wall.emptyMoves(), paceLaps: { push: 0, balanced: 0, save: 0 }, pit: false,
      ...extra,
    });
    assert(wall.wallAlerts([reading('A', {})]).length === 0, 'R24: sin nada que avisar, no hay avisos');
    const troubled = [
      reading('A', { tyres: { compound: 'medium', health: 18, available: { soft: 1, medium: 0, hard: 1 }, ruleWarning: null } }),
      reading('B', { penalties: ['5 s: exceso de velocidad en el pit lane'] }),
      reading('C', { fuel: { kg: 5, lapsOfFuel: 3.2, lapsToGo: 4, reserveLaps: -0.8 } }),
      reading('D', { tyres: { compound: 'medium', health: 70, available: { soft: 1, medium: 0, hard: 1 }, ruleWarning: 'Aún tiene que usar otro compuesto de seco' }, fuel: { kg: 40, lapsOfFuel: 30, lapsToGo: 6, reserveLaps: 24 } }),
      reading('E', { vscDeltaSec: -0.4 }),
    ];
    const alerts = wall.wallAlerts(troubled);
    assert(alerts.length === 5 && alerts.map(alert => alert.code).join('') === 'BCDAE', 'R24: orden de prioridad: sanción, combustible, regla de compuestos, desgaste y VSC', alerts.map(a => `${a.code}:${a.kind}`).join(' '));
    assert(alerts.every(alert => alert.text.startsWith(alert.code) && alert.text.length < 140 && !/S\d+\.\d|Art\./.test(alert.text)), 'R24: avisos cortos, con el piloto por delante y sin citar artículos', alerts.map(a => a.text).join(' | '));
    assert(/0,8/.test(alerts[1].text) && /18/.test(alerts[3].text), 'R24: con la cifra que importa (vueltas que faltan de gasolina, salud del neumático)');

    const first = wall.nextAlerts(alerts, new Set());
    assert(first.show.length === 3 && first.show.map(a => a.code).join('') === 'BCD', 'R24: como máximo tres avisos a la vez, los más prioritarios');
    const second = wall.nextAlerts(alerts, first.active);
    assert(second.show.map(a => a.code).join('') === 'AE', 'R24: los ya dados no se repiten; salen los que quedaban');
    const third = wall.nextAlerts(alerts, second.active);
    assert(third.show.length === 0, 'R24: mientras dura la causa no se repite ningún aviso');
    const cleared = wall.nextAlerts(alerts.filter(a => a.code !== 'B'), third.active);
    const again = wall.nextAlerts(alerts, cleared.active);
    assert(again.show.length === 1 && again.show[0].code === 'B', 'R24: si la causa desaparece y vuelve, se avisa otra vez');
    assert(/wallAlerts\(/.test(source('src/App.tsx')) && /nextAlerts\(/.test(source('src/App.tsx')), 'R24: la aplicación da los avisos del muro por ese camino');
  });

  await test('R24: sin cifras ficticias, y lo nuevo se guarda', () => {
    const engine = source('src/simulation/RaceSimulation.ts');
    assert(!/currentLap \* 0\.35|currentLap \* 0\.65|gridPosition - car\.currentPosition/.test(engine), 'R24: desaparecen los porcentajes fijos de ataque y ahorro y el falso contador de adelantamientos');

    const original = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = make('barcelona', 6);
      sim.lightsRandomDelay = 1.2;
      sim.cars.forEach((c, i) => { c.raceDayLuckFactor = 0; c.progress = 2.2 - i * 0.004; c.trackT = frac(c.progress); });
      sim.setSeed(24); sim.setFixedStep(0.02);
      sim.cars[0].paceMode = 'save'; sim.cars[5].paceMode = 'push';
      while (sim.fixedStepCount < 40000 && !sim.cars.every(c => c.currentLap >= 4)) sim.update(1 / 60);
      // Un adelantamiento seguro: el cuarto coche aparece justo delante del tercero.
      const byPosition = [...sim.cars].sort((x, y) => x.currentPosition - y.currentPosition);
      byPosition[3].progress = byPosition[2].progress + 0.0005; byPosition[3].trackT = frac(byPosition[3].progress);
      for (let i = 0; i < 300; i++) sim.update(1 / 60);
      assert(sim.cars.some(c => c.positionLog.length > 0), 'R24 (preparación): carrera con cambios de posición');
      const target = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(target, JSON.stringify(snap.createSnapshot(sim)));
      const view = s => JSON.stringify(s.cars.map(c => [c.id, c.positionLog, c.moves, c.paceLaps, c.penaltyNote ?? null]));
      assert(outcome.ok && view(target) === view(sim), 'R24: registro de posiciones, totales y vueltas por ritmo vuelven tal cual', outcome.errors?.join(' · '));
      for (let i = 0; i < 1500; i++) { sim.update(1 / 60); target.update(1 / 60); }
      assert(view(target) === view(sim), 'R24: la carrera cargada sigue igual que la original');
    } finally { Math.random = original; }

    for (const key of ['verde', 'safetyCar']) {
      const old = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(old, JSON.stringify(fixture[key]));
      for (let i = 0; i < 200; i++) old.update(1 / 60);
      assert(outcome.ok && old.cars.every(c => Array.isArray(c.positionLog) && c.moves && c.paceLaps && Number.isFinite(c.stats.overtakesMade)) && old.getWallReading(old.cars[0].id) !== null,
        `R24: la partida antigua (${key}) carga y tiene lectura del muro`, outcome.errors?.join(' · '));
    }
  });
}
