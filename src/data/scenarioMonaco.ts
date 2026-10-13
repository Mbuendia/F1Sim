import type { CircuitScenario } from './scenarioTypes';

/**
 * Escenario de Mónaco (Circuit de Monaco)
 * Arquetipo: CIRCUITO URBANO
 *
 * Características reales:
 * - Sin escapatorias de grava ni hierba en todo el circuito
 * - Barreras armco y muros de hormigón delimitando la pista a ambos lados
 * - Pianos mínimos, solo en chicanes principales (Sainte Dévote, Piscine)
 * - Fondo urbano gris oscuro (asfalto de ciudad, no hierba)
 * - Túnel de Mónaco con paredes de hormigón reforzado
 * - Puerto de Hércules como referencia geográfica
 *
 * APPROX: calibrated artwork, not FIA-sourced
 * Los valores de t son aproximaciones calibradas contra los corners generados
 * por svgTrackParser para monaco-6.svg con startOffsetT=0.6.
 */
export const monacoScenario: CircuitScenario = {
  trackType: 'street',
  backgroundColor: '#1a1d24',   // Asfalto urbano gris oscuro (no hierba)
  defaultRunoffSurface: 'wall',
  hasGravelGlobal: false,       // ¡CERO grava en Mónaco!

  // ── ESCAPATORIAS: NO HAY ──
  // Mónaco no tiene escapatorias de grava ni asfalto; la pista está delimitada por muros
  runoffZones: [],

  // ── PIANOS LOCALIZADOS (MÍNIMOS) ──
  // Solo en las chicanes principales
  kerbs: [
    // Sainte Dévote (T1) — piano de entrada
    { startT: 0.3435, endT: 0.3835, side: 'both', style: 'flat' },
    // Massenet / Casino (T3/T4)
    { startT: 0.4435, endT: 0.4835, side: 'right', style: 'flat' },
    // Grand Hotel Hairpin (T6) — horquilla
    { startT: 0.5435, endT: 0.5835, side: 'both', style: 'flat' },
    // Chicane de la Piscine (T12/T13)
    { startT: 0.8835, endT: 0.9535, side: 'both', style: 'sausage' },
    // La Rascasse (T17)
    { startT: 0.1435, endT: 0.1835, side: 'both', style: 'flat' },
    // Anthony Noghes (T19 — última curva)
    { startT: 0.2235, endT: 0.2635, side: 'both', style: 'flat' },
  ],

  // ── BARRERAS ARMCO Y MUROS DE HORMIGÓN ──
  // Ambos lados en todo el circuito: esto es lo que define un circuito urbano
  barriers: [
    // Tramo completo lado izquierdo — armco continuo
    { startT: 0.3035, endT: 0.8035, side: 'left', type: 'armco', color: '#b0b8c4' },
    { startT: 0.8035, endT: 1, side: 'left', type: 'armco', color: '#b0b8c4' },
    { startT: 0, endT: 0.3035, side: 'left', type: 'armco', color: '#b0b8c4' },

    // Tramo completo lado derecho — armco continuo
    { startT: 0.3035, endT: 0.8035, side: 'right', type: 'armco', color: '#b0b8c4' },
    { startT: 0.8035, endT: 1, side: 'right', type: 'armco', color: '#b0b8c4' },
    { startT: 0, endT: 0.3035, side: 'right', type: 'armco', color: '#b0b8c4' },

    // Túnel de Mónaco — muros de hormigón reforzado (más oscuro y grueso)
    { startT: 0.6035, endT: 0.7235, side: 'both', type: 'concrete', color: '#6b7280' },

    // Sainte Dévote — muro de hormigón en el interior
    { startT: 0.3235, endT: 0.3835, side: 'left', type: 'concrete', color: '#6b7280' },

    // Tabac / Piscine — hormigón reforzado
    { startT: 0.8235, endT: 0.9835, side: 'both', type: 'concrete', color: '#6b7280' },
  ],
};
