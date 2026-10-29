// [R47] Vuelta de referencia por circuito y calibración del trazado para acercar el ritmo del motor al real.
//
// `referenceLapSec` es la vuelta rápida de carrera de 2025 en cada circuito, tomada de los resultados oficiales
// (formula1.com, «Fastest laps» de cada Gran Premio de 2025; consultado el 13/10/2026). `curvatureGain` es la severidad de las curvas del circuito (agarre disponible; ver `cornerSpeedKmh` en `svgTrackParser.ts`): convierte la
// curvatura del eje (1/m, a escala real desde el Sprint 4.5) en severidad de curva; se resuelve por circuito con
// `node scripts/calibrate-laps.mjs` para que la vuelta de referencia del motor coincida con `referenceLapSec`.

export const LAP_REFERENCE_PROVENANCE = 'oficial';
export const LAP_REFERENCE_NOTE = 'Vuelta rápida de carrera de 2025 según los resultados oficiales de formula1.com; la ganancia de curvatura es calibración del juego.';

export interface LapReference {
  referenceLapSec: number;
  curvatureGain: number;
}

/** Ganancia de curvatura anterior a R47 (igual para todos los circuitos). */
export const DEFAULT_CURVATURE_GAIN = 55;
/** Distancia antes del vértice de una curva lenta en la que la velocidad objetivo empieza a bajar (m). */
export const BRAKE_LOOKAHEAD_M = 150;

export const LAP_REFERENCES: Record<string, LapReference> = {
  barcelona: { referenceLapSec: 75.743, curvatureGain: 9.66 },
  monza: { referenceLapSec: 80.901, curvatureGain: 6.73 },
  silverstone: { referenceLapSec: 89.337, curvatureGain: 7.47 },
  spa: { referenceLapSec: 104.861, curvatureGain: 7.47 },
  monaco: { referenceLapSec: 73.221, curvatureGain: 6.84 },
  spielberg: { referenceLapSec: 67.924, curvatureGain: 9.08 },
  interlagos: { referenceLapSec: 72.4, curvatureGain: 7.96 },
  suzuka: { referenceLapSec: 90.965, curvatureGain: 9.06 },
  zandvoort: { referenceLapSec: 72.271, curvatureGain: 7.11 },
  'las-vegas': { referenceLapSec: 93.365, curvatureGain: 8.2 },
  bahrain: { referenceLapSec: 95.14, curvatureGain: 9.37 },
  baku: { referenceLapSec: 103.388, curvatureGain: 17.17 },
  melbourne: { referenceLapSec: 82.167, curvatureGain: 5.86 },
  miami: { referenceLapSec: 89.746, curvatureGain: 7.77 },
  shanghai: { referenceLapSec: 95.454, curvatureGain: 8.79 },
  jeddah: { referenceLapSec: 91.778, curvatureGain: 9.54 },
  'marina-bay': { referenceLapSec: 93.808, curvatureGain: 7.43 },
  lusail: { referenceLapSec: 82.996, curvatureGain: 8.27 },
  'yas-marina': { referenceLapSec: 86.725, curvatureGain: 5.59 },
  hungaroring: { referenceLapSec: 79.409, curvatureGain: 9.15 },
  'mexico-city': { referenceLapSec: 80.052, curvatureGain: 7.02 },
  montreal: { referenceLapSec: 74.119, curvatureGain: 6.93 },
  austin: { referenceLapSec: 97.577, curvatureGain: 6.55 },
};
