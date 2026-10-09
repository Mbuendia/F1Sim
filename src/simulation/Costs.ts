// [T4.2] Lo que cuesta dinero en el coche: empezar un proyecto de desarrollo, montar una unidad de componente y
// reparar los daños de un accidente. Plazos, efectos y sanciones son los de R18 y R19: aquí solo se cobra.
// Un proyecto y una unidad fuera de cupo son gastos voluntarios (no se aceptan si la deuda pasaría del límite); una
// unidad dentro del cupo y los daños son gastos obligados. La IA no pide prestado para lo voluntario: sin dinero deja
// de desarrollar y de montar fuera de cupo (decisión del usuario del 09/10/2026: sin mínimo garantizado).
// Todos los importes son diseño del juego, en miles.
import type { TrackIncident } from '../types/f1';
import type { RunoffSurface } from '../data/scenarioTypes';
import { DRIVERS } from '../data/drivers';
import { ALLOCATION, COMPONENT_LABEL, COMPONENT_TYPES, NOMINAL_RACES, fitNew, fittedUnit, undoFit } from './ComponentPool';
import type { ComponentState, ComponentType } from './ComponentPool';
import { MAX_ACTIVE, PROJECTS, activeProjects, installFirst, startProject } from './Development';
import type { DevelopmentProgram } from './Development';
import { FINANCE, balanceOf, charge, credit, formatMoney, spend } from './Finance';
import type { ManagementState } from './Management';
import { mulberry32, streamSeed } from './Random';

export const COSTS = {
  /** Coste de empezar cada proyecto del catálogo de R18. */
  PROJECT: { alerones: 3000, suelo: 4000, refrigeracion: 2000, eficiencia: 3000, neumaticos: 3000 } as Record<string, number>,
  /** Coste de un proyecto que no esté en la tabla. */
  PROJECT_DEFAULT: 3000,
  /** Coste de una unidad nueva de cada componente dentro del cupo. */
  COMPONENT: { ICE: 800, TC: 300, MGUH: 400, MGUK: 400, ES: 500, CE: 300 } as Record<ComponentType, number>,
  /** Una unidad fuera de cupo cuesta este tanto más (además de su sanción de parrilla). */
  EXCESS_FACTOR: 2,
  /** Daños de un accidente o una salida de pista según lo que hay fuera en ese punto. */
  DAMAGE: { wall: 900, tecpro: 700, gravel: 400, grass: 250, asphalt: 100 } as Record<RunoffSurface, number>,
  /** Accidente grave (el que saca bandera roja). */
  MAJOR_CRASH: 1500,
};

type Outcome<T> = T & { ok: boolean; management: ManagementState; reason: string | null };

export function projectCost(key: string): number {
  return PROJECTS[key] ? COSTS.PROJECT[key] ?? COSTS.PROJECT_DEFAULT : 0;
}

/** Cuánto le falta al equipo para poder pagar ese proyecto sin pasar del límite de deuda (0 si le llega). */
export function projectShortfall(management: ManagementState, teamId: string, key: string): number {
  return Math.max(0, projectCost(key) - (balanceOf(management.finance, teamId) + FINANCE.DEBT_LIMIT));
}

/**
 * Empieza un proyecto pagándolo. Si no puede empezar (ya está en marcha, no hay hueco) o el dinero no llega, no cambia
 * nada y dice por qué; con el dinero, cuánto falta.
 */
export function buyProject(management: ManagementState, program: DevelopmentProgram, teamId: string, key: string, raceIndex: number,
  constructorsPosition: number, round: number): Outcome<{ program: DevelopmentProgram }> {
  const started = startProject(program, teamId, key, raceIndex, constructorsPosition);
  if (!started.ok) return { ok: false, management, program, reason: started.reason ?? 'El proyecto no puede empezar' };
  const missing = projectShortfall(management, teamId, key);
  if (missing > 0) return { ok: false, management, program, reason: `Faltan ${formatMoney(missing)} para empezar «${PROJECTS[key].label}» (cuesta ${formatMoney(projectCost(key))})` };
  const paid = spend(management.finance, teamId, { round, kind: 'proyecto', label: `Proyecto: ${PROJECTS[key].label}`, amount: projectCost(key) });
  if (!paid.ok) return { ok: false, management, program, reason: paid.reason };
  return { ok: true, management: { ...management, finance: paid.state }, program: started.program, reason: null };
}

const unitsOf = (state: ComponentState, driverId: string, type: ComponentType) => state.units.filter(unit => unit.driverId === driverId && unit.type === type);
const withinQuota = (state: ComponentState, driverId: string, type: ComponentType) => unitsOf(state, driverId, type).length + 1 <= ALLOCATION[type];

/** Coste de montar ahora otra unidad nueva de ese componente: su precio, o más si ya está fuera de cupo. */
export function componentCost(state: ComponentState, driverId: string, type: ComponentType): number {
  return withinQuota(state, driverId, type) ? COSTS.COMPONENT[type] : Math.round(COSTS.COMPONENT[type] * COSTS.EXCESS_FACTOR);
}

const unitLabel = (state: ComponentState, driverId: string, type: ComponentType) => `${COMPONENT_LABEL[type]} n.º ${unitsOf(state, driverId, type).length + 1} · ${DRIVERS[driverId]?.code ?? driverId}`;

/**
 * Monta una unidad nueva pagándola. Dentro del cupo se cobra siempre; fuera de cupo es un gasto voluntario y no se
 * monta si la deuda pasaría del límite.
 */
export function buyComponent(management: ManagementState, components: ComponentState, teamId: string, driverId: string, type: ComponentType,
  round: number): Outcome<{ components: ComponentState }> {
  const amount = componentCost(components, driverId, type);
  const movement = { round, kind: 'componente' as const, label: unitLabel(components, driverId, type), amount };
  if (withinQuota(components, driverId, type)) {
    return { ok: true, management: { ...management, finance: charge(management.finance, teamId, movement) }, components: fitNew(components, driverId, type), reason: null };
  }
  const paid = spend(management.finance, teamId, { ...movement, label: `${movement.label} (fuera de cupo)` });
  if (!paid.ok) return { ok: false, management, components, reason: paid.reason };
  return { ok: true, management: { ...management, finance: paid.state }, components: fitNew(components, driverId, type), reason: null };
}

/** Deshace la unidad montada si aún no ha salido a pista y devuelve lo que costó. */
export function refundComponent(management: ManagementState, components: ComponentState, teamId: string, driverId: string, type: ComponentType,
  round: number): { ok: boolean; management: ManagementState; components: ComponentState } {
  const undone = undoFit(components, driverId, type);
  if (undone === components) return { ok: false, management, components };
  const amount = componentCost(undone, driverId, type);
  const finance = credit(management.finance, teamId, { round, kind: 'componente', label: `Devolución: ${unitLabel(undone, driverId, type)} sin estrenar`, amount });
  return { ok: true, management: { ...management, finance }, components: undone };
}

/** Factura de daños de un coche: va a su equipo al liquidar la ronda. */
export interface DamageItem { teamId: string; driverCode: string; amount: number; label: string }

const SURFACE_NAME: Record<RunoffSurface, string> = { wall: 'muro', tecpro: 'barrera', gravel: 'grava', grass: 'hierba', asphalt: 'salida al asfalto' };

/**
 * Daños de la carrera a partir de los incidentes que registró el motor: cada accidente o salida de pista cuesta según
 * la superficie del punto donde ocurrió; un accidente grave tiene su importe; una avería mecánica no genera factura.
 */
export function raceDamages(incidents: Pick<TrackIncident, 'carId' | 'type' | 'surface'>[], cars: { id: number; driver: { code: string; teamId: string } }[]): DamageItem[] {
  const bill: DamageItem[] = [];
  for (const incident of incidents) {
    const car = cars.find(candidate => candidate.id === incident.carId);
    if (!car || incident.type === 'dnf') continue;
    const major = incident.type === 'major_crash';
    const surface = incident.surface ?? 'gravel';
    bill.push({
      teamId: car.driver.teamId, driverCode: car.driver.code, amount: major ? COSTS.MAJOR_CRASH : COSTS.DAMAGE[surface],
      label: `Daños · ${car.driver.code} (${major ? 'accidente grave' : SURFACE_NAME[surface]})`,
    });
  }
  return bill;
}

/**
 * Desarrollo de los rivales pagando: montan lo que está listo (no cuesta) y empiezan proyectos mientras tengan hueco y
 * dinero en el saldo. No piden prestado: sin dinero dejan de desarrollar. Con la misma semilla deciden lo mismo.
 */
export function aiDevelopPaying(management: ManagementState, program: DevelopmentProgram, teamIds: string[], raceIndex: number, positions: Record<string, number>,
  seed: number, firstDriverOf: (teamId: string) => string, round: number): { management: ManagementState; program: DevelopmentProgram } {
  let state = management, next = program;
  for (const teamId of teamIds) {
    for (const project of activeProjects(next, teamId)) {
      if (raceIndex >= project.readyRace) next = installFirst(next, project.id, firstDriverOf(teamId), raceIndex).program;
    }
    const rng = mulberry32(streamSeed(seed, `desarrollo-${teamId}-${raceIndex}`));
    while (activeProjects(next, teamId).length < MAX_ACTIVE) {
      const running = activeProjects(next, teamId);
      const options = Object.keys(PROJECTS).filter(key => !running.some(project => project.key === key) && projectCost(key) <= balanceOf(state.finance, teamId));
      if (!options.length) break;
      const bought = buyProject(state, next, teamId, options[Math.floor(rng() * options.length)], raceIndex, positions[teamId] ?? 7, round);
      if (!bought.ok) break;
      state = bought.management; next = bought.program;
    }
  }
  return { management: state, program: next };
}

/**
 * Componentes de los rivales pagando: sustituyen la unidad que ha agotado su vida nominal. Dentro del cupo, siempre;
 * fuera de cupo, solo si su saldo lo cubre.
 */
export function aiReplaceComponents(management: ManagementState, components: ComponentState, drivers: { id: string; teamId: string }[],
  round: number): { management: ManagementState; components: ComponentState } {
  let state = management, next = components;
  for (const driver of drivers) for (const type of COMPONENT_TYPES) {
    const unit = fittedUnit(next, driver.id, type);
    if (!unit || unit.races < NOMINAL_RACES[type]) continue;
    if (!withinQuota(next, driver.id, type) && componentCost(next, driver.id, type) > balanceOf(state.finance, driver.teamId)) continue;
    const bought = buyComponent(state, next, driver.teamId, driver.id, type, round);
    if (bought.ok) { state = bought.management; next = bought.components; }
  }
  return { management: state, components: next };
}
