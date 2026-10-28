// UX16 — De lejos, puntos de colores en lugar de coches (Sprint 7). Contrato acordado con el usuario el 28/10/2026 (corte en
// 8 píxeles, la opción recomendada).
//  1. Tres niveles según lo que mide el coche en pantalla, no según los metros: completo de cerca, ligero a media
//     distancia (como hoy) y punto cuando mide menos de 8 píxeles de largo; con un margen del 20 % para que no parpadee.
//  2. Los puntos son un único objeto para todos los coches, de tamaño fijo en píxeles y con el color del equipo; los dos
//     del jugador, algo más grandes y con borde blanco, y el coche seguido se distingue.
//  3. Con todos los coches de lejos (vista general) no hay ningún modelo de coche visible, y las llamadas de dibujo de los
//     coches bajan de una por coche a una en total.
//  4. Al acercar la cámara vuelven los coches con su librea, sin volver a cargar los modelos.
//  5. Los retirados y los que están en boxes ocultos siguen sin verse, también como punto.
//  6. Revisión en el navegador: capturas de la vista general y de cerca, y medida de llamadas de dibujo y fotogramas por
//     segundo con el contador de UX3, antes y después.
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const d = await server.ssrLoadModule('/src/scene3d/carDots.ts');
  const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
  const car = (id, distanceM, extra = {}) => ({ id, teamId: 'mclaren', color: '#ff8000', status: 'running', isRetiredVisible: false, distanceM, ...extra });

  await test('UX16: tres niveles por tamaño en pantalla', () => {
    // 5,4 m a 100 m con 55° en 800 px de alto: 5,4 / (2·100·tan 27,5°) · 800 ≈ 41 px.
    const px = d.screenLengthPx(100, 55, 800);
    assert(Math.abs(px - 41.5) < 1, 'UX16: el largo en pantalla sale de la distancia, el ángulo y el alto de la ventana', px.toFixed(1));
    assert(d.screenLengthPx(100, 55, 1600) > d.screenLengthPx(100, 55, 800) && d.screenLengthPx(100, 30, 800) > px, 'UX16: con más pantalla o más zoom, se ve más grande');
    assert(d.DOT_PX === 8 && d.DOT_HYSTERESIS === 0.2, 'UX16: corte en 8 píxeles, con un margen del 20 %');
    assert(d.carLevel(40, 50, undefined) === 'completo' && d.carLevel(40, 200, undefined) === 'ligero' && d.carLevel(7.9, 600, undefined) === 'punto', 'UX16: completo de cerca, ligero a media distancia y punto si mide menos de 8 px');
    assert(d.carLevel(8.5, 600, 'punto') === 'punto' && d.carLevel(9.7, 600, 'punto') === 'ligero' && d.carLevel(8.5, 600, 'ligero') === 'ligero', 'UX16: para dejar de ser punto tiene que pasar de 9,6 px (no parpadea)');
    // Lo mismo en metros, distinto en píxeles: el nivel lo deciden los píxeles.
    assert(d.carLevel(d.screenLengthPx(700, 55, 400), 700, undefined) === 'punto' && d.carLevel(d.screenLengthPx(700, 15, 1600), 700, undefined) === 'ligero', 'UX16: a la misma distancia, con zoom o pantalla grande sigue siendo coche');
  });

  await test('UX16: los puntos', () => {
    const plain = d.dotStyle({ mine: false, followed: false }), mine = d.dotStyle({ mine: true, followed: false }), followed = d.dotStyle({ mine: true, followed: true });
    assert(mine.sizePx > plain.sizePx && mine.ring === 'blanco' && plain.ring === 'ninguno', 'UX16: los del jugador, más grandes y con borde blanco');
    assert(followed.sizePx > mine.sizePx && followed.ring === 'seguido', 'UX16: el seguido se distingue');
    const plan = d.planCars([car(1, 3000), car(2, 3000, { teamId: 'ferrari', color: '#dc0000' })], { fovDeg: 55, viewportHeightPx: 800, playerTeamId: 'mclaren', followedCarId: null }, new Map());
    assert(plan.every(p => p.level === 'punto') && plan[0].dot.color === '#ff8000' && plan[1].dot.color === '#dc0000' && plan[0].dot.ring === 'blanco', 'UX16: cada punto con el color de su equipo');
    assert((scene.match(/new THREE\.Points\(/g) ?? []).length === 2 && /this\.dots\b/.test(scene) && /gl_PointSize/.test(scene), 'UX16: un solo objeto de puntos para todos los coches (el otro es el de los fuegos artificiales), de tamaño fijo en píxeles');
  });

  await test('UX16: de lejos, ningún modelo', () => {
    const cars = Array.from({ length: 20 }, (_, i) => car(i + 1, 2500 + i * 10, { teamId: i < 2 ? 'mclaren' : `t${i}` }));
    const plan = d.planCars(cars, { fovDeg: 55, viewportHeightPx: 800, playerTeamId: 'mclaren', followedCarId: 1 }, new Map());
    assert(plan.length === 20 && plan.every(p => p.level === 'punto'), 'UX16: en la vista general, todos son puntos');
    assert(/slot\.full\.visible = level === 'completo'/.test(scene) && /slot\.lod\.visible = level === 'ligero'/.test(scene) && /holder\.visible = level !== 'punto'/.test(scene), 'UX16: un coche en punto no tiene ningún modelo visible');
    assert(/this\.dots\.geometry\.setDrawRange\(0, /.test(scene), 'UX16: los puntos se dibujan de una vez (una sola llamada)');
  });

  await test('UX16: al acercar, vuelven los coches', () => {
    const prev = new Map();
    d.planCars([car(1, 3000)], { fovDeg: 55, viewportHeightPx: 800 }, prev);
    const near = d.planCars([car(1, 40)], { fovDeg: 55, viewportHeightPx: 800 }, prev);
    assert(near[0].level === 'completo' && near[0].dot === null, 'UX16: de cerca, el coche completo');
    // Al pasar a punto los modelos solo se esconden: no se liberan ni se vuelven a cargar.
    const placeCars = scene.slice(scene.indexOf('private placeCars'), scene.indexOf('private placeFireworks'));
    assert(!/disposeModel|release\?\.\(\)|\.remove\(/.test(placeCars) && /if \(!slot\.full && this\.carModel\)/.test(placeCars), 'UX16: los modelos se crean una vez y solo se esconden');
  });

  await test('UX16: los ocultos no salen', () => {
    const plan = d.planCars([car(1, 3000, { status: 'out', isRetiredVisible: false }), car(2, 3000, { status: 'finished' }), car(3, 3000, { status: 'out', isRetiredVisible: true }), car(4, 3000)], { fovDeg: 55, viewportHeightPx: 800 }, new Map());
    assert(plan.map(p => p.id).join() === '3,4', 'UX16: los retirados ocultos y los que han acabado no salen, tampoco como punto', plan.map(p => p.id).join());
    assert(/planCars\(/.test(scene), 'UX16: la escena usa este plan');
  });
}
