// [N7] Pantallas de sala, en dos páginas (decisión del usuario del 19/10/2026): primero la sala, donde se ve quién se
// conecta y el anfitrión elige circuito, formato y tiempo; después la elección de equipos, común a todos y en tiempo
// real, que abre el anfitrión. También la de unirse por código. No saben nada de Firebase: reciben el estado de la sala
// ya leído y devuelven lo que elige el jugador. Pensadas primero para el móvil (375 px, controles de 44 px).
import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { Check, Copy, Eye, LogOut, Play, Users, X } from 'lucide-react';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { WEATHER_SCENARIOS } from '../data/weatherScenarios';
import { browserDevStorage, isDevMode } from '../dev/devMode';

/** [UX3] ¿Está encendido el modo desarrollador en este dispositivo? */
const devMode = () => isDevMode(browserDevStorage());
import type { RaceFormatId } from './RaceFormatSelect';
import { Segmented } from './ui/Segmented';
import type { LobbySettings, Seats, SeatWant } from '../net/Lobby';
import s from './RoomScreens.module.css';

export interface RoomTeam { id: string; name: string; color: string }
export type LinkLabel = 'none' | 'connecting' | 'direct' | 'fallback' | 'down';
export interface RoomPlayer {
  uid: string;
  name: string;
  /** El anfitrión, un jugador con equipo, uno que aún lo está eligiendo o un espectador. */
  role: 'host' | 'player' | 'pending' | 'spectator';
  teamId: string | null;
  link: LinkLabel;
}
export type RoomStatusView = 'lobby' | 'race' | 'closed';

const LINK_TEXT: Record<LinkLabel, string> = { none: '', connecting: 'Conectando', direct: 'Directo', fallback: 'Respaldo', down: 'Caído' };
const FORMAT_TEXT: Record<RaceFormatId, string> = { directo: 'GP directo', clasificacion: 'Con clasificación', sprint: 'Sprint' };
const circuitName = (id: string) => OFFICIAL_CIRCUITS[id]?.name ?? id;
const weatherName = (id: string) => WEATHER_SCENARIOS.find(w => w.id === id)?.label ?? id;

/** Quién está en la sala y cómo le llega la conexión (sin equipos: eso es la página siguiente). */
function PlayerList({ players }: { players: RoomPlayer[] }) {
  return (
    <ul className={s.players}>
      {players.map(p => (
        <li key={p.uid} className={s.player} style={{ ['--c' as string]: 'var(--line-strong)' }}>
          <span className={s.playerName}>{p.name}</span>
          <span className={s.playerTeam}>{p.role === 'host' ? 'Anfitrión' : 'Conectado'}</span>
          {LINK_TEXT[p.link] && <span className={s.link} data-link={p.link}>{LINK_TEXT[p.link]}</span>}
        </li>
      ))}
    </ul>
  );
}

function SettingsSummary({ settings }: { settings: LobbySettings }) {
  return (
    <p className={s.summary}>
      <b>{circuitName(settings.circuitId)}</b> · {FORMAT_TEXT[settings.format] ?? settings.format} · {weatherName(settings.weather)}
    </p>
  );
}

function Ended({ status, onLeave }: { status: RoomStatusView; onLeave: () => void }) {
  return (
    <div className={s.screen}>
      <main className={s.body}><section className={s.card}>
        <p className={s.big}>{status === 'closed' ? 'La sala se ha cerrado' : 'La carrera ha empezado'}</p>
        {status === 'race' && <p className={s.dim}>La carrera compartida en pantalla llega con la siguiente tarea.</p>}
        <button type="button" className={s.primary} onClick={onLeave}>Volver al menú</button>
      </section></main>
    </div>
  );
}

/** Sala del anfitrión: código, enlace y QR, ajustes de la carrera y quién se va conectando. */
export function HostLobby({ code, link, qr, settings, players, onSettings, onOpenTeams, onClose }: {
  code: string;
  link: string;
  /** QR del enlace en SVG (null mientras se genera). */
  qr: string | null;
  settings: LobbySettings;
  teams?: RoomTeam[];
  players: RoomPlayer[];
  onSettings: (settings: LobbySettings) => void;
  onOpenTeams: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <h1>Sala</h1>
        <button type="button" className={s.ghost} onClick={onClose}><X size={18} aria-hidden="true" />Cerrar sala</button>
      </header>
      <main className={s.body}>
        <section className={s.card}>
          <div className={s.codeRow}>
            <div>
              <div className={s.label}>Código</div>
              <div className={s.code}>{code}</div>
            </div>
            {qr && <div className={s.qr} role="img" aria-label="QR del enlace de la sala" dangerouslySetInnerHTML={{ __html: qr }} />}
          </div>
          <div className={s.linkRow}>
            <span className={s.linkText}>{link}</span>
            <button type="button" className={s.button} onClick={copy}><Copy size={16} aria-hidden="true" />{copied ? 'Copiado' : 'Copiar'}</button>
          </div>
        </section>

        <section className={s.card}>
          <h2 className={s.title}>Carrera</h2>
          <details className={s.picker}>
            <summary className={s.pickerHead}><span className={s.label}>Circuito</span><b>{circuitName(settings.circuitId)}</b></summary>
            <div className={s.pickerList}>
              {Object.values(OFFICIAL_CIRCUITS).map(c => (
                <button key={c.id} type="button" className={s.choice} aria-pressed={c.id === settings.circuitId}
                  onClick={() => onSettings({ ...settings, circuitId: c.id })}>
                  {c.name}
                </button>
              ))}
            </div>
          </details>
          {/* [N9] En la sala: GP directo o con clasificación (decisión del usuario del 19/10/2026); el sprint no. */}
          <div className={s.inputRow}>
            <span className={s.label}>Formato</span>
            <Segmented wrap label="Formato" name="sala-formato" value={settings.format === 'clasificacion' ? 'clasificacion' : 'directo'}
              options={[{ value: 'directo', label: 'GP directo', title: 'Parrilla prefijada' }, { value: 'clasificacion', label: 'Con clasificación', title: 'Q1, Q2 y Q3 antes de salir' }]}
              onChange={format => onSettings({ ...settings, format })} />
          </div>
          {/* [UX3] El tiempo es una herramienta de prueba: se elige solo con el modo desarrollador; sin él, se sortea. */}
          <div className={s.inputRow}>
            <span className={s.label}>Tiempo</span>
            {devMode() ? (
              <Segmented wrap label="Tiempo" name="sala-tiempo" value={settings.weather}
                options={WEATHER_SCENARIOS.map(w => ({ value: w.id as string, label: w.label, title: w.description }))}
                onChange={weather => onSettings({ ...settings, weather })} />
            ) : <span className={s.dim}>Se sortea según el circuito</span>}
          </div>
        </section>

        <section className={s.card}>
          <h2 className={s.title}>Conectados <span className={s.dim}>{players.length}</span></h2>
          <PlayerList players={players} />
        </section>
      </main>
      <footer className={s.foot}>
        <button type="button" className={s.primary} onClick={onOpenTeams}><Users size={16} aria-hidden="true" />Elegir equipos</button>
      </footer>
    </div>
  );
}

export type JoinError = 'codigo-invalido' | 'no-existe' | 'en-carrera' | 'misma-sesion' | string;
const JOIN_ERRORS: Record<string, string> = {
  'codigo-invalido': 'El código no es válido: son seis letras y números.',
  'no-existe': 'Esa sala no existe o ya se ha cerrado.',
  'en-carrera': 'La carrera de esa sala ya ha empezado.',
  'misma-sesion': 'Esta ventana ya es la del anfitrión de la sala. Para entrar como otro jugador, abre el enlace en una ventana de incógnito o en otro navegador.',
};

export function JoinRoomScreen({ initialCode = '', name: initialName = '', error, busy, onJoin, onBack }: {
  initialCode?: string;
  name?: string;
  error: JoinError | null;
  busy: boolean;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <h1>Unirse a una sala</h1>
        <button type="button" className={s.ghost} onClick={onBack}>Volver</button>
      </header>
      <main className={s.body}>
        <form className={s.card} onSubmit={event => { event.preventDefault(); onJoin(code, name); }}>
          <label className={s.inputRow}>
            <span className={s.label}>Código de la sala</span>
            <input className={s.input} value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" placeholder="ABC234" />
          </label>
          <label className={s.inputRow}>
            <span className={s.label}>Tu nombre</span>
            <input className={s.input} value={name} onChange={e => setName(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="Jugador" />
          </label>
          {error && <p className={s.error} role="alert">{JOIN_ERRORS[error] ?? error}</p>}
          <button type="submit" className={s.primary} disabled={busy || !code.trim()}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <p className={s.dim}>No hace falta registrarse.</p>
        </form>
      </main>
    </div>
  );
}

/** Sala del invitado: quién está y la carrera elegida, hasta que el anfitrión abra la elección de equipos. */
export function GuestWaiting({ code, players, settings, status, onLeave }: {
  code: string;
  players: RoomPlayer[];
  settings: LobbySettings | null;
  status: RoomStatusView;
  onLeave: () => void;
}) {
  if (status !== 'lobby') return <Ended status={status} onLeave={onLeave} />;
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <h1>Sala {code}</h1>
        <button type="button" className={s.ghost} onClick={onLeave}><LogOut size={18} aria-hidden="true" />Salir</button>
      </header>
      <main className={s.body}>
        {settings && <section className={s.card}><SettingsSummary settings={settings} /></section>}
        <section className={s.card}>
          <p className={s.big}>Esperando a que el anfitrión abra la elección de equipos</p>
        </section>
        <section className={s.card}>
          <h2 className={s.title}>Conectados <span className={s.dim}>{players.length}</span></h2>
          <PlayerList players={players} />
        </section>
      </main>
    </div>
  );
}

/** Con «reducir movimiento» en el sistema, sin animaciones. */
const calm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Parrilla de equipos con respuesta inmediata (el anfitrión tarda en confirmar con Firebase de verdad): al pulsar, la
 * tarjeta se hunde y queda «Pidiendo…»; al confirmarse, salta; si te lo quitaron, tiembla; cuando otro coge o suelta
 * un equipo, su nombre entra con un destello.
 */
function TeamGrid({ teams, taken, myUid, nameOf, askedTeam, refused, onPick }: {
  teams: RoomTeam[];
  taken: Record<string, string>;
  myUid: string;
  nameOf: (uid: string) => string;
  askedTeam: string | null;
  /** Petición rechazada (equipo y número de petición), para que tiemble una vez. */
  refused: { teamId: string; at: number } | null;
  onPick: (want: { teamId: string }) => void;
}) {
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const grid = useRef<HTMLElement | null>(null);
  const previous = useRef<Record<string, string> | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);
  const myTeam = Object.entries(taken).find(([, uid]) => uid === myUid)?.[0] ?? null;

  // Entrada escalonada al abrir la página.
  useEffect(() => {
    if (calm() || !grid.current) return;
    animate(grid.current.querySelectorAll('button'), { opacity: [0, 1], translateY: [12, 0], delay: stagger(35), duration: 380, ease: 'outQuad' });
  }, []);

  // Cambios del reparto: mi equipo confirmado salta; el de otro, destello en su nombre.
  useEffect(() => {
    const before = previous.current;
    previous.current = { ...taken };
    if (!before || calm()) return;
    for (const t of teams) {
      const card = cards.current.get(t.id);
      if (!card || before[t.id] === taken[t.id]) continue;
      if (taken[t.id] === myUid) animate(card, { scale: [0.94, 1.06, 1], duration: 520, ease: 'outBack' });
      else {
        const label = card.querySelector('[data-owner]');
        if (label) animate(label, { opacity: [0, 1], translateX: [-8, 0], duration: 420, ease: 'outQuad' });
        animate(card, { filter: ['brightness(1.6)', 'brightness(1)'], duration: 600, ease: 'outQuad' });
      }
    }
  }, [taken, teams, myUid]);

  // Petición rechazada: la tarjeta tiembla.
  useEffect(() => {
    if (!refused) return;
    setClicked(null);
    const card = cards.current.get(refused.teamId);
    if (card && !calm()) animate(card, { translateX: [0, -9, 9, -6, 6, -3, 0], duration: 480, ease: 'linear' });
  }, [refused?.teamId, refused?.at]);

  // «Pidiendo…» dura hasta que llega la petición, la confirmación o el equipo lo coge otro.
  useEffect(() => {
    if (clicked && (myTeam === clicked || askedTeam === clicked || (taken[clicked] && taken[clicked] !== myUid))) setClicked(null);
  }, [clicked, myTeam, askedTeam, taken, myUid]);

  const pick = (teamId: string) => {
    const card = cards.current.get(teamId);
    if (card && !calm()) animate(card, { scale: [1, 0.95, 1], duration: 260, ease: 'outQuad' });
    setClicked(teamId);
    onPick({ teamId });
  };

  return (
    <section className={s.grid} aria-label="Equipos" ref={grid}>
      {teams.map(t => {
        const owner = taken[t.id];
        const mine = owner === myUid;
        const waiting = !owner && (askedTeam === t.id || clicked === t.id);
        return (
          <button key={t.id} type="button" className={s.teamCard} data-team={t.id} data-state={mine ? 'mio' : waiting ? 'pidiendo' : undefined}
            ref={el => { if (el) cards.current.set(t.id, el); else cards.current.delete(t.id); }}
            style={{ ['--c' as string]: t.color }} disabled={Boolean(owner) && !mine} aria-pressed={mine}
            onClick={() => { if (!owner) pick(t.id); }}>
            <span className={s.teamName}>{t.name}</span>
            <span className={s.teamOwner} data-owner>
              {mine ? <><Check size={14} aria-hidden="true" />Tú</> : owner ? nameOf(owner) : askedTeam === t.id ? 'Esperando confirmación' : clicked === t.id ? 'Pidiendo…' : 'Libre'}
            </span>
          </button>
        );
      })}
    </section>
  );
}

/** Elección de equipos, común a todos: los diez equipos con quién lleva cada uno, en tiempo real. */
export function TeamSelection({ code, myUid, isHost, teams, players, seats, settings, wants, status, onPick, onStart, onLeave }: {
  code: string;
  myUid: string;
  isHost: boolean;
  teams: RoomTeam[];
  players: RoomPlayer[];
  seats: Seats | null;
  settings: LobbySettings | null;
  /** Lo último que ha pedido este jugador. */
  wants: SeatWant | null;
  status: RoomStatusView;
  onPick: (want: { teamId: string } | { spectator: true }) => void;
  onStart?: () => void;
  onLeave: () => void;
}) {
  if (status !== 'lobby') return <Ended status={status} onLeave={onLeave} />;
  const taken = seats?.teams ?? {};
  const nameOf = (uid: string) => players.find(p => p.uid === uid)?.name ?? '…';
  const myTeam = Object.entries(taken).find(([, uid]) => uid === myUid)?.[0] ?? null;
  const spectating = seats?.spectators.includes(myUid) ?? false;
  // Una petición está pendiente hasta que el anfitrión la atiende; si el equipo estaba cogido, hay que pedir otro.
  const handledAt = seats?.handled?.[myUid];
  const served = Boolean(wants && handledAt !== undefined && (wants.at ?? 0) <= handledAt);
  const satisfied = Boolean(wants && ('spectator' in wants ? spectating : wants.teamId === myTeam));
  const asked = Boolean(wants) && !served && !satisfied;
  const refused = Boolean(wants) && served && !satisfied;
  const askedTeam = asked && wants && 'teamId' in wants ? wants.teamId : null;
  const watching = players.filter(p => seats?.spectators.includes(p.uid));
  const choosing = players.filter(p => !Object.values(taken).includes(p.uid) && !seats?.spectators.includes(p.uid));
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <h1>Equipos · {code}</h1>
        <button type="button" className={s.ghost} onClick={onLeave}>
          {isHost ? <><X size={18} aria-hidden="true" />Cerrar sala</> : <><LogOut size={18} aria-hidden="true" />Salir</>}
        </button>
      </header>
      <main className={s.body}>
        {settings && <section className={s.card}><SettingsSummary settings={settings} /></section>}
        {refused && <p className={s.notice} role="status">Ese equipo ya estaba cogido: elige otro.</p>}
        {asked && <p className={s.notice} role="status">Esperando confirmación del anfitrión…</p>}
        <TeamGrid teams={teams} taken={taken} myUid={myUid} nameOf={nameOf} askedTeam={askedTeam} onPick={onPick}
          refused={refused && wants && 'teamId' in wants ? { teamId: wants.teamId, at: wants.at ?? 0 } : null} />
        <section className={s.card}>
          <p className={s.summary}><b>Mirando:</b> {watching.length ? watching.map(p => p.name).join(', ') : 'nadie'}</p>
          <p className={s.summary}><b>Sin equipo:</b> {choosing.length ? choosing.map(p => p.name).join(', ') : 'nadie'}</p>
          {!isHost && !spectating && <button type="button" className={s.button} onClick={() => onPick({ spectator: true })}><Eye size={16} aria-hidden="true" />Entrar a mirar</button>}
        </section>
      </main>
      {isHost && (
        <footer className={s.foot}>
          {!myTeam && <span className={s.dim}>Elige tu equipo para empezar</span>}
          <button type="button" className={s.primary} onClick={onStart} disabled={!myTeam}><Play size={16} fill="#fff" aria-hidden="true" />Empezar</button>
        </footer>
      )}
    </div>
  );
}
