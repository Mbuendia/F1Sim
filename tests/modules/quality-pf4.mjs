// PF4 — Calidad automática según el dispositivo (Sprint 8). Contrato escrito el 29/10/2026 en el modo sin permisos que
// pide el usuario ese día (opción recomendada en cada decisión).
//  1. Tres niveles (alto, medio y bajo) que fijan la resolución máxima, las sombras, el suavizado de bordes y desde qué
//     tamaño se pinta el coche completo; cada nivel gasta menos que el anterior. Alto es lo de hoy.
//  2. El nivel lo elige el dispositivo: escritorio con memoria y procesador sobrados, alto; escritorio justo o móvil,
//     medio; móvil justo, bajo. Sin datos de memoria, alto en escritorio y medio en móvil.
//  3. Se puede ajustar en Ajustes → Gráficos: Automática (por defecto), Alta, Media o Baja; se guarda en el dispositivo.
//  4. En automático baja solo si los fotogramas caen: de alto a medio con 5 s seguidos por debajo de 45 fps y de medio a
//     bajo con 5 s por debajo de 28; tras empezar o tras un cambio, 5 s de gracia; nunca sube solo (no oscila). Con un
//     nivel elegido a mano no cambia.
//  5. La carrera 3D lo aplica: resolución, sombras y corte del coche completo, y vigila los fotogramas.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const qP = load('/src/settings/quality.ts'); qP.catch(() => {});
  const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

  await test('PF4.1: tres niveles', async () => {
    const q = await qP;
    const { alto, medio, bajo } = q.QUALITY_PROFILES;
    assert(alto.pixelRatioMax === 1.5 && alto.shadowMapSize === 2048 && alto.antialias === true && alto.fullCarPx === 150, 'PF4: alto es lo de hoy (resolución ×1,5, sombras 2048, suavizado, coche completo desde 150 px)', JSON.stringify(alto));
    assert(alto.pixelRatioMax >= medio.pixelRatioMax && medio.pixelRatioMax >= bajo.pixelRatioMax && bajo.pixelRatioMax === 1, 'PF4: la resolución baja con el nivel (bajo, ×1)');
    assert(alto.shadowMapSize > medio.shadowMapSize && medio.shadowMapSize > 0 && bajo.shadowMapSize === 0, 'PF4: sombras 2048, menos en medio y ninguna en bajo');
    assert(alto.fullCarPx < medio.fullCarPx && bajo.fullCarPx === Infinity, 'PF4: el coche completo sale menos en medio y nunca en bajo');
    assert(bajo.antialias === false, 'PF4: sin suavizado de bordes en bajo');
  });

  await test('PF4.2: el dispositivo elige', async () => {
    const q = await qP;
    assert(q.recommendedQuality({ mobile: false, deviceMemory: 16, cores: 12 }) === 'alto', 'PF4: escritorio sobrado, alto');
    assert(q.recommendedQuality({ mobile: false, deviceMemory: 4, cores: 8 }) === 'medio' && q.recommendedQuality({ mobile: false, deviceMemory: 8, cores: 4 }) === 'medio', 'PF4: escritorio justo (4 GB o 4 núcleos), medio');
    assert(q.recommendedQuality({ mobile: true, deviceMemory: 8, cores: 8 }) === 'medio', 'PF4: móvil, medio');
    assert(q.recommendedQuality({ mobile: true, deviceMemory: 3, cores: 8 }) === 'bajo' && q.recommendedQuality({ mobile: true, deviceMemory: 8, cores: 4 }) === 'bajo', 'PF4: móvil justo, bajo');
    assert(q.recommendedQuality({ mobile: false, deviceMemory: undefined, cores: undefined }) === 'alto' && q.recommendedQuality({ mobile: true, deviceMemory: undefined, cores: undefined }) === 'medio', 'PF4: sin datos, alto en escritorio y medio en móvil');
  });

  await test('PF4.3: Ajustes', async () => {
    const q = await qP;
    const s = memory();
    assert(q.readQuality(s) === 'auto', 'PF4: automática por defecto');
    q.writeQuality(s, 'bajo');
    assert(q.readQuality(s) === 'bajo' && s.getItem(q.QUALITY_KEY) === 'bajo', 'PF4: se guarda en el dispositivo');
    s.setItem(q.QUALITY_KEY, 'ultra');
    assert(q.readQuality(s) === 'auto', 'PF4: un valor raro vuelve a automática');
    assert(q.effectiveQuality('auto', { mobile: true, deviceMemory: 2, cores: 4 }) === 'bajo' && q.effectiveQuality('alto', { mobile: true, deviceMemory: 2, cores: 4 }) === 'alto', 'PF4: en automática decide el dispositivo; a mano, lo elegido');
    const SettingsScreen = (await load('/src/components/SettingsScreen.tsx')).default;
    const html = renderToStaticMarkup(createElement(SettingsScreen, { onBack: () => {}, storage: memory() }));
    assert(/name="ajustes-calidad"/.test(html) && ['Automática', 'Alta', 'Media', 'Baja'].every(l => html.includes(l)), 'PF4: Ajustes → Gráficos tiene la calidad (Automática, Alta, Media, Baja)');
  });

  await test('PF4.4: baja sola si caen los fotogramas', async () => {
    const q = await qP;
    const g = q.createQualityGovernor({ start: 'alto', auto: true });
    const feed = (fps, n) => { let last = null; for (let i = 0; i < n; i++) last = g.second(fps) ?? last; return last; };
    assert(feed(20, 5) === null && g.level === 'alto', 'PF4: los 5 primeros segundos son de gracia');
    assert(feed(40, 4) === null && g.level === 'alto', 'PF4: 4 s malos no bastan');
    assert(feed(60, 1) === null && feed(40, 4) === null && g.level === 'alto', 'PF4: un segundo bueno corta la racha');
    assert(feed(40, 1) === 'medio' && g.level === 'medio', 'PF4: 5 s seguidos por debajo de 45 fps pasan a medio');
    assert(feed(20, 5) === null && g.level === 'medio', 'PF4: tras el cambio, 5 s de gracia otra vez');
    assert(feed(30, 10) === null && g.level === 'medio', 'PF4: en medio, 30 fps aguantan (el corte es 28)');
    assert(feed(25, 5) === 'bajo' && g.level === 'bajo', 'PF4: 5 s por debajo de 28 fps pasan a bajo');
    assert(feed(60, 60) === null && g.level === 'bajo', 'PF4: nunca sube solo');
    const manual = q.createQualityGovernor({ start: 'alto', auto: false });
    let changed = null; for (let i = 0; i < 30; i++) changed = manual.second(10) ?? changed;
    assert(changed === null && manual.level === 'alto', 'PF4: con un nivel elegido a mano no cambia');
  });

  await test('PF4.5: la carrera 3D lo aplica', async () => {
    const d = await load('/src/scene3d/carDots.ts');
    assert(d.carLevel(200, 25, undefined, 250) === 'ligero' && d.carLevel(260, 20, undefined, 250) === 'completo' && d.carLevel(5000, 2, undefined, Infinity) === 'ligero', 'PF4: el corte del coche completo depende del nivel');
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    const canvas = readFileSync('src/components/RaceCanvas.tsx', 'utf8');
    assert(/setQuality\(/.test(scene) && /shadowMapSize/.test(scene), 'PF4: la escena 3D cambia sombras y corte con setQuality');
    assert(/createQualityGovernor\(/.test(canvas) && /pixelRatioMax/.test(canvas), 'PF4: la carrera vigila los fotogramas y limita la resolución según el nivel');
  });
}
