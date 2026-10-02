// [R02] Azar del motor. Sin semilla se usa Math.random (comportamiento de siempre); con semilla, cada flujo
// (uno global y uno por coche) es un generador mulberry32 propio, de modo que el resultado no depende del orden
// en que se actualicen los coches.

export type Rng = () => number;

const defaultRng: Rng = () => Math.random();
let current: Rng = defaultRng;

/** Número aleatorio en [0, 1) del flujo activo. Los modelos del motor lo usan en lugar de Math.random. */
export function random(): number {
  return current();
}

/** Activa un flujo (o el de por defecto con `null`). */
export function useRng(rng: Rng | null): void {
  current = rng ?? defaultRng;
}

// [R28] Estado interno de cada flujo, para guardarlo: mulberry32(rngState(r)) continúa la secuencia de r.
const states = new WeakMap<Rng, { state: number }>();

export function mulberry32(seed: number): Rng {
  const box = { state: seed >>> 0 };
  const rng: Rng = () => {
    box.state = (box.state + 0x6d2b79f5) >>> 0;
    let t = box.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  states.set(rng, box);
  return rng;
}

/** Estado actual (uint32) de un flujo creado con mulberry32. */
export function rngState(rng: Rng): number {
  const box = states.get(rng);
  if (!box) throw new Error('El flujo no tiene estado reproducible (Math.random)');
  return box.state;
}

/** Semilla de un flujo a partir de la semilla de la carrera y su nombre. */
export function streamSeed(seed: number, key: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
  }
  return h;
}
