// VS2 — Ambiente de los circuitos (Sprint 11). Contrato acordado con el usuario el 13/11/2026:
//  1. El cielo no es un color plano y da tres aspectos distintos: día, atardecer y noche.
//  2. Con lluvia hay gotas y estela en 3D, y el asfalto se oscurece; en seco, nada de eso.
//     (Las gotas ya se pintaban encima de la vista 3D antes de VS2, con WeatherRenderer.renderDrops; VS2 añade la estela
//     de los coches y la película de agua sobre el asfalto dentro de la escena.)
//  3. Todas las gradas de los 22 circuitos llevan público (las del escenario y las piezas de grada del kit).
//  4. Las chispas solo salen por encima de una velocidad y son reproducibles (misma carrera, mismas chispas).
//  5. Todo el ambiente añade seis llamadas de dibujo como mucho, y el límite de 250 no se toca.
//  6. No entra ningún archivo nuevo en la descarga; el límite de la instalación sin conexión no se toca.
//  7. En calidad baja no hay partículas.
//  8. La carrera no cambia: lo vigilan los tests de simulación, en verde sin tocarlos.
//  9. Capturas de antes y después de día, al atardecer, de noche y con lluvia (docs/design/vs2-capturas/).
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const SHOTS = 'docs/design/vs2-capturas';
const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const amb = await load('/src/scene3d/ambience.ts');
  const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8'), meshes = readFileSync('src/scene3d/ambienceMeshes.ts', 'utf8'), rules = readFileSync('src/scene3d/ambience.ts', 'utf8');

  await test('VS2.1: cielo según la hora', async () => {
    const { sunAt } = await load('/src/renderer/lighting.ts');
    const day = amb.skyLook({ mode: 'sol', dx: 0, dy: 1, length: 0.6, alpha: 0.45 }, 0), dusk = amb.skyLook({ mode: 'sol', dx: 1, dy: 0, length: 4, alpha: 0.45 }, 0), night = amb.skyLook({ mode: 'focos', dx: 0.6, dy: 0.8, length: 0.25, alpha: 0.25 }, 0);
    assert(day.phase === 'dia' && dusk.phase === 'atardecer' && night.phase === 'noche', 'VS2: el cielo tiene día, atardecer y noche', `${day.phase}, ${dusk.phase}, ${night.phase}`);
    assert([day, dusk, night].every(l => dist(l.zenith, l.horizon) > 0.05), 'VS2: el cielo no es un color plano: cambia del horizonte al cénit');
    assert(dist(day.horizon, dusk.horizon) > 0.2 && dist(day.zenith, night.zenith) > 0.5 && dist(dusk.horizon, night.horizon) > 0.5, 'VS2: los tres aspectos se distinguen entre sí');
    assert(night.stars > 0 && day.stars === 0 && dusk.stars === 0, 'VS2: estrellas solo de noche');
    assert(amb.skyLook({ mode: 'focos', dx: 0, dy: 1, length: 0.25, alpha: 0.2 }, 1).stars < night.stars && dist(amb.skyLook({ mode: 'sol', dx: 0, dy: 1, length: 0.6, alpha: 0.4 }, 1).zenith, day.zenith) > 0.1, 'VS2: las nubes tapan estrellas y agrisan el cielo');
    // Con el sol del juego: Barcelona sale de día y acaba con el sol bajo; Las Vegas es de noche.
    const at = (id, s) => amb.skyLook(sunAt({ circuitId: id, raceTimeSec: s, cloudCover: 0 }), 0);
    assert(at('barcelona', 0).phase === 'dia' && at('las-vegas', 0).phase === 'noche', 'VS2: Barcelona empieza de día y Las Vegas es de noche', `${at('barcelona', 0).phase}, ${at('las-vegas', 0).phase}`);
    assert(at('barcelona', 5400).dusk > at('barcelona', 0).dusk, 'VS2: el cielo se va poniendo de atardecer según avanza la carrera', `${at('barcelona', 0).dusk.toFixed(2)} → ${at('barcelona', 5400).dusk.toFixed(2)}`);
    assert(/skyLook\(sun/.test(scene) && /createSky\(\)/.test(scene) && /updateSky\(/.test(scene), 'VS2: la escena 3D dibuja la cúpula del cielo en cada fotograma');
  });

  await test('VS2.2: lluvia en 3D', async () => {
    const { sprayLevel } = await load('/src/renderer/WeatherRenderer.ts');
    assert(amb.wetFilm([], []) === 0 && amb.wetFilm([0, 0, 0], [0, 0, 0]) === 0, 'VS2: en seco el asfalto no se oscurece');
    const damp = amb.wetFilm([0, 0], [3, 0]), soaked = amb.wetFilm([1.5, 1.2], [8, 8]);
    assert(damp > 0 && soaked > damp && soaked <= amb.WET_FILM_MAX, 'VS2: el asfalto se oscurece cuando llueve y más cuanta más agua hay', `llovizna ${damp.toFixed(2)}, mojado ${soaked.toFixed(2)}`);
    const car = { id: 4, x: 100, y: 50, z: 0, angle: 0.7 }, trail = amb.trailPoints(car, 12.3, amb.SPRAY, 1);
    const behind = trail.every(p => (p.x - car.x) * Math.cos(car.angle) + (p.y - car.y) * Math.sin(car.angle) < 0);
    assert(trail.length === amb.SPRAY.count && behind && trail.every(p => p.z > car.z), 'VS2: la estela de agua sale detrás del coche y se levanta del suelo', `${trail.length} puntos`);
    assert(sprayLevel(300, 0) === 0 && sprayLevel(250, 1.5) > 0, 'VS2: sin agua bajo el coche no hay estela');
    assert(/sprayLevel\(car\.currentSpeedKmh, wet\.depthAt\(car\.trackT\)\)/.test(scene) && /wetFilm\(wet\.waterMm, wet\.rainMmH\)/.test(scene), 'VS2: la escena pinta la estela y la película de agua con el agua de la pista');
    assert(/renderDrops\(ctx, track, camera, frame\.rain/.test(readFileSync('src/components/RaceCanvas.tsx', 'utf8')), 'VS2: las gotas se siguen pintando sobre la vista 3D');
  });

  await test('VS2.3: público en todas las gradas', async () => {
    const { sceneryFor, KIT_CIRCUIT } = await load('/src/scene3d/scenery.ts');
    const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
    const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
    const { kitPlacementFor, drawnScenery } = await load('/src/scene3d/kitPlacement.ts');
    const { CIRCUIT_KIT } = await load('/src/scene3d/circuitKit.ts');
    const dims = piece => CIRCUIT_KIT.find(p => p.id === piece)?.dims;
    let stands = 0, people = 0, worst = { id: '', seats: 0 }; const empty = [], bare = [];
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const track = new RaceSimulation(id).activeTrack, kit = KIT_CIRCUIT(id) ? kitPlacementFor(track, id, { quality: 'alto' }) : null;
      const list = amb.standsOf(drawnScenery(kit, sceneryFor(track, id)), kit?.pieces ?? [], dims);
      if (!list.length) bare.push(id);
      let seats = 0;
      for (const s of list) { const n = amb.crowdSeats(s, track.points, 16).length; if (!n) empty.push(`${id}/${s.id}`); seats += n; }
      stands += list.length; people += seats; if (seats > worst.seats) worst = { id, seats };
    }
    assert(stands > 0 && empty.length === 0, 'VS2: cada grada lleva público', empty.slice(0, 5).join(', ') || `${stands} gradas, ${people} personas`);
    assert(bare.length <= 1, 'VS2: hay gradas con público en los circuitos', bare.join(', ') || 'en todos');
    assert(worst.seats <= 150000, 'VS2: el público cabe en una sola nube de puntos', `${worst.id}: ${worst.seats}`);
    const stand = { id: 'p', x: 0, y: 30, heading: 0, length: 60, width: 14, height: 15 }, seats = amb.crowdSeats(stand, [{ x: 0, y: 0 }, { x: 10, y: 0 }], 16);
    const front = seats.reduce((a, b) => (a.y < b.y ? a : b)), back = seats.reduce((a, b) => (a.y > b.y ? a : b));
    assert(front.up < back.up, 'VS2: las filas suben desde el lado de la pista hacia atrás', `${front.up.toFixed(1)} m → ${back.up.toFixed(1)} m`);
    assert(amb.crowdSeats(stand, [{ x: 0, y: 0 }], 16, 0.5).length < seats.length * 0.7, 'VS2: en calidad baja la grada lleva menos puntos');
  });

  await test('VS2.4: chispas', () => {
    const times = Array.from({ length: 400 }, (_, i) => i * 0.31);
    assert(times.every(t => !amb.sparking(7, amb.SPARK_MIN_KMH - 1, t)), `VS2: por debajo de ${amb.SPARK_MIN_KMH} km/h no hay chispas`);
    const on = times.filter(t => amb.sparking(7, 320, t)).length;
    assert(on > 20 && on < 300, 'VS2: a fondo hay chispas a ráfagas, no siempre', `${on} de ${times.length} instantes`);
    const car = { id: 7, x: 5, y: 9, z: 1, angle: 2 };
    assert(times.every(t => amb.sparking(7, 320, t) === amb.sparking(7, 320, t)) && JSON.stringify(amb.trailPoints(car, 33.3, amb.SPARKS)) === JSON.stringify(amb.trailPoints(car, 33.3, amb.SPARKS)), 'VS2: las chispas son reproducibles');
    assert(!/Math\.random/.test(rules) && !/Math\.random/.test(meshes), 'VS2: el ambiente no usa el azar');
  });

  await test('VS2.5, 6 y 7: llamadas de dibujo, descarga y calidad baja', () => {
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    assert(amb.AMBIENCE_OBJECTS.length <= 6, 'VS2: el ambiente añade seis llamadas de dibujo como mucho', amb.AMBIENCE_OBJECTS.join(', '));
    const made = (meshes.match(/new THREE\.(Mesh|Points)\(/g) ?? []).length, added = (scene.match(/create(Sky|WetFilm|Trail|Crowd)\(/g) ?? []).length;
    assert(made === 4 && added === 5, 'VS2: cada objeto del ambiente es una sola malla o nube de puntos', `${made} constructores, ${added} objetos en la escena`);
    assert(budget.limits.sceneryDrawCallsPerCircuit === 250, 'VS2: el límite de llamadas de dibujo no se toca', String(budget.limits.sceneryDrawCallsPerCircuit));
    assert(!/TextureLoader|\.glb|\.png|\.webp|\.jpg|url\(|fetch\(/.test(rules + meshes), 'VS2: el ambiente se genera por código, sin archivos nuevos');
    assert(budget.limits.offlineCoreKB === 8870, 'VS2: el límite de la instalación sin conexión no se toca', String(budget.limits.offlineCoreKB));
    assert(/if \(this\.quality !== QUALITY_PROFILES\.bajo\) for \(const car of frame\.cars\)/.test(scene), 'VS2: en calidad baja no hay partículas');
  });

  await test('VS2.9: capturas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const need = ['dia', 'atardecer', 'noche', 'lluvia'].flatMap(s => ['antes', 'despues'].map(m => `${s}-${m}`)).filter(n => !shots.some(f => f.startsWith(n + '.')));
    assert(need.length === 0, `VS2: capturas de antes y después en ${SHOTS}/`, need.join(', ') || 'ok');
  });
}
