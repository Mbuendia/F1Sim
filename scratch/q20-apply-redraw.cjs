// Q20 opción A: aplica scratch/q20-redraw.json (salida de q20-redraw.mjs) a datos, SVG, rutas y fixture.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);
// Q20_ONLY=<id> aplica un único circuito con SVG conservado desde scratch/q20-redraw-<id>.json (sin tocar los demás).
const ONLY = process.env.Q20_ONLY;
const R = JSON.parse(read(ONLY ? `scratch/q20-redraw-${ONLY.split('-')[0]}.json` : 'scratch/q20-redraw.json'));
const meta = JSON.parse(read('scratch/q20-meta.json'));
const REDRAW = ONLY ? [] : ['spielberg', 'las-vegas', 'bahrain', 'baku', 'miami', 'shanghai', 'mexico-city', 'austin'];
const KEEP_SVG = ONLY ? [ONLY] : ['jeddah'];
const r4 = v => Math.round(v * 10000) / 10000;
const r3 = v => Math.round(v * 1000) / 1000;

// T antiguo → T nuevo: correspondencia monótona (DTW) con f(0)=0 y f(1)=1.
function mapper(mapT) {
  const n = mapT.length, u = [];
  for (let i = 0; i < n; i++) {
    let v = mapT[i] - mapT[0];
    v = ((v % 1) + 1) % 1;
    if (i > 0 && v < u[i - 1] - 0.5) v += 1;
    u.push(Math.min(1, Math.max(i ? u[i - 1] : 0, v)));
  }
  return t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const x = t * n, i = Math.floor(x), f = x - i;
    const a = u[i], b = i + 1 < n ? u[i + 1] : 1;
    return a + (b - a) * f;
  };
}

function blockRange(s, id) {
  const start = s.search(new RegExp('\\n  \'?' + id + '\'?: \\{'));
  if (start < 0) throw new Error('sin bloque ' + id);
  const next = s.slice(start + 5).search(/\n  '?[a-z-]+'?: \{/);
  return [start, next < 0 ? s.length : start + 5 + next];
}

let circuits = read('src/data/circuits.ts');
let calendar = read('src/data/scenarioCalendar.ts');
const svgPaths = JSON.parse(read('src/data/svgTrackPaths.json'));
const routes = JSON.parse(read('src/data/pitLaneRoutes.json'));
const refs = JSON.parse(read('tests/fixtures/pit-lane-references.json'));
const report = [];

for (const id of [...REDRAW, ...KEEP_SVG]) {
  const r = R[id];
  const redraw = REDRAW.includes(id);
  const [a, b] = blockRange(circuits, id);
  let block = circuits.slice(a, b);
  const oldSvg = block.match(/svgFile: '([^']+)'/)[1];
  const pit = redraw ? r.pit : r.pitOld;
  const f = redraw ? mapper(r.mapT) : t => t;
  const setNum = (key, value) => {
    const re = new RegExp('(' + key + ': )-?[0-9.]+');
    if (!re.test(block)) throw new Error(id + ' sin ' + key);
    block = block.replace(re, '$1' + value);
  };
  setNum('pitEntryT', pit.entryT);
  setNum('pitExitT', pit.exitT);
  const changes = { pit: [pit.entryT, pit.exitT] };
  if (redraw) {
    const newSvg = oldSvg.replace(/-\d+\.svg$/, '-2026.svg');
    block = block.replace(`svgFile: '${oldSvg}'`, `svgFile: '${newSvg}'`);
    setNum('startOffsetT', 0);
    changes.drs = [];
    block = block.replace(/startT: ([0-9.]+), endT: ([0-9.]+)/g, (_, s0, e0) => {
      const s1 = r3(f(+s0)), e1 = r3(f(+e0));
      changes.drs.push(`${s0}-${e0} → ${s1}-${e1}`);
      return `startT: ${s1.toFixed(3)}, endT: ${e1.toFixed(3)}`;
    });
    // SVG nuevo: rutas del parser y archivos públicos (raíz y minimal, que usa la interfaz).
    svgPaths[newSvg] = r.d;
    for (const dir of ['public/circuits', 'public/circuits/minimal']) {
      const src = read(`${dir}/${oldSvg}`);
      const out = src
        .replace(/<desc>[\s\S]*?<\/desc>/, `<desc>\n        Trazado real: bacinger/f1-circuits circuits/${r.geojson}.geojson (MIT), ajustado al marco de ${oldSvg} (julesr0y/f1-circuits-svg). Q20, 2026-09-29.\n    </desc>`)
        .replace(/(<path[^>]*?\sd=")[^"]*(")/, `$1${r.d}$2`);
      write(`${dir}/${newSvg}`, out);
    }
    // Perfil visual del calendario: centros de curva y barreras en el nuevo T.
    const line = calendar.match(new RegExp(`(\\n  '?${id}'?: \\{[\\s\\S]*?barriers: )(\\[[^\\n]*\\]\\])( \\},)`));
    if (!line) throw new Error('perfil ' + id);
    const bends = line[0].match(/bends: (\[[^\]]*\])/);
    const newBends = JSON.parse(bends[1]).map(t => r3(f(t)));
    const newBarriers = JSON.parse(line[2]).map(([s0, e0]) => [r3(f(s0)), r3(f(e0))]);
    const fmt = v => (v === 0 || v === 1 ? String(v) : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
    const replaced = line[0]
      .replace(bends[0], `bends: [${newBends.map(fmt).join(', ')}]`)
      .replace(line[2], `[${newBarriers.map(([s0, e0]) => `[${fmt(s0)}, ${fmt(e0)}]`).join(', ')}]`);
    calendar = calendar.replace(line[0], replaced);
    changes.bends = newBends; changes.barriers = newBarriers; changes.svg = `${oldSvg} → ${newSvg}`;
  }
  circuits = circuits.slice(0, a) + block + circuits.slice(b);

  routes[id] = { osmWays: meta[id].pitWays, points: pit.routeSvg };
  const rel = meta[id].relVersion ? `OSM relación ${meta[id].relation} v${meta[id].relVersion.version} (${meta[id].relVersion.timestamp.slice(0, 10)})` : 'OSM (sin relación de circuito)';
  refs[id] = {
    status: 'VERIFICADO',
    source: `Pista: bacinger/f1-circuits circuits/${r.geojson}.geojson (MIT). Pit lane: OpenStreetMap vías ${meta[id].pitWays.join(', ')} (${meta[id].pitSource}). Definición de entrada/salida: FIA 2025 F1 Sporting Regulations Issue 5 art. 34.1-34.2.`,
    edition: `bacinger/f1-circuits master (último cambio 2026-02-05); ${rel}; descargados 2026-09-29`,
    direction: `${block.match(/direction: '([^']+)'/)[1]}; sentido del pit lane ${pit === r.pit && r.pit.oneway === false ? 'deducido del sentido de carrera' : 'según oneway=yes de OSM'}, coherente con la pista`,
    svgTransform: redraw
      ? `${circuits.slice(a).match(/svgFile: '([^']+)'/)[1]} generado desde el GeoJSON (Catmull-Rom) en el marco de ${oldSvg}: rotación ${r.rotDeg}°, ${r.metersPerSvgUnit} m por unidad SVG, empieza en el T=0 anterior (startOffsetT 0); T antiguo→nuevo por DTW (diferencia mediana de forma ${r.oldVsNewMedianM} m)`
      : `GeoJSON → marco de ${oldSvg} por semejanza (rotación ${r.rotDeg}°, ${r.metersPerSvgUnit} m por unidad SVG; diferencia mediana de forma ${r.oldVsNewMedianM} m); el SVG se conserva`,
    entryT: pit.entryT,
    exitT: pit.exitT,
    evidence: {
      trackVsOsmMedianM: r.osmVsRealMedianM,
      entry: { t: pit.entryT, distanceToTrackM: pit.entryDistM, localOsmResidualM: r.pit.entryLocalOsmM },
      exit: { t: pit.exitT, distanceToTrackM: pit.exitDistM, localOsmResidualM: r.pit.exitLocalOsmM },
    },
  };
  report.push([id, JSON.stringify(changes)]);
}

// Criterio de la opción A: extremo <= 15 m de la pista y residuo local OSM/pista <= 5 m.
for (const id of [...REDRAW, ...KEEP_SVG]) {
  const e = refs[id].evidence;
  if (e.entry.distanceToTrackM > 15 || e.exit.distanceToTrackM > 15 || e.entry.localOsmResidualM > 5 || e.exit.localOsmResidualM > 5)
    throw new Error(`${id} no cumple el criterio de verificación`);
}
if (!ONLY) refs['yas-marina'].reason = 'La salida de boxes de OSM termina a 17-22 m de la pista (GeoJSON y SVG) en la reincorporación tras el túnel: extremo no concluyente (> 15 m). El SVG yas-marina-2 coincide con la geometría real (mediana 3,9 m), así que no se redibuja.';
if (!ONLY) refs._nota += ' Opción A (29/09/2026): pista real de bacinger/f1-circuits (MIT) para los circuitos cuyo SVG se desviaba > 5 m (redibujados como <id>-2026.svg) y para Jeddah (SVG conservado); el pit lane sigue siendo OSM proyectado sobre esa pista. Criterio: extremo <= 15 m y residuo local OSM/pista <= 5 m. Validación cruzada: en Barcelona, Silverstone y Hungaroring este método reproduce las referencias OSM con diferencia <= 0,0004 vueltas.';

write('src/data/circuits.ts', circuits);
write('src/data/scenarioCalendar.ts', calendar);
// Nota: al redibujar se reformatea el JSON; en el commit se reinsertaron solo las claves nuevas con el formato original.
if (!ONLY) write('src/data/svgTrackPaths.json', JSON.stringify(svgPaths, null, 2) + '\n');
write('src/data/pitLaneRoutes.json', JSON.stringify(routes) + '\n');
write('tests/fixtures/pit-lane-references.json', JSON.stringify(refs, null, 2) + '\n');
for (const [id, c] of report) console.log(id.padEnd(12), c);
