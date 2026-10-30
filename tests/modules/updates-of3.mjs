// OF3 — Avisos de versión nueva (Sprint 13). Contrato acordado con el usuario el 29/10/2026.
// Con OF1, el juego sale de la caché: una versión publicada nueva se baja sola en segundo plano, pero no se usa hasta
// que se cierran todas las pestañas. OF3 avisa y deja actualizar con un toque. Lo que no se puede perder es una
// carrera a medias (vive en la memoria); la temporada y las partidas ya se guardan solas con cada cambio (T4.19).
//  1. El service worker nuevo espera: al instalarse no toma el control (nunca skipWaiting por su cuenta); solo
//     cuando la página se lo pide ({ type: 'skip-waiting' }).
//  2. watchForUpdates avisa cuando hay una versión nueva esperando: la que ya estaba al abrir y la que llega mientras
//     se juega. La primera instalación (sin versión anterior) no es una versión nueva.
//  3. Busca versión nueva al volver a la pestaña y cada hora; sin conexión no lo intenta y un fallo no rompe nada.
//  4. applyUpdate pide al service worker nuevo que tome el control y recarga la página una sola vez.
//  5. Durante una carrera no se actualiza: el aviso dice que se podrá al acabar y no tiene botón; fuera de carrera
//     dice que la partida está guardada y ofrece «Actualizar» y «Más tarde». «Más tarde» lo esconde hasta la
//     siguiente versión. Sin versión nueva no se ve nada.
//  6. El aviso se ve en todo el juego (lo monta Root, también en la portada) y App le dice cuándo hay carrera.
//  7. A mano (no en la suite): con el juego instalado se publica una versión, aparece el aviso, se actualiza y la
//     temporada sigue igual.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const tick = () => new Promise(r => setTimeout(r, 0));

/** Registro de service worker falso con sus eventos. */
function fakeReg({ waiting = null } = {}) {
  const reg = { waiting, installing: null, listeners: {}, updates: 0, failUpdate: false };
  reg.addEventListener = (t, cb) => { (reg.listeners[t] ??= []).push(cb); };
  reg.removeEventListener = (t, cb) => { reg.listeners[t] = (reg.listeners[t] ?? []).filter(f => f !== cb); };
  reg.update = async () => { reg.updates++; if (reg.failUpdate) throw new Error('sin red'); };
  reg.emit = t => (reg.listeners[t] ?? []).forEach(cb => cb());
  return reg;
}
function fakeWorker(state = 'installing') {
  const w = { state, listeners: {}, posted: [] };
  w.addEventListener = (t, cb) => { (w.listeners[t] ??= []).push(cb); };
  w.postMessage = m => w.posted.push(m);
  w.become = s => { w.state = s; (w.listeners.statechange ?? []).forEach(cb => cb()); };
  return w;
}
function fakePage({ controller = true, online = true } = {}) {
  const p = { listeners: {}, swListeners: {}, reloads: 0, timers: [], cleared: 0 };
  p.doc = { visibilityState: 'visible', addEventListener: (t, cb) => { (p.listeners[t] ??= []).push(cb); }, removeEventListener: () => {} };
  p.win = {
    document: p.doc,
    location: { reload: () => { p.reloads++; } },
    setInterval: (cb, ms) => { p.timers.push({ cb, ms }); return p.timers.length; },
    clearInterval: () => { p.cleared++; },
  };
  p.nav = { onLine: online, serviceWorker: {
    controller: controller ? {} : null,
    addEventListener: (t, cb) => { (p.swListeners[t] ??= []).push(cb); },
  } };
  p.emitSw = t => (p.swListeners[t] ?? []).forEach(cb => cb());
  return p;
}

export default async function run({ server, assert, test }) {
  let core = null, up = null, store = null;
  try { core = await server.ssrLoadModule('/src/offline/swCore.ts'); } catch (e) { assert(false, 'OF3: existe src/offline/swCore.ts (OF1)', e.message); }
  try { up = await server.ssrLoadModule('/src/offline/updates.ts'); } catch (e) { assert(false, 'OF3: existe src/offline/updates.ts', e.message); }
  try { store = await server.ssrLoadModule('/src/offline/updateStore.ts'); } catch (e) { assert(false, 'OF3: existe src/offline/updateStore.ts', e.message); }

  await test('OF3.1: la versión nueva espera', async () => {
    if (!core) return;
    let skips = 0;
    const caches = { stores: new Map(), async open(n) { if (!this.stores.has(n)) this.stores.set(n, new Map()); const m = this.stores.get(n); return { put: async (r, res) => m.set(r.url ?? r, res), match: async r => m.get(r.url ?? r), keys: async () => [...m.keys()].map(u => new Request(u)), delete: async r => m.delete(r.url ?? r) }; }, async keys() { return [...this.stores.keys()]; }, async delete(n) { return this.stores.delete(n); }, async has(n) { return this.stores.has(n); } };
    const sw = core.createOfflineWorker({
      manifest: { version: 'v9', base: '/F1Sim/', core: ['/F1Sim/index.html'], ai: [] },
      caches, fetch: async () => new Response('x'), origin: 'https://juego.test',
      clients: { async claim() {} }, skipWaiting: async () => { skips++; },
    });
    await sw.install();
    assert(skips === 0, 'OF3.1: al instalarse no toma el control por su cuenta');
    await sw.message({ type: 'skip-waiting' });
    assert(skips === 1, 'OF3.1: lo toma cuando la página se lo pide');
  });

  await test('OF3.2/OF3.3: detectar la versión nueva', async () => {
    if (!up) return;
    // Ya había una esperando al abrir.
    const p1 = fakePage(), r1 = fakeReg({ waiting: fakeWorker('installed') });
    const seen1 = [];
    up.watchForUpdates({ registration: r1, nav: p1.nav, win: p1.win, onUpdate: w => seen1.push(w) });
    assert(seen1.length === 1 && seen1[0] === r1.waiting, 'OF3.2: avisa de la versión que ya esperaba al abrir');
    // Llega mientras se juega.
    const p2 = fakePage(), r2 = fakeReg();
    const seen2 = [];
    const stop = up.watchForUpdates({ registration: r2, nav: p2.nav, win: p2.win, onUpdate: w => seen2.push(w) });
    const w2 = fakeWorker();
    r2.installing = w2; r2.emit('updatefound');
    assert(seen2.length === 0, 'OF3.2: no avisa mientras se está bajando');
    w2.become('installed');
    assert(seen2.length === 1 && seen2[0] === w2, 'OF3.2: avisa cuando la versión nueva está lista');
    // Primera instalación: no hay versión anterior.
    const p3 = fakePage({ controller: false }), r3 = fakeReg();
    const seen3 = [];
    up.watchForUpdates({ registration: r3, nav: p3.nav, win: p3.win, onUpdate: w => seen3.push(w) });
    const w3 = fakeWorker(); r3.installing = w3; r3.emit('updatefound'); w3.become('installed');
    assert(seen3.length === 0, 'OF3.2: la primera instalación no es una versión nueva');

    // Buscar versión nueva.
    const hourly = p2.timers.find(t => t.ms === 60 * 60 * 1000);
    assert(!!hourly, 'OF3.3: busca versión nueva cada hora', p2.timers.map(t => t.ms).join(', '));
    const before = r2.updates;
    hourly?.cb(); await tick();
    p2.doc.visibilityState = 'visible'; (p2.listeners.visibilitychange ?? []).forEach(cb => cb()); await tick();
    assert(r2.updates === before + 2, 'OF3.3: cada hora y al volver a la pestaña', `${r2.updates - before} búsquedas`);
    p2.doc.visibilityState = 'hidden'; (p2.listeners.visibilitychange ?? []).forEach(cb => cb()); await tick();
    assert(r2.updates === before + 2, 'OF3.3: al irse de la pestaña no busca');
    p2.nav.onLine = false; hourly?.cb(); await tick();
    assert(r2.updates === before + 2, 'OF3.3: sin conexión no lo intenta');
    p2.nav.onLine = true; r2.failUpdate = true;
    let threw = false;
    try { hourly?.cb(); await tick(); await tick(); } catch { threw = true; }
    assert(!threw, 'OF3.3: si la búsqueda falla, no rompe nada');
    assert(typeof stop === 'function', 'OF3.3: watchForUpdates devuelve con qué pararlo');
    stop?.();
    assert(p2.cleared >= 1, 'OF3.3: al pararlo deja de buscar');
  });

  await test('OF3.4: actualizar', async () => {
    if (!up) return;
    const p = fakePage(), w = fakeWorker('installed');
    up.applyUpdate({ waiting: w, nav: p.nav, win: p.win });
    assert(w.posted.some(m => m?.type === 'skip-waiting'), 'OF3.4: pide a la versión nueva que tome el control');
    assert(p.reloads === 0, 'OF3.4: no recarga antes de que la versión nueva mande');
    p.emitSw('controllerchange');
    p.emitSw('controllerchange');
    assert(p.reloads === 1, 'OF3.4: recarga una sola vez', `${p.reloads} recargas`);
  });

  await test('OF3.5: el aviso', async () => {
    if (!store) return;
    const s = store.createUpdateStore();
    const w1 = fakeWorker('installed');
    assert(s.getState().available === false, 'OF3.5: sin versión nueva no hay aviso');
    s.getState().setAvailable(w1);
    assert(s.getState().available === true, 'OF3.5: con versión nueva hay aviso');
    s.getState().setInRace(true);
    assert(s.getState().requestUpdate() === false && w1.posted.length === 0, 'OF3.5: durante una carrera no se actualiza');
    s.getState().setInRace(false);
    s.getState().dismiss();
    assert(s.getState().available === false, 'OF3.5: «Más tarde» lo esconde');
    s.getState().setAvailable(w1);
    assert(s.getState().available === false, 'OF3.5: la misma versión no vuelve a avisar tras «Más tarde»');
    s.getState().setAvailable(fakeWorker('installed'));
    assert(s.getState().available === true, 'OF3.5: la siguiente versión sí avisa');

    let Notice = null;
    try { Notice = (await server.ssrLoadModule('/src/components/UpdateNotice.tsx')).UpdateNotice; } catch (e) { assert(false, 'OF3.5: existe src/components/UpdateNotice.tsx', e.message); }
    if (!Notice) return;
    const render = props => renderToStaticMarkup(createElement(Notice, { onUpdate: () => {}, onLater: () => {}, ...props }));
    assert(render({ available: false, inRace: false }) === '', 'OF3.5: sin versión nueva no se pinta nada');
    const free = render({ available: true, inRace: false });
    assert(/versión nueva/i.test(free) && /partida está guardada/i.test(free), 'OF3.5: fuera de carrera avisa y dice que la partida está guardada');
    assert(/>Actualizar</.test(free) && />Más tarde</.test(free), 'OF3.5: con «Actualizar» y «Más tarde»');
    assert(/role="status"/.test(free), 'OF3.5: el aviso se anuncia (role="status")');
    const race = render({ available: true, inRace: true });
    assert(/al acabar la carrera/i.test(race) && !/>Actualizar</.test(race), 'OF3.5: en carrera dice que se podrá al acabar y no tiene botón');
  });

  await test('OF3.6: dónde se ve', () => {
    const root = readFileSync('src/Root.tsx', 'utf8');
    assert(/UpdateNotice/.test(root), 'OF3.6: Root monta el aviso (también en la portada)');
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/setInRace/.test(app), 'OF3.6: App le dice al aviso cuándo hay carrera');
    const reg = readFileSync('src/offline/register.ts', 'utf8');
    assert(/watchForUpdates/.test(reg), 'OF3.6: el registro del service worker vigila las versiones');
  });
}
