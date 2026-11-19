// [TL7, 16/11/2026] Logotipos de los patrocinadores de parodia en los coches. Revisión del usuario: «busca la manera de
// hacer logos y nombres de marcas que parezcan más realistas… cógete referencias de los coches». Los logotipos de los
// coches de hoy son palabras grandes de letra pesada y muy trabajada: anchas y en cursiva (como los de los motores),
// muy espaciadas (relojería, tecnología), en minúscula redonda (internet, finanzas), dentro de una placa o con un emblema
// al lado. Cada patrocinador tiene aquí su forma, sus colores y su emblema. Ninguno copia un logotipo real.
import { SPONSOR_COLORS } from '../scene3d/sponsors';

/** Forma del logotipo. */
export type BrandKind =
  | 'bloque' // ancha, pesada y en cursiva (como los motores: Hondita)
  | 'ancho' // ancha y pesada, recta, muy junta
  | 'espaciado' // mayúsculas finas y muy separadas (relojes, tecnología)
  | 'minusculas' // minúscula redonda y gruesa (internet, finanzas)
  | 'caja' // placa de color con la palabra dentro
  | 'insignia' // emblema de color a la izquierda y la palabra al lado
  | 'dos-tonos' // la palabra partida en dos colores
  | 'subrayado'; // palabra con una barra o un trazo debajo

export type BrandEmblem = 'circulo' | 'escudo' | 'rombo' | 'ala' | 'estrella' | 'barras' | 'gota' | 'concha';

export interface BrandStyle {
  kind: BrandKind;
  /** Color de la letra; sin él, blanco o negro según lo que haya debajo. */
  fg?: string;
  /** Color de la placa (caja), del emblema (insignia) o de la segunda parte (dos tonos) o del trazo (subrayado). */
  bg?: string;
  emblem?: BrandEmblem;
  /** Dónde se parte la palabra en «dos tonos» (número de letras de la primera parte). */
  split?: number;
}

const S = (kind: BrandKind, extra: Omit<BrandStyle, 'kind'> = {}): BrandStyle => ({ kind, ...extra });

const STYLES: Record<string, BrandStyle> = {
  // McPapaya
  Mastercarta: S('insignia', { emblem: 'circulo', bg: '#f79e1b' }), 'Okey X': S('ancho'), Gugle: S('minusculas'), Delicioso: S('espaciado'),
  Arrobas: S('subrayado', { bg: '#ff8000' }), Cromo: S('insignia', { emblem: 'circulo', bg: '#4285f4' }),
  // Red Bulla
  'Oráculo': S('ancho', { fg: '#ff2a2a' }), Baibai: S('dos-tonos', { split: 3, bg: '#f7a600' }), 'Móvil Uno': S('bloque', { fg: '#ffffff' }),
  'TAG Hoyer': S('caja', { bg: '#000000', fg: '#e30613' }), Pumba: S('insignia', { emblem: 'ala', bg: '#ffffff' }), Fortito: S('caja', { bg: '#003478', fg: '#ffffff' }),
  // Errari
  'Concha Oil': S('insignia', { emblem: 'concha', bg: '#ffd500' }), Santandreu: S('insignia', { emblem: 'gota', bg: '#ec0000' }), 'Ray-Bon': S('caja', { bg: '#c8102e', fg: '#ffffff' }),
  'Ricardo Mil': S('espaciado'), HPrecio: S('minusculas'),
  // Totocedes
  Patronus: S('insignia', { emblem: 'gota', bg: '#00a19b' }), 'Inéditos': S('espaciado'), Cualcom: S('minusculas'), 'Hilfígaro': S('caja', { bg: '#0b2a5b', fg: '#ffffff' }),
  Microsuave: S('insignia', { emblem: 'barras', bg: '#00a4ef' }),
  // Aston Papá
  Carambola: S('insignia', { emblem: 'estrella', bg: '#cedc00' }), 'Incógnito': S('minusculas'), Valvulina: S('bloque'), 'Pirulí': S('caja', { bg: '#000000', fg: '#ffd400' }),
  'Papá Paga': S('dos-tonos', { split: 4, bg: '#cedc00' }), Hondita: S('bloque'),
  // Vowlliams
  'Dura Chill': S('dos-tonos', { split: 4, bg: '#f6a800' }), Gulpf: S('caja', { bg: '#8fd3f4', fg: '#f26b21' }), Kraquen: S('ancho'), Sofistica: S('espaciado'),
  'Komatsú': S('caja', { bg: '#ffffff', fg: '#0a3a8c' }), Atlasiano: S('insignia', { emblem: 'rombo', bg: '#2684ff' }), Barclaus: S('insignia', { emblem: 'ala', bg: '#00aeef' }),
  // Racing Bueyes
  'Alfa Toalla': S('espaciado'), Orlando: S('insignia', { emblem: 'escudo', bg: '#e30613' }), 'Mancha Azul': S('minusculas'), Zebrita: S('bloque'),
  Vizcash: S('caja', { bg: '#1a1f71', fg: '#f7b600' }), Bizcocho: S('minusculas'), 'Hugo Jefe': S('espaciado'), 'Taxímetro': S('caja', { bg: '#000000', fg: '#ffffff' }),
  // Haasta Luego
  MonyGramo: S('caja', { bg: '#da291c', fg: '#ffffff' }), 'Palfínguer': S('ancho'), 'Chipotlé': S('minusculas'), 'Bosé': S('espaciado'),
  Toyoda: S('insignia', { emblem: 'circulo', bg: '#eb0a1e' }), 'Gazú': S('bloque'),
  // Alpino Grigio
  BTW: S('ancho'), Castoro: S('caja', { bg: '#007a3d', fg: '#ffffff' }), 'Mapfrío': S('subrayado', { bg: '#d81e05' }), 'Kat-Kit': S('caja', { bg: '#d2001e', fg: '#ffffff' }),
  Salesfuerza: S('insignia', { emblem: 'gota', bg: '#00a1e0' }),
  // Steak Sauber / Audiencia
  'Alfa Romero': S('insignia', { emblem: 'escudo', bg: '#9b0000' }), Steak: S('ancho', { fg: '#52e252' }), 'Kriptón': S('insignia', { emblem: 'rombo', bg: '#0a1a3f' }),
  'Musgo Oil': S('caja', { bg: '#2d5016', fg: '#ffffff' }), 'Kik Salsa': S('caja', { bg: '#53fc18', fg: '#000000' }), 'AWSome Nube': S('subrayado', { bg: '#ff9900' }),
  'Cuatro Anillos': S('espaciado'), 'Revolución': S('minusculas'), Nexofit: S('insignia', { emblem: 'barras', bg: '#ff4f00' }), Bitpandita: S('minusculas'),
};

const KINDS: BrandKind[] = ['bloque', 'ancho', 'espaciado', 'minusculas', 'caja', 'insignia', 'dos-tonos', 'subrayado'];
const EMBLEMS: BrandEmblem[] = ['circulo', 'escudo', 'rombo', 'ala', 'estrella', 'barras', 'gota'];
const PALETTE = ['#e10600', '#ffd23f', '#00a3e0', '#57d9a3', '#ff8000', '#b678ff', '#ffffff', '#111111'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Logotipo de un patrocinador: el anotado o, si no lo hay (patrocinadores firmados, de reserva, de la librea de
 * siempre…), uno estable sacado de su nombre. Los colores de las vallas mandan cuando el nombre también está en ellas.
 */
export function brandStyle(name: string): BrandStyle {
  const board = (SPONSOR_COLORS as Record<string, { bg: string; fg: string } | undefined>)[name];
  const known = STYLES[name];
  if (known) return known;
  if (board) return { kind: 'caja', bg: board.bg, fg: board.fg };
  const h = hash(name);
  const kind = KINDS[h % KINDS.length];
  return { kind, emblem: EMBLEMS[(h >> 4) % EMBLEMS.length], bg: PALETTE[(h >> 7) % PALETTE.length], split: Math.max(2, Math.floor(name.length / 2)) };
}
