// Escenario 3D, iconos de los circuitos y cámaras (PROPUESTA DE CONTRATO, 22/10/2026).
// Petición del usuario: ver la carrera en 3D inclinado, con objetos que identifiquen cada circuito (el toro de Austria,
// el puerto de Mónaco con barcos, mar y edificios, el puente sobre la recta de Shanghái…), la zona interior del circuito
// (hierba, gradas, zona VIP, paddock), sombras en todos los circuitos y cámaras que se comporten distinto de verdad.
// Decisión del usuario del 22/10/2026: vista 3D inclinada; piloto con un kit común para los 23 circuitos y los iconos de
// Spielberg, Mónaco y Shanghái; modos de cámara distintos. Lo que se puede probar sin pantalla:
//  1. Kit común en los 23 circuitos: interior del circuito, gradas junto a la meta, zona VIP y paddock junto al pit lane,
//     y nada encima del asfalto.
//  2. Iconos del piloto: el toro dentro del circuito de Spielberg; en Mónaco mar con barcos, edificios y el casino; en
//     Shanghái el puente que cruza la recta de meta por encima de los coches.
//  3. Modelos: cada modelo existe en public/models/scenery, ligero (archivo y triángulos acotados).
//  4. Cámaras: persecución detrás del coche, a bordo a la altura del piloto mirando adelante, helicóptero alto y por
//     delante, TV con cámaras fijas fuera de la pista que cortan con calma.
//  5. Sol: la luz 3D viene del lado contrario a la sombra y con la altura que marca su largo.
//  Cómo se ve (modelos reconocibles, sombras, rendimiento en móvil) se comprueba en el navegador con capturas.
// Convención: suelo en (x, y) del mundo del juego (metros, y hacia abajo = sur) y z hacia arriba.
import { existsSync, readFileSync, statSync } from 'node:fs';

const MODEL_MAX_BYTES = 800 * 1024;
const MODELS_MAX_BYTES = 6 * 1024 * 1024;
const MODEL_MAX_TRIANGLES = 30000;

/** Triángulos de un .glb leyendo su JSON (índices o, sin ellos, vértices). */
function glbTriangles(path) {
  const buf = readFileSync(path);
  const jsonLength = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
  let tris = 0;
  for (const mesh of gltf.meshes ?? []) for (const prim of mesh.primitives ?? []) {
    const count = prim.indices !== undefined ? gltf.accessors[prim.indices].count : gltf.accessors[prim.attributes.POSITION].count;
    tris += count / 3;
  }
  return tris;
}

const inside = (pt, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};
const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
/** Esquinas y centro de la planta de un objeto. */
const footprint = item => {
  const c = Math.cos(item.heading), s = Math.sin(item.heading), l = item.length / 2, w = item.width / 2;
  return [[0, 0], [l, w], [l, -w], [-l, w], [-l, -w]].map(([u, v]) => ({ x: item.x + u * c - v * s, y: item.y + u * s + v * c }));
};

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { chaseView, onboardView, helicopterView, tvCamerasFor, TvDirector, TV_MIN_SHOT_SEC, CAMERA_MODES } = await load('/src/scene3d/cameras.ts');
  const { sunLightVector } = await load('/src/scene3d/sunLight.ts');
  const { sunAt } = await load('/src/renderer/lighting.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const tracks = Object.fromEntries(ids.map(id => [id, new RaceSimulation(id).activeTrack]));
  const scenes = Object.fromEntries(ids.map(id => [id, sceneryFor(tracks[id], id)]));
  /** Distancia mínima de un punto al eje de la pista (muestreado cada pocos metros). */
  const axisDistance = (track, p) => {
    let best = Infinity;
    for (let i = 0; i < track.points.length; i += 2) best = Math.min(best, Math.hypot(track.points[i].x - p.x, track.points[i].y - p.y));
    return best;
  };

  await test('Escenario: kit común en los 23 circuitos', () => {
    const noInfield = ids.filter(id => !(scenes[id].infield.length > 0 && scenes[id].infield.every(poly => poly.length >= 3 && area(poly) > 1000)));
    assert(noInfield.length === 0, 'Escenario: cada circuito tiene su zona interior', noInfield.join(', '));
    const missing = [];
    for (const id of ids) {
      const track = tracks[id], start = track.points[0], items = scenes[id].items;
      const near = (kind, m, from) => items.filter(it => it.kind === kind && from.some(p => Math.hypot(it.x - p.x, it.y - p.y) <= m)).length;
      const pit = getPitLaneGeometry(track).fastLane;
      if (near('grandstand', 300, [start]) < 2) missing.push(`${id}: gradas en la meta`);
      if (near('vip', 200, pit.length ? pit : [start]) < 1) missing.push(`${id}: zona VIP`);
      if (near('paddock', 150, pit.length ? pit : [start]) < 1) missing.push(`${id}: paddock`);
    }
    assert(missing.length === 0, 'Escenario: gradas junto a la meta, zona VIP y paddock junto al pit lane', missing.slice(0, 12).join(' | '));
    const onTrack = [];
    for (const id of ids) {
      const half = (tracks[id].trackWidthMeters || 12) / 2;
      for (const it of scenes[id].items) {
        if (it.kind === 'bridge') continue;
        if (footprint(it).some(p => axisDistance(tracks[id], p) < half + 1.5)) onTrack.push(`${id}: ${it.id ?? it.kind}`);
      }
    }
    assert(onTrack.length === 0, 'Escenario: ningún objeto pisa el asfalto (salvo los puentes, que van por encima)', onTrack.slice(0, 12).join(' | '));
  });

  await test('Escenario: iconos de Spielberg, Mónaco y Shanghái', () => {
    const bull = scenes.spielberg.items.find(it => it.id === 'toro');
    assert(bull && bull.kind === 'landmark' && bull.height >= 15 && bull.height <= 20, 'Iconos: el toro de Spielberg, de unos 17 m', JSON.stringify(bull));
    assert(bull && scenes.spielberg.infield.some(poly => inside(bull, poly)), 'Iconos: el toro está en el centro del circuito');

    const monaco = scenes.monaco;
    assert(monaco.water.length > 0, 'Iconos: Mónaco tiene mar');
    const yachts = monaco.items.filter(it => it.kind === 'yacht');
    assert(yachts.length >= 6 && yachts.every(y => monaco.water.some(poly => inside(y, poly))), 'Iconos: al menos seis barcos, todos en el agua', String(yachts.length));
    assert(monaco.items.filter(it => it.kind === 'building').length >= 10, 'Iconos: edificios junto al trazado de Mónaco');
    const casino = monaco.items.find(it => it.id === 'casino');
    // Corregido con autorización del usuario (22/10/2026): Casino (T4) está al 26,8 % de la vuelta según las curvas del
    // circuito (la horquilla, al 37,9 %, lo confirma); el 43-50 % venía de los pianos del escenario de Mónaco, desplazados.
    assert(casino && casino.t >= 0.25 && casino.t <= 0.29, 'Iconos: el casino junto a la curva Casino (T4)', JSON.stringify(casino && { t: casino.t }));

    const shanghai = tracks.shanghai, bridge = scenes.shanghai.items.find(it => it.id === 'puente-meta');
    const width = shanghai.trackWidthMeters || 12;
    assert(bridge && bridge.kind === 'bridge' && (bridge.t <= 0.03 || bridge.t >= 0.97), 'Iconos: en Shanghái, el puente sobre la recta de meta', JSON.stringify(bridge && { t: bridge.t }));
    assert(bridge && bridge.length >= width + 10 && bridge.clearance >= 6, 'Iconos: el puente cruza toda la recta y deja pasar a los coches por debajo', JSON.stringify(bridge && { length: bridge.length, clearance: bridge.clearance }));
  });

  await test('Escenario: modelos ligeros', () => {
    const models = [...new Set(ids.flatMap(id => scenes[id].items.map(it => it.model)))];
    const absent = models.filter(m => !existsSync(`public/models/scenery/${m}.glb`));
    assert(absent.length === 0, 'Modelos: cada objeto tiene su modelo en public/models/scenery', absent.join(', '));
    const present = models.filter(m => existsSync(`public/models/scenery/${m}.glb`));
    const heavy = present.filter(m => statSync(`public/models/scenery/${m}.glb`).size > MODEL_MAX_BYTES);
    assert(heavy.length === 0, 'Modelos: ninguno pasa de 800 KB', heavy.join(', '));
    const total = present.reduce((s, m) => s + statSync(`public/models/scenery/${m}.glb`).size, 0);
    assert(total <= MODELS_MAX_BYTES, 'Modelos: todos juntos, 6 MB como mucho', `${(total / 1048576).toFixed(2)} MB`);
    const dense = present.filter(m => glbTriangles(`public/models/scenery/${m}.glb`) > MODEL_MAX_TRIANGLES);
    assert(dense.length === 0, 'Modelos: 30 000 triángulos como mucho cada uno', dense.join(', '));
  });

  await test('Cámaras: cada modo se comporta distinto', () => {
    // Cambiado con autorización del usuario (22/10/2026): ocho modos, con las dos cenitales de scenery-3d-2.
    assert(['vista', 'persecucion', 'tv', 'helicoptero', 'a-bordo', 'libre'].every(m => CAMERA_MODES.includes(m)) && CAMERA_MODES.length === 8, 'Cámaras: ocho modos', CAMERA_MODES.join(', '));
    const track = tracks.suzuka, n = track.points.length;
    const at = t => { const p = track.points[Math.floor(t * n) % n]; return { x: p.x, y: p.y, heading: p.angle, t, speedMs: 70 }; };
    const car = at(0.3), fwd = { x: Math.cos(car.heading), y: Math.sin(car.heading) };
    const rel = v => ({ x: v.x - car.x, y: v.y - car.y });
    const dot = (a, b) => a.x * b.x + a.y * b.y;

    const chase = chaseView(car);
    const back = rel(chase.position), backDist = Math.hypot(back.x, back.y);
    assert(dot(back, fwd) < 0 && backDist >= 8 && backDist <= 20 && chase.position.z >= 2 && chase.position.z <= 6, 'Cámaras: persecución detrás del coche, a 8-20 m y algo elevada', JSON.stringify(chase.position));
    assert(Math.hypot(chase.target.x - car.x, chase.target.y - car.y) <= 3, 'Cámaras: la persecución mira al coche');

    const onboard = onboardView(car);
    assert(Math.hypot(onboard.position.x - car.x, onboard.position.y - car.y) <= 1.5 && onboard.position.z >= 0.8 && onboard.position.z <= 1.5, 'Cámaras: a bordo, a la altura del piloto', JSON.stringify(onboard.position));
    assert(dot(rel(onboard.target), fwd) >= 10, 'Cámaras: a bordo mira hacia delante');

    const heli = helicopterView(car, track);
    assert(heli.position.z >= 40, 'Cámaras: helicóptero alto', JSON.stringify(heli.position));
    const ahead = rel(heli.target);
    assert(dot(ahead, fwd) > 0 && Math.hypot(ahead.x, ahead.y) <= 100, 'Cámaras: el helicóptero se adelanta al coche', JSON.stringify(heli.target));

    const thin = [], onAsphalt = [];
    for (const id of ids) {
      const cams = tvCamerasFor(tracks[id], id), half = (tracks[id].trackWidthMeters || 12) / 2;
      if (cams.length < 8) thin.push(`${id}: ${cams.length}`);
      if (cams.some(c => axisDistance(tracks[id], c) < half + 3 || c.z < 3 || c.z > 30)) onAsphalt.push(id);
    }
    assert(thin.length === 0, 'Cámaras: al menos ocho cámaras de TV por circuito', thin.join(', '));
    assert(onAsphalt.length === 0, 'Cámaras: las de TV fuera de la pista, entre 3 y 30 m de alto', onAsphalt.join(', '));

    const director = new TvDirector(track, 'suzuka');
    let cuts = 0, last = null, lastCutAt = -Infinity, shortest = Infinity, close = 0, samples = 0;
    for (let s = 0; s <= 120; s += 0.1) {
      const c = at((s / 120) % 1);
      const shot = director.view(c, s);
      if (last !== null && shot.cameraIndex !== last) { cuts++; shortest = Math.min(shortest, s - lastCutAt); lastCutAt = s; }
      if (last === null) lastCutAt = s;
      last = shot.cameraIndex;
      samples++;
      if (Math.hypot(shot.view.position.x - c.x, shot.view.position.y - c.y) <= 250) close++;
    }
    assert(cuts >= 6, 'Cámaras: la realización de TV cambia de cámara a lo largo de la vuelta', String(cuts));
    assert(shortest >= TV_MIN_SHOT_SEC && TV_MIN_SHOT_SEC >= 3, 'Cámaras: cada plano de TV dura al menos 3 s', `${shortest.toFixed(1)} s`);
    assert(close / samples >= 0.9, 'Cámaras: la cámara de TV está cerca del coche (250 m) casi siempre', `${Math.round(100 * close / samples)} %`);
  });

  await test('Sol: la luz 3D cuadra con las sombras', () => {
    const sun = sunAt({ circuitId: 'barcelona', raceTimeSec: 0, cloudCover: 0 });
    const v = sunLightVector(sun), flat = Math.hypot(v.x, v.y);
    assert(Math.abs(Math.hypot(v.x, v.y, v.z) - 1) < 1e-6 && v.z > 0, 'Sol: vector unitario hacia el cielo', JSON.stringify(v));
    assert(Math.abs(v.x / flat + sun.dx) < 1e-6 && Math.abs(v.y / flat + sun.dy) < 1e-6, 'Sol: la luz viene del lado contrario a la sombra');
    assert(Math.abs(flat / v.z - sun.length) < 1e-6, 'Sol: la altura del sol da el largo de la sombra');
  });
}
