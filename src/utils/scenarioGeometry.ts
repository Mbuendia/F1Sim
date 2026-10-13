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

// ── Anchuras base en metros ──
const BASE_RUNOFF_WIDTH = 18;  // Ancho base de escapatoria (coherente con los 18*zoom de grava actual)
export const KERB_WIDTH = 1.6;  // [G4] Ancho de piano en metros
const BARRIER_WIDTH = 1;       // Ancho de barrera

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
 * [G4] Desplazamiento lateral que no se pliega: por el interior de una curva no pasa del radio del eje en ese punto.
 * `sign` es +1 hacia la normal (izquierda) y -1 al otro lado.
 */
function safeOffset(trackPoints: TrackDefinition['points'], idx: number, sign: number, offset: number): number {
  const n = trackPoints.length, prev = trackPoints[(idx - 1 + n) % n], next = trackPoints[(idx + 1) % n];
  const turn = Math.atan2(Math.sin(next.angle - prev.angle), Math.cos(next.angle - prev.angle));
  const length = Math.hypot(next.x - prev.x, next.y - prev.y);
  if (turn * sign <= 1e-9 || length < 1e-9) return offset;
  return Math.min(offset, 0.9 * length / Math.abs(turn));
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
      const inside = safeOffset(trackPoints, idx, sign, innerOffset), outside = safeOffset(trackPoints, idx, sign, outerOffset);
      inner.push({ x: pt.x + nx * inside, y: pt.y + ny * inside });
      outer.push({ x: pt.x + nx * outside, y: pt.y + ny * outside });
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
      const distance = safeOffset(trackPoints, idx, sign, offsetDistance);
      path.push({ x: pt.x + nx * distance, y: pt.y + ny * distance });
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
  const trackHalfWidth = (track.trackWidthMeters || 12) / 2;
  const points = track.points;
  // [G4] Escapatorias, pianos y barreras se dibujan con un vértice cada 6 m: de sobra para su forma.
  const stepM = track.lapLengthMeters > 0 ? track.lapLengthMeters / Math.max(1, points.length) : 6;
  const every = Math.max(1, Math.round(6 / stepM));
  const thin = (indices: number[]) => indices.filter((_, k) => k % every === 0 || k === indices.length - 1);

  // ── 0. PROCEDURAL GENERATION PARA CIRCUITOS SIN ESCENARIO (Q6) ──
  let runoffs = scenario.runoffZones;
  let kerbs = scenario.kerbs;
  let barriers = scenario.barriers;

  if (runoffs.length === 0 && kerbs.length === 0 && barriers.length === 0) {
    const isStreet = track.name.toLowerCase().includes('street') || 
                     track.name.toLowerCase().includes('monaco') || 
                     track.name.toLowerCase().includes('marina') || 
                     track.name.toLowerCase().includes('las vegas') || 
                     track.name.toLowerCase().includes('jeddah') || 
                     track.name.toLowerCase().includes('baku');
    
    // Auto-generar a partir de las curvas calibradas
    runoffs = track.corners.map(c => ({
      startT: Math.max(0, c.t - 0.025),
      endT: Math.min(1, c.t + 0.035),
      side: 'both' as TrackSide,
      surface: isStreet ? 'asphalt' : 'gravel',
      widthMultiplier: isStreet ? 1.2 : 1.5
    }));

    kerbs = track.corners.map(c => ({
      startT: Math.max(0, c.t - 0.02),
      endT: Math.min(1, c.t + 0.02),
      side: 'both' as TrackSide,
      style: 'standard'
    }));

    if (isStreet) {
      // Los circuitos urbanos tienen muros continuos
      barriers = [
        { startT: 0, endT: 0.999, side: 'both', type: 'concrete', color: '#8a8a8a' }
      ];
    } else {
      // Circuitos permanentes tienen barreras en zonas de frenada o curvas peligrosas
      barriers = track.corners.map(c => ({
        startT: Math.max(0, c.t - 0.03),
        endT: Math.min(1, c.t + 0.04),
        side: 'both' as TrackSide,
        type: 'armco',
        color: '#6b7280'
      }));
    }
  }

  // ── 1. ESCAPATORIAS LOCALIZADAS ──
  const runoffPolygons: RunoffPolygon[] = [];

  for (const zone of runoffs) {
    const indices = thin(getPointRange(points, zone.startT, zone.endT));
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

  for (const kerb of kerbs) {
    const indices = thin(getPointRange(points, kerb.startT, kerb.endT));
    if (indices.length < 2) continue;

    const kerbOffset = trackHalfWidth + KERB_WIDTH / 2;
    const paths = buildOffsetPath(points, indices, kerb.side, kerbOffset);
    for (const path of paths) {
      kerbSegments.push({ points: path, side: kerb.side, style: kerb.style });
    }
  }

  // ── 3. BARRERAS ──
  const barrierLines: BarrierLine[] = [];

  for (const barrier of barriers) {
    const indices = thin(getPointRange(points, barrier.startT, barrier.endT));
    if (indices.length < 2) continue;

    // [G4] Las barreras van por fuera del piano, nunca sobre el asfalto
    const barrierOffset = trackHalfWidth + KERB_WIDTH + 0.6;
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
