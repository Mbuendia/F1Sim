// [N4] Adaptador de RoomService sobre Firebase: solo los módulos de base de datos en tiempo real y de sesión.
// Se carga con import() cuando el jugador abre el modo compartido, para que la partida de un jugador no lo descargue.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, onValue, onDisconnect,
} from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';
import type { RoomDb } from './RoomService';

export interface ConnectOptions {
  /** Para pruebas locales: base de datos del emulador (p. ej. { host: '127.0.0.1', port: 9000 }). */
  emulator?: { host: string; port: number };
}

const isPermissionDenied = (error: unknown) => /permission[_ -]?denied/i.test(String((error as { code?: string; message?: string })?.code ?? (error as Error)?.message ?? error));

/** Inicia sesión anónima y devuelve el adaptador de base de datos para RoomService. */
export async function connectFirebase(options: ConnectOptions = {}): Promise<RoomDb> {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const { user } = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
  const database = getDatabase(app);
  if (options.emulator) connectDatabaseEmulator(database, options.emulator.host, options.emulator.port);
  const at = (path: string) => ref(database, path);

  return {
    uid: user.uid,
    async get(path) { const snap = await get(at(path)); return snap.exists() ? snap.val() : null; },
    async set(path, value) { await set(at(path), value); },
    async update(path, patch) { await update(at(path), patch); },
    async remove(path) { await remove(at(path)); },
    async transaction(path, fn) {
      try {
        const result = await runTransaction(at(path), current => fn(current ?? null), { applyLocally: false });
        return { committed: result.committed, value: result.snapshot.val() };
      } catch (error) {
        // Sala ocupada por otro: las reglas no dejan leerla ni escribirla, así que el código no está libre.
        if (isPermissionDenied(error)) return { committed: false, value: null };
        throw error;
      }
    },
    onValue(path, cb) {
      // Si se pierde el permiso de lectura (p. ej. la sala se cierra), la escucha se corta: se trata como vacío.
      return onValue(at(path), snap => cb(snap.exists() ? snap.val() : null), () => cb(null));
    },
    async onDisconnectRemove(path) { await onDisconnect(at(path)).remove(); },
    async cancelOnDisconnect(path) { await onDisconnect(at(path)).cancel(); },
  };
}
