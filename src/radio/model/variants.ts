/**
 * [IA10] Qué versión del modelo propio de la radio se ofrece en este dispositivo:
 *  - q0f16 (sin cuantizar, ≈ 950 MB, la más precisa) en un escritorio con WebGPU de verdad, 8 GB de memoria (o sin
 *    dato) y 1,2 GB de cuota;
 *  - q4 (4 bits, ≈ 280 MB) en el móvil, con menos memoria, poca cuota o un adaptador de respaldo (por software);
 *  - radio básica, con su motivo, sin WebGPU, con menos de 4 GB de memoria o sin sitio para guardar la pequeña.
 * El jugador puede quedarse con la pequeña aunque su equipo admita la grande (`pequena`).
 */
import { DEVICE_REASONS, MIN_BINDING, MIN_BUFFER, type Estimate } from './deviceCheck';

export type RadioVariant = 'q0f16' | 'q4';
export type VariantPreference = 'auto' | 'pequena';

const MB = 1024 * 1024;
/** Cuota mínima para guardar la pequeña (≈ 280 MB y margen) y para la grande (≈ 950 MB y margen). */
export const Q4_MIN_QUOTA = 512 * MB;
export const Q0_MIN_QUOTA = 1229 * MB;
/** La tabla de palabras de la grande es un solo bloque de ≈ 272 MB: hace falta un enlace de memoria mayor. */
export const Q0_MIN_BINDING = 512 * MB;
export const Q0_MIN_BUFFER = 512 * MB;
export const Q0_MIN_MEMORY_GB = 8;
export const MIN_MEMORY_GB = 4;

export const VARIANT_REASONS = {
  poca: 'Este dispositivo tiene poca memoria para la IA local',
  movil: 'En el móvil se usa la versión ligera de la IA',
  ligera: 'Tu equipo no da para la versión completa: se usa la ligera',
} as const;

interface AdapterLike {
  isFallbackAdapter?: boolean;
  info?: { isFallbackAdapter?: boolean };
  limits: { maxBufferSize: number; maxStorageBufferBindingSize: number };
}
export interface VariantEnv {
  gpu?: { requestAdapter(): Promise<AdapterLike | null> };
  mobile: boolean;
  /** navigator.deviceMemory (GB; Chrome no pasa de 8). Sin dato en Safari y Firefox. */
  deviceMemory?: number;
  estimate?: Estimate;
}
export interface VariantChoice {
  variant: RadioVariant | 'basica';
  /** Versiones que admite el dispositivo, la recomendada primero (vacío: radio básica). */
  options: RadioVariant[];
  reason?: string;
  mobile: boolean;
}

export async function chooseVariant(env: VariantEnv, preference: VariantPreference = 'auto'): Promise<VariantChoice> {
  const basic = (reason: string): VariantChoice => ({ variant: 'basica', options: [], reason, mobile: env.mobile });
  let adapter: AdapterLike | null = null;
  try { adapter = env.gpu ? await env.gpu.requestAdapter() : null; } catch { adapter = null; }
  if (!adapter) return basic(DEVICE_REASONS.sinWebgpu);
  if (env.deviceMemory !== undefined && env.deviceMemory < MIN_MEMORY_GB) return basic(VARIANT_REASONS.poca);
  const { maxBufferSize = 0, maxStorageBufferBindingSize = 0 } = adapter.limits ?? {};
  if (maxBufferSize < MIN_BUFFER || maxStorageBufferBindingSize < MIN_BINDING) return basic(DEVICE_REASONS.sinMemoria);
  let quota = 0;
  try { quota = env.estimate ? (await env.estimate()).quota ?? 0 : 0; } catch { quota = 0; }
  if (quota < Q4_MIN_QUOTA) return basic(DEVICE_REASONS.sinEspacio);

  const fallback = Boolean(adapter.isFallbackAdapter ?? adapter.info?.isFallbackAdapter);
  const bigOk = !env.mobile && !fallback
    && (env.deviceMemory === undefined || env.deviceMemory >= Q0_MIN_MEMORY_GB)
    && quota >= Q0_MIN_QUOTA && maxBufferSize >= Q0_MIN_BUFFER && maxStorageBufferBindingSize >= Q0_MIN_BINDING;
  const options: RadioVariant[] = bigOk ? ['q0f16', 'q4'] : ['q4'];
  const variant = preference === 'pequena' ? 'q4' : options[0];
  const reason = env.mobile ? VARIANT_REASONS.movil : bigOk ? undefined : VARIANT_REASONS.ligera;
  return { variant, options, mobile: env.mobile, ...(reason ? { reason } : {}) };
}

/** Si la versión elegida no está descargada pero la otra que admite el dispositivo sí, se usa la que ya está. */
export async function installedVariant(choice: VariantChoice, has: (v: RadioVariant) => Promise<boolean>): Promise<RadioVariant | null> {
  if (choice.variant === 'basica') return null;
  const order = [choice.variant, ...choice.options.filter(v => v !== choice.variant)];
  for (const v of order) { try { if (await has(v)) return v; } catch { /* sin caché */ } }
  return null;
}

/** El entorno del navegador para elegir versión. */
export function browserVariantEnv(): VariantEnv {
  const nav = (globalThis as unknown as { navigator?: Navigator & { gpu?: VariantEnv['gpu']; deviceMemory?: number; userAgentData?: { mobile?: boolean } } }).navigator;
  const mobile = Boolean(nav?.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(nav?.userAgent ?? ''));
  const estimate = nav?.storage?.estimate ? () => nav.storage.estimate() : undefined;
  return { gpu: nav?.gpu, mobile, deviceMemory: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : undefined, estimate };
}

/** Batería del navegador (solo Chrome en Android y escritorio); null si no se sabe. */
export async function browserBattery(): Promise<{ level: number; charging: boolean } | null> {
  try {
    const nav = (globalThis as unknown as { navigator?: { getBattery?: () => Promise<{ level: number; charging: boolean }> } }).navigator;
    const b = nav?.getBattery ? await nav.getBattery() : null;
    return b ? { level: b.level, charging: b.charging } : null;
  } catch { return null; }
}

export const RADIO_VARIANT_KEY = 'f1_radio_version';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | undefined;
export function readVariantPreference(storage: StorageLike): VariantPreference {
  try { return storage?.getItem(RADIO_VARIANT_KEY) === 'pequena' ? 'pequena' : 'auto'; } catch { return 'auto'; }
}
export function writeVariantPreference(storage: StorageLike, preference: VariantPreference): void {
  try { storage?.setItem(RADIO_VARIANT_KEY, preference); } catch { /* sin almacenamiento */ }
}
