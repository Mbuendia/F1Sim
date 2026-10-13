import { ArrowRight, CloudRain, Flag, ListChecks } from 'lucide-react';
import type { HubSection, PendingItem } from '../simulation/Hub';
import { SEASON_RACES } from '../simulation/Season';
import m from './Management.module.css';

export interface NextRace { round: number; circuitName: string; laps: number; rainPercent: number; sprint: boolean; note?: string }
export interface StatusCard { label: string; value: string; detail: string; section: HubSection }

/**
 * [T4.3] Inicio del centro de gestión: la ronda que toca con su botón, lo que espera una decisión (avisa y no bloquea)
 * y las tarjetas de estado, que llevan a su pestaña.
 */
export function HubHome({ next, pending, status, onGo }: {
  next: NextRace | null;
  pending: PendingItem[];
  status: StatusCard[];
  onGo: (section: HubSection) => void;
}) {
  return (
    <div className={m.hubHome}>
      <section className={`${m.card} ${m.nextRace}`}>
        {next ? (
          <>
            <span className={m.label}>Siguiente · ronda {next.round} de {SEASON_RACES}</span>
            <div className={m.title}>{next.circuitName}</div>
            <div className={`${m.row} ${m.wrap}`}>
              <span className={m.chip}>{next.laps} vueltas</span>
              <span className={m.chip}><CloudRain size={14} aria-hidden="true" />Previsión: lluvia {next.rainPercent} %</span>
              <span className={`${m.chip} ${next.sprint ? m.chipWarn : ''}`}>{next.sprint ? 'Fin de semana sprint' : 'Sin sprint'}</span>
            </div>
            {next.note && <span className={m.muted}>{next.note}</span>}
            <span className={m.hubSpacer} />
            <div className={m.row}>
              <button type="button" className={m.primary} onClick={() => onGo('correr')}><Flag size={16} aria-hidden="true" />Preparar carrera</button>
            </div>
          </>
        ) : (
          <>
            <span className={m.label}>Temporada completa</span>
            <div className={m.title}>No quedan rondas por correr</div>
          </>
        )}
      </section>
      <section className={m.card}>
        <span className={m.label}><ListChecks size={14} aria-hidden="true" /> Pendiente de tu decisión ({pending.length})</span>
        {pending.length === 0 && <span className={m.muted}>Nada pendiente.</span>}
        <ul className={m.pending}>
          {pending.map(item => (
            <li key={item.id}>
              <span><b>{item.title}</b><br /><span className={m.muted}>{item.detail}</span></span>
              <button type="button" className={m.button} onClick={() => onGo(item.section)} aria-label={`Ir a resolver: ${item.title}`}><ArrowRight size={16} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
        {pending.length > 0 && <span className={m.dim}>Avisa; nunca impide entrar a pista.</span>}
      </section>
      <div className={m.statusRow}>
        {status.map(card => (
          <button key={card.label} type="button" className={`${m.card} ${m.statusCard}`} onClick={() => onGo(card.section)}>
            <span className={m.label}>{card.label}</span>
            <span className={m.statusValue}>{card.value}</span>
            <span className={m.muted}>{card.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
