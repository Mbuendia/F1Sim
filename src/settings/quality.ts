/**
 * [PF4] Calidad gráfica según el dispositivo: tres niveles (alto, medio y bajo), el que recomienda el dispositivo en
 * automático, el que se elige a mano en Ajustes y un vigilante que baja un nivel si los fotogramas caen (nunca sube
 * solo, para no oscilar). Sin three ni React: la carrera 3D (RaceCanvas y RaceScene3D) lo aplica.
 */
export type QualityLevel = 'alto' | 'medio' | 'bajo';
export type QualitySetting = 'auto' | QualityLevel;

export interface QualityProfile {
  /** Tope de la densidad de píxeles del lienzo 3D. */
  pixelRatioMax: number;
  /** Lado del mapa de sombras del sol (0: sin sombras). */
  shadowMapSize: number;
  /** Sombras suaves (PCF suave) o normales. */
  softShadows: boolean;
  /** Suavizado de bordes del lienzo 3D (se aplica al crearlo). */
  antialias: boolean;
  /** Tamaño en pantalla desde el que se pinta el coche completo (PF2); Infinity: nunca. */
  fullCarPx: number;
  /** [PF2.7] Con la cámara de persecución o a bordo, radio (m) alrededor del coche seguido en el que todos van completos. */
  focusRadiusM: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  alto: { pixelRatioMax: 1.5, shadowMapSize: 2048, softShadows: true, antialias: true, fullCarPx: 150, focusRadiusM: 80 },
  medio: { pixelRatioMax: 1.25, shadowMapSize: 1024, softShadows: false, antialias: true, fullCarPx: 250, focusRadiusM: 40 },
  bajo: { pixelRatioMax: 1, shadowMapSize: 0, softShadows: false, antialias: false, fullCarPx: Infinity, focusRadiusM: 0 },
};

export const QUALITY_KEY = 'f1sim.calidad';
export const QUALITY_LABELS: Record<QualitySetting, string> = { auto: 'Automática', alto: 'Alta', medio: 'Media', bajo: 'Baja' };

export interface DeviceInfo { mobile: boolean; deviceMemory?: number; cores?: number }

/** Nivel que recomienda el dispositivo: memoria (GB) y núcleos; sin datos, alto en escritorio y medio en móvil. */
export function recommendedQuality({ mobile, deviceMemory, cores }: DeviceInfo): QualityLevel {
  const tight = (deviceMemory !== undefined && deviceMemory <= 4) || (cores !== undefined && cores <= 4);
  if (mobile) return tight ? 'bajo' : 'medio';
  return tight ? 'medio' : 'alto';
}

export function effectiveQuality(setting: QualitySetting, device: DeviceInfo): QualityLevel {
  return setting === 'auto' ? recommendedQuality(device) : setting;
}

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function readQuality(storage: StorageLike | null | undefined): QualitySetting {
  try {
    const v = storage?.getItem(QUALITY_KEY);
    return v === 'alto' || v === 'medio' || v === 'bajo' ? v : 'auto';
  } catch { return 'auto'; }
}

export function writeQuality(storage: StorageLike | null | undefined, value: QualitySetting): void {
  try { storage?.setItem(QUALITY_KEY, value); } catch { /* sin almacenamiento */ }
}

/** Datos del dispositivo del navegador (memoria y núcleos, si los da; móvil si es táctil y estrecho). */
export function browserDevice(): DeviceInfo {
  if (typeof navigator === 'undefined') return { mobile: false };
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const narrow = typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) < 820;
  return { mobile: coarse && narrow, deviceMemory: nav.deviceMemory, cores: nav.hardwareConcurrency || undefined };
}

/** Segundos de gracia tras empezar o tras un cambio, segundos malos seguidos para bajar y cortes de cada nivel. */
export const GOVERNOR = { graceS: 5, badS: 5, minFps: { alto: 45, medio: 28 } as Record<QualityLevel, number | undefined> };

/**
 * Vigilante de fotogramas: se le da los fps de cada segundo y devuelve el nivel nuevo cuando baja (o null). En manual
 * (`auto: false`) nunca cambia.
 */
export function createQualityGovernor({ start, auto }: { start: QualityLevel; auto: boolean }) {
  let grace = GOVERNOR.graceS, bad = 0;
  const g = {
    level: start,
    second(fps: number): QualityLevel | null {
      if (!auto) return null;
      if (grace > 0) { grace--; return null; }
      const min = GOVERNOR.minFps[g.level];
      if (min === undefined) return null;
      bad = fps < min ? bad + 1 : 0;
      if (bad < GOVERNOR.badS) return null;
      g.level = g.level === 'alto' ? 'medio' : 'bajo';
      bad = 0; grace = GOVERNOR.graceS;
      return g.level;
    },
  };
  return g;
}
