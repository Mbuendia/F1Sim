import type { CircuitScenario } from './scenarioTypes';

/**
 * Escenario por defecto: reproduce el comportamiento visual actual
 * (bandas uniformes de hierba, grava y pianos) para circuitos sin datos
 * de escenario específico. Garantiza cero regresión visual.
 */
export const defaultScenario: CircuitScenario = {
  trackType: 'permanent',
  backgroundColor: '#181e1a',        // Hierba exterior (color actual)
  defaultRunoffSurface: 'gravel',
  runoffZones: [],                   // Vacío = usa el renderizado uniforme legacy
  kerbs: [],                         // Vacío = pianos globales legacy
  barriers: [],
  hasGravelGlobal: true,             // Comportamiento legacy: grava en todo el circuito
};
