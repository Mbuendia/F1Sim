import { SplinePoint, Point2D } from './spline';
import { TrackDefinition, CornerMarker } from '../data/barcelonaTrack';
import { CircuitSpec } from '../data/circuits';
import svgPathsJson from '../data/svgTrackPaths.json';

const svgPathsMap: Record<string, string> = svgPathsJson as any;

/**
 * Convierte un path SVG oficial en un TrackDefinition calibrado con geometría auténtica 1:1,
 * preservando la orientación geográfica oficial FIA y satelital.
 */
export function buildTrackFromSvg(circuit: CircuitSpec, sampleCount: number = 750): TrackDefinition {
  const pathD = svgPathsMap[circuit.svgFile] || '';

  const rawPoints: { x: number; y: number }[] = [];

  if (typeof document !== 'undefined' && pathD) {
    try {
      const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svgPath.setAttribute('d', pathD);
      const totalLen = svgPath.getTotalLength();

      if (totalLen > 0) {
        for (let i = 0; i < sampleCount; i++) {
          const dist = (i / sampleCount) * totalLen;
          const pt = svgPath.getPointAtLength(dist);
          rawPoints.push({ x: pt.x, y: pt.y });
        }
      }
    } catch (e) {
      console.warn('Error sampling SVG path:', e);
    }
  }

  if (rawPoints.length === 0) {
    for (let i = 0; i < sampleCount; i++) {
      const angle = (i / sampleCount) * Math.PI * 2;
      rawPoints.push({
        x: 250 + Math.cos(angle) * 180,
        y: 250 + Math.sin(angle) * 140
      });
    }
  }

  // ── 1. DETERMINAR Y ALINEAR SENTIDO DE GIRO (CLOCKWISE vs ANTI-CLOCKWISE) ──
  let areaSum = 0;
  for (let i = 0; i < rawPoints.length; i++) {
    const p1 = rawPoints[i];
    const p2 = rawPoints[(i + 1) % rawPoints.length];
    areaSum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  const isRawClockwise = areaSum < 0;
  const targetClockwise = circuit.direction === 'clockwise';

  let orderedPoints = [...rawPoints];
  if (isRawClockwise !== targetClockwise) {
    orderedPoints.reverse();
  }

  // ── 1.5. APLICAR START OFFSET (SHIFT) ──
  if (circuit.startOffsetT !== undefined) {
    const shiftIndex = Math.floor(circuit.startOffsetT * orderedPoints.length);
    orderedPoints = [
      ...orderedPoints.slice(shiftIndex),
      ...orderedPoints.slice(0, shiftIndex)
    ];
  }

  // ── 2. ESCALADO Y CENTRADO EN EL MUNDO DE SIMULACIÓN (1900 x 1150) ──
  // Manteniendo la orientación geográfica natural y oficial del SVG satelital
  let minRawX = Infinity, maxRawX = -Infinity;
  let minRawY = Infinity, maxRawY = -Infinity;

  orderedPoints.forEach(p => {
    if (p.x < minRawX) minRawX = p.x;
    if (p.x > maxRawX) maxRawX = p.x;
    if (p.y < minRawY) minRawY = p.y;
    if (p.y > maxRawY) maxRawY = p.y;
  });

  const rawWidth = Math.max(1, maxRawX - minRawX);
  const rawHeight = Math.max(1, maxRawY - minRawY);

  const targetWidth = 1900;
  const targetHeight = 1150;
  const scale = Math.min(targetWidth / rawWidth, targetHeight / rawHeight);

  const offsetX = 100 + (targetWidth - rawWidth * scale) / 2;
  const offsetY = 90 + (targetHeight - rawHeight * scale) / 2;

  const worldPoints = orderedPoints.map(p => ({
    x: (p.x - minRawX) * scale + offsetX,
    y: (p.y - minRawY) * scale + offsetY
  }));

  // ── 3. CÁLCULO DE CURVATURAS, VELOCIDADES Y FRENADAS PREVIAS ──
  const total = worldPoints.length;
  const rawCurvatures: number[] = [];
  const distances: number[] = [];
  const angles: number[] = [];
  const normals: Point2D[] = [];

  let accumDist = 0;

  for (let i = 0; i < total; i++) {
    const curr = worldPoints[i];
    const next = worldPoints[(i + 1) % total];
    const prev = worldPoints[(i - 1 + total) % total];

    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const dist = Math.hypot(dx, dy);
    distances.push(dist);

    const angle = Math.atan2(dy, dx);
    angles.push(angle);
    normals.push({ x: -Math.sin(angle), y: Math.cos(angle) });

    const prevAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    let dAngle = angle - prevAngle;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    const curvature = Math.abs(dAngle) / Math.max(0.001, dist);
    rawCurvatures.push(curvature);
  }

  // Suavizado de curvatura
  const smoothedCurvatures: number[] = [];
  const smoothedSignedCurvatures: number[] = [];
  for (let i = 0; i < total; i++) {
    let sumC = 0;
    let sumSignedC = 0;
    const windowSize = 5;
    for (let w = -windowSize; w <= windowSize; w++) {
      const idx = (i + w + total) % total;
      sumC += rawCurvatures[idx];
      
      const curr = worldPoints[idx];
      const prev = worldPoints[(idx - 1 + total) % total];
      const next = worldPoints[(idx + 1) % total];
      
      const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      let dAng = a2 - a1;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      
      sumSignedC += dAng / Math.max(0.001, distances[idx]);
    }
    smoothedCurvatures.push(sumC / (windowSize * 2 + 1));
    smoothedSignedCurvatures.push(sumSignedC / (windowSize * 2 + 1));
  }

  // Velocidades locales en función de la curvatura
  const rawSpeedLimits: number[] = [];
  for (let i = 0; i < total; i++) {
    const curv = smoothedCurvatures[i];
    const tightness = Math.min(1.0, curv * 55);
    const speed = Math.max(0.24, 1.0 - tightness * 0.76);
    rawSpeedLimits.push(speed);
  }

  // Lookahead para frenadas F1
  const finalSpeedLimits: number[] = [...rawSpeedLimits];
  const isBrakingZones: boolean[] = new Array(total).fill(false);

  const lookaheadSteps = Math.floor(total * 0.045);
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
    
    // Q7: Variable track width
    const baseTrackWidthMeters = circuit.trackWidthMeters || 24;
    const baseTrackWidthCars = circuit.trackWidthCars || 3;
    const widthModifier = 0.85 + (speedLimitFactor * 0.3); // from ~0.95 to 1.15
    const segmentWidth = baseTrackWidthMeters * widthModifier;
    const segmentCars = speedLimitFactor > 0.8 ? baseTrackWidthCars : Math.max(1, baseTrackWidthCars - 1);

    // Q8: Ideal racing line with signed curvature
    const signedCurvature = smoothedSignedCurvatures[i];
    const turnIntensity = Math.max(-1, Math.min(1, signedCurvature * 25));
    // Dynamic offset based on turn direction
    let idealOffset = -turnIntensity * 0.70;

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
      idealLineOffset: idealOffset,
      rubberGrip: 0.0 // Grip starts at 0 and goes up to 1.0 across laps
    });

    accumDist += distances[i];
  }

  // ── 4. GENERACIÓN DEL PIT LANE OFICIAL (CARRIL DE BOXES INTERIOR) ──
  const pitEntryT = circuit.pitEntryT !== undefined ? circuit.pitEntryT : 0.92;
  const pitExitT = circuit.pitExitT !== undefined ? circuit.pitExitT : 0.08;
  const pitOffset = circuit.pitOffset !== undefined ? circuit.pitOffset : 38;

  const pitLanePoints = generatePitLanePoints(splinePoints, pitEntryT, pitExitT, pitOffset);

  // ── 5. CURVAS Y BORDES OFICIALES ──
  const corners: CornerMarker[] = [];
  let cornerCount = 0;
  for (let i = 10; i < total - 10; i += 15) {
    const pt = splinePoints[i];
    if (pt.speedLimitFactor < 0.58 && smoothedCurvatures[i] > 0.008) {
      cornerCount++;
      corners.push({
        number: cornerCount,
        name: `T${cornerCount}`,
        t: i / total,
        gear: pt.speedLimitFactor < 0.35 ? 2 : (pt.speedLimitFactor < 0.50 ? 3 : 4),
        apexSpeedKmh: Math.round(pt.speedLimitFactor * 320)
      });
      i += 18;
    }
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
    fullName: circuit.officialGpName,
    location: circuit.location,
    country: circuit.country,
    totalLaps: circuit.totalLaps,
    lapLengthMeters: circuit.lapLengthMeters,
    trackWidthMeters: 24,
    corners,
    points: splinePoints,
    pitLanePoints,
    pitEntryT,
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
