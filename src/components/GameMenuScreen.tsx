import { Flag, FolderOpen, LogIn, Play, PlusCircle, Users } from 'lucide-react';
import { TEAMS } from '../data/teams';
import { menuOptions } from '../simulation/Career';
import { formatMoney } from '../simulation/Finance';
import type { SlotSummary } from '../simulation/SaveGame';
import { SEASON_RACES } from '../simulation/Season';
import { F1WheelSvg } from './F1WheelSvg';
import s from './Screens.module.css';

/** Estado de una partida en una línea: ronda, puesto en constructores y saldo. */
export function slotStatus(slot: SlotSummary): string {
  const parts = [`Ronda ${slot.raceNumber} de ${SEASON_RACES}`];
  if (slot.position) parts.push(`P${slot.position} en constructores`);
  if (slot.balance !== undefined) parts.push(`${slot.balance < 0 ? 'deuda' : 'saldo'} ${formatMoney(Math.abs(slot.balance))}`);
  return parts.join(' · ');
}

/**
 * [T4.19] Menú de partidas, tras la portada: continuar la partida en curso (con su estado), empezar una carrera
 * profesional, cargar una partida guardada o correr una carrera libre. Sin partida en curso ni guardadas, «Continuar»
 * y «Cargar partida» no aparecen. [N7] Con onCreateRoom y onJoinRoom, también crear una sala o unirse a una.
 */
export function GameMenuScreen({ current = null, slots = [], onContinue, onNew, onLoad, onFree, onCreateRoom, onJoinRoom }: {
  current?: SlotSummary | null;
  slots?: SlotSummary[];
  onContinue: () => void;
  onNew: () => void;
  onLoad: () => void;
  onFree: () => void;
  onCreateRoom?: () => void;
  onJoinRoom?: () => void;
}) {
  const options = menuOptions(current, slots);
  return (
    <div className={s.screen}>
      <div className={s.entry}>
        <F1WheelSvg className={s.wheel} />
        <div className={s.front}>
          <div className={s.brand}>F1 <em>RACE</em> MANAGER</div>
          {current && options.includes('continuar') && (
            <div className={s.continue} style={{ ['--c' as string]: TEAMS[current.team?.id ?? '']?.color }}>
              <button type="button" className={s.primary} onClick={onContinue}><Play size={16} fill="#fff" aria-hidden="true" />Continuar</button>
              <div>
                <div className={s.continueTitle}>{current.team?.name ?? 'Partida en curso'} · Temporada {current.season ?? 1}</div>
                <div className={s.muted}>{slotStatus(current)}</div>
                <div className={s.dim}>«{current.name}»{current.raceInProgress && !current.raceInProgress.finished ? ` · en carrera: vuelta ${current.raceInProgress.lap} de ${current.raceInProgress.totalLaps}` : ''}</div>
              </div>
            </div>
          )}
          <div className={s.stack}>
            <button type="button" className={s.option} onClick={onNew}><span><PlusCircle size={18} aria-hidden="true" />Nueva carrera profesional</span><small>eliges equipo</small></button>
            {options.includes('cargar') && (
              <button type="button" className={s.option} onClick={onLoad}><span><FolderOpen size={18} aria-hidden="true" />Cargar partida</span><small>{slots.length} {slots.length === 1 ? 'guardada' : 'guardadas'}</small></button>
            )}
            <button type="button" className={s.option} onClick={onFree}><span><Flag size={18} aria-hidden="true" />Carrera libre</span><small>no cuenta para ninguna partida</small></button>
            {onCreateRoom && <button type="button" className={s.option} onClick={onCreateRoom}><span><Users size={18} aria-hidden="true" />Crear sala</span><small>carrera con amigos</small></button>}
            {onJoinRoom && <button type="button" className={s.option} onClick={onJoinRoom}><span><LogIn size={18} aria-hidden="true" />Unirse a una sala</span><small>con el código</small></button>}
          </div>
        </div>
      </div>
    </div>
  );
}
