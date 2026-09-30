import { raceFactory } from '../support/race.mjs';
export default async function run({server, assert, test}) {
  const make = await raceFactory(server);
  const { calculateCarWorldPosition } = await server.ssrLoadModule('/src/utils/carPosition.ts');
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  for (const circuit of ['barcelona', 'monaco']) {
    await test(`Q7 ${circuit}`, () => {
      const sim = make(circuit), points = sim.activeTrack.points;
      assert(points.every(p => Number.isFinite(p.trackWidthMeters) && p.trackWidthMeters > 0), `Q7: anchuras válidas en ${circuit}`);
      assert(new Set(points.map(p => p.trackWidthMeters)).size > 1, `Q7: anchura variable en ${circuit}`);
    });
  }
  // Frontera sintética ancho→estrecho y costura de meta. No son medidas oficiales.
  for (const boundary of [.5, 1]) {
    await test(`Q7 continuidad ${boundary}`, () => {
      const sim = make(), track = sim.activeTrack;
      const base = track.points[0];
      track.points = [{...base,x:0,y:0,angle:0,trackWidthMeters:14,trackWidthCars:3},
        {...base,x:100,y:0,angle:0,trackWidthMeters:8,trackWidthCars:2}];
      const car = {...sim.cars[0], lateralOffset:.6, progress:boundary - 1e-8};
      const a=calculateCarWorldPosition(car,track), b=calculateCarWorldPosition({...car,progress:boundary + 1e-8},track);
      assert(Math.hypot(a.worldX-b.worldX,a.worldY-b.worldY)<.001, `Q7: posición continua al cambiar anchura/capacidad en ${boundary}`);
      const wide=CarRenderer.getCarDimensions(1,14,3), narrow=CarRenderer.getCarDimensions(1,8,2);
      assert(wide.width===narrow.width && wide.length===narrow.length, 'Q7: huella física constante al estrecharse la pista');
    });
  }
}
