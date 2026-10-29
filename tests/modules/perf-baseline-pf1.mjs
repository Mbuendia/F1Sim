// PF1 — Medición base y contador de rendimiento (Sprint 8). Contrato acordado con el usuario el 29/10/2026.
// Revisado con autorización del usuario el 29/10/2026: la página de la prueba es PerfBenchPage.tsx (PerfBench.tsx chocaba
// con perfBench.ts en Windows) y el punto 8 excluye de verdad src/dev/ (el filtro buscaba «/src/dev/» y no casaba nunca).
//  1. Desglose en el contador: además de fps, ms medio y peor, llamadas y triángulos, enseña el coste de simulación,
//     pista, clima, coches, 3D y resto (sale de `frameCost`).
//  2. Procesador y gráfica por separado: el tiempo de gráfica se mide con el cronómetro de WebGL
//     (EXT_disjoint_timer_query_webgl2) si el navegador lo ofrece; si no, «n/d», nunca un 0 que parezca una medida.
//  3. Memoria: la del juego (Chrome, performance.memory) y la de la gráfica (geometrías y texturas del 3D), o «n/d».
//  4. Tiempo de carga: marcas desde que se abre la página hasta el menú listo y hasta el primer fotograma de carrera.
//  5. Peso de la descarga: `npm run perf:size` lee `dist/` y da el paquete principal, el total de JS y los modelos,
//     texturas y audio, comprimidos con gzip.
//  6. Prueba repetible: `?rendimiento=prueba` corre 30 s de una escena fija (mismo circuito, semilla y cámara) y enseña
//     un resumen con un botón «Copiar», para comparar dispositivos.
//  7. Cifras de referencia en `docs/perf/linea-base.md`, una fila por dispositivo; uno sin medir queda «pendiente»,
//     nunca como medido.
//  8. Sin coste para el jugador: contador, medidor y prueba fuera del paquete principal (con import(), como en UX3).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const STAGES = ['simulacion', 'pista', 'clima', 'coches', '3d', 'resto'];

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);

  await test('PF1.1: desglose por fase en el contador', async () => {
    const { frameCost } = await load('/src/renderer/frameCost.ts');
    assert(STAGES.every(s => s in frameCost.ms), 'PF1: frameCost mide simulación, pista, clima, coches, 3D y resto', Object.keys(frameCost.ms).join(', '));
    const meter = await load('/src/dev/perfMeter.ts');
    const s = meter.summarizeFrames([10, 20, 30, 40]);
    assert(Math.abs(s.avgMs - 25) < 1e-9 && s.worstMs === 40 && s.fps === 40, 'PF1: resumen de fotogramas (media, peor y fps = 1000 / media)', JSON.stringify(s));
    const many = Array.from({ length: 100 }, (_, i) => i + 1);
    assert(meter.summarizeFrames(many).p95Ms === 95, 'PF1: percentil 95 del tiempo por fotograma', String(meter.summarizeFrames(many).p95Ms));
    assert(meter.summarizeFrames([]).fps === 0, 'PF1: sin fotogramas, 0 fps y sin error');
    const { PerfPanel } = await load('/src/dev/PerfOverlay.tsx');
    const snapshot = {
      fps: 58, avgMs: 17.2, worstMs: 31, p95Ms: 22, calls: 400, triangles: 250000,
      stages: { simulacion: 1.1, pista: 2.2, clima: 0.4, coches: 3.3, '3d': 6.6, resto: 0.9 },
      gpuMs: null, heapMb: null, gpuGeometries: null, gpuTextures: null,
    };
    const html = renderToStaticMarkup(createElement(PerfPanel, { snapshot }));
    assert(STAGES.every(st => html.includes(`data-perf-stage="${st}"`)), 'PF1: el contador enseña cada fase', html.slice(0, 300));
    assert(/data-perf-calls/.test(html) && /58 fps/.test(html), 'PF1: sigue enseñando fps y llamadas de dibujo');
  });

  await test('PF1.2: procesador y gráfica por separado', async () => {
    const meter = await load('/src/dev/perfMeter.ts');
    assert(meter.formatMetric(null, 'ms') === 'n/d' && meter.formatMetric(undefined, 'ms') === 'n/d' && meter.formatMetric(Number.NaN, 'ms') === 'n/d', 'PF1: sin dato, «n/d»');
    assert(meter.formatMetric(0, 'ms') !== 'n/d' && /ms/.test(meter.formatMetric(2.5, 'ms')), 'PF1: un 0 medido se enseña como medida');
    const none = meter.createGpuTimer({ getExtension: () => null });
    assert(none.available === false && none.lastMs === null, 'PF1: sin cronómetro de WebGL, la gráfica queda sin medir');
    const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
    let disjoint = false;
    const gl = {
      QUERY_RESULT: 0x8866, QUERY_RESULT_AVAILABLE: 0x8867,
      getExtension: name => (name === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
      createQuery: () => ({}), deleteQuery: () => {}, beginQuery: () => {}, endQuery: () => {},
      getQueryParameter: (_q, p) => (p === 0x8867 ? true : 2_000_000),
      getParameter: p => (p === ext.GPU_DISJOINT_EXT ? disjoint : 0),
    };
    const timer = meter.createGpuTimer(gl);
    assert(timer.available === true, 'PF1: con la extensión, el cronómetro está disponible');
    timer.begin(); timer.end(); timer.poll();
    assert(timer.lastMs === 2, 'PF1: 2.000.000 ns de gráfica son 2 ms', String(timer.lastMs));
    disjoint = true; timer.begin(); timer.end(); timer.poll();
    assert(timer.lastMs === 2, 'PF1: una medida interrumpida (disjoint) se descarta y no cambia la última buena', String(timer.lastMs));
    const { PerfPanel } = await load('/src/dev/PerfOverlay.tsx');
    const html = renderToStaticMarkup(createElement(PerfPanel, { snapshot: {
      fps: 60, avgMs: 16.6, worstMs: 20, p95Ms: 18, calls: 0, triangles: 0,
      stages: { simulacion: 0, pista: 0, clima: 0, coches: 0, '3d': 0, resto: 0 },
      gpuMs: null, heapMb: null, gpuGeometries: null, gpuTextures: null,
    } }));
    assert(/data-perf-gpu[^>]*>[^<]*n\/d/.test(html), 'PF1: el contador enseña «n/d» en la gráfica cuando no se puede medir', html);
  });

  await test('PF1.3: memoria', async () => {
    const meter = await load('/src/dev/perfMeter.ts');
    assert(meter.readMemory({}).heapMb === null, 'PF1: sin performance.memory (Safari, Firefox), la memoria queda «n/d»');
    assert(meter.readMemory({ memory: { usedJSHeapSize: 50 * 1024 * 1024 } }).heapMb === 50, 'PF1: memoria del juego en MB');
    const g = meter.gpuMemory({ memory: { geometries: 120, textures: 34 } });
    assert(g.geometries === 120 && g.textures === 34, 'PF1: geometrías y texturas en la gráfica (renderer.info)');
    const n = meter.gpuMemory(null);
    assert(n.geometries === null && n.textures === null, 'PF1: sin vista 3D, la memoria de gráfica queda «n/d»');
  });

  await test('PF1.4: tiempo de carga', async () => {
    const marks = await load('/src/perf/loadMarks.ts');
    const fake = entries => ({ getEntriesByName: name => entries.filter(e => e.name === name) });
    const t = marks.loadTimes(fake([{ name: marks.LOAD_MARKS.menu, startTime: 812 }, { name: marks.LOAD_MARKS.firstFrame, startTime: 2450 }]));
    assert(t.menuMs === 812 && t.firstFrameMs === 2450, 'PF1: tiempo hasta el menú y hasta el primer fotograma de carrera', JSON.stringify(t));
    const empty = marks.loadTimes(fake([]));
    assert(empty.menuMs === null && empty.firstFrameMs === null, 'PF1: sin marca, sin cifra (no 0)');
    let calls = 0;
    marks.markLoad('menu', { mark: () => { calls++; }, getEntriesByName: () => [{}] });
    assert(calls === 0, 'PF1: cada marca se pone una sola vez (no se repite al volver al menú)');
    const sources = sourceFiles('src').filter(f => !f.endsWith('src/perf/loadMarks.ts')).map(f => readFileSync(f, 'utf8')).join('\n');
    assert(/markLoad\(\s*['"]menu['"]/.test(sources) && /markLoad\(\s*['"]firstFrame['"]/.test(sources), 'PF1: el juego pone las dos marcas (menú listo y primer fotograma)');
  });

  await test('PF1.5: peso de la descarga', async () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    assert(/scripts\/perf-size\.mjs/.test(pkg.scripts?.['perf:size'] ?? ''), 'PF1: existe npm run perf:size');
    assert(existsSync('scripts/perf-size.mjs'), 'PF1: existe scripts/perf-size.mjs');
    const { measureDist } = await import(pathToFileURL(join(process.cwd(), 'scripts/perf-size.mjs')).href);
    const dir = mkdtempSync(join(tmpdir(), 'pf1-dist-'));
    try {
      const files = {
        'index.html': '<!doctype html><script type="module" crossorigin src="/F1Sim/assets/index-abc123.js"></script>',
        'assets/index-abc123.js': 'console.log("principal");'.repeat(200),
        'assets/chunk-def456.js': 'export const x = 1;'.repeat(100),
        'assets/index-abc123.css': 'body{margin:0}'.repeat(50),
        'models/car.glb': 'G'.repeat(3000),
        'textures/asfalto.ktx2': 'K'.repeat(2000),
        'textures/cielo.png': 'P'.repeat(1000),
        'audio/radio.mp3': 'M'.repeat(1500),
      };
      for (const [rel, body] of Object.entries(files)) {
        mkdirSync(join(dir, rel, '..'), { recursive: true });
        writeFileSync(join(dir, rel), body);
      }
      const gz = rel => gzipSync(Buffer.from(files[rel])).length;
      const r = measureDist(dir);
      assert(r.mainJs === gz('assets/index-abc123.js'), 'PF1: el paquete principal es el script de entrada de index.html, comprimido', JSON.stringify(r));
      assert(r.totalJs === gz('assets/index-abc123.js') + gz('assets/chunk-def456.js'), 'PF1: total de JS comprimido');
      assert(r.models === gz('models/car.glb'), 'PF1: modelos aparte');
      assert(r.textures === gz('textures/asfalto.ktx2') + gz('textures/cielo.png'), 'PF1: texturas aparte');
      assert(r.audio === gz('audio/radio.mp3'), 'PF1: audio aparte');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  await test('PF1.6: prueba repetible', async () => {
    const bench = await load('/src/dev/perfBench.ts');
    const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
    const sc = bench.BENCH_SCENARIO;
    assert(sc.durationS === 30 && Number.isInteger(sc.seed) && typeof sc.camera === 'string' && sc.camera.length > 0, 'PF1: escena fija de 30 s con semilla y cámara', JSON.stringify(sc));
    assert(Boolean(OFFICIAL_CIRCUITS[sc.circuitId]), 'PF1: el circuito de la prueba existe', String(sc.circuitId));
    assert(Object.isFrozen(sc), 'PF1: la escena no se puede cambiar en marcha (mismas condiciones en cada dispositivo)');
    const input = {
      device: 'Prueba', userAgent: 'UA', frames: [16, 17, 18, 40],
      stages: { simulacion: 1, pista: 2, clima: 0.5, coches: 3, '3d': 6, resto: 1 },
      gpuMs: null, heapMb: 80, gpuGeometries: 100, gpuTextures: 20, menuMs: 900, firstFrameMs: null,
    };
    const a = bench.benchSummary(input), b = bench.benchSummary(input);
    assert(JSON.stringify(a) === JSON.stringify(b), 'PF1: el mismo resultado da el mismo resumen');
    const keys = ['scenario', 'device', 'userAgent', 'fps', 'avgMs', 'worstMs', 'p95Ms', 'stages', 'gpuMs', 'heapMb', 'gpuGeometries', 'gpuTextures', 'menuMs', 'firstFrameMs'];
    assert(keys.every(k => k in a), 'PF1: el resumen lleva escena, dispositivo, fotogramas, fases, gráfica, memoria y carga', Object.keys(a).join(', '));
    assert(a.gpuMs === 'n/d' && a.firstFrameMs === 'n/d' && a.heapMb === 80, 'PF1: lo que no se pudo medir sale «n/d» en el resumen');
    const text = bench.benchText(a);
    assert(typeof text === 'string' && text.includes('fps') && text.includes(String(sc.circuitId)), 'PF1: texto para copiar y pegar');
    const main = readFileSync('src/main.tsx', 'utf8');
    assert(/['"]prueba['"]/.test(main) && /import\(['"]\.\/dev\/PerfBenchPage['"]\)/.test(main), 'PF1: main.tsx abre la prueba con ?rendimiento=prueba, cargada aparte');
    const page = readFileSync('src/dev/PerfBenchPage.tsx', 'utf8');
    assert(/Copiar/.test(page) && /clipboard/.test(page), 'PF1: la prueba tiene un botón «Copiar»');
  });

  await test('PF1.7: cifras de referencia', () => {
    const path = 'docs/perf/linea-base.md';
    assert(existsSync(path), 'PF1: existe docs/perf/linea-base.md');
    const md = readFileSync(path, 'utf8');
    // [PF2] Revisado con autorización del usuario (29/10/2026): solo la tabla de su sección; otras tablas del documento
    // (la de PF2) no son filas de dispositivo.
    const section = md.slice(md.indexOf('## Fotogramas, memoria y carga')).split(/\r?\n## /)[0];
    const rows = section.split(/\r?\n/).filter(l => /^\|/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
    const header = rows[0] ?? [];
    const cols = ['Dispositivo', 'Estado', 'fps', 'ms medio', 'peor ms', 'p95 ms', 'gráfica ms', 'memoria MB', 'menú ms', 'primer fotograma ms'];
    assert(cols.every(c => header.includes(c)), 'PF1: la tabla tiene las columnas acordadas', header.join(' | '));
    const body = rows.slice(2);
    const device = name => body.find(r => r[header.indexOf('Dispositivo')] === name);
    assert(['PC del usuario', 'Móvil del usuario', 'Móvil modesto'].every(device), 'PF1: una fila por dispositivo (PC, móvil del usuario y uno modesto)');
    const numeric = ['fps', 'ms medio', 'peor ms', 'p95 ms'].map(c => header.indexOf(c));
    const measuredCols = cols.slice(2).map(c => header.indexOf(c));
    for (const r of body) {
      const state = r[header.indexOf('Estado')];
      assert(state === 'medido' || state === 'pendiente', 'PF1: cada fila está «medido» o «pendiente»', r.join(' | '));
      if (state === 'medido') assert(numeric.every(i => Number.isFinite(Number(r[i].replace(',', '.')))), 'PF1: una fila medida tiene sus cifras', r.join(' | '));
      else assert(measuredCols.every(i => r[i] === '—'), 'PF1: una fila pendiente no tiene cifras (no cuenta como medida)', r.join(' | '));
    }
    assert(/perf:size/.test(md) && /paquete principal/i.test(md), 'PF1: el documento recoge también el peso de la descarga');
  });

  await test('PF1.8: sin coste para el jugador', () => {
    const offenders = sourceFiles('src')
      .filter(f => !f.startsWith('src/dev/'))
      .filter(f => /^import [^(]*from ['"][./]*(dev\/)?(perfMeter|perfBench|PerfBenchPage|PerfOverlay)['"]/m.test(readFileSync(f, 'utf8')));
    assert(offenders.length === 0, 'PF1: el medidor, el contador y la prueba no entran en el paquete principal', offenders.join(', '));
    const main = readFileSync('src/main.tsx', 'utf8');
    assert(!/^import [^(]*from ['"]\.\/dev\//m.test(main), 'PF1: main.tsx sigue cargando las herramientas con import()');
  });
}
