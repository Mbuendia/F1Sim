import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
    console.log('\n--- TEST GROUP 13: Q5 — escala de meta y legibilidad ---');
    {
      const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
      const start = { x: 120, y: 90, angle: 0.5 };
      const track = { points: [start], trackWidthMeters: 24, corners: [{ number: 1, t: 0 }] };
      for (const zoom of [0.25, 0.5, 1, 2.75, 4.5, 8]) {
        for (const rotation of [0, 0.8, -1.2]) {
          const camera = new Camera();
          Object.assign(camera, { x: start.x, y: start.y, zoom, rotation });
          let path = [];
          const strokes = [], texts = [];
          const ctx = new Proxy({
            beginPath: () => { path = []; },
            moveTo: (x, y) => path.push({ x, y }), lineTo: (x, y) => path.push({ x, y }),
            stroke: () => strokes.push({ path: [...path], width: ctx.lineWidth, color: ctx.strokeStyle, cap: ctx.lineCap }),
            measureText: text => ({ width: text.length * 6 }),
            fillText: (text, x, y) => texts.push({ text, x, y }),
          }, { get: (target, key) => target[key] ?? (() => {}) });
          TrackRenderer.renderStartFinishLine(ctx, track, camera);
          const segments = strokes.filter(s => s.path.length === 2);
          const a = segments[0].path[0], b = segments.at(-1).path[1];
          const center = camera.worldToScreen(start.x, start.y);
          const halfWidth = 24 * 1.75 / 2;
          const expectedEdge = camera.worldToScreen(start.x + Math.cos(start.angle + Math.PI / 2) * halfWidth,
            start.y + Math.sin(start.angle + Math.PI / 2) * halfWidth);
          assert(segments.length === 10 && Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 42 * zoom) < 1e-7 &&
            segments.every(s => s.width === 5 * zoom && s.cap === 'butt') && Math.hypot(a.x - expectedEdge.x, a.y - expectedEdge.y) < 1e-7,
            `Q5: Ancho, grosor y bordes de meta lineales (zoom ${zoom}, rotación ${rotation})`);
          assert(segments.every((s, i) => s.color === (i % 2 ? '#000000' : '#ffffff')),
            `Q5: Ajedrezado no tapado por una línea blanca (zoom ${zoom}, rotación ${rotation})`);
          TrackRenderer.renderCornerLabels(ctx, track, camera);
          const corner = texts.find(t => t.text === 'T1');
          assert(Math.abs(Math.hypot(corner.x - center.x, corner.y - center.y) - (21 + 18) * zoom) < 1e-7,
            `Q5: Etiquetas de curva sin doble zoom (${zoom}, rotación ${rotation})`);
        }
      }
    }

    {
      const base = new RaceSimulation('barcelona').cars;
      const scene = base.slice(0, 4).map((car, i) => ({ ...car, worldX: 180 + i * 180, worldY: 300,
        worldAngle: 0, currentPosition: i + 1, progress: 2.1 + i * 0.01, currentSpeedKmh: 200,
        isInPitLane: false, isBlueFlagged: false, status: 'running', carAheadId: null, gapToCarAheadSec: 0 }));
      scene[1].progress = 2.2;
      scene[2].progress = 2.195;
      scene[2].carAheadId = scene[1].id;
      scene[2].gapToCarAheadSec = 0.4;
      function draw(cars, zoom, selectedId = scene[0].id) {
        const labels = [], boxes = [], circles = [];
        let vectors = 0;
        const ctx = new Proxy({
          measureText: text => ({ width: text.length * 6 }),
          fillText: (text, x, y) => labels.push({ text, x, y }),
          roundRect: (x, y, width, height) => { if (ctx.fillStyle === 'rgba(8, 12, 20, 0.88)') boxes.push({ x, y, width, height }); },
          arc: (x, y, radius) => circles.push({ x, y, radius, color: ctx.strokeStyle }),
          translate: () => { vectors++; },
        }, { get: (target, key) => target[key] ?? (() => {}) });
        const camera = { zoom, rotation: 0, screenWidth: 1000, screenHeight: 700, worldToScreen: (x, y) => ({ x, y }) };
        const before = JSON.stringify(cars);
        CarRenderer.renderCars(ctx, cars, camera, selectedId, { trackWidthMeters: 24 }, 3);
        return { labels, boxes, circles, vectors, unchanged: before === JSON.stringify(cars) };
      }
      for (const zoom of [0.25, 0.7]) {
        const result = draw(scene, zoom);
        assert(result.vectors === 0 && result.circles.length === 4 && result.labels.every(l => /^\d+$/.test(l.text)),
          `Q5: Vista lejana usa círculos/posiciones compactas (${zoom})`);
        assert(result.circles.every(p => scene.some(c => c.worldX === p.x && c.worldY === p.y)) && result.unchanged,
          `Q5: LOD conserva posición Q4 y no modifica estado (${zoom})`);
      }
      for (const zoom of [0.71, 1.2]) {
        const result = draw(scene, zoom);
        assert(result.vectors === 4 && result.labels.length === 0, `Q5: Distancia intermedia conserva coches sin nombres (${zoom})`);
      }
      for (const zoom of [1.21, 2.75, 8]) {
        const result = draw(scene, zoom);
        assert(result.vectors === 4 && result.labels.length === 3 && scene.slice(0, 3).every(c => result.labels.some(l => l.text.startsWith(c.driver.code))) &&
          !result.labels.some(l => l.text.startsWith(scene[3].driver.code)), `Q5: Nombres solo del seleccionado y ambos rivales (${zoom})`);
      }
      const changedSelection = draw(scene, 2.75, scene[3].id);
      assert(changedSelection.labels[0].text.startsWith(scene[3].driver.code) &&
        !changedSelection.labels.some(l => l.text.startsWith(scene[0].driver.code)),
        'Q5: Cambiar de seleccionado retira el nombre anterior y prioriza el nuevo');
      const clearedSelection = draw(scene, 2.75, null);
      assert(clearedSelection.labels.length === 2 && !clearedSelection.labels.some(l => l.text.startsWith(scene[3].driver.code)),
        'Q5: Deseleccionar conserva únicamente los nombres de las batallas');
      for (const gap of [0, -0.1, 0.799, 0.8, 1, NaN]) {
        const result = draw(scene.map((c, i) => i === 2 ? { ...c, gapToCarAheadSec: gap } : c), 2.75);
        assert(result.labels.length === (gap === 0.799 ? 3 : 1), `Q5: Umbral de batalla estricto y gap válido (${gap})`);
      }
      for (const change of [{ isInPitLane: true }, { status: 'pit' }, { status: 'out', isRetiredVisible: true },
        { isBlueFlagged: true }, { currentSpeedKmh: 0 }, { progress: 1.195 }]) {
        const result = draw(scene.map((c, i) => i === 2 ? { ...c, ...change } : c), 2.75);
        assert(result.labels.length === 1, `Q5: No etiqueta una falsa batalla (${JSON.stringify(change)})`);
      }
      const packed = base.map((car, i) => ({ ...car, worldX: 500, worldY: 300, currentPosition: i + 1,
        currentSpeedKmh: 200, progress: 2.4 - i * 0.001, carAheadId: i ? base[i - 1].id : null, gapToCarAheadSec: i ? 0.2 : 0 }));
      for (const zoom of [0.5, 2.75]) {
        const result = draw(packed, zoom, packed[19].id);
        const selectedText = zoom < 1 ? '20' : `${packed[19].driver.code} · P20`;
        assert(result.labels[0]?.text === selectedText && result.labels.length < 20 && result.boxes.every((a, i) =>
          result.boxes.slice(i + 1).every(b => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)),
          `Q5: Pelotón denso prioriza seleccionado y evita solapamientos (${zoom})`);
      }
      const blue = draw([{ ...scene[0], isBlueFlagged: true }], 0.5);
      const retired = draw([{ ...scene[0], status: 'out', isRetiredVisible: true, retireTimer: 10 }], 2.75);
      assert(blue.circles.some(c => c.color === '#38bdf8') && retired.labels[0]?.text.includes('DNF'),
        'Q5: Alertas de bandera azul y DNF siguen visibles con el nuevo LOD');
    }

}
