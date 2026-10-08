// [R47] Vuelta de referencia por circuito y calibración del trazado para acercar el ritmo del motor al real.
//
// `referenceLapSec` es la vuelta rápida de carrera aproximada de 2024 (en seco), anotada de memoria como referencia de
// CALIBRACIÓN del juego: no es un dato verificado contra una fuente del repositorio. `curvatureGain` convierte la
// curvatura del trazado SVG (en unidades de mundo, sin escala real) en severidad de curva; se resuelve por circuito con
// `node scripts/calibrate-laps.mjs` para que la vuelta de referencia del motor coincida con `referenceLapSec`.

export const LAP_REFERENCE_PROVENANCE = 'calibrado';
export const LAP_REFERENCE_NOTE = 'Vuelta rápida de carrera aproximada de 2024, anotada de memoria como calibración del juego: no verificada contra una fuente del repositorio.';

export interface LapReference {
  referenceLapSec: number;
  curvatureGain: number;
}

/** Ganancia de curvatura anterior a R47 (igual para todos los circuitos). */
export const DEFAULT_CURVATURE_GAIN = 55;
/** Distancia antes del vértice de una curva lenta en la que la velocidad objetivo empieza a bajar (m). */
export const BRAKE_LOOKAHEAD_M = 150;

export const LAP_REFERENCES: Record<string, LapReference> = {
  barcelona: { referenceLapSec: 77.1, curvatureGain: 34.27 },
  monza: { referenceLapSec: 81.4, curvatureGain: 18.14 },
  silverstone: { referenceLapSec: 88.3, curvatureGain: 21.71 },
  spa: { referenceLapSec: 104.7, curvatureGain: 19.05 },
  monaco: { referenceLapSec: 74.2, curvatureGain: 27.42 },
  spielberg: { referenceLapSec: 67.7, curvatureGain: 35.81 },
  interlagos: { referenceLapSec: 72.5, curvatureGain: 35.36 },
  suzuka: { referenceLapSec: 93.7, curvatureGain: 38.93 },
  zandvoort: { referenceLapSec: 73.8, curvatureGain: 44.71 },
  'las-vegas': { referenceLapSec: 94.9, curvatureGain: 34.7 },
  bahrain: { referenceLapSec: 92.6, curvatureGain: 50.79 },
  baku: { referenceLapSec: 105.3, curvatureGain: 26.4 },
  melbourne: { referenceLapSec: 79.8, curvatureGain: 20.62 },
  miami: { referenceLapSec: 90.6, curvatureGain: 43.97 },
  shanghai: { referenceLapSec: 97.8, curvatureGain: 38.72 },
  jeddah: { referenceLapSec: 91.6, curvatureGain: 27.47 },
  'marina-bay': { referenceLapSec: 94.5, curvatureGain: 42.8 },
  lusail: { referenceLapSec: 82.4, curvatureGain: 38.6 },
  'yas-marina': { referenceLapSec: 85.6, curvatureGain: 22.09 },
  hungaroring: { referenceLapSec: 80.3, curvatureGain: 32.44 },
  'mexico-city': { referenceLapSec: 78.3, curvatureGain: 33.92 },
  montreal: { referenceLapSec: 74.9, curvatureGain: 17.25 },
  austin: { referenceLapSec: 97.3, curvatureGain: 25.99 },
};
