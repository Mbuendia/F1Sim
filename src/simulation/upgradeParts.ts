// [TL4, 18/11/2026] Tu coche mejora a la vista. Alcance elegido por el usuario: piezas añadidas que encajan en el coche
// sin cambiarle la forma (hechas en Blender para los cuatro coches), solo en los coches del jugador, con el nivel de cada
// pieza según las veces que se ha montado su mejora esta temporada (hasta 3; con el coche del año nuevo vuelve a la base)
// y a la vista en la carrera 3D, el centro de temporada y el coche del inicio.
// Sin three: lo usan el juego y los tests.
import type { DevelopmentProgram } from './Development';

/** Proyectos de desarrollo con pieza a la vista (el de neumáticos no tiene). */
export const UPGRADE_PROJECTS = ['alerones', 'suelo', 'refrigeracion', 'eficiencia'] as const;
export type UpgradeProject = typeof UPGRADE_PROJECTS[number];
export type UpgradeLevels = Record<UpgradeProject, number>;
export const MAX_UPGRADE_LEVEL = 3;
export const BASE_LEVELS: UpgradeLevels = { alerones: 0, suelo: 0, refrigeracion: 0, eficiencia: 0 };

/** Qué se añade en cada pieza (para la ficha y los textos). */

export const isUpgradeProject = (key: string): key is UpgradeProject => (UPGRADE_PROJECTS as readonly string[]).includes(key);

/**
 * Nivel de cada pieza en el coche de un piloto en una carrera: cuántas veces se ha montado su mejora en ese coche esta
 * temporada (el primer piloto la lleva desde la carrera en que se monta; el compañero, desde la siguiente), hasta 3. Lo
 * heredado del coche anterior no cuenta: el coche del año nuevo empieza con las piezas de base.
 */
export function upgradeLevels(program: DevelopmentProgram, teamId: string, driverId: string, raceIndex: number): UpgradeLevels {
  const levels: UpgradeLevels = { ...BASE_LEVELS };
  for (const item of program.teams[teamId]?.installed ?? []) {
    if (!isUpgradeProject(item.key)) continue;
    const mounted = item.firstDriverId === driverId ? raceIndex >= item.fromRace : raceIndex >= item.fromRace + 1;
    if (mounted) levels[item.key] = Math.min(MAX_UPGRADE_LEVEL, levels[item.key] + 1);
  }
  return levels;
}

/** El nivel siguiente de una pieza (lo que enseña el centro de temporada al decidir esa mejora). */
export function nextLevels(levels: UpgradeLevels, key: string): UpgradeLevels {
  if (!isUpgradeProject(key)) return levels;
  return { ...levels, [key]: Math.min(MAX_UPGRADE_LEVEL, levels[key] + 1) };
}

/** Nombre del nodo de una pieza en el archivo de mejoras: mejora_<proyecto>_<nivel>. Cada nivel se suma a los anteriores. */
export const upgradeNode = (key: UpgradeProject, level: number) => `mejora_${key}_${level}`;

/** Nodos que se ven con unos niveles (los de cada pieza hasta su nivel). */
export function upgradeNodeNames(levels: UpgradeLevels): string[] {
  return UPGRADE_PROJECTS.flatMap(key => Array.from({ length: Math.min(MAX_UPGRADE_LEVEL, Math.max(0, levels[key])) }, (_, i) => upgradeNode(key, i + 1)));
}

