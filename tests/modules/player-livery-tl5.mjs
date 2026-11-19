// TL5 — Tu librea (Sprint 12). Alcance elegido por el usuario el 19/11/2026: editor por zonas, al crear la carrera
// profesional y en cada pretemporada; MD18 lo ampliará. Contrato aprobado ese día («Sí, adelante»):
//  1. 6 a 8 plantillas sacadas del estilo de coches reales; cualquier plantilla con cualquier combinación de tres colores da
//     una librea válida que se proyecta sin manchas y sin marcas reales.
//  2. El editor enseña el coche en 3D girando y se actualiza al cambiar plantilla, colores, dorsal y patrocinadores
//     (pontón, tapa motor, morro y placas del alerón).
//  3. Los patrocinadores son los de parodia que tiene tu equipo; un hueco puede quedar vacío.
//  4. La librea se guarda en la partida y se recupera; una partida antigua sin librea propia sigue con la de su equipo.
//  5. Tus coches la llevan en la carrera 3D (cercano y lejano), el centro de temporada, el coche del inicio y los retratos.
//  6. Se elige al crear la carrera profesional (paso que se puede saltar) y después solo en la pretemporada.
//  7. Si dos colores son casi iguales el editor avisa, y los rótulos eligen letra clara u oscura.
//  8. Capturas de cada plantilla con dos juegos de colores y del editor en escritorio y en móvil.
// (El dorsal: como cada piloto lleva su número, el editor elige el color del dorsal, no el número.)
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8');
const HEX = /^#[0-9a-fA-F]{6}$/;
const REAL = /\b(ORACLE|PETRONAS|SHELL|ARAMCO|BWT|STAKE|VISA|OKX|CHROME|HAAS|MONEYGRAM|RED ?BULL|HONDA|MERCEDES|FERRARI|RENAULT|AUDI|MCLAREN|WILLIAMS|ALPINE|TOYOTA|FORD)\b/i;

export default async function run({ server, assert, test }) {
  const L = await server.ssrLoadModule('/src/data/playerLivery.ts');
  const M = await server.ssrLoadModule('/src/simulation/Management.ts');
  const { default: LiveryEditor } = await server.ssrLoadModule('/src/components/LiveryEditor.tsx');
  const sample = (template, colors, slots = {}) => ({ version: 1, template, colors, numberColor: '#ffffff', slots });
  const SETS = [['#0b2d7a', '#e10600', '#ffffff'], ['#111111', '#ff8000', '#47c7fc'], ['#ffffff', '#ffffff', '#ffffff'], ['#000000', '#000000', '#000000'], ['#12ab34', '#fedcba', '#808080']];

  await test('TL5.1: plantillas válidas con cualquier color, proyectadas y sin marcas reales', () => {
    const bad = [];
    const n = L.LIVERY_TEMPLATES.length;
    if (n < 6 || n > 8) bad.push(`${n} plantillas`);
    const keys = new Set();
    for (const t of L.LIVERY_TEMPLATES) {
      if (!t.inspiredBy || !t.name) bad.push(`${t.id}: sin nombre o sin la librea que la inspira`);
      for (const c of SETS) {
        const art = L.playerLiveryArt(sample(t.id, c, { ponton: 'Brivio' }), 'mclaren', 2025);
        const sl = L.playerSeasonLivery(sample(t.id, c, { ponton: 'Brivio' }), 'mclaren', 2025);
        if (!HEX.test(art.base) || !sl.art || !sl.artKey) bad.push(`${t.id} ${c}: sin dibujo proyectado`);
        for (const sh of [...art.side, ...art.top]) {
          if ('color' in sh && !HEX.test(sh.color)) bad.push(`${t.id}: color ${sh.color}`);
          if ('text' in sh && REAL.test(sh.text)) bad.push(`${t.id}: marca ${sh.text}`);
        }
        keys.add(sl.artKey);
      }
    }
    assert(bad.length === 0 && keys.size === n * SETS.length - (n - 1) * 0, 'TL5: 6-8 plantillas; cada una con cualquier juego de colores da su dibujo proyectado (clave propia), sin marcas reales', bad.join(' | ') || `${keys.size} libreas distintas`);
  });

  await test('TL5.2: el editor enseña el coche en 3D y se actualiza con cada cambio', () => {
    const html = renderToStaticMarkup(createElement(LiveryEditor, { teamId: 'mclaren', year: 2025, number: 4, sponsors: ['Brivio', 'Calindra', ''], value: L.defaultPlayerLivery('#ff8000', '#111111', ['Brivio']), onSave: () => {}, onSkip: () => {} }));
    const radios = (html.match(/role="radio"/g) ?? []).length, colors = (html.match(/type="color"/g) ?? []).length, selects = (html.match(/<select/g) ?? []).length;
    const ed = src('src/components/LiveryEditor.tsx');
    const live = /setTimeout\(\(\) => setShown\(draft\), 220\)/.test(ed) && /playerSeasonLivery\(shown, teamId, year\)/.test(ed) && /<Car3DViewer[^>]*livery=\{livery\}/s.test(ed);
    const turns = /gira solo/.test(src('src/components/Car3DViewer.tsx'));
    const slots = L.LIVERY_SLOTS.join(',') === 'ponton,tapa,morro,placas';
    assert(radios === L.LIVERY_TEMPLATES.length && colors === 4 && selects === 4 && live && turns && slots,
      'TL5: plantillas, tres colores y dorsal, cuatro huecos (pontón, tapa motor, morro y placas) y el coche 3D girando que se repinta con cada cambio',
      `plantillas ${radios} | colores ${colors} | huecos ${selects} | en vivo ${live} | gira ${turns}`);
  });

  await test('TL5.3: solo los patrocinadores de tu equipo; un hueco puede ir vacío', () => {
    const html = renderToStaticMarkup(createElement(LiveryEditor, { teamId: 'mclaren', year: 2025, number: 4, sponsors: ['Brivio', 'Calindra', ''], value: L.defaultPlayerLivery('#ff8000', '#111111', []), onSave: () => {}, onSkip: () => {} }));
    const first = html.split('<select')[1]?.split('</select>')[0] ?? '';
    const options = [...first.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(m => m[1]);
    const empty = L.playerLiveryArt(sample('flecha', SETS[0]), 'mclaren', 2025).side.every(sh => !('logo' in sh));
    const placed = L.playerLiveryArt(sample('flecha', SETS[0], { tapa: 'Calindra' }), 'mclaren', 2025).side.filter(sh => 'logo' in sh).map(sh => sh.logo);
    const app = /carSponsors\(management\.sponsors, teamId\)/.test(src('src/App.tsx'));
    assert(options.join('|') === 'Vacío|Brivio|Calindra' && empty && placed.join() === 'Calindra' && app,
      'TL5: cada hueco ofrece «Vacío» y los patrocinadores firmados por tu equipo; un hueco vacío no pinta nada', `opciones ${options.join(', ')} | vacío ${empty} | ${placed} | firmados ${app}`);
  });

  await test('TL5.4: se guarda en la partida y se recupera; las partidas antiguas siguen con la de su equipo', () => {
    const base = M.startManagement('mclaren', 1, 7);
    const livery = sample('ola', SETS[1], { ponton: 'Brivio' });
    const back = M.readManagement(JSON.parse(JSON.stringify({ ...base, livery })));
    const old = M.readManagement(JSON.parse(JSON.stringify(base)));
    const broken = M.readManagement(JSON.parse(JSON.stringify({ ...base, livery: { version: 1, template: 'nada', colors: ['rojo'] } })));
    const ok = JSON.stringify(back?.livery) === JSON.stringify(livery) && old && !('livery' in old) && broken && !('livery' in broken);
    const form = { mclaren: { livery: { primary: '#000000', secondary: '#111111', sponsors: [] } }, ferrari: { livery: { primary: '#ff0000', secondary: '#000000', sponsors: [] } } };
    const none = L.withPlayerLivery(form, 'mclaren', 2025, undefined) === form;
    assert(ok && none, 'TL5: la librea vuelve igual al cargar; sin librea o con una que no se entiende, el coche lleva la de su equipo', `vuelve ${ok} | sin librea ${none}`);
  });

  await test('TL5.5: tus coches la llevan en la carrera, la temporada, el inicio y los retratos', () => {
    const form = { mclaren: { livery: { primary: '#000000', secondary: '#111111', sponsors: [] } }, ferrari: { livery: { primary: '#ff0000', secondary: '#000000', sponsors: [] } } };
    const out = L.withPlayerLivery(form, 'mclaren', 2025, sample('panel', SETS[0]));
    const mine = Boolean(out.mclaren.livery.art) && out.mclaren.livery.primary === '#0b2d7a' && out.ferrari === form.ferrari;
    const app = src('src/App.tsx');
    const race = /simulation\.setTeamForm\(mode === 'career' \? withPlayerLivery\(seasonForm\(season\), management\.playerTeamId, seasonYear\(season\), management\.livery\)/.test(app);
    const home = /teamForm=\{mode === 'career' \? withPlayerLivery\(seasonForm\(season\)/.test(app);
    const scene = /dressCar\(root, carLivery\(car\.team\)/.test(src('src/scene3d/RaceScene3D.ts'));
    const portraits = /car\.team\.livery/.test(src('src/renderer/carSprites.ts'));
    assert(mine && race && home && scene && portraits, 'TL5: tu equipo (y solo él) lleva tu librea en el motor de la carrera, el centro de temporada y el inicio; la escena 3D y los retratos la leen del equipo',
      `tuya ${mine} | carrera ${race} | inicio ${home} | escena ${scene} | retratos ${portraits}`);
  });

  await test('TL5.6: al crear la carrera (se puede saltar) y en la pretemporada', () => {
    const app = src('src/App.tsx');
    const calls = [...app.matchAll(/setLiveryEditor\('(new|winter)'\)/g)].map(m => m[1]);
    const skip = /skipLabel=\{liveryEditor === 'new' \? 'Saltar' : 'Cancelar'\}/.test(app);
    const winter = /onLivery\?: \(\) => void/.test(src('src/components/WinterScreen.tsx'));
    assert(calls.sort().join() === 'new,winter' && skip && winter, 'TL5: el editor solo se abre al crear la carrera (con «Saltar») y desde el invierno', `aperturas ${calls.join(', ')} | saltar ${skip} | invierno ${winter}`);
  });

  await test('TL5.7: aviso de colores casi iguales y rótulos legibles', () => {
    const near = L.liveryWarnings(sample('flecha', ['#ff0000', '#fe0202', '#ffffff'])).length > 0;
    const far = L.liveryWarnings(sample('flecha', ['#ff0000', '#000000', '#ffffff'])).length === 0;
    const paint = src('src/renderer/liveryPaint.ts');
    const ink = /draw\(ctx, w, h, luminance\(under\) < 0\.45\)/.test(paint) && /luminance\(under\) < 0\.45 \? '#ffffff' : '#141414'/.test(paint);
    const shown = /liveryWarnings\(draft\)/.test(src('src/components/LiveryEditor.tsx'));
    assert(near && far && ink && shown, 'TL5: el editor avisa si dos colores casi no se distinguen y cada rótulo va en claro u oscuro según lo que tiene debajo', `cerca ${near} | lejos ${far} | tinta ${ink} | aviso ${shown}`);
  });

  await test('TL5.8: capturas de cada plantilla con dos juegos de colores y del editor', () => {
    const dir = 'docs/design/tl5-capturas';
    const need = [...L.LIVERY_TEMPLATES.flatMap((_, i) => [1, 2].map(k => `plantilla-${i + 1}-colores-${k}.png`)), 'editor-escritorio.png', 'editor-movil.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'TL5: capturas de las plantillas (dos juegos de colores) y del editor en escritorio y móvil', missing.join(', '));
  });
}
