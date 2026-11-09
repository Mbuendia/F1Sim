/**
 * [CR5] Cubierta de luces del hotel de Yas Marina: los paneles de LED de la malla de rombos (uno por rombo, como los de
 * verdad), su color en cada momento (secuencias lentas que recorren la cubierta) y la luz que cae en la pista y en los
 * coches que pasan por debajo. Sin three: RaceScene3D pinta los paneles (InstancedMesh) y la luz.
 * La forma es la del modelo de Blender (scripts/blender/cr5-models.py, `canopy_z`): rombos de 8 m sobre una superelipse.
 */
import { yasCanopyItem } from './landmarksCr5';

export interface CanopyPanel {
  /** Centro del panel en el mundo (x, y en el suelo; z hacia arriba, m). */
  x: number; y: number; z: number;
  /** Posición en la cubierta (−1…1 a lo largo y a lo ancho). */
  u: number; v: number;
  /** Giro del rombo en el suelo (rad). */
  heading: number;
  /** Diagonal del rombo (m). */
  size: number;
}

const CELL = 8;

/** Altura de la cubierta (m) en (u, v), igual que `canopy_z` del modelo. */
export function canopyHeight(u: number, v: number): number {
  const rho = (Math.abs(u) ** 4 + Math.abs(v) ** 4) ** 0.25;
  return 38 + 8 * Math.max(0, 1 - rho * rho);
}

let cache: CanopyPanel[] | null = null;

/** Paneles de LED de la cubierta (en el mundo del juego). */
export function canopyPanels(): CanopyPanel[] {
  if (cache) return cache;
  const c = yasCanopyItem(), a = c.length / 2, b = c.width / 2;
  const cos = Math.cos(c.heading), sin = Math.sin(c.heading);
  const out: CanopyPanel[] = [];
  const base = -a - b + CELL / 2;
  for (let i = 0; base + i * CELL <= a + b; i++) for (let j = 0; base + j * CELL <= a + b; j++) {
    const p = base + i * CELL, q = base + j * CELL;
    const lx = (p + q) / 2, ly = (p - q) / 2, u = lx / a, v = ly / b;
    if (Math.abs(u) ** 4 + Math.abs(v) ** 4 > 0.94) continue;
    out.push({ x: c.x + lx * cos - ly * sin, y: c.y + lx * sin + ly * cos, z: canopyHeight(u, v) + 0.35, u, v, heading: c.heading + Math.PI / 4, size: CELL * 0.62 });
  }
  return (cache = out);
}

const frac = (x: number) => x - Math.floor(x);
function hsl(h: number, s: number, l: number) {
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return { r: f(0), g: f(8), b: f(4) };
}

/**
 * Color de la cubierta en (u, v) a los `s` segundos: ondas lentas de color que recorren la malla a lo largo y a lo
 * ancho, con una secuencia de tonos que cambia cada minuto (azules y violetas, luego magentas y rojos, luego turquesas).
 */
export function canopyColorAt(u: number, v: number, s: number) {
  const seq = s / 60, k = Math.floor(seq), mix = Math.min(1, Math.max(0, (frac(seq) - 0.85) / 0.15));
  const palette = [0.62, 0.9, 0.5];
  const baseHue = palette[k % 3] * (1 - mix) + palette[(k + 1) % 3] * mix;
  const wave = 0.09 * Math.sin(0.22 * s - 4.5 * u) + 0.06 * Math.sin(0.13 * s + 5.2 * v);
  const light = 0.5 + 0.12 * Math.sin(0.3 * s - 3 * u + 2 * v);
  return hsl(frac(baseHue + wave), 0.85, light);
}

/** Color del panel `i` a los `s` segundos (0…1 en cada canal). */
export function panelColor(i: number, s: number) {
  const p = canopyPanels()[i];
  return p ? canopyColorAt(p.u, p.v, s) : { r: 0, g: 0, b: 0 };
}

/**
 * Luz de la cubierta en el punto (x, y) del suelo: color medio de los paneles de encima e intensidad (0 fuera de la
 * cubierta; más fuerte hacia el centro). La usa la escena para teñir la pista y los coches que pasan por debajo.
 */
export function canopyTint(x: number, y: number, s: number) {
  const c = yasCanopyItem(), a = c.length / 2, b = c.width / 2;
  const dx = x - c.x, dy = y - c.y, cos = Math.cos(c.heading), sin = Math.sin(c.heading);
  const u = (dx * cos + dy * sin) / a, v = (-dx * sin + dy * cos) / b;
  const e = Math.abs(u) ** 4 + Math.abs(v) ** 4;
  if (e >= 1) return { r: 0, g: 0, b: 0, intensity: 0 };
  const col = canopyColorAt(u, v, s);
  return { ...col, intensity: Math.sqrt(1 - e) };
}
