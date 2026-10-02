// R03 (base inicial) — Geometría existente con unidades y datos de evento con procedencia (contrato aprobado por
// el usuario el 01/10/2026). Barcelona y Mónaco de referencia; sin cambiar ningún valor del juego.
//  1. Sentido de giro según la ficha; con el sentido invertido, giro contrario y misma longitud.
//  2. Escala mundo↔metros: la vuelta mide lo que dice la ficha y t equivale a distancia recorrida.
//  3. Intervalos que cruzan la meta.  4. Pit lane que cruza (Barcelona) y que no cruza (Mónaco) la meta.
//  5. Distancias en el sentido de marcha.  6. Procedencia declarada y validador de fichas.
export default async function run({ server, assert, test }) {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const geo = await server.ssrLoadModule('/src/data/trackGeometry.ts');
  const { buildEventData, validateEventData, EVENT_DATA_IDS } = await server.ssrLoadModule('/src/data/eventData.ts');
  const REFERENCE = ['barcelona', 'monaco'];
  const tracks = Object.fromEntries(REFERENCE.map(id => [id, buildTrackFromSvg(OFFICIAL_CIRCUITS[id])]));

  await test('R03: sentido de giro de la ficha y sentido inverso', () => {
    for (const id of REFERENCE) {
      const spec = OFFICIAL_CIRCUITS[id];
      assert(geo.isClockwise(tracks[id].points) === (spec.direction === 'clockwise'), `R03: ${id} gira en el sentido de su ficha`, spec.direction);
      const reversed = buildTrackFromSvg({ ...spec, direction: spec.direction === 'clockwise' ? 'anti-clockwise' : 'clockwise' });
      assert(geo.isClockwise(reversed.points) !== geo.isClockwise(tracks[id].points), `R03: ${id} invertido gira al revés`);
      const a = geo.polylineLength(tracks[id].points), b = geo.polylineLength(reversed.points);
      assert(Math.abs(a - b) / a < 1e-6, `R03: ${id} invertido conserva la longitud`, `${a.toFixed(2)} / ${b.toFixed(2)}`);
    }
  });

  await test('R03: escala mundo↔metros y t como distancia recorrida', () => {
    for (const id of REFERENCE) {
      const track = tracks[id], L = OFFICIAL_CIRCUITS[id].lapLengthMeters;
      const scale = geo.createTrackScale(track);
      const lap = scale.worldToMeters(geo.polylineLength(track.points));
      assert(Math.abs(lap - L) / L < 0.005, `R03: ${id} mide ${L} m (±0,5 %)`, `${lap.toFixed(1)} m`);
      let worstRoundTrip = 0, worstUniform = 0;
      for (let i = 0; i <= 200; i++) {
        const t = i / 200 * 0.999;
        worstRoundTrip = Math.max(worstRoundTrip, Math.abs(scale.metersToT(scale.tToMeters(t)) - t));
        worstUniform = Math.max(worstUniform, Math.abs(scale.tToMeters(t) - t * L));
      }
      assert(worstRoundTrip < 1e-6, `R03: ${id} t→m→t sin error`, worstRoundTrip.toExponential(2));
      assert(worstUniform < 0.005 * L, `R03: ${id} t equivale a distancia (±0,5 % de la vuelta)`, `${worstUniform.toFixed(1)} m`);
      assert(Math.abs(scale.metersToWorld(scale.worldToMeters(123.4)) - 123.4) < 1e-9, `R03: ${id} mundo→m→mundo sin error`);
    }
  });

  await test('R03: intervalo que cruza la meta', () => {
    const zone = OFFICIAL_CIRCUITS.barcelona.drsZoneSpecs.find(z => z.id === 2);
    const interval = geo.trackInterval(zone.startT, zone.endT);
    assert(interval.crossesFinish, 'R03: la zona DRS 2 de Barcelona cruza la meta');
    assert(interval.contains(0.95) && interval.contains(0.05) && !interval.contains(0.5), 'R03: contiene 0,95 y 0,05 pero no 0,5');
    const expected = (1 - 0.9015 + 0.0867) * OFFICIAL_CIRCUITS.barcelona.lapLengthMeters;
    const meters = interval.length * OFFICIAL_CIRCUITS.barcelona.lapLengthMeters;
    assert(Math.abs(meters - expected) < 0.5, 'R03: longitud correcta a través de la meta', `${meters.toFixed(1)} m`);
  });

  await test('R03: pit lane que cruza y que no cruza la meta', () => {
    const pit = id => geo.trackInterval(tracks[id].pitEntryT, tracks[id].pitExitT);
    assert(!pit('monaco').crossesFinish && !pit('monaco').contains(0), 'R03: el pit lane de Mónaco no cruza la meta');
    assert(pit('barcelona').crossesFinish && pit('barcelona').contains(0), 'R03: el pit lane de Barcelona cruza la meta');
  });

  await test('R03: distancias en el sentido de marcha', () => {
    for (const id of REFERENCE) {
      const scale = geo.createTrackScale(tracks[id]), L = OFFICIAL_CIRCUITS[id].lapLengthMeters;
      for (const [a, b] of [[0.9, 0.1], [0.1, 0.9], [0.25, 0.75], [0.99, 0.01]]) {
        const sum = scale.arcDistance(a, b) + scale.arcDistance(b, a);
        assert(Math.abs(sum - L) < 1e-6 * L, `R03: ${id} ida ${a}→${b} + vuelta = una vuelta`, `${sum.toFixed(2)} m`);
      }
      assert(Math.abs(scale.arcDistance(0.9, 0.1) - scale.tToMeters(0.1) - (L - scale.tToMeters(0.9))) < 1e-6 * L,
        `R03: ${id} 0,9→0,1 avanza a través de la meta`);
    }
  });

  await test('R03: procedencia declarada y validador de fichas', () => {
    assert(REFERENCE.every(id => EVENT_DATA_IDS.includes(id)), 'R03: Barcelona y Mónaco tienen datos de evento');
    for (const id of REFERENCE) {
      const data = buildEventData(OFFICIAL_CIRCUITS[id], tracks[id]);
      const errors = validateEventData(data);
      assert(errors.length === 0, `R03: los datos de ${id} son válidos`, errors.join(' | '));
      assert(data.lines.every(l => ['verificado', 'calibrado', 'provisional', 'sintetico'].includes(l.provenance) && l.unit),
        `R03: cada línea de ${id} declara procedencia y unidad`);
      assert(['meta', 'sector', 'drs-deteccion', 'drs-zona', 'pit-entrada', 'pit-salida', 'pit-compromiso']
        .every(kind => data.lines.some(l => l.kind === kind)), `R03: ${id} registra meta, sectores, DRS y boxes`);
    }
    const barcelona = buildEventData(OFFICIAL_CIRCUITS.barcelona, tracks.barcelona);
    assert(barcelona.lines.find(l => l.id === 'D2').provenance === 'calibrado', 'R03: la detección D2 de Barcelona sigue calibrada, no oficial');

    const broken = mutate => { const copy = structuredClone(barcelona); mutate(copy); return validateEventData(copy); };
    const drs = (data, kind) => data.lines.find(l => l.kind === kind);
    const cases = {
      't fuera de rango': d => { drs(d, 'drs-deteccion').t = 1.2; },
      'id duplicado': d => { d.lines.push({ ...d.lines[0] }); },
      'zona inexistente': d => { drs(d, 'drs-deteccion').zoneIds = [99]; },
      'zona sin detección': d => { d.lines = d.lines.filter(l => !(l.kind === 'drs-deteccion' && l.zoneIds.includes(1))); },
      'verificado sin fuente': d => { const l = d.lines.find(x => x.provenance === 'verificado'); l.source = ''; },
      'unidad ausente': d => { delete d.lines[0].unit; },
    };
    for (const [label, mutate] of Object.entries(cases)) {
      assert(broken(mutate).length > 0, `R03: el validador rechaza «${label}»`);
    }
  });
}
