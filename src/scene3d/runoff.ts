/**
 * Escapatorias de cada circuito como en la realidad (23/10/2026, investigación con referencias):
 * - grava: Suzuka, Zandvoort (sin asfalto en sus escapatorias), Monza, Lusail, Melbourne.
 * - asfalto: Baréin, Interlagos, México, Miami, Shanghái.
 * - mixta (grava a la entrada de la curva y asfalto a la salida, la propuesta de Wurz; Spa y Spielberg añadieron grava
 *   a escapatorias de asfalto): Barcelona, Silverstone, Spa, Spielberg, Hungaroring, Montreal.
 * - pintada: Yas Marina (azules) y COTA (rojo, blanco y azul; arcén pintado en rojo).
 * - ninguna: los urbanos (Mónaco, Bakú, Singapur, Yeda, Las Vegas), con muros pegados.
 * Solo para la vista 3D: la vista cenital 2D sigue con su escenario.
 */
export type RunoffKind = 'grava' | 'asfalto' | 'mixta' | 'pintada' | 'ninguna';
export type RunoffSurface = 'grava' | 'asfalto' | 'pintada' | 'ninguna';

export const RUNOFF_LOOK: Record<string, { kind: RunoffKind }> = {
  suzuka: { kind: 'grava' }, zandvoort: { kind: 'grava' }, monza: { kind: 'grava' }, lusail: { kind: 'grava' }, melbourne: { kind: 'grava' },
  bahrain: { kind: 'asfalto' }, interlagos: { kind: 'asfalto' }, 'mexico-city': { kind: 'asfalto' }, miami: { kind: 'asfalto' }, shanghai: { kind: 'asfalto' },
  barcelona: { kind: 'mixta' }, silverstone: { kind: 'mixta' }, spa: { kind: 'mixta' }, spielberg: { kind: 'mixta' }, hungaroring: { kind: 'mixta' }, montreal: { kind: 'mixta' },
  'yas-marina': { kind: 'pintada' }, austin: { kind: 'pintada' },
  monaco: { kind: 'ninguna' }, baku: { kind: 'ninguna' }, 'marina-bay': { kind: 'ninguna' }, jeddah: { kind: 'ninguna' }, 'las-vegas': { kind: 'ninguna' },
};

export const RUNOFF_COLORS = { grava: '#c2ad83', asfalto: '#3b404b' } as const;

/** Franjas de las escapatorias pintadas, en el orden en que se repiten. */
export const PAINT_STRIPES: Record<string, string[]> = {
  // Abu Dabi: turquesa claro con franjas de azul oscuro (foto aérea nocturna que pasó el usuario el 22/10/2026).
  'yas-marina': ['#5cc8dc', '#2a6fb0'],
  austin: ['#cf2b34', '#f1f1f1', '#2a55c8'],
};

/** Superficie en la fracción `fraction` (0 entrada, 1 salida) de una zona de escapatoria del circuito. */
export function runoffSurfaceAt(circuitId: string, fraction: number): RunoffSurface {
  const kind = RUNOFF_LOOK[circuitId]?.kind ?? 'grava';
  if (kind === 'mixta') return fraction < 0.5 ? 'grava' : 'asfalto';
  return kind;
}

/** Color de un trozo de escapatoria: `stripe` es el número de franja (para las pintadas). */
export function runoffColor(circuitId: string, fraction: number, stripe: number): string | null {
  const surface = runoffSurfaceAt(circuitId, fraction);
  if (surface === 'ninguna') return null;
  if (surface === 'pintada') { const s = PAINT_STRIPES[circuitId] ?? [RUNOFF_COLORS.asfalto]; return s[((stripe % s.length) + s.length) % s.length]; }
  return RUNOFF_COLORS[surface];
}
