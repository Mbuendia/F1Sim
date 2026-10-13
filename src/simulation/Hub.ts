// [T4.3] Centro de gestión: lo que está pendiente de una decisión del director y las sesiones del fin de semana.
// La lista de pendientes avisa y nunca bloquea la entrada a pista (decisión del usuario).
import { DRIVERS } from '../data/drivers';
import { negotiationOpen, pairOf, seatsTaken } from './Contracts';
import { TEAMS } from '../data/teams';
import { COMPONENT_LABEL, COMPONENT_TYPES, fittedUnit, wearFactor } from './ComponentPool';
import type { ComponentState } from './ComponentPool';
import { PROJECTS, activeProjects, statusAt } from './Development';
import type { DevelopmentProgram } from './Development';
import { maxProjects } from './Facilities';
import { atDebtLimit } from './Finance';
import { BOARD } from './Board';
import type { ManagementState } from './Management';
import { SPONSOR_SLOTS } from './Sponsors';

/** Pestañas del centro de gestión, en su orden. «Correr» es la última. */
export const HUB_SECTIONS = [
  ['inicio', 'Inicio'], ['equipo', 'Equipo'], ['fabrica', 'Fábrica'], ['finanzas', 'Finanzas'], ['temporada', 'Temporada'], ['correr', 'Correr'],
] as const;
export type HubSection = typeof HUB_SECTIONS[number][0];

/** Algo que espera una decisión: qué es, por qué y en qué pestaña se resuelve. */
export interface PendingItem { id: string; title: string; detail: string; section: HubSection }

/** Fatiga del equipo de boxes a partir de la cual se avisa. */
export const FATIGUE_WARNING = 70;

/** Pendientes del equipo del jugador, del más urgente al menos. Lista vacía si no hay nada que decidir. */
export function pendingDecisions(input: { teamId: string; management: ManagementState; program: DevelopmentProgram; components: ComponentState; raceIndex: number; round?: number }): PendingItem[] {
  const { teamId, management, program, components, raceIndex } = input;
  const items: PendingItem[] = [];
  if (atDebtLimit(management.finance, teamId)) {
    items.push({ id: 'deuda-limite', title: 'El equipo está en el límite de deuda', detail: 'No se pueden empezar gastos nuevos hasta bajar la deuda', section: 'finanzas' });
  }
  if (management.board.confidence < BOARD.WARNING) {
    items.push({ id: 'junta-baja', title: 'La junta está perdiendo la confianza', detail: `Confianza al ${Math.round(management.board.confidence)}: a cero, destitución al acabar la temporada`, section: 'finanzas' });
  }
  const running = activeProjects(program, teamId);
  for (const project of running) {
    if (statusAt(project, raceIndex) !== 'listo') continue;
    items.push({ id: `mejora-${project.id}`, title: 'Mejora lista para montar', detail: `${PROJECTS[project.key]?.label ?? project.key}: elige en qué coche va primero`, section: 'fabrica' });
  }
  // [T4.7] Desde la mitad de la temporada, cada piloto del equipo que acaba contrato y no ha renovado.
  const pair = pairOf(management.contracts, teamId);
  if (input.round !== undefined && negotiationOpen(input.round) && seatsTaken(management.contracts, management.finance.season, teamId) < 2) {
    for (const driverId of pair) {
      if (management.contracts.contracts[driverId].until > management.finance.season || management.contracts.agreed[driverId]) continue;
      items.push({ id: `contrato-${driverId}`, title: 'Contrato que vence', detail: `${DRIVERS[driverId]?.lastName ?? driverId} acaba contrato esta temporada: renueva o ficha a otro piloto`, section: 'equipo' });
    }
  }
  for (const driverId of pair) {
    for (const type of COMPONENT_TYPES) {
      const unit = fittedUnit(components, driverId, type);
      if (!unit || wearFactor(unit) <= 1) continue;
      items.push({ id: `componente-${driverId}-${type}`, title: 'Componente con riesgo de avería', detail: `${COMPONENT_LABEL[type]} de ${DRIVERS[driverId]?.code ?? driverId}: ha pasado su vida nominal`, section: 'fabrica' });
    }
  }
  if (running.length < maxProjects(management.facilities, teamId)) {
    items.push({ id: 'desarrollo-libre', title: 'Hueco de desarrollo libre', detail: 'Puedes empezar otro proyecto del catálogo', section: 'fabrica' });
  }
  const sponsors = management.sponsors.teams[teamId];
  if (sponsors && sponsors.deals.length < SPONSOR_SLOTS && sponsors.offers.length > 0) {
    items.push({ id: 'patrocinio', title: 'Hueco de patrocinio libre', detail: `${sponsors.offers.length} ofertas esperan respuesta`, section: 'finanzas' });
  }
  const crew = management.pitCrews.teams[teamId];
  if (crew && crew.fatigue >= FATIGUE_WARNING) {
    items.push({ id: 'boxes-fatiga', title: 'Equipo de boxes fatigado', detail: `Fatiga al ${Math.round(crew.fatigue)} %: más paradas lentas hasta que descanse`, section: 'equipo' });
  }
  return items;
}

/** Sesión del fin de semana: hecha, la que toca o por venir. */
export interface WeekendSession { name: string; done: boolean; current: boolean }

/**
 * Sesiones del fin de semana según el formato elegido. En una ronda sprint con el sprint ya corrido (`sprintDone`) se
 * enseñan las cuatro, con las dos del sprint hechas.
 */
export function weekendSessions(format: 'directo' | 'clasificacion' | 'sprint', sprintDone: boolean, practiceDone?: boolean): WeekendSession[] {
  const names = format === 'sprint' || sprintDone ? ['Clasificación sprint', 'Sprint', 'Clasificación', 'Carrera']
    : format === 'clasificacion' ? ['Clasificación', 'Carrera'] : ['Carrera'];
  const doneCount = sprintDone ? 2 : 0;
  const sessions = names.map((name, i) => ({ name, done: i < doneCount, current: i === doneCount }));
  // [T4.13] Los libres son el primer paso del fin de semana; son opcionales, así que no quitan el «ahora» a la sesión siguiente.
  return practiceDone === undefined ? sessions : [{ name: 'Entrenamientos libres', done: practiceDone, current: false }, ...sessions];
}
