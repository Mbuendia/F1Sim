import { lazy, Suspense, useEffect, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { codeFromLink } from './net/roomCode';
import { markLoad } from './perf/loadMarks';

/**
 * [PF8, LCP] Arranque ligero: lo primero que se pinta es la portada, que solo necesita React y su propio código; el
 * juego entero (App, el motor, las pantallas) se carga aparte y se precarga con la primera señal de que se va a jugar,
 * así que al pulsar «Jugar» normalmente ya está. Con un enlace de sala se entra directo al juego, como antes.
 * Antes la portada esperaba a bajar y ejecutar todo el juego: LCP de 5 s en un móvil con 4G lenta.
 */
const App = lazy(() => import('./App'));
// [OF3] Aviso de versión nueva, en todas las pantallas (también la portada); se carga aparte, tras el primer pintado.
const UpdateNotice = lazy(() => import('./components/UpdateNotice'));
const notice = <Suspense fallback={null}><UpdateNotice /></Suspense>;

/** Con un enlace de sala (?sala=…) no se enseña la portada. */
export function startsInGame(href: string): boolean {
  return codeFromLink(href) !== null;
}

/**
 * Precarga del juego con la primera señal de que se va a jugar (mover el puntero, tocar o pulsar una tecla). Al medir,
 * precargarlo en cuanto el navegador quedaba libre metía más de un segundo de trabajo en un móvil justo después del primer
 * pintado (TBT de 586 ms a 1,6 s); así ese trabajo solo llega cuando alguien está delante.
 */
const INTENT = ['pointermove', 'pointerdown', 'touchstart', 'keydown'] as const;
function onFirstIntent(fn: () => void): () => void {
  let done = false;
  const fire = () => { if (done) return; done = true; off(); fn(); };
  const off = () => { for (const type of INTENT) window.removeEventListener(type, fire); };
  for (const type of INTENT) window.addEventListener(type, fire, { passive: true, once: true });
  return off;
}

export default function Root() {
  const [inGame, setInGame] = useState(() => typeof location !== 'undefined' && startsInGame(location.href));
  // [PF1] Marca de carga: la primera pantalla del juego está lista.
  useEffect(() => { markLoad('menu'); }, []);
  useEffect(() => onFirstIntent(() => { void import('./App'); }), []);
  if (!inGame) return <><LandingPage onEnter={() => setInGame(true)} />{notice}</>;
  return (
    <Suspense fallback={<div role="status" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0b0e13', color: '#9aa4b2', font: '600 14px system-ui' }}>Cargando el paddock…</div>}>
      <App startAt="menu" />
      {notice}
    </Suspense>
  );
}
