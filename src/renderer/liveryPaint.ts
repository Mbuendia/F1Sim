// [TL4, 19/11/2026] Pintura proyectada: la librea dibujada (data/liveryArt.ts) se pinta en dos lienzos de cada costado y
// uno de arriba, y la carrocería los lee según su posición en el coche (attribute carPos, que deja paintZones). Así las
// líneas finas y los cambios de color salen rectos, sin depender de los triángulos del modelo.
import * as THREE from 'three';
import type { ArtShape, LiveryArt } from '../data/liveryArt';
import { EMBLEMS, LOGOS } from './logos';

/** Medidas del coche que necesita la proyección (las deja paintZones en root.userData.carFrame). */
export interface CarFrame { x0: number; x1: number; xr: number; xf: number; top: number; half: number }

const SIDE_W = 2048, SIDE_H = 512, TOP_H = 512;
const cache = new Map<string, { sideR: THREE.Texture; sideL: THREE.Texture; top: THREE.Texture }>();

const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

function drawShapes(ctx: CanvasRenderingContext2D, shapes: ArtShape[], X: (u: number) => number, Y: (y: number) => number, pxU: number, pxY: number, under: string, frame: CarFrame) {
  const base = frame.xf - frame.xr;
  for (const s of shapes) {
    if ('poly' in s) {
      ctx.fillStyle = s.color; ctx.beginPath(); s.poly.forEach(([u, y], i) => (i ? ctx.lineTo(X(u), Y(y)) : ctx.moveTo(X(u), Y(y)))); ctx.closePath(); ctx.fill();
    } else if ('line' in s) {
      ctx.strokeStyle = s.color; ctx.lineWidth = Math.max(1.5, s.width * pxY); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); s.line.forEach(([u, y], i) => (i ? ctx.lineTo(X(u), Y(y)) : ctx.moveTo(X(u), Y(y)))); ctx.stroke();
    } else if ('fade' in s) {
      const [u0, u1, y0, y1] = s.fade;
      const g = ctx.createLinearGradient(X(u0), 0, X(u1), 0);
      g.addColorStop(0, s.color); g.addColorStop(1, s.color + '00');
      ctx.fillStyle = g; ctx.fillRect(Math.min(X(u0), X(u1)), Y(y1), Math.abs(X(u1) - X(u0)), Y(y0) - Y(y1));
    } else {
      const w = s.w * pxU * base / base, h = s.h * pxY;
      const cx = X(s.at[0]), cy = Y(s.at[1]);
      ctx.save(); ctx.translate(cx - w / 2, cy - h / 2);
      if ('text' in s) {
        ctx.fillStyle = s.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let size = h; ctx.font = `${s.italic ? 'italic ' : ''}900 ${size}px "Arial Black", "Barlow", sans-serif`;
        const tw = ctx.measureText(s.text).width; ctx.translate(w / 2, h / 2 + h * 0.04); ctx.scale(Math.min(1.6, w / Math.max(1, tw)), 1);
        ctx.fillText(s.text, 0, 0);
      } else {
        const draw = 'logo' in s ? LOGOS[s.logo] : EMBLEMS[s.emblem];
        if (draw) draw(ctx, w, h, luminance(under) < 0.45);
      }
      ctx.restore();
    }
  }
}

/** Color que hay debajo de un logotipo (para que elija letra clara u oscura): el de la forma que lo contiene. */
function colorUnder(art: LiveryArt, u: number, y: number): string {
  let c = art.base;
  for (const s of art.side) {
    if (!('poly' in s)) continue;
    let inside = false; const p = s.poly;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) && u < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
    }
    if (inside) c = s.color;
  }
  return c;
}

function sideCanvas(art: LiveryArt, f: CarFrame, mirror: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = SIDE_W; c.height = SIDE_H;
  const ctx = c.getContext('2d')!;
  const len = f.x1 - f.x0, base = f.xf - f.xr;
  const nx = (u: number) => (f.xr + u * base - f.x0) / len;
  const X = (u: number) => (mirror ? 1 - nx(u) : nx(u)) * SIDE_W;
  const Y = (y: number) => (1 - y / f.top) * SIDE_H;
  ctx.fillStyle = art.base; ctx.fillRect(0, 0, SIDE_W, SIDE_H);
  const shapes = art.side.filter(s => !('logo' in s || 'emblem' in s || 'text' in s));
  drawShapes(ctx, shapes, X, Y, SIDE_W / len, SIDE_H / f.top, art.base, f);
  // Logotipos: en su sitio, pero sin reflejar (se leen bien desde los dos lados).
  for (const s of art.side) {
    if (!('at' in s)) continue;
    drawShapes(ctx, [s], X, Y, SIDE_W / len, SIDE_H / f.top, colorUnder(art, s.at[0], s.at[1]), f);
  }
  return c;
}

function topCanvas(art: LiveryArt, f: CarFrame): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = SIDE_W; c.height = TOP_H;
  const ctx = c.getContext('2d')!;
  const len = f.x1 - f.x0, base = f.xf - f.xr;
  const X = (u: number) => (f.xr + u * base - f.x0) / len * SIDE_W;
  ctx.fillStyle = art.topBase ?? art.base; ctx.fillRect(0, 0, SIDE_W, TOP_H);
  for (const sign of [1, -1]) {
    const Z = (z: number) => (0.5 - (sign * z) / (2 * f.half)) * TOP_H;
    drawShapes(ctx, art.top, X, Z, SIDE_W / len, TOP_H / (2 * f.half), art.base, f);
  }
  return c;
}

function texture(c: HTMLCanvasElement): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Lienzos de una librea para un coche (se guardan: los comparten los coches del mismo equipo). */
export function liveryTextures(key: string, art: LiveryArt, f: CarFrame) {
  const k = `${key}|${f.x0.toFixed(2)}|${f.x1.toFixed(2)}|${f.top.toFixed(2)}`;
  let t = cache.get(k);
  if (!t) { t = { sideR: texture(sideCanvas(art, f, false)), sideL: texture(sideCanvas(art, f, true)), top: texture(topCanvas(art, f)) }; cache.set(k, t); }
  return t;
}

/** Material de carrocería que lee la librea proyectada. */
export function projectedMaterial(src: THREE.Material, tex: ReturnType<typeof liveryTextures>, f: CarFrame): THREE.Material {
  const m = (src as THREE.MeshStandardMaterial).clone();
  m.name = src.name;
  m.color = new THREE.Color('#ffffff');
  const frame = new THREE.Vector4(f.x0, f.x1 - f.x0, f.top, f.half);
  m.onBeforeCompile = shader => {
    shader.uniforms.lvSideR = { value: tex.sideR };
    shader.uniforms.lvSideL = { value: tex.sideL };
    shader.uniforms.lvTop = { value: tex.top };
    shader.uniforms.lvFrame = { value: frame };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 carPos;\nattribute vec3 carNormal;\nvarying vec3 vCarPos;\nvarying vec3 vCarN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarPos = carPos;\nvCarN = carNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D lvSideR;\nuniform sampler2D lvSideL;\nuniform sampler2D lvTop;\nuniform vec4 lvFrame;\nvarying vec3 vCarPos;\nvarying vec3 vCarN;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 lvN = normalize(vCarN);
        vec3 lvA = abs(lvN);
        float lvU = (vCarPos.x - lvFrame.x) / lvFrame.y;
        float lvV = clamp(vCarPos.y / lvFrame.z, 0.0, 1.0);
        vec4 lvS = vCarPos.z >= 0.0 ? texture2D(lvSideR, vec2(lvU, lvV)) : texture2D(lvSideL, vec2(1.0 - lvU, lvV));
        vec4 lvT = texture2D(lvTop, vec2(lvU, 0.5 + vCarPos.z / (2.0 * lvFrame.w)));
        float lvWs = pow(lvA.z, 4.0) + 0.6 * pow(lvA.x, 4.0);
        float lvWt = pow(lvA.y, 16.0);
        diffuseColor.rgb *= (lvS.rgb * lvWs + lvT.rgb * lvWt) / max(lvWs + lvWt, 1e-4);`);
  };
  m.customProgramCacheKey = () => 'livery-proyectada';
  return m;
}
