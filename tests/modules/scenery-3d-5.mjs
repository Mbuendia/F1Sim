// Vista 3D, quinta tanda (PROPUESTA DE CONTRATO, 23/10/2026).
// Petición del usuario: revisar la escapatoria de Spa con la cámara (no se veía) y detallar los circuitos que faltan.
// Hallazgo: las zonas de escapatoria del escenario son aproximadas y no caen en todas las curvas reales (Spielberg, 4 de
// 10; Spa, 13 de 19; La Source, sin escapatoria). Iconos de la lista aprobada «para después»; en Abu Dabi, escapatorias
// turquesa con franjas de azul oscuro (foto aérea nocturna del usuario). Lo que se puede probar sin pantalla:
//  1. Escapatorias: en los circuitos permanentes y mixtos, cada curva real tiene su zona de escapatoria (por fuera).
//  2. Iconos de cada circuito, fuera del asfalto (los puentes, por encima) y con su modelo:
//     Suzuka, la noria · Monza, el peralte antiguo y el podio sobre la recta · Silverstone, el edificio The Wing ·
//     Spa, la tribuna de Eau Rouge y el bosque · Interlagos, los rascacielos de São Paulo y el lago · Zandvoort, el mar y
//     las dunas · Las Vegas, la Esfera, la torre Eiffel y los hoteles · Baréin, la torre de Sakhir · Bakú, la Torre de
//     la Doncella, las Flame Towers, las murallas y el mar Caspio · Melbourne, el lago de Albert Park y los rascacielos ·
//     Miami, el estadio y el puerto falso con barcos · Yeda, el mar Rojo y la fuente del rey Fahd · Singapur, el Marina
//     Bay Sands, la noria y la bahía · Lusail, las dunas · Hungaroring, el bosque · México, el Foro Sol · Montreal, la
//     Biosfera y el canal de remo · Austin, la torre de observación · Barcelona, la torre de control.
//  Cómo se ven (que se reconozcan) se comprueba en el navegador con capturas.
import { existsSync } from 'node:fs';

const ICONS = {
  suzuka: ['noria'], monza: ['peralte', 'podio-monza'], silverstone: ['the-wing'], spa: ['tribuna-eau-rouge'],
  interlagos: ['rascacielos-sp'], zandvoort: [], 'las-vegas': ['esfera', 'torre-eiffel'], bahrain: ['torre-sakhir'],
  baku: ['torre-doncella', 'flame-towers'], melbourne: [], miami: ['estadio-miami'], jeddah: ['fuente-fahd'],
  'marina-bay': ['marina-bay-sands', 'noria-singapur'], lusail: [], hungaroring: [], 'mexico-city': [],
  montreal: ['biosfera'], austin: ['torre-cota'], barcelona: ['torre-control'],
};
/** Circuitos con agua (mar, lago, canal o puerto). */
const WATER = ['interlagos', 'zandvoort', 'baku', 'melbourne', 'miami', 'jeddah', 'marina-bay', 'montreal'];
/** Mínimos de objetos de un tipo por circuito. */
const MINIMUM = {
  'las-vegas': { kind: 'building', min: 6, height: 80 }, interlagos: { kind: 'building', min: 6, height: 60 },
  melbourne: { kind: 'building', min: 6, height: 60 }, zandvoort: { kind: 'dune', min: 6 }, lusail: { kind: 'dune', min: 6 },
  baku: { kind: 'wall', min: 3 }, spa: { kind: 'tree', min: 120 }, hungaroring: { kind: 'tree', min: 120 }, miami: { kind: 'yacht', min: 6 },
};

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { sceneryFor, runoffZones3d } = await load('/src/scene3d/scenery.ts');
  const { getScenario } = await load('/src/data/scenarioRegistry.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const tracks = Object.fromEntries(ids.map(id => [id, new RaceSimulation(id).activeTrack]));
  const scenes = Object.fromEntries(ids.map(id => [id, sceneryFor(tracks[id], id)]));
  const axisDistance = (track, p) => {
    let best = Infinity;
    for (let i = 0; i < track.points.length; i += 2) best = Math.min(best, Math.hypot(track.points[i].x - p.x, track.points[i].y - p.y));
    return best;
  };

  await test('Escapatorias en cada curva real', () => {
    const missing = [];
    for (const id of ids) {
      if (getScenario(id).trackType === 'street') continue;
      const zones = runoffZones3d(tracks[id], id);
      const inZone = t => zones.some(z => (z.startT <= z.endT ? t >= z.startT && t <= z.endT : t >= z.startT || t <= z.endT));
      const bare = tracks[id].corners.filter(c => !inZone(c.t));
      if (bare.length) missing.push(`${id}: ${bare.map(c => `T${c.number}`).join(' ')}`);
    }
    assert(missing.length === 0, 'Escapatorias: en los permanentes y mixtos, todas las curvas con su escapatoria', missing.slice(0, 10).join(' | '));
  });

  await test('Iconos de los circuitos que faltaban', async () => {
    const absent = [], onTrack = [];
    for (const [id, icons] of Object.entries(ICONS)) {
      const half = (tracks[id].trackWidthMeters || 12) / 2;
      for (const icon of icons) {
        const item = scenes[id].items.find(it => it.id === icon);
        if (!item) { absent.push(`${id}: ${icon}`); continue; }
        if (item.kind !== 'bridge' && axisDistance(tracks[id], item) < half + 3) onTrack.push(`${id}: ${icon}`);
      }
    }
    // [CK3, autorizado por el usuario el 30/10/2026] el Foro Sol de México lo hace ahora el kit: el estadio de su sección.
    const { kitPlacementFor } = await load('/src/scene3d/kitPlacement.ts');
    if (!kitPlacementFor(tracks['mexico-city'], 'mexico-city').stadium?.sections?.length) absent.push('mexico-city: estadio del Foro Sol');
    assert(absent.length === 0, 'Iconos: cada circuito con los suyos', absent.join(', '));
    assert(onTrack.length === 0, 'Iconos: ninguno encima de la pista (salvo los puentes)', onTrack.join(', '));
    const dry = WATER.filter(id => scenes[id].water.length === 0);
    assert(dry.length === 0, 'Iconos: mar, lago, canal o puerto donde lo hay', dry.join(', '));
    const short = Object.entries(MINIMUM).filter(([id, m]) => scenes[id].items.filter(it => it.kind === m.kind && (!m.height || it.height >= m.height)).length < m.min).map(([id, m]) => `${id}: ${m.kind}`);
    assert(short.length === 0, 'Iconos: rascacielos, dunas, murallas, bosque y barcos donde tocan', short.join(', '));
    const monza = scenes.monza.items.find(it => it.id === 'podio-monza'), start = tracks.monza.points[0];
    assert(monza && monza.kind === 'bridge' && Math.hypot(monza.x - start.x, monza.y - start.y) <= 300, 'Iconos: el podio de Monza vuela sobre la recta de meta');
    const fountain = scenes.jeddah.items.find(it => it.id === 'fuente-fahd');
    assert(fountain && fountain.height >= 100 && scenes.jeddah.water.some(poly => poly.length > 2), 'Iconos: la fuente de Yeda, un chorro de más de 100 m en el mar');
    const models = [...new Set(ids.flatMap(id => scenes[id].items.map(it => it.model)))].filter(m => !existsSync(`public/models/scenery/${m}.glb`));
    assert(models.length === 0, 'Iconos: cada uno con su modelo de Blender', models.join(', '));
  });
}
