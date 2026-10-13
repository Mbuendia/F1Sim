import { SplinePoint, Point2D } from './spline';
import { TrackDefinition, CornerMarker } from '../data/barcelonaTrack';
import { CircuitSpec } from '../data/circuits';
import svgPathsJson from '../data/svgTrackPaths.json';
import { setIdealRacingLine } from './racingLine';
import { sampleSvgPath } from './svgPathSampler';
import { closedFrames, closedLength, resampleClosed, smoothClosed, type AxisFrame } from './circuitGeometry';
import pitLaneRoutes from '../data/pitLaneRoutes.json';
import circuitReferences from '../data/circuitReferences.json';
import { pitLaneClearance } from './pitLaneGeometry';
import { BRAKE_LOOKAHEAD_M, DEFAULT_CURVATURE_GAIN, LAP_REFERENCES } from '../data/lapReferences';

const svgPathsMap: Record<string, string> = svgPathsJson as any;

/** [G3] Paso entre muestras del eje (m), suavizado del trazado de origen (m) y margen del radio mínimo sobre medio ancho (m). */
export const AXIS_STEP_M = 1.9;
const AXIS_SIGMA_M = 3;
const AXIS_RADIUS_MARGIN_M = 6;
/** Margen del mundo alrededor del circuito (m). */
const WORLD_MARGIN_M = 200;
/** Curvatura (1/m) a partir de la cual `turn` vale ±1 y a partir de la cual un tramo lento cuenta como curva numerada. */
const TURN_GAIN = 25;
const CORNER_CURVATURE = 0.008;

/**
 * [G3] Velocidad de paso por curva con el radio real del eje. La aceleración lateral que aguanta el coche crece con
 * la velocidad por el apoyo aerodinámico: a = (A0 + K·v²) / severidad, y en la curva v² = a·R. De ahí
 * v² = A0·R / (severidad − K·R): una horquilla de 12 m se pasa a unos 55 km/h, una curva de 70 m a unos 150 km/h y a
 * partir de unos 300 m de radio se va a fondo. `severity` es la ganancia calibrada por circuito (`curvatureGain`)
 * dividida por `SEVERITY_REFERENCE`. El resultado se devuelve como el factor de velocidad que usa el motor.
 */
export const CORNER_GRIP = { A0: 20, K: 0.0032, SEVERITY_REFERENCE: 25 };
export function cornerSpeedKmh(curvature: number, gain: number): number {
  if (!(curvature > 1e-9)) return Infinity;
  const severity = Math.max(0.05, gain / CORNER_GRIP.SEVERITY_REFERENCE), radius = 1 / curvature;
  const grip = severity - CORNER_GRIP.K * radius;
  return grip <= 1e-9 ? Infinity : Math.sqrt(CORNER_GRIP.A0 * radius / grip) * 3.6;
}
/** Inversa de la velocidad objetivo del motor por tramos (`RaceSimulation`): km/h de paso → factor de velocidad. */
export function cornerSpeedFactor(curvature: number, gain: number): number {
  const kmh = cornerSpeedKmh(curvature, gain);
  if (kmh >= 302.5) return 1;
  if (kmh >= 190) return 0.65 + (kmh - 190) / 450;
  if (kmh >= 120) return 0.4 + (kmh - 120) / 280;
  return Math.max(0.24, 0.2 + (kmh - 68) / 240);
}

interface AxisBake { worldPoints: Point2D[]; frames: AxisFrame[]; toWorld: (p: Point2D) => Point2D }
const axisCache = new Map<string, AxisBake>();
const lineCache = new Map<string, number[]>();
const axisKey = (circuit: CircuitSpec, width: number) =>
  [circuit.id, circuit.svgFile, circuit.direction, circuit.startOffsetT ?? 0, circuit.lapLengthMeters, width].join('|');

/**
 * [G2][G3] Eje del circuito en metros: el trazado SVG se escala a la longitud oficial, se suaviza (sin quiebros y con
 * radio mínimo mayor que medio ancho de pista) y se remuestrea a paso fijo por longitud de arco. Se calcula una vez.
 */
function bakeAxis(circuit: CircuitSpec, trackWidthMeters: number): AxisBake {
  const key = axisKey(circuit, trackWidthMeters);
  const cached = axisCache.get(key);
  if (cached) return cached;

  // Muestreo denso por longitud de arco sin DOM: la misma geometría en navegador y en Node (tests).
  const dense = Math.max(1500, Math.round(circuit.lapLengthMeters / 1.5));
  let raw: Point2D[] = [];
  const pathD = svgPathsMap[circuit.svgFile] || '';
  if (pathD) {
    try { raw = sampleSvgPath(pathD, dense); } catch (e) { console.warn('Error sampling SVG path:', e); }
  }
  if (raw.length === 0) {
    for (let i = 0; i < dense; i++) {
      const angle = (i / dense) * Math.PI * 2;
      raw.push({ x: 250 + Math.cos(angle) * 180, y: 250 + Math.sin(angle) * 140 });
    }
  }

  // Sentido de giro y punto de salida.
  let areaSum = 0;
  for (let i = 0; i < raw.length; i++) {
    const p1 = raw[i], p2 = raw[(i + 1) % raw.length];
    areaSum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  let ordered = [...raw];
  if ((areaSum < 0) !== (circuit.direction === 'clockwise')) ordered.reverse();
  if (circuit.startOffsetT !== undefined) {
    const shift = Math.floor(circuit.startOffsetT * ordered.length);
    ordered = [...ordered.slice(shift), ...ordered.slice(0, shift)];
  }

  // Escala real: el perímetro del eje es la longitud oficial de la vuelta. El suavizado acorta un poco la curva,
  // así que la escala se corrige hasta que el eje definitivo mide lo que debe.
  let minX = Infinity, minY = Infinity;
  for (const p of ordered) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }
  const count = Math.ceil(circuit.lapLengthMeters / AXIS_STEP_M);
  const minRadius = trackWidthMeters / 2 + AXIS_RADIUS_MARGIN_M;
  let scale = circuit.lapLengthMeters / closedLength(ordered);
  let worldPoints: Point2D[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const scaled = ordered.map(p => ({ x: (p.x - minX) * scale + WORLD_MARGIN_M, y: (p.y - minY) * scale + WORLD_MARGIN_M }));
    const uniform = resampleClosed(scaled, dense);
    worldPoints = resampleClosed(smoothClosed(uniform, circuit.lapLengthMeters / dense, AXIS_SIGMA_M, minRadius), count);
    const error = circuit.lapLengthMeters / closedLength(worldPoints);
    if (Math.abs(error - 1) < 1e-4) break;
    scale *= error;
  }
  // Ajuste final exacto de la escala sobre el eje ya remuestreado.
  const exact = circuit.lapLengthMeters / closedLength(worldPoints);
  worldPoints = worldPoints.map(p => ({ x: (p.x - WORLD_MARGIN_M) * exact + WORLD_MARGIN_M, y: (p.y - WORLD_MARGIN_M) * exact + WORLD_MARGIN_M }));
  const finalScale = scale * exact;
  const bake: AxisBake = {
    worldPoints, frames: closedFrames(worldPoints),
    toWorld: p => ({ x: (p.x - minX) * finalScale + WORLD_MARGIN_M, y: (p.y - minY) * finalScale + WORLD_MARGIN_M }),
  };
  axisCache.set(key, bake);
  return bake;
}

/**
 * Convierte un path SVG oficial en un TrackDefinition calibrado con geometría auténtica 1:1,
 * preservando la orientación geográfica oficial FIA y satelital.
 */
export function buildTrackFromSvg(circuit: CircuitSpec, _sampleCount?: number): TrackDefinition {
  const targetClockwise = circuit.direction === 'clockwise';
  const baseTrackWidthMeters = circuit.trackWidthMeters || 12;
  const baseTrackWidthCars = circuit.trackWidthCars || 3;
  const { worldPoints, frames, toWorld } = bakeAxis(circuit, baseTrackWidthMeters);

  // ── 3. CURVATURAS, VELOCIDADES Y FRENADAS PREVIAS ──
  const total = worldPoints.length;
  const stepM = circuit.lapLengthMeters / total;
  const distances: number[] = new Array(total).fill(stepM);
  const angles = frames.map(f => f.angle);
  const normals: Point2D[] = frames.map(f => f.normal);
  let accumDist = 0;

  // Curvatura media en una ventana de unos 12 m: es la que frena al coche, no la de una muestra.
  const smoothedCurvatures: number[] = [];
  const smoothedSignedCurvatures: number[] = [];
  const windowSize = Math.max(1, Math.round(6 / stepM));
  for (let i = 0; i < total; i++) {
    let sumSignedC = 0;
    for (let w = -windowSize; w <= windowSize; w++) sumSignedC += frames[(i + w + total) % total].curvature;
    smoothedSignedCurvatures.push(sumSignedC / (windowSize * 2 + 1));
    smoothedCurvatures.push(Math.abs(smoothedSignedCurvatures[i]));
  }
  // [R06] Un circuito horario gira a derechas en conjunto: el signo neto de la curvatura de un trazado horario marca
  // las curvas a derechas (y al revés en uno antihorario).
  const netSignedCurvature = smoothedSignedCurvatures.reduce((sum, c) => sum + c, 0);
  const rightHandSign = (targetClockwise ? 1 : -1) * (Math.sign(netSignedCurvature) || 1);

  // Velocidades locales en función de la curvatura
  // [R47] Ganancia calibrada por circuito para que la vuelta del motor se acerque a la de referencia.
  const curvatureGain = LAP_REFERENCES[circuit.id]?.curvatureGain ?? DEFAULT_CURVATURE_GAIN;
  const rawSpeedLimits: number[] = [];
  for (let i = 0; i < total; i++) {
    const curv = smoothedCurvatures[i];
    rawSpeedLimits.push(cornerSpeedFactor(curv, curvatureGain));
  }

  // Lookahead para frenadas F1
  const finalSpeedLimits: number[] = [...rawSpeedLimits];
  const isBrakingZones: boolean[] = new Array(total).fill(false);

  // [R47] La rampa de frenada mide metros reales, no una fracción fija de la vuelta.
  const lookaheadSteps = Math.max(2, Math.round(BRAKE_LOOKAHEAD_M / (circuit.lapLengthMeters / total)));
  for (let i = 0; i < total; i++) {
    const apexSpeed = rawSpeedLimits[i];
    if (apexSpeed < 0.55) {
      for (let step = 1; step <= lookaheadSteps; step++) {
        const prevIdx = (i - step + total) % total;
        const progressToApex = step / lookaheadSteps;
        const interpolatedLimit = apexSpeed + (1.0 - apexSpeed) * progressToApex;
        if (interpolatedLimit < finalSpeedLimits[prevIdx]) {
          finalSpeedLimits[prevIdx] = interpolatedLimit;
        }
        if (step <= lookaheadSteps * 0.75) {
          isBrakingZones[prevIdx] = true;
        }
      }
    }
  }

  const splinePoints: SplinePoint[] = [];
  accumDist = 0;

  for (let i = 0; i < total; i++) {
    const curr = worldPoints[i];
    const progress = i / total;

    let sector: 1 | 2 | 3 = 1;
    if (progress > 0.67) sector = 3;
    else if (progress > 0.33) sector = 2;

    let isDrsZone = false;
    let drsZoneId: number | undefined = undefined;

    if (circuit.drsZoneSpecs && circuit.drsZoneSpecs.length > 0) {
      for (const drs of circuit.drsZoneSpecs) {
        let inside = false;
        if (drs.startT > drs.endT) {
          inside = progress >= drs.startT || progress <= drs.endT;
        } else {
          inside = progress >= drs.startT && progress <= drs.endT;
        }
        if (inside) {
          isDrsZone = true;
          drsZoneId = drs.id;
          break;
        }
      }
    } else {
      isDrsZone = progress >= 0.90 || progress <= 0.06;
      drsZoneId = isDrsZone ? 1 : undefined;
    }

    const speedLimitFactor = finalSpeedLimits[i];
    
    // [G2] Ancho real del circuito, igual en toda la vuelta; la capacidad sí baja en las curvas lentas (Q7).
    const segmentWidth = baseTrackWidthMeters;
    // La primera muestra tras un tramo a fondo conserva la capacidad de la recta: ahí empieza la frenada.
    const segmentCars = speedLimitFactor > 0.8 || finalSpeedLimits[(i - 1 + total) % total] >= 0.9 ? baseTrackWidthCars : Math.max(1, baseTrackWidthCars - 1);

    const signedCurvature = smoothedSignedCurvatures[i];

    splinePoints.push({
      x: curr.x,
      y: curr.y,
      angle: angles[i],
      normal: normals[i],
      distance: accumDist,
      curvature: smoothedCurvatures[i],
      sector,
      isDrsZone,
      drsZoneId,
      isBrakingZone: isBrakingZones[i],
      speedLimitFactor,
      trackWidthMeters: segmentWidth,
      trackWidthCars: segmentCars,
      idealLineOffset: 0,   // [G5] la calcula setIdealRacingLine
      rubberGrip: 0.0, // Grip starts at 0 and goes up to 1.0 across laps
      turn: Math.max(-1, Math.min(1, signedCurvature * TURN_GAIN)) * rightHandSign
    });

    accumDist += distances[i];
  }

  // [G5] La trazada depende solo del eje y del ancho: se calcula una vez por circuito.
  const lineKey = axisKey(circuit, baseTrackWidthMeters);
  let line = lineCache.get(lineKey);
  if (!line) {
    setIdealRacingLine(splinePoints);
    line = splinePoints.map(p => p.idealLineOffset);
    lineCache.set(lineKey, line);
  } else {
    const cachedLine = line;
    splinePoints.forEach((p, i) => { p.idealLineOffset = cachedLine[i]; });
  }

  // ── 4. GENERACIÓN DEL PIT LANE OFICIAL (CARRIL DE BOXES INTERIOR) ──
  const pitEntryT = circuit.pitEntryT !== undefined ? circuit.pitEntryT : 0.92;
  const pitExitT = circuit.pitExitT !== undefined ? circuit.pitExitT : 0.08;
  const pitOffset = circuit.pitOffset !== undefined ? circuit.pitOffset : 38;

  // Q20: trazado real (OSM) cuando existe referencia verificada; si no, carril genérico.
  const realRoute = (pitLaneRoutes as unknown as Record<string, { points?: number[][] }>)[circuit.id]?.points;
  const pitLanePoints = realRoute && realRoute.length >= 2
    ? buildRealPitLanePoints(
        realRoute.map(([x, y]) => toWorld({ x, y })),
        worldPoints, pitEntryT, pitExitT, circuit.pitTunnel ? 0 : pitLaneClearance(baseTrackWidthMeters))
    : generatePitLanePoints(splinePoints, pitEntryT, pitExitT, pitOffset);

  // ── 5. CURVAS Y BORDES OFICIALES ──
  // [G7] Curvas con su número real (referencia de una vuelta real, `circuitReferences.json`); cada una se lleva al
  // punto más lento del eje a menos de 40 m. Sin referencia, se detectan por velocidad y curvatura.
  const realCorners = (circuitReferences as Record<string, { corners?: { number: number; letter?: string; t: number }[] }>)[circuit.id]?.corners;
  const corners: CornerMarker[] = realCorners?.length ? realCorners.map(ref => {
    const centre = Math.round(ref.t * total), reach = Math.round(40 / stepM);
    let best = ((centre % total) + total) % total;
    for (let d = -reach; d <= reach; d++) {
      const i = (((centre + d) % total) + total) % total;
      if (splinePoints[i].speedLimitFactor < splinePoints[best].speedLimitFactor - 1e-9) best = i;
    }
    const pt = splinePoints[best];
    return {
      number: ref.number, name: `T${ref.number}${ref.letter ?? ''}`, t: best / total,
      gear: pt.speedLimitFactor < 0.35 ? 2 : (pt.speedLimitFactor < 0.50 ? 3 : 4),
      apexSpeedKmh: Math.round(pt.speedLimitFactor * 320),
    };
  }) : detectCorners();

  function detectCorners(): CornerMarker[] {
    const corners: CornerMarker[] = [];
    let cornerCount = 0;
    // Paso y salto en muestras equivalentes a los de las 750 muestras por vuelta anteriores.
    const cornerStride = Math.max(1, Math.round(total * 15 / 750)), cornerSkip = Math.round(total * 18 / 750);
    for (let i = cornerStride; i < total - cornerStride; i += cornerStride) {
      const pt = splinePoints[i];
      if (pt.speedLimitFactor < 0.58 && smoothedCurvatures[i] > CORNER_CURVATURE) {
        cornerCount++;
        corners.push({
          number: cornerCount,
          name: `T${cornerCount}`,
          t: i / total,
          gear: pt.speedLimitFactor < 0.35 ? 2 : (pt.speedLimitFactor < 0.50 ? 3 : 4),
          apexSpeedKmh: Math.round(pt.speedLimitFactor * 320)
        });
        i += cornerSkip;
      }
    }
    return corners;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  splinePoints.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    name: circuit.name,
    pitLaneTimeLossSec: circuit.pitLaneTimeLossSec,
    drsDetections: circuit.drsDetections,
    fullName: circuit.officialGpName,
    location: circuit.location,
    country: circuit.country,
    totalLaps: circuit.totalLaps,
    lapLengthMeters: circuit.lapLengthMeters,
    trackWidthMeters: baseTrackWidthMeters,
    corners,
    points: splinePoints,
    pitLanePoints,
    pitTunnel: circuit.pitTunnel,
    pitEntryT,
    // Fallback de decisión táctica a 120 m nominales de la entrada, no línea FIA.
    pitCommitmentT: circuit.pitCommitmentT ?? ((pitEntryT - 120 / circuit.lapLengthMeters + 1) % 1),
    pitCommitmentSource: 'calibrated',
    pitExitT,
    pitBoxT: 0.00,
    sector1EndT: 0.33,
    sector2EndT: 0.67,
    bounds: {
      minX: minX - 140,
      maxX: maxX + 140,
      minY: minY - 140,
      maxY: maxY + 140
    }
  };
}

/**
 * Muestrea el intervalo exacto de boxes, incluidas entradas/salidas entre puntos del trazado.
 * Smootherstep suaviza la separación lateral en los empalmes; la velocidad depende del motor.
 */
export function generatePitLanePoints(
  splinePoints: SplinePoint[],
  pitEntryT: number = 0.92,
  pitExitT: number = 0.08,
  pitOffset: number = 38,
  entryFrac: number = 0.28,
  exitFrac: number = 0.28
): Point2D[] {
  const total = splinePoints.length;
  if (total < 2) return [];

  const normalize = (t: number) => ((t % 1) + 1) % 1;
  const entryT = normalize(pitEntryT);
  const exitT = normalize(pitExitT);
  const span = normalize(exitT - entryT);
  if (!Number.isFinite(span) || span < 1e-12) return [];
  if (!Number.isFinite(pitOffset) || !Number.isFinite(entryFrac) || !Number.isFinite(exitFrac) ||
      entryFrac <= 0 || exitFrac <= 0 || entryFrac + exitFrac > 1) {
    throw new RangeError('El carril de boxes necesita un offset finito y transiciones positivas que no se solapen.');
  }
  // Todos los intervalos tienen el mismo delta de trackT, como espera el renderer.
  const segments = Math.max(2, Math.ceil(span * total - 1e-9));

  const pitLanePoints: Point2D[] = [];

  for (let k = 0; k <= segments; k++) {
    const u = k / segments;
    const t = k === segments ? exitT : normalize(entryT + span * u);
    const index = t * total;
    const i = Math.floor(index);
    const fraction = index - i;
    const a = splinePoints[i % total];
    const b = splinePoints[(i + 1) % total];
    const x = a.x + (b.x - a.x) * fraction;
    const y = a.y + (b.y - a.y) * fraction;
    const nx = a.normal.x + (b.normal.x - a.normal.x) * fraction;
    const ny = a.normal.y + (b.normal.y - a.normal.y) * fraction;
    const normalLength = Math.hypot(nx, ny) || 1;

    let currentOffset = pitOffset;

    if (u < entryFrac) {
      // Bifurcación lateral suave; no altera la velocidad del coche.
      const tau = u / entryFrac;
      const factor = tau * tau * tau * (tau * (tau * 6 - 15) + 10);
      currentOffset = pitOffset * factor;
    } else if (u > 1.0 - exitFrac) {
      // Reincorporación lateral suave.
      const tau = (1.0 - u) / exitFrac;
      const factor = tau * tau * tau * (tau * (tau * 6 - 15) + 10);
      currentOffset = pitOffset * factor;
    } else {
      // Separación nominal de la zona de servicio.
      currentOffset = pitOffset;
    }

    pitLanePoints.push({
      x: x + (nx / normalLength) * currentOffset,
      y: y + (ny / normalLength) * currentOffset
    });
  }

  return pitLanePoints;
}

/**
 * Q20: convierte el trazado real del pit lane (ya en coordenadas de mundo) en la ruta del motor.
 * Los extremos se anclan exactamente a la línea central en pitEntryT/pitExitT mediante una
 * transición gradual (sin quiebros); después se suaviza y se remuestrea a paso uniforme para que
 * el avance en boxes sea proporcional a la distancia recorrida.
 */
export function buildRealPitLanePoints(route: Point2D[], centerline: Point2D[], pitEntryT: number, pitExitT: number, clearance = 0): Point2D[] {
  const n = centerline.length;
  if (n < 2 || route.length < 2) return [];
  const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
  const centerAt = (t: number): Point2D => {
    const x = (((t % 1) + 1) % 1) * n, i = Math.floor(x) % n, f = x - Math.floor(x);
    const a = centerline[i], b = centerline[(i + 1) % n];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  const cumulative = (points: Point2D[]) => points.reduce<number[]>((acc, p, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + distance(p, points[i - 1]));
    return acc;
  }, []);
  const entry = centerAt(pitEntryT), exit = centerAt(pitExitT);

  // Orientar de entrada a salida con independencia del sentido en que se trazó la vía.
  let points = route.filter((p, i) => i === 0 || distance(p, route[i - 1]) > 1e-6);
  if (distance(points[points.length - 1], entry) < distance(points[0], entry)) points = [...points].reverse();

  // Separación y reincorporación tangentes: cerca de cada extremo la ruta se funde con la línea
  // central (a la misma distancia recorrida), de modo que sale y entra en la pista sin quiebro.
  let perimeter = 0;
  for (let i = 0; i < n; i++) perimeter += distance(centerline[i], centerline[(i + 1) % n]);
  const along = cumulative(points), total = along[along.length - 1];
  const blend = Math.max(1e-6, Math.min(total * 0.15, 60));
  const weight = (u: number) => (u >= 1 ? 1 : u * u * (3 - 2 * u));
  points = points.map((p, i) => {
    const fromEntry = along[i], toExit = total - along[i];
    if (fromEntry < blend) {
      const q = centerAt(pitEntryT + fromEntry / perimeter), w = weight(fromEntry / blend);
      return { x: q.x + (p.x - q.x) * w, y: q.y + (p.y - q.y) * w };
    }
    if (toExit < blend) {
      const q = centerAt(pitExitT - toExit / perimeter), w = weight(toExit / blend);
      return { x: q.x + (p.x - q.x) * w, y: q.y + (p.y - q.y) * w };
    }
    return p;
  });

  // [G6] La zona de servicio no pisa la pista: donde la ruta real queda más cerca del eje que `clearance` (por el
  // ajuste entre el plano de la pista y el de OpenStreetMap), se aparta hacia fuera. La separación exigida crece de
  // forma gradual desde la entrada y hacia la salida, que siguen fundidas con la pista.
  if (clearance > 0) {
    const nearest = (p: Point2D) => {
      let best = Infinity, q = centerline[0];
      for (let i = 0; i < n; i++) {
        const a = centerline[i], b = centerline[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        const c = { x: a.x + t * dx, y: a.y + t * dy }, d = distance(p, c);
        if (d < best) { best = d; q = c; const length = Math.hypot(dx, dy) || 1; normal = { x: -dy / length, y: dx / length }; }
      }
      return { q, d: best, normal };
    };
    let normal: Point2D = { x: 0, y: 0 };
    // Lado de boxes respecto a la pista: el del punto de la ruta más alejado de ella.
    let far = -1, side = 1;
    for (const p of points) { const near = nearest(p); if (near.d > far) { far = near.d; side = Math.sign((p.x - near.q.x) * near.normal.x + (p.y - near.q.y) * near.normal.y) || 1; } }
    const ramp = (u: number) => { const v = Math.max(0, Math.min(1, (Math.min(u, 1 - u) - 0.04) / 0.11)); return v * v * (3 - 2 * v); };
    // Con vértices cada pocos metros: un tramo largo entre dos vértices alejados podría cortar una curva de la pista.
    const sparse = cumulative(points), sparseTotal = sparse[sparse.length - 1];
    const dense: Point2D[] = [];
    for (let j = 0, k = 1, count = Math.max(2, Math.ceil(sparseTotal / 4)); j <= count; j++) {
      const target = (j / count) * sparseTotal;
      while (k < points.length - 1 && sparse[k] < target) k++;
      const f = Math.max(0, Math.min(1, (target - sparse[k - 1]) / (sparse[k] - sparse[k - 1] || 1)));
      dense.push({ x: points[k - 1].x + (points[k].x - points[k - 1].x) * f, y: points[k - 1].y + (points[k].y - points[k - 1].y) * f });
    }
    points = dense;
    const pushed = cumulative(points), pushedTotal = pushed[pushed.length - 1] || 1;
    points = points.map((p, i) => {
      const need = clearance * ramp(pushed[i] / pushedTotal), near = nearest(p);
      if (near.d >= need) return p;
      // Si el punto ha caído al otro lado del eje, se lleva al lado de boxes.
      let dx = p.x - near.q.x, dy = p.y - near.q.y;
      if (near.d < 1e-6 || (dx * near.normal.x + dy * near.normal.y) * side < 0) { dx = near.normal.x * side; dy = near.normal.y * side; }
      const length = Math.hypot(dx, dy) || 1;
      return { x: near.q.x + dx / length * need, y: near.q.y + dy / length * need };
    });
  }

  // Suavizado Chaikin conservando los extremos.
  for (let iteration = 0; iteration < 3; iteration++) {
    const smoothed: Point2D[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (i > 0) smoothed.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      if (i < points.length - 2) smoothed.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    smoothed.push(points[points.length - 1]);
    points = smoothed;
  }

  // [G6] Sin quiebros: la ruta se remata con un suavizado corto que conserva los extremos.
  if (clearance > 0) {
    for (let pass = 0; pass < 24; pass++) {
      points = points.map((p, i) => (i === 0 || i === points.length - 1 ? p
        : { x: p.x / 2 + (points[i - 1].x + points[i + 1].x) / 4, y: p.y / 2 + (points[i - 1].y + points[i + 1].y) / 4 }));
    }
  }

  // Remuestreo uniforme con el paso medio de la pista.
  const s = cumulative(points), length = s[s.length - 1];
  const count = Math.max(10, Math.ceil(length / (perimeter / n)));
  const result: Point2D[] = [];
  let k = 1;
  for (let j = 0; j <= count; j++) {
    const target = (j / count) * length;
    while (k < points.length - 1 && s[k] < target) k++;
    const span = s[k] - s[k - 1] || 1, f = Math.max(0, Math.min(1, (target - s[k - 1]) / span));
    result.push({ x: points[k - 1].x + (points[k].x - points[k - 1].x) * f, y: points[k - 1].y + (points[k].y - points[k - 1].y) * f });
  }
  result[0] = entry;
  result[result.length - 1] = exit;
  return result;
}
