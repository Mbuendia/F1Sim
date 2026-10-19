// [N10] Herramientas para la prueba entre redes:
//  - `?respaldo` en la dirección: esa pantalla nunca abre la conexión directa (WebRTC) y va siempre por el respaldo de
//    Firebase, para comprobar que se sigue pudiendo jugar;
//  - medidor de consumo: cuenta lo que esta pantalla escribe en Firebase y lo que recibe de él (aproximado: el tamaño
//    de los datos en JSON, sin la sobrecarga del protocolo). `?medir` lo enseña en una esquina.
import type { RoomDb } from './RoomService';
import type { DirectChannel, DirectConnector, DirectListener } from './transport/Transport';

const params = () => (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search));
export const forceFallback = () => params().has('respaldo');
export const showUsage = () => params().has('medir');

/** Conexión directa que nunca se abre: el transporte pasa solo al respaldo. */
export const blockedConnector: DirectConnector = {
  connect(): DirectChannel {
    return { isOpen: false, send() {}, onMessage() {}, onOpen() {}, onClose() {}, close() {} };
  },
};
/** Anfitrión sin conexiones directas entrantes. */
export const blockedListener: DirectListener = { listen: () => () => {} };

export interface Usage { since: number; writes: number; writeBytes: number; updates: number; readBytes: number }
export const usage: Usage = { since: Date.now(), writes: 0, writeBytes: 0, updates: 0, readBytes: 0 };
const size = (value: unknown) => (value === undefined || value === null ? 4 : JSON.stringify(value).length);

/** El mismo adaptador, contando lo que pasa por él. */
export function measured(db: RoomDb): RoomDb {
  usage.since = Date.now();
  return {
    ...db,
    uid: db.uid,
    async get(path) { const value = await db.get(path); usage.readBytes += size(value); return value; },
    async set(path, value) { usage.writes++; usage.writeBytes += size(value) + path.length; return db.set(path, value); },
    async update(path, patch) { usage.writes++; usage.writeBytes += size(patch) + path.length; return db.update(path, patch); },
    async remove(path) { usage.writes++; usage.writeBytes += path.length; return db.remove(path); },
    onValue(path, cb) { return db.onValue(path, value => { usage.updates++; usage.readBytes += size(value); cb(value); }); },
  };
}

/** Bytes por hora al ritmo medido. */
export function perHour(bytes: number, now = Date.now()) {
  const hours = Math.max(1 / 3600, (now - usage.since) / 3_600_000);
  return bytes / hours;
}
export const formatBytes = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
