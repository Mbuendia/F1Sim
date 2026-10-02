export type EngineMode = 'low' | 'standard' | 'push' | 'overtake';
export type AggressionLevel = 'conservative' | 'balanced' | 'aggressive' | 'maximum';
export type TireCompound = 'soft' | 'medium' | 'hard' | 'intermediate' | 'wet';

// ── Q9: ÓRDENES DE BOXES VINCULANTES ──
export type BoxOrderStatus = 'pending' | 'accepted' | 'committed' | 'consumed' | 'cancelled' | 'rejected';
export type BoxOrderIssuer = 'player' | 'ai';

export interface BoxOrder {
  id: string;
  carId: number;
  issuer: BoxOrderIssuer;
  compound: TireCompound;
  status: BoxOrderStatus;
  rejectionReason?: string;
  createdAt: number;         // raceTimeSec when the order was created
  consumedAt?: number;       // raceTimeSec when the order was consumed (tire change)
  commitmentProgress: number;
  entryProgress: number;
  message: string;
}

// ── SISTEMA DE BANDERAS Y SAFETY CAR ──
export type RaceFlagState = 'green' | 'yellow' | 'double-yellow' | 'vsc' | 'sc' | 'red';

export interface SafetyCarState {
  isDeployed: boolean;
  mode: 'idle' | 'deploying' | 'leading' | 'returning' | 'in';
  progress: number;
  trackT: number;
  currentSpeedKmh: number;
  lapCount: number;
  targetLaps: number;
  triggerReason: string;
  deployedAtRaceTime: number;
  isInPitLane?: boolean;       // Q14: circulando por el pit lane (salida o retirada)
  /** [R10] Fase del procedimiento (S55), registro de fases y lista de doblados autorizados a desdoblarse. */
  phase?: SafetyCarPhase;
  phaseLog?: { phase: SafetyCarPhase; time: number; message: string }[];
  unlapEligible?: number[] | null;
}

export type SafetyCarPhase = 'despliegue' | 'recogida' | 'fila' | 'desdoblamiento' | 'retirada' | 'relanzamiento' | 'verde';

export interface TrackIncident {
  id: number;
  carId: number;
  driverCode: string;
  trackT: number;
  sector: 1 | 2 | 3;
  type: 'dnf' | 'crash' | 'major_crash' | 'spin';
  isCleared: boolean;
  clearTimer: number;
  reason: string;
  /** [R09] Sector de comisarios (independiente de los sectores cronometrados), causa y responsabilidad. */
  marshalSector?: number;
  cause?: 'mecanica' | 'accidente' | 'trompo';
  responsibility?: 'ninguna' | 'propio' | 'sin-determinar';
}

export interface DnfNotification {
  id: string;
  driverName: string;
  driverCode: string;
  driverNumber: number;
  driverCountryFlag: string;
  teamName: string;
  teamColor: string;
  lap: number;
  sector: 1 | 2 | 3;
  reason: string;
  timestamp: number;
}

export interface Driver {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  number: number;
  country: string;
  countryFlag: string;
  teamId: string;
  palmaresScore: number;
  worldChampionships: number;
  careerWins: number;
  careerPodiums: number;
  talentRating: number;
  luckRating: number;
  tireManagement: number;
  raceCraft: number;
  consistency: number;
  /** [R45] Puntos ganados en los atributos con efecto propio (cero sin mejoras). */
  development?: { overtake: number; defence: number; wet: number; fitness: number };
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  accentColor: string;
  textColor: string;
  carPerformance: number;
  aerodynamics: number;
  enginePower: number;
  reliability: number;
  pitStopAverageTime: number;
  engineManufacturer: string;
  engineModel: string;
  horsepower: number;
  drivers: string[];
}

export interface TireState {
  health: number;
  compound: TireCompound;
  lapsOnTire: number;
  wearRate: number;
  tempCelsius: number;
  isBlistered: boolean;
  healthFL?: number;
  healthFR?: number;
  healthRL?: number;
  healthRR?: number;
  /** [R06] Temperatura de cada rueda (°C). */
  tempFL?: number;
  tempFR?: number;
  tempRL?: number;
  tempRR?: number;
}

export interface TelemetryData {
  speedKmh: number;
  throttle: number;
  brake: number;
  gear: number;
  rpm: number;
  drsActive: boolean;
  drsAvailable: boolean;
  drsEligible?: boolean; // [FIX B6] Alias unificado de elegibilidad de DRS
  engineMode: EngineMode;
  aggression: AggressionLevel;
  fuelKg: number;
  fuelPerLap: number;
  batterySoc: number;
  ersDeploying: boolean;
  tireWear: number; // Porcentaje de desgaste acumulado (0% = nueva, 100% = destruida)
  tireHealth?: number; // [FIX B7] Salud restante (100% = nueva, 0% = destruida)
  tireHealthFL: number;
  tireHealthFR: number;
  tireHealthRL: number;
  tireHealthRR: number;
  currentPaceDelta: number;
}

export interface SectorTimes {
  s1: number | null;
  s2: number | null;
  s3: number | null;
  personalBestS1: number | null;
  personalBestS2: number | null;
  personalBestS3: number | null;
}

export interface DriverStatsSummary {
  pushLaps: number;
  savingLaps: number;
  drsZonesTraversed: number;
  projectedLapsRemainingOnTire: number;
  willMakeToEndWithoutPit: boolean;
  optimalPitLap: number;
  overtakesMade: number;
  brakeTempCelsius: number;
  engineTempCelsius: number;
}

export interface CarTelemetryLog {
  lap: number;
  lapTime: number;
  sector1: number;
  sector2: number;
  sector3: number;
  compound: TireCompound;
  tireHealth: number;
}

export interface StintLog {
  stintNumber: number;
  compound: TireCompound;
  startLap: number;
  endLap: number;
  expectedLaps: number;
}

export interface PitStopState {
  scheduledLap: number;
  isPitting: boolean;
  pitLaneProgress: number;
  stopDuration: number;
  currentStopTimer: number;
  totalPitStops: number;
  lastStopDuration: number | null;
  targetCompound: TireCompound;
  stints: StintLog[];
  activeBoxOrder: BoxOrder | null;   // Q9: Binding compound order
  /** [R07] Motivo del último rechazo de una orden de boxes (p. ej. sin juegos del compuesto). */
  lastOrderRejection?: string;
  /** [R13] Paso por boxes en curso: servicio, drive-through o stop-and-go; espera de sanción antes del servicio. */
  passMode?: 'service' | 'drive-through' | 'stop-go';
  penaltyHoldSec?: number;
  penaltyPlannedSec?: number;
  servingDecisionIds?: string[];
  mustServePenalty?: boolean;
  /** [R08] Infracciones registradas en boxes (las sanciones las aplica R13). */
  infractions?: PitInfraction[];
  /** [R08] Registro de cada parada con tiempos separados. */
  stopLog?: PitStopLog[];
  /** [R08] Paradas programadas pendientes (vuelta y compuesto). */
  plannedStops?: { lap: number; compound: TireCompound }[];
  /** [R08] Contadores de la parada en curso. */
  laneTimer?: number;
  releaseHoldSec?: number;
  limitStartChecked?: boolean;
  limitEndFlagged?: boolean;
  pendingLog?: Omit<PitStopLog, 'totalSec' | 'transitSec' | 'queueSec' | 'releaseHoldSec'> | null;
  playerControlled?: boolean;
  entryProgress?: number;
  // Q11: Double stack — waiting state
  waitingForBox: boolean;            // true when queued behind teammate at the shared box
  boxWaitTimer: number;              // accumulated wait time (sim seconds) behind teammate
  // Q17: beneficio D20 de servicio pendiente (se consume en la próxima parada real dentro de su validez)
  crewBenefit?: CrewServiceBenefit | null;
}

/** [R08] Infracción en el pit lane. */
export interface PitInfraction {
  type: 'exceso-velocidad';
  line: 'inicio' | 'fin';
  overKmh: number;
  lap: number;
}

/** [R08] Parada registrada: la pérdida sale de tránsito, servicio, cola y retención, no de una cifra fija. */
export interface PitStopLog {
  lap: number;
  /** [R13] Segundos de sanción cumplidos en el cajón antes del servicio. */
  penaltySec?: number;
  setId: string | null;
  compound: TireCompound;
  totalSec: number;
  transitSec: number;
  serviceSec: number;
  queueSec: number;
  releaseHoldSec: number;
}

// [Q17] Beneficio de preparación de boxes: solo acota la duración del servicio; no toca tránsito ni recursos.
export interface CrewServiceBenefit {
  eventId: string;
  label: string;
  minSec: number;
  maxSec: number;
  expiresLap: number;
  inUse?: boolean;             // aplicado al servicio de la parada en curso
}

// [Q17] Catálogo de beneficios del D20 por tramo de tirada.
export type D20BenefitKind = 'crew-ready' | 'crew-alert' | 'engineer-report' | 'restart-report' | 'none';
/** [R37] Informe de relanzamiento bajo bandera roja (solo información). */
export interface RestartReport {
  queuePos: number;
  own: { compound: TireCompound; health: number };
  ahead: { code: string; compound: TireCompound; health: number } | null;
  behind: { code: string; compound: TireCompound; health: number } | null;
  changeAdvised: boolean;
  recommended: TireCompound | null;
}
/** [R26] Qué clase de ayuda es: información, preparación del box, reducción acotada del riesgo en el servicio o ninguna. */
export type D20BenefitCategory = 'informacion' | 'preparacion' | 'riesgo' | 'ninguna';
export interface D20Benefit {
  kind: D20BenefitKind;
  category?: D20BenefitCategory;
  label: string;
  serviceMinSec?: number;
  serviceMaxSec?: number;
  validLaps?: number;
  rejoin?: RejoinEstimate;
  restart?: RestartReport;
}

export type StartLightState = 
  | 'idle'
  | 'formation-lap'
  | 'grid-parking'
  | 'grid-ready'
  | 'lights-1'
  | 'lights-2'
  | 'lights-3'
  | 'lights-4'
  | 'lights-5'
  | 'lights-out'
  | 'racing'
  | 'finished';

export interface RelativeCarInfo {
  id: number;
  driverName: string;
  driverCode: string;
  teamName: string;
  teamColor: string;
  gapSec: number;
  position: number;
}

// [Q13] Estimación de reincorporación tras parar ahora (predictor del motor), o motivo por el que no hay estimación.
export type RejoinEstimate =
  | {
      available: true;
      carId: number;
      projectedPos: number;
      bestPos: number;
      worstPos: number;
      timeLossSec: number;
      uncertaintySec: number;
      rejoinProgress: number;
      rejoinTrackT: number;
      source: string;
    }
  | { available: false; carId: number; reason: string };

export interface CarState {
  id: number;
  driver: Driver;
  team: Team;
  gridPosition: number;
  currentPosition: number;
  previousPosition: number;
  progress: number;
  trackT: number;
  // Posición/orientación compartida por dibujo, cámara, minimapa y selección.
  worldX: number;
  worldY: number;
  worldAngle: number;
  isInPitLane: boolean;
  speed: number;
  currentSpeedKmh: number;

  lateralOffset: number;
  targetLateralOffset: number;
  isOvertaking: boolean;
  isBlueFlagged: boolean;
  blueFlagLevel?: number;        // Q15: nivel de cesión 0..1 (gradual)
  blueFlagSide?: -1 | 1;         // Q15: lado hacia el que se aparta mientras cede

  hasPuncture?: boolean;
  dnfReason?: string;
  isRetiredVisible: boolean;
  retireTimer: number;
  smokeOpacity: number;

  raceDayLuckFactor: number;

  // [Q12] Pace mode ordered by player
  paceMode?: 'push' | 'balanced' | 'save';
  energy?: import('../simulation/EnergyModel').EnergyState;

  tires: TireState;
  fuelKg: number;
  engineMode: EngineMode;
  aggression: AggressionLevel;
  drsActive: boolean;
  drsEligible: boolean;

  // ── MODELO TERMODINÁMICO CONTINUO ──
  brakeTempCelsius: number;    // 250°C (frío) → 1050°C (frenada extrema)
  engineTempCelsius: number;   // 85°C (frío) → 130°C (sobrecalentamiento)

  currentLap: number;
  lapStartTime: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  gapToLeaderSec: number;
  gapToCarAheadSec: number;
  carAheadId: number | null;
  /** [R02] Vueltas completas por detrás del líder (el líder ya lo ha adelantado en pista). */
  lapsBehindLeader?: number;
  /** [R02] Coche inmediatamente delante en pista (sin pit lane), sea cual sea su vuelta. */
  physicalAheadId?: number | null;
  /** [R05] Rebufo 0..1 del coche físicamente delante (solo en recta). */
  slipstreamLevel?: number;
  /** [R05] Aire sucio 0..1 en curva. */
  dirtyAirLevel?: number;
  /** [R42] Ritmo propio del coche en su último paso (lo comparan los demás para decidir un adelantamiento). */
  paceIndex?: number;
  /** [R14] Masa actual (seca + combustible, kg), combustible quemado acumulado (kg) y tiempo en lift-and-coast (s). */
  massKg?: number;
  fuelBurnedKg?: number;
  coastedSec?: number;
  /** [R16] Potencia de fricción de los frenos en el último paso (MW): la frenada que no recupera el MGU-K. */
  brakeFrictionMW?: number;
  /** [R10] Doblado autorizado que está adelantando a la fila y al SC para recuperar su vuelta. */
  scUnlapping?: boolean;
  /** [R11] Referencia del VSC (progreso virtual) y delta en segundos (≥ 0 = detrás de la referencia). */
  vscRef?: number;
  vscDeltaSec?: number;
  /** [R11] Acaba de salir de boxes bajo VSC: su referencia arranca con el margen de recuperación (delta continuo). */
  vscPitExit?: boolean;
  /** [R12] Bandera roja: el coche va a la fila del carril rápido y espera (sin parada) / sale tras la reanudación. */
  redFlagHold?: boolean;
  /** [R13] Hora a la que cruzó la meta al terminar la carrera. */
  finishTimeSec?: number;
  /** [R21] Hora de paso por meta al empezar cada vuelta (índice: `currentLap` tras el paso). */
  lapCrossTimes?: Record<number, number>;
  /** [R25] Estado y registro del estratega de la IA; el ritmo lo fijó el jugador. */
  strategy?: import('../simulation/Strategist').StrategyState;
  paceByPlayer?: boolean;
  redFlagRelease?: boolean;
  /** [R11] Infracciones de pista registradas (las sanciones las aplica R13). */
  infractions?: { type: 'delta-vsc'; value: number; lap: number; time: number }[];
  /** [R17] Perfil técnico resuelto para este evento (chasis, PU y paquete aerodinámico). */
  technical?: import('../data/teamProfiles').CarTechnical;
  /** [R07] Juegos de neumáticos del coche y clasificación reglamentaria (DSQ por incumplir S30.5m). */
  tireInventory?: import('../simulation/TireInventory').TireInventory;
  classification?: 'DSQ';
  classificationReason?: string;

  aheadInfo: RelativeCarInfo | null;
  behindInfo: RelativeCarInfo | null;

  currentSector: 1 | 2 | 3;
  sectors: SectorTimes;
  sectorStartTime: number;

  pitStop: PitStopState;
  stats: DriverStatsSummary;
  lapHistory: CarTelemetryLog[];
  telemetry: TelemetryData;
  status: 'running' | 'pit' | 'out' | 'finished';
}

export interface RaceResultHistory {
  id: string;
  dateFormatted: string;
  trackName: string;
  winnerName: string;
  winnerTeam: string;
  winnerTeamColor: string;
  p2Name: string;
  p3Name: string;
  userDriverName: string;
  userDriverPos: number;
  winnerStrategy: string;
  totalRaceTime: string;
}

// ── TELEMETRÍA AMBIENTAL & CONDICIONES DE PISTA ──
export type WeatherCondition = 'dry' | 'drizzle' | 'rain' | 'heavy_rain' | 'storm';

export interface TrackWeatherState {
  condition: WeatherCondition;
  conditionLabel: string;
  waterDepthMm: number;        // 0.0 mm (Seco) a 6.0 mm (Encharcado)
  waterPercentage: number;     // 0% a 100%
  trackTempCelsius: number;    // Temperatura de asfalto (ej. 32°C - 52°C)
  airTempCelsius: number;      // Temperatura ambiente (ej. 20°C - 30°C)
  humidityPercentage: number;  // 35% a 95%
  gripMultiplier: number;      // 1.0 (óptimo) a 0.65 (pista mojada)
  windSpeedKmh: number;        // 5 a 45 km/h
  windDirection: string;       // N, NE, E, SE, S, SW, W, NW
  forecast5Min: string;
  forecast15Min: string;
  rainProbabilityPct: number;
}

// ── EVENTO TÁCTICO DADO D20 (SAFETY CAR & BANDERA ROJA) ──
export interface D20LuckEvent {
  id: string;
  triggerType: 'sc' | 'vsc' | 'red';
  rollValue: number;           // 1 al 20
  luckyCarId: number;
  luckyDriverName: string;
  luckyDriverNumber: number;
  luckyDriverFlag: string;
  luckyTeamName: string;
  luckyTeamColor: string;
  isPlayerCar: boolean;
  rewardTitle: string;
  rewardDescription: string;
  optimalCompound: TireCompound;
  benefit: D20Benefit;
  /** [R26] Identificación de la variante, causa de la tirada y alcance exacto del beneficio. */
  variant?: string;
  cause?: string;
  scope?: string;
  applied: boolean;
  timestamp: number;
}

