// [R51] Calendario de la temporada: 24 rondas en el orden del campeonato de 2026 (sin fechas: diseño del juego).
// El juego tiene 23 circuitos: la ronda de Madrid se corre en Barcelona, que acoge dos (decisión del usuario).

export interface CalendarRound {
  /** Número de ronda (1..24). */
  round: number;
  circuitId: string;
  /** Sede real a la que sustituye este circuito, cuando el juego no la tiene. */
  substitutes?: string;
  /** [R52] Ronda con fin de semana sprint. */
  sprint?: boolean;
}

/** [R52] Sedes con fin de semana sprint (las de 2026 que decidió el usuario; sin contrastar con una fuente oficial). */
export const SPRINT_VENUES = ['shanghai', 'miami', 'montreal', 'silverstone', 'zandvoort', 'marina-bay'];

const ORDER: (string | [circuitId: string, substitutes: string])[] = [
  'melbourne', 'shanghai', 'suzuka', 'bahrain', 'jeddah', 'miami', 'montreal', 'monaco',
  'barcelona', 'spielberg', 'silverstone', 'spa', 'hungaroring', 'zandvoort', 'monza', ['barcelona', 'Madrid'],
  'baku', 'marina-bay', 'austin', 'mexico-city', 'interlagos', 'las-vegas', 'lusail', 'yas-marina',
];

export const SEASON_CALENDAR: CalendarRound[] = ORDER.map((entry, index) => {
  const round: CalendarRound = typeof entry === 'string' ? { round: index + 1, circuitId: entry } : { round: index + 1, circuitId: entry[0], substitutes: entry[1] };
  return SPRINT_VENUES.includes(round.circuitId) ? { ...round, sprint: true } : round;
});
