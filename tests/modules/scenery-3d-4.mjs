// Vista 3D, cuarta tanda (PROPUESTA DE CONTRATO, 23/10/2026).
// Petición del usuario: el edificio de boxes como una sola pieza continua; los focos de las carreras de noche con su
// luz (que se vea que alumbran); las escapatorias de cada circuito como en la realidad; corregir todo lo posible frente
// a las referencias investigadas. Referencias (23/10/2026): Zandvoort, sin asfalto en las escapatorias; COTA, arcén
// pintado en rojo y grava añadida; Spa, escapatorias de asfalto con grava en algunos puntos; propuesta de grava a la
// entrada y asfalto a la salida (Wurz); Yas Marina, escapatorias pintadas de azul (sin fuente encontrada: de memoria).
// Lo que se puede probar sin pantalla:
//  1. Boxes: una pieza continua a lo largo del pit lane (sin saltos), fuera de la pista y del carril.
//  2. Focos: cada torre de luz apunta a un punto de la pista cercano (su haz cae sobre el asfalto).
//  3. Escapatorias: el tipo de cada circuito según las referencias (grava, asfalto, mixta, pintada o ninguna); en las
//     mixtas, grava a la entrada de la curva y asfalto a la salida; en las pintadas, franjas de sus colores.
//  Cómo se ve (la luz de los focos, el edificio y las escapatorias) se comprueba en el navegador con capturas.

const EXPECTED_RUNOFF = {
  suzuka: 'grava', zandvoort: 'grava', monza: 'grava', lusail: 'grava', melbourne: 'grava',
  bahrain: 'asfalto', interlagos: 'asfalto', 'mexico-city': 'asfalto', miami: 'asfalto', shanghai: 'asfalto',
  barcelona: 'mixta', silverstone: 'mixta', spa: 'mixta', spielberg: 'mixta', hungaroring: 'mixta', montreal: 'mixta',
  'yas-marina': 'pintada', austin: 'pintada',
  monaco: 'ninguna', baku: 'ninguna', 'marina-bay': 'ninguna', jeddah: 'ninguna', 'las-vegas': 'ninguna',
};
const luminance = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255); };

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { lampAim } = await load('/src/scene3d/sunLight.ts');
  const { RUNOFF_LOOK, runoffSurfaceAt, RUNOFF_COLORS, PAINT_STRIPES } = await load('/src/scene3d/runoff.ts');
  const { NIGHT_RACES } = await load('/src/renderer/lighting.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const tracks = Object.fromEntries(ids.map(id => [id, new RaceSimulation(id).activeTrack]));
  const scenes = Object.fromEntries(ids.map(id => [id, sceneryFor(tracks[id], id)]));
  const nearest = (pts, p) => pts.reduce((best, q) => Math.min(best, Math.hypot(q.x - p.x, q.y - p.y)), Infinity);
  const axisDistance = (track, p) => nearest(track.points.filter((_, i) => i % 2 === 0), p);

  await test('Boxes: una pieza continua', () => {
    const bad = [];
    for (const id of ids) {
      const track = tracks[id], lane = getPitLaneGeometry(track).fastLane, half = (track.trackWidthMeters || 12) / 2;
      if (lane.length < 2) continue;
      const pb = scenes[id].pitBuilding;
      if (!pb || pb.points.length < 2) { bad.push(`${id}: sin edificio`); continue; }
      if (scenes[id].items.some(it => it.kind === 'pit-building')) bad.push(`${id}: aún en bloques sueltos`);
      let length = 0, worstGap = 0, laneLength = 0;
      for (let i = 1; i < pb.points.length; i++) { const g = Math.hypot(pb.points[i].x - pb.points[i - 1].x, pb.points[i].y - pb.points[i - 1].y); length += g; worstGap = Math.max(worstGap, g); }
      for (let i = 1; i < lane.length; i++) laneLength += Math.hypot(lane[i].x - lane[i - 1].x, lane[i].y - lane[i - 1].y);
      if (length < 0.5 * laneLength) bad.push(`${id}: ${Math.round(length)} de ${Math.round(laneLength)} m`);
      if (worstGap > 6) bad.push(`${id}: salto de ${worstGap.toFixed(1)} m`);
      const sample = pb.points.filter((_, i) => i % 3 === 0);
      if (sample.some(p => axisDistance(track, p) < half + 3 + pb.depth / 2)) bad.push(`${id}: pisa la pista`);
      if (sample.some(p => nearest(lane, p) < pb.depth / 2 + 6)) bad.push(`${id}: pisa el pit lane`);
      if (!(pb.depth >= 10 && pb.height >= 8)) bad.push(`${id}: medidas`);
    }
    assert(bad.length === 0, 'Boxes: un solo edificio continuo a lo largo del pit lane, fuera de la pista y del carril', bad.slice(0, 12).join(' | '));
  });

  await test('Focos: su luz cae sobre la pista', () => {
    const bad = [];
    for (const id of NIGHT_RACES) {
      const track = tracks[id], half = (track.trackWidthMeters || 12) / 2;
      for (const light of scenes[id].items.filter(it => it.kind === 'floodlight')) {
        const aim = lampAim(light, track);
        if (axisDistance(track, aim) > half || Math.hypot(aim.x - light.x, aim.y - light.y) > 70) { bad.push(id); break; }
      }
    }
    assert(bad.length === 0, 'Focos: cada torre apunta a un punto de la pista a menos de 70 m', bad.join(', '));
  });

  await test('Escapatorias como en la realidad', () => {
    const wrong = ids.filter(id => RUNOFF_LOOK[id]?.kind !== EXPECTED_RUNOFF[id]);
    assert(wrong.length === 0, 'Escapatorias: el tipo de cada circuito según las referencias', wrong.map(id => `${id}: ${RUNOFF_LOOK[id]?.kind}`).join(', '));
    assert(runoffSurfaceAt('spa', 0.2) === 'grava' && runoffSurfaceAt('spa', 0.8) === 'asfalto', 'Escapatorias mixtas: grava a la entrada de la curva y asfalto a la salida');
    assert(runoffSurfaceAt('suzuka', 0.8) === 'grava' && runoffSurfaceAt('bahrain', 0.2) === 'asfalto', 'Escapatorias: las de un solo tipo, iguales en toda la zona');
    assert(luminance(RUNOFF_COLORS.grava) > luminance(RUNOFF_COLORS.asfalto) + 40, 'Escapatorias: la grava, clara; el asfalto, oscuro');
    const yas = PAINT_STRIPES['yas-marina'], cota = PAINT_STRIPES.austin;
    assert(yas?.length >= 2 && yas.every(c => { const n = parseInt(c.slice(1), 16); return (n & 255) >= (n >> 16 & 255); }), 'Escapatorias pintadas: Yas Marina en azules', JSON.stringify(yas));
    assert(cota?.length >= 2 && cota.some(c => (parseInt(c.slice(1), 16) >> 16 & 255) > 150 && (parseInt(c.slice(1), 16) & 255) < 120) && cota.some(c => (parseInt(c.slice(1), 16) & 255) > 150),
      'Escapatorias pintadas: COTA en rojo y azul', JSON.stringify(cota));
  });
}
