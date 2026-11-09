// CA4 — Las ruedas en todo el juego (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. Los iconos de compuesto de la interfaz son imágenes renderizadas de las ruedas de CA3.
//  2. Cada coche 3D monta el compuesto que lleva y lo cambia al salir de boxes.
//  3. La portada se vuelve a renderizar con el coche y las ruedas nuevos (proceso de PF9), `landing-lcp-pf8` en verde
//     (aparte) y captura para el visto bueno (en `docs/design/ca4-portada/`).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ICONS = { soft: 'rueda_blanda', medium: 'rueda_media', hard: 'rueda_dura', intermediate: 'rueda_intermedia', wet: 'rueda_lluvia' };
/** Huellas de la capa del coche de la portada de PF9 (coche de 2026), para saber que se ha vuelto a renderizar. */
const OLD_HERO = { 'public/hero/portada-escritorio-coche.webp': 'a0f50fc46c161915', 'public/hero/portada-movil-coche.webp': 'af081ca1ab381e77' };
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);

export default async function run({ server, assert, test }) {
  await test('CA4: iconos de compuesto con la imagen de su rueda', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    const bad = [];
    for (const [compound, icon] of Object.entries(ICONS)) {
      const file = `public/img/compuestos/${icon}.webp`;
      if (!existsSync(file)) { bad.push(`falta ${file}`); continue; }
      const buf = readFileSync(file);
      if (buf.subarray(0, 4).toString() !== 'RIFF' || buf.subarray(8, 12).toString() !== 'WEBP') bad.push(`${file}: no es WebP`);
      if (buf.length > 8 * 1024) bad.push(`${file}: ${Math.round(buf.length / 1024)} KB (máx. 8)`);
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      if (!new RegExp(`<image[^>]+href="[^"]*img/compuestos/${icon}\\.webp"`).test(html)) bad.push(`${compound}: el icono no usa ${icon}.webp`);
    }
    assert(bad.length === 0, 'CA4: los cinco iconos de compuesto son la imagen renderizada de su rueda (WebP de 8 KB como mucho)', bad.join(' | '));
  });

  await test('CA4: cada coche 3D monta su compuesto y lo cambia al salir de boxes', async () => {
    const mod = await server.ssrLoadModule('/src/scene3d/compoundMount.ts').catch(() => ({}));
    const { compoundStyle } = await server.ssrLoadModule('/src/utils/compounds.ts');
    const { CAR_MODEL } = await server.ssrLoadModule('/src/renderer/carModel3d.ts');
    const material = name => ({ name, color: { value: null, set(v) { this.value = v; } } });
    const band = [material(CAR_MODEL.materials.band), material(CAR_MODEL.materials.band)], other = material(CAR_MODEL.materials.primary);
    const root = { userData: {}, traverse: cb => [{ isMesh: true, material: band[0] }, { isMesh: true, material: [other, band[1]] }, { isMesh: false }].forEach(cb) };
    const ok = typeof mod.syncCompound === 'function';
    const first = ok && mod.syncCompound(root, 'medium');
    const again = ok && mod.syncCompound(root, 'medium');
    const colorsMedium = band.map(m => m.color.value);
    const changed = ok && mod.syncCompound(root, 'hard');
    assert(ok && first === true && again === false && changed === true
      && colorsMedium.every(c => c === compoundStyle('medium').color) && band.every(m => m.color.value === compoundStyle("hard").color) && other.color.value === null,
      'CA4: syncCompound pinta la banda con el compuesto montado, solo cuando cambia, y no toca la librea', JSON.stringify({ first, again, changed, colorsMedium, now: band.map(m => m.color.value) }));
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/syncCompound\(slot\.full,\s*car\.tires\.compound\)/.test(scene) && /syncCompound\(slot\.lod,\s*car\.tires\.compound\)/.test(scene),
      'CA4: la escena sincroniza en cada fotograma el compuesto del coche completo y del ligero');
    // El motor cambia el compuesto montado al terminar la parada: lo que la escena lee.
    const { raceFactory, advance } = await import('../support/race.mjs');
    const sim = (await raceFactory(server))('barcelona', 1), car = sim.cars[0];
    car.tires.compound = 'medium'; car.pitStop.targetCompound = 'hard'; car.pitStop.scheduledLap = car.currentLap;
    let steps = 0;
    while (!(car.pitStop.stopLog ?? []).some(s => s.totalSec > 0) && steps++ < 4000) advance(sim, 0.5, 0.05);
    assert(car.tires.compound !== 'medium', 'CA4: al salir de boxes el coche lleva otro compuesto (el que la escena monta)', car.tires.compound);
  });

  await test('CA4: la portada con el coche y las ruedas nuevos', () => {
    const changed = Object.entries(OLD_HERO).filter(([path, old]) => existsSync(path) && sha(path) !== old).length;
    const dir = 'docs/design/ca4-portada';
    const files = existsSync(dir) ? readdirSync(dir) : [];
    const missing = ['portada-escritorio.png', 'portada-movil.png'].filter(f => !files.includes(f));
    assert(changed === 2 && missing.length === 0, 'CA4: capas del coche de la portada renderizadas de nuevo (escritorio y móvil) y capturas en docs/design/ca4-portada/',
      `${changed}/2 capas nuevas; faltan ${missing.join(', ') || 'ninguna'}`);
  });
}
