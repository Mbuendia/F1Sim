// [VS6] El despiece, como función pura del scroll: carState(p) da, para p entre 0 (arriba del todo) y 1 (abajo del
// todo), cuánto se ha separado cada pieza y la cámara. No guarda estado: la misma p da siempre lo mismo, se baje o se
// suba. Coordenadas de three.js: x hacia el morro, y hacia arriba, z hacia la derecha del coche.

/** Cada pieza que sale: hacia dónde (vector), cuánto (metros) y en qué tramo del scroll [desde, hasta]. */
export const PIECES = [
  { name: 'ala_delantera', dir: [1, 0.12, 0], dist: 1.25, window: [0.05, 0.16] },
  { name: 'rueda_FL', dir: [0, 0.05, -1], dist: 1.0, window: [0.18, 0.28] },
  { name: 'rueda_FR', dir: [0, 0.05, 1], dist: 1.0, window: [0.18, 0.28] },
  { name: 'rueda_RL', dir: [0, 0.05, -1], dist: 1.0, window: [0.19, 0.29] },
  { name: 'rueda_RR', dir: [0, 0.05, 1], dist: 1.0, window: [0.19, 0.29] },
  { name: 'tapa_motor', dir: [-0.12, 1, 0], dist: 1.5, window: [0.32, 0.48] },
  { name: 'pontones', dir: [0.1, 1, 0], dist: 0.85, window: [0.52, 0.62] },
  { name: 'suelo', dir: [0, -1, 0], dist: 0.75, window: [0.67, 0.77] },
  { name: 'suspension_del', dir: [0.4, -1, 0], dist: 0.35, window: [0.68, 0.77] },
  { name: 'suspension_tras', dir: [-0.4, -1, 0], dist: 0.35, window: [0.68, 0.77] },
];

/** Al final, las piezas se recogen: cada una se queda a esta fracción de su separación máxima (una vista despiezada
 *  ordenada, en lugar del coche desperdigado), en el tramo del cierre. */
export const GATHER = { window: [0.92, 0.99], keep: 0.45 };

/** El flap del DRS: gira sobre su eje (z) en su propio tramo y se queda abierto. */
export const DRS = { name: 'drs_flap', window: [0.83, 0.89], angle: 0.5236 };

/** Momentos de la página: dónde empieza cada sección (en p) y la cámara que le toca (posición y punto al que mira). */
export const STOPS = [
  { id: 'inicio', p: 0, pos: [4.9, 1.5, 6.4], look: [0.45, 0.3, 0] },
  { id: 'ala', p: 0.12, pos: [7.4, 1.7, 4.6], look: [2.3, 0.3, 0] },
  { id: 'ruedas', p: 0.25, pos: [0.6, 2.4, 7.6], look: [0, 0.35, 0] },
  { id: 'motor', p: 0.42, pos: [-2.7, 2.9, 2.9], look: [-0.75, 0.55, 0] },
  { id: 'pontones', p: 0.56, pos: [0.9, 3.4, 3.9], look: [-0.1, 0.5, 0] },
  { id: 'suelo', p: 0.7, pos: [3.6, 0.4, 5.6], look: [0, 0.05, 0] },
  { id: 'drs', p: 0.8, pos: [-3.7, 1.02, 1.75], look: [-2.15, 0.8, 0.05] },
  { id: 'drs-abierto', p: 0.91, pos: [-3.7, 1.02, 1.75], look: [-2.15, 0.8, 0.05] },   // la cámara espera a que el flap se abra
  { id: 'cierre', p: 1, pos: [6.3, 2.7, 8.4], look: [0.2, -0.55, 0] },
];

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Suave al empezar y al acabar: las piezas no arrancan ni frenan de golpe. */
export const ease = t => { const u = clamp01(t); return u * u * (3 - 2 * u); };
const along = (p, [a, b]) => ease((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const round = v => Math.round(v * 1e6) / 1e6;

function camera(p) {
  let i = 0;
  while (i < STOPS.length - 2 && p > STOPS[i + 1].p) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  const t = ease((p - a.p) / (b.p - a.p));
  return { pos: a.pos.map((v, k) => round(lerp(v, b.pos[k], t))), look: a.look.map((v, k) => round(lerp(v, b.look[k], t))) };
}

export function carState(p) {
  const q = clamp01(Number(p) || 0);
  const pieces = {};
  const gather = 1 - (1 - GATHER.keep) * along(q, GATHER.window);
  for (const piece of PIECES) {
    const n = Math.hypot(...piece.dir), d = piece.dist * along(q, piece.window) * gather;
    pieces[piece.name] = { offset: piece.dir.map(v => round((v / n) * d)), rot: 0 };
  }
  pieces[DRS.name] = { offset: [0, 0, 0], rot: round(DRS.angle * along(q, DRS.window)) };
  return { p: round(q), pieces, camera: camera(q) };
}
