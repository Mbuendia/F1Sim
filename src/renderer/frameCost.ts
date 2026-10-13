// [G8][G9] Coste de pintado por fotograma (Sprint 4.5): media móvil en milisegundos de cada fase del lienzo de carrera.
// Medir cuesta unas pocas lecturas del reloj por fotograma. En desarrollo se consulta desde la consola: `__frameCost`.
export type FrameStage = 'simulacion' | 'pista' | 'clima' | 'coches' | 'resto' | 'total';

export const frameCost: { frames: number; gpu: boolean; simScale: number; ms: Record<FrameStage, number> } = {
  frames: 0, gpu: false, simScale: 1, ms: { simulacion: 0, pista: 0, clima: 0, coches: 0, resto: 0, total: 0 },
};

/** Añade una medida a la media móvil de su fase (constante de unos 60 fotogramas). */
export function recordStage(stage: FrameStage, ms: number): void {
  const previous = frameCost.ms[stage];
  frameCost.ms[stage] = frameCost.frames < 1 ? ms : previous + (ms - previous) / 60;
}

export function resetFrameCost(): void {
  frameCost.frames = 0;
  for (const stage of Object.keys(frameCost.ms) as FrameStage[]) frameCost.ms[stage] = 0;
}
