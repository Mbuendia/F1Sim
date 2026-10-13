import type { ReactNode } from 'react';
import { Check, CloudRain, Play } from 'lucide-react';
import type { WeekendSession } from '../simulation/Hub';
import { SEASON_RACES } from '../simulation/Season';
import type { NextRace } from './HubHome';
import m from './Management.module.css';

/**
 * [T4.3] Pestaña «Correr» de la carrera profesional: la ronda que toca con su previsión, las sesiones del fin de semana
 * como pasos, el piloto que se sigue en pista (los dos son tuyos), los ajustes de la carrera (`children`: formato y
 * setup) y un solo botón rojo, que lleva a la sesión siguiente.
 */
export function RaceWeekendPanel({ round, sessions, drivers, followedId, onFollow, launchLabel, launchNote, onStart, children }: {
  round: NextRace;
  sessions: WeekendSession[];
  drivers: { id: string; code: string; name: string; number: number }[];
  followedId: string;
  onFollow: (driverId: string) => void;
  launchLabel: string;
  launchNote?: string;
  onStart: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={m.weekend}>
      <section className={`${m.card} ${m.row} ${m.between} ${m.wrap}`}>
        <div>
          <span className={m.label}>Ronda {round.round} de {SEASON_RACES}</span>
          <div className={m.title}>{round.circuitName}</div>
        </div>
        <ol className={m.steps} aria-label="Sesiones del fin de semana">
          {sessions.map((session, i) => (
            <li key={session.name} data-state={session.done ? 'hecha' : session.current ? 'ahora' : 'pendiente'}>
              <span className={m.stepMark}>{session.done ? <Check size={14} aria-label="hecha" /> : i + 1}</span>{session.name}
            </li>
          ))}
        </ol>
        <div className={`${m.row} ${m.wrap}`}>
          <span className={m.chip}>{round.laps} vueltas</span>
          <span className={m.chip}><CloudRain size={14} aria-hidden="true" />Previsión: lluvia {round.rainPercent} %</span>
        </div>
      </section>
      <section className={`${m.card} ${m.row} ${m.between} ${m.wrap}`}>
        <span><span className={m.label}>Piloto que sigues en pista</span><span className={m.dim}>Diriges a los dos desde el muro; este es el que enfoca la cámara al empezar.</span></span>
        <div className={m.segmented} role="group" aria-label="Piloto que sigues en pista">
          {drivers.map(driver => (
            <button key={driver.id} type="button" onClick={() => onFollow(driver.id)} aria-pressed={followedId === driver.id}>{driver.code} · {driver.name} #{driver.number}</button>
          ))}
        </div>
      </section>
      {children}
      <div className={`${m.row} ${m.between} ${m.wrap} ${m.weekendFoot}`}>
        <span className={m.dim}>{launchNote ?? 'Un solo paso cada vez: el botón rojo es siempre la sesión siguiente.'}</span>
        <button type="button" className={m.primary} data-primary onClick={onStart}><Play size={16} fill="#fff" aria-hidden="true" />{launchLabel}</button>
      </div>
    </div>
  );
}
