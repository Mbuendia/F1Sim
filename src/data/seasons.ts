// [TL2] Datos de cada temporada, de 2023 a 2026: la parrilla al empezar el año, la fuerza del coche y el motor de cada
// equipo, y la edad y el palmarés de cada piloto en ese momento. Anotados de memoria (16/11/2026), sin fuente oficial:
// los revisa el usuario. Los nombres son de parodia, como en drivers.ts y teams.ts.
// La fuerza de 2023, 2024 y 2025 sigue el orden real del campeonato de constructores de ese año; la de 2026 es la que
// ya tenía el juego (la temporada aún no se ha decidido). Después del primer año, la partida sigue su propia historia:
// `evolveForm` hace el coche del año siguiente con el de este, el desarrollo de cada equipo y algo de azar.
import type { Driver } from '../types/f1';
import { DRIVERS } from './drivers';
import { TEAMS } from './teams';
import { mulberry32, streamSeed } from '../simulation/Random';
import { seasonLivery, seasonTeamName } from './seasonLiveries';
import type { SeasonLivery } from './seasonLiveries';

export { seasonLivery, seasonTeamName };
export type { SeasonLivery };

export const DATA_YEARS = [2023, 2024, 2025, 2026] as const;
const FIRST = DATA_YEARS[0], LAST = DATA_YEARS[DATA_YEARS.length - 1];
/** Año de las fichas de drivers.ts (edad y palmarés al empezar 2025). */
const BASE_YEAR = 2025;
const clampYear = (year: number) => Math.min(LAST, Math.max(FIRST, Math.floor(year)));

/** Lo que cambia de un equipo de un año a otro. */
export interface TeamYear {
  carPerformance: number;
  aerodynamics: number;
  enginePower: number;
  reliability: number;
  horsepower: number;
  engineManufacturer: string;
  engineModel: string;
  /** [TL3] Nombre largo del equipo ese año y su librea (ausentes en las partidas guardadas con TL2). */
  name?: string;
  livery?: SeasonLivery;
}
export type TeamForm = Record<string, TeamYear>;

/** Pilotos de 2023 a 2026 que no están en la parrilla de partida del juego (drivers.ts). Datos de 2025, como allí. */
const extra = (d: Omit<Driver, 'teamId'>): Driver => ({ ...d, teamId: '' });
export const EXTRA_DRIVERS: Record<string, Driver> = {
  perez: extra({ id: 'perez', code: 'PER', firstName: 'Sergio', lastName: 'Pérdiz', number: 11, age: 35, country: 'México', countryFlag: '🇲🇽', palmaresScore: 0.8, worldChampionships: 0, careerWins: 6, careerPodiums: 39, talentRating: 0.9, luckRating: 0.7, tireManagement: 0.93, raceCraft: 0.88, consistency: 0.82 }),
  bottas: extra({ id: 'bottas', code: 'BOT', firstName: 'Valtteri', lastName: 'Botazos', number: 77, age: 35, country: 'Finlandia', countryFlag: '🇫🇮', palmaresScore: 0.8, worldChampionships: 0, careerWins: 10, careerPodiums: 67, talentRating: 0.9, luckRating: 0.72, tireManagement: 0.88, raceCraft: 0.85, consistency: 0.88 }),
  zhou: extra({ id: 'zhou', code: 'ZHO', firstName: 'Guanyu', lastName: 'Shumai', number: 24, age: 25, country: 'China', countryFlag: '🇨🇳', palmaresScore: 0.62, worldChampionships: 0, careerWins: 0, careerPodiums: 0, talentRating: 0.85, luckRating: 0.72, tireManagement: 0.84, raceCraft: 0.82, consistency: 0.84 }),
  magnussen: extra({ id: 'magnussen', code: 'MAG', firstName: 'Kevin', lastName: 'Magnífico', number: 20, age: 32, country: 'Dinamarca', countryFlag: '🇩🇰', palmaresScore: 0.66, worldChampionships: 0, careerWins: 0, careerPodiums: 1, talentRating: 0.86, luckRating: 0.7, tireManagement: 0.82, raceCraft: 0.88, consistency: 0.8 }),
  sargeant: extra({ id: 'sargeant', code: 'SAR', firstName: 'Logan', lastName: 'Sargentón', number: 2, age: 24, country: 'Estados Unidos', countryFlag: '🇺🇸', palmaresScore: 0.55, worldChampionships: 0, careerWins: 0, careerPodiums: 0, talentRating: 0.82, luckRating: 0.65, tireManagement: 0.8, raceCraft: 0.78, consistency: 0.76 }),
  devries: extra({ id: 'devries', code: 'DEV', firstName: 'Nyck', lastName: 'De Frías', number: 21, age: 30, country: 'Países Bajos', countryFlag: '🇳🇱', palmaresScore: 0.62, worldChampionships: 0, careerWins: 0, careerPodiums: 0, talentRating: 0.84, luckRating: 0.65, tireManagement: 0.82, raceCraft: 0.8, consistency: 0.78 }),
  ricciardo: extra({ id: 'ricciardo', code: 'RIC', firstName: 'Daniel', lastName: 'Sonriardo', number: 3, age: 35, country: 'Australia', countryFlag: '🇦🇺', palmaresScore: 0.82, worldChampionships: 0, careerWins: 8, careerPodiums: 32, talentRating: 0.88, luckRating: 0.7, tireManagement: 0.85, raceCraft: 0.9, consistency: 0.8 }),
  colapinto: extra({ id: 'colapinto', code: 'COL', firstName: 'Franco', lastName: 'Colapintón', number: 43, age: 21, country: 'Argentina', countryFlag: '🇦🇷', palmaresScore: 0.58, worldChampionships: 0, careerWins: 0, careerPodiums: 0, talentRating: 0.86, luckRating: 0.7, tireManagement: 0.8, raceCraft: 0.84, consistency: 0.78 }),
  lindblad: extra({ id: 'lindblad', code: 'LIN', firstName: 'Arvid', lastName: 'Lindoblad', number: 41, age: 17, country: 'Reino Unido', countryFlag: '🇬🇧', palmaresScore: 0.55, worldChampionships: 0, careerWins: 0, careerPodiums: 0, talentRating: 0.88, luckRating: 0.72, tireManagement: 0.8, raceCraft: 0.84, consistency: 0.8 }),
};

/** Parrilla al empezar cada año (equipo → sus dos pilotos). 2025 es la de drivers.ts. */
const GRIDS: Record<number, Record<string, [string, string]>> = {
  2023: {
    redbull: ['verstappen', 'perez'], mercedes: ['hamilton', 'russell'], ferrari: ['leclerc', 'sainz'], mclaren: ['norris', 'piastri'],
    astonmartin: ['alonso', 'stroll'], alpine: ['gasly', 'ocon'], williams: ['albon', 'sargeant'], racingbulls: ['tsunoda', 'devries'],
    sauber: ['bottas', 'zhou'], haas: ['hulkenberg', 'magnussen'],
  },
  2024: {
    redbull: ['verstappen', 'perez'], mercedes: ['hamilton', 'russell'], ferrari: ['leclerc', 'sainz'], mclaren: ['norris', 'piastri'],
    astonmartin: ['alonso', 'stroll'], alpine: ['gasly', 'ocon'], williams: ['albon', 'sargeant'], racingbulls: ['tsunoda', 'ricciardo'],
    sauber: ['bottas', 'zhou'], haas: ['hulkenberg', 'magnussen'],
  },
  2025: Object.fromEntries(Object.values(TEAMS).map(team => [team.id, team.drivers as [string, string]])),
  // Sin Cadillac: Pérdiz y Botazos se quedan fuera; Tsunami y Doomhan, sin asiento.
  2026: {
    mclaren: ['norris', 'piastri'], mercedes: ['russell', 'antonelli'], redbull: ['verstappen', 'hadjar'], ferrari: ['leclerc', 'hamilton'],
    williams: ['albon', 'sainz'], racingbulls: ['lawson', 'lindblad'], astonmartin: ['alonso', 'stroll'], haas: ['ocon', 'bearman'],
    sauber: ['hulkenberg', 'bortoleto'], alpine: ['gasly', 'colapinto'],
  },
};

/** Equipo de cada piloto al empezar ese año (fuera de 2023-2026, el año más cercano). */
export function lineupFor(year: number): Record<string, string> {
  const grid = GRIDS[clampYear(year)];
  return Object.fromEntries(Object.entries(grid).flatMap(([teamId, pair]) => pair.map(id => [id, teamId])));
}

/** Orden real del campeonato de constructores de cada año (del primero al último). */
const ORDER: Record<number, string[]> = {
  2023: ['redbull', 'mercedes', 'ferrari', 'mclaren', 'astonmartin', 'alpine', 'williams', 'racingbulls', 'sauber', 'haas'],
  2024: ['mclaren', 'ferrari', 'redbull', 'mercedes', 'astonmartin', 'alpine', 'haas', 'racingbulls', 'williams', 'sauber'],
  2025: ['mclaren', 'mercedes', 'redbull', 'ferrari', 'williams', 'racingbulls', 'astonmartin', 'haas', 'sauber', 'alpine'],
};
/** Fuerza del coche por puesto: en 2023, un coche muy por delante; en 2025, cuatro casi juntos. */
const SPREAD: Record<number, number[]> = {
  2023: [0.999, 0.9935, 0.993, 0.9925, 0.9915, 0.989, 0.987, 0.9865, 0.986, 0.9855],
  2024: [0.999, 0.9985, 0.998, 0.997, 0.991, 0.988, 0.9875, 0.987, 0.9865, 0.985],
  2025: [0.999, 0.9975, 0.9972, 0.997, 0.9925, 0.99, 0.9895, 0.989, 0.987, 0.986],
};

/** Motores (de parodia) de cada fabricante: potencia de referencia y modelo. */
const ENGINES = {
  totocedes: { engineManufacturer: TEAMS.mercedes.engineManufacturer, engineModel: TEAMS.mercedes.engineModel, horsepower: 1045 },
  errari: { engineManufacturer: TEAMS.ferrari.engineManufacturer, engineModel: TEAMS.ferrari.engineModel, horsepower: 1038 },
  honda: { engineManufacturer: TEAMS.redbull.engineManufacturer, engineModel: TEAMS.redbull.engineModel, horsepower: 1030 },
  renol: { engineManufacturer: TEAMS.alpine.engineManufacturer, engineModel: TEAMS.alpine.engineModel, horsepower: 1015 },
  // 2026: motores nuevos del reglamento de 2026.
  fordtrains: { engineManufacturer: 'Red Bulla Fordtrains', engineModel: 'Red Bulla Fordtrains DM01 1.6L V6 Turbo', horsepower: 1015 },
  hondaAston: { engineManufacturer: TEAMS.redbull.engineManufacturer.replace(' RBPT', ''), engineModel: 'Hondamental RA626H 1.6L V6 Turbo', horsepower: 1022 },
  audiencia: { engineManufacturer: 'Audiencia', engineModel: 'Audiencia AFR 26 1.6L V6 Turbo', horsepower: 1010 },
};
type EngineId = keyof typeof ENGINES;
/** Motor de cada equipo: hasta 2025, el de teams.ts; en 2026 cambian Red Bulla, Racing Bueyes, Aston Papá, Steak Sauber y Alpino. */
const SUPPLIER_2025: Record<string, EngineId> = {
  mclaren: 'totocedes', mercedes: 'totocedes', astonmartin: 'totocedes', williams: 'totocedes',
  ferrari: 'errari', haas: 'errari', sauber: 'errari', redbull: 'honda', racingbulls: 'honda', alpine: 'renol',
};
const SUPPLIER_2026: Record<string, EngineId> = { ...SUPPLIER_2025, redbull: 'fordtrains', racingbulls: 'fordtrains', astonmartin: 'hondaAston', sauber: 'audiencia', alpine: 'totocedes' };
/** En 2023 el motor del Red Bulla era el mejor de la parrilla. */
const HP_BY_YEAR: Partial<Record<number, Partial<Record<EngineId, number>>>> = { 2023: { honda: 1048, totocedes: 1040 }, 2024: { honda: 1040 } };

const enginePowerOf = (hp: number) => Math.round((0.99 + ((hp - 1010) / 38) * 0.009) * 10000) / 10000;

function engineFor(teamId: string, year: number): Pick<TeamYear, 'engineManufacturer' | 'engineModel' | 'horsepower' | 'enginePower'> {
  const id = (year >= 2026 ? SUPPLIER_2026 : SUPPLIER_2025)[teamId] ?? 'totocedes';
  const engine = ENGINES[id];
  const horsepower = HP_BY_YEAR[year]?.[id] ?? engine.horsepower;
  return { engineManufacturer: engine.engineManufacturer, engineModel: engine.engineModel, horsepower, enginePower: year === 2025 ? TEAMS[teamId].enginePower : enginePowerOf(horsepower) };
}

/** Fuerza y motor de cada equipo al empezar ese año. */
export function teamFormFor(year: number): TeamForm {
  const y = clampYear(year);
  return Object.fromEntries(Object.values(TEAMS).map(team => {
    const engine = { ...engineFor(team.id, y), name: seasonTeamName(team.id, y), livery: seasonLivery(team.id, y, 0) };
    if (y === LAST) return [team.id, { carPerformance: team.carPerformance, aerodynamics: team.aerodynamics, reliability: team.reliability, ...engine }];
    const place = ORDER[y].indexOf(team.id);
    const carPerformance = SPREAD[y][place];
    const year2025 = y === 2025 ? { horsepower: team.horsepower } : {};
    return [team.id, { carPerformance, aerodynamics: Math.round((carPerformance - 0.001) * 10000) / 10000, reliability: team.reliability, ...engine, ...year2025 }];
  }));
}

/** Palmarés (títulos, victorias, podios) al empezar cada año de quien ha cambiado desde 2023; si no figura, el de su ficha. */
const PALMARES: Record<string, Partial<Record<number, [number, number, number]>>> = {
  verstappen: { 2023: [2, 35, 77], 2024: [3, 54, 98], 2026: [4, 71, 126] },
  norris: { 2023: [0, 0, 6], 2024: [0, 0, 13], 2026: [1, 11, 44] },
  piastri: { 2023: [0, 0, 0], 2024: [0, 0, 2], 2026: [0, 9, 25] },
  hamilton: { 2023: [7, 103, 191], 2024: [7, 103, 197] },
  leclerc: { 2023: [0, 5, 24], 2024: [0, 5, 30], 2026: [0, 8, 50] },
  russell: { 2023: [0, 1, 9], 2024: [0, 1, 11], 2026: [0, 5, 24] },
  sainz: { 2023: [0, 1, 15], 2024: [0, 2, 18], 2026: [0, 4, 27] },
  alonso: { 2023: [2, 32, 98] },
  gasly: { 2023: [0, 1, 3], 2024: [0, 1, 4] },
  ocon: { 2023: [0, 1, 2], 2024: [0, 1, 3] },
  perez: { 2023: [0, 4, 28], 2024: [0, 6, 37] },
  hulkenberg: { 2026: [0, 0, 1] },
};

/** Ficha de un piloto al empezar ese año: edad y palmarés de entonces. La de 2025 es la de drivers.ts. */
export function driverSheetFor(driverId: string, year: number): Driver {
  const base = DRIVERS[driverId] ?? EXTRA_DRIVERS[driverId];
  const y = clampYear(year);
  if (!base || y === BASE_YEAR) return base;
  const palmares = PALMARES[driverId]?.[y];
  return {
    ...base, ...(base.age === undefined ? {} : { age: base.age - (BASE_YEAR - y) }),
    ...(palmares ? { worldChampionships: palmares[0], careerWins: palmares[1], careerPodiums: palmares[2] } : {}),
  };
}

/** Desarrollo de cada equipo en la temporada que se cierra: las mejoras montadas que hereda el coche nuevo. */
interface ProgramLike { legacy?: Record<string, unknown[]> }

export const EVOLUTION = {
  /** Parte de la diferencia con la media que conserva el coche nuevo (el resto se lo come la parrilla). */
  KEEP: 0.85,
  /** Fuerza que suma cada mejora heredada, frente a la media de la parrilla. */
  PER_UPGRADE: 0.0005,
  /** Azar de un año a otro (más o menos). */
  NOISE: 0.0012,
  /** Probabilidad y tamaño del pelotazo de un equipo de mitad de tabla o de abajo. */
  JACKPOT_CHANCE: 0.07,
  JACKPOT: 0.004,
  MIN: 0.978,
  MAX: 1,
};

/**
 * Coche del año siguiente de cada equipo: conserva parte de su ventaja (o desventaja), suma lo que desarrolló frente a
 * la media y un poco de azar; de vez en cuando un equipo de la mitad de abajo pega el pelotazo. Al llegar a 2026 cada
 * equipo monta el motor de 2026; después los motores se quedan. Con la misma semilla, el mismo resultado.
 */
export function evolveForm(form: TeamForm, nextYear: number, program: ProgramLike, seed: number): TeamForm {
  const rng = mulberry32(streamSeed(seed, `forma-${nextYear}`));
  const ids = Object.keys(form);
  const mean = ids.reduce((sum, id) => sum + form[id].carPerformance, 0) / ids.length;
  const upgrades = Object.fromEntries(ids.map(id => [id, program.legacy?.[id]?.length ?? 0]));
  const meanUpgrades = ids.reduce((sum, id) => sum + upgrades[id], 0) / ids.length;
  const ranked = [...ids].sort((a, b) => form[b].carPerformance - form[a].carPerformance);
  const round4 = (v: number) => Math.round(v * 100000) / 100000;
  return Object.fromEntries(ids.map(id => {
    const current = form[id];
    const noise = (rng() * 2 - 1) * EVOLUTION.NOISE;
    const jackpot = ranked.indexOf(id) >= 4 && rng() < EVOLUTION.JACKPOT_CHANCE ? EVOLUTION.JACKPOT : 0;
    const carPerformance = round4(Math.min(EVOLUTION.MAX, Math.max(EVOLUTION.MIN,
      mean + (current.carPerformance - mean) * EVOLUTION.KEEP + (upgrades[id] - meanUpgrades) * EVOLUTION.PER_UPGRADE + noise + jackpot)));
    const engine = nextYear === 2026 ? engineFor(id, 2026) : {};
    // [TL3] Librea y nombre del año nuevo: hasta 2026 los de la tabla; después, la librea propia de la partida.
    const look = { name: seasonTeamName(id, nextYear), livery: seasonLivery(id, nextYear, seed) };
    return [id, { ...current, ...engine, ...look, carPerformance, aerodynamics: round4(current.aerodynamics + (carPerformance - current.carPerformance)) }];
  }));
}

/** ¿Es legible una fuerza guardada? Los diez equipos con sus números. */
export function isTeamForm(data: unknown): data is TeamForm {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const form = data as Record<string, Partial<TeamYear>>;
  return Object.keys(TEAMS).every(id => {
    const t = form[id];
    return Boolean(t) && ['carPerformance', 'aerodynamics', 'enginePower', 'reliability', 'horsepower'].every(k => Number.isFinite(t?.[k as keyof TeamYear]))
      && typeof t?.engineManufacturer === 'string' && typeof t?.engineModel === 'string';
  });
}
