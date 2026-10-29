/**
 * [UX3] Modo desarrollador oculto. Apagado por defecto; se enciende con 7 toques seguidos (en menos de 4 s) en el número
 * de versión de Ajustes, se recuerda en el dispositivo y se puede apagar. Reúne las herramientas de revisión que antes
 * solo existían en desarrollo (`?revision=…`), las pruebas de carrera (Safety Car, bandera roja, tiempo) y el contador
 * de rendimiento. Este módulo es pequeño: las herramientas se cargan aparte, con import().
 */
import { drawWeatherScenario, type WeatherScenarioId } from '../data/weatherScenarios';

export const DEV_MODE_KEY = 'f1sim.desarrollador';
export const DEV_TAPS = 7;
export const DEV_TAP_WINDOW_MS = 4000;

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }

export function isDevMode(storage: StorageLike | null | undefined): boolean {
  try { return storage?.getItem(DEV_MODE_KEY) === '1'; } catch { return false; }
}

export function setDevMode(storage: StorageLike | null | undefined, on: boolean): void {
  try {
    if (on) storage?.setItem(DEV_MODE_KEY, '1');
    else if (storage?.removeItem) storage.removeItem(DEV_MODE_KEY);
    else storage?.setItem(DEV_MODE_KEY, '0');
  } catch { /* sin almacenamiento */ }
}

/** Cuenta toques: el séptimo en menos de 4 s enciende el modo. Devuelve `true` en el toque que lo enciende. */
export function createDevTapCounter({ storage, now = () => Date.now(), taps = DEV_TAPS, windowMs = DEV_TAP_WINDOW_MS }: {
  storage: StorageLike | null | undefined; now?: () => number; taps?: number; windowMs?: number;
}) {
  let times: number[] = [];
  return {
    tap(): boolean {
      if (isDevMode(storage)) return false;
      const t = now();
      times = [...times, t].filter(x => t - x <= windowMs);
      if (times.length < taps) return false;
      times = [];
      setDevMode(storage, true);
      return true;
    },
    /** Toques que faltan (para el aviso «a 3 toques…»). */
    remaining: () => Math.max(0, taps - times.length),
  };
}

export interface DevTool { id: string; label: string; description: string; query: string }

/** Herramientas del modo desarrollador: cada una se abre con su dirección (`?revision=…` o `?rendimiento`). */
export const DEV_TOOLS: DevTool[] = [
  { id: 'circuitos', label: 'Circuitos', description: 'Revisión de los 23 trazados y su geometría', query: '?revision=circuitos' },
  { id: 'sala', label: 'Salas', description: 'Pantallas de sala con datos simulados', query: '?revision=sala' },
  { id: 'radio', label: 'Ajustes de la radio', description: 'Todos los estados de la descarga con una tienda falsa', query: '?revision=radio' },
  { id: 'radio-eval', label: 'Evaluación de la radio', description: 'Mide el modelo de la radio en este dispositivo', query: '?revision=radio-eval' },
  { id: 'respuestas', label: 'Respuestas de los pilotos', description: 'Muestra del banco de respuestas para marcar las malas', query: '?revision=respuestas' },
  { id: 'puente', label: 'Escena 3D', description: 'Coches colocados y cámara libre (puente de Suzuka)', query: '?revision=puente' },
  { id: 'rendimiento', label: 'Contador de rendimiento', description: 'Fotogramas por segundo y coste de cada fotograma, encima del juego', query: '?rendimiento' },
];

/** Las herramientas se abren en desarrollo o con el modo encendido; a un jugador normal, nunca. */
export function devToolsAllowed({ dev, storage }: { dev: boolean; storage: StorageLike | null | undefined }): boolean {
  return dev || isDevMode(storage);
}

/**
 * Tiempo de una carrera libre: con el modo encendido, el elegido; sin él, se sortea con la probabilidad de lluvia del
 * circuito, como en la temporada (el tiempo es una herramienta de prueba).
 */
export function freeRaceWeather({ devMode, chosen, rainProbabilityPercent, seed }: {
  devMode: boolean; chosen: WeatherScenarioId | string; rainProbabilityPercent: number; seed: number;
}): WeatherScenarioId | string {
  return devMode ? chosen : drawWeatherScenario(rainProbabilityPercent, seed);
}

export function browserDevStorage(): StorageLike | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
