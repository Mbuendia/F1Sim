import { SplinePoint, Point2D } from './spline';
import { TrackDefinition, CornerMarker } from '../data/barcelonaTrack';
import { CircuitSpec } from '../data/circuits';
import svgPathsJson from '../data/svgTrackPaths.json';

const svgPathsMap: Record<string, string> = svgPathsJson as any;

/**
 * Genera un TrackDefinition de alta fidelidad para cualquier circuito oficial FIA a partir de su path SVG
 */
export function buildTrackFromSvg(circuit: CircuitSpec, sampleCount: number = 600): TrackDefinition {
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

  // Fallback si no se pudo muestrear
  if (rawPoints.length === 0) {
    for (let i = 0; i < sampleCount; i++) {
      const angle = (i / sampleCount) * Math.PI * 2;
      rawPoints.push({
        x: 250 + Math.cos(angle) * 180,
        y: 250 + Math.sin(angle) * 140
      });
    }
  }

  // 1. Normalizar y escalar a dimensiones del mundo de simulación (1600 x 1100)
  let minRawX = Infinity, maxRawX = -Infinity;
  let minRawY = Infinity, maxRawY = -Infinity;

  rawPoints.forEach(p => {
    if (p.x < minRawX) minRawX = p.x;
    if (p.x > maxRawX) maxRawX = p.x;
    if (p.y < minRawY) minRawY = p.y;
    if (p.y > maxRawY) maxRawY = p.y;
  });

  const rawWidth = Math.max(1, maxRawX - minRawX);
  const rawHeight = Math.max(1, maxRawY - minRawY);

  const targetWidth = 1400;
  const targetHeight = 900;
  const scale = Math.min(targetWidth / rawWidth, targetHeight / rawHeight);

  const offsetX = 100 + (targetWidth - rawWidth * scale) / 2;
  const offsetY = 100 + (targetHeight - rawHeight * scale) / 2;

  const worldPoints = rawPoints.map(p => ({
    x: (p.x - minRawX) * scale + offsetX,
    y: (p.y - minRawY) * scale + offsetY
  }));

  // 2. Calcular distancias, ángulos, normales, curvatura y sectores
  const total = worldPoints.length;
  const splinePoints: SplinePoint[] = [];
  let accumDist = 0;

  for (let i = 0; i < total; i++) {
    const curr = worldPoints[i];
    const next = worldPoints[(i + 1) % total];
    const prev = worldPoints[(i - 1 + total) % total];

    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const dist = Math.hypot(dx, dy);

    const angle = Math.atan2(dy, dx);
    const normal: Point2D = { x: -Math.sin(angle), y: Math.cos(angle) };

    const prevAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    let dAngle = angle - prevAngle;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    const curvature = Math.abs(dAngle) / Math.max(0.001, dist);

    const progress = i / total;
    let sector: 1 | 2 | 3 = 1;
    if (progress > 0.67) sector = 3;
    else if (progress > 0.33) sector = 2;

    // Límite de velocidad dinámico basado en la física de curvatura del viraje
    const cornerTightness = Math.min(1.0, curvature * 45);
    const speedLimit = Math.max(0.38, 1.0 - cornerTightness * 0.62);

    const isBrakingZone = cornerTightness > 0.55;
    const isDrsZone = speedLimit > 0.92 && (progress < 0.12 || progress > 0.88 || (progress > 0.45 && progress < 0.58));
    const drsZoneId = isDrsZone ? (progress > 0.40 && progress < 0.60 ? 2 : 1) : undefined;

    splinePoints.push({
      x: curr.x,
      y: curr.y,
      angle,
      normal,
      distance: accumDist,
      curvature,
      sector,
      isDrsZone,
      drsZoneId,
      isBrakingZone,
      speedLimitFactor: speedLimit
    });

    accumDist += dist;
  }

  // 3. Generar Pit Lane paralelo a la recta de salida (inicio del trazado)
  const pitStartIdx = Math.floor(total * 0.94);
  const pitEndIdx = Math.floor(total * 0.06);
  const pitLanePoints: Point2D[] = [];

  const pitOffset = 22; // Offset en metros
  for (let i = pitStartIdx; i < total; i++) {
    const pt = splinePoints[i];
    pitLanePoints.push({
      x: pt.x + pt.normal.x * pitOffset,
      y: pt.y + pt.normal.y * pitOffset
    });
  }
  for (let i = 0; i <= pitEndIdx; i++) {
    const pt = splinePoints[i];
    pitLanePoints.push({
      x: pt.x + pt.normal.x * pitOffset,
      y: pt.y + pt.normal.y * pitOffset
    });
  }

  // 4. Marcadores de curvas
  const corners: CornerMarker[] = [];
  let cornerCount = 0;
  for (let i = 5; i < total - 5; i += 15) {
    const pt = splinePoints[i];
    if (pt.isBrakingZone && pt.speedLimitFactor < 0.60) {
      cornerCount++;
      corners.push({
        number: cornerCount,
        name: `T${cornerCount}`,
        t: i / total,
        gear: pt.speedLimitFactor < 0.45 ? 2 : (pt.speedLimitFactor < 0.6 ? 3 : 4),
        apexSpeedKmh: Math.round(pt.speedLimitFactor * 260)
      });
      i += 20; // Saltar para no duplicar la misma curva
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
    trackWidthMeters: 14,
    corners,
    points: splinePoints,
    pitLanePoints,
    pitEntryT: 0.94,
    pitExitT: 0.06,
    pitBoxT: 0.00,
    sector1EndT: 0.33,
    sector2EndT: 0.67,
    bounds: {
      minX: minX - 120,
      maxX: maxX + 120,
      minY: minY - 120,
      maxY: maxY + 120
    }
  };
}
