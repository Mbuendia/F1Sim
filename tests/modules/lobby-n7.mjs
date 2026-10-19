// N7 — Pantallas de sala (CONTRATO REVISADO, 19/10/2026).
// Decisiones del usuario del 19/10/2026: N7 llega hasta «Empezar» (la carrera compartida es N8); QR con
// qrcode-generator; quién lleva cada equipo, los ajustes y la fase van en la ficha de la sala (meta/seats,
// meta/settings y meta/phase), que las reglas de N4 ya permiten. Revisión del mismo día, tras probarlo el usuario: dos
// páginas. Primero la sala, donde se ve quién se conecta y el anfitrión elige circuito, formato y tiempo; el anfitrión
// pasa a todos a la elección de equipos (quien entra después va directo a ella), donde se ven los diez equipos con
// quién lleva cada uno, en tiempo real. El anfitrión elige equipo igual que los demás.
//  1. Sala (src/net/Lobby.ts) sobre la base simulada de N4: cada jugador (también el anfitrión) pide un asiento en su
//     presencia (un equipo o mirar; el anfitrión no puede mirar); el anfitrión los reparte por orden de petición, sin
//     dar un equipo cogido a otro, con los límites de N6, y libera los asientos de quien se va.
//  2. Fase de la sala y ajustes del anfitrión, que ven todos; se puede entrar mientras se eligen equipos.
//  3. QR del enlace de la sala (src/net/roomQr.ts).
//  4. Pantallas (src/components/RoomScreens.tsx y el menú), renderizadas con estados de sala simulados.
//  La maquetación a 375 px (textos sin cortar, controles de 44 px o más) se mide en el navegador con __uiAudit(): no
//  forma parte de este módulo.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createFakeServer } from '../support/fakeDb.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { createRoom, joinRoom, leaveRoom, setRoomStatus } = await load('/src/net/RoomService.ts');
  const lobby = await load('/src/net/Lobby.ts');
  const { qrSvg } = await load('/src/net/roomQr.ts');
  const screens = await load('/src/components/RoomScreens.tsx');
  const { GameMenuScreen } = await load('/src/components/GameMenuScreen.tsx');
  const { TEAMS } = await load('/src/data/teams.ts');
  const { MULTIPLAYER_LIMITS } = await load('/src/engine/EngineHost.ts');
  const settle = () => new Promise(r => setTimeout(r, 0));
  const html = (C, props) => renderToStaticMarkup(createElement(C, props));
  const teamIds = Object.keys(TEAMS);
  const teams = teamIds.map(id => ({ id, name: TEAMS[id].name, color: TEAMS[id].color }));

  /** Sala con anfitrión y los invitados dados, y lo que cada uno ve de ella. */
  const room = async (guests = []) => {
    const fake = createFakeServer();
    const hostDb = fake.client('host');
    const { code } = await createRoom(hostDb, { name: 'Ana', random: () => 0.3 });
    const dbs = { host: hostDb };
    for (const uid of guests) { dbs[uid] = fake.client(uid); await joinRoom(dbs[uid], code, { name: uid }); }
    const seen = {};
    for (const uid of ['host', ...guests]) lobby.watchLobby(dbs[uid], code, s => { seen[uid] = s; });
    await settle();
    /** Lo que hace la aplicación del anfitrión al cambiar la sala: repartir los asientos y guardarlos. */
    const arbitrate = async () => {
      const seats = lobby.resolveSeats({ hostUid: 'host', teamIds, lobby: seen.host });
      await lobby.saveSeats(hostDb, code, seats);
      await settle();
      return seats;
    };
    const ask = async (uid, want) => { await lobby.requestSeat(dbs[uid], code, want); await settle(); };
    return { fake, code, hostDb, dbs, seen, arbitrate, ask };
  };

  await test('N7: asientos de la sala', async () => {
    const r = await room(['g1', 'g2', 'g3']);
    assert(r.seen.host?.hostUid === 'host' && r.seen.host.members.length === 4 && r.seen.host.status === 'lobby', 'N7: el anfitrión ve la sala con sus invitados', JSON.stringify(r.seen.host)?.slice(0, 120));
    let seats = await r.arbitrate();
    assert(Object.keys(seats.teams).length === 0 && seats.spectators.length === 0, 'N7: al empezar nadie tiene equipo, tampoco el anfitrión', JSON.stringify(seats));

    await r.ask('host', { teamId: teamIds[0] });
    await r.ask('g1', { teamId: teamIds[1] });
    await r.ask('g2', { teamId: teamIds[1] });
    await r.ask('g3', { spectator: true });
    assert(r.seen.host.members.find(m => m.uid === 'g1')?.wants?.teamId === teamIds[1], 'N7: cada uno pide su asiento en su presencia', JSON.stringify(r.seen.host.members));
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[0]] === 'host', 'N7: el anfitrión elige equipo igual que los demás', JSON.stringify(seats));
    assert(seats.teams[teamIds[1]] === 'g1' && !Object.values(seats.teams).includes('g2'), 'N7: un equipo cogido no se da a otro; gana quien lo pidió antes', JSON.stringify(seats));
    assert(seats.spectators.join() === 'g3', 'N7: quien entra a mirar queda como espectador', JSON.stringify(seats));
    assert(r.seen.g2?.seats?.teams?.[teamIds[1]] === 'g1' && r.seen.g1?.seats?.teams?.[teamIds[0]] === 'host', 'N7: todos ven el reparto en tiempo real', JSON.stringify(r.seen.g2?.seats));
    assert(lobby.freeTeams(r.seen.g2, teamIds).length === teamIds.length - 2 && !lobby.freeTeams(r.seen.g2, teamIds).includes(teamIds[1]),
      'N7: los equipos cogidos dejan de estar libres', JSON.stringify(lobby.freeTeams(r.seen.g2, teamIds)));
    assert(lobby.seatOf(r.seen.g2, 'g2') === null, 'N7: el que pidió un equipo cogido sigue sin asiento hasta pedir otro');

    await r.ask('host', { teamId: teamIds[1] });
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[1]] === 'g1' && seats.teams[teamIds[0]] === 'host', 'N7: el anfitrión tampoco puede quitar un equipo: conserva el suyo', JSON.stringify(seats));
    await r.ask('host', { spectator: true });
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[0]] === 'host' && !seats.spectators.includes('host'), 'N7: el anfitrión no puede quedarse mirando', JSON.stringify(seats));

    await r.ask('g1', { teamId: teamIds[2] });
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[2]] === 'g1' && seats.teams[teamIds[1]] === undefined, 'N7: cambiar a otro equipo libre suelta el anterior', JSON.stringify(seats));
    await r.ask('g2', { teamId: teamIds[1] });
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[1]] === 'g2', 'N7: y otro lo puede tomar', JSON.stringify(seats));
    assert(lobby.seatOf(r.seen.g2, 'g2')?.teamId === teamIds[1] && lobby.seatOf(r.seen.g3, 'g3')?.spectator === true, 'N7: cada uno sabe qué asiento tiene');

    await leaveRoom(r.dbs.g1, r.code);
    await settle();
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[2]] === undefined && !seats.spectators.includes('g1'), 'N7: quien se va libera su asiento', JSON.stringify(seats));
    const unknown = lobby.resolveSeats({ hostUid: 'host', teamIds, lobby: { ...r.seen.host, members: [...r.seen.host.members, { uid: 'g9', name: 'g9', role: 'guest', joinedAt: 9e15, wants: { teamId: 'no-existe' } }] } });
    assert(!Object.values(unknown.teams).includes('g9'), 'N7: un equipo que no corre no se asigna');
  });

  await test('N7: límites de la sala', async () => {
    const members = [{ uid: 'host', name: 'Ana', role: 'host', joinedAt: 0 }];
    for (let i = 1; i <= 12; i++) members.push({ uid: `s${i}`, name: `s${i}`, role: 'guest', joinedAt: i, wants: { spectator: true } });
    const seats = lobby.resolveSeats({ hostUid: 'host', teamIds, lobby: { hostUid: 'host', status: 'lobby', members, seats: null, settings: null } });
    assert(seats.spectators.length === MULTIPLAYER_LIMITS.spectators && seats.spectators.join() === Array.from({ length: 10 }, (_, i) => `s${i + 1}`).join(),
      'N7: diez espectadores como mucho, por orden de llegada', JSON.stringify(seats.spectators));
  });

  await test('N7: fase y ajustes de la sala', async () => {
    const r = await room(['g1']);
    assert(r.seen.g1?.phase === 'sala', 'N7: la sala empieza en la fase de conexión', r.seen.g1?.phase);
    const def = lobby.DEFAULT_SETTINGS;
    assert(def && typeof def.circuitId === 'string' && ['directo', 'clasificacion', 'sprint'].includes(def.format) && typeof def.weather === 'string', 'N7: hay ajustes por defecto', JSON.stringify(def));
    await lobby.saveSettings(r.hostDb, r.code, { circuitId: 'monaco', format: 'clasificacion', weather: 'tormenta' });
    await settle();
    assert(JSON.stringify(r.seen.g1?.settings) === JSON.stringify({ circuitId: 'monaco', format: 'clasificacion', weather: 'tormenta' }), 'N7: el invitado ve circuito, formato y tiempo', JSON.stringify(r.seen.g1?.settings));
    await lobby.setPhase(r.hostDb, r.code, 'equipos');
    await settle();
    assert(r.seen.g1?.phase === 'equipos' && r.seen.host?.phase === 'equipos', 'N7: el anfitrión pasa a todos a la elección de equipos', r.seen.g1?.phase);
    assert(r.fake.read(`rooms/${r.code}/meta/host`) === 'host' && r.fake.read(`rooms/${r.code}/meta/status`) === 'lobby', 'N7: ni los ajustes ni la fase estropean la ficha de la sala');
    const late = r.fake.client('g2');
    const joined = await joinRoom(late, r.code, { name: 'g2' });
    let lateSeen = null;
    lobby.watchLobby(late, r.code, s => { lateSeen = s; });
    await settle();
    assert(joined.ok && lateSeen?.phase === 'equipos', 'N7: quien entra mientras se eligen equipos va directo a la elección', JSON.stringify(joined));
    await setRoomStatus(r.hostDb, r.code, 'race');
    await settle();
    assert(r.seen.g1?.status === 'race', 'N7: al empezar, el invitado se entera', r.seen.g1?.status);
    await leaveRoom(r.hostDb, r.code);
    await settle();
    assert(r.seen.g1?.closed === true, 'N7: si el anfitrión cierra la sala, el invitado se entera');
  });

  await test('N7: QR del enlace', () => {
    const svg = qrSvg('https://f1sim-d5085.web.app/?sala=ABC234');
    assert(typeof svg === 'string' && svg.startsWith('<svg') && svg.includes('</svg>') && /<path|<rect/.test(svg), 'N7: el enlace se convierte en un QR en SVG', String(svg).slice(0, 60));
    assert(qrSvg('https://f1sim-d5085.web.app/?sala=XYZ789') !== svg, 'N7: cada enlace da su QR');
  });

  await test('N7: menú', () => {
    const noop = () => {};
    const out = html(GameMenuScreen, { hasCurrent: false, hasSaves: false, onContinue: noop, onNew: noop, onLoad: noop, onFree: noop, onCreateRoom: noop, onJoinRoom: noop });
    assert(out.includes('Crear sala') && out.includes('Unirse a una sala') && out.includes('Carrera libre'), 'N7: el menú ofrece crear sala y unirse a una sala');
  });

  const players = [
    { uid: 'host', name: 'Ana', role: 'host', teamId: null, link: 'none' },
    { uid: 'g1', name: 'Bea', role: 'pending', teamId: null, link: 'direct' },
    { uid: 'g2', name: 'Carla', role: 'pending', teamId: null, link: 'fallback' },
    { uid: 'g3', name: 'Dani', role: 'pending', teamId: null, link: 'connecting' },
    { uid: 'g4', name: 'Eva', role: 'pending', teamId: null, link: 'down' },
  ];
  const settings = { circuitId: 'monaco', format: 'clasificacion', weather: 'tormenta' };
  const noop = () => {};

  await test('N7: sala del anfitrión', () => {
    const out = html(screens.HostLobby, {
      code: 'ABC234', link: 'https://f1sim-d5085.web.app/?sala=ABC234', qr: qrSvg('https://f1sim-d5085.web.app/?sala=ABC234'),
      settings, teams, players, onSettings: noop, onOpenTeams: noop, onClose: noop,
    });
    assert(out.includes('ABC234') && out.includes('https://f1sim-d5085.web.app/?sala=ABC234') && out.includes('<svg'), 'N7: el anfitrión ve código, enlace y QR');
    assert(/Mónaco|Monaco/.test(out) && out.includes('Tormenta'), 'N7: y elige circuito y tiempo');
    // [N8] Decisión del usuario del 19/10/2026: en la sala solo se corre GP directo hasta la clasificación compartida (N9).
    assert(out.includes('GP directo') && !/Con clasificación|Sprint/.test(out), 'N8: el formato es GP directo: la sala no ofrece clasificación ni sprint');
    for (const p of ['Ana', 'Bea', 'Carla', 'Dani', 'Eva']) assert(out.includes(p), `N7: ve conectarse a ${p}`);
    assert(out.includes('Directo') && out.includes('Respaldo') && out.includes('Conectando') && out.includes('Caído'), 'N7: con el estado de su enlace');
    assert(out.includes('Elegir equipos') && out.includes('Cerrar sala') && !out.includes('data-team='), 'N7: en la sala no se eligen equipos: el anfitrión abre la elección');
  });

  await test('N7: sala del invitado', () => {
    const join = html(screens.JoinRoomScreen, { initialCode: 'ABC234', name: '', error: null, busy: false, onJoin: noop, onBack: noop });
    assert(join.includes('value="ABC234"') && /maxLength="24"|maxlength="24"/.test(join), 'N7: el código llega del enlace y el nombre tiene 24 letras como mucho');
    assert(!/type="password"|type="email"/.test(join), 'N7: sin registrarse: ni correo ni contraseña');
    const msg = reason => html(screens.JoinRoomScreen, { initialCode: 'ABC234', name: 'Bea', error: reason, busy: false, onJoin: noop, onBack: noop });
    assert(/no es válido/.test(msg('codigo-invalido')) && /no existe/.test(msg('no-existe')) && /ya ha empezado/.test(msg('en-carrera')), 'N7: cada motivo de rechazo se explica');
    assert(/incógnito/.test(msg('misma-sesion')), 'N7: desde la misma sesión que el anfitrión no se entra: se explica que use incógnito u otro navegador');
    const wait = html(screens.GuestWaiting, { code: 'ABC234', players, settings, status: 'lobby', onLeave: noop });
    assert(wait.includes('Esperando a que el anfitrión abra la elección de equipos') && /Mónaco|Monaco/.test(wait) && wait.includes('Bea') && !wait.includes('data-team='),
      'N7: el invitado ve quién está y espera a la elección de equipos');
    assert(html(screens.GuestWaiting, { code: 'ABC234', players, settings, status: 'closed', onLeave: noop }).includes('La sala se ha cerrado'), 'N7: y se entera si se cierra');
  });

  await test('N7: elección de equipos', () => {
    const seats = { teams: { [teamIds[0]]: 'host', [teamIds[1]]: 'g1' }, spectators: ['g4'], handled: { g2: 5 } };
    const roster = [
      { uid: 'host', name: 'Ana', role: 'host', teamId: teamIds[0], link: 'none' },
      { uid: 'g1', name: 'Bea', role: 'player', teamId: teamIds[1], link: 'direct' },
      { uid: 'g2', name: 'Carla', role: 'pending', teamId: null, link: 'fallback' },
      { uid: 'g3', name: 'Dani', role: 'pending', teamId: null, link: 'connecting' },
      { uid: 'g4', name: 'Eva', role: 'spectator', teamId: null, link: 'direct' },
    ];
    const base = { code: 'ABC234', teams, players: roster, seats, settings, wants: null, status: 'lobby', onPick: noop, onStart: noop, onLeave: noop };
    const out = html(screens.TeamSelection, { ...base, myUid: 'g3', isHost: false });
    const cards = [...out.matchAll(/<button[^>]*data-team="([^"]+)"[^>]*>/g)].map(m => ({ id: m[1], disabled: /disabled=""/.test(m[0]), mine: /aria-pressed="true"/.test(m[0]) }));
    assert(cards.length === teamIds.length, 'N7: se ven los diez equipos', String(cards.length));
    assert(cards.filter(c => c.disabled).map(c => c.id).join() === [teamIds[0], teamIds[1]].join(), 'N7: los cogidos no se pueden pulsar; los libres sí', JSON.stringify(cards));
    assert(out.includes('Ana') && out.includes('Bea') && out.includes('Libre'), 'N7: cada tarjeta dice quién lleva el equipo o que está libre');
    assert(out.includes('Mirando') && out.includes('Eva') && out.includes('Sin equipo') && out.includes('Dani'), 'N7: debajo, quién mira y quién aún no ha elegido');
    assert(out.includes('Entrar a mirar') && !out.includes('Empezar'), 'N7: el invitado puede entrar a mirar y no puede empezar');
    const mine = html(screens.TeamSelection, { ...base, myUid: 'g1', isHost: false });
    assert(/data-team="[^"]+"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-team/.test(mine) && mine.includes('Tú'), 'N7: el equipo propio se marca');
    const pending = html(screens.TeamSelection, { ...base, myUid: 'g3', isHost: false, wants: { teamId: teamIds[3], at: 9 } });
    assert(pending.includes('Esperando confirmación'), 'N7: tras pedir un equipo, espera la confirmación del anfitrión');
    const refused = html(screens.TeamSelection, { ...base, myUid: 'g2', isHost: false, wants: { teamId: teamIds[1], at: 5 } });
    assert(refused.includes('ya estaba cogido'), 'N7: si se lo quitaron por poco, se le dice que elija otro');
    const hostNoTeam = html(screens.TeamSelection, { ...base, seats: { ...seats, teams: { [teamIds[1]]: 'g1' } }, myUid: 'host', isHost: true });
    assert(/<button[^>]*disabled=""[^>]*>[^<]*(<[^>]+>)*[^<]*Empezar/.test(hostNoTeam) || /Empezar[\s\S]{0,40}Elige tu equipo/.test(hostNoTeam) || /Elige tu equipo[\s\S]{0,200}Empezar/.test(hostNoTeam),
      'N7: el anfitrión no puede empezar sin equipo');
    const hostReady = html(screens.TeamSelection, { ...base, myUid: 'host', isHost: true });
    assert(hostReady.includes('Empezar') && !hostReady.includes('Entrar a mirar') && !/<button[^>]*disabled=""[^>]*>(<[^>]+>)*Empezar/.test(hostReady), 'N7: con equipo, el anfitrión puede empezar (y no mirar)');
    assert(html(screens.TeamSelection, { ...base, myUid: 'g1', isHost: false, status: 'race' }).includes('La carrera ha empezado'), 'N7: se entera de que ha empezado');
    assert(html(screens.TeamSelection, { ...base, myUid: 'g1', isHost: false, status: 'closed' }).includes('La sala se ha cerrado'), 'N7: y de que se ha cerrado');
  });
}
