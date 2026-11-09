/**
 * [CR5/CR6] Datos de OpenStreetMap del escenario (© OpenStreetMap contributors, ODbL), ya en coordenadas del juego:
 * src/data/osmScenery/<id>.json, que genera scripts/osm-scenery.mjs a partir de las fichas de CR1.
 */
import type { Poly } from './trackSpace';

type Raw = [number, number][];
export interface OsmWater { osm: string; points: Poly; holes?: Poly[] }
/** Bosque, parque o arbolado (area) o hilera y árbol suelto (sin area). */
export interface OsmWood { osm: string; area: boolean; points: Poly; holes?: Poly[] }
/** Edificio con su huella y su altura (de OpenStreetMap o según su tipo). */
export interface OsmBuilding { osm: string; points: Poly; height: number; type?: string; name?: string }
/** Puente o paso bajo la pista: su línea y su tipo (pasarela, carretera, monorrail, tren). */
export interface OsmLine { osm: string; points: Poly; type: string; name?: string; layer?: number; way?: string; tunnel?: string }
interface RawScenery {
  id: string;
  water: { osm: string; points: Raw; holes?: Raw[] }[];
  woods?: { osm: string; area: boolean; points: Raw; holes?: Raw[] }[];
  buildings?: { osm: string; points: Raw; height: number; type?: string; name?: string }[];
  bridges?: (Omit<OsmLine, 'points'> & { points: Raw })[];
  tunnels?: (Omit<OsmLine, 'points'> & { points: Raw })[];
  landmarks?: OsmLandmark[];
}
/** [CR6] Icono del circuito en su sitio real: centro, giro del lado largo y planta de su huella de OpenStreetMap. */
export interface OsmLandmark {
  icon: string; osm: string[]; x: number; y: number; heading: number; length: number; width: number;
  /** [CR6, tanda 3] Gradas: tramos que siguen la planta de OpenStreetMap (curvas incluidas). */
  segments?: { x: number; y: number; heading: number; length: number; width: number }[];
}

const RAW = import.meta.glob<RawScenery>('../data/osmScenery/*.json', { eager: true, import: 'default' });
const byId = new Map<string, RawScenery>();
for (const data of Object.values(RAW)) byId.set(data.id, data);

const toPoly = (pts: Raw): Poly => pts.map(([x, y]) => ({ x, y }));

/** Agua real del circuito (lagos, ríos y el mar), con sus islas como huecos. */
export function osmWater(circuitId: string): OsmWater[] {
  return (byId.get(circuitId)?.water ?? []).map(w => ({ osm: w.osm, points: toPoly(w.points), ...(w.holes ? { holes: w.holes.map(toPoly) } : {}) }));
}

/** Arbolado real cerca de la pista. */
export function osmWoods(circuitId: string): OsmWood[] {
  return (byId.get(circuitId)?.woods ?? []).map(w => ({ osm: w.osm, area: w.area, points: toPoly(w.points), ...(w.holes ? { holes: w.holes.map(toPoly) } : {}) }));
}

/** Edificios reales a 150 m de la pista o menos. */
export function osmBuildings(circuitId: string): OsmBuilding[] {
  return (byId.get(circuitId)?.buildings ?? []).map(b => ({ ...b, points: toPoly(b.points) }));
}

/** Puentes de OpenStreetMap que cruzan la pista. */
export function osmBridges(circuitId: string): OsmLine[] {
  return (byId.get(circuitId)?.bridges ?? []).map(b => ({ ...b, points: toPoly(b.points) }));
}

/** Pasos bajo la pista (túneles de OpenStreetMap que la cruzan). */
export function osmTunnels(circuitId: string): OsmLine[] {
  return (byId.get(circuitId)?.tunnels ?? []).map(b => ({ ...b, points: toPoly(b.points) }));
}

/** [CR6] Sitio real de un icono del circuito (si OpenStreetMap tiene su huella). */
export function osmLandmark(circuitId: string, icon: string): OsmLandmark | undefined {
  return byId.get(circuitId)?.landmarks?.find(l => l.icon === icon);
}

const inPoly = (q: { x: number; y: number }, poly: Poly) => {
  let c = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const A = poly[a], B = poly[b];
    if ((A.y > q.y) !== (B.y > q.y) && q.x < (B.x - A.x) * (q.y - A.y) / (B.y - A.y) + A.x) c = !c;
  }
  return c;
};

/**
 * Sitios para árboles: una rejilla de `spacing` metros dentro de cada bosque (sin sus claros) y los puntos de las
 * hileras y los árboles sueltos (las hileras, cada `spacing` metros). Se mueven un poco, siempre igual (sin azar).
 */
export function woodSpots(circuitId: string, spacing: number): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  const jitter = (i: number, j: number) => { const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return (h - Math.floor(h) - 0.5) * spacing * 0.5; };
  for (const w of osmWoods(circuitId)) {
    if (w.area) {
      const xs = w.points.map(p => p.x), ys = w.points.map(p => p.y);
      for (let x = Math.min(...xs) + spacing / 2; x < Math.max(...xs); x += spacing) for (let y = Math.min(...ys) + spacing / 2; y < Math.max(...ys); y += spacing) {
        const q = { x: x + jitter(x, y), y: y + jitter(y, x) };
        if (inPoly(q, w.points) && !(w.holes ?? []).some(h => inPoly(q, h))) spots.push(q);
      }
    } else {
      // Hileras: un árbol en cada punto que OpenStreetMap marca (y, en los tramos largos, a 12 m de cada extremo).
      for (let k = 0; k < w.points.length; k++) {
        const a = w.points[k], b = w.points[k + 1];
        spots.push(a);
        const L = b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
        if (L > 36) for (const s of [12, L - 12]) spots.push({ x: a.x + (b.x - a.x) * s / L, y: a.y + (b.y - a.y) * s / L });
      }
    }
  }
  return spots;
}

/**
 * Estilo de las fachadas de cada ciudad (color, tejado y ventanas). Los circuitos permanentes de las tandas 4 y 5, fuera
 * de la ciudad, llevan el estilo 'circuito' (naves, oficinas y hospitalidad), no el de las casas de su país.
 */
export const BUILDING_STYLE: Record<string, string> = {
  montreal: 'norteamericano', miami: 'tropical', austin: 'circuito', 'las-vegas': 'desierto-americano', 'mexico-city': 'latino',
  interlagos: 'latino', melbourne: 'australiano', 'marina-bay': 'asiatico', suzuka: 'japones', shanghai: 'asiatico',
  bahrain: 'circuito', jeddah: 'arabe', 'yas-marina': 'arabe', lusail: 'circuito', baku: 'caucasico',
  silverstone: 'circuito', spa: 'circuito', zandvoort: 'neerlandes', monza: 'circuito', barcelona: 'circuito',
  spielberg: 'circuito', hungaroring: 'circuito',
};
