// N10: lo que Firebase Realtime Database hace con lo que se guarda, para que los tests lo vean. Al escribir quita los
// null y las listas u objetos vacíos (no se guardan), y las listas se guardan como objetos con claves 0, 1, 2…; al
// leerlas vuelven como lista solo si más de la mitad de las posiciones existen (los huecos, como null). La base
// simulada de N4 (fakeDb.mjs) no lo hace: esta envoltura sí.
import { createFakeServer } from './fakeDb.mjs';

export function firebaseTransform(value) {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const out = {};
    value.forEach((x, i) => { const y = firebaseTransform(x); if (y !== undefined) out[i] = y; });
    const keys = Object.keys(out).map(Number);
    if (!keys.length) return undefined;
    const max = Math.max(...keys);
    return keys.length * 2 > max + 1 ? Array.from({ length: max + 1 }, (_, i) => (i in out ? out[i] : null)) : out;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(value)) { const y = firebaseTransform(x); if (y !== undefined) out[k] = y; }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

/** Base simulada que guarda como Firebase. */
export function createFirebaseLikeServer() {
  const fake = createFakeServer();
  const client = fake.client;
  fake.client = uid => {
    const db = client(uid);
    const set = db.set, update = db.update;
    db.set = (path, value) => set(path, firebaseTransform(value) ?? null);
    db.update = (path, patch) => update(path, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, firebaseTransform(v) ?? null])));
    return db;
  };
  return fake;
}
