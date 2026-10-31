// PF2 — Renderizado 3D más ligero (Sprint 8). Contrato acordado con el usuario el 29/10/2026 (opción A del punto 3).
//  1. Instancias: los objetos repetidos del escenario (árboles, pinos, palmeras, torres de luz, carteles por
//     patrocinador, gradas, edificios, dunas, yates…) se dibujan en grupos de instancias, uno por modelo y variante
//     (patrocinador o color); cada objeto en un solo grupo, con la misma posición, tamaño y giro que antes. Los
//     modelos que salen una sola vez (monumentos) siguen sueltos.
//  2. Descartar lo que no se ve: los grupos se parten en trozos de unos 250 m para que three descarte los que quedan
//     fuera de cámara.
//  3. Detalle de los coches por tamaño en pantalla (opción A): el modelo completo solo cuando el coche mide 150 px o
//     más; por debajo, el ligero (y el punto de UX16 por debajo de 8 px). Margen del 20 % para no parpadear: quien va
//     completo sigue completo hasta bajar de 120 px. El usuario autoriza cambiar el caso de UX16 que pedía «completo»
//     para un coche de 40 px a 50 m.
//  4. Sombras ajustadas: la sombra de un coche se dibuja con su modelo ligero; las rayas de la pista siguen sin sombra.
//  5. Se ve igual: siguen en verde scenery-3d, scenery-3d-2, bridge-shadows y car-dots-ux16 (se ejecutan aparte).
//  6. Medida con la prueba de PF1 (llamadas y triángulos no dependen del dispositivo): Barcelona con la cámara de
//     persecución de 177 a 120 llamadas como mucho y de 681.000 a 350.000 triángulos como mucho; la vista general
//     también baja. El antes y el después, en docs/perf/linea-base.md.
import { readFileSync, existsSync } from 'node:fs';

/** Primitivas (llamadas de dibujo) de cada modelo de escenario, leídas de la cabecera del .glb. */
function primsOf(model) {
  const path = `public/models/scenery/${model}.glb`;
  if (!existsSync(path)) return 1;
  const b = readFileSync(path);
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  return Math.max(1, (json.meshes ?? []).reduce((s, m) => s + m.primitives.length, 0));
}

const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  // Se carga dentro de cada caso: si falta, falla el caso, no el módulo entero.
  const instP = load('/src/scene3d/instancing.ts'); instP.catch(() => {});
  // [CK3, autorizado por el usuario el 30/10/2026] los árboles y lo repetido del kit común van en sus propios grupos.
  const kitP = load('/src/scene3d/kitPlacement.ts'); kitP.catch(() => {});
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const sceneOf = id => { const sim = new RaceSimulation(id); return { track: sim.activeTrack, scenery: sceneryFor(sim.activeTrack, id) }; };
  const source = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');

  await test('PF2.1: instancias del escenario', async () => {
    const inst = await instP;
    const { scenery } = sceneOf('barcelona');
    const plan = inst.planInstances(scenery.items);
    const counts = new Map();
    for (const it of scenery.items) counts.set(it.model, (counts.get(it.model) ?? 0) + 1);
    const grouped = plan.groups.flatMap(g => g.items);
    assert(grouped.length + plan.singles.length === scenery.items.length && new Set([...grouped, ...plan.singles]).size === scenery.items.length, 'PF2: cada objeto en un solo sitio (grupo o suelto)');
    assert(plan.singles.every(it => counts.get(it.model) === 1) && grouped.every(it => counts.get(it.model) > 1), 'PF2: lo repetido va en grupos; lo único, suelto');
    assert(plan.groups.every(g => g.items.every(it => it.model === g.model && inst.variantKey(it) === inst.variantKey(g.items[0]))), 'PF2: un grupo por modelo y variante (patrocinador o color)');
    // [CK3, autorizado por el usuario el 30/10/2026] los árboles de Barcelona son ahora del kit: un grupo por pieza.
    const kit = await kitP, kplan = kit.kitPlacementFor(sceneOf('barcelona').track, 'barcelona');
    const kitTrees = kplan.pieces.filter(p => p.piece.startsWith('arbol_')).length;
    const grouped3 = kit.kitGroups(kplan).filter(g => g.piece.startsWith('arbol_')).reduce((s, g) => s + g.count, 0);
    assert(kitTrees > 0 && grouped3 === kitTrees, 'PF2: todos los árboles de Barcelona van en instancias', `${grouped3} de ${kitTrees}`);
    assert(/new THREE\.InstancedMesh\(/.test(source) && /planInstances\(/.test(source), 'PF2: la escena dibuja los grupos con InstancedMesh');
  });

  await test('PF2.1: misma posición, tamaño y giro', async () => {
    const inst = await instP;
    const { track, scenery } = sceneOf('monaco');
    const size = { x: 2, y: 4, z: 1 };
    for (const it of scenery.items.slice(0, 40)) {
      const t = inst.itemTransform(it, size, track);
      assert(t.x === it.x && t.y === it.y, 'PF2: la posición no cambia', it.model);
      assert(Math.abs(t.sx - it.length / 2) < 1e-9 && Math.abs(t.sy - it.height / 4) < 1e-9 && Math.abs(t.sz - it.width / 1) < 1e-9, 'PF2: el tamaño sale del largo, alto y ancho del objeto', it.model);
      const turn = ((t.heading - it.heading) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      assert(Math.abs(turn) < 1e-9 || Math.abs(turn - Math.PI) < 1e-9, 'PF2: el giro es el suyo (o media vuelta para mirar a la pista)', it.model);
      if (!inst.FACE_TRACK.has(it.kind)) assert(Math.abs(turn) < 1e-9, 'PF2: lo que no mira a la pista conserva su giro', it.model);
    }
  });

  await test('PF2.2: trozos para descartar lo que no se ve', async () => {
    const inst = await instP;
    assert(inst.INSTANCE_CHUNK_M >= 200 && inst.INSTANCE_CHUNK_M <= 300, 'PF2: trozos de unos 250 m', String(inst.INSTANCE_CHUNK_M));
    for (const id of ['barcelona', 'spa', 'monaco']) {
      const plan = inst.planInstances(sceneOf(id).scenery.items);
      for (const g of plan.groups) {
        const xs = g.items.map(it => it.x), ys = g.items.map(it => it.y);
        assert(Math.max(...xs) - Math.min(...xs) <= inst.INSTANCE_CHUNK_M && Math.max(...ys) - Math.min(...ys) <= inst.INSTANCE_CHUNK_M, 'PF2: ningún grupo ocupa más de un trozo', `${id} ${g.key}`);
      }
    }
    let before = 0, after = 0;
    const kit = await kitP;
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const items = sceneOf(id).scenery.items;
      // [CK3, autorizado por el usuario el 30/10/2026] el kit común cuenta: una llamada por pieza sin instancias, una por grupo con ellas.
      const kplan = kit.kitPlacementFor(sceneOf(id).track, id);
      before += kplan.pieces.length; after += kit.kitGroups(kplan).length;
      const plan = inst.planInstances(items);
      const now = items.reduce((s, it) => s + primsOf(it.model), 0);
      const next = plan.groups.reduce((s, g) => s + primsOf(g.model), 0) + plan.singles.reduce((s, it) => s + primsOf(it.model), 0);
      assert(next <= now, 'PF2: ningún circuito dibuja el escenario con más llamadas que antes', `${id}: ${now} → ${next}`);
      before += now; after += next;
    }
    assert(after <= before * 0.6, 'PF2: el escenario de los 23 circuitos baja al menos un 40 % sus llamadas (sin contar lo que se descarta)', `${before} → ${after}`);
  });

  await test('PF2.3: detalle de los coches por tamaño en pantalla', async () => {
    const d = await load('/src/scene3d/carDots.ts');
    assert(d.FULL_PX === 150 && d.FULL_HYSTERESIS === 0.2, 'PF2: corte del modelo completo en 150 px, con margen del 20 %');
    assert(d.carLevel(200, 25, undefined) === 'completo' && d.carLevel(150, 30, undefined) === 'completo', 'PF2: completo desde 150 px');
    assert(d.carLevel(149, 30, undefined) === 'ligero' && d.carLevel(40, 50, undefined) === 'ligero', 'PF2: por debajo de 150 px, el ligero aunque esté cerca');
    assert(d.carLevel(130, 35, 'completo') === 'completo' && d.carLevel(119, 40, 'completo') === 'ligero' && d.carLevel(130, 35, 'ligero') === 'ligero', 'PF2: quien va completo sigue así hasta bajar de 120 px (no parpadea)');
    assert(d.carLevel(7.9, 600, undefined) === 'punto', 'PF2: el punto de UX16 no cambia');
  });

  await test('PF2.4: sombras ajustadas', async () => {
    const d = await load('/src/scene3d/carDots.ts');
    assert(d.shadowSource('completo') === 'ligero' && d.shadowSource('ligero') === 'ligero' && d.shadowSource('punto') === null, 'PF2: la sombra de un coche sale de su modelo ligero; un punto no da sombra');
    assert(/shadowSource\(/.test(source), 'PF2: la escena decide la sombra de cada coche con shadowSource');
    assert(/add\(lines, '#e8e8e8', \{ cast: false \}\)/.test(source), 'PF2: las rayas de la pista siguen sin sombra');
  });

  // PF2.7 — Ampliación pedida por el usuario el 29/10/2026: con la cámara de persecución (y a bordo), el coche seguido y
  // los que están cerca de él van con el modelo completo, aunque midan menos de 150 px, para que en curvas cerradas o con
  // coches pegados delante o detrás se vean siempre con su calidad. Radio según el nivel (PF4): 80 m en alta, 40 m en
  // media y nada en baja (en baja, nunca completo); margen del 10 % para no parpadear al cruzar el radio.
  await test('PF2.7: coches cerca del coche seguido', async () => {
    const d = await load('/src/scene3d/carDots.ts');
    const { QUALITY_PROFILES } = await load('/src/settings/quality.ts');
    assert(QUALITY_PROFILES.alto.focusRadiusM === 80 && QUALITY_PROFILES.medio.focusRadiusM === 40 && QUALITY_PROFILES.bajo.focusRadiusM === 0, 'PF2: radio de 80 m en alta, 40 m en media y nada en baja');
    const car = (id, x, distanceM) => ({ id, teamId: `t${id}`, color: '#fff', status: 'running', isRetiredVisible: false, distanceM, x, y: 0 });
    // Cámara a 60 m del seguido (mide unos 70 px): sin la ampliación, ligero.
    const cars = [car(1, 0, 60), car(2, 50, 90), car(3, -30, 40), car(4, 150, 190)];
    const view = { fovDeg: 55, viewportHeightPx: 800, followedCarId: 1, fullCarPx: 150 };
    const plain = d.planCars(cars, view, new Map());
    assert(plain.every(p => p.level === 'ligero'), 'PF2: sin coche seguido en foco, la regla de los 150 px', plain.map(p => p.level).join(','));
    const near = new Map(d.planCars(cars, { ...view, focusCarId: 1, focusRadiusM: 80 }, new Map()).map(p => [p.id, p.level]));
    assert(near.get(1) === 'completo', 'PF2: el coche seguido, completo');
    assert(near.get(2) === 'completo' && near.get(3) === 'completo', 'PF2: los que están a menos de 80 m del seguido (delante o detrás), completos');
    assert(near.get(4) === 'ligero', 'PF2: los que están más lejos, con la regla de siempre');
    const prev = new Map([[2, 'completo']]);
    const edge = new Map(d.planCars([car(1, 0, 60), car(2, 85, 120)], { ...view, focusCarId: 1, focusRadiusM: 80 }, prev).map(p => [p.id, p.level]));
    assert(edge.get(2) === 'completo', 'PF2: quien ya va completo sigue así hasta pasar de 88 m (no parpadea)');
    const low = d.planCars(cars, { ...view, fullCarPx: Infinity, focusCarId: 1, focusRadiusM: 0 }, new Map());
    assert(low.every(p => p.level === 'ligero'), 'PF2: en calidad baja, nunca completo');
    const far = d.planCars([car(1, 0, 3000), car(2, 20, 3000)], { ...view, focusCarId: 1, focusRadiusM: 80 }, new Map());
    assert(far.every(p => p.level === 'punto'), 'PF2: de muy lejos siguen siendo puntos');
    const canvas = readFileSync('src/components/RaceCanvas.tsx', 'utf8');
    assert(/focusCarId/.test(source) && /focusRadiusM/.test(source), 'PF2: la escena 3D pasa el coche en foco y el radio del nivel');
    assert(/focusCarId[^\n]*(persecucion|a-bordo)/.test(canvas), 'PF2: el foco se pone con las cámaras de persecución y a bordo');
  });

  await test('PF2.6: medida antes y después', () => {
    const md = readFileSync('docs/perf/linea-base.md', 'utf8');
    const at = md.indexOf('## PF2');
    assert(at >= 0, 'PF2: docs/perf/linea-base.md tiene la sección de PF2');
    const rows = md.slice(at).split(/\r?\n/).filter(l => /^\|/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
    const header = rows[0] ?? [];
    const cols = ['Escena', 'Llamadas antes', 'Llamadas después', 'Triángulos antes', 'Triángulos después'];
    assert(cols.every(c => header.includes(c)), 'PF2: la tabla tiene las columnas acordadas', header.join(' | '));
    const row = name => rows.slice(2).find(r => r[header.indexOf('Escena')] === name);
    const chase = row('Barcelona, persecución'), overview = row('Barcelona, vista general');
    assert(Boolean(chase && overview), 'PF2: se miden la persecución y la vista general de Barcelona');
    if (!chase || !overview) return;
    const v = (r, c) => num(r[header.indexOf(c)]);
    assert(v(chase, 'Llamadas antes') === 177 && v(chase, 'Triángulos antes') === 681000, 'PF2: el antes es la medida de PF1 (177 llamadas, 681.000 triángulos)');
    assert(v(chase, 'Llamadas después') <= 120, 'PF2: persecución, 120 llamadas como mucho', String(v(chase, 'Llamadas después')));
    assert(v(chase, 'Triángulos después') <= 350000, 'PF2: persecución, 350.000 triángulos como mucho', String(v(chase, 'Triángulos después')));
    assert(v(overview, 'Llamadas después') < v(overview, 'Llamadas antes'), 'PF2: la vista general también baja');
  });
}
