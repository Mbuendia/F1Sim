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
    name: 'Circuit de Barcelona-Catalunya',
    trackType: 'permanent',
    pitEntryT: 0.8343,
    pitCommitmentT: 0.8093,
      pitExitT: 0.0616,
      startOffsetT: 0.12,
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
      { id: 1, name: "A1 · 40m after turn 9", startT: 0.5641, endT: 0.6547 },
      { id: 2, name: "A2 · 162m after turn 14", startT: 0.9015, endT: 0.0867 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5366, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.8343, zoneIds: [2], source: 'calibrated' }
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
    name: 'Autodromo Nazionale Monza',
      trackType: 'permanent',
      pitEntryT: 0.8882,
      pitExitT: 0.0162,
      startOffsetT: 0.76,
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
      { id: 1, name: "A1 · 170m after Turn 7", startT: 0.4585, endT: 0.588 },
      { id: 2, name: "A2 · 12m after finish line", startT: 0.9347, endT: 0.0653 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.4126, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.8393, zoneIds: [2], source: 'verified' }
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
    name: 'Silverstone Circuit',
    trackType: 'permanent',
    pitEntryT: 0.4118,
    pitExitT: 0.6355,
    pitOffset: 28,
    startOffsetT: 0.42,
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
      { id: 1, name: "A1 · 30m after Turn 5", startT: 0.7356, endT: 0.828 },
      { id: 2, name: "A2 · Turn 14", startT: 0.2284, endT: 0.3507 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.6626, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.1529, zoneIds: [2], source: 'verified' }
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
    name: 'Circuit de Spa-Francorchamps',
      trackType: 'permanent',
      pitEntryT: 0.8664,
      pitExitT: 0.9774,
      startOffsetT: 0.05,
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
      { id: 1, name: "A1 · 305m after Turn 4", startT: 0.1256, endT: 0.2187 },
      { id: 2, name: "A2 · 30m after Turn 19", startT: 0.8765, endT: 0.9267 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.017, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.8389, zoneIds: [2], source: 'verified' }
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
    trackWidthCars: 2,
    name: 'Circuit de Monaco',
      trackType: 'street',
      pitEntryT: 0.5867,
      pitExitT: 0.7023,
      startOffsetT: 0.6,
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
      { id: 1, name: "A1 · 18m after Turn 19", startT: 0.6067, endT: 0.732 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5345, zoneIds: [1], source: 'verified' }
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
    name: 'Red Bull Ring',
      trackType: 'permanent',
    pitEntryT: 0.1527,
      pitExitT: 0.4006,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 102m after T1", startT: 0.3918, endT: 0.5587 },
      { id: 2, name: "A2 · 100m after T3", startT: 0.6094, endT: 0.7493 },
      { id: 3, name: "A3 · 106m after T10", startT: 0.2121, endT: 0.3308 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.3308, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.5757, zoneIds: [2], source: 'verified' },
      { id: 'D3', t: 0.1581, zoneIds: [3], source: 'verified' }
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
      { id: 1, name: "A1 · 30m after Turn 3", startT: 0.3514, endT: 0.4987 },
      { id: 2, name: "A2 · 160m before Turn 15", startT: 0.0983, endT: 0.2493 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.3015, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.9884, zoneIds: [2], source: 'verified' }
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
    pitEntryT: 0.0981,
    pitExitT: 0.4289,
    latitude: -23.7036,
    longitude: -46.6997,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-23.7036,-46.6997',
    racingCircuitsUrl: 'https://www.racingcircuits.info/south-america/brazil/interlagos.html',
    racingNews365Url: 'https://racingnews365.com/f1/races/brazilian-grand-prix',
    statsF1Url: 'https://www.statsf1.com/en/circuit-interlagos.aspx'
  },
  suzuka: {
    id: 'suzuka',
    name: 'Suzuka International Racing Course',
      trackType: 'permanent',
      pitEntryT: 0.9117,
      pitExitT: 0.0672,
      startOffsetT: 0.62,
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
      { id: 1, name: "A1 · 100m before control line", startT: 0.9481, endT: 0.0853 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.8301, zoneIds: [1], source: 'verified' }
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
    trackWidthCars: 2,
    name: 'Circuit Zandvoort',
      trackType: 'permanent',
      pitEntryT: 0.2744,
      pitExitT: 0.4603,
      startOffsetT: 0.75,
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
      { id: 1, name: "A1 · 50m after turn 10", startT: 0.9349, endT: 0.036 },
      { id: 2, name: "A2 · 40m after turn 13", startT: 0.1672, endT: 0.392 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.9132, zoneIds: [1], source: 'calibrated' },
      { id: 'D2', t: 0.0904, zoneIds: [2], source: 'verified' }
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
    trackWidthCars: 2,
    name: 'Las Vegas Strip Circuit',
      trackType: 'street',
    pitEntryT: 0.0254,
      pitExitT: 0.1087,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 20m After T4", startT: 0.1695, endT: 0.2853 },
      { id: 2, name: "A2 · 870m Before T14", startT: 0.7478, endT: 0.864 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.1167, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.6884, zoneIds: [2], source: 'verified' }
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
    name: 'Bahrain International Circuit',
      trackType: 'permanent',
      pitEntryT: 0.1688,
      pitExitT: 0.3108,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 23m after T3", startT: 0.3856, endT: 0.472 },
      { id: 2, name: "A2 · 50m after T10", startT: 0.7216, endT: 0.836 },
      { id: 3, name: "A3 · 250m after T15", startT: 0.1793, endT: 0.3173 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.3311, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.6922, zoneIds: [2], source: 'verified' },
      { id: 'D3', t: 0.0974, zoneIds: [3], source: 'verified' }
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
    trackWidthCars: 2,
    name: 'Baku City Circuit',
      trackType: 'street',
      pitEntryT: 0.9989,
      pitExitT: 0.1252,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 54m after Turn 2", startT: 0.1732, endT: 0.2827 },
      { id: 2, name: "A2 · 347m after Turn 20", startT: 0.9488, endT: 0.08 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.1252, zoneIds: [1], source: 'calibrated' },
      { id: 'D2', t: 0.8907, zoneIds: [2], source: 'verified' }
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
    name: 'Albert Park Circuit',
      trackType: 'hybrid',
      pitEntryT: 0.3325,
      pitExitT: 0.4703,
      startOffsetT: 0.64,
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
      { id: 1, name: "A1 · 130m after TSP1", startT: 0.8839, endT: 0.0587 },
      { id: 2, name: "A2 · 100m after T10", startT: 0.1099, endT: 0.1973 },
      { id: 3, name: "A3 · 30m after T14", startT: 0.3591, endT: 0.484 },
      { id: 4, name: "A4 · 30m after T2", startT: 0.5322, endT: 0.6227 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.8064, zoneIds: [1, 2], source: 'verified' },
      { id: 'D2', t: 0.305, zoneIds: [3, 4], source: 'verified' }
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
    trackWidthCars: 2,
    name: 'Miami International Autodrome',
      trackType: 'hybrid',
      pitEntryT: 0.1671,
      pitExitT: 0.3159,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 30m after turn 9", startT: 0.6387, endT: 0.7813 },
      { id: 2, name: "A2 · 525m after turn 16", startT: 0.9848, endT: 0.108 },
      { id: 3, name: "A3 · On turn 19 apex", startT: 0.1984, endT: 0.276 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5524, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.9017, zoneIds: [2], source: 'verified' },
      { id: 'D3', t: 0.1363, zoneIds: [3], source: 'verified' }
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
    name: 'Shanghai International Circuit',
      trackType: 'permanent',
      pitEntryT: 0.0482,
      pitExitT: 0.1906,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 375m after turn 13", startT: 0.8004, endT: 0.956 },
      { id: 2, name: "A2 · 98m after turn 16", startT: 0.0681, endT: 0.2027 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.6943, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.0442, zoneIds: [2], source: 'verified' }
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
    trackWidthCars: 2,
    name: 'Jeddah Corniche Circuit',
      trackType: 'street',
      pitEntryT: 0.9568,
      pitExitT: 0.0998,
      startOffsetT: 0.07,
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
      { id: 1, name: "A1 · On exit to turn 19", startT: 0.6039, endT: 0.6942 },
      { id: 2, name: "A2 · On entry to turn 25", startT: 0.7804, endT: 0.884 },
      { id: 3, name: "A3 · 240m after turn 27", startT: 0.9487, endT: 0.0613 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5352, zoneIds: [1], source: 'calibrated' },
      { id: 'D2', t: 0.6942, zoneIds: [2], source: 'calibrated' },
      { id: 'D3', t: 0.9182, zoneIds: [3], source: 'calibrated' }
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
    name: 'Lusail International Circuit',
      trackType: 'permanent',
    pitEntryT: 0.7953,
      pitExitT: 0.028,
      startOffsetT: 0.04,
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
      { id: 1, name: "A1 · 305m After Turn 16", startT: 0.8861, endT: 0.0427 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.7487, zoneIds: [1], source: 'verified' }
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
    name: 'Yas Marina Circuit',
      trackType: 'permanent',
    pitEntryT: 0.5179,
      pitExitT: 0.7328,
      startOffsetT: 0.05,
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
      { id: 1, name: "A1 · 260m after Turn 5", startT: 0.8917, endT: 0.0427 },
      { id: 2, name: "A2 · 165m after Turn 7", startT: 0.1138, endT: 0.2387 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.7982, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.0923, zoneIds: [2], source: 'verified' }
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
    name: 'Hungaroring',
      trackType: 'permanent',
      pitEntryT: 0.5245,
      pitExitT: 0.7784,
      startOffsetT: 0.22,
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
      { id: 1, name: "A1 · 40m after Turn 14", startT: 0.5884, endT: 0.7587 },
      { id: 2, name: "A2 · 6m after Turn 1", startT: 0.7908, endT: 0.8733 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5776, zoneIds: [1, 2], source: 'verified' }
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
    name: 'Autódromo Hermanos Rodríguez',
      trackType: 'permanent',
    pitEntryT: 0.8099,
      pitExitT: 0.9975,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 80m after Turn 11", startT: 0.6045, endT: 0.692 },
      { id: 2, name: "A2 · 240m after Turn 17", startT: 0.8855, endT: 0.124 },
      { id: 3, name: "A3 · 115m after Turn 3", startT: 0.2091, endT: 0.3187 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.5345, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.7978, zoneIds: [2, 3], source: 'calibrated' }
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
    name: 'Circuit Gilles-Villeneuve',
      trackType: 'hybrid',
      pitEntryT: 0.125,
      pitExitT: 0.3224,
      startOffsetT: 0.18,
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
      { id: 1, name: "A1 · 95m after Turn 7", startT: 0.5608, endT: 0.668 },
      { id: 2, name: "A2 · 155m before Turn 12", startT: 0.9264, endT: 0.1013 },
      { id: 3, name: "A3 · 70m after Turn 14", startT: 0.1512, endT: 0.264 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.4686, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.7402, zoneIds: [2, 3], source: 'verified' }
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
    name: 'Circuit of the Americas',
      trackType: 'permanent',
    pitEntryT: 0.5045,
      pitExitT: 0.6877,
      startOffsetT: 0,
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
      { id: 1, name: "A1 · 345m after turn 11", startT: 0.1042, endT: 0.2333 },
      { id: 2, name: "A2 · 80m after turn 20", startT: 0.5624, endT: 0.6653 }
    ],
    drsDetections: [
      { id: 'D1', t: 0.9985, zoneIds: [1], source: 'verified' },
      { id: 'D2', t: 0.451, zoneIds: [2], source: 'verified' }
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
