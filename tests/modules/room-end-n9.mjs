// N9 — Clasificación, final de carrera y cierre de sala (PROPUESTA DE CONTRATO, 19/10/2026).
// Decisiones del usuario del 19/10/2026: la sala ofrece GP directo y GP con clasificación (el sprint queda fuera); la
// clasificación es una simulación ya calculada: el anfitrión la calcula y la publica, y todos ven la misma (resultado,
// parrilla y comentarios), cada uno a su ritmo; al acabar, podio y resultado comunes y el anfitrión elige «Otra
// carrera» (todos vuelven a la sala con sus equipos) o «Cerrar sala»; se conectan ya las caídas de N6 (el equipo de
// quien se cae pasa al estratega y lo recupera al volver con la misma sesión).
// Montaje como N8: motor del anfitrión en el enlace local en modo compartido, transporte de N5 sobre la base y la red
// simuladas, sesión de N3 en el invitado sobre el enlace remoto; el reloj se mueve a mano.
//  1. Misma clasificación y misma parrilla para todos.
//  2. Mismo resultado para todos al acabar.
//  3. Otra carrera: la sala vuelve a la fase de sala, con los equipos de cada uno.
//  4. Sala cerrada: si el anfitrión cierra o se cae, el invitado se entera y tiene un aviso claro con vuelta al menú.
//  5. Caídas: el equipo de quien se va pasa al estratega; vuelve con la misma sesión y lo recupera.
//  6. Pantallas: formatos de la sala, final de carrera del anfitrión y del invitado, aviso de sala cerrada.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';
import { createFakeServer } from '../support/fakeDb.mjs';
import { createDirectNet } from '../support/fakeDirect.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { LocalLink } = await load('/src/engine/LocalLink.ts');
  const { RaceSession, rosterOf } = await load('/src/engine/RaceSession.ts');
  const { createRaceStore } = await load('/src/state/raceStore.ts');
  const { createLinkStore } = await load('/src/state/linkStore.ts');
  const { createSnapshot } = await load('/src/simulation/Snapshot.ts');
  const { runQualifying } = await load('/src/simulation/Qualifying.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { createRoom, joinRoom, leaveRoom } = await load('/src/net/RoomService.ts');
  const lobbyApi = await load('/src/net/Lobby.ts');
  const { HostTransport, GuestTransport } = await load('/src/net/transport/Transport.ts');
  const shared = await load('/src/net/SharedRace.ts');
  const screens = await load('/src/components/RoomScreens.tsx');
  const { ClientRaceScreen, SharedRaceEnd } = await load('/src/components/ClientRace.tsx');
  const { TEAMS } = await load('/src/data/teams.ts');
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

  /** Parrilla completa de 20 coches: el motor solo acepta una parrilla de salida con todos (autorizado por el usuario el
   *  19/10/2026 para el caso de la parrilla; el montaje de 6 coches no la admite). */
  const fullRace = () => { const sim = new RaceSimulation('barcelona'); sim.setSeed(42); sim.setFixedStep(0.02); return sim; };

  /** Sala con anfitrión (primer equipo) y «Bea» (g1, segundo equipo) ya repartidos, lista para correr. */
  const room = async ({ format = 'directo', full = false } = {}) => {
    const sim = full ? fullRace() : seededRace();
    const T = [...new Set(sim.cars.map(c => c.team.id))];
    const roster = rosterOf(sim);
    const fake = createFakeServer();
    const net = createDirectNet();
    const clock = { t: 0, now() { return this.t; } };
    const hostDb = fake.client('host');
    const { code } = await createRoom(hostDb, { name: 'Ana', random: () => 0.3 });
    const transport = new HostTransport({ db: hostDb, code, direct: net.listener, clock, onOrder: () => ({ ok: false }) });
    await transport.start();
    const seats = { teams: { [T[0]]: 'host', [T[1]]: 'g1' }, spectators: [], handled: {} };
    await lobbyApi.saveSeats(hostDb, code, seats);
    const link = new LocalLink();
    const hostStore = createRaceStore();
    const host = new shared.SharedRaceHost({ link, transport, store: hostStore, clock, names: { g1: 'Bea' } });
    const gdb = fake.client('g1');
    await joinRoom(gdb, code, { name: 'Bea' });
    transport.addGuest('g1', { teamId: T[1] });
    const linkStore = createLinkStore();
    const gt = new GuestTransport({ db: gdb, code, direct: net.connector('g1'), clock, linkStore });
    await gt.start();
    const guestStore = createRaceStore();
    const session = new RaceSession({ link: new shared.RemoteLink(gt), store: guestStore, linkStore });
    const seen = {};
    lobbyApi.watchLobby(gdb, code, s => { seen.g1 = s; });
    lobbyApi.watchLobby(hostDb, code, s => { seen.host = s; });
    const step = async (ms = 1000 / 60) => {
      clock.t += ms;
      link.tick(ms / 1000); link.flush();
      transport.tick(); gt.tick();
      net.flush(); await settle(); link.flush(); net.flush(); await settle();
    };
    const start = async (extra = {}) => {
      const started = host.start({ db: hostDb, code, snapshot: createSnapshot(sim), config: CONFIG, roster, circuitId: 'barcelona', weather: 'seco', format,
        hostUid: 'host', hostTeamId: T[0], players: [{ uid: 'g1', teamId: T[1] }], ...extra });
      link.flush();
      await started;
      await session.start({ snapshot: null, config: CONFIG, roster });
      for (let i = 0; i < 30; i++) await step();
    };
    return { sim, T, roster, fake, net, clock, code, hostDb, gdb, transport, link, hostStore, host, gt, guestStore, session, seen, step, start, seats };
  };
  const engine = r => r.link.host.sim;

  await test('N9: misma clasificación y misma parrilla para todos', async () => {
    const r = await room({ format: 'clasificacion', full: true });
    const quali = runQualifying(r.sim.qualifyingEntrants(), 1234, { format: 'gp' });
    const order = quali.grid.slice().sort((a, b) => a.position - b.position).map(g => g.driverId);
    await r.host.publishQualifying({ db: r.hostDb, code: r.code, result: quali, roster: r.roster, circuitId: 'barcelona', weather: 'seco' });
    await settle();
    const race = r.seen.g1?.race;
    assert(race?.format === 'clasificacion' && race.stage === 'clasificacion', 'N9: la sala anuncia la clasificación', JSON.stringify(race && { format: race.format, stage: race.stage }));
    assert(JSON.stringify(race.qualifying) === JSON.stringify(JSON.parse(JSON.stringify(quali))), 'N9: el invitado recibe la misma clasificación (sesiones, tiempos y parrilla)');
    r.sim.setStartingGrid(order);
    await r.start();
    assert(JSON.stringify(engine(r).startingGrid) === JSON.stringify(order), 'N9: el motor sale con la parrilla de esa clasificación', JSON.stringify(engine(r).startingGrid));
    assert(r.seen.g1?.race?.stage === 'carrera' && JSON.stringify(r.seen.g1.race.qualifying?.grid) === JSON.stringify(JSON.parse(JSON.stringify(quali.grid))),
      'N9: al salir a pista la sala pasa a carrera y conserva la clasificación', r.seen.g1?.race?.stage);
  });

  await test('N9: mismo resultado para todos', async () => {
    const r = await room();
    await r.start();
    for (let i = 0; i < 60; i++) await r.step();
    const end = async o => { const p = r.host.order(o); for (let i = 0; i < 10; i++) await r.step(); return p; };
    assert((await end({ kind: 'devRedFlag', reason: 'PRUEBA' })).ok, 'N9: el anfitrión puede terminar la carrera (bandera roja)');
    assert((await end({ kind: 'endSuspended' })).ok, 'N9: y darla por acabada');
    for (let i = 0; i < 90; i++) await r.step();
    const hostSlow = r.hostStore.getState().slow, guestSlow = r.guestStore.getState().slow;
    assert(hostSlow?.finished && guestSlow?.finished, 'N9: los dos saben que ha acabado', `${hostSlow?.finished} ${guestSlow?.finished}`);
    assert(hostSlow.result && JSON.stringify(guestSlow.result) === JSON.stringify(hostSlow.result), 'N9: el mismo resultado en los dos');
    assert(JSON.stringify(guestSlow.podiumIds) === JSON.stringify(hostSlow.podiumIds), 'N9: y el mismo podio');
  });

  await test('N9: otra carrera en la misma sala', async () => {
    const r = await room();
    await r.start();
    for (let i = 0; i < 30; i++) await r.step();
    await lobbyApi.returnToLobby(r.hostDb, r.code);
    await settle();
    assert(r.seen.g1?.status === 'lobby' && r.seen.g1.phase === 'sala' && r.seen.g1.race === null, 'N9: la sala vuelve a la fase de sala, sin carrera', JSON.stringify({ s: r.seen.g1?.status, p: r.seen.g1?.phase }));
    assert(JSON.stringify(r.seen.g1.seats?.teams) === JSON.stringify(r.seats.teams), 'N9: cada uno conserva su equipo', JSON.stringify(r.seen.g1.seats?.teams));
    const late = r.fake.client('g2');
    assert((await joinRoom(late, r.code, { name: 'Carla' })).ok, 'N9: y se puede volver a entrar en ella');
  });

  await test('N9: sala cerrada', async () => {
    const a = await room();
    await a.start();
    await leaveRoom(a.hostDb, a.code);
    await settle();
    assert(a.seen.g1?.closed === true, 'N9: si el anfitrión cierra la sala, el invitado se entera');
    const b = await room();
    await b.start();
    b.hostDb.disconnect();
    await settle();
    assert(b.seen.g1?.closed === true, 'N9: y también si el anfitrión se cae (la sala se borra al desconectarse)');
    const notice = html(ClientRaceScreen, { role: 'player', myTeamId: b.T[1], roster: b.roster, fast: null, slow: b.guestStore.getState().slow, teams: {}, link: 'down',
      pauseRequested: false, closed: true, onOrder: async () => ({ ok: true }), onRequestPause: () => {}, onLeave: () => {} });
    assert(notice.includes('El anfitrión ha cerrado la sala') && notice.includes('Volver al menú'), 'N9: el invitado ve un aviso claro con la vuelta al menú');
  });

  await test('N9: caídas y vueltas de un jugador', async () => {
    const r = await room();
    await r.start();
    for (let i = 0; i < 30; i++) await r.step();
    const cars = () => engine(r).cars.filter(c => c.team.id === r.T[1]);
    assert(cars().every(c => !c.wallDelegated), 'N9: en carrera, el jugador lleva su equipo');
    r.gdb.disconnect();
    for (let i = 0; i < 20; i++) await r.step();
    assert(cars().every(c => c.wallDelegated), 'N9: si se cae, su equipo pasa al estratega');
    assert(r.host.droppedPlayers?.includes('g1'), 'N9: el anfitrión sabe quién se ha caído', JSON.stringify(r.host.droppedPlayers));
    const back = r.fake.client('g1');
    const rejoined = await lobbyApi.rejoinRoom(back, r.code, { name: 'Bea' });
    assert(rejoined.ok, 'N9: con la misma sesión puede volver a una sala en carrera', JSON.stringify(rejoined));
    for (let i = 0; i < 20; i++) await r.step();
    assert(cars().every(c => !c.wallDelegated) && !r.host.droppedPlayers.includes('g1'), 'N9: y recupera su equipo');
    const stranger = await lobbyApi.rejoinRoom(r.fake.client('x9'), r.code, { name: 'X' });
    assert(!stranger.ok && stranger.reason === 'en-carrera', 'N9: quien no tenía sitio no entra en una sala en carrera', JSON.stringify(stranger));
  });

  await test('N9: pantallas', () => {
    const noop = () => {};
    const teams = Object.keys(TEAMS).map(id => ({ id, name: TEAMS[id].name, color: TEAMS[id].color }));
    const lobby = html(screens.HostLobby, { code: 'ABC234', link: 'x', qr: null, settings: { circuitId: 'monaco', format: 'clasificacion', weather: 'seco' }, teams, players: [], onSettings: noop, onOpenTeams: noop, onClose: noop });
    assert(lobby.includes('GP directo') && lobby.includes('Con clasificación') && !lobby.includes('Sprint'), 'N9: la sala ofrece GP directo y con clasificación, sin sprint');
    const hostEnd = html(SharedRaceEnd, { isHost: true, onAnother: noop, onClose: noop, onLeave: noop });
    assert(hostEnd.includes('Otra carrera') && hostEnd.includes('Cerrar sala'), 'N9: al acabar, el anfitrión elige otra carrera o cerrar la sala');
    const guestEnd = html(SharedRaceEnd, { isHost: false, onAnother: noop, onClose: noop, onLeave: noop });
    assert(guestEnd.includes('Esperando al anfitrión') && !guestEnd.includes('Otra carrera') && guestEnd.includes('Salir'), 'N9: el invitado espera la decisión del anfitrión (o sale)');
  });
}
