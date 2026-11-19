// [TL3] Libreas por año: de 2023 a 2026, los dos colores de cada equipo ese año y cuatro patrocinadores de parodia del
// patrocinador real de entonces (pontón, tapa motor, morro y alerón), y el nombre largo del equipo de ese año. Anotado de
// memoria (16/11/2026) con la regla de ideas-libreas.md: ninguna marca real, solo colores y juegos de palabras.
// Desde 2027 la librea es propia de la partida: `seasonLivery` mueve un poco los colores de 2026 y cambia uno o dos
// patrocinadores con los de reserva del equipo, con la semilla de la partida.
import { TEAMS } from './teams';
import { liveryArt } from './liveryArt';
import type { LiveryArt } from './liveryArt';
import { mulberry32, streamSeed } from '../simulation/Random';

export interface SeasonLivery { primary: string; secondary: string; sponsors: string[]; zones?: Partial<Record<string, string>>; emblem?: string; art?: LiveryArt; artKey?: string }

/**
 * [TL4, 19/11/2026] Disposición de los colores de cada coche, como la librea real de ese año (sin marcas): qué color va en
 * cada zona de la carrocería (paintZones) y el emblema propio del equipo. Revisión del usuario: «las papayas tienen que
 * tener los colores negro como están puestos en el coche oficial… Red Bull… un toro amarillo».
 */
type Design = { zones: Record<string, string>; emblem?: string };
const Z = (cuerpo: string, punta: string, tapa: string, aleta: string, ponton: string, costado: string, lateral: string, alerones: string, placas: string, emblem?: string): Design => ({
  zones: { zona_cuerpo: cuerpo, zona_punta: punta, zona_tapa: tapa, zona_aleta: aleta, zona_ponton: ponton, zona_costado: costado, zona_lateral: lateral, zona_alerones: alerones, zona_placas: placas },
  ...(emblem ? { emblem } : {}),
});
const DESIGNS: Record<string, Partial<Record<number, Design>>> = {
  //          cuerpo     punta      tapa       aleta      pontón     costado    lateral    alerones   placas
  // Según las fotos del GP de Austria 2023, 2024, 2025 y 2026 (Wikimedia Commons): dónde va cada color, sin marcas.
  // [19/11/2026, el usuario] Alerones y placas revisados con las fotos de Austria 2025 (Wikimedia Commons): los alerones son
  // negros o azul marino; las placas llevan el color del equipo solo en McLaren, Ferrari, Haas, Alpine y Racing Bulls.
  mclaren:     { 2025: Z('#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#222326', '#222326', '#FF8000'), 2023: Z('#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#1E1E22', '#1E1E22', '#FF8000'), 2024: Z('#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#1E1E22', '#1E1E22', '#FF8000'), 2026: Z('#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#FF8000', '#1E1E22', '#1E1E22', '#FF8000') },
  redbull:     { 2025: Z('#1A2340', '#E30613', '#1A2340', '#1A2340', '#1A2340', '#1A2340', '#1A2340', '#1A2340', '#1A2340', 'toro'), 2023: Z('#1B2238', '#F5B400', '#1B2238', '#1B2238', '#1B2238', '#1B2238', '#1B2238', '#1B2238', '#1B2238', 'toro'), 2024: Z('#182040', '#F5B400', '#182040', '#182040', '#182040', '#182040', '#182040', '#182040', '#182040', 'toro'), 2026: Z('#14204A', '#F5B400', '#14204A', '#14204A', '#14204A', '#14204A', '#14204A', '#14204A', '#14204A', 'toro') },
  ferrari:     { 2025: Z('#D8001F', '#D8001F', '#D8001F', '#FFFFFF', '#D8001F', '#D8001F', '#D8001F', '#151515', '#D8001F'), 2023: Z('#D40000', '#D40000', '#D40000', '#D40000', '#D40000', '#D40000', '#141414', '#151515', '#151515'), 2024: Z('#E8002D', '#E8002D', '#E8002D', '#E8002D', '#E8002D', '#E8002D', '#141414', '#151515', '#151515'), 2026: Z('#E10019', '#E10019', '#FFFFFF', '#FFFFFF', '#E10019', '#E10019', '#141414', '#151515', '#E10019') },
  mercedes:    { 2025: Z('#7A8188', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414'), 2023: Z('#9AA0A6', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414'), 2024: Z('#8E949A', '#8E949A', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414', '#141414'), 2026: Z('#16C2BC', '#16C2BC', '#141414', '#141414', '#16C2BC', '#16C2BC', '#141414', '#141414', '#141414') },
  astonmartin: { 2025: Z('#00594F', '#00594F', '#00594F', '#CEDC00', '#00594F', '#00594F', '#004C43', '#121414', '#121414'), 2023: Z('#00594F', '#00594F', '#00594F', '#00594F', '#00594F', '#00594F', '#121414', '#121414', '#00594F'), 2024: Z('#00665E', '#00665E', '#00665E', '#00665E', '#00665E', '#00665E', '#121414', '#121414', '#121414'), 2026: Z('#004C45', '#004C45', '#004C45', '#004C45', '#004C45', '#004C45', '#121414', '#121414', '#121414') },
  williams:    { 2025: Z('#1E66E0', '#0B1E45', '#1E66E0', '#1E66E0', '#1E66E0', '#1E66E0', '#0B1E45', '#0B1E45', '#0B1E45'), 2023: Z('#0B2D7A', '#0B2D7A', '#0B2D7A', '#0B2D7A', '#0B2D7A', '#0B2D7A', '#0B0F1E', '#0B1E45', '#00A3E0'), 2024: Z('#0E2470', '#0E2470', '#0E2470', '#0E2470', '#1F4FD1', '#1F4FD1', '#0B0F1E', '#0B1E45', '#0B1E45'), 2026: Z('#3D9BE9', '#0B1E3F', '#3D9BE9', '#3D9BE9', '#3D9BE9', '#3D9BE9', '#0B1E3F', '#0B1E3F', '#0B1E3F') },
  racingbulls: { 2025: Z('#F2F2F2', '#1634CC', '#F2F2F2', '#1634CC', '#F2F2F2', '#F2F2F2', '#1634CC', '#141414', '#F2F2F2', 'toro'), 2023: Z('#F4F4F4', '#F4F4F4', '#20394C', '#20394C', '#F4F4F4', '#F4F4F4', '#20394C', '#20394C', '#20394C', 'toro'), 2024: Z('#F2F2F2', '#F2F2F2', '#1634CC', '#1634CC', '#1634CC', '#1634CC', '#1634CC', '#141414', '#1634CC', 'toro'), 2026: Z('#F2F2F2', '#F2F2F2', '#F2F2F2', '#F2F2F2', '#F2F2F2', '#F2F2F2', '#1A2350', '#141414', '#F2F2F2', 'toro') },
  haas:        { 2025: Z('#F4F4F4', '#E6002B', '#F4F4F4', '#F4F4F4', '#F4F4F4', '#F4F4F4', '#16171A', '#16171A', '#E6002B'), 2023: Z('#F4F4F4', '#F4F4F4', '#141416', '#141416', '#141416', '#141416', '#141416', '#141416', '#F4F4F4'), 2024: Z('#F4F4F4', '#F4F4F4', '#16171A', '#16171A', '#16171A', '#16171A', '#16171A', '#16171A', '#F4F4F4'), 2026: Z('#F2F2F2', '#F2F2F2', '#C8102E', '#C8102E', '#F2F2F2', '#F2F2F2', '#16171A', '#16171A', '#C8102E') },
  alpine:      { 2025: Z('#FF6FB5', '#0A2A5E', '#FF6FB5', '#FF6FB5', '#FF6FB5', '#FF6FB5', '#0A2A5E', '#101218', '#FF6FB5'), 2023: Z('#0A4FA0', '#0A4FA0', '#0A4FA0', '#0A4FA0', '#0A4FA0', '#FF87BC', '#101218', '#101218', '#0A4FA0'), 2024: Z('#0078C1', '#0078C1', '#121418', '#121418', '#121418', '#FF87BC', '#121418', '#121418', '#FF87BC'), 2026: Z('#FF87BC', '#FF87BC', '#2E8FE0', '#2E8FE0', '#FF87BC', '#FF87BC', '#121418', '#121418', '#FF87BC') },
  sauber:      { 2025: Z('#3CE03C', '#3CE03C', '#3CE03C', '#3CE03C', '#3CE03C', '#3CE03C', '#111111', '#111111', '#111111'), 2023: Z('#900000', '#900000', '#111111', '#111111', '#900000', '#900000', '#111111', '#111111', '#900000'), 2024: Z('#111111', '#52E252', '#111111', '#111111', '#111111', '#111111', '#111111', '#111111', '#52E252'), 2026: Z('#B5B7BA', '#B5B7BA', '#111111', '#111111', '#B5B7BA', '#E30613', '#111111', '#111111', '#111111') },
};

type Entry = [name: string, primary: string, secondary: string, sponsors: string[]];
const base = (teamId: string, name: string, sponsors: string[]): Entry => [name, TEAMS[teamId].color, TEAMS[teamId].accentColor, sponsors];

/** [TL4] Zonas y emblema de un equipo un año (para la librea de siempre, la de 2025). */
export function liveryDesign(teamId: string, year: number): { zones?: Partial<Record<string, string>>; emblem?: string; art?: LiveryArt; artKey?: string } {
  const d = DESIGNS[teamId]?.[clampYear(year)];
  const art = liveryArt(teamId, year);
  return { ...(d ? { zones: { ...d.zones }, ...(d.emblem ? { emblem: d.emblem } : {}) } : {}), ...(art ? { art, artKey: `${teamId}-${clampYear(year)}` } : {}) };
}

/** Librea y nombre de cada equipo y año (2025: los colores de teams.ts). */
const TABLE: Record<string, Record<number, Entry>> = {
  mclaren: {
    2023: ['McPapaya Racing', '#FF8000', '#47C7FC', ['Okey X', 'Cromo', 'Delicioso', 'Arrobas']],
    2024: ['McPapaya Racing', '#FF8000', '#1E1E1E', ['Okey X', 'Gugle', 'Delicioso', 'Arrobas']],
    2025: base('mclaren', 'McPapaya Mastercarta Racing', ['Mastercarta', 'Okey X', 'Gugle', 'Delicioso']),
    2026: ['McPapaya Mastercarta Racing', '#FF8000', '#0F0F0F', ['Mastercarta', 'Okey X', 'Gugle', 'Arrobas']],
  },
  redbull: {
    2023: ['Oráculo Red Bulla Racing', '#1B2A5C', '#E30118', ['Oráculo', 'Baibai', 'Móvil Uno', 'TAG Hoyer']],
    2024: ['Oráculo Red Bulla Racing', '#14234F', '#E8002D', ['Oráculo', 'Baibai', 'Móvil Uno', 'Pumba']],
    2025: base('redbull', 'Oráculo Red Bulla Racing', ['Oráculo', 'Baibai', 'Móvil Uno', 'TAG Hoyer']),
    2026: ['Oráculo Red Bulla Racing', '#0A1E4F', '#F2C200', ['Oráculo', 'Baibai', 'Fortito', 'TAG Hoyer']],
  },
  ferrari: {
    2023: ['Scudería Errari', '#DC0000', '#1A1A1A', ['Concha Oil', 'Santandreu', 'Ray-Bon', 'Ricardo Mil']],
    2024: ['Scudería Errari', '#E8002D', '#FFFFFF', ['Concha Oil', 'Santandreu', 'Ray-Bon', 'Ricardo Mil']],
    2025: base('ferrari', 'Scudería Errari Plan B', ['HPrecio', 'Concha Oil', 'Santandreu', 'Ray-Bon']),
    2026: ['Scudería Errari Plan B', '#E10019', '#FFF200', ['HPrecio', 'Concha Oil', 'Santandreu', 'Ricardo Mil']],
  },
  mercedes: {
    2023: ['Totocedes-AMG Petrolas', '#1A1A1A', '#27F4D2', ['Patronus', 'Inéditos', 'Cualcom', 'Hilfígaro']],
    2024: ['Totocedes-AMG Petrolas', '#1C1C1C', '#C0C0C0', ['Patronus', 'Inéditos', 'Cualcom', 'Hilfígaro']],
    2025: base('mercedes', 'Totocedes-AMG Petrolas', ['Patronus', 'Inéditos', 'Microsuave', 'Hilfígaro']),
    2026: ['Totocedes-AMG Petrolas', '#C8CCCE', '#00A19C', ['Patronus', 'Microsuave', 'Cualcom', 'Hilfígaro']],
  },
  astonmartin: {
    2023: ['Aston Papá Carambola Incógnito', '#00594F', '#CEDC00', ['Carambola', 'Incógnito', 'Valvulina', 'Pirulí']],
    2024: ['Aston Papá Carambola', '#00665E', '#CEDC00', ['Carambola', 'Incógnito', 'Valvulina', 'Pirulí']],
    2025: base('astonmartin', 'Aston Papá Stroll Team', ['Carambola', 'Valvulina', 'Pirulí', 'Papá Paga']),
    2026: ['Aston Papá Stroll Team', '#004C45', '#D4E000', ['Carambola', 'Hondita', 'Valvulina', 'Pirulí']],
  },
  williams: {
    2023: ['Vowlliams Racing', '#041E42', '#00A3E0', ['Dura Chill', 'Gulpf', 'Kraquen', 'Sofistica']],
    2024: ['Vowlliams Racing', '#00205B', '#00A0DE', ['Komatsú', 'Dura Chill', 'Gulpf', 'Kraquen']],
    2025: base('williams', 'Atlasiano Vowlliams Racing', ['Atlasiano', 'Komatsú', 'Dura Chill', 'Barclaus']),
    2026: ['Atlasiano Vowlliams Racing', '#1868DB', '#0B1E3F', ['Atlasiano', 'Barclaus', 'Dura Chill', 'Gulpf']],
  },
  racingbulls: {
    2023: ['Escudería Alfa Torero', '#20394C', '#FFFFFF', ['Alfa Toalla', 'Orlando', 'Mancha Azul', 'Zebrita']],
    2024: ['Vizcash Racing Bueyes', '#1634CC', '#E8E8E8', ['Vizcash', 'Bizcocho', 'Hugo Jefe', 'Taxímetro']],
    2025: base('racingbulls', 'Vizcash Racing Bueyes', ['Vizcash', 'Bizcocho', 'Hugo Jefe', 'Taxímetro']),
    2026: ['Vizcash Racing Bueyes', '#FFFFFF', '#1634CC', ['Vizcash', 'Hugo Jefe', 'Taxímetro', 'Bizcocho']],
  },
  haas: {
    2023: ['MonyGramo Haasta Luego', '#FFFFFF', '#B6BABD', ['MonyGramo', 'Palfínguer', 'Chipotlé', 'Bosé']],
    2024: ['MonyGramo Haasta Luego', '#FFFFFF', '#E6002B', ['MonyGramo', 'Palfínguer', 'Chipotlé', 'Bosé']],
    2025: base('haas', 'MonyGramo Haasta Luego', ['MonyGramo', 'Toyoda', 'Chipotlé', 'Bosé']),
    2026: ['Toyoda Gazú Haasta Luego', '#F2F2F2', '#C8102E', ['Toyoda', 'Gazú', 'MonyGramo', 'Bosé']],
  },
  alpine: {
    2023: ['BTW Alpino Grigio', '#0093CC', '#FF87BC', ['BTW', 'Castoro', 'Mapfrío', 'Kat-Kit']],
    2024: ['BTW Alpino Grigio', '#0078C1', '#FF87BC', ['BTW', 'Castoro', 'Mapfrío', 'Kat-Kit']],
    2025: base('alpine', 'BTW Alpino Grigio', ['BTW', 'Castoro', 'Salesfuerza', 'Mapfrío']),
    2026: ['BTW Alpino Grigio', '#FF87BC', '#005BA9', ['BTW', 'Salesfuerza', 'Castoro', 'Kat-Kit']],
  },
  sauber: {
    2023: ['Alfa Romero Steak', '#900000', '#FFFFFF', ['Alfa Romero', 'Steak', 'Kriptón', 'Musgo Oil']],
    2024: ['Steak Team Kik Salsa', '#52E252', '#1A1A1A', ['Steak', 'Kik Salsa', 'Kriptón', 'AWSome Nube']],
    2025: base('sauber', 'Steak Team Kik Salsa', ['Steak', 'Kik Salsa', 'Kriptón', 'AWSome Nube']),
    2026: ['Audiencia F-Uno Team', '#B5B7BA', '#E30613', ['Cuatro Anillos', 'Revolución', 'Nexofit', 'Bitpandita']],
  },
};

/** Patrocinadores de reserva de cada equipo para los años sin fin (no se repiten entre equipos). */
const RESERVE: Record<string, string[]> = {
  mclaren: ['Papayón', 'Naranjito', 'Zumo Total', 'Gajo Uno', 'Mandarina X', 'Pulpa Pro'],
  redbull: ['Alitas', 'Bueyfuel', 'Cuernos', 'Taurina', 'Embestida', 'Becerro Tech'],
  ferrari: ['Cavallino', 'Rosso Pasta', 'Maranelo', 'Tifosol', 'Estrategia B', 'Plan Z'],
  mercedes: ['Plateado', 'Flechita', 'Turquesa Pro', 'Toto Tech', 'Eslalon', 'Silbato'],
  astonmartin: ['Verdolaga', 'Limón Racing', 'Bandera Verde', 'Espárrago', 'Menta Fuel', 'Papá Invierte'],
  williams: ['Azulón', 'Grove Fresh', 'Cobalto', 'Marino Uno', 'Nostalgia', 'Garaje Viejo'],
  racingbulls: ['Toro Junior', 'Faenza Té', 'Ternero', 'Rebaño', 'Pasto Azul', 'Mugido'],
  haas: ['Hastío', 'Gunther Dice', 'Presupuesto', 'Sobresueldo', 'Taller Kanna', 'Luego Más'],
  alpine: ['Montañero', 'Rosa Chicle', 'Esquí Azul', 'Cumbre', 'Fondue', 'Glaciar'],
  sauber: ['Bisteque', 'Hinwil Hot', 'Chuletón', 'Verde Lima', 'Suizo Seguro', 'Relojito'],
};

const FIRST = 2023, LAST = 2026;
const clampYear = (year: number) => Math.min(LAST, Math.max(FIRST, Math.floor(year)));

/** Nombre largo del equipo ese año (después de 2026, el de 2026). */
export function seasonTeamName(teamId: string, year: number): string {
  return TABLE[teamId]?.[clampYear(year)]?.[0] ?? TEAMS[teamId]?.name ?? teamId;
}

/** Librea de la tabla (2023 a 2026). */
function tableLivery(teamId: string, year: number): SeasonLivery {
  const entry = TABLE[teamId]?.[clampYear(year)];
  const design = DESIGNS[teamId]?.[clampYear(year)];
  const art = liveryArt(teamId, year);
  const extra = { ...(design ? { zones: { ...design.zones }, ...(design.emblem ? { emblem: design.emblem } : {}) } : {}), ...(art ? { art, artKey: `${teamId}-${clampYear(year)}` } : {}) };
  return entry ? { primary: entry[1], secondary: entry[2], sponsors: [...entry[3]], ...extra } : { primary: TEAMS[teamId]?.color ?? '#8a94a6', secondary: TEAMS[teamId]?.accentColor ?? '#1f2937', sponsors: ['Circuita', 'Paddock 1', 'Vuelta Uno', 'Recta Larga'] };
}

/** Mueve un color un poco (cada canal, como mucho `spread` arriba o abajo). */
function nudge(color: string, rng: () => number, spread: number): string {
  const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const shift = (rng() * 2 - 1) * spread;
  return '#' + channels.map(c => Math.round(Math.min(255, Math.max(0, c + shift + (rng() * 2 - 1) * spread * 0.4))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Librea de un equipo un año. De 2023 a 2026, la de la tabla. Desde 2027, la de 2026 con los colores algo movidos y uno
 * o dos patrocinadores cambiados por los de reserva del equipo; con la misma semilla y el mismo año, la misma librea.
 */
export function seasonLivery(teamId: string, year: number, seed: number): SeasonLivery {
  const from = tableLivery(teamId, year);
  if (year <= LAST) return from;
  const rng = mulberry32(streamSeed(seed, `librea-${teamId}-${Math.floor(year)}`));
  const reserve = [...(RESERVE[teamId] ?? [])];
  const sponsors = [...from.sponsors];
  const swaps = rng() < 0.5 ? 1 : 2;
  const slots = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, swaps);
  for (const slot of slots) {
    if (!reserve.length) break;
    sponsors[slot] = reserve.splice(Math.floor(rng() * reserve.length), 1)[0];
  }
  return { ...from, primary: nudge(from.primary, rng, 26), secondary: nudge(from.secondary, rng, 26), sponsors };
}
