// [T4.19] Carrera profesional: qué ofrece el menú de partidas, cómo nace una partida nueva (se elige equipo, no
// piloto) y qué piloto sigue el jugador. La carrera libre es un modo aparte que no toca ninguna partida.
import { calendarFor, DEFAULT_SEASON_YEAR } from '../data/calendar';
import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import { CHAMPIONSHIP_STORAGE_KEY, emptyChampionship, parseChampionship } from './Championship';
import { emptyComponents, ensureDriver } from './ComponentPool';
import { emptyProgram } from './Development';
import { emptyDevelopment } from './DriverDevelopment';
import { MANAGEMENT_STORAGE_KEY, startManagement } from './Management';
import type { CareerData, SaveSelection, SlotSummary } from './SaveGame';
import { emptySeason } from './Season';
import { lineupOf, pairOf } from './Contracts';
import { teamFormFor } from '../data/seasons';

/** Nombre de la partida en curso: existe desde que se empieza o se carga una. */
export const CAREER_NAME_KEY = 'f1_career_name';
export const DEFAULT_CAREER_NAME = 'Mi carrera';

export type MenuOptionId = 'continuar' | 'nueva' | 'cargar' | 'libre';

/** Opciones del menú de partidas: continuar solo con partida en curso y cargar solo con partidas guardadas. */
export function menuOptions(current: SlotSummary | null, slots: SlotSummary[]): MenuOptionId[] {
  return [...(current ? ['continuar' as const] : []), 'nueva', ...(slots.length ? ['cargar' as const] : []), 'libre'];
}

/** ¿Hay en el navegador una partida que continuar? También vale una anterior al menú (campeonato con carreras o gestión). */
export function hasStoredCareer(storage: { getItem(key: string): string | null }): boolean {
  if (storage.getItem(CAREER_NAME_KEY) !== null || storage.getItem(MANAGEMENT_STORAGE_KEY) !== null) return true;
  return parseChampionship(storage.getItem(CHAMPIONSHIP_STORAGE_KEY)).races.length > 0;
}

const levelOf = (teamId: string, year?: number): number => {
  const perf = (id: string) => (year === undefined ? TEAMS[id]?.carPerformance : teamFormFor(year)[id]?.carPerformance) ?? 0;
  const levels = Object.keys(TEAMS).map(perf);
  const low = Math.min(...levels), high = Math.max(...levels);
  return TEAMS[teamId] && high > low ? (perf(teamId) - low) / (high - low) : 0;
};

/** Dificultad de dirigir un equipo: baja con los mejores coches y alta con los peores. [TL2] Con `year`, con los coches de ese año. */
export function teamDifficulty(teamId: string, year?: number): 'Baja' | 'Media' | 'Alta' {
  const level = levelOf(teamId, year);
  return level >= 0.66 ? 'Baja' : level >= 0.33 ? 'Media' : 'Alta';
}

/**
 * Piloto que sigue el jugador en la carrera profesional: uno de su equipo (el pedido si lo es; si no, el primero).
 * [T4.7] `pair` es la pareja de la temporada según los contratos; sin ella vale la de partida.
 */
export function careerDriver(teamId: string, driverId: string, pair: string[] = TEAMS[teamId]?.drivers ?? []): string {
  return pair.includes(driverId) ? driverId : pair[0] ?? Object.keys(DRIVERS)[0];
}

/**
 * Partida nueva con ese equipo: campeonato vacío, saldos iniciales, componentes de la primera carrera y la ronda 1.
 * `seed` es la semilla de lo que la gestión sortea (ofertas, mercado…).
 */
export function newCareer(teamId: string, name: string, seed: number, startYear: number = DEFAULT_SEASON_YEAR): { name: string; career: CareerData; selection: SaveSelection } {
  // [TL2] Pilotos, edades, fuerza y motores del año elegido.
  const management = startManagement(teamId, 1, seed, startYear);
  // [TL1] La partida empieza en el año elegido, con su calendario.
  const first = calendarFor(startYear)[0];
  return {
    name: name.trim() || DEFAULT_CAREER_NAME,
    career: {
      championship: emptyChampionship(), development: emptyDevelopment(),
      components: Object.keys(lineupOf(management.contracts)).reduce((state, id) => ensureDriver(state, id), emptyComponents()),
      program: emptyProgram(), archive: [], history: [], season: emptySeason(startYear, teamFormFor(startYear)), management,
    },
    selection: {
      driverId: careerDriver(management.playerTeamId, '', pairOf(management.contracts, management.playerTeamId)), circuitId: first.circuitId,
      raceFormat: first.sprint ? 'sprint' : 'directo', weatherScenarioId: 'seco', luckVariant: true, counts: true,
    },
  };
}
