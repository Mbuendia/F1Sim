// [R18] Temporada de 24 carreras (decisión del usuario). Al cerrarla el campeonato pasa al historial con sus campeones,
// se renuevan los cupos de componentes (R19) y el programa de desarrollo; los atributos de los pilotos (R45) se conservan.
import { constructorsChampionship, driverStandings, emptyChampionship } from './Championship';
import type { ChampionshipState } from './Championship';
import { emptyComponents, ensureDriver } from './ComponentPool';
import type { ComponentState } from './ComponentPool';
import { emptyProgram } from './Development';
import type { DevelopmentProgram } from './Development';

export const SEASON_RACES = 24;
export const SEASONS_STORAGE_KEY = 'f1_seasons';

export interface SeasonSummary { season: number; races: number; champion: string | null; constructorsChampion: string | null }

export function seasonComplete(championship: ChampionshipState): boolean {
  return championship.races.length >= SEASON_RACES;
}

/** Carrera actual dentro de la temporada (1..24). */
export function seasonRaceNumber(championship: ChampionshipState): number {
  return Math.min(SEASON_RACES, championship.races.length + 1);
}

export function parseArchive(text: string | null): SeasonSummary[] {
  try {
    const data = text ? JSON.parse(text) : null;
    if (Array.isArray(data)) return data as SeasonSummary[];
  } catch { /* guardado ilegible */ }
  return [];
}

export function closeSeason({ championship, components, program, archive }: {
  championship: ChampionshipState; components: ComponentState; program: DevelopmentProgram; archive: SeasonSummary[];
}): { championship: ChampionshipState; components: ComponentState; program: DevelopmentProgram; archive: SeasonSummary[] } {
  const drivers = driverStandings(championship), teams = constructorsChampionship(championship);
  const summary: SeasonSummary = {
    season: archive.length + 1, races: championship.races.length,
    champion: drivers[0]?.driverCode ?? null, constructorsChampion: teams[0]?.teamName ?? null,
  };
  const driverIds = [...new Set(components.units.map(u => u.driverId))];
  return {
    championship: emptyChampionship(),
    components: driverIds.reduce((s, id) => ensureDriver(s, id), emptyComponents()),
    program: emptyProgram(),
    archive: [...archive, summary],
  };
}
