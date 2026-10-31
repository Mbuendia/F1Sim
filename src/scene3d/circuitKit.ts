/**
 * [CK2] Kit común de piezas de circuito (Sprint 10): sacadas del modelo de Shanghái del usuario (crédito en
 * public/models/ATTRIBUTION.md), limpias, sin marcas reales y con dos atlas compartidos (kit-comun.webp y
 * kit-shanghai.webp). Generado por scripts/kit-catalog.mjs a partir de los .glb: no se edita a mano.
 * Medidas en metros: [largo (X), ancho (Z), alto (Y)]; origen en el centro de la base. `tile`: largo de las piezas que se
 * encadenan. `front`: eje de glTF hacia el que mira la cara útil. Las de ámbito «shanghai» son solo para ese circuito (CK4).
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
  { id: "guardarrail", file: "models/kit/guardarrail.glb", scope: "comun", dims: [8,0.25,1.14], tris: 68, alpha: "opaque", tile: 8, note: "Guardarraíl de tres bandas; interiores de curva y rectas." },
  { id: "muro_neumaticos", file: "models/kit/muro_neumaticos.glb", scope: "comun", dims: [11.58,1.12,1.15], tris: 1220, alpha: "opaque", tile: 11.58, note: "Muro de neumáticos de dos filas; al final de las escapatorias de curva." },
  { id: "valla_alta", file: "models/kit/valla_alta.glb", scope: "comun", dims: [7.22,0.71,6.09], tris: 4, alpha: "mask", tile: 7.22, note: "Panel de valla alta de malla; detrás de los muros donde hay público, y encima del hormigón en urbanos." },
  { id: "valla_publi", file: "models/kit/valla_publi.glb", scope: "comun", dims: [10,0.31,2.53], tris: 4, alpha: "opaque", tile: 10, front: "+z", note: "Valla publicitaria; el patrocinador lo pinta CK3 (de sponsors.ts)." },
  { id: "bloque_hormigon", file: "models/kit/bloque_hormigon.glb", scope: "comun", dims: [2.02,0.53,0.98], tris: 94, alpha: "opaque", tile: 2.02, note: "Bloque de hormigón; muros de urbanos y zonas de servicio." },
  { id: "poste_luz", file: "models/kit/poste_luz.glb", scope: "comun", dims: [0.84,0.14,6.13], tris: 58, alpha: "opaque", note: "Poste de luz." },
  { id: "farola", file: "models/kit/farola.glb", scope: "comun", dims: [1.51,1.56,11], tris: 352, alpha: "opaque", note: "Farola de 11 m; paddock y viales." },
  { id: "pancarta", file: "models/kit/pancarta.glb", scope: "comun", dims: [25.81,5.11,0.19], tris: 20, alpha: "opaque", note: "Pancarta pintada en el suelo de la escapatoria." },
  { id: "cartel_pequeno", file: "models/kit/cartel_pequeno.glb", scope: "comun", dims: [1.2,0.08,0.67], tris: 12, alpha: "opaque", front: "+z", note: "Cartel pequeño de patrocinador." },
  { id: "marcador", file: "models/kit/marcador.glb", scope: "comun", dims: [9.06,0.77,0.84], tris: 348, alpha: "opaque", note: "Marcador de tiempos." },
  { id: "torre_posiciones", file: "models/kit/torre_posiciones.glb", scope: "comun", dims: [12.21,11.06,23.49], tris: 1377, alpha: "opaque", front: "+z", note: "Torre de posiciones; el cartel de arriba lleva el nombre del circuito (CK3)." },
  { id: "grada_comun", file: "models/kit/grada_comun.glb", scope: "comun", dims: [42.14,30.21,18.72], tris: 682, alpha: "opaque", front: "-z", note: "Grada de celosía (la blanca); en el vértice de las curvas." },
  { id: "grada_roja", file: "models/kit/grada_roja.glb", scope: "comun", dims: [38.94,21.91,15.99], tris: 383, alpha: "opaque", front: "-z", note: "Módulo de grada roja; se encadena por las rectas y el arco de las curvas." },
  { id: "grada_pequena", file: "models/kit/grada_pequena.glb", scope: "comun", dims: [18,8.5,6.2], tris: 88, alpha: "opaque", front: "-z", note: "Grada pequeña; huecos dentro de las curvas cerradas." },
  { id: "cartel_metros", file: "models/kit/cartel_metros.glb", scope: "comun", dims: [1,0.1,2.15], tris: 36, alpha: "opaque", front: "+z", note: "Cartel de metros (200, 150, 100 y 50) antes de las curvas; el número y el patrocinador los pinta CK3." },
  { id: "grua", file: "models/kit/grua.glb", scope: "comun", dims: [14.03,11.21,33.5], tris: 943, alpha: "opaque", note: "Grúa móvil; detrás de los muros de neumáticos de las curvas de frenada." },
  { id: "arbol_a", file: "models/kit/arbol_a.glb", scope: "comun", dims: [12.71,12.07,15.3], tris: 9, alpha: "mask", note: "Árbol (planos cruzados)." },
  { id: "arbol_b", file: "models/kit/arbol_b.glb", scope: "comun", dims: [14.37,16.24,20.94], tris: 9, alpha: "mask", note: "Árbol (planos cruzados)." },
  { id: "arbol_c", file: "models/kit/arbol_c.glb", scope: "comun", dims: [12.83,11.72,15.3], tris: 9, alpha: "mask", note: "Árbol (planos cruzados)." },
  { id: "coche_medico", file: "models/kit/coche_medico.glb", scope: "comun", dims: [4.96,2.09,1.89], tris: 670, alpha: "opaque", note: "Furgoneta del equipo de seguridad." },
  { id: "coche_aparcado", file: "models/kit/coche_aparcado.glb", scope: "comun", dims: [5.52,2.39,2.11], tris: 167, alpha: "opaque", note: "Furgoneta aparcada." },
  { id: "camion", file: "models/kit/camion.glb", scope: "comun", dims: [13.63,2.6,3.07], tris: 216, alpha: "opaque", note: "Camión del paddock." },
  { id: "refugio_comisarios", file: "models/kit/refugio_comisarios.glb", scope: "comun", dims: [8.07,2.51,1.24], tris: 50, alpha: "opaque", note: "Puesto de comisarios." },
  { id: "edificio_boxes", file: "models/kit/edificio_boxes.glb", scope: "shanghai", dims: [86.86,24.64,11.7], tris: 1298, alpha: "opaque", note: "Módulo del edificio de boxes de Shanghái (87 m)." },
  { id: "edificio_b", file: "models/kit/edificio_b.glb", scope: "shanghai", dims: [42.85,16.08,6.07], tris: 190, alpha: "opaque", note: "Garajes de Shanghái." },
  { id: "pabellon", file: "models/kit/pabellon.glb", scope: "shanghai", dims: [42.14,40.19,8.49], tris: 924, alpha: "opaque", note: "Pabellón de equipo de Shanghái." },
  { id: "carpa", file: "models/kit/carpa.glb", scope: "shanghai", dims: [24.01,23.17,7.03], tris: 248, alpha: "opaque", note: "Carpa del paddock de Shanghái." },
  { id: "marquesina", file: "models/kit/marquesina.glb", scope: "shanghai", dims: [71.05,20.32,15.36], tris: 958, alpha: "opaque", note: "Marquesina de Shanghái." },
  { id: "techo_tribuna", file: "models/kit/techo_tribuna.glb", scope: "shanghai", dims: [35.18,30.28,5.01], tris: 416, alpha: "opaque", note: "Techo de la tribuna principal de Shanghái." },
  { id: "estructura_b", file: "models/kit/estructura_b.glb", scope: "shanghai", dims: [37.54,21.77,13.16], tris: 106, alpha: "opaque", note: "Pórtico de Shanghái." },
  { id: "estructura_c", file: "models/kit/estructura_c.glb", scope: "shanghai", dims: [10.82,8.53,12.25], tris: 40, alpha: "mask", note: "Escaleras con barandillas de Shanghái." },
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
