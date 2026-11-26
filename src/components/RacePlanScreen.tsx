// [MJ11, 20/11/2026] Plan de carrera antes de la vuelta de formación: para cada coche del jugador, el neumático de salida,
// las paradas previstas (ninguna, una o dos, con su vuelta y su compuesto), el ritmo de salida o dejarlo al estratega.
// [ES3, 20/11/2026] Con las mejores estrategias del optimizador (la óptima destacada) y hasta tres paradas.
// De fondo, la escena del garaje hecha en Blender (scripts/blender/mj11-garaje.py) en tres capas que se mueven un poco
// (fondo, coche y personas), como la portada de PF9. En solitario o como anfitrión, «A la parrilla» da la salida; el
// invitado envía su plan y espera a que el anfitrión la dé.
import { useMemo, useState } from 'react';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import type { TireCompound } from '../types/f1';
import { compoundStyle } from '../utils/compounds';
import { applyStrategy, availableCompounds, defaultPlan, moveStop, rivalOf, stopRelativeTo, withStopCount, DRY, type CarPlan, type PlanPace, type StopCount } from '../utils/racePlan';
import { bestUndercut, gainText, offsetText, undercutTable } from '../simulation/Undercut';
import { backupPlansFor, planWindows } from '../simulation/BackupPlans';
import type { DryCompound } from '../simulation/StrategyOptimizer';
import { compoundName, crossoverText, optimizeStrategy, riskText, startText, type Strategy } from '../simulation/StrategyOptimizer';
import { formatDuration } from '../freeRace/freeRace';
import { Segmented } from './ui/Segmented';
import { PlanCar3D, type PlanCarLook } from './PlanCar3D';
import s from './RacePlanScreen.module.css';

export interface PlanCar {
  id: number;
  code: string;
  number: number;
  color: string;
  compound: TireCompound;
  inventory?: { sets: { compound: TireCompound; state: string; laps?: number }[] } | null;
  /** [ES5] Posición de salida (para el efecto del neumático de salida). */
  grid?: number;
}

/** [ES3] Cuántas estrategias se enseñan. */
export const PLAN_STRATEGIES = 5;

const BG = `${import.meta.env.BASE_URL ?? '/'}plan/`;
// [20/11/2026] El coche va encima (en directo, con la livery del jugador): fondo, personas y coche.
const LAYERS = ['fondo', 'personas', 'coche'] as const;
const PACES: { value: PlanPace; label: string }[] = [{ value: 'save', label: 'Ahorro' }, { value: 'balanced', label: 'Normal' }, { value: 'push', label: 'Ataque' }];

export function RacePlanScreen({ cars, totalLaps, role, onConfirm, look, circuitId, field = [] }: {
  cars: PlanCar[];
  /** [ES9] Toda la parrilla (código y posición de salida), para elegir el rival del undercut. */
  field?: { code: string; grid: number }[];
  /** [ES3] Circuito de la carrera, para el optimizador de estrategia. */
  circuitId?: string;
  /** [20/11/2026] El coche del garaje: el del jugador, con su livery y su dorsal (sin esto, el de carbono del render). */
  look?: PlanCarLook;
  totalLaps: number;
  /** «solo» y «anfitrion» dan la salida; «invitado» envía su plan y espera. */
  role: 'solo' | 'anfitrion' | 'invitado';
  onConfirm: (plans: Record<number, CarPlan>) => void | Promise<void>;
}) {
  const [plans, setPlans] = useState<Record<number, CarPlan>>(() => Object.fromEntries(cars.map(car => [car.id, defaultPlan(car.compound, totalLaps)])));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // Cambios con función: dos toques seguidos no se pisan (cada uno parte del plan que dejó el anterior).
  const update = (id: number, change: (plan: CarPlan) => CarPlan) => { setSent(false); setPlans(prev => ({ ...prev, [id]: change(prev[id]) })); };
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(plans); setSent(true); } finally { setBusy(false); }
  };
  const guest = role === 'invitado';
  const [car3d, setCar3d] = useState(false);

  return (
    <div className={s.screen} data-race-plan role="dialog" aria-modal="true" aria-labelledby="plan-titulo">
      <div className={s.scene} aria-hidden="true">
        {LAYERS.map(layer => (
          <picture key={layer} className={`${s.layer} ${s[layer]}`} hidden={layer === 'coche' && car3d}>
            <source media="(max-width: 767px)" type="image/avif" srcSet={`${BG}garaje-movil-${layer}.avif`} />
            <source media="(max-width: 767px)" type="image/webp" srcSet={`${BG}garaje-movil-${layer}.webp`} />
            <source type="image/avif" srcSet={`${BG}garaje-escritorio-${layer}.avif`} />
            <img src={`${BG}garaje-escritorio-${layer}.webp`} alt="" decoding="async" data-plan-layer={layer} />
          </picture>
        ))}
        {look && <div className={`${s.layer} ${s.coche}`}><PlanCar3D look={look} onReady={setCar3d} /></div>}
      </div>
      <div className={s.shade} aria-hidden="true" />
      <main className={s.panel}>
        <header className={s.head}>
          <p className={s.brand}>Antes de la salida</p>
          <h1 id="plan-titulo" className={s.title}>Plan de carrera</h1>
          <p className={s.dim}>{totalLaps} vueltas. Lo puedes cambiar en carrera desde el muro.</p>
        </header>
        <div className={s.cars}>
          {cars.map(car => <CarCard key={car.id} car={car} plan={plans[car.id]} totalLaps={totalLaps} circuitId={circuitId} field={field.filter(f => !cars.some(c => c.code === f.code))} onChange={change => update(car.id, change)} />)}
        </div>
        <footer className={s.actions}>
          {guest && sent && <p className={s.sent} role="status"><Check size={16} aria-hidden="true" />Plan enviado. Esperando la salida del anfitrión.</p>}
          <button type="button" className={s.primary} onClick={() => void confirm()} disabled={busy || (guest && sent)} data-plan-go>
            {guest ? (sent ? 'Plan enviado' : 'Enviar plan') : 'A la parrilla'}<ArrowRight size={18} aria-hidden="true" />
          </button>
        </footer>
      </main>
    </div>
  );
}

function CarCard({ car, plan, totalLaps, circuitId, field, onChange }: { car: PlanCar; plan: CarPlan; totalLaps: number; circuitId?: string; field: { code: string; grid: number }[]; onChange: (change: (plan: CarPlan) => CarPlan) => void }) {
  const options = useMemo(() => availableCompounds(car.inventory), [car.inventory]);
  // [ES5] Con su posición de salida: el neumático de salida suma lo que gana o pierde en el tráfico de las primeras vueltas.
  const optimized = useMemo(() => (circuitId ? optimizeStrategy({ circuitId, totalLaps, inventory: car.inventory, gridPosition: car.grid }) : null), [circuitId, totalLaps, car.inventory, car.grid]);
  const start = useMemo(() => (circuitId && car.grid ? startText(circuitId, car.grid) : null), [circuitId, car.grid]);
  // [ES6] Ventana de cada parada y planes B, C y D del plan de este coche.
  const windows = useMemo(() => (circuitId ? planWindows(circuitId, plan.compound, plan.stops, totalLaps) : []), [circuitId, plan.compound, plan.stops, totalLaps]);
  const backups = useMemo(() => (circuitId ? backupPlansFor(circuitId, totalLaps, plan.compound, plan.stops, car.inventory) : []), [circuitId, totalLaps, plan.compound, plan.stops, car.inventory]);
  const off = plan.delegated;
  return (
    <section className={s.car} style={{ borderLeftColor: car.color }} aria-label={`Plan de ${car.code}`} data-plan-car={car.id}>
      <div className={s.carHead}>
        <b className={s.code}>{car.code} <span>#{car.number}</span></b>
        <button type="button" className={s.toggle} aria-pressed={off} onClick={() => onChange(p => ({ ...p, delegated: !p.delegated }))}>
          {off ? 'Lo decide el estratega' : 'Que decida el estratega'}
        </button>
      </div>
      {off ? (
        <p className={s.dim}>El estratega elige el neumático, las paradas y el ritmo de este coche durante la carrera.</p>
      ) : (
        <>
          {optimized && optimized.strategies.length > 0 && <Strategies result={optimized} plan={plan} code={car.code} onUse={st => onChange(p => applyStrategy(p, st))} />}
          {start && <p className={s.dim} data-plan-start>{start}</p>}
          {backups.length > 0 && (
            <div className={s.strategies} data-plan-backups>
              <span className={s.label}>Planes de reserva</span>
              <ul className={s.strategyList} aria-label={`Planes de reserva de ${car.code}`}>
                {backups.map(b => (
                  <li key={b.id} className={`${s.strategy} ${s.ucRow}`} data-plan-backup={b.id}>
                    <span className={s.strategyText}><b>{b.title}</b><br />{b.trigger}{b.example && <><br /><em className={s.backupNote}>{b.example}</em></>}</span>
                  </li>
                ))}
              </ul>
              <p className={s.dim}>En carrera, el muro te propone el plan cuando se cumpla lo que lo dispara.</p>
            </div>
          )}
          {circuitId && field.length > 0 && <Undercut circuitId={circuitId} car={car} plan={plan} totalLaps={totalLaps} field={field} onChange={onChange} />}
          <div className={s.row}>
            <span className={s.label}>Neumático de salida</span>
            <Compounds value={plan.compound} options={options} onPick={c => onChange(p => ({ ...p, compound: c }))} name={`salida-${car.id}`} />
          </div>
          <div className={s.row}>
            <span className={s.label}>Paradas</span>
            <Segmented label={`Paradas de ${car.code}`} name={`paradas-${car.id}`} value={String(plan.stops.length)}
              onChange={v => onChange(p => withStopCount(p, Number(v) as StopCount, totalLaps))}
              options={[{ value: '0', label: 'Ninguna' }, { value: '1', label: 'Una' }, { value: '2', label: 'Dos' }, { value: '3', label: 'Tres' }]} />
          </div>
          {plan.stops.map((stop, i) => (
            <div key={i} className={s.stop}>
              <span className={s.stopName}>Parada {i + 1}</span>
              <div className={s.stepper} role="group" aria-label={`Vuelta de la parada ${i + 1}`}>
                <button type="button" aria-label="Una vuelta antes" onClick={() => onChange(p => moveStop(p, i, p.stops[i].lap - 1, totalLaps))}><Minus size={14} aria-hidden="true" /></button>
                <span>Vuelta <b>{stop.lap}</b>{windows[i] && windows[i].from < windows[i].to && <em className={s.window} data-plan-window={i}> ({windows[i].from}–{windows[i].to})</em>}</span>
                <button type="button" aria-label="Una vuelta después" onClick={() => onChange(p => moveStop(p, i, p.stops[i].lap + 1, totalLaps))}><Plus size={14} aria-hidden="true" /></button>
              </div>
              <Compounds value={stop.compound} options={options.length ? options : DRY} small name={`parada-${car.id}-${i}`}
                onPick={c => onChange(p => ({ ...p, stops: p.stops.map((x, k) => (k === i ? { ...x, compound: c } : x)) }))} />
            </div>
          ))}
          <div className={s.row}>
            <span className={s.label}>Ritmo de salida</span>
            <Segmented label={`Ritmo de salida de ${car.code}`} name={`ritmo-${car.id}`} value={plan.pace} onChange={v => onChange(p => ({ ...p, pace: v as PlanPace }))} options={PACES} />
          </div>
        </>
      )}
    </section>
  );
}

/** ¿El plan es esta estrategia? (mismo neumático de salida y mismas paradas). */
const isPlan = (plan: CarPlan, st: Strategy) => plan.compound === st.stints[0].compound && plan.stops.length === st.stopLaps.length
  && st.stopLaps.every((lap, i) => plan.stops[i].lap === lap && plan.stops[i].compound === st.stints[i + 1].compound);

/** [ES3] Las mejores estrategias del optimizador para este coche, con la óptima destacada y el punto de cruce. */
function Strategies({ result, plan, code, onUse }: { result: ReturnType<typeof optimizeStrategy>; plan: CarPlan; code: string; onUse: (st: Strategy) => void }) {
  const cross = crossoverText(result), risk = riskText(result);
  // [ES4] Las cinco mejores y, si no está entre ellas, la óptima contando con el Safety Car.
  const top = result.strategies.slice(0, PLAN_STRATEGIES);
  const list = result.expectedBest && !top.includes(result.expectedBest) ? [...top, result.expectedBest] : top;
  return (
    <div className={s.strategies} data-plan-strategies>
      <span className={s.label}>Mejores estrategias</span>
      <ol className={s.strategyList} aria-label={`Mejores estrategias de ${code}`}>
        {list.map((st, i) => {
          const chosen = isPlan(plan, st);
          const robust = st === result.expectedBest && !st.optimal;
          return (
            <li key={i} className={`${s.strategy} ${st.optimal || robust ? s.optimal : ''}`} data-plan-strategy={i} data-optimal={st.optimal || undefined} data-tied={st.tied || undefined} data-expected-best={st === result.expectedBest || undefined}>
              <span className={s.tyres} aria-hidden="true">
                {st.stints.map((t, k) => <i key={k} style={{ ['--tyre' as string]: compoundStyle(t.compound).color, flexGrow: t.laps }}>{compoundStyle(t.compound).letter}</i>)}
              </span>
              <span className={s.strategyText}>
                <b>{st.optimal ? 'Óptima · ' : robust ? 'Óptima con Safety Car · ' : st.tied ? 'Empatada · ' : ''}{st.stops} {st.stops === 1 ? 'parada' : 'paradas'}</b>
                {' '}{st.stints.map(t => `${compoundName(t.compound)} ${t.laps}`).join(' → ')}
                <em>{st.optimal ? `≈ ${formatDuration(st.totalSec)}` : `+${st.deltaSec.toFixed(1).replace('.', ',')} s`}</em>
              </span>
              <button type="button" className={s.use} onClick={() => onUse(st)} aria-pressed={chosen} data-plan-use={i}>{chosen ? 'En el plan' : 'Usar esta'}</button>
            </li>
          );
        })}
      </ol>
      {cross && <p className={s.dim} data-plan-crossover>{cross.charAt(0).toUpperCase() + cross.slice(1)}.</p>}
      {risk && <p className={s.dim} data-plan-risk>{risk}</p>}
    </div>
  );
}

const isDry = (c: TireCompound): c is DryCompound => c === 'soft' || c === 'medium' || c === 'hard';

/**
 * [ES9] Undercut y overcut contra un rival (por defecto, el de delante en parrilla, que se supone con la estrategia
 * óptima): lo que se gana parando de 1 a 5 vueltas antes o después que él, y un botón para dejar el plan así.
 */
function Undercut({ circuitId, car, plan, totalLaps, field, onChange }: { circuitId: string; car: PlanCar; plan: CarPlan; totalLaps: number; field: { code: string; grid: number }[]; onChange: (change: (plan: CarPlan) => CarPlan) => void }) {
  const [rivalCode, setRivalCode] = useState<string | null>(() => (car.grid ? rivalOf(field, car.grid)?.code ?? null : null) ?? field[0]?.code ?? null);
  const rival = field.find(f => f.code === rivalCode) ?? null;
  const rivalBest = useMemo(() => (rival ? optimizeStrategy({ circuitId, totalLaps, gridPosition: rival.grid }).best : null), [circuitId, totalLaps, rival]);
  const next = plan.stops[0]?.compound ?? (plan.compound === 'hard' ? 'medium' : 'hard');
  if (!rival || !rivalBest || rivalBest.stops < 1 || !isDry(plan.compound) || !isDry(next)) return null;
  const rivalPlan = { compound: rivalBest.stints[0].compound, stopLap: rivalBest.stopLaps[0], next: rivalBest.stints[1].compound };
  const options = undercutTable(circuitId, { compound: plan.compound, next }, rivalPlan, totalLaps);
  const best = bestUndercut(options);
  return (
    <div className={s.strategies} data-plan-undercut>
      <div className={s.row}>
        <span className={s.label}>Undercut contra</span>
        <select className={s.use} value={rival.code} onChange={e => setRivalCode(e.target.value)} aria-label={`Rival de referencia de ${car.code}`}>
          {[...field].sort((a, b) => a.grid - b.grid).map(f => <option key={f.code} value={f.code}>P{f.grid} {f.code}</option>)}
        </select>
      </div>
      <p className={s.dim}>{rival.code} para en la vuelta {rivalPlan.stopLap} ({compoundName(rivalPlan.compound)} → {compoundName(rivalPlan.next)}). Parando tú, hasta que sale de boxes:</p>
      <ol className={s.strategyList} aria-label={`Undercut y overcut de ${car.code} contra ${rival.code}`}>
        {options.map(o => (
          <li key={o.offset} className={`${s.strategy} ${s.ucRow} ${o === best ? s.optimal : ''}`} data-best={o === best || undefined}>
            <span className={s.strategyText}><b>{offsetText(o.offset)}</b> (vuelta {o.lap}) <em>{gainText(o.gainSec)}</em></span>
            <button type="button" className={s.use} disabled={o.gainSec === null} aria-label={`Parar ${offsetText(o.offset)} que ${rival.code}`} onClick={() => onChange(p => stopRelativeTo(p, rivalPlan.stopLap, o.offset, totalLaps))}>
              Parar ahí
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Compounds({ value, options, onPick, name, small = false }: { value: TireCompound; options: TireCompound[]; onPick: (c: TireCompound) => void; name: string; small?: boolean }) {
  return (
    <div className={`${s.compounds} ${small ? s.small : ''}`} role="radiogroup" aria-label={name}>
      {options.map(c => {
        const st = compoundStyle(c);
        return (
          <button key={c} type="button" role="radio" aria-checked={value === c} title={st.label} className={s.compound} onClick={() => onPick(c)}
            style={{ ['--tyre' as string]: st.color }}>
            <span aria-hidden="true">{st.letter}</span><em>{st.name}</em>
          </button>
        );
      })}
    </div>
  );
}
