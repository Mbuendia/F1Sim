import type { TrackDefinition } from '../data/barcelonaTrack';
import type { CircuitScenario, RunoffZone, KerbZone, BarrierZone, RunoffSurface, TrackSide } from '../data/scenarioTypes';
import type { Point2D } from './spline';

// ── Colores estándar por tipo de superficie ──
const SURFACE_COLORS: Record<RunoffSurface, string> = {
  gravel: '#5a4f3a',
  asphalt: '#2a2e38',
  wall: '#6b7280',
  grass: '#181e1a',
  tecpro: '#2563eb',
};

// ── Anchuras base en unidades de mundo ──
const BASE_RUNOFF_WIDTH = 18;  // Ancho base de escapatoria (coherente con los 18*zoom de grava actual)
const KERB_WIDTH = 8;          // Ancho de piano (coherente con los 8*zoom actuales)
const BARRIER_WIDTH = 2;       // Ancho de barrera

/** Polígono de escapatoria listo para dibujar */
export interface RunoffPolygon {
  points: Point2D[];
  color: string;
  surface: RunoffSurface;
}

/** Segmento de piano listo para dibujar */
export interface KerbSegment {
  points: Point2D[];  // Path abierto a lo largo de la pista
  side: TrackSide;
  style: 'standard' | 'sausage' | 'flat';
}

/** Línea de barrera lista para dibujar */
export interface BarrierLine {
  points: Point2D[];
  color: string;
  width: number;
  type: 'armco' | 'concrete' | 'tecpro';
}

/** Geometría completa del escenario, cacheada por track */
export interface ScenarioGeometry {
  runoffPolygons: RunoffPolygon[];
  kerbSegments: KerbSegment[];
  barrierLines: BarrierLine[];
  terrainColor: string;
  hasGravelGlobal: boolean;
}

/**
 * Convierte un índice de progreso normalizado (0.0-1.0) a un índice
 * en el array de puntos del circuito.
 */
function tToIndex(t: number, totalPoints: number): number {
  const normalized = ((t % 1) + 1) % 1;  // Manejar wrap-around
  return Math.floor(normalized * totalPoints) % totalPoints;
}

/**
 * Extrae un rango de puntos del circuito entre startT y endT,
 * manejando correctamente el wrap-around de la línea de meta.
 */
function getPointRange(points: { x: number; y: number; angle: number }[], startT: number, endT: number): number[] {
  const n = points.length;
  const startIdx = tToIndex(startT, n);
  const endIdx = tToIndex(endT, n);

  const indices: number[] = [];
  if (startIdx <= endIdx) {
    for (let i = startIdx; i <= endIdx; i++) indices.push(i);
  } else {
    // Wrap-around: cruza la línea de meta
    for (let i = startIdx; i < n; i++) indices.push(i);
    for (let i = 0; i <= endIdx; i++) indices.push(i);
  }
  return indices;
}

/**
 * Genera un polígono de offset a un lado de la pista.
 * El polígono se crea desplazando los puntos del spline hacia la normal
 * (exterior) o contra la normal (interior).
 */
function buildOffsetPolygon(
  trackPoints: TrackDefinition['points'],
  indices: number[],
  side: TrackSide,
  innerOffset: number,
  outerOffset: number
): Point2D[][] {
  const results: Point2D[][] = [];

  const buildSide = (sign: number) => {
    const outer: Point2D[] = [];
    const inner: Point2D[] = [];
    for (const idx of indices) {
      const pt = trackPoints[idx];
      const nx = Math.cos(pt.angle + Math.PI / 2) * sign;
      const ny = Math.sin(pt.angle + Math.PI / 2) * sign;
      inner.push({ x: pt.x + nx * innerOffset, y: pt.y + ny * innerOffset });
      outer.push({ x: pt.x + nx * outerOffset, y: pt.y + ny * outerOffset });
    }
    // Polígono cerrado: inner forward + outer backward
    results.push([...inner, ...outer.reverse()]);
  };

  if (side === 'left' || side === 'both') buildSide(1);
  if (side === 'right' || side === 'both') buildSide(-1);

  return results;
}

/**
 * Genera un path de offset a un lado de la pista (para líneas/barreras).
 */
function buildOffsetPath(
  trackPoints: TrackDefinition['points'],
  indices: number[],
  side: TrackSide,
  offsetDistance: number
): Point2D[][] {
  const results: Point2D[][] = [];

  const buildSide = (sign: number) => {
    const path: Point2D[] = [];
    for (const idx of indices) {
      const pt = trackPoints[idx];
      const nx = Math.cos(pt.angle + Math.PI / 2) * sign;
      const ny = Math.sin(pt.angle + Math.PI / 2) * sign;
      path.push({ x: pt.x + nx * offsetDistance, y: pt.y + ny * offsetDistance });
    }
    results.push(path);
  };

  if (side === 'left' || side === 'both') buildSide(1);
  if (side === 'right' || side === 'both') buildSide(-1);

  return results;
}

/**
 * Construye toda la geometría de escenario para un circuito.
 * Esta función se ejecuta una sola vez por track y su resultado se cachea.
 */
export function buildScenarioGeometry(
  track: TrackDefinition,
  scenario: CircuitScenario
): ScenarioGeometry {
  const trackHalfWidth = ((track.trackWidthMeters || 26) * 1.75) / 2;
  const points = track.points;

  // ── 1. ESCAPATORIAS LOCALIZADAS ──
  const runoffPolygons: RunoffPolygon[] = [];

  for (const zone of scenario.runoffZones) {
    const indices = getPointRange(points, zone.startT, zone.endT);
    if (indices.length < 2) continue;

    const innerEdge = trackHalfWidth;
    const outerEdge = trackHalfWidth + BASE_RUNOFF_WIDTH * zone.widthMultiplier;
    const color = zone.color || SURFACE_COLORS[zone.surface];

    const polygons = buildOffsetPolygon(points, indices, zone.side, innerEdge, outerEdge);
    for (const poly of polygons) {
      runoffPolygons.push({ points: poly, color, surface: zone.surface });
    }
  }

  // ── 2. PIANOS LOCALIZADOS ──
  const kerbSegments: KerbSegment[] = [];

  for (const kerb of scenario.kerbs) {
    const indices = getPointRange(points, kerb.startT, kerb.endT);
    if (indices.length < 2) continue;

    const kerbOffset = trackHalfWidth + KERB_WIDTH / 2;
    const paths = buildOffsetPath(points, indices, kerb.side, kerbOffset);
    for (const path of paths) {
      kerbSegments.push({ points: path, side: kerb.side, style: kerb.style });
    }
  }

  // ── 3. BARRERAS ──
  const barrierLines: BarrierLine[] = [];

  for (const barrier of scenario.barriers) {
    const indices = getPointRange(points, barrier.startT, barrier.endT);
    if (indices.length < 2) continue;

    // Las barreras se colocan justo al borde de la pista
    const barrierOffset = trackHalfWidth + 1;
    const paths = buildOffsetPath(points, indices, barrier.side, barrierOffset);
    for (const path of paths) {
      barrierLines.push({
        points: path,
        color: barrier.color,
        width: barrier.type === 'concrete' ? BARRIER_WIDTH * 1.5 : BARRIER_WIDTH,
        type: barrier.type,
      });
    }
  }

  return {
    runoffPolygons,
    kerbSegments,
    barrierLines,
    terrainColor: scenario.backgroundColor,
    hasGravelGlobal: scenario.hasGravelGlobal,
  };
}
