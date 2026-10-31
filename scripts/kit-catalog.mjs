#!/usr/bin/env node
// [CK2] Escribe src/scene3d/circuitKit.ts con las medidas y los triángulos leídos de los .glb de public/models/kit, para
// que el catálogo nunca se desfase del modelo. Uso: node scripts/kit-catalog.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parseGlb } from './compress-models.mjs';

const COMMON = ['guardarrail', 'muro_neumaticos', 'valla_alta', 'valla_publi', 'bloque_hormigon', 'poste_luz', 'farola', 'pancarta',
  'cartel_pequeno', 'marcador', 'torre_posiciones', 'grada_comun', 'grada_roja', 'grada_pequena', 'cartel_metros', 'grua',
  'arbol_a', 'arbol_b', 'arbol_c', 'coche_medico', 'coche_aparcado', 'camion', 'refugio_comisarios'];
const SHANGHAI = ['edificio_boxes', 'edificio_b', 'pabellon', 'carpa', 'marquesina', 'techo_tribuna', 'estructura_b', 'estructura_c'];
const TILE = new Set(['guardarrail', 'muro_neumaticos', 'valla_alta', 'valla_publi', 'bloque_hormigon']);
/** Hacia dónde mira la cara útil (eje de glTF): las gradas, sus asientos; carteles y torre, su cara legible. */
const FRONT = { grada_comun: '-z', grada_roja: '-z', grada_pequena: '-z', valla_publi: '+z', cartel_pequeno: '+z', cartel_metros: '+z', torre_posiciones: '+z' };
const NOTES = {
  guardarrail: 'Guardarraíl de tres bandas; interiores de curva y rectas.',
  muro_neumaticos: 'Muro de neumáticos de dos filas; al final de las escapatorias de curva.',
  valla_alta: 'Panel de valla alta de malla; detrás de los muros donde hay público, y encima del hormigón en urbanos.',
  valla_publi: 'Valla publicitaria; el patrocinador lo pinta CK3 (de sponsors.ts).',
  bloque_hormigon: 'Bloque de hormigón; muros de urbanos y zonas de servicio.',
  poste_luz: 'Poste de luz.',
  farola: 'Farola de 11 m; paddock y viales.',
  pancarta: 'Pancarta pintada en el suelo de la escapatoria.',
  cartel_pequeno: 'Cartel pequeño de patrocinador.',
  marcador: 'Marcador de tiempos.',
  torre_posiciones: 'Torre de posiciones; el cartel de arriba lleva el nombre del circuito (CK3).',
  grada_comun: 'Grada de celosía (la blanca); en el vértice de las curvas.',
  grada_roja: 'Módulo de grada roja; se encadena por las rectas y el arco de las curvas.',
  grada_pequena: 'Grada pequeña; huecos dentro de las curvas cerradas.',
  cartel_metros: 'Cartel de metros (200, 150, 100 y 50) antes de las curvas; el número y el patrocinador los pinta CK3.',
  grua: 'Grúa móvil; detrás de los muros de neumáticos de las curvas de frenada.',
  arbol_a: 'Árbol (planos cruzados).', arbol_b: 'Árbol (planos cruzados).', arbol_c: 'Árbol (planos cruzados).',
  coche_medico: 'Furgoneta del equipo de seguridad.', coche_aparcado: 'Furgoneta aparcada.', camion: 'Camión del paddock.',
  refugio_comisarios: 'Puesto de comisarios.',
  edificio_boxes: 'Módulo del edificio de boxes de Shanghái (87 m).', edificio_b: 'Garajes de Shanghái.', pabellon: 'Pabellón de equipo de Shanghái.',
  carpa: 'Carpa del paddock de Shanghái.', marquesina: 'Marquesina de Shanghái.', techo_tribuna: 'Techo de la tribuna principal de Shanghái.',
  estructura_b: 'Pórtico de Shanghái.', estructura_c: 'Escaleras con barandillas de Shanghái.',
};

const r2 = v => Math.round(v * 100) / 100;
const entries = [];
for (const [scope, ids] of [['comun', COMMON], ['shanghai', SHANGHAI]]) for (const id of ids) {
  const { json } = parseGlb(readFileSync(`public/models/kit/${id}.glb`));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; let tris = 0;
  for (const m of json.meshes) for (const p of m.primitives) {
    const a = json.accessors[p.attributes.POSITION];
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.min[k]); hi[k] = Math.max(hi[k], a.max[k]); }
    tris += (p.indices !== undefined ? json.accessors[p.indices].count : a.count) / 3;
  }
  const dims = [r2(hi[0] - lo[0]), r2(hi[2] - lo[2]), r2(hi[1] - lo[1])];
  const alpha = json.materials.some(m => m.alphaMode === 'MASK') ? 'mask' : 'opaque';
  const e = { id, file: `models/kit/${id}.glb`, scope, dims, tris, alpha };
  if (TILE.has(id)) e.tile = dims[0];
  if (FRONT[id]) e.front = FRONT[id];
  e.note = NOTES[id];
  entries.push(e);
}
const fmt = e => `  { ${Object.entries(e).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')} },`;
const src = `/**
 * [CK2] Kit común de piezas de circuito (Sprint 10): sacadas del modelo de Shanghái del usuario (crédito en
 * public/models/ATTRIBUTION.md), limpias, sin marcas reales y con dos atlas compartidos (kit-comun.webp y
 * kit-shanghai.webp). Generado por scripts/kit-catalog.mjs a partir de los .glb: no se edita a mano.
 * Medidas en metros: [largo (X), ancho (Z), alto (Y)]; origen en el centro de la base. \`tile\`: largo de las piezas que se
 * encadenan. \`front\`: eje de glTF hacia el que mira la cara útil. Las de ámbito «shanghai» son solo para ese circuito (CK4).
 */
export type KitScope = 'comun' | 'shanghai';
export interface KitPiece {
  id: string;
  file: string;
  scope: KitScope;
  dims: [number, number, number];
  tris: number;
  alpha: 'mask' | 'opaque';
  tile?: number;
  front?: '+z' | '-z';
  note: string;
}

export const CIRCUIT_KIT: KitPiece[] = [
${entries.map(fmt).join('\n')}
];

/**
 * Reglas de colocación (CK3) sacadas del análisis del modelo de Shanghái (docs/design/analisis-shanghai-circuito.md) y de
 * la maqueta en Blender que el usuario aprobó el 30/10/2026. Distancias en metros desde el borde del asfalto.
 */
export const KIT_RULES = {
  /** Frenada según la velocidad en el vértice (km/h): por debajo de cada umbral. */
  braking: { fuerte: 120, media: 200, rapida: 270 },
  /** Escapatoria por fuera de la curva: primero asfalto y luego grava (anchos [mínimo, máximo]). */
  runoff: { fuerte: { asfalto: [20, 50], grava: [15, 60] }, media: { asfalto: [5, 10], grava: [10, 15] }, rapida: { asfalto: [0, 0], grava: [12, 15] } },
  barriers: { endOfRunoff: 'muro_neumaticos', behindWithPublic: 'valla_alta', insideAndStraights: 'guardarrail', insideDistanceM: 10, advertisingM: [1, 9] },
  grandstands: { distanceM: [22, 100], apex: 'grada_comun', arc: 'grada_roja', arcStepM: 38, boxedIn: 'grada_pequena', boxedInM: 70 },
  positionTower: { piece: 'torre_posiciones', where: 'meta', facing: 'llegada', perCircuit: 1 },
  cranes: { piece: 'grua', behind: 'muro_neumaticos' },
  lamps: { piece: 'farola', distanceM: [17, 68] },
  distanceBoards: { piece: 'cartel_metros', metres: [200, 150, 100, 50] },
  /** Nada toca el asfalto salvo los coches y el Safety Car (puentes y túneles aparte). */
  trackClearanceM: 0.3,
} as const;
`;
writeFileSync('src/scene3d/circuitKit.ts', src.replace(/\n/g, '\r\n'));
console.log(entries.length, 'piezas;', entries.reduce((s, e) => s + e.tris, 0), 'triángulos');
