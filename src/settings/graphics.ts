/**
 * [UX2] Preferencias gráficas guardadas en el dispositivo. Por ahora, la vista de la carrera: en 3D (por defecto, si el
 * navegador tiene WebGL) o en 2D desde arriba, que pesa menos (antes solo se elegía con `?2d` en la dirección).
 */
export type RaceView = '3d' | '2d';
export const RACE_VIEW_KEY = 'f1sim.vista';

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function readRaceView(storage: StorageLike | null | undefined): RaceView {
  try { return storage?.getItem(RACE_VIEW_KEY) === '2d' ? '2d' : '3d'; } catch { return '3d'; }
}

export function writeRaceView(storage: StorageLike | null | undefined, view: RaceView): void {
  try { storage?.setItem(RACE_VIEW_KEY, view); } catch { /* sin almacenamiento */ }
}

export function browserSettingsStorage(): StorageLike | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
