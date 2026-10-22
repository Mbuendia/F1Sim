/**
 * [IA4] Preferencias de la radio en el navegador (como el audio) y comprobaciones de espacio. Todo con try/catch: en
 * una ventana privada o con el almacenamiento bloqueado, radio básica y sin errores.
 */
export const RADIO_MODE_KEY = 'f1_radio_mode';
export const RADIO_VOICE_KEY = 'f1_radio_voice';
export type RadioMode = 'basica' | 'ia';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | undefined;

export function readRadioMode(storage: StorageLike): RadioMode {
  try { return storage?.getItem(RADIO_MODE_KEY) === 'ia' ? 'ia' : 'basica'; } catch { return 'basica'; }
}
export function writeRadioMode(storage: StorageLike, mode: RadioMode): void {
  try { storage?.setItem(RADIO_MODE_KEY, mode); } catch { /* sin almacenamiento */ }
}
export function browserStorage(): StorageLike {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/** Margen sobre el tamaño del modelo que tiene que quedar libre antes de descargar. */
export const SPACE_MARGIN = 1.2;
const MB = 1024 * 1024;

/** ¿Cabe `needBytes` (más un 20 %)? Si no, cuántos MB faltan. */
export function spaceCheck(estimate: { quota?: number; usage?: number }, needBytes: number): { ok: boolean; missingMB: number } {
  const free = Math.max(0, (estimate.quota ?? 0) - (estimate.usage ?? 0));
  const missing = needBytes * SPACE_MARGIN - free;
  return missing <= 0 ? { ok: true, missingMB: 0 } : { ok: false, missingMB: Math.ceil(missing / MB) };
}

/** Pide al navegador que no borre el modelo (solo tras una descarga completa). */
export async function persistStorage(): Promise<boolean> {
  try {
    const storage = (globalThis as unknown as { navigator?: { storage?: { persist?: () => Promise<boolean> } } }).navigator?.storage;
    return (await storage?.persist?.()) ?? false;
  } catch { return false; }
}
