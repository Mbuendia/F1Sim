import { FACILITIES, FACILITY_EFFECT, FACILITY_IDS, FACILITY_LABEL, levelOf, maintenanceOf, upgradeCost, workSummary } from '../simulation/Facilities';
import type { FacilitiesState, FacilityId } from '../simulation/Facilities';
import { formatMoney } from '../simulation/Finance';
import m from './Management.module.css';

/** Nivel de 1 a 5 como cinco marcas; `building` marca el nivel que está en obra. */
export function Pips({ level, building = false }: { level: number; building?: boolean }) {
  return (
    <span className={m.pips} role="img" aria-label={`Nivel ${level} de ${FACILITIES.MAX_LEVEL}`}>
      {Array.from({ length: FACILITIES.MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? m.pipOn : building && i === level ? m.pipWork : undefined} />)}
    </span>
  );
}

/**
 * [T4.4] Instalaciones de la fábrica del equipo: nivel y efecto de cada una, la obra en curso y el botón para ampliar
 * (una obra a la vez). `canAfford` dice si el equipo puede pagar un gasto de ese importe.
 */
export function FacilitiesPanel({ facilities, teamId, canAfford, onUpgrade }: {
  facilities: FacilitiesState;
  teamId: string;
  canAfford: (cost: number) => boolean;
  onUpgrade: (facility: FacilityId) => void;
}) {
  const work = facilities.teams[teamId]?.work ?? null;
  return (
    <section className={m.card} aria-label="Instalaciones de la fábrica">
      <span className={m.label}>Instalaciones · una obra a la vez · mantenimiento {formatMoney(maintenanceOf(facilities, teamId))} por ronda</span>
      {FACILITY_IDS.map(id => {
        const level = levelOf(facilities, teamId, id), building = work?.facility === id;
        const next = level + 1;
        return (
          <div key={id} className={m.facility}>
            <b>{FACILITY_LABEL[id]}</b>
            <Pips level={level} building={building} />
            <span className={m.muted}>{FACILITY_EFFECT[id]}</span>
            {building && work
              ? <span className={`${m.chip} ${m.chipWarn}`}>En obra · {work.remaining === 1 ? 'queda 1 ronda' : `quedan ${work.remaining} rondas`}</span>
              : next <= FACILITIES.MAX_LEVEL
                ? (
                  <button type="button" className={m.button} disabled={work !== null || !canAfford(upgradeCost(next))} onClick={() => onUpgrade(id)}
                    title={work ? 'Ya hay una obra en curso' : !canAfford(upgradeCost(next)) ? 'El dinero no llega para esta obra' : undefined}>
                    Ampliar a nivel {next} · {workSummary(next)}
                  </button>
                )
                : <span className={m.dim}>Al nivel máximo</span>}
          </div>
        );
      })}
    </section>
  );
}
