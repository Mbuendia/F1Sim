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
    bends: [0.1674, 0.3474, 0.4374, 0.5074, 0.7274, 0.8974], barriers: [[0.1374, 0.2074], [0.7074, 0.7674], [0.8774, 0.9574]] },
  silverstone: { type: 'permanent', ground: '#233b28', runoff: 'grass', width: 1.7,
    bends: [0.0299, 0.0899, 0.3099, 0.3999, 0.5399, 0.6399, 0.6899, 0.8399, 0.9399], barriers: [[0.0099, 0.1299], [0.2799, 0.3499], [0.9099, 0.9699]] },
  spa: { type: 'permanent', ground: '#152c21', runoff: 'gravel', width: 1.8,
    bends: [0, 0.14, 0.21, 0.39, 0.45, 0.52, 0.6, 0.72, 0.85], barriers: [[0.18, 0.25], [0.57, 0.65], [0.82, 0.89]] },
  spielberg: { type: 'permanent', ground: '#29412a', runoff: 'gravel', width: 1.5,
    bends: [0.0216, 0.2186, 0.3276, 0.4256, 0.5606, 0.6496, 0.7996], barriers: [[0, 0.0716], [0.1886, 0.2686], [0.5336, 0.6796], [0.9926, 1]] },
  interlagos: { type: 'permanent', ground: '#283b23', runoff: 'asphalt', width: 1.3,
    bends: [0.1349, 0.2349, 0.3349, 0.4149, 0.5149, 0.6049, 0.8649, 0.9249], barriers: [[0.2949, 0.4549], [0.5749, 0.6549], [0.8349, 0.9649]] },
  suzuka: { type: 'permanent', ground: '#213823', runoff: 'gravel', width: 1.5,
    bends: [0.0954, 0.1754, 0.2454, 0.3254, 0.4054, 0.5054, 0.6654, 0.8254, 0.9354], barriers: [[0.3754, 0.4454], [0.6354, 0.7054], [0.7954, 0.8654]] },
  zandvoort: { type: 'permanent', ground: '#685e40', runoff: 'gravel', width: 1.2,
    bends: [0.0246, 0.1546, 0.2646, 0.3946, 0.4946, 0.5946, 0.7246, 0.8046, 0.8746], barriers: [[0, 0.0646], [0.5546, 0.6346], [0.6946, 0.7646], [0.9846, 1]] },
  'las-vegas': { type: 'street', ground: '#262330', runoff: 'wall', width: 0.7,
    bends: [0.0044, 0.0714, 0.2594, 0.3474, 0.4674, 0.7844, 0.8544], barriers: [[0, 0.4474], [0.4474, 0.9444], [0.9444, 1]] },
  bahrain: { type: 'permanent', ground: '#6a5b40', runoff: 'asphalt', width: 2,
    bends: [0.0925, 0.1785, 0.2685, 0.3525, 0.4815, 0.5935, 0.7115, 0.8425, 0.9335], barriers: [[0.0625, 0.1295], [0.3255, 0.4055], [0.8125, 0.8825]] },
  baku: { type: 'street', ground: '#33353c', runoff: 'wall', width: 0.6,
    bends: [0.0803, 0.1993, 0.2873, 0.3753, 0.4573, 0.5393, 0.6383, 0.9993], barriers: [[0, 0.3433], [0.3433, 0.7033], [0.7033, 0.9403], [0.9403, 1]] },
  melbourne: { type: 'hybrid', ground: '#284338', runoff: 'grass', width: 1.1,
    bends: [0.1469, 0.2469, 0.3869, 0.4869, 0.6169, 0.7069, 0.8469, 0.9469], barriers: [[0.1269, 0.2969], [0.3669, 0.5569], [0.5569, 0.7469], [0.8269, 0.9869]] },
  miami: { type: 'hybrid', ground: '#235354', runoff: 'asphalt', width: 1.3,
    bends: [0.0056, 0.0856, 0.2506, 0.3486, 0.4386, 0.6356, 0.7166, 0.8366, 0.9166], barriers: [[0, 0.1176], [0.2296, 0.4896], [0.6096, 0.7736], [0.7736, 1]] },
  shanghai: { type: 'permanent', ground: '#324135', runoff: 'asphalt', width: 1.8,
    bends: [0.0296, 0.1176, 0.2186, 0.3156, 0.4186, 0.5416, 0.7896, 0.8586, 0.9616], barriers: [[0, 0.0696], [0.1886, 0.2576], [0.7496, 0.8296], [0.9286, 1]] },
  jeddah: { type: 'street', ground: '#3a424c', runoff: 'wall', width: 0.8,
    bends: [0.0517, 0.1517, 0.2417, 0.3417, 0.4417, 0.6217, 0.7117, 0.8817], barriers: [[0, 0.4717], [0.4717, 0.9917], [0.9917, 1]] },
  'marina-bay': { type: 'street', ground: '#242934', runoff: 'wall', width: 0.7,
    bends: [0.0579, 0.1379, 0.3579, 0.4479, 0.5279, 0.6279, 0.6879, 0.8379, 0.9279], barriers: [[0, 0.3479], [0.3479, 0.6979], [0.6979, 0.9979], [0.9979, 1]] },
  lusail: { type: 'permanent', ground: '#736444', runoff: 'gravel', width: 1.7,
    bends: [0.1461, 0.2261, 0.3261, 0.4261, 0.5361, 0.6461, 0.7561, 0.8561, 0.9961], barriers: [[0, 0.0461], [0.1161, 0.2661], [0.6161, 0.7961], [0.9561, 1]] },
  'yas-marina': { type: 'permanent', ground: '#47514a', runoff: 'asphalt', width: 1.8,
    bends: [0.0899, 0.1799, 0.2799, 0.3699, 0.4899, 0.5999, 0.6999, 0.8899], barriers: [[0.1499, 0.4099], [0.6699, 0.7399], [0.8599, 0.9399]] },
  hungaroring: { type: 'permanent', ground: '#33452b', runoff: 'asphalt', width: 1.4,
    bends: [0.039, 0.159, 0.279, 0.419, 0.549, 0.649, 0.739, 0.829, 0.929], barriers: [[0.129, 0.329], [0.389, 0.459], [0.709, 0.779]] },
  'mexico-city': { type: 'permanent', ground: '#354138', runoff: 'asphalt', width: 1.3,
    bends: [0.1943, 0.2663, 0.3693, 0.4623, 0.5523, 0.6593, 0.8403, 0.9083, 0.9663], barriers: [[0, 0.0083], [0.1633, 0.3063], [0.3383, 0.4963], [0.8093, 1]] },
  montreal: { type: 'hybrid', ground: '#274133', runoff: 'asphalt', width: 0.9,
    bends: [0.0304, 0.1404, 0.2704, 0.4004, 0.6504, 0.8204, 0.9004], barriers: [[0.0004, 0.1804], [0.2404, 0.4604], [0.6204, 0.7604], [0.7604, 0.9504]] },
  austin: { type: 'permanent', ground: '#4c4c31', runoff: 'asphalt', width: 2,
    bends: [0.0407, 0.1247, 0.2257, 0.3587, 0.4867, 0.5767, 0.6557, 0.7537, 0.8397], barriers: [[0.0127, 0.0807], [0.3257, 0.3957], [0.4557, 0.5267], [0.8057, 0.8837]] },
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
