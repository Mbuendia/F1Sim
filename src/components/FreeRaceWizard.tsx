import { useReducer, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Info, Play, UserRound } from 'lucide-react';
import type { Driver } from '../types/f1';
import type { DriverAttributes } from '../simulation/DriverDevelopment';
import { TEAMS } from '../data/teams';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { getRuleSet, DEFAULT_RULE_SET_ID } from '../rules/ruleSets';
import {
  FREE_RACE_STEPS, STEP_LABEL, canAdvance, circuitCard, driversOf, formatDuration, freeRaceReducer, initialFreeRace, teamCards,
  type FreeRaceState,
} from '../freeRace/freeRace';
import { RaceFormatSelect, type RaceFormatId } from './RaceFormatSelect';
import { WeatherScenarioSelect } from './WeatherScenarioSelect';
import { WeatherOutlook } from './WeatherOutlook';
import { FlagIcon } from './FlagIcon';
import { DriverSheet } from './DriverSheet';
import { CircuitSheet } from './CircuitSheet';
import s from './FreeRace.module.css';

export interface FreeRaceWizardProps {
  roster: Record<string, Driver>;
  /** Para revisar o probar un paso concreto; si no, se empieza por el equipo sin nada elegido. */
  initial?: FreeRaceState;
  raceFormat: RaceFormatId;
  onSelectFormat: (format: RaceFormatId) => void;
  sprintAvailable?: boolean;
  /** [UX3] Solo con el modo desarrollador se elige el tiempo; sin él, se enseña la previsión. */
  weatherScenarioId?: string;
  onSelectWeather?: (id: string) => void;
  onSelectTeam: (teamId: string) => void;
  onSelectCircuit: (circuitId: string) => void;
  onStart: () => void;
  /** Salir al menú de partidas. */
  onExit: () => void;
  driverAttributes?: (driver: Driver) => DriverAttributes;
}

/**
 * [UX12] Carrera libre por pasos: Equipo → Circuito → Resumen. La barra de arriba dice en qué paso se está; el pie, fijo
 * y solo con texto, dice lo elegido y lleva Atrás y Siguiente (en el resumen, «Entrar a pista»). Solo se desplaza el
 * contenido del paso. Las fichas de piloto y de circuito se abren a pantalla completa encima.
 */
export function FreeRaceWizard(p: FreeRaceWizardProps) {
  const [state, dispatch] = useReducer(freeRaceReducer, p.initial ?? initialFreeRace());
  const [driverSheet, setDriverSheet] = useState<string | null>(null);
  const [circuitSheet, setCircuitSheet] = useState<string | null>(null);
  const team = state.teamId ? TEAMS[state.teamId] : null;
  const circuit = state.circuitId ? OFFICIAL_CIRCUITS[state.circuitId] : null;
  const at = FREE_RACE_STEPS.indexOf(state.step);

  const pickTeam = (teamId: string) => { dispatch({ type: 'team', teamId }); p.onSelectTeam(teamId); };
  const pickCircuit = (circuitId: string) => { dispatch({ type: 'circuit', circuitId }); p.onSelectCircuit(circuitId); };

  if (driverSheet) {
    const d = p.roster[driverSheet];
    const mate = driversOf(p.roster, d.teamId).find(x => x.id !== d.id) ?? null;
    return <DriverSheet driver={d} mate={mate} team={TEAMS[d.teamId]} onBack={() => setDriverSheet(null)} onOther={id => setDriverSheet(id)}
      attributes={p.driverAttributes?.(d)} />;
  }
  if (circuitSheet) {
    const c = OFFICIAL_CIRCUITS[circuitSheet];
    return <CircuitSheet circuit={c} onBack={() => setCircuitSheet(null)}
      onChoose={() => { pickCircuit(c.id); setCircuitSheet(null); }} chosen={state.circuitId === c.id} />;
  }

  const hint = state.step === 'equipo' && !team ? 'Elige un equipo' : state.step === 'circuito' && !circuit ? 'Elige un circuito' : null;
  return (
    <div className={s.wizard} data-free-wizard>
      <header className={s.top}>
        <button type="button" className={s.ghost} onClick={p.onExit} aria-label="Volver al menú"><ArrowLeft size={20} aria-hidden="true" /></button>
        <h1 className={s.title}>Carrera libre</h1>
        <ol className={s.steps} aria-label="Pasos">
          {FREE_RACE_STEPS.map((step, i) => (
            <li key={step}>
              <button type="button" className={s.step} data-state={i < at ? 'hecho' : i === at ? 'actual' : 'pendiente'} aria-current={i === at ? 'step' : undefined}
                onClick={() => dispatch({ type: 'go', step })}>
                <span className={s.stepNum}>{i < at ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
                <span className={s.stepLabel}>{STEP_LABEL[step]}</span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <main className={s.scroll} data-free-scroll>
        {state.step === 'equipo' && (
          <section className={s.grid} aria-label="Equipos">
            {teamCards(p.roster).map(card => {
              const chosen = card.id === state.teamId;
              return (
                <article key={card.id} className={s.teamCard} data-chosen={chosen || undefined} style={{ ['--c' as string]: card.color }}>
                  <button type="button" className={s.pick} aria-pressed={chosen} onClick={() => pickTeam(card.id)}>
                    <span className={s.cardHead}><span className={s.cardName}>{card.name}</span>{chosen && <Check size={18} aria-label="Elegido" />}</span>
                    <dl className={s.attrs}>
                      {card.attributes.map(a => <div key={a.label}><dt>{a.label}</dt><dd>{a.value}</dd></div>)}
                    </dl>
                  </button>
                  <ul className={s.drivers}>
                    {card.drivers.map(d => (
                      <li key={d.id} className={s.driver}>
                        <span className={s.driverText}>
                          <strong>{d.name}</strong>
                          <span className={s.facts}>{d.facts.join(' · ')}</span>
                        </span>
                        <button type="button" className={s.secondary} onClick={() => setDriverSheet(d.id)} aria-label={`Ver ficha de ${d.name}`}>
                          <UserRound size={16} aria-hidden="true" />Ver ficha
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </section>
        )}

        {state.step === 'circuito' && (
          <section className={s.grid} aria-label="Circuitos">
            {Object.values(OFFICIAL_CIRCUITS).map(c => {
              const info = circuitCard(c);
              const chosen = c.id === state.circuitId;
              return (
                <article key={c.id} className={s.circuitCard} data-chosen={chosen || undefined}>
                  <button type="button" className={s.pick} aria-pressed={chosen} onClick={() => pickCircuit(c.id)}>
                    <span className={s.cardHead}>
                      <FlagIcon country={c.country} emoji={c.countryFlag} size={16} />
                      <span className={s.cardName}>{c.name}</span>
                      {chosen && <Check size={18} aria-label="Elegido" />}
                    </span>
                    <span className={s.circuitBody}>
                      <img className={s.trackImg} src={`${import.meta.env.BASE_URL}circuits/minimal/${c.svgFile}`} alt="" loading="lazy" />
                      <dl className={s.attrs}>
                        <div><dt>Carrera</dt><dd>{info.laps} vueltas</dd></div>
                        <div><dt>Safety Car</dt><dd>{info.safetyCarPercent} %</dd></div>
                        <div><dt>Paso por el pit lane</dt><dd>{info.pitLossSec.toLocaleString('es-ES')} s</dd></div>
                        <div><dt>Zonas DRS</dt><dd>{info.drsZones}</dd></div>
                        <div className={s.wide}><dt>Estrategia</dt><dd>{info.strategy}</dd></div>
                        <div className={s.wide}><dt>Previsto</dt><dd>≈ {formatDuration(info.predictedSec)}</dd></div>
                      </dl>
                    </span>
                  </button>
                  <button type="button" className={s.secondary} onClick={() => setCircuitSheet(c.id)} aria-label={`Detalle de ${c.name}`}>
                    <Info size={16} aria-hidden="true" />Detalle del circuito
                  </button>
                </article>
              );
            })}
          </section>
        )}

        {state.step === 'resumen' && team && circuit && (
          <section className={s.summary} aria-label="Resumen">
            <div className={s.summaryCard} style={{ ['--c' as string]: team.color }}>
              <span className={s.kicker}>Equipo</span>
              <strong className={s.summaryMain}>{team.name}</strong>
              <span className={s.facts}>{driversOf(p.roster, team.id).slice(0, 2).map(d => `${d.firstName} ${d.lastName}`).join(' y ')} · {team.engineManufacturer}, {team.horsepower} CV</span>
            </div>
            <div className={s.summaryCard} style={{ ['--c' as string]: 'var(--accion)' }}>
              <span className={s.kicker}>Circuito</span>
              <strong className={s.summaryMain}><FlagIcon country={circuit.country} emoji={circuit.countryFlag} size={16} /> {circuit.name}</strong>
              <span className={s.facts}>{circuit.officialGpName} · {circuit.totalLaps} vueltas · ≈ {formatDuration(circuitCard(circuit).predictedSec)}</span>
              <img className={s.summaryTrack} src={`${import.meta.env.BASE_URL}circuits/minimal/${circuit.svgFile}`} alt={`Trazado de ${circuit.name}`} />
            </div>
            <div className={s.summaryCard}>
              <RaceFormatSelect value={p.raceFormat} onChange={p.onSelectFormat} sprintAvailable={p.sprintAvailable} />
              {p.onSelectWeather
                ? <WeatherScenarioSelect value={p.weatherScenarioId ?? 'seco'} onChange={p.onSelectWeather} />
                : <WeatherOutlook rainProbabilityPercent={circuit.rainProbabilityPercent} />}
              <span className={s.facts}>Reglas: {getRuleSet(DEFAULT_RULE_SET_ID).label} · no cuenta para ninguna partida</span>
            </div>
          </section>
        )}
      </main>

      <footer className={s.footer} data-free-footer>
        <p className={s.chosen} aria-live="polite">
          <span><span className={s.kicker}>Equipo</span> {team ? team.name : '—'}</span>
          <span><span className={s.kicker}>Circuito</span> {circuit ? circuit.name : '—'}</span>
          {hint && <span className={s.hint}>{hint}</span>}
        </p>
        <div className={s.footerButtons}>
          <button type="button" className={s.secondary} onClick={() => (at === 0 ? p.onExit() : dispatch({ type: 'back' }))}>
            <ArrowLeft size={18} aria-hidden="true" />{at === 0 ? 'Menú' : 'Atrás'}
          </button>
          {state.step === 'resumen' ? (
            <button type="button" className={s.primary} onClick={p.onStart} data-main><Play size={18} fill="#fff" aria-hidden="true" />Entrar a pista</button>
          ) : (
            <button type="button" className={s.primary} disabled={!canAdvance(state)} onClick={() => dispatch({ type: 'next' })}>
              Siguiente<ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default FreeRaceWizard;
