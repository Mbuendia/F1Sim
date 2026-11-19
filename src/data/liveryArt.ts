// [TL4, 19/11/2026] Libreas dibujadas como las plantillas de los diseñadores: una vista de lado y otra desde arriba, con
// sus bandas de color, sus líneas finas y los patrocinadores (de parodia) al tamaño que tienen en el coche real. El juego
// proyecta el dibujo sobre la carrocería (renderer/liveryPaint.ts), así las líneas salen rectas aunque crucen la joroba.
// Revisión del usuario: «los coches reales tienen líneas finas a lo largo y ancho… el Oracle ocupa todo el pontón…
// revisa las proporciones… no te inventes nada, usa las referencias».
// Referencias: fotos de los diez coches en el GP de Austria 2025 (Wikimedia Commons, «FIA F1 Austria 2025 Nr. …»).
// Coordenadas: u a lo largo del coche (0 = eje trasero, 1 = eje delantero; el morro llega a ~1,42 y la cola a ~-0,23) y
// altura y en metros desde el suelo. Medidas sacadas de las fotos con la batalla (3,6 m) y la rueda (72 cm) como regla.
// Zonas del coche de 2025 para orientarse: pontón u 0,25-0,75 (su costado, y 0,15-0,55); tapa motor u -0,1-0,6 (y 0,55-1);
// toma de aire u 0,35-0,48; cabina u 0,6-0,8; morro u 0,8-1,42 (de 0,6 baja a 0,3).

export type Pt = [u: number, y: number];
export type ArtShape =
  | { poly: Pt[]; color: string }
  /** Línea fina: ancho en metros. */
  | { line: Pt[]; width: number; color: string }
  /** Degradado horizontal entre u0 (color) y u1 (transparente), entre y0 e y1. */
  | { fade: [u0: number, u1: number, y0: number, y1: number]; color: string }
  /** Logotipo de parodia (logos.ts) centrado en (u, y), w × h en metros. */
  | { logo: string; at: Pt; w: number; h: number }
  /** Emblema del equipo (logos.ts, EMBLEMS). */
  | { emblem: string; at: Pt; w: number; h: number }
  /** Texto propio (el nombre del equipo, por ejemplo). */
  | { text: string; at: Pt; w: number; h: number; color: string; italic?: boolean };

export interface LiveryArt {
  base: string;
  /** Color del halo, que va entero de un color (si no, el de base). */
  halo?: string;
  side: ArtShape[];
  /** Vista desde arriba: (u, z) con z en metros desde el eje (se refleja al otro lado). */
  top: ArtShape[];
  topBase?: string;
}

const L = (color: string, width: number, ...pts: Pt[]): ArtShape => ({ line: pts, width, color });
const P = (color: string, ...pts: Pt[]): ArtShape => ({ poly: pts, color });
const G = (name: string, u: number, y: number, w: number, h: number): ArtShape => ({ logo: name, at: [u, y], w, h });
const LOWER = (color: string): ArtShape => P(color, [-0.3, 0], [1.5, 0], [1.5, 0.2], [0.75, 0.22], [0.3, 0.24], [-0.3, 0.3]);

export const LIVERY_ART: Record<string, Partial<Record<number, LiveryArt>>> = {
  // Todos llevan el nombre del motor encima de la joroba de la tapa motor (lienzo de arriba, a lo largo del lomo).
  // MCL39: casi todo negro antracita; papaya en la parte alta del morro y la cabina, un trapecio en la boca del pontón y
  // la «ola» que sube desde el pontón hasta la tapa motor y la cola. OKX grande en el pontón, Chrome en la tapa motor.
  mclaren: { 2025: {
    base: '#1D1E22',
    side: [
      P('#FF8000', [0.72, 0.5], [1.5, 0.33], [1.5, 0.62], [0.72, 0.82]),
      P('#FF8000', [0.52, 0.42], [0.7, 0.42], [0.68, 0.53], [0.5, 0.53]),
      P('#FF8000', [0.44, 0.3], [0.34, 0.3], [0.17, 0.56], [-0.3, 0.56], [-0.3, 1.1], [0.08, 1.1], [0.27, 0.66]),
      P('#FF8000', [0.33, 0.88], [0.48, 0.88], [0.48, 1.1], [0.33, 1.1]),
      G('Okey X', 0.48, 0.35, 0.85, 0.17), G('Cromo', 0.33, 0.78, 0.75, 0.13),
      G('Mastercarta', 0.12, 0.64, 0.32, 0.1), G('Delicioso', 0.95, 0.44, 0.38, 0.08),
    ],
    top: [P('#FF8000', [0.72, 0], [1.5, 0], [1.5, 0.35], [0.72, 0.4]), P('#FF8000', [-0.3, 0], [0.15, 0], [0.15, 0.6], [-0.3, 0.6]), { text: 'TOTOCEDES', at: [0.2, 0], w: 0.7, h: 0.09, color: '#FFFFFF' }],
  } },
  // RB21: azul mate; toma de aire amarilla y el toro grande en el costado de la tapa motor; Oracle de punta a punta del
  // pontón; filete rojo en el borde del pontón y del monocasco; punta del morro amarilla (corregido por el usuario el 19/11/2026).
  redbull: { 2025: {
    base: '#1B2238',
    side: [
      P('#F5B400', [0.36, 0.74], [0.5, 0.74], [0.5, 1.1], [0.36, 1.1]),
      P('#F5B400', [1.3, 0], [1.5, 0], [1.5, 0.7], [1.3, 0.7]),
      L('#E30613', 0.012, [0.28, 0.55], [0.75, 0.55]), L('#E30613', 0.012, [0.75, 0.5], [1.3, 0.38]),
      { emblem: 'toro', at: [0.24, 0.78], w: 1.25, h: 0.5 },
      G('Oráculo', 0.36, 0.43, 1.2, 0.17), G('Baibai', 1.0, 0.42, 0.45, 0.1), G('Móvil Uno', 0.62, 0.52, 0.28, 0.07),
    ],
    top: [P('#F5B400', [0.36, 0], [0.5, 0], [0.5, 0.15], [0.36, 0.15]), P('#F5B400', [1.3, 0], [1.5, 0], [1.5, 0.4], [1.3, 0.4]), { text: 'HONDAMENTAL', at: [0.2, 0], w: 0.7, h: 0.09, color: '#FFFFFF' }],
  } },
  // SF-25: rojo con la parte baja negra y un panel blanco en diagonal en la tapa motor con el HP; Shell y Ray-Ban grandes
  // en el pontón.
  ferrari: { 2025: {
    base: '#B5121B',
    side: [
      LOWER('#141414'),
      P('#FFFFFF', [0.52, 1.05], [0.36, 1.05], [0.26, 0.62], [0.43, 0.62]),
      G('HPrecio', 0.41, 0.84, 0.36, 0.17), G('Concha Oil', 0.48, 0.44, 0.36, 0.2), G('Ray-Bon', 0.3, 0.42, 0.6, 0.14),
      G('Santandreu', 0.17, 0.66, 0.42, 0.08), G('Ricardo Mil', 0.98, 0.42, 0.4, 0.07),
    ],
    top: [P('#FFFFFF', [0.36, 0], [0.52, 0], [0.52, 0.22], [0.36, 0.22]), { text: 'ERRARI', at: [0.2, 0], w: 0.7, h: 0.09, color: '#FFFFFF' }],
  } },
  // W16: negro, gris plata en lo alto del morro y la cabina, filete turquesa a lo largo del pontón; Petronas grande en el
  // pontón.
  mercedes: { 2025: {
    base: '#141414',
    side: [
      P('#7E858C', [0.6, 0.62], [1.5, 0.45], [1.5, 0.64], [0.6, 0.88]),
      L('#00D7B6', 0.015, [1.32, 0.42], [0.75, 0.5], [0.25, 0.52]),
      G('Patronus', 0.36, 0.43, 1.1, 0.17), G('Inéditos', 1.12, 0.42, 0.36, 0.08), G('Cualcom', 0.3, 0.8, 0.42, 0.08),
    ],
    top: [P('#7E858C', [0.6, 0], [1.5, 0], [1.5, 0.3], [0.6, 0.35]), { text: 'TOTOCEDES', at: [0.2, 0], w: 0.7, h: 0.09, color: '#00D7B6' }],
  } },
  // AMR25: verde con la parte baja negra; filete lima a lo largo del morro y la tapa motor; Aramco grande en el pontón.
  astonmartin: { 2025: {
    base: '#00665A',
    side: [
      P('#121414', [-0.3, 0], [1.5, 0], [1.5, 0.28], [0.9, 0.33], [0.62, 0.4], [0.3, 0.42], [-0.3, 0.45]),
      L('#CEDC00', 0.012, [1.42, 0.31], [0.9, 0.36], [0.62, 0.43]), L('#CEDC00', 0.012, [0.48, 0.6], [0.05, 0.62]),
      G('Carambola', 0.36, 0.42, 1.0, 0.17), G('Valvulina', 0.25, 0.52, 0.35, 0.07), G('Incógnito', 0.95, 0.25, 0.5, 0.08),
      G('Pirulí', 0.34, 0.82, 0.32, 0.08),
    ],
    top: [{ text: 'TOTOCEDES', at: [0.2, 0], w: 0.7, h: 0.09, color: '#CEDC00' }, { text: 'TOTOCEDES', at: [0.2, 0], w: 0.7, h: 0.09, color: '#CEDC00' }],
  } },
  // FW47: azul vivo en pontón y tapa motor, azul marino en el morro y la cabina, negro abajo y un filete claro; Atlassian
  // grande en la tapa motor y Komatsu en el pontón.
  williams: { 2025: {
    base: '#2F5BE6',
    side: [
      P('#0E1A4A', [0.62, 0.55], [1.5, 0.4], [1.5, 0.66], [0.62, 0.95]),
      LOWER('#0B0F1E'),
      L('#DCE3FF', 0.01, [0.95, 0.55], [0.62, 0.58], [0.2, 0.6]),
      G('Atlasiano', 0.33, 0.78, 0.8, 0.11), G('Komatsú', 0.36, 0.42, 1.0, 0.15), G('Kraquen', 0.6, 0.53, 0.3, 0.06),
      G('Gulpf', 0.12, 0.64, 0.2, 0.12), G('Dura Chill', 0.42, 0.95, 0.3, 0.06),
    ],
    top: [P('#0E1A4A', [0.62, 0], [1.5, 0], [1.5, 0.35], [0.62, 0.4]), { text: 'TOTOCEDES', at: [0.2, 0], w: 0.7, h: 0.09, color: '#FFFFFF' }],
  } },
  // VCARB 02 (Austria 2025): blanco con una franja azul marino en diagonal por el pontón, toma de aire amarilla y el toro
  // en la tapa motor; Visa grande en el pontón.
  racingbulls: { 2025: {
    base: '#F2F2F2',
    side: [
      LOWER('#141414'),
      P('#1A2350', [0.86, 0.46], [0.86, 0.51], [0.2, 0.31], [0.2, 0.26]),
      P('#F5B400', [0.36, 0.74], [0.5, 0.74], [0.5, 1.1], [0.36, 1.1]),
      { emblem: 'toro', at: [0.24, 0.79], w: 1.15, h: 0.46 },
      G('Vizcash', 0.36, 0.43, 0.9, 0.22), G('Hugo Jefe', 1.0, 0.45, 0.36, 0.08),
    ],
    top: [P('#F5B400', [0.36, 0], [0.5, 0], [0.5, 0.15], [0.36, 0.15]), { text: 'HONDAMENTAL', at: [0.2, 0], w: 0.7, h: 0.09, color: '#1A2350' }],
  } },
  // VF-25: blanco, tapa motor gris oscuro, negro abajo y filete rojo; el nombre del equipo en negro, enorme, en el
  // pontón; MoneyGram en la tapa motor.
  haas: { 2025: {
    base: '#F4F4F4', halo: '#2A2B30',
    side: [
      P('#2A2B30', [-0.3, 0.55], [0.62, 0.55], [0.62, 1.1], [-0.3, 1.1]),
      LOWER('#141416'),
      L('#E6002B', 0.012, [1.42, 0.38], [0.62, 0.52], [-0.1, 0.55]),
      { text: 'HAASTA', at: [0.36, 0.42], w: 1.15, h: 0.2, color: '#141416', italic: true },
      G('MonyGramo', 0.33, 0.82, 0.6, 0.12), G('Toyoda', 1.0, 0.42, 0.35, 0.08),
    ],
    top: [P('#2A2B30', [-0.3, 0], [0.62, 0], [0.62, 0.3], [-0.3, 0.3]), { text: 'ERRARI', at: [0.2, 0], w: 0.7, h: 0.09, color: '#FFFFFF' }],
  } },
  // A525: azul, morro y cabina rosas y un trazo rosa en la cola; BWT en rosa,
  // grande, en el pontón.
  alpine: { 2025: {
    base: '#1F5FD6',
    side: [
      LOWER('#101218'),
      P('#FF6FB5', [0.7, 0.55], [1.5, 0.4], [1.5, 0.63], [0.7, 0.8]),
      P('#FF6FB5', [0.12, 0.55], [0.02, 0.55], [-0.05, 0.86], [0.05, 0.86]),
      { text: 'BTW', at: [0.36, 0.42], w: 0.9, h: 0.24, color: '#FF6FB5' },
      G('Castoro', 0.62, 0.42, 0.3, 0.08), G('Salesfuerza', 0.3, 0.85, 0.36, 0.08),
    ],
    top: [P('#FF6FB5', [0.7, 0], [1.5, 0], [1.5, 0.35], [0.7, 0.4]), { text: 'RENOL', at: [0.2, 0], w: 0.7, h: 0.09, color: '#FF6FB5' }],
  } },
  // C45: verde chillón delante (morro, cabina y toma de aire) con un corte en diagonal al negro de atrás; pontones y cola negros;
  // Stake grande en el pontón y en la tapa motor.
  sauber: { 2025: {
    base: '#111111',
    side: [
      P('#39E639', [0.66, 0], [1.5, 0], [1.5, 1.1], [0.42, 1.1], [0.58, 0.5]),
      LOWER('#111111'),
      G('Steak', 0.36, 0.43, 0.9, 0.24), G('Steak', 0.3, 0.85, 0.45, 0.14), G('Kik Salsa', 0.95, 0.4, 0.4, 0.08),
    ],
    top: [P('#39E639', [0.4, 0], [1.5, 0], [1.5, 0.6], [0.4, 0.6]), { text: 'ERRARI', at: [0.2, 0], w: 0.7, h: 0.09, color: '#39E639' }],
  } },
};

// [TL4, 19/11/2026] Libreas de 2023, 2024 y 2026, con las fotos de Wikimedia Commons como referencia: «FIA F1 Austria 2023 Nr. …»,
// «FIA F1 Austria 2024 Nr. … (side)», «FIA F1 Austria 2026 Nr. …» y «2026 Bahrain/Singapore GP - <equipo> - …». Mismas
// coordenadas que las de 2025 (el proyector las encaja en el coche de cada año). Tamaños y sitios de los patrocinadores
// revisados uno a uno con cada foto el 19/11/2026 (el usuario: «revisa el tamaño de los patrocinadores… dónde va cada uno»).
const ENG = (name: string, color: string): ArtShape => ({ text: name, at: [0.2, 0], w: 0.7, h: 0.09, color });
const T = (text: string, u: number, y: number, w: number, h: number, color: string, italic = false): ArtShape => ({ text, at: [u, y], w, h, color, italic });
const TORO = (u: number, y: number, w: number, h: number): ArtShape => ({ emblem: 'toro', at: [u, y], w, h });
/** Parte baja oscura que sube hacia atrás (casi todos los coches la tienen). */
const BELOW = (color: string, front = 0.3, rear = 0.42): ArtShape => P(color, [-0.3, 0], [1.5, 0], [1.5, front * 0.7], [0.75, front], [0.3, (front + rear) / 2], [-0.3, rear]);
/** Red Bull de siempre: azul mate, toma de aire amarilla, toro grande, filetes rojos y punta del morro amarilla. */
const redBull = (base: string, sponsors: [string, string, string]): LiveryArt => ({
  base,
  side: [
    P('#F5B400', [0.36, 0.74], [0.5, 0.74], [0.5, 1.1], [0.36, 1.1]),
    P('#F5B400', [1.3, 0], [1.5, 0], [1.5, 0.7], [1.3, 0.7]),
    L('#E30613', 0.012, [0.28, 0.55], [0.75, 0.55]), L('#E30613', 0.012, [0.75, 0.5], [1.3, 0.38]),
    TORO(0.24, 0.78, 1.25, 0.5),
    G(sponsors[0], 0.36, 0.43, 1.2, 0.17), G(sponsors[1], 1.0, 0.42, 0.45, 0.1), G(sponsors[2], 0.62, 0.52, 0.28, 0.07),
  ],
  top: [P('#F5B400', [0.36, 0], [0.5, 0], [0.5, 0.15], [0.36, 0.15]), P('#F5B400', [1.3, 0], [1.5, 0], [1.5, 0.4], [1.3, 0.4])],
});
/** Aston Martin de siempre: verde, parte baja negra y filete lima. */
const aston = (base: string, sponsors: [string, string, string]): LiveryArt => ({
  base,
  side: [
    P('#121414', [-0.3, 0], [1.5, 0], [1.5, 0.28], [0.9, 0.33], [0.62, 0.4], [0.3, 0.42], [-0.3, 0.45]),
    L('#CEDC00', 0.012, [1.42, 0.31], [0.9, 0.36], [0.62, 0.43]), L('#CEDC00', 0.012, [0.48, 0.6], [0.05, 0.62]),
    G(sponsors[0], 0.42, 0.34, 1.1, 0.2), G(sponsors[1], 0.25, 0.55, 0.35, 0.07), G(sponsors[2], 0.34, 0.82, 0.32, 0.08),
  ],
  top: [],
});

const MORE: Record<string, Partial<Record<number, LiveryArt>>> = {
  // MCL60 (2023): papaya arriba, negro abajo con un filete azul claro en la raya; OKX sobre el negro del pontón.
  // MCL38 (2024): igual pero con más papaya en el pontón. MCL40 (2026): papaya con bandas negras en diagonal.
  mclaren: {
    2023: { base: '#FF8000', side: [BELOW('#1E1E22', 0.36, 0.5), L('#47C7FC', 0.014, [1.5, 0.255], [0.75, 0.36], [0.3, 0.43], [-0.3, 0.5]),
      G('Okey X', 0.42, 0.3, 1.0, 0.2), G('Cromo', 0.36, 0.72, 0.95, 0.18), G('Delicioso', 0.95, 0.44, 0.38, 0.08)],
      top: [ENG('TOTOCEDES', '#1E1E22')], halo: '#1E1E22' },
    2024: { base: '#FF8000', side: [BELOW('#1E1E22', 0.3, 0.42), P('#1E1E22', [0.2, 0.42], [0.55, 0.42], [0.62, 0.3], [0.27, 0.3]),
      G('Okey X', 0.42, 0.32, 1.0, 0.2), G('Cromo', 0.36, 0.72, 0.95, 0.18), G('Gugle', 0.95, 0.44, 0.38, 0.08)],
      top: [ENG('TOTOCEDES', '#1E1E22')], halo: '#1E1E22' },
    2026: { base: '#FF8000', side: [BELOW('#1E1E22', 0.3, 0.42), P('#1E1E22', [0.15, 0.3], [0.32, 0.3], [0.6, 0.62], [0.43, 0.62]),
      P('#1E1E22', [0.62, 0.42], [0.75, 0.42], [0.95, 0.62], [0.82, 0.62]),
      G('Okey X', 0.4, 0.36, 1.0, 0.2), G('Mastercarta', 0.12, 0.66, 0.32, 0.1), G('Gugle', 0.33, 0.8, 0.75, 0.15)],
      top: [ENG('TOTOCEDES', '#1E1E22')], halo: '#1E1E22' },
  },
  // RB19, RB20 y RB22: la misma idea en los tres (azul mate, toma amarilla, toro, filetes rojos).
  redbull: {
    2023: { ...redBull('#1B2238', ['Oráculo', 'Baibai', 'Móvil Uno']), top: [...redBull('#1B2238', ['Oráculo', 'Baibai', 'Móvil Uno']).top, ENG('HONDAMENTAL', '#FFFFFF')] },
    2024: { ...redBull('#182040', ['Oráculo', 'Baibai', 'Pumba']), top: [...redBull('#182040', ['Oráculo', 'Baibai', 'Pumba']).top, ENG('HONDAMENTAL', '#FFFFFF')] },
    2026: { ...redBull('#14204A', ['Oráculo', 'Baibai', 'Fortito']), top: [...redBull('#14204A', ['Oráculo', 'Baibai', 'Fortito']).top, ENG('FORDTRAINS', '#FFFFFF')] },
  },
  // SF-23: rojo con la parte baja negra. SF-24: rojo con una franja blanca y otra amarilla junto a la cabina.
  // SF-26: rojo con la tapa motor y la cola blancas.
  ferrari: {
    2023: { base: '#D40000', side: [BELOW('#141414', 0.26, 0.4), G('Concha Oil', 0.48, 0.44, 0.36, 0.2), G('Ray-Bon', 0.3, 0.42, 0.6, 0.14),
      G('Santandreu', 0.17, 0.66, 0.42, 0.08), G('Ricardo Mil', 0.98, 0.42, 0.4, 0.07)], top: [ENG('ERRARI', '#FFFFFF')], halo: '#141414' },
    2024: { base: '#E8002D', side: [BELOW('#141414', 0.24, 0.36), P('#FFFFFF', [0.55, 0.5], [0.6, 0.5], [0.66, 0.9], [0.61, 0.9]),
      P('#FFE600', [0.6, 0.5], [0.63, 0.5], [0.69, 0.9], [0.66, 0.9]),
      G('Concha Oil', 0.46, 0.44, 0.45, 0.26), G('Ray-Bon', 0.27, 0.4, 0.65, 0.15), G('Santandreu', 0.17, 0.66, 0.5, 0.1)],
      top: [P('#FFFFFF', [0.6, 0], [0.64, 0], [0.64, 0.3], [0.6, 0.3]), P('#FFE600', [0.64, 0], [0.67, 0], [0.67, 0.3], [0.64, 0.3]), ENG('ERRARI', '#FFFFFF')], halo: '#E8002D' },
    2026: { base: '#E10019', side: [BELOW('#141414', 0.24, 0.36), P('#FFFFFF', [-0.3, 0.5], [0.3, 0.55], [0.5, 0.75], [0.52, 1.1], [-0.3, 1.1]),
      G('HPrecio', 0.4, 0.84, 0.36, 0.17), G('Concha Oil', 0.5, 0.42, 0.36, 0.2), G('Santandreu', 0.17, 0.4, 0.42, 0.08)],
      top: [P('#FFFFFF', [-0.3, 0], [0.5, 0], [0.5, 0.45], [-0.3, 0.6]), ENG('ERRARI', '#E10019')], halo: '#E10019' },
  },
  // W14: negro con el morro plateado y filetes turquesa. W15: negro detrás y plata delante. W17: turquesa delante que pasa
  // a negro detrás, con la cola negra.
  mercedes: {
    2023: { base: '#141414', side: [P('#9AA0A6', [0.85, 0.45], [1.5, 0.33], [1.5, 0.6], [0.85, 0.72]),
      L('#00D7B6', 0.015, [1.32, 0.42], [0.75, 0.5], [0.25, 0.52]), G('Patronus', 0.4, 0.43, 1.1, 0.17), G('Cualcom', 0.3, 0.8, 0.42, 0.08)],
      top: [P('#9AA0A6', [0.85, 0], [1.5, 0], [1.5, 0.3], [0.85, 0.35]), ENG('TOTOCEDES', '#00D7B6')] },
    2024: { base: '#141414', side: [P('#8E949A', [0.6, 0.46], [0.92, 0.42], [0.92, 0.8], [0.6, 0.86]), { fade: [0.6, 0.45, 0.46, 0.86], color: '#8E949A' },
      L('#00D7B6', 0.015, [1.32, 0.3], [0.75, 0.34], [0.25, 0.4]), G('Patronus', 0.4, 0.45, 1.2, 0.18), G('Cualcom', 0.3, 0.8, 0.5, 0.1)],
      top: [P('#8E949A', [0.6, 0], [0.92, 0], [0.92, 0.35], [0.6, 0.35]), ENG('TOTOCEDES', '#00D7B6')] },
    2026: { base: '#141414', side: [P('#16C2BC', [0.42, 0.2], [1.5, 0.15], [1.5, 1.1], [0.42, 1.1]), { fade: [0.42, 0.22, 0.2, 1.1], color: '#16C2BC' },
      BELOW('#141414', 0.2, 0.3), G('Patronus', 0.38, 0.36, 1.0, 0.16), G('Microsuave', 0.9, 0.55, 0.4, 0.08)],
      top: [P('#16C2BC', [0.42, 0], [1.5, 0], [1.5, 0.6], [0.42, 0.6]), ENG('TOTOCEDES', '#FFFFFF')], halo: '#141414' },
  },
  // AMR23, AMR24 y AMR26: verde, parte baja negra y filete lima.
  astonmartin: {
    2023: { ...aston('#00594F', ['Incógnito', 'Valvulina', 'Pirulí']), side: [...aston('#00594F', ['Incógnito', 'Valvulina', 'Pirulí']).side, G('Carambola', 0.36, 0.76, 0.95, 0.17)], top: [ENG('TOTOCEDES', '#CEDC00')] },
    2024: { ...aston('#00665E', ['Carambola', 'Valvulina', 'Pirulí']), top: [ENG('TOTOCEDES', '#CEDC00')] },
    2026: { ...aston('#004C45', ['Carambola', 'Valvulina', 'Pirulí']), top: [ENG('HONDAMENTAL', '#CEDC00')] },
  },
  // FW45: azul oscuro brillante con filetes azul claro y negro abajo. FW46: azul marino con el pontón más claro.
  // FW48: azul cielo arriba y azul marino abajo, con el morro marino.
  williams: {
    2023: { base: '#0B2D7A', side: [BELOW('#0B0F1E', 0.24, 0.34), L('#00A3E0', 0.012, [1.42, 0.34], [0.75, 0.42], [0.2, 0.46]),
      G('Dura Chill', 0.33, 0.78, 0.6, 0.11), G('Gulpf', 0.12, 0.64, 0.2, 0.12), G('Kraquen', 0.4, 0.4, 0.7, 0.13)], top: [ENG('TOTOCEDES', '#00A3E0')] },
    2024: { base: '#0E2470', side: [BELOW('#0B0F1E', 0.24, 0.34), P('#1F4FD1', [0.15, 0.3], [0.7, 0.3], [0.7, 0.6], [0.15, 0.62]),
      G('Komatsú', 0.42, 0.42, 1.0, 0.15), G('Dura Chill', 0.33, 0.8, 0.5, 0.09), G('Gulpf', 0.12, 0.64, 0.2, 0.12)], top: [ENG('TOTOCEDES', '#FFFFFF')] },
    2026: { base: '#3D9BE9', side: [BELOW('#0B1E3F', 0.3, 0.4), P('#0B1E3F', [1.15, 0], [1.5, 0], [1.5, 0.7], [1.15, 0.7]),
      G('Atlasiano', 0.33, 0.78, 0.8, 0.11), G('Barclaus', 0.4, 0.44, 0.9, 0.15), G('Gulpf', 0.12, 0.64, 0.2, 0.12)], top: [ENG('TOTOCEDES', '#FFFFFF')], halo: '#0B1E3F' },
  },
  // AT04 (2023): azul marino con el morro y lo alto del pontón blancos y el nombre en el pontón. VCARB 01 (2024): azul
  // real con el morro y la cabina blancos. 2026: blanco con la parte baja azul marino y el toro en la tapa motor.
  racingbulls: {
    2023: { base: '#20394C', side: [P('#F4F4F4', [0.3, 0.5], [1.5, 0.36], [1.5, 0.72], [0.62, 0.72], [0.3, 0.6]),
      T('ALFA TORERO', 0.32, 0.4, 0.95, 0.13, '#F4F4F4'), TORO(0.24, 0.78, 0.9, 0.36), G('Mancha Azul', 1.0, 0.42, 0.36, 0.08)],
      top: [P('#F4F4F4', [0.62, 0], [1.5, 0], [1.5, 0.4], [0.62, 0.4]), ENG('HONDAMENTAL', '#FFFFFF')], halo: '#20394C' },
    2024: { base: '#1634CC', side: [P('#F2F2F2', [0.62, 0.42], [1.5, 0.3], [1.5, 1.1], [0.62, 1.1]), L('#E30613', 0.012, [1.42, 0.3], [0.62, 0.42], [0.1, 0.48]),
      G('Vizcash', 0.4, 0.36, 1.05, 0.26), G('Hugo Jefe', 1.0, 0.45, 0.4, 0.09)],
      top: [P('#F2F2F2', [0.62, 0], [1.5, 0], [1.5, 0.6], [0.62, 0.6]), ENG('HONDAMENTAL', '#FFFFFF')], halo: '#F2F2F2' },
    2026: { base: '#F2F2F2', side: [BELOW('#1A2350', 0.26, 0.36), P('#1A2350', [0.2, 0.28], [0.3, 0.28], [0.8, 0.5], [0.7, 0.5]),
      TORO(0.24, 0.79, 1.15, 0.46), G('Vizcash', 0.4, 0.4, 0.9, 0.22), G('Hugo Jefe', 1.0, 0.45, 0.36, 0.08)],
      top: [ENG('FORDTRAINS', '#1A2350')] },
  },
  // VF-23: negro con el morro blanco y filetes rojos. VF-24: blanco delante y abajo, tapa motor y pontón negros.
  // 2026: blanco con la parte baja negra y un panel rojo en la tapa motor.
  haas: {
    2023: { base: '#141416', side: [P('#F4F4F4', [0.7, 0.2], [1.5, 0.15], [1.5, 0.75], [0.7, 0.55]), L('#E6002B', 0.014, [1.42, 0.4], [0.7, 0.4], [-0.1, 0.45]),
      T('HAASTA', 0.3, 0.32, 1.15, 0.24, '#F4F4F4', true), G('MonyGramo', 0.33, 0.82, 0.6, 0.12)], top: [ENG('ERRARI', '#FFFFFF')] },
    2024: { base: '#F4F4F4', side: [P('#16171A', [-0.3, 0.25], [0.68, 0.25], [0.68, 1.1], [-0.3, 1.1]), BELOW('#16171A', 0.2, 0.3),
      L('#E6002B', 0.012, [1.42, 0.38], [0.68, 0.5]), T('HAASTA', 0.3, 0.32, 1.15, 0.24, '#F4F4F4', true), G('MonyGramo', 0.36, 0.84, 0.7, 0.13)],
      top: [P('#16171A', [-0.3, 0], [0.68, 0], [0.68, 0.6], [-0.3, 0.6]), ENG('ERRARI', '#FFFFFF')], halo: '#16171A' },
    2026: { base: '#F2F2F2', side: [BELOW('#16171A', 0.24, 0.34), P('#C8102E', [0.05, 0.6], [0.5, 0.6], [0.5, 1.1], [0.05, 1.1]),
      T('HAASTA', 0.36, 0.42, 1.0, 0.18, '#16171A', true), G('Toyoda', 0.28, 0.84, 0.45, 0.1), G('Gazú', 1.0, 0.42, 0.35, 0.08)],
      top: [P('#C8102E', [0.05, 0], [0.5, 0], [0.5, 0.35], [0.05, 0.35]), ENG('ERRARI', '#FFFFFF')], halo: '#16171A' },
  },
  // A523: azul arriba, negro abajo, panel rosa en el pontón con BWT y filetes rosas en el morro. A524: negro con el panel
  // rosa y el morro azul. A526: rosa con la tapa motor azul.
  alpine: {
    2023: { base: '#0A4FA0', side: [BELOW('#101218', 0.26, 0.38), P('#FF87BC', [0.22, 0.28], [0.62, 0.28], [0.62, 0.52], [0.22, 0.52]),
      L('#FF87BC', 0.014, [1.42, 0.34], [0.75, 0.47]), T('BTW', 0.42, 0.4, 0.75, 0.2, '#0A4FA0'), G('Castoro', 0.66, 0.42, 0.3, 0.08)],
      top: [ENG('RENOL', '#FF87BC')] },
    2024: { base: '#121418', side: [P('#FF87BC', [0.2, 0.26], [0.64, 0.26], [0.64, 0.54], [0.2, 0.54]), P('#0078C1', [0.75, 0.32], [1.5, 0.28], [1.5, 0.62], [0.75, 0.7]),
      L('#FF87BC', 0.014, [1.42, 0.3], [0.75, 0.33]), T('BTW', 0.42, 0.4, 0.95, 0.26, '#2B3990'), G('Castoro', 0.7, 0.42, 0.3, 0.08)],
      top: [P('#0078C1', [0.75, 0], [1.5, 0], [1.5, 0.3], [0.75, 0.35]), ENG('RENOL', '#FF87BC')] },
    2026: { base: '#FF87BC', side: [BELOW('#121418', 0.22, 0.32), P('#2E8FE0', [-0.3, 0.6], [0.55, 0.6], [0.68, 1.1], [-0.3, 1.1]),
      T('BTW', 0.4, 0.4, 0.8, 0.22, '#0C1F4A'), G('Salesfuerza', 0.3, 0.85, 0.36, 0.08)],
      top: [P('#2E8FE0', [-0.3, 0], [0.62, 0], [0.62, 0.5], [-0.3, 0.5]), ENG('TOTOCEDES', '#FFFFFF')], halo: '#2E8FE0' },
  },
  // C43 (2023): granate delante y en el pontón, negro detrás y abajo, filete blanco. C44 (2024): negro con verde chillón en
  // la toma de aire, el morro y una franja baja. Audi 2026: titanio con la tapa motor negra y un panel rojo en el pontón.
  sauber: {
    2023: { base: '#900000', side: [BELOW('#111111', 0.26, 0.38), P('#111111', [-0.3, 0.55], [0.3, 0.6], [0.36, 1.1], [-0.3, 1.1]),
      L('#FFFFFF', 0.01, [1.42, 0.36], [0.75, 0.46], [0.3, 0.5]), G('Steak', 0.4, 0.42, 0.95, 0.25), G('Alfa Romero', 0.3, 0.74, 0.85, 0.15)],
      top: [P('#111111', [-0.3, 0], [0.33, 0], [0.33, 0.6], [-0.3, 0.6]), ENG('ERRARI', '#FFFFFF')], halo: '#111111' },
    2024: { base: '#111111', side: [P('#52E252', [0.36, 0.74], [0.5, 0.74], [0.5, 1.1], [0.36, 1.1]), P('#52E252', [1.25, 0], [1.5, 0], [1.5, 0.6], [1.25, 0.6]),
      P('#52E252', [0.1, 0.12], [0.75, 0.16], [0.75, 0.22], [0.1, 0.2]), G('Steak', 0.4, 0.36, 1.0, 0.26), G('Kik Salsa', 0.95, 0.4, 0.4, 0.08)],
      top: [P('#52E252', [0.36, 0], [0.5, 0], [0.5, 0.15], [0.36, 0.15]), ENG('ERRARI', '#52E252')] },
    2026: { base: '#B5B7BA', side: [P('#111111', [-0.3, 0.5], [0.42, 0.55], [0.48, 1.1], [-0.3, 1.1]), BELOW('#111111', 0.22, 0.34),
      P('#E30613', [0.12, 0.26], [0.38, 0.26], [0.42, 0.55], [0.14, 0.55]), G('Revolución', 0.5, 0.42, 0.7, 0.14), G('Cuatro Anillos', 0.2, 0.8, 0.5, 0.14)],
      top: [P('#111111', [-0.3, 0], [0.45, 0], [0.45, 0.6], [-0.3, 0.6]), ENG('AUDIENCIA', '#E30613')], halo: '#111111' },
  },
};
for (const [team, years] of Object.entries(MORE)) LIVERY_ART[team] = { ...LIVERY_ART[team], ...years };

export function liveryArt(teamId: string, year: number): LiveryArt | undefined {
  const y = Math.min(2026, Math.max(2023, Math.floor(year)));
  return LIVERY_ART[teamId]?.[y];
}
