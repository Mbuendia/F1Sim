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
import { COSTS } from './Costs';

/**
 * Pestañas del centro de gestión, en su orden. [UX9] Cuatro zonas en lugar de unos 14 paneles al mismo nivel: Coche
 * (desarrollo, componentes y reglaje), Equipo (pilotos, personal, mecánicos y reserva), Sede y dinero (instalaciones,
 * finanzas, patrocinio y junta) y Fin de semana (calendario, libres, espionaje y correr), la última.
 */
export const HUB_SECTIONS = [
  ['inicio', 'Inicio'], ['coche', 'Coche'], ['equipo', 'Equipo'], ['sede', 'Sede y dinero'], ['finde', 'Fin de semana'],
] as const;
export type HubSection = typeof HUB_SECTIONS[number][0];

/** [UX9] Lo que se decide en cada pestaña; se dice arriba de cada una. */
export const SECTION_PURPOSE: Record<HubSection, string> = {
  inicio: 'Lo más urgente de tu equipo y la próxima carrera.',
  coche: 'Qué mejoras se desarrollan, en qué coche se montan, qué piezas se cambian y el reglaje.',
  equipo: 'Quién conduce, quién trabaja en la fábrica y cómo rinden los mecánicos.',
  sede: 'En qué se invierte el dinero: instalaciones, patrocinadores y lo que pide la junta.',
  finde: 'Cómo se prepara la próxima carrera: libres, espionaje, formato y salida a pista.',
};

/** [UX10] Qué enseñar en imagen de una decisión: una pieza del coche, una instalación (o la sede) o una persona. */
export interface DecisionVisual { kind: 'pieza' | 'instalacion' | 'persona'; id: string }

/**
 * Algo que espera una decisión: qué es, por qué y en qué pestaña se resuelve. [UX9] Además, su efecto (lo que cambia),
 * su coste en euros si lo tiene, qué enseñar en imagen y su urgencia (1 = deuda y junta, 2 = lo que caduca o se rompe,
 * 3 = lo que mejora, 4 = lo que puede esperar).
 */
export interface PendingItem { id: string; title: string; detail: string; section: HubSection; effect: string; cost?: number; visual?: DecisionVisual; priority: number }

/** [UX9] Las `count` decisiones más urgentes, de más a menos (a igual urgencia, en el orden en que llegaron). */
export function nextDecisions(items: PendingItem[], count = 3): PendingItem[] {
  return items.map((item, i) => ({ item, i })).sort((a, b) => a.item.priority - b.item.priority || a.i - b.i).slice(0, count).map(x => x.item);
}

/** Miles de euros (como guarda la gestión) a euros. */
const euros = (thousands: number) => thousands * 1000;
/** Miles de euros a «1,2 M». */
const millions = (thousands: number) => `${(thousands / 1000).toFixed(1).replace('.', ',')} M`;

/** Fatiga del equipo de boxes a partir de la cual se avisa. */
export const FATIGUE_WARNING = 70;

/** Pendientes del equipo del jugador, en el orden en que se comprueban (`nextDecisions` los ordena por urgencia). Lista vacía si no hay nada que decidir. */
export function pendingDecisions(input: { teamId: string; management: ManagementState; program: DevelopmentProgram; components: ComponentState; raceIndex: number; round?: number }): PendingItem[] {
  const { teamId, management, program, components, raceIndex } = input;
  const items: PendingItem[] = [];
  if (atDebtLimit(management.finance, teamId)) {
    items.push({ id: 'deuda-limite', title: 'El equipo está en el límite de deuda', detail: 'No se pueden empezar gastos nuevos hasta bajar la deuda', section: 'sede', effect: 'Sin gastos nuevos: ni proyectos, ni obras, ni piezas fuera de cupo', visual: { kind: 'instalacion', id: 'sede' }, priority: 1 });
  }
  if (management.board.confidence < BOARD.WARNING) {
    items.push({ id: 'junta-baja', title: 'La junta está perdiendo la confianza', detail: `Confianza al ${Math.round(management.board.confidence)}: a cero, destitución al acabar la temporada`, section: 'sede', effect: `Pide acabar ${management.board.objective}.º en constructores; si la confianza llega a cero, te destituyen`, visual: { kind: 'instalacion', id: 'sede' }, priority: 1 });
  }
  const running = activeProjects(program, teamId);
  for (const project of running) {
    if (statusAt(project, raceIndex) !== 'listo') continue;
    items.push({ id: `mejora-${project.id}`, title: 'Mejora lista para montar', detail: `${PROJECTS[project.key]?.label ?? project.key}: elige en qué coche va primero`, section: 'coche', effect: PROJECTS[project.key]?.description ?? 'Mejora el coche', visual: { kind: 'pieza', id: project.key }, priority: 3 });
  }
  // [T4.7] Desde la mitad de la temporada, cada piloto del equipo que acaba contrato y no ha renovado.
  const pair = pairOf(management.contracts, teamId);
  if (input.round !== undefined && negotiationOpen(input.round) && seatsTaken(management.contracts, management.finance.season, teamId) < 2) {
    for (const driverId of pair) {
      if (management.contracts.contracts[driverId].until > management.finance.season || management.contracts.agreed[driverId]) continue;
      items.push({ id: `contrato-${driverId}`, title: 'Contrato que vence', detail: `${DRIVERS[driverId]?.lastName ?? driverId} acaba contrato esta temporada: renueva o ficha a otro piloto`, section: 'equipo', effect: 'Si no renuevas ni fichas a otro, te quedas sin ese asiento la temporada que viene', visual: { kind: 'persona', id: driverId }, priority: 2 });
    }
  }
  for (const driverId of pair) {
    for (const type of COMPONENT_TYPES) {
      const unit = fittedUnit(components, driverId, type);
      if (!unit || wearFactor(unit) <= 1) continue;
      items.push({ id: `componente-${driverId}-${type}`, title: 'Componente con riesgo de avería', detail: `${COMPONENT_LABEL[type]} de ${DRIVERS[driverId]?.code ?? driverId}: ha pasado su vida nominal`, section: 'coche', effect: `Avería un ${Math.round((wearFactor(unit) - 1) * 100)} % más probable; montar otra puede costar sanción`, visual: { kind: 'pieza', id: type }, priority: 2 });
    }
  }
  if (running.length < maxProjects(management.facilities, teamId)) {
    items.push({ id: 'desarrollo-libre', title: 'Hueco de desarrollo libre', detail: 'Puedes empezar otro proyecto del catálogo', section: 'coche', effect: 'Otra mejora del coche en marcha', cost: euros(Math.min(...Object.values(COSTS.PROJECT))), visual: { kind: 'instalacion', id: 'tunel' }, priority: 4 });
  }
  const sponsors = management.sponsors.teams[teamId];
  if (sponsors && sponsors.deals.length < SPONSOR_SLOTS && sponsors.offers.length > 0) {
    items.push({ id: 'patrocinio', title: 'Hueco de patrocinio libre', detail: `${sponsors.offers.length} ofertas esperan respuesta`, section: 'sede', effect: `Hasta +${millions(Math.max(...sponsors.offers.map(o => o.perRound)))} por carrera`, visual: { kind: 'instalacion', id: 'sede' }, priority: 3 });
  }
  const crew = management.pitCrews.teams[teamId];
  if (crew && crew.fatigue >= FATIGUE_WARNING) {
    items.push({ id: 'boxes-fatiga', title: 'Equipo de boxes fatigado', detail: `Fatiga al ${Math.round(crew.fatigue)} %: más paradas lentas hasta que descanse`, section: 'equipo', effect: 'Más paradas lentas o con fallos hasta que descanse', visual: { kind: 'persona', id: 'mecanicos' }, priority: 2 });
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
