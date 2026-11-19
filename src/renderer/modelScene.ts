// [R55] Utilidades de three para los visores de modelos (solo las importan los visores, que se cargan bajo demanda).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CAR_MODEL, DECAL_BACKGROUND, SAFETY_CAR_MODEL, applyLivery, carModelFiles, decalTexts, liveryColors, modelUrl, textColorOn, upgradePartsFile } from './carModel3d';
import { upgradeNodeNames } from '../simulation/upgradeParts';
import type { UpgradeLevels } from '../simulation/upgradeParts';
import { SAFETY_CAR_LIVERY } from '../data/liveries';
import { brandStyle } from '../data/brands';
import type { BrandEmblem } from '../data/brands';
import { EMBLEMS, LOGOS } from './logos';
import { liveryTextures, projectedMaterial } from './liveryPaint';
import type { CarFrame } from './liveryPaint';
import type { LiveryArt } from '../data/liveryArt';

/** [PF3] Los modelos van comprimidos con meshopt (scripts/compress-models.mjs): el cargador lleva su descompresor. */
export function loadModel(url: string): Promise<GLTF> {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
}

/**
 * [TL7] El coche de un año (carModelFiles): si su archivo no llega (sin conexión y sin haberlo usado antes), el de 2025.
 * `lod`: la versión lejana.
 */
export async function loadCarModel(base: string, year: number | null | undefined, lod = false): Promise<GLTF> {
  const files = carModelFiles(year), fallback = carModelFiles(null);
  const file = lod ? files.lod : files.file;
  let gltf: GLTF;
  try {
    gltf = await loadModel(modelUrl(base, file));
  } catch (error) {
    if (file === (lod ? fallback.lod : fallback.file)) throw error;
    gltf = await loadModel(modelUrl(base, lod ? fallback.lod : fallback.file));
  }
  paintZones(gltf.scene);
  splitNose(gltf.scene);
  return gltf;
}

/**
 * [TL4, 19/11/2026, el usuario: «que se puedan cambiar el morro»] Separa el morro (con el alerón delantero) del resto de
 * la carrocería: las caras por delante del eje delantero, menos las tomas de freno y la suspensión junto a la rueda. Las
 * piezas nuevas se llaman «morro» y la parada las mueve al cambiarlo. Vale para los cuatro coches (se hace al cargar).
 */
export function splitNose(root: THREE.Object3D): number {
  const frame = root.userData.carFrame as CarFrame | undefined;
  if (!frame) return 0;
  const cut = frame.xf + 0.2;
  const p = new THREE.Vector3();
  const meshes: THREE.Mesh[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry.index || /wheel|band|mejora|morro/.test(m.name + (m.parent?.name ?? ''))) return;
    if (m.name.startsWith('decal') || m.parent?.name.startsWith('decal')) {
      // El dorsal y los rótulos del morro se van con él.
      if (new THREE.Box3().setFromObject(m).getCenter(p).x > cut) m.userData.morro = true;
      return;
    }
    meshes.push(m);
  });
  let moved = 0;
  for (const mesh of meshes) {
    const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index!;
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: idx.count, materialIndex: 0 }];
    const keep: { index: number[]; groups: { start: number; count: number; materialIndex: number }[] } = { index: [], groups: [] };
    const nose: typeof keep = { index: [], groups: [] };
    for (const g of groups) {
      const k0 = keep.index.length, n0 = nose.index.length;
      for (let i = g.start; i < g.start + g.count; i += 3) {
        let x = 0, az = 0;
        for (let j = 0; j < 3; j++) { p.fromBufferAttribute(pos, idx.getX(i + j)).applyMatrix4(mesh.matrixWorld); x += p.x / 3; az += Math.abs(p.z) / 3; }
        const isNose = x > cut && !(az > 0.4 && x < frame.xf + 0.42);
        (isNose ? nose : keep).index.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
      }
      if (keep.index.length > k0) keep.groups.push({ start: k0, count: keep.index.length - k0, materialIndex: g.materialIndex ?? 0 });
      if (nose.index.length > n0) nose.groups.push({ start: n0, count: nose.index.length - n0, materialIndex: g.materialIndex ?? 0 });
    }
    if (!nose.index.length) continue;
    const make = (part: typeof keep) => {
      const out = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(geo.attributes)) out.setAttribute(name, attr);
      out.setIndex(part.index);
      for (const g of part.groups) out.addGroup(g.start, g.count, g.materialIndex);
      return out;
    };
    const piece = new THREE.Mesh(make(nose), mesh.material);
    piece.name = 'morro'; piece.userData.morro = true;
    piece.position.copy(mesh.position); piece.quaternion.copy(mesh.quaternion); piece.scale.copy(mesh.scale);
    mesh.geometry = make(keep);
    mesh.parent?.add(piece);
    moved += nose.index.length / 3;
  }
  return moved;
}

/** [TL4, 19/11/2026] Por debajo de esta altura (m), lo pintado es fondo plano. */
const FLOOR_TOP = 0.06;

/**
 * [TL4, 19/11/2026] Zonas de pintura limpias. Revisión del usuario: «los colores del coche… parece que están puestos a
 * parches… la livery tiene que ser igual» que la del coche real. Los modelos traían las zonas de color de su autor, rotas
 * al reducirlos (trozos de «carbono» en mitad de los paneles). Al cargar cada coche, cada cara de la carrocería se
 * clasifica por su sitio (relativo a los ejes de las ruedas, así sirve para los cuatro coches) en una zona con su
 * material, que la librea pinta: fondo plano y halo en carbono, y morro, punta, tapa motor, aleta, pontón, lateral,
 * alerones y placas. Sin tocar los archivos (el presupuesto de modelos no da para reexportarlos).
 */
type CarbonPiece = 'carbon' | 'halo' | 'paint';
/** [19/11/2026] Qué es cada pieza suelta de lo que el modelo trae en carbono (por su caja), una respuesta por cara. */
function carbonShells(mesh: THREE.Mesh, f: { xf: number; xr: number; top: number }, isCarbon = true): CarbonPiece[] {
  const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index!;
  const p = new THREE.Vector3();
  const keys: string[] = [], parent = new Map<string, string>();
  const find = (k: string) => { let r = k; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(k, r); return r; };
  for (let v = 0; v < pos.count; v++) {
    p.fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld);
    const k = Math.round(p.x * 1000) + ',' + Math.round(p.y * 1000) + ',' + Math.round(p.z * 1000);
    keys.push(k); if (!parent.has(k)) parent.set(k, k);
  }
  for (let i = 0; i < idx.count; i += 3) {
    const a = find(keys[idx.getX(i)]);
    for (const j of [1, 2]) { const b = find(keys[idx.getX(i + j)]); if (a !== b) parent.set(b, a); }
  }
  const box = new Map<string, { n: number; mn: THREE.Vector3; mx: THREE.Vector3 }>();
  const faceRoot: string[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const r = find(keys[idx.getX(i)]); faceRoot.push(r);
    let b = box.get(r); if (!b) box.set(r, b = { n: 0, mn: new THREE.Vector3(Infinity, Infinity, Infinity), mx: new THREE.Vector3(-Infinity, -Infinity, -Infinity) });
    b.n++;
    for (let k = 0; k < 3; k++) { p.fromBufferAttribute(pos, idx.getX(i + k)).applyMatrix4(mesh.matrixWorld); b.mn.min(p); b.mx.max(p); }
  }
  const kind = new Map<string, CarbonPiece>();
  for (const [r, { n, mn, mx }] of box) {
    const dx = mx.x - mn.x, dz = mx.z - mn.z, az = Math.max(Math.abs(mn.z), Math.abs(mx.z));
    const nearWheel = dx < 0.8 && ((mx.x > f.xf - 0.45 && mn.x < f.xf + 0.45) || (mx.x > f.xr - 0.45 && mn.x < f.xr + 0.45));
    let k: CarbonPiece = 'carbon';
    if (!isCarbon) { kind.set(r, 'paint'); continue; }
    if (mx.y < 0.33 && mn.y < 0.08) k = 'carbon';                                       // fondo plano y sus bordes
    else if (mn.x > f.xr + 1.2 && mx.x < f.xf - 0.6 && mn.y > 0.5 && mx.y > 0.8 && dz > 0.35) k = 'halo';
    else if (mx.x < f.xr && mn.y > 0.3) k = 'paint';                                    // alerón trasero (lo reparte la regla del alerón)
    else if (nearWheel && az > 0.4) k = 'carbon';                                       // suspensión y tomas de freno
    else if (n >= 900) k = 'paint';
    else if (!nearWheel && n >= 30 && mn.y > 0.3 && mx.y < 0.82 && az < 0.5) k = 'paint';            // paneles pequeños del costado                                                     // paneles grandes: pontón, bajos del morro
    else if (dz < 0.12 && mx.y > 0.8 * f.top && n >= 200) k = 'paint';                  // aleta de la tapa motor
    kind.set(r, k);
  }
  // Una pieza gigante (todo el coche soldado, como el de 2024): se reparte cara a cara por dónde está cada una. El aro del
  // halo encima de la cabina es halo; lo que sale hacia las ruedas (brazos y tomas de freno) es carbono.
  return faceRoot.map((r, i) => {
    const k = kind.get(r)!;
    const b = box.get(r)!;
    if (b.mx.x - b.mn.x < 3) return k;
    let x = 0, y = 0, az = 0;
    for (let j = 0; j < 3; j++) { p.fromBufferAttribute(pos, idx.getX(i * 3 + j)).applyMatrix4(mesh.matrixWorld); x += p.x / 3; y += p.y / 3; az += Math.abs(p.z) / 3; }
    if (y > 0.8 && x > f.xr + 1.95 && x < f.xf - 0.7 && az < 0.34) return 'halo';
    if (y > 0.15 && y < 0.62 && Math.abs(x - f.xf) < 0.45 && az > 0.3) return 'carbon';
    if (y > 0.15 && y < 0.6 && Math.abs(x - f.xr) < 0.45 && az > 0.38) return 'carbon';
    return k;
  });
}

export function paintZones(root: THREE.Object3D): number {
  const named = new Map<string, THREE.Material>();
  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) for (const x of materialsOf(m)) if (!named.has(x.name)) named.set(x.name, x); });
  const carbon = named.get(CAR_MODEL.materials.carbon), paint = named.get(CAR_MODEL.materials.primary) ?? named.get(CAR_MODEL.materials.secondary);
  if (!carbon || !paint) return 0;
  root.updateMatrixWorld(true);
  const wheel = (n: string) => { const w = root.getObjectByName(n); return w ? new THREE.Vector3().setFromMatrixPosition(w.matrixWorld) : null; };
  const fl = wheel('wheel_FL'), rl = wheel('wheel_RL');
  if (!fl || !rl) return 0;
  const xf = fl.x, xr = rl.x, base = xf - xr;
  const zoneMat = new Map<string, THREE.Material>();
  const matFor = (zone: string) => {
    if (zone === 'carbon') return carbon;
    let m = zoneMat.get(zone);
    if (!m) { m = paint.clone(); m.name = zone; zoneMat.set(zone, m); }
    return m;
  };
  const painted = new Set<string>([CAR_MODEL.materials.primary, CAR_MODEL.materials.secondary]);
  let top = 0, front = -Infinity;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const meshes: THREE.Mesh[] = [];
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.name.startsWith('decal') || mesh.parent?.name.startsWith('decal')) return;
    const name = mesh.material.name;
    if (!painted.has(name) && name !== CAR_MODEL.materials.carbon) return;
    if (/wheel|band|mejora/.test(mesh.name) || /wheel|band|mejora/.test(mesh.parent?.name ?? '')) return;
    meshes.push(mesh);
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      top = Math.max(top, a.y);
      if (painted.has(name) && Math.abs(a.z) < 0.2 && a.y > 0.12 && a.y < 0.6) front = Math.max(front, a.x);
    }
  });
  let moved = 0;
  // La raya entre costado y lateral, recta: los triángulos que la cruzan se cortan por esa altura antes de pintar.
  const splitY = 0.42 * top;
  for (const mesh of meshes) mesh.geometry = splitAtHeight(mesh.geometry, mesh.matrixWorld, splitY);
  // [19/11/2026] Y el borde del fondo plano, también recto (antes salía en sierra por los triángulos).
  for (const mesh of meshes) mesh.geometry = splitAtHeight(mesh.geometry, mesh.matrixWorld, FLOOR_TOP);
  for (const mesh of meshes) {
    const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index;
    if (!idx) continue;
    const wasCarbon = (mesh.material as THREE.Material).name === CAR_MODEL.materials.carbon;
    // [19/11/2026, el usuario: «define bien todo el coche con todas las piezas por separado»] Lo que el modelo trae en
    // carbono son piezas sueltas (halo, brazos de suspensión, tomas de freno, fondo, laterales del pontón, aleta…). Cada
    // pieza se decide entera: carbono, halo, alerón o carrocería pintada. Así no quedan piezas pintadas a medias, en sierra.
    const shellOf = carbonShells(mesh, { xf, xr, top }, wasCarbon);
    const faceZone: string[] = [];
    const faceX: number[] = [], faceAz: number[] = [], faceNy: number[] = [];
    for (let i = 0; i < idx.count; i += 3) {
      const i0 = idx.getX(i), i1 = idx.getX(i + 1), i2 = idx.getX(i + 2);
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      const x = (a.x + b.x + c.x) / 3, y = (a.y + b.y + c.y) / 3, z = (a.z + b.z + c.z) / 3, az = Math.abs(z);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
      const u = (x - xr) / base;
      let zone: string;
      // El ala delantera, menos el morro que pasa por encima de su centro.
      const frontWing = x > xf + 0.35 && (y < 0.36 || (az > 0.5 && y < 0.6)) && !(az < 0.17 && y > 0.11 && !(Math.abs(n.y) > 0.75 && az > 0.08 && y < 0.2));
      const rearWing = x < xr - 0.15 && y > 0.36;
      // [19/11/2026, el usuario: «revisa la parte de atrás»] Detrás del eje trasero y por debajo del alerón (difusor, viga y
      // estructura de choque) todo es carbono: antes salía pintado a trozos.
      const rearLow = x < xr - 0.1 && y <= 0.36;
      // Placas: las caras de los extremos que miran de lado.
      // Las piezas sueltas que son carbono (tomas de freno, suspensión) lo son entero, estén donde estén.
      if (shellOf && shellOf[i / 3] === 'carbon') zone = 'carbon';
      else if (frontWing) zone = az > 0.6 && Math.abs(n.z) > 0.6 ? 'zona_placas' : 'zona_alerones';
      else if (rearLow) zone = 'carbon';
      // Placas del alerón trasero: las caras de los extremos que miran de lado; los planos (casi horizontales) son alerón.
      else if (rearWing) zone = az > 0.3 && Math.abs(n.z) > 0.6 ? 'zona_placas' : 'zona_alerones';
      // [19/11/2026, el usuario: «el suelo es una parte más pequeña»] Solo el borde fino del fondo plano y su cara de arriba,
      // plana y pegada al suelo; lo de debajo del pontón es carrocería y va pintado.
      else if (y < FLOOR_TOP || (n.y > 0.85 && y < 0.12 && u > 0.05 && u < 0.85) || (n.y < -0.7 && y < 0.1)) zone = 'carbon';
      else {
        const piece = shellOf ? shellOf[i / 3] : 'paint';
        if (piece === 'carbon') zone = 'carbon';
        else if (piece === 'halo') zone = 'zona_halo';
        else if (x > front - 0.45 && az < 0.25) zone = 'zona_punta';
        else if (x > xf - 0.05) zone = y > 0.42 * top || n.y > 0.5 ? 'zona_cuerpo' : 'zona_lateral';
        else if (az < 0.05 && y > 0.75 * top && u < 0.55) zone = 'zona_aleta';
        else if (u < 0.6 && az < 0.24 && n.y > 0.15 && y > 0.45 * top) zone = 'zona_tapa';
        else if (u > 0.2 && u < 0.78 && az > 0.24 && n.y > 0.35 && y > 0.42 * top) zone = 'zona_ponton';
        else if (u >= 0.6 && n.y > 0.3 && y > 0.42 * top) zone = 'zona_cuerpo';
        // Los costados, partidos en alto y bajo (casi todas las libreas los parten así).
        else zone = y > 0.42 * top ? 'zona_costado' : 'zona_lateral';
      }
      faceZone.push(zone); faceX.push(x); faceAz.push(az); faceNy.push(Math.abs(n.y));
    }
    // Fronteras sin dientes: dos pasadas en las que cada cara pintada toma la zona que más tienen ella y sus vecinas
    // (las que comparten vértice). El carbono no se mueve.
    // Los vértices de las costuras van repetidos: se reconocen por su posición (al milímetro).
    const keyOf = (v: number) => `${Math.round(pos.getX(v) * 1000)},${Math.round(pos.getY(v) * 1000)},${Math.round(pos.getZ(v) * 1000)}`;
    const vkey = new Map<number, string>();
    const byVertex = new Map<string, number[]>();
    for (let f = 0; f < faceZone.length; f++) for (let k = 0; k < 3; k++) {
      const v = idx.getX(f * 3 + k); let key = vkey.get(v); if (!key) vkey.set(v, key = keyOf(v));
      let l = byVertex.get(key); if (!l) byVertex.set(key, l = []); l.push(f);
    }
    for (let pass = 0; pass < 3; pass++) {
      const next = faceZone.slice();
      for (let f = 0; f < faceZone.length; f++) {
        if (faceZone[f] === 'carbon') continue;
        const votes = new Map<string, number>();
        for (let k = 0; k < 3; k++) for (const g of byVertex.get(vkey.get(idx.getX(f * 3 + k))!) ?? []) {
          const z = faceZone[g]; if (z !== 'carbon') votes.set(z, (votes.get(z) ?? 0) + 1);
        }
        let best = faceZone[f], most = 0;
        for (const [z, c] of votes) if (c > most) { best = z; most = c; }
        // Entre costado y lateral manda la altura (la raya es recta, ya cortada).
        const sides = (z: string) => z === 'zona_costado' || z === 'zona_lateral';
        next[f] = sides(faceZone[f]) && sides(best) ? faceZone[f] : best;
      }
      for (let f = 0; f < next.length; f++) faceZone[f] = next[f];
    }
    // [19/11/2026, el usuario: «el morro… pinta parte del alerón por los laterales»] El morro es la pieza que sigue unida
    // a la carrocería; las piezas sueltas del ala delantera son alerón aunque pasen por debajo del morro. Se recorre la malla
    // desde la carrocería por los vértices compartidos; si el ala está soldada al morro (todo alcanzado), se deja la regla.
    {
      const reached = new Uint8Array(faceZone.length), queue: number[] = [];
      for (let f = 0; f < faceZone.length; f++) if (faceX[f] < xf && faceZone[f] !== 'carbon') { reached[f] = 1; queue.push(f); }
      const seeded = queue.length > 0;
      while (queue.length) {
        const f = queue.pop()!;
        for (let k = 0; k < 3; k++) for (const g of byVertex.get(vkey.get(idx.getX(f * 3 + k))!) ?? []) if (!reached[g]) { reached[g] = 1; queue.push(g); }
      }
      const ahead = faceZone.map((_, f) => f).filter(f => faceX[f] > xf + 0.35 && faceZone[f] !== 'carbon');
      const loose = ahead.filter(f => !reached[f]);
      // Una parte de la malla sin nada de la carrocería (solo el ala, por ejemplo) se queda con la regla de antes.
      if (seeded && loose.length > ahead.length * 0.15) for (const f of ahead) {
        if (!reached[f]) { if (faceZone[f] !== 'zona_placas') faceZone[f] = 'zona_alerones'; }
        else if (faceZone[f] === 'zona_alerones' && faceAz[f] < 0.25) faceZone[f] = 'zona_punta';
      }
      // [19/11/2026, el usuario: «en el morro hay dos líneas negras»] Las caras que no son planas (de lado o de frente)
      // pegadas a la punta del morro son morro, no alerón: los elementos del ala son láminas casi horizontales.
      for (const f of ahead) if (faceZone[f] === 'zona_alerones' && faceAz[f] < 0.17 && faceNy[f] < 0.6) faceZone[f] = 'zona_punta';
    }
    const buckets = new Map<string, number[]>();
    for (let f = 0; f < faceZone.length; f++) {
      const zone = faceZone[f];
      if (!buckets.has(zone)) buckets.set(zone, []);
      buckets.get(zone)!.push(idx.getX(f * 3), idx.getX(f * 3 + 1), idx.getX(f * 3 + 2));
    }
    const zones = [...buckets.keys()];
    const index: number[] = [];
    geo.clearGroups();
    zones.forEach((zone, k) => { const list = buckets.get(zone)!; geo.addGroup(index.length, list.length, k); for (const v of list) index.push(v); });
    geo.setIndex(index);
    // [TL4] Posición y normal de cada vértice en el coche, para la pintura proyectada (liveryPaint.ts).
    const cp = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { a.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); cp[i * 3] = a.x; cp[i * 3 + 1] = a.y; cp[i * 3 + 2] = a.z; }
    geo.setAttribute('carPos', new THREE.BufferAttribute(cp, 3));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), nrm = geo.attributes.normal, cn = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize(); cn[i * 3] = n.x; cn[i * 3 + 1] = n.y; cn[i * 3 + 2] = n.z; }
    geo.setAttribute('carNormal', new THREE.BufferAttribute(cn, 3));
    mesh.material = zones.map(matFor);
    moved += zones.length;
  }
  // Medidas para la proyección.
  let x0 = Infinity, x1 = -Infinity, half = 0;
  root.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { a.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); half = Math.max(half, Math.abs(a.z)); } });
  root.userData.carFrame = { x0, x1, xr, xf, top, half };
  return moved;
}

/**
 * [TL4] Corta por la altura `h` (en el mundo) los triángulos que la cruzan, para que una frontera de color a esa altura
 * salga recta. Devuelve una geometría con índice nuevo; todos los atributos se interpolan en el corte.
 */
function splitAtHeight(geo: THREE.BufferGeometry, world: THREE.Matrix4, h: number): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const names = Object.keys(src.attributes);
  const pos = src.attributes.position;
  const out: Record<string, number[]> = Object.fromEntries(names.map(n => [n, []]));
  const v = new THREE.Vector3();
  const ys = new Float64Array(pos.count);
  for (let i = 0; i < pos.count; i++) ys[i] = v.fromBufferAttribute(pos, i).applyMatrix4(world).y;
  const read = (n: string, i: number) => { const a = src.attributes[n]; const r: number[] = []; for (let k = 0; k < a.itemSize; k++) r.push(a.getComponent(i, k)); return r; };
  const lerp = (n: string, i: number, j: number, s: number) => { const a = read(n, i), b = read(n, j); return a.map((x, k) => x + (b[k] - x) * s); };
  const push = (vals: Record<string, number[]>) => { for (const n of names) out[n].push(...vals[n]); };
  const vert = (i: number) => Object.fromEntries(names.map(n => [n, read(n, i)]));
  const cut = (i: number, j: number) => { const s = (h - ys[i]) / (ys[j] - ys[i]); return Object.fromEntries(names.map(n => [n, lerp(n, i, j, s)])); };
  for (let t = 0; t < pos.count; t += 3) {
    const tri = [t, t + 1, t + 2];
    const above = tri.filter(i => ys[i] > h);
    if (above.length === 0 || above.length === 3) { for (const i of tri) push(vert(i)); continue; }
    // El vértice solo a un lado (a) y los otros dos (b, c), conservando el orden de las caras.
    const lone = above.length === 1 ? above[0] : tri.find(i => ys[i] <= h)!;
    const k = tri.indexOf(lone), b = tri[(k + 1) % 3], c = tri[(k + 2) % 3];
    const pb = cut(lone, b), pc = cut(lone, c);
    push(vert(lone)); push(pb); push(pc);
    push(pb); push(vert(b)); push(vert(c));
    push(pb); push(vert(c)); push(pc);
  }
  const res = new THREE.BufferGeometry();
  for (const n of names) res.setAttribute(n, new THREE.Float32BufferAttribute(out[n], src.attributes[n].itemSize));
  const count = out.position.length / 3;
  res.setIndex(Array.from({ length: count }, (_, i) => i));
  return res;
}

/** [TL4] Piezas de las mejoras del coche de un año (una vez por archivo); null si no llegan: el coche se ve sin ellas. */
const upgradeCache = new Map<string, Promise<THREE.Object3D | null>>();
export function loadUpgradeParts(base: string, year: number | null | undefined): Promise<THREE.Object3D | null> {
  const file = upgradePartsFile(year);
  if (!upgradeCache.has(file)) upgradeCache.set(file, loadModel(modelUrl(base, file)).then(g => g.scene).catch(() => null));
  return upgradeCache.get(file)!;
}

/**
 * [TL4] Monta en un coche las piezas de sus mejoras (las de cada pieza hasta su nivel), pintadas con su librea. Devuelve
 * el grupo montado (para quitarlo) o null si no hay ninguna.
 */
export function mountUpgrades(root: THREE.Object3D, parts: THREE.Object3D | null, levels: UpgradeLevels | null | undefined,
  livery: { primary: string; secondary: string }): THREE.Object3D | null {
  root.getObjectByName('mejoras')?.removeFromParent();
  if (!parts || !levels) return null;
  const names = new Set(upgradeNodeNames(levels));
  if (!names.size) return null;
  const group = new THREE.Group();
  group.name = 'mejoras';
  parts.traverse(o => {
    if (!names.has(o.name)) return;
    const copy = o.clone(true);
    copy.traverse(n => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
      mesh.castShadow = true;
    });
    group.add(copy);
  });
  applyLivery(group, liveryColors(livery, '#ffffff'));
  root.add(group);
  return group;
}

const materialsOf = (mesh: THREE.Mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** Textura con un texto centrado para una superficie de rótulos (coordenadas de glTF: sin voltear). */
export function textTexture(text: string, color: string, aspect: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.height = 128;
  canvas.width = Math.max(48, Math.round(128 * aspect));
  const ctx = canvas.getContext('2d');
  if (ctx && text) {
    const label = text.toUpperCase(), limit = canvas.width * 0.92;
    let size = 96;
    ctx.font = `800 ${size}px sans-serif`;
    const width = ctx.measureText(label).width;
    if (width > limit) size = Math.floor(size * limit / width);
    ctx.font = `800 ${size}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** [TL7] Letras de los logotipos: las de la interfaz (ya cargadas), con respaldo del sistema. */
const LOGO_FONT = {
  condensada: '"Barlow Condensed", "Arial Narrow", sans-serif',
  redonda: '"Barlow", "Segoe UI", Arial, sans-serif',
  pesada: '"Arial Black", "Barlow", sans-serif',
};
if (typeof document !== 'undefined') {
  for (const f of ['800 64px "Barlow Condensed"', 'italic 800 64px "Barlow Condensed"', '700 64px "Barlow"', '600 64px "Barlow"']) void document.fonts?.load?.(f).catch(() => undefined);
}

/** Emblema de un logotipo, centrado en (cx, cy) y de alto `s`. */
function drawEmblem(ctx: CanvasRenderingContext2D, kind: BrandEmblem | undefined, cx: number, cy: number, s: number, color: string, ink: string): void {
  const r = s / 2;
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = ink;
  ctx.beginPath();
  switch (kind) {
    case 'circulo': ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.fillStyle = ink; ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2); ctx.fill(); break;
    case 'escudo': ctx.moveTo(cx - r * 0.8, cy - r); ctx.lineTo(cx + r * 0.8, cy - r); ctx.lineTo(cx + r * 0.8, cy + r * 0.1); ctx.quadraticCurveTo(cx + r * 0.6, cy + r * 0.8, cx, cy + r); ctx.quadraticCurveTo(cx - r * 0.6, cy + r * 0.8, cx - r * 0.8, cy + r * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ink; ctx.fillRect(cx - r * 0.12, cy - r * 0.75, r * 0.24, r * 1.35); break;
    case 'rombo': ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.85, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.85, cy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = ink; ctx.moveTo(cx, cy - r * 0.45); ctx.lineTo(cx + r * 0.38, cy); ctx.lineTo(cx, cy + r * 0.45); ctx.lineTo(cx - r * 0.38, cy); ctx.closePath(); ctx.fill(); break;
    case 'ala': ctx.moveTo(cx - r, cy + r * 0.6); ctx.quadraticCurveTo(cx - r * 0.1, cy - r * 1.1, cx + r * 1.1, cy - r * 0.7); ctx.quadraticCurveTo(cx + r * 0.1, cy - r * 0.2, cx - r * 0.35, cy + r * 0.6); ctx.closePath(); ctx.fill(); break;
    case 'estrella': for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.42 : r, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); break;
    case 'barras': for (let i = 0; i < 4; i++) { const h = s * (0.45 + i * 0.18); ctx.fillRect(cx - r + i * r * 0.52, cy + r - h, r * 0.38, h); } break;
    case 'gota': ctx.moveTo(cx, cy - r); ctx.bezierCurveTo(cx + r * 1.05, cy - r * 0.05, cx + r * 0.85, cy + r, cx, cy + r); ctx.bezierCurveTo(cx - r * 0.85, cy + r, cx - r * 1.05, cy - r * 0.05, cx, cy - r); ctx.fill(); break;
    case 'concha': for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; ctx.moveTo(cx, cy + r * 0.8); ctx.lineTo(cx + Math.cos(a - 0.2) * r, cy + r * 0.8 + Math.sin(a - 0.2) * r * 1.6); ctx.lineTo(cx + Math.cos(a + 0.2) * r, cy + r * 0.8 + Math.sin(a + 0.2) * r * 1.6); ctx.closePath(); } ctx.fill(); break;
    default: break;
  }
  ctx.restore();
}

/**
 * [TL7] Logotipo de un patrocinador (data/brands.ts) para una superficie de proporción `aspect`: palabra grande que
 * llena el alto, letra pesada y trabajada, con su placa, emblema, dos tonos o trazo. `under` es el color de lo que hay
 * debajo, para que la letra contraste cuando la marca no tiene color propio.
 */
export function brandTexture(name: string, under: string, aspect: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.height = 256;
  canvas.width = Math.max(128, Math.round(256 * aspect));
  const ctx = canvas.getContext('2d');
  // [TL7] Los patrocinadores principales llevan su logotipo dibujado a mano (logos.ts).
  // [TL4] «@toro»: emblema del equipo.
  const hand = name.startsWith('@') ? EMBLEMS[name.slice(1)] : LOGOS[name];
  if (ctx && name && hand) {
    hand(ctx, canvas.width, canvas.height, textColorOn(under) === '#ffffff');
  } else if (ctx && name) {
    const style = brandStyle(name);
    const W = canvas.width, H = canvas.height;
    const auto = textColorOn(under);
    const readable = (c: string | undefined) => (c && contrast(c, under) >= 2.4 ? c : auto);
    const lower = style.kind === 'minusculas';
    const label = lower ? name.toLowerCase() : name.toUpperCase();
    // Letra, cursiva y separación de cada forma.
    const look: Record<string, { font: string; weight: number; italic: boolean; track: number; fill: number }> = {
      bloque: { font: LOGO_FONT.pesada, weight: 900, italic: true, track: -0.02, fill: 0.78 },
      ancho: { font: LOGO_FONT.pesada, weight: 900, italic: false, track: -0.04, fill: 0.8 },
      espaciado: { font: LOGO_FONT.pesada, weight: 900, italic: false, track: 0.16, fill: 0.62 },
      minusculas: { font: LOGO_FONT.redonda, weight: 700, italic: false, track: -0.03, fill: 0.92 },
      caja: { font: LOGO_FONT.condensada, weight: 800, italic: true, track: 0.02, fill: 0.58 },
      insignia: { font: LOGO_FONT.condensada, weight: 800, italic: false, track: 0.03, fill: 0.74 },
      'dos-tonos': { font: LOGO_FONT.condensada, weight: 800, italic: true, track: 0, fill: 0.8 },
      subrayado: { font: LOGO_FONT.condensada, weight: 800, italic: true, track: 0.02, fill: 0.66 },
    };
    const L = look[style.kind];
    let size = Math.round(H * L.fill);
    const setFont = () => { ctx.font = `${L.italic ? 'italic ' : ''}${L.weight} ${size}px ${L.font}`; ctx.letterSpacing = `${Math.round(L.track * size)}px`; };
    setFont();
    const emblemW = style.kind === 'insignia' ? H * 0.78 : 0;
    const margin = style.kind === 'caja' ? H * 0.34 : H * 0.06;
    const room = W - margin * 2 - emblemW;
    let textW = ctx.measureText(label).width, squeeze = 1;
    if (textW > room) {
      squeeze = Math.max(0.68, room / textW);
      if (textW * squeeze > room) { size = Math.floor(size * room / (textW * squeeze)); setFont(); textW = ctx.measureText(label).width; }
    }
    const wordW = textW * squeeze, total = wordW + emblemW;
    let x = (W - total) / 2;
    const cy = H / 2;
    if (style.kind === 'caja') {
      const bh = H * 0.86, bw = Math.min(W - 4, wordW + H * 0.5), bx = (W - bw) / 2, sl = bh * 0.22;
      ctx.fillStyle = style.bg ?? '#111111';
      ctx.beginPath(); ctx.moveTo(bx + sl, cy - bh / 2); ctx.lineTo(bx + bw, cy - bh / 2); ctx.lineTo(bx + bw - sl, cy + bh / 2); ctx.lineTo(bx, cy + bh / 2); ctx.closePath(); ctx.fill();
    }
    if (emblemW) { drawEmblem(ctx, style.emblem, x + emblemW * 0.45, cy, H * 0.7, style.bg ?? '#e10600', under); x += emblemW; }
    const ink = style.kind === 'caja' ? (style.fg ?? textColorOn(style.bg ?? '#111111')) : readable(style.fg);
    ctx.save();
    ctx.translate(x, cy + size * 0.05);
    ctx.scale(squeeze, 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (style.kind === 'dos-tonos') {
      const cut = Math.min(label.length - 1, style.split ?? Math.ceil(label.length / 2));
      const first = label.slice(0, cut), rest = label.slice(cut);
      ctx.fillStyle = ink; ctx.fillText(first, 0, 0);
      ctx.fillStyle = readable(style.bg); ctx.fillText(rest, ctx.measureText(first).width, 0);
    } else {
      ctx.fillStyle = ink; ctx.fillText(label, 0, 0);
    }
    ctx.restore();
    if (style.kind === 'subrayado') {
      ctx.fillStyle = readable(style.bg);
      const y = cy + size * 0.48, x0 = (W - total) / 2;
      ctx.beginPath(); ctx.moveTo(x0, y + H * 0.05); ctx.quadraticCurveTo(x0 + wordW * 0.5, y - H * 0.06, x0 + wordW, y - H * 0.02); ctx.lineTo(x0 + wordW, y + H * 0.03); ctx.quadraticCurveTo(x0 + wordW * 0.5, y, x0, y + H * 0.1); ctx.closePath(); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Contraste aproximado entre dos colores (relación de luminancias, como en WCAG). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => { const n = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * n(1) + 0.7152 * n(3) + 0.0722 * n(5); };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Pone la textura en las mallas que usan el material `name` (superficies transparentes pegadas a la carrocería). */
export function setDecal(root: THREE.Object3D, name: string, texture: THREE.Texture): void {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of materialsOf(mesh)) {
      if (material.name !== name) continue;
      const decal = material as THREE.MeshStandardMaterial;
      decal.map = texture;
      decal.color.set('#ffffff');
      decal.transparent = true;
      decal.opacity = 1;
      decal.alphaTest = 0;
      decal.depthWrite = false;
      decal.polygonOffset = true;
      decal.polygonOffsetFactor = -2;
      decal.needsUpdate = true;
    }
  });
}

/** Materiales del modelo con ese nombre. */
export function materialsNamed(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial[] {
  const found = new Set<THREE.MeshStandardMaterial>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) for (const material of materialsOf(mesh)) if (material.name === name) found.add(material as THREE.MeshStandardMaterial);
  });
  return [...found];
}

/** Proporción (ancho/alto) de cada superficie de rótulos del monoplaza. */
const DECAL_ASPECT: Record<string, number> = {
  // [TL7] Medidas en el coche (ancho/alto de cada superficie, medidas en Blender): antes el morro se dibujaba como si
  // fuera alto (0,55) y el alerón trasero, como la mitad de ancho, y el texto salía estirado o aplastado.
  [CAR_MODEL.decals.sidepod]: 2.35, [CAR_MODEL.decals.engine]: 3.55, [CAR_MODEL.decals.rearwing]: 4.55, [CAR_MODEL.decals.nose]: 1.93,
  [CAR_MODEL.decals.frontwing]: 3.58, [CAR_MODEL.decals.noseside]: 4.95, [CAR_MODEL.decals.endplate]: 1.65, [CAR_MODEL.decals.fin]: 2.11,
  [CAR_MODEL.decals.sidepodside]: 3.85, [CAR_MODEL.decals.enginebig]: 3.34, [CAR_MODEL.decals.nosetop]: 3.85, [CAR_MODEL.decals.halo]: 3.01, [CAR_MODEL.decals.nosecone]: 4.58,
};
/** Superficies del dorsal: llevan el número, no una marca. */
const NUMBER_DECALS = new Set<string>([CAR_MODEL.decals.nose, CAR_MODEL.decals.fin]);
/** Color de fondo de las superficies que van sobre la fibra (sin pintar). */
const CARBON_BACKGROUND = '#111111';

/**
 * Viste el monoplaza con una librea: pintura, patrocinadores, dorsal y banda del compuesto. Devuelve cómo liberar
 * las texturas de los rótulos (para vestir después el mismo modelo con otra librea).
 */
export function dressCar(
  root: THREE.Object3D, livery: { primary: string; secondary: string; sponsors: string[]; zones?: Partial<Record<string, string>>; emblem?: string; art?: LiveryArt; artKey?: string }, number: number, compoundColor: string,
): () => void {
  applyLivery(root, liveryColors(livery, compoundColor));
  // [TL4] Librea dibujada: la carrocería lee el dibujo proyectado y los rótulos sueltos se apagan (salvo los dorsales).
  const frame = root.userData.carFrame as CarFrame | undefined;
  if (livery.art && frame) {
    const tex = liveryTextures(livery.artKey ?? JSON.stringify(livery.art).length + livery.primary, livery.art, frame);
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!list.some(m => BODY_ZONES.has(m.name))) return;
      const next = list.map(m => (BODY_ZONES.has(m.name) ? projectedMaterial(m, tex, frame) : m));
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    // El halo, de una pieza y de un color (el de la librea).
    const halo = livery.art.halo ?? livery.art.base;
    root.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) for (const m of materialsOf(mesh)) if (m.name === 'zona_halo') (m as THREE.MeshStandardMaterial).color.set(halo); });
  }
  const textures: THREE.Texture[] = [];
  for (const [material, rawText] of Object.entries(decalTexts(livery, number))) {
    const text = livery.art && !NUMBER_DECALS.has(material) ? '' : rawText;
    const background = DECAL_BACKGROUND[material] ?? 'primary';
    // [TL4] Lo que hay debajo de cada rótulo: el color de su zona, si la librea lo dice.
    const zone = DECAL_ZONE[material];
    const under = background === 'carbon' ? CARBON_BACKGROUND : (zone && livery.zones?.[zone]) || livery[background];
    const aspect = DECAL_ASPECT[material] ?? 4;
    const texture = NUMBER_DECALS.has(material) ? textTexture(text, textColorOn(under), aspect) : brandTexture(text, under, aspect);
    // [TL7] El plano del alerón trasero tiene sus coordenadas de textura al revés: sin esto, el rótulo sale en espejo.
    if (material === CAR_MODEL.decals.rearwing) { texture.wrapS = THREE.RepeatWrapping; texture.repeat.x = -1; texture.offset.x = 1; }
    setDecal(root, material, texture);
    textures.push(texture);
  }
  // [19/11/2026, el usuario: «en el morro hay dos líneas negras»] Con librea dibujada, los rótulos vacíos no se ven: eran
  // rectángulos del color de su zona (los de los lados del morro salían como dos rayas negras). Los dorsales, sí.
  const decalNames = new Set(Object.keys(DECAL_ASPECT));
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (decalNames.has(m.name)) m.visible = !livery.art || NUMBER_DECALS.has(m.name);
    }
  });
  return () => { for (const texture of textures) texture.dispose(); };
}

/** [TL4] Zonas de la carrocería que pinta la librea dibujada. */
const BODY_ZONES = new Set(['zona_cuerpo', 'zona_punta', 'zona_tapa', 'zona_aleta', 'zona_ponton', 'zona_costado', 'zona_lateral']);

/** [TL4] Zona de la carrocería sobre la que va cada rótulo. */
const DECAL_ZONE: Record<string, string> = {
  [CAR_MODEL.decals.sidepod]: 'zona_ponton', [CAR_MODEL.decals.sidepodside]: 'zona_lateral', [CAR_MODEL.decals.enginebig]: 'zona_costado',
  [CAR_MODEL.decals.engine]: 'zona_tapa', [CAR_MODEL.decals.rearwing]: 'zona_alerones', [CAR_MODEL.decals.nose]: 'zona_cuerpo',
  [CAR_MODEL.decals.nosetop]: 'zona_cuerpo', [CAR_MODEL.decals.noseside]: 'zona_costado', [CAR_MODEL.decals.frontwing]: 'zona_placas',
  [CAR_MODEL.decals.endplate]: 'zona_placas', [CAR_MODEL.decals.fin]: 'zona_aleta', [CAR_MODEL.decals.nosecone]: 'zona_cuerpo',
};

/** Viste el Safety Car (pintura y rótulos) y devuelve los materiales de su barra de luces. */
export function dressSafetyCar(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  for (const paint of materialsNamed(root, SAFETY_CAR_MODEL.materials.paint)) paint.color.set(SAFETY_CAR_LIVERY.body);
  setDecal(root, SAFETY_CAR_MODEL.decals.door, textTexture('Safety Car', SAFETY_CAR_LIVERY.accent, 3.8));
  setDecal(root, SAFETY_CAR_MODEL.decals.hood, textTexture(SAFETY_CAR_LIVERY.sponsors[0] ?? '', textColorOn(SAFETY_CAR_LIVERY.body), 1.7));
  return materialsNamed(root, SAFETY_CAR_MODEL.materials.lightbar);
}

/** Libera geometrías, materiales y texturas del modelo. */
export function disposeModel(root: THREE.Object3D): void {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const material of materialsOf(mesh)) {
      (material as THREE.MeshStandardMaterial).map?.dispose();
      material.dispose();
    }
  });
}
