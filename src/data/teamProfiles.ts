// [R17] Perfiles técnicos versionados por equipo: chasis, unidad de potencia común por fabricante y paquete
// aerodinámico por circuito. Ningún coeficiente tiene fuente real: todos son calibración del juego, derivados de los
// ratings anteriores de `teams.ts` para conservar el orden general. Cada ventaja tiene su coste:
//  · más carga → más paso por curva rápida, más drag;  · más refrigeración → motor más frío, más drag;
//  · neumático que calienta antes → mejor out-lap, más desgaste.
import { TEAMS } from './teams';

export interface ProfileValue { value: number; origin: 'calibracion'; note: string }

export interface PowerUnit {
  supplier: string;
  /** Potencia del motor térmico (kW), igual para el equipo oficial y sus clientes (T ap. 3-4). */
  iceKw: number;
}

export interface TeamProfile {
  teamId: string;
  version: string;
  chassis: {
    downforce: ProfileValue;
    mechanicalGrip: ProfileValue;
    cooling: ProfileValue;
    tyreHeat: ProfileValue;
    tyreWear: ProfileValue;
  };
  pu: PowerUnit;
}

/** Perfil resuelto para un coche en un evento (lo que usa el motor). */
export interface CarTechnical {
  teamId: string;
  version: string;
  package: PackageId;
  /** Multiplicador de velocidad de paso en curva rápida (carga) y lenta (agarre mecánico). */
  fastCornerGrip: number;
  slowCornerGrip: number;
  /** Multiplicador del drag (CdA). */
  dragFactor: number;
  iceKw: number;
  cooling: number;
  tyreHeat: number;
  tyreWear: number;
}

export type PackageId = 'baja' | 'media' | 'alta';

/** Paquetes aerodinámicos: carga y drag se mueven juntos (calibración). */
export const PACKAGES: Record<PackageId, { downforce: number; drag: number }> = {
  baja: { downforce: 0.988, drag: 0.88 },
  media: { downforce: 1, drag: 1 },
  alta: { downforce: 1.012, drag: 1.10 },
};

const LOW_DOWNFORCE = new Set(['monza', 'spa', 'las-vegas', 'baku', 'jeddah']);
const HIGH_DOWNFORCE = new Set(['monaco', 'hungaroring', 'marina-bay', 'mexico-city']);

export function packageFor(circuitId: string): PackageId {
  return LOW_DOWNFORCE.has(circuitId) ? 'baja' : HIGH_DOWNFORCE.has(circuitId) ? 'alta' : 'media';
}

/** Coste en drag por cada unidad de carga o refrigeración por encima de la referencia. */
const DRAG_PER_DOWNFORCE = 0.6;
const DRAG_PER_COOLING = 0.05;
/** Referencias de los ratings anteriores (media de la parrilla). */
const AERO_REF = 0.992, PERF_REF = 0.992;

const PU_BY_SUPPLIER: Record<string, PowerUnit> = {};
for (const team of Object.values(TEAMS)) {
  // La PU sale del fabricante (potencia anterior del equipo oficial = la del fabricante en teams.ts).
  PU_BY_SUPPLIER[team.engineManufacturer] ??= { supplier: team.engineManufacturer, iceKw: team.horsepower * 0.7457 - 120 };
}

const value = (v: number, note: string): ProfileValue => ({ value: v, origin: 'calibracion', note });

export const TEAM_PROFILES: Record<string, TeamProfile> = Object.fromEntries(Object.values(TEAMS).map(team => [team.id, {
  teamId: team.id,
  version: '2025.1',
  chassis: {
    downforce: value(1 + (team.aerodynamics - AERO_REF), 'Derivado del rating aerodinámico anterior; sin fuente real.'),
    mechanicalGrip: value(1 + (team.carPerformance - PERF_REF), 'Derivado del rating de rendimiento anterior; sin fuente real.'),
    cooling: value(1, 'Referencia común; sin datos por equipo.'),
    tyreHeat: value(1, 'Referencia común; sin datos por equipo.'),
    tyreWear: value(1, 'Referencia común; sin datos por equipo.'),
  },
  pu: { ...PU_BY_SUPPLIER[team.engineManufacturer] },
}]));

/** [R17] Peso de la carga en la curva más lenta (calibración). */
export const CHASSIS_BLEND = { slowWeight: 0.25 };

/**
 * [R17] Agarre del chasis en un punto: mezcla de agarre mecánico y carga según la velocidad de la curva (la carga
 * pesa un 25 % en la horquilla más lenta y del todo en curva rápida).
 */
export function chassisGripAt(technical: Pick<CarTechnical, 'fastCornerGrip' | 'slowCornerGrip'>, speedLimitFactor: number): number {
  const w = CHASSIS_BLEND.slowWeight + (1 - CHASSIS_BLEND.slowWeight) * Math.min(1, Math.max(0, (speedLimitFactor - 0.2) / 0.6));
  return technical.slowCornerGrip * (1 - w) + technical.fastCornerGrip * w;
}

/** Perfil técnico de un equipo para un circuito (y paquete, por defecto el del circuito). */
export function resolveTechnical(teamId: string, circuitId: string, pkg: PackageId = packageFor(circuitId)): CarTechnical {
  const profile = TEAM_PROFILES[teamId] ?? TEAM_PROFILES.mclaren;
  const { downforce, mechanicalGrip, cooling, tyreHeat, tyreWear } = profile.chassis;
  const pack = PACKAGES[pkg];
  return {
    teamId: profile.teamId,
    version: profile.version,
    package: pkg,
    fastCornerGrip: downforce.value * pack.downforce,
    slowCornerGrip: mechanicalGrip.value,
    dragFactor: pack.drag * (1 + (downforce.value - 1) * DRAG_PER_DOWNFORCE) * (1 + (cooling.value - 1) * DRAG_PER_COOLING),
    iceKw: profile.pu.iceKw,
    cooling: cooling.value,
    tyreHeat: tyreHeat.value,
    tyreWear: tyreWear.value,
  };
}
