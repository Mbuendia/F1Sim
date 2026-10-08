// R56 — Coches de pista y Safety Car con el aspecto de los modelos 3D (contrato aprobado por el usuario el 07/10/2026).
//  1. El coche de pista con imagen conserva las proporciones del modelo y nunca sobresale de la huella de su carril.
//  2. Con imagen se pinta esa imagen girada con el coche y siguen la marca del compuesto, la luz trasera, el DRS y el
//     resalte de selección; sin imagen se pinta el dibujo actual (sus tests no se tocan).
//  3. El Safety Car de pista usa su imagen con la barra de luces parpadeando y, si falta, el dibujo actual.
//  4. La generación de imágenes se carga bajo demanda y la vista lejana sigue con puntos.
//  5. Revisión en el navegador con capturas de varios equipos y del Safety Car en pista (manual; en el dashboard).
// Decisiones del usuario: la imagen sale del mismo modelo 3D de R55 al entrar en carrera; el coche ocupa la misma
// superficie que el dibujo actual, con las proporciones reales del modelo.
import { existsSync, readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const sprites = await server.ssrLoadModule('/src/renderer/carSprites.ts');
  const { safetyCarLightOn } = await server.ssrLoadModule('/src/renderer/carDetail.ts');
  const { calculateCarWorldPosition } = await server.ssrLoadModule('/src/utils/carPosition.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { OVERVIEW_ZOOM } = await server.ssrLoadModule('/src/renderer/CarLabels.ts');
  const { compoundStyle } = await server.ssrLoadModule('/src/utils/compounds.ts');
  const file = relative => new URL(`../../${relative}`, import.meta.url);
  const source = relative => readFileSync(file(relative), 'utf8');

  const cars = new RaceSimulation('barcelona').cars;
  const car = cars[0];
  const level = (width, height, name) => ({ width, height, name });
  /** Imagen de prueba con las medidas de un monoplaza visto desde arriba (m). */
  const carSprite = () => ({
    levels: [level(384, 140, 'grande'), level(192, 70, 'media'), level(96, 35, 'pequeña')],
    lengthM: 5.6, widthM: 2.04,
    wheels: [[1.7, -0.76], [1.7, 0.76], [-1.7, -0.73], [-1.7, 0.73]],
    tyre: { lengthM: 0.72, widthM: 0.36 },
    rearWing: { x0: -2.45, x1: -2.0, halfWidth: 0.55 },
  });
  const safetySprite = () => ({
    levels: [level(320, 140, 'sc-grande'), level(160, 70, 'sc-media')],
    lengthM: 4.7, widthM: 2.06,
    lightbar: { x: -0.69, lengthM: 0.25, halfWidth: 0.5 },
  });

  /** Lienzo de prueba: anota cada operación con el estilo y la transformación vigentes. */
  function recorder() {
    const calls = [];
    let transform = { x: 0, y: 0, angle: 0 };
    const transforms = [], states = [];
    const state = { fillStyle: '', strokeStyle: '', globalAlpha: 1, shadowBlur: 0, lineWidth: 1 };
    const target = {
      save: () => { transforms.push({ ...transform }); states.push({ ...state }); },
      restore: () => { transform = transforms.pop(); Object.assign(state, states.pop()); },
      translate: (x, y) => { transform.x += x; transform.y += y; },
      rotate: angle => { transform.angle += angle; },
      measureText: text => ({ width: String(text).length * 6 }),
    };
    for (const op of ['drawImage', 'fillRect', 'roundRect', 'arc', 'ellipse', 'fillText', 'strokeText', 'stroke', 'fill']) {
      target[op] = (...args) => { calls.push({ op, args, ...state, transform: { ...transform } }); };
    }
    const ctx = new Proxy(target, {
      get: (object, key) => (key in state ? state[key] : object[key] ?? (() => {})),
      set: (_, key, value) => { state[key] = value; return true; },
    });
    return { ctx, calls, of: op => calls.filter(call => call.op === op) };
  }
  /** Rectángulo en pantalla (esquinas) de una operación con forma de rectángulo. */
  const corners = call => {
    const [x, y, w, h] = call.op === 'drawImage' ? call.args.slice(1) : call.args;
    const { x: tx, y: ty, angle } = call.transform;
    return [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) =>
      [tx + px * Math.cos(angle) - py * Math.sin(angle), ty + px * Math.sin(angle) + py * Math.cos(angle)]);
  };
  const rects = calls => calls.filter(call => ['drawImage', 'fillRect', 'roundRect'].includes(call.op));
  const draw = (target, { zoom = 3, angle = 0.6, selected = false, opacity = 1, detail, dims } = {}) => {
    const rec = recorder();
    CarRenderer.drawSingleCar(rec.ctx, 300, 200, angle, target, zoom, selected, dims ?? CarRenderer.getCarDimensions(zoom, 12, 3), opacity,
      detail ?? { wetMm: 0, timeSec: 0, distanceM: 10 });
    return rec;
  };
  const plain = { ...car, status: 'running', drsActive: false, isBlueFlagged: false, telemetry: { ...car.telemetry, brake: 0 } };

  try {
    await test('R56: proporciones del modelo y huella del carril', () => {
      sprites.clearTrackSprites();
      const sprite = carSprite(), aspect = sprite.lengthM / sprite.widthM;
      sprites.setCarSprite(sprites.carSpriteKey(car), sprite);
      let proportional = true, inside = true, sameArea = true;
      for (const [width, capacity] of [[24, 3], [24, 2], [16, 2], [8, 2]]) {
        for (const zoom of [0.75, 1, 1.8, 2.75, 4.5, 8]) {
          const dims = CarRenderer.getCarDimensions(zoom, width, capacity);
          const size = sprites.carSpriteSize(dims, aspect);
          proportional &&= Math.abs(size.length / size.width - aspect) < 1e-9;
          inside &&= size.width <= dims.footprintWidth + 1e-9;
          // Misma superficie que el dibujo actual, medido sobre lo que pinta de verdad.
          sprites.clearTrackSprites();
          const vector = rects(draw(plain, { zoom, angle: 0, dims }).calls).flatMap(corners);
          const vectorLength = Math.max(...vector.map(p => p[0])) - Math.min(...vector.map(p => p[0]));
          const vectorWidth = Math.max(...vector.map(p => p[1])) - Math.min(...vector.map(p => p[1]));
          sameArea &&= Math.abs(size.length * size.width / (vectorLength * vectorWidth) - 1) < 0.01;
          sprites.setCarSprite(sprites.carSpriteKey(car), sprite);
        }
      }
      assert(proportional, 'R56: la imagen se pinta con las proporciones del modelo');
      assert(inside, 'R56: la imagen nunca es más ancha que la huella declarada del coche');
      assert(sameArea, 'R56: la imagen ocupa la misma superficie que el dibujo actual (decisión del usuario)');
      const narrow = sprites.carSpriteSize(CarRenderer.getCarDimensions(2, 12, 3), 1.2), wide = CarRenderer.getCarDimensions(2, 12, 3);
      assert(narrow.width <= wide.footprintWidth + 1e-9 && Math.abs(narrow.length / narrow.width - 1.2) < 1e-9, 'R56: un modelo poco alargado tampoco sobresale del carril');

      // Mismo criterio que Q1, ahora con el coche pintado con su imagen (imagen y marcas superpuestas).
      function drawnBounds(width, capacity, zoom, lateralOffset, rotation) {
        const camera = {
          zoom, rotation,
          worldToScreen: (x, y) => ({
            x: 200 + zoom * (x * Math.cos(rotation) - y * Math.sin(rotation)),
            y: 200 + zoom * (x * Math.sin(rotation) + y * Math.cos(rotation)),
          }),
        };
        const track = { trackWidthMeters: width, pitLanePoints: [], points: [{ x: 0, y: 0, angle: 0 }, { x: 100, y: 0, angle: 0 }] };
        const drawn = { ...plain, drsActive: true, progress: 0, lateralOffset, isInPitLane: false };
        Object.assign(drawn, calculateCarWorldPosition(drawn, track, capacity));
        const screen = camera.worldToScreen(drawn.worldX, drawn.worldY);
        const rec = recorder();
        CarRenderer.drawSingleCar(rec.ctx, screen.x, screen.y, drawn.worldAngle + rotation, drawn, zoom, false,
          CarRenderer.getCarDimensions(zoom, width, capacity), 1, { wetMm: 1, timeSec: 0, distanceM: 3 });
        const transverse = rects(rec.calls).flatMap(corners).map(([sx, sy]) => -(sx - 200) * Math.sin(rotation) + (sy - 200) * Math.cos(rotation));
        return { min: Math.min(...transverse), max: Math.max(...transverse), images: rec.of('drawImage').length };
      }
      for (const [width, capacity] of [[24, 3], [24, 2], [16, 2]]) {
        let clearOfCenter = true, clearOpposite = true, insideTrack = true, withinFootprint = true, painted = true;
        for (const zoom of [0.75, 1, 1.8, 2.75, 4.5, 8]) {
          for (const rotation of [0, Math.PI / 2, -0.7]) {
            const center = drawnBounds(width, capacity, zoom, 0, rotation);
            const right = drawnBounds(width, capacity, zoom, 0.55, rotation);
            const left = drawnBounds(width, capacity, zoom, -0.55, rotation);
            const edge = drawnBounds(width, capacity, zoom, 0.85, rotation);
            painted &&= center.images === 1;
            clearOfCenter &&= right.min > center.max && left.max < center.min;
            clearOpposite &&= right.min > left.max;
            insideTrack &&= edge.max <= CarRenderer.getTrackHalfWidth(width) * zoom;
            withinFootprint &&= center.max - center.min <= CarRenderer.getCarDimensions(zoom, width, capacity).footprintWidth + 1e-7;
          }
        }
        assert(painted, `R56: el coche se pinta con su imagen (${width} m, capacidad ${capacity})`);
        assert(clearOfCenter && clearOpposite, `R56: coches con imagen separados entre carriles (${width} m, capacidad ${capacity})`);
        assert(insideTrack, `R56: coche con imagen dentro del asfalto con desplazamiento 0,85 (${width} m, capacidad ${capacity})`);
        assert(withinFootprint, `R56: imagen y marcas dentro de la huella declarada (${width} m, capacidad ${capacity})`);
      }

      const frame = sprites.spriteFrame({ minX: -2.6, maxX: 2.8, minZ: -0.95, maxZ: 0.97 });
      assert(Math.abs(frame.centerX - 0.1) < 1e-9 && Math.abs(frame.centerZ - 0.01) < 1e-9, 'R56: la imagen se centra en el modelo');
      assert(frame.lengthM >= 5.4 && frame.widthM >= 1.92 && frame.lengthM < 5.4 * 1.1 && Math.abs((frame.lengthM - 5.4) - (frame.widthM - 1.92)) < 1e-9,
        'R56: la imagen abarca el modelo entero con el mismo margen por los cuatro lados', JSON.stringify(frame));
    });

    await test('R56: el coche con imagen conserva sus marcas; sin imagen, el dibujo actual', () => {
      sprites.clearTrackSprites();
      const sprite = carSprite(), key = sprites.carSpriteKey(car);

      const vector = draw(plain);
      assert(vector.of('drawImage').length === 0 && vector.of('roundRect').length >= 5, 'R56: sin imagen se pinta el dibujo actual');

      sprites.setCarSprite(key, sprite);
      const rec = draw(plain, { opacity: 0.5 });
      const images = rec.of('drawImage');
      assert(images.length === 1 && sprite.levels.includes(images[0].args[0]), 'R56: con imagen se pinta la imagen del coche');
      const [, dx, dy, dw, dh] = images[0].args;
      assert(Math.abs(dx + dw / 2) < 1e-9 && Math.abs(dy + dh / 2) < 1e-9, 'R56: la imagen va centrada en el coche');
      assert(images[0].transform.x === 300 && images[0].transform.y === 200 && Math.abs(images[0].transform.angle - 0.6) < 1e-12, 'R56: la imagen gira con el coche');
      assert(images[0].globalAlpha === 0.5, 'R56: el coche retirado se sigue atenuando');
      assert(rec.of('roundRect').length === 0, 'R56: con imagen no se pinta además el dibujo vectorial');

      const compound = compoundStyle(plain.tires.compound).color;
      const marks = call => call.op === 'fillRect' && call.fillStyle === compound;
      assert(draw(plain, { zoom: 3 }).calls.filter(marks).length === 4, 'R56: marca del compuesto en las cuatro ruedas');
      assert(draw(plain, { zoom: 1 }).calls.filter(marks).length === 0, 'R56: de lejos no se pinta la marca del compuesto (como hasta ahora)');
      const tread = (distanceM) => draw(plain, { angle: 0, detail: { wetMm: 0, timeSec: 0, distanceM } }).calls
        .filter(call => call.op === 'fillRect' && /255, 255, 255/.test(call.fillStyle)).map(call => call.args[0]);
      const a = tread(100), b = tread(100.5);
      assert(a.length === 4 && b.length === 4 && a.some((x, i) => Math.abs(x - b[i]) > 1e-6), 'R56: la marca de la rueda avanza con la distancia recorrida');

      const lit = call => call.op === 'fillRect' && call.fillStyle === '#ff2d2d';
      assert(draw(plain, { detail: { wetMm: 1, timeSec: 0, distanceM: 0 } }).calls.some(lit), 'R56: luz trasera con pista mojada');
      assert(draw({ ...plain, telemetry: { ...plain.telemetry, brake: 80 } }).calls.some(lit), 'R56: luz trasera al recargar en frenada');
      assert(!draw(plain).calls.some(lit), 'R56: luz trasera apagada en seco y sin frenar');

      const drs = call => call.op === 'fillRect' && call.fillStyle === '#00ff66';
      assert(draw({ ...plain, drsActive: true }).calls.some(drs) && !draw(plain).calls.some(drs), 'R56: el alerón trasero se marca en verde con el DRS abierto');

      const ring = recording => recording.of('arc').filter(call => call.shadowBlur === 18);
      assert(ring(draw(plain, { selected: true })).length === 1 && ring(draw(plain)).length === 0, 'R56: el coche seleccionado conserva su resalte');
      const flagged = draw({ ...plain, isBlueFlagged: true }).of('stroke').some(call => call.strokeStyle === '#38bdf8');
      assert(flagged, 'R56: el coche con bandera azul conserva su aro');

      assert(sprites.spriteLevel(sprite, 20) === sprite.levels[2] && sprites.spriteLevel(sprite, 150) === sprite.levels[1]
        && sprites.spriteLevel(sprite, 5000) === sprite.levels[0], 'R56: se usa el nivel de imagen más pequeño que cubre el tamaño en pantalla');

      const other = cars.find(c => c.team.id !== car.team.id);
      assert(draw({ ...other, status: 'running' }).of('drawImage').length === 0, 'R56: un coche sin imagen propia sigue con el dibujo actual');
    });

    await test('R56: Safety Car de pista', () => {
      sprites.clearTrackSprites();
      const track = { trackWidthMeters: 12, pitEntryT: 0.9, pitExitT: 0.15, pitLanePoints: [], points: [{ x: 0, y: 0, angle: 0 }, { x: 100, y: 0, angle: 0 }] };
      const camera = { zoom: 2, rotation: 0.3, screenWidth: 2000, screenHeight: 2000, worldToScreen: (x, y) => ({ x: x * 2 + 600, y: y * 2 + 600 }) };
      const safetyCar = { isDeployed: true, mode: 'leading', progress: 0.25, isInPitLane: false, lapCount: 1, triggerReason: 'prueba' };
      const render = () => { const rec = recorder(); CarRenderer.renderCars(rec.ctx, [], camera, null, track, 3, safetyCar); return rec; };

      const before = render();
      assert(before.of('drawImage').length === 0 && before.calls.some(call => call.fillStyle === '#00594f'), 'R56: sin imagen, el Safety Car se pinta como hasta ahora');

      const sprite = safetySprite();
      sprites.setSafetyCarSprite(sprite);
      const rec = render();
      const images = rec.of('drawImage');
      assert(images.length === 1 && sprite.levels.includes(images[0].args[0]), 'R56: el Safety Car se pinta con su imagen');
      const [, dx, dy, dw, dh] = images[0].args;
      assert(Math.abs(dw / dh - sprite.lengthM / sprite.widthM) < 1e-9 && Math.abs(dx + dw / 2) < 1e-9 && Math.abs(dy + dh / 2) < 1e-9,
        'R56: imagen del Safety Car centrada y con las proporciones del modelo');
      assert(Math.abs(images[0].transform.angle - 0.3) < 1e-12, 'R56: el Safety Car gira con la pista y la cámara');
      assert(!rec.calls.some(call => call.fillStyle === '#00594f'), 'R56: con imagen no se pinta además el dibujo anterior');
      const bar = rec.calls.filter(call => call.op === 'fillRect' && ['#f59e0b', '#ef4444'].includes(call.fillStyle) && call.shadowBlur > 0);
      assert(bar.length === 1, 'R56: la barra de luces se pinta sobre la imagen');
      assert(Math.abs(bar[0].args[0] + bar[0].args[2] / 2 - sprite.lightbar.x * dw / sprite.lengthM) < 1e-9, 'R56: la barra de luces va donde está en el modelo');
      assert(rec.of('fillText').some(call => /SAFETY CAR/.test(call.args[0])), 'R56: el Safety Car conserva su etiqueta');
      const states = Array.from({ length: 100 }, (_, i) => safetyCarLightOn(i * 10));
      assert(states.includes(true) && states.includes(false), 'R56: la barra de luces parpadea');

      sprites.setSafetyCarSprite(null);
      assert(render().of('drawImage').length === 0, 'R56: al quitar la imagen vuelve el dibujo anterior');
    });

    await test('R56: carga bajo demanda y vista lejana', () => {
      sprites.clearTrackSprites();
      const keys = cars.map(sprites.carSpriteKey);
      assert(new Set(keys).size === cars.length, 'R56: cada coche de la parrilla tiene su propia imagen (equipo y dorsal)');
      const jobs = sprites.carSpriteJobs(cars);
      assert(jobs.length === cars.length && jobs.every(job => job.teamId && Number.isFinite(job.number)), 'R56: un trabajo de imagen por coche');
      for (const each of cars) sprites.setCarSprite(sprites.carSpriteKey(each), carSprite());
      assert(sprites.carSpriteJobs(cars).length === 0, 'R56: las imágenes ya hechas no se repiten');

      const track = { trackWidthMeters: 12, pitEntryT: 0.9, pitExitT: 0.15, pitLanePoints: [], points: [{ x: 0, y: 0, angle: 0 }, { x: 100, y: 0, angle: 0 }] };
      const camera = zoom => ({ zoom, rotation: 0, screenWidth: 2000, screenHeight: 2000, worldToScreen: (x, y) => ({ x: x * zoom + 600, y: y * zoom + 600 }) });
      const field = cars.slice(0, 6).map((each, i) => {
        const drawn = { ...each, status: 'running', progress: 0.1 + i * 0.1, lateralOffset: 0, isInPitLane: false };
        return Object.assign(drawn, calculateCarWorldPosition(drawn, track, 3));
      });
      const far = recorder();
      CarRenderer.renderCars(far.ctx, field, camera(OVERVIEW_ZOOM), null, track, 3);
      assert(far.of('drawImage').length === 0 && far.of('arc').length >= field.length, 'R56: la vista lejana sigue con puntos de color');
      const near = recorder();
      CarRenderer.renderCars(near.ctx, field, camera(3), null, track, 3);
      assert(near.of('drawImage').length === field.length, 'R56: de cerca cada coche se pinta con su imagen');

      const canvas = source('src/components/RaceCanvas.tsx');
      assert(/import\('\.\.\/renderer\/carSprites3d'\)/.test(canvas), 'R56: la pista pide las imágenes bajo demanda');
      assert(existsSync(file('src/renderer/carSprites3d.ts')) && /loadModel\(/.test(source('src/renderer/carSprites3d.ts')), 'R56: las imágenes salen del modelo 3D de R55');
      for (const name of ['src/renderer/CarRenderer.ts', 'src/renderer/carSprites.ts', 'src/renderer/carDetail.ts']) {
        const text = source(name);
        assert(!/from 'three'/.test(text) && !/GLTFLoader|carSprites3d|modelScene/.test(text), `R56: ${name} no arrastra three ni el cargador de modelos`);
      }
      assert(!/carSprites3d/.test(source('src/App.tsx')), 'R56: la aplicación no importa el generador de imágenes directamente');
    });
  } finally {
    sprites.clearTrackSprites();
  }
}
