// [R18] Desarrollo del coche por proyectos (decisión del usuario: sin dinero, solo plazos; máximo 2 proyectos a la vez).
//
// El reparto de túnel de viento (ATR) por posición en constructores sigue la tabla de referencia del reglamento; aquí
// solo acorta o alarga la investigación: no hace mayor la mejora. Efectos, plazos y contrapartidas son diseño del
// juego. La unidad de potencia está homologada y es común por proveedor: ningún proyecto la toca.
import type { CarTechnical } from '../data/teamProfiles';
import { mulberry32, streamSeed } from './Random';

export const CATALOG_VERSION = 'desarrollo-2025.1';

type EffectField = 'fastCornerGrip' | 'slowCornerGrip' | 'cooling' | 'dragFactor' | 'tyreWear' | 'tyreHeat';
export interface ProjectSpec {
  label: string;
  description: string;
  /** Cambio multiplicativo de cada campo del perfil técnico (+0,01 = +1 %). */
  effect: Partial<Record<EffectField, number>>;
  researchRaces: number;
  productionRaces: number;
}

export const PROJECTS: Record<string, ProjectSpec> = {
  alerones: { label: 'Alerones de más carga', description: 'Más paso por curva rápida a cambio de más resistencia.', effect: { fastCornerGrip: 0.006, dragFactor: 0.012 }, researchRaces: 3, productionRaces: 1 },
  suelo: { label: 'Suelo y difusor', description: 'Más agarre en curva lenta y media; el neumático trabaja más.', effect: { slowCornerGrip: 0.006, fastCornerGrip: 0.003, tyreWear: 0.02 }, researchRaces: 4, productionRaces: 1 },
  refrigeracion: { label: 'Refrigeración más eficiente', description: 'Motor y frenos más frescos con algo más de resistencia.', effect: { cooling: 0.03, dragFactor: 0.005 }, researchRaces: 2, productionRaces: 1 },
  eficiencia: { label: 'Eficiencia aerodinámica', description: 'Menos resistencia en recta perdiendo algo de carga.', effect: { dragFactor: -0.015, fastCornerGrip: -0.003 }, researchRaces: 3, productionRaces: 1 },
  neumaticos: { label: 'Gestión de neumáticos', description: 'Menos desgaste a cambio de un neumático que tarda más en calentar.', effect: { tyreWear: -0.04, tyreHeat: -0.02 }, researchRaces: 3, productionRaces: 1 },
};

/** Túnel de viento disponible (%) por posición en constructores. */
export const ATR_PERCENT: Record<number, number> = { 1: 70, 2: 75, 3: 80, 4: 85, 5: 90, 6: 95, 7: 100, 8: 105, 9: 110, 10: 115 };
export const MAX_ACTIVE = 2;

export function researchRaces(key: string, constructorsPosition: number): number {
  const atr = ATR_PERCENT[Math.min(10, Math.max(1, Math.round(constructorsPosition)))] ?? 100;
  return Math.max(1, Math.ceil(PROJECTS[key].researchRaces * 100 / atr));
}

export interface Project {
  id: string;
  key: string;
  startedRace: number;
  /** Carrera desde la que la mejora está lista para montarse. */
  readyRace: number;
  researchEndRace: number;
  effect: ProjectSpec['effect'];
  installed: boolean;
}
export interface Installed { key: string; firstDriverId: string; fromRace: number }
export interface DevelopmentProgram {
  version: 1;
  catalog: string;
  teams: Record<string, { projects: Project[]; installed: Installed[] }>;
}

export const PROGRAM_STORAGE_KEY = 'f1_development_program';

export function emptyProgram(): DevelopmentProgram {
  return { version: 1, catalog: CATALOG_VERSION, teams: {} };
}

export function parseProgram(text: string | null): DevelopmentProgram {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && data.teams) return data as DevelopmentProgram;
  } catch { /* guardado ilegible */ }
  return emptyProgram();
}

const teamOf = (program: DevelopmentProgram, teamId: string) => program.teams[teamId] ?? { projects: [], installed: [] };

export function statusAt(project: Project, raceIndex: number): 'investigacion' | 'produccion' | 'listo' | 'instalado' {
  if (project.installed) return 'instalado';
  if (raceIndex >= project.readyRace) return 'listo';
  return raceIndex >= project.researchEndRace ? 'produccion' : 'investigacion';
}

export function activeProjects(program: DevelopmentProgram, teamId: string): Project[] {
  return teamOf(program, teamId).projects.filter(p => !p.installed);
}

export function startProject(program: DevelopmentProgram, teamId: string, key: string, raceIndex: number, constructorsPosition: number):
  { ok: boolean; program: DevelopmentProgram; reason?: string } {
  const spec = PROJECTS[key];
  const team = teamOf(program, teamId);
  const active = team.projects.filter(p => !p.installed);
  if (!spec) return { ok: false, program, reason: 'Proyecto desconocido' };
  if (active.length >= MAX_ACTIVE) return { ok: false, program, reason: `Como máximo ${MAX_ACTIVE} proyectos a la vez` };
  if (active.some(p => p.key === key)) return { ok: false, program, reason: 'Ese proyecto ya está en marcha' };
  const researchEndRace = raceIndex + researchRaces(key, constructorsPosition);
  const project: Project = {
    id: `${teamId}-${key}-${team.projects.filter(p => p.key === key).length + 1}`, key, startedRace: raceIndex,
    researchEndRace, readyRace: researchEndRace + spec.productionRaces, effect: { ...spec.effect }, installed: false,
  };
  return { ok: true, program: { ...program, teams: { ...program.teams, [teamId]: { ...team, projects: [...team.projects, project] } } } };
}

/** Primera unidad para un coche; el compañero la recibe en la carrera siguiente. */
export function installFirst(program: DevelopmentProgram, projectId: string, driverId: string, raceIndex: number): { ok: boolean; program: DevelopmentProgram } {
  for (const [teamId, team] of Object.entries(program.teams)) {
    const project = team.projects.find(p => p.id === projectId);
    if (!project) continue;
    if (project.installed || raceIndex < project.readyRace) return { ok: false, program };
    const next = {
      projects: team.projects.map(p => (p.id === projectId ? { ...p, installed: true } : p)),
      installed: [...team.installed, { key: project.key, firstDriverId: driverId, fromRace: raceIndex }],
    };
    return { ok: true, program: { ...program, teams: { ...program.teams, [teamId]: next } } };
  }
  return { ok: false, program };
}

/** Mejoras montadas en el coche de un piloto en una carrera. */
export function upgradesFor(program: DevelopmentProgram, teamId: string, driverId: string, raceIndex: number): string[] {
  return teamOf(program, teamId).installed
    .filter(i => (i.firstDriverId === driverId ? raceIndex >= i.fromRace : raceIndex >= i.fromRace + 1))
    .map(i => i.key);
}

/** Perfil técnico con las mejoras aplicadas y su versión; la potencia del motor no cambia. */
export function technicalWith(base: CarTechnical, keys: string[]): CarTechnical {
  if (!keys.length) return base;
  const next = { ...base };
  for (const key of keys) {
    for (const [field, change] of Object.entries(PROJECTS[key]?.effect ?? {}) as [EffectField, number][]) next[field] = next[field] * (1 + change);
  }
  next.version = `${base.version}+${keys.join('+')}`;
  return next;
}

/** La IA inicia proyectos hasta llenar sus huecos y monta lo que está listo (primer coche: su primer piloto). */
export function aiDevelop(program: DevelopmentProgram, teamIds: string[], raceIndex: number, positions: Record<string, number>, seed: number,
  firstDriverOf: (teamId: string) => string = teamId => `${teamId}-1`): DevelopmentProgram {
  let next = program;
  for (const teamId of teamIds) {
    for (const project of activeProjects(next, teamId)) {
      if (raceIndex >= project.readyRace) next = installFirst(next, project.id, firstDriverOf(teamId), raceIndex).program;
    }
    const rng = mulberry32(streamSeed(seed, `desarrollo-${teamId}-${raceIndex}`));
    while (activeProjects(next, teamId).length < MAX_ACTIVE) {
      const options = Object.keys(PROJECTS).filter(k => !activeProjects(next, teamId).some(p => p.key === k));
      if (!options.length) break;
      next = startProject(next, teamId, options[Math.floor(rng() * options.length)], raceIndex, positions[teamId] ?? 7).program;
    }
  }
  return next;
}
