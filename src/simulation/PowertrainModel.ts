// [R16] Frenos con ventana térmica y energía de fricción, motor con refrigeración afectada por la estela y caja de
// 8 marchas. Calibración del juego (no son cifras de ningún fabricante ni de la FIA).

/** Ventana de trabajo de los discos de carbono (°C). */
export const BRAKE_WINDOW = { min: 350, max: 1000 };

/** Deceleración relativa por temperatura de freno: completa en la ventana, menor en frío y con fatiga. */
export function brakeDecelFactor(tempC: number): number {
  if (tempC < BRAKE_WINDOW.min) return Math.max(0.75, 1 - (BRAKE_WINDOW.min - tempC) * 0.0025);
  if (tempC > BRAKE_WINDOW.max) return Math.max(0.7, 1 - (tempC - BRAKE_WINDOW.max) * 0.004);
  return 1;
}

/**
 * Temperatura de freno tras `dt`: la potencia de fricción (la frenada que no recupera el MGU-K) calienta; el aire
 * enfría, menos en la estela de otro coche (`wake` 0..1).
 */
export function brakeTempStep(tempC: number, frictionMW: number, speedKmh: number, wake: number, dt: number): number {
  const ambient = 280 + Math.min(1, speedKmh / 350) * 80;
  const target = ambient + Math.max(0, frictionMW) * 220;
  const rate = target > tempC ? 2.5 : (speedKmh > 100 ? 2.5 : 1.2) * (1 - 0.4 * wake);
  const next = tempC + (target - tempC) * Math.min(1, dt * rate);
  return Math.max(250, Math.min(1080, next));
}

/** Temperatura del motor tras `dt` según modo, RPM, velocidad y estela (menos aire en los radiadores). */
export function engineTempStep(tempC: number, mode: string, rpm: number, speedKmh: number, wake: number, dt: number,
  cooling = 1): number {
  let heat = mode === 'push' ? 108 : mode === 'overtake' ? 118 : mode === 'low' ? 88 : 95;
  heat += (rpm - 10000) / 3600 * 4;
  if (speedKmh > 300) heat += 3;
  heat += 6 * wake;
  // [R17] La eficiencia de refrigeración del chasis acelera el enfriamiento y reduce la carga térmica en estela.
  heat -= (cooling - 1) * 10;
  const coolRate = (0.8 + (speedKmh / 350) * 0.6) * (1 - 0.35 * wake) * cooling;
  const next = tempC + (heat - tempC) * Math.min(1, dt * coolRate);
  return Math.max(80, Math.min(135, next));
}

/** Velocidad máxima de cada marcha (km/h) a las RPM de cambio; índice = marcha (1..8). */
export const GEAR_TOP_KMH = [0, 90, 125, 160, 195, 230, 265, 300, 345];
export const SHIFT_RPM = 12000;

export function gearFor(speedKmh: number): number {
  for (let gear = 1; gear < 8; gear++) if (speedKmh < GEAR_TOP_KMH[gear]) return gear;
  return 8;
}

/** RPM proporcionales a la velocidad dentro de la marcha (relación fija), entre 4000 y 15000. */
export function rpmFor(speedKmh: number, gear: number): number {
  return Math.min(15000, Math.max(4000, SHIFT_RPM * speedKmh / GEAR_TOP_KMH[gear]));
}
