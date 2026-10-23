/**
 * [IA4] ¿Puede este dispositivo usar la radio con IA? `completo` (WebGPU con memoria suficiente y sitio para guardar
 * el modelo), `movil` (lo mismo en un móvil: se ofrece con aviso) o `no-apto`, con un motivo que se lee claro.
 * La prueba corta de velocidad (≥ 15 tokens/s) se añade en IA5.
 */
export const DEVICE_REASONS = {
  sinWebgpu: 'Tu navegador no permite IA local (sin WebGPU)',
  sinMemoria: 'Tu tarjeta gráfica no tiene memoria suficiente',
  sinEspacio: 'Ventana privada o poco espacio: no se puede guardar el modelo',
  movil: 'En el móvil gasta memoria y batería: mejor con el cargador puesto',
} as const;

const MB = 1024 * 1024;
export const MIN_BUFFER = 256 * MB;
export const MIN_BINDING = 128 * MB;
export const MIN_QUOTA = 1024 * MB;

export interface GpuLike { requestAdapter(): Promise<{ limits: { maxBufferSize: number; maxStorageBufferBindingSize: number } } | null> }
export type Estimate = () => Promise<{ quota?: number; usage?: number }>;
export interface DeviceEnv { gpu?: GpuLike; mobile: boolean; estimate?: Estimate }
export interface DeviceResult { kind: 'completo' | 'movil' | 'no-apto'; reason?: string }

export async function classifyDevice(env: DeviceEnv): Promise<DeviceResult> {
  let adapter: Awaited<ReturnType<GpuLike['requestAdapter']>> = null;
  try { adapter = env.gpu ? await env.gpu.requestAdapter() : null; } catch { adapter = null; }
  if (!adapter) return { kind: 'no-apto', reason: DEVICE_REASONS.sinWebgpu };
  const { maxBufferSize = 0, maxStorageBufferBindingSize = 0 } = adapter.limits ?? {};
  if (maxBufferSize < MIN_BUFFER || maxStorageBufferBindingSize < MIN_BINDING) return { kind: 'no-apto', reason: DEVICE_REASONS.sinMemoria };
  let quota = 0;
  try { quota = env.estimate ? (await env.estimate()).quota ?? 0 : 0; } catch { quota = 0; }
  if (quota < MIN_QUOTA) return { kind: 'no-apto', reason: DEVICE_REASONS.sinEspacio };
  return env.mobile ? { kind: 'movil', reason: DEVICE_REASONS.movil } : { kind: 'completo' };
}

/**
 * [IA8] El clasificador por ejemplos no necesita WebGPU (va en WASM): solo sitio para guardar el modelo (≈ 130 MB,
 * se pide 1 GB de cuota como en IA4). En el móvil se ofrece con el aviso de memoria y batería.
 */
export async function classifyClassifierDevice(env: DeviceEnv): Promise<DeviceResult> {
  let quota = 0;
  try { quota = env.estimate ? (await env.estimate()).quota ?? 0 : 0; } catch { quota = 0; }
  if (quota < MIN_QUOTA) return { kind: 'no-apto', reason: DEVICE_REASONS.sinEspacio };
  return env.mobile ? { kind: 'movil', reason: DEVICE_REASONS.movil } : { kind: 'completo' };
}

/** El entorno del navegador (sin nada en el servidor o en los tests). */
export function browserDeviceEnv(): DeviceEnv {
  const nav = (globalThis as unknown as { navigator?: Navigator & { gpu?: GpuLike; userAgentData?: { mobile?: boolean } } }).navigator;
  const mobile = Boolean(nav?.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(nav?.userAgent ?? ''));
  const estimate = nav?.storage?.estimate ? () => nav.storage.estimate() : undefined;
  return { gpu: nav?.gpu, mobile, estimate };
}
