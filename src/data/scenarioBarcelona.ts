import type { CircuitScenario } from './scenarioTypes';

/**
 * Escenario de Barcelona (Circuit de Barcelona-Catalunya)
 * Arquetipo: CIRCUITO PERMANENTE
 *
 * Características reales:
 * - Escapatorias amplias de asfalto en T1/T2 (alta velocidad)
 * - Lechos de grava profundos en T4, T5, T10 (zonas de frenada severa)
 * - Hierba perimetral exterior como base
 * - Pianos rojos/blancos solo en entradas, ápices y salidas de curvas
 * - Muro de campeones en T16 (barrera a pie de pista)
 *
 * APPROX: calibrated artwork, not FIA-sourced
 * Los valores de t son aproximaciones calibradas contra los corners generados
 * por svgTrackParser para catalunya-6.svg con startOffsetT=0.12.
 */
export const barcelonaScenario: CircuitScenario = {
  trackType: 'permanent',
  backgroundColor: '#181e1a',  // Hierba verde oscura perimetral
  defaultRunoffSurface: 'gravel',
  hasGravelGlobal: true,

  // ── ESCAPATORIAS LOCALIZADAS ──
  runoffZones: [
    // T1 Elf / T2 — amplia escapatoria de asfalto (alta velocidad, frenada de ~300km/h)
    { startT: 0.086, endT: 0.166, side: 'both', surface: 'asphalt', widthMultiplier: 2.0 },

    // T4 Repsol — grava profunda exterior
    { startT: 0.226, endT: 0.286, side: 'right', surface: 'gravel', widthMultiplier: 1.8 },

    // T5 Seat — grava profunda en la chicana lenta
    { startT: 0.306, endT: 0.366, side: 'both', surface: 'gravel', widthMultiplier: 1.6 },

    // T7/T8 — escapatoria moderada de asfalto
    { startT: 0.416, endT: 0.486, side: 'right', surface: 'asphalt', widthMultiplier: 1.3 },

    // T9 — contrarrecta: escapatoria de asfalto
    { startT: 0.506, endT: 0.546, side: 'left', surface: 'asphalt', widthMultiplier: 1.4 },

    // T10 La Caixa — grava profunda (frenada severa)
    { startT: 0.566, endT: 0.626, side: 'both', surface: 'gravel', widthMultiplier: 2.0 },

    // T12/T13 — grava moderada en la chicana
    { startT: 0.686, endT: 0.766, side: 'both', surface: 'gravel', widthMultiplier: 1.2 },

    // T14/T15 — escapatoria de asfalto en la curva de enlace
    { startT: 0.806, endT: 0.886, side: 'right', surface: 'asphalt', widthMultiplier: 1.5 },

    // T16 (Última curva) — el lado del muro tiene barrera, el otro lado tiene asfalto
    { startT: 0.916, endT: 0.986, side: 'left', surface: 'asphalt', widthMultiplier: 1.4 },
  ],

  // ── PIANOS LOCALIZADOS EN CURVAS ──
  // Solo en entradas, ápices y salidas — nunca en rectas
  kerbs: [
    // T1 entrada/salida
    { startT: 0.086, endT: 0.126, side: 'both', style: 'standard' },
    // T3 gran arco peraltado
    { startT: 0.166, endT: 0.206, side: 'both', style: 'standard' },
    // T4 Repsol
    { startT: 0.236, endT: 0.276, side: 'both', style: 'standard' },
    // T5 Seat (chicana lenta)
    { startT: 0.316, endT: 0.356, side: 'both', style: 'sausage' },
    // T7/T8
    { startT: 0.426, endT: 0.476, side: 'both', style: 'standard' },
    // T9
    { startT: 0.506, endT: 0.536, side: 'left', style: 'standard' },
    // T10 La Caixa
    { startT: 0.576, endT: 0.616, side: 'both', style: 'standard' },
    // T12 chicana
    { startT: 0.696, endT: 0.726, side: 'both', style: 'sausage' },
    // T13
    { startT: 0.736, endT: 0.766, side: 'both', style: 'standard' },
    // T14/T15
    { startT: 0.816, endT: 0.866, side: 'right', style: 'standard' },
    // T16 última curva
    { startT: 0.926, endT: 0.976, side: 'both', style: 'standard' },
  ],

  // ── BARRERAS ──
  barriers: [
    // T16 — muro de campeones (barrera de hormigón a pie de pista)
    { startT: 0.926, endT: 0.986, side: 'right', type: 'concrete', color: '#8a8a8a' },
  ],
};
