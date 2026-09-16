import type { TrackDefinition } from '../data/barcelonaTrack';
import type { Point2D } from './spline';

export interface PitTeam { id: string; shortName: string; color: string }
export interface PitBox {
  team: PitTeam;
  center: Point2D;
  corners: Point2D[];
  label: Point2D;
  angle: number;
}
export interface PitLaneGeometry {
  trackEdges: Point2D[][];
  fastLane: Point2D[];
  fastLaneEdges: Point2D[][];
  serviceArea: Point2D[];
  walls: Point2D[][];
  boxes: PitBox[];
  fastLaneWidth: number;
  wallWidth: number;
}

// Unidades visuales del mundo, compatibles con la huella actual de CarRenderer.
// La escala física por circuito es responsabilidad de R03, no del zoom.
const FAST_LANE_WIDTH = 10;
const SERVICE_WIDTH = 14;
const WALL_WIDTH = 1;
const WALL_OFFSET = FAST_LANE_WIDTH / 2 + 1;

function normalAt(points: Point2D[], index: number, closed = false): Point2D {
  const previous = points[closed ? (index - 1 + points.length) % points.length : Math.max(0, index - 1)];
  const next = points[closed ? (index + 1) % points.length : Math.min(points.length - 1, index + 1)];
  const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
  return { x: -(next.y - previous.y) / length, y: (next.x - previous.x) / length };
}

function offset(point: Point2D, normal: Point2D, distance: number): Point2D {
  return { x: point.x + normal.x * distance, y: point.y + normal.y * distance };
}

function nearestOnSegment(point: Point2D, a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function distanceToSegment(point: Point2D, a: Point2D, b: Point2D): number {
  const nearest = nearestOnSegment(point, a, b);
  return Math.hypot(point.x - nearest.x, point.y - nearest.y);
}

function cross(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentDistance(a: Point2D, b: Point2D, c: Point2D, d: Point2D): number {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
}

function segmentClearsPath(a: Point2D, b: Point2D, path: Point2D[], clearance: number, closed = false): boolean {
  const count = closed ? path.length : path.length - 1;
  for (let i = 0; i < count; i++) {
    if (segmentDistance(a, b, path[i], path[(i + 1) % path.length]) < clearance) return false;
  }
  return true;
}

/** Geometría independiente del motor: nunca modifica la ruta ni la posición del coche. */
export function buildPitLaneGeometry(track: TrackDefinition, teams: PitTeam[]): PitLaneGeometry {
  const main = track.points;
  const trackHalfWidth = (track.trackWidthMeters || 26) * 1.75 / 2;
  const trackEdges = main.length >= 3 ? [-1, 1].map(side => main.map((p, i) => offset(p, normalAt(main, i, true), side * trackHalfWidth))) : [];
  const result: PitLaneGeometry = {
    trackEdges, fastLane: [], fastLaneEdges: [], serviceArea: [], walls: [], boxes: [],
    fastLaneWidth: FAST_LANE_WIDTH, wallWidth: WALL_WIDTH,
  };
  const pit = track.pitLanePoints.filter((p, i, points) =>
    Number.isFinite(p.x) && Number.isFinite(p.y) && (i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1e-8));
  if (pit.length < 2 || main.length < 3) return result;
  const distances = [0];
  for (let i = 1; i < pit.length; i++) distances.push(distances[i - 1] + Math.hypot(pit[i].x - pit[i - 1].x, pit[i].y - pit[i - 1].y));
  const total = distances[distances.length - 1];
  if (total < 1e-6) return result;

  const sample = (distance: number) => {
    let index = 1;
    while (index < pit.length - 1 && distances[index] < distance) index++;
    const a = pit[index - 1], b = pit[index];
    const length = distances[index] - distances[index - 1];
    const t = Math.max(0, Math.min(1, (distance - distances[index - 1]) / length));
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    return { point, normal, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  // Elegir el lado del área de trabajo opuesto a la pista, también con offset negativo.
  const middle = sample(total / 2);
  let nearest: Point2D = main[0], bestDistance = Infinity;
  for (let i = 0; i < main.length; i++) {
    const candidate = nearestOnSegment(middle.point, main[i], main[(i + 1) % main.length]);
    const distance = Math.hypot(candidate.x - middle.point.x, candidate.y - middle.point.y);
    if (distance < bestDistance) { nearest = candidate; bestDistance = distance; }
  }
  const serviceSide = Math.sign((middle.point.x - nearest.x) * middle.normal.x + (middle.point.y - nearest.y) * middle.normal.y) || 1;
  const normals = pit.map((_, i) => normalAt(pit, i));
  result.fastLane = pit;
  result.fastLaneEdges = [-1, 1].map(side => pit.map((p, i) => offset(p, normals[i], side * FAST_LANE_WIDTH / 2)));

  // La plataforma de trabajo se abre gradualmente, lejos de las incorporaciones.
  const inner: Point2D[] = [], outer: Point2D[] = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const { point, normal } = sample(total * (0.22 + 0.56 * u));
    const taper = Math.min(1, u / 0.12, (1 - u) / 0.12);
    inner.push(offset(point, normal, serviceSide * FAST_LANE_WIDTH / 2));
    outer.push(offset(point, normal, serviceSide * (FAST_LANE_WIDTH / 2 + SERVICE_WIDTH * taper)));
  }
  result.serviceArea = [...inner, ...outer.reverse()];

  for (let i = 1; i < pit.length; i++) {
    if (distances[i - 1] < total * 0.18 || distances[i] > total * 0.82) continue;
    const a = offset(pit[i - 1], normals[i - 1], -serviceSide * WALL_OFFSET);
    const b = offset(pit[i], normals[i], -serviceSide * WALL_OFFSET);
    // Revisar el segmento completo, no solo sus extremos, antes de dibujar una barrera.
    if (segmentClearsPath(a, b, pit, FAST_LANE_WIDTH / 2 + WALL_WIDTH / 2 + 0.2) &&
        segmentClearsPath(a, b, main, trackHalfWidth + WALL_WIDTH / 2 + 0.2, true)) {
      result.walls.push([a, b]);
    }
  }

  const pitch = total * 0.4 / Math.max(1, teams.length);
  const halfLength = Math.min(6, pitch * 0.35);
  for (const [index, team] of teams.entries()) {
    const { point, normal, angle } = sample(total * 0.3 + pitch * (index + 0.5));
    const center = offset(point, normal, serviceSide * (FAST_LANE_WIDTH / 2 + SERVICE_WIDTH / 2));
    const tangent = { x: normal.y, y: -normal.x };
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({
      x: center.x + tangent.x * x * halfLength + normal.x * y * 3.5,
      y: center.y + tangent.y * x * halfLength + normal.y * y * 3.5,
    }));
    result.boxes.push({ team, center, corners, angle, label: offset(point, normal, serviceSide * (FAST_LANE_WIDTH / 2 + SERVICE_WIDTH + 5)) });
  }
  return result;
}
