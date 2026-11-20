// [MJ11, 20/11/2026] Plan de carrera antes de la vuelta de formación: para cada coche del jugador, el neumático de salida,
// las paradas previstas (ninguna, una o dos, con su vuelta y su compuesto), el ritmo de salida o dejarlo al estratega.
// De fondo, la escena del garaje hecha en Blender (scripts/blender/mj11-garaje.py) en tres capas que se mueven un poco
// (fondo, coche y personas), como la portada de PF9. En solitario o como anfitrión, «A la parrilla» da la salida; el
// invitado envía su plan y espera a que el anfitrión la dé.
import { useMemo, useState } from 'react';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import type { TireCompound } from '../types/f1';
import { compoundStyle } from '../utils/compounds';
import { availableCompounds, defaultPlan, moveStop, withStopCount, DRY, type CarPlan, type PlanPace } from '../utils/racePlan';
import { Segmented } from './ui/Segmented';
import { PlanCar3D, type PlanCarLook } from './PlanCar3D';
import s from './RacePlanScreen.module.css';

export interface PlanCar {
  id: number;
  code: string;
  number: number;
  color: string;
  compound: TireCompound;
  inventory?: { sets: { compound: TireCompound; state: string }[] } | null;
}

const BG = `${import.meta.env.BASE_URL ?? '/'}plan/`;
// [20/11/2026] El coche va encima (en directo, con la livery del jugador): fondo, personas y coche.
const LAYERS = ['fondo', 'personas', 'coche'] as const;
const PACES: { value: PlanPace; label: string }[] = [{ value: 'save', label: 'Ahorro' }, { value: 'balanced', label: 'Normal' }, { value: 'push', label: 'Ataque' }];

export function RacePlanScreen({ cars, totalLaps, role, onConfirm, look }: {
  cars: PlanCar[];
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
          {cars.map(car => <CarCard key={car.id} car={car} plan={plans[car.id]} totalLaps={totalLaps} onChange={change => update(car.id, change)} />)}
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

function CarCard({ car, plan, totalLaps, onChange }: { car: PlanCar; plan: CarPlan; totalLaps: number; onChange: (change: (plan: CarPlan) => CarPlan) => void }) {
  const options = useMemo(() => availableCompounds(car.inventory), [car.inventory]);
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
          <div className={s.row}>
            <span className={s.label}>Neumático de salida</span>
            <Compounds value={plan.compound} options={options} onPick={c => onChange(p => ({ ...p, compound: c }))} name={`salida-${car.id}`} />
          </div>
          <div className={s.row}>
            <span className={s.label}>Paradas</span>
            <Segmented label={`Paradas de ${car.code}`} name={`paradas-${car.id}`} value={String(plan.stops.length)}
              onChange={v => onChange(p => withStopCount(p, Number(v) as 0 | 1 | 2, totalLaps))}
              options={[{ value: '0', label: 'Ninguna' }, { value: '1', label: 'Una' }, { value: '2', label: 'Dos' }]} />
          </div>
          {plan.stops.map((stop, i) => (
            <div key={i} className={s.stop}>
              <span className={s.stopName}>Parada {i + 1}</span>
              <div className={s.stepper} role="group" aria-label={`Vuelta de la parada ${i + 1}`}>
                <button type="button" aria-label="Una vuelta antes" onClick={() => onChange(p => moveStop(p, i, p.stops[i].lap - 1, totalLaps))}><Minus size={14} aria-hidden="true" /></button>
                <span>Vuelta <b>{stop.lap}</b></span>
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
