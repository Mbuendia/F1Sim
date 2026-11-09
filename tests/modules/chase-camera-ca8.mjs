// CA8 — Cámara de persecución más cerca (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. La persecución va a 6-7 m detrás del coche y a 2-2,5 m de alto, mirando al coche.
//  2. Nunca dentro del coche ni del muro: a más de 4 m del centro del coche.
//  3. Sigue igual de suave en las curvas (mismo seguimiento que hoy) y la cámara de boxes de CA5 no cambia.
//  4. Captura para el visto bueno (en `docs/design/ca8-persecucion/`).
//  [Autorizado al aprobar el contrato] `scenery-3d` pasa de «a 8-20 m» a «a 5-20 m» detrás del coche.
import { readFileSync, existsSync, readdirSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const cams = await server.ssrLoadModule('/src/scene3d/cameras.ts');

  await test('CA8: persecución más cerca', () => {
    const bad = [];
    for (const heading of [0, 0.7, 2.1, -1.4, Math.PI]) {
      const car = { x: 120, y: -40, heading, t: 0.3, z: 1.5 };
      const v = cams.chaseView(car);
      const dx = v.position.x - car.x, dy = v.position.y - car.y, back = Math.hypot(dx, dy);
      const behind = dx * Math.cos(heading) + dy * Math.sin(heading) < 0;
      const high = v.position.z - car.z;
      if (!behind || back < 6 || back > 7) bad.push(`detrás ${back.toFixed(2)} m`);
      if (high < 2 || high > 2.5) bad.push(`altura ${high.toFixed(2)} m`);
      if (Math.hypot(v.target.x - car.x, v.target.y - car.y) > 3) bad.push('no mira al coche');
      if (Math.hypot(dx, dy, high) <= 4) bad.push('demasiado cerca del coche');
    }
    assert(bad.length === 0, 'CA8: 6-7 m detrás, 2-2,5 m de alto, mirando al coche y a más de 4 m de su centro', [...new Set(bad)].join(' | '));
  });

  await test('CA8: el resto de la realización no cambia', () => {
    const director = readFileSync('src/scene3d/director3d.ts', 'utf8');
    const car = { x: 100, y: 50, heading: 0.4, t: 0.1, z: 0, inBox: true };
    const box = cams.pitBoxView(car);
    const d = Math.hypot(box.position.x - car.x, box.position.y - car.y);
    assert(/this\.mode === 'persecucion' \? 6 : 2\.5/.test(director) && d > 6 && d < 6.5,
      'CA8: la persecución sigue al coche con la misma suavidad y la cámara de boxes sigue donde estaba', `${d.toFixed(2)} m`);
  });

  await test('CA8: captura', () => {
    const dir = 'docs/design/ca8-persecucion';
    const files = existsSync(dir) ? readdirSync(dir).filter(f => /\.(png|jpg)$/.test(f)) : [];
    assert(files.length >= 1, 'CA8: captura de la persecución nueva en docs/design/ca8-persecucion/', files.join(', '));
  });
}
