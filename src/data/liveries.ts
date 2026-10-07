// [R55] Libreas de los coches en 3D: colores de cada equipo y patrocinadores FICTICIOS (decisión del usuario: ninguna
// marca real en los coches). Los nombres son inventados para el juego. Créditos de los modelos 3D de terceros.
import { TEAMS } from './teams';

export interface Livery {
  teamId: string;
  /** Pintura principal (el color del equipo) y secundaria (alerones, toma de aire y retrovisores). */
  primary: string;
  secondary: string;
  /** Rótulos: pontón, cubierta del motor y deriva del alerón trasero, en ese orden. */
  sponsors: string[];
}

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
}]));

const DEFAULT_LIVERY: Livery = { teamId: 'generico', primary: '#8a94a6', secondary: '#1f2937', sponsors: ['Circuita', 'Paddock 1', 'Vuelta Uno'] };

/** Librea del equipo (una genérica si no existe). */
export function liveryFor(teamId: string | undefined): Livery {
  return (teamId && LIVERIES[teamId]) || DEFAULT_LIVERY;
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

/** Atribución de los modelos 3D de terceros (ambos modificados para el juego). */
export const MODEL_CREDITS: Record<'car' | 'safetyCar', ModelCredit> = {
  car: {
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
