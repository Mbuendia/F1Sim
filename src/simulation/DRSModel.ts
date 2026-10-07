import { DEFAULT_RULES } from '../rules/ruleSets';

export interface DrsDetection { id: string; t: number; zoneIds: number[]; source: 'calibrated' | 'verified'; }
interface Passage { carId: number; time: number; }
interface Permission { zones: number[]; eligible: boolean; gapSec: number | null; aheadCarId: number | null; timeSec: number; }

/** [R04] Lo medido la última vez que un coche cruzó una detección: rival observado, hueco y si le dio permiso. */
export interface DrsReading {
  detectionId: string;
  zoneIds: number[];
  eligible: boolean;
  /** Hueco con el coche que cruzó antes (s); null si no había ninguno. */
  gapSec: number | null;
  aheadCarId: number | null;
  timeSec: number;
  /** Zonas de esta detección por las que el coche aún no ha pasado desde que la cruzó. */
  pendingZoneIds: number[];
}

/** Tiempos de cruce por ruta principal y permiso persistente hasta otra detección. */
export class DrsPermissions {
  /** [R01] Umbral de detección del perfil de reglas activo (s). */
  gapThresholdSec: number = DEFAULT_RULES.drsGapSec;
  private passages = new Map<string, Passage[]>();
  private permissions = new Map<number, Map<string, Permission>>();
  private zonePassages = new Map<number, { zoneId: number; closedByBraking: boolean }>();
  /** [R04] Zonas ya recorridas por cada coche desde su última detección (su permiso ya no está pendiente). */
  private usedZones = new Map<number, Set<number>>();

  reset(): void {
    this.passages.clear();
    this.permissions.clear();
    this.zonePassages.clear();
    this.usedZones.clear();
  }

  /** [R28] Estado serializable (pasos por detección, permisos y pasada por zona). */
  serialize() {
    return {
      gapThresholdSec: this.gapThresholdSec,
      passages: [...this.passages.entries()].map(([id, list]) => [id, list.map(p => ({ ...p }))] as const),
      permissions: [...this.permissions.entries()].map(([carId, grants]) =>
        [carId, [...grants.entries()].map(([id, p]) => [id, { ...p, zones: [...p.zones] }] as const)] as const),
      zonePassages: [...this.zonePassages.entries()].map(([carId, p]) => [carId, { ...p }] as const),
      usedZones: [...this.usedZones.entries()].map(([carId, zones]) => [carId, [...zones]] as const),
    };
  }

  /** [R48] Recupera el estado guardado por `serialize` (los guardados anteriores a R04 no traen el hueco medido). */
  restore(data: ReturnType<DrsPermissions['serialize']>): void {
    this.gapThresholdSec = data.gapThresholdSec;
    this.passages = new Map(data.passages.map(([id, list]) => [id, list.map(p => ({ ...p }))]));
    this.permissions = new Map(data.permissions.map(([carId, grants]) =>
      [carId, new Map(grants.map(([id, p]) => [id, {
        zones: [...p.zones], eligible: p.eligible, gapSec: p.gapSec ?? null, aheadCarId: p.aheadCarId ?? null, timeSec: p.timeSec ?? 0,
      }]))]));
    this.zonePassages = new Map(data.zonePassages.map(([carId, p]) => [carId, { ...p }]));
    this.usedZones = new Map((data.usedZones ?? []).map(([carId, zones]) => [carId, new Set(zones)]));
  }

  /** Una frenada cierra esta pasada, sin borrar el permiso de otras zonas. */
  activation(carId: number, zoneId: number | undefined, eligible: boolean, braking: boolean): boolean {
    let passage = this.zonePassages.get(carId);
    // [R04] Al salir de una zona, su permiso deja de estar pendiente hasta la próxima detección.
    if (passage && passage.zoneId !== zoneId) {
      const used = this.usedZones.get(carId) ?? new Set<number>();
      used.add(passage.zoneId);
      this.usedZones.set(carId, used);
    }
    if (zoneId === undefined) {
      this.zonePassages.delete(carId);
      return false;
    }
    if (!passage || passage.zoneId !== zoneId) {
      passage = { zoneId, closedByBraking: false };
      this.zonePassages.set(carId, passage);
    }
    passage.closedByBraking ||= braking;
    return eligible && !passage.closedByBraking;
  }

  /** [R04] ¿Ha cerrado ya una frenada el flap en la pasada actual por la zona? */
  closedByBraking(carId: number): boolean {
    return this.zonePassages.get(carId)?.closedByBraking ?? false;
  }

  record(cars: {id: number; from: number; to: number; onTrack: boolean}[],
    detections: DrsDetection[], startTime: number, dt: number): void {
    const events: { carId: number; time: number; detection: DrsDetection }[] = [];
    for (const car of cars) {
      if (!car.onTrack || car.to <= car.from) continue;
      for (const detection of detections) {
        for (let crossing = Math.floor(car.from - detection.t) + 1 + detection.t; crossing <= car.to; crossing++) {
          events.push({carId: car.id, detection, time: startTime + dt * (crossing - car.from) / (car.to - car.from)});
        }
      }
    }
    events.sort((a, b) => a.time - b.time || a.carId - b.carId);
    for (const event of events) {
      const history = this.passages.get(event.detection.id) || [];
      const ahead = [...history].reverse().find(p => p.carId !== event.carId);
      const gap = ahead ? event.time - ahead.time : Infinity;
      const grants = this.permissions.get(event.carId) || new Map<string, Permission>();
      grants.set(event.detection.id, {
        zones: event.detection.zoneIds, eligible: gap >= 0 && gap < this.gapThresholdSec,
        gapSec: ahead ? gap : null, aheadCarId: ahead ? ahead.carId : null, timeSec: event.time,
      });
      this.permissions.set(event.carId, grants);
      const used = this.usedZones.get(event.carId);
      if (used) for (const zone of event.detection.zoneIds) used.delete(zone);
      history.push({carId: event.carId, time: event.time});
      this.passages.set(event.detection.id, history.filter(p => p.time >= event.time - 2));
    }
  }

  eligible(carId: number, zoneId?: number): boolean {
    return zoneId !== undefined && [...(this.permissions.get(carId)?.values() || [])]
      .some(p => p.eligible && p.zones.includes(zoneId));
  }

  /** [R04] Última medición del coche: la de la detección de esa zona o, sin zona, la más reciente de todas. */
  reading(carId: number, zoneId?: number): DrsReading | null {
    let latestId: string | null = null, latest: Permission | null = null;
    for (const [detectionId, p] of this.permissions.get(carId) ?? []) {
      if (zoneId !== undefined && !p.zones.includes(zoneId)) continue;
      if (!latest || p.timeSec > latest.timeSec) { latest = p; latestId = detectionId; }
    }
    if (!latest || latestId === null) return null;
    const used = this.usedZones.get(carId);
    return {
      detectionId: latestId, zoneIds: latest.zones, eligible: latest.eligible, gapSec: latest.gapSec, aheadCarId: latest.aheadCarId, timeSec: latest.timeSec,
      pendingZoneIds: used ? latest.zones.filter(zone => !used.has(zone)) : latest.zones,
    };
  }
}

/** [R04] Lo que se ve del DRS de un coche. */
export type DrsState = 'sin-permiso' | 'permiso' | 'abierto' | 'bloqueado';
export interface DrsStatus {
  state: DrsState;
  /** Por qué está así, en una frase (rival y hueco medido, bloqueo de Dirección de Carrera, frenada…). */
  reason: string;
  gapSec: number | null;
  aheadCarId: number | null;
  zoneId: number | null;
  detectionId: string | null;
}

const decimal = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

/**
 * Estado visible del DRS a partir de lo que decide el motor: si está abierto, si Dirección de Carrera lo bloquea,
 * lo medido en la detección y si una frenada ya lo cerró en esta zona.
 */
export function drsStatus(input: {
  open: boolean; block: string | null; reading: DrsReading | null; closedByBraking: boolean; thresholdSec: number;
  aheadCode?: string; zoneId?: number;
}): DrsStatus {
  // Fuera de una zona, una medición cuyas zonas ya se han recorrido no dice nada de la siguiente.
  const spent = input.zoneId === undefined && input.reading !== null && input.reading.pendingZoneIds.length === 0;
  const reading = spent ? null : input.reading;
  const base = {
    gapSec: reading?.gapSec ?? null, aheadCarId: reading?.aheadCarId ?? null,
    zoneId: input.zoneId ?? reading?.pendingZoneIds[0] ?? null, detectionId: reading?.detectionId ?? null,
  };
  const measured = reading && reading.gapSec !== null ? `A ${decimal(reading.gapSec, 2)} s de ${input.aheadCode ?? 'el coche de delante'} en la detección` : null;
  if (input.block) return { ...base, state: 'bloqueado', reason: input.block };
  if (input.open) return { ...base, state: 'abierto', reason: measured ?? 'Permiso obtenido en la detección' };
  if (!reading) return { ...base, state: 'sin-permiso', reason: spent ? 'A la espera de la próxima detección' : 'Aún no ha pasado por una detección' };
  if (!reading.eligible) {
    const threshold = String(input.thresholdSec).replace('.', ',');
    return { ...base, state: 'sin-permiso', reason: measured ? `${measured} (hace falta menos de ${threshold} s)` : 'Sin coche delante en la detección' };
  }
  if (input.closedByBraking) return { ...base, state: 'sin-permiso', reason: 'Cerrado en la primera frenada de la zona' };
  return { ...base, state: 'permiso', reason: measured ?? 'Permiso obtenido en la detección' };
}

/** [R04] Tiempo que tarda el flap en pasar de una posición a la otra (T3.10.10: menos de 400 ms). */
export const DRS_FLAP_SECONDS = 0.3;

/**
 * Apertura del flap (0 cerrado, 1 abierto) en el instante `nowSec`, sabiendo cuándo cambió por última vez. Solo es
 * lo que se ve: la resistencia aerodinámica cambia al instante (decisión del usuario).
 */
export function flapOpenness(open: boolean, changedAtSec: number | undefined, nowSec: number): number {
  const target = open ? 1 : 0;
  if (changedAtSec === undefined || nowSec < changedAtSec) return target;
  const progress = Math.min(1, (nowSec - changedAtSec) / DRS_FLAP_SECONDS);
  return open ? progress : 1 - progress;
}
