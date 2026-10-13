import type { TrackDefinition } from '../data/barcelonaTrack';
import type { Point2D } from './spline';
import { getLateralDisplacement, getTrackHalfWidth, worldUnitsPerMeter } from './carPosition';
import { getPitLaneGeometry } from './pitLaneGeometry';

/** [G1] Límites de calidad geométrica de un circuito (Sprint 4.5). Distancias en metros reales. */
export const QUALITY_LIMITS = {
  /** Diferencia admitida entre una unidad del mundo y un metro. */
  scaleTolerance: 0.005,
  /** Paso máximo entre dos muestras del eje. */
  maxStepM: 2,
  /** El radio del eje supera medio ancho de pista en al menos este margen (los bordes no se pliegan). */
  radiusMarginM: 1,
  /** Diferencia máxima entre la línea blanca y el borde del asfalto. */
  edgeGapM: 0.1,
  /** Desplazamiento lateral máximo de la trazada por metro de avance: el que admite el coche (`MAX_LATERAL_SLOPE`, Q20). */
  lineSlope: 0.35,
  /** Margen de la trazada con el borde (medio coche). */
  lineMarginM: 1,
  /** Un tramo es recta si su radio supera este valor durante al menos `straightMinM` (un codo de 600 m de radio a fondo es curva). */
  straightRadiusM: 1500,
  straightMinM: 100,
  /**
   * Cruces de lado admitidos en una misma recta. Entre dos curvas de sentido contrario la trazada cruza dos veces:
   * del ápice al exterior de la salida y de ahí al exterior de la curva siguiente. Tres o más es zigzag.
   */
  straightCrossings: 2,
  /** La trazada está a un lado cuando se aparta del eje más que esto; rozar el centro no es cambiar de lado. */
  sideMarginM: 1.5,
  /** Muro entre la pista y el carril rápido. */
  pitWallM: 1,
  /** Tramo de la ruta de boxes que se considera zona de servicio. */
  serviceFrom: 0.2,
  serviceTo: 0.8,
  /** Error admitido de la meta respecto a su referencia. */
  finishToleranceM: 30,
  /**
   * Longitud de la parrilla (20 puestos a 8 m) y radio mínimo del eje en ella. Con la meta en su sitio real, en varios
   * circuitos los últimos puestos quedan en la salida de la última curva, como en la realidad (Austin, Silverstone,
   * Yas Marina: comprobado contra una segunda fuente); solo se exige que ningún puesto caiga en el vértice de una horquilla.
   */
  gridLengthM: 160,
  gridRadiusM: 10,
} as const;

export interface CircuitQuality {
  unitsPerMeter: number;
  samples: number;
  maxStepM: number;
  /** Mayor cambio de rumbo entre dos muestras consecutivas (grados). */
  maxHeadingStepDeg: number;
  minRadiusM: number;
  /** Menor diferencia entre el radio del eje y medio ancho de pista; negativa si un borde se pliega. */
  minRadiusMarginM: number;
  edgeFolds: number;
  edgeGapM: number;
  lineSlopeMax: number;
  lineOutside: number;
  /** Mayor número de cambios de lado de la trazada dentro de una misma recta. */
  lineStraightCrossings: number;
  /** Menor holgura entre el carril rápido (con su muro) y el borde de la pista en la zona de servicio. */
  pitClearanceM: number;
  /** Esquinas de cajones y extremos de muro que pisan el asfalto. */
  pitObjectsOnTrack: number;
  /** Mayor giro entre dos tramos consecutivos de la ruta de boxes (grados). */
  pitTurnDeg: number;
  /** Distancia de la meta a la salida de boxes, a lo largo de la pista. */
  lineToPitExitM: number;
  /** Radio mínimo del eje en la zona de parrilla. */
  gridMinRadiusM: number;
}

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

function circumradius(a: Point2D, b: Point2D, c: Point2D): number {
  const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), ca = Math.hypot(a.x - c.x, a.y - c.y);
  const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

function distanceToPath(point: Point2D, path: Point2D[], closed: boolean): { distance: number; index: number } {
  let best = Infinity, index = 0;
  const count = closed ? path.length : path.length - 1;
  for (let i = 0; i < count; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
    if (d < best) { best = d; index = i; }
  }
  return { distance: best, index };
}

/** Radio del eje en cada muestra, medido con vecinos a unos 4 m para no confundir ruido con curva. */
export function axisRadiiM(track: TrackDefinition): number[] {
  const points = track.points, n = points.length, unit = worldUnitsPerMeter(track);
  const stepM = track.lapLengthMeters / n;
  const k = Math.max(1, Math.round(4 / stepM));
  return points.map((p, i) => circumradius(points[(i - k + n) % n], p, points[(i + k) % n]) / unit);
}

/** Medidas geométricas de un circuito ya construido. No modifica la pista. */
export function measureCircuit(track: TrackDefinition): CircuitQuality {
  const L = QUALITY_LIMITS;
  const points = track.points, n = points.length;
  const unit = worldUnitsPerMeter(track);
  const halfWidthM = (i: number) => getTrackHalfWidth(points[i].trackWidthMeters ?? track.trackWidthMeters) / unit;
  const stepM = (i: number) => Math.hypot(points[(i + 1) % n].x - points[i].x, points[(i + 1) % n].y - points[i].y) / unit;
  const radii = axisRadiiM(track);

  let maxStepM = 0, maxHeadingStepDeg = 0, minRadiusM = Infinity, minRadiusMarginM = Infinity;
  for (let i = 0; i < n; i++) {
    maxStepM = Math.max(maxStepM, stepM(i));
    maxHeadingStepDeg = Math.max(maxHeadingStepDeg, Math.abs(wrap(points[(i + 1) % n].angle - points[i].angle)) * 180 / Math.PI);
    minRadiusM = Math.min(minRadiusM, radii[i]);
    minRadiusMarginM = Math.min(minRadiusMarginM, radii[i] - halfWidthM(i));
  }

  // Bordes: mismas muestras que el eje, sin tramos que retrocedan y a medio ancho del eje.
  const geometry = getPitLaneGeometry(track);
  let edgeFolds = 0, edgeGapM = 0;
  for (const edge of geometry.trackEdges) {
    if (edge.length !== n) { edgeGapM = Infinity; continue; }
    for (let i = 0; i < n; i++) {
      const a = edge[i], b = edge[(i + 1) % n], p = points[i], q = points[(i + 1) % n];
      if ((b.x - a.x) * (q.x - p.x) + (b.y - a.y) * (q.y - p.y) <= 0) edgeFolds++;
      edgeGapM = Math.max(edgeGapM, Math.abs(Math.hypot(a.x - p.x, a.y - p.y) / unit - halfWidthM(i)));
    }
  }
  if (geometry.trackEdges.length < 2) edgeGapM = Infinity;

  // Trazada ideal, en metros a un lado del eje.
  const lateralM = points.map(p => getLateralDisplacement(p.idealLineOffset || 0, p.trackWidthMeters ?? track.trackWidthMeters, p.trackWidthCars ?? 3) / unit);
  let lineSlopeMax = 0, lineOutside = 0;
  for (let i = 0; i < n; i++) {
    lineSlopeMax = Math.max(lineSlopeMax, Math.abs(lateralM[(i + 1) % n] - lateralM[i]) / Math.max(1e-6, stepM(i)));
    if (Math.abs(lateralM[i]) + L.lineMarginM > halfWidthM(i) + 1e-6) lineOutside++;
  }
  // Rectas: tramos seguidos con radio grande; se empieza a recorrer desde una curva para no partir una recta.
  let lineStraightCrossings = 0;
  const firstCorner = radii.findIndex(r => r < L.straightRadiusM);
  if (firstCorner >= 0) {
    let length = 0, crossings = 0, side = 0;
    for (let s = 1; s <= n; s++) {
      const i = (firstCorner + s) % n;
      if (radii[i] >= L.straightRadiusM) {
        length += stepM(i);
        const now = Math.abs(lateralM[i]) > L.sideMarginM ? Math.sign(lateralM[i]) : 0;
        if (now !== 0) { if (side !== 0 && now !== side) crossings++; side = now; }
      } else {
        if (length >= L.straightMinM) lineStraightCrossings = Math.max(lineStraightCrossings, crossings);
        length = 0; crossings = 0; side = 0;
      }
    }
  }

  // Boxes frente a la pista.
  const pit = track.pitLanePoints;
  let pitClearanceM = Infinity, pitTurnDeg = 0;
  // Con túnel (Yas Marina) el carril cruza la pista de verdad: no se mide a menos de 60 m del cruce.
  const tunnel = new Set<number>();
  if (track.pitTunnel) {
    const sideOf = (p: Point2D) => { const near = distanceToPath(p, points, true), q = points[near.index]; return Math.sign((p.x - q.x) * q.normal.x + (p.y - q.y) * q.normal.y); };
    const sides = pit.map(sideOf), reach = Math.ceil(60 / Math.max(0.1, track.lapLengthMeters / n));
    for (let k = 1; k < pit.length; k++) if (sides[k] !== sides[k - 1]) for (let d = -reach; d <= reach; d++) tunnel.add(k + d);
  }
  for (let k = 0; k < pit.length; k++) {
    const u = k / Math.max(1, pit.length - 1);
    if (u >= L.serviceFrom && u <= L.serviceTo && !tunnel.has(k)) {
      const near = distanceToPath(pit[k], points, true);
      pitClearanceM = Math.min(pitClearanceM, near.distance / unit - halfWidthM(near.index) - L.pitWallM - geometry.fastLaneWidth / unit / 2);
    }
    if (k > 0 && k < pit.length - 1) {
      const turn = wrap(Math.atan2(pit[k + 1].y - pit[k].y, pit[k + 1].x - pit[k].x) - Math.atan2(pit[k].y - pit[k - 1].y, pit[k].x - pit[k - 1].x));
      pitTurnDeg = Math.max(pitTurnDeg, Math.abs(turn) * 180 / Math.PI);
    }
  }
  let pitObjectsOnTrack = 0;
  const onTrack = (p: Point2D) => { const near = distanceToPath(p, points, true); return near.distance / unit < halfWidthM(near.index); };
  for (const box of geometry.boxes) for (const corner of box.corners) if (onTrack(corner)) pitObjectsOnTrack++;
  for (const wall of geometry.walls) for (const end of wall) if (onTrack(end)) pitObjectsOnTrack++;

  // Meta y parrilla.
  const lineToPitExitM = (((track.pitExitT % 1) + 1) % 1) * track.lapLengthMeters;
  let gridMinRadiusM = Infinity;
  const gridSamples = Math.ceil(L.gridLengthM / (track.lapLengthMeters / n));
  for (let s = 0; s <= gridSamples; s++) gridMinRadiusM = Math.min(gridMinRadiusM, radii[(n - s) % n]);

  return {
    unitsPerMeter: unit, samples: n, maxStepM, maxHeadingStepDeg, minRadiusM, minRadiusMarginM, edgeFolds, edgeGapM,
    lineSlopeMax, lineOutside, lineStraightCrossings, pitClearanceM, pitObjectsOnTrack, pitTurnDeg, lineToPitExitM, gridMinRadiusM,
  };
}

export interface QualityCheck { id: string; label: string; value: string; limit: string; pass: boolean }

/** Las medidas con su límite, en el orden del contrato de G1. `finishReferenceM`: distancia real de la meta a la salida de boxes. */
export function qualityChecks(q: CircuitQuality, finishReferenceM?: number): QualityCheck[] {
  const L = QUALITY_LIMITS;
  const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '∞');
  const finishError = finishReferenceM === undefined ? undefined : Math.abs(q.lineToPitExitM - finishReferenceM);
  return [
    { id: 'scale', label: 'Escala: una unidad es un metro', value: f(q.unitsPerMeter, 3), limit: `1 ± ${L.scaleTolerance}`, pass: Math.abs(q.unitsPerMeter - 1) <= L.scaleTolerance },
    { id: 'step', label: 'Eje: paso entre muestras', value: `${f(q.maxStepM)} m`, limit: `≤ ${L.maxStepM} m`, pass: q.maxStepM <= L.maxStepM },
    { id: 'radius', label: 'Eje: radio mínimo frente a medio ancho', value: `${f(q.minRadiusMarginM)} m (radio ${f(q.minRadiusM)} m)`, limit: `≥ ${L.radiusMarginM} m`, pass: q.minRadiusMarginM >= L.radiusMarginM },
    { id: 'folds', label: 'Bordes: tramos plegados', value: String(q.edgeFolds), limit: '0', pass: q.edgeFolds === 0 },
    { id: 'edge', label: 'Bordes: línea blanca frente al asfalto', value: `${f(q.edgeGapM, 2)} m`, limit: `≤ ${L.edgeGapM} m`, pass: q.edgeGapM <= L.edgeGapM },
    { id: 'line-crossings', label: 'Trazada: cambios de lado en una recta', value: String(q.lineStraightCrossings), limit: `≤ ${L.straightCrossings}`, pass: q.lineStraightCrossings <= L.straightCrossings },
    { id: 'line-slope', label: 'Trazada: desplazamiento lateral por metro', value: f(q.lineSlopeMax, 2), limit: `≤ ${L.lineSlope}`, pass: q.lineSlopeMax <= L.lineSlope },
    { id: 'line-inside', label: 'Trazada: muestras fuera de los bordes', value: String(q.lineOutside), limit: '0', pass: q.lineOutside === 0 },
    { id: 'pit-clearance', label: 'Boxes: holgura con el borde de la pista', value: `${f(q.pitClearanceM)} m`, limit: '≥ 0 m', pass: q.pitClearanceM >= 0 },
    { id: 'pit-objects', label: 'Boxes: cajones y muros sobre el asfalto', value: String(q.pitObjectsOnTrack), limit: '0', pass: q.pitObjectsOnTrack === 0 },
    { id: 'finish', label: 'Meta: distancia a su referencia', value: finishError === undefined ? 'sin referencia' : `${f(finishError)} m`, limit: `≤ ${L.finishToleranceM} m`, pass: finishError !== undefined && finishError <= L.finishToleranceM },
    { id: 'grid', label: 'Parrilla: ningún puesto en el vértice de una horquilla (radio del eje)', value: `${f(q.gridMinRadiusM, 0)} m`, limit: `≥ ${L.gridRadiusM} m`, pass: q.gridMinRadiusM >= L.gridRadiusM },
  ];
}
