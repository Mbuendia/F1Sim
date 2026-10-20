export interface CornerInfo {
  number: number;
  name: string;
  t: number;
  gear: number;
  apexSpeedKmh: number;
  brakingG: number;
}

export interface DrsZoneSpec {
  id: number;
  name: string;
  startT: number;
  endT: number;
}

import type { TrackType } from './scenarioTypes';

export interface CircuitSpec {
  /** Solo puntos aportados explícitamente; no inferirlos del comienzo de zona. */
  drsDetections?: import('../simulation/DRSModel').DrsDetection[];
  id: string;
  name: string;
  officialGpName: string;
  location: string;
  country: string;
  flag?: string;
  countryFlag: string;
  svgFile: string;
  direction: 'clockwise' | 'anti-clockwise';
  /** Tipo de circuito: permanente, urbano o híbrido */
  trackType: TrackType;
  lapLengthMeters: number;
  totalLaps: number;
  turns: number;
  drsZones: number;
  drsZoneSpecs: DrsZoneSpec[];
  spectators: number;
  pitLaneTimeLossSec: number;
  rainProbabilityPercent: number;
  windSpeedKmh: number;
  windDirection: string;
  asphaltAbrasion: 'Baja' | 'Media' | 'Alta' | 'Muy Alta';
  tireStressLevel: 'Baja' | 'Media' | 'Alta' | 'Extrema';
  asphaltGripLevel: 'Bajo' | 'Medio' | 'Alto';
  elevationChangeMeters: number;
  safetyCarProbabilityPercent: number;
  officialWebsiteUrl: string;
  pitEntryT?: number;
  /** Línea táctica calibrada para el juego, no dato FIA. */
  pitCommitmentT?: number;
  pitExitT?: number;
  startOffsetT?: number;
  pitOffset?: number;
  /** [G6] El carril de boxes cruza la pista de verdad, por un túnel (Yas Marina): ahí no se le exige separación. */
  pitTunnel?: boolean;
  /**
   * [G2] Ancho típico de la pista en metros reales; la pista se pinta a este ancho. En 16 circuitos sale del ancho medido
   * sobre imagen de satélite (TUMFTM racetrack-database, LGPL-3.0): punto medio entre la mediana y el percentil 90, que
   * es lo que coincide con los anchos que publican los circuitos (Barcelona 12 m, Silverstone 15 m, Monza 10-12 m); en los demás (urbanos recientes y Lusail) es
   * un dato anotado sin fuente medida.
   */
  trackWidthMeters?: number;
  trackWidthCars?: number;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  racingCircuitsUrl: string;
  racingNews365Url: string;
  statsF1Url: string;
}

export const OFFICIAL_CIRCUITS: Record<string, CircuitSpec> = {
  barcelona: {
    id: 'barcelona',
    trackWidthMeters: 11.5,   // medido (TUMFTM racetrack-database)
    name: 'Circuit de Barcelona-Catalunya',
    trackType: 'permanent',
    pitEntryT: 0.9003,
    pitCommitmentT: 0.8753,
      pitExitT: 0.1276,
      startOffsetT: 0.054,
      officialGpName: 'Gran Premio de España',
    location: 'Montmeló, Barcelona',
    country: 'España',
    countryFlag: '🇪🇸',
    svgFile: 'catalunya-6.svg',
    direction: 'clockwise',
    lapLengthMeters: 4657,
    totalLaps: 66,
    turns: 16,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Spanish Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 40m after turn 9", startT: 0.6301, endT: 0.7207 },
      { id: 2, name: "A2 · 162m after turn 14", startT: 0.9675, endT: 0.1527 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.6026, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.9003, zoneIds: [2], source: 'calibrated' }
    ],
    spectators: 140000,
    pitLaneTimeLossSec: 22.4,
    rainProbabilityPercent: 12,
    windSpeedKmh: 14,
    windDirection: 'NO (Noroeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 41.5700,
    longitude: 2.2611,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=41.5700,2.2611',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/spain/circuit-de-barcelona-catalunya.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/spanish-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-barcelona.aspx'
    },
  monza: {
    id: 'monza',
    trackWidthMeters: 10,   // medido (TUMFTM racetrack-database)
    name: 'Autodromo Nazionale Monza',
      trackType: 'permanent',
      pitEntryT: 0.9556,
      pitExitT: 0.0836,
      startOffsetT: 0.6926,
      officialGpName: 'Gran Premio d\'Italia',
    location: 'Monza, Milán',
    country: 'Italia',
    countryFlag: '🇮🇹',
    svgFile: 'monza-7.svg',
    direction: 'clockwise',
    lapLengthMeters: 5793,
    totalLaps: 53,
    turns: 11,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Italian Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 170m after Turn 7", startT: 0.5259, endT: 0.6554 },
      { id: 2, name: "A2 · 12m after finish line", startT: 0.0021, endT: 0.1327 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.48, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.9067, zoneIds: [2], source: 'verified' }
    ],
    spectators: 155000,
    pitLaneTimeLossSec: 24.1,
    rainProbabilityPercent: 8,
    windSpeedKmh: 10,
    windDirection: 'NE (Nordeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 45.6190,
    longitude: 9.2811,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=45.6190,9.2811',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/italy/monza.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/italian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-monza.aspx'
    },
  silverstone: {
    id: 'silverstone',
    trackWidthMeters: 14.5,   // medido (TUMFTM racetrack-database)
    name: 'Silverstone Circuit',
    trackType: 'permanent',
    pitEntryT: 0.8917,
    pitExitT: 0.1154,
    pitOffset: 28,
    startOffsetT: 0.9401,
    officialGpName: 'British Grand Prix',
    location: 'Silverstone, Northamptonshire',
    country: 'Reino Unido',
    countryFlag: '🇬🇧',
    svgFile: 'silverstone-8.svg',
    direction: 'clockwise',
    lapLengthMeters: 5891,
    totalLaps: 52,
    turns: 18,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · British Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 30m after Turn 5", startT: 0.2155, endT: 0.3079 },
      { id: 2, name: "A2 · Turn 14", startT: 0.7083, endT: 0.8306 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.1425, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.6328, zoneIds: [2], source: 'verified' }
    ],
    spectators: 160000,
    pitLaneTimeLossSec: 20.5,
    rainProbabilityPercent: 45,
    windSpeedKmh: 24,
    windDirection: 'SO (Suroeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 52.0786,
    longitude: -1.0169,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=52.0786,-1.0169',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/united-kingdom/silverstone.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/british-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-silverstone.aspx'
    },
  spa: {
    id: 'spa',
    trackWidthMeters: 11,   // medido (TUMFTM racetrack-database)
    name: 'Circuit de Spa-Francorchamps',
      trackType: 'permanent',
      pitEntryT: 0.9664,
      pitExitT: 0.0774,
      startOffsetT: 0.95,
      officialGpName: 'Belgian Grand Prix',
    location: 'Stavelot, Lieja',
    country: 'Bélgica',
    countryFlag: '🇧🇪',
    svgFile: 'spa-francorchamps-4.svg',
    direction: 'clockwise',
    lapLengthMeters: 7004,
    totalLaps: 44,
    turns: 19,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Belgian Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 305m after Turn 4", startT: 0.2256, endT: 0.3187 },
      { id: 2, name: "A2 · 30m after Turn 19", startT: 0.9765, endT: 0.0267 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.117, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.9389, zoneIds: [2], source: 'verified' }
    ],
    spectators: 130000,
    pitLaneTimeLossSec: 21.8,
    rainProbabilityPercent: 60,
    windSpeedKmh: 16,
    windDirection: 'O (Oeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 50.4372,
    longitude: 5.9714,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=50.4372,5.9714',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/belgium/spa-francorchamps.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/belgian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-spa-francorchamps.aspx'
    },
  monaco: {
    pitCommitmentT: 0.5567,
    id: 'monaco',
    trackWidthMeters: 9,
    trackWidthCars: 2,
    name: 'Circuit de Monaco',
      trackType: 'street',
      pitEntryT: 0.8902,
      pitExitT: 0.0058,
      startOffsetT: 0.2965,
      officialGpName: 'Grand Prix de Monaco',
    location: 'Montecarlo',
    country: 'Mónaco',
    countryFlag: '🇲🇨',
    svgFile: 'monaco-6.svg',
    direction: 'clockwise',
    lapLengthMeters: 3337,
    totalLaps: 78,
    turns: 19,
    drsZones: 1,
    // Q19: activación y detección oficiales (plano FIA 2025 · Monaco Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 18m after Turn 19", startT: 0.9102, endT: 0.0355 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.838, zoneIds: [1], source: 'verified' }
    ],
    spectators: 40000,
    pitLaneTimeLossSec: 22.0,
    rainProbabilityPercent: 15,
    windSpeedKmh: 8,
    windDirection: 'SE (Sudeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 43.7347,
    longitude: 7.4206,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=43.7347,7.4206',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/monaco/monte-carlo.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/monaco-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-monaco.aspx'
    },
  spielberg: {
    id: 'spielberg',
    trackWidthMeters: 11,   // medido (TUMFTM racetrack-database)
    name: 'Red Bulla Ring',
      trackType: 'permanent',
    pitEntryT: 0.8853,
      pitExitT: 0.1332,
      startOffsetT: 0.2674,
      officialGpName: 'Austrian Grand Prix',
    location: 'Spielberg, Estiria',
    country: 'Austria',
    countryFlag: '🇦🇹',
    svgFile: 'spielberg-2026.svg',
    direction: 'clockwise',
    lapLengthMeters: 4318,
    totalLaps: 71,
    turns: 10,
    drsZones: 3,
    // Q19: activación y detección oficiales (plano FIA 2025 · Austrian Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 102m after T1", startT: 0.1244, endT: 0.2913 },
      { id: 2, name: "A2 · 100m after T3", startT: 0.342, endT: 0.4819 },
      { id: 3, name: "A3 · 106m after T10", startT: 0.9447, endT: 0.0634 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.0634, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.3083, zoneIds: [2], source: 'verified' },
      { id: 'D3', t: 0.8907, zoneIds: [3], source: 'verified' }
    ],
    spectators: 105000,
    pitLaneTimeLossSec: 20.2,
    rainProbabilityPercent: 25,
    windSpeedKmh: 12,
    windDirection: 'N (Norte)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 47.2197,
    longitude: 14.7647,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=47.2197,14.7647',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/austria/red-bull-ring.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/austrian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-a1-ring.aspx'
    },
  interlagos: {
    id: 'interlagos',
    trackWidthMeters: 13,   // medido (TUMFTM racetrack-database)
    name: 'Autódromo José Carlos Pace',
      trackType: 'permanent',
    officialGpName: 'Grande Prêmio de São Paulo',
    location: 'São Paulo',
    country: 'Brasil',
    flag: '🇧🇷',
    countryFlag: '🇧🇷',
    svgFile: 'interlagos-2.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 4309,
    totalLaps: 71,
    turns: 15,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · São Paulo Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 30m after Turn 3", startT: 0.1563, endT: 0.3036 },
      { id: 2, name: "A2 · 160m before Turn 15", startT: 0.9032, endT: 0.0542 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.1064, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.7933, zoneIds: [2], source: 'verified' }
    ],
    spectators: 110000,
    pitLaneTimeLossSec: 23.5,
    rainProbabilityPercent: 55,
    windSpeedKmh: 15,
    windDirection: 'SE (Sudeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    pitEntryT: 0.903,
    pitExitT: 0.2338,
    startOffsetT: 0.1951,
    latitude: -23.7036,
    longitude: -46.6997,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-23.7036,-46.6997',
    racingCircuitsUrl: 'https://www.racingcircuits.info/south-america/brazil/interlagos.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/brazilian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-interlagos.aspx'
  },
  suzuka: {
    id: 'suzuka',
    trackWidthMeters: 11.5,   // medido (TUMFTM racetrack-database)
    name: 'Suzuka International Racing Course',
      trackType: 'permanent',
      pitEntryT: 0.9471,
      pitExitT: 0.1026,
      startOffsetT: 0.5846,
      officialGpName: 'Japanese Grand Prix',
    location: 'Suzuka, Mie',
    country: 'Japón',
    countryFlag: '🇯🇵',
    svgFile: 'suzuka-2.svg',
    direction: 'clockwise',
    lapLengthMeters: 5807,
    totalLaps: 53,
    turns: 18,
    drsZones: 1,
    // Q19: activación y detección oficiales (plano FIA 2025 · Japanese Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 100m before control line", startT: 0.9835, endT: 0.1207 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.8655, zoneIds: [1], source: 'verified' }
    ],
    spectators: 130000,
    pitLaneTimeLossSec: 22.8,
    rainProbabilityPercent: 40,
    windSpeedKmh: 18,
    windDirection: 'E (Este)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 34.8431,
    longitude: 136.5414,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=34.8431,136.5414',
    racingCircuitsUrl: 'https://www.racingcircuits.info/asia/japan/suzuka.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/japanese-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-suzuka.aspx'
    },
  zandvoort: {
    id: 'zandvoort',
    trackWidthMeters: 11.5,   // medido (TUMFTM racetrack-database)
    trackWidthCars: 2,
    name: 'Circuit Zandvoort',
      trackType: 'permanent',
      pitEntryT: 0.939,
      pitExitT: 0.1249,
      startOffsetT: 0.0854,
      officialGpName: 'Dutch Grand Prix',
    location: 'Zandvoort',
    country: 'Países Bajos',
    countryFlag: '🇳🇱',
    svgFile: 'zandvoort-5.svg',
    direction: 'clockwise',
    lapLengthMeters: 4259,
    totalLaps: 72,
    turns: 14,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Dutch Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 50m after turn 10", startT: 0.5995, endT: 0.7006 },
      { id: 2, name: "A2 · 40m after turn 13", startT: 0.8318, endT: 0.0566 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5778, zoneIds: [1], source: 'calibrated' },
      { id: 'D2', t: 0.755, zoneIds: [2], source: 'verified' }
    ],
    spectators: 115000,
    pitLaneTimeLossSec: 21.0,
    rainProbabilityPercent: 30,
    windSpeedKmh: 28,
    windDirection: 'NO (Noroeste Marino)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 52.3888,
    longitude: 4.5409,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=52.3888,4.5409',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/netherlands/zandvoort.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/dutch-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-zandvoort.aspx'
    },
  'las-vegas': {
    id: 'las-vegas',
    trackWidthMeters: 13,
    trackWidthCars: 2,
    name: 'Las Vegas Strip Circuit',
      trackType: 'street',
    pitEntryT: 0.9698,
      pitExitT: 0.0531,
      startOffsetT: 0.0556,
      officialGpName: 'Las Vegas Grand Prix',
    location: 'Las Vegas, Nevada',
    country: 'Estados Unidos',
    countryFlag: '🇺🇸',
    svgFile: 'las-vegas-2026.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 6201,
    totalLaps: 50,
    turns: 17,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Las Vegas Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 20m After T4", startT: 0.1139, endT: 0.2297 },
      { id: 2, name: "A2 · 870m Before T14", startT: 0.6922, endT: 0.8084 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.0611, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.6328, zoneIds: [2], source: 'verified' }
    ],
    spectators: 120000,
    pitLaneTimeLossSec: 21.5,
    rainProbabilityPercent: 2,
    windSpeedKmh: 8,
    windDirection: 'S (Sur)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 36.1147,
    longitude: -115.1728,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=36.1147,-115.1728',
    racingCircuitsUrl: 'https://www.racingcircuits.info/north-america/usa/las-vegas-strip-circuit.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/las-vegas-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-las-vegas.aspx'
    },
  bahrain: {
    id: 'bahrain',
    trackWidthMeters: 14.5,   // medido (TUMFTM racetrack-database)
    name: 'Bahrain International Circuit',
      trackType: 'permanent',
      pitEntryT: 0.9563,
      pitExitT: 0.0983,
      startOffsetT: 0.2125,
      officialGpName: 'Bahrain Grand Prix',
    location: 'Sakhir',
    country: 'Baréin',
    countryFlag: '🇧🇭',
    svgFile: 'bahrain-2026.svg',
    direction: 'clockwise',
    lapLengthMeters: 5412,
    totalLaps: 57,
    turns: 15,
    drsZones: 3,
    // Q19: activación y detección oficiales (plano FIA 2025 · Bahrain Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 23m after T3", startT: 0.1731, endT: 0.2595 },
      { id: 2, name: "A2 · 50m after T10", startT: 0.5091, endT: 0.6235 },
      { id: 3, name: "A3 · 250m after T15", startT: 0.9668, endT: 0.1048 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.1186, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.4797, zoneIds: [2], source: 'verified' },
      { id: 'D3', t: 0.8849, zoneIds: [3], source: 'verified' }
    ],
    spectators: 98000,
    pitLaneTimeLossSec: 23.9,
    rainProbabilityPercent: 1,
    windSpeedKmh: 18,
    windDirection: 'N (Norte Desértico)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 26.0325,
    longitude: 50.5106,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=26.0325,50.5106',
    racingCircuitsUrl: 'https://www.racingcircuits.info/middle-east/bahrain/bahrain-international-circuit.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/bahrain-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-sakhir.aspx'
    },
  baku: {
    id: 'baku',
    trackWidthMeters: 11,
    trackWidthCars: 2,
    name: 'Baku City Circuit',
      trackType: 'street',
      pitEntryT: 0.9392,
      pitExitT: 0.0655,
      startOffsetT: 0.0597,
      officialGpName: 'Azerbaijan Grand Prix',
    location: 'Bakú',
    country: 'Azerbaiyán',
    countryFlag: '🇦🇿',
    svgFile: 'baku-2026.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 6003,
    totalLaps: 51,
    turns: 20,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Azerbaijan Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 54m after Turn 2", startT: 0.1135, endT: 0.223 },
      { id: 2, name: "A2 · 347m after Turn 20", startT: 0.8891, endT: 0.0203 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.0655, zoneIds: [1], source: 'calibrated' },
      { id: 'D2', t: 0.831, zoneIds: [2], source: 'verified' }
    ],
    spectators: 85000,
    pitLaneTimeLossSec: 21.2,
    rainProbabilityPercent: 5,
    windSpeedKmh: 26,
    windDirection: 'E (Mar Caspio)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 40.3725,
    longitude: 49.8533,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=40.3725,49.8533',
    racingCircuitsUrl: 'https://www.racingcircuits.info/asia/azerbaijan/baku-city-circuit.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/azerbaijan-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-bakou.aspx'
    },
  melbourne: {
    id: 'melbourne',
    trackWidthMeters: 13,   // medido (TUMFTM racetrack-database)
    name: 'Albert Park Circuit',
      trackType: 'hybrid',
      pitEntryT: 0.8894,
      pitExitT: 0.0272,
      startOffsetT: 0.0831,
      officialGpName: 'Australian Grand Prix',
    location: 'Melbourne, Victoria',
    country: 'Australia',
    countryFlag: '🇦🇺',
    svgFile: 'melbourne-2.svg',
    direction: 'clockwise',
    lapLengthMeters: 5278,
    totalLaps: 58,
    turns: 14,
    drsZones: 4,
    // Q19: activación y detección oficiales (plano FIA 2025 · Australian Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 130m after TSP1", startT: 0.4408, endT: 0.6156 },
      { id: 2, name: "A2 · 100m after T10", startT: 0.6668, endT: 0.7542 },
      { id: 3, name: "A3 · 30m after T14", startT: 0.916, endT: 0.0409 },
      { id: 4, name: "A4 · 30m after T2", startT: 0.0891, endT: 0.1796 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.3633, zoneIds: [1, 2], source: 'verified' },
      { id: 'D2', t: 0.8619, zoneIds: [3, 4], source: 'verified' }
    ],
    spectators: 145000,
    pitLaneTimeLossSec: 21.0,
    rainProbabilityPercent: 20,
    windSpeedKmh: 14,
    windDirection: 'SO (Suroeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: -37.8497,
    longitude: 144.9680,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-37.8497,144.9680',
    racingCircuitsUrl: 'https://www.racingcircuits.info/australasia/australia/albert-park-melbourne.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/australian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-albert-park.aspx'
    },
  miami: {
    id: 'miami',
    trackWidthMeters: 13,
    trackWidthCars: 2,
    name: 'Miami International Autodrome',
      trackType: 'hybrid',
      pitEntryT: 0.9407,
      pitExitT: 0.0895,
      startOffsetT: 0.2264,
      officialGpName: 'Miami Grand Prix',
    location: 'Miami Gardens, Florida',
    country: 'Estados Unidos',
    countryFlag: '🇺🇸',
    svgFile: 'miami-2026.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 5412,
    totalLaps: 57,
    turns: 19,
    drsZones: 3,
    // Q19: activación y detección oficiales (plano FIA 2025 · Miami Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 30m after turn 9", startT: 0.4123, endT: 0.5549 },
      { id: 2, name: "A2 · 525m after turn 16", startT: 0.7584, endT: 0.8816 },
      { id: 3, name: "A3 · On turn 19 apex", startT: 0.972, endT: 0.0496 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.326, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.6753, zoneIds: [2], source: 'verified' },
      { id: 'D3', t: 0.9099, zoneIds: [3], source: 'verified' }
    ],
    spectators: 95000,
    pitLaneTimeLossSec: 22.1,
    rainProbabilityPercent: 35,
    windSpeedKmh: 16,
    windDirection: 'E (Atlántico)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 25.9580,
    longitude: -80.2389,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=25.9580,-80.2389',
    racingCircuitsUrl: 'https://www.racingcircuits.info/north-america/usa/miami-international-autodrome.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/miami-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-miami.aspx'
    },
  shanghai: {
    id: 'shanghai',
    trackWidthMeters: 13.5,   // medido (TUMFTM racetrack-database)
    name: 'Shanghai International Circuit',
      trackType: 'permanent',
      pitEntryT: 0.9468,
      pitExitT: 0.0892,
      startOffsetT: 0.1014,
      officialGpName: 'Chinese Grand Prix',
    location: 'Jiading, Shanghai',
    country: 'China',
    countryFlag: '🇨🇳',
    svgFile: 'shanghai-2026.svg',
    direction: 'clockwise',
    lapLengthMeters: 5451,
    totalLaps: 56,
    turns: 16,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Chinese Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 375m after turn 13", startT: 0.699, endT: 0.8546 },
      { id: 2, name: "A2 · 98m after turn 16", startT: 0.9667, endT: 0.1013 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5929, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.9428, zoneIds: [2], source: 'verified' }
    ],
    spectators: 120000,
    pitLaneTimeLossSec: 22.9,
    rainProbabilityPercent: 28,
    windSpeedKmh: 12,
    windDirection: 'E (Este)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 31.3389,
    longitude: 121.2200,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.3389,121.2200',
    racingCircuitsUrl: 'https://www.racingcircuits.info/asia/china/shanghai-international-circuit.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/chinese-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-shanghai.aspx'
    },
  jeddah: {
    id: 'jeddah',
    trackWidthMeters: 11,
    trackWidthCars: 2,
    name: 'Jeddah Corniche Circuit',
      trackType: 'street',
      pitEntryT: 0.9485,
      pitExitT: 0.0915,
      startOffsetT: 0.0783,
      officialGpName: 'Saudi Arabian Grand Prix',
    location: 'Yeda',
    country: 'Arabia Saudí',
    countryFlag: '🇸🇦',
    svgFile: 'jeddah-1.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 6174,
    totalLaps: 50,
    turns: 27,
    drsZones: 3,
    // Q19: activación y detección oficiales (plano FIA 2025 · Saudi Arabian Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · On exit to turn 19", startT: 0.5956, endT: 0.6859 },
      { id: 2, name: "A2 · On entry to turn 25", startT: 0.7721, endT: 0.8757 },
      { id: 3, name: "A3 · 240m after turn 27", startT: 0.9404, endT: 0.053 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5269, zoneIds: [1], source: 'calibrated' },
      { id: 'D2', t: 0.6859, zoneIds: [2], source: 'calibrated' },
      { id: 'D3', t: 0.9099, zoneIds: [3], source: 'calibrated' }
    ],
    spectators: 90000,
    pitLaneTimeLossSec: 20.8,
    rainProbabilityPercent: 0,
    windSpeedKmh: 20,
    windDirection: 'NO (Mar Rojo)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 21.6319,
    longitude: 39.1044,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.6319,39.1044',
    racingCircuitsUrl: 'https://www.racingcircuits.info/middle-east/saudi-arabia/jeddah-corniche-circuit.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/saudi-arabian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-djeddah.aspx'
    },
  'marina-bay': {
    id: 'marina-bay',
    trackWidthMeters: 10,
    trackWidthCars: 2,
    name: 'Marina Bay Street Circuit',
      trackType: 'street',
    pitEntryT: 0.9287,
      pitExitT: 0.1012,
      startOffsetT: 0.05,
      officialGpName: 'Singapore Grand Prix',
    location: 'Marina Bay',
    country: 'Singapur',
    countryFlag: '🇸🇬',
    svgFile: 'marina-bay-4.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 4940,
    totalLaps: 62,
    turns: 19,
    drsZones: 4,
    // Q19: activación y detección oficiales (plano FIA 2025 · Singapore Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 48m after T5", startT: 0.2075, endT: 0.3373 },
      { id: 2, name: "A2 · 78m after T13", startT: 0.6385, endT: 0.7067 },
      { id: 3, name: "A3 · 100m after T14", startT: 0.7571, endT: 0.86 },
      { id: 4, name: "A4 · Exit T19", startT: 0.9844, endT: 0.064 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.1471, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.598, zoneIds: [2, 3], source: 'verified' },
      { id: 'D3', t: 0.9171, zoneIds: [4], source: 'verified' }
    ],
    spectators: 100000,
    pitLaneTimeLossSec: 29.5,
    rainProbabilityPercent: 40,
    windSpeedKmh: 6,
    windDirection: 'SO (Húmedo Tropical)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 1.2914,
    longitude: 103.8636,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=1.2914,103.8636',
    racingCircuitsUrl: 'https://www.racingcircuits.info/asia/singapore/marina-bay.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/singapore-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-singapour.aspx'
    },
  lusail: {
    id: 'lusail',
    trackWidthMeters: 12,
    name: 'Lusail International Circuit',
      trackType: 'permanent',
    pitEntryT: 0.8814,
      pitExitT: 0.1141,
      startOffsetT: 0.9539,
      officialGpName: 'Qatar Grand Prix',
    location: 'Lusail, Doha',
    country: 'Catar',
    countryFlag: '🇶🇦',
    svgFile: 'lusail-1.svg',
    direction: 'clockwise',
    lapLengthMeters: 5419,
    totalLaps: 57,
    turns: 16,
    drsZones: 1,
    // Q19: activación y detección oficiales (plano FIA 2025 · Qatar Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 305m After Turn 16", startT: 0.9722, endT: 0.1288 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.8348, zoneIds: [1], source: 'verified' }
    ],
    spectators: 85000,
    pitLaneTimeLossSec: 22.0,
    rainProbabilityPercent: 0,
    windSpeedKmh: 22,
    windDirection: 'N (Golfo Pérsico)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 25.4900,
    longitude: 51.4542,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=25.4900,51.4542',
    racingCircuitsUrl: 'https://www.racingcircuits.info/middle-east/qatar/losail.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/qatar-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-losail.aspx'
    },
  'yas-marina': {
    id: 'yas-marina',
    pitTunnel: true,
    trackWidthMeters: 13.5,   // medido (TUMFTM racetrack-database)
    name: 'Yas Marina Circuit',
      trackType: 'permanent',
    pitEntryT: 0.9478,
      pitExitT: 0.1627,
      startOffsetT: 0.6201,
      officialGpName: 'Abu Dhabi Grand Prix',
    location: 'Isla Yas, Abu Dabi',
    country: 'Emiratos Árabes Unidos',
    countryFlag: '🇦🇪',
    svgFile: 'yas-marina-2.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 5281,
    totalLaps: 58,
    turns: 16,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Abu Dhabi Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 260m after Turn 5", startT: 0.3216, endT: 0.4726 },
      { id: 2, name: "A2 · 165m after Turn 7", startT: 0.5437, endT: 0.6686 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.2281, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.5222, zoneIds: [2], source: 'verified' }
    ],
    spectators: 110000,
    pitLaneTimeLossSec: 22.6,
    rainProbabilityPercent: 0,
    windSpeedKmh: 12,
    windDirection: 'NO (Golfo)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 24.4672,
    longitude: 54.6031,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=24.4672,54.6031',
    racingCircuitsUrl: 'https://www.racingcircuits.info/middle-east/united-arab-emirates/yas-marina.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/abu-dhabi-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-yas-marina.aspx'
    },
  hungaroring: {
    id: 'hungaroring',
    trackWidthMeters: 11.5,   // medido (TUMFTM racetrack-database)
    name: 'Hungaroring',
      trackType: 'permanent',
      pitEntryT: 0.8835,
      pitExitT: 0.1374,
      startOffsetT: 0.861,
      officialGpName: 'Hungarian Grand Prix',
    location: 'Mogyoród, Budapest',
    country: 'Hungría',
    countryFlag: '🇭🇺',
    svgFile: 'hungaroring-3.svg',
    direction: 'clockwise',
    lapLengthMeters: 4381,
    totalLaps: 70,
    turns: 14,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · Hungarian Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 40m after Turn 14", startT: 0.9474, endT: 0.1177 },
      { id: 2, name: "A2 · 6m after Turn 1", startT: 0.1498, endT: 0.2323 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.9366, zoneIds: [1, 2], source: 'verified' }
    ],
    spectators: 100000,
    pitLaneTimeLossSec: 21.4,
    rainProbabilityPercent: 18,
    windSpeedKmh: 10,
    windDirection: 'NE (Nordeste)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 47.5830,
    longitude: 19.2486,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=47.5830,19.2486',
    racingCircuitsUrl: 'https://www.racingcircuits.info/europe/hungary/hungaroring.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/hungarian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-hungaroring.aspx'
    },
  'mexico-city': {
    id: 'mexico-city',
    trackWidthMeters: 12.5,   // medido (TUMFTM racetrack-database)
    name: 'Autódromo Hermanos Rodríguez',
      trackType: 'permanent',
    pitEntryT: 0.9432,
      pitExitT: 0.1308,
      startOffsetT: 0.8667,
      officialGpName: 'Gran Premio de la Ciudad de México',
    location: 'Ciudad de México',
    country: 'México',
    countryFlag: '🇲🇽',
    svgFile: 'mexico-city-2026.svg',
    direction: 'clockwise',
    lapLengthMeters: 4304,
    totalLaps: 71,
    turns: 17,
    drsZones: 3,
    // Q19: activación y detección oficiales (plano FIA 2025 · Mexico City Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 80m after Turn 11", startT: 0.7378, endT: 0.8253 },
      { id: 2, name: "A2 · 240m after Turn 17", startT: 0.0188, endT: 0.2573 },
      { id: 3, name: "A3 · 115m after Turn 3", startT: 0.3424, endT: 0.452 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.6678, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.9311, zoneIds: [2, 3], source: 'calibrated' }
    ],
    spectators: 150000,
    pitLaneTimeLossSec: 22.5,
    rainProbabilityPercent: 20,
    windSpeedKmh: 8,
    windDirection: 'N (Valle de México)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 19.4042,
    longitude: -99.0907,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=19.4042,-99.0907',
    racingCircuitsUrl: 'https://www.racingcircuits.info/north-america/mexico/autodromo-hermanos-rodriguez.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/mexican-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-mexico.aspx'
    },
  montreal: {
    id: 'montreal',
    trackWidthMeters: 10.5,   // medido (TUMFTM racetrack-database)
    name: 'Circuit Gilles-Villeneuve',
      trackType: 'hybrid',
      pitEntryT: 0.8854,
      pitExitT: 0.0828,
      startOffsetT: 0.4196,
      officialGpName: 'Canadian Grand Prix',
    location: 'Île Notre-Dame, Montreal',
    country: 'Canadá',
    countryFlag: '🇨🇦',
    svgFile: 'montreal-6.svg',
    direction: 'clockwise',
    lapLengthMeters: 4361,
    totalLaps: 70,
    turns: 14,
    drsZones: 3,
    // Q19: activación y detección oficiales (plano FIA 2025 · Canadian Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 95m after Turn 7", startT: 0.3212, endT: 0.4284 },
      { id: 2, name: "A2 · 155m before Turn 12", startT: 0.6868, endT: 0.8617 },
      { id: 3, name: "A3 · 70m after Turn 14", startT: 0.9116, endT: 0.0244 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.229, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.5006, zoneIds: [2, 3], source: 'verified' }
    ],
    spectators: 115000,
    pitLaneTimeLossSec: 18.5,
    rainProbabilityPercent: 35,
    windSpeedKmh: 16,
    windDirection: 'SO (Río San Lorenzo)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 45.5000,
    longitude: -73.5228,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=45.5000,-73.5228',
    racingCircuitsUrl: 'https://www.racingcircuits.info/north-america/canada/circuit-gilles-villeneuve.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/canadian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-montreal.aspx'
    },
  austin: {
    id: 'austin',
    trackWidthMeters: 15,   // medido (TUMFTM racetrack-database)
    name: 'Circuit of the Americas',
      trackType: 'permanent',
    pitEntryT: 0.9302,
      pitExitT: 0.1134,
      startOffsetT: 0.5743,
      officialGpName: 'United States Grand Prix',
    location: 'Austin, Texas',
    country: 'Estados Unidos',
    countryFlag: '🇺🇸',
    svgFile: 'austin-2026.svg',
    direction: 'anti-clockwise',
    lapLengthMeters: 5513,
    totalLaps: 56,
    turns: 20,
    drsZones: 2,
    // Q19: activación y detección oficiales (plano FIA 2025 · United States Grand Prix); fin de zona en la frenada siguiente.
    drsZoneSpecs: [
      { id: 1, name: "A1 · 345m after turn 11", startT: 0.5299, endT: 0.659 },
      { id: 2, name: "A2 · 80m after turn 20", startT: 0.9881, endT: 0.091 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.4242, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.8767, zoneIds: [2], source: 'verified' }
    ],
    spectators: 150000,
    pitLaneTimeLossSec: 21.6,
    rainProbabilityPercent: 15,
    windSpeedKmh: 14,
    windDirection: 'S (Sur Tejano)',
    asphaltAbrasion: 'Media',
    tireStressLevel: 'Media',
    asphaltGripLevel: 'Medio',
    elevationChangeMeters: 25,
    safetyCarProbabilityPercent: 45,
    officialWebsiteUrl: 'https://www.formula1.com/en/racing/2026.html',
    latitude: 30.1328,
    longitude: -97.6411,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=30.1328,-97.6411',
    racingCircuitsUrl: 'https://www.racingcircuits.info/north-america/usa/circuit-of-the-americas.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/united-states-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-austin.aspx'
    },
};
