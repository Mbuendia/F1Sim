// MJ2 — Pausa que se cumple (Sprint 15). Decisión del usuario (19/11/2026): «Pausa sola, con límite». Contrato aprobado
// ese día («Sí, adelante»):
//  1. El botón de pausa alterna: en marcha pausa; en pausa sigue a la velocidad que llevaba (como la barra espaciadora).
//  2. En una sala, «Pedir pausa» del invitado pausa la carrera al momento para todos.
//  3. Cada jugador tiene 2 pausas por carrera, de 60 s como mucho; la tercera se rechaza con el motivo y el botón queda
//     desactivado con lo que le queda.
//  4. Pueden seguir quien la pidió o el anfitrión; si nadie lo hace, la carrera sigue sola a los 60 s.
//  5. Todos ven el estado: «En pausa», quién la pidió, la cuenta atrás y «Seguir» para quien puede.
//  6. La pausa del anfitrión sigue como siempre, sin límite.
//  7. Capturas de la pausa vista por el anfitrión y por el invitado, en escritorio y en móvil.
// Montaje: el mismo de client-race-n8 (motor del anfitrión, transporte simulado y la sesión de cada invitado).
import { readFileSync, existsSync } from 'node:fs';
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

  const { GUEST_PAUSES, GUEST_PAUSE_SEC } = await load('/src/engine/EngineHost.ts');
  const { PauseStatus } = await load('/src/components/ClientRace.tsx');
  const src = f => readFileSync(f, 'utf8');
  const slowOf = g => g.store.getState().slow;
  const ask = async (r, fn) => { const p = fn(); for (let i = 0; i < 10; i++) await r.step(); return p; };

  await test('MJ2.1: el botón de pausa alterna', async () => {
    const toggles = src('src/components/SpeedControls.tsx').includes('onClick={() => onSpeedChange(isPaused ? currentSpeed : 0)}');
    const app = src('src/App.tsx');
    const space = app.includes('handleSpeedChange(isPaused ? 1 : 0)') && app.includes("speed === 0 ? { kind: 'pause', paused: true } : { kind: 'speed', value: speed }");
    const r = await race();
    await ask(r, () => r.host.order({ kind: 'pause', paused: true }));
    const paused = engine(r).isPaused;
    await ask(r, () => r.host.order({ kind: 'speed', value: 2 }));
    assert(toggles && space && paused && !engine(r).isPaused && engine(r).speedMultiplier === 2,
      'MJ2: en pausa, el botón manda seguir a la velocidad de antes (como la barra espaciadora) y el motor reanuda',
      `botón ${toggles} | espacio ${space} | pausa ${paused} | sigue ${!engine(r).isPaused}`);
  });

  await test('MJ2.2: pedir pausa pausa para todos', async () => {
    const r = await race();
    const ack = await ask(r, () => shared.requestPause(r.guests.g1.session));
    assert(ack.ok && engine(r).isPaused && slowOf(r.guests.g1).paused && slowOf(r.guests.s1).paused && r.hostStore.getState().slow.paused,
      'MJ2: al pedirla, el motor se pausa y lo ven el anfitrión, el invitado y el espectador', JSON.stringify(ack));
  });

  await test('MJ2.3: dos pausas por jugador; la tercera se rechaza', async () => {
    const r = await race();
    const g = r.guests.g1;
    const results = [];
    for (let k = 0; k < 3; k++) {
      results.push(await ask(r, () => shared.requestPause(g.session)));
      if (k < 2) await ask(r, () => shared.resumePause(g.session));
      for (let i = 0; i < 11; i++) await r.step(1000);
    }
    const left = slowOf(g).pausesLeft?.g1;
    const html = renderToStaticMarkup(createElement(ClientRaceScreen, { role: 'player', myTeamId: r.T[1], myUid: 'g1', roster: r.roster, fast: null, slow: slowOf(g),
      teams: g.store.getState().teams, link: 'direct', pauseRequested: false, track: null, onOrder: async () => ({ ok: true }), onRequestPause() {}, onLeave() {} }));
    const button = /<button[^>]*disabled=""[^>]*>(<[^>]+>)*[^<]*Sin pausas/.test(html);
    assert(GUEST_PAUSES === 2 && GUEST_PAUSE_SEC === 60 && results[0].ok && results[1].ok && !results[2].ok && /2 pausas/.test(results[2].reason ?? '') && left === 0 && button,
      'MJ2: 2 pausas de 60 s; la tercera se rechaza diciendo por qué y el botón queda «Sin pausas», desactivado', JSON.stringify({ results, left, button }));
  });

  await test('MJ2.4: siguen quien la pidió o el anfitrión, o sola a los 60 s', async () => {
    const r = await race();
    await ask(r, () => shared.requestPause(r.guests.g1.session));
    const spectator = await ask(r, () => shared.resumePause(r.guests.s1.session));
    const stillPaused = engine(r).isPaused;
    const own = await ask(r, () => shared.resumePause(r.guests.g1.session));
    const ownResumed = !engine(r).isPaused;
    for (let i = 0; i < 11; i++) await r.step(1000);
    await ask(r, () => shared.requestPause(r.guests.g1.session));
    const byHost = await ask(r, () => r.host.order({ kind: 'guestResume' }));
    const hostResumed = !engine(r).isPaused;
    const r2 = await race();
    await ask(r2, () => shared.requestPause(r2.guests.g1.session));
    for (let i = 0; i < 58; i++) await r2.step(1000);
    const before = engine(r2).isPaused;
    for (let i = 0; i < 4; i++) await r2.step(1000);
    assert(!spectator.ok && stillPaused && own.ok && ownResumed && byHost.ok && hostResumed && before && !engine(r2).isPaused,
      'MJ2: un espectador no puede seguir; quien la pidió y el anfitrión sí; sin nadie, sigue sola al pasar el minuto',
      JSON.stringify({ spectator, own, byHost, before, after: engine(r2).isPaused }));
  });

  await test('MJ2.5: todos ven quién la pidió, la cuenta atrás y cómo seguir', async () => {
    const r = await race();
    await ask(r, () => shared.requestPause(r.guests.g1.session));
    for (let i = 0; i < 5; i++) await r.step(1000);
    const seen = [slowOf(r.guests.g1), slowOf(r.guests.s1), r.hostStore.getState().slow].map(v => v.guestPause);
    const same = seen.every(p => p && p.uid === 'g1' && p.name === 'Bea' && p.remainingSec <= 56 && p.remainingSec >= 50);
    const mine = renderToStaticMarkup(createElement(PauseStatus, { pause: seen[0], canResume: true, onResume() {} }));
    const other = renderToStaticMarkup(createElement(PauseStatus, { pause: seen[1], canResume: false, onResume() {} }));
    const ui = mine.includes('En pausa') && mine.includes('Bea') && mine.includes(`${seen[0]?.remainingSec} s`) && mine.includes('>Seguir<') && other.includes('En pausa') && !other.includes('>Seguir<');
    const wired = src("src/App.tsx").includes("<PauseStatus pause={slowView?.guestPause ??")
      && src('src/components/ClientRace.tsx').includes('<PauseStatus pause={slow?.guestPause} canResume={Boolean(myUid && slow?.guestPause?.uid === myUid)}');
    assert(same && ui && wired, 'MJ2: anfitrión, invitado y espectador ven «En pausa», que la pidió Bea y los segundos que quedan; «Seguir» solo para quien puede',
      JSON.stringify({ seen, ui, wired }));
  });

  await test('MJ2.6: la pausa del anfitrión, sin límite', async () => {
    const r = await race();
    let ok = true;
    for (let k = 0; k < 4; k++) {
      const p = await ask(r, () => r.host.order({ kind: 'pause', paused: true }));
      ok = ok && p.ok && engine(r).isPaused;
      for (let i = 0; i < 3; i++) await r.step(1000);
      const q = await ask(r, () => r.host.order({ kind: 'pause', paused: false }));
      ok = ok && q.ok && !engine(r).isPaused;
    }
    const slow = r.hostStore.getState().slow;
    const noGuest = !slow.guestPause && !('host' in (slow.pausesLeft ?? {}));
    assert(ok && noGuest, 'MJ2: el anfitrión pausa y sigue cuantas veces quiera, sin cuenta atrás ni límite', `ok ${ok} | sin límite ${noGuest}`);
  });

  await test('MJ2.7: capturas de la pausa', () => {
    const dir = 'docs/design/mj2-capturas';
    const need = ['anfitrion-escritorio.png', 'invitado-escritorio.png', 'anfitrion-movil.png', 'invitado-movil.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ2: capturas de la pausa vista por el anfitrión y por el invitado, en escritorio y en móvil', missing.join(', '));
  });
}
