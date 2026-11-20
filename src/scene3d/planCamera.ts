// [MJ11, 20/11/2026, el usuario: «el coche que tiene que aparecer es el de la livery… el que has seleccionado»] El coche del
// plan de carrera se dibuja en directo encima de la escena de Blender (garaje y personas), con la misma cámara que el
// render: estos números son los de scripts/blender/mj11-garaje.py (frame() y la posición del coche) y tienen que ir a la
// par. Blender usa Z arriba y three Y arriba: (x, y, z) de Blender es (x, z, -y) en three.

export interface PlanFrame {
  width: number; height: number;
  /** Posición y punto al que mira la cámara, en coordenadas de Blender. */
  eye: [number, number, number]; target: [number, number, number];
  /** Focal (mm) con sensor de 36 mm en el lado largo, y desplazamiento de la lente (fracción del lado largo). */
  lens: number; shiftX: number; shiftY: number;
}

export const PLAN_FRAMES: Record<'escritorio' | 'movil', PlanFrame> = {
  escritorio: { width: 1920, height: 1080, eye: [4.5, -8.0, 1.7], target: [0.2, 0.8, 1.0], lens: 30, shiftX: -0.16, shiftY: 0.02 },
  movil: { width: 1080, height: 1920, eye: [3.5, -8.5, 1.8], target: [0.0, 0.8, 1.0], lens: 26, shiftX: 0.0, shiftY: -0.14 },
};

/** Dónde está el coche en el garaje (Blender): posición y giro en grados alrededor de Z. */
export const PLAN_CAR = { position: [1.0, -0.2, 0.003] as [number, number, number], headingDeg: -32 };

/** De Blender (Z arriba) a three (Y arriba). */
export const toThree = ([x, y, z]: [number, number, number]): [number, number, number] => [x, z, -y];

/** Campo de visión vertical (grados) de three para una focal de Blender con sensor de 36 mm en el lado largo. */
export function verticalFov(frame: PlanFrame): number {
  const long = Math.max(frame.width, frame.height);
  const sensorV = 36 * frame.height / long;
  return 2 * Math.atan(sensorV / 2 / frame.lens) * 180 / Math.PI;
}

/** Desplazamiento de la vista (píxeles) equivalente al shift de la lente de Blender, para camera.setViewOffset. */
export function viewOffset(frame: PlanFrame): { x: number; y: number } {
  const long = Math.max(frame.width, frame.height);
  return { x: frame.shiftX * long, y: -frame.shiftY * long };
}
