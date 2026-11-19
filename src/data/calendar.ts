// [R51] Calendario de la temporada (sin fechas: diseño del juego). [TL1] Uno por año, de 2023 a 2026; después de 2026
// se repite el de 2026. Los órdenes y los sprints salen de lo que se sabe de cada campeonato, sin contrastar con una
// fuente oficial. El juego tiene 23 circuitos: la ronda de Madrid (2026) se corre en Barcelona y la de Imola (2024 y
// 2025) en Monza, que acogen dos (decisiones del usuario).

export interface CalendarRound {
  /** Número de ronda (1..24). */
  round: number;
  circuitId: string;
  /** Sede real a la que sustituye este circuito, cuando el juego no la tiene. */
  substitutes?: string;
  /** [R52] Ronda con fin de semana sprint. */
  sprint?: boolean;
}

/** [TL1] Años en que puede empezar una carrera profesional. */
export const SEASON_YEARS = [2023, 2024, 2025, 2026] as const;
/** [TL1] Año de las partidas que no lo tienen (las de antes de TL1) y de las partidas nuevas por defecto. */
export const DEFAULT_SEASON_YEAR = 2026;

type Entry = string | [circuitId: string, substitutes: string];

const YEARS: Record<number, { order: Entry[]; sprints: string[] }> = {
  2023: {
    order: ['bahrain', 'jeddah', 'melbourne', 'baku', 'miami', 'monaco', 'barcelona', 'montreal', 'spielberg', 'silverstone', 'hungaroring',
      'spa', 'zandvoort', 'monza', 'marina-bay', 'suzuka', 'lusail', 'austin', 'mexico-city', 'interlagos', 'las-vegas', 'yas-marina'],
    sprints: ['baku', 'spielberg', 'spa', 'lusail', 'austin', 'interlagos'],
  },
  2024: {
    order: ['bahrain', 'jeddah', 'melbourne', 'suzuka', 'shanghai', 'miami', ['monza', 'Imola'], 'monaco', 'montreal', 'barcelona', 'spielberg',
      'silverstone', 'hungaroring', 'spa', 'zandvoort', 'monza', 'baku', 'marina-bay', 'austin', 'mexico-city', 'interlagos', 'las-vegas', 'lusail', 'yas-marina'],
    sprints: ['shanghai', 'miami', 'spielberg', 'austin', 'interlagos', 'lusail'],
  },
  2025: {
    order: ['melbourne', 'shanghai', 'suzuka', 'bahrain', 'jeddah', 'miami', ['monza', 'Imola'], 'monaco', 'barcelona', 'montreal', 'spielberg',
      'silverstone', 'spa', 'hungaroring', 'zandvoort', 'monza', 'baku', 'marina-bay', 'austin', 'mexico-city', 'interlagos', 'las-vegas', 'lusail', 'yas-marina'],
    sprints: ['shanghai', 'miami', 'spa', 'austin', 'interlagos', 'lusail'],
  },
  // [R51/R52] El de 2026 es el que tenía el juego: 24 rondas en el orden del campeonato de 2026.
  2026: {
    order: ['melbourne', 'shanghai', 'suzuka', 'bahrain', 'jeddah', 'miami', 'montreal', 'monaco', 'barcelona', 'spielberg', 'silverstone', 'spa',
      'hungaroring', 'zandvoort', 'monza', ['barcelona', 'Madrid'], 'baku', 'marina-bay', 'austin', 'mexico-city', 'interlagos', 'las-vegas', 'lusail', 'yas-marina'],
    sprints: ['shanghai', 'miami', 'montreal', 'silverstone', 'zandvoort', 'marina-bay'],
  },
};

function build({ order, sprints }: { order: Entry[]; sprints: string[] }): CalendarRound[] {
  return order.map((entry, index) => {
    const round: CalendarRound = typeof entry === 'string' ? { round: index + 1, circuitId: entry } : { round: index + 1, circuitId: entry[0], substitutes: entry[1] };
    return !round.substitutes && sprints.includes(round.circuitId) ? { ...round, sprint: true } : round;
  });
}

const CALENDARS: Record<number, CalendarRound[]> = Object.fromEntries(Object.entries(YEARS).map(([year, data]) => [year, build(data)]));

/** [TL1] Calendario de un año. Antes de 2023, el de 2023; después de 2026, el de 2026. */
export function calendarFor(year: number = DEFAULT_SEASON_YEAR): CalendarRound[] {
  const first = SEASON_YEARS[0], last = SEASON_YEARS[SEASON_YEARS.length - 1];
  return CALENDARS[Math.min(last, Math.max(first, Math.floor(year)))];
}

/** [TL1] Reglamento: en 2023 y 2024 la vuelta rápida da un punto a quien acaba entre los diez primeros (no en el sprint). */
export function fastestLapPoint(year: number = DEFAULT_SEASON_YEAR): boolean {
  return year <= 2024;
}

/** [R52] Sedes con fin de semana sprint en 2026. */
export const SPRINT_VENUES = YEARS[DEFAULT_SEASON_YEAR].sprints;

/** El calendario de 2026, el que usaba el juego antes de TL1. */
export const SEASON_CALENDAR: CalendarRound[] = calendarFor(DEFAULT_SEASON_YEAR);
