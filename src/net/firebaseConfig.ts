// [N4] Configuración web del proyecto de Firebase. Es pública por diseño (va en el navegador de cada jugador): lo que
// protege los datos son las reglas de acceso (database.rules.json) y la sesión anónima, no esta clave.
export const firebaseConfig = {
  apiKey: 'AIzaSyCgN1Mj9dFEgqN_GrmRapgebARNzkF7Nac',
  authDomain: 'f1sim-d5085.firebaseapp.com',
  databaseURL: 'https://f1sim-d5085-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'f1sim-d5085',
  appId: '1:539442261148:web:dfe2b053fdacad3c705159',
} as const;
