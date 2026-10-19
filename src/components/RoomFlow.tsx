// [N7] El modo compartido antes de la carrera: crear una sala (anfitrión) o unirse a una (invitado), en dos páginas:
// la sala (quién se conecta y los ajustes) y la elección de equipos, que abre el anfitrión. Conecta las pantallas de
// RoomScreens con la sala de N4 (Lobby) y el transporte de N5, que ya da el estado del enlace de cada jugador. Firebase se carga aquí, con import(), solo cuando se abre el modo compartido. La carrera compartida es N8.
import { useEffect, useMemo, useRef, useState } from 'react';
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

export function RoomFlow({ intent, initialCode, onExit, backend = FIREBASE }: { intent: 'create' | 'join'; initialCode?: string; onExit: () => void; backend?: RoomBackend }) {
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
  /** Deja de escuchar la sala (al salir o al desmontar). */
  const unwatch = useRef<() => void>(() => {});
  const linkStore = useMemo(() => createLinkStore(), []);
  const qr = useMemo(() => (link ? qrSvg(link) : null), [link]);

  // Sesión anónima y base de datos.
  useEffect(() => {
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
      const result = await joinRoom(db, input, { name });
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
  const selection = (isHost: boolean) => lobby && code && (
    <TeamSelection code={code} myUid={db.uid} isHost={isHost} teams={TEAM_LIST} players={playersOf(lobby, links)} seats={lobby.seats}
      settings={lobby.settings} wants={lobby.members.find(m => m.uid === db.uid)?.wants ?? null} status={status}
      onPick={pick} onStart={() => { setRoomStatus(db, code, 'race').catch(() => {}); }} onLeave={exit} />
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
  if (lobby.phase === 'equipos') return selection(false);
  return <GuestWaiting code={code} players={playersOf(lobby, links)} settings={lobby.settings} status={status} onLeave={exit} />;
}
