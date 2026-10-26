import { ArrowRight, CloudRain, Flag, ListChecks } from 'lucide-react';
import { nextDecisions } from '../simulation/Hub';
import type { HubSection, PendingItem } from '../simulation/Hub';
import { HUB_SECTIONS } from '../simulation/Hub';
import { SEASON_RACES } from '../simulation/Season';
import m from './Management.module.css';

export interface NextRace { round: number; circuitName?: string; name?: string; laps?: number; rainPercent?: number; sprint?: boolean; note?: string }
export interface StatusCard { label: string; value: string; detail: string; section: HubSection }

/** Cuántas decisiones salen como tarjeta en la portada. */
export const DECISION_CARDS = 3;
const SECTION_LABEL = Object.fromEntries(HUB_SECTIONS) as Record<HubSection, string>;
const URGENCY: Record<number, string> = { 1: 'Urgente', 2: 'Caduca pronto', 3: 'Mejora', 4: 'Cuando quieras' };
/** Euros a «1,2 M». */
const costText = (euros: number) => `${(euros / 1_000_000).toFixed(1).replace('.', ',')} M`;

/**
 * [T4.3] Inicio del centro de gestión. [UX9] Arriba, las tres decisiones más urgentes como tarjetas (qué es, qué cambia
 * y cuánto cuesta), cada una con «Decidir», que lleva a su pestaña (allí se decide igual que siempre); después, la
 * ronda que toca, el resto de pendientes y las tarjetas de estado. Sin nada pendiente, lo dice y propone ir a correr.
 * Avisa y nunca bloquea la entrada a pista.
 */
export function HubHome({ next, pending, status, onGo }: {
  next: NextRace | null;
  pending: PendingItem[];
  status: StatusCard[];
  onGo: (section: HubSection) => void;
}) {
  const top = nextDecisions(pending, DECISION_CARDS);
  const rest = pending.filter(item => !top.includes(item));
  return (
    <div className={m.hubHome}>
      <section className={m.decisions} aria-label="Próximas decisiones">
        {top.length === 0 ? (
          <div className={`${m.card} ${m.decisionEmpty}`}>
            <span className={m.label}><ListChecks size={14} aria-hidden="true" /> Próximas decisiones</span>
            <div className={m.title}>Nada pendiente</div>
            <span className={m.muted}>{next ? 'El equipo está listo: el siguiente paso es preparar la carrera.' : 'No queda nada que decidir esta temporada.'}</span>
            {next && <div className={m.row}><button type="button" className={m.primary} onClick={() => onGo('finde')}><Flag size={16} aria-hidden="true" />Ir a correr</button></div>}
          </div>
        ) : top.map(item => (
          <article key={item.id} className={`${m.card} ${m.decisionCard}`} data-decision-card data-urgency={item.priority}>
            <span className={m.label}>{URGENCY[item.priority] ?? 'Pendiente'} · {SECTION_LABEL[item.section]}</span>
            <div className={m.decisionTitle}>{item.title}</div>
            <span className={m.muted}>{item.detail}</span>
            <dl className={m.decisionFacts}>
              <div><dt>Qué cambia</dt><dd>{item.effect}</dd></div>
              {item.cost !== undefined && <div><dt>Coste</dt><dd>{costText(item.cost)}</dd></div>}
            </dl>
            <span className={m.hubSpacer} />
            <button type="button" className={m.primary} onClick={() => onGo(item.section)} aria-label={`Decidir: ${item.title}`}>Decidir<ArrowRight size={16} aria-hidden="true" /></button>
          </article>
        ))}
      </section>
      <section className={`${m.card} ${m.nextRace}`}>
        {next ? (
          <>
            <span className={m.label}>Siguiente · ronda {next.round} de {SEASON_RACES}</span>
            <div className={m.title}>{next.circuitName ?? next.name}</div>
            <div className={`${m.row} ${m.wrap}`}>
              {next.laps !== undefined && <span className={m.chip}>{next.laps} vueltas</span>}
              {next.rainPercent !== undefined && <span className={m.chip}><CloudRain size={14} aria-hidden="true" />Previsión: lluvia {next.rainPercent} %</span>}
              <span className={`${m.chip} ${next.sprint ? m.chipWarn : ''}`}>{next.sprint ? 'Fin de semana sprint' : 'Sin sprint'}</span>
            </div>
            {next.note && <span className={m.muted}>{next.note}</span>}
            <span className={m.hubSpacer} />
            <div className={m.row}>
              <button type="button" className={m.primary} onClick={() => onGo('finde')}><Flag size={16} aria-hidden="true" />Preparar carrera</button>
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
        {rest.length > 0 && (
          <ul className={m.pending}>
            {rest.map(item => (
              <li key={item.id}>
                <span><b>{item.title}</b><br /><span className={m.muted}>{item.effect}</span></span>
                <button type="button" className={m.button} onClick={() => onGo(item.section)} aria-label={`Ir a resolver: ${item.title}`}><ArrowRight size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && rest.length === 0 && <div className={m.muted}>Todo lo pendiente está en las tarjetas de arriba.</div>}
        {pending.length > 0 && <div className={m.dim}>Avisa; nunca impide entrar a pista.</div>}
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
