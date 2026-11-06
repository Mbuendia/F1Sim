/**
 * [OF5] Los modelos de IA en una lista (Ajustes): el de la radio, la voz realista y el micro sin red. Cada fila con su
 * descarga (la de UX4) y el estado que se comprueba una sola vez al abrir Ajustes, sin cargar ningún modelo.
 * Reglas, en cualquier dispositivo: una descarga a la vez, y un solo modelo grande activo en carrera (el de la radio o
 * la voz realista: los dos a la vez no caben en la memoria de un móvil y cargan mucho un PC); el micro va con cualquiera.
 */
import { createModelDownload, type DownloadState, type ModelDownload, type ModelDownloadDeps } from './download';
import type { ModelStore } from './ModelStore';
import type { RadioMode } from './storage';

export type ModelId = 'radio' | 'voz' | 'micro';
export type ModelStates = Partial<Record<ModelId, DownloadState>>;
export type ActiveModels = Partial<Record<ModelId, boolean>>;

export interface ModelRowSpec {
  id: ModelId;
  name?: string;
  bytes: number;
  /** Modelo grande: solo uno activo a la vez. */
  heavy: boolean;
  store: ModelStore;
  /** La descarga ya creada (la compartida de toda la página, UX4); sin ella, se crea una. */
  download?: ModelDownload;
}

export interface ListResult { ok: boolean; reason?: string; off?: ModelId[] }

const nameOf = (row: { id: ModelId; name?: string }) => (row.name ?? row.id).toLowerCase();

export function createModelList({ rows, persist, estimate, initialActive = {} }: {
  rows: ModelRowSpec[];
  /** Lo activo al abrir (de las preferencias de siempre, con activeFromPrefs). */
  initialActive?: ActiveModels;
  /** Ya no cambia las reglas (valen en todos los dispositivos); se conserva para quien lo pase. */
  mobile?: boolean;
  persist: ModelDownloadDeps['persist'];
  estimate?: ModelDownloadDeps['estimate'];
}) {
  const downloads = new Map<ModelId, ModelDownload>(rows.map(r => [r.id, r.download ?? createModelDownload({ store: r.store, totalBytes: r.bytes, estimate, persist })]));
  let active: ActiveModels = { ...initialActive };
  const row = (id: ModelId) => rows.find(r => r.id === id);
  const state = (): ModelStates => Object.fromEntries([...downloads].map(([id, d]) => [id, d.state()]));
  const downloading = (except?: ModelId) => rows.find(r => r.id !== except && downloads.get(r.id)?.state().status === 'descargando');

  return {
    state,
    active: (): ActiveModels => ({ ...active }),
    /** Al abrir Ajustes: el estado de cada fila, comprobado una sola vez. */
    async refresh() { await Promise.all([...downloads.values()].map(d => d.refresh())); },
    /** Empieza una descarga, si no hay otra en marcha. */
    async start(id: ModelId): Promise<ListResult> {
      const other = downloading(id);
      if (other) return { ok: false, reason: `Espera a que acabe la descarga de ${nameOf(other)}` };
      const d = downloads.get(id);
      if (!d) return { ok: false, reason: 'Ese modelo no está en la lista' };
      await d.start();
      return { ok: true };
    },
    cancel(id: ModelId) { downloads.get(id)?.cancel(); },
    async remove(id: ModelId) { active = { ...active, [id]: false }; await downloads.get(id)?.remove(); },
    /** Activa o apaga un modelo para la carrera. Activar uno grande apaga el otro. */
    setActive(id: ModelId, on: boolean): ListResult {
      const spec = row(id);
      if (!spec) return { ok: false, reason: 'Ese modelo no está en la lista' };
      if (!on) { active = { ...active, [id]: false }; return { ok: true }; }
      if (downloads.get(id)?.state().status !== 'completa') return { ok: false, reason: 'Descárgalo primero' };
      const off = spec.heavy ? rows.filter(r => r.heavy && r.id !== id && active[r.id]).map(r => r.id) : [];
      active = { ...active, [id]: true, ...Object.fromEntries(off.map(o => [o, false])) };
      const reason = off.length ? `Solo cabe uno de los dos en memoria a la vez: se apaga ${off.map(o => nameOf(row(o)!)).join(' y ')}` : undefined;
      return { ok: true, off, ...(reason ? { reason } : {}) };
    },
  };
}

/** Lo activo según las preferencias de siempre; con los dos grandes encendidos, se queda el de la radio. */
export function activeFromPrefs({ radioMode, voicePref }: { radioMode: RadioMode; voicePref: 'piper' | 'sistema'; mobile?: boolean }): ActiveModels {
  const radio = radioMode === 'ia';
  return { radio, voz: voicePref === 'piper' && !radio };
}

/** Las preferencias de siempre a partir de lo activo (así la carrera usa lo elegido). */
export function prefsFromActive(active: ActiveModels): { radioMode: RadioMode; voicePref: 'piper' | 'sistema' } {
  return { radioMode: active.radio ? 'ia' : 'basica', voicePref: active.voz ? 'piper' : 'sistema' };
}
