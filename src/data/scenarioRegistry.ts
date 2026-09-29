import type { CircuitScenario } from './scenarioTypes';
import { barcelonaScenario } from './scenarioBarcelona';
import { monacoScenario } from './scenarioMonaco';
import { defaultScenario } from './scenarioDefault';
import { calendarScenarios } from './scenarioCalendar';

/**
 * Registro centralizado de escenarios por circuito.
 * Los circuitos sin escenario específico reciben el fallback por defecto
 * (bandas uniformes idénticas al renderizado legacy).
 */
const SCENARIOS: Record<string, CircuitScenario> = {
  ...calendarScenarios,
  barcelona: barcelonaScenario,
  monaco: monacoScenario,
};

/**
 * Obtiene el escenario visual para un circuito dado.
 * Retorna el escenario por defecto si el circuito no tiene datos específicos.
 */
export function getScenario(circuitId: string): CircuitScenario {
  return SCENARIOS[circuitId] || defaultScenario;
}
