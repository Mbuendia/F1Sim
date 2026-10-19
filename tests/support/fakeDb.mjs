// N4: base de datos en tiempo real simulada para los tests de salas. Imita lo que usa RoomService de Firebase:
// leer, escribir, actualizar, borrar, transacción, escuchar una ruta y «borrar al desconectar». No comprueba reglas
// de acceso (eso es del emulador o de la revisión manual): solo el comportamiento de los datos.
const parts = path => path.split('/').filter(Boolean);
const clone = v => (v === undefined ? null : structuredClone(v));

export function createFakeServer() {
  let root = null;
  const listeners = new Set(); // { path, cb, client }
  const read = path => {
    let node = root;
    for (const key of parts(path)) { if (node == null || typeof node !== 'object') return null; node = node[key]; }
    return node === undefined ? null : node;
  };
  const prune = node => {
    if (node == null || typeof node !== 'object' || Array.isArray(node)) return node;
    for (const k of Object.keys(node)) { node[k] = prune(node[k]); if (node[k] == null) delete node[k]; }
    return Object.keys(node).length ? node : null;
  };
  const write = (path, value) => {
    const keys = parts(path);
    if (!keys.length) { root = prune(clone(value)); return notify(); }
    root = root && typeof root === 'object' ? root : {};
    let node = root;
    for (const k of keys.slice(0, -1)) { if (node[k] == null || typeof node[k] !== 'object') node[k] = {}; node = node[k]; }
    node[keys.at(-1)] = clone(value);
    root = prune(root);
    notify();
  };
  const notify = () => { for (const l of [...listeners]) if (listeners.has(l)) l.cb(clone(read(l.path))); };
  const writes = [];

  const client = uid => {
    const pending = new Set();
    let online = true;
    const guard = () => { if (!online) throw new Error('desconectado'); };
    const db = {
      uid,
      async get(path) { guard(); return clone(read(path)); },
      async set(path, value) { guard(); writes.push({ uid, path, op: 'set', value: clone(value) }); write(path, value); },
      async update(path, patch) {
        guard(); writes.push({ uid, path, op: 'update', value: clone(patch) });
        const base = read(path); const next = { ...(base && typeof base === 'object' ? base : {}) };
        for (const [k, v] of Object.entries(patch)) next[k] = v;
        write(path, next);
      },
      async remove(path) { guard(); writes.push({ uid, path, op: 'remove' }); write(path, null); },
      async transaction(path, fn) {
        guard();
        const next = fn(clone(read(path)));
        if (next === undefined) return { committed: false, value: clone(read(path)) };
        writes.push({ uid, path, op: 'transaction', value: clone(next) });
        write(path, next);
        return { committed: true, value: clone(next) };
      },
      onValue(path, cb) {
        const l = { path, cb, client: db };
        listeners.add(l); cb(clone(read(path)));
        return () => listeners.delete(l);
      },
      async onDisconnectRemove(path) { guard(); pending.add(path); },
      async cancelOnDisconnect(path) { guard(); pending.delete(path); },
      /** Solo para los tests: corta la conexión de este cliente; el servidor ejecuta sus «borrar al desconectar». */
      disconnect() {
        online = false;
        for (const l of [...listeners]) if (l.client === db) listeners.delete(l);
        for (const path of pending) write(path, null);
        pending.clear();
      },
      get pendingOnDisconnect() { return [...pending]; },
    };
    return db;
  };
  return { client, read: path => clone(read(path)), writes, write };
}
