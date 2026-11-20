// [MJ14, 20/11/2026] Revisión de las piezas pintadas: el coche de un año con la livery de un equipo, tal como lo pinta el
// juego (loadCarModel + dressCar), desde un ángulo. Con &zonas=1, cada zona de un color fijo (carbono negro, halo magenta,
// carrocería en colores) para ver qué pieza cae en cada sitio.
// ?revision=coches&anio=2025&equipo=mclaren&vista=lado|frente|tres|arriba|cola[&zonas=1]
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadCarModel, dressCar } from '../renderer/modelScene';
import { seasonLivery } from '../data/seasonLiveries';
import { liveryFor } from '../data/liveries';

const ZONE_DEBUG: Record<string, string> = {
  carbon: '#111111', zona_halo: '#ff00ff', zona_cuerpo: '#ff8800', zona_punta: '#ffee00', zona_tapa: '#00c8ff', zona_aleta: '#0044ff',
  zona_ponton: '#00ff66', zona_costado: '#88ff00', zona_lateral: '#008844', zona_alerones: '#ff2244', zona_placas: '#aa00ff',
};
const VIEWS: Record<string, [number, number, number]> = {
  lado: [0.3, 0.7, 7.5], frente: [6.5, 1.1, 0.01], tres: [4.6, 2.0, 4.4], arriba: [0.3, 8.5, 0.01], cola: [-5.5, 1.6, 2.6],
};

export default function CarPartsReview() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const params = new URLSearchParams(location.search);
    const year = Number(params.get('anio') ?? 2025);
    const team = params.get('equipo') ?? 'mclaren';
    const view = VIEWS[params.get('vista') ?? 'tres'] ?? VIEWS.tres;
    const zones = params.get('zonas') === '1';
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1200, 700);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#bcc2ca');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 8, 5);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1200 / 700, 0.1, 100);
    camera.position.set(...view);
    camera.lookAt(0.3, 0.45, 0);
    let alive = true;
    loadCarModel(import.meta.env.BASE_URL, year).then(gltf => {
      if (!alive) return;
      const livery = year >= 2023 && year <= 2026 ? seasonLivery(team, year, 1) : liveryFor(team);
      dressCar(gltf.scene, livery, 4, '#ffd700');
      if (zones) {
        gltf.scene.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          const out = mats.map(x => {
            const c = ZONE_DEBUG[x.name] ?? (x.name === 'carbon' ? ZONE_DEBUG.carbon : null);
            return c ? new THREE.MeshLambertMaterial({ color: c }) : x;
          });
          m.material = Array.isArray(m.material) ? out : out[0];
          if (m.name.startsWith('decal') || m.parent?.name.startsWith('decal')) m.visible = false;
        });
      }
      // Medición (&medir=1): en la carrocería, cuánto de la suspensión y del suelo queda pintado, si queda zona de halo
      // pintada y cuántas manchas de carbono sueltas (grupos pequeños de caras de carbono rodeados de pintura) hay.
      if (params.get('medir') === '1') host.dataset.medida = JSON.stringify(measure(gltf.scene));
      scene.add(gltf.scene);
      renderer.render(scene, camera);
      host.dataset.ready = '1';
    }).catch(e => { host.dataset.ready = 'error'; host.dataset.error = String(e); });
    return () => { alive = false; renderer.dispose(); host.innerHTML = ''; };
  }, []);
  return <div ref={ref} data-car-parts style={{ width: 1200, height: 700 }} />;
}

/** Medición de las piezas pintadas (MJ14), con la posición de cada vértice en el coche (carPos) que deja paintZones. */
function measure(root: THREE.Object3D) {
  const frame = root.userData.carFrame as { xr: number; xf: number; top: number } | undefined;
  const out = { suspension: { faces: 0, painted: 0 }, floor: { faces: 0, painted: 0 }, haloZone: 0, islands: 0, islandFaces: 0, sideCarbon: { faces: 0, carbon: 0 } };
  if (!frame) return out;
  const { xr, xf } = frame;
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !Array.isArray(m.material) || !m.geometry.attributes.carPos) return;
    const geo = m.geometry, cp = geo.attributes.carPos, idx = geo.index!;
    const names = (m.material as THREE.Material[]).map(x => x.name);
    const faceMat: string[] = [], centers: [number, number, number][] = [];
    for (const g of geo.groups) for (let i = g.start; i < g.start + g.count; i += 3) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) { const v = idx.getX(i + k); x += cp.getX(v) / 3; y += cp.getY(v) / 3; z += cp.getZ(v) / 3; }
      faceMat.push(names[g.materialIndex ?? 0]); centers.push([x, y, Math.abs(z)]);
    }
    if (names.includes('zona_halo')) out.haloZone += faceMat.filter(n => n === 'zona_halo').length;
    centers.forEach(([x, y, az], f) => {
      const painted = faceMat[f] !== 'carbon';
      const nearWheel = Math.abs(x - xf) < 0.4 || Math.abs(x - xr) < 0.4;
      if (nearWheel && az > 0.45 && y > 0.18 && y < 0.55) { out.suspension.faces++; if (painted) out.suspension.painted++; }
      if (y < 0.1 && x < xf - 0.1 && x > xr + 0.3) { out.floor.faces++; if (painted) out.floor.painted++; }
      // Costados de la carrocería (pontones y laterales, por debajo del halo y los retrovisores, lejos de ruedas y suelo).
      if (y > 0.25 && y < 0.65 && az > 0.32 && az < 0.6 && x > xr + 0.5 && x < xf - 0.5) { out.sideCarbon.faces++; if (!painted) out.sideCarbon.carbon++; }
    });
    // Manchas: grupos de caras de carbono unidas por vértices, en el centro de la carrocería, de 8 a 120 caras y
    // con pintura alrededor (más del 70 % de sus vecinas pintadas).
    const keyOf = (v: number) => Math.round(cp.getX(v) * 1000) + ',' + Math.round(cp.getY(v) * 1000) + ',' + Math.round(cp.getZ(v) * 1000);
    const faceVerts: string[][] = [];
    let fi = 0;
    for (const g of geo.groups) for (let i = g.start; i < g.start + g.count; i += 3, fi++) faceVerts[fi] = [keyOf(idx.getX(i)), keyOf(idx.getX(i + 1)), keyOf(idx.getX(i + 2))];
    const byKey = new Map<string, number[]>();
    faceVerts.forEach((ks, f) => ks.forEach(k => { let l = byKey.get(k); if (!l) byKey.set(k, l = []); l.push(f); }));
    const seen = new Uint8Array(faceMat.length);
    const mid = (f: number) => { const [x, y, az] = centers[f]; return y > 0.25 && y < frame.top * 0.95 && az < 0.55 && x > xr + 0.4 && x < xf - 0.4; };
    for (let f = 0; f < faceMat.length; f++) {
      if (seen[f] || faceMat[f] !== 'carbon' || !mid(f)) continue;
      const group: number[] = [], queue = [f]; seen[f] = 1;
      let paintedNb = 0, nb = 0;
      while (queue.length && group.length < 400) {
        const g = queue.pop()!; group.push(g);
        for (const k of faceVerts[g]) for (const h of byKey.get(k) ?? []) {
          if (h === g) continue;
          if (faceMat[h] === 'carbon') { if (!seen[h]) { seen[h] = 1; queue.push(h); } } else { paintedNb++; }
          nb++;
        }
      }
      // Las de 8 caras o más (las de menos no se ven ni de cerca).
      if (group.length >= 8 && group.length < 120 && nb > 0 && paintedNb / nb > 0.7) { out.islands++; out.islandFaces += group.length; }
    }
  });
  return out;
}
