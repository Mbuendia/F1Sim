// UX15 — Voz de los pilotos más natural (Piper o Kokoro) y motor grabado (Sprint 7). Contrato acordado con el usuario el
// 26/10/2026; módulo escrito al empezar la tarea (28/10/2026), con el permiso del usuario para bajar Kokoro.
//  1. Página de prueba (modo desarrollador) con 12 frases del banco dichas por Piper y por Kokoro, en orden al azar y sin
//     decir cuál es cuál, con el mismo efecto de radio; el usuario marca la que prefiere en cada una y el resultado se
//     guarda.
//  2. Si gana Kokoro: se descarga en Ajustes como Piper (tamaño, versión, barra, continuar y borrar, UX4), cada piloto
//     tiene su voz (los compañeros, con tono y velocidad distintos) y, sin WebGPU o sin descargar, se vuelve a Piper o a
//     la voz del sistema. [28/10/2026: el usuario elige Kokoro; se comprueban la descarga, la voz de cada piloto y el
//     respaldo.]
//  3. Motor grabado: un bucle CC0 con su atribución, de 300 KB como mucho, cuya velocidad sigue las revoluciones, por la
//     banda de la radio y solo con la radio abierta (UX13). [28/10/2026: sin grabación CC0 que suene a F1, el usuario
//     elige una grabación a bordo suya (con estática mezclada) para el motor y el pitido de radio de Pixabay para abrir;
//     se comprueba con su autoría y licencia en lugar de CC0. Si no cargan, sigue lo sintético.]
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

  await test('UX15: Kokoro, la voz realista, con respaldo', () => {
    const c = kokoro.chooseRealisticVoice;
    assert(c({ webgpu: true, kokoroReady: true, piperReady: true }) === 'kokoro' && c({ webgpu: true, kokoroReady: true, piperReady: false }) === 'kokoro', 'UX15: con WebGPU y descargada, suena Kokoro');
    assert(c({ webgpu: false, kokoroReady: true, piperReady: true }) === 'piper' && c({ webgpu: true, kokoroReady: false, piperReady: true }) === 'piper', 'UX15: sin WebGPU o sin descargar, vuelve a Piper');
    assert(c({ webgpu: false, kokoroReady: true, piperReady: false }) === null && c({ webgpu: true, kokoroReady: false, piperReady: false }) === null, 'UX15: sin ninguna, queda la voz del sistema');
    const runtime = read('src/radio/voice/piperRuntime.ts');
    assert(/chooseRealisticVoice\(/.test(runtime) && /\['kokoro', 'piper'\]/.test(runtime) && /systemVoiceAvailable\(\) \? 'sistema' : 'texto'/.test(runtime), 'UX15: si Kokoro falla al cargar, Piper; si tampoco, la del sistema');
    assert(/import\('\.\/kokoroVoice'\)/.test(runtime) && !/from '\.\/kokoroVoice'/.test(runtime), 'UX15: Kokoro llega a la carrera con import()');
  });

  await test('UX15: descarga en Ajustes', async () => {
    // Caché y red falsas: cada archivo de 1.000 bytes en trozos de 250.
    const store = new Map(); let fetches = 0;
    const caches = { open: async () => ({ match: async k => store.get(k), put: async (k, r) => { store.set(k, r); }, delete: async k => store.delete(k) }) };
    const fetch = async (url, init) => {
      fetches++;
      if (init?.signal?.aborted) throw new Error('aborted');
      const chunks = [0, 1, 2, 3].map(() => new Uint8Array(250));
      return new Response(new ReadableStream({ pull(ctl) { const ch = chunks.shift(); if (init?.signal?.aborted) ctl.error(new Error('aborted')); else if (ch) ctl.enqueue(ch); else ctl.close(); } }));
    };
    const s = kokoro.createKokoroStore({ fetch, caches });
    assert(!(await s.has()), 'UX15: al principio no está');
    const seen = [];
    await s.download((loaded, total) => seen.push([loaded, total]), new AbortController().signal);
    assert(await s.has() && seen.at(-1)[0] === seen.at(-1)[1] && seen.some(([l]) => l > 0 && l < kokoro.KOKORO_VOICE.bytes), 'UX15: baja con barra de progreso hasta el final');
    assert(kokoro.KOKORO_FILES.every(f => store.has(kokoro.kokoroUrl(f))), 'UX15: guarda cada archivo donde lo busca transformers.js', [...store.keys()].join(', '));
    assert(kokoro.KOKORO_FILES.includes('onnx/model.onnx') && kokoro.KOKORO_FILES.includes('voices/em_alex.bin') && kokoro.KOKORO_FILES.includes('voices/em_santa.bin'), 'UX15: el modelo completo y las dos voces');
    // Continuar: lo que ya está no se vuelve a bajar.
    store.delete(kokoro.kokoroUrl('voices/em_santa.bin')); fetches = 0;
    await s.download(() => {}, new AbortController().signal);
    assert(fetches === 1 && await s.has(), 'UX15: al continuar, solo baja lo que falta', String(fetches));
    await s.remove();
    assert(!(await s.has()) && store.size === 0, 'UX15: borrar la quita del navegador');
    const ac = new AbortController(); ac.abort();
    let code = null; try { await s.download(() => {}, ac.signal); } catch (e) { code = e.code; }
    assert(code === 'cancelada', 'UX15: se puede cancelar', String(code));
    assert(kokoro.KOKORO_VOICE.bytes > 300e6 && kokoro.KOKORO_VOICE.bytes < 400e6 && kokoro.KOKORO_VOICE.device === 'webgpu' && kokoro.KOKORO_VOICE.dtype === 'fp32', 'UX15: tamaño anunciado del modelo completo para WebGPU (≈ 345 MB)');
  });

  await test('UX15: Ajustes, con y sin WebGPU', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const RadioSettings = (await load('/src/components/RadioSettings.tsx')).default;
    const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
    const fake = () => createFakeModelStore({ totalBytes: 1000, chunkBytes: 100 });
    const props = webgpu => ({ device: { kind: 'completo' }, initialMode: 'basica', store: fake(), voiceStore: fake(), kokoroStore: fake(), whisperStore: fake(), remember: false, webgpu, estimate: async () => ({ quota: 8e9, usage: 0 }) });
    const withGpu = renderToStaticMarkup(createElement(RadioSettings, props(true)));
    const mb = n => String(Math.round(n / 1024 / 1024));
    assert(/Voz de radio realista/.test(withGpu) && withGpu.includes(mb(kokoro.KOKORO_VOICE.bytes)) && /Kokoro/.test(withGpu), 'UX15: con WebGPU, la voz realista es Kokoro, con su tamaño y su crédito');
    const noGpu = renderToStaticMarkup(createElement(RadioSettings, props(false)));
    assert(/no tiene WebGPU/.test(noGpu) && /Piper|sharvard/.test(noGpu) && !/Kokoro-82M/.test(noGpu), 'UX15: sin WebGPU, lo dice y ofrece Piper');
    const settings = read('src/components/RadioSettings.tsx');
    assert(/"voz-kokoro"/.test(settings), 'UX15: una sola descarga de Kokoro en toda la página (como Piper, UX4)');
  });

  await test('UX15: motor y pitido grabados', async () => {
    const R = await load('/src/radio/voice/radioFilter.ts');
    const L = await load('/src/radio/voice/radioRecordings.ts');
    const { statSync, existsSync } = await import('node:fs');
    for (const k of ['cue', 'engine']) {
      const spec = L.RADIO_RECORDINGS[k], file = `public/${spec.file}`;
      assert(existsSync(file) && statSync(file).size <= 300 * 1024, `UX15: «${spec.label}» existe y pesa 300 KB como mucho`, file);
      assert(spec.author && spec.license && spec.source && spec.note, `UX15: «${spec.label}» lleva autor, licencia y origen`);
      const wav = readFileSync(file);
      const parsed = R.parseWav16(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.length));
      assert(parsed.samples.length > parsed.sampleRate * 0.5 && parsed.sampleRate >= 16000, `UX15: «${spec.label}» se lee`, `${parsed.samples.length} muestras a ${parsed.sampleRate} Hz`);
    }
    assert(L.radioRecordingCredits().length === 2 && /radioRecordingCredits\(\)/.test(read('src/components/RadioSettings.tsx')), 'UX15: los créditos se ven en Ajustes');
    // Cadena con grabaciones y un contexto falso.
    const sources = [], links = [];
    const ctx = { currentTime: 1, sampleRate: 48000, destination: { kind: 'dest' } };
    const param = v => { const p = { value: v }; p.setValueAtTime = x => { p.value = x; }; p.linearRampToValueAtTime = x => { p.value = x; }; p.cancelScheduledValues = () => {}; return p; };
    const node = (kind, extra) => { const n = { kind, ...extra, connect(to) { links.push([n, to]); return to; }, disconnect() {} }; return n; };
    Object.assign(ctx, {
      createGain: () => node('gain', { gain: param(1) }), createBiquadFilter: () => node('biquad', { type: '', frequency: param(0), Q: param(1) }),
      createWaveShaper: () => node('shaper', { curve: null, oversample: 'none' }),
      createBuffer: (ch, length, rate) => { const d = new Float32Array(length); return { length, sampleRate: rate, getChannelData: () => d }; },
      createBufferSource: () => { const s = node('source', { buffer: null, loop: false, playbackRate: param(1), startedAt: null, stoppedAt: null }); s.start = () => { s.startedAt = ctx.currentTime; }; s.stop = w => { s.stoppedAt = w ?? ctx.currentTime; }; sources.push(s); return s; },
    });
    const rec = { cue: { samples: new Float32Array(4800).fill(0.1), sampleRate: 48000 }, engine: { samples: new Float32Array(24000).fill(0.05), sampleRate: 24000 } };
    const chain = R.buildRadioChain(ctx, ctx.destination, rec);
    const running = () => sources.filter(s => s.loop && s.engine && s.startedAt !== null && s.stoppedAt === null);
    assert(running().length === 0, 'UX15: sin abrir la radio, el motor no suena');
    chain.setEngine({ rpm: R.ENGINE_REF_RPM, moving: true }); chain.open();
    const eng = running()[0];
    assert(eng && eng.buffer.length === 24000, 'UX15: con la radio abierta suena el motor grabado');
    const natural = eng.playbackRate.value * eng.buffer.sampleRate / rec.engine.sampleRate;
    assert(Math.abs(natural - 1) < 1e-6 && Math.abs(eng.playbackRate.value * R.ENGINE_BASE_HZ - R.engineFrequency(R.ENGINE_REF_RPM)) < 1, 'UX15: a las revoluciones de referencia suena a su velocidad natural', natural.toFixed(3));
    chain.setEngine({ rpm: 12500, moving: true });
    assert(eng.playbackRate.value * eng.buffer.sampleRate / rec.engine.sampleRate > 1, 'UX15: con más revoluciones, más agudo');
    const reach = (from, seen = new Set()) => { if (!from || seen.has(from)) return false; if (from.kind === 'biquad') return true; seen.add(from); return links.filter(([a]) => a === from).some(([, b]) => reach(b, seen)); };
    assert(reach(eng), 'UX15: el motor grabado pasa por la banda de la radio');
    const shots = sources.filter(s => !s.loop && s.startedAt !== null);
    assert(shots.some(s => s.buffer.length === 4800), 'UX15: al abrir suena el pitido grabado');
    chain.close();
    assert(running().length === 0, 'UX15: al cerrar la radio, el motor se para (UX13)');
    // Sin grabaciones, lo sintético de siempre.
    let none = null;
    const before = R.radioRecordings();
    const got = await L.loadRadioRecordings('/', async () => { throw new Error('sin red'); });
    none = got;
    assert(none && !none.cue && !none.engine, 'UX15: si las grabaciones no llegan, la radio sigue con lo sintético', JSON.stringify(before));
    const quiet = L.withRms(Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i)), L.ENGINE_RECORDING_RMS);
    const rms = Math.sqrt(quiet.reduce((a, v) => a + v * v, 0) / quiet.length);
    assert(Math.abs(rms - L.ENGINE_RECORDING_RMS) < 1e-6, 'UX15: la grabación del motor se deja a su volumen medio (15–20 dB por debajo de la voz)');
    assert(/import\('\.\/radioRecordings'\)/.test(read('src/radio/voice/piperRuntime.ts')), 'UX15: las grabaciones se cargan con la voz realista, con import()');
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
