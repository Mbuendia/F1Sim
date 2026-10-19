// N8 — Carrera en modo cliente (PROPUESTA DE CONTRATO, 19/10/2026).
// Decisiones del usuario del 19/10/2026: en la sala solo se corre GP directo (la clasificación compartida es N9); el
// invitado tiene una pantalla de carrera nueva, más sencilla; cuando pide pausa, el anfitrión ve el aviso y decide.
// Montaje: el motor del anfitrión (enlace local, el mismo de N3) en modo compartido (N6), el transporte de N5 sobre la
// base y la red simuladas, y en cada invitado la sesión de N3 sobre un enlace remoto. El reloj se mueve a mano.
//  1. Arranque: el anfitrión publica en la sala la carrera (circuito, tiempo y lista de salida) y la pone en carrera.
//  2. El anfitrión reparte la carrera: su pantalla recibe todo; cada invitado, las vistas comunes y solo la de su
//     equipo; el espectador, ninguna de equipo.
//  3. Órdenes del invitado: llegan al motor con quién las manda (N6). Una parada propia se cumple y el invitado la ve;
//     sobre otro equipo, velocidad o pausa, se rechazan. Con invitados, la carrera no pasa de x4.
//  4. Pedir pausa: avisa al anfitrión con el nombre; no se repite antes de 10 s.
//  5. Suavizado: con conexión directa y con respaldo, ningún coche salta ni retrocede entre fotogramas.
//  6. Pantalla del invitado (src/components/ClientRace.tsx): tiempos, muro de su equipo, «Pedir pausa» y estado del
//     enlace; sin herramientas, velocidad ni pausa. El espectador: tiempos sin muro. Aviso de pausa en el anfitrión.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';
import { createFakeServer } from '../support/fakeDb.mjs';
import { createDirectNet } from '../support/fakeDirect.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { LocalLink } = await load('/src/engine/LocalLink.ts');
  const { RaceSession, rosterOf } = await load('/src/engine/RaceSession.ts');
  const { ViewInterpolator } = await load('/src/engine/ViewInterpolator.ts');
  const { createRaceStore } = await load('/src/state/raceStore.ts');
  const { createLinkStore } = await load('/src/state/linkStore.ts');
  const { createSnapshot } = await load('/src/simulation/Snapshot.ts');
  const { createRoom, joinRoom } = await load('/src/net/RoomService.ts');
  const { watchLobby } = await load('/src/net/Lobby.ts');
  const { HostTransport, GuestTransport } = await load('/src/net/transport/Transport.ts');
  const shared = await load('/src/net/SharedRace.ts');
  const { ClientRaceScreen, PauseRequestBanner } = await load('/src/components/ClientRace.tsx');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const settle = () => new Promise(r => setTimeout(r, 0));
  const html = (C, props) => renderToStaticMarkup(createElement(C, props));
  const CONFIG = { fixedStepSec: 0.02, autoStartTyres: true, seededPreparation: true, autoTeamOrders: true, upgradeTradeoffs: {}, luckVariantEnabled: false };

  const seededRace = (cars = 6) => {
    const sim = make('barcelona', cars);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(42); sim.setFixedStep(0.02);
    return sim;
  };

  /** Carrera compartida: anfitrión con el primer equipo, «Bea» (g1) con el segundo y un espectador (s1). */
  const race = async ({ blocked = false } = {}) => {
    const sim = seededRace();
    const T = [...new Set(sim.cars.map(c => c.team.id))];
    const roster = rosterOf(sim);
    const fake = createFakeServer();
    const net = createDirectNet();
    if (blocked) net.block();
    const clock = { t: 0, now() { return this.t; } };
    const hostDb = fake.client('host');
    const { code } = await createRoom(hostDb, { name: 'Ana', random: () => 0.3 });
    const transport = new HostTransport({ db: hostDb, code, direct: net.listener, clock, onOrder: () => ({ ok: false }) });
    await transport.start();
    const link = new LocalLink();
    const hostStore = createRaceStore();
    const pauses = [];
    const host = new shared.SharedRaceHost({ link, transport, store: hostStore, clock, names: { g1: 'Bea', s1: 'Eva' }, onPauseRequest: (uid, name) => pauses.push({ uid, name }) });
    const guests = {};
    for (const [uid, seat] of [['g1', { teamId: T[1] }], ['s1', { spectator: true }]]) {
      const db = fake.client(uid);
      await joinRoom(db, code, { name: uid });
      transport.addGuest(uid, { teamId: seat.teamId ?? '' });
      const linkStore = createLinkStore();
      const gt = new GuestTransport({ db, code, direct: net.connector(uid), clock, linkStore });
      await gt.start();
      const remote = new shared.RemoteLink(gt);
      const store = createRaceStore();
      const session = new RaceSession({ link: remote, store, linkStore });
      const fastLog = [];
      remote.onMessage(m => { if (m?.type === 'fast') fastLog.push({ view: structuredClone(m.view), at: clock.t }); });
      guests[uid] = { db, gt, remote, store, session, linkStore, fastLog, started: session.start({ snapshot: null, config: CONFIG, roster }) };
    }
    const lobby = {};
    watchLobby(guests.g1.db, code, s => { lobby.g1 = s; });
    const started = host.start({
      db: hostDb, code, snapshot: createSnapshot(sim), config: CONFIG, roster, circuitId: 'barcelona', weather: 'seco',
      hostUid: 'host', hostTeamId: T[0], players: [{ uid: 'g1', teamId: T[1] }, { uid: 's1', spectator: true }],
    });
    link.flush();
    const step = async (ms = 1000 / 60) => {
      clock.t += ms;
      link.tick(ms / 1000); link.flush();
      transport.tick();
      for (const g of Object.values(guests)) g.gt.tick();
      net.flush(); await settle(); link.flush(); net.flush(); await settle();
    };
    await started;
    for (const g of Object.values(guests)) await g.started;
    for (let i = 0; i < 30; i++) await step();
    return { sim, T, roster, fake, net, clock, code, hostDb, transport, link, hostStore, host, guests, step, pauses, lobby };
  };
  const engine = r => r.link.host.sim;

  await test('N8: arranque de la carrera compartida', async () => {
    const r = await race();
    assert(r.lobby.g1?.status === 'race', 'N8: la sala pasa a «en carrera»', r.lobby.g1?.status);
    const published = r.lobby.g1?.race;
    assert(published?.circuitId === 'barcelona' && published.weather === 'seco' && published.format === 'directo', 'N8: el invitado lee circuito, tiempo y formato (siempre GP directo)', JSON.stringify(published)?.slice(0, 120));
    assert(published.roster?.length === r.roster.length && published.roster.every((e, i) => e.id === r.roster[i].id && e.driver?.code === r.roster[i].driver.code && e.team?.id === r.roster[i].team.id),
      'N8: y la lista de salida (piloto y equipo de cada coche)');
    assert(JSON.stringify(published.roster) === JSON.stringify(JSON.parse(JSON.stringify(r.roster))), 'N8: la lista viaja como datos planos (Firebase no admite valores sin definir)');
    assert(engine(r).isPlayerCar(r.sim.cars.find(c => c.team.id === r.T[1]).driver.id), 'N8: el motor arranca en modo compartido con los equipos elegidos');
  });

  await test('N8: el anfitrión reparte la carrera', async () => {
    const r = await race();
    for (let i = 0; i < 90; i++) await r.step();
    const { g1, s1 } = r.guests;
    assert(r.hostStore.getState().fast && r.hostStore.getState().slow && r.hostStore.getState().teams[r.T[0]], 'N8: la pantalla del anfitrión recibe todo (y la vista de su equipo)');
    assert(g1.store.getState().fast && g1.store.getState().slow && s1.store.getState().slow, 'N8: los invitados reciben las vistas comunes');
    assert(Object.keys(g1.store.getState().teams).join() === r.T[1], 'N8: el jugador recibe solo la vista de su equipo', JSON.stringify(Object.keys(g1.store.getState().teams)));
    assert(Object.keys(s1.store.getState().teams).length === 0, 'N8: el espectador, ninguna de equipo');
    const ids = g1.store.getState().slow.cars.map(c => c.id).sort().join();
    assert(ids === r.sim.cars.map(c => c.id).sort().join(), 'N8: con todos los coches de la carrera');
  });

  await test('N8: órdenes del invitado', async () => {
    const r = await race();
    const { g1, s1 } = r.guests;
    const own = engine(r).cars.find(c => c.team.id === r.T[1]);
    const rival = engine(r).cars.find(c => c.team.id === r.T[0]);
    const pending = [];
    const order = (g, o) => { const p = g.session.order(o); pending.push(p); return p; };
    const a = order(g1, { kind: 'box', carId: rival.id, compound: 'hard' });
    const b = order(g1, { kind: 'speed', value: 2 });
    const c = order(g1, { kind: 'pause', paused: true });
    const d = order(s1, { kind: 'pace', carId: own.id, mode: 'push' });
    for (let i = 0; i < 20; i++) await r.step();
    const [ra, rb, rc, rd] = await Promise.all([a, b, c, d]);
    assert(!ra.ok && !rb.ok && !rc.ok && !rd.ok, 'N8: otro equipo, velocidad, pausa y órdenes de un espectador se rechazan', JSON.stringify([ra, rb, rc, rd]));
    assert(!rival.pitStop.activeBoxOrder && !engine(r).isPaused, 'N8: y no cambian nada');
    const speed = await (async () => { const p = r.host.order({ kind: 'speed', value: 8 }); for (let i = 0; i < 5; i++) await r.step(); return p; })();
    assert(speed.ok && engine(r).speedMultiplier === 4, 'N8: con invitados, la carrera del anfitrión no pasa de x4', String(engine(r).speedMultiplier));
    const box = order(g1, { kind: 'box', carId: own.id, compound: 'hard' });
    for (let i = 0; i < 20; i++) await r.step();
    const rbox = await box;
    assert(rbox.ok && own.pitStop.activeBoxOrder, 'N8: la parada sobre su propio coche se acepta', JSON.stringify(rbox));
    const teamCar = () => g1.store.getState().teams[r.T[1]]?.cars.find(c => c.id === own.id);
    assert(teamCar()?.boxOrder, 'N8: el invitado ve su orden de boxes en el muro');
    let stops = 0;
    for (let i = 0; i < 4000 && !stops; i++) { await r.step(50); stops = g1.store.getState().slow?.cars.find(c => c.id === own.id)?.totalPitStops ?? 0; }
    assert(stops >= 1, 'N8: y la ve cumplirse: el coche para', String(stops));
  });

  await test('N8: pedir pausa', async () => {
    const r = await race();
    const { g1 } = r.guests;
    const first = shared.requestPause(g1.session);
    for (let i = 0; i < 10; i++) await r.step();
    assert((await first).ok && r.pauses.length === 1 && r.pauses[0].name === 'Bea', 'N8: el anfitrión recibe el aviso con el nombre de quien la pide', JSON.stringify(r.pauses));
    assert(r.host.pauseRequests.some(p => p.uid === 'g1' && p.name === 'Bea'), 'N8: y queda en su lista de peticiones');
    assert(!engine(r).isPaused, 'N8: pedir pausa no pausa: decide el anfitrión');
    const again = shared.requestPause(g1.session);
    for (let i = 0; i < 10; i++) await r.step();
    assert(!(await again).ok && r.pauses.length === 1, 'N8: antes de 10 s no se repite el aviso');
    for (let i = 0; i < 10; i++) await r.step(1000);
    const later = shared.requestPause(g1.session);
    for (let i = 0; i < 10; i++) await r.step();
    assert((await later).ok && r.pauses.length === 2, 'N8: pasados 10 s, se puede volver a pedir');
  });

  /** Pinta a 60 Hz lo que recibe el invitado y comprueba que ningún coche salta ni retrocede. */
  const smooth = async (r, label) => {
    const g = r.guests.g1;
    g.fastLog.length = 0;
    const frames = [];
    const interp = new ViewInterpolator();
    let next = 0;
    for (let i = 0; i < 600; i++) {
      await r.step();
      while (next < g.fastLog.length) { interp.push(g.fastLog[next].view, g.fastLog[next].at); next++; }
      if (i > 120) frames.push(new Map(interp.frame(r.clock.t).cars.map(c => [c.id, c.progress])));
    }
    let backwards = 0, worst = 0, steps = [];
    for (let i = 1; i < frames.length; i++) for (const [id, p] of frames[i]) {
      const d = p - (frames[i - 1].get(id) ?? p);
      if (d < -1e-9) backwards++;
      steps.push(d);
    }
    const mean = steps.reduce((a, b) => a + b, 0) / Math.max(1, steps.length);
    worst = Math.max(...steps);
    assert(g.fastLog.length > 0 && backwards === 0, `N8: ${label}: ningún coche retrocede`, `${backwards} retrocesos en ${frames.length} fotogramas`);
    assert(mean > 0 && worst <= 4 * mean, `N8: ${label}: ni salta (el mayor avance por fotograma no pasa de 4 veces la media)`, `media ${mean.toExponential(2)}, mayor ${worst.toExponential(2)}`);
    return g.fastLog.length;
  };

  await test('N8: suavizado con conexión directa', async () => {
    const r = await race();
    const views = await smooth(r, 'en directo');
    assert(views >= 140 && views <= 160, 'N8: en directo llegan unas 15 fotos por segundo', String(views));
  });

  await test('N8: suavizado con respaldo', async () => {
    const r = await race({ blocked: true });
    for (let i = 0; i < 400; i++) await r.step();
    assert(r.guests.g1.gt.mode === 'fallback', 'N8: con la directa bloqueada, el invitado va por el respaldo', r.guests.g1.gt.mode);
    const views = await smooth(r, 'con respaldo');
    assert(views >= 18 && views <= 22, 'N8: por el respaldo llegan unas 2 fotos por segundo', String(views));
  });

  await test('N8: pantalla del invitado', async () => {
    const r = await race();
    for (let i = 0; i < 90; i++) await r.step();
    const st = r.guests.g1.store.getState();
    const base = { roster: r.roster, fast: st.fast, slow: st.slow, teams: st.teams, myTeamId: r.T[1], link: 'direct', pauseRequested: false, onOrder: async () => ({ ok: true }), onRequestPause: () => {}, onLeave: () => {} };
    const out = html(ClientRaceScreen, { ...base, role: 'player' });
    const timing = out.slice(out.indexOf('data-timing'));
    const leader = st.slow.cars.slice().sort((a, b) => a.position - b.position)[0];
    assert(out.includes('data-timing') && timing.indexOf(leader.code) >= 0 && timing.indexOf(leader.code) <= Math.min(...st.slow.cars.map(c => timing.indexOf(c.code)).filter(i => i >= 0)),
      'N8: tiempos con todos los coches, empezando por el líder');
    const wall = out.slice(out.indexOf('data-wall'));
    const own = r.sim.cars.filter(c => c.team.id === r.T[1]);
    assert(out.includes('data-wall') && own.every(c => wall.includes(c.driver.code)), 'N8: el muro de su equipo, con sus dos coches');
    assert(out.includes('Pedir pausa') && out.includes('Directo'), 'N8: «Pedir pausa» y el estado del enlace');
    assert(!/Herramientas|Velocidad|×4|x4|Pausar|Reanudar/.test(out), 'N8: sin herramientas, control de velocidad ni pausa');
    const asked = html(ClientRaceScreen, { ...base, role: 'player', pauseRequested: true });
    assert(asked.includes('Pausa pedida') && /<button[^>]*disabled=""[^>]*>(<[^>]+>)*[^<]*Pausa pedida/.test(asked), 'N8: tras pedirla, el botón queda «Pausa pedida» y no se puede pulsar');
    assert(html(ClientRaceScreen, { ...base, role: 'player', link: 'fallback' }).includes('Respaldo'), 'N8: el indicador dice cuándo va por el respaldo');
    const spec = html(ClientRaceScreen, { ...base, role: 'spectator', myTeamId: null, teams: {} });
    assert(spec.includes('data-timing') && !spec.includes('data-wall') && !spec.includes('Pedir pausa') && spec.includes('Mirando'), 'N8: el espectador ve los tiempos, sin muro ni pausa');
    const banner = html(PauseRequestBanner, { requests: [{ uid: 'g1', name: 'Bea', at: 0 }], onDismiss: () => {} });
    assert(banner.includes('Bea pide pausa'), 'N8: el anfitrión ve quién pide pausa');
  });
}
