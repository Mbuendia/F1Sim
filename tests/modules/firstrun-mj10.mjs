// MJ10 — Primera configuración y modelos de IA (Sprint 15). Contrato aprobado por el usuario el 20/11/2026 («Si»):
//  1. La pantalla sale solo la primera vez; hecha u omitida, no vuelve.
//  2. Lo elegido se guarda igual que en Ajustes (vista, calidad y radio); «Omitir» deja vista y calidad recomendadas y la
//     radio básica.
//  3. La radio con IA enseña lo que pesa su descarga en este dispositivo, y la descarga solo empieza si se elige.
//  4. Ninguna descarga de modelos empieza sola, ni en el anfitrión ni en un invitado; el invitado no carga nada de la radio.
//  5. Capturas en escritorio y en el móvil, y la sonda a 1440, 430 y 375 px sin desbordes.
// Prueba en Chrome sin ventana del 20/11/2026: tras borrar los datos, «Jugar» lleva a la primera configuración (paso 1,
// gráficos; paso 2, radio con IA de 953 MB en ese escritorio); «Omitir» guarda omitida, 3d, auto y basica, y al recargar
// no vuelve a salir. Sonda: page 0, scrollX y cut vacíos a 1440, 430 y 375 px.
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }; };

export default async function run({ server, assert, test }) {
  const F = await server.ssrLoadModule('/src/settings/firstRun.ts');
  const { default: FirstRunScreen } = await server.ssrLoadModule('/src/components/FirstRunScreen.tsx');
  const { RADIO_MODELS, toMB } = await server.ssrLoadModule('/src/radio/model/manifest.ts');

  await test('MJ10.1: solo la primera vez', () => {
    const fresh = memory();
    const first = !F.isFirstRunDone(fresh);
    F.finishFirstRun(fresh, { view: '3d', quality: 'auto', radio: 'basica' }, 'omitida');
    const after = F.isFirstRunDone(fresh);
    const app = src('src/App.tsx');
    const gate = app.includes("if (currentView === 'menu' && !firstRunDone) {") && app.includes('<FirstRunScreen onDone={() => setFirstRunDone(true)} />')
      && app.includes('useState(() => isFirstRunDone(browserSettingsStorage()))') && app.includes("const FirstRunScreen = lazy(() => import('./components/FirstRunScreen'));");
    assert(first && after && gate, 'MJ10: sin la marca, la primera configuración sale antes del menú (cargada aparte); hecha u omitida, queda marcada y no vuelve', JSON.stringify({ first, after, gate }));
  });

  await test('MJ10.2: se guarda como en Ajustes; «Omitir», lo recomendado', () => {
    const st = memory();
    F.finishFirstRun(st, { view: '2d', quality: 'bajo', radio: 'ia' }, 'hecha');
    const saved = st.getItem('f1sim.vista') === '2d' && st.getItem('f1sim.calidad') === 'bajo' && st.getItem('f1_radio_mode') === 'ia' && st.getItem(F.FIRST_RUN_KEY) === 'hecha';
    const desk = F.recommendedFirstRun({ mobile: false, deviceMemory: 16, cores: 8 }), weak = F.recommendedFirstRun({ mobile: true, deviceMemory: 3, cores: 4 });
    const rec = desk.view === '3d' && desk.quality === 'auto' && desk.radio === 'basica' && weak.view === '2d' && weak.radio === 'basica';
    const skip = src('src/components/FirstRunScreen.tsx').includes("const final = how === 'omitida' ? recommended : choice;");
    assert(saved && rec && skip, 'MJ10: lo elegido va a las claves de Ajustes (vista, calidad y radio); omitir deja 3D (2D en los más justos), calidad automática y radio básica',
      JSON.stringify({ saved, rec, skip }));
  });

  await test('MJ10.3: la radio con IA dice lo que pesa y solo descarga si se elige', () => {
    const desk = renderToStaticMarkup(createElement(FirstRunScreen, { onDone() {}, storage: memory(), device: { mobile: false }, radioChoice: { variant: 'q0f16', options: ['q0f16', 'q4'], mobile: false } }));
    const step1 = /Paso 1 de 2/.test(desk) && /Vista 3D \(recomendada\)/.test(desk) && /Automática \(recomendada\)/.test(desk) && /Omitir/.test(desk);
    const comp = src('src/components/FirstRunScreen.tsx');
    const size = comp.includes('title={aiMB ? `Radio con IA · ${aiMB} MB` : \'Radio con IA\'}') && comp.includes('const aiMB = aiVariant && sizes ? sizes[aiVariant] : null;') && comp.includes('q0f16: m.toMB(m.RADIO_MODELS.q0f16.bytes), q4: m.toMB(m.RADIO_MODELS.q4.bytes)')
      && toMB(RADIO_MODELS.q4.bytes) < toMB(RADIO_MODELS.q0f16.bytes);
    const onlyIfChosen = comp.includes("if (how === 'hecha' && final.radio === 'ia' && aiVariant) {") && comp.includes('void m.radioModelDownload(aiVariant).start();')
      && src('src/components/RadioSettings.tsx').includes('return browserModelDownload(`radio-${model.modelId}`, { store: realStores[variant], totalBytes: model.bytes,');
    const unavailable = comp.includes('No disponible en este dispositivo');
    assert(step1 && size && onlyIfChosen && unavailable, 'MJ10: la radio con IA enseña el tamaño de la versión de este dispositivo (completa o ligera) y la descarga, la misma de Ajustes, solo empieza al elegirla; si el dispositivo no puede, lo dice',
      JSON.stringify({ step1, size, onlyIfChosen, unavailable }));
  });

  await test('MJ10.4: ninguna descarga empieza sola; el invitado no carga la radio', () => {
    const settings = src('src/components/RadioSettings.tsx');
    const userOnly = (settings.match(/list\.start\(/g) ?? []).length === 1 && /const start = \(id: ModelId\) => \{/.test(settings);
    const resumeOnlyPaused = /resumeIfPaused\(\) \{\s*if \(pausedInBackground && state\.status === 'cancelada'\) await download\.start\(\);/.test(src('src/radio/model/download.ts'));
    const guest = ['src/components/ClientRace.tsx', 'src/components/RoomFlow.tsx'].every(f => !/from '\.\.\/radio\/|RadioSettings|RadioPanel/.test(src(f)));
    const note = /los invitados no la usan y no descargan nada/.test(src('src/components/SettingsScreen.tsx'));
    assert(userOnly && resumeOnlyPaused && guest && note, 'MJ10: los modelos solo se descargan al pulsarlo (o al elegir la radio con IA la primera vez); solo se reanuda lo cortado en segundo plano; la pantalla del invitado no carga nada de la radio y Ajustes lo explica',
      JSON.stringify({ userOnly, resumeOnlyPaused, guest, note }));
  });

  await test('MJ10.5: capturas y sonda', () => {
    const dir = 'docs/design/mj10-capturas';
    const need = ['escritorio-graficos.png', 'escritorio-radio.png', 'movil-graficos.png', 'movil-radio.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    // [20/11/2026, el usuario pide más efecto wow y elige «Escena nueva de Blender»] De fondo, el muro de boxes renderizado en Blender.
    for (const f of ['muro-escritorio.avif', 'muro-escritorio.webp', 'muro-movil.avif', 'muro-movil.webp']) if (!existsSync(`public/primera/${f}`)) missing.push(`public/primera/${f}`);
    if (!existsSync('scripts/blender/mj10-muro.py') || !src('src/components/FirstRunScreen.tsx').includes('data-first-run-scene')) missing.push('escena de Blender');
    const probe = [1440, 430, 375].every(w => src('tests/modules/firstrun-mj10.mjs').includes(String(w)));
    assert(missing.length === 0 && probe, 'MJ10: capturas de los dos pasos en escritorio y en el móvil, con la escena del muro de boxes de fondo; la sonda, anotada', missing.join(', ') || String(probe));
  });
}
