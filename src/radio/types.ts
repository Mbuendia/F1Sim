/**
 * [IA1] Tipos de la radio del muro (Sprint 6). La radio traduce lo que dice el jugador a una orden que el motor ya
 * tiene; nunca decide nada de la carrera. Esta carpeta no conoce el motor (`src/simulation/`).
 */
import type { TireCompound } from '../types/f1';
import type { EngineOrder } from '../engine/EngineHost';

export type PaceMode = 'push' | 'balanced' | 'save';
export type TeamOrderMode = 'libre' | 'mantener' | 'dejar-pasar';

/** Lo que el jugador ha pedido, ya entendido (antes de convertirlo en orden del motor). */
export type RadioIntent =
  /** [OF4] Con `lap` o `inLaps` es una parada programada y el compuesto es opcional (sin él, lo elige el muro). */
  | { kind: 'boxes'; carId: number; compound?: TireCompound; lap?: number; inLaps?: number }
  | { kind: 'anular-boxes'; carId: number }
  | { kind: 'ritmo'; carIds: number[]; mode: PaceMode }
  | { kind: 'orden-equipo'; mode: TeamOrderMode; favouredCarId?: number }
  | { kind: 'propuesta'; carId: number; accept: boolean; proposalId: string }
  | { kind: 'delegar'; carId: number; delegated: boolean };

export type RadioStatus = 'ok' | 'ambigua' | 'no-es-tuyo' | 'sin-compuesto' | 'no-disponible';

/** Resultado de interpretar una frase. Solo con `ok` hay órdenes; en los demás casos no se aplica nada. */
export interface RadioParse {
  status: RadioStatus;
  intent?: RadioIntent;
  orders: EngineOrder[];
  /** Coches a los que va el mensaje (para la conversación). */
  carIds: number[];
  /** Por qué no se puede (con `no-disponible`). */
  reason?: string;
}

export interface RadioProposal { id: string; kind: 'parada' | 'ritmo' | 'salida'; compound?: TireCompound }

/** Un coche propio, tal como lo ve la radio. */
export interface RadioCar {
  id: number;
  driverId: string;
  /** [IA2] Nombre de pila, para las respuestas («{companero}»). */
  displayName?: string;
  /** [IA5] Siglas del piloto (ALO, STR…), para hablar con el modelo. */
  code?: string;
  /** Formas de llamarlo, ya normalizadas (nombre, apellido de parodia, siglas, dorsal y apodos). */
  names: string[];
  position: number;
  status: string;
  /** Parando o con la parada ya comprometida. */
  inBoxes: boolean;
  /** Compuestos con juegos disponibles (sin dato, no se comprueba: lo valida el motor). */
  compounds?: TireCompound[];
  /** Propuestas pendientes del estratega, de la más antigua a la más reciente. */
  proposals: RadioProposal[];
}

export interface RadioContext {
  teamId: string;
  cars: RadioCar[];
  selectedCarId: number | null;
  /** Nombres (normalizados) de los pilotos rivales: para responder que no son tuyos. */
  rivalNames: string[];
  /** La carrera admite órdenes (en marcha y sin terminar). */
  ordersAvailable: boolean;
  lap?: number;
  timeSec?: number;
}

export interface RadioInterpreter {
  interpret(text: string, context: RadioContext): Promise<RadioParse>;
}
