import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { generatePitLanePoints } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const { calculateCarWorldPosition } = await server.ssrLoadModule('/src/utils/carPosition.ts');
    console.log('\n--- TEST GROUP 9: Revisión Q1/Q2 — dibujo real y extremos entre muestras ---');

    // Medir los rectángulos que renderCars dibuja: incluye ruedas y alerones,
    // excluye etiquetas, sombra y halo de selección.
    {
      const car = new RaceSimulation('barcelona').cars[0];
      function drawnBounds(width, capacity, zoom, lateralOffset, rotation) {
        let transform = { x: 0, y: 0, angle: 0 };
        const stack = [];
        const transverse = [];
        const recordRect = (x, y, w, h) => {
          for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
            const sx = transform.x + px * Math.cos(transform.angle) - py * Math.sin(transform.angle);
            const sy = transform.y + px * Math.sin(transform.angle) + py * Math.cos(transform.angle);
            transverse.push(-(sx - 200) * Math.sin(rotation) + (sy - 200) * Math.cos(rotation));
          }
        };
        const ctx = new Proxy({
          save: () => stack.push({ ...transform }),
          restore: () => { transform = stack.pop(); },
          translate: (x, y) => { transform.x += x; transform.y += y; },
          rotate: angle => { transform.angle += angle; },
          roundRect: recordRect,
          fillRect: recordRect,
        }, { get: (target, key) => target[key] ?? (() => {}) });
        const camera = {
          zoom, rotation, screenWidth: 1000, screenHeight: 1000,
          worldToScreen: (x, y) => ({
            x: 200 + zoom * (x * Math.cos(rotation) - y * Math.sin(rotation)),
            y: 200 + zoom * (x * Math.sin(rotation) + y * Math.cos(rotation)),
          }),
        };
        const track = {
          trackWidthMeters: width, pitLanePoints: [],
          points: [{ x: 0, y: 0, angle: 0 }, { x: 100, y: 0, angle: 0 }],
        };
        const drawnCar = {
          ...car, progress: 0, lateralOffset, status: 'running', isInPitLane: false,
          isBlueFlagged: false,
        };
        Object.assign(drawnCar, calculateCarWorldPosition(drawnCar, track, capacity));
        // Q5 usa símbolos HUD en vista lejana; Q1 sigue midiendo la huella del vector.
        const screen = camera.worldToScreen(drawnCar.worldX, drawnCar.worldY);
        CarRenderer.drawSingleCar(ctx, screen.x, screen.y, drawnCar.worldAngle + rotation, drawnCar, zoom, false,
          CarRenderer.getCarDimensions(zoom, width, capacity));
        return { min: Math.min(...transverse), max: Math.max(...transverse) };
      }
      for (const [width, capacity] of [[24, 3], [24, 2], [16, 2]]) {
        let clearOfCenter = true;
        let clearOpposite = true;
        let insideTrack = true;
        let dimensionsMatch = true;
        for (const zoom of [0.25, 0.5, 1, 1.8, 2.75, 4.5, 8]) {
          for (const rotation of [0, Math.PI / 2, -0.7]) {
            const center = drawnBounds(width, capacity, zoom, 0, rotation);
            const right = drawnBounds(width, capacity, zoom, 0.55, rotation);
            const left = drawnBounds(width, capacity, zoom, -0.55, rotation);
            const edge = drawnBounds(width, capacity, zoom, 0.85, rotation);
            clearOfCenter &&= right.min > center.max && left.max < center.min;
            clearOpposite &&= right.min > left.max;
            insideTrack &&= edge.max <= CarRenderer.getTrackHalfWidth(width) * zoom;
            const dims = CarRenderer.getCarDimensions(zoom, width, capacity);
            dimensionsMatch &&= Math.abs(center.max - center.min - dims.footprintWidth) < 1e-7;
          }
        }
        assert(clearOfCenter, `Q1: Ruedas/alerones separados del coche centrado (${width}m, capacidad ${capacity}, zoom 0.25–8 y rotaciones)`);
        assert(clearOpposite, `Q1: Dibujo real separado en carriles opuestos (${width}m, capacidad ${capacity})`);
        assert(insideTrack, `Q1: Monoplaza completo dentro del asfalto con offset 0.85 (${width}m, capacidad ${capacity})`);
        assert(dimensionsMatch, `Q1: Huella declarada coincide con ruedas y alerones realmente dibujados (${width}m, capacidad ${capacity})`);
      }
    }

    {
      // Curva con tangente/normal coherentes, sin depender del DOM del navegador.
      const points = Array.from({ length: 750 }, (_, i) => {
        const a = i / 750 * Math.PI * 2;
        return {
          x: 500 * Math.cos(a), y: 500 * Math.sin(a), angle: a + Math.PI / 2,
          normal: { x: -Math.cos(a), y: -Math.sin(a) },
        };
      });
      const sample = t => {
        const index = ((t % 1 + 1) % 1) * points.length;
        const a = points[Math.floor(index) % points.length];
        const b = points[(Math.floor(index) + 1) % points.length];
        const f = index - Math.floor(index);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      };
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const angleDifference = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      for (const [entry, exit, offset] of [[0.9, 0.15, 38], [0.361, 0.461, 28], [0.9237, 0.1011, -38]]) {
        const pit = generatePitLanePoints(points, entry, exit, offset);
        const last = pit.length - 1;
        assert(pit.length > 2 && distance(pit[0], sample(entry)) < 1e-7 && distance(pit[last], sample(exit)) < 1e-7,
          `Q2: Extremos exactos entre muestras, entrada ${entry} / salida ${exit}`);
        const span = (exit - entry + 1) % 1;
        const step = span / last;
        const start = sample(entry);
        const next = sample(entry + step);
        const previous = sample(exit - step);
        const end = sample(exit);
        const entryError = angleDifference(Math.atan2(pit[1].y - pit[0].y, pit[1].x - pit[0].x), Math.atan2(next.y - start.y, next.x - start.x));
        const exitError = angleDifference(Math.atan2(pit[last].y - pit[last - 1].y, pit[last].x - pit[last - 1].x), Math.atan2(end.y - previous.y, end.x - previous.x));
        assert(entryError < 0.05 && exitError < 0.05, `Q2: Dirección de entrada/salida suave en intervalo ${entry}–${exit}`);
        assert(pit.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), `Q2: Todas las muestras son finitas en ${entry}–${exit}`);
      }
      assert(generatePitLanePoints([], 0.9, 0.1).length === 0, 'Q2: Pista vacía no genera un carril inválido');

      const car = new RaceSimulation('barcelona').cars[0];
      const track = {
        points, trackWidthMeters: 24, pitEntryT: 0.9, pitExitT: 0.15,
        pitLanePoints: generatePitLanePoints(points, 0.9, 0.15, 38),
      };
      function renderPosition(progress, isInPitLane, previousPitProgress) {
        let position;
        const ctx = new Proxy({ translate: (x, y) => { position = { x, y }; } }, {
          get: (target, key) => target[key] ?? (() => {}),
        });
        const drawnCar = {
          ...car, progress, isInPitLane, lateralOffset: 0, status: 'running',
          pitStop: { ...car.pitStop, pitLaneProgress: previousPitProgress },
        };
        Object.assign(drawnCar, calculateCarWorldPosition(drawnCar, track, 3));
        CarRenderer.renderCars(ctx, [drawnCar], {
          zoom: 1, rotation: 0, screenWidth: 2000, screenHeight: 2000,
          worldToScreen: (x, y) => ({ x: x + 600, y: y + 600 }),
        }, null, track, 3);
        return position;
      }
      const progress = 1.02;
      const expectedU = (progress - track.pitEntryT) / 0.25;
      const index = expectedU * (track.pitLanePoints.length - 1);
      const a = track.pitLanePoints[Math.floor(index)];
      const b = track.pitLanePoints[Math.floor(index) + 1];
      const f = index - Math.floor(index);
      assert(distance(renderPosition(progress, true, 0), { x: 600 + a.x + (b.x - a.x) * f, y: 600 + a.y + (b.y - a.y) * f }) < 1e-7,
        'Q2: El dibujo en boxes usa el progreso actual, aunque pitLaneProgress esté retrasado');
      assert(distance(renderPosition(0.9, true, 0.95), renderPosition(0.9, false, 0)) < 1e-7,
        'Q2: Activar la ruta de boxes en la entrada no desplaza el coche');
      assert(distance(renderPosition(1.15, true, 0.95), renderPosition(1.15, false, 0)) < 1e-7,
        'Q2: Cambiar de ruta en la salida conserva la posición dibujada');
      assert(distance(renderPosition(1.151, true, 0.99), renderPosition(1.151, false, 0)) < 1e-7,
        'Q2: Superar la salida no retiene visualmente el coche cuando el estado de boxes llega un paso tarde');
    }

}
