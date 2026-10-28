// UX15 — Voz de los pilotos más natural (Piper o Kokoro) y motor grabado (Sprint 7). Contrato acordado con el usuario el
// 26/10/2026; módulo escrito al empezar la tarea (28/10/2026), con el permiso del usuario para bajar Kokoro.
//  1. Página de prueba (modo desarrollador) con 12 frases del banco dichas por Piper y por Kokoro, en orden al azar y sin
//     decir cuál es cuál, con el mismo efecto de radio; el usuario marca la que prefiere en cada una y el resultado se
//     guarda.
//  2. Si gana Kokoro: se descarga en Ajustes como Piper (tamaño, versión, barra, continuar y borrar, UX4), cada piloto
//     tiene su voz (los compañeros, con tono y velocidad distintos) y, sin WebGPU o sin descargar, se vuelve a Piper o a
//     la voz del sistema. [28/10/2026: se comprueba ya que cada piloto tiene su voz; la descarga y el respaldo se
//     añaden aquí si gana Kokoro en la prueba del usuario.]
//  3. Motor grabado: un bucle CC0 con su atribución, de 300 KB como mucho, cuya velocidad sigue las revoluciones, por la
//     banda de la radio y solo con la radio abierta (UX13). [Pendiente del permiso del usuario para bajar la grabación.]
//  4. Nada de esto se carga al arrancar el juego (import()) y cabe en el presupuesto de PF8.
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const blind = await load('/src/dev/blindVoiceTest.ts');
  const kokoro = await load('/src/radio/voice/kokoroVoice.ts');
  const { DRIVERS } = await load('/src/data/drivers.ts');
  const read = p => readFileSync(p, 'utf8');
  const bank = Object.fromEntries(['frio', 'competitivo', 'quejica', 'bromista'].map(t => [t, JSON.parse(read(`src/radio/replies/bank/${t}.json`))]));

  await test('UX15: prueba a ciegas', () => {
    const trials = blind.blindTrials(bank, Object.keys(DRIVERS), 7);
    assert(trials.length === 12 && blind.BLIND_PHRASES === 12, 'UX15: 12 frases', String(trials.length));
    const all = new Set(Object.values(bank).flatMap(k => Object.values(k).flat()).map(blind.fillSlots));
    assert(trials.every(t => all.has(t.text) && !/\{\w+\}/.test(t.text)), 'UX15: las frases salen del banco, con los huecos rellenos');
    assert(new Set(trials.map(t => t.text)).size === 12, 'UX15: doce frases distintas');
    assert(trials.every(t => t.order.length === 2 && new Set(t.order).size === 2 && t.order.includes('piper') && t.order.includes('kokoro')), 'UX15: cada frase, con las dos voces');
    const many = Array.from({ length: 20 }, (_, i) => blind.blindTrials(bank, Object.keys(DRIVERS), 100 + i)).flat();
    const first = many.filter(t => t.order[0] === 'kokoro').length / many.length;
    assert(first > 0.3 && first < 0.7, 'UX15: el orden de las voces va al azar', first.toFixed(2));
    const page = read('src/dev/VoiceBlindTest.tsx');
    assert(!/\bPiper\b[^<]*<\/button>|\bKokoro\b[^<]*<\/button>/.test(page) && /Escuchar A/.test(page) && /Escuchar B/.test(page), 'UX15: los botones dicen A y B, no qué voz es');
    assert((page.match(/createPiperSpeaker\(/g) ?? []).length === 1 && /make\(piper\)/.test(page) && /make\(text => kokoro/.test(page), 'UX15: las dos voces pasan por el mismo altavoz de radio (filtro, chasquidos y motor)');
    const store = new Map(); const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const result = blind.scoreBlind([...trials.slice(0, 7).map(t => ({ text: t.text, pick: 'kokoro' })), ...trials.slice(7, 10).map(t => ({ text: t.text, pick: 'piper' })), ...trials.slice(10).map(t => ({ text: t.text, pick: 'igual' }))]);
    blind.saveBlindResult(storage, result);
    const back = blind.readBlindResult(storage);
    assert(back && back.kokoro === 7 && back.piper === 3 && back.igual === 2 && back.winner === 'kokoro', 'UX15: el resultado se cuenta y se guarda', JSON.stringify(back));
    assert(blind.scoreBlind([{ text: 'a', pick: 'piper' }, { text: 'b', pick: 'kokoro' }]).winner === 'empate', 'UX15: con los mismos votos, empate');
    const main = read('src/main.tsx');
    assert(/voces: \(\) => import\('\.\/dev\/VoiceBlindTest'\)/.test(main) && /devToolsAllowed\(/.test(main), 'UX15: la página es una revisión (`?revision=voces`), solo en desarrollo o con el modo desarrollador');
  });

  await test('UX15: cada piloto con su voz Kokoro', () => {
    const teams = {};
    for (const [id, d] of Object.entries(DRIVERS)) (teams[d.teamId] ??= []).push(id);
    const pairs = Object.values(teams).filter(p => p.length === 2);
    assert(pairs.length > 0 && pairs.every(([a, b]) => kokoro.kokoroVoiceFor(a).voice !== kokoro.kokoroVoiceFor(b).voice), 'UX15: los compañeros de equipo suenan con voces distintas');
    assert(Object.keys(DRIVERS).every(id => kokoro.KOKORO_MALE_VOICES.includes(kokoro.kokoroVoiceFor(id).voice)), 'UX15: todos con voz masculina en español');
    assert(Object.keys(DRIVERS).every(id => { const s = kokoro.kokoroVoiceFor(id).speed; return s > 0.85 && s < 1.15; }), 'UX15: cada uno con su velocidad, sin pasarse');
    const style = kokoro.styleSlice(Float32Array.from({ length: 256 * 520 }, (_, i) => i), 12);
    assert(style.length === 256 && style[0] === 256 * 10, 'UX15: el estilo de la voz se toma según la longitud de la frase');
  });

  await test('UX15: nada al arrancar', () => {
    const k = read('src/radio/voice/kokoroVoice.ts');
    assert(!/^import [^;]*from '@huggingface\/transformers'/m.test(k) && /import\('@huggingface\/transformers'\)/.test(k), 'UX15: transformers.js llega con import()');
    for (const file of ['src/App.tsx', 'src/main.tsx', 'src/radio/voice/runtime.ts', 'src/radio/voice/piperRuntime.ts']) {
      assert(!/from '\.{1,2}\/[^']*kokoroVoice'|from '\.{1,2}\/[^']*VoiceBlindTest'/.test(read(file)), `UX15: ${file} no carga Kokoro ni la prueba al arrancar`);
    }
    const p = read('src/radio/voice/piperVoice.ts');
    assert(!/^import [^;]*from '@diffusionstudio/m.test(p), 'UX15: espeak (piper-wasm) sigue llegando con import()');
  });
}
