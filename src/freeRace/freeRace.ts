/**
 * [UX12] Carrera libre por pasos: Equipo → Circuito → Resumen. Aquí va la lógica sin pantalla: el orden de los pasos,
 * qué deja avanzar, y lo que enseña cada tarjeta de equipo y de circuito.
 */
import type { Driver } from '../types/f1';
import type { CircuitSpec } from '../data/circuits';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { LAP_REFERENCES } from '../data/lapReferences';

export const FREE_RACE_STEPS = ['equipo', 'circuito', 'resumen'] as const;
export type FreeRaceStep = typeof FREE_RACE_STEPS[number];
export const STEP_LABEL: Record<FreeRaceStep, string> = { equipo: 'Equipo', circuito: 'Circuito', resumen: 'Resumen' };

export interface FreeRaceState { step: FreeRaceStep; teamId: string | null; circuitId: string | null }
export type FreeRaceAction = { type: 'next' } | { type: 'back' } | { type: 'team'; teamId: string } | { type: 'circuit'; circuitId: string } | { type: 'go'; step: FreeRaceStep };

export const initialFreeRace = (): FreeRaceState => ({ step: 'equipo', teamId: null, circuitId: null });

/** ¿Se puede salir de este paso hacia el siguiente? Solo con lo del paso elegido. */
export function canAdvance(s: FreeRaceState): boolean {
  return s.step === 'equipo' ? s.teamId !== null : s.step === 'circuito' ? s.circuitId !== null : false;
}

export function freeRaceReducer(s: FreeRaceState, a: FreeRaceAction): FreeRaceState {
  const at = FREE_RACE_STEPS.indexOf(s.step);
  switch (a.type) {
    case 'team': return { ...s, teamId: a.teamId };
    case 'circuit': return { ...s, circuitId: a.circuitId };
    case 'next': return canAdvance(s) ? { ...s, step: FREE_RACE_STEPS[at + 1] } : s;
    case 'back': return at > 0 ? { ...s, step: FREE_RACE_STEPS[at - 1] } : s;
    // Saltar desde la barra de pasos: hacia atrás siempre; hacia delante, solo si lo de antes está elegido.
    case 'go': {
      const to = FREE_RACE_STEPS.indexOf(a.step);
      if (to <= at) return { ...s, step: a.step };
      const ready = (to < 1 || s.teamId !== null) && (to < 2 || s.circuitId !== null);
      return ready ? { ...s, step: a.step } : s;
    }
  }
}

/** Pilotos de un equipo, primero los del equipo en su orden y luego por parrilla de salida. */
export function driversOf(roster: Record<string, Driver>, teamId: string): Driver[] {
  const team = TEAMS[teamId];
  const grid = (id: string) => { const i = STARTING_GRID_ORDER.indexOf(id); return i < 0 ? 99 : i; };
  const own = (id: string) => { const i = team?.drivers.indexOf(id) ?? -1; return i < 0 ? 99 : i; };
  return Object.values(roster).filter(d => d.teamId === teamId).sort((a, b) => own(a.id) - own(b.id) || grid(a.id) - grid(b.id));
}

/** Piloto al que sigue la cámara al empezar (decisión recomendada de UX12): el primero del equipo. */
export function firstDriverOf(roster: Record<string, Driver>, teamId: string): string {
  return driversOf(roster, teamId)[0]?.id ?? Object.keys(roster)[0];
}

export interface TeamCard {
  id: string; name: string; color: string;
  attributes: { label: string; value: string }[];
  drivers: { id: string; name: string; code: string; number: number; facts: string[] }[];
}

/** Puesto de un equipo entre todos en un atributo (1 = el mejor). */
const rankOf = (teamId: string, key: 'carPerformance' | 'aerodynamics' | 'enginePower' | 'reliability') => {
  const sorted = Object.values(TEAMS).sort((a, b) => b[key] - a[key]);
  return sorted.findIndex(t => t.id === teamId) + 1;
};

/** Tarjetas del paso Equipo: los atributos del coche (puesto entre los equipos) y los dos pilotos con tres datos. */
export function teamCards(roster: Record<string, Driver>): TeamCard[] {
  const total = Object.keys(TEAMS).length;
  return Object.values(TEAMS).map(t => ({
    id: t.id, name: t.name, color: t.color,
    attributes: [
      { label: 'Coche', value: `${rankOf(t.id, 'carPerformance')}º de ${total}` },
      { label: 'Aerodinámica', value: `${rankOf(t.id, 'aerodynamics')}º` },
      { label: 'Motor', value: `${rankOf(t.id, 'enginePower')}º · ${t.horsepower} CV` },
      { label: 'Fiabilidad', value: `${rankOf(t.id, 'reliability')}º` },
      { label: 'Parada media', value: `${t.pitStopAverageTime.toLocaleString('es-ES')} s` },
    ],
    drivers: driversOf(roster, t.id).slice(0, 2).map(d => ({
      id: d.id, name: `${d.firstName} ${d.lastName}`, code: d.code, number: d.number,
      facts: [`#${d.number} · ${d.country}`, `Talento ${Math.round(d.talentRating * 100)}`, d.worldChampionships > 0 ? `${d.worldChampionships} ${d.worldChampionships === 1 ? 'mundial' : 'mundiales'}` : `${d.careerWins} victorias`],
    })),
  }));
}

/** Estrategia óptima según el desgaste del asfalto (la misma regla del paddock de antes). */
export function circuitStrategy(c: CircuitSpec): { stops: number; text: string } {
  return c.asphaltAbrasion === 'Muy Alta' || c.asphaltAbrasion === 'Alta'
    ? { stops: 2, text: '2 paradas (blando, medio, duro)' }
    : { stops: 1, text: '1 parada (medio, duro)' };
}

/** Ritmo de carrera frente a la vuelta rápida (gasolina, neumáticos y tráfico). */
const RACE_PACE = 1.06;

/** Primer Gran Premio del campeonato en cada circuito (año). */
export const FIRST_GRAND_PRIX: Record<string, number> = {
  barcelona: 1991, monza: 1950, silverstone: 1950, spa: 1950, monaco: 1950, spielberg: 1970, interlagos: 1973, suzuka: 1987,
  zandvoort: 1952, 'las-vegas': 2023, bahrain: 2004, baku: 2016, melbourne: 1996, miami: 2022, shanghai: 2004, jeddah: 2021,
  'marina-bay': 2008, lusail: 2021, 'yas-marina': 2009, hungaroring: 1986, 'mexico-city': 1963, montreal: 1978, austin: 2012,
};

export interface CircuitCard { laps: number; safetyCarPercent: number; pitLossSec: number; drsZones: number; strategy: string; predictedSec: number; fastestLapSec: number | null }

/** Lo que sirve para decidir en el paso Circuito. El tiempo previsto: vueltas a ritmo de carrera y las paradas. */
export function circuitCard(c: CircuitSpec): CircuitCard {
  const ref = LAP_REFERENCES[c.id]?.referenceLapSec ?? null;
  const lap = ref ?? c.lapLengthMeters / 60; // sin referencia, a unos 216 km/h de media
  const strategy = circuitStrategy(c);
  return {
    laps: c.totalLaps, safetyCarPercent: c.safetyCarProbabilityPercent, pitLossSec: c.pitLaneTimeLossSec, drsZones: c.drsZones,
    strategy: strategy.text, predictedSec: Math.round(c.totalLaps * lap * RACE_PACE + strategy.stops * c.pitLaneTimeLossSec), fastestLapSec: ref,
  };
}

/** «1 h 18 min». */
export function formatDuration(sec: number): string {
  const min = Math.round(sec / 60);
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** «1:15,743». */
export function formatLap(sec: number): string {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0').replace('.', ',')}`;
}
