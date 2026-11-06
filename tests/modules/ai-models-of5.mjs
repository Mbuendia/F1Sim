// OF5 — Modelos de IA en una lista (propuesta del usuario del 06/11/2026). Contrato acordado con el usuario ese
// día; el mismo día pide que la regla de un solo modelo grande valga en todos los dispositivos, no solo en el móvil). Origen: en el iPhone del usuario (Chrome, iOS), con el modelo de la radio (276 MB) y la voz realista
// (332 MB) bajados, entrar en Ajustes recarga la página. Hoy Ajustes monta tres bloques por separado (radio, voz, micro)
// que al abrirse comprueban cada uno sus archivos, y en carrera nada impide cargar a la vez los dos modelos grandes.
//  1. Una sola lista «Modelos de IA» en Ajustes, con una fila por modelo que el dispositivo puede usar: el modelo de la
//     radio (la versión de este dispositivo), la voz realista (Kokoro con WebGPU; Piper sin él) y el micro sin red
//     (Whisper). Cada fila dice qué es, para qué sirve, cuánto ocupa y su estado («Sin bajar», «Bajando N %»,
//     «Bajado»), con su botón (Descargar, Cancelar o Borrar). Sin IA local en el dispositivo, la fila de la radio lo
//     dice y no ofrece descargar.
//  2. Abrir Ajustes no carga ningún modelo: el estado de cada fila se comprueba una sola vez (si está bajado, sin
//     preguntar además cuánto ocupa), sin descargar ni arrancar nada.
//  3. Una descarga a la vez: con una en marcha, las demás filas no dejan empezar otra y dicen a cuál esperan.
//  4. Un solo modelo grande en carrera, en cualquier dispositivo (móvil, tableta o PC): el de la radio y la voz realista
//     no pueden estar activos a la vez (activar uno apaga el otro y lo dice); el micro sin red (41 MB) va con cualquiera.
//     Solo se activa lo que está bajado.
//  5. Lo activo se guarda en las preferencias de siempre (radio con IA o básica, voz realista o del sistema), así que
//     la carrera usa lo elegido; quien ya tenga los dos grandes activos se queda con el de la radio.
//  6. En carrera, la lista solo enseña el estado: sin descargas (UX2).
//  7. A mano (no en la suite): en el iPhone del usuario, con los modelos bajados, Ajustes abre sin recargar; y a 375 px
//     la lista cabe sin salirse (__uiAudit() y captura).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const MB = 1024 * 1024;
const tick = () => new Promise(r => setTimeout(r, 0));

/** Tienda falsa que cuenta lo que se le pide; `slow` deja la descarga a medias hasta que se suelte. */
function countingStore({ complete = false, onDisk = 0, slow = false } = {}) {
  const c = { has: 0, bytes: 0, download: 0 };
  let release = null;
  const store = {
    has: async () => { c.has++; return complete; },
    bytesOnDisk: async () => { c.bytes++; return complete ? 1 : onDisk; },
    async download(onProgress) {
      c.download++;
      if (slow) await new Promise(r => { release = r; });
      complete = true; onProgress?.(1, 1);
    },
    remove: async () => { complete = false; },
  };
  return { c, store, release: () => release?.() };
}

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  let list = null;
  try { list = await load('/src/radio/model/modelList.ts'); } catch (e) { assert(false, 'OF5: existe src/radio/model/modelList.ts', e.message); }
  const RadioSettings = (await load('/src/components/RadioSettings.tsx')).default;
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const kokoro = await load('/src/radio/voice/kokoroVoice.ts');
  const piper = await load('/src/radio/voice/piperVoice.ts');
  const { RADIO_MODELS } = await load('/src/radio/model/manifest.ts');
  const fake = (preloaded = false) => createFakeModelStore({ totalBytes: 1000, chunkBytes: 100, preloaded });
  const props = (over = {}) => ({ device: { kind: 'completo' }, initialMode: 'basica', store: fake(), voiceStore: fake(), kokoroStore: fake(), whisperStore: fake(), remember: false, webgpu: true, estimate: async () => ({ quota: 8e9, usage: 0 }), ...over });
  const rows = html => [...html.matchAll(/data-model-row="([^"]+)"/g)].map(m => m[1]);
  const mb = n => String(Math.round(n / MB));

  await test('OF5.1: una sola lista', () => {
    const html = renderToStaticMarkup(createElement(RadioSettings, props()));
    assert(/data-model-list/.test(html), 'OF5.1: Ajustes tiene la lista «Modelos de IA»');
    assert(/Modelos de IA/.test(html), 'OF5.1: con su título');
    assert(JSON.stringify(rows(html)) === JSON.stringify(['radio', 'voz', 'micro']), 'OF5.1: una fila por modelo: radio, voz y micro', rows(html).join(', '));
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert(text.includes(mb(RADIO_MODELS.q0f16.bytes)) && text.includes(mb(kokoro.KOKORO_VOICE.bytes)) && text.includes('41'), 'OF5.1: cada fila dice cuánto ocupa (radio completa en el escritorio, Kokoro con WebGPU, micro 41 MB)');
    assert((text.match(/Sin bajar/g) ?? []).length === 3, 'OF5.1: y su estado', String((text.match(/Sin bajar/g) ?? []).length));
    assert(/Voz de radio realista/.test(text) && /Kokoro/.test(text), 'OF5.1: la voz realista con su nombre y su crédito (UX15)');
    const phone = renderToStaticMarkup(createElement(RadioSettings, props({ device: { kind: 'movil', reason: 'En el móvil se usa la versión ligera de la IA' }, webgpu: false }))).replace(/<[^>]+>/g, ' ');
    assert(phone.includes(mb(RADIO_MODELS.q4.bytes)) && phone.includes(mb(piper.PIPER_VOICE.bytes)), 'OF5.1: en un móvil sin WebGPU, la radio ligera y la voz Piper');
    const noAi = renderToStaticMarkup(createElement(RadioSettings, props({ device: { kind: 'no-apto', reason: 'Tu navegador no permite IA local (sin WebGPU)' } })));
    const radioRow = /data-model-row="radio"[\s\S]*?(?=data-model-row="voz")/.exec(noAi)?.[0] ?? '';
    assert(/no permite IA local/.test(radioRow) && !/>Descargar/.test(radioRow), 'OF5.1: sin IA local, la fila de la radio lo dice y no ofrece descargar');
  });

  await test('OF5.2: abrir Ajustes no carga ningún modelo', async () => {
    if (!list) return;
    const radio = countingStore({ complete: true }), voz = countingStore({ onDisk: 50 }), micro = countingStore();
    const l = list.createModelList({ rows: [
      { id: 'radio', bytes: 100, heavy: true, store: radio.store },
      { id: 'voz', bytes: 100, heavy: true, store: voz.store },
      { id: 'micro', bytes: 10, heavy: false, store: micro.store },
    ], mobile: true, persist: async () => true });
    await l.refresh();
    assert(radio.c.has === 1 && radio.c.bytes === 0, 'OF5.2: un modelo bajado se comprueba una vez, sin preguntar cuánto ocupa', JSON.stringify(radio.c));
    assert(voz.c.has === 1 && voz.c.bytes === 1, 'OF5.2: uno a medias, una vez cada cosa', JSON.stringify(voz.c));
    assert(radio.c.download + voz.c.download + micro.c.download === 0, 'OF5.2: sin descargar ni arrancar nada');
    const s = l.state();
    assert(s.radio.status === 'completa' && s.voz.status === 'cancelada' && s.micro.status === 'inactiva', 'OF5.2: cada fila con su estado', JSON.stringify({ radio: s.radio.status, voz: s.voz.status, micro: s.micro.status }));
  });

  await test('OF5.3: una descarga a la vez', async () => {
    if (!list) return;
    const radio = countingStore({ slow: true }), voz = countingStore();
    const l = list.createModelList({ rows: [
      { id: 'radio', name: 'Modelo de la radio', bytes: 100, heavy: true, store: radio.store },
      { id: 'voz', name: 'Voz de radio realista', bytes: 100, heavy: true, store: voz.store },
    ], mobile: false, persist: async () => true });
    await l.refresh();
    const first = l.start('radio');
    await tick();
    const second = await l.start('voz');
    assert(second?.ok === false && /Espera/.test(second.reason ?? '') && /radio/i.test(second.reason ?? ''), 'OF5.3: con una en marcha no empieza otra, y dice a cuál espera', JSON.stringify(second));
    assert(voz.c.download === 0, 'OF5.3: la segunda no se descarga');
    radio.release(); await first; await tick();
    const third = await l.start('voz');
    assert(third?.ok === true && voz.c.download === 1, 'OF5.3: al acabar la primera, sí', JSON.stringify(third));

    const busy = renderToStaticMarkup(createElement((await load('/src/components/AiModelList.tsx')).AiModelList, {
      rows: [{ id: 'radio', name: 'Modelo de la radio', purpose: 'Entiende tus órdenes', bytes: 100 * MB }, { id: 'voz', name: 'Voz de radio realista', purpose: 'Los pilotos hablan', bytes: 100 * MB }],
      states: { radio: { status: 'descargando', loaded: 50 * MB, total: 100 * MB, percent: 50 }, voz: { status: 'inactiva', loaded: 0, total: 100 * MB, percent: 0 } },
      active: {}, place: 'ajustes', onStart: () => {}, onCancel: () => {}, onRemove: () => {}, onActive: () => {},
    }));
    const vozRow = /data-model-row="voz"[\s\S]*$/.exec(busy)?.[0] ?? '';
    assert(/Bajando 50 %/.test(busy), 'OF5.3: la fila que baja dice «Bajando 50 %»');
    assert(/<button[^>]*disabled[^>]*>[^<]*Descargar/.test(vozRow) && /Espera/.test(vozRow), 'OF5.3: en las demás, Descargar desactivado y a qué esperan');
  });

  await test('OF5.4: un solo modelo grande, en cualquier dispositivo', async () => {
    if (!list) return;
    const make = mobile => list.createModelList({ rows: [
      { id: 'radio', bytes: 100, heavy: true, store: countingStore({ complete: true }).store },
      { id: 'voz', bytes: 100, heavy: true, store: countingStore({ complete: true }).store },
      { id: 'micro', bytes: 10, heavy: false, store: countingStore({ complete: true }).store },
    ], mobile, persist: async () => true });
    const phone = make(true);
    await phone.refresh();
    phone.setActive('radio', true); phone.setActive('micro', true);
    const r = phone.setActive('voz', true);
    const a = phone.active();
    assert(a.voz === true && a.radio === false, 'OF5.4: en el móvil, activar la voz apaga el modelo de la radio', JSON.stringify(a));
    assert(/memoria/i.test(r?.reason ?? '') && /uno/i.test(r?.reason ?? ''), 'OF5.4: y dice por qué', JSON.stringify(r));
    assert(a.micro === true, 'OF5.4: el micro sin red va con cualquiera');
    const desk = make(false);
    await desk.refresh();
    desk.setActive('voz', true); desk.setActive('micro', true); desk.setActive('radio', true);
    assert(desk.active().radio === true && desk.active().voz === false && desk.active().micro === true, 'OF5.4: en el PC, igual: activar la radio apaga la voz y el micro sigue', JSON.stringify(desk.active()));
    const empty = list.createModelList({ rows: [{ id: 'voz', bytes: 100, heavy: true, store: countingStore().store }], mobile: false, persist: async () => true });
    await empty.refresh();
    const no = empty.setActive('voz', true);
    assert(no?.ok === false && empty.active().voz !== true && /Descárgal/i.test(no.reason ?? ''), 'OF5.4: solo se activa lo que está bajado', JSON.stringify(no));
  });

  await test('OF5.5: lo activo, en las preferencias de siempre', () => {
    if (!list) return;
    const both = list.activeFromPrefs({ radioMode: 'ia', voicePref: 'piper', mobile: true });
    assert(both.radio === true && both.voz === false, 'OF5.5: con los dos grandes activos en el móvil, se queda el de la radio', JSON.stringify(both));
    const desk = list.activeFromPrefs({ radioMode: 'ia', voicePref: 'piper', mobile: false });
    assert(desk.radio === true && desk.voz === false, 'OF5.5: y en el PC, igual', JSON.stringify(desk));
    const onlyVoice = list.activeFromPrefs({ radioMode: 'basica', voicePref: 'piper', mobile: false });
    assert(onlyVoice.radio === false && onlyVoice.voz === true, 'OF5.5: con solo la voz realista, la voz', JSON.stringify(onlyVoice));
    const p = list.prefsFromActive({ radio: false, voz: true });
    assert(p.radioMode === 'basica' && p.voicePref === 'piper', 'OF5.5: radio apagada → radio básica; voz encendida → voz realista', JSON.stringify(p));
    const q = list.prefsFromActive({ radio: true, voz: false });
    assert(q.radioMode === 'ia' && q.voicePref === 'sistema', 'OF5.5: y al revés', JSON.stringify(q));
  });

  await test('OF5.6: en carrera, solo el estado', () => {
    const html = renderToStaticMarkup(createElement(RadioSettings, props({ place: 'carrera', store: fake(true) })));
    assert(/data-model-list/.test(html) && rows(html).length === 3, 'OF5.6: en carrera también se ve la lista', rows(html).join(', '));
    assert(!/>Descargar/.test(html) && !/>Borrar/.test(html), 'OF5.6: sin descargar ni borrar');
  });
}
