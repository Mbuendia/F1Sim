/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// [26/10/2026] Configuración de Firebase por variables de entorno (src/net/firebaseConfig.ts).
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

// [UX3] Versión del juego, puesta por vite.config.ts al compilar.
declare const __APP_VERSION__: string | undefined;
