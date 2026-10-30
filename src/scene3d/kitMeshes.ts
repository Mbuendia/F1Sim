/**
 * [CK3] Mallas del kit común en la escena 3D: una malla instanciada por pieza (con su atlas de CK2), los rótulos (vallas,
 * pancartas, carteles de metros y el nombre del circuito en la torre) juntos en una malla con un lienzo de patrocinadores
 * de sponsors.ts, y el estadio de Hermanos Rodríguez. Sigue los grupos de `kitGroups`.
 */
import * as THREE from 'three';
import { CIRCUIT_KIT } from './circuitKit';
import { kitFront, type KitInstance, type KitPlacement, type Stadium } from './kitPlacement';
import { SPONSOR_COLORS, type Sponsor } from './sponsors';
import { loadModel } from '../renderer/modelScene';
import { modelUrl } from '../renderer/carModel3d';

const W = (x: number, y: number, z = 0) => new THREE.Vector3(x, z, y);
const BY_ID = Object.fromEntries(CIRCUIT_KIT.map(p => [p.id, p]));
const SIGNED = new Set(['valla_publi', 'pancarta', 'cartel_metros']);
/** Piezas que proyectan sombra (las grandes). */
const BRIGHTEN: Record<string, number> = { guardarrail: 2.4 };
const SHADOW = new Set(['grada_comun', 'grada_roja', 'grada_pequena', 'torre_posiciones', 'grua', 'muro_neumaticos', 'bloque_hormigon', 'refugio_comisarios', 'camion']);

export async function buildKit(plan: KitPlacement, base: string): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'kit';
  const byPiece = new Map<string, KitInstance[]>();
  for (const p of plan.pieces) if (!SIGNED.has(p.piece)) (byPiece.get(p.piece) ?? byPiece.set(p.piece, []).get(p.piece)!).push(p);
  await Promise.all([...byPiece].map(async ([piece, list]) => {
    try {
      const gltf = await loadModel(modelUrl(base, BY_ID[piece].file));
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        let material = mesh.material as THREE.MeshStandardMaterial;
        // El guardarraíl de Shanghái tiene una textura de metal muy oscura: más claro para que se vea con la luz del juego.
        if (BRIGHTEN[piece]) { material = material.clone(); material.color.setScalar(BRIGHTEN[piece]); }
        const inst = new THREE.InstancedMesh(mesh.geometry, material, list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
        list.forEach((p, k) => { q.setFromAxisAngle(up, -p.heading); inst.setMatrixAt(k, m.compose(W(p.x, p.y, 0), q, one).multiply(mesh.matrixWorld)); });
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        inst.castShadow = SHADOW.has(piece); inst.receiveShadow = true;
        inst.name = `kit:${piece}`;
        group.add(inst);
      });
    } catch { /* sin esa pieza: se salta */ }
  }));
  const signs = buildSigns(plan);
  if (signs) group.add(signs);
  if (plan.stadium) group.add(buildStadium(plan.stadium));
  return group;
}

/** Lienzo de rótulos: una celda por patrocinador (vallas y pancartas), una por número y patrocinador (carteles de metros)
 *  y una con el nombre del circuito (torre). */
function signAtlas(plan: KitPlacement) {
  const sponsors = [...new Set(plan.pieces.filter(p => p.sponsor).map(p => p.sponsor as Sponsor))];
  const boards = [...new Set(plan.pieces.filter(p => p.piece === 'cartel_metros').map(p => `${p.label}|${p.sponsor}`))];
  const tower = plan.pieces.find(p => p.piece === 'torre_posiciones')?.label ?? '';
  const CW = 512, CH = 128, BW = 128, BH = 180, COLS = 4, BCOLS = 16;
  const rowsA = Math.ceil(sponsors.length / COLS), rowsB = Math.ceil(boards.length / BCOLS);
  const width = CW * COLS, height = rowsA * CH + rowsB * BH + CH;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d')!;
  const cells = new Map<string, [number, number, number, number]>();
  const font = (px: number) => `800 ${px}px 'Rajdhani', 'Arial Black', sans-serif`;
  sponsors.forEach((s, k) => {
    const x = (k % COLS) * CW, y = Math.floor(k / COLS) * CH, { bg, fg } = SPONSOR_COLORS[s];
    ctx.fillStyle = bg; ctx.fillRect(x, y, CW, CH);
    ctx.fillStyle = fg; ctx.font = font(70); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x + CW / 2, y + CH / 2 + 4, CW - 30);
    cells.set(`s|${s}`, [x, y, CW, CH]);
  });
  boards.forEach((key, k) => {
    const [label, s] = key.split('|'), x = (k % BCOLS) * BW, y = rowsA * CH + Math.floor(k / BCOLS) * BH, { bg, fg } = SPONSOR_COLORS[s as Sponsor];
    ctx.fillStyle = '#f4f4f2'; ctx.fillRect(x, y, BW, BH);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.strokeRect(x + 4, y + 4, BW - 8, BH * 0.66 - 6);
    ctx.fillStyle = '#111'; ctx.font = font(label.length > 2 ? 62 : 80); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + BW / 2, y + BH * 0.34, BW - 12);
    ctx.fillStyle = bg; ctx.fillRect(x, y + BH * 0.68, BW, BH * 0.32);
    ctx.fillStyle = fg; ctx.font = font(26); ctx.fillText(s, x + BW / 2, y + BH * 0.84, BW - 10);
    cells.set(`b|${key}`, [x, y, BW, BH]);
  });
  if (tower) {
    const y = rowsA * CH + rowsB * BH;
    ctx.fillStyle = '#b3121b'; ctx.fillRect(0, y, CW, CH);
    ctx.fillStyle = '#fff'; ctx.font = font(80); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tower, CW / 2, y + CH / 2 + 4, CW - 30);
    cells.set('torre', [0, y, CW, CH]);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, cells, width, height: canvas.height };
}

/** Todos los rótulos en una malla: cada uno, un rectángulo con su celda del lienzo por las dos caras. */
function buildSigns(plan: KitPlacement): THREE.Mesh | null {
  const signed = plan.pieces.filter(p => SIGNED.has(p.piece) || p.piece === 'torre_posiciones');
  if (!signed.length) return null;
  const { tex, cells, width, height } = signAtlas(plan);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const quad = (corners: THREE.Vector3[], cell: [number, number, number, number] | undefined, both = true) => {
    if (!cell) return;
    const [x, y, w, h] = cell, u0 = x / width, u1 = (x + w) / width, v1 = 1 - y / height, v0 = 1 - (y + h) / height;
    const add = (cs: THREE.Vector3[], uvs: number[][]) => {
      const b = pos.length / 3;
      cs.forEach(c => pos.push(c.x, c.y, c.z)); uvs.forEach(t => uv.push(...t));
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    add(corners, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    if (both) add([corners[1], corners[0], corners[3], corners[2]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  };
  for (const p of signed) {
    const def = BY_ID[p.piece], L = def.dims[0], c = Math.cos(p.heading), s = Math.sin(p.heading);
    const along = (d: number) => ({ x: c * d, y: s * d });
    if (p.piece === 'valla_publi') {
      const a = along(-L / 2), b = along(L / 2);
      quad([W(p.x + a.x, p.y + a.y, 0.1), W(p.x + b.x, p.y + b.y, 0.1), W(p.x + b.x, p.y + b.y, def.dims[2]), W(p.x + a.x, p.y + a.y, def.dims[2])], cells.get(`s|${p.sponsor}`));
    } else if (p.piece === 'pancarta') {
      const hw = def.dims[1] / 2, a = along(-L / 2), b = along(L / 2), nx = -s * hw, ny = c * hw;
      quad([W(p.x + a.x - nx, p.y + a.y - ny, 0.06), W(p.x + b.x - nx, p.y + b.y - ny, 0.06), W(p.x + b.x + nx, p.y + b.y + ny, 0.06), W(p.x + a.x + nx, p.y + a.y + ny, 0.06)], cells.get(`s|${p.sponsor}`), false);
    } else if (p.piece === 'cartel_metros') {
      const a = along(-0.5), b = along(0.5);
      quad([W(p.x + a.x, p.y + a.y, 0.75), W(p.x + b.x, p.y + b.y, 0.75), W(p.x + b.x, p.y + b.y, 2.15), W(p.x + a.x, p.y + a.y, 2.15)], cells.get(`b|${p.label}|${p.sponsor}`));
    } else if (p.piece === 'torre_posiciones') {
      // Nombre del circuito en lo alto de la torre, delante del panel.
      const f = kitFront(p.piece, p.heading), a = along(-3.4), b = along(3.4), o = { x: p.x + f.x * 1.2, y: p.y + f.y * 1.2 };
      quad([W(o.x + a.x, o.y + a.y, 20.2), W(o.x + b.x, o.y + b.y, 20.2), W(o.x + b.x, o.y + b.y, 22.0), W(o.x + a.x, o.y + a.y, 22.0)], cells.get('torre'));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
  mesh.name = 'kit:rotulos';
  return mesh;
}

/** Estadio: la grada grande con dos pisos y cubierta, palcos de dos plantas y el pórtico con el cartel. */
function buildStadium(st: Stadium): THREE.Group {
  const g = new THREE.Group(); g.name = 'kit:estadio';
  const mats = {
    conc: new THREE.MeshLambertMaterial({ color: '#c9c6bd' }), seatA: new THREE.MeshLambertMaterial({ color: '#9aa3ad' }), seatB: new THREE.MeshLambertMaterial({ color: '#d2782f' }),
    roof: new THREE.MeshLambertMaterial({ color: '#3a3d42', side: THREE.DoubleSide }), white: new THREE.MeshLambertMaterial({ color: '#f1f1ee' }),
    green: new THREE.MeshLambertMaterial({ color: '#1f8a4c' }), glass: new THREE.MeshLambertMaterial({ color: '#2b3440' }),
  };
  const sweep = (path: Stadium['sections'][number]['path'], prof: [number, number, number][], materials: THREE.Material[]) => {
    const groups: Map<number, number[]> = new Map(); const pos: number[] = [];
    path.forEach(q => prof.forEach(([d, z]) => { const p = W(q.x + q.nx * (q.base + d), q.y + q.ny * (q.base + d), z); pos.push(p.x, p.y, p.z); }));
    const m = prof.length;
    for (let k = 0; k < path.length - 1; k++) for (let j = 0; j < m - 1; j++) {
      const a0 = k * m + j, a1 = a0 + 1, b0 = a0 + m, b1 = b0 + 1, mi = prof[j + 1][2];
      (groups.get(mi) ?? groups.set(mi, []).get(mi)!).push(a0, b0, b1, a0, b1, a1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const idx: number[] = []; for (const [mi, list] of groups) { geo.addGroup(idx.length, list.length, mi); idx.push(...list); }
    geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, materials); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  };
  for (const sec of st.sections) {
    if (sec.tier === 'grande') {
      const DD = 0.85, DH = 0.5; const prof: [number, number, number][] = [[0, 0, 0], [0, 1.3, 0]]; let z = 1.3;
      for (let r = 0; r < 18; r++) { z += DH; prof.push([r * DD, z, 0], [(r + 1) * DD, z, 1 + (Math.floor(r / 3) % 2)]); }
      let d = 18 * DD; prof.push([d, z, 0], [d + 3, z, 0], [d + 3, z + 2.5, 0]); z += 2.5; const d0 = d + 3;
      for (let r = 0; r < 16; r++) { z += DH * 1.15; prof.push([d0 + r * DD, z, 0], [d0 + (r + 1) * DD, z, 1]); }
      d = d0 + 16 * DD; prof.push([d, z + 3, 0], [d, 0, 0]);
      sweep(sec.path, prof, [mats.conc, mats.seatA, mats.seatB]);
      const zr = z + 6;
      sweep(sec.path, [[d * 0.35, zr - 1.5, 0], [d + 1, zr + 1.5, 0]], [mats.roof]);
    } else {
      sweep(sec.path, [[2, 0, 0], [2, 3.2, 2], [2, 3.6, 0], [2, 6.8, 2], [2, 7.6, 0], [12, 7.6, 1], [12, 0, 1]], [mats.white, mats.green, mats.glass]);
    }
  }
  // Pórtico con el cartel, centrado entre los muros.
  const p = st.portico, nx = Math.cos(p.heading), ny = Math.sin(p.heading), cx = p.x + nx * p.shift, cy = p.y + ny * p.shift;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(p.span, 3, 4), mats.conc);
  deck.position.copy(W(cx, cy, 10)); deck.rotation.y = -p.heading; deck.castShadow = true; g.add(deck);
  for (const sd of [-1, 1]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(2, 11.5, 2), mats.conc);
    pil.position.copy(W(cx + nx * sd * p.span / 2, cy + ny * sd * p.span / 2, 5.75)); g.add(pil);
  }
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, 1024, 160);
  ctx.font = "900 118px 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const parts: [string, string][] = [['MÉ', '#0b8a3e'], ['XI', '#b9b9b9'], ['CO', '#ce1126']];
  const total = parts.reduce((s, [t]) => s + ctx.measureText(t).width, 0); let x = 512 - total / 2;
  for (const [t, c] of parts) { ctx.fillStyle = c; ctx.textAlign = 'left'; ctx.fillText(t, x, 84); x += ctx.measureText(t).width; }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(p.span * 0.7, 2.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.copy(W(cx, cy, 10)); sign.rotation.y = -p.heading; sign.translateZ(2.05); g.add(sign);
  return g;
}

/** Color del suelo de cada franja del kit (escapatorias y asfalto pintado del estadio). */
export const KIT_STRIP_COLORS = { asfalto: '#3b404b', grava: '#c2ad83', azul: '#1f4fb8', verde: '#2f9a44' } as const;
