// [T4.3] Acento de cada equipo en la interfaz de gestión (cabecera, pestaña activa, pilotos propios). Es el color del
// equipo cuando se lee sobre el fondo grafito; los muy oscuros van aclarados y Ferrari usa amarillo, porque el rojo
// queda reservado a la acción principal. Los colores de los coches (teams.ts) no cambian.
import { TEAMS } from './teams';

const ACCENTS: Record<string, string> = {
  redbull: '#5B8DEF',
  ferrari: '#F2C200',
  astonmartin: '#2FB487',
  williams: '#5C97FF',
  racingbulls: '#8098FF',
  haas: '#E6E8EB',
};

/** Acento neutro para un equipo desconocido: el color de foco del sistema visual. */
export const DEFAULT_ACCENT = '#5AA9FF';

export function teamAccent(teamId: string | undefined): string {
  if (!teamId || !TEAMS[teamId]) return DEFAULT_ACCENT;
  return ACCENTS[teamId] ?? TEAMS[teamId].color;
}
