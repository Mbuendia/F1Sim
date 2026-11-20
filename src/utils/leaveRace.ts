// [MJ9, 20/11/2026] Salir de la carrera sin errores: qué se pierde al salir según el caso, y la protección del botón o el
// gesto de atrás del móvil y de recargar o cerrar la pestaña mientras dura la carrera.
import { useEffect, useRef } from 'react';

export type LeaveKind = 'libre' | 'profesional' | 'anfitrion' | 'invitado' | 'espectador';

/** Título y explicación del aviso de salida. `saved`: hay dónde autoguardar (carrera en solitario). */
export function leaveText(kind: LeaveKind, opts: { saved?: boolean; roomCode?: string | null } = {}): { title: string; body: string; leave: string } {
  const code = opts.roomCode ? ` ${opts.roomCode}` : '';
  switch (kind) {
    case 'anfitrion':
      return { title: '¿Cerrar la sala?', body: 'Eres el anfitrión: si sales, la sala se cierra y la carrera se acaba para todos tus invitados.', leave: 'Cerrar la sala y salir' };
    case 'invitado':
      return { title: '¿Salir de la sala?', body: `Sales de la sala${code}. Mientras siga abierta puedes volver a entrar con su código; hasta entonces, el estratega lleva tus coches.`, leave: 'Salir de la sala' };
    case 'espectador':
      return { title: '¿Salir de la sala?', body: `Dejas de ver la carrera de la sala${code}. Mientras siga abierta puedes volver a entrar con su código.`, leave: 'Salir de la sala' };
    default: {
      const which = kind === 'profesional' ? 'La carrera de tu temporada' : 'La carrera';
      return opts.saved
        ? { title: '¿Salir de la carrera?', body: `${which} se guarda en «Autoguardado»: puedes seguirla desde «Cargar partida».`, leave: 'Salir' }
        : { title: '¿Salir de la carrera?', body: `${which} se pierde: no hay dónde guardarla en este navegador.`, leave: 'Salir' };
    }
  }
}

/** Marca de la entrada del historial que pone la carrera para que «atrás» no la cierre. */
export const GUARD_KEY = 'f1simCarrera';

/**
 * Mientras `active`: «atrás» (botón o gesto del móvil) llama a `onBack` en lugar de salir, y recargar o cerrar la pestaña
 * pide confirmación (el aviso es el del navegador: su texto no se puede cambiar).
 */
export function useLeaveGuard(active: boolean, onBack: () => void): void {
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    // Una entrada de más en el historial: «atrás» la gasta y se queda en la carrera (se vuelve a poner para la siguiente vez).
    const push = () => { try { history.pushState({ ...(history.state ?? {}), [GUARD_KEY]: true }, ''); } catch { /* sin historial */ } };
    if (!history.state?.[GUARD_KEY]) push();
    const onPop = () => { push(); back.current(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPop);
    };
  }, [active]);
}
