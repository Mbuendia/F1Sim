// [R09] Dirección de Carrera: sectores de comisarios y un único servicio de permisos por coche.
//
// Prioridad: roja > SC > VSC > doble amarilla local > amarilla local > verde. Las amarillas solo afectan al sector de
// comisarios del incidente; la bandera global «yellow» queda como aviso informativo. Los factores de velocidad son
// calibración del juego (los detalles de conducta del Código Deportivo / Apéndices H y L quedan pendientes de fuente).
import type { RaceFlagState, TrackIncident } from '../types/f1';

/** Sectores de comisarios por circuito: provisionales (iguales en longitud) hasta tener mapas oficiales (R03). */
export const MARSHAL_SECTOR_COUNT = 18;
export const YELLOW_SPEED_FACTOR = 0.9;
export const DOUBLE_YELLOW_SPEED_FACTOR = 0.75;

export type LocalFlag = 'yellow' | 'double-yellow';

const normalize = (t: number) => ((t % 1) + 1) % 1;

/** Sector de comisarios (1..18) de una fracción de vuelta. */
export function marshalSectorOf(t: number): number {
  return Math.min(MARSHAL_SECTOR_COUNT, Math.floor(normalize(t) * MARSHAL_SECTOR_COUNT) + 1);
}

export function marshalSectorRange(sector: number): { startT: number; endT: number } {
  return { startT: (sector - 1) / MARSHAL_SECTOR_COUNT, endT: sector / MARSHAL_SECTOR_COUNT };
}

/** Banderas locales por sector de comisarios a partir de los incidentes activos. */
export function localFlagsFrom(incidents: TrackIncident[]): Map<number, LocalFlag> {
  const counts = new Map<number, { n: number; major: boolean }>();
  for (const incident of incidents) {
    if (incident.isCleared) continue;
    const sector = incident.marshalSector ?? marshalSectorOf(incident.trackT);
    const entry = counts.get(sector) ?? { n: 0, major: false };
    entry.n++;
    entry.major ||= incident.type === 'major_crash';
    counts.set(sector, entry);
  }
  const flags = new Map<number, LocalFlag>();
  for (const [sector, { n, major }] of counts) flags.set(sector, n >= 2 || major ? 'double-yellow' : 'yellow');
  return flags;
}

export interface Permissions {
  overtake: boolean;
  drs: boolean;
  /** El doblado puede apartarse para ceder (no en zona peligrosa). */
  blueFlags: boolean;
  /** Neutralización de toda la pista (VSC, SC o roja). */
  neutralized: boolean;
  speedFactor: number;
  reason: string;
}

export interface PermissionInput {
  marshalSector: number;
  globalFlag: RaceFlagState;
  vscActive?: boolean;
  localFlags: Map<number, LocalFlag>;
}

export function permissionsFor({ marshalSector, globalFlag, vscActive, localFlags }: PermissionInput): Permissions {
  if (globalFlag === 'red') return { overtake: false, drs: false, blueFlags: false, neutralized: true, speedFactor: 1, reason: 'Bandera roja' };
  if (globalFlag === 'sc') return { overtake: false, drs: false, blueFlags: false, neutralized: true, speedFactor: 1, reason: 'Safety Car' };
  if (globalFlag === 'vsc' || vscActive) return { overtake: false, drs: false, blueFlags: false, neutralized: true, speedFactor: 1, reason: 'Virtual Safety Car' };
  const local = localFlags.get(marshalSector);
  if (local === 'double-yellow') {
    return { overtake: false, drs: false, blueFlags: false, neutralized: false, speedFactor: DOUBLE_YELLOW_SPEED_FACTOR, reason: `Doble amarilla en el sector ${marshalSector}` };
  }
  if (local === 'yellow') {
    return { overtake: false, drs: false, blueFlags: false, neutralized: false, speedFactor: YELLOW_SPEED_FACTOR, reason: `Amarilla en el sector ${marshalSector}` };
  }
  return { overtake: true, drs: true, blueFlags: true, neutralized: false, speedFactor: 1, reason: 'Verde' };
}
