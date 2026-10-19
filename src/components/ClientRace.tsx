// [N8] Pantalla de carrera del invitado (decisión del usuario del 19/10/2026: una pantalla nueva, más sencilla que la
// del anfitrión). Pista, tiempos y, si juega, el muro de su equipo con sus órdenes; «Pedir pausa» y el estado del
// enlace. Sin herramientas, control de velocidad ni pausa: eso es del anfitrión. El espectador ve pista y tiempos.
// [N10] Tras la primera prueba entre redes (decisión del usuario del 19/10/2026): en el móvil, la pista arriba y dos
// pestañas, «Muro» (por defecto si juega) y «Tiempos», para no tener que bajar por la clasificación hasta el muro; un
// solo selector de ritmo (el del bloque de paradas) y avisos durante la salida.
// No sabe nada de la red: recibe lo que hay en el almacén de la carrera y devuelve las órdenes.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Hand, ListOrdered, LogOut, Play, Radio, X } from 'lucide-react';
import { ResultsTable } from './ResultsTable';
import type { RaceResult } from '../simulation/RaceResult';
import { carViews } from '../engine/raceCars';
import type { RosterEntry } from '../engine/raceCars';
import type { FastView, SlowView, TeamView } from '../engine/RaceView';
import type { EngineOrder } from '../engine/EngineHost';
import type { Ack } from '../engine/RaceSession';
import { Leaderboard } from './Leaderboard';
import { BoxControls } from './BoxControls';
import type { LinkLabel } from './RoomScreens';
import s from './ClientRace.module.css';

const LINK_TEXT: Record<LinkLabel, string> = { none: 'Sin enlace', connecting: 'Conectando', direct: 'Directo', fallback: 'Respaldo', down: 'Caído' };

/** [N10] Qué está pasando antes de la salida (el invitado no ve los controles del anfitrión que la dan). */
function startNotice(light: string | undefined): { text: string; lights?: number } | null {
  if (light === 'formation-lap') return { text: 'Vuelta de formación' };
  if (light === 'grid-parking') return { text: 'Los coches se colocan en la parrilla' };
  if (light === 'grid-ready') return { text: 'Esperando la salida del anfitrión' };
  const lit = /^lights-(\d)$/.exec(light ?? '');
  if (lit) return { text: `Luces: ${lit[1]} de 5`, lights: Number(lit[1]) };
  if (light === 'lights-out') return { text: 'Luces fuera', lights: 0 };
  return null;
}

export function ClientRaceScreen({ role, myTeamId, roster, fast, slow, teams, link, pauseRequested, closed = false, track, onOrder, onRequestPause, onLeave }: {
  role: 'player' | 'spectator';
  myTeamId: string | null;
  roster: RosterEntry[];
  fast: FastView | null;
  slow: SlowView | null;
  teams: Record<string, TeamView>;
  link: LinkLabel;
  /** Ya ha pedido pausa y aún no puede volver a pedirla. */
  pauseRequested: boolean;
  /** [N9] El anfitrión ha cerrado la sala (o se ha caído y la sala se ha borrado). */
  closed?: boolean;
  /** La pista (un lienzo en la aplicación; nada en los tests). */
  track?: ReactNode;
  onOrder: (order: EngineOrder) => Promise<Ack>;
  onRequestPause: () => void;
  onLeave: () => void;
}) {
  const [tab, setTab] = useState<'muro' | 'tiempos'>('muro');
  if (closed) {
    return (
      <div className={s.screen}>
        <main className={s.ended}>
          <p className={s.endTitle}>El anfitrión ha cerrado la sala</p>
          <p className={s.dim}>La carrera compartida ha terminado para todos.</p>
          <button type="button" className={s.primary} onClick={onLeave}>Volver al menú</button>
        </main>
      </div>
    );
  }
  const cars = carViews({ roster, fast, slow, teams });
  const team = myTeamId ? teams[myTeamId] : undefined;
  const player = role === 'player';
  const own = player && myTeamId ? cars.filter(car => car.team.id === myTeamId) : [];
  const race = { lightState: slow?.light ?? 'off', isFinished: Boolean(slow?.finished), raceFlagState: slow?.flag ?? 'green' };
  const notice = startNotice(slow?.light);
  const showWall = player && tab === 'muro';
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <div className={s.title}>
          <b className={s.lap}>{slow ? `Vuelta ${Math.min(slow.lap, slow.totalLaps)}/${slow.totalLaps}` : 'Esperando la carrera…'}</b>
          {role === 'spectator' && <span className={s.tag}>Mirando</span>}
        </div>
        <span className={s.link} data-link={link}>{LINK_TEXT[link]}</span>
        {player && (
          <button type="button" className={s.button} onClick={onRequestPause} disabled={pauseRequested}>
            <Hand size={16} aria-hidden="true" />{pauseRequested ? 'Pausa pedida' : 'Pedir pausa'}
          </button>
        )}
        <button type="button" className={s.ghost} onClick={onLeave} aria-label="Salir de la sala"><LogOut size={18} aria-hidden="true" /></button>
      </header>
      <div className={s.layout}>
        <section className={s.track}>
          {track}
          {notice && (
            <div className={s.start} role="status">
              {notice.lights !== undefined && (
                <span className={s.lamps} aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <span key={i} data-on={i <= (notice.lights ?? 0) ? 'true' : undefined} />)}</span>
              )}
              <span>{notice.text}</span>
            </div>
          )}
        </section>
        <div className={s.panels}>
          {slow?.finished && Boolean(slow.result) && (
            <section className={s.result} aria-label="Resultado">
              <ResultsTable result={slow.result as RaceResult} />
              <SharedRaceEnd isHost={false} onAnother={() => {}} onClose={() => {}} onLeave={onLeave} />
            </section>
          )}
          {player && (
            <div className={s.tabs} role="tablist" aria-label="Carrera">
              <button type="button" role="tab" aria-selected={tab === 'muro'} className={s.tab} onClick={() => setTab('muro')}><Radio size={16} aria-hidden="true" />Muro</button>
              <button type="button" role="tab" aria-selected={tab === 'tiempos'} className={s.tab} onClick={() => setTab('tiempos')}><ListOrdered size={16} aria-hidden="true" />Tiempos</button>
            </div>
          )}
          <section className={s.timing} data-timing hidden={player && tab !== 'tiempos'}>
            <Leaderboard cars={cars} selectedCarId={null} onSelectCar={() => {}} fastestLapDriverName={slow?.fastestLap?.driverName ?? null} leaderLap={slow?.lap ?? 0} />
          </section>
          {player && (
            <section className={s.wall} data-wall aria-label="Muro de tu equipo" hidden={!showWall}>
              {/* Paradas, ritmo, órdenes de equipo y propuestas de los dos pilotos, en el bloque de siempre. */}
              {own.length > 0
                ? <div className={s.car} style={{ ['--c' as string]: own[0].team.color }}><BoxControls car={own[0]} teamCars={own} team={team} race={race} send={onOrder} /></div>
                : <p className={s.dim}>Esperando el muro de tu equipo…</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** [N9] Final de la carrera compartida: el anfitrión elige otra carrera en la misma sala o cerrarla; el invitado espera. */
export function SharedRaceEnd({ isHost, onAnother, onClose, onLeave }: { isHost: boolean; onAnother: () => void; onClose: () => void; onLeave: () => void }) {
  return (
    <div className={s.end} role="group" aria-label="Final de la carrera">
      {isHost ? (
        <>
          <button type="button" className={s.primary} onClick={onAnother}><Play size={16} fill="#fff" aria-hidden="true" />Otra carrera</button>
          <button type="button" className={s.ghost} onClick={onClose}><X size={16} aria-hidden="true" />Cerrar sala</button>
        </>
      ) : (
        <>
          <span className={s.dim}>Esperando al anfitrión: otra carrera o cerrar la sala.</span>
          <button type="button" className={s.ghost} onClick={onLeave}><LogOut size={16} aria-hidden="true" />Salir</button>
        </>
      )}
    </div>
  );
}

/** Aviso al anfitrión: quién pide pausa. Él decide si pausa. */
export function PauseRequestBanner({ requests, onDismiss }: { requests: { uid: string; name: string; at: number }[]; onDismiss: (uid: string) => void }) {
  if (!requests.length) return null;
  return (
    <div className={s.banner} role="status">
      {requests.map(r => (
        <div key={r.uid} className={s.bannerRow}>
          <Hand size={16} aria-hidden="true" /><span>{r.name} pide pausa</span>
          <button type="button" className={s.ghost} onClick={() => onDismiss(r.uid)}>Vale</button>
        </div>
      ))}
    </div>
  );
}
