// Radio eufórica: retoque de la voz en las frases eufóricas y mensaje de victoria al ganar.
// Contrato aprobado por el usuario el 30/10/2026 (opción A + B), tras las pruebas de voz con VoiceStudio: el retoque que
// eligió fue +2 semitonos y un 6 % más rápido.
//  1. Las frases de adelantamiento y de victoria son eufóricas; el resto, no.
//  2. Con el retoque, la voz queda 2 semitonos más aguda y un 6 % más rápida, en Piper y en Kokoro.
//  3. El altavoz aplica el retoque solo a las frases eufóricas.
//  4. El mensaje de victoria sale una vez cuando el coche del jugador termina primero, suena aunque el coche ya haya
//     terminado, y hay frases para los cuatro caracteres.
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { moodOf, EUPHORIA, euphoricVoice } = await load('/src/radio/voice/mood.ts');
  const { pilotVoice, createPiperSpeaker } = await load('/src/radio/voice/piperVoice.ts');
  const { kokoroVoiceFor, withStretch } = await load('/src/radio/voice/kokoroVoice.ts');
  const { createVoiceQueue } = await load('/src/radio/voice/voiceQueue.ts');
  const { driverSays } = await load('/src/radio/controller.ts');
  const { createRadioStore } = await load('/src/state/radioStore.ts');
  const { TEMPLATES, TEMPERAMENTS, REPLY_KINDS, CALL_KINDS } = await load('/src/radio/replies/templates.ts');
  const { createCallDetector } = await load('/src/radio/replies/driverCalls.ts');
  const PITCH = 2 ** (2 / 12);

  await test('Euforia: qué frases son eufóricas', () => {
    assert(moodOf('adelanta') === 'euforico' && moodOf('victoria') === 'euforico', 'Euforia: adelantar y ganar son eufóricas');
    const others = [...REPLY_KINDS, ...CALL_KINDS].filter(k => k !== 'adelanta');
    const wrong = others.filter(k => moodOf(k) !== undefined);
    assert(wrong.length === 0 && moodOf(undefined) === undefined, 'Euforia: el resto de frases suenan con la voz normal', wrong.join(','));
  });

  await test('Euforia: 2 semitonos más aguda y un 6 % más rápida', () => {
    assert(EUPHORIA.semitones === 2 && EUPHORIA.tempo === 1.06, 'Euforia: el retoque es el elegido por el usuario', JSON.stringify(EUPHORIA));
    const base = pilotVoice('alonso');
    const v = euphoricVoice(base);
    // Piper: el tono lo da la reproducción; la duración, length_scale (más alto, más lento) y la reproducción.
    assert(Math.abs(v.playback / base.playback - PITCH) < 1e-6, 'Euforia: Piper suena 2 semitonos más agudo', (v.playback / base.playback).toFixed(4));
    const piperTempo = (v.playback / base.playback) / (v.lengthScale / base.lengthScale);
    assert(Math.abs(piperTempo - 1.06) < 1e-6, 'Euforia: Piper habla un 6 % más rápido', piperTempo.toFixed(4));
    assert(v.speaker === base.speaker && base.playback === pilotVoice('alonso').playback, 'Euforia: misma voz del piloto y sin tocar la de siempre');
    // Kokoro: la duración la da `speed` (más alto, más rápido) y el tono, la reproducción del altavoz.
    const k = kokoroVoiceFor('alonso');
    const ke = withStretch(k, v.stretch);
    const kokoroTempo = (ke.speed / k.speed) * (v.playback / base.playback);
    assert(ke.voice === k.voice && Math.abs(kokoroTempo - 1.06) < 1e-6, 'Euforia: Kokoro habla un 6 % más rápido con su misma voz', kokoroTempo.toFixed(4));
    assert(withStretch(k, undefined).speed === k.speed, 'Euforia: sin retoque, Kokoro a su velocidad de siempre');
  });

  /** Contexto de audio simulado, lo justo para el altavoz de radio. */
  const fakeContext = () => {
    const nodes = [];
    const param = (value = 0) => ({ value, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
    const node = (kind, extra = {}) => { const n = { kind, ...extra, connect(to) { return to; }, disconnect() {} }; nodes.push(n); return n; };
    const context = {
      currentTime: 0, sampleRate: 24000, state: 'running', destination: { kind: 'destination' },
      createBiquadFilter: () => node('biquad', { type: 'lowpass', frequency: param(), Q: param(), gain: param() }),
      createWaveShaper: () => node('shaper', { curve: null, oversample: 'none' }),
      createGain: () => node('gain', { gain: param() }),
      createDynamicsCompressor: () => node('comp', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
      createBuffer: (channels, length, rate) => ({ length, sampleRate: rate, duration: length / rate, getChannelData: () => new Float32Array(length) }),
      createBufferSource: () => node('source', { buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {}, onended: null }),
      createOscillator: () => node('osc', { type: 'square', frequency: param(), start() {}, stop() {} }),
    };
    return { context, nodes };
  };

  await test('Euforia: el altavoz retoca solo las frases eufóricas', async () => {
    const said = async mood => {
      const { context, nodes } = fakeContext();
      const calls = [];
      const speaker = createPiperSpeaker({ context: () => context, synth: async (text, voice) => { calls.push(voice); return { samples: new Float32Array(2400), sampleRate: 24000 }; } });
      const done = speaker.speak('¡Ganamos!', { pitch: 1, rate: 1, driverId: 'alonso', mood });
      await tick(); await tick();
      const src = nodes.find(n => n.kind === 'source' && n.buffer?.length === 2400);
      src?.onended?.();
      await done;
      return { voice: calls[0], rate: src?.playbackRate.value };
    };
    const base = pilotVoice('alonso');
    const happy = await said('euforico');
    assert(happy.voice && Math.abs(happy.rate - base.playback * PITCH) < 1e-6 && Math.abs(happy.voice.lengthScale - euphoricVoice(base).lengthScale) < 1e-9, 'Euforia: una frase eufórica sale retocada', JSON.stringify(happy));
    const calm = await said(undefined);
    assert(calm.voice && Math.abs(calm.rate - base.playback) < 1e-9 && calm.voice.lengthScale === base.lengthScale, 'Euforia: una frase normal sale con la voz de siempre', JSON.stringify(calm));
  });

  await test('Euforia: la cola y la radio llevan el tono', async () => {
    const spoken = [];
    const speaker = { available: () => true, ownCues: true, cancel() {}, async speak(text, opts) { spoken.push({ text, mood: opts.mood }); } };
    const queue = createVoiceQueue({ speaker, playSound() {}, level: () => 1, now: () => 100, isRunning: () => false });
    const store = createRadioStore();
    // El coche ya ha terminado: la victoria se dice igual; otra frase de un coche terminado, no.
    driverSays({ store, queue, carId: 1, driverId: 'alonso', text: '¡Ganamos!', kind: 'victoria', requestedAt: 99, now: 100, running: false });
    driverSays({ store, queue, carId: 1, driverId: 'alonso', text: 'Pasado.', kind: 'adelanta', requestedAt: 99, now: 100, running: false });
    await queue.idle(); await tick();
    assert(spoken.length === 1 && spoken[0].text === '¡Ganamos!' && spoken[0].mood === 'euforico', 'Euforia: la victoria suena, eufórica, aunque el coche haya terminado', JSON.stringify(spoken));
    const running = createVoiceQueue({ speaker, playSound() {}, level: () => 1, now: () => 100, isRunning: () => true });
    spoken.length = 0;
    driverSays({ store, queue: running, carId: 1, driverId: 'alonso', text: 'Pasado.', kind: 'adelanta', requestedAt: 99, now: 100, running: true });
    driverSays({ store, queue: running, carId: 1, driverId: 'alonso', text: 'Copiado.', kind: 'ok-ritmo', requestedAt: 99, now: 100, running: true });
    await running.idle(); await tick();
    assert(spoken.map(s => s.mood).join(',') === 'euforico,', 'Euforia: el adelantamiento va eufórico y una respuesta normal no', JSON.stringify(spoken));
  });

  await test('Euforia: frases de victoria', () => {
    const bad = TEMPERAMENTS.filter(t => !(TEMPLATES[t].victoria?.length >= 3) || TEMPLATES[t].victoria.some(s => !s.trim() || /[{}]/.test(s)));
    assert(bad.length === 0, 'Euforia: cada carácter tiene al menos tres frases de victoria, sin huecos', bad.join(','));
  });

  await test('Euforia: el piloto habla al ganar', () => {
    const car = (over = {}) => ({ id: 1, position: 1, tireWear: 10, stops: 1, puncture: false, rain: false, running: true, finished: false, ...over });
    const snap = (t, cars) => ({ timeSec: t, lap: 50, safetyCar: { isDeployed: false, mode: 'sc' }, notices: [], cars });
    const d = createCallDetector();
    d.detect(snap(100, [car(), car({ id: 2, position: 5 })]));
    // Adelanta justo antes de la meta (llamada reciente) y gana: la victoria sale igual, y una sola vez.
    d.detect(snap(110, [car(), car({ id: 2, position: 4 })]));
    const win = d.detect(snap(115, [car({ running: false, finished: true }), car({ id: 2, position: 4 })]));
    assert(win.length === 1 && win[0].kind === 'victoria' && win[0].carId === 1 && win[0].priority === true, 'Euforia: al terminar primero, mensaje de victoria con prioridad', JSON.stringify(win));
    const again = d.detect(snap(120, [car({ running: false, finished: true }), car({ id: 2, position: 4 })]));
    assert(again.length === 0, 'Euforia: la victoria se dice una sola vez', JSON.stringify(again));
    const second = d.detect(snap(125, [car({ running: false, finished: true }), car({ id: 2, position: 2, running: false, finished: true })]));
    assert(second.length === 0, 'Euforia: terminar segundo no es victoria', JSON.stringify(second));
  });

  await test('Euforia: la carrera le pasa al detector quién ha terminado', async () => {
    const { readFileSync } = await import('node:fs');
    const panel = readFileSync(new URL('../../src/components/RadioPanel.tsx', import.meta.url), 'utf8');
    assert(/finished:\s*\(view\?\.status \?\? car\.status\) === 'finished'/.test(panel), 'Euforia: el panel de radio dice al detector si el coche ha terminado');
  });
}
