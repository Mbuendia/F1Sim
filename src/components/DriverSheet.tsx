import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Driver, Team } from '../types/f1';
import type { DriverAttributes } from '../simulation/DriverDevelopment';
import { CarShowcase } from './CarShowcase';
import { DriverAttributesCard } from './DriverAttributesCard';
import { FlagIcon } from './FlagIcon';
import s from './FreeRace.module.css';

type Tab = 'ficha' | 'estrategia' | 'rendimiento';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ficha', label: 'Atributos y ficha' }, { id: 'estrategia', label: 'Estrategia y estilo' }, { id: 'rendimiento', label: 'Rendimiento' },
];
const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Pares dato y valor, como lista de definiciones. */
function Facts({ rows }: { rows: [string, string][] }) {
  return <dl className={s.sheetFacts}>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

/** Barra de un atributo de 0 a 100. */
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className={s.bar}>
      <span>{label}</span>
      <span className={s.barTrack} aria-hidden="true"><span style={{ width: `${Math.round(value * 100)}%` }} /></span>
      <strong>{Math.round(value * 100)}</strong>
    </div>
  );
}

/**
 * [UX12] Ficha del piloto a pantalla completa: atributos y ficha, estrategia y estilo, y rendimiento, con Atrás y paso
 * directo al otro piloto del equipo.
 */
export function DriverSheet({ driver: d, mate, team: t, onBack, onOther, attributes }: {
  driver: Driver; mate: Driver | null; team: Team; onBack: () => void; onOther: (driverId: string) => void; attributes?: DriverAttributes;
}) {
  const [tab, setTab] = useState<Tab>('ficha');
  const style = d.raceCraft > 0.85 ? 'Agresivo: busca huecos y frena tarde'
    : d.tireManagement > 0.8 ? 'Conservador: cuida los neumáticos y mantiene el ritmo' : 'Equilibrado: fuerte en ritmo de carrera';
  return (
    <div className={s.wizard} data-fullscreen style={{ ['--c' as string]: t.color }}>
      <header className={s.top}>
        <button type="button" className={s.secondary} onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Atrás</button>
        <div className={s.sheetTitle}>
          <h1 className={s.title}><FlagIcon country={d.country} emoji={d.countryFlag} size={18} /> {d.firstName} {d.lastName}</h1>
          <span className={s.facts}>#{d.number} · {t.name}</span>
        </div>
      </header>
      <div className={s.tabs} role="tablist" aria-label="Ficha del piloto">
        {TABS.map(x => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={s.tab} onClick={() => setTab(x.id)}>{x.label}</button>)}
      </div>
      <main className={s.scroll}>
        <div className={s.sheet}>
          {tab === 'ficha' && (<>
            <CarShowcase teamId={t.id} teamColor={t.color} accentColor={t.accentColor} number={d.number} compound="medium" label={`Monoplaza de ${t.name} · ${d.code}`} />
            <section className={s.block}>
              <h2>Piloto</h2>
              <Bar label="Talento" value={d.talentRating} />
              <Bar label="Gestión de neumáticos" value={d.tireManagement} />
              <Bar label="Constancia" value={d.consistency} />
              <Bar label="Agresividad" value={d.raceCraft} />
              <Bar label="Suerte" value={d.luckRating} />
            </section>
            {attributes && <DriverAttributesCard driver={d} attributes={attributes} />}
            <section className={s.block}>
              <h2>Monoplaza</h2>
              <Facts rows={[['Motor', t.engineManufacturer], ['Potencia', `${t.horsepower} CV`], ['Velocidad punta', `${Math.round(338 + t.carPerformance * 16)} km/h`],
                ['Carga aerodinámica', `${Math.round(1450 + t.aerodynamics * 350)} kgf`], ['Fiabilidad', pct(t.reliability)], ['Parada media', `${t.pitStopAverageTime.toLocaleString('es-ES')} s`]]} />
            </section>
          </>)}
          {tab === 'estrategia' && (<>
            <section className={s.block}>
              <h2>Estilo</h2>
              <p className={s.lead}>{style}</p>
              <Facts rows={[['Estrategia recomendada', d.tireManagement > 0.8 ? '1 parada (medio, duro)' : '2 paradas (blando, medio, blando)'],
                ['Desgaste estimado', `${(1.45 - d.tireManagement * 0.65).toFixed(2).replace('.', ',')} % por vuelta`],
                ['Ventana para alargar', d.tireManagement > 0.85 ? '+4 vueltas' : d.tireManagement > 0.7 ? '+2 vueltas' : 'Normal']]} />
            </section>
            <section className={s.block}>
              <h2>En carrera</h2>
              <Facts rows={[['En lluvia', `${Math.round(d.talentRating * 70 + d.consistency * 30)} %`], ['Éxito al adelantar', `${Math.round(d.raceCraft * 75 + d.talentRating * 25)} %`],
                ['Riesgo de incidente', `${Math.round(d.raceCraft * 30 * (1.1 - d.luckRating * 0.3))} %`]]} />
            </section>
          </>)}
          {tab === 'rendimiento' && (<>
            <section className={s.block}>
              <h2>Palmarés</h2>
              <Facts rows={[['Mundiales', String(d.worldChampionships)], ['Victorias', String(d.careerWins)], ['Podios', String(d.careerPodiums)]]} />
            </section>
            <section className={s.block}>
              <h2>Temporada</h2>
              <Facts rows={[['Equipo', t.name], ['Valoración', `${Math.round((d.talentRating + d.consistency + d.tireManagement) / 3 * 100)} de 100`],
                ['Eficiencia en clasificación', `${Math.round(d.talentRating * 95)} %`], ['Fiabilidad del coche', pct(t.reliability)]]} />
            </section>
          </>)}
        </div>
      </main>
      {mate && (
        <footer className={s.footer}>
          <span className={s.facts}>Compañero: {mate.firstName} {mate.lastName}</span>
          <div className={s.footerButtons}>
            <button type="button" className={s.primary} onClick={() => onOther(mate.id)}>Ver a {mate.lastName}<ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        </footer>
      )}
    </div>
  );
}
