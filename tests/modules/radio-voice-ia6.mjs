// IA6 — Voces Piper y órdenes por micro (Sprint 6).
// Contrato aprobado por el usuario el 23/10/2026 (ficha de IA6 en DASHBOARD.md), con la voz es_ES-sharvard-medium,
// @diffusionstudio/vits-web para descargarla y un ejecutor propio (opción B: las dos voces del modelo y velocidad por
// piloto, con @diffusionstudio/piper-wasm para los fonemas). Todo con sustitutos, sin descargar nada:
//  1. Elección de voz: Piper si está descargado y hay sonido; si no, la del sistema; si no, solo texto.
//  2. Ajustes de voz por piloto estables y distintos entre compañeros de equipo (todos con la voz masculina: petición
//     del usuario del 23/10/2026).
//  3. Cadena del filtro con los nodos y frecuencias acordados (contexto de audio simulado, como en audio-t416).
//  4. Elección de reconocimiento: Web Speech con red, Whisper sin red si está descargado, botón oculto si no hay ninguno.
//  5. Soltar envía el texto reconocido por el mismo camino de IA1; un reconocimiento vacío no envía nada.
//  6. Ni Piper ni Whisper se importan al arrancar el juego.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { chooseVoiceEngine, pilotVoice, PIPER_VOICE, createPiperSpeaker } = await load('/src/radio/voice/piperVoice.ts');
  const { RADIO_FILTER, buildRadioChain } = await load('/src/radio/voice/radioFilter.ts');
  const { chooseStt, createPushToTalk, WHISPER_MODEL } = await load('/src/radio/stt/sttChooser.ts');
  const { DRIVERS } = await load('/src/data/drivers.ts');

  /** Contexto de audio simulado: apunta cada nodo creado y cada conexión. */
  const fakeContext = () => {
    const log = { nodes: [], links: [], started: 0 };
    // [UX13] Las rampas dejan el valor final (como cuando terminan en el navegador).
    const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; } });
    const node = (kind, extra = {}) => {
      const n = { kind, ...extra, connect(to) { log.links.push([n, to]); return to; }, disconnect() {} };
      log.nodes.push(n);
      return n;
    };
    const context = {
      currentTime: 0, sampleRate: 22050, state: 'running', destination: { kind: 'destination' },
      createBiquadFilter: () => node('biquad', { type: 'lowpass', frequency: param(), Q: param() }),
      createWaveShaper: () => node('shaper', { curve: null, oversample: 'none' }),
      createGain: () => node('gain', { gain: param() }),
      createBuffer: (channels, length, rate) => ({ length, sampleRate: rate, duration: length / rate, getChannelData: () => new Float32Array(length) }),
      createBufferSource: () => node('source', { buffer: null, loop: false, playbackRate: param(), start() { log.started++; }, stop() {}, onended: null }),
      createOscillator: () => node('osc', { type: 'square', frequency: param(), start() {}, stop() {} }),
    };
    return { context, log };
  };

  await test('IA6: elección de voz', () => {
    assert(chooseVoiceEngine({ piperReady: true, audio: true, system: true }) === 'piper', 'IA6: con Piper descargado y sonido → Piper');
    assert(chooseVoiceEngine({ piperReady: true, audio: false, system: true }) === 'sistema', 'IA6: sin sonido WebAudio → la del sistema');
    assert(chooseVoiceEngine({ piperReady: false, audio: true, system: true }) === 'sistema', 'IA6: sin Piper → la del sistema');
    assert(chooseVoiceEngine({ piperReady: true, audio: true, system: true, enabled: false }) === 'sistema', 'IA6: con Piper apagado en Ajustes → la del sistema');
    assert(chooseVoiceEngine({ piperReady: false, audio: true, system: false }) === 'texto' && chooseVoiceEngine({ piperReady: false, audio: false, system: false }) === 'texto', 'IA6: sin nada → solo texto');
    assert(PIPER_VOICE.id === 'es_ES-sharvard-medium' && PIPER_VOICE.speakers === 2 && /CC BY 3\.0/.test(PIPER_VOICE.license) && PIPER_VOICE.bytes > 70e6 && PIPER_VOICE.bytes < 120e6, 'IA6: la voz es sharvard, con dos voces, su licencia y su tamaño', JSON.stringify(PIPER_VOICE));
  });

  await test('IA6: voz por piloto', () => {
    const ids = Object.keys(DRIVERS);
    const bad = [];
    for (const id of ids) {
      const v = pilotVoice(id), again = pilotVoice(id);
      if (JSON.stringify(v) !== JSON.stringify(again)) bad.push(`${id}: cambia`);
      if (!(v.speaker === 0 || v.speaker === 1) || v.lengthScale < 0.9 || v.lengthScale > 1.1 || v.playback < 0.94 || v.playback > 1.06) bad.push(`${id}: ${JSON.stringify(v)}`);
    }
    assert(bad.length === 0, 'IA6: cada piloto, siempre los mismos ajustes y dentro de los márgenes (velocidad 0,9–1,1; tono 0,94–1,06)', bad.slice(0, 4).join(' | '));
    const teams = {};
    for (const d of Object.values(DRIVERS)) (teams[d.teamId] ??= []).push(d.id);
    // [23/10/2026] A petición del usuario, todos los pilotos con la voz masculina del modelo (sharvard: M = 0, F = 1):
    // los compañeros se distinguen por tono y velocidad, no por la voz del modelo.
    assert(ids.every(id => pilotVoice(id).speaker === 0), 'IA6: todos los pilotos con la voz masculina del modelo');
    const same = Object.entries(teams).filter(([, m]) => m.length === 2).filter(([, [a, b]]) => {
      const x = pilotVoice(a), y = pilotVoice(b);
      return Math.abs(x.lengthScale - y.lengthScale) < 0.05 || Math.abs(x.playback - y.playback) < 0.01;
    });
    assert(same.length === 0, 'IA6: los dos pilotos de cada equipo, con tono y velocidad distintos', same.map(([t]) => t).join(', '));
    const unknown = pilotVoice('piloto-inventado');
    assert(unknown.speaker === 0 && unknown.lengthScale >= 0.9 && unknown.lengthScale <= 1.1, 'IA6: un piloto sin ficha también tiene voz');
  });

  await test('IA6: filtro de radio', () => {
    const { context, log } = fakeContext();
    const chain = buildRadioChain(context, context.destination);
    // [UX14] Valores cambiados con autorización del usuario (26/10/2026): banda de unos 250 a 3.800 Hz con dos filtros a
    // cada lado y, de fondo, el motor a unos −17 dB (antes 300–3.400 Hz y ruido blanco al 2 %).
    const biquads = log.nodes.filter(n => n.kind === 'biquad');
    const hp = biquads.filter(n => n.type === 'highpass'), lp = biquads.filter(n => n.type === 'lowpass');
    assert(RADIO_FILTER.highpassHz === 280 && RADIO_FILTER.lowpassHz === 3200 && Math.abs(20 * Math.log10(RADIO_FILTER.noise) + 17) < 1e-6, 'IA6: valores acordados en UX14 (paso alto 280 Hz, paso bajo 3.200 Hz, fondo a −17 dB)');
    assert(hp.length === 2 && hp.every(n => n.frequency.value === 280) && lp.length === 2 && lp.every(n => n.frequency.value === 3200), 'IA6: dos pasos altos a 280 Hz y dos pasos bajos a 3.200 Hz', JSON.stringify(biquads.map(n => [n.type, n.frequency.value])));
    const to = from => log.links.filter(([a]) => a === from).map(([, b]) => b);
    const reachesOutVia = (from, target) => { const seen = new Set(); const walk = x => x === target || (!seen.has(x) && (seen.add(x), to(x).some(walk))); return walk(from); };
    const shaper = log.nodes.find(n => n.kind === 'shaper');
    assert(to(chain.input).includes(hp[0]) && to(hp[0]).includes(hp[1]) && to(hp[1]).includes(lp[0]) && to(lp[0]).includes(lp[1]) && reachesOutVia(lp[1], shaper) && shaper.curve && shaper.curve.length > 0, 'IA6: voz → pasos altos → pasos bajos → saturación suave');
    const reachesOut = n => { const seen = new Set(); const walk = x => { if (x === context.destination) return true; if (seen.has(x)) return false; seen.add(x); return to(x).some(walk); }; return walk(n); };
    // [UX13] El ruido se mide con la radio abierta: al crear la cadena está en silencio (cambio autorizado por el
    // usuario el 26/10/2026).
    chain.open();
    assert(reachesOut(shaper) && reachesOut(chain.noise) && Math.abs(chain.noise.gain.value - RADIO_FILTER.noise) < 1e-9, 'IA6: la saturación y el fondo (el motor, con la radio abierta) llegan a la salida');
    chain.close();
    const before = log.started;
    chain.click();
    assert(log.started > before, 'IA6: chasquido de apertura y cierre');
  });

  await test('IA6: Piper suena por el filtro', async () => {
    const { context, log } = fakeContext();
    const calls = [];
    const speaker = createPiperSpeaker({
      context: () => context,
      synth: async (text, voice) => { calls.push({ text, voice }); return { samples: new Float32Array(2205), sampleRate: 22050 }; },
    });
    const done = speaker.speak('Copiado, entro', { pitch: 1, rate: 1, volume: 0.8, driverId: 'alonso' });
    await tick(); await tick();
    const src = log.nodes.find(n => n.kind === 'source' && n.buffer?.length === 2205);
    assert(calls.length === 1 && calls[0].voice.speaker === pilotVoice('alonso').speaker && calls[0].voice.lengthScale === pilotVoice('alonso').lengthScale, 'IA6: Piper habla con la voz y la velocidad del piloto', JSON.stringify(calls[0]));
    assert(src && Math.abs(src.playbackRate.value - pilotVoice('alonso').playback) < 1e-9, 'IA6: y con su tono (velocidad de reproducción)');
    src.onended?.();
    await done;
    assert(speaker.available() === true, 'IA6: el altavoz de Piper está disponible con contexto de audio');
  });

  await test('IA6: elección de reconocimiento', () => {
    assert(chooseStt({ online: true, webSpeech: true, whisperReady: false }) === 'web-speech', 'IA6: con red y Web Speech → Web Speech');
    assert(chooseStt({ online: true, webSpeech: true, whisperReady: true }) === 'web-speech', 'IA6: con red, Web Speech aunque haya Whisper');
    assert(chooseStt({ online: false, webSpeech: true, whisperReady: true }) === 'whisper', 'IA6: sin red y con Whisper → Whisper');
    assert(chooseStt({ online: true, webSpeech: false, whisperReady: true }) === 'whisper', 'IA6: sin Web Speech y con Whisper → Whisper');
    assert(chooseStt({ online: false, webSpeech: true, whisperReady: false }) === null && chooseStt({ online: true, webSpeech: false, whisperReady: false }) === null, 'IA6: sin ninguno → sin botón');
    assert(WHISPER_MODEL.modelId === 'onnx-community/whisper-tiny' && /^[0-9a-f]{40}$/.test(WHISPER_MODEL.revision) && WHISPER_MODEL.bytes > 30e6 && WHISPER_MODEL.bytes < 60e6, 'IA6: Whisper tiny con commit fijado y su tamaño', JSON.stringify(WHISPER_MODEL));
  });

  await test('IA6: mantén para hablar', async () => {
    const sent = [], shown = [];
    const recognizer = text => ({ start: async () => {}, stop: async () => text, cancel() {} });
    const ptt = createPushToTalk({ recognizer: () => recognizer('Fer, box, duros'), submit: t => sent.push(t), show: t => shown.push(t) });
    await ptt.press(); await ptt.release();
    assert(sent.join() === 'Fer, box, duros' && shown.includes('Fer, box, duros'), 'IA6: al soltar, el texto aparece en el campo y se envía');
    const empty = createPushToTalk({ recognizer: () => recognizer('   '), submit: t => sent.push(t), show: () => {} });
    await empty.press(); await empty.release();
    assert(sent.length === 1, 'IA6: un reconocimiento vacío no envía nada');
    const failing = createPushToTalk({ recognizer: () => ({ start: async () => { throw new Error('sin permiso'); }, stop: async () => 'x', cancel() {} }), submit: t => sent.push(t), show: () => {} });
    await failing.press(); await failing.release();
    assert(sent.length === 1 && failing.error === 'sin permiso', 'IA6: sin permiso del micro no se envía nada y queda el motivo', failing.error);
    const panel = readFileSync('src/components/RadioPanel.tsx', 'utf8');
    assert(/createPushToTalk/.test(panel) && /submit:\s*\(?\s*\w*\s*\)?\s*=>\s*send(Text|Radio)\(/.test(panel) && /'t'/.test(panel), 'IA6: el panel envía lo reconocido por el mismo camino que el texto escrito, con la tecla T');
  });

  await test('IA6: el paquete principal no lleva Piper ni Whisper', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'f1-ia6-build-'));
    try {
      const { build } = await import('vite');
      await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true, reportCompressedSize: false } });
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const entry = [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.js)"/g)].map(m => m[1]);
      const heavy = /createPiperPhonemize|piper_phonemize|diffusionstudio|automatic-speech-recognition|whisper-tiny/;
      const bad = entry.filter(f => heavy.test(readFileSync(join(outDir, f), 'utf8')));
      const assets = readdirSync(join(outDir, 'assets')).filter(f => f.endsWith('.js'));
      assert(entry.length > 0 && bad.length === 0, 'IA6: lo que carga index.html no contiene Piper ni Whisper', bad.join(', '));
      assert(assets.some(f => /createPiperPhonemize|piper_phonemize/.test(readFileSync(join(outDir, 'assets', f), 'utf8'))), 'IA6: Piper va en un trozo aparte que se carga con import()');
    } finally { rmSync(outDir, { recursive: true, force: true }); }
  });
}
