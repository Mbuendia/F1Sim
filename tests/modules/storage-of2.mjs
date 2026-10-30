// OF2 — Datos que no se borran (Sprint 13). Contrato acordado con el usuario el 29/10/2026.
// Hoy: solo la descarga de un modelo de la radio pide almacenamiento persistente (persistStorage, IA4). Las partidas
// (localStorage), los modelos 3D y el juego guardado por OF1 pueden borrarse: Safari borra todo lo de una web no
// instalada tras 7 días sin abrirla, y Chrome lo borra si le falta espacio. Firefox pregunta al jugador, así que no se
// pide al abrir la web sin más, sino en momentos con sentido.
//  1. ensurePersistent (src/offline/persist.ts): si ya es persistente no vuelve a pedirlo; si no, lo pide una vez;
//     contesta «persistente», «normal» o «sin-soporte», y nunca lanza.
//  2. Cuándo se pide: al abrir el juego instalado (pantalla de inicio, también el «standalone» de Safari), al
//     instalarlo (appinstalled), al guardar una partida y al acabar de bajar un modelo de la radio (como hasta ahora,
//     ahora con ensurePersistent). Abierto en una pestaña normal, al arrancar no se pide.
//  3. Ajustes tiene una sección «Datos guardados», después de Controles: dice si están protegidos o si el navegador
//     puede borrarlos, cuánto ocupan y cuánto cabe, y si no están protegidos ofrece «Proteger datos».
//  4. En el iPhone y el iPad con Safari sin instalar, esa sección explica que hay que añadir el juego a la pantalla
//     de inicio para que Safari no borre los modelos ni las partidas a los 7 días. Instalado, o en Android y el PC, no.
//  5. A mano en el iPhone (no en la suite): instalado en la pantalla de inicio, Ajustes dice «Protegidos».
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** navigator.storage falso: `persisted` de partida y lo que contesta `persist`. */
const fakeStorage = ({ persisted = false, grant = true, throws = false } = {}) => {
  const s = { asked: 0, state: persisted };
  s.persisted = async () => { if (throws) throw new Error('no'); return s.state; };
  s.persist = async () => { s.asked++; if (throws) throw new Error('no'); if (grant) s.state = true; return grant; };
  s.estimate = async () => ({ usage: 312 * 1024 * 1024, quota: 2048 * 1024 * 1024 });
  return s;
};

export default async function run({ server, assert, test }) {
  let persist = null;
  try { persist = await server.ssrLoadModule('/src/offline/persist.ts'); } catch (e) { assert(false, 'OF2: existe src/offline/persist.ts', e.message); }

  await test('OF2.1: pedir que no se borre', async () => {
    if (!persist) return;
    const done = fakeStorage({ persisted: true });
    assert(await persist.ensurePersistent(done) === 'persistente' && done.asked === 0, 'OF2.1: si ya es persistente, no lo vuelve a pedir', `${done.asked} peticiones`);
    const ok = fakeStorage();
    assert(await persist.ensurePersistent(ok) === 'persistente' && ok.asked === 1, 'OF2.1: si no lo es, lo pide una vez y lo consigue');
    const no = fakeStorage({ grant: false });
    assert(await persist.ensurePersistent(no) === 'normal' && no.asked === 1, 'OF2.1: si el navegador no lo concede, «normal»');
    assert(await persist.ensurePersistent(undefined) === 'sin-soporte', 'OF2.1: sin navigator.storage, «sin-soporte»');
    assert(await persist.ensurePersistent({}) === 'sin-soporte', 'OF2.1: sin persist(), «sin-soporte»');
    let threw = false, r = null;
    try { r = await persist.ensurePersistent(fakeStorage({ throws: true })); } catch { threw = true; }
    assert(!threw && r === 'normal', 'OF2.1: si el navegador falla, no lanza', String(r));
  });

  await test('OF2.2: cuándo se pide', async () => {
    if (!persist) return;
    const env = ({ standalone = false, iosStandalone = false } = {}) => {
      const e = { listeners: {}, storage: fakeStorage() };
      e.win = {
        matchMedia: q => ({ matches: standalone && /display-mode:\s*standalone/.test(q) }),
        addEventListener: (t, cb) => { (e.listeners[t] ??= []).push(cb); },
      };
      e.nav = { storage: e.storage, ...(iosStandalone ? { standalone: true } : {}) };
      return e;
    };
    const tab = env();
    await persist.askPersistOnLaunch({ nav: tab.nav, win: tab.win });
    assert(tab.storage.asked === 0, 'OF2.2: en una pestaña normal no se pide al arrancar');
    for (const cb of tab.listeners.appinstalled ?? []) await cb();
    assert(tab.storage.asked === 1, 'OF2.2: al instalar el juego (appinstalled) se pide');
    const app = env({ standalone: true });
    await persist.askPersistOnLaunch({ nav: app.nav, win: app.win });
    assert(app.storage.asked === 1, 'OF2.2: al abrir el juego instalado se pide');
    const ios = env({ iosStandalone: true });
    await persist.askPersistOnLaunch({ nav: ios.nav, win: ios.win });
    assert(ios.storage.asked === 1, 'OF2.2: también instalado en Safari (navigator.standalone)');

    const main = readFileSync('src/main.tsx', 'utf8') + readFileSync('src/offline/register.ts', 'utf8');
    assert(/askPersistOnLaunch/.test(main), 'OF2.2: el arranque llama a askPersistOnLaunch');
    const app2 = readFileSync('src/App.tsx', 'utf8');
    assert(/offline\/persist/.test(app2) && /ensurePersistent/.test(app2), 'OF2.2: guardar una partida pide que no se borre (App.tsx usa ensurePersistent)');
    const radio = readFileSync('src/radio/model/storage.ts', 'utf8');
    assert(/ensurePersistent/.test(radio), 'OF2.2: la descarga de un modelo usa ensurePersistent');
  });

  await test('OF2.3/OF2.4: Ajustes', async () => {
    if (!persist) return;
    let Storage = null;
    try { Storage = (await server.ssrLoadModule('/src/components/StorageSettings.tsx')).StorageSettings; } catch (e) { assert(false, 'OF2.3: existe src/components/StorageSettings.tsx', e.message); }
    if (!Storage) return;
    const render = props => renderToStaticMarkup(createElement(Storage, { onProtect: () => {}, ...props }));
    const prot = render({ status: { state: 'persistente', usageBytes: 312 * 1024 * 1024, quotaBytes: 2048 * 1024 * 1024 }, hint: null });
    assert(/Protegidos/.test(prot) && !/>Proteger datos</.test(prot), 'OF2.3: con datos protegidos lo dice y no ofrece el botón');
    assert(/312\s*MB/.test(prot) && /2[.,]?0?\s*GB|2048\s*MB/.test(prot), 'OF2.3: dice cuánto ocupan y cuánto cabe', prot.replace(/<[^>]+>/g, ' ').slice(0, 200));
    const loose = render({ status: { state: 'normal', usageBytes: 10 * 1024 * 1024, quotaBytes: 1024 * 1024 * 1024 }, hint: null });
    assert(/puede borrarlos/i.test(loose) && />Proteger datos</.test(loose), 'OF2.3: sin proteger lo dice y ofrece «Proteger datos»');

    const hint = persist.installHint;
    const ip = hint({ userAgent: IPHONE, standalone: false, maxTouchPoints: 5 });
    assert(typeof ip === 'string' && /pantalla de inicio/i.test(ip) && /7 días/.test(ip), 'OF2.4: en el iPhone sin instalar explica cómo evitar el borrado a los 7 días', String(ip));
    assert(typeof hint({ userAgent: IPAD, standalone: false, maxTouchPoints: 5 }) === 'string', 'OF2.4: también en el iPad (se presenta como Mac con pantalla táctil)');
    assert(hint({ userAgent: IPHONE, standalone: true, maxTouchPoints: 5 }) === null, 'OF2.4: instalado, sin aviso');
    assert(hint({ userAgent: IPAD, standalone: false, maxTouchPoints: 0 }) === null, 'OF2.4: en un Mac de verdad, sin aviso');
    assert(hint({ userAgent: ANDROID, standalone: false, maxTouchPoints: 5 }) === null && hint({ userAgent: PC, standalone: false, maxTouchPoints: 0 }) === null, 'OF2.4: en Android y el PC, sin aviso');
    const withHint = render({ status: { state: 'normal', usageBytes: 0, quotaBytes: 0 }, hint: ip });
    assert(withHint.includes('pantalla de inicio'), 'OF2.4: la sección enseña el aviso');

    const SettingsScreen = (await server.ssrLoadModule('/src/components/SettingsScreen.tsx')).default;
    const { createFakeModelStore } = await server.ssrLoadModule('/src/radio/model/ModelStore.ts');
    const html = renderToStaticMarkup(createElement(SettingsScreen, { onBack: () => {}, radioProps: { store: createFakeModelStore({ totalBytes: 10, chunkBytes: 10 }), choice: { variant: 'q0f16', options: ['q0f16'], mobile: false }, estimate: async () => ({ quota: 1e10, usage: 0 }), initialMode: 'basica', remember: false } }));
    const iControls = html.indexOf('Controles'), iData = html.indexOf('Datos guardados');
    assert(iData > iControls && iControls >= 0, 'OF2.3: Ajustes tiene «Datos guardados» después de Controles', `${iControls} / ${iData}`);
  });
}
