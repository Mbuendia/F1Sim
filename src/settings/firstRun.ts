// [MJ10, 20/11/2026] Primera configuración: la primera vez que se entra al juego (tras la portada) se eligen los gráficos y la
// radio. Se guarda en las mismas claves que Ajustes; «Omitir» deja lo recomendado y la radio básica. No vuelve a salir.
import { writeRaceView, type RaceView } from './graphics';
import { recommendedQuality, writeQuality, type DeviceInfo, type QualitySetting } from './quality';
import type { RadioMode } from '../radio/model/storage';

/** La clave del modo de la radio (la de `radio/model/storage`, que no se importa aquí: el código de la radio solo entra con import(), IA4). */
const RADIO_MODE_KEY = 'f1_radio_mode';

export const FIRST_RUN_KEY = 'f1sim.primeraConfiguracion';

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function isFirstRunDone(storage: StorageLike | null | undefined): boolean {
  try { return storage ? storage.getItem(FIRST_RUN_KEY) !== null : true; } catch { return true; }
}

export interface FirstRunChoice { view: RaceView; quality: QualitySetting; radio: RadioMode }

/** Lo recomendado para el dispositivo: 3D salvo en los más justos (2D, más ligera), calidad automática y radio básica. */
export function recommendedFirstRun(device: DeviceInfo): FirstRunChoice {
  return { view: recommendedQuality(device) === 'bajo' ? '2d' : '3d', quality: 'auto', radio: 'basica' };
}

/** Guarda lo elegido (o lo recomendado, al omitir) y marca la primera configuración como hecha. */
export function finishFirstRun(storage: StorageLike | null | undefined, choice: FirstRunChoice, how: 'hecha' | 'omitida'): void {
  writeRaceView(storage, choice.view);
  writeQuality(storage, choice.quality);
  try { storage?.setItem(RADIO_MODE_KEY, choice.radio); } catch { /* sin almacenamiento */ }
  try { storage?.setItem(FIRST_RUN_KEY, how); } catch { /* sin almacenamiento */ }
}
