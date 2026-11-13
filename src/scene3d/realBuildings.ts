/**
 * [CR6] Edificios reales de OpenStreetMap levantados con su huella y su altura, todos en una sola malla por circuito
 * (una llamada de dibujo). Las fachadas llevan una textura de ventanas por planta (3,2 m) y vano (4 m) según el estilo
 * de la ciudad; el color de cada edificio sale de la paleta del estilo y es fijo para cada edificio (sin azar).
 * [CR12] Cada edificio se pinta según su uso (`use`, de osm-scenery): solo los de 'ciudad' llevan la fachada de ventanas;
 * una 'nave' (pabellón, almacén, comercio, edificio grande y bajo) va con paredes de panel liso y cubierta de chapa, y
 * una 'cubierta' es una losa sobre pilares, sin paredes. Las gradas no llegan aquí: las pone el escenario.
 */
import * as THREE from 'three';
import type { OsmBuilding } from './osmScenery';

interface Style { walls: string[]; roofs: string[]; window: 'banda' | 'alta' | 'pequena' | 'cristal' | 'cuadrada' | 'panel'; glass: number }
const STYLES: Record<string, Style> = {
  norteamericano: { walls: ['#b9b3a8', '#8f97a3', '#c8c2b5', '#a39486', '#d6d2c8'], roofs: ['#5d5f63', '#6b6f75'], window: 'cuadrada', glass: 0.32 },
  tropical: { walls: ['#f1ece2', '#e8dccb', '#d9e4e6', '#f4e6d0', '#e2eef0'], roofs: ['#c9c4bb', '#a9a49b'], window: 'banda', glass: 0.4 },
  'desierto-americano': { walls: ['#d8c7a6', '#c9b48a', '#e4d6b8', '#b8a07a', '#d2c2a4'], roofs: ['#9d9282', '#8a7f70'], window: 'banda', glass: 0.35 },
  latino: { walls: ['#e6d7bf', '#d9c3a1', '#cfd6c4', '#e9c9a6', '#bfc7cc'], roofs: ['#7c6a58', '#8d5a43'], window: 'cuadrada', glass: 0.3 },
  australiano: { walls: ['#d7cfc0', '#b8b0a2', '#e2ddd2', '#a7a198', '#c9bfae'], roofs: ['#6c6a66', '#8a4b3a'], window: 'cuadrada', glass: 0.34 },
  asiatico: { walls: ['#dfe3e6', '#c5ccd3', '#e9e6df', '#b4bec8', '#d0d6dc'], roofs: ['#8d949b', '#6f767d'], window: 'cristal', glass: 0.45 },
  japones: { walls: ['#e7e3da', '#cfcac0', '#d9dcd8', '#bfc2bd', '#ece8de'], roofs: ['#4f5458', '#5d5048'], window: 'banda', glass: 0.33 },
  arabe: { walls: ['#e9dcc3', '#ddcba8', '#f0e6d2', '#d4c09c', '#e6d8bb'], roofs: ['#cdbd9e', '#bba987'], window: 'pequena', glass: 0.3 },
  caucasico: { walls: ['#d9c9a8', '#cdb991', '#e2d6bd', '#bfae8d', '#d4c4a3'], roofs: ['#8b7e6c', '#6e655a'], window: 'alta', glass: 0.3 },
  neerlandes: { walls: ['#8e5a46', '#a7705a', '#c6b9a3', '#7c4f3f', '#b49b84'], roofs: ['#4f4b48', '#7a3e2e'], window: 'alta', glass: 0.3 },
  // Circuito permanente (no urbano): naves de equipos, oficinas y hospitalidad de chapa clara o gris antracita, con una
  // franja de cristal oscuro por planta y las juntas de los paneles; cubiertas de chapa gris.
  circuito: { walls: ['#e9ecef', '#d5dade', '#f4f5f6', '#b9c0c7', '#5f666e', '#cfd8df'], roofs: ['#8e959c', '#a9afb5', '#737a81'], window: 'panel', glass: 0.18 },
};
/** [CR12] Naves y cubiertas: panel de chapa clara y cubierta de chapa gris, iguales en cualquier ciudad. */
const HALL = { walls: ['#e4e7ea', '#cfd5da', '#b8c0c7', '#dcd8cf', '#9aa3ab'], roofs: ['#9aa1a8', '#b4bac0', '#7d858c'], pillar: '#8b9299' };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

/** Cómo se pinta un edificio: paredes con ventanas (ciudad), de panel liso (nave) o ninguna (cubierta), y sus colores. */
export interface BuildingLook { walls: 'ventanas' | 'panel' | 'ninguna'; wall: string; roof: string }
export function buildingLook(b: Pick<OsmBuilding, 'osm' | 'use'>, styleName: string): BuildingLook {
  const style = STYLES[styleName] ?? STYLES.norteamericano;
  const pick = (list: string[], salt: string) => list[Math.floor(hash(b.osm + salt) * list.length) % list.length];
  if (b.use === 'cubierta') return { walls: 'ninguna', wall: HALL.pillar, roof: pick(HALL.roofs, 'r') };
  if (b.use === 'nave') return { walls: 'panel', wall: pick(HALL.walls, ''), roof: pick(HALL.roofs, 'r') };
  return { walls: 'ventanas', wall: pick(style.walls, ''), roof: pick(style.roofs, 'r') };
}

/** Textura de un vano por una planta: pared blanca y ventana oscura (el color lo pone cada edificio). */
function facadeTexture(style: Style): THREE.Texture {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  const glass = Math.round(255 * style.glass), col = `rgb(${glass},${glass + 6},${glass + 14})`;
  g.fillStyle = col;
  // El píxel (2, 2) queda siempre de pared: es donde miran los tejados.
  const rect = { banda: [0.06, 0.3, 0.94, 0.78], alta: [0.3, 0.18, 0.7, 0.8], pequena: [0.38, 0.35, 0.62, 0.65], cristal: [0.04, 0.1, 0.96, 0.92], cuadrada: [0.22, 0.28, 0.78, 0.76], panel: [0, 0.52, 1, 0.8] }[style.window];
  g.fillRect(rect[0] * S, rect[1] * S, (rect[2] - rect[0]) * S, (rect[3] - rect[1]) * S);
  if (style.window === 'panel') {
    // Juntas verticales de los paneles (dos por vano) y la línea del forjado bajo el cristal.
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (const x of [0.25, 0.75]) g.fillRect(x * S - 1, 0, 2, 0.52 * S);
    g.fillRect(0, 0.84 * S, S, 2);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0.62 * S, S, 0.03 * S);
  }
  if (style.window === 'cristal') { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0.46 * S, S, 0.04 * S); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Una malla con todos los edificios: paredes y tejado plano. `ground` da la altura del suelo en un punto (relieve);
 * `toWorld` pasa del plano del juego (x, y, altura) a la escena.
 */
export function buildRealBuildings(buildings: OsmBuilding[], styleName: string, ground: (x: number, y: number) => number,
  toWorld: (x: number, y: number, z: number) => THREE.Vector3): THREE.Mesh | null {
  if (!buildings.length) return null;
  const style = STYLES[styleName] ?? STYLES.norteamericano;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], colr: number[] = [];
  const color = new THREE.Color();
  const BAY = 4, FLOOR = 3.2, FLAT = 0.016, SLAB = 0.5;
  const up = new THREE.Vector3().subVectors(toWorld(0, 0, 1), toWorld(0, 0, 0)).normalize();
  /** Una pared vertical de `a` a `c` entre dos alturas; `u0`/`u1`/`v1` de la textura, o lisa si no se dan. */
  const quad = (a: { x: number; y: number }, c: { x: number; y: number }, z0: number, z1: number, rgb: number[], tex?: [number, number, number]) => {
    const A0 = toWorld(a.x, a.y, z0), C0 = toWorld(c.x, c.y, z0), A1 = toWorld(a.x, a.y, z1), C1 = toWorld(c.x, c.y, z1);
    const n = new THREE.Vector3().subVectors(C0, A0).cross(new THREE.Vector3().subVectors(A1, A0)).normalize();
    const [u0, u1, v1] = tex ?? [FLAT, FLAT, FLAT], v0 = tex ? 0 : FLAT;
    for (const [p, u, v] of [[A0, u0, v0], [C0, u1, v0], [C1, u1, v1], [A0, u0, v0], [C1, u1, v1], [A1, u0, v1]] as [THREE.Vector3, number, number][]) {
      pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(u, v); colr.push(...rgb);
    }
  };
  for (const b of buildings) {
    let pts = b.points.slice();
    if (pts.length > 3 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.01) pts.pop();
    if (pts.length < 3) continue;
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a.x * c.y - c.x * a.y; }
    if (area < 0) pts = pts.reverse();
    const base = Math.min(...pts.map(p => ground(p.x, p.y))), top = base + b.height;
    const look = buildingLook(b, styleName);
    color.set(look.wall).multiplyScalar(0.92 + 0.16 * hash(b.osm + 'l'));
    const wall = [color.r, color.g, color.b];
    // Una cubierta es solo su losa (medio metro de canto) sobre pilares; el resto, paredes de abajo arriba.
    const open = look.walls === 'ninguna', wallFrom = open ? Math.max(base, top - SLAB) : base;
    let run = hash(b.osm + 'u') * BAY;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length], L = Math.hypot(c.x - a.x, c.y - a.y);
      if (L < 0.05) continue;
      quad(a, c, wallFrom, top, wall, look.walls === 'ventanas' ? [run / BAY, (run + L) / BAY, b.height / FLOOR] : undefined);
      run += L;
    }
    if (open && wallFrom > base + 0.5) {
      // Pilares de 0,5 m en las esquinas (doce como mucho, repartidos por el contorno).
      const every = Math.max(1, Math.ceil(pts.length / 12)), cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      for (let i = 0; i < pts.length; i += every) {
        // Un poco hacia dentro, para que el pilar quede bajo la losa.
        const d = Math.hypot(cx - pts[i].x, cy - pts[i].y) || 1, px = pts[i].x + (cx - pts[i].x) / d * 0.6, py = pts[i].y + (cy - pts[i].y) / d * 0.6, h = 0.25;
        const sq = [{ x: px - h, y: py - h }, { x: px + h, y: py - h }, { x: px + h, y: py + h }, { x: px - h, y: py + h }];
        for (let k = 0; k < 4; k++) quad(sq[k], sq[(k + 1) % 4], base, wallFrom, wall);
      }
    }
    // Tejado plano (el píxel de pared de la textura, con el color del tejado).
    color.set(look.roof);
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p.x, p.y)), []);
    for (const tri of tris) {
      // El plano del juego tiene la y hacia abajo: se invierte el orden para que la cara mire arriba.
      for (const idx of [tri[0], tri[2], tri[1]]) {
        const p = toWorld(pts[idx].x, pts[idx].y, top);
        pos.push(p.x, p.y, p.z); nor.push(up.x, up.y, up.z); uv.push(FLAT, FLAT); colr.push(color.r, color.g, color.b);
      }
      // La cara de abajo de una cubierta, que se ve desde la pista.
      if (open) for (const idx of tri) {
        const p = toWorld(pts[idx].x, pts[idx].y, wallFrom);
        pos.push(p.x, p.y, p.z); nor.push(-up.x, -up.y, -up.z); uv.push(FLAT, FLAT); colr.push(color.r * 0.8, color.g * 0.8, color.b * 0.8);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ map: facadeTexture(style), vertexColors: true, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'edificios-reales';
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
