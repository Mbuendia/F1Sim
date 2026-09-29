/**
 * Muestreo de un path SVG por longitud de arco sin DOM.
 * Equivale a getTotalLength/getPointAtLength: aplana cada segmento en subsegmentos
 * cortos y reparte las muestras de forma uniforme sobre la longitud acumulada.
 * Permite construir la geometría real del circuito también en Node (tests).
 */
type Pt = { x: number; y: number };

const SUBDIVISIONS = 64;

/** Lector secuencial: los flags de arco pueden ir pegados ("a4 4 0 010 8"). */
class PathReader {
  private i = 0;
  constructor(private readonly d: string) {}
  private skip() { while (this.i < this.d.length && /[\s,]/.test(this.d[this.i])) this.i++; }
  done() { this.skip(); return this.i >= this.d.length; }
  command(): string | null {
    this.skip();
    const c = this.d[this.i];
    if (c && /[MmLlHhVvCcSsQqTtAaZz]/.test(c)) { this.i++; return c; }
    return null;
  }
  number(): number {
    this.skip();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(this.d.slice(this.i));
    if (!m) throw new Error(`Número esperado en path SVG en la posición ${this.i}`);
    this.i += m[0].length;
    return parseFloat(m[0]);
  }
  flag(): number {
    this.skip();
    const c = this.d[this.i];
    if (c !== '0' && c !== '1') throw new Error(`Flag de arco esperado en la posición ${this.i}`);
    this.i++;
    return c === '1' ? 1 : 0;
  }
}

function arcPoints(p0: Pt, rx: number, ry: number, phiDeg: number, large: number, sweep: number, p1: Pt): Pt[] {
  if (rx === 0 || ry === 0 || (p0.x === p1.x && p0.y === p1.y)) return [p1];
  const phi = (phiDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (coef * rx * y1) / ry, cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0.x + p1.x) / 2, cy = sin * cx1 + cos * cy1 + (p0.y + p1.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const th1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dth = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  const out: Pt[] = [];
  for (let k = 1; k <= SUBDIVISIONS; k++) {
    const t = th1 + (dth * k) / SUBDIVISIONS, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    out.push({ x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy });
  }
  out[out.length - 1] = p1;
  return out;
}

/** Polilínea densa equivalente al path (subtrayectos concatenados). */
export function flattenSvgPath(d: string): Pt[] {
  const r = new PathReader(d);
  const pts: Pt[] = [];
  let cmd = '', cur: Pt = { x: 0, y: 0 }, start: Pt = { x: 0, y: 0 };
  let lastCtrl = null as Pt | null, lastCmd = '';
  const num = () => r.number();
  const cubic = (c1: Pt, c2: Pt, p: Pt) => {
    for (let k = 1; k <= SUBDIVISIONS; k++) {
      const t = k / SUBDIVISIONS, u = 1 - t;
      pts.push({
        x: u * u * u * cur.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p.x,
        y: u * u * u * cur.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p.y,
      });
    }
    lastCtrl = c2; cur = p;
  };
  const quad = (c: Pt, p: Pt) => {
    for (let k = 1; k <= SUBDIVISIONS; k++) {
      const t = k / SUBDIVISIONS, u = 1 - t;
      pts.push({ x: u * u * cur.x + 2 * u * t * c.x + t * t * p.x, y: u * u * cur.y + 2 * u * t * c.y + t * t * p.y });
    }
    lastCtrl = c; cur = p;
  };
  while (!r.done()) {
    const next = r.command();
    if (next) cmd = next;
    else if (!cmd) throw new Error('El path SVG debe empezar por un comando');
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cur.x : 0, oy = rel ? cur.y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': cur = { x: ox + num(), y: oy + num() }; start = cur; pts.push(cur); lastCtrl = null; break;
      case 'L': cur = { x: ox + num(), y: oy + num() }; pts.push(cur); lastCtrl = null; break;
      case 'H': cur = { x: (rel ? cur.x : 0) + num(), y: cur.y }; pts.push(cur); lastCtrl = null; break;
      case 'V': cur = { x: cur.x, y: (rel ? cur.y : 0) + num() }; pts.push(cur); lastCtrl = null; break;
      case 'C': { const c1 = { x: ox + num(), y: oy + num() }, c2 = { x: ox + num(), y: oy + num() }, p = { x: ox + num(), y: oy + num() }; cubic(c1, c2, p); break; }
      case 'S': {
        const prev = lastCtrl as Pt | null;
        const c1 = prev && /[CS]/i.test(lastCmd) ? { x: 2 * cur.x - prev.x, y: 2 * cur.y - prev.y } : cur;
        const c2 = { x: ox + num(), y: oy + num() }, p = { x: ox + num(), y: oy + num() }; cubic(c1, c2, p); break;
      }
      case 'Q': { const c = { x: ox + num(), y: oy + num() }, p = { x: ox + num(), y: oy + num() }; quad(c, p); break; }
      case 'T': {
        const prev = lastCtrl as Pt | null;
        const c = prev && /[QT]/i.test(lastCmd) ? { x: 2 * cur.x - prev.x, y: 2 * cur.y - prev.y } : cur;
        const p = { x: ox + num(), y: oy + num() }; quad(c, p); break;
      }
      case 'A': {
        const rx = num(), ry = num(), phi = num();
        const large = r.flag(), sweep = r.flag();
        const p = { x: ox + num(), y: oy + num() };
        pts.push(...arcPoints(cur, rx, ry, phi, large, sweep, p)); cur = p; lastCtrl = null; break;
      }
      case 'Z': cur = start; pts.push(cur); lastCtrl = null; break;
      default: throw new Error(`Comando SVG no soportado: ${cmd}`);
    }
    lastCmd = cmd;
  }
  return pts;
}

/** `count` puntos equiespaciados por longitud de arco, como i/count * getTotalLength(). */
export function sampleSvgPath(d: string, count: number): Pt[] {
  const poly = flattenSvgPath(d);
  if (poly.length < 2) return [];
  const cum = [0];
  for (let k = 1; k < poly.length; k++) cum.push(cum[k - 1] + Math.hypot(poly[k].x - poly[k - 1].x, poly[k].y - poly[k - 1].y));
  const total = cum[cum.length - 1];
  if (!(total > 0)) return [];
  const out: Pt[] = [];
  let seg = 1;
  for (let s = 0; s < count; s++) {
    const target = (s / count) * total;
    while (seg < poly.length - 1 && cum[seg] < target) seg++;
    const span = cum[seg] - cum[seg - 1] || 1, f = (target - cum[seg - 1]) / span;
    out.push({ x: poly[seg - 1].x + (poly[seg].x - poly[seg - 1].x) * f, y: poly[seg - 1].y + (poly[seg].y - poly[seg - 1].y) * f });
  }
  return out;
}
