// [N4] Configuración web del proyecto de Firebase. Va en el navegador de cada jugador: lo que protege los datos son las
// reglas de acceso (database.rules.json), la sesión anónima y las restricciones de la clave en Google Cloud (webs y
// servicios permitidos), no que la clave sea secreta.
// [26/10/2026] La clave ya no está en el repositorio (GitHub la marcaba como expuesta): se lee de la variable de entorno
// VITE_FIREBASE_API_KEY, que en el equipo va en `.env.local` (git la ignora) y al publicar sale de los secretos de
// GitHub Actions. El resto son identificadores del proyecto, no secretos, y se pueden cambiar con sus variables.
// Guía: docs/multijugador.md, «Clave de Firebase».

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const value = (name: string, fallback = '') => (env[name] ?? '').trim() || fallback;

export const firebaseConfig = {
  apiKey: value('VITE_FIREBASE_API_KEY'),
  authDomain: value('VITE_FIREBASE_AUTH_DOMAIN', 'f1sim-d5085.firebaseapp.com'),
  databaseURL: value('VITE_FIREBASE_DATABASE_URL', 'https://f1sim-d5085-default-rtdb.europe-west1.firebasedatabase.app'),
  projectId: value('VITE_FIREBASE_PROJECT_ID', 'f1sim-d5085'),
  appId: value('VITE_FIREBASE_APP_ID', '1:539442261148:web:dfe2b053fdacad3c705159'),
} as const;

/** Mensaje para el jugador cuando esta versión del juego se ha compilado sin la clave. */
export const FIREBASE_MISSING = 'el multijugador no está configurado en esta versión del juego (falta la clave de Firebase)';

/** ¿Hay clave? Sin ella, el multijugador no se intenta y la sala lo dice. */
export function firebaseConfigured(config: { apiKey: string } = firebaseConfig): boolean {
  return config.apiKey.length > 0;
}
