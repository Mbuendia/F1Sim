/**
 * [UX16] De lejos, puntos de colores en lugar de coches (para gastar menos). Lo que decide el nivel de cada coche, sin
 * three: cuánto mide en pantalla, con qué nivel se pinta (completo, ligero o punto, con margen para no parpadear) y cómo
 * es su punto. La escena 3D (RaceScene3D) lo aplica.
 */
import { isCarVisible } from '../utils/carPosition';

/** Largo de un F1 (m), el del modelo. */
export const CAR_LENGTH_M = 5.4;
/** Por debajo de este largo en pantalla (píxeles CSS), el coche pasa a punto (decisión del usuario, 28/10/2026). */
export const DOT_PX = 8;
/** Margen para volver del punto al coche: tiene que medir un 20 % más (así no parpadea al cruzar el límite). */
export const DOT_HYSTERESIS = 0.2;
/** [PF2] El modelo completo (127.000 triángulos) solo cuando el coche mide al menos esto en pantalla (píxeles CSS). */
export const FULL_PX = 150;
/** [PF2] Margen para dejar el completo: quien lo lleva sigue con él hasta bajar un 20 % del corte (120 px). */
export const FULL_HYSTERESIS = 0.2;

export type CarLevel = 'completo' | 'ligero' | 'punto';

/** Largo en pantalla (píxeles CSS) de algo de `lengthM` metros a `distanceM` de una cámara de `fovDeg` grados en vertical. */
export function screenLengthPx(distanceM: number, fovDeg: number, viewportHeightPx: number, lengthM = CAR_LENGTH_M): number {
  const d = Math.max(0.01, distanceM);
  return (lengthM / (2 * d * Math.tan((fovDeg * Math.PI) / 360))) * viewportHeightPx;
}

/**
 * Nivel de un coche por lo que mide en pantalla: punto si se ve pequeño, completo si se ve grande ([PF2] 150 px) y
 * ligero en medio, con margen respecto a cómo estaba para que no parpadee. `distanceM` ya no decide (se conserva la firma).
 */
export function carLevel(lengthPx: number, _distanceM: number, previous: CarLevel | undefined, fullPx = FULL_PX): CarLevel {
  const limit = previous === 'punto' ? DOT_PX * (1 + DOT_HYSTERESIS) : DOT_PX;
  if (lengthPx < limit) return 'punto';
  // [PF4] El corte depende del nivel de calidad (Infinity en bajo: nunca completo).
  const full = previous === 'completo' ? fullPx * (1 - FULL_HYSTERESIS) : fullPx;
  return lengthPx >= full ? 'completo' : 'ligero';
}

/** [PF2] Con qué modelo se dibuja la sombra de un coche: siempre el ligero; un punto no da sombra. */
export function shadowSource(level: CarLevel): 'ligero' | null {
  return level === 'punto' ? null : 'ligero';
}

export interface DotStyle { sizePx: number; ring: 'ninguno' | 'blanco' | 'seguido' }

/** Cómo es el punto: los del jugador, más grandes y con borde blanco; el seguido, el más grande y con borde amarillo. */
export function dotStyle(car: { mine: boolean; followed: boolean }): DotStyle {
  if (car.followed) return { sizePx: 12, ring: 'seguido' };
  if (car.mine) return { sizePx: 10, ring: 'blanco' };
  return { sizePx: 7, ring: 'ninguno' };
}

export interface CarPlanInput {
  id: number; teamId: string; color: string; status: string; isRetiredVisible: boolean; distanceM: number;
  /** [PF2.7] Posición en el mundo (m), para saber quién está cerca del coche en foco. */
  x?: number; y?: number;
}

/** [PF2.7] Margen para dejar el completo por cercanía: quien lo lleva sigue con él hasta un 10 % más allá del radio. */
export const FOCUS_HYSTERESIS = 0.1;
export interface CarPlan { id: number; level: CarLevel; dot: (DotStyle & { color: string }) | null }

/**
 * El plan de un fotograma: un nivel por coche visible (los ocultos no salen, tampoco como punto) y, para los que van de
 * punto, su estilo. `previous` guarda el nivel de cada coche en el fotograma anterior (para el margen).
 */
export function planCars(cars: CarPlanInput[], view: {
  fovDeg: number; viewportHeightPx: number; playerTeamId?: string | null; followedCarId?: number | null; fullCarPx?: number;
  /**
   * [PF2.7] Coche en foco (el seguido con las cámaras de persecución y a bordo) y radio del nivel de calidad: él y los
   * que estén a menos de ese radio van con el modelo completo aunque midan menos que el corte, para que en curvas
   * cerradas o con coches pegados delante o detrás se vean siempre bien. En calidad baja (corte Infinity) no se aplica.
   */
  focusCarId?: number | null; focusRadiusM?: number;
}, previous: Map<number, CarLevel>): CarPlan[] {
  const plans: CarPlan[] = [];
  const focus = view.focusCarId != null && (view.focusRadiusM ?? 0) > 0 && Number.isFinite(view.fullCarPx ?? FULL_PX)
    ? cars.find(c => c.id === view.focusCarId && c.x !== undefined && c.y !== undefined) ?? null
    : null;
  for (const car of cars) {
    if (!isCarVisible({ status: car.status as never, isRetiredVisible: car.isRetiredVisible })) continue;
    const before = previous.get(car.id);
    let level = carLevel(screenLengthPx(car.distanceM, view.fovDeg, view.viewportHeightPx), car.distanceM, before, view.fullCarPx);
    if (focus && level === 'ligero' && car.x !== undefined && car.y !== undefined) {
      const radius = (view.focusRadiusM ?? 0) * (before === 'completo' ? 1 + FOCUS_HYSTERESIS : 1);
      if (Math.hypot(car.x - focus.x!, car.y - focus.y!) <= radius) level = 'completo';
    }
    previous.set(car.id, level);
    const style = level === 'punto' ? dotStyle({ mine: Boolean(view.playerTeamId) && car.teamId === view.playerTeamId, followed: car.id === view.followedCarId }) : null;
    plans.push({ id: car.id, level, dot: style ? { ...style, color: car.color } : null });
  }
  return plans;
}
