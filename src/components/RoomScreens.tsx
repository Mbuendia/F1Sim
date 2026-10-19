// [N7] Pantallas de sala: la del anfitrión (código, enlace, QR, ajustes y jugadores), la de unirse por código y la de
// espera del invitado (elegir un equipo libre o mirar). No saben nada de Firebase: reciben el estado de la sala ya
// leído y devuelven lo que elige el jugador. Pensadas primero para el móvil (375 px, controles de 44 px).
import { useState } from 'react';
import { Copy, Eye, LogOut, Play, X } from 'lucide-react';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { WEATHER_SCENARIOS } from '../data/weatherScenarios';
import { isSprintVenue } from '../simulation/Weekend';
import { RaceFormatSelect } from './RaceFormatSelect';
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

const LINK_TEXT: Record<LinkLabel, string> = { none: '', connecting: 'Conectando', direct: 'Directo', fallback: 'Respaldo', down: 'Caído' };
const FORMAT_TEXT: Record<RaceFormatId, string> = { directo: 'GP directo', clasificacion: 'Con clasificación', sprint: 'Sprint' };
const circuitName = (id: string) => OFFICIAL_CIRCUITS[id]?.name ?? id;
const weatherName = (id: string) => WEATHER_SCENARIOS.find(w => w.id === id)?.label ?? id;
const teamById = (teams: RoomTeam[], id: string | null) => (id ? teams.find(t => t.id === id) : undefined);

function PlayerList({ players, teams }: { players: RoomPlayer[]; teams: RoomTeam[] }) {
  return (
    <ul className={s.players}>
      {players.map(p => {
        const team = teamById(teams, p.teamId);
        const what = p.role === 'spectator' ? 'Mirando' : p.role === 'pending' ? 'Eligiendo equipo' : team?.name ?? '';
        return (
          <li key={p.uid} className={s.player} style={{ ['--c' as string]: team?.color ?? 'var(--line-strong)' }}>
            <span className={s.playerName}>{p.name}{p.role === 'host' ? ' · anfitrión' : ''}</span>
            <span className={s.playerTeam}>{what}</span>
            {LINK_TEXT[p.link] && <span className={s.link} data-link={p.link}>{LINK_TEXT[p.link]}</span>}
          </li>
        );
      })}
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

export function HostLobby({ code, link, qr, settings, teams, players, hostTeamId, status = 'lobby', onSettings, onHostTeam, onStart, onClose }: {
  code: string;
  link: string;
  /** QR del enlace en SVG (null mientras se genera). */
  qr: string | null;
  settings: LobbySettings;
  teams: RoomTeam[];
  players: RoomPlayer[];
  hostTeamId?: string;
  status?: 'lobby' | 'race';
  onSettings: (settings: LobbySettings) => void;
  onHostTeam?: (teamId: string) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false));
  };
  const taken = new Set(players.filter(p => p.uid !== players.find(h => h.role === 'host')?.uid).map(p => p.teamId).filter(Boolean));
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
                  onClick={() => onSettings({ ...settings, circuitId: c.id, format: settings.format === 'sprint' && !isSprintVenue(c.id) ? 'clasificacion' : settings.format })}>
                  {c.name}
                </button>
              ))}
            </div>
          </details>
          <RaceFormatSelect value={settings.format} sprintAvailable={isSprintVenue(settings.circuitId)} onChange={format => onSettings({ ...settings, format })} />
          <div className={s.inputRow}>
            <span className={s.label}>Tiempo</span>
            <Segmented wrap label="Tiempo" name="sala-tiempo" value={settings.weather}
              options={WEATHER_SCENARIOS.map(w => ({ value: w.id as string, label: w.label, title: w.description }))}
              onChange={weather => onSettings({ ...settings, weather })} />
          </div>
          {onHostTeam && (
            <details className={s.picker}>
              <summary className={s.pickerHead}><span className={s.label}>Tu equipo</span><b>{teamById(teams, hostTeamId ?? null)?.name ?? '—'}</b></summary>
              <div className={s.pickerList}>
                {teams.filter(t => t.id === hostTeamId || !taken.has(t.id)).map(t => (
                  <button key={t.id} type="button" className={s.choice} aria-pressed={t.id === hostTeamId} style={{ ['--c' as string]: t.color }} onClick={() => onHostTeam(t.id)}>{t.name}</button>
                ))}
              </div>
            </details>
          )}
        </section>

        <section className={s.card}>
          <h2 className={s.title}>Jugadores <span className={s.dim}>{players.length}</span></h2>
          <PlayerList players={players} teams={teams} />
        </section>
        {status === 'race' && <p className={s.notice}>La sala está en carrera. La carrera compartida en pantalla llega con la siguiente tarea.</p>}
      </main>
      <footer className={s.foot}>
        <button type="button" className={s.primary} onClick={onStart} disabled={status !== 'lobby'}><Play size={16} fill="#fff" aria-hidden="true" />Empezar</button>
      </footer>
    </div>
  );
}

export type JoinError = 'codigo-invalido' | 'no-existe' | 'en-carrera' | string;
const JOIN_ERRORS: Record<string, string> = {
  'codigo-invalido': 'El código no es válido: son seis letras y números.',
  'no-existe': 'Esa sala no existe o ya se ha cerrado.',
  'en-carrera': 'La carrera de esa sala ya ha empezado.',
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

export function GuestLobby({ code, myUid, teams, players, seats, settings, wants, status, onPick, onLeave }: {
  code: string;
  myUid: string;
  teams: RoomTeam[];
  players: RoomPlayer[];
  seats: Seats | null;
  settings: LobbySettings | null;
  /** Lo último que ha pedido este invitado. */
  wants: SeatWant | null;
  status: 'lobby' | 'race' | 'closed';
  onPick: (want: { teamId: string } | { spectator: true }) => void;
  onLeave: () => void;
}) {
  if (status === 'closed') {
    return (
      <div className={s.screen}>
        <main className={s.body}><section className={s.card}><p className={s.big}>La sala se ha cerrado</p>
          <button type="button" className={s.primary} onClick={onLeave}>Volver al menú</button></section></main>
      </div>
    );
  }
  const taken = seats?.teams ?? {};
  const myTeam = Object.entries(taken).find(([, uid]) => uid === myUid)?.[0] ?? null;
  const spectating = seats?.spectators.includes(myUid) ?? false;
  // Una petición está pendiente hasta que el anfitrión la atiende; si el equipo estaba cogido, hay que pedir otro.
  const handledAt = seats?.handled?.[myUid];
  const served = Boolean(wants && handledAt !== undefined && (wants.at ?? 0) <= handledAt);
  const satisfied = Boolean(wants && ('spectator' in wants ? spectating : wants.teamId === myTeam));
  const asked = Boolean(wants) && !served && !satisfied;
  const refused = Boolean(wants) && served && !satisfied;
  const free = teams.filter(t => taken[t.id] === undefined);
  const team = teamById(teams, myTeam);
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <h1>Sala {code}</h1>
        <button type="button" className={s.ghost} onClick={onLeave}><LogOut size={18} aria-hidden="true" />Salir</button>
      </header>
      <main className={s.body}>
        {settings && <section className={s.card}><SettingsSummary settings={settings} /></section>}
        <section className={s.card}>
          {status === 'race' ? <p className={s.big}>La carrera ha empezado</p>
            : asked ? <p className={s.big}>Esperando al anfitrión…</p>
            : team ? <p className={s.big} style={{ ['--c' as string]: team.color }}><span className={s.teamMark} />{team.name} · Esperando a que empiece</p>
            : spectating ? <p className={s.big}>Mirando · Esperando a que empiece</p>
            : <p className={s.big}>Elige un equipo</p>}
          {status === 'lobby' && refused && !asked && <p className={s.notice}>Ese equipo ya estaba cogido: elige otro.</p>}
          {status === 'lobby' && (
            <>
              <div className={s.teams}>
                {free.map(t => (
                  <button key={t.id} type="button" className={s.teamButton} data-team={t.id} style={{ ['--c' as string]: t.color }}
                    aria-pressed={wants && 'teamId' in wants ? wants.teamId === t.id : false} onClick={() => onPick({ teamId: t.id })}>{t.name}</button>
                ))}
              </div>
              {!spectating && <button type="button" className={s.button} onClick={() => onPick({ spectator: true })}><Eye size={16} aria-hidden="true" />Entrar a mirar</button>}
            </>
          )}
        </section>
        <section className={s.card}>
          <h2 className={s.title}>Jugadores <span className={s.dim}>{players.length}</span></h2>
          <PlayerList players={players} teams={teams} />
        </section>
      </main>
    </div>
  );
}
