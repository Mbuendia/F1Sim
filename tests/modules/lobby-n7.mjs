// N7 — Pantallas de sala (PROPUESTA DE CONTRATO, 19/10/2026).
// Decisiones del usuario del 19/10/2026: N7 llega hasta «Empezar» (la carrera compartida es N8); QR con
// qrcode-generator; quién lleva cada equipo y los ajustes del anfitrión van en la ficha de la sala (meta/seats y
// meta/settings), que las reglas de N4 ya permiten; el anfitrión elige circuito, formato y tiempo en un panel compacto.
//  1. Sala (src/net/Lobby.ts) sobre la base simulada de N4: el invitado pide un asiento en su presencia (un equipo o
//     mirar); el anfitrión los reparte por orden de llegada, sin dar un equipo cogido a otro, con los límites de N6, y
//     libera los asientos de quien se va; los ajustes se guardan en la ficha y los ven todos.
//  2. QR del enlace de la sala (src/net/roomQr.ts).
//  3. Pantallas (src/components/RoomScreens.tsx y el menú), renderizadas con estados de sala simulados: «Crear sala» y
//     «Unirse a una sala» en el menú; el anfitrión ve código, enlace, QR, ajustes y jugadores con equipo y enlace; el
//     invitado escribe el código y su nombre (sin registrarse), elige un equipo libre o entra a mirar y espera.
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

  /** Sala con anfitrión (lleva el primer equipo) y los invitados dados, y lo que cada uno ve de ella. */
  const room = async (guests = []) => {
    const fake = createFakeServer();
    const hostDb = fake.client('host');
    const { code } = await createRoom(hostDb, { name: 'Ana', random: () => 0.3 });
    const dbs = {};
    for (const uid of guests) { dbs[uid] = fake.client(uid); await joinRoom(dbs[uid], code, { name: uid }); }
    const seen = { host: null };
    lobby.watchLobby(hostDb, code, s => { seen.host = s; });
    for (const uid of guests) lobby.watchLobby(dbs[uid], code, s => { seen[uid] = s; });
    await settle();
    /** Lo que hace la aplicación del anfitrión al cambiar la sala: repartir los asientos y guardarlos si cambian. */
    const arbitrate = async () => {
      const seats = lobby.resolveSeats({ hostUid: 'host', hostTeamId: teamIds[0], teamIds, lobby: seen.host });
      await lobby.saveSeats(hostDb, code, seats);
      await settle();
      return seats;
    };
    return { fake, code, hostDb, dbs, seen, arbitrate };
  };

  await test('N7: asientos de la sala', async () => {
    const r = await room(['g1', 'g2', 'g3']);
    assert(r.seen.host?.hostUid === 'host' && r.seen.host.members.length === 4 && r.seen.host.status === 'lobby', 'N7: el anfitrión ve la sala con sus invitados', JSON.stringify(r.seen.host)?.slice(0, 120));
    let seats = await r.arbitrate();
    assert(seats.teams[teamIds[0]] === 'host' && Object.keys(seats.teams).length === 1 && seats.spectators.length === 0, 'N7: al empezar, solo el anfitrión tiene equipo', JSON.stringify(seats));

    await lobby.requestSeat(r.dbs.g1, r.code, { teamId: teamIds[1] });
    await lobby.requestSeat(r.dbs.g2, r.code, { teamId: teamIds[1] });
    await lobby.requestSeat(r.dbs.g3, r.code, { spectator: true });
    await settle();
    assert(r.seen.host.members.find(m => m.uid === 'g1')?.wants?.teamId === teamIds[1], 'N7: el invitado pide su asiento en su presencia', JSON.stringify(r.seen.host.members));
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[1]] === 'g1' && !Object.values(seats.teams).includes('g2'), 'N7: un equipo cogido no se da a otro; gana quien llegó antes', JSON.stringify(seats));
    assert(seats.spectators.join() === 'g3', 'N7: quien entra a mirar queda como espectador', JSON.stringify(seats));
    assert(r.seen.g2?.seats?.teams?.[teamIds[1]] === 'g1' && r.seen.g1?.seats?.teams?.[teamIds[1]] === 'g1', 'N7: todos ven el reparto en la ficha de la sala', JSON.stringify(r.seen.g2?.seats));
    assert(lobby.freeTeams(r.seen.g2, teamIds).every(id => id !== teamIds[0] && id !== teamIds[1]) && lobby.freeTeams(r.seen.g2, teamIds).length === teamIds.length - 2,
      'N7: a los demás solo se les ofrecen los equipos libres', JSON.stringify(lobby.freeTeams(r.seen.g2, teamIds)));
    assert(r.seen.host.members.find(m => m.uid === 'g2')?.wants?.teamId === teamIds[1] && lobby.seatOf(r.seen.g2, 'g2') === null, 'N7: el que pidió un equipo cogido sigue sin asiento hasta pedir otro');

    await lobby.requestSeat(r.dbs.g1, r.code, { teamId: teamIds[2] });
    await settle();
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[2]] === 'g1' && seats.teams[teamIds[1]] === undefined, 'N7: cambiar a otro equipo libre suelta el anterior', JSON.stringify(seats));
    await lobby.requestSeat(r.dbs.g2, r.code, { teamId: teamIds[1] });
    await settle();
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[1]] === 'g2', 'N7: y otro lo puede tomar', JSON.stringify(seats));
    assert(lobby.seatOf(r.seen.g2, 'g2')?.teamId === teamIds[1] && lobby.seatOf(r.seen.g3, 'g3')?.spectator === true, 'N7: cada uno sabe qué asiento tiene');

    await leaveRoom(r.dbs.g1, r.code);
    await settle();
    seats = await r.arbitrate();
    assert(seats.teams[teamIds[2]] === undefined && !seats.spectators.includes('g1'), 'N7: quien se va libera su asiento', JSON.stringify(seats));
    const pick = lobby.resolveSeats({ hostUid: 'host', hostTeamId: teamIds[0], teamIds, lobby: { ...r.seen.host, members: [...r.seen.host.members, { uid: 'g9', name: 'g9', role: 'guest', joinedAt: 1, wants: { teamId: teamIds[0] } }] } });
    assert(pick.teams[teamIds[0]] === 'host', 'N7: nadie quita su equipo al anfitrión');
    const unknown = lobby.resolveSeats({ hostUid: 'host', hostTeamId: teamIds[0], teamIds, lobby: { ...r.seen.host, members: [...r.seen.host.members, { uid: 'g9', name: 'g9', role: 'guest', joinedAt: 9e15, wants: { teamId: 'no-existe' } }] } });
    assert(!Object.values(unknown.teams).includes('g9'), 'N7: un equipo que no corre no se asigna');
  });

  await test('N7: límites de la sala', async () => {
    const members = [{ uid: 'host', name: 'Ana', role: 'host', joinedAt: 0 }];
    for (let i = 1; i <= 12; i++) members.push({ uid: `s${i}`, name: `s${i}`, role: 'guest', joinedAt: i, wants: { spectator: true } });
    const seats = lobby.resolveSeats({ hostUid: 'host', hostTeamId: teamIds[0], teamIds, lobby: { hostUid: 'host', status: 'lobby', members, seats: null, settings: null } });
    assert(seats.spectators.length === MULTIPLAYER_LIMITS.spectators && seats.spectators.join() === Array.from({ length: 10 }, (_, i) => `s${i + 1}`).join(),
      'N7: diez espectadores como mucho, por orden de llegada', JSON.stringify(seats.spectators));
  });

  await test('N7: ajustes del anfitrión', async () => {
    const r = await room(['g1']);
    const def = lobby.DEFAULT_SETTINGS;
    assert(def && typeof def.circuitId === 'string' && ['directo', 'clasificacion', 'sprint'].includes(def.format) && typeof def.weather === 'string', 'N7: hay ajustes por defecto', JSON.stringify(def));
    await lobby.saveSettings(r.hostDb, r.code, { circuitId: 'monaco', format: 'clasificacion', weather: 'tormenta' });
    await settle();
    assert(JSON.stringify(r.seen.g1?.settings) === JSON.stringify({ circuitId: 'monaco', format: 'clasificacion', weather: 'tormenta' }), 'N7: el invitado ve circuito, formato y tiempo', JSON.stringify(r.seen.g1?.settings));
    assert(r.fake.read(`rooms/${r.code}/meta/host`) === 'host' && r.fake.read(`rooms/${r.code}/meta/status`) === 'lobby', 'N7: los ajustes no estropean la ficha de la sala');
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
    { uid: 'host', name: 'Ana', role: 'host', teamId: teamIds[0], link: 'none' },
    { uid: 'g1', name: 'Bea', role: 'player', teamId: teamIds[1], link: 'direct' },
    { uid: 'g2', name: 'Carla', role: 'player', teamId: teamIds[2], link: 'fallback' },
    { uid: 'g3', name: 'Dani', role: 'pending', teamId: null, link: 'connecting' },
    { uid: 'g4', name: 'Eva', role: 'spectator', teamId: null, link: 'down' },
  ];

  await test('N7: pantalla del anfitrión', () => {
    const noop = () => {};
    const out = html(screens.HostLobby, {
      code: 'ABC234', link: 'https://f1sim-d5085.web.app/?sala=ABC234', qr: qrSvg('https://f1sim-d5085.web.app/?sala=ABC234'),
      settings: { circuitId: 'monaco', format: 'clasificacion', weather: 'tormenta' }, teams, players,
      onSettings: noop, onStart: noop, onClose: noop,
    });
    assert(out.includes('ABC234') && out.includes('https://f1sim-d5085.web.app/?sala=ABC234') && out.includes('<svg'), 'N7: el anfitrión ve código, enlace y QR');
    assert(/Mónaco|Monaco/.test(out) && out.includes('Tormenta') && /clasificaci/i.test(out), 'N7: y los ajustes elegidos: circuito, formato y tiempo');
    for (const p of ['Ana', 'Bea', 'Carla', 'Dani', 'Eva']) assert(out.includes(p), `N7: la lista de jugadores incluye a ${p}`);
    assert(out.includes(teams[1].name) && out.includes(teams[2].name), 'N7: con el equipo de cada uno');
    assert(out.includes('Directo') && out.includes('Respaldo') && out.includes('Conectando') && out.includes('Caído'), 'N7: y el estado de su enlace');
    assert(out.includes('Mirando') && out.includes('Eligiendo equipo'), 'N7: el espectador y el que aún no tiene equipo se distinguen');
    assert(out.includes('Empezar') && out.includes('Cerrar sala'), 'N7: puede empezar o cerrar la sala');
  });

  await test('N7: pantallas del invitado', () => {
    const noop = () => {};
    const join = html(screens.JoinRoomScreen, { initialCode: 'ABC234', name: '', error: null, busy: false, onJoin: noop, onBack: noop });
    assert(join.includes('value="ABC234"') && /maxLength="24"|maxlength="24"/.test(join), 'N7: el código llega del enlace y el nombre tiene 24 letras como mucho');
    assert(!/type="password"|type="email"/.test(join), 'N7: sin registrarse: ni correo ni contraseña');
    const msg = reason => html(screens.JoinRoomScreen, { initialCode: 'ABC234', name: 'Bea', error: reason, busy: false, onJoin: noop, onBack: noop });
    assert(/no es válido/.test(msg('codigo-invalido')) && /no existe/.test(msg('no-existe')) && /ya ha empezado/.test(msg('en-carrera')), 'N7: cada motivo de rechazo se explica');

    const seats = { teams: { [teamIds[0]]: 'host', [teamIds[1]]: 'g1', [teamIds[2]]: 'g2' }, spectators: ['g4'] };
    const base = { code: 'ABC234', myUid: 'g3', teams, players, seats, settings: { circuitId: 'monaco', format: 'directo', weather: 'seco' }, wants: null, onPick: noop, onLeave: noop };
    const wait = html(screens.GuestLobby, { ...base, status: 'lobby' });
    const offered = [...wait.matchAll(/data-team="([^"]+)"/g)].map(m => m[1]);
    assert(offered.length === teamIds.length - 3 && !offered.includes(teamIds[0]) && !offered.includes(teamIds[1]) && !offered.includes(teamIds[2]), 'N7: el invitado solo ve ofrecidos los equipos libres', JSON.stringify(offered));
    assert(wait.includes('Entrar a mirar') && /Mónaco|Monaco/.test(wait), 'N7: puede entrar a mirar y ve el circuito');
    const pending = html(screens.GuestLobby, { ...base, status: 'lobby', wants: { teamId: teamIds[3] } });
    assert(pending.includes('Esperando al anfitrión'), 'N7: tras pedir un equipo, espera la confirmación');
    const seated = html(screens.GuestLobby, { ...base, myUid: 'g1', status: 'lobby' });
    assert(seated.includes(teams[1].name) && seated.includes('Esperando a que empiece'), 'N7: con equipo, espera a que empiece');
    assert(html(screens.GuestLobby, { ...base, myUid: 'g1', status: 'race' }).includes('La carrera ha empezado'), 'N7: se entera de que ha empezado');
    assert(html(screens.GuestLobby, { ...base, status: 'closed' }).includes('La sala se ha cerrado'), 'N7: y de que se ha cerrado');
  });
}
