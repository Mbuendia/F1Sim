// G8 — Pista en WebGL (Sprint 4.5). Contrato escrito el 13/10/2026 (el usuario autorizó ese día el sprint y revisar los
// contratos al llegar a cada tarea). WebGL no existe en Node: aquí se prueba lo que se sube a la GPU y lo que deja de
// pintar el Canvas; lo pintado se revisa en el navegador.
//  1. Las capas fijas (`trackLayers.ts`) salen de la misma geometría que el Canvas: un asfalto al ancho del circuito,
//     los dos bordes blancos de `getPitLaneGeometry`, la meta de borde a borde, 20 cajones de parrilla dentro de la
//     pista, boxes y pianos; sin coordenadas inválidas, en los 23 circuitos.
//  2. Con la pista en la GPU, el Canvas no vuelve a pintar esas formas (ni un trazo ni un relleno de pista) y conserva
//     los rótulos y la goma de la trazada.
//  3. Sin WebGL el Canvas pinta lo mismo que antes (respaldo).
export default async function run({ server, assert, test }) {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const { buildTrackLayers, getTrackLayers, FINISH_LINE_M } = await server.ssrLoadModule('/src/renderer/trackLayers.ts');
  const { getPitLaneGeometry } = await server.ssrLoadModule('/src/utils/pitLaneGeometry.ts');
  const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
  const { frameCost, recordStage, resetFrameCost } = await server.ssrLoadModule('/src/renderer/frameCost.ts');

  const nearestAxis = (p, points) => {
    let best = Infinity;
    for (const q of points) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    return best;
  };

  await test('G8: capas fijas de los 23 circuitos', () => {
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const track = buildTrackFromSvg(OFFICIAL_CIRCUITS[id]);
      const layers = buildTrackLayers(track, id), shapes = layers.shapes;
      assert(shapes.length > 40 && shapes.every(s => s.points.length >= (s.kind === 'fill' ? 3 : 2) && s.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))),
        `G8 ${id}: formas completas y sin coordenadas inválidas`, String(shapes.length));
      const asphalt = shapes.filter(s => s.role === 'asphalt');
      assert(asphalt.length === 1 && asphalt[0].width === track.trackWidthMeters && asphalt[0].closed && asphalt[0].points.length === track.points.length,
        `G8 ${id}: un asfalto, al ancho del circuito y sobre todo el eje`);
      const edges = getPitLaneGeometry(track).trackEdges;
      const white = shapes.filter(s => s.kind === 'stroke' && s.hairline && s.closed && s.color === '#ffffff' && s.points.length === track.points.length);
      assert(white.length === 2 && white.every((s, i) => s.points === edges[i]), `G8 ${id}: los bordes blancos son los de la geometría común`);
      // Cuadros de la meta: los que caen sobre la línea (medio grosor a lo largo de la pista, medio ancho a lo ancho).
      const start = track.points[0], along = { x: Math.cos(start.angle), y: Math.sin(start.angle) };
      const onLine = p => Math.abs((p.x - start.x) * along.x + (p.y - start.y) * along.y) <= FINISH_LINE_M / 2 + 1e-6 && Math.abs(-(p.x - start.x) * along.y + (p.y - start.y) * along.x) <= track.trackWidthMeters / 2 + 1e-6;
      const squares = shapes.filter(s => s.kind === 'fill' && s.points.length === 4 && (s.color === '#ffffff' || s.color === '#000000') && s.points.every(onLine));
      const span = Math.max(...squares.flatMap(s => s.points.map(p => Math.abs(-(p.x - start.x) * along.y + (p.y - start.y) * along.x))));
      assert(squares.length === 10 && Math.abs(span - track.trackWidthMeters / 2) < 1e-6, `G8 ${id}: meta ajedrezada de borde a borde`, `${squares.length} · ${span.toFixed(2)} m`);
      const brackets = shapes.filter(s => s.kind === 'stroke' && s.hairline && !s.closed && s.points.length === 4 && s.width === 0.15);
      assert(brackets.length === 20 && brackets.every(s => s.points.every(p => nearestAxis(p, track.points) <= track.trackWidthMeters / 2)),
        `G8 ${id}: 20 cajones de parrilla dentro de la pista`, String(brackets.length));
      assert(getTrackLayers(track, id) === getTrackLayers(track, id), `G8 ${id}: las capas se calculan una vez por pista`);
    }
  });

  await test('G8: con la pista en la GPU el Canvas solo pinta goma y rótulos', () => {
    const track = buildTrackFromSvg(OFFICIAL_CIRCUITS.barcelona);
    const record = gpu => {
      const strokes = [], fills = [], texts = [];
      const ctx = new Proxy({
        stroke: () => strokes.push({ color: ctx.strokeStyle, width: ctx.lineWidth }),
        fill: () => fills.push(ctx.fillStyle),
        fillText: text => texts.push(text),
        measureText: text => ({ width: text.length * 6 }),
      }, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
      const zoom = 3;
      const camera = { zoom, rotation: 0, x: 0, y: 0, screenWidth: 1200, screenHeight: 800, worldToScreen: (x, y) => ({ x: x * zoom, y: y * zoom }) };
      TrackRenderer.renderTrack(ctx, track, camera, 1, undefined, 'barcelona', gpu);
      return { strokes, fills, texts };
    };
    const canvas = record(false), gpu = record(true);
    assert(canvas.strokes.some(s => s.width === track.trackWidthMeters * 3) && canvas.fills.length > 10, 'G8: sin WebGL el Canvas pinta el asfalto y los rellenos (respaldo)',
      `${canvas.strokes.length} trazos · ${canvas.fills.length} rellenos`);
    assert(!gpu.strokes.some(s => s.width === track.trackWidthMeters * 3), 'G8: con WebGL el Canvas no pinta el asfalto');
    const rubber = /^rgba\((20, 22, 28|13, 16, 23),/;
    assert(gpu.strokes.length > 0 && gpu.strokes.every(s => rubber.test(String(s.color)) || s.color === 'rgba(255, 255, 255, 0.15)'), 'G8: con WebGL los únicos trazos del Canvas son la goma de la trazada y el marco de los rótulos',
      [...new Set(gpu.strokes.map(s => s.color))].join(' | '));
    assert(gpu.fills.every(f => f === 'rgba(10, 15, 25, 0.88)'), 'G8: con WebGL los únicos rellenos del Canvas son el fondo de los rótulos de curva', [...new Set(gpu.fills)].join(' | '));
    assert(gpu.texts.length > 0 && JSON.stringify(gpu.texts) === JSON.stringify(canvas.texts), 'G8: los rótulos son los mismos con y sin WebGL', `${gpu.texts.length} / ${canvas.texts.length}`);
  });

  // G9: el coste por fase del fotograma se mide con una media móvil (los valores reales se leen en el navegador).
  await test('G9: medida del coste por fotograma', () => {
    resetFrameCost();
    recordStage('coches', 4);
    assert(frameCost.ms.coches === 4, 'G9: la primera medida de una fase es su valor');
    frameCost.frames = 1;
    recordStage('coches', 10);
    assert(frameCost.ms.coches > 4 && frameCost.ms.coches < 4.2, 'G9: las siguientes entran en una media móvil lenta', String(frameCost.ms.coches));
    resetFrameCost();
    assert(frameCost.frames === 0 && Object.values(frameCost.ms).every(v => v === 0), 'G9: la medida se puede poner a cero');
  });
  // G9 (ampliado el 13/10/2026 a petición del usuario): coches, Safety Car y spray en WebGL. Aquí se prueba lo que se
  // manda a la GPU (`carDraws.ts`) y lo que deja de pintar el Canvas.
  await test('G9: coches, Safety Car y spray que pinta la GPU', async () => {
    const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    const { buildCarDraws, buildSafetyCarDraw } = await server.ssrLoadModule('/src/renderer/carDraws.ts');
    const sprites = await server.ssrLoadModule('/src/renderer/carSprites.ts');
    const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
    const { SpraySystem, SPRAY } = await server.ssrLoadModule('/src/renderer/SprayParticles.ts');
    const { compoundStyle } = await server.ssrLoadModule('/src/utils/compounds.ts');
    const sim = new RaceSimulation('barcelona');
    sim.lightState = 'racing';
    sim.cars.forEach((car, i) => Object.assign(car, { progress: 2.3 - i * 0.002, trackT: (2.3 - i * 0.002) % 1, currentLap: 2, currentSpeedKmh: 200 }));
    sim.update(1 / 60);
    const track = sim.activeTrack, target = sim.cars[3];
    const cameraAt = zoom => ({ zoom, rotation: 0, x: target.worldX, y: target.worldY, screenWidth: 1200, screenHeight: 800,
      worldToScreen: (x, y) => ({ x: 600 + (x - target.worldX) * zoom, y: 400 + (y - target.worldY) * zoom }) });
    sprites.clearTrackSprites();

    // De lejos: un punto por coche visible, también sin imágenes.
    const far = buildCarDraws(sim.cars, cameraAt(0.5), target.id, track, 3, {});
    assert(far.length === 20 && far.every(d => d.mode === 'dot') && far.at(-1).id === target.id && far.at(-1).ringColor === '#ffd700',
      'G9: de lejos, un punto por coche y el seleccionado el último, con su contorno', String(far.length));
    // De cerca sin imagen: lo pinta el Canvas (dibujo vectorial).
    assert(buildCarDraws(sim.cars, cameraAt(3), target.id, track, 3, {}).length === 0, 'G9: sin imagen del modelo, el coche lo pinta el Canvas');

    const image = { width: 256, height: 96 };
    const model = { levels: [image], lengthM: 5.6, widthM: 2.0, wheels: [[1.6, 0.8], [1.6, -0.8], [-1.7, 0.8], [-1.7, -0.8]], tyre: { lengthM: 0.7, widthM: 0.4 }, rearWing: { x0: -2.7, x1: -2.3, halfWidth: 0.5 } };
    for (const car of sim.cars) sprites.setCarSprite(sprites.carSpriteKey(car), model);
    Object.assign(target, { drsActive: true, drsChangedAt: -10, isBlueFlagged: false });
    target.telemetry.brake = 0;
    const braking = sim.cars[4];
    braking.telemetry.brake = 80; braking.drsActive = false; braking.drsChangedAt = -10;
    const near = buildCarDraws(sim.cars, cameraAt(3), target.id, track, 3, { timeSec: 100, depthAt: () => 0 });
    const own = near.find(d => d.id === target.id), other = near.find(d => d.id === braking.id);
    assert(near.length > 3 && near.every(d => d.mode === 'sprite' && d.sprite === model && d.lengthM > 4 && d.lengthM < 7.5 && d.widthM <= 2.7 && Math.abs(d.lengthM / d.widthM - 2.8) < 1e-9),
      'G9: de cerca, la imagen del modelo con sus proporciones y a tamaño de coche', near.slice(0, 1).map(d => `${d.lengthM.toFixed(2)} × ${d.widthM.toFixed(2)} m`).join());
    assert(own && Math.abs(own.x - target.worldX) < 1e-9 && Math.abs(own.y - target.worldY) < 1e-9 && Math.abs(own.angle - target.worldAngle) < 1e-9, 'G9: posición y rumbo son los del motor');
    assert(own.flap === 1 && other.flap === 0, 'G9: el alerón abierto solo en el coche con DRS', `${own.flap} / ${other.flap}`);
    assert(other.lightOn && !own.lightOn, 'G9: la luz trasera se enciende al frenar');
    assert(own.compoundColor === compoundStyle(target.tires.compound).color && own.showTyres, 'G9: la marca del neumático lleva el color de su compuesto');
    assert(own.ringColor === target.team.color && own.selected && other.ringColor === null, 'G9: aro del color del equipo en el coche seleccionado');
    const visible = car => Math.abs(car.worldX - target.worldX) * 3 <= 680 && Math.abs(car.worldY - target.worldY) * 3 <= 480;
    assert(sim.cars.every(car => near.some(d => d.id === car.id) === visible(car)), 'G9: solo se mandan a la GPU los coches que caen en pantalla', `${near.length} de 20`);

    // Safety Car: solo con imagen y en pista.
    const safetyCar = { isDeployed: true, mode: 'leading', progress: target.progress, isInPitLane: false };
    assert(buildSafetyCarDraw(safetyCar, track, cameraAt(3), 0) === null, 'G9: sin imagen, el Safety Car lo pinta el Canvas');
    sprites.setSafetyCarSprite({ levels: [image], lengthM: 4.7, widthM: 2.0, lightbar: { x: 0.2, lengthM: 0.3, halfWidth: 0.5 } });
    const sc = buildSafetyCarDraw(safetyCar, track, cameraAt(3), 0);
    assert(sc && sc.lengthM > 4 && Math.abs(sc.lengthM / sc.widthM - 2.35) < 1e-9 && buildSafetyCarDraw({ ...safetyCar, mode: 'idle' }, track, cameraAt(3), 0) === null,
      'G9: el Safety Car va a la GPU cuando está en pista y tiene imagen');
    assert(Math.abs(buildSafetyCarDraw(safetyCar, track, cameraAt(0.2), 0).lengthM - 16 * 0.9 / 0.2) < 1e-9, 'G9: de lejos conserva su tamaño mínimo en pantalla');

    // El Canvas no repite los cuerpos que ya ha pintado la GPU, y conserva las etiquetas.
    const record = onGpu => {
      const images = [], texts = [];
      const ctx = new Proxy({ drawImage: picture => images.push(picture), fillText: text => texts.push(text), strokeText: () => {}, measureText: text => ({ width: text.length * 6 }) },
        { get: (o, key) => o[key] ?? (() => {}), set: (o, key, value) => { o[key] = value; return true; } });
      CarRenderer.renderCars(ctx, sim.cars, cameraAt(3), target.id, track, 3, safetyCar, { timeSec: 100 }, onGpu);
      return { images: images.length, texts };
    };
    const all = record(undefined), skipped = record({ cars: new Set(near.map(d => d.id)), safetyCar: true });
    assert(all.images === near.length + 1, 'G9: sin GPU, el Canvas pinta la imagen de cada coche en pantalla y la del Safety Car (respaldo)', `${all.images} / ${near.length + 1}`);
    assert(skipped.images <= 1, 'G9: con los coches en la GPU, el Canvas no vuelve a pintar sus imágenes', String(skipped.images));
    assert(skipped.texts.length > 0 && JSON.stringify(skipped.texts) === JSON.stringify(all.texts), 'G9: etiquetas y rótulo del Safety Car, iguales con y sin GPU');
    sprites.clearTrackSprites();

    // Spray: las partículas que recorre la GPU son las vivas, dentro de su vida y con tamaño positivo.
    const spray = new SpraySystem();
    const wet = sim.cars.map(c => ({ ...c, status: 'running', isInPitLane: false, currentSpeedKmh: 250 }));
    for (let t = 0; t <= 1; t += 1 / 60) spray.update(wet, () => 2, 100 + t);
    let alive = 0, valid = true;
    spray.forEachAlive(101, (x, y, size, life) => { alive++; valid &&= Number.isFinite(x) && Number.isFinite(y) && size > 0 && life >= 0 && life < 1; });
    assert(alive > 20 && alive <= SPRAY.MAX && valid, 'G9: con agua, la GPU recibe las gotas vivas del spray', String(alive));
    let late = 0;
    spray.forEachAlive(101 + SPRAY.LIFE_SEC + 0.05, () => { late++; });
    assert(late === 0, 'G9: pasada su vida no queda ninguna gota');
  });

  await test('G9: tiempos de prueba de la carrera libre', async () => {
    const { WEATHER_TESTS } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
    const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    assert(WEATHER_TESTS.map(t => t.label).join() === 'seco,llovizna,lluvia,diluvio', 'G9: el botón recorre seco, llovizna, lluvia y diluvio');
    const depths = WEATHER_TESTS.map(({ scenario }) => { const sim = new RaceSimulation('barcelona'); sim.setWeatherScenario(scenario); return sim.weatherModel.meanDepth(); });
    assert(depths[0] === 0 && depths[1] > 0 && depths[2] > depths[1] && depths[3] > depths[2], 'G9: cada tiempo de prueba deja más agua en la pista que el anterior', depths.map(d => d.toFixed(2)).join());
  });
}
