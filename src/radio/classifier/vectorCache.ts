/**
 * [IA8] Los vectores del banco se calculan la primera vez (unos segundos) y se guardan en el navegador (IndexedDB),
 * con una clave que cambia si cambia el modelo o el banco. Sin IndexedDB (ventana privada), se recalculan cada vez.
 */
const DB = 'f1-radio';
const STORE = 'vectores';

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function loadVectors(key: string): Promise<Float32Array[] | null> {
  const db = await open();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result as { dims: number; data: Float32Array } | undefined;
        if (!v) { resolve(null); return; }
        const out: Float32Array[] = [];
        for (let i = 0; i < v.data.length; i += v.dims) out.push(v.data.slice(i, i + v.dims));
        resolve(out);
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function saveVectors(key: string, vectors: ArrayLike<number>[]): Promise<void> {
  const db = await open();
  if (!db || !vectors.length) return;
  const dims = vectors[0].length;
  const data = new Float32Array(vectors.length * dims);
  vectors.forEach((v, i) => data.set(Array.from(v), i * dims));
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear();
      store.put({ dims, data }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export async function clearVectors(): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>(resolve => {
    try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); } catch { resolve(); }
  });
}

/** Clave de los vectores: modelo, revisión y una huella del banco. */
export function vectorKey(modelId: string, revision: string, texts: string[]): string {
  let h = 2166136261;
  for (const t of texts) for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return `${modelId}@${revision}#${texts.length}:${h.toString(16)}`;
}
