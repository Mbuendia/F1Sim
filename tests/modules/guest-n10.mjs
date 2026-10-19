// N10 — Arreglos tras la primera prueba entre redes del usuario (PROPUESTA DE CONTRATO, 19/10/2026).
// Lo que pasó: a los invitados se les quedaba toda la pantalla en negro al empezar la carrera y les costaba usar el muro
// en el móvil. Causa de lo primero: Firebase no guarda null ni listas u objetos vacíos; por el respaldo, la foto lenta
// llegaba sin `bestSectors` (al empezar vale [null, null, null]) y la aplicación del invitado caía entera. La base
// simulada de los tests no lo hacía; `tests/support/firebaseLike.mjs` sí. Decisiones del usuario del 19/10/2026: el
// invitado tiene en el móvil la pista arriba y dos pestañas, «Muro» (por defecto si juega) y «Tiempos».
//  1. Lo que pasa por Firebase (fotos del respaldo, vista de equipo, lista de salida, clasificación) llega idéntico.
//  2. Carrera compartida por el respaldo sobre una base que guarda como Firebase: el invitado recibe las fotos enteras,
//     también al acabar (podio y resultado).
//  3. Pantalla del invitado: pestañas Muro/Tiempos, un solo selector de ritmo y avisos durante la salida.
//  La maquetación a 375 px (controles de 44 px, el muro sin bajar por la clasificación) se mide en el navegador con
//  __uiAudit(): no forma parte de este módulo.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';
import { createFirebaseLikeServer, firebaseTransform } from '../support/firebaseLike.mjs';
import { createDirectNet } from '../support/fakeDirect.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { toDb, fromDb } = await load('/src/net/dbSafe.ts');
  const { EngineHost } = await load('/src/engine/EngineHost.ts');
  const { guestSlowView, guestTeamView } = await load('/src/engine/RaceView.ts');
  const { LocalLink } = await load('/src/engine/LocalLink.ts');
  const { RaceSession, rosterOf } = await load('/src/engine/RaceSession.ts');
  const { createRaceStore } = await load('/src/state/raceStore.ts');
  const { createLinkStore } = await load('/src/state/linkStore.ts');
  const { createSnapshot } = await load('/src/simulation/Snapshot.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { runQualifying } = await load('/src/simulation/Qualifying.ts');
  const { createRoom, joinRoom } = await load('/src/net/RoomService.ts');
  const { watchLobby } = await load('/src/net/Lobby.ts');
  const { HostTransport, GuestTransport } = await load('/src/net/transport/Transport.ts');
  const shared = await load('/src/net/SharedRace.ts');
  const { ClientRaceScreen } = await load('/src/components/ClientRace.tsx');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const settle = () => new Promise(r => setTimeout(r, 0));
  const html = (C, props) => renderToStaticMarkup(createElement(C, props));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const CONFIG = { fixedStepSec: 0.02, autoStartTyres: true, seededPreparation: true, autoTeamOrders: true, upgradeTradeoffs: {}, luckVariantEnabled: false };
  const throughFirebase = v => fromDb(firebaseTransform(toDb(v)) ?? null);

  const fullRace = () => {
    const sim = new RaceSimulation('barcelona');
    sim.setSeed(42); sim.setFixedStep(0.02); sim.lightState = 'racing';
    const T = [...new Set(sim.cars.map(c => c.team.id))];
    const host = new EngineHost(sim, { shared: { hostUid: 'h', hostTeamId: T[0] } });
    host.join('g', { teamId: T[1] });
    for (let i = 0; i < 5; i++) host.advance(0.1);
    return { sim, T, host };
  };

  await test('N10: lo que pasa por Firebase llega idéntico', () => {
    const { sim, T, host } = fullRace();
    const slow = guestSlowView(host.slowView()), team = guestTeamView(host.teamView(T[1]));
    assert(same(slow.bestSectors, [null, null, null]) && firebaseTransform(slow).bestSectors === undefined, 'N10: sin codificar, Firebase se come los mejores sectores (la causa de la pantalla negra)');
    assert(same(throughFirebase(slow), slow), 'N10: codificada, la foto lenta llega idéntica');
    assert(same(throughFirebase(team), team), 'N10: la vista de equipo también');
    assert(same(throughFirebase(host.fastView()), host.fastView()), 'N10: y la rápida');
    const roster = JSON.parse(JSON.stringify(rosterOf(sim)));
    assert(same(throughFirebase(roster), roster), 'N10: la lista de salida');
    const quali = JSON.parse(JSON.stringify(runQualifying(sim.qualifyingEntrants(), 7, { format: 'gp' })));
    assert(same(throughFirebase(quali), quali), 'N10: y la clasificación');
    const tricky = { a: null, b: [], c: {}, d: [null, 1, null], e: '~texto', f: '', g: [[], {}], h: 0, i: false };
    assert(same(throughFirebase(tricky), tricky), 'N10: también vacíos, huecos y textos que empiezan por la marca', JSON.stringify(throughFirebase(tricky)));
    assert(same(fromDb(toDb(42)), 42) && fromDb(null) === null, 'N10: los valores simples no cambian');
  });

  await test('N10: carrera por el respaldo sobre una base que guarda como Firebase', async () => {
    const sim = make('barcelona', 6);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(42); sim.setFixedStep(0.02);
    const T = [...new Set(sim.cars.map(c => c.team.id))];
    const roster = rosterOf(sim);
    const fake = createFirebaseLikeServer();
    const net = createDirectNet();
    net.block();
    const clock = { t: 0, now() { return this.t; } };
    const hostDb = fake.client('host');
    const { code } = await createRoom(hostDb, { name: 'Ana', random: () => 0.3 });
    const transport = new HostTransport({ db: hostDb, code, direct: net.listener, clock, onOrder: () => ({ ok: false }) });
    await transport.start();
    const link = new LocalLink();
    const hostStore = createRaceStore();
    const host = new shared.SharedRaceHost({ link, transport, store: hostStore, clock });
    const db = fake.client('g1');
    await joinRoom(db, code, { name: 'Bea' });
    transport.addGuest('g1', { teamId: T[1] });
    const linkStore = createLinkStore();
    const gt = new GuestTransport({ db, code, direct: net.connector('g1'), clock, linkStore });
    await gt.start();
    const guestStore = createRaceStore();
    const session = new RaceSession({ link: new shared.RemoteLink(gt), store: guestStore, linkStore });
    let lobby = null;
    watchLobby(db, code, s => { lobby = s; });
    const started = host.start({ db: hostDb, code, snapshot: createSnapshot(sim), config: CONFIG, roster, circuitId: 'barcelona', weather: 'seco',
      hostUid: 'host', hostTeamId: T[0], players: [{ uid: 'g1', teamId: T[1] }] });
    link.flush();
    await started;
    await session.start({ snapshot: null, config: CONFIG, roster });
    const step = async (ms = 1000 / 60) => {
      clock.t += ms;
      link.tick(ms / 1000); link.flush();
      transport.tick(); gt.tick();
      net.flush(); await settle(); link.flush(); net.flush(); await settle();
    };
    for (let i = 0; i < 500; i++) await step();
    assert(gt.mode === 'fallback', 'N10: el invitado va por el respaldo', gt.mode);
    assert(same(lobby?.race?.roster, JSON.parse(JSON.stringify(roster))), 'N10: la lista de salida llega entera por la sala');
    const gs = guestStore.getState().slow;
    assert(gs && Array.isArray(gs.bestSectors) && gs.bestSectors.length === 3 && Array.isArray(gs.notices) && Array.isArray(gs.podiumIds) && gs.cars.every(c => Array.isArray(c.laps)),
      'N10: la foto lenta del invitado llega entera (mejores sectores, avisos, podio, vueltas)', JSON.stringify(gs && { b: gs.bestSectors, n: gs.notices, p: gs.podiumIds }));
    const team = guestStore.getState().teams[T[1]];
    assert(team && team.cars.every(c => Array.isArray(c.proposals) && Array.isArray(c.pit.stopLog)), 'N10: y la de su equipo (propuestas y paradas)');
    const end = async o => { const p = host.order(o); for (let i = 0; i < 10; i++) await step(); return p; };
    await end({ kind: 'devRedFlag', reason: 'PRUEBA' });
    await end({ kind: 'endSuspended' });
    for (let i = 0; i < 120; i++) await step();
    const hs = hostStore.getState().slow, fin = guestStore.getState().slow;
    assert(fin?.finished && Array.isArray(fin.podiumIds) && same(fin.podiumIds, hs.podiumIds) && same(fin.result, guestSlowView(hs).result), 'N10: al acabar, el mismo podio y resultado por el respaldo');
  });

  await test('N10: pantalla del invitado en el móvil', () => {
    const { sim, T, host } = fullRace();
    const roster = rosterOf(sim);
    const base = { roster, fast: host.fastView(), slow: guestSlowView(host.slowView()), teams: { [T[1]]: guestTeamView(host.teamView(T[1])) }, link: 'direct',
      pauseRequested: false, onOrder: async () => ({ ok: true }), onRequestPause: () => {}, onLeave: () => {} };
    const player = html(ClientRaceScreen, { ...base, role: 'player', myTeamId: T[1] });
    const tab = name => player.match(new RegExp(`<button[^>]*role="tab"[^>]*>(<[^>]+>)*${name}`));
    assert(tab('Muro') && tab('Tiempos'), 'N10: pestañas «Muro» y «Tiempos»');
    assert(/aria-selected="true"[^>]*>(<[^>]+>)*Muro/.test(player) || /<button[^>]*aria-selected="true"[^>]*>[^<]*(<[^>]+>)*Muro/.test(player), 'N10: si juega, empieza en el muro');
    assert(/<section[^>]*data-timing[^>]*hidden=""|<section[^>]*hidden=""[^>]*data-timing/.test(player) && player.includes('data-wall'), 'N10: los tiempos quedan en su pestaña, sin empujar el muro hacia abajo');
    // Un selector de ritmo por piloto (el bloque de paradas tiene una pestaña por piloto), sin el duplicado de debajo.
    // Corregido con autorización del usuario del 19/10/2026: antes pedía uno en total.
    const pilots = sim.cars.filter(c => c.team.id === T[1]).length;
    assert((player.match(/>Ahorro</g) ?? []).length === pilots, 'N10: un selector de ritmo por piloto en el muro', `${(player.match(/>Ahorro</g) ?? []).length} para ${pilots} pilotos`);
    const spec = html(ClientRaceScreen, { ...base, role: 'spectator', myTeamId: null, teams: {} });
    assert(!spec.includes('role="tab"') && spec.includes('data-timing') && !/data-timing[^>]*hidden=""/.test(spec), 'N10: el espectador ve los tiempos directamente');
    const at = light => html(ClientRaceScreen, { ...base, role: 'player', myTeamId: T[1], slow: { ...base.slow, light } });
    assert(at('formation-lap').includes('Vuelta de formación'), 'N10: durante la vuelta de formación lo dice');
    assert(at('grid-ready').includes('Esperando la salida del anfitrión'), 'N10: en parrilla, espera la salida del anfitrión');
    assert(/Luces/.test(at('lights-3')) && !/Vuelta de formación|Esperando la salida/.test(at('lights-3')), 'N10: con las luces encendiéndose, las luces');
    assert(!/Vuelta de formación|Esperando la salida del anfitrión/.test(at('racing')), 'N10: en carrera, sin avisos de salida');
    assert(/Vuelta \d+\/\d+/.test(player), 'N10: la vuelta, compacta en una línea (2/66)');
  });
}
