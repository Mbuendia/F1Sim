// Puente de Suzuka y sombras con la hora del día (PROPUESTA DE CONTRATO, 21/10/2026).
// Petición del usuario: en Suzuka los coches pasaban siempre por encima del puente; hacerlo bien y añadir sombras para
// que se vea más realista. Decisión del usuario del 21/10/2026: sombras de coches, puente y muros, con la dirección y el
// largo según la hora de la carrera (y casi sin sombra con nubes). Lo que se puede probar sin pantalla:
//  1. Cruces del trazado: Suzuka se corta a sí mismo una vez (bajada de Degner hacia la horquilla y recta de la 130R);
//     los demás circuitos, ninguna.
//  2. El puente: en Suzuka va por arriba la recta de la 130R. Los coches cerca del cruce van por debajo o por encima,
//     y se pintan en ese orden: primero la pista y los de abajo, luego el tablero del puente, luego los de arriba.
//  3. El sol: hora de salida de cada Gran Premio, dirección y largo de la sombra según la hora y la latitud, menos sombra
//     con nubes y focos en las carreras de noche. Convención: arriba en la pantalla es el norte.
//  Cómo se ve (tablero, sombras de coches, puente y muros) se comprueba en el navegador con capturas.

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { findCrossings, overpassFor, bridgeSide, bridgePaintOrder } = await load('/src/renderer/overpass.ts');
  const { START_HOUR, NIGHT_RACES, sunAt, shadowOffset } = await load('/src/renderer/lighting.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const angle = v => Math.atan2(v.dy, v.dx) * 180 / Math.PI;

  await test('Puente: cruces de los trazados', () => {
    const suzuka = findCrossings(new RaceSimulation('suzuka').activeTrack.points);
    assert(suzuka.length === 1, 'Puente: Suzuka se corta a sí mismo una vez', JSON.stringify(suzuka));
    const [c] = suzuka;
    const ts = [c.tA, c.tB].sort((a, b) => a - b);
    assert(near(ts[0], 0.435, 0.005) && near(ts[1], 0.8445, 0.005), 'Puente: entre la bajada de Degner (43,5 %) y la recta de la 130R (84,5 %)', JSON.stringify(ts));
    const others = ids.filter(id => id !== 'suzuka').filter(id => findCrossings(new RaceSimulation(id).activeTrack.points).length > 0);
    assert(others.length === 0, 'Puente: ningún otro circuito se cruza', others.join(', '));
  });

  await test('Puente: qué tramo va por arriba y en qué orden se pinta', () => {
    const o = overpassFor('suzuka');
    assert(o && near(o.upperT, 0.8445, 0.005) && near(o.lowerT, 0.435, 0.005), 'Puente: en Suzuka va por arriba la recta de la 130R', JSON.stringify(o));
    assert(overpassFor('barcelona') === null, 'Puente: los circuitos sin cruce no tienen puente');
    assert(bridgeSide(o, o.lowerT) === 'under' && bridgeSide(o, o.lowerT + 0.002) === 'under', 'Puente: un coche en la bajada de Degner, junto al cruce, va por debajo');
    assert(bridgeSide(o, o.upperT) === 'over' && bridgeSide(o, o.upperT - 0.002) === 'over', 'Puente: en la recta de la 130R, por encima');
    assert(bridgeSide(o, 0.1) === null && bridgeSide(o, (o.lowerT + o.upperT) / 2) === null, 'Puente: lejos del cruce, ni una cosa ni otra');
    assert(bridgeSide(o, o.lowerT, true) === null, 'Puente: el pit lane no pasa por el cruce');
    const cars = [{ id: 1, trackT: o.lowerT }, { id: 2, trackT: o.upperT }, { id: 3, trackT: 0.2 }, { id: 4, trackT: o.lowerT - 0.001 }];
    const plan = bridgePaintOrder(cars, o);
    assert(plan.below.map(c => c.id).sort().join() === '1,3,4' && plan.above.map(c => c.id).join() === '2',
      'Puente: primero la pista y los coches de abajo (y los demás), luego el tablero, luego los de arriba', JSON.stringify({ below: plan.below.map(c => c.id), above: plan.above.map(c => c.id) }));
    const none = bridgePaintOrder(cars, null);
    assert(none.below.length === 4 && none.above.length === 0, 'Puente: sin puente, todos en una capa');
  });

  await test('Sombras: el sol según la hora, la latitud y las nubes', () => {
    assert(ids.every(id => Number.isFinite(START_HOUR[id]) && START_HOUR[id] >= 12 && START_HOUR[id] <= 23), 'Sombras: cada Gran Premio tiene su hora de salida', ids.filter(id => !Number.isFinite(START_HOUR[id])).join(', '));
    for (const id of ['bahrain', 'jeddah', 'marina-bay', 'las-vegas', 'lusail']) assert(NIGHT_RACES.has(id), `Sombras: ${id} se corre de noche`);
    assert(!NIGHT_RACES.has('suzuka') && !NIGHT_RACES.has('barcelona'), 'Sombras: Suzuka y Barcelona, de día');
    const day = sunAt({ circuitId: 'barcelona', raceTimeSec: 0, cloudCover: 0 });
    assert(day.mode === 'sol' && day.alpha > 0.2 && day.alpha <= 0.6 && near(Math.hypot(day.dx, day.dy), 1, 1e-6) && day.length > 0, 'Sombras: de día, sombra de sol con dirección y largo', JSON.stringify(day));
    assert(day.dy < 0, 'Sombras: en el hemisferio norte, a primera hora de la tarde, la sombra cae hacia el norte (arriba)', JSON.stringify(day));
    const later = sunAt({ circuitId: 'barcelona', raceTimeSec: 5400, cloudCover: 0 });
    assert(Math.abs(angle(later) - angle(day)) > 5 && later.length > day.length, 'Sombras: hora y media después la sombra gira y se alarga', `${angle(day).toFixed(1)}° → ${angle(later).toFixed(1)}°, ${day.length.toFixed(2)} → ${later.length.toFixed(2)}`);
    const south = sunAt({ circuitId: 'melbourne', raceTimeSec: 0, cloudCover: 0 });
    assert(south.mode === 'sol' && south.dy > 0, 'Sombras: en el hemisferio sur, la sombra cae hacia el sur (abajo)', JSON.stringify(south));
    const cloudy = sunAt({ circuitId: 'barcelona', raceTimeSec: 0, cloudCover: 1 });
    assert(cloudy.alpha <= day.alpha * 0.35, 'Sombras: con el cielo cubierto casi no hay sombra', `${day.alpha.toFixed(2)} → ${cloudy.alpha.toFixed(2)}`);
    const night = sunAt({ circuitId: 'marina-bay', raceTimeSec: 0, cloudCover: 0 });
    assert(night.mode === 'focos' && night.length <= 0.3 && night.alpha > 0, 'Sombras: de noche, sombras cortas de los focos', JSON.stringify(night));
    const off = shadowOffset(day, 2);
    assert(near(off.x, day.dx * day.length * 2, 1e-9) && near(off.y, day.dy * day.length * 2, 1e-9), 'Sombras: el desplazamiento de una sombra es la dirección por el largo y la altura', JSON.stringify(off));
  });
}
