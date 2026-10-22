// Vista 3D, tercera tanda (PROPUESTA DE CONTRATO, 23/10/2026).
// Petición del usuario tras probar la segunda: las ruedas del coche ligero se ven rotas; el toro sigue sin parecerse
// (referencia: «Cartoon Race Track Spielberg» de RCC Design en Sketchfab: toro encabritado casi en vertical, de celosía
// naranja, bajo un arco blanco); revisar todos los componentes del circuito y hacerlos en Blender; Abu Dabi y Arabia
// Saudí parecen de día; las vallas van demasiado pegadas a la pista (en la realidad van al final de la escapatoria).
// Medidas: al menos 3 m de espacio libre junto a la pista y las barreras al final de la escapatoria; en los urbanos, los
// muros pegados. Lo que se puede probar sin pantalla:
//  1. Coche ligero: los materiales con su nombre exacto (si no, el juego no les pone color y las ruedas salen rotas).
//  2. Vallas: nunca dentro de una escapatoria; a 3 m o más del borde; en los permanentes, lejos (mediana de 8 m o más);
//     en Mónaco, pegadas (mediana de 4 m o menos).
//  3. Noche: Abu Dabi y Yeda, de noche desde la salida; la luz de noche, tres veces más baja que la de día y con los
//     focos más cercanos encendidos.
//  4. Componentes en los 23 circuitos: edificio de boxes a lo largo del pit lane, pórtico de salida sobre la meta, vallas
//     publicitarias con patrocinadores de parodia; palmeras en los circuitos de calor y coníferas en los de montaña.
//  5. El toro, de celosía (muchos más triángulos que antes, dentro del límite).
//  Cómo se ve (el toro, la noche, los componentes) se comprueba en el navegador con capturas.
import { existsSync, readFileSync } from 'node:fs';

function glbInfo(path) {
  const buf = readFileSync(path);
  const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  let tris = 0;
  for (const mesh of gltf.meshes ?? []) for (const prim of mesh.primitives ?? []) {
    tris += (prim.indices !== undefined ? gltf.accessors[prim.indices].count : gltf.accessors[prim.attributes.POSITION].count) / 3;
  }
  return { tris, materials: (gltf.materials ?? []).map(m => m.name) };
}
const inside = (pt, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const luminance = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

const HOT = ['bahrain', 'jeddah', 'yas-marina', 'lusail', 'miami', 'marina-bay', 'las-vegas'];
const MOUNTAIN = ['spielberg', 'spa', 'hungaroring', 'montreal'];
const STREET_CLOSE = ['monaco'];

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { SPONSORS } = await load('/src/scene3d/sponsors.ts');
  const { nightLook, nearestFloodlights } = await load('/src/scene3d/sunLight.ts');
  const { sunAt, NIGHT_RACES } = await load('/src/renderer/lighting.ts');
  const { CAR_MODEL } = await load('/src/renderer/carModel3d.ts');
  const { buildScenarioGeometry } = await load('/src/utils/scenarioGeometry.ts');
  const { getScenario } = await load('/src/data/scenarioRegistry.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const tracks = Object.fromEntries(ids.map(id => [id, new RaceSimulation(id).activeTrack]));
  const scenes = Object.fromEntries(ids.map(id => [id, sceneryFor(tracks[id], id)]));
  const axisDistance = (track, p) => {
    let best = Infinity;
    for (let i = 0; i < track.points.length; i += 2) best = Math.min(best, Math.hypot(track.points[i].x - p.x, track.points[i].y - p.y));
    return best;
  };

  await test('Coche ligero: materiales con su nombre exacto', () => {
    const { materials } = glbInfo('public/models/f1-car-lod.glb');
    const wanted = Object.values(CAR_MODEL.materials);
    const missing = wanted.filter(m => !materials.includes(m));
    assert(missing.length === 0, 'Coche ligero: neumático, llanta, banda y pintura con el mismo nombre que el modelo completo', missing.join(', '));
    assert(materials.every(m => !/\.\d{3}$/.test(m)), 'Coche ligero: ningún material renombrado por Blender (.001)', materials.filter(m => /\.\d{3}$/.test(m)).join(', '));
  });

  await test('Vallas a la distancia de verdad', () => {
    const insideRunoff = [], tooClose = [], nearPermanent = [], farStreet = [];
    for (const id of ids) {
      const track = tracks[id], half = (track.trackWidthMeters || 12) / 2;
      const walls = scenes[id].barriers.filter(b => b.kind !== 'tecpro');
      const pts = walls.flatMap(b => b.points.filter((_, i) => i % 3 === 0));
      if (!pts.length) continue;
      const runoffs = buildScenarioGeometry(track, getScenario(id)).runoffPolygons.map(r => r.points);
      if (pts.some(p => runoffs.some(poly => inside(p, poly)))) insideRunoff.push(id);
      const gaps = pts.map(p => axisDistance(track, p) - half);
      if (Math.min(...gaps) < 3 - 0.01) tooClose.push(`${id}: ${Math.min(...gaps).toFixed(1)} m`);
      const street = getScenario(id).trackType === 'street';
      if (!street && median(gaps) < 8) nearPermanent.push(`${id}: ${median(gaps).toFixed(1)} m`);
      if (STREET_CLOSE.includes(id) && median(gaps) > 4) farStreet.push(`${id}: ${median(gaps).toFixed(1)} m`);
    }
    assert(insideRunoff.length === 0, 'Vallas: ninguna dentro de una escapatoria (van a su final)', insideRunoff.join(', '));
    assert(tooClose.length === 0, 'Vallas: al menos 3 m de espacio libre junto a la pista', tooClose.join(' | '));
    assert(nearPermanent.length === 0, 'Vallas: en los circuitos permanentes, lejos de la pista (mediana de 8 m o más)', nearPermanent.join(' | '));
    assert(farStreet.length === 0, 'Vallas: en Mónaco, los muros pegados a la pista (mediana de 4 m o menos)', farStreet.join(' | '));
  });

  await test('Noche en Abu Dabi y Yeda', () => {
    assert(NIGHT_RACES.has('yas-marina') && NIGHT_RACES.has('jeddah'), 'Noche: Abu Dabi y Yeda se corren de noche');
    for (const id of ['yas-marina', 'jeddah']) assert(sunAt({ circuitId: id, raceTimeSec: 0, cloudCover: 0 }).mode === 'focos', `Noche: ${id} con focos desde la salida`);
    const day = nightLook(sunAt({ circuitId: 'barcelona', raceTimeSec: 0, cloudCover: 0 }));
    const night = nightLook(sunAt({ circuitId: 'jeddah', raceTimeSec: 0, cloudCover: 0 }));
    assert(night.hemi * 3 <= day.hemi && night.hemi <= 0.35, 'Noche: la luz ambiente, tres veces más baja que de día', `${day.hemi} → ${night.hemi}`);
    assert(luminance(night.sky) <= 0.08 && luminance(day.sky) >= 0.3, 'Noche: cielo oscuro (y de día, claro)', `${luminance(day.sky).toFixed(2)} → ${luminance(night.sky).toFixed(2)}`);
    assert(night.floodlights > 0 && day.floodlights === 0, 'Noche: los focos se encienden solo de noche');
    const lights = scenes.jeddah.items.filter(it => it.kind === 'floodlight');
    const near = nearestFloodlights(lights, lights[0].x, lights[0].y, 8);
    assert(near.length === 8 && near[0] === lights[0] && near.every((l, i) => i === 0 || Math.hypot(l.x - lights[0].x, l.y - lights[0].y) >= Math.hypot(near[i - 1].x - lights[0].x, near[i - 1].y - lights[0].y)),
      'Noche: se encienden los ocho focos más cercanos a la cámara, ordenados por distancia');
  });

  await test('Componentes en los 23 circuitos', () => {
    const missing = [];
    for (const id of ids) {
      const track = tracks[id], items = scenes[id].items, start = track.points[0], pit = getPitLaneGeometry(track).fastLane;
      if (pit.length >= 2) {
        let laneLength = 0;
        for (let i = 1; i < pit.length; i++) laneLength += Math.hypot(pit[i].x - pit[i - 1].x, pit[i].y - pit[i - 1].y);
        const boxes = items.filter(it => it.kind === 'pit-building' && pit.some(p => Math.hypot(p.x - it.x, p.y - it.y) <= 60));
        if (boxes.reduce((s, b) => s + b.length, 0) < 0.5 * laneLength) missing.push(`${id}: edificio de boxes`);
      }
      const gantry = items.find(it => it.kind === 'bridge' && it.id === 'portico-salida');
      if (!gantry || Math.hypot(gantry.x - start.x, gantry.y - start.y) > 40 || !(gantry.clearance >= 6)) missing.push(`${id}: pórtico de salida`);
      const boards = items.filter(it => it.kind === 'billboard');
      if (boards.length < 6 || !boards.every(b => SPONSORS.includes(b.sponsor))) missing.push(`${id}: vallas publicitarias`);
      const trees = items.filter(it => it.kind === 'tree');
      if (HOT.includes(id) && trees.filter(t => t.model === 'palm').length < 10) missing.push(`${id}: palmeras`);
      if (MOUNTAIN.includes(id) && trees.filter(t => t.model === 'pine').length < 10) missing.push(`${id}: coníferas`);
    }
    assert(missing.length === 0, 'Componentes: boxes, pórtico de salida, publicidad y árboles de cada sitio', missing.slice(0, 14).join(' | '));
    const models = [...new Set(ids.flatMap(id => scenes[id].items.map(it => it.model)))];
    const absent = models.filter(m => !existsSync(`public/models/scenery/${m}.glb`));
    assert(absent.length === 0, 'Componentes: cada uno con su modelo de Blender', absent.join(', '));
  });

  await test('Toro de celosía', () => {
    const { tris } = glbInfo('public/models/scenery/red-bull.glb');
    assert(tris >= 4000 && tris <= 30000, 'Toro: de celosía (entre 4000 y 30 000 triángulos)', String(tris));
  });
}
