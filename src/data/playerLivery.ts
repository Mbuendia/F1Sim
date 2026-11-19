// [TL5, 19/11/2026] Tu librea: el jugador elige una plantilla, tres colores, el color del dorsal y dónde va cada uno de
// los patrocinadores (de parodia) que ha firmado su equipo. Alcance elegido por el usuario: editor por zonas, al crear la
// carrera profesional y en cada pretemporada; MD18 lo ampliará con dibujos, acabados y piezas estéticas.
// Se convierte en un dibujo (LiveryArt) que se proyecta sobre la carrocería como las libreas de los equipos: nada de
// pintar zonas sueltas del modelo (ver data/liveryArt.ts y renderer/liveryPaint.ts).
import type { ArtShape, LiveryArt, Pt } from './liveryArt';
import type { SeasonLivery } from './seasonLiveries';

/** Huecos para patrocinadores: el costado del pontón, la tapa motor, el lateral del morro y las placas del alerón. */
export const LIVERY_SLOTS = ['ponton', 'tapa', 'morro', 'placas'] as const;
export type LiverySlot = typeof LIVERY_SLOTS[number];
export const SLOT_LABEL: Record<LiverySlot, string> = { ponton: 'Pontón', tapa: 'Tapa motor', morro: 'Morro', placas: 'Placas del alerón' };

export interface PlayerLivery {
  version: 1;
  template: string;
  /** Color principal, secundario y de acento (#rrggbb). */
  colors: [string, string, string];
  /** Color del dorsal. */
  numberColor: string;
  /** Patrocinador de cada hueco (uno de los firmados por el equipo); sin él, el hueco va vacío. */
  slots: Partial<Record<LiverySlot, string>>;
}

const P = (color: string, ...pts: Pt[]): ArtShape => ({ poly: pts, color });
const L = (color: string, width: number, ...pts: Pt[]): ArtShape => ({ line: pts, width, color });
const BELOW = (color: string, front = 0.24, rear = 0.34): ArtShape => P(color, [-0.3, 0], [1.5, 0], [1.5, front * 0.7], [0.75, front], [0.3, (front + rear) / 2], [-0.3, rear]);

/** Plantillas: la idea de una librea real, sin sus marcas. Cada una recibe (principal, secundario, acento). */
interface Template { id: string; name: string; inspiredBy: string; side: (p: string, s: string, a: string) => ArtShape[]; top: (p: string, s: string, a: string) => ArtShape[]; wings: (p: string, s: string, a: string) => [string, string] }
export const LIVERY_TEMPLATES: Template[] = [
  { id: 'flecha', name: 'Flecha', inspiredBy: 'morro y cabina de otro color con un filete a lo largo (estilo de las flechas plateadas)',
    side: (p, s, a) => [BELOW(s), P(s, [0.62, 0.48], [1.5, 0.34], [1.5, 0.6], [0.62, 0.86]), L(a, 0.015, [1.32, 0.42], [0.75, 0.5], [0.25, 0.52])],
    top: (p, s) => [P(s, [0.62, 0], [1.5, 0], [1.5, 0.3], [0.62, 0.35])], wings: (p, s) => [s, s] },
  { id: 'ola', name: 'Ola', inspiredBy: 'una ola que sube del pontón a la tapa motor sobre un color oscuro (estilo papaya)',
    side: (p, s, a) => [P(p, [0.72, 0.5], [1.5, 0.33], [1.5, 0.62], [0.72, 0.82]), P(p, [0.44, 0.3], [0.34, 0.3], [0.17, 0.56], [-0.3, 0.56], [-0.3, 1.1], [0.08, 1.1], [0.27, 0.66]),
      L(a, 0.012, [0.44, 0.3], [0.75, 0.5])],
    top: p => [P(p, [0.72, 0], [1.5, 0], [1.5, 0.35], [0.72, 0.4]), P(p, [-0.3, 0], [0.15, 0], [0.15, 0.6], [-0.3, 0.6])], wings: (p, s) => [s, p] },
  { id: 'toma', name: 'Toma de aire', inspiredBy: 'color mate con la toma de aire y la punta del morro de acento y filetes finos (estilo azul mate)',
    side: (p, s, a) => [P(a, [0.36, 0.74], [0.5, 0.74], [0.5, 1.1], [0.36, 1.1]), P(a, [1.3, 0], [1.5, 0], [1.5, 0.7], [1.3, 0.7]),
      L(s, 0.012, [0.28, 0.55], [0.75, 0.55]), L(s, 0.012, [0.75, 0.5], [1.3, 0.38])],
    top: (p, s, a) => [P(a, [0.36, 0], [0.5, 0], [0.5, 0.15], [0.36, 0.15]), P(a, [1.3, 0], [1.5, 0], [1.5, 0.4], [1.3, 0.4])], wings: p => [p, p] },
  { id: 'clasica', name: 'Clásica', inspiredBy: 'un color con la parte baja oscura y un panel en diagonal en la tapa motor (estilo rojo)',
    side: (p, s, a) => [BELOW(s, 0.26, 0.4), P(a, [0.52, 1.05], [0.36, 1.05], [0.26, 0.62], [0.43, 0.62])],
    top: (p, s, a) => [P(a, [0.36, 0], [0.52, 0], [0.52, 0.22], [0.36, 0.22])], wings: (p, s) => [s, p] },
  { id: 'mitades', name: 'Mitades', inspiredBy: 'la parte delantera de un color y la trasera de otro, con un corte en diagonal (estilo verde y negro)',
    side: (p, s) => [P(p, [0.66, 0], [1.5, 0], [1.5, 1.1], [0.42, 1.1], [0.58, 0.5]), BELOW(s, 0.2, 0.3)],
    top: p => [P(p, [0.4, 0], [1.5, 0], [1.5, 0.6], [0.4, 0.6])], wings: (p, s) => [s, s] },
  { id: 'panel', name: 'Panel', inspiredBy: 'un panel grande en el pontón para el patrocinador principal y el morro de acento (estilo azul y rosa)',
    side: (p, s, a) => [BELOW(s), P(a, [0.2, 0.26], [0.64, 0.26], [0.64, 0.54], [0.2, 0.54]), P(a, [0.75, 0.32], [1.5, 0.28], [1.5, 0.62], [0.75, 0.7])],
    top: (p, s, a) => [P(a, [0.75, 0], [1.5, 0], [1.5, 0.3], [0.75, 0.35])], wings: (p, s, a) => [s, a] },
  { id: 'bloques', name: 'Bloques', inspiredBy: 'morro y bajos de un color y tapa motor y pontón de otro, con un filete (estilo blanco y negro)',
    side: (p, s, a) => [P(s, [-0.3, 0.25], [0.68, 0.25], [0.68, 1.1], [-0.3, 1.1]), BELOW(s, 0.2, 0.3), L(a, 0.012, [1.42, 0.38], [0.68, 0.5])],
    top: (p, s) => [P(s, [-0.3, 0], [0.68, 0], [0.68, 0.6], [-0.3, 0.6])], wings: (p, s, a) => [s, a] },
];

/** Librea de partida: la plantilla «Flecha» con los colores del equipo y sus patrocinadores en orden. */
export function defaultPlayerLivery(primary: string, secondary: string, sponsors: readonly string[]): PlayerLivery {
  const named = sponsors.filter(Boolean);
  return { version: 1, template: 'flecha', colors: [primary, secondary, '#ffffff'], numberColor: '#ffffff',
    slots: Object.fromEntries(LIVERY_SLOTS.map((slot, i) => [slot, named[i]]).filter(([, name]) => name)) };
}

const hex = /^#[0-9a-fA-F]{6}$/;
const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
/** Distancia entre dos colores (0-441): por debajo de 60 se ven casi iguales. */
export function colorDistance(a: string, b: string): number {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
/** Avisos del editor: pares de colores casi iguales. */
export function liveryWarnings(l: PlayerLivery): string[] {
  const names = ['principal', 'secundario', 'acento'];
  const out: string[] = [];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (colorDistance(l.colors[i], l.colors[j]) < 60) out.push(`El color ${names[i]} y el ${names[j]} casi no se distinguen`);
  if (colorDistance(l.numberColor, l.colors[0]) < 60) out.push('El dorsal casi no se distingue del color principal');
  return out;
}

/** Comprueba una librea leída de una partida guardada. */
export function isPlayerLivery(data: unknown): data is PlayerLivery {
  if (!data || typeof data !== 'object') return false;
  const l = data as Record<string, unknown>;
  return l.version === 1 && LIVERY_TEMPLATES.some(t => t.id === l.template) && Array.isArray(l.colors) && l.colors.length === 3
    && l.colors.every(c => typeof c === 'string' && hex.test(c)) && typeof l.numberColor === 'string' && hex.test(l.numberColor)
    && !!l.slots && typeof l.slots === 'object' && Object.entries(l.slots as object).every(([k, v]) => (LIVERY_SLOTS as readonly string[]).includes(k) && typeof v === 'string');
}

/** Motor de cada equipo y año encima de la joroba (el mismo que llevan las libreas de los equipos). */
function engineTag(teamId: string, year: number): string {
  if (year >= 2026) {
    if (teamId === 'redbull' || teamId === 'racingbulls') return 'FORDTRAINS';
    if (teamId === 'astonmartin') return 'HONDAMENTAL';
    if (teamId === 'sauber') return 'AUDIENCIA';
    if (teamId === 'alpine') return 'TOTOCEDES';
  }
  if (teamId === 'alpine') return 'RENOL';
  if (['ferrari', 'haas', 'sauber'].includes(teamId)) return 'ERRARI';
  if (['redbull', 'racingbulls'].includes(teamId)) return 'HONDAMENTAL';
  return 'TOTOCEDES';
}

/** El dibujo de la librea del jugador, listo para proyectar (con los patrocinadores en sus huecos y el motor del año). */
export function playerLiveryArt(l: PlayerLivery, teamId: string, year: number): LiveryArt {
  const t = LIVERY_TEMPLATES.find(x => x.id === l.template) ?? LIVERY_TEMPLATES[0];
  const [p, s, a] = l.colors;
  const logo = (slot: LiverySlot, u: number, y: number, w: number, h: number): ArtShape[] => (l.slots[slot] ? [{ logo: l.slots[slot]!, at: [u, y], w, h }] : []);
  return {
    base: p, halo: s,
    side: [...t.side(p, s, a), ...logo('ponton', 0.4, 0.4, 1.0, 0.2), ...logo('tapa', 0.33, 0.76, 0.85, 0.16), ...logo('morro', 1.0, 0.42, 0.42, 0.09)],
    top: [...t.top(p, s, a), { text: engineTag(teamId, year), at: [0.2, 0], w: 0.7, h: 0.09, color: colorDistance(p, '#ffffff') < 120 ? '#141414' : '#ffffff' }],
  };
}

/** Clave estable de una librea (para la caché de los lienzos proyectados). */
const keyOf = (l: PlayerLivery, teamId: string, year: number) => `jugador-${teamId}-${year}-${l.template}-${l.colors.join('')}-${l.numberColor}-${LIVERY_SLOTS.map(s => l.slots[s] ?? '').join('|')}`;

/** La librea del jugador como librea de temporada: colores, piezas, patrocinadores y dibujo proyectado. */
export function playerSeasonLivery(l: PlayerLivery, teamId: string, year: number): SeasonLivery {
  const t = LIVERY_TEMPLATES.find(x => x.id === l.template) ?? LIVERY_TEMPLATES[0];
  const [p, s, a] = l.colors;
  const [alerones, placas] = t.wings(p, s, a);
  const sponsors = LIVERY_SLOTS.map(slot => l.slots[slot] ?? '');
  return {
    primary: p, secondary: s, sponsors,
    zones: { zona_cuerpo: p, zona_punta: p, zona_tapa: p, zona_aleta: p, zona_ponton: p, zona_costado: p, zona_lateral: s, zona_alerones: alerones, zona_placas: placas, zona_halo: s },
    art: playerLiveryArt(l, teamId, year), artKey: keyOf(l, teamId, year),
    numberColor: l.numberColor,
    ...(l.slots.placas ? { decalSlots: { decal_endplate: l.slots.placas } } : {}),
  };
}

/** La fuerza y librea de cada equipo de la temporada con tu librea en tu equipo (sin librea propia, tal cual). */
export function withPlayerLivery<T extends Record<string, { livery?: SeasonLivery }>>(form: T | null, teamId: string, year: number, livery: PlayerLivery | undefined): T | null {
  if (!form || !livery || !form[teamId]) return form;
  return { ...form, [teamId]: { ...form[teamId], livery: playerSeasonLivery(livery, teamId, year) } };
}
