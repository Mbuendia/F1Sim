// [G9] Qué se pinta de cada coche, como datos (Sprint 4.5): posición, tamaño y señales en metros del mundo, a partir
// del estado del motor. Lo usa la capa de WebGL (`TrackLayerGL`); no depende de WebGL ni del DOM y se prueba en Node.
// Las reglas son las de `CarRenderer` (R23, R46, R56): mismo orden, mismo recorte y mismas señales.
import type { TrackDefinition } from '../data/barcelonaTrack';
import { flapOpenness } from '../simulation/DRSModel';
import type { CarState, SafetyCarState } from '../types/f1';
import { calculateCarWorldPosition, isCarVisible } from '../utils/carPosition';
import { compoundStyle } from '../utils/compounds';
import type { Camera } from './Camera';
import { rearLight, safetyCarLightOn, wheelMarkPhase } from './carDetail';
import { OVERVIEW_ZOOM } from './CarLabels';
import { CarRenderer, type CarEffects } from './CarRenderer';
import { carPixelsPerMeter, carSpriteKey, carSpriteSize, getCarSprite, getSafetyCarSprite, type TopSprite } from './carSprites';

export interface CarDraw {
  id: number;
  /** De lejos, un punto del color del equipo; de cerca, la imagen del modelo con sus señales. */
  mode: 'dot' | 'sprite';
  x: number; y: number; angle: number;
  opacity: number;
  teamColor: string;
  /** Aro (de cerca) o contorno (de lejos): seleccionado, bandera azul o retirado. */
  ringColor: string | null;
  selected: boolean;
  sprite?: TopSprite;
  /** Largo y ancho del coche en metros del mundo, y la unidad de sus marcas (la del dibujo a zoom 1). */
  lengthM: number; widthM: number; unit: number;
  compoundColor: string;
  showTyres: boolean;
  markPhase: number;
  /** DRS: 0 cerrado, 1 abierto, con la transición del flap. */
  flap: number;
  lightOn: boolean;
}

export interface SafetyCarDraw {
  x: number; y: number; angle: number; lengthM: number; widthM: number; lightOn: boolean; sprite: TopSprite;
}

const PASS_MARGIN_PX = 80;

/** Coches que pinta la GPU, en orden de pintado (el seleccionado, el último). Los que no tienen imagen los pinta el Canvas. */
export function buildCarDraws(
  cars: CarState[], camera: Camera, selectedCarId: number | null, track: TrackDefinition, capacity: number, effects: CarEffects = {},
): CarDraw[] {
  const sorted = cars.filter(isCarVisible).sort((a, b) => (a.id === selectedCarId ? 1 : b.id === selectedCarId ? -1 : a.progress - b.progress));
  const points = track.points || [];
  const draws: CarDraw[] = [];
  for (const car of sorted) {
    const screen = camera.worldToScreen(car.worldX, car.worldY);
    if (screen.x < -PASS_MARGIN_PX || screen.x > camera.screenWidth + PASS_MARGIN_PX || screen.y < -PASS_MARGIN_PX || screen.y > camera.screenHeight + PASS_MARGIN_PX) continue;
    const selected = car.id === selectedCarId;
    const overview = camera.zoom <= OVERVIEW_ZOOM;
    const sprite = overview ? undefined : getCarSprite(carSpriteKey(car));
    if (!overview && !sprite) continue;   // dibujo vectorial del Canvas
    const point = points.length ? points[Math.floor((((car.progress % 1) + 1) % 1) * points.length) % points.length] : undefined;
    const dimensions = CarRenderer.getCarDimensions(1, point?.trackWidthMeters ?? track.trackWidthMeters ?? 12, point?.trackWidthCars ?? capacity ?? 3);
    const size = sprite ? carSpriteSize(dimensions, sprite.lengthM / sprite.widthM) : { length: 0, width: 0 };
    const timeSec = effects.timeSec ?? 0;
    const highlighted = selected || car.isBlueFlagged || car.status === 'out';
    draws.push({
      id: car.id, mode: overview ? 'dot' : 'sprite', x: car.worldX, y: car.worldY, angle: car.worldAngle,
      opacity: car.status === 'out' ? Math.max(0.25, Math.min(1.0, car.retireTimer / 10)) : 1.0,
      teamColor: car.team.color,
      ringColor: overview
        ? (car.status === 'out' ? '#ef4444' : car.isBlueFlagged ? '#38bdf8' : selected ? '#ffd700' : null)
        : (highlighted ? (car.status === 'out' ? '#ef4444' : car.isBlueFlagged ? '#38bdf8' : car.team.color) : null),
      selected, sprite, lengthM: size.length, widthM: size.width, unit: dimensions.scale,
      compoundColor: compoundStyle(car.tires.compound).color,
      showTyres: camera.zoom > 1.1 && Boolean(sprite?.wheels && sprite?.tyre),
      markPhase: wheelMarkPhase(car.progress * (track.lapLengthMeters || 0)),
      flap: flapOpenness(car.drsActive, car.drsChangedAt, timeSec),
      lightOn: rearLight({ wetMm: effects.depthAt?.(car.trackT) ?? 0, braking: car.status === 'running' && car.telemetry.brake > 20, timeSec }).lit,
    });
  }
  return draws;
}

/** El Safety Car, si está en pista y ya tiene su imagen; si no, lo pinta el Canvas. */
export function buildSafetyCarDraw(safetyCar: SafetyCarState | null | undefined, track: TrackDefinition, camera: Camera, nowMs: number): SafetyCarDraw | null {
  if (!safetyCar || !safetyCar.isDeployed || safetyCar.mode === 'idle' || safetyCar.mode === 'in') return null;
  const sprite = getSafetyCarSprite();
  if (!sprite) return null;
  const pose = calculateCarWorldPosition({ progress: safetyCar.progress, isInPitLane: Boolean(safetyCar.isInPitLane), lateralOffset: 0 }, track);
  const screen = camera.worldToScreen(pose.worldX, pose.worldY);
  if (screen.x < -PASS_MARGIN_PX || screen.x > camera.screenWidth + PASS_MARGIN_PX || screen.y < -PASS_MARGIN_PX || screen.y > camera.screenHeight + PASS_MARGIN_PX) return null;
  // La misma escala que los monoplazas, sin bajar del tamaño mínimo en pantalla que lo mantiene visible de lejos.
  const lengthM = Math.max(16 * 0.9 / camera.zoom, sprite.lengthM * carPixelsPerMeter(CarRenderer.getCarDimensions(1)));
  return { x: pose.worldX, y: pose.worldY, angle: pose.worldAngle, lengthM, widthM: lengthM * sprite.widthM / sprite.lengthM, lightOn: safetyCarLightOn(nowMs), sprite };
}
