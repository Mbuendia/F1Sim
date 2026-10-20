import { useState } from 'react';
import { AlertTriangle, Eye, ShieldCheck } from 'lucide-react';
import { SPY, SPY_LABEL, SPY_LEVELS, canSpy } from '../simulation/Spy';
import type { SpyLevel, SpyReport } from '../simulation/Spy';
import { formatMoney } from '../simulation/Finance';
import { SetupCompare } from './SetupCompare';
import { Segmented } from './ui/Segmented';
import { Chip } from './ui/Tile';
import m from './Management.module.css';

/**
 * [V9] Espía de setups en la pestaña «Correr»: hechos los libres, se elige un equipo rival y el nivel del informe; el
 * coste y el riesgo de que la FIA lo descubra van a la vista antes de pagar.
 */
export function SpyPanel({ round, teams, reports, available, canAfford, driverCode, onSpy }: {
  round: number;
  /** Equipos rivales que se pueden espiar. */
  teams: { id: string; name: string }[];
  reports: SpyReport[];
  /** Solo hay algo que espiar cuando los rivales ya han hecho sus libres. */
  available: boolean;
  canAfford: (cost: number) => boolean;
  driverCode: (driverId: string) => string;
  onSpy: (teamId: string, level: SpyLevel) => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [level, setLevel] = useState<SpyLevel>('basico');
  const mine = reports.filter(report => report.round === round);
  const allowed = available && Boolean(teamId) && canSpy(reports, round, teamId) && canAfford(SPY.COST[level]);
  const nameOf = (id: string) => teams.find(team => team.id === id)?.name ?? id;
  return (
    <section className={m.card} aria-label="Espía de setups">
      <span className={m.label}><Eye size={16} aria-hidden="true" /> Espía de setups · hasta {SPY.MAX_PER_ROUND} informes por ronda</span>
      {!available ? (
        <span className={m.dim}>Primero haz los entrenamientos libres: hasta entonces los rivales no han decidido su setup.</span>
      ) : (
        <>
          <Segmented wrap label="Equipo que se espía" name="espia-equipo" value={teamId} onChange={setTeamId} options={teams.map(team => ({ value: team.id, label: team.name }))} />
          <div className={`${m.row} ${m.between} ${m.wrap}`}>
            <Segmented label="Nivel del informe" name="espia-nivel" value={level} onChange={setLevel}
              options={SPY_LEVELS.map(id => ({ value: id, label: SPY_LABEL[id], title: id === 'basico' ? 'Barato y discreto; puede traer un ajuste equivocado' : 'Exacto; caro y más fácil de descubrir' }))} />
            <span className={m.dim}>{formatMoney(SPY.COST[level])} · riesgo {Math.round(100 * SPY.DETECTION[level])} % · multa {formatMoney(SPY.FINE)}</span>
            <button type="button" className={m.button} disabled={!allowed} onClick={() => onSpy(teamId, level)}
              title={!canSpy(reports, round, teamId) ? 'Ya tienes informe de este equipo o no quedan informes esta ronda' : !canAfford(SPY.COST[level]) ? 'El dinero no llega' : undefined}>
              Encargar el informe
            </button>
          </div>
        </>
      )}
      {mine.map(report => (
        <div key={`${report.teamId}-${report.level}`} className={m.practiceLearned} data-spy={report.teamId}>
          <span className={m.label}>{nameOf(report.teamId)} · {SPY_LABEL[report.level]}</span>
          <SetupCompare caption={`Setups de ${nameOf(report.teamId)}`} head="Piloto" rows={Object.entries(report.setups).map(([driverId, setup]) => ({ id: driverId, name: driverCode(driverId), setup }))} />
          {report.exact
            ? <Chip tone="ok" icon={<ShieldCheck size={14} aria-hidden="true" />}>Informe exacto</Chip>
            : <Chip tone="warn">Puede traer un ajuste desviado un punto</Chip>}
          {report.detected && <Chip tone="bad" icon={<AlertTriangle size={14} aria-hidden="true" />}>Descubierto por la FAI: multa de {formatMoney(report.fine)} y la junta pierde confianza</Chip>}
        </div>
      ))}
    </section>
  );
}
