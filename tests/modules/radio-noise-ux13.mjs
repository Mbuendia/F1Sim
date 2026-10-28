// UX13 — El ruido de la radio no se queda encendido (Sprint 7). Contrato acordado con el usuario el 26/10/2026.
// Lo que vio el usuario: tras una respuesta, queda un ruido blanco de fondo para siempre. Causa: buildRadioChain
// arrancaba un bucle de ruido al crearse, con el volumen fijo al 2 %, y no lo paraba nunca.
//  1. Al crear la cadena de radio, el ruido está en silencio y no hay ningún bucle sonando.
//  2. Al empezar una frase suena la apertura (un chasquido de radio) y el ruido sube en 80 ms como mucho.
//     [UX14] Antes era «chasquido y pitido corto»: el pitido se cambia por un chasquido, como en la radio real, con
//     autorización del usuario del 26/10/2026. El fondo es ahora el motor del coche (UX14).
//     [UX15] Cambiado el 28/10/2026 con aprobación del usuario: con la grabación cargada, la apertura es el pitido de radio
//     grabado por el usuario (lo comprueba voice-natural-ux15); este módulo mide la cadena sin grabaciones (el respaldo).
//  3. Al acabar suena el cierre y el ruido baja a cero y se para en 200 ms como mucho; ningún bucle sigue en marcha
//     (con un contexto de audio falso).
//  4. Cancelar a mitad de frase cierra igual.
//  5. La voz del sistema usa los mismos sonidos de apertura y cierre.
export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { RADIO_FILTER, buildRadioChain } = await load('/src/radio/voice/radioFilter.ts');
  const { createPiperSpeaker } = await load('/src/radio/voice/piperVoice.ts');
  const { createSystemSpeaker } = await load('/src/radio/voice/systemVoice.ts');
  const { createVoiceQueue } = await load('/src/radio/voice/voiceQueue.ts');

  /** Contexto de audio falso: guarda las fuentes (con bucle o no, cuándo empiezan y cuándo paran) y las rampas. */
  const fakeContext = () => {
    const sources = [];
    const ctx = { currentTime: 10, sampleRate: 8000, destination: { kind: 'dest' } };
    const param = v => {
      const p = { value: v, events: [] };
      p.setValueAtTime = (value, at) => { p.events.push({ kind: 'set', value, at }); p.value = value; };
      p.linearRampToValueAtTime = (value, at) => { p.events.push({ kind: 'ramp', value, at }); p.value = value; };
      p.cancelScheduledValues = () => {};
      return p;
    };
    const node = extra => ({ connect() {}, disconnect() {}, ...extra });
    Object.assign(ctx, {
      createGain: () => node({ gain: param(1) }),
      createBiquadFilter: () => node({ type: '', frequency: param(0), Q: param(1) }),
      createWaveShaper: () => node({ curve: null, oversample: 'none' }),
      createBuffer: (channels, length) => { const data = new Float32Array(length); return { length, getChannelData: () => data }; },
      createBufferSource: () => {
        const src = node({ buffer: null, loop: false, playbackRate: param(1), onended: null, startedAt: null, stoppedAt: null });
        src.start = (when = ctx.currentTime) => { src.startedAt = when; };
        src.stop = (when = ctx.currentTime) => { src.stoppedAt = when; };
        sources.push(src); return src;
      },
    });
    const loopsRunning = () => sources.filter(s => s.loop && s.startedAt !== null && s.stoppedAt === null);
    return { ctx, sources, loopsRunning };
  };
  const oneShots = (sources, from) => sources.slice(from).filter(s => !s.loop && s.startedAt !== null);

  await test('UX13: la cadena empieza en silencio', () => {
    const { ctx, loopsRunning } = fakeContext();
    const chain = buildRadioChain(ctx, ctx.destination);
    assert(chain.noise.gain.value === 0 && loopsRunning().length === 0, 'UX13: al crearla, sin ruido y sin bucle sonando', `${chain.noise.gain.value} · ${loopsRunning().length}`);
  });

  await test('UX13: abrir y cerrar', () => {
    const { ctx, sources, loopsRunning } = fakeContext();
    const chain = buildRadioChain(ctx, ctx.destination);
    let mark = sources.length;
    chain.open();
    const openRamp = chain.noise.gain.events.filter(e => e.kind === 'ramp').at(-1);
    assert(oneShots(sources, mark).length >= 1, 'UX13: al abrir suena la apertura (chasquido)');
    assert(openRamp && Math.abs(openRamp.value - RADIO_FILTER.noise) < 1e-9 && openRamp.at - ctx.currentTime <= 0.08 + 1e-9 && loopsRunning().length === 1, 'UX13: el ruido sube al 2 % en 80 ms como mucho', JSON.stringify(openRamp));
    mark = sources.length;
    chain.close();
    const closeRamp = chain.noise.gain.events.filter(e => e.kind === 'ramp').at(-1);
    const hiss = sources.find(s => s.loop);
    assert(oneShots(sources, mark).length >= 1, 'UX13: al cerrar suena el cierre');
    assert(closeRamp && closeRamp.value === 0 && closeRamp.at - ctx.currentTime <= 0.2 + 1e-9, 'UX13: el ruido baja a cero en 200 ms como mucho', JSON.stringify(closeRamp));
    assert(hiss.stoppedAt !== null && hiss.stoppedAt - ctx.currentTime <= 0.2 + 1e-9, 'UX13: y el bucle se para', String(hiss.stoppedAt));
    const crossings = d => { let c = 0; for (let i = 1; i < d.length; i++) if ((d[i] >= 0) !== (d[i - 1] >= 0)) c++; return c / d.length; };
    assert(oneShots(sources, mark).every(s => crossings(s.buffer.getChannelData(0)) > 0.25), 'UX13: el cierre es un chasquido de ruido, sin pitido musical (UX14)');
  });

  /** Altavoz Piper con el contexto falso: `endNow()` termina la frase como lo haría el navegador. */
  const piper = () => {
    const f = fakeContext();
    const speaker = createPiperSpeaker({ context: () => f.ctx, synth: async () => ({ samples: new Float32Array(800), sampleRate: 8000 }) });
    const voiceSource = () => f.sources.find(s => !s.loop && s.buffer && s.buffer.length === 800);
    return { ...f, speaker, voiceSource };
  };

  await test('UX13: tras una frase no queda ruido', async () => {
    const p = piper();
    const said = p.speaker.speak('Box, box', { pitch: 1, rate: 1, driverId: 'alonso' });
    await new Promise(r => setTimeout(r, 0));
    assert(p.loopsRunning().length === 1, 'UX13: mientras habla, el ruido de fondo suena');
    p.voiceSource().onended?.();
    await said;
    assert(p.loopsRunning().length === 0, 'UX13: al acabar la frase, ningún bucle de ruido sigue en marcha');
  });

  await test('UX13: cancelar a mitad cierra igual', async () => {
    const p = piper();
    const said = p.speaker.speak('Entra a boxes', { pitch: 1, rate: 1, driverId: 'alonso' });
    await new Promise(r => setTimeout(r, 0));
    const before = p.sources.length;
    p.speaker.cancel();
    await said;
    assert(p.loopsRunning().length === 0 && oneShots(p.sources, before).length >= 1, 'UX13: al cancelar suena el cierre y el ruido se para');
  });

  await test('UX13: la voz del sistema, con los mismos sonidos', async () => {
    const events = [];
    const synth = { getVoices: () => [{ name: 'es', lang: 'es-ES' }], speak(u) { events.push('voz'); setTimeout(() => u.onend?.(), 0); }, cancel() {} };
    class FakeUtterance { constructor(text) { this.text = text; } }
    const system = createSystemSpeaker(synth, FakeUtterance);
    const q = createVoiceQueue({ speaker: system, playSound: s => events.push(s), level: () => 1, now: () => 0, isRunning: () => true });
    q.push({ carId: 1, text: 'hola', requestedAt: 0, pitch: 1, rate: 1 });
    await q.idle();
    assert(events.join() === 'radio,voz,radio', 'UX13: la voz del sistema suena entre la apertura y el cierre («radio»)', events.join());
    const p = piper();
    const sounds = [];
    const q2 = createVoiceQueue({ speaker: p.speaker, playSound: s => sounds.push(s), level: () => 1, now: () => 0, isRunning: () => true });
    q2.push({ carId: 1, text: 'hola', requestedAt: 0, pitch: 1, rate: 1, driverId: 'alonso' });
    await new Promise(r => setTimeout(r, 0));
    p.voiceSource()?.onended?.();
    await q2.idle();
    assert(sounds.length === 0 && p.loopsRunning().length === 0, 'UX13: con la voz realista, la apertura y el cierre los pone la radio (su chasquido), sin repetirlos', sounds.join());
  });
}
