// [R46] Especificación del monoplaza 3D del paddock: geometría básica propia (cajas, cilindros y una esfera), sin modelos
// ni marcas con licencia. Ejes: x hacia delante, y hacia arriba, z lateral; medidas en metros. Diseño del juego.
import { compoundStyle } from '../utils/compounds';

export interface CarPart {
  name: string;
  shape: 'box' | 'cylinder' | 'sphere';
  /** Caja: largo, alto, ancho. Cilindro: radio, radio, ancho (eje lateral). Esfera: radio ×3. */
  size: [number, number, number];
  position: [number, number, number];
  color: string;
}

export interface CarModelSpec {
  parts: CarPart[];
  number: number;
  lengthM: number;
  widthM: number;
}

export interface CarModelInput {
  teamColor: string;
  accentColor: string;
  number: number;
  compound: string;
}

const CARBON = '#15171c';

export function buildCarModelSpec({ teamColor, accentColor, number, compound }: CarModelInput): CarModelSpec {
  const band = compoundStyle(compound).color;
  const box = (name: string, size: CarPart['size'], position: CarPart['position'], color: string): CarPart => ({ name, shape: 'box', size, position, color });
  const parts: CarPart[] = [
    box('suelo', [3.6, 0.06, 1.5], [-0.2, 0.1, 0], CARBON),
    box('chasis', [2.3, 0.42, 0.62], [0.35, 0.42, 0], teamColor),
    box('morro', [1.45, 0.2, 0.34], [2.0, 0.3, 0], teamColor),
    box('punta del morro', [0.3, 0.12, 0.24], [2.65, 0.24, 0], accentColor),
    box('alerón delantero', [0.5, 0.05, 1.9], [2.55, 0.13, 0], accentColor),
    box('deriva delantera izquierda', [0.55, 0.22, 0.04], [2.55, 0.2, 0.95], teamColor),
    box('deriva delantera derecha', [0.55, 0.22, 0.04], [2.55, 0.2, -0.95], teamColor),
    box('pontón izquierdo', [1.7, 0.4, 0.42], [-0.35, 0.36, 0.52], teamColor),
    box('pontón derecho', [1.7, 0.4, 0.42], [-0.35, 0.36, -0.52], teamColor),
    box('cubierta del motor', [1.9, 0.5, 0.36], [-0.95, 0.62, 0], teamColor),
    box('toma de aire', [0.5, 0.3, 0.3], [-0.2, 0.9, 0], accentColor),
    box('aleta', [1.1, 0.34, 0.03], [-1.35, 0.95, 0], teamColor),
    box('halo', [0.9, 0.06, 0.5], [0.55, 0.74, 0], CARBON),
    box('pilar del halo', [0.06, 0.2, 0.06], [0.98, 0.66, 0], CARBON),
    { name: 'casco', shape: 'sphere', size: [0.15, 0.15, 0.15], position: [0.45, 0.7, 0], color: accentColor },
    box('alerón trasero', [0.42, 0.06, 1.05], [-2.55, 0.98, 0], accentColor),
    box('flap del alerón trasero', [0.26, 0.05, 1.05], [-2.62, 1.08, 0], teamColor),
    box('deriva trasera izquierda', [0.6, 0.62, 0.04], [-2.55, 0.8, 0.54], teamColor),
    box('deriva trasera derecha', [0.6, 0.62, 0.04], [-2.55, 0.8, -0.54], teamColor),
    box('soporte del alerón trasero', [0.1, 0.45, 0.1], [-2.5, 0.72, 0], CARBON),
    box('difusor', [0.5, 0.18, 1.05], [-2.25, 0.2, 0], CARBON),
  ];
  const wheel = (label: string, x: number, z: number, width: number) => {
    parts.push({ name: `rueda ${label}`, shape: 'cylinder', size: [0.36, 0.36, width], position: [x, 0.36, z], color: '#0c0c0e' });
    // Banda del compuesto en la cara exterior del neumático.
    parts.push({ name: `banda ${label}`, shape: 'cylinder', size: [0.3, 0.3, 0.02], position: [x, 0.36, z + Math.sign(z) * (width / 2 + 0.005)], color: band });
  };
  wheel('delantera izquierda', 1.65, 0.82, 0.32);
  wheel('delantera derecha', 1.65, -0.82, 0.32);
  wheel('trasera izquierda', -1.85, 0.8, 0.4);
  wheel('trasera derecha', -1.85, -0.8, 0.4);
  const xs = parts.flatMap(p => [p.position[0] - p.size[0] / 2, p.position[0] + p.size[0] / 2]);
  const zs = parts.flatMap(p => [p.position[2] - p.size[2] / 2, p.position[2] + p.size[2] / 2]);
  const round = (v: number) => Math.round(v * 100) / 100;
  return { parts, number, lengthM: round(Math.max(...xs) - Math.min(...xs)), widthM: round(Math.max(...zs) - Math.min(...zs)) };
}
