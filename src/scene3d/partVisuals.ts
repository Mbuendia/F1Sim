/**
 * [UX10] Qué se enseña de cada decisión: la pieza del coche que cambia una mejora (en el coche del menú, separado por
 * piezas en Blender) o la imagen de la instalación o de la sede (hechas en Blender, con estilo propio y sin marcas).
 * Sin three: lo usan la portada y los tests.
 */
import type { DecisionVisual } from '../simulation/Hub';

/** Piezas con nombre del coche del menú. El de 2025 (CA2) llegará con los mismos nombres. */
export const CAR_PARTS = ['ala_delantera', 'ala_trasera', 'suelo', 'pontones', 'tapa_motor', 'ruedas'] as const;
export type CarPart = typeof CAR_PARTS[number];

export const PART_LABEL: Record<CarPart, string> = {
  ala_delantera: 'Alerón delantero', ala_trasera: 'Alerón trasero', suelo: 'Fondo plano', pontones: 'Pontones', tapa_motor: 'Tapa motor', ruedas: 'Ruedas',
};

/** Pieza a la que apunta cada proyecto de desarrollo. */
export const PART_FOR_PROJECT: Record<string, CarPart[]> = {
  alerones: ['ala_delantera', 'ala_trasera'], suelo: ['suelo'], refrigeracion: ['pontones'], eficiencia: ['tapa_motor'], neumaticos: ['ruedas'],
};

/** La unidad de potencia va bajo la tapa motor: sus componentes se enseñan ahí. */
const POWER_UNIT_PART: CarPart = 'tapa_motor';

/** Coche del menú, por piezas (en `public/`). */
export const MENU_CAR_MODEL = 'models/f1-car-piezas.glb';

/** Imagen de cada instalación y de la sede (en `public/`, ≤ 200 KB). */
export const FACILITY_IMAGE: Record<string, string> = {
  tunel: 'hub/tunel.webp', simulador: 'hub/simulador.webp', produccion: 'hub/produccion.webp', banco: 'hub/banco.webp', sede: 'hub/sede.webp',
};
export const FACILITY_ALT: Record<string, string> = {
  tunel: 'Túnel de viento con el coche en la cinta', simulador: 'Simulador con el coche sobre la plataforma', produccion: 'Taller de producción con el coche a medio montar',
  banco: 'Banco de pruebas con el motor', sede: 'Sede del equipo junto al lago',
};

export type ResolvedVisual = { kind: 'pieza'; parts: CarPart[]; label: string } | { kind: 'imagen'; src: string; alt: string } | null;

/** Lo que se enseña para una decisión; las personas, de momento, sin imagen. */
export function resolveVisual(visual: DecisionVisual | undefined): ResolvedVisual {
  if (!visual) return null;
  if (visual.kind === 'instalacion') {
    const src = FACILITY_IMAGE[visual.id];
    return src ? { kind: 'imagen', src, alt: FACILITY_ALT[visual.id] ?? visual.id } : null;
  }
  if (visual.kind === 'pieza') {
    const parts = PART_FOR_PROJECT[visual.id] ?? ((CAR_PARTS as readonly string[]).includes(visual.id) ? [visual.id as CarPart] : [POWER_UNIT_PART]);
    return { kind: 'pieza', parts, label: parts.map(p => PART_LABEL[p]).join(' y ') };
  }
  return null;
}
