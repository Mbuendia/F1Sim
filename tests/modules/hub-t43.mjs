// T4.3 — Centro de gestión (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día y sus decisiones de diseño: pestañas arriba
// en el orden Inicio · Equipo · Fábrica · Finanzas · Temporada · Correr («Correr» la última), lista de pendientes que
// avisa y no bloquea, acento con el color del equipo e iconos. Tests proporcionados: la lógica de los pendientes y del
// acento, y un renderizado por pieza; la composición se revisa en el navegador.
//  1. Pendientes de tu decisión: mejora lista para montar, hueco de desarrollo libre, hueco de patrocinio con ofertas,
//     componente con riesgo de avería, equipo de boxes fatigado y límite de deuda. Sin nada pendiente, lista vacía.
//  2. Acento de cada equipo: se lee sobre el fondo y no es el rojo de la acción principal.
//  3. Inicio: la ronda que toca con su botón, los pendientes y las tarjetas de estado.
//  4. Correr: la ronda, la previsión, las sesiones del fin de semana como pasos, los dos pilotos y un solo botón rojo.
//  5. Temporada: franja de 24 rondas con la que toca resaltada, las disputadas con su ganador y las de sprint marcadas.
//  6. Cabecera con equipo, temporada, ronda y saldo, y las seis pestañas en su orden.
//  7. Revisión en el navegador a 1280×720, 1366×768 y 1920×1080 (manual; en el dashboard).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const hub = await server.ssrLoadModule('/src/simulation/Hub.ts');
  const accents = await server.ssrLoadModule('/src/data/teamAccents.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const sp = await server.ssrLoadModule('/src/simulation/Sponsors.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const PLAYER = 'astonmartin', TEAM_IDS = Object.keys(TEAMS);
  const fresh = management.startManagement(PLAYER);
  const allDrivers = Object.keys(DRIVERS).reduce((state, id) => comps.ensureDriver(state, id), comps.emptyComponents());
  const input = changes => ({ teamId: PLAYER, management: fresh, program: dev.emptyProgram(), components: allDrivers, raceIndex: 0, ...changes });
  const ids = list => list.map(item => item.id);

  await test('T4.3: pendientes de tu decisión', () => {
    // Una partida recién empezada: dos huecos de desarrollo libres y un hueco de patrocinio con ofertas.
    const start = hub.pendingDecisions(input({}));
    assert(ids(start).includes('desarrollo-libre') && ids(start).includes('patrocinio') && start.every(item => item.title && item.detail && ['equipo', 'fabrica', 'finanzas', 'temporada', 'correr'].includes(item.section)),
      'T4.3: al empezar avisa del hueco de desarrollo y de las ofertas de patrocinio, cada aviso con su texto y su pestaña', ids(start).join());
    // Todo resuelto: proyectos en marcha y patrocinio firmado.
    let program = dev.emptyProgram();
    for (const key of ['suelo', 'alerones']) program = dev.startProject(program, PLAYER, key, 0, 5).program;
    const signed = { ...fresh, sponsors: sp.signSponsor(fresh.sponsors, PLAYER, fresh.sponsors.teams[PLAYER].offers[0].id).state };
    assert(hub.pendingDecisions(input({ program, management: signed })).length === 0, 'T4.3: sin nada que decidir, la lista queda vacía');
    const ready = hub.pendingDecisions(input({ program, management: signed, raceIndex: 30 }));
    assert(ids(ready).filter(id => id.startsWith('mejora-')).length === 2 && ready[0].section === 'fabrica' && /montar/i.test(ready[0].title), 'T4.3: una mejora fabricada avisa de que está lista para montar', JSON.stringify(ready[0]));
    const worn = { ...allDrivers, units: allDrivers.units.map(unit => (unit.driverId === 'alonso' && unit.type === 'ICE' ? { ...unit, races: comps.NOMINAL_RACES.ICE + 2, firstUsedRace: 0 } : unit)) };
    const risk = hub.pendingDecisions(input({ program, management: signed, components: worn }));
    assert(risk.length === 1 && risk[0].id.startsWith('componente-') && risk[0].section === 'fabrica' && risk[0].detail.includes('ALO'), 'T4.3: un componente pasado de su vida avisa del riesgo de avería, con su piloto', JSON.stringify(risk));
    const rival = { ...allDrivers, units: allDrivers.units.map(unit => (unit.driverId === 'norris' && unit.type === 'ICE' ? { ...unit, races: comps.NOMINAL_RACES.ICE + 2 } : unit)) };
    assert(hub.pendingDecisions(input({ program, management: signed, components: rival })).length === 0, 'T4.3: los componentes de los rivales no son asunto tuyo');
    const tired = { ...signed, pitCrews: { ...signed.pitCrews, teams: { ...signed.pitCrews.teams, [PLAYER]: { ...signed.pitCrews.teams[PLAYER], fatigue: 85 } } } };
    assert(ids(hub.pendingDecisions(input({ program, management: tired }))).join() === 'boxes-fatiga', 'T4.3: un equipo de boxes muy fatigado avisa en la pestaña Equipo');
    const broke = { ...signed, finance: finance.spend(signed.finance, PLAYER, { round: 1, kind: 'obra', label: 'x', amount: finance.balanceOf(signed.finance, PLAYER) + finance.FINANCE.DEBT_LIMIT }).state };
    const debt = hub.pendingDecisions(input({ program, management: broke }));
    assert(debt[0].id === 'deuda-limite' && debt[0].section === 'finanzas', 'T4.3: en el límite de deuda, ese es el primer aviso');
  });

  await test('T4.3: acento de cada equipo', () => {
    const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    const redness = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return r > 200 && g < 90 && b < 90; };
    const list = TEAM_IDS.map(id => [id, accents.teamAccent(id)]);
    assert(list.every(([, color]) => /^#[0-9a-f]{6}$/i.test(color) && contrast(color, '#0d1117') >= 4.5), 'T4.3: el acento de los diez equipos se lee sobre el fondo grafito', list.map(([id, color]) => `${id} ${color} ${contrast(color, '#0d1117').toFixed(1)}`).join(' · '));
    assert(list.every(([, color]) => !redness(color)) && redness(TEAMS.ferrari.color), 'T4.3: ningún acento es rojo (el rojo es de la acción principal); Ferrari usa otro color');
    assert(accents.teamAccent('mclaren').toLowerCase() === TEAMS.mclaren.color.toLowerCase() && /^#[0-9a-f]{6}$/i.test(accents.teamAccent('no-existe')), 'T4.3: un equipo cuyo color ya se lee lo conserva, y uno desconocido recibe un acento neutro');
  });

  await test('T4.3: piezas del centro de gestión', async () => {
    const noop = () => {};
    const pending = hub.pendingDecisions(input({}));
    const home = await render('/src/components/HubHome.tsx', 'HubHome', {
      next: { round: 7, circuitName: 'Circuit de Monaco', laps: 78, rainPercent: 15, sprint: false }, pending, onGo: noop,
      status: [{ label: 'Campeonato', value: 'P5 · 88 pts', detail: 'ALO 7.º', section: 'temporada' }, { label: 'Finanzas', value: '12,4 M', detail: 'sin deuda', section: 'finanzas' }, { label: 'Fábrica', value: 'Suelo: lista', detail: '', section: 'fabrica' }, { label: 'Equipo', value: 'Boxes nivel 3', detail: '', section: 'equipo' }],
    });
    assert(/ronda 7 de 24/i.test(home) && home.includes('Circuit de Monaco') && /78 vueltas/.test(home) && /lluvia 15\s*%/i.test(home) && /Preparar carrera/.test(home), 'T4.3: Inicio enseña la ronda que toca con su previsión y el botón para prepararla', home.slice(0, 200));
    assert(pending.every(item => home.includes(item.title)) && new RegExp(`\\(${pending.length}\\)`).test(home) && ['Campeonato', 'Finanzas', 'Fábrica', 'Equipo'].every(label => home.includes(label)) && home.includes('P5 · 88 pts'),
      'T4.3: Inicio enseña los pendientes con su número y las cuatro tarjetas de estado');
    const calm = await render('/src/components/HubHome.tsx', 'HubHome', { next: null, pending: [], status: [], onGo: noop });
    assert(/Nada pendiente/.test(calm) && /Temporada completa/.test(calm) && !/Preparar carrera/.test(calm), 'T4.3: sin pendientes ni ronda por correr, Inicio lo dice y no ofrece preparar carrera');

    const drivers = TEAMS[PLAYER].drivers.map(id => ({ id, code: DRIVERS[id].code, name: DRIVERS[id].lastName, number: DRIVERS[id].number }));
    const weekend = await render('/src/components/RaceWeekendPanel.tsx', 'RaceWeekendPanel', {
      round: { round: 2, circuitName: 'Shanghai International Circuit', laps: 56, rainPercent: 28, sprint: true }, sessions: hub.weekendSessions('sprint', false), drivers, followedId: drivers[1].id,
      onFollow: noop, launchLabel: 'Clasificación sprint y sprint', onStart: noop,
    });
    assert(/ronda 2 de 24/i.test(weekend) && weekend.includes('Shanghai International Circuit') && /lluvia 28\s*%/i.test(weekend) && drivers.every(driver => weekend.includes(driver.code)) && (weekend.match(/aria-pressed="true"/g) ?? []).length === 1,
      'T4.3: Correr enseña la ronda, la previsión y los dos pilotos, con el seguido marcado');
    assert(['Clasificación sprint', 'Sprint', 'Clasificación', 'Carrera'].every(name => weekend.includes(name)) && (weekend.match(/data-primary/g) ?? []).length === 1 && /Clasificación sprint y sprint/.test(weekend), 'T4.3: las sesiones del fin de semana van como pasos y hay un solo botón rojo');
    assert(hub.weekendSessions('directo', false).map(s => s.name).join() === 'Carrera' && hub.weekendSessions('clasificacion', false).map(s => s.name).join() === 'Clasificación,Carrera'
      && hub.weekendSessions('clasificacion', true).filter(s => s.done).map(s => s.name).join() === 'Clasificación sprint,Sprint' && hub.weekendSessions('sprint', false).filter(s => s.current).length === 1,
      'T4.3: las sesiones dependen del formato, y tras el sprint quedan hechas las suyas');

    let championship = champ.emptyChampionship();
    const row = (code, position) => ({ driverCode: code, driverName: code, teamId: 'mclaren', teamName: 'McLaren', position, points: 25 });
    championship = { version: 1, races: [{ id: 'gp1', circuitId: 'melbourne', format: 'gp', rows: [row('NOR', 1)] }] };
    const rounds = season.calendarView(championship, { version: 1, skipped: [3] });
    const strip = await render('/src/components/SeasonStrip.tsx', 'SeasonStrip', { rounds });
    assert((strip.match(/data-round=/g) ?? []).length === 24 && (strip.match(/data-status="siguiente"/g) ?? []).length === 1 && /data-round="2"[^>]*data-status="siguiente"/.test(strip) && /data-round="1"[^>]*data-status="disputada"/.test(strip) && /data-round="3"[^>]*data-status="saltada"/.test(strip),
      'T4.3: la franja enseña las 24 rondas con su estado y resalta la que toca');
    assert(strip.includes('NOR') && (strip.match(/data-sprint/g) ?? []).length === rounds.filter(r => r.sprint).length && rounds.filter(r => r.sprint).length === 6, 'T4.3: las rondas disputadas llevan su ganador y las de sprint van marcadas');

    const header = await render('/src/components/HubHeader.tsx', 'HubHeader', { teamName: 'Aston Martin', seasonNumber: 2, round: 7, kpis: [{ label: 'saldo', value: '12,4 M' }, { label: 'constructores', value: 'P5' }], section: 'finanzas', onSection: noop });
    const order = ['Inicio', 'Equipo', 'Fábrica', 'Finanzas', 'Temporada', 'Correr'].map(label => header.indexOf(`>${label}<`));
    assert(header.includes('Aston Martin') && /Temporada 2/.test(header) && /ronda 7 de 24/i.test(header) && header.includes('12,4 M') && header.includes('P5'), 'T4.3: la cabecera dice el equipo, la temporada, la ronda y el saldo', header.slice(0, 200));
    assert(order.every(index => index >= 0) && order.every((index, i) => i === 0 || index > order[i - 1]) && (header.match(/aria-selected="true"/g) ?? []).length === 1 && /aria-selected="true"[^>]*>(<svg[\s\S]*?<\/svg>)?Finanzas</.test(header),
      'T4.3: las seis pestañas van en su orden, con «Correr» la última, y la activa marcada', order.join());
  });
}
