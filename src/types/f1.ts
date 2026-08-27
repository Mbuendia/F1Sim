export type EngineMode = 'low' | 'standard' | 'push' | 'overtake';
export type AggressionLevel = 'conservative' | 'balanced' | 'aggressive' | 'maximum';
export type TireCompound = 'soft' | 'medium' | 'hard';

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
  drivers: string[];
}

export interface TireState {
  health: number;
  compound: TireCompound;
  lapsOnTire: number;
  wearRate: number;
  tempCelsius: number;
  isBlistered: boolean;
}

export interface TelemetryData {
  speedKmh: number;
  throttle: number;
  brake: number;
  gear: number;
  rpm: number;
  drsActive: boolean;
  drsAvailable: boolean;
  engineMode: EngineMode;
  aggression: AggressionLevel;
  fuelKg: number;
  fuelPerLap: number;
  batterySoc: number;
  ersDeploying: boolean;
  tireWear: number;
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

export interface PitStopState {
  scheduledLap: number;
  isPitting: boolean;
  pitLaneProgress: number;
  stopDuration: number;
  currentStopTimer: number;
  totalPitStops: number;
  lastStopDuration: number | null;
  targetCompound: TireCompound;
}

export type StartLightState = 
  | 'idle'
  | 'formation-lap'
  | 'grid-parking'
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

export interface CarState {
  id: number;
  driver: Driver;
  team: Team;
  gridPosition: number;
  currentPosition: number;
  previousPosition: number;
  progress: number;
  trackT: number;
  isInPitLane: boolean;
  speed: number;
  currentSpeedKmh: number;
  
  lateralOffset: number;
  targetLateralOffset: number;
  isOvertaking: boolean;
  isBlueFlagged: boolean;

  raceDayLuckFactor: number;
  
  tires: TireState;
  fuelKg: number;
  engineMode: EngineMode;
  aggression: AggressionLevel;
  drsActive: boolean;
  drsEligible: boolean;
  
  currentLap: number;
  lapStartTime: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  gapToLeaderSec: number;
  gapToCarAheadSec: number;
  carAheadId: number | null;

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
