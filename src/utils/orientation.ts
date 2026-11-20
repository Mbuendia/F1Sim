// [MJ1, 19/11/2026] En el móvil la carrera se juega en vertical (decisión del usuario: «Vertical»). El navegador solo
// deja bloquear la orientación con el juego instalado o en pantalla completa; si no se puede, sale un aviso para girar
// el móvil y la carrera sigue debajo («Aviso y la carrera sigue»).

/**
 * ¿Es un móvil? Pantalla táctil y, de canto, como mucho 900 px (contrato: «900 px de ancho como mucho» medido en vertical,
 * el lado corto). Para dejar fuera las tabletas grandes, el lado largo no pasa de 1000 px: un iPhone 16 Pro Max mide
 * 440 × 956; un iPad mini, 744 × 1133.
 */
export function isPhone(env: { coarse: boolean; width: number; height: number }): boolean {
  const short = Math.min(env.width, env.height), long = Math.max(env.width, env.height);
  return env.coarse && short <= 900 && long <= 1000;
}

/** ¿Hay que pedir girar el móvil? Solo en la carrera, en un móvil y con la pantalla más ancha que alta. */
export function needsRotate(env: { coarse: boolean; width: number; height: number; inRace: boolean }): boolean {
  return env.inRace && isPhone(env) && env.width > env.height;
}

type LockableOrientation = { lock?: (o: string) => Promise<void> };

/** Intenta bloquear la pantalla en vertical (instalado o en pantalla completa); si el navegador no deja, no pasa nada. */
export async function lockPortrait(orientation: LockableOrientation | undefined = typeof screen !== 'undefined' ? (screen.orientation as unknown as LockableOrientation) : undefined): Promise<boolean> {
  if (!orientation?.lock) return false;
  try { await orientation.lock('portrait'); return true; } catch { return false; }
}

/** Lo que el navegador dice ahora mismo de la pantalla. */
export function currentEnv(): { coarse: boolean; width: number; height: number } {
  if (typeof window === 'undefined') return { coarse: false, width: 1440, height: 900 };
  return { coarse: window.matchMedia?.('(pointer: coarse)').matches === true, width: window.innerWidth, height: window.innerHeight };
}
