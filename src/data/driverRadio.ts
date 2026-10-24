/**
 * [IA1] Ficha de radio de cada piloto (Sprint 6): carácter, obediencia, formas de llamarlo y voz. Valores iniciales
 * propuestos a partir de su `raceCraft` y su `consistency`; nunca nombres reales (apodos de la afición y de parodia).
 * La obediencia la usará IA3 y la voz IA2; IA1 usa las formas de llamarlo.
 */
import type { Driver } from '../types/f1';
import { DRIVERS } from './drivers';
import { clean } from '../radio/normalize';

export type Temperament = 'frio' | 'competitivo' | 'quejica' | 'bromista';
export interface DriverRadio {
  temperament: Temperament;
  /** 0 (hace lo que quiere) a 1 (obedece siempre). */
  obedience: number;
  /** Apodos además del nombre, el apellido, las siglas y el dorsal. */
  nicknames: string[];
  voice: { pitch: number; rate: number };
}

export const DRIVER_RADIO: Record<string, DriverRadio> = {
  verstappen: { temperament: 'competitivo', obedience: 0.45, nicknames: ['supermax', 'mad max'], voice: { pitch: 0.95, rate: 1.05 } },
  lawson: { temperament: 'competitivo', obedience: 0.7, nicknames: [], voice: { pitch: 1.0, rate: 1.05 } },
  norris: { temperament: 'bromista', obedience: 0.8, nicknames: ['landito'], voice: { pitch: 1.05, rate: 1.08 } },
  piastri: { temperament: 'frio', obedience: 0.85, nicknames: ['oscarito'], voice: { pitch: 0.97, rate: 0.98 } },
  hamilton: { temperament: 'frio', obedience: 0.75, nicknames: ['sir'], voice: { pitch: 0.96, rate: 1.0 } },
  leclerc: { temperament: 'quejica', obedience: 0.65, nicknames: ['charlie'], voice: { pitch: 1.04, rate: 1.06 } },
  russell: { temperament: 'frio', obedience: 0.8, nicknames: [], voice: { pitch: 0.98, rate: 1.0 } },
  antonelli: { temperament: 'bromista', obedience: 0.85, nicknames: ['kimito'], voice: { pitch: 1.08, rate: 1.1 } },
  alonso: { temperament: 'competitivo', obedience: 0.5, nicknames: ['fer', 'nano', 'magic'], voice: { pitch: 0.92, rate: 1.04 } },
  stroll: { temperament: 'quejica', obedience: 0.8, nicknames: ['lancito'], voice: { pitch: 1.0, rate: 0.97 } },
  gasly: { temperament: 'bromista', obedience: 0.7, nicknames: ['pierrot'], voice: { pitch: 1.02, rate: 1.05 } },
  doohan: { temperament: 'quejica', obedience: 0.9, nicknames: [], voice: { pitch: 1.05, rate: 1.02 } },
  sainz: { temperament: 'competitivo', obedience: 0.6, nicknames: ['chili'], voice: { pitch: 0.97, rate: 1.06 } },
  albon: { temperament: 'bromista', obedience: 0.85, nicknames: [], voice: { pitch: 1.0, rate: 1.0 } },
  tsunoda: { temperament: 'quejica', obedience: 0.6, nicknames: ['yukito'], voice: { pitch: 1.1, rate: 1.1 } },
  hadjar: { temperament: 'competitivo', obedience: 0.75, nicknames: [], voice: { pitch: 1.06, rate: 1.06 } },
  hulkenberg: { temperament: 'frio', obedience: 0.8, nicknames: ['hulk'], voice: { pitch: 0.9, rate: 0.96 } },
  bortoleto: { temperament: 'frio', obedience: 0.85, nicknames: [], voice: { pitch: 1.04, rate: 1.0 } },
  ocon: { temperament: 'quejica', obedience: 0.55, nicknames: [], voice: { pitch: 1.0, rate: 1.03 } },
  bearman: { temperament: 'bromista', obedience: 0.85, nicknames: ['ollie'], voice: { pitch: 1.07, rate: 1.04 } },
};

/** Ficha de un piloto que no está en la lista (mercado, academia): valores neutros. */
export const DEFAULT_DRIVER_RADIO: DriverRadio = { temperament: 'frio', obedience: 0.75, nicknames: [], voice: { pitch: 1.0, rate: 1.0 } };

export function driverRadio(driverId: string): DriverRadio {
  return DRIVER_RADIO[driverId] ?? DEFAULT_DRIVER_RADIO;
}

/** Formas de llamar a un piloto, normalizadas: nombre, apellido de parodia, siglas, dorsal y apodos. */
export function radioNames(driver: Pick<Driver, 'id' | 'firstName' | 'lastName' | 'code' | 'number'>): string[] {
  const forms = [driver.firstName, driver.lastName, driver.code, String(driver.number), ...driverRadio(driver.id).nicknames];
  return [...new Set(forms.map(f => clean(f)).filter(Boolean))];
}

/** Formas de llamar a cualquier piloto del juego por su identificador. */
export function radioNamesById(driverId: string): string[] {
  const d = DRIVERS[driverId];
  return d ? radioNames(d) : [];
}
