// T4.16 — Audio (Sprint 4).
// Contrato del 13/10/2026 (el usuario pidió terminar el Sprint 4 de seguido asumiendo la opción recomendada).
// Decisión del usuario del 09/10/2026: grabaciones con licencia libre, no sonidos sintetizados. Descargar grabaciones
// necesita su permiso expreso, archivo a archivo, y aún no lo hay: el motor queda completo y cada sonido lleva un tono
// PROVISIONAL sintetizado hasta que se elija su grabación (asunción; la escucha real es revisión del usuario).
//  1. Mapa de evento a sonido: semáforo, salida, radio, banderas y Safety Car, pistola de boxes y bandera a cuadros.
//  2. Ciclo de vida con un contexto de audio simulado: sin interacción no suena nada; apagado no se crea el contexto
//     ni se descarga nada; en pausa calla; al liberar, se cierra el contexto.
//  3. Carga bajo demanda: una grabación se pide la primera vez que suena, y una sola vez.
//  4. Atribución: toda grabación lleva autor, licencia y origen, y los créditos se enseñan en el juego.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const sounds = await server.ssrLoadModule('/src/audio/sounds.ts');
  const { AudioEngine, AUDIO_LEVELS, AUDIO_LEVEL_LABEL, parseAudioLevel } = await server.ssrLoadModule('/src/audio/AudioEngine.ts');

  const fakeContext = () => {
    const log = { oscillators: 0, sources: 0, decoded: 0, suspended: 0, resumed: 0, closed: 0 };
    const param = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} };
    const context = {
      currentTime: 0, state: 'running', destination: {},
      createGain: () => ({ gain: { ...param }, connect() {} }),
      createOscillator: () => { log.oscillators++; return { type: 'sine', frequency: { ...param }, connect() {}, start() {}, stop() {} }; },
      createBufferSource: () => { log.sources++; return { buffer: null, connect() {}, start() {} }; },
      decodeAudioData: async () => { log.decoded++; return { samples: 1 }; },
      suspend: async () => { log.suspended++; }, resume: async () => { log.resumed++; }, close: async () => { log.closed++; },
    };
    return { context, log };
  };
  const base = { lightState: 'racing', flag: 'green', finished: false, wallMessages: 0, servicing: 0 };

  await test('T4.16: mapa de evento a sonido', () => {
    const between = (a, b) => sounds.soundsBetween({ ...base, ...a }, { ...base, ...b }).join();
    assert(sounds.soundsBetween(null, base).length === 0 && between({}, {}) === '', 'T4.16: sin cambios (o en la primera lectura) no suena nada');
    assert(between({ lightState: 'grid-ready' }, { lightState: 'lights-1' }) === 'semaforo' && between({ lightState: 'lights-4' }, { lightState: 'lights-5' }) === 'semaforo'
      && between({ lightState: 'lights-5' }, { lightState: 'lights-out' }) === 'salida' && between({ lightState: 'lights-out' }, { lightState: 'racing' }) === '', 'T4.16: cada luz del semáforo y la salida, una sola vez');
    assert(between({}, { flag: 'yellow' }) === 'bandera-amarilla' && between({}, { flag: 'sc' }) === 'safety-car' && between({}, { flag: 'vsc' }) === 'safety-car' && between({}, { flag: 'red' }) === 'bandera-roja'
      && between({ flag: 'sc' }, { flag: 'green' }) === 'bandera-verde', 'T4.16: banderas, Safety Car y relanzamiento');
    assert(between({}, { wallMessages: 1 }) === 'radio' && between({ wallMessages: 2 }, { wallMessages: 1 }) === '' && between({}, { servicing: 1 }) === 'pistola' && between({}, { finished: true }) === 'meta',
      'T4.16: radio al llegar una propuesta del muro, pistola al empezar el servicio y bandera a cuadros');
    assert(sounds.SOUND_IDS.every(id => sounds.SOUNDS[id] && sounds.SOUNDS[id].provisional.notes.length > 0) && Object.keys(sounds.SOUNDS).length === sounds.SOUND_IDS.length, 'T4.16: cada sonido del mapa está definido');
  });

  await test('T4.16: ciclo de vida', async () => {
    const fake = fakeContext();
    let created = 0, loaded = 0;
    const engine = new AudioEngine(() => { created++; return fake.context; }, async () => { loaded++; return new ArrayBuffer(8); });
    assert(engine.play('radio') === false && created === 0, 'T4.16: apagado (el estado inicial) no suena ni crea el contexto de audio');
    engine.setVolume(0.5);
    assert(engine.play('radio') === false && created === 0, 'T4.16: encendido pero sin interacción previa del jugador, tampoco');
    engine.unlock();
    assert(engine.play('radio') === true && created === 1 && fake.log.oscillators === sounds.SOUNDS.radio.provisional.notes.length && loaded === 0, 'T4.16: tras la primera interacción suena, y sin grabación no se descarga nada');
    engine.play('meta');
    assert(created === 1, 'T4.16: el contexto se crea una sola vez');
    engine.setPaused(true);
    const before = fake.log.oscillators;
    assert(engine.play('radio') === false && fake.log.oscillators === before && fake.log.suspended === 1, 'T4.16: con la carrera en pausa o la página oculta calla');
    engine.setPaused(false);
    assert(engine.play('radio') === true && fake.log.resumed === 1, 'T4.16: y vuelve al reanudar');
    engine.dispose();
    assert(fake.log.closed === 1 && engine.hasContext === false, 'T4.16: al salir de la carrera se cierra el contexto');
    const other = fakeContext();
    const off = new AudioEngine(() => other.context);
    off.unlock(); off.setVolume(1); off.play('radio'); off.setVolume(0);
    assert(other.log.closed === 1 && off.play('radio') === false && off.enabled === false, 'T4.16: apagar el audio libera el contexto y deja de sonar');
    assert(new AudioEngine(() => null).play('radio') === false, 'T4.16: en un navegador sin audio no falla');
    assert(AUDIO_LEVELS[0] === 0 && parseAudioLevel(null) === 0 && parseAudioLevel('2') === 2 && parseAudioLevel('9') === 0 && AUDIO_LEVEL_LABEL.length === AUDIO_LEVELS.length, 'T4.16: el nivel guardado se lee con cuidado y por defecto está apagado');
  });

  await test('T4.16: carga bajo demanda', async () => {
    const original = { ...sounds.SOUNDS.radio };
    Object.assign(sounds.SOUNDS.radio, { file: 'radio.ogg', author: 'Autora de prueba', license: 'CC0 1.0', source: 'https://example.org/radio' });
    try {
      const fake = fakeContext();
      const urls = [];
      const engine = new AudioEngine(() => fake.context, async url => { urls.push(url); return new ArrayBuffer(8); }, '/F1Sim/');
      engine.unlock(); engine.setVolume(1);
      assert(urls.length === 0, 'T4.16: antes de sonar no se pide ninguna grabación');
      engine.play('radio'); engine.play('radio');
      await new Promise(resolve => setTimeout(resolve, 10));
      assert(urls.join() === '/F1Sim/audio/radio.ogg' && fake.log.decoded === 1 && fake.log.sources === 2 && fake.log.oscillators === 0, 'T4.16: la grabación se pide la primera vez que suena, una sola vez, y suena ella (no el tono provisional)', urls.join());
      const failing = fakeContext();
      const broken = new AudioEngine(() => failing.context, async () => { throw new Error('sin red'); });
      broken.unlock(); broken.setVolume(1); broken.play('radio');
      await new Promise(resolve => setTimeout(resolve, 10));
      assert(failing.log.oscillators > 0, 'T4.16: si la grabación no carga, suena el tono provisional');
      assert(/Autora de prueba · CC0 1\.0 · https:\/\/example\.org\/radio/.test(sounds.soundCredits().find(credit => credit.id === 'radio').text), 'T4.16: los créditos enseñan autor, licencia y origen de la grabación');
    } finally { Object.assign(sounds.SOUNDS.radio, original); }
  });

  await test('T4.16: atribución e interfaz', async () => {
    for (const id of sounds.SOUND_IDS) {
      const spec = sounds.SOUNDS[id];
      if (spec.file) assert(Boolean(spec.author && spec.license && spec.source) && existsSync(new URL(`../../public/audio/${spec.file}`, import.meta.url)), `T4.16: la grabación de «${spec.label}» tiene autor, licencia, origen y archivo`);
    }
    const credits = sounds.soundCredits();
    assert(credits.length === sounds.SOUND_IDS.length && credits.every(credit => credit.text.length > 10) && sounds.SOUND_IDS.filter(id => !sounds.SOUNDS[id].file).every(id => /provisional/i.test(credits.find(c => c.id === id).text)),
      'T4.16: cada sonido tiene su línea de créditos; los que aún no tienen grabación lo dicen');
    const { RaceMenu } = await server.ssrLoadModule('/src/components/RaceMenu.tsx');
    const html = renderToStaticMarkup(createElement(RaceMenu, { safetyCarDeployed: false, onToggleSafetyCarTest() {}, onRedFlagTest() {}, defaultOpen: true,
      audio: { level: 1, labels: AUDIO_LEVEL_LABEL, onLevel() {}, credits } }));
    assert(AUDIO_LEVEL_LABEL.every(label => html.includes(label)) && (html.match(/role="menuitemradio"/g) ?? []).length === 3 && /aria-checked="true"[^>]*>Sonido bajo/.test(html) && /Créditos de los sonidos/.test(html) && /Bandera a cuadros/.test(html),
      'T4.16: el menú de carrera tiene el volumen (apagado, bajo, alto) y los créditos de los sonidos');
    const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
    assert(/audio\.unlock\(\)/.test(app) && /audio\.setPaused\(document\.hidden \|\| isPaused \|\| currentView !== 'race'\)/.test(app) && /audio\.dispose\(\)/.test(app) && /soundsBetween\(audioSeen\.current, heard\)/.test(app),
      'T4.16: la aplicación desbloquea el audio con la primera interacción, lo calla en pausa o con la página oculta y lo libera al salir');
  });
}
