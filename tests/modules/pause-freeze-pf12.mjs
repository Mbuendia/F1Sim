// PF12 — La pausa congela la carrera (Sprint 9). Contrato acordado con el usuario el 04/11/2026 (ficha de PF12):
//  1. En pausa (siguen llegando vistas con el mismo instante), ningún coche se mueve en 2 s reales, ni atrás ni adelante.
//  2. Al reanudar, los coches siguen sin saltos: nunca hacia atrás ni más de lo que permite su velocidad.
//  3. Las pruebas de pintado de N3 y N8 siguen en verde (se pasan con la suite).
// Lo que se ve es el coche respecto a la cámara: la de persecución sigue al coche con algo de retraso y, al pararse todo,
// seguía acercándose (el coche parecía ir hacia atrás). En pausa la cámara tampoco se mueve (CameraDirector3D.view con
// el último argumento `paused`).
export default async function run({ server, assert, test }) {
  const { ViewInterpolator } = await server.ssrLoadModule('/src/engine/ViewInterpolator.ts');
  const { CameraDirector3D } = await server.ssrLoadModule('/src/scene3d/director3d.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  // Un coche a 200 km/h en línea recta: x en décimas de metro y progreso en cienmilésimas.
  const view = t => ({ t, c: [7, Math.round(t * 55.6 * 10), 0, 0, 200, 0, 10000, Math.round(t * 1e5 / 5000 * 55.6)] });
  const run60 = (interp, from, to, t0, rate) => { let t = t0; for (let now = from; now < to; now += 1000 / 60) { t += rate / 60; interp.push(view(+t.toFixed(4)), now); } return t; };

  await test('PF12.1: en pausa, quieto', () => {
    const interp = new ViewInterpolator();
    const tPause = run60(interp, 0, 3000, 0, 1);
    const xs = [];
    for (let now = 3000; now < 5000; now += 1000 / 60) { interp.push(view(+tPause.toFixed(4)), now); xs.push(interp.frame(now).cars[0].worldX); }
    // Tras el primer instante (lo que quedaba por pintar hasta la última vista), nada se mueve.
    const settled = xs.slice(30);
    const spread = Math.max(...settled) - Math.min(...settled);
    const back = xs.some((x, k) => k > 0 && x < xs[k - 1] - 1e-9);
    assert(!back, 'PF12: en pausa ningún coche retrocede', back ? 'retrocede' : 'ok');
    assert(spread < 1e-6, 'PF12: en pausa los coches se quedan quietos (desde el primer medio segundo)', `${spread.toFixed(4)} m`);
  });

  await test('PF12.2: al reanudar, sin saltos', () => {
    const interp = new ViewInterpolator();
    let t = run60(interp, 0, 3000, 0, 1);
    let last = null, back = false, jump = 0;
    for (let now = 3000; now < 5000; now += 1000 / 60) { interp.push(view(+t.toFixed(4)), now); last = interp.frame(now).cars[0].worldX; }
    for (let now = 5000; now < 7000; now += 1000 / 60) {
      t += 1 / 60; interp.push(view(+t.toFixed(4)), now);
      const x = interp.frame(now).cars[0].worldX;
      if (x < last - 1e-9) back = true;
      jump = Math.max(jump, x - last);
      last = x;
    }
    assert(!back && jump <= 55.6 / 60 * 3, 'PF12: al reanudar ni retroceso ni saltos (como mucho tres pasos de su velocidad por fotograma)', `máx. ${jump.toFixed(2)} m por fotograma`);
  });

  await test('PF12.3: en pausa la cámara tampoco se mueve', () => {
    const sim = new RaceSimulation('barcelona'), car = sim.cars[0], track = sim.activeTrack;
    const director = new CameraDirector3D(track, 'barcelona', { mode3d: 'persecucion' });
    const P = track.points, at = k => { const p = P[k % P.length], q = P[(k + 1) % P.length]; return { ...car, worldX: p.x, worldY: p.y, worldAngle: Math.atan2(q.y - p.y, q.x - p.x), trackT: (k % P.length) / P.length, status: 'running' }; };
    let k = 100, view = null;
    for (let f = 0; f < 120; f++) { k += 15; view = director.view([at(k)], car.id, f / 60, 1 / 60, 16 / 9, () => 0, false).view; }
    const paused = []; for (let f = 0; f < 120; f++) paused.push(director.view([at(k)], car.id, 2, 1 / 60, 16 / 9, () => 0, true).view.position);
    const moved = Math.max(...paused.map(p => Math.hypot(p.x - paused[0].x, p.y - paused[0].y, p.z - paused[0].z)));
    assert(moved < 1e-6, 'PF12: en pausa la cámara de persecución se queda quieta (el coche no parece ir hacia atrás)', `${moved.toFixed(2)} m`);
  });
}
