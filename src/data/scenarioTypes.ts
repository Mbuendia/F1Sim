/** Tipo de circuito: permanente (Barcelona), urbano (Mónaco), o híbrido (Melbourne) */
export type TrackType = 'permanent' | 'street' | 'hybrid';

/** Tipo de superficie de escapatoria */
export type RunoffSurface = 'gravel' | 'asphalt' | 'wall' | 'grass' | 'tecpro';

/** Lado relativo al sentido de marcha */
export type TrackSide = 'left' | 'right' | 'both';

/** Zona de escapatoria localizada en un intervalo del circuito */
export interface RunoffZone {
  /** Inicio normalizado del tramo (0.0 - 1.0) */
  startT: number;
  /** Fin normalizado del tramo (0.0 - 1.0) */
  endT: number;
  /** Lado respecto al sentido de marcha */
  side: TrackSide;
  /** Tipo de superficie */
  surface: RunoffSurface;
  /** Factor sobre la anchura base de escapatoria (1.0 = normal, 2.0 = doble) */
  widthMultiplier: number;
  /** Override de color (si no se proporciona, se usa el color estándar del surface) */
  color?: string;
}

/** Piano/kerb localizado en una curva específica */
export interface KerbZone {
  /** Inicio normalizado del tramo de piano */
  startT: number;
  /** Fin normalizado del tramo de piano */
  endT: number;
  /** Lado del piano respecto al sentido de marcha */
  side: TrackSide;
  /** Estilo visual del piano */
  style: 'standard' | 'sausage' | 'flat';
}

/** Barrera/muro de contención */
export interface BarrierZone {
  /** Inicio normalizado del tramo de barrera */
  startT: number;
  /** Fin normalizado del tramo de barrera */
  endT: number;
  /** Lado de la barrera respecto al sentido de marcha */
  side: TrackSide;
  /** Tipo de barrera */
  type: 'armco' | 'concrete' | 'tecpro';
  /** Color de la barrera */
  color: string;
}

/** Definición completa del escenario visual de un circuito */
export interface CircuitScenario {
  /** Tipo de circuito */
  trackType: TrackType;
  /** Color del terreno base que rodea la pista */
  backgroundColor: string;
  /** Superficie de escapatoria por defecto para este circuito */
  defaultRunoffSurface: RunoffSurface;
  /** Escapatorias localizadas por zona */
  runoffZones: RunoffZone[];
  /** Pianos solo en curvas específicas */
  kerbs: KerbZone[];
  /** Muros y barreras de contención */
  barriers: BarrierZone[];
  /** true si el circuito tiene grava como escapatoria general */
  hasGravelGlobal: boolean;
}
