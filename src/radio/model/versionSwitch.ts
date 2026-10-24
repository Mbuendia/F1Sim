/**
 * [IA7] Cambio de versión del modelo propio: con una revisión nueva en el manifiesto, el jugador que tenía la anterior
 * la sigue usando mientras no descargue la nueva; la nueva se descarga entera y solo entonces se borra la vieja. Si la
 * descarga falla, no se pierde nada.
 */
import type { ModelStore } from './ModelStore';
import type { RadioModelManifest } from './manifest';

/** Cada revisión de una versión con su tienda: la actual primero y luego las anteriores. */
export function modelRevisions(model: RadioModelManifest, storeFor: (m: RadioModelManifest) => ModelStore): { manifest: RadioModelManifest; store: ModelStore }[] {
  return [model, ...model.previousRevisions.map(revision => ({ ...model, revision, previousRevisions: [] }))].map(manifest => ({ manifest, store: storeFor(manifest) }));
}

/** Qué versión usar: la actual si está; si no, la anterior más reciente que quede (con aviso de que hay una nueva). */
export async function pickModelVersion(args: { current: ModelStore; previous: ModelStore[] }): Promise<{ store: ModelStore | null; outdated: boolean }> {
  const has = async (s: ModelStore) => { try { return await s.has(); } catch { return false; } };
  if (await has(args.current)) return { store: args.current, outdated: false };
  for (const old of args.previous) if (await has(old)) return { store: old, outdated: true };
  return { store: null, outdated: false };
}

/** Descarga la versión nueva y, solo si termina, borra las anteriores. */
export async function upgradeModel(args: {
  current: ModelStore; previous: ModelStore[]; onProgress: (loaded: number, total: number) => void; signal: AbortSignal;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await args.current.download(args.onProgress, args.signal);
    if (!(await args.current.has())) return { ok: false, error: 'La versión nueva no ha quedado guardada' };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error) };
  }
  for (const old of args.previous) { try { await old.remove(); } catch { /* ya no estaba */ } }
  return { ok: true };
}

/** Una tienda que, al descargar, hace el cambio seguro (para enchufarla a la descarga de Ajustes). */
export function upgradingStore(current: ModelStore, previous: ModelStore[]): ModelStore {
  return {
    has: () => current.has(),
    async download(onProgress, signal) {
      // Los errores de la descarga (red, cuota, cancelada) llegan tal cual a Ajustes; la vieja solo se borra al terminar.
      await current.download(onProgress, signal);
      if (!(await current.has())) return;
      for (const old of previous) { try { await old.remove(); } catch { /* ya no estaba */ } }
    },
    remove: () => current.remove(),
    bytesOnDisk: () => current.bytesOnDisk(),
  };
}
