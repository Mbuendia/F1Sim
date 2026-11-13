// CR12 — Edificios con su aspecto real (Sprint 10.5). Contrato acordado con el usuario el 13/11/2026, tras su revisión de
// CR10 («muchos siguen teniendo edificios que parecen viviendas»; el centro acuático de Melbourne, los edificios del
// canal olímpico de Montreal, la horquilla de Suzuka y las bocas de túnel de Eau Rouge):
//  1. Cada edificio de src/data/osmScenery/<id>.json tiene su uso (`use`; sin él, 'ciudad'): 'grada', 'cubierta', 'nave' o 'ciudad', sacado
//     de sus etiquetas de OpenStreetMap y de su tamaño (regla en scripts/osm-scenery.mjs y en docs/design/edificios-cr12.md).
//  2. Ninguna grada ni cubierta se dibuja como caja con ventanas: las gradas no están entre los edificios levantados y
//     el 60 % o más tienen su grada en el escenario; las cubiertas van sin paredes (`buildingLook`).
//  3. Ninguna nave lleva ventanas por planta ni tejado de teja (`buildingLook`): paredes de panel y cubierta de chapa.
//  4. Modelos propios hechos en Blender, en el repositorio y con su crédito: la boca de túnel nueva, el centro deportivo y
//     acuático de Melbourne y los edificios del canal olímpico de Montreal; referencias citadas en el documento.
//  5. Sin subir límites: lo vigilan `budget-pf8` y los tests de llamadas de dibujo, que siguen en verde sin tocarlos.
//  6. Trazado, pit lane y carrera no cambian: lo vigilan `landmarks-cr5` y `circuits-cr6`, en verde sin tocarlos.
//  7. Capturas de antes y después (docs/design/cr12-edificios/) de Melbourne, Montreal, Suzuka y Eau Rouge.
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const DIR = 'src/data/osmScenery', DOC = 'docs/design/edificios-cr12.md', SHOTS = 'docs/design/cr12-edificios';
const USES = new Set(['grada', 'cubierta', 'nave', 'ciudad']);
const TILE = new Set(['#8a4b3a', '#8d5a43', '#7a3e2e']);   // tejados de teja de los estilos de ciudad
const MODELS = ['boca-tunel', 'centro-acuatico-melbourne', 'canal-olimpico-montreal'];

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const ids = readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  // En los datos, un edificio sin `use` es de 'ciudad' (no se escribe, para no engordar la descarga).
  const data = Object.fromEntries(ids.map(id => { const d = JSON.parse(readFileSync(`${DIR}/${id}.json`, 'utf8')); return [id, { ...d, buildings: (d.buildings ?? []).map(b => ({ ...b, use: b.use ?? 'ciudad' })) }]; }));

  await test('CR12.1: cada edificio con su uso', () => {
    const bad = ids.filter(id => (data[id].buildings ?? []).some(b => !USES.has(b.use)));
    assert(ids.length === 22 && bad.length === 0, 'CR12: cada edificio lleva su uso (grada, cubierta, nave o ciudad)', bad.join(', ') || `${ids.length} circuitos`);
    const all = ids.flatMap(id => data[id].buildings ?? []), count = u => all.filter(b => b.use === u).length;
    assert(count('grada') >= 18 && count('cubierta') >= 40 && count('nave') >= 100, 'CR12: hay gradas, cubiertas y naves reconocidas', `gradas ${count('grada')}, cubiertas ${count('cubierta')}, naves ${count('nave')}, ciudad ${count('ciudad')}`);
    // El centro deportivo y acuático de Melbourne (way/154881920) lleva modelo propio: es un icono, no un edificio de la lista.
    const msac = (data.melbourne.buildings ?? []).find(b => b.osm === 'way/154881920'), icon = (data.melbourne.landmarks ?? []).find(l => l.osm.includes('way/154881920'));
    assert(icon?.icon === 'centro-acuatico' && !msac, 'CR12: el centro deportivo y acuático de Melbourne es un icono con modelo propio, no viviendas', JSON.stringify({ icono: icon?.icon, edificio: msac?.use }));
    const script = readFileSync('scripts/osm-scenery.mjs', 'utf8');
    assert(/useOf/.test(script) && existsSync(DOC) && /grada/.test(readFileSync(DOC, 'utf8')) && /nave/.test(readFileSync(DOC, 'utf8')), 'CR12: la regla está en el script y explicada en el documento');
  });

  await test('CR12.2 y 3: gradas, cubiertas y naves, sin fachada de viviendas', async () => {
    const { sceneryFor } = await load('/src/scene3d/scenery.ts');
    const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
    const rb = await load('/src/scene3d/realBuildings.ts');
    assert(typeof rb.buildingLook === 'function', 'CR12: realBuildings exporta buildingLook (cómo se pinta cada edificio)');
    if (typeof rb.buildingLook !== 'function') return;
    let stands = 0, drawn = 0; const boxed = [];
    for (const id of ids) {
      const scene = sceneryFor(new RaceSimulation(id).activeTrack, id), raised = scene.realBuildings ?? [];
      if (raised.some(b => b.use === 'grada')) boxed.push(id);
      const gradas = (data[id].buildings ?? []).filter(b => b.use === 'grada').map(b => b.osm);
      stands += gradas.length;
      drawn += gradas.filter(osm => scene.items.some(it => it.kind === 'grandstand' && it.osm === osm)).length;
    }
    assert(boxed.length === 0, 'CR12: ninguna grada se levanta como edificio', boxed.join(', ') || 'ok');
    assert(stands > 0 && drawn >= stands * 0.6, 'CR12: el 60 % o más de las gradas de OpenStreetMap tienen su grada en el escenario', `${drawn} de ${stands}`);
    const styles = ['australiano', 'latino', 'neerlandes', 'norteamericano', 'circuito'];
    const roof = styles.map(s => rb.buildingLook({ osm: 'way/1', use: 'cubierta', height: 6 }, s));
    assert(roof.every(l => l.walls === 'ninguna'), 'CR12: una cubierta va sin paredes', JSON.stringify(roof[0]));
    const hall = styles.map(s => rb.buildingLook({ osm: 'way/2', use: 'nave', height: 12 }, s));
    assert(hall.every(l => l.walls === 'panel' && !TILE.has(l.roof)), 'CR12: una nave lleva paredes de panel y cubierta de chapa, sin teja', JSON.stringify(hall[0]));
    const city = rb.buildingLook({ osm: 'way/3', use: 'ciudad', height: 9 }, 'australiano');
    assert(city.walls === 'ventanas', 'CR12: el resto sigue con la fachada de su ciudad', JSON.stringify(city));
  });

  await test('CR12.4: modelos propios y referencias', () => {
    const missing = MODELS.filter(m => !existsSync(`public/models/scenery/${m}.glb`));
    assert(missing.length === 0, 'CR12: los modelos nuevos están en public/models/scenery/', missing.join(', ') || 'ok');
    const attr = readFileSync('public/models/ATTRIBUTION.md', 'utf8');
    assert(MODELS.every(m => attr.includes(`scenery/${m}.glb`)), 'CR12: ATTRIBUTION.md los nombra como modelos propios');
    const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
    assert(/commons\.wikimedia\.org/.test(doc) && /openstreetmap\.org/i.test(doc) && !/google/i.test(doc), 'CR12: referencias de Wikimedia Commons y OpenStreetMap citadas; nada de Google');
  });

  await test('CR12.7: capturas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const need = ['melbourne', 'montreal', 'suzuka', 'spa'].filter(c => !(shots.some(f => f.startsWith(c) && /-antes\./.test(f)) && shots.some(f => f.startsWith(c) && /-despues\./.test(f))));
    assert(need.length === 0, `CR12: capturas de antes y después en ${SHOTS}/`, need.join(', ') || 'ok');
  });
}
