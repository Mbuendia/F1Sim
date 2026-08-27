import { SplinePoint, Point2D } from './spline';
import { TrackDefinition, CornerMarker } from '../data/barcelonaTrack';
import { CircuitSpec, OFFICIAL_CIRCUITS } from '../data/circuits';
import svgPathsJson from '../data/svgTrackPaths.json';

const svgPathsMap: Record<string, string> = svgPathsJson as any;

/**
 * Convierte un path SVG oficial en un TrackDefinition calibrado con físicas de aceleración y frenada F1 reales
 */
export function buildTrackFromSvg(circuit: CircuitSpec, sampleCount: number = 700): TrackDefinition {
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

  // ── 1. DETERMINAR Y ALINEAR SENTIDO DE GIRO (CLOCKWISE vs ANTI-CLOCKWISE) ──
  // Calcular el área con el producto cruzado (shoelace formula)
  let areaSum = 0;
  for (let i = 0; i < rawPoints.length; i++) {
    const p1 = rawPoints[i];
    const p2 = rawPoints[(i + 1) % rawPoints.length];
    areaSum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  // En SVG (donde Y crece hacia abajo), areaSum > 0 es Clockwise, areaSum < 0 es Anti-Clockwise
  const isRawClockwise = areaSum > 0;
  const targetClockwise = circuit.direction === 'clockwise';

  let orderedPoints = [...rawPoints];
  if (isRawClockwise !== targetClockwise) {
    // Si la orientación del archivo no coincide con el sentido oficial de la FIA, invertimos el orden
    orderedPoints.reverse();
  }

  // ── 2. ROTAR PARA COLOCAR LA RECTA DE META HORIZONTAL EN LA PARTE INFERIOR ──
  const p0 = orderedPoints[0];
  const p1 = orderedPoints[Math.min(orderedPoints.length - 1, 15)];
  const startAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

  let sumX = 0, sumY = 0;
  orderedPoints.forEach(p => { sumX += p.x; sumY += p.y; });
  const centerX = sumX / orderedPoints.length;
  const centerY = sumY / orderedPoints.length;

  // Si es Clockwise los coches van en la recta hacia la izquierda/derecha
  // Hacemos que la recta de meta sea horizontal (ángulo 0 o PI)
  let rotAngle = -startAngle;
  let rotatedPoints = orderedPoints.map(p => {
    const rx = p.x - centerX;
    const ry = p.y - centerY;
    return {
      x: rx * Math.cos(rotAngle) - ry * Math.sin(rotAngle) + centerX,
      y: rx * Math.sin(rotAngle) + ry * Math.cos(rotAngle) + centerY
    };
  });

  // Si la recta de meta quedó en la mitad superior, rotamos 180º para ponerla abajo
  if (rotatedPoints[0].y < centerY) {
    rotAngle += Math.PI;
    rotatedPoints = orderedPoints.map(p => {
      const rx = p.x - centerX;
      const ry = p.y - centerY;
      return {
        x: rx * Math.cos(rotAngle) - ry * Math.sin(rotAngle) + centerX,
        y: rx * Math.sin(rotAngle) + ry * Math.cos(rotAngle) + centerY
      };
    });
  }

  // ── 3. ESCALADO AL MUNDO DE SIMULACIÓN (1600 x 1000) ──
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
  const targetHeight = 860;
  const scale = Math.min(targetWidth / rawWidth, targetHeight / rawHeight);

  const offsetX = 90 + (targetWidth - rawWidth * scale) / 2;
  const offsetY = 70 + (targetHeight - rawHeight * scale) / 2;

  const worldPoints = rotatedPoints.map(p => ({
    x: (p.x - minRawX) * scale + offsetX,
    y: (p.y - minRawY) * scale + offsetY
  }));

  // ── 4. CÁLCULO DE CURVATURAS, VELOCIDADES Y FRENADAS PREVIAS ──
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

  // Suavizado de curvatura para no tener picos bruscos
  const smoothedCurvatures: number[] = [];
  for (let i = 0; i < total; i++) {
    let sumC = 0;
    const windowSize = 5;
    for (let w = -windowSize; w <= windowSize; w++) {
      const idx = (i + w + total) % total;
      sumC += rawCurvatures[idx];
    }
    smoothedCurvatures.push(sumC / (windowSize * 2 + 1));
  }

  // Velocidades locales en cada punto basadas en el radio de curvatura
  const rawSpeedLimits: number[] = [];
  for (let i = 0; i < total; i++) {
    const curv = smoothedCurvatures[i];
    // Curvatura alta (horquilla) -> factor ~ 0.22 (75 km/h)
    // Curvatura media (curva rápida) -> factor ~ 0.55 - 0.70 (180 - 240 km/h)
    // Recta -> factor 1.0 (340+ km/h)
    const tightness = Math.min(1.0, curv * 55);
    const speed = Math.max(0.24, 1.0 - tightness * 0.76);
    rawSpeedLimits.push(speed);
  }

  // Lookahead para frenadas previas (los F1 empiezan a frenar 120-180m antes del vértice)
  const finalSpeedLimits: number[] = [...rawSpeedLimits];
  const isBrakingZones: boolean[] = new Array(total).fill(false);

  const lookaheadSteps = Math.floor(total * 0.04); // ~28 puntos antes
  for (let i = 0; i < total; i++) {
    const apexSpeed = rawSpeedLimits[i];
    if (apexSpeed < 0.55) {
      // Es una curva que requiere frenada fuerte
      for (let step = 1; step <= lookaheadSteps; step++) {
        const prevIdx = (i - step + total) % total;
        const progressToApex = step / lookaheadSteps;
        // La velocidad límite decrece suavemente desde 1.0 hasta el ápice
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

  // Construcción de SplinePoints con DRS y sectores
  const splinePoints: SplinePoint[] = [];
  accumDist = 0;

  for (let i = 0; i < total; i++) {
    const curr = worldPoints[i];
    const progress = i / total;

    let sector: 1 | 2 | 3 = 1;
    if (progress > 0.67) sector = 3;
    else if (progress > 0.33) sector = 2;

    // Verificar si cae en alguna de las zonas DRS oficiales de este circuito
    let isDrsZone = false;
    let drsZoneId: number | undefined = undefined;

    if (circuit.drsZoneSpecs && circuit.drsZoneSpecs.length > 0) {
      for (const drs of circuit.drsZoneSpecs) {
        let inside = false;
        if (drs.startT > drs.endT) {
          // Zona DRS que cruza la línea de meta (ej. 0.90 a 0.05)
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
      // Fallback genérico a la recta principal
      isDrsZone = progress >= 0.90 || progress <= 0.06;
      drsZoneId = isDrsZone ? 1 : undefined;
    }

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
      speedLimitFactor: finalSpeedLimits[i]
    });

    accumDist += distances[i];
  }

  // ── 5. GENERACIÓN DEL PIT LANE PARALELO A LA RECTA PRINCIPAL ──
  const pitStartIdx = Math.floor(total * 0.93);
  const pitEndIdx = Math.floor(total * 0.07);
  const pitLanePoints: Point2D[] = [];

  const pitOffset = 24;
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

  // ── 6. CURVAS Y BORDES ──
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
    trackWidthMeters: 14,
    corners,
    points: splinePoints,
    pitLanePoints,
    pitEntryT: 0.93,
    pitExitT: 0.07,
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