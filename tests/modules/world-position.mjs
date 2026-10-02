import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { generatePitLanePoints } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const { calculateCarWorldPosition } = await server.ssrLoadModule('/src/utils/carPosition.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
  const { renderLeftMinimap } = await server.ssrLoadModule('/src/renderer/MinimapRenderer.ts');
    console.log('\n--- TEST GROUP 11: Q4 — posición única y consumidores ---');
    {
      const base = new RaceSimulation('barcelona').cars[0];
      const points = Array.from({ length: 750 }, (_, i) => {
        const a = i / 750 * Math.PI * 2;
        return { x: 500 * Math.cos(a), y: 500 * Math.sin(a), angle: a + Math.PI / 2,
          normal: { x: -Math.cos(a), y: -Math.sin(a) } };
      });
      for (const [entry, exit, offset] of [[0.9, 0.15, 38], [0.361, 0.461, -28]]) {
        const track = { points, pitEntryT: entry, pitExitT: exit, trackWidthMeters: 24,
          pitLanePoints: generatePitLanePoints(points, entry, exit, offset) };
        const span = (exit - entry + 1) % 1;
        let routeCorrect = true, cameraCorrect = true;
        for (let step = 0; step <= 100; step++) {
          const u = step / 100;
          const car = { ...base, progress: 3 + entry + span * u, isInPitLane: true, lateralOffset: 0.65 };
          Object.assign(car, calculateCarWorldPosition(car, track));
          const exact = u * (track.pitLanePoints.length - 1);
          const index = Math.min(track.pitLanePoints.length - 2, Math.floor(exact));
          const a = track.pitLanePoints[index], b = track.pitLanePoints[index + 1];
          routeCorrect &&= Math.hypot(car.worldX - (a.x + (b.x - a.x) * (exact - index)),
            car.worldY - (a.y + (b.y - a.y) * (exact - index))) < 1e-7;
          for (const mode of ['follow', 'cinematic', 'onboard', 'helicopter']) {
            const camera = new Camera();
            camera.followCar(car.id);
            camera.setMode(mode);
            camera.update([car], 0.016, track);
            cameraCorrect &&= camera.targetX === car.worldX && camera.targetY === car.worldY;
          }
        }
        assert(routeCorrect, `Q4: Posición sobre toda la ruta de boxes ${entry}–${exit}, sin offset lateral de pista`);
        assert(cameraCorrect, `Q4: Cuatro cámaras apuntan al coche en los 101 puntos de boxes ${entry}–${exit}`);
      }

      const straight = { points: [{ x: 0, y: 0, angle: 0 }, { x: 1000, y: 0, angle: 0 }],
        pitLanePoints: [], trackWidthMeters: 16, pitEntryT: 0.9, pitExitT: 0.1 };
      const lane = calculateCarWorldPosition({ progress: 0.125, lateralOffset: 0.65, isInPitLane: false }, straight, 2);
      assert(lane.worldX === 250 && Math.abs(lane.worldY - 0.65 * 14 * 0.72) < 1e-9,
        'Q4: Interpolación y desplazamiento lateral conservan el ancho/capacidad Q1');

      // Los consumidores deben respetar la coordenada almacenada aunque progress apunte a otro sitio.
      const car = { ...base, worldX: 72, worldY: 24, worldAngle: 0.31, progress: 0.6, lateralOffset: -0.7 };
      for (const [zoom, rotation] of [[0.25, 0], [2.75, 0.8], [8, -1.2]]) {
        const camera = new Camera();
        Object.assign(camera, { x: car.worldX, y: car.worldY, zoom, rotation, screenWidth: 1000, screenHeight: 700 });
        const screen = camera.worldToScreen(car.worldX, car.worldY);
        const drawing = [];
        const originalDraw = CarRenderer.drawSingleCar;
        const originalOverview = CarRenderer.drawOverviewCar;
        try {
          CarRenderer.drawSingleCar = (_ctx, x, y, angle) => drawing.push({ x, y, angle });
          CarRenderer.drawOverviewCar = (_ctx, x, y) => drawing.push({ x, y });
          const ctx = new Proxy({ measureText: text => ({ width: text.length * 6 }) }, { get: (target, key) => target[key] ?? (() => {}) });
          CarRenderer.renderCars(ctx, [car], camera, null, straight, 2);
        } finally { CarRenderer.drawSingleCar = originalDraw; CarRenderer.drawOverviewCar = originalOverview; }
        assert(drawing.length === 1 && drawing[0].x === screen.x && drawing[0].y === screen.y && (zoom <= 0.7 || drawing[0].angle === car.worldAngle + rotation),
          `Q4: Renderer consume posición/orientación almacenada (zoom ${zoom})`);
        assert(CarRenderer.pickCarAtScreen([car], camera, screen.x, screen.y) === car.id &&
          CarRenderer.pickCarAtScreen([car], camera, screen.x + 36, screen.y) === null,
          `Q4: Clic en coche visible con zoom ${zoom} y rotación ${rotation}`);
      }
      const camera = new Camera();
      camera.followCar(car.id);
      const mapTrack = { ...straight, bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
        pitLanePoints: [{ x: 20, y: 0 }, { x: 200, y: 100 }] };
      const arcs = [], lines = [];
      const ctx = new Proxy({ arc: (...args) => arcs.push(args), lineTo: (...args) => lines.push(args) },
        { get: (target, key) => target[key] ?? (() => {}) });
      const hidden = [
        { ...car, id: 2, status: 'finished' },
        { ...car, id: 3, status: 'out', isRetiredVisible: false },
      ];
      const retired = { ...car, id: 4, status: 'out', isRetiredVisible: true };
      renderLeftMinimap(ctx, { cars: [car, ...hidden, retired], activeTrack: mapTrack }, camera);
      // Bounds ampliados a 200x100: escala .75 y origen del mapa (35,585).
      assert(arcs.length === 2 && arcs[0][0] === 35 + car.worldX * 0.75 &&
        arcs[0][1] === 585 + car.worldY * 0.75 && arcs[0][2] === 4.5,
        'Q4: Minimap real proyecta worldX/Y e incluye boxes en el encuadre');
      assert(lines.some(([x, y]) => x === 185 && y === 660), 'Q4: Minimap dibuja el carril de boxes');
      const screen = camera.worldToScreen(car.worldX, car.worldY);
      assert(CarRenderer.pickCarAtScreen(hidden, camera, screen.x, screen.y) === null &&
        CarRenderer.pickCarAtScreen([retired], camera, screen.x, screen.y) === retired.id,
        'Q4: Clic y minimapa excluyen finalizados/retirados ocultos y conservan retirados visibles');
    }

    {
      const sim = new RaceSimulation('barcelona');
      const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
      const positionsAreCurrent = () => sim.cars.every(car => {
        const expected = calculateCarWorldPosition(car, sim.activeTrack, OFFICIAL_CIRCUITS[sim.circuitId].trackWidthCars);
        return ['worldX', 'worldY', 'worldAngle'].every(key => Number.isFinite(car[key]) && Math.abs(car[key] - expected[key]) < 1e-9);
      });
      assert(positionsAreCurrent(), 'Q4: Parrilla inicial tiene posiciones válidas antes del primer frame');
      sim.startRaceSequence();
      assert(positionsAreCurrent(), 'Q4: Empezar formación actualiza inmediatamente el offset de parrilla');
      for (const phase of ['formation-lap', 'grid-parking', 'grid-ready', 'lights-1', 'racing']) {
        sim.lightState = phase;
        for (const car of sim.cars) { car.worldX = NaN; car.worldY = NaN; }
        sim.update(0.016);
        assert(positionsAreCurrent(), `Q4: Motor sincroniza al terminar la rama ${phase}`);
      }
      sim.lightState = 'racing';
      const car = sim.cars[0];
      // Q20 (revisión autorizada 29/09/2026): dentro del pit lane y antes del cajón con cualquier trazado real.
      Object.assign(car, { progress: sim.activeTrack.pitEntryT + 0.02, trackT: sim.activeTrack.pitEntryT + 0.02, currentLap: 0, isInPitLane: true, status: 'pit' });
      car.pitStop.isPitting = true;
      car.pitStop.pitLaneProgress = 0;
        const oldProgress = car.progress;
        sim.update(0.02);
        const posOk = positionsAreCurrent();
        if (!(car.progress > oldProgress) || !posOk) {
          console.error(`Debug Q4: car.progress=${car.progress}, oldProgress=${oldProgress}, speed=${car.currentSpeedKmh}, pitLaneProgress=${car.pitStop.pitLaneProgress}, timer=${car.pitStop.currentStopTimer}, duration=${car.pitStop.stopDuration}`);
        }
        assert(car.progress > oldProgress && posOk, 'Q4: Boxes se sincroniza después de avanzar, sin retraso de un paso');
      Object.assign(car, { status: 'out', isRetiredVisible: true, currentSpeedKmh: 40 });
      sim.update(0.02);
      assert(positionsAreCurrent(), 'Q4: Retirados también mantienen su posición actual');
      sim.isPaused = true;
      const before = sim.cars.map(c => c.progress);
      sim.update(0.5);
      assert(positionsAreCurrent() && sim.cars.every((c, i) => c.progress === before[i]), 'Q4: Pausa conserva posición y progreso');
      sim.isPaused = false;
      sim.initRace();
      sim.lightState = 'racing';
      sim.raceFlagState = 'red';
      sim.update(0.016);
      // R12: la roja ya no recoloca en parrilla; inicia la suspensión (ajuste autorizado por el usuario el 01/10/2026).
      assert(sim.redFlag.phase === 'suspension' && positionsAreCurrent(), 'Q4: Recolocación tras roja actualiza posición en el mismo frame');
      sim.setCircuit('monaco');
      assert(positionsAreCurrent(), 'Q4: Cambiar circuito reinicializa posiciones con su capacidad');
      sim.initRace();
      assert(positionsAreCurrent(), 'Q4: Reiniciar carrera no conserva posiciones del estado anterior');

      // Recorrer una parada completa usando el motor, no solo muestras geométricas.
      sim.setCircuit('barcelona');
      sim.cars = [sim.cars[0]];
      const pitCar = sim.cars[0];
      Object.assign(pitCar, { progress: 1 + sim.activeTrack.pitEntryT, trackT: sim.activeTrack.pitEntryT, currentLap: 1 });
      pitCar.pitStop.scheduledLap = 1;
      sim.lightState = 'racing';
      sim.setSpeed(32);
      const camera = new Camera();
      camera.followCar(pitCar.id);
      let entered = false, stopped = false, exited = false, aligned = true;
      for (let i = 0; i < 2000 && !exited; i++) {
        sim.update(0.016);
        camera.update(sim.cars, 0.016, sim.activeTrack);
        entered ||= pitCar.isInPitLane;
        stopped ||= pitCar.isInPitLane && pitCar.currentSpeedKmh === 0;
        const isAligned = positionsAreCurrent() && camera.targetX === pitCar.worldX && camera.targetY === pitCar.worldY;
        if (!isAligned) {
          console.error(`Debug Q4 full pit stop: posCurrent=${positionsAreCurrent()}, targetX=${camera.targetX}, worldX=${pitCar.worldX}, speed=${pitCar.currentSpeedKmh}, pitLaneProgress=${pitCar.pitStop.pitLaneProgress}`);
        }
        aligned &&= isAligned;
        exited = entered && !pitCar.isInPitLane;
      }
      if (!(entered && stopped && exited && aligned && pitCar.pitStop.totalPitStops === 1)) {
        console.error(`Debug Q4 failed full pit stop: entered=${entered}, stopped=${stopped}, exited=${exited}, aligned=${aligned}, pitStops=${pitCar.pitStop.totalPitStops}`);
      }
      assert(entered && stopped && exited && aligned && pitCar.pitStop.totalPitStops === 1,
        'Q4: Parada completa del motor mantiene cámara/posición alineadas en entrada, servicio y salida');
    }

}
