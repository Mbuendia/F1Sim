// G8 — Pista en WebGL (Sprint 4.5). Contrato escrito el 13/10/2026 (el usuario autorizó ese día el sprint y revisar los
// contratos al llegar a cada tarea). WebGL no existe en Node: aquí se prueba lo que se sube a la GPU y lo que deja de
// pintar el Canvas; lo pintado se revisa en el navegador.
//  1. Las capas fijas (`trackLayers.ts`) salen de la misma geometría que el Canvas: un asfalto al ancho del circuito,
//     los dos bordes blancos de `getPitLaneGeometry`, la meta de borde a borde, 20 cajones de parrilla dentro de la
//     pista, boxes y pianos; sin coordenadas inválidas, en los 23 circuitos.
//  2. Con la pista en la GPU, el Canvas no vuelve a pintar esas formas (ni un trazo ni un relleno de pista) y conserva
//     los rótulos y la goma de la trazada.
//  3. Sin WebGL el Canvas pinta lo mismo que antes (respaldo).
export default async function run({ server, assert, test }) {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const { buildTrackLayers, getTrackLayers, FINISH_LINE_M } = await server.ssrLoadModule('/src/renderer/trackLayers.ts');
  const { getPitLaneGeometry } = await server.ssrLoadModule('/src/utils/pitLaneGeometry.ts');
  const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
  const { frameCost, recordStage, resetFrameCost } = await server.ssrLoadModule('/src/renderer/frameCost.ts');

  const nearestAxis = (p, points) => {
    let best = Infinity;
    for (const q of points) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    return best;
  };

  await test('G8: capas fijas de los 23 circuitos', () => {
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const track = buildTrackFromSvg(OFFICIAL_CIRCUITS[id]);
      const layers = buildTrackLayers(track, id), shapes = layers.shapes;
      assert(shapes.length > 40 && shapes.every(s => s.points.length >= (s.kind === 'fill' ? 3 : 2) && s.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))),
        `G8 ${id}: formas completas y sin coordenadas inválidas`, String(shapes.length));
      const asphalt = shapes.filter(s => s.role === 'asphalt');
      assert(asphalt.length === 1 && asphalt[0].width === track.trackWidthMeters && asphalt[0].closed && asphalt[0].points.length === track.points.length,
        `G8 ${id}: un asfalto, al ancho del circuito y sobre todo el eje`);
      const edges = getPitLaneGeometry(track).trackEdges;
      const white = shapes.filter(s => s.kind === 'stroke' && s.hairline && s.closed && s.color === '#ffffff' && s.points.length === track.points.length);
      assert(white.length === 2 && white.every((s, i) => s.points === edges[i]), `G8 ${id}: los bordes blancos son los de la geometría común`);
      // Cuadros de la meta: los que caen sobre la línea (medio grosor a lo largo de la pista, medio ancho a lo ancho).
      const start = track.points[0], along = { x: Math.cos(start.angle), y: Math.sin(start.angle) };
      const onLine = p => Math.abs((p.x - start.x) * along.x + (p.y - start.y) * along.y) <= FINISH_LINE_M / 2 + 1e-6 && Math.abs(-(p.x - start.x) * along.y + (p.y - start.y) * along.x) <= track.trackWidthMeters / 2 + 1e-6;
      const squares = shapes.filter(s => s.kind === 'fill' && s.points.length === 4 && (s.color === '#ffffff' || s.color === '#000000') && s.points.every(onLine));
      const span = Math.max(...squares.flatMap(s => s.points.map(p => Math.abs(-(p.x - start.x) * along.y + (p.y - start.y) * along.x))));
      assert(squares.length === 10 && Math.abs(span - track.trackWidthMeters / 2) < 1e-6, `G8 ${id}: meta ajedrezada de borde a borde`, `${squares.length} · ${span.toFixed(2)} m`);
      const brackets = shapes.filter(s => s.kind === 'stroke' && s.hairline && !s.closed && s.points.length === 4 && s.width === 0.15);
      assert(brackets.length === 20 && brackets.every(s => s.points.every(p => nearestAxis(p, track.points) <= track.trackWidthMeters / 2)),
        `G8 ${id}: 20 cajones de parrilla dentro de la pista`, String(brackets.length));
      assert(getTrackLayers(track, id) === getTrackLayers(track, id), `G8 ${id}: las capas se calculan una vez por pista`);
    }
  });

  await test('G8: con la pista en la GPU el Canvas solo pinta goma y rótulos', () => {
    const track = buildTrackFromSvg(OFFICIAL_CIRCUITS.barcelona);
    const record = gpu => {
      const strokes = [], fills = [], texts = [];
      const ctx = new Proxy({
        stroke: () => strokes.push({ color: ctx.strokeStyle, width: ctx.lineWidth }),
        fill: () => fills.push(ctx.fillStyle),
        fillText: text => texts.push(text),
        measureText: text => ({ width: text.length * 6 }),
      }, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
      const zoom = 3;
      const camera = { zoom, rotation: 0, x: 0, y: 0, screenWidth: 1200, screenHeight: 800, worldToScreen: (x, y) => ({ x: x * zoom, y: y * zoom }) };
      TrackRenderer.renderTrack(ctx, track, camera, 1, undefined, 'barcelona', gpu);
      return { strokes, fills, texts };
    };
    const canvas = record(false), gpu = record(true);
    assert(canvas.strokes.some(s => s.width === track.trackWidthMeters * 3) && canvas.fills.length > 10, 'G8: sin WebGL el Canvas pinta el asfalto y los rellenos (respaldo)',
      `${canvas.strokes.length} trazos · ${canvas.fills.length} rellenos`);
    assert(!gpu.strokes.some(s => s.width === track.trackWidthMeters * 3), 'G8: con WebGL el Canvas no pinta el asfalto');
    const rubber = /^rgba\((20, 22, 28|13, 16, 23),/;
    assert(gpu.strokes.length > 0 && gpu.strokes.every(s => rubber.test(String(s.color)) || s.color === 'rgba(255, 255, 255, 0.15)'), 'G8: con WebGL los únicos trazos del Canvas son la goma de la trazada y el marco de los rótulos',
      [...new Set(gpu.strokes.map(s => s.color))].join(' | '));
    assert(gpu.fills.every(f => f === 'rgba(10, 15, 25, 0.88)'), 'G8: con WebGL los únicos rellenos del Canvas son el fondo de los rótulos de curva', [...new Set(gpu.fills)].join(' | '));
    assert(gpu.texts.length > 0 && JSON.stringify(gpu.texts) === JSON.stringify(canvas.texts), 'G8: los rótulos son los mismos con y sin WebGL', `${gpu.texts.length} / ${canvas.texts.length}`);
  });

  // G9: el coste por fase del fotograma se mide con una media móvil (los valores reales se leen en el navegador).
  await test('G9: medida del coste por fotograma', () => {
    resetFrameCost();
    recordStage('coches', 4);
    assert(frameCost.ms.coches === 4, 'G9: la primera medida de una fase es su valor');
    frameCost.frames = 1;
    recordStage('coches', 10);
    assert(frameCost.ms.coches > 4 && frameCost.ms.coches < 4.2, 'G9: las siguientes entran en una media móvil lenta', String(frameCost.ms.coches));
    resetFrameCost();
    assert(frameCost.frames === 0 && Object.values(frameCost.ms).every(v => v === 0), 'G9: la medida se puede poner a cero');
  });
}
