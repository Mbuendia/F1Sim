// [G8] Capas fijas de la pista como datos (Sprint 4.5): las mismas formas que pinta el Canvas, en metros del mundo,
// listas para subirse una vez a la GPU. No depende de WebGL ni del DOM: se construye y se prueba en Node.
import type { TrackDefinition } from '../data/barcelonaTrack';
import { getScenario } from '../data/scenarioRegistry';
import { calculateCarWorldPosition, GRID_LATERAL_OFFSET, GRID_SLOT_M } from '../utils/carPosition';
import { getPitLaneGeometry } from '../utils/pitLaneGeometry';
import { buildScenarioGeometry, KERB_WIDTH } from '../utils/scenarioGeometry';
import type { Point2D } from '../utils/spline';

/** Grosor de la línea de meta (m). */
export const FINISH_LINE_M = 1.5;
export const ASPHALT_DRY = '#272b35';
export const ASPHALT_WET = '#161922';

export interface FillShape { kind: 'fill'; points: Point2D[]; color: string; alpha?: number }
export interface StrokeShape {
  kind: 'stroke'; points: Point2D[]; closed?: boolean; width: number; color: string; alpha?: number;
  /** Línea fina: nunca se pinta con menos de un píxel, por lejos que esté la cámara. */
  hairline?: boolean;
  /** El asfalto cambia de color con la pista mojada. */
  role?: 'asphalt';
}
export type TrackShape = FillShape | StrokeShape;
export interface TrackLayers { trackWidthM: number; shapes: TrackShape[] }

const layersCache = new WeakMap<TrackDefinition, { circuitId: string; layers: TrackLayers }>();

/** Capas fijas de un circuito, de abajo arriba. Se calculan una vez por pista. */
export function getTrackLayers(track: TrackDefinition, circuitId: string): TrackLayers {
  const cached = layersCache.get(track);
  if (cached && cached.circuitId === circuitId) return cached.layers;
  const layers = buildTrackLayers(track, circuitId);
  layersCache.set(track, { circuitId, layers });
  return layers;
}

export function buildTrackLayers(track: TrackDefinition, circuitId: string): TrackLayers {
  const axis: Point2D[] = track.points.map(p => ({ x: p.x, y: p.y }));
  const width = track.trackWidthMeters || 12;
  const scenario = buildScenarioGeometry(track, getScenario(circuitId));
  const pit = getPitLaneGeometry(track);
  const shapes: TrackShape[] = [];
  const legacy = scenario.runoffPolygons.length === 0 && scenario.kerbSegments.length === 0 && scenario.barrierLines.length === 0;

  // Terreno, grava general y, sin escenario, la banda de piano de toda la vuelta.
  shapes.push({ kind: 'stroke', points: axis, closed: true, width: width + 40, color: legacy ? '#181e1a' : scenario.terrainColor });
  if (legacy || scenario.hasGravelGlobal) shapes.push({ kind: 'stroke', points: axis, closed: true, width: width + 18, color: '#5a4f3a' });
  if (legacy) shapes.push({ kind: 'stroke', points: axis, closed: true, width: width + 2 * KERB_WIDTH, color: '#d90429' });

  for (const runoff of scenario.runoffPolygons) shapes.push({ kind: 'fill', points: runoff.points, color: runoff.color });

  // Pianos: tramos rojos y blancos alternos de unos 3 m.
  let red = true;
  for (const kerb of scenario.kerbSegments) {
    for (let i = 0; i + 1 < kerb.points.length; i++) {
      const a = kerb.points[i], b = kerb.points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 1e-6) continue;
      const nx = -(b.y - a.y) / length * KERB_WIDTH / 2, ny = (b.x - a.x) / length * KERB_WIDTH / 2;
      const pieces = Math.max(1, Math.round(length / 3));
      for (let k = 0; k < pieces; k++) {
        const p = { x: a.x + (b.x - a.x) * k / pieces, y: a.y + (b.y - a.y) * k / pieces };
        const q = { x: a.x + (b.x - a.x) * (k + 1) / pieces, y: a.y + (b.y - a.y) * (k + 1) / pieces };
        shapes.push({ kind: 'fill', color: red ? '#d90429' : '#ffffff',
          points: [{ x: p.x + nx, y: p.y + ny }, { x: q.x + nx, y: q.y + ny }, { x: q.x - nx, y: q.y - ny }, { x: p.x - nx, y: p.y - ny }] });
        red = !red;
      }
    }
  }

  shapes.push({ kind: 'stroke', points: axis, closed: true, width, color: ASPHALT_DRY, role: 'asphalt' });

  for (const barrier of scenario.barrierLines) {
    if (barrier.points.length >= 2) shapes.push({ kind: 'stroke', points: barrier.points, width: barrier.width, color: barrier.color });
  }
  for (const edge of pit.trackEdges) shapes.push({ kind: 'stroke', points: edge, closed: true, width: 0.25, color: '#ffffff', alpha: 0.75, hairline: true });

  // Boxes.
  if (pit.fastLane.length >= 2) {
    if (pit.serviceArea.length >= 3) shapes.push({ kind: 'fill', points: pit.serviceArea, color: '#404753' });
    shapes.push({ kind: 'stroke', points: pit.fastLane, width: pit.fastLaneWidth, color: '#242c38' });
    for (const edge of pit.fastLaneEdges) shapes.push({ kind: 'stroke', points: edge, width: 0.2, color: '#d9dde5', hairline: true });
    for (const wall of pit.walls) shapes.push({ kind: 'stroke', points: wall, width: pit.wallWidth, color: '#aeb9c8' });
    for (const box of pit.boxes) {
      shapes.push({ kind: 'fill', points: box.corners, color: box.team.color, alpha: 0.33 });
      shapes.push({ kind: 'stroke', points: box.corners, closed: true, width: 0.25, color: box.team.color, hairline: true });
    }
  }

  // Meta ajedrezada de borde a borde y baliza.
  const start = track.points[0];
  if (start) {
    const nx = Math.cos(start.angle + Math.PI / 2), ny = Math.sin(start.angle + Math.PI / 2);
    const tx = Math.cos(start.angle) * FINISH_LINE_M / 2, ty = Math.sin(start.angle) * FINISH_LINE_M / 2;
    const at = (u: number) => ({ x: start.x + nx * (width / 2 - width * u), y: start.y + ny * (width / 2 - width * u) });
    for (let s = 0; s < 10; s++) {
      const a = at(s / 10), b = at((s + 1) / 10);
      shapes.push({ kind: 'fill', color: s % 2 === 0 ? '#ffffff' : '#000000',
        points: [{ x: a.x - tx, y: a.y - ty }, { x: b.x - tx, y: b.y - ty }, { x: b.x + tx, y: b.y + ty }, { x: a.x + tx, y: a.y + ty }] });
    }
    const beacon = at(0);
    shapes.push({ kind: 'fill', color: '#e10600', points: Array.from({ length: 12 }, (_, k) => ({ x: beacon.x + Math.cos(k * Math.PI / 6) * 1.5, y: beacon.y + Math.sin(k * Math.PI / 6) * 1.5 })) });
  }

  // Cajones de parrilla.
  if (track.lapLengthMeters > 0 && track.points.length >= 2) {
    for (const bracket of gridBrackets(track)) shapes.push({ kind: 'stroke', points: bracket, width: 0.15, color: '#ffffff', alpha: 0.8, hairline: true });
  }
  return { trackWidthM: width, shapes };
}

/** Los 20 cajones de parrilla, a 8 m reales uno de otro: una marca en U delante de cada coche. */
export function gridBrackets(track: TrackDefinition): Point2D[][] {
  const brackets: Point2D[][] = [];
  for (let slot = 0; slot < 20; slot++) {
    const pose = calculateCarWorldPosition({ progress: 1 - (slot + 1) * GRID_SLOT_M / track.lapLengthMeters,
      lateralOffset: slot % 2 === 0 ? GRID_LATERAL_OFFSET : -GRID_LATERAL_OFFSET, isInPitLane: false }, track);
    const tx = Math.cos(pose.worldAngle), ty = Math.sin(pose.worldAngle);
    // Frente del cajón 3 m por delante del centro del coche; 1,3 m a cada lado y 1,5 m hacia atrás.
    const fx = pose.worldX + tx * 3, fy = pose.worldY + ty * 3;
    const corner = (side: number, back: number) => ({ x: fx - ty * 1.3 * side - tx * back, y: fy + tx * 1.3 * side - ty * back });
    brackets.push([corner(1, 1.5), corner(1, 0), corner(-1, 0), corner(-1, 1.5)]);
  }
  return brackets;
}
