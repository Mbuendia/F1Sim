import type { TireCompound } from '../types/f1';

/**
 * Q21: fuente única de la representación visual de los compuestos.
 * Convención del proveedor (Pirelli F1): P Zero seco con banda roja (Soft), amarilla (Medium) y
 * blanca (Hard); Cinturato de lluvia con banda verde (Intermediate) y azul (Wet). El Reglamento
 * Deportivo FIA identifica los compuestos pero no fija códigos HEX de pantalla: los HEX son la
 * paleta visual del juego, no una certificación oficial.
 */
export interface CompoundStyle {
  color: string;
  letter: string;
  name: string;
  label: string;
}

export const COMPOUND_STYLES: Record<TireCompound, CompoundStyle> = {
  soft: { color: '#e10600', letter: 'S', name: 'Soft', label: 'Blando (Soft) · P Zero rojo' },
  medium: { color: '#ffd700', letter: 'M', name: 'Medium', label: 'Medio (Medium) · P Zero amarillo' },
  hard: { color: '#ffffff', letter: 'H', name: 'Hard', label: 'Duro (Hard) · P Zero blanco' },
  intermediate: { color: '#22c55e', letter: 'I', name: 'Intermediate', label: 'Intermedio (Intermediate) · Cinturato verde' },
  wet: { color: '#3b82f6', letter: 'W', name: 'Wet', label: 'Lluvia (Wet) · Cinturato azul' },
};

export const TIRE_COMPOUNDS = Object.keys(COMPOUND_STYLES) as TireCompound[];

/** Estilo del compuesto; un valor desconocido cae en Hard en lugar de romper la interfaz. */
export function compoundStyle(compound: string): CompoundStyle {
  return COMPOUND_STYLES[compound as TireCompound] ?? COMPOUND_STYLES.hard;
}
