import { SplinePoint, Point2D } from './spline';
import { TrackDefinition, CornerMarker } from '../data/barcelonaTrack';
import { CircuitSpec } from '../data/circuits';
import svgPathsJson from '../data/svgTrackPaths.json';

const svgPathsMap: Record<string, string> = svgPathsJson as any;

/**
 * Genera un TrackDefinition con el trazado oficial FIA alineado con la recta de meta en la parte inferior
 */
export function buildTrackFromSvg(circuit: CircuitSpec, sampleCount: number = 650): TrackDefinition {
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

  // Fallback seguro
  if (rawPoints.length === 0) {
    for (let i = 0; i < sampleCount; i++) {
      const angle = (i / sampleCount) * Math.PI * 2;
      rawPoints.push({
        x: 250 + Math.cos(angle) * 180,
        y: 250 + Math.sin(angle) * 140
      });
    }
  }

  // ── 1. ALINEACIÓN: Rotar para que la recta de meta esté horizontal y abajo ──
  // El punto 0 del SVG es la línea de salida/meta
  const p0 = rawPoints[0];
  const p1 = rawPoints[Math.min(rawPoints.length - 1, 15)];
  const initialAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

  // Centro geométrico para rotar
  let sumX = 0, sumY = 0;
  rawPoints.forEach(p => { sumX += p.x; sumY += p.y; });
  const centerX = sumX / rawPoints.length;
  const centerY = sumY / rawPoints.length;

  // Rotamos para hacer la recta horizontal (ángulo 0 o PI)
  let rotAngle = -initialAngle;
  let rotatedPoints = rawPoints.map(p => {
    const rx = p.x - centerX;
    const ry = p.y - centerY;
    return {
      x: rx * Math.cos(rotAngle) - ry * Math.sin(rotAngle) + centerX,
      y: rx * Math.sin(rotAngle) + ry * Math.cos(rotAngle) + centerY
    };
  });

  // Comprobar si la recta de meta (punto 0) quedó arriba o abajo del centroide
  if (rotatedPoints[0].y < centerY) {
    // Si quedó arriba, rotamos 180º para colocarla en la parte inferior
    rotAngle += Math.PI;
    rotatedPoints = rawPoints.map(p => {
      const rx = p.x - centerX;
      const ry = p.y - centerY;
      return {
        x: rx * Math.cos(rotAngle) - ry * Math.sin(rotAngle) + centerX,
        y: rx * Math.sin(rotAngle) + ry * Math.cos(rotAngle) + centerY
      };
    });
  }

  // ── 2. ESCALADO AL MUNDO DE SIMULACIÓN (1600 x 1050) ──
  let minRawX = Infinity, maxRawX = -Infinity;
  let minRawY = Infinity, maxRawY = -Infinity;

  rotatedPoints.forEach(p => {
    if (p.x < minRawX) minRawX = p.x;
    if (p.x > maxRawX) maxRawX = p.x;
    if (p.y < minRawY) minRawY = p.y;
    if (p.y > maxRawY) maxRawY = p.y;
  });

  const rawWidth = Math.max(1, maxRawX - minRawX);
  const rawHeight = Math.max(1, maxRawY - minRawY);

  const targetWidth = 1420;
  const targetHeight = 880;
  const scale = Math.min(targetWidth / rawWidth, targetHeight / rawHeight);

  const offsetX = 90 + (targetWidth - rawWidth * scale) / 2;
  const offsetY = 70 + (targetHeight - rawHeight * scale) / 2;

  const worldPoints = rotatedPoints.map(p => ({
    x: (p.x - minRawX) * scale + offsetX,
    y: (p.y - minRawY) * scale + offsetY
  }));

  // ── 3. CÁLCULO DE DISTANCIAS, ÁNGULOS, CURVATURAS Y SECTORES ──
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

    const cornerTightness = Math.min(1.0, curvature * 45);
    const speedLimit = Math.max(0.38, 1.0 - cornerTightness * 0.62);

    const isBrakingZone = cornerTightness > 0.52;
    const isMainStraight = progress <= 0.08 || progress >= 0.92;
    const isBackStraight = progress >= 0.42 && progress <= 0.58;
    const isDrsZone = (isMainStraight || isBackStraight) && speedLimit > 0.90;
    const drsZoneId = isDrsZone ? (isMainStraight ? 1 : 2) : undefined;

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

  // ── 4. GENERACIÓN DEL PIT LANE PARALELO A LA RECTA INFERIOR ──
  const pitStartIdx = Math.floor(total * 0.94);
  const pitEndIdx = Math.floor(total * 0.06);
  const pitLanePoints: Point2D[] = [];

  const pitOffset = 24; // Offset hacia el interior de la pista
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

  // ── 5. CURVAS Y BORDES ──
  const corners: CornerMarker[] = [];
  let cornerCount = 0;
  for (let i = 8; i < total - 8; i += 12) {
    const pt = splinePoints[i];
    if (pt.isBrakingZone && pt.speedLimitFactor < 0.62) {
      cornerCount++;
      corners.push({
        number: cornerCount,
        name: `T${cornerCount}`,
        t: i / total,
        gear: pt.speedLimitFactor < 0.45 ? 2 : (pt.speedLimitFactor < 0.6 ? 3 : 4),
        apexSpeedKmh: Math.round(pt.speedLimitFactor * 260)
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
      minX: minX - 100,
      maxX: maxX + 100,
      minY: minY - 100,
      maxY: maxY + 100
    }
  };
}
