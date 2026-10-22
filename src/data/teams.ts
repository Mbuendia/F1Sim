// Nombres de parodia (20/10/2026, petición del usuario): equipos y motores sacados de memes de la afición; los
// identificadores, colores y datos de rendimiento no cambian.
import { Team } from '../types/f1';

export const TEAMS: Record<string, Team> = {
  mclaren: {
    id: 'mclaren',
    name: 'McPapaya Racing',
    shortName: 'McPapaya',
    color: '#FF8000',
    accentColor: '#1a1005',
    textColor: '#ffffff',
    carPerformance: 0.999,
    aerodynamics: 0.998,
    enginePower: 0.996,
    reliability: 0.99,
    pitStopAverageTime: 2.1,
    engineManufacturer: 'Totocedes-AMG',
    engineModel: 'Totocedes-AMG F-Uno M15 E Performance 1.6L V6 Turbo',
    horsepower: 1045,
    drivers: ['norris', 'piastri']
  },
  redbull: {
    id: 'redbull',
    name: 'Oráculo Red Bulla Racing',
    shortName: 'Red Bulla',
    color: '#041E42', // [FIX M7] Navy Blue Mate Oficial Red Bull
    accentColor: '#E10600', // Red Bull Racing Red
    textColor: '#ffffff',
    carPerformance: 0.998,
    aerodynamics: 0.997,
    enginePower: 0.998,
    reliability: 0.98,
    pitStopAverageTime: 2.0,
    engineManufacturer: 'Hondamental RBPT',
    engineModel: 'Hondamental RBPT RBPTH002 1.6L V6 Turbo',
    horsepower: 1030,
    drivers: ['verstappen', 'lawson']
  },
  ferrari: {
    id: 'ferrari',
    name: 'Scudería Errari Plan B',
    shortName: 'Errari',
    color: '#E8002D',
    accentColor: '#3d000c',
    textColor: '#ffffff',
    carPerformance: 0.997,
    aerodynamics: 0.996,
    enginePower: 0.999,
    reliability: 0.98,
    pitStopAverageTime: 2.2,
    engineManufacturer: 'Scudería Errari',
    engineModel: 'Errari 066/12 1.6L V6 Turbo',
    horsepower: 1038,
    drivers: ['leclerc', 'hamilton']
  },
  mercedes: {
    id: 'mercedes',
    name: 'Totocedes-AMG Petrolas',
    shortName: 'Totocedes',
    color: '#27F4D2', // Petronas Green
    accentColor: '#000000', // Black
    textColor: '#000000', // [FIX M6] Negro puro para contraste WCAG AAA (15.6:1)
    carPerformance: 0.995,
    aerodynamics: 0.994,
    enginePower: 0.996,
    reliability: 0.99,
    pitStopAverageTime: 2.3,
    engineManufacturer: 'Totocedes-AMG',
    engineModel: 'Totocedes-AMG F-Uno M15 E Performance 1.6L V6 Turbo',
    horsepower: 1045,
    drivers: ['russell', 'antonelli']
  },
  astonmartin: {
    id: 'astonmartin',
    name: 'Aston Papá Stroll Team',
    shortName: 'Aston Papá',
    color: '#229971', // British Racing Green
    accentColor: '#D3DA27', // Lime yellow
    textColor: '#ffffff',
    carPerformance: 0.993,
    aerodynamics: 0.992,
    enginePower: 0.994,
    reliability: 0.98,
    pitStopAverageTime: 2.4,
    engineManufacturer: 'Totocedes-AMG',
    engineModel: 'Totocedes-AMG F-Uno M15 E Performance 1.6L V6 Turbo',
    horsepower: 1045,
    drivers: ['alonso', 'stroll']
  },
  williams: {
    id: 'williams',
    name: 'Vowlliams Racing',
    shortName: 'Vowlliams',
    color: '#005AFF', // Williams Blue
    accentColor: '#000000',
    textColor: '#ffffff',
    carPerformance: 0.991,
    aerodynamics: 0.989,
    enginePower: 0.996,
    reliability: 0.98,
    pitStopAverageTime: 2.3,
    engineManufacturer: 'Totocedes-AMG',
    engineModel: 'Totocedes-AMG F-Uno M15 E Performance 1.6L V6 Turbo',
    horsepower: 1045,
    drivers: ['sainz', 'albon']
  },
  racingbulls: {
    id: 'racingbulls',
    name: 'Bizum Cash App RB',
    shortName: 'Racing Bueyes',
    color: '#1634CC', // VCARB Blue
    accentColor: '#E0E0E0', // [FIX M7] Plateado metálico
    textColor: '#ffffff',
    carPerformance: 0.990,
    aerodynamics: 0.989,
    enginePower: 0.993,
    reliability: 0.97,
    pitStopAverageTime: 2.4,
    engineManufacturer: 'Hondamental RBPT',
    engineModel: 'Hondamental RBPT RBPTH002 1.6L V6 Turbo',
    horsepower: 1030,
    drivers: ['tsunoda', 'hadjar']
  },
  haas: {
    id: 'haas',
    name: 'MoneyGramo Haasta Luego',
    shortName: 'Haasta Luego',
    color: '#FFFFFF', // White/Black
    accentColor: '#E6002B', // Red
    textColor: '#000000',
    carPerformance: 0.989,
    aerodynamics: 0.987,
    enginePower: 0.995,
    reliability: 0.97,
    pitStopAverageTime: 2.4,
    engineManufacturer: 'Scudería Errari',
    engineModel: 'Errari 066/12 1.6L V6 Turbo',
    horsepower: 1038,
    drivers: ['ocon', 'bearman']
  },
  alpine: {
    id: 'alpine',
    name: 'BWT Alpino Grigio',
    shortName: 'Alpino Grigio',
    color: '#FF87BC', // BWT Pink
    accentColor: '#0090FF', // Alpine Blue
    textColor: '#000000',
    carPerformance: 0.988,
    aerodynamics: 0.987,
    enginePower: 0.990,
    reliability: 0.97,
    pitStopAverageTime: 2.5,
    engineManufacturer: 'Renol',
    engineModel: 'Renol E-Tech RE24 1.6L V6 Turbo',
    horsepower: 1015,
    drivers: ['gasly', 'doohan']
  },
  sauber: {
    id: 'sauber',
    name: 'Steak Team Kick Salsa',
    shortName: 'Steak Sauber',
    color: '#52E252', // Neon Green
    accentColor: '#000000', // Black
    textColor: '#000000',
    carPerformance: 0.986,
    aerodynamics: 0.985,
    enginePower: 0.990,
    reliability: 0.96,
    pitStopAverageTime: 2.6,
    engineManufacturer: 'Scudería Errari',
    engineModel: 'Errari 066/12 1.6L V6 Turbo',
    horsepower: 1038,
    drivers: ['hulkenberg', 'bortoleto']
  }
};

export const STARTING_GRID_ORDER: string[] = [
  'norris',
  'verstappen',
  'leclerc',
  'piastri',
  'hamilton',
  'russell',
  'alonso',
  'sainz',
  'antonelli',
  'lawson',
  'gasly',
  'albon',
  'tsunoda',
  'hulkenberg',
  'stroll',
  'ocon',
  'bearman',
  'hadjar',
  'doohan',
  'bortoleto'
];
