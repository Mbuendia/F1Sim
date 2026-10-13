// [G3][G5] Geometría de circuito a escala real (Sprint 4.5): eje suave remuestreado por longitud de arco y
// trazada de mínima curvatura. Funciones puras sobre curvas cerradas; las distancias son metros.
import type { Point2D } from './spline';

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function closedLength(points: Point2D[]): number {
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

/** Remuestrea una curva cerrada en `count` puntos separados por la misma longitud de arco, empezando en el primero. */
export function resampleClosed(points: Point2D[], count: number): Point2D[] {
  const n = points.length, total = closedLength(points), step = total / count;
  const result: Point2D[] = [];
  let i = 0, start = 0, segment = Math.hypot(points[1 % n].x - points[0].x, points[1 % n].y - points[0].y);
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (start + segment < target && i < n - 1) {
      start += segment; i++;
      segment = Math.hypot(points[(i + 1) % n].x - points[i].x, points[(i + 1) % n].y - points[i].y);
    }
    const f = segment > 1e-12 ? Math.min(1, Math.max(0, (target - start) / segment)) : 0;
    const a = points[i], b = points[(i + 1) % n];
    result.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return result;
}

/** Radio de la circunferencia que pasa por cada punto y sus vecinos a `k` muestras. */
export function closedRadii(points: Point2D[], k: number): number[] {
  const n = points.length;
  return points.map((b, i) => {
    const a = points[(i - k + n) % n], c = points[(i + k) % n];
    const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (area2 < 1e-9) return Infinity;
    return Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y) * Math.hypot(a.x - c.x, a.y - c.y) / (2 * area2);
  });
}

/** Una pasada de suavizado [1 2 1]/4; `weight` (0..1 por punto) limita dónde actúa. */
function smoothPass(points: Point2D[], weight?: Float64Array): Point2D[] {
  const n = points.length;
  return points.map((p, i) => {
    const a = points[(i - 1 + n) % n], b = points[(i + 1) % n], w = weight ? weight[i] : 1;
    return { x: p.x + w * ((a.x + b.x) / 2 - p.x) / 2, y: p.y + w * ((a.y + b.y) / 2 - p.y) / 2 };
  });
}

/**
 * Suaviza una curva cerrada muestreada a paso uniforme: quita los quiebros del trazado de origen (`sigmaM`) y abre
 * solo las curvas cuyo radio queda por debajo de `minRadiusM`, hasta que todas lo cumplen.
 */
export function smoothClosed(points: Point2D[], stepM: number, sigmaM: number, minRadiusM: number): Point2D[] {
  let current = points;
  // Cada pasada [1 2 1]/4 añade una varianza de medio paso al cuadrado.
  const passes = Math.max(1, Math.round((sigmaM / stepM) ** 2 / 0.5));
  for (let i = 0; i < passes; i++) current = smoothPass(current);
  const n = current.length, k = Math.max(1, Math.round(4 / stepM)), reach = Math.max(2, Math.round(30 / stepM));
  for (let round = 0; round < 400; round++) {
    const radii = closedRadii(current, k);
    const weight = new Float64Array(n);
    let tight = false;
    for (let i = 0; i < n; i++) {
      if (radii[i] >= minRadiusM) continue;
      tight = true;
      for (let d = -reach; d <= reach; d++) {
        const j = (i + d + n) % n, w = 0.5 + 0.5 * Math.cos(Math.PI * d / reach);
        if (w > weight[j]) weight[j] = w;
      }
    }
    if (!tight) break;
    for (let i = 0; i < 4; i++) current = smoothPass(current, weight);
  }
  // Las curvas abiertas a mano se rematan con un suavizado corto: la curvatura cambia de forma gradual.
  for (let i = 0; i < passes; i++) current = smoothPass(current);
  return current;
}

export interface AxisFrame { angle: number; normal: Point2D; curvature: number }

/** Rumbo, normal izquierda y curvatura con signo (1/m) de una curva cerrada a paso uniforme, por diferencias centradas. */
export function closedFrames(points: Point2D[]): AxisFrame[] {
  const n = points.length;
  const angles = points.map((_, i) => {
    const a = points[(i - 1 + n) % n], b = points[(i + 1) % n];
    return Math.atan2(b.y - a.y, b.x - a.x);
  });
  return points.map((p, i) => {
    const a = points[(i - 1 + n) % n], b = points[(i + 1) % n];
    const chord = Math.hypot(b.x - p.x, b.y - p.y) + Math.hypot(p.x - a.x, p.y - a.y);
    const curvature = wrap(angles[(i + 1) % n] - angles[(i - 1 + n) % n]) / Math.max(1e-9, chord);
    return { angle: angles[i], normal: { x: -Math.sin(angles[i]), y: Math.cos(angles[i]) }, curvature };
  });
}

/** Interpolación cúbica periódica (Catmull-Rom) de valores en nodos equiespaciados a `count` muestras. */
function periodicInterpolate(nodes: number[], count: number): number[] {
  const m = nodes.length, result: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = i / count * m, j = Math.floor(u), t = u - j;
    const p0 = nodes[(j - 1 + m) % m], p1 = nodes[j % m], p2 = nodes[(j + 1) % m], p3 = nodes[(j + 2) % m];
    result.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t));
  }
  return result;
}

/**
 * Trazada de mínima curvatura: desplazamiento lateral (m, positivo hacia la normal) de cada punto del eje que hace
 * mínima la suma de segundas diferencias de la trayectoria, sin pasar de `bound`. Se resuelve de grueso a fino
 * (Gauss-Seidel proyectado) y se entrega interpolada con una curva suave: exterior, ápice, exterior. `maxSlope` limita
 * el desplazamiento lateral por metro de avance.
 */
export function minimumCurvatureOffsets(points: Point2D[], normals: Point2D[], bound: number[], stepM: number, maxSlope = Infinity): number[] {
  const n = points.length;
  let offsets = new Array<number>(n).fill(0);
  for (const spacingM of [384, 192, 96, 48, 24, 12]) {
    const m = Math.max(8, Math.round(n * stepM / spacingM));
    if (m >= n) continue;
    const index = Array.from({ length: m }, (_, j) => Math.round(j * n / m) % n);
    const alpha = index.map(i => offsets[i]);
    const limit = index.map(i => bound[i]);
    const at = (j: number) => {
      const k = ((j % m) + m) % m, i = index[k];
      return { x: points[i].x + normals[i].x * alpha[k], y: points[i].y + normals[i].y * alpha[k] };
    };
    for (let iteration = 0; iteration < 4000; iteration++) {
      let change = 0;
      for (let j = 0; j < m; j++) {
        const i = index[j], N = normals[i], C = points[i];
        const a = at(j - 2), b = at(j - 1), c = at(j + 1), d = at(j + 2);
        // Mínimo de |a-2b+P|² + |b-2P+c|² + |P-2c+d|² con P = C + αN.
        const sx = a.x - 4 * b.x - 4 * c.x + d.x, sy = a.y - 4 * b.y - 4 * c.y + d.y;
        // La trazada no se mueve de lado más deprisa que `maxSlope` por metro de avance: el coche puede seguirla.
        const reach = maxSlope * n * stepM / m, before = alpha[(j - 1 + m) % m], after = alpha[(j + 1) % m];
        let low = Math.max(-limit[j], before - reach, after - reach), high = Math.min(limit[j], before + reach, after + reach);
        if (low > high) low = high = (low + high) / 2;
        const next = Math.max(low, Math.min(high, -(N.x * sx + N.y * sy) / 6 - (N.x * C.x + N.y * C.y)));
        change = Math.max(change, Math.abs(next - alpha[j]));
        alpha[j] = next;
      }
      if (change < 0.0005) break;
    }
    offsets = periodicInterpolate(alpha, n).map((value, i) => Math.max(-bound[i], Math.min(bound[i], value)));
  }
  return offsets;
}
