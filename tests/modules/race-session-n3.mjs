// N3 — La pantalla de carrera lee de almacenes alimentados por las vistas del motor (PROPUESTA DE CONTRATO, 19/10/2026).
// El motor corre detrás de un enlace (Worker en el navegador; enlace local en los tests) y la pantalla solo ve vistas.
//  1. Almacenes (zustand): carrera (vista rápida actual y anterior, lenta, equipos, avisos), sala y conexión.
//  2. Sesión: arranca el motor desde un snapshot con la configuración de la aplicación, manda órdenes con acuse,
//     guarda, y la carrera es idéntica a la de hoy con la misma semilla y las mismas órdenes.
//  3. Coches para la pantalla: los mismos nombres de campo que el motor; lo público de todos y lo privado solo del equipo propio.
//  4. Pintado: la pose se interpola entre vistas, sin repetir posición ni saltos, a 60 y a 144 Hz (como R43).
//  5. Vistas ampliadas con lo que pinta la pantalla (sin pasar de 1,5 KB la rápida) y eventos (DNF, suerte, órdenes, final).
//  6. Órdenes nuevas de la pantalla (semáforos, suerte, final, tiempo de prueba, pruebas de Safety Car y roja).
//  7. Ningún componente ni pintor de la carrera toca el motor.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { EngineHost } = await load('/src/engine/EngineHost.ts');
  const { decodeFast, decodeSafetyCar } = await load('/src/engine/RaceView.ts');
  const { LocalLink } = await load('/src/engine/LocalLink.ts');
  const { RaceSession, rosterOf } = await load('/src/engine/RaceSession.ts');
  const { carViews } = await load('/src/engine/raceCars.ts');
  const { ViewInterpolator } = await load('/src/engine/ViewInterpolator.ts');
  const { createRaceStore } = await load('/src/state/raceStore.ts');
  const { createRoomStore } = await load('/src/state/roomStore.ts');
  const { createLinkStore } = await load('/src/state/linkStore.ts');
  const { createSnapshot } = await load('/src/simulation/Snapshot.ts');
  const { worldUnitsPerMeter } = await load('/src/utils/carPosition.ts');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const cross = m => structuredClone(m);
  // Configuración con la que la aplicación crea su carrera (App.tsx): el Worker no la recibe en el snapshot.
  const CONFIG = { fixedStepSec: 0.02, autoStartTyres: true, seededPreparation: true, autoTeamOrders: true, upgradeTradeoffs: {}, luckVariantEnabled: false };

  const seededRace = (cars = 6) => {
    const sim = make('barcelona', cars);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(42); sim.setFixedStep(0.02);
    return sim;
  };
  const runTo = (sim, steps) => { while (sim.fixedStepCount < steps) sim.update(1 / 60); };
  const fingerprint = sim => JSON.stringify(sim.cars.map(c => [c.id, c.progress, c.currentPosition, c.tires, c.lapHistory.map(l => l.lapTime)]));
  /** Sesión sobre el enlace local, con el reloj movido a mano. */
  const session = async (sim, teams) => {
    const link = new LocalLink();
    const store = createRaceStore();
    const links = createLinkStore();
    const s = new RaceSession({ link, store, linkStore: links });
    const started = s.start({ snapshot: createSnapshot(sim), config: CONFIG, teams, roster: rosterOf(sim) });
    link.flush();
    return { s, link, store, links, started: await started };
  };
  const ticksTo = (link, steps) => { while (link.host.sim.fixedStepCount < steps) { link.tick(1 / 60); link.flush(); } };

  await test('N3: almacén de carrera: vista rápida actual y anterior, lenta y de equipo por separado', () => {
    const store = createRaceStore();
    const host = new EngineHost(seededRace(), { teams: ['x'] });
    const f1 = { type: 'fast', view: host.fastView() }, f2 = { type: 'fast', view: host.fastView() };
    store.getState().receive(cross(f1), 1000);
    store.getState().receive({ type: 'slow', view: cross(host.slowView()) }, 1010);
    const slowRef = store.getState().slow;
    store.getState().receive(cross(f2), 1066);
    const st = store.getState();
    assert(st.fast && st.prevFast && st.fastAt === 1066 && st.prevFastAt === 1000, 'N3: guarda la vista rápida actual y la anterior con su hora de llegada');
    assert(st.slow === slowRef, 'N3: una vista rápida no toca la lenta (los paneles no se repintan por ella)');
    const teamId = host.sim.cars[0].team.id;
    store.getState().receive({ type: 'team', teamId, view: cross(host.teamView(teamId)) }, 1070);
    assert(store.getState().teams[teamId]?.teamId === teamId && store.getState().fast === st.fast, 'N3: la vista del equipo se guarda por equipo sin tocar las demás');
    const room = createRoomStore(), link = createLinkStore();
    assert(room.getState().mode === 'solo' && Array.isArray(room.getState().teams), 'N3: almacén de sala (en N3, partida de un jugador)');
    assert(['none', 'local', 'worker'].includes(link.getState().transport) && typeof link.getState().status === 'string', 'N3: almacén de conexión');
  });

  await test('N3: la sesión arranca el motor desde el snapshot con la configuración de la aplicación', async () => {
    const sim = seededRace();
    const teamId = sim.cars[0].team.id;
    const { link, store, links, started } = await session(sim, [teamId]);
    assert(started.ok === true, 'N3: el motor acepta el snapshot', JSON.stringify(started.errors));
    const engine = link.host.sim;
    assert(engine.autoStartTyres === true && engine.seededPreparation === true && engine.autoTeamOrders === true && engine.fixedStepSec === 0.02,
      'N3: el motor recibe la configuración que no viaja en el snapshot');
    ticksTo(link, 400);
    const st = store.getState();
    assert(st.fast && st.slow && st.teams[teamId] && st.roster.length === sim.cars.length, 'N3: llegan las tres vistas y la lista de coches');
    assert(links.getState().transport === 'local' && links.getState().status === 'ready', 'N3: la conexión queda lista', JSON.stringify(links.getState()));
  });

  await test('N3: misma carrera que hoy con la misma semilla y las mismas órdenes, a través de la sesión', async () => {
    const direct = seededRace();
    Object.assign(direct, { autoStartTyres: true, seededPreparation: true, autoTeamOrders: true });
    runTo(direct, 800); direct.issuePaceOrder(direct.cars[1].id, 'push');
    runTo(direct, 1600); direct.issueBoxOrder(direct.cars[2].id, 'hard');
    runTo(direct, 3000);

    const { s, link } = await session(seededRace(), []);
    ticksTo(link, 800); const a = s.order({ kind: 'pace', carId: link.host.sim.cars[1].id, mode: 'push' }); link.flush();
    ticksTo(link, 1600); const b = s.order({ kind: 'box', carId: link.host.sim.cars[2].id, compound: 'hard' }); link.flush();
    ticksTo(link, 3000);
    const [ackA, ackB] = await Promise.all([a, b]);
    assert(ackA.ok && ackB.ok, 'N3: las órdenes vuelven con acuse');
    assert(fingerprint(link.host.sim) === fingerprint(direct), 'N3: carrera idéntica');
    const saved = s.save(); link.flush();
    const snap = await saved;
    assert(JSON.stringify(snap) === JSON.stringify(createSnapshot(link.host.sim)), 'N3: guardar devuelve el snapshot de la carrera del motor');
  });

  await test('N3: coches para la pantalla: lo público de todos, lo privado solo de los propios', async () => {
    const sim = seededRace(20);
    const own = sim.cars[0].team.id;
    const { link, store } = await session(sim, [own]);
    ticksTo(link, 600);
    // Corrección autorizada el 19/10/2026: se compara con el motor en el instante en que se hacen las vistas (las
    // que esperan en el almacén pueden tener hasta un segundo).
    const engine = link.host.sim;
    const fresh = createRaceStore();
    fresh.getState().reset(store.getState().roster);
    fresh.getState().receive(cross({ type: 'fast', view: link.host.fastView() }), 0);
    fresh.getState().receive(cross({ type: 'slow', view: link.host.slowView() }), 0);
    fresh.getState().receive(cross({ type: 'team', teamId: own, view: link.host.teamView(own) }), 0);
    const st = fresh.getState();
    const views = carViews({ roster: st.roster, fast: st.fast, slow: st.slow, teams: st.teams });
    assert(views.length === 20 && views.every(v => v.driver?.code && v.team?.color), 'N3: cada coche trae piloto y equipo de la lista de salida');
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    const publicOk = engine.cars.every(c => {
      const v = views.find(x => x.id === c.id);
      return v.currentPosition === c.currentPosition && v.status === c.status && v.tires.compound === c.tires.compound && v.tires.lapsOnTire === c.tires.lapsOnTire
        && v.pitStop.isPitting === c.pitStop.isPitting && v.pitStop.totalPitStops === c.pitStop.totalPitStops && v.gapToLeaderSec === c.gapToLeaderSec
        && near(v.worldX, c.worldX, 0.1) && near(v.progress, c.progress, 1e-4) && v.isInPitLane === c.isInPitLane;
    });
    assert(publicOk, 'N3: posición, estado, gomas (compuesto y vueltas), boxes, diferencias y pose como el motor');
    const mine = views.filter(v => v.team.id === own), others = views.filter(v => v.team.id !== own);
    assert(mine.every(v => typeof v.tires.health === 'number' && 'activeBoxOrder' in v.pitStop && Array.isArray(v.wallProposals) && typeof v.energy?.percent === 'number'),
      'N3: los coches propios traen desgaste, orden de boxes, propuestas y batería');
    assert(others.every(v => v.tires.health === undefined && !('activeBoxOrder' in v.pitStop) && v.wallProposals === undefined && v.energy === undefined && v.paceMode === undefined),
      'N3: los rivales no traen desgaste, órdenes, propuestas, batería ni ritmo');
  });

  await test('N3: la clasificación enseña el desgaste solo de los coches propios', async () => {
    const { Leaderboard } = await load('/src/components/Leaderboard.tsx');
    const sim = seededRace(20);
    const own = sim.cars[0].team.id;
    const { link, store } = await session(sim, [own]);
    ticksTo(link, 300);
    const st = store.getState();
    const cars = carViews({ roster: st.roster, fast: st.fast, slow: st.slow, teams: st.teams });
    const html = renderToStaticMarkup(createElement(Leaderboard, { cars, selectedCarId: null, onSelectCar: () => {}, fastestLapDriverName: null, leaderLap: 1 }));
    // Corrección autorizada el 19/10/2026: el icono repite su texto en `title` y `aria-label`; se cuenta una vez por fila.
    const healthTags = (html.match(/title="[^"]*Salud \d+%/g) ?? []).length;
    assert(healthTags === cars.filter(c => c.team.id === own).length, 'N3: «Salud» solo en las filas propias', String(healthTags));
  });

  await test('N3: pose interpolada entre vistas, sin repeticiones ni tirones (60 y 144 Hz; vistas a 60/s y a 15/s)', () => {
    for (const viewHz of [60, 15]) for (const hz of [60, 144]) {
      const sim = make('barcelona', 1), car = sim.cars[0];
      Object.assign(car, { progress: 3.9, trackT: 0.9, currentLap: 3, currentSpeedKmh: 300 });
      car.pitStop.playerControlled = true;
      sim.setSeed(43); sim.setFixedStep(0.02);
      const host = new EngineHost(sim, { fastHz: viewHz });
      const interp = new ViewInterpolator();
      const unit = worldUnitsPerMeter(sim.activeTrack);
      const dt = 1 / hz;
      let now = 0, last = null, repeated = 0, worst = 0, frames = 0;
      for (let i = 0; i < hz * 3; i++) {
        now += dt * 1000;
        for (const m of host.advance(dt)) if (m.type === 'fast') interp.push(cross(m.view), now);
        const pose = interp.frame(now).cars.find(c => c.id === car.id);
        if (pose && last && i > hz) {
          const moved = Math.hypot(pose.worldX - last.worldX, pose.worldY - last.worldY);
          const expected = car.currentSpeedKmh / 3.6 * dt * sim.getEffectiveTimeScale() * unit;
          if (moved < 1e-9) repeated++;
          worst = Math.max(worst, Math.abs(moved / expected - 1));
          frames++;
        }
        if (pose) last = { worldX: pose.worldX, worldY: pose.worldY };
      }
      assert(frames > 0 && repeated === 0, `N3: vistas a ${viewHz}/s, pintado a ${hz} Hz: ningún fotograma repite posición`, String(repeated));
      assert(worst <= 0.10, `N3: vistas a ${viewHz}/s, pintado a ${hz} Hz: avance dentro del ±10 %`, `${(worst * 100).toFixed(1)} %`);
    }
    const interp = new ViewInterpolator();
    interp.push({ t: 0, c: [7, 0, 0, 0, 200, 0, 10000, 100000] }, 0);
    interp.push({ t: 0.1, c: [7, 5000, 0, 0, 200, 0, 10000, 100500] }, 100);
    const mid = interp.frame(150).cars[0];
    assert(mid.worldX === 500, 'N3: un salto de más de 30 m (recolocación) no se interpola', String(mid.worldX));
  });

  await test('N3: vista rápida ampliada (boxes, DRS, azul, freno, vueltas, Safety Car) sin pasar de 1,5 KB', () => {
    const sim = seededRace(20);
    const host = new EngineHost(sim);
    runTo(sim, 500);
    sim.cars[3].drsActive = true; sim.cars[4].isBlueFlagged = true; sim.deploySafetyCar('Prueba');
    const fast = cross(host.fastView());
    const bytes = JSON.stringify(fast).length;
    assert(bytes <= 1500, 'N3: ≤ 1500 bytes con 20 coches y Safety Car', `${bytes} bytes`);
    const cars = decodeFast(fast);
    const ok = sim.cars.every(c => {
      const v = cars.find(x => x.id === c.id);
      return v.drsActive === Boolean(c.drsActive) && v.isBlueFlagged === Boolean(c.isBlueFlagged) && Math.abs(v.progress - c.progress) <= 1e-5
        && Math.abs(v.trackT - frac(c.progress)) <= 1e-5 && typeof v.rpm === 'number' && typeof v.brake === 'boolean';
    });
    assert(ok, 'N3: DRS, bandera azul, progreso (vueltas y fracción), vueltas por minuto y freno de cada coche');
    const sc = decodeSafetyCar(fast);
    assert(sc && Math.abs(sc.progress - sim.safetyCar.progress) <= 1e-5 && sc.isInPitLane === Boolean(sim.safetyCar.isInPitLane) && sc.mode === sim.safetyCar.mode,
      'N3: el Safety Car viaja en la vista rápida con su progreso, boxes y fase');
  });

  await test('N3: vista lenta ampliada y eventos: DNF, suerte, órdenes cumplidas y final, al momento y una sola vez', () => {
    const sim = seededRace(20);
    const host = new EngineHost(sim);
    runTo(sim, 300);
    let out = host.advance(1 / 60);
    const slow = cross(host.slowView());
    assert(Array.isArray(slow.sectorFlags) && slow.bestSectors?.length === 3 && slow.forecast && Array.isArray(slow.weatherScene?.water)
      && typeof slow.weatherScene.cloudCover === 'number' && slow.raceFormat === sim.raceFormat, 'N3: sectores, mejores parciales, radar, agua por tramo, nubes y formato');
    assert(slow.cars.every(v => 'previousPosition' in v && 'hasPuncture' in v && 'waitingForBox' in v && 'carAheadId' in v && Array.isArray(v.stints)),
      'N3: por coche, posición anterior, pinchazo, cola en boxes, coche de delante y relevos');
    sim.latestDnf = { id: 'dnf-1', carId: sim.cars[5].id, driverCode: sim.cars[5].driver.code, reason: 'Motor', lap: 2, time: sim.raceTimeSec };
    out = host.advance(1 / 60).map(cross);
    assert(out.some(m => m.type === 'slow' && m.view.dnf?.id === 'dnf-1'), 'N3: un DNF sale en una vista lenta inmediata');
    sim.teamOrderNotices.push({ text: 'Orden cumplida' });
    out = host.advance(1 / 60).map(cross);
    const noticed = out.filter(m => m.type === 'slow').flatMap(m => m.view.notices);
    out = [...out, ...host.advance(1 / 60).map(cross)];
    assert(noticed.length === 1 && noticed[0] === 'Orden cumplida' && sim.teamOrderNotices.length === 0, 'N3: cada aviso de orden de equipo sale una vez y se vacía en el motor');
    sim.isFinished = true;
    out = host.advance(1 / 60).map(cross);
    const final = out.find(m => m.type === 'slow')?.view;
    assert(final?.finished === true && Array.isArray(final.podiumIds) && final.result && Array.isArray(final.result.rows), 'N3: al terminar sale el resultado y el podio');
  });

  await test('N3: órdenes nuevas de la pantalla, iguales que la llamada directa', async () => {
    const cases = [
      ['startSequence', { kind: 'startSequence' }, s => { s.lightState = 'idle'; }, s => (s.startRaceSequence(), true)],
      ['confirmStart', { kind: 'confirmStart' }, s => { s.lightState = 'grid-ready'; }, s => (s.confirmRaceStart(), true)],
      ['luckVariant', { kind: 'luckVariant', enabled: true }, null, s => ((s.luckVariantEnabled = true), true)],
      ['dnfClear', { kind: 'dnfClear' }, s => { s.latestDnf = { id: 'x', carId: 1, driverCode: 'AAA', reason: 'r', lap: 1, time: 1 }; }, s => ((s.latestDnf = null), true)],
      ['luckClear', { kind: 'luckClear' }, null, s => ((s.activeLuckEvent = null), true)],
      ['devSafetyCar', { kind: 'devSafetyCar' }, null, s => (s.deploySafetyCar('PRUEBA MANUAL (DEV)', { targetLaps: 999 }), true)],
      ['devRedFlag', { kind: 'devRedFlag' }, null, s => (s.startRedFlag('PRUEBA MANUAL (DEV)'), s.triggerD20LuckRoll('red'), true)],
      ['endSuspended', { kind: 'endSuspended' }, null, s => s.endRaceSuspended()],
    ];
    for (const [name, order, prepare, direct] of cases) {
      const a = seededRace(); runTo(a, 300); if (prepare) prepare(a);
      const b = seededRace(); runTo(b, 300); if (prepare) prepare(b);
      const host = new EngineHost(b);
      // Corrección autorizada el 19/10/2026: la bandera roja tira el dado D20 con Math.random y lo marca con la hora
      // (Date.now); se fijan las dos cosas para las dos carreras.
      const stable = async fn => { const now = Date.now; Date.now = () => 1_700_000_000_000; try { return await fixedRandom(0.42, fn); } finally { Date.now = now; } };
      const expected = await stable(() => direct(a));
      const [ack] = await stable(() => host.handle(cross({ type: 'order', seq: 3, order })).map(cross));
      // Corrección autorizada el 19/10/2026: el retardo del semáforo se sortea al crear la carrera, así que se compara el
      // estado de la carrera y el semáforo (como en N2), no el guardado completo.
      const sa = createSnapshot(a), sb = createSnapshot(b);
      const same = JSON.stringify(sa.state) === JSON.stringify(sb.state) && sa.clock.lightState === sb.clock.lightState;
      assert(ack?.ok === Boolean(expected) && same, `N3: orden «${name}» igual que la llamada directa`, JSON.stringify(ack));
    }
    const host = new EngineHost(seededRace());
    const [bad] = host.handle({ type: 'order', seq: 4, order: { kind: 'luckReward', eventId: 'no-existe' } });
    assert(bad.ok === false && bad.reason, 'N3: premio de suerte inexistente rechazado', JSON.stringify(bad));
    const [weather] = host.handle({ type: 'order', seq: 5, order: { kind: 'weatherTest', index: 1 } });
    assert(weather.ok === true, 'N3: tiempo de prueba de la carrera libre (G9) por orden', JSON.stringify(weather));
  });

  await test('N3: ningún componente ni pintor de la carrera toca el motor', () => {
    const files = ['src/components/RaceCanvas.tsx', 'src/components/BoxControls.tsx', 'src/components/PaceControls.tsx', 'src/components/Leaderboard.tsx',
      'src/components/BottomTelemetryDock.tsx', 'src/components/RightStatsPanel.tsx', 'src/components/RaceFlagsHUD.tsx',
      'src/components/StartLights.tsx', 'src/components/PodiumModal.tsx', 'src/components/WallPanel.tsx', 'src/components/StintTimeline.tsx',
      'src/components/RaceTabs.tsx', 'src/renderer/MinimapRenderer.ts', 'src/renderer/CarRenderer.ts', 'src/renderer/CarLabels.ts', 'src/renderer/carDraws.ts'];
    const touching = files.filter(f => /simulation\/RaceSimulation|\bsimulation\s*[:.]/.test(readFileSync(f, 'utf8')));
    assert(touching.length === 0, 'N3: ninguno importa RaceSimulation ni recibe o lee `simulation`', touching.join(', '));
  });
}
