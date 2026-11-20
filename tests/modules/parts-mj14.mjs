// MJ14 — Piezas pintadas como en un F1 de verdad (Sprint 15). Contrato aprobado por el usuario el 20/11/2026 («Sí, adelante»):
//  1. En los cuatro coches, suspensión, halo, asiento, cabina, retrovisores y suelo quedan en carbono.
//  2. La livery solo cae en piezas pintables: ningún trozo de carbono pequeño rodeado de pintura (sin manchas negras).
//  3. Las liveries de los cuatro años y la del jugador siguen proyectándose sobre la carrocería (TL4).
//  4. El coche de la landing pública: sin manchas negras, con tapacubos y con las mismas piezas que se desmontan.
//     [20/11/2026, cambiado a petición del usuario: «vuelve a como estaba»] El coche de la landing no se toca.
//  5. Capturas de antes y después de los cuatro coches desde varios ángulos y del coche de la landing, y la medición.
// Medición del 20/11/2026 en el navegador (?revision=coches&medir=1, el mismo loadCarModel + dressCar del juego), en
// docs/design/mj14-capturas/medicion-{antes,despues}.json: caras pintadas en la suspensión junto a las ruedas, en el suelo y
// en zona de halo, manchas de carbono (grupos de 8 a 120 caras rodeados de pintura) y carbono en los costados.
// Antes: halo pintado en los cuatro (1455 a 8508 caras), suelo pintado (161 a 2236) y suspensión pintada (532 a 4233 en
// 2024-2026). Después: todo a 0, sin manchas, y carbono en los costados (solo retrovisores y halo bajo) por debajo del 5 %.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(readFileSync(f, 'utf8'));

export default async function run({ server, assert, test }) {
  const after = json('docs/design/mj14-capturas/medicion-despues.json');
  const before = json('docs/design/mj14-capturas/medicion-antes.json');
  const years = ['2023', '2024', '2025', '2026'];
  const of = (m, y) => m[`${y}-mclaren`];

  await test('MJ14.1: suspensión, halo, cabina y suelo en carbono', () => {
    const measured = years.every(y => { const m = of(after, y); return m && m.suspension.faces > 1000 && m.suspension.painted === 0 && m.floor.faces > 1000 && m.floor.painted === 0 && m.haloZone === 0; });
    const wasWrong = years.every(y => of(before, y).haloZone > 0) && years.some(y => of(before, y).suspension.painted > 0) && years.every(y => of(before, y).floor.painted > 0);
    const scene = src('src/renderer/modelScene.ts');
    const rules = scene.includes("else if (piece === 'halo') zone = 'carbon';") && scene.includes('else if (suspFront || suspRear || floor) zone = \'carbon\';')
      && /inside && faceZone\[f\] !== 'carbon' && faceX\[f\] > cockpit\.x0/.test(scene) && /rearLow = x < xr - 0\.1 && y <= 0\.62/.test(scene);
    assert(measured && wasWrong && rules, 'MJ14: en los cuatro coches la suspensión, el halo, el asiento y la cabina, el suelo y la estructura trasera quedan en carbono (medido: 0 caras pintadas; antes había)',
      JSON.stringify({ measured, wasWrong, rules, after: years.map(y => of(after, y)) }));
  });

  await test('MJ14.2: sin manchas negras', () => {
    const noIslands = years.every(y => of(after, y).islands === 0);
    const sides = years.every(y => { const s = of(after, y).sideCarbon; return s.faces > 1000 && s.carbon / s.faces < 0.05; });
    const rule = /else if \(!nearWheel && \(\(mn\.y > 0\.18 && az < 0\.62/.test(src('src/renderer/modelScene.ts'));
    assert(noIslands && sides && rule, 'MJ14: ningún grupo pequeño de carbono rodeado de pintura y, en los costados, menos del 5 % de carbono (retrovisores y halo); los trozos sueltos que el modelo traía en carbono van pintados',
      JSON.stringify({ noIslands, sides, rule, sideCarbon: years.map(y => of(after, y).sideCarbon) }));
  });

  await test('MJ14.3: las liveries siguen proyectándose', () => {
    const scene = src('src/renderer/modelScene.ts');
    const projected = scene.includes("geo.setAttribute('carPos', new THREE.BufferAttribute(cp, 3));") && scene.includes('root.userData.carFrame = { x0, x1, xr, xf, top, half };');
    const zones = ['zona_cuerpo', 'zona_punta', 'zona_tapa', 'zona_ponton', 'zona_costado', 'zona_lateral', 'zona_alerones', 'zona_placas'].every(z => scene.includes(`'${z}'`));
    assert(projected && zones, 'MJ14: la carrocería conserva sus zonas y la posición de cada vértice para la livery proyectada (TL4 y la del jugador, comprobadas en car-upgrades-tl4 y player-livery-tl5)', JSON.stringify({ projected, zones }));
  });

  // [20/11/2026] Cambiado a petición del usuario («No quería eso en el coche de la landing… vuelve a como estaba»): el coche
  // de la landing pública se queda como estaba antes de MJ14 (mismo archivo).
  await test('MJ14.4: el coche de la landing pública, como estaba', async () => {
    const hash = (await import('node:crypto')).createHash('md5').update(readFileSync('public/landing/f1-despiece.glb')).digest('hex');
    assert(hash === 'e09087269ef02a9ff8d261490ab3818a' && !existsSync('scripts/blender/mj14-landing.py'), 'MJ14: el coche de la landing pública no cambia (el mismo archivo de antes)', hash);
  });

  await test('MJ14.5: capturas y medición', () => {
    const dir = 'docs/design/mj14-capturas';
    const need = [];
    for (const p of ['antes', 'despues']) for (const y of years) for (const v of ['lado', 'tres', 'cola', 'arriba']) need.push(`${p}-${y}-${v}.png`);
    need.push('medicion-antes.json', 'medicion-despues.json');
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ14: capturas de los cuatro coches desde cuatro ángulos, antes y después, y la medición', missing.join(', '));
  });
}
