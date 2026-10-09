import { CREW_PLANS, CREW_PLAN_EFFECT, CREW_PLAN_LABEL, crewStats } from '../simulation/PitCrew';
import type { CrewPlan, PitCrew } from '../simulation/PitCrew';
import { Pips } from './FacilitiesPanel';
import m from './Management.module.css';

const seconds = (value: number) => `${value.toFixed(1).replace('.', ',')} s`;

/**
 * [T4.6] Equipo de boxes del jugador: nivel, fatiga, paradas de la temporada y el plan de la semana (velocidad,
 * seguridad o descanso), que se nota en la carrera siguiente.
 */
export function PitCrewPanel({ crew, onPlan }: { crew: PitCrew; onPlan: (plan: CrewPlan) => void }) {
  const stats = crewStats(crew);
  return (
    <section className={`${m.card} ${m.stack}`} aria-label="Equipo de boxes">
      <span className={m.label}>Equipo de boxes</span>
      <div className={`${m.row} ${m.between} ${m.wrap}`}>
        <div className={`${m.row} ${m.wrap}`}>
          <Pips level={crew.level} />
          <span className={crew.fatigue >= 70 ? m.warn : m.muted}>Fatiga {Math.round(crew.fatigue)} %</span>
          <span className={m.muted}>
            {stats.averageSec === null ? 'Sin paradas esta temporada'
              : `${stats.stops} ${stats.stops === 1 ? 'parada' : 'paradas'} · media ${seconds(stats.averageSec)} · ${stats.slow} ${stats.slow === 1 ? 'lenta' : 'lentas'}`}
          </span>
        </div>
        <div className={m.segmented} role="group" aria-label="Plan de la semana">
          {CREW_PLANS.map(plan => (
            <button key={plan} type="button" onClick={() => onPlan(plan)} aria-pressed={crew.plan === plan}>{CREW_PLAN_LABEL[plan]}</button>
          ))}
        </div>
      </div>
      <span className={m.dim}>Plan de esta ronda: {CREW_PLAN_EFFECT[crew.plan]}.</span>
    </section>
  );
}
