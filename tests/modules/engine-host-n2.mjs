// N2 — Motor detrás de mensajes: EngineHost, vista del estado y órdenes (PROPUESTA DE CONTRATO, 19/10/2026).
// EngineHost envuelve RaceSimulation sin tocar el DOM: recibe mensajes (órdenes, guardar, cargar), avanza el motor y
// devuelve mensajes (acuses, vistas). El Worker real solo lo conecta a postMessage; aquí se prueba directamente y cada
// mensaje pasa por structuredClone, como al cruzar la frontera del Worker.
//  1. Misma semilla y mismas órdenes → misma carrera que llamando al motor directamente.
//  2. Vista rápida (15/s): posición, ángulo, velocidad y estado de cada coche; ≤ 1,5 KB con 20 coches (N1).
//  3. Vista lenta (1/s y al cambiar bandera o semáforo): vuelta, banderas, clima y datos de cada coche.
//  4. Lo privado de cada equipo (muro, propuestas, órdenes, ritmo) va solo en la vista de ese equipo.
//  5. Cada orden tiene el mismo efecto que la llamada directa y un acuse; las inválidas se rechazan sin cambiar nada.
//  6. Guardar y cargar a través de mensajes; la carrera cargada continúa igual que sin interrumpir.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { EngineHost } = await server.ssrLoadModule('/src/engine/EngineHost.ts');
  const { decodeFast } = await server.ssrLoadModule('/src/engine/RaceView.ts');
  const { createSnapshot } = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const cross = m => structuredClone(m); // frontera del Worker

  const seededRace = (cars = 6) => {
    const sim = make('barcelona', cars);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(42); sim.setFixedStep(0.02);
    return sim;
  };
  const runTo = (sim, steps) => { while (sim.fixedStepCount < steps) sim.update(1 / 60); };
  const hostTo = (host, steps) => { const out = []; while (host.sim.fixedStepCount < steps) out.push(...host.advance(1 / 60).map(cross)); return out; };
  const send = (host, msg) => host.handle(cross(msg)).map(cross);
  const fingerprint = sim => JSON.stringify(sim.cars.map(c => [c.id, c.progress, c.currentPosition, c.tires, c.lapHistory.map(l => l.lapTime)]));
  const keysDeep = (value, out = new Set()) => {
    if (Array.isArray(value)) value.forEach(v => keysDeep(v, out));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { out.add(k); keysDeep(v, out); }
    return out;
  };
  // De los rivales se ve el compuesto y las vueltas que lleva (como en la tele); su desgaste solo se estima (muro, T4.15).
  // Decisión del usuario, 19/10/2026.
  const PRIVATE = ['setup', 'proposals', 'reading', 'boxOrder', 'paceMode', 'delegated', 'teamOrder', 'health', 'wearRate'];

  await test('N2: con la misma semilla y las mismas órdenes, la carrera tras los mensajes es idéntica', () => {
    const direct = seededRace();
    runTo(direct, 800); direct.issuePaceOrder(direct.cars[1].id, 'push');
    runTo(direct, 1600); direct.issueBoxOrder(direct.cars[2].id, 'hard');
    runTo(direct, 3000);

    const host = new EngineHost(seededRace());
    hostTo(host, 800); const a = send(host, { type: 'order', seq: 1, order: { kind: 'pace', carId: host.sim.cars[1].id, mode: 'push' } });
    hostTo(host, 1600); const b = send(host, { type: 'order', seq: 2, order: { kind: 'box', carId: host.sim.cars[2].id, compound: 'hard' } });
    hostTo(host, 3000);
    assert(a[0]?.type === 'ack' && a[0].seq === 1 && a[0].ok === true && b[0]?.ok === true, 'N2: las dos órdenes reciben acuse positivo', JSON.stringify([a, b]));
    assert(fingerprint(host.sim) === fingerprint(direct), 'N2: misma carrera (progreso, posiciones, neumáticos y vueltas)');
  });

  await test('N2: vista rápida fiel al motor y de 1,5 KB como mucho con 20 coches', () => {
    const sim = seededRace(20);
    const host = new EngineHost(sim);
    hostTo(host, 500);
    const fast = cross(host.fastView());
    const bytes = JSON.stringify(fast).length;
    assert(bytes <= 1500, 'N2: vista rápida ≤ 1500 bytes en JSON con 20 coches', `${bytes} bytes`);
    const cars = decodeFast(fast);
    assert(cars.length === 20, 'N2: un registro por coche', String(cars.length));
    const off = cars.map(v => {
      const c = sim.cars.find(x => x.id === v.id);
      return Math.max(Math.abs(v.worldX - c.worldX), Math.abs(v.worldY - c.worldY), Math.abs(v.worldAngle - c.worldAngle) * 10,
        Math.abs(v.speedKmh - c.currentSpeedKmh) / 10) + (v.status === c.status ? 0 : 99) + (v.inPit === c.isInPitLane ? 0 : 99);
    });
    assert(Math.max(...off) <= 0.1, 'N2: posición (±0,1 m), ángulo (±0,01 rad), velocidad (±1 km/h), estado y boxes coinciden', Math.max(...off).toFixed(3));
    assert(typeof fast.t === 'number' && Math.abs(fast.t - sim.raceTimeSec) < 0.01, 'N2: lleva el tiempo de carrera para interpolar');
  });

  await test('N2: vista lenta con vuelta, banderas, clima y datos de cada coche', () => {
    const sim = seededRace(20);
    const host = new EngineHost(sim);
    hostTo(host, 500);
    const slow = cross(host.slowView());
    assert(slow.lap === sim.leaderLap && slow.totalLaps === sim.totalLaps && slow.light === sim.lightState
      && slow.flag === sim.raceFlagState && slow.paused === sim.isPaused && slow.finished === sim.isFinished,
    'N2: vuelta, total, semáforo, bandera, pausa y final', JSON.stringify({ lap: slow.lap, flag: slow.flag }));
    assert(slow.safetyCar && typeof slow.safetyCar === 'object' && slow.weather?.condition === sim.weather.condition, 'N2: Safety Car y clima');
    const ok = sim.cars.every(c => {
      const v = slow.cars.find(x => x.id === c.id);
      return v && v.position === c.currentPosition && v.compound === c.tires.compound && v.tyreLaps === c.tires.lapsOnTire
        && v.lastLap === (c.lastLapTime ?? null)
        && v.bestLap === (c.bestLapTime ?? null) && v.gapToLeader === c.gapToLeaderSec;
    });
    assert(ok && slow.cars.length === 20, 'N2: por coche, posición, compuesto, vueltas con esa goma, última y mejor vuelta y diferencia al líder');
  });

  await test('N2: lo privado de cada equipo no aparece en las vistas comunes ni en las de otro equipo', () => {
    const sim = seededRace(20);
    const host = new EngineHost(sim);
    hostTo(host, 500);
    const common = keysDeep([cross(host.fastView()), cross(host.slowView())]);
    const leaked = PRIVATE.filter(k => common.has(k));
    assert(leaked.length === 0, 'N2: las vistas comunes no llevan setup, muro, propuestas, órdenes, ritmo ni desgaste de gomas', leaked.join(', '));
    const teamId = sim.cars[0].team.id;
    const own = sim.cars.filter(c => c.team.id === teamId).map(c => c.id).sort();
    const view = cross(host.teamView(teamId));
    assert(view.teamId === teamId && JSON.stringify(view.cars.map(c => c.id).sort()) === JSON.stringify(own),
      'N2: la vista de un equipo trae solo sus coches', JSON.stringify(view.cars.map(c => c.id)));
    assert(view.cars.every(c => 'reading' in c && 'proposals' in c && 'paceMode' in c && 'boxOrder' in c && 'delegated' in c) && 'teamOrder' in view,
      'N2: la vista del equipo trae lectura del muro, propuestas, ritmo, orden de boxes, delegación y orden de equipo');
    assert(view.cars.every(c => {
      const car = sim.cars.find(x => x.id === c.id);
      return c.tyres && c.tyres.health === car.tires.health && c.tyres.compound === car.tires.compound;
    }), 'N2: el desgaste exacto de las gomas propias va en la vista del equipo');
    assert(!keysDeep(view).has('setup'), 'N2: ni siquiera la vista propia lleva el setup');
  });

  await test('N2: cadencia: 15 vistas rápidas y 1 lenta por segundo, más una lenta al cambiar bandera', () => {
    const sim = seededRace(6);
    const teamId = sim.cars[0].team.id;
    const host = new EngineHost(sim, { teams: [teamId] });
    hostTo(host, 100);
    const out = [];
    for (let i = 0; i < 120; i++) out.push(...host.advance(1 / 60).map(cross)); // 2 s reales
    const count = type => out.filter(m => m.type === type).length;
    assert(Math.abs(count('fast') - 30) <= 1, 'N2: ~15 vistas rápidas por segundo', String(count('fast')));
    assert(count('slow') >= 2 && count('slow') <= 3, 'N2: ~1 vista lenta por segundo', String(count('slow')));
    const teams = out.filter(m => m.type === 'team');
    assert(teams.length >= 2 && teams.every(m => m.teamId === teamId), 'N2: vista del equipo solo para los equipos pedidos, ~1 por segundo', String(teams.length));
    host.advance(1 / 60);
    sim.deploySafetyCar('Prueba');
    const next = host.advance(1 / 60).map(cross);
    assert(next.some(m => m.type === 'slow' && m.view.flag === sim.raceFlagState), 'N2: al cambiar la bandera sale una vista lenta en el siguiente avance');
  });

  await test('N2: cada orden tiene el mismo efecto que la llamada directa', () => {
    const [, one, two] = seededRace().cars.map(c => c.id);
    const orders = [
      [{ kind: 'box', carId: two, compound: 'hard' }, s => s.issueBoxOrder(two, 'hard') !== null],
      [{ kind: 'cancelBox', carId: two }, s => { s.issueBoxOrder(two, 'medium'); return s.cancelBoxOrder(two); }, s => s.issueBoxOrder(two, 'medium')],
      [{ kind: 'pace', carId: one, mode: 'save' }, s => s.issuePaceOrder(one, 'save')],
      [{ kind: 'delegate', carId: one, delegated: true }, s => s.setWallDelegation(one, true)],
      [{ kind: 'speed', value: 4 }, s => (s.setSpeed(4), true)],
      [{ kind: 'pause', paused: true }, s => ((s.isPaused = true), true)],
    ];
    for (const [order, direct, prepare] of orders) {
      const a = seededRace(); runTo(a, 300);
      const host = new EngineHost(seededRace()); hostTo(host, 300);
      if (prepare) prepare(host.sim);
      const expected = direct(a);
      const [ack] = send(host, { type: 'order', seq: 7, order });
      const same = JSON.stringify(createSnapshot(a).state) === JSON.stringify(createSnapshot(host.sim).state)
        && a.speedMultiplier === host.sim.speedMultiplier && a.isPaused === host.sim.isPaused;
      assert(ack?.type === 'ack' && ack.seq === 7 && ack.ok === !!expected && same, `N2: orden «${order.kind}» igual que la llamada directa`, JSON.stringify(ack));
    }
    const sim = seededRace(20);
    const teamId = sim.cars[0].team.id;
    const a = seededRace(20); const okDirect = a.setTeamOrder(teamId, 'mantener');
    const host = new EngineHost(sim);
    const [ack] = send(host, { type: 'order', seq: 8, order: { kind: 'teamOrder', teamId, mode: 'mantener' } });
    assert(ack.ok === okDirect && JSON.stringify(host.sim.getTeamOrder(teamId)) === JSON.stringify(a.getTeamOrder(teamId)), 'N2: orden de equipo igual que la llamada directa');
  });

  await test('N2: las órdenes inválidas se rechazan con motivo y sin cambiar la carrera', () => {
    const one = seededRace().cars[1].id;
    const bad = [
      { kind: 'box', carId: 999, compound: 'hard' },
      { kind: 'box', carId: one, compound: 'neumático-inventado' },
      { kind: 'pace', carId: one, mode: 'turbo' },
      { kind: 'acceptProposal', carId: one, proposalId: 'no-existe' },
      { kind: 'discardProposal', carId: one, proposalId: 'no-existe' },
      { kind: 'speed', value: -3 },
      { kind: 'volar' },
      null,
    ];
    for (const order of bad) {
      const host = new EngineHost(seededRace()); hostTo(host, 300);
      const before = JSON.stringify(createSnapshot(host.sim));
      let replies;
      try { replies = send(host, { type: 'order', seq: 9, order }); } catch (e) { replies = [{ thrown: e.message }]; }
      const ack = replies[0];
      assert(ack?.type === 'ack' && ack.seq === 9 && ack.ok === false && typeof ack.reason === 'string' && ack.reason.length > 0
        && JSON.stringify(createSnapshot(host.sim)) === before, `N2: rechazada sin efecto: ${JSON.stringify(order)}`, JSON.stringify(ack));
    }
    const host = new EngineHost(seededRace());
    let reply;
    try { reply = send(host, { type: 'mensaje-raro', seq: 10 }); } catch (e) { reply = [{ thrown: e.message }]; }
    assert(reply[0]?.type === 'error' && reply[0].seq === 10, 'N2: un mensaje desconocido responde con error, no rompe el motor', JSON.stringify(reply));
  });

  await test('N2: guardar y cargar por mensajes; la carrera cargada sigue igual que sin interrumpir', () => {
    const straight = seededRace(); runTo(straight, 3000);

    const host = new EngineHost(seededRace()); hostTo(host, 1500);
    const [saved] = send(host, { type: 'save', seq: 11 });
    assert(saved?.type === 'saved' && saved.seq === 11 && JSON.stringify(saved.snapshot) === JSON.stringify(createSnapshot(host.sim)),
      'N2: «save» devuelve el mismo snapshot que createSnapshot');

    const fresh = new EngineHost(new RaceSimulation('barcelona'));
    const [loaded] = send(fresh, { type: 'load', seq: 12, snapshot: saved.snapshot });
    assert(loaded?.type === 'loaded' && loaded.seq === 12 && loaded.ok === true, 'N2: «load» acepta el snapshot', JSON.stringify(loaded?.errors ?? loaded));
    hostTo(fresh, 3000);
    assert(fingerprint(fresh.sim) === fingerprint(straight), 'N2: la carrera cargada continúa exactamente igual');

    const [rejected] = send(fresh, { type: 'load', seq: 13, snapshot: { basura: true } });
    assert(rejected?.ok === false && Array.isArray(rejected.errors) && rejected.errors.length > 0 && fingerprint(fresh.sim) === fingerprint(straight),
      'N2: un snapshot inválido se rechaza con diagnóstico y no toca la carrera');
  });

  await test('N2: todo lo que sale del motor cruza la frontera del Worker sin perder nada', () => {
    const host = new EngineHost(seededRace(20), { teams: [seededRace(20).cars[0].team.id] });
    const out = hostTo(host, 400);
    const bad = out.filter(m => JSON.stringify(m) !== JSON.stringify(cross(m)) || keysDeep(m).has('driver') || keysDeep(m).has('team'));
    assert(out.length > 0 && bad.length === 0, 'N2: mensajes planos (sin objetos del motor como driver o team), idénticos tras structuredClone', String(bad.length));
  });
}
