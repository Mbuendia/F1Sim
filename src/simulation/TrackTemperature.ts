/**
 * [VS3, 13/11/2026] Temperatura del asfalto por circuito y hora. Hasta ahora todos los circuitos salían a 38,5 °C; cada
 * uno tiene ahora la suya, baja según avanza la tarde (o la noche) y con el agua en pista, y calienta o enfría los
 * neumáticos (TireModel). Lo que aquí se calcula es la diferencia con aquella temperatura de siempre: a diferencia cero,
 * la carrera es exactamente la de antes.
 */

/** Temperatura de referencia: la que tenían todos los circuitos antes de VS3 (°C). */
export const TRACK_TEMP_REFERENCE_C = 38.5;

/** Temperatura típica del asfalto a la hora de la salida (°C): calibración del juego, no tabla oficial. */
export const TRACK_TEMP_START_C: Record<string, number> = {
  barcelona: 44, monza: 42, silverstone: 34, spa: 28, monaco: 43, spielberg: 40, interlagos: 40, suzuka: 34, zandvoort: 30,
  'las-vegas': 18, bahrain: 30, baku: 44, melbourne: 36, miami: 48, shanghai: 34, jeddah: 31, 'marina-bay': 33, lusail: 34,
  'yas-marina': 33, hungaroring: 50, 'mexico-city': 44, montreal: 38, austin: 40,
};

/** Carreras de noche: el asfalto ya ha soltado el calor del día y se enfría más despacio. */
const NIGHT = new Set(['las-vegas', 'bahrain', 'jeddah', 'marina-bay', 'lusail', 'yas-marina']);
const COOLING_PER_HOUR_C = { day: 2.5, night: 1.5 };
/** Lo que enfría el agua en pista: 5 °C por milímetro de media, hasta 8 °C. */
const WATER_COOLING_PER_MM_C = 5, WATER_COOLING_MAX_C = 8;

/** Para los tests: con `forceReference`, todos los circuitos vuelven a la temperatura de antes de VS3. */
export const trackTempConfig = { forceReference: false };

export const trackTempStart = (circuitId: string): number => TRACK_TEMP_START_C[circuitId] ?? TRACK_TEMP_REFERENCE_C;

/** Diferencia (°C) con la temperatura de referencia en este instante de la carrera. */
export function trackTempOffset(circuitId: string, raceTimeSec: number, meanWaterMm: number): number {
  if (trackTempConfig.forceReference) return 0;
  const hours = Math.max(0, raceTimeSec || 0) / 3600;
  const cooling = COOLING_PER_HOUR_C[NIGHT.has(circuitId) ? 'night' : 'day'] * hours;
  const water = Math.min(WATER_COOLING_MAX_C, Math.max(0, meanWaterMm || 0) * WATER_COOLING_PER_MM_C);
  return Math.round((trackTempStart(circuitId) - TRACK_TEMP_REFERENCE_C - cooling - water) * 100) / 100;
}

export type TrackTempBand = 'fria' | 'normal' | 'caliente';
export const TRACK_TEMP_COLD_C = 30, TRACK_TEMP_HOT_C = 45;
export const trackTempBand = (tempC: number): TrackTempBand => (tempC < TRACK_TEMP_COLD_C ? 'fria' : tempC > TRACK_TEMP_HOT_C ? 'caliente' : 'normal');

/** Lo que le dice al jugador cada franja: qué les pasa a sus neumáticos. */
export const TRACK_TEMP_HINT: Record<TrackTempBand, { label: string; effect: string }> = {
  fria: { label: 'Pista fría', effect: 'A los duros les cuesta coger temperatura' },
  normal: { label: 'Pista normal', effect: 'Los neumáticos trabajan en su ventana' },
  caliente: { label: 'Pista caliente', effect: 'Los blandos se pasan de temperatura y duran menos' },
};
