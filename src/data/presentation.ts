// [TL6, 19/11/2026] Presentación de la temporada: lo que cambia en cada coche respecto al año anterior (librea, nombre,
// coche nuevo por reglamento, motor, puesto previsto por la fuerza del coche y pilotos). Alcance elegido por el usuario:
// paso nuevo del invierno y también al empezar la carrera profesional («todas empiezan desde el invierno»), con el coche
// de ese año en 3D sobre un escenario hecho en Blender. El tuyo va primero y después los demás por puesto previsto.
import { DRIVERS } from './drivers';
import { EXTRA_DRIVERS, lineupFor, teamFormFor, type TeamForm } from './seasons';
import type { SeasonLivery } from './seasonLiveries';
import { TEAMS } from './teams';

/** Coche de cada año: el modelo cambia con el reglamento (2023, 2024, 2025 y desde 2026). */
export const modelEra = (year: number): number => (year <= 2023 ? 2023 : year === 2024 ? 2024 : year === 2025 ? 2025 : 2026);

export interface PresentationDriver { id: string; name: string; code: string; number: number; isNew: boolean }
export interface PresentationCard {
  teamId: string;
  player: boolean;
  name: string;
  /** Nombre del año anterior si cambia; null si es el mismo (o no hay año anterior). */
  previousName: string | null;
  livery?: SeasonLivery;
  previousLivery?: SeasonLivery;
  /** El coche es nuevo por reglamento (cambia el modelo respecto al año anterior). */
  newCar: boolean;
  engine: string;
  /** Motor del año anterior si cambia; null si es el mismo. */
  previousEngine: string | null;
  /** Puesto previsto (1-10) por la fuerza del coche, el del año anterior y cuánto sube (+) o baja (−). */
  expected: number;
  previousExpected: number | null;
  delta: number | null;
  drivers: PresentationDriver[];
}
export interface SeasonPresentation { year: number; previousYear: number | null; cards: PresentationCard[] }

const FIRST_YEAR = 2023;
const driverOf = (id: string) => DRIVERS[id] ?? EXTRA_DRIVERS[id];
const ranking = (form: TeamForm): Record<string, number> =>
  Object.fromEntries(Object.keys(form).sort((a, b) => form[b].carPerformance - form[a].carPerformance).map((id, i) => [id, i + 1]));
const pairs = (lineup: Record<string, string>): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [driverId, teamId] of Object.entries(lineup)) (out[teamId] ??= []).push(driverId);
  return out;
};

/**
 * La presentación de un año. Sin datos del año anterior (antes de 2023) no hay comparación. En la carrera profesional
 * se le pasan la fuerza y la alineación de la temporada (con la librea del jugador y los fichajes); si no, los del año.
 */
export function seasonPresentation(year: number, playerTeamId: string, opts: { form?: TeamForm | null; lineup?: Record<string, string>; previousForm?: TeamForm | null; previousLineup?: Record<string, string> } = {}): SeasonPresentation {
  const previousYear = year - 1 >= FIRST_YEAR ? year - 1 : null;
  const form = opts.form ?? teamFormFor(year);
  const prevForm = previousYear === null ? null : opts.previousForm ?? teamFormFor(previousYear);
  const now = pairs(opts.lineup ?? lineupFor(year));
  const before = previousYear === null ? null : pairs(opts.previousLineup ?? lineupFor(previousYear));
  const rank = ranking(form), prevRank = prevForm ? ranking(prevForm) : null;
  const cards: PresentationCard[] = Object.keys(TEAMS).filter(id => form[id]).map(teamId => {
    const cur = form[teamId], prev = prevForm?.[teamId];
    const name = cur.name ?? TEAMS[teamId].name;
    const prevName = prev ? prev.name ?? TEAMS[teamId].name : null;
    const prevDrivers = new Set(before?.[teamId] ?? []);
    return {
      teamId, player: teamId === playerTeamId, name,
      previousName: prevName && prevName !== name ? prevName : null,
      livery: cur.livery, previousLivery: prev?.livery,
      newCar: previousYear !== null && modelEra(year) !== modelEra(previousYear),
      engine: cur.engineManufacturer,
      previousEngine: prev && prev.engineManufacturer !== cur.engineManufacturer ? prev.engineManufacturer : null,
      expected: rank[teamId], previousExpected: prevRank?.[teamId] ?? null,
      delta: prevRank ? prevRank[teamId] - rank[teamId] : null,
      drivers: (now[teamId] ?? []).map(id => {
        const d = driverOf(id);
        return { id, name: d ? `${d.firstName} ${d.lastName}` : id, code: d?.code ?? id.slice(0, 3).toUpperCase(), number: d?.number ?? 0, isNew: before !== null && !prevDrivers.has(id) };
      }),
    };
  });
  cards.sort((a, b) => (a.player === b.player ? a.expected - b.expected : a.player ? -1 : 1));
  return { year, previousYear, cards };
}
