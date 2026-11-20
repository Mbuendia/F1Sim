// [N8] Pantalla de carrera del invitado (decisión del usuario del 19/10/2026: una pantalla nueva, más sencilla que la
// del anfitrión). Pista, tiempos y, si juega, el muro de su equipo con sus órdenes; «Pedir pausa» y el estado del
// enlace. Sin herramientas, control de velocidad ni pausa: eso es del anfitrión. El espectador ve pista y tiempos.
// [N10] Tras la primera prueba entre redes (decisión del usuario del 19/10/2026): en el móvil, la pista arriba y dos
// pestañas, «Muro» (por defecto si juega) y «Tiempos», para no tener que bajar por la clasificación hasta el muro; un
// solo selector de ritmo (el del bloque de paradas) y avisos durante la salida.
// No sabe nada de la red: recibe lo que hay en el almacén de la carrera y devuelve las órdenes.
import { RacePlanScreen } from './RacePlanScreen';
import { planOrders } from '../utils/racePlan';
import { LeaveRaceDialog } from './LeaveRaceDialog';
import { useLeaveGuard } from '../utils/leaveRace';
import { LapCounter } from './LapCounter';
import { RotateNotice } from './RotateNotice';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CloudSun, Hand, ListOrdered, LogOut, Play, Radio, X } from 'lucide-react';
import RaceFlagsHUD from './RaceFlagsHUD';
import { StartLights } from './StartLights';
import { RightStatsPanel } from './RightStatsPanel';
import { BottomTelemetryDock } from './BottomTelemetryDock';
import { StintTimeline } from './StintTimeline';
import { WallPanel } from './WallPanel';
import type { WallReading } from '../simulation/Wall';
import type { RaceFlagState, SafetyCarState, CarState, TrackWeatherState, StartLightState } from '../types/f1';
import type { RainForecast } from '../simulation/WeatherForecast';
import { formatLapTime } from '../simulation/Qualifying';
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

export function ClientRaceScreen({ role, myTeamId, roster, fast, slow, teams, link, pauseRequested, closed = false, track, onOrder, onRequestPause, onLeave, myUid, onResumePause, selectedCarId = null, onSelectCar, roomCode = null }: {
  role: 'player' | 'spectator';
  myTeamId: string | null;
  roster: RosterEntry[];
  fast: FastView | null;
  slow: SlowView | null;
  teams: Record<string, TeamView>;
  link: LinkLabel;
  /** Ya ha pedido pausa y aún no puede volver a pedirla. */
  pauseRequested: boolean;
  /** [MJ2, 19/11/2026] Quién es el invitado (para saber si la pausa es suya) y cómo seguir. */
  myUid?: string;
  onResumePause?: () => void;
  /** [MJ3, 19/11/2026] Coche que se ve en detalle (tocado en la pista o en los tiempos) y cómo cambiarlo. */
  selectedCarId?: number | null;
  onSelectCar?: (carId: number | null) => void;
  /** [N9] El anfitrión ha cerrado la sala (o se ha caído y la sala se ha borrado). */
  closed?: boolean;
  /** La pista (un lienzo en la aplicación; nada en los tests). */
  track?: ReactNode;
  onOrder: (order: EngineOrder) => Promise<Ack>;
  onRequestPause: () => void;
  onLeave: () => void;
  /** [MJ9, 20/11/2026] Código de la sala, para decir cómo volver a entrar. */
  roomCode?: string | null;
}) {
  // [MJ3, 19/11/2026] Tres pestañas si juega (muro, tiempos y tiempo); el espectador, tiempos y tiempo.
  const [tab, setTab] = useState<'muro' | 'tiempos' | 'tiempo'>(role === 'player' ? 'muro' : 'tiempos');
  // [MJ9, 20/11/2026] Salir de la carrera en curso pide confirmación; también «atrás» del móvil y recargar o cerrar la pestaña.
  const [leaveAsk, setLeaveAsk] = useState(false);
  const leaveGuarded = Boolean(slow) && !slow?.finished && !closed;
  useLeaveGuard(leaveGuarded, () => setLeaveAsk(true));
  const requestLeave = () => { if (leaveGuarded) setLeaveAsk(true); else onLeave(); };
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
  const pausesLeft = myUid ? slow?.pausesLeft?.[myUid] : undefined;
  // [MJ3, 19/11/2026] Banderas y Safety Car, como los ve el anfitrión (de la vista común).
  const safetyCar: SafetyCarState | null = slow?.safetyCar?.isDeployed ? {
    isDeployed: true, mode: slow.safetyCar.mode as SafetyCarState['mode'], phase: (slow.safetyCar.phase ?? undefined) as SafetyCarState['phase'],
    lapCount: slow.safetyCar.lapCount, targetLaps: slow.safetyCar.targetLaps, triggerReason: slow.safetyCar.reason,
    progress: 0, trackT: 0, currentSpeedKmh: 0, deployedAtRaceTime: 0,
  } : null;
  // [MJ3, 19/11/2026] Detalle del coche tocado: de los tuyos, todo lo de tu vista de equipo; de un rival, solo lo público.
  const detail = selectedCarId === null ? null : cars.find(car => car.id === selectedCarId) ?? null;
  const detailOwn = Boolean(detail && myTeamId && detail.team.id === myTeamId);
  const reading = detailOwn && myTeamId ? ((teams[myTeamId]?.cars.find(car => car.id === detail!.id)?.reading as WallReading | null | undefined) ?? null) : null;
  return (
    <div className={s.screen}>
      {/* [MJ1] También el invitado juega en vertical en el móvil. */}
      <RotateNotice inRace />
      <header className={s.head}>
        <div className={s.title}>
          {/* [MJ5] La vuelta va en el contador grande de la pista (MJ4); aquí solo se espera a que empiece. */}
          {!slow && <b className={s.lap}>Esperando la carrera…</b>}
          {role === 'spectator' && <span className={s.tag}>Mirando</span>}
        </div>
        <span className={s.link} data-link={link}>{LINK_TEXT[link]}</span>
        {player && (
          // [MJ2, 19/11/2026] Pide pausa (pausa de verdad, con las que le quedan); en pausa, sin botón: el aviso de abajo dice cómo seguir.
          <button type="button" className={s.button} onClick={onRequestPause} disabled={pauseRequested || Boolean(slow?.paused) || pausesLeft === 0}>
            <Hand size={16} aria-hidden="true" />{pauseRequested ? 'Pausa pedida' : pausesLeft === 0 ? 'Sin pausas' : `Pedir pausa${pausesLeft !== undefined ? ` (${pausesLeft})` : ''}`}
          </button>
        )}
        <button type="button" className={s.ghost} onClick={requestLeave} aria-label="Salir de la sala"><LogOut size={18} aria-hidden="true" /></button>
      </header>
      {/* [MJ11, 20/11/2026] Antes de la salida, el invitado planifica sus coches; la salida la da el anfitrión. */}
      {player && slow?.light === 'idle' && own.length > 0 && (
        <RacePlanScreen role="invitado" totalLaps={slow.totalLaps} look={{ team: own[0].team, number: own[0].driver.number, compound: own[0].tires.compound }}
          cars={own.map(c => ({ id: c.id, code: c.driver.code, number: c.driver.number, color: c.team.color, compound: c.tires.compound, inventory: null }))}
          onConfirm={async plans => { for (const [id, plan] of Object.entries(plans)) for (const order of planOrders(Number(id), plan)) await onOrder(order); }} />
      )}
      {leaveAsk && <LeaveRaceDialog kind={player ? 'invitado' : 'espectador'} roomCode={roomCode} onStay={() => setLeaveAsk(false)} onLeave={() => { setLeaveAsk(false); onLeave(); }} />}
      <PauseStatus pause={slow?.guestPause} canResume={Boolean(myUid && slow?.guestPause?.uid === myUid)} mine={Boolean(myUid && slow?.guestPause?.uid === myUid)} onResume={() => onResumePause?.()} />
      <div className={s.layout}>
        <section className={s.track}>
          {track}
          {/* [MJ4] Las vueltas, a la vista: el mismo contador que el anfitrión. */}
          {slow && <LapCounter lap={slow.lap} total={slow.totalLaps} light={slow.light} finished={slow.finished} />}
          <RaceFlagsHUD raceFlagState={(slow?.flag ?? 'green') as RaceFlagState} sectorFlags={(slow?.sectorFlags?.length === 3 ? slow.sectorFlags : ['green', 'green', 'green']) as [RaceFlagState, RaceFlagState, RaceFlagState]} safetyCar={safetyCar} />
          {/* [MJ12, 20/11/2026] El invitado también ve el semáforo de salida (sin botón: la salida la da el anfitrión). */}
          <StartLights lightState={(slow?.light ?? 'idle') as StartLightState} cars={[]} favoriteCarId={0} onSelectFavoriteCar={() => {}} />
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
          {detail && (
            <section className={s.detail} data-detail={detailOwn ? 'propio' : 'rival'} aria-label={`Detalle de ${detail.driver.code}`}>
              <header className={s.detailHead}>
                <b style={{ borderLeft: `4px solid ${detail.team.color}`, paddingLeft: 8 }}>{detail.driver.code} · P{detail.currentPosition}</b>
                <span className={s.dim}>{detail.team.name}</span>
                <button type="button" className={s.ghost} onClick={() => onSelectCar?.(null)} aria-label="Cerrar detalle"><X size={16} aria-hidden="true" /></button>
              </header>
              {detailOwn ? (
                <>
                  <BottomTelemetryDock car={detail as unknown as CarState} onSelectCar={id => onSelectCar?.(id)} compact />
                  <StintTimeline stints={(detail as unknown as CarState).pitStop?.stints ?? []} currentLap={detail.currentLap} totalLaps={slow?.totalLaps ?? 0} />
                  <WallPanel reading={reading} />
                </>
              ) : (
                <dl className={s.facts} data-rival>
                  <div><dt>Última vuelta</dt><dd>{detail.lastLapTime ? formatLapTime(detail.lastLapTime) : '—'}</dd></div>
                  <div><dt>Mejor vuelta</dt><dd>{detail.bestLapTime ? formatLapTime(detail.bestLapTime) : '—'}</dd></div>
                  <div><dt>Sectores</dt><dd>{(['s1', 's2', 's3'] as const).map(k => (detail.sectors?.[k] ? detail.sectors[k]!.toFixed(3) : '—')).join(' · ')}</dd></div>
                  <div><dt>Neumático</dt><dd>{String((detail as unknown as CarState).tires?.compound ?? '—')}</dd></div>
                  <div><dt>Paradas</dt><dd>{(detail as unknown as CarState).pitStop?.totalPitStops ?? 0}</dd></div>
                  <div><dt>A líder</dt><dd>{detail.currentPosition === 1 ? 'Líder' : `+${detail.gapToLeaderSec.toFixed(1)} s`}</dd></div>
                </dl>
              )}
            </section>
          )}
          {/* El espectador no tiene pestañas (N10): ve los tiempos y, debajo, el tiempo. */}
          {player && (
            <div className={s.tabs} role="tablist" aria-label="Carrera">
              {<button type="button" role="tab" aria-selected={tab === 'muro'} className={s.tab} onClick={() => setTab('muro')}><Radio size={16} aria-hidden="true" />Muro</button>}
              <button type="button" role="tab" aria-selected={tab === 'tiempos'} className={s.tab} onClick={() => setTab('tiempos')}><ListOrdered size={16} aria-hidden="true" />Tiempos</button>
              <button type="button" role="tab" aria-selected={tab === 'tiempo'} className={s.tab} onClick={() => setTab('tiempo')}><CloudSun size={16} aria-hidden="true" />Tiempo</button>
            </div>
          )}
          <section className={s.timing} data-timing hidden={player && tab !== 'tiempos'}>
            <Leaderboard cars={cars} selectedCarId={selectedCarId} onSelectCar={id => onSelectCar?.(id)} fastestLapDriverName={slow?.fastestLap?.driverName ?? null} leaderLap={slow?.lap ?? 0} />
          </section>
          {/* [MJ3, 19/11/2026] El tiempo, con el mismo panel que el anfitrión (cielo, temperaturas, agua, radar y previsión). */}
          <section className={s.weather} data-weather hidden={player && tab !== 'tiempo'}>
            {(!player || tab === 'tiempo') && (
              <RightStatsPanel car={null} defaultCar={(own[0] ?? cars[0] ?? null) as unknown as CarState | null} totalLaps={slow?.totalLaps ?? 0}
                overallBestS1={slow?.bestSectors?.[0] ?? null} overallBestS2={slow?.bestSectors?.[1] ?? null} overallBestS3={slow?.bestSectors?.[2] ?? null}
                weather={(slow?.weatherState as TrackWeatherState | undefined) ?? undefined} rainForecast={(slow?.forecast as RainForecast | null | undefined) ?? null} initialTab="track_weather" />
            )}
          </section>
          {player && (
            <section className={s.wall} data-wall aria-label="Muro de tu equipo" hidden={!showWall}>
              {/* Paradas, ritmo, órdenes de equipo y propuestas de los dos pilotos, en el bloque de siempre. */}
              {own.length > 0
                ? <div className={s.car} style={{ ['--c' as string]: own[0].team.color }}><BoxControls car={own[0]} teamCars={own} team={team} race={race} send={onOrder} onSelectCar={id => onSelectCar?.(id)} slow={slow} /></div>
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

/** [MJ2, 19/11/2026] La pausa de un invitado, para todos: quién la pidió, cuánto falta para que siga sola y «Seguir» para quien puede. */
export function PauseStatus({ pause, canResume, onResume, mine = false }: { pause: { name: string; remainingSec: number } | null | undefined; canResume: boolean; onResume: () => void; /** La pausa es tuya. */ mine?: boolean }) {
  if (!pause) return null;
  return (
    <div className={s.pauseStatus} role="status" aria-live="polite" data-pause-status>
      <Hand size={18} aria-hidden="true" />
      <span><b>En pausa</b> · {mine ? 'la has pedido tú' : `la ha pedido ${pause.name}`} · sigue sola en {pause.remainingSec} s</span>
      {canResume && <button type="button" className={s.primary} onClick={onResume}>Seguir</button>}
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
