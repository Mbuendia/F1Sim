// UX14 — Radio más parecida a la de verdad (Sprint 7). Contrato acordado con el usuario el 26/10/2026 (autoriza cambiar
// el punto 2 de UX13 y su test). Referencia: análisis del audio de «25 Years Of Legendary F1 Team Radio».
//  1. Banda de la radio de 250 a 3.800 Hz con caída pronunciada (dos filtros en cascada a cada lado), en lugar de
//     300–3.400 Hz suaves: medido con una señal de prueba por la cadena, lo que pasa de 4 kHz queda al menos 15 dB por
//     debajo de la banda. (Bordes de la banda: puntos de −6 dB; la respuesta se calcula como la del navegador, con la Q
//     de los filtros en dB.)
//  2. Voz comprimida como en la referencia: compresor fuerte (umbral −24 dB, relación 6:1) y ganancia de compensación;
//     con una frase de prueba, la dinámica de la envolvente queda en 20 dB o menos.
//  3. Fondo de motor en lugar de ruido blanco: un tono con armónicos a la frecuencia de encendido del motor del coche que
//     habla (revoluciones ÷ 60 × 3, de unos 400 a 950 Hz), por la misma banda y unos 15–20 dB por debajo de la voz; sube
//     con las revoluciones y casi desaparece en boxes o parado; sigue sonando solo con la radio abierta (UX13).
//  4. Apertura y cierre con un chasquido de radio (ráfaga corta de ruido filtrado), sin pitido musical.
//     [UX15] Cambiado el 28/10/2026 con aprobación del usuario: con la grabación cargada, la apertura es el pitido de radio
//     grabado por el usuario (musical; lo comprueba voice-natural-ux15). Aquí se mide la cadena sin grabaciones, el respaldo.
//  5. Todo lo anterior solo en la voz realista (Piper); la voz del sistema no pasa por el filtro (el navegador no lo
//     permite).
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const radio = await load('/src/radio/voice/radioFilter.ts');
  const { buildRadioChain, RADIO_COMPRESSOR, compressorOutputDb, engineFrequency, ENGINE_LEVEL } = radio;

  /** Contexto de audio falso: nodos, conexiones, fuentes y parámetros con rampas. */
  const fakeContext = (rate = 48000) => {
    const nodes = [], links = [], sources = [];
    const ctx = { currentTime: 5, sampleRate: rate, destination: { kind: 'dest' } };
    const param = v => { const p = { value: v }; p.setValueAtTime = x => { p.value = x; }; p.linearRampToValueAtTime = x => { p.value = x; }; p.cancelScheduledValues = () => {}; return p; };
    const node = (kind, extra) => { const n = { kind, ...extra, connect(to) { links.push([n, to]); return to; }, disconnect() {} }; nodes.push(n); return n; };
    Object.assign(ctx, {
      createGain: () => node('gain', { gain: param(1) }),
      createBiquadFilter: () => node('biquad', { type: 'lowpass', frequency: param(350), Q: param(1) }),
      createWaveShaper: () => node('shaper', { curve: null, oversample: 'none' }),
      createDynamicsCompressor: () => node('compressor', { threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }),
      createBuffer: (ch, length) => { const data = new Float32Array(length); return { length, getChannelData: () => data }; },
      createBufferSource: () => { const s = node('source', { buffer: null, loop: false, playbackRate: param(1), onended: null, startedAt: null, stoppedAt: null }); s.start = (w = ctx.currentTime) => { s.startedAt = w; }; s.stop = (w = ctx.currentTime) => { s.stoppedAt = w; }; sources.push(s); return s; },
    });
    return { ctx, nodes, links, sources };
  };
  const after = (links, from) => links.filter(([a]) => a === from).map(([, b]) => b);

  /** Respuesta en potencia de un biquad como el de WebAudio (paso alto y bajo con Q en dB). */
  const response = (type, f0, qDb, rate) => f => {
    const w0 = (2 * Math.PI * f0) / rate, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * Math.pow(10, qDb / 20));
    const b = type === 'lowpass' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    const a = [1 + alpha, -2 * cos, 1 - alpha], w = (2 * Math.PI * f) / rate;
    const nr = b[0] + b[1] * Math.cos(w) + b[2] * Math.cos(2 * w), ni = -(b[1] * Math.sin(w) + b[2] * Math.sin(2 * w));
    const dr = a[0] + a[1] * Math.cos(w) + a[2] * Math.cos(2 * w), di = -(a[1] * Math.sin(w) + a[2] * Math.sin(2 * w));
    return (nr * nr + ni * ni) / (dr * dr + di * di);
  };

  await test('UX14: banda de la radio', () => {
    const { ctx, nodes, links } = fakeContext();
    const chain = buildRadioChain(ctx, ctx.destination);
    // Camino de la voz: los filtros en serie desde la entrada.
    const path = []; let at = chain.input;
    for (let i = 0; i < 12; i++) { const next = after(links, at).find(n => n.kind === 'biquad'); if (!next) break; path.push(next); at = next; }
    const hp = path.filter(n => n.type === 'highpass'), lp = path.filter(n => n.type === 'lowpass');
    assert(hp.length === 2 && lp.length === 2, 'UX14: dos filtros en cascada a cada lado', path.map(n => `${n.type} ${n.frequency.value}`).join(', '));
    const p = f => path.reduce((acc, n) => acc * response(n.type, n.frequency.value, n.Q.value, ctx.sampleRate)(f), 1);
    const avg = (a, b) => { let s = 0, k = 0; for (let f = a; f <= b; f += 5) { s += p(f); k++; } return s / k; };
    const pass = avg(500, 3000), db = f => 10 * Math.log10(p(f) / pass);
    const edgeHi = (() => { for (let f = 3000; f <= 6000; f += 5) if (db(f) <= -6) return f; return null; })();
    const edgeLo = (() => { for (let f = 600; f >= 20; f -= 5) if (db(f) <= -6) return f; return null; })();
    assert(edgeLo >= 220 && edgeLo <= 290 && edgeHi >= 3700 && edgeHi <= 3900, 'UX14: la banda va de unos 250 a unos 3.800 Hz (puntos de −6 dB)', `${edgeLo}–${edgeHi} Hz`);
    const above = 10 * Math.log10(avg(4000, 8000) / pass);
    assert(above <= -15, 'UX14: lo que pasa de 4 kHz queda al menos 15 dB por debajo de la banda', `${above.toFixed(1)} dB`);
    assert(nodes.filter(n => n.kind === 'biquad').length >= 4, 'UX14: la voz no pasa por los 300–3.400 Hz suaves de antes');
  });

  await test('UX14: voz comprimida', () => {
    const { ctx, links } = fakeContext();
    const chain = buildRadioChain(ctx, ctx.destination);
    const reach = (from, kind, seen = new Set()) => { if (from?.kind === kind) return from; if (!from || seen.has(from)) return null; seen.add(from); for (const n of after(links, from)) { const r = reach(n, kind, seen); if (r) return r; } return null; };
    const comp = reach(chain.input, 'compressor');
    assert(comp && comp.threshold.value === -24 && comp.ratio.value === 6 && RADIO_COMPRESSOR.threshold === -24 && RADIO_COMPRESSOR.ratio === 6, 'UX14: compresor fuerte en el camino de la voz (umbral −24 dB, 6:1)', JSON.stringify(comp && { t: comp.threshold.value, r: comp.ratio.value }));
    // Frase de prueba: envolvente de una voz normal (28 dB entre el 10 % y el 90 %), con los picos cerca de 0 dBFS.
    const env = Array.from({ length: 200 }, (_, i) => -38 + (i / 199) * 36);
    const outDb = env.map(compressorOutputDb);
    const pct = (a, q) => [...a].sort((x, y) => x - y)[Math.floor(q * (a.length - 1))];
    const before = pct(env, 0.9) - pct(env, 0.1), range = pct(outDb, 0.9) - pct(outDb, 0.1);
    assert(before >= 25 && range <= 20, 'UX14: la dinámica de la frase queda en 20 dB o menos', `${before.toFixed(1)} → ${range.toFixed(1)} dB`);
  });

  await test('UX14: motor de fondo', () => {
    assert(Math.abs(engineFrequency(10000) - 500) < 1 && engineFrequency(4000) === 400 && engineFrequency(30000) === 950, 'UX14: frecuencia del motor = revoluciones ÷ 60 × 3, entre 400 y 950 Hz');
    const { ctx, sources } = fakeContext();
    const chain = buildRadioChain(ctx, ctx.destination);
    const engineLoops = () => sources.filter(s => s.loop && s.engine && s.startedAt !== null && s.stoppedAt === null);
    assert(engineLoops().length === 0, 'UX14: sin abrir la radio no suena el motor');
    chain.setEngine({ rpm: 11500, moving: true });
    chain.open();
    const eng = engineLoops()[0];
    const hz = eng ? eng.playbackRate.value * radio.ENGINE_BASE_HZ : 0;
    assert(eng && Math.abs(hz - engineFrequency(11500)) < 2, 'UX14: con la radio abierta suena el motor del coche que habla, a su frecuencia', `${hz.toFixed(0)} Hz`);
    const level = 20 * Math.log10(chain.engine.gain.value / chain.input.gain.value);
    assert(level <= -15 && level >= -20 && ENGINE_LEVEL.movingDb <= -15 && ENGINE_LEVEL.movingDb >= -20, 'UX14: el motor va unos 15–20 dB por debajo de la voz', `${level.toFixed(1)} dB`);
    chain.setEngine({ rpm: 4000, moving: false });
    const quiet = 20 * Math.log10(chain.engine.gain.value / chain.input.gain.value);
    assert(quiet <= -35, 'UX14: en boxes o parado casi desaparece', `${quiet.toFixed(1)} dB`);
    chain.setEngine({ rpm: 9000, moving: true });
    const low = chain.engine.gain.value;
    chain.setEngine({ rpm: 12500, moving: true });
    assert(chain.engine.gain.value > low, 'UX14: sube con las revoluciones');
    chain.close();
    assert(engineLoops().length === 0 && chain.engine.gain.value === 0, 'UX14: al cerrar la radio, el motor se calla y se para');
    assert(sources.every(s => !s.loop || s.engine), 'UX14: ya no hay bucle de ruido blanco');
  });

  await test('UX14: chasquido al abrir y cerrar', () => {
    const { ctx, sources } = fakeContext();
    const chain = buildRadioChain(ctx, ctx.destination);
    const oneShots = from => sources.slice(from).filter(s => !s.loop && s.startedAt !== null);
    const crossings = d => { let c = 0; for (let i = 1; i < d.length; i++) if ((d[i] >= 0) !== (d[i - 1] >= 0)) c++; return c / d.length; };
    for (const [name, act] of [['abrir', () => chain.open()], ['cerrar', () => chain.close()]]) {
      const mark = sources.length; act();
      const shots = oneShots(mark);
      const ms = shots.map(s => (s.buffer.length / ctx.sampleRate) * 1000);
      const noisy = shots.every(s => crossings(s.buffer.getChannelData(0)) > 0.25);
      assert(shots.length >= 1 && ms.every(x => x >= 10 && x <= 80) && noisy, `UX14: al ${name}, un chasquido de ruido corto, sin pitido musical`, `${shots.length} sonido(s) · ${ms.map(x => x.toFixed(0)).join(', ')} ms · ruido ${noisy}`);
    }
  });

  await test('UX14: solo la voz realista', () => {
    const system = readFileSync('src/radio/voice/systemVoice.ts', 'utf8');
    assert(!/buildRadioChain/.test(system), 'UX14: la voz del sistema no pasa por el filtro (el navegador no lo permite)');
    const piper = readFileSync('src/radio/voice/piperVoice.ts', 'utf8');
    assert(/buildRadioChain/.test(piper) && /setEngine\(/.test(piper), 'UX14: la voz Piper pasa por la cadena de radio con su motor');
  });
}
