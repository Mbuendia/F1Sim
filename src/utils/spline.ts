export interface Point2D {
  x: number;
  y: number;
}

export interface SplinePoint extends Point2D {
  angle: number;
  normal: Point2D;
  distance: number;
  curvature: number;
  sector: 1 | 2 | 3;
  isDrsZone: boolean;
  drsZoneId?: number;
  isBrakingZone: boolean;
  cornerName?: string;
  speedLimitFactor: number; // 0.35 (horquilla lenta) a 1.0 (recta a fondo)
}

/**
 * Interpolación Catmull-Rom para curvas suaves de circuito
 */
export function catmullRom(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    y: 0.5 * (
      (2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    )
  };
}

export function computeTrackSpline(
  controlPoints: { x: number; y: number; speedLimit?: number; corner?: string }[],
  samplesPerSegment: number = 24
): SplinePoint[] {
  const n = controlPoints.length;
  const rawPoints: { x: number; y: number; speedLimit: number; corner?: string }[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p3 = controlPoints[(i + 2) % n];

    const s1 = p1.speedLimit ?? 1.0;
    const s2 = p2.speedLimit ?? 1.0;

    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const pt = catmullRom(p0, p1, p2, p3, t);
      const speedLimit = s1 + (s2 - s1) * t;
      const corner = j === 0 ? p1.corner : undefined;
      rawPoints.push({ x: pt.x, y: pt.y, speedLimit, corner });
    }
  }

  // Calcular distancias acumuladas, ángulos, normales y curvatura
  const total = rawPoints.length;
  const splinePoints: SplinePoint[] = [];
  let accumDistance = 0;

  for (let i = 0; i < total; i++) {
    const curr = rawPoints[i];
    const next = rawPoints[(i + 1) % total];
    const prev = rawPoints[(i - 1 + total) % total];

    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const dist = Math.hypot(dx, dy);

    const angle = Math.atan2(dy, dx);
    const normal = { x: -Math.sin(angle), y: Math.cos(angle) };

    // Curvatura aproximada (cambio de ángulo por distancia)
    const prevAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    let dAngle = angle - prevAngle;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    const curvature = Math.abs(dAngle) / Math.max(0.001, dist);

    // Determinar sector (S1: ~0% a 32%, S2: ~32% a 68%, S3: ~68% a 100%)
    const progressFrac = i / total;
    let sector: 1 | 2 | 3 = 1;
    if (progressFrac > 0.68) sector = 3;
    else if (progressFrac > 0.32) sector = 2;

    // DRS zones en Barcelona:
    // Zona 1: Recta principal (progress ~ 0.88 a 1.0 y 0.0 a 0.08)
    // Zona 2: Contrarrecta (progress ~ 0.42 a 0.54)
    const isDrs1 = progressFrac >= 0.88 || progressFrac <= 0.08;
    const isDrs2 = progressFrac >= 0.42 && progressFrac <= 0.54;
    const isDrsZone = isDrs1 || isDrs2;
    const drsZoneId = isDrs1 ? 1 : (isDrs2 ? 2 : undefined);

    const isBrakingZone = curr.speedLimit < 0.65;

    splinePoints.push({
      x: curr.x,
      y: curr.y,
      angle,
      normal,
      distance: accumDistance,
      curvature,
      sector,
      isDrsZone,
      drsZoneId,
      isBrakingZone,
      cornerName: curr.corner,
      speedLimitFactor: Math.min(1.0, Math.max(0.32, curr.speedLimit))
    });

    accumDistance += dist;
  }

  return splinePoints;
}
