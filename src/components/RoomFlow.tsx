// [N7] El modo compartido antes de la carrera: crear una sala (anfitrión) o unirse a una (invitado), en dos páginas:
// la sala (quién se conecta y los ajustes) y la elección de equipos, que abre el anfitrión. Conecta las pantallas de
// RoomScreens con la sala de N4 (Lobby) y el transporte de N5, que ya da el estado del enlace de cada jugador. Firebase se carga aquí, con import(), solo cuando se abre el modo compartido. La carrera compartida es N8.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { Camera } from '../renderer/Camera';
import { RaceSession } from '../engine/RaceSession';
import type { RaceConfig } from '../engine/engineCore';
import type { RosterEntry } from '../engine/raceCars';
import { raceStore, useRace } from '../state/raceStore';
import type { LinkStore } from '../state/linkStore';
import { PAUSE_REQUEST_COOLDOWN_MS, RemoteLink, requestPause } from '../net/SharedRace';
import { ClientRaceScreen } from './ClientRace';
import { QualifyingLive } from './QualifyingLive';
import { QualifyingResults } from './QualifyingResults';
import qualifyingStyles from './QualifyingResults.module.css';
import type { SharedRaceRecord } from '../net/Lobby';
import { rejoinRoom } from '../net/Lobby';
import { RaceCanvas } from './RaceCanvas';
import { TEAMS } from '../data/teams';
import { createRoom, joinRoom, leaveRoom, roomPaths, setRoomStatus } from '../net/RoomService';
import type { RoomDb } from '../net/RoomService';
import { codeFromLink, isValidRoomCode, normalizeRoomCode } from '../net/roomCode';
import { DEFAULT_SETTINGS, requestSeat, resolveSeats, saveSeats, saveSettings, seatOf, setPhase, watchLobby } from '../net/Lobby';
import type { LobbySettings, LobbyState, Seats } from '../net/Lobby';
import { GuestTransport, HostTransport } from '../net/transport/Transport';
import { createWebRtcConnector, createWebRtcListener } from '../net/transport/webrtc';
import type { DirectConnector, DirectListener } from '../net/transport/Transport';
import { createLinkStore } from '../state/linkStore';
import { qrSvg } from '../net/roomQr';
import { GuestWaiting, HostLobby, JoinRoomScreen, TeamSelection } from './RoomScreens';
import type { LinkLabel, RoomPlayer, RoomStatusView, RoomTeam } from './RoomScreens';
import s from './RoomScreens.module.css';

const TEAM_LIST: RoomTeam[] = Object.values(TEAMS).map(t => ({ id: t.id, name: t.name, color: t.color }));
const TEAM_IDS = TEAM_LIST.map(t => t.id);

/** Comparación estable (las claves de Firebase vuelven ordenadas). */
const stable = (value: unknown): string => JSON.stringify(value, (_key, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

function playersOf(lobby: LobbyState | null, links: Record<string, LinkLabel>): RoomPlayer[] {
  if (!lobby) return [];
  return [...lobby.members].sort((a, b) => (a.role === 'host' ? -1 : b.role === 'host' ? 1 : (a.joinedAt ?? 0) - (b.joinedAt ?? 0))).map(m => {
    const seat = seatOf(lobby, m.uid);
    const isHost = m.uid === lobby.hostUid;
    const teamId = seat && 'teamId' in seat ? seat.teamId : null;
    return {
      uid: m.uid, name: m.name, teamId, link: links[m.uid] ?? 'none',
      role: isHost ? 'host' : teamId ? 'player' : seat && 'spectator' in seat ? 'spectator' : 'pending',
    };
  });
}

function Waiting({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className={s.screen}>
      <main className={s.body}><section className={s.card}><p className={s.big}>{text}</p>
        <button type="button" className={s.ghost} onClick={onBack}>Volver al menú</button></section></main>
    </div>
  );
}

/** [N8] Lo que el anfitrión entrega a la aplicación al pulsar «Empezar»: la sala, su transporte y quién juega. */
export interface HostStart {
  db: RoomDb;
  code: string;
  transport: HostTransport;
  hostUid: string;
  hostTeamId: string;
  players: ({ uid: string; teamId: string } | { uid: string; spectator: true })[];
  names: Record<string, string>;
  circuitId: string;
  weather: string;
  /** [N9] Formato (GP directo o con clasificación) y enlace de la sala (para volver a ella con «Otra carrera»). */
  format: 'directo' | 'clasificacion';
  link: string;
}

/** El invitado no arranca motor: esta configuración no se usa, solo la pide la sesión. */
const GUEST_CONFIG: RaceConfig = { fixedStepSec: 0.02, autoStartTyres: false, seededPreparation: false, autoTeamOrders: false, upgradeTradeoffs: {}, luckVariantEnabled: false };

/** [N8] Carrera en el dispositivo del invitado: la sesión de N3 sobre el enlace remoto, en el almacén de la aplicación. */
function GuestRace({ transport, race, lobby, myUid, linkStore, closed, onLeave }: {
  transport: GuestTransport;
  race: SharedRaceRecord;
  /** [N9] La sala se ha cerrado (el anfitrión la cerró o se cayó). */
  closed: boolean;
  lobby: LobbyState;
  myUid: string;
  linkStore: LinkStore;
  onLeave: () => void;
}) {
  const sessionRef = useRef<RaceSession | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pauseRequested, setPauseRequested] = useState(false);
  // [N9] La clasificación (ya calculada por el anfitrión) se ve a su ritmo; al salir a pista, todos pasan a la carrera.
  const [qualiStep, setQualiStep] = useState<'directo' | 'resultado' | 'visto'>('directo');
  const track = useMemo(() => new RaceSimulation(race.circuitId).activeTrack, [race.circuitId]);
  const camera = useMemo(() => new Camera(), []);
  const slow = useRace(state => state.slow);
  const teams = useRace(state => state.teams);
  const peer = useStore(linkStore, state => state.peer);
  // La sala se vuelve a leer con cada cambio (y trae un objeto nuevo): la carrera solo se rearranca si es otra.
  const raceKey = `${race.circuitId}:${race.roster.map(entry => entry.id).join(',')}`;
  const rosterRef = useRef(race.roster);
  rosterRef.current = race.roster;
  useEffect(() => {
    const session = new RaceSession({ link: new RemoteLink(transport), store: raceStore, linkStore });
    sessionRef.current = session;
    camera.resetToFullTrack();
    void session.start({ snapshot: null, config: GUEST_CONFIG, roster: rosterRef.current });
    return () => { if (sessionRef.current === session) sessionRef.current = null; session.stop(); };
  }, [transport, raceKey, linkStore, camera]);
  useEffect(() => {
    if (!pauseRequested) return;
    const id = setTimeout(() => setPauseRequested(false), PAUSE_REQUEST_COOLDOWN_MS);
    return () => clearTimeout(id);
  }, [pauseRequested]);
  const seat = seatOf(lobby, myUid);
  const myTeamId = seat && 'teamId' in seat ? seat.teamId : null;
  if (!closed && race.stage === 'clasificacion' && race.qualifying) {
    const mine = race.roster.filter(entry => entry.team.id === myTeamId).map(entry => entry.driver.id);
    return (
      <div className={s.screen}>
        {qualiStep === 'directo' && <div className={qualifyingStyles.overlay}><QualifyingLive result={race.qualifying} outline={track.points} playerIds={mine} onDone={() => setQualiStep('resultado')} /></div>}
        {qualiStep === 'resultado' && <div className={qualifyingStyles.overlay}><QualifyingResults result={race.qualifying} onContinue={() => setQualiStep('visto')} /></div>}
        {qualiStep === 'visto' && <main className={s.body}><section className={s.card}><p className={s.big}>Esperando la salida…</p><p className={s.dim}>El anfitrión decide cuándo se sale a pista.</p></section></main>}
      </div>
    );
  }
  return (
    <ClientRaceScreen role={myTeamId ? 'player' : 'spectator'} myTeamId={myTeamId} roster={race.roster} fast={null} slow={slow} teams={teams}
      link={peer === 'none' ? 'none' : peer} pauseRequested={pauseRequested} closed={closed}
      track={<RaceCanvas track={track} circuitId={race.circuitId} roster={race.roster} camera={camera} selectedCarId={selected} onSelectCar={setSelected} />}
      onOrder={order => sessionRef.current?.order(order) ?? Promise.resolve({ ok: false, reason: 'Sin carrera' })}
      onRequestPause={() => { const session = sessionRef.current; if (!session) return; setPauseRequested(true); void requestPause(session); }}
      onLeave={onLeave} />
  );
}

/** Lo que viene de fuera: Firebase y WebRTC en la aplicación; una base y una red simuladas en la página de revisión. */
export interface RoomBackend {
  connect: () => Promise<RoomDb>;
  listener: (db: RoomDb, code: string) => DirectListener;
  connector: (db: RoomDb, code: string) => DirectConnector;
}
const FIREBASE: RoomBackend = {
  connect: () => import('../net/firebaseDb').then(m => m.connectFirebase()),
  listener: createWebRtcListener,
  connector: createWebRtcConnector,
};

export function RoomFlow({ intent, initialCode, onExit, onHostStart, resume, backend = FIREBASE }: {
  intent: 'create' | 'join'; initialCode?: string; onExit: () => void;
  /** [N9] «Otra carrera»: el anfitrión vuelve a su sala abierta (misma base, código y transporte) en vez de crear otra. */
  resume?: HostStart | null;
  /** [N8] El anfitrión empieza: la aplicación arranca su carrera compartida (sin esto, solo se marca la sala en carrera). */
  onHostStart?: (start: HostStart) => void;
  backend?: RoomBackend;
}) {
  const [db, setDb] = useState<RoomDb | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [settings, setSettings] = useState<LobbySettings>(DEFAULT_SETTINGS);
  const [links, setLinks] = useState<Record<string, LinkLabel>>({});
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hostTransport = useRef<HostTransport | null>(null);
  const guestTransport = useRef<GuestTransport | null>(null);
  const added = useRef(new Set<string>());
  const creating = useRef(false);
  const lastRace = useRef<SharedRaceRecord | null>(null);
  /** Deja de escuchar la sala (al salir o al desmontar). */
  const unwatch = useRef<() => void>(() => {});
  const linkStore = useMemo(() => createLinkStore(), []);
  const qr = useMemo(() => (link ? qrSvg(link) : null), [link]);

  // Sesión anónima y base de datos.
  useEffect(() => {
    if (resume) { setDb(resume.db); return; }
    let alive = true;
    backend.connect().then(
      connected => { if (alive) setDb(connected); },
      error => { if (alive) setFailure(`No se ha podido conectar: ${error?.message ?? error}`); },
    );
    return () => { alive = false; };
  }, []);

  // Anfitrión: crea la sala (una sola vez) y empieza a escuchar a los invitados. La escucha no cuelga de este efecto:
  // si colgara, al llegar el código el efecto se repetiría y su limpieza la cortaría (la sala dejaría de actualizarse).
  useEffect(() => {
    if (!db || intent !== 'create' || creating.current) return;
    creating.current = true;
    if (resume) {
      // [N9] La sala sigue abierta: se vuelve a ella; las órdenes de los invitados ya no van a ningún motor.
      resume.transport.setOrderHandler(() => ({ ok: false, reason: 'La carrera aún no ha empezado' }));
      hostTransport.current = resume.transport;
      for (const p of resume.players) added.current.add(p.uid);
      unwatch.current = watchLobby(db, resume.code, setLobby);
      setCode(resume.code);
      setLink(resume.link);
      return;
    }
    createRoom(db, { name: 'Anfitrión' }).then(async room => {
      await saveSettings(db, room.code, DEFAULT_SETTINGS);
      const transport = new HostTransport({ db, code: room.code, direct: backend.listener(db, room.code), onOrder: () => ({ ok: false, reason: 'La carrera aún no ha empezado' }) });
      await transport.start();
      hostTransport.current = transport;
      unwatch.current = watchLobby(db, room.code, setLobby);
      setCode(room.code);
      setLink(room.link);
    }).catch(error => setFailure(`No se ha podido crear la sala: ${error?.message ?? error}`));
  }, [db, intent, backend]);

  // Anfitrión: reparte los asientos cada vez que cambia la sala y da de alta en el transporte a quien entra.
  useEffect(() => {
    if (!db || !code || intent !== 'create' || !lobby || lobby.closed) return;
    const seats: Seats = resolveSeats({ hostUid: db.uid, teamIds: TEAM_IDS, lobby });
    if (stable(seats) !== stable(lobby.seats)) saveSeats(db, code, seats).catch(() => {});
    const transport = hostTransport.current;
    if (!transport) return;
    const present = new Set(lobby.members.map(m => m.uid).filter(uid => uid !== db.uid));
    for (const uid of present) if (!added.current.has(uid)) { transport.addGuest(uid, { teamId: '' }); added.current.add(uid); }
    for (const uid of [...added.current]) if (!present.has(uid)) { transport.removeGuest(uid); added.current.delete(uid); }
  }, [db, code, intent, lobby]);

  // Estado del enlace de cada invitado (anfitrión) o el propio (invitado), una vez por segundo.
  useEffect(() => {
    const id = setInterval(() => {
      const host = hostTransport.current;
      if (host) {
        host.tick();
        setLinks(Object.fromEntries([...added.current].map(uid => [uid, host.modeOf(uid) as LinkLabel])));
      }
      const guest = guestTransport.current;
      if (guest && db) {
        guest.tick();
        const peer = linkStore.getState().peer;
        setLinks({ [db.uid]: peer === 'none' ? 'none' : peer });
      }
    }, 500);
    return () => clearInterval(id);
  }, [db, linkStore]);

  // Al salir de la pantalla, se deja de escuchar la sala y se cierra el transporte.
  useEffect(() => () => { unwatch.current(); hostTransport.current?.stop(); guestTransport.current?.stop(); }, []);

  const exit = async () => {
    unwatch.current(); unwatch.current = () => {};
    hostTransport.current?.stop(); hostTransport.current = null;
    guestTransport.current?.stop(); guestTransport.current = null;
    if (db && code) await leaveRoom(db, code).catch(() => {});
    onExit();
  };

  const join = async (input: string, name: string) => {
    if (!db) return;
    setBusy(true); setJoinError(null);
    try {
      // Desde la misma sesión que el anfitrión no se entra: sería el anfitrión con otro nombre.
      const typed = codeFromLink(input) ?? normalizeRoomCode(input);
      if (isValidRoomCode(typed) && (await db.get(`${roomPaths.room(typed)}/meta/host`)) === db.uid) { setJoinError('misma-sesion'); return; }
      // [N9] Con la sala en carrera solo vuelve quien tenía sitio (misma sesión): rejoinRoom; si no, como siempre.
      const result = isValidRoomCode(typed) ? await rejoinRoom(db, typed, { name }) : await joinRoom(db, input, { name });
      if (!result.ok) { setJoinError(result.reason); return; }
      const transport = new GuestTransport({ db, code: result.code, direct: backend.connector(db, result.code), linkStore });
      await transport.start();
      guestTransport.current = transport;
      unwatch.current = watchLobby(db, result.code, setLobby);
      setCode(result.code);
    } catch (error) {
      setJoinError(`No se ha podido entrar: ${(error as Error)?.message ?? error}`);
    } finally {
      setBusy(false);
    }
  };

  if (failure) return <Waiting text={failure} onBack={onExit} />;
  if (!db) return <Waiting text="Conectando…" onBack={onExit} />;

  const status: RoomStatusView = lobby?.closed ? 'closed' : lobby?.status === 'race' ? 'race' : 'lobby';
  const pick = (want: { teamId: string } | { spectator: true }) => { if (code) requestSeat(db, code, want).catch(() => {}); };
  /** [N8] El anfitrión empieza: entrega la sala y su transporte a la aplicación (que publica la carrera y la arranca). */
  const startRace = () => {
    if (!code || !lobby) return;
    const transport = hostTransport.current;
    const seats = lobby.seats;
    const hostTeamId = seats ? Object.entries(seats.teams).find(([, uid]) => uid === db.uid)?.[0] : undefined;
    if (!onHostStart || !transport || !seats || !hostTeamId) { setRoomStatus(db, code, 'race').catch(() => {}); return; }
    const players: HostStart['players'] = [
      ...Object.entries(seats.teams).filter(([, uid]) => uid !== db.uid).map(([teamId, uid]) => ({ uid, teamId })),
      ...seats.spectators.map(uid => ({ uid, spectator: true as const })),
    ];
    const settings = lobby.settings ?? DEFAULT_SETTINGS;
    // El transporte y la sala pasan a la aplicación: al desmontar esta pantalla no se cierran.
    hostTransport.current = null;
    unwatch.current(); unwatch.current = () => {};
    onHostStart({ db, code, transport, hostUid: db.uid, hostTeamId, players, names: Object.fromEntries(lobby.members.map(m => [m.uid, m.name])), circuitId: settings.circuitId, weather: settings.weather,
      format: settings.format === 'clasificacion' ? 'clasificacion' : 'directo', link });
  };
  const selection = (isHost: boolean) => lobby && code && (
    <TeamSelection code={code} myUid={db.uid} isHost={isHost} teams={TEAM_LIST} players={playersOf(lobby, links)} seats={lobby.seats}
      settings={lobby.settings} wants={lobby.members.find(m => m.uid === db.uid)?.wants ?? null} status={status}
      onPick={pick} onStart={startRace} onLeave={exit} />
  );

  if (intent === 'create') {
    if (!code || !lobby) return <Waiting text="Creando la sala…" onBack={exit} />;
    if (lobby.phase === 'equipos') return selection(true);
    return (
      <HostLobby code={code} link={link} qr={qr} settings={lobby.settings ?? settings} teams={TEAM_LIST} players={playersOf(lobby, links)}
        onSettings={next => { setSettings(next); saveSettings(db, code, next).catch(() => {}); }}
        onOpenTeams={() => { setPhase(db, code, 'equipos').catch(() => {}); }}
        onClose={exit} />
    );
  }

  if (!code || !lobby) {
    return <JoinRoomScreen initialCode={initialCode ?? ''} error={joinError} busy={busy} onJoin={join} onBack={onExit} />;
  }
  // [N9] La carrera publicada se recuerda: si la sala se cierra en carrera, el invitado ve el aviso en su pantalla.
  if (lobby.race) lastRace.current = lobby.race;
  else if (status === 'lobby') lastRace.current = null;
  if ((status === 'race' || status === 'closed') && lastRace.current && guestTransport.current) {
    return <GuestRace transport={guestTransport.current} race={lastRace.current} lobby={lobby} myUid={db.uid} linkStore={linkStore} closed={status === 'closed'} onLeave={exit} />;
  }
  if (lobby.phase === 'equipos') return selection(false);
  return <GuestWaiting code={code} players={playersOf(lobby, links)} settings={lobby.settings} status={status} onLeave={exit} />;
}
