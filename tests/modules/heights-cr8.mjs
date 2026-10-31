// CR8 — Valorar las alturas de cada circuito (Sprint 10.5). Contrato acordado con el usuario el 31/10/2026 (ficha de CR8
// en DASHBOARD.md); la prueba se hace en Mónaco en vez de Spa, por petición del usuario.
//  1. docs/design/alturas-circuitos.md: una fila por circuito, con el formato
//     | `id` | medido (m) | publicado (m) | categoría | lo que chocaría |
//     categoría «mucho» (40 m o más), «medio» (15–40 m) o «casi plano» (menos de 15 m), según lo medido.
//  2. Fuentes con licencia citadas: GeoJSON de bacinger/f1-circuits (MIT) y modelo de elevación abierto (SRTM o EU-DEM)
//     por OpenTopoData; nada de Google ni de modelos de pago.
//  3. Prueba en Mónaco: docs/design/cr8/monaco-perfil.json ({ lapM, source, points: [{ s, z, tunnel? }], game: [z por
//     punto del trazado del juego] }) y su gráfica; desnivel a ±15 % de 42 m; subida de Sainte Dévote al Casino de 25 m
//     como mínimo y bajada hacia el túnel; túnel interpolado y marcado; sin picos de tejados.
//  4. Coste estimado en el 3D y en el motor.
//  5. Recomendación para CK5 y CK6, y la decisión del usuario anotada en sus fichas.
import { readFileSync, existsSync } from 'node:fs';

const DOC = 'docs/design/alturas-circuitos.md';
const PROFILE = 'docs/design/cr8/monaco-perfil.json';
const REAL_MONACO = 42;
const category = m => (m >= 40 ? 'mucho' : m >= 15 ? 'medio' : 'casi plano');

export default async function run({ server, assert, test }) {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';

  await test('CR8.1: valoración de cada circuito', () => {
    assert(doc.length > 0, `CR8: existe ${DOC}`);
    const rows = new Map();
    for (const line of doc.split(/\r?\n/)) {
      const m = line.match(/^\|\s*`([a-z-]+)`\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+|n\/d)\s*\|\s*(mucho|medio|casi plano)\s*\|\s*(.+?)\s*\|\s*$/);
      if (m) rows.set(m[1], { measured: Number(m[2].replace(',', '.')), published: m[3], cat: m[4], clash: m[5] });
    }
    const missing = ids.filter(id => !rows.has(id));
    assert(missing.length === 0, 'CR8: una fila por cada uno de los 23 circuitos', missing.join(', ') || `${rows.size} filas`);
    const wrong = [...rows].filter(([, r]) => r.cat !== category(r.measured)).map(([id, r]) => `${id}: ${r.measured} m → ${r.cat}`);
    assert(rows.size > 0 && wrong.length === 0, 'CR8: la categoría sale del desnivel medido (40 m o más, 15–40 m, menos de 15 m)', wrong.join('; ') || 'ok');
    const noClash = [...rows].filter(([, r]) => r.clash.length < 3).map(([id]) => id);
    assert(rows.size > 0 && noClash.length === 0, 'CR8: cada fila dice lo que chocaría con el relieve', noClash.join(', ') || 'ok');
  });

  await test('CR8.2: fuentes con licencia', () => {
    assert(/bacinger\/f1-circuits/.test(doc) && /\bMIT\b/.test(doc), 'CR8: cita el GeoJSON de bacinger/f1-circuits con su licencia MIT');
    assert(/OpenTopoData/i.test(doc) && /(SRTM|EU-DEM)/.test(doc), 'CR8: cita el modelo de elevación (SRTM o EU-DEM) y OpenTopoData');
    assert(!/maps\.google|googleapis|cgtrader|turbosquid/i.test(existsSync(PROFILE) ? readFileSync(PROFILE, 'utf8') : '') && !/fuente[^\n]*(google|cgtrader|turbosquid)/i.test(doc), 'CR8: nada sale de Google ni de modelos de pago');
  });

  await test('CR8.3: prueba en Mónaco', () => {
    assert(existsSync(PROFILE), `CR8: existe ${PROFILE}`);
    if (!existsSync(PROFILE)) return;
    const p = JSON.parse(readFileSync(PROFILE, 'utf8'));
    const pts = p.points ?? [];
    const ordered = pts.every((q, k) => k === 0 || q.s > pts[k - 1].s);
    assert(pts.length >= 100 && ordered && pts[pts.length - 1].s >= 0.95 * p.lapM, 'CR8: perfil de toda la vuelta, ordenado', `${pts.length} puntos`);
    const zs = pts.map(q => q.z), drop = Math.max(...zs) - Math.min(...zs);
    assert(Math.abs(drop - REAL_MONACO) <= 0.15 * REAL_MONACO, `CR8: desnivel a ±15 % de ${REAL_MONACO} m`, `${drop.toFixed(1)} m`);
    const zIn = (a, b, f) => f(...pts.filter(q => q.s >= a * p.lapM && q.s <= b * p.lapM).map(q => q.z));
    const climb = zIn(0.2, 0.35, Math.max) - zIn(0.04, 0.14, Math.min);
    assert(climb >= 25, 'CR8: sube 25 m o más de Sainte Dévote al Casino', `${climb.toFixed(1)} m`);
    const tunnel = pts.filter(q => q.tunnel);
    assert(tunnel.length >= 3 && zIn(0.2, 0.35, Math.max) - Math.max(...tunnel.map(q => q.z)) >= 20, 'CR8: baja 20 m o más del Casino al túnel', `${tunnel.length} puntos de túnel`);
    const linear = tunnel.every((q, k) => k < 2 || Math.abs((q.z - tunnel[k - 1].z) / (q.s - tunnel[k - 1].s) - (tunnel[k - 1].z - tunnel[k - 2].z) / (tunnel[k - 1].s - tunnel[k - 2].s)) < 0.002);
    assert(tunnel.length >= 3 && linear, 'CR8: el túnel va interpolado (pendiente constante)');
    const steep = pts.filter((q, k) => k > 0 && Math.abs(q.z - pts[k - 1].z) / Math.max(1, q.s - pts[k - 1].s) > 0.2);
    assert(steep.length === 0, 'CR8: sin picos de tejados (ninguna pendiente de más del 20 %)', `${steep.length} saltos`);
    const track = new RaceSimulation('monaco').activeTrack;
    assert(Array.isArray(p.game) && p.game.length === track.points.length && p.game.every(Number.isFinite), 'CR8: una altura por punto del trazado del juego', `${p.game?.length} de ${track.points.length}`);
    assert(existsSync('docs/design/cr8/monaco-perfil.png') || existsSync('docs/design/cr8/monaco-perfil.svg'), 'CR8: gráfica del perfil');
  });

  await test('CR8.4: coste estimado', () => {
    assert(/triángulos/i.test(doc) && /llamadas de dibujo/i.test(doc), 'CR8: coste en el 3D (triángulos y llamadas de dibujo)');
    assert(/semilla/i.test(doc) && /guardad/i.test(doc) && /R27/.test(doc), 'CR8: coste en el motor (semilla, guardado y banco R27)');
  });

  await test('CR8.5: recomendación y decisión del usuario', () => {
    const rec = doc.slice(doc.search(/^#+\s*Recomendación/im));
    assert(/^#+\s*Recomendación/im.test(doc) && /CK5/.test(rec) && /CK6/.test(rec), 'CR8: recomendación con opciones para CK5 y CK6');
    const dash = readFileSync('DASHBOARD.md', 'utf8');
    const card = id => { const at = dash.indexOf(`* **${id} —`); return at < 0 ? '' : dash.slice(at, dash.indexOf('\n* **', at + 5)); };
    assert(['CK5', 'CK6'].every(id => /Decisión del usuario \(CR8/.test(card(id))), 'CR8: la decisión del usuario está anotada en las fichas de CK5 y CK6');
  });
}
