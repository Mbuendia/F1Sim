// [R55] Libreas de los coches en 3D: colores de cada equipo y patrocinadores FICTICIOS (decisión del usuario: ninguna
// marca real en los coches). Los nombres son inventados para el juego. Créditos de los modelos 3D de terceros.
import { TEAMS } from './teams';
import { liveryDesign } from './seasonLiveries';

export interface Livery {
  teamId: string;
  /** Pintura principal (el color del equipo) y secundaria (alerones, toma de aire y retrovisores). */
  primary: string;
  secondary: string;
  /** Rótulos: pontón, cubierta del motor y deriva del alerón trasero, en ese orden. */
  sponsors: string[];
  /** [TL4, 19/11/2026] Color de cada zona de la carrocería (como el coche real); la que falte, del principal o el secundario. */
  zones?: Partial<Record<PaintZone, string>>;
  /** [TL4] Emblema propio del equipo (de parodia), en el costado del pontón en lugar del segundo patrocinador. */
  emblem?: string;
  /** [TL4] Librea dibujada (vista de lado y de arriba, con sus patrocinadores a escala real). */
  art?: import('./liveryArt').LiveryArt;
  artKey?: string;
}

/** [TL4] Zonas de pintura de la carrocería (las clasifica paintZones al cargar el coche). */
export const PAINT_ZONES = ['zona_cuerpo', 'zona_punta', 'zona_tapa', 'zona_aleta', 'zona_ponton', 'zona_costado', 'zona_lateral', 'zona_alerones', 'zona_placas', 'zona_halo'] as const;
export type PaintZone = typeof PAINT_ZONES[number];
/** De qué color sale cada zona si la librea no la dice. */
export const ZONE_FALLBACK: Record<PaintZone, 'primary' | 'secondary'> = {
  zona_cuerpo: 'primary', zona_punta: 'secondary', zona_tapa: 'primary', zona_aleta: 'primary', zona_ponton: 'primary', zona_costado: 'primary', zona_lateral: 'primary', zona_alerones: 'secondary', zona_placas: 'secondary', zona_halo: 'primary',
};

export const SPONSOR_NOTE = 'Patrocinadores ficticios: marcas inventadas para el juego, ninguna es real.';

const SPONSORS: Record<string, string[]> = {
  mclaren: ['Nuvora', 'Zentia', 'Halcyra'],
  redbull: ['Vextor', 'Orbisol', 'Kestrix'],
  ferrari: ['Lumetra', 'Solvane', 'Arquon'],
  mercedes: ['Tessaly', 'Quantiva', 'Meridel'],
  astonmartin: ['Brivio', 'Calindra', 'Noventis'],
  williams: ['Altiro', 'Nexaro', 'Veldora'],
  racingbulls: ['Taurix', 'Pixelia', 'Ombra One'],
  haas: ['Granitec', 'Rotalia', 'Ferrum 9'],
  alpine: ['Glacia', 'Aquenta', 'Rosalba'],
  sauber: ['Viridian X', 'Kinetra', 'Luzverde'],
};

export const LIVERIES: Record<string, Livery> = Object.fromEntries(Object.values(TEAMS).map(team => [team.id, {
  teamId: team.id,
  primary: team.color,
  secondary: team.accentColor,
  sponsors: SPONSORS[team.id] ?? ['Circuita', 'Paddock 1', 'Vuelta Uno'],
  // [TL4] La disposición de colores del coche de 2025 (como el real).
  ...liveryDesign(team.id, 2025),
}]));

const DEFAULT_LIVERY: Livery = { teamId: 'generico', primary: '#8a94a6', secondary: '#1f2937', sponsors: ['Circuita', 'Paddock 1', 'Vuelta Uno'] };

/** Librea del equipo (una genérica si no existe). */
export function liveryFor(teamId: string | undefined): Livery {
  return (teamId && LIVERIES[teamId]) || DEFAULT_LIVERY;
}

/** [TL3] Librea con la que sale un coche: la del año (carrera profesional) o, sin ella, la de siempre. */
export function carLivery(team: { id: string; livery?: Pick<Livery, 'primary' | 'secondary' | 'sponsors'> } | undefined): Pick<Livery, 'primary' | 'secondary' | 'sponsors'> {
  return team?.livery ?? liveryFor(team?.id);
}

/** Safety Car del juego: carrocería plateada, rótulos en rojo y un patrocinador ficticio en el capó. */
export const SAFETY_CAR_LIVERY = { body: '#b8bec6', accent: '#c81e1e', sponsors: ['Guardia Pista', 'Lumen Seguro'] };

export interface ModelCredit {
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
  changes: string;
}

/** [TL7] Crédito del coche de un año (el de 2025 sin año). */
export function carCreditKey(year: number | null | undefined): 'car' | 'car2023' | 'car2024' | 'car2026' {
  if (year == null || year === 2025) return 'car';
  return year <= 2023 ? 'car2023' : year === 2024 ? 'car2024' : 'car2026';
}

/** Atribución de los modelos 3D de terceros (ambos modificados para el juego). */
export const MODEL_CREDITS: Record<'car' | 'car2023' | 'car2024' | 'car2026' | 'safetyCar', ModelCredit> = {
  // [CA2, 07/11/2026] El coche de 2025 sustituye al de 2026 (F1 2026 concept, de Qvist_designs, guardado aparte para las temporadas largas).
  car: {
    title: '2025 F1 CAR',
    author: 'Abu Saif',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898',
    changes: 'Reducido de 3,1 millones a unos 94 000 triángulos; ruedas separadas y animadas; zonas de pintura, banda del compuesto y superficies para dorsal y patrocinadores.',
  },
  // [TL7, 18/11/2026] El coche de cada año de la carrera profesional.
  car2023: {
    title: 'Mercedes F1 W14 [FREE!!]',
    author: '3dblenderlol',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://sketchfab.com/3d-models/mercedes-f1-w14-free-26fda66f3e8a48d5a636056f8a64e299',
    changes: 'Sin logotipos ni texturas de marcas; reducido a unos 97 000 triángulos; ruedas separadas y animadas; zonas de pintura, banda del compuesto y superficies para dorsal y patrocinadores.',
  },
  // Modelo propio del autor del juego (sin licencia de terceros ni enlace).
  car2024: {
    title: 'Coche de 2024',
    author: 'el autor del juego',
    license: '',
    licenseUrl: '',
    source: '',
    changes: 'Modelo propio; sin calcas ni texturas, ruedas separadas y animadas, zonas de pintura y superficies para dorsal y patrocinadores.',
  },
  car2026: {
    title: 'F1 2026 concept (polygon model)',
    author: 'Qvist_designs',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42',
    changes: 'Reducido de 1,16 millones a unos 127 000 triángulos; ruedas separadas y animadas; zonas de pintura, banda del compuesto y superficies para dorsal y patrocinadores.',
  },
  safetyCar: {
    title: '2019 Mercedes-Benz AMG GTR Safety Car',
    author: 'OUTPISTON',
    license: 'CC BY-NC-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    source: 'https://sketchfab.com/3d-models/2019-mercedes-benz-amg-gtr-safety-car-5bfaf6b31d084dde80dae723b52998bc',
    changes: 'Sin texturas ni emblemas de marcas; materiales planos; ruedas y barra de luces como piezas aparte y animadas; superficies para rótulos.',
  },
};
