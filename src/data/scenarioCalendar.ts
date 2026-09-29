import type { CircuitScenario, TrackType, RunoffSurface } from './scenarioTypes';

/**
 * Perfiles visuales del calendario. APPROX: calibración artística, no datos FIA.
 * Los intervalos normalizados son aproximaciones para el juego; no representan
 * una certificación de seguridad ni ubicaciones topográficas verificadas.
 * Cada entrada define su paleta, superficies y zonas, sin recurrir al fallback.
 */
interface VisualProfile {
  type: TrackType;
  ground: string;
  runoff: RunoffSurface;
  /** Centros aproximados de grupos de curvas; nunca pianos en toda la vuelta. */
  bends: number[];
  /** Tramos con barrera; las calles mantienen continuidad a ambos lados. */
  barriers: [number, number][];
  width: number;
}

const profiles: Record<string, VisualProfile> = {
  monza: { type: 'permanent', ground: '#19291c', runoff: 'gravel', width: 1.6,
    bends: [0.10, 0.28, 0.37, 0.44, 0.66, 0.83], barriers: [[0.07, 0.14], [0.64, 0.70], [0.81, 0.89]] },
  silverstone: { type: 'permanent', ground: '#233b28', runoff: 'grass', width: 1.7,
    bends: [0.06, 0.16, 0.21, 0.36, 0.46, 0.55, 0.61, 0.83, 0.92], barriers: [[0.43, 0.49], [0.53, 0.65], [0.80, 0.87]] },
  spa: { type: 'permanent', ground: '#152c21', runoff: 'gravel', width: 1.8,
    bends: [0.04, 0.11, 0.29, 0.35, 0.42, 0.50, 0.62, 0.75, 0.90], barriers: [[0.08, 0.15], [0.47, 0.55], [0.72, 0.79]] },
  spielberg: { type: 'permanent', ground: '#29412a', runoff: 'gravel', width: 1.5,
    bends: [0.067, 0.289, 0.486, 0.595, 0.693, 0.828, 0.917], barriers: [[0.26, 0.339], [0.456, 0.536], [0.801, 0.947]] },
  interlagos: { type: 'permanent', ground: '#283b23', runoff: 'asphalt', width: 1.3,
    bends: [0.06, 0.12, 0.33, 0.43, 0.53, 0.61, 0.71, 0.80], barriers: [[0.03, 0.16], [0.49, 0.65], [0.77, 0.85]] },
  suzuka: { type: 'permanent', ground: '#213823', runoff: 'gravel', width: 1.5,
    bends: [0.06, 0.14, 0.21, 0.29, 0.37, 0.47, 0.63, 0.79, 0.90], barriers: [[0.34, 0.41], [0.60, 0.67], [0.76, 0.83]] },
  zandvoort: { type: 'permanent', ground: '#685e40', runoff: 'gravel', width: 1.2,
    bends: [0.06, 0.14, 0.21, 0.36, 0.49, 0.60, 0.73, 0.83, 0.93], barriers: [[0.03, 0.10], [0.32, 0.40], [0.89, 0.97]] },
  'las-vegas': { type: 'street', ground: '#262330', runoff: 'wall', width: 0.7,
    bends: [0.06, 0.127, 0.315, 0.403, 0.523, 0.84, 0.91], barriers: [[0, 0.503], [0.503, 1]] },
  bahrain: { type: 'permanent', ground: '#6a5b40', runoff: 'asphalt', width: 2,
    bends: [0.055, 0.146, 0.305, 0.391, 0.481, 0.565, 0.694, 0.806, 0.924], barriers: [[0.025, 0.095], [0.275, 0.342], [0.538, 0.618]] },
  baku: { type: 'street', ground: '#33353c', runoff: 'wall', width: 0.6,
    bends: [0.059, 0.14, 0.259, 0.347, 0.435, 0.517, 0.599, 0.698], barriers: [[0, 0.403], [0.403, 0.763], [0.763, 1]] },
  melbourne: { type: 'hybrid', ground: '#284338', runoff: 'grass', width: 1.1,
    bends: [0.06, 0.15, 0.29, 0.39, 0.59, 0.69, 0.83, 0.93], barriers: [[0, 0.19], [0.27, 0.43], [0.57, 0.74], [0.81, 1]] },
  miami: { type: 'hybrid', ground: '#235354', runoff: 'asphalt', width: 1.3,
    bends: [0.063, 0.143, 0.232, 0.312, 0.477, 0.575, 0.665, 0.862, 0.943], barriers: [[0, 0.344], [0.456, 0.716], [0.836, 1]] },
  shanghai: { type: 'permanent', ground: '#324135', runoff: 'asphalt', width: 1.8,
    bends: [0.063, 0.131, 0.219, 0.32, 0.417, 0.52, 0.643, 0.891, 0.96], barriers: [[0.03, 0.171], [0.29, 0.359], [0.851, 0.931]] },
  jeddah: { type: 'street', ground: '#3a424c', runoff: 'wall', width: 0.8,
    bends: [0.06, 0.16, 0.25, 0.35, 0.45, 0.63, 0.72, 0.89], barriers: [[0, 0.48], [0.48, 1]] },
  'marina-bay': { type: 'street', ground: '#242934', runoff: 'wall', width: 0.7,
    bends: [0.06, 0.14, 0.36, 0.45, 0.53, 0.63, 0.69, 0.84, 0.93], barriers: [[0, 0.35], [0.35, 0.7], [0.7, 1]] },
  lusail: { type: 'permanent', ground: '#736444', runoff: 'gravel', width: 1.7,
    bends: [0.06, 0.14, 0.24, 0.34, 0.45, 0.56, 0.67, 0.77, 0.91], barriers: [[0.03, 0.18], [0.53, 0.71], [0.87, 0.96]] },
  'yas-marina': { type: 'permanent', ground: '#47514a', runoff: 'asphalt', width: 1.8,
    bends: [0.06, 0.17, 0.27, 0.46, 0.66, 0.75, 0.85, 0.94], barriers: [[0.24, 0.31], [0.43, 0.51], [0.72, 0.98]] },
  hungaroring: { type: 'permanent', ground: '#33452b', runoff: 'asphalt', width: 1.4,
    bends: [0.06, 0.19, 0.29, 0.38, 0.47, 0.57, 0.68, 0.80, 0.92], barriers: [[0.03, 0.10], [0.35, 0.42], [0.77, 0.97]] },
  'mexico-city': { type: 'permanent', ground: '#354138', runoff: 'asphalt', width: 1.3,
    bends: [0.061, 0.133, 0.236, 0.329, 0.419, 0.526, 0.707, 0.775, 0.833], barriers: [[0.03, 0.173], [0.205, 0.363], [0.676, 0.875]] },
  montreal: { type: 'hybrid', ground: '#274133', runoff: 'asphalt', width: 0.9,
    bends: [0.06, 0.14, 0.27, 0.38, 0.51, 0.64, 0.89], barriers: [[0, 0.19], [0.24, 0.42], [0.48, 0.70], [0.86, 1]] },
  austin: { type: 'permanent', ground: '#4c4c31', runoff: 'asphalt', width: 2,
    bends: [0.061, 0.151, 0.23, 0.328, 0.414, 0.615, 0.699, 0.8, 0.933], barriers: [[0.03, 0.101], [0.38, 0.458], [0.587, 0.655], [0.9, 0.97]] },
};

function buildProfile(profile: VisualProfile): CircuitScenario {
  const street = profile.type === 'street';
  return {
    trackType: profile.type,
    backgroundColor: profile.ground,
    defaultRunoffSurface: profile.runoff,
    hasGravelGlobal: profile.runoff === 'gravel',
    runoffZones: street ? [] : profile.bends.map(t => ({
      startT: Math.max(0, t - 0.025), endT: Math.min(1, t + 0.03),
      side: 'both', surface: profile.runoff, widthMultiplier: profile.width,
    })),
    kerbs: profile.bends.map(t => ({
      startT: Math.max(0, t - 0.012), endT: Math.min(1, t + 0.015),
      side: 'both', style: street ? 'flat' : 'standard',
    })),
    barriers: profile.barriers.map(([startT, endT]) => ({
      startT, endT, side: 'both',
      type: profile.type === 'permanent' ? 'armco' : 'concrete',
      color: street ? '#92969d' : '#747e87',
    })),
  };
}

export const calendarScenarios: Record<string, CircuitScenario> = Object.fromEntries(
  Object.entries(profiles).map(([id, profile]) => [id, buildProfile(profile)]),
);
