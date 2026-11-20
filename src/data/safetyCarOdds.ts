/**
 * [ES4, 20/11/2026] Probabilidad real de Safety Car y de coche de seguridad virtual (VSC) en cada circuito: el porcentaje
 * de carreras recientes con al menos uno. Fuente: las previas «Need to know» de formula1.com (temporada 2026 donde la
 * hay; 2025 en Baréin, Yeda, Lusail y Yas Marina), que dan las dos cifras y de cuántas carreras salen. Sustituye al 45 %
 * de relleno que tenían los 23 circuitos.
 */
export interface SafetyCarOdds {
  /** Carreras con Safety Car (%). */
  sc: number;
  /** Carreras con VSC (%). */
  vsc: number;
  /** De cuántas carreras sale (null si la previa no lo dice). */
  races: number | null;
  /** Previa de formula1.com de la que sale. */
  source: string;
}

const PREVIAS = 'https://www.formula1.com/en/latest/article/';

export const SAFETY_CAR_ODDS: Record<string, SafetyCarOdds> = {
  barcelona: { sc: 50, vsc: 13, races: 8, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-barcelona-catalunya-grand-prix.51RmTAVS0jveoGWnBr9Ul` },
  monza: { sc: 50, vsc: 38, races: 8, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-italian-grand-prix.3R2slU8oSHdeOc5lidJDGy` },
  silverstone: { sc: 78, vsc: 22, races: 9, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-british-grand-prix.6zB1eKpKSqJjdYtLxye7eG` },
  spa: { sc: 50, vsc: 0, races: 8, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-belgian-grand-prix.79EYKMXkm1MLXnciMgrPyY` },
  monaco: { sc: 29, vsc: 43, races: 7, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-monaco-grand-prix.1dphiN7qz6fiI4sm4MaC4V` },
  spielberg: { sc: 50, vsc: 40, races: 10, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-austrian-grand-prix.5c3It3dAheBaaNuzedrXPx` },
  interlagos: { sc: 86, vsc: 57, races: 7, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-sao-paulo-grand-prix.3w1LZutz0yrGfP2Iz38vd8` },
  suzuka: { sc: 50, vsc: 33, races: 6, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-japanese-grand-prix.59xoCL07qjNCWPVzBJOmK2` },
  zandvoort: { sc: 60, vsc: 60, races: 5, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-dutch-grand-prix.7rXg1scAXG5IMsHc9k74g4` },
  'las-vegas': { sc: 33, vsc: 67, races: 3, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-las-vegas-grand-prix.6ynxQ4e9Z7F1o2Uijhh1FK` },
  bahrain: { sc: 63, vsc: 50, races: 8, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2025-bahrain-grand-prix.2UBRH78pLhBrYbZoChAvHZ` },
  baku: { sc: 67, vsc: 50, races: 6, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-azerbaijan-grand-prix.3PkKCxoeboOkSc18pCB2z` },
  melbourne: { sc: 67, vsc: 67, races: 6, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026.7gyyqNLcwuCPZdXvgGwhCM` },
  miami: { sc: 50, vsc: 75, races: 4, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-miami-grand-prix.6CaXXUBmgXIxzTWv26Qc6b` },
  shanghai: { sc: 50, vsc: 50, races: 4, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-chinese-grand-prix.2KbEu5okNlIMtVgklEpGJT` },
  jeddah: { sc: 100, vsc: 50, races: null, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2025-saudi-arabian-grand-prix.6A0OrkHOtZDMRyFg16hMbY` },
  'marina-bay': { sc: 67, vsc: 33, races: 6, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-singapore-grand-prix.2yF5JZuQTWUoUmbDH4niHv` },
  lusail: { sc: 67, vsc: 67, races: null, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2025-qatar-grand-prix.6DxCdCUowmWJJQMOTOPZI7` },
  'yas-marina': { sc: 38, vsc: 50, races: null, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2025-abu.5pGXiI5uO3um15txovxKwc` },
  hungaroring: { sc: 13, vsc: 25, races: 8, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-hungarian-grand-prix.5Zhle8vMBDwzt2OSoCgk4d` },
  'mexico-city': { sc: 60, vsc: 60, races: 5, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-mexico-city-grand-prix.7n5BnpkqmEkgJR61h8yqGv` },
  montreal: { sc: 83, vsc: 33, races: 6, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-canadian-grand-prix.5mxhs5HB0dFrvjaz7sbBGR` },
  austin: { sc: 29, vsc: 43, races: 7, source: `${PREVIAS}need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-united-states-grand-prix.1jmVcZ1nggWJpoUO6OLkjA` },
};

/** Probabilidades de un circuito (sin dato, la media de los 23). */
export function safetyCarOdds(circuitId: string | null | undefined): SafetyCarOdds {
  const hit = circuitId ? SAFETY_CAR_ODDS[circuitId] : undefined;
  if (hit) return hit;
  const all = Object.values(SAFETY_CAR_ODDS);
  const mean = (k: 'sc' | 'vsc') => Math.round(all.reduce((a, o) => a + o[k], 0) / all.length);
  return { sc: mean('sc'), vsc: mean('vsc'), races: null, source: '' };
}
