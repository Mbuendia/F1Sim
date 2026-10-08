// [R23] Señales que la pista pinta para explicar el estado físico de los coches. Cada una tiene su color y, además,
// una forma o un rótulo propios: ninguna se distingue solo por ser roja o verde. Diseño del juego.
import { OVERVIEW_ZOOM } from './CarLabels';

/** Asfalto sobre el que se pintan (seco y mojado). */
export const ASPHALT = { dry: '#272b35', wet: '#161922' } as const;
/** Contraste mínimo de una señal con el asfalto (el de componentes gráficos de WCAG 2.1). */
export const MIN_SIGNAL_CONTRAST = 3;

export interface Signal {
  id: string;
  label: string;
  color: string;
  /** Segundo color, si la señal alterna entre dos. */
  alternate?: string;
  /** Lo que la distingue además del color. */
  shape: string;
  /** Zoom a partir del cual se pinta (por debajo, los coches son puntos). */
  minZoom: number;
}

export const SIGNALS = {
  drsOpen: { id: 'drs-abierto', label: 'DRS abierto', color: '#00ff66', shape: 'alerón trasero partido por una ranura oscura', minZoom: OVERVIEW_ZOOM },
  rearLight: { id: 'luz-trasera', label: 'Luz trasera', color: '#ff2d2d', shape: 'punto con halo en la cola del coche', minZoom: OVERVIEW_ZOOM },
  safetyCarLights: { id: 'luces-safety-car', label: 'Safety Car', color: '#f59e0b', alternate: '#ef4444', shape: 'barra que parpadea sobre el techo, con rótulo', minZoom: 0 },
  drsZone: { id: 'drs-zona', label: 'DRS', color: '#00ff66', shape: 'línea continua en el borde de la pista, con rótulo', minZoom: 0 },
  drsDetection: { id: 'drs-deteccion', label: 'DETECCIÓN DRS', color: '#38bdf8', shape: 'línea discontinua que cruza la pista, con rótulo', minZoom: 0 },
} as const satisfies Record<string, Signal>;

/** Ranura del flap abierto (entre los dos planos del alerón). */
export const DRS_SLOT_COLOR = '#0b0f1a';

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (index: number) => {
    const c = parseInt(value.slice(index, index + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Relación de contraste entre dos colores (WCAG 2.1), de 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
