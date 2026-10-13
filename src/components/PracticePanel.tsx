import { Check, ClipboardList, Gauge, Timer, Wrench } from 'lucide-react';
import { PRACTICE, PRACTICE_PROGRAMS, PROGRAM_EFFECT, PROGRAM_LABEL } from '../simulation/Practice';
import type { PracticeProgram, PracticeResult } from '../simulation/Practice';
import { SETUP_FIELDS } from '../simulation/Setup';
import type { CarSetup } from '../simulation/Setup';
import { Segmented } from './ui/Segmented';
import { SetupCompare } from './SetupCompare';
import { CompoundBadge } from './CompoundBadge';
import { Chip } from './ui/Tile';
import m from './Management.module.css';

const ICON: Record<PracticeProgram, typeof Gauge> = { setup: Wrench, 'tanda-larga': Timer, clasificacion: Gauge };

/** Un setup en corto: «carga +1 · rigidez 0 · cambio Media». */
export const setupText = (setup: CarSetup) => SETUP_FIELDS.map(field => `${field.label.split(' ')[0].toLowerCase()} ${field.valueLabel(setup[field.key])}`).join(', ');

/**
 * [T4.13] Entrenamientos libres en la pestaña «Correr»: el programa de cada piloto, el botón para hacerlos y, hechos, lo
 * aprendido de cada uno. Son opcionales: sin ellos el fin de semana es el de siempre.
 */
export function PracticePanel({ drivers, programs, onProgram, result, sprintWeekend, onRun }: {
  drivers: { id: string; code: string }[];
  programs: Record<string, PracticeProgram>;
  onProgram: (driverId: string, program: PracticeProgram) => void;
  /** Libres ya hechos en esta ronda, o null. */
  result: PracticeResult | null;
  sprintWeekend: boolean;
  onRun: () => void;
}) {
  const sessions = sprintWeekend ? PRACTICE.SESSIONS.sprint : PRACTICE.SESSIONS.normal;
  return (
    <section className={m.card} aria-label="Entrenamientos libres">
      <div className={`${m.row} ${m.between} ${m.wrap}`}>
        <span className={m.label}><ClipboardList size={16} aria-hidden="true" /> Entrenamientos libres · {sessions === 1 ? '1 sesión' : `${sessions} sesiones`}</span>
        {result
          ? <Chip tone="ok" icon={<Check size={14} aria-hidden="true" />}>Hechos · {Object.values(result.km)[0] ?? 0} km por coche</Chip>
          : <button type="button" className={m.button} onClick={onRun} title="Gastan juegos de neumáticos y suman kilómetros a los componentes; los rivales también los hacen y afinan su setup">Hacer los entrenamientos libres</button>}
      </div>
      {drivers.map(driver => {
        const learned = result?.learning[driver.id];
        const program = learned?.program ?? programs[driver.id] ?? 'setup';
        return (
          <div key={driver.id} className={m.practiceRow}>
            <b>{driver.code}</b>
            {learned ? (
              <PracticeLearned entry={learned} />
            ) : (
              <Segmented wrap label={`Programa de ${driver.code} en los libres`} name={`libres-${driver.id}`} value={program} onChange={value => onProgram(driver.id, value)}
                options={PRACTICE_PROGRAMS.map(id => { const Icon = ICON[id]; return { value: id, label: PROGRAM_LABEL[id], title: PROGRAM_EFFECT[id], content: <><Icon size={16} aria-hidden="true" />{PROGRAM_LABEL[id]}</> }; })} />
            )}
          </div>
        );
      })}
      {!result && <span className={m.dim}>Opcionales. Lo aprendido vale para la clasificación y la carrera de este fin de semana y nunca es exacto.</span>}
    </section>
  );
}

function PracticeLearned({ entry }: { entry: PracticeResult['learning'][string] }) {
  const Icon = ICON[entry.program];
  return (
    <div className={m.practiceLearned} data-program={entry.program}>
      <span className={m.label}><Icon size={15} aria-hidden="true" /> {PROGRAM_LABEL[entry.program]} · {entry.laps} vueltas</span>
      {entry.program === 'setup' && (
        <>
          <span>El setup más rápido está entre estos {entry.setupCandidates?.length}:</span>
          <SetupCompare caption="Setups candidatos" head="Opción" rows={(entry.setupCandidates ?? []).map((setup, order) => ({ id: setupText(setup), name: order + 1, setup }))} />
          {(entry.setupCandidates?.length ?? 0) > 1 && <span className={m.dim}>Resaltado, lo que cambia de una opción a otra.</span>}
        </>
      )}
      {entry.program === 'tanda-larga' && entry.tyreLife && (
        <span className={`${m.row} ${m.wrap}`}>
          <span>Vida estimada (±{entry.tyreLifeMargin} vueltas)</span>
          {(['soft', 'medium', 'hard'] as const).map(compound => (
            <span key={compound} className={m.chip}><CompoundBadge compound={compound} size={18} detail="vida estimada" /><b className={m.num}>{entry.tyreLife![compound]}</b> vueltas</span>
          ))}
        </span>
      )}
      {entry.program === 'clasificacion' && (
        <span>Ritmo a una vuelta: hacia el puesto <b>{entry.paceRank}</b> (±{entry.paceRankMargin}), a {(entry.paceGapSec ?? 0).toFixed(2).replace('.', ',')} s del mejor</span>
      )}
    </div>
  );
}
