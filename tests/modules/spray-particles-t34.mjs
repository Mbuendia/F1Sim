// T3.4 — Spray con partículas (contrato aprobado por el usuario el 08/10/2026).
//  1. Cada coche en pista mojada suelta partículas por detrás; ninguna con el coche parado o sobre asfalto seco.
//  2. La cantidad crece con la velocidad y con el agua de ese tramo.
//  3. Cada partícula vive un tiempo fijo (por tiempo, no por fotogramas) y sale hacia atrás del coche, también con la
//     cámara girada o con zoom.
//  4. Hay un máximo de partículas para los 20 coches y se reciclan, con coste de pintado acotado.
//  5. El azar del spray es solo visual: no toca el de la carrera.
//  6. Las etiquetas de los coches siguen leyéndose (el spray se pinta antes que los coches).
//  7. Revisión en el navegador (manual; en el dashboard).
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const { SpraySystem, SPRAY } = await server.ssrLoadModule('/src/renderer/SprayParticles.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const car = (id, speedKmh, angle = 0, x = 0, y = 0) => ({ id, status: 'running', isRetiredVisible: false, isInPitLane: false, currentSpeedKmh: speedKmh, trackT: 0.5, worldX: x, worldY: y, worldAngle: angle });
  /** Avanza el sistema de `from` a `to` segundos con esos coches y esa agua. */
  const drive = (system, cars, depthMm, from, to, hz = 60) => { for (let t = from; t <= to + 1e-9; t += 1 / hz) system.update(cars, () => depthMm, t); };
  const fresh = (cars, depthMm, seconds = 2, hz = 60) => { const system = new SpraySystem(); drive(system, cars, depthMm, 0, seconds, hz); return system; };

  await test('T3.4: partículas según agua y velocidad', () => {
    assert(fresh([car(1, 250)], 0).alive(2) === 0 && fresh([car(1, 250)], 0).emitted === 0, 'T3.4: sobre asfalto seco no hay spray');
    assert(fresh([car(1, 0)], 3).emitted === 0 && fresh([car(1, 40)], 3).emitted === 0, 'T3.4: un coche parado o muy lento no levanta spray');
    const stopped = { ...car(1, 250), status: 'out' }, pit = { ...car(1, 250), isInPitLane: true };
    assert(fresh([stopped], 3).emitted === 0 && fresh([pit], 3).emitted === 0, 'T3.4: tampoco un coche retirado o en el pit lane');
    const base = fresh([car(1, 200)], 1.5).emitted, faster = fresh([car(1, 300)], 1.5).emitted, wetter = fresh([car(1, 200)], 3).emitted;
    assert(base > 0 && faster > base && wetter > base, 'T3.4: la cantidad crece con la velocidad y con el agua', `${base} · más rápido ${faster} · más agua ${wetter}`);
  });

  await test('T3.4: vida por tiempo y dirección', () => {
    // Misma emisión a 60 y a 15 actualizaciones por segundo.
    const fast = fresh([car(1, 250)], 2, 2, 60).emitted, slow = fresh([car(1, 250)], 2, 2, 15).emitted;
    assert(Math.abs(fast - slow) <= 2, 'T3.4: la emisión depende del tiempo, no del número de fotogramas', `${fast} a 60 Hz, ${slow} a 15 Hz`);
    // Al dejar de emitir, las partículas duran su vida y ni un fotograma más, se actualice mucho o poco.
    for (const hz of [120, 20]) {
      const system = fresh([car(1, 250)], 2, 2, 60);
      drive(system, [], 2, 2, 2 + SPRAY.LIFE_SEC / 2, hz);
      const half = system.alive(2 + SPRAY.LIFE_SEC / 2);
      drive(system, [], 2, 2 + SPRAY.LIFE_SEC / 2, 2 + SPRAY.LIFE_SEC + 0.05, hz);
      assert(half > 0 && system.alive(2 + SPRAY.LIFE_SEC + 0.05) === 0, `T3.4: cada partícula vive ${SPRAY.LIFE_SEC} s (a ${hz} Hz)`, `${half} a media vida`);
    }
    // Sale hacia atrás del coche, sea cual sea su orientación.
    for (const [angle, axis, sign] of [[0, 'x', -1], [Math.PI / 2, 'y', -1], [Math.PI, 'x', 1]]) {
      const system = fresh([car(1, 250, angle, 100, 100)], 2, 1);
      const alive = system.snapshot(1);
      const mean = alive.reduce((sum, p) => sum + p[axis], 0) / alive.length;
      assert(alive.length > 0 && Math.sign(mean - 100) === sign, `T3.4: el spray queda detrás del coche (rumbo ${angle.toFixed(2)})`, `${axis} medio ${mean.toFixed(1)}`);
    }
    // Con la cámara girada y con zoom, cada partícula se pinta donde la cámara la proyecta.
    const system = fresh([car(1, 250, 0.7, 50, 80)], 2, 1);
    const camera = { zoom: 2.5, rotation: 1.1, screenWidth: 4000, screenHeight: 4000, worldToScreen: (x, y) => ({ x: 2000 - y * 2.5, y: 2000 + x * 2.5 }) };
    const drawn = [];
    const ctx = new Proxy({}, { get: (_, key) => key === 'rect' ? (x, y, w, h) => drawn.push([x + w / 2, y + h / 2]) : () => {}, set: () => true });
    system.render(ctx, camera, 1);
    const expected = system.snapshot(1).map(p => camera.worldToScreen(p.x, p.y));
    const matched = expected.every(e => drawn.some(d => Math.hypot(d[0] - e.x, d[1] - e.y) < 0.01));
    assert(drawn.length === expected.length && expected.length > 0 && matched, 'T3.4: con la cámara girada y con zoom el spray sigue saliendo de detrás del coche', `${drawn.length} pintadas, ${expected.length} vivas`);
  });

  await test('T3.4: máximo, reciclaje y coste', () => {
    const cars = Array.from({ length: 20 }, (_, i) => car(i + 1, 310, i * 0.3, i * 40, i * 25));
    const system = fresh(cars, 6, 5);
    let calls = 0;
    const ctx = new Proxy({}, { get: () => () => { calls++; }, set: () => true });
    const camera = { zoom: 1, rotation: 0, screenWidth: 4000, screenHeight: 4000, worldToScreen: (x, y) => ({ x: x + 500, y: y + 500 }) };
    system.render(ctx, camera, 5);
    assert(system.alive(5) <= SPRAY.MAX && system.alive(5) > SPRAY.MAX * 0.5 && system.emitted > SPRAY.MAX, 'T3.4: nunca hay más partículas que el máximo y las viejas se reciclan', `${system.alive(5)} vivas de ${SPRAY.MAX}, ${system.emitted} emitidas`);
    assert(calls > 0 && calls <= SPRAY.MAX + 20, 'T3.4: el pintado está acotado', `${calls} llamadas`);
    // Fuera de pantalla no se pinta nada.
    calls = 0;
    system.render(ctx, { ...camera, worldToScreen: () => ({ x: -5000, y: -5000 }) }, 5);
    assert(calls <= 12, 'T3.4: lo que queda fuera de la pantalla no se pinta', `${calls} llamadas`);
    // Volver atrás en el tiempo (reinicio o carga) limpia el sistema.
    system.update(cars, () => 6, 1);
    assert(system.alive(1) <= cars.length * 2, 'T3.4: al reiniciar o cargar la carrera el spray empieza de cero');
  });

  await test('T3.4: solo visual y sin tapar las etiquetas', () => {
    const original = Math.random;
    let used = 0;
    Math.random = () => { used++; return 0.5; };
    try { const system = fresh([car(1, 250)], 2, 1); system.render(new Proxy({}, { get: () => () => {}, set: () => true }), { zoom: 1, rotation: 0, screenWidth: 100, screenHeight: 100, worldToScreen: (x, y) => ({ x, y }) }, 1); }
    finally { Math.random = original; }
    const code = source('src/renderer/SprayParticles.ts');
    assert(used === 0 && !/simulation\/Random/.test(code), 'T3.4: el spray usa su propio azar, no el de la carrera');
    const a = fresh([car(1, 250, 0.3, 10, 10)], 2, 1).snapshot(1), b = fresh([car(1, 250, 0.3, 10, 10)], 2, 1).snapshot(1);
    assert(JSON.stringify(a) === JSON.stringify(b), 'T3.4: y es repetible');
    const canvas = source('src/components/RaceCanvas.tsx');
    const spray = canvas.indexOf('spray.current.render('), carsAt = canvas.indexOf('CarRenderer.render');
    assert(spray > 0 && carsAt > spray && /spray\.current\.update\(/.test(canvas), 'T3.4: el spray se pinta antes que los coches y sus etiquetas', `${spray} / ${carsAt}`);
  });
}
