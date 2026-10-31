// Vista 3D, segunda tanda (PROPUESTA DE CONTRATO, 22/10/2026).
// Petición del usuario tras probar el piloto: el toro como el de verdad (arco alto por encima), barreras TecPro con
// patrocinadores ficticios que parodian a los oficiales, más agua en Mónaco, Abu Dabi de noche con luces, el hotel que
// cambia suavemente entre rojos y azules y fuegos artificiales al acabar la carrera, un coche ligero sacado del modelo
// de verdad (no cajas), una sola barra de cámaras (la de arriba) y dos cámaras cenitales: la que sigue al coche elegido
// y otra que gira con él para que se vea siempre en horizontal. Lo que se puede probar sin pantalla:
//  1. Barreras TecPro en todos los circuitos, fuera del asfalto, con patrocinadores de parodia (ninguno real).
//  2. Mónaco: mucha más agua (puerto y mar) y más barcos.
//  3. Abu Dabi: hotel sobre la pista, torre de control junto a la meta, puerto deportivo con barcos, focos por todo el
//     circuito (también en las carreras de noche) y fuegos artificiales solo al acabar la carrera y solo allí.
//  4. Color del hotel: siempre entre rojos y azules, sin saltos, pasando por los dos.
//  5. Coche ligero: sacado del modelo del juego, con sus colores de librea y pocos triángulos.
//  6. Cámaras: ocho modos con las dos cenitales; la barra de arriba los recorre todos en la vista 3D.
//  Cómo se ve (el toro, las barreras, la noche, los fuegos) se comprueba en el navegador con capturas.
import { existsSync, readFileSync, statSync } from 'node:fs';

/** Patrocinadores reales que no pueden aparecer tal cual (con límites de palabra). */
const REAL_SPONSORS = ['Rolex', 'DHL', 'Aramco', 'Heineken', 'Lenovo', 'Crypto.com', 'Etihad', 'Emirates', 'Salesforce', 'AWS',
  'Pirelli', 'MSC', 'Qatar Airways', 'Louis Vuitton', 'TAG Heuer', 'Paramount', 'Globant', 'Oracle', 'Petronas', 'Shell', 'Santander',
  'Allianz', 'Mastercard', 'Visa', 'Lego', 'LEGO', 'Pepsi', 'Coca-Cola', 'Red Bull', 'Ferrari', 'Mercedes', 'McLaren', 'Formula 1', 'F1', 'FIA', 'ADNOC'];
const word = term => new RegExp(`(?<![\\p{L}\\p{N}_-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u');

function glbInfo(path) {
  const buf = readFileSync(path);
  const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  let tris = 0;
  for (const mesh of gltf.meshes ?? []) for (const prim of mesh.primitives ?? []) {
    tris += (prim.indices !== undefined ? gltf.accessors[prim.indices].count : gltf.accessors[prim.attributes.POSITION].count) / 3;
  }
  return { tris, materials: (gltf.materials ?? []).map(m => m.name) };
}
const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
const inside = (pt, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { SPONSORS } = await load('/src/scene3d/sponsors.ts');
  const { yasHotelColor, FIREWORK_CIRCUITS, fireworkBursts } = await load('/src/scene3d/effects.ts');
  const { CAMERA_MODES, cenitalView, cenitalGiroView } = await load('/src/scene3d/cameras.ts');
  const { Camera } = await load('/src/renderer/Camera.ts');
  const { NIGHT_RACES } = await load('/src/renderer/lighting.ts');
  const { CAR_MODEL } = await load('/src/renderer/carModel3d.ts');
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

  // [CK3, autorizado por el usuario el 30/10/2026] con el kit común, las TecPro solo quedan en Mónaco; en el resto mandan
  // los muros de neumáticos del kit, y la publicidad de parodia la llevan sus vallas y carteles.
  const { kitPlacementFor } = await load('/src/scene3d/kitPlacement.ts');
  const kits = Object.fromEntries(ids.map(id => [id, kitPlacementFor(tracks[id], id)]));
  await test('Barreras TecPro con patrocinadores de parodia', () => {
    const few = ids.filter(id => id === 'monaco' ? scenes[id].barriers.filter(b => b.kind === 'tecpro').length < 3 : kits[id].pieces.filter(p => p.piece === 'muro_neumaticos').length < 3);
    assert(few.length === 0, 'TecPro: al menos tres tramos en cada circuito', few.join(', '));
    const onTrack = [];
    for (const id of ids) {
      const half = (tracks[id].trackWidthMeters || 12) / 2;
      for (const b of scenes[id].barriers.filter(b => b.kind === 'tecpro')) if (b.points.some(p => axisDistance(tracks[id], p) < half + 1.5)) onTrack.push(id);
    }
    assert(onTrack.length === 0, 'TecPro: siempre fuera del asfalto', [...new Set(onTrack)].join(', '));
    const used = new Set([...ids.flatMap(id => scenes[id].barriers.filter(b => b.kind === 'tecpro').map(b => b.sponsor)), ...ids.flatMap(id => kits[id].pieces.filter(p => p.sponsor).map(p => p.sponsor))]);
    assert([...used].every(s => SPONSORS.includes(s)) && used.size >= 6, 'TecPro: cada tramo lleva un patrocinador de la lista, y hay variedad', [...used].join(', '));
    const real = SPONSORS.filter(s => REAL_SPONSORS.some(r => word(r).test(s)));
    assert(SPONSORS.length >= 10 && real.length === 0, 'TecPro: diez o más patrocinadores, todos de parodia', real.join(', '));
  });

  await test('Mónaco: más agua y más barcos', () => {
    const monaco = scenes.monaco;
    const water = monaco.water.reduce((s, poly) => s + area(poly), 0);
    assert(water >= 250000, 'Mónaco: puerto y mar, al menos 25 hectáreas de agua', `${Math.round(water / 10000)} ha`);
    const yachts = monaco.items.filter(it => it.kind === 'yacht');
    assert(yachts.length >= 20 && yachts.every(y => monaco.water.some(poly => inside(y, poly))), 'Mónaco: veinte barcos o más, todos en el agua', String(yachts.length));
  });

  await test('Abu Dabi: hotel, torre, puerto, focos y fuegos artificiales', () => {
    const track = tracks['yas-marina'], scene = scenes['yas-marina'], half = (track.trackWidthMeters || 12) / 2;
    const hotel = scene.items.find(it => it.id === 'yas-hotel');
    assert(hotel && hotel.kind === 'bridge' && hotel.clearance >= 8 && axisDistance(track, hotel) <= half, 'Abu Dabi: el hotel pasa por encima de la pista', JSON.stringify(hotel && { clearance: hotel.clearance }));
    const tower = scene.items.find(it => it.id === 'torre-yas');
    const start = track.points[0];
    assert(tower && tower.kind === 'landmark' && Math.hypot(tower.x - start.x, tower.y - start.y) <= 400, 'Abu Dabi: la torre de control junto a la meta');
    const yachts = scene.items.filter(it => it.kind === 'yacht');
    assert(scene.water.length > 0 && yachts.length >= 8 && yachts.every(y => scene.water.some(poly => inside(y, poly))), 'Abu Dabi: puerto deportivo con barcos', String(yachts.length));
    // [CK3, autorizado por el usuario el 30/10/2026] las luces de la noche son los postes de luz del kit.
    const lit = [...NIGHT_RACES, 'yas-marina'].filter(id => kits[id].pieces.filter(p => p.piece === 'poste_luz').length < 40);
    assert(lit.length === 0, 'Focos: cuarenta o más torres de luz en Abu Dabi y en las carreras de noche', lit.join(', '));
    assert(FIREWORK_CIRCUITS.includes('yas-marina') && FIREWORK_CIRCUITS.length === 1, 'Fuegos: solo en Abu Dabi', FIREWORK_CIRCUITS.join(', '));
    assert(fireworkBursts('yas-marina', track, null).length === 0, 'Fuegos: nada mientras no acaba la carrera');
    assert(fireworkBursts('barcelona', tracks.barcelona, 5).length === 0, 'Fuegos: en otro circuito, nada aunque acabe');
    const bursts = fireworkBursts('yas-marina', track, 5);
    assert(bursts.length > 0 && bursts.every(b => b.z >= 40 && Math.hypot(b.x - start.x, b.y - start.y) <= 600), 'Fuegos: al acabar, en el cielo sobre la meta', String(bursts.length));
    assert(fireworkBursts('yas-marina', track, 90).length === 0, 'Fuegos: se apagan pasado un minuto');
  });

  await test('Hotel de Abu Dabi: de rojo a azul, suave', () => {
    let reddest = 0, bluest = 0, worstJump = 0, outside = 0, prev = null;
    for (let t = 0; t <= 120; t += 0.1) {
      const c = yasHotelColor(t);
      if (c.g > Math.max(c.r, c.b) * 0.5) outside++;
      reddest = Math.max(reddest, c.r - c.b); bluest = Math.max(bluest, c.b - c.r);
      if (prev) worstJump = Math.max(worstJump, Math.abs(c.r - prev.r) + Math.abs(c.g - prev.g) + Math.abs(c.b - prev.b));
      prev = c;
    }
    assert(outside === 0, 'Hotel: siempre entre rojos, morados y azules (poco verde)', String(outside));
    assert(reddest >= 0.4 && bluest >= 0.4, 'Hotel: pasa por un rojo claro y por un azul claro', `${reddest.toFixed(2)} / ${bluest.toFixed(2)}`);
    assert(worstJump <= 0.05, 'Hotel: cambia suavemente (sin saltos en una décima de segundo)', worstJump.toFixed(3));
  });

  await test('Coche ligero sacado del modelo del juego', () => {
    const path = 'public/models/f1-car-lod.glb';
    assert(existsSync(path), 'Coche ligero: existe public/models/f1-car-lod.glb');
    if (!existsSync(path)) return;
    const info = glbInfo(path);
    assert(info.tris <= 10000 && info.tris >= 1500, 'Coche ligero: entre 1500 y 10 000 triángulos (no una caja)', String(info.tris));
    assert(statSync(path).size <= 600 * 1024, 'Coche ligero: 600 KB como mucho', `${Math.round(statSync(path).size / 1024)} KB`);
    assert([CAR_MODEL.materials.primary, CAR_MODEL.materials.secondary].every(m => info.materials.includes(m)), 'Coche ligero: con los colores de la librea', info.materials.join(', '));
  });

  await test('Cámaras: dos cenitales y una sola barra', () => {
    assert(CAMERA_MODES.length === 8 && ['cenital', 'cenital-giro'].every(m => CAMERA_MODES.includes(m)), 'Cámaras: ocho modos con las dos cenitales', CAMERA_MODES.join(', '));
    const car = { x: 100, y: 50, heading: 0.7, t: 0.2 };
    const top = cenitalView(car, 1);
    assert(Math.hypot(top.position.x - car.x, top.position.y - car.y) < 0.5 && top.position.z >= 60 && Math.hypot(top.target.x - car.x, top.target.y - car.y) < 0.5, 'Cenital: justo encima del coche elegido, mirándolo', JSON.stringify(top.position));
    assert(top.up && Math.abs(top.up.x) < 1e-6 && top.up.y < 0, 'Cenital: con el norte arriba, como la vista de siempre', JSON.stringify(top.up));
    assert(cenitalView(car, 2).position.z < top.position.z, 'Cenital: con zoom, más cerca');
    const turn = cenitalGiroView(car, 1);
    const along = turn.up.x * Math.cos(car.heading) + turn.up.y * Math.sin(car.heading);
    assert(Math.abs(along) < 1e-6 && Math.hypot(turn.up.x, turn.up.y) > 0.99, 'Cenital que gira: el coche siempre en horizontal (arriba de la pantalla, perpendicular a su marcha)', JSON.stringify(turn.up));
    const cam = new Camera();
    cam.view3d = true;
    cam.mode3d = CAMERA_MODES[0];
    const seen = [];
    for (let i = 0; i < CAMERA_MODES.length; i++) { cam.cycleMode(); seen.push(cam.mode3d); }
    assert(seen.join() === [...CAMERA_MODES.slice(1), CAMERA_MODES[0]].join(), 'Barra de arriba: en 3D, su botón recorre los ocho modos', seen.join(', '));
    const canvas = readFileSync('src/components/RaceCanvas.tsx', 'utf8');
    assert(!canvas.includes('data-camera-mode'), 'Barra de arriba: la pista ya no lleva su propia fila de botones de cámara');
  });
}
