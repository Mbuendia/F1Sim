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
    { startT: 0.02, endT: 0.10, side: 'both', surface: 'asphalt', widthMultiplier: 2.0 },

    // T4 Repsol — grava profunda exterior
    { startT: 0.16, endT: 0.22, side: 'right', surface: 'gravel', widthMultiplier: 1.8 },

    // T5 Seat — grava profunda en la chicana lenta
    { startT: 0.24, endT: 0.30, side: 'both', surface: 'gravel', widthMultiplier: 1.6 },

    // T7/T8 — escapatoria moderada de asfalto
    { startT: 0.35, endT: 0.42, side: 'right', surface: 'asphalt', widthMultiplier: 1.3 },

    // T9 — contrarrecta: escapatoria de asfalto
    { startT: 0.44, endT: 0.48, side: 'left', surface: 'asphalt', widthMultiplier: 1.4 },

    // T10 La Caixa — grava profunda (frenada severa)
    { startT: 0.50, endT: 0.56, side: 'both', surface: 'gravel', widthMultiplier: 2.0 },

    // T12/T13 — grava moderada en la chicana
    { startT: 0.62, endT: 0.70, side: 'both', surface: 'gravel', widthMultiplier: 1.2 },

    // T14/T15 — escapatoria de asfalto en la curva de enlace
    { startT: 0.74, endT: 0.82, side: 'right', surface: 'asphalt', widthMultiplier: 1.5 },

    // T16 (Última curva) — el lado del muro tiene barrera, el otro lado tiene asfalto
    { startT: 0.85, endT: 0.92, side: 'left', surface: 'asphalt', widthMultiplier: 1.4 },
  ],

  // ── PIANOS LOCALIZADOS EN CURVAS ──
  // Solo en entradas, ápices y salidas — nunca en rectas
  kerbs: [
    // T1 entrada/salida
    { startT: 0.02, endT: 0.06, side: 'both', style: 'standard' },
    // T3 gran arco peraltado
    { startT: 0.10, endT: 0.14, side: 'both', style: 'standard' },
    // T4 Repsol
    { startT: 0.17, endT: 0.21, side: 'both', style: 'standard' },
    // T5 Seat (chicana lenta)
    { startT: 0.25, endT: 0.29, side: 'both', style: 'sausage' },
    // T7/T8
    { startT: 0.36, endT: 0.41, side: 'both', style: 'standard' },
    // T9
    { startT: 0.44, endT: 0.47, side: 'left', style: 'standard' },
    // T10 La Caixa
    { startT: 0.51, endT: 0.55, side: 'both', style: 'standard' },
    // T12 chicana
    { startT: 0.63, endT: 0.66, side: 'both', style: 'sausage' },
    // T13
    { startT: 0.67, endT: 0.70, side: 'both', style: 'standard' },
    // T14/T15
    { startT: 0.75, endT: 0.80, side: 'right', style: 'standard' },
    // T16 última curva
    { startT: 0.86, endT: 0.91, side: 'both', style: 'standard' },
  ],

  // ── BARRERAS ──
  barriers: [
    // T16 — muro de campeones (barrera de hormigón a pie de pista)
    { startT: 0.86, endT: 0.92, side: 'right', type: 'concrete', color: '#8a8a8a' },
  ],
};
