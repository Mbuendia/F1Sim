// T4.21, T4.22 y T4.23 — Lo pendiente de R18, R19 y R20 (Sprint 4, bloque G).
// Contrato del 13/10/2026 (el usuario pidió terminar el Sprint 4 de seguido asumiendo la opción recomendada).
// Auditoría hecha sobre el código antes de escribirlo: ya estaban cubiertos el historial de temporadas (R51), el aviso
// de sanciones en GP directo (R51), el piloto sustituto (T4.8), los daños (T4.2), la renovación de cupos al cerrar la
// temporada (T4.11), la clasificación sprint con sus neumáticos (R52), los entrenamientos (T4.13) y ver la
// clasificación en directo (V7). Aquí va lo que faltaba y se ha hecho:
//  T4.21 · retraso de un paquete de mejoras cuando la fábrica ya tiene otro en fabricación.
//  T4.22 · el escape entra en el cupo (ocho); volver a montar una unidad usada; dossier de la unidad de potencia.
//  T4.23 · se comprueba lo ya cubierto. Quedan fuera por decisión asumida: las sesiones jugables en pista y que la
//          clasificación del Gran Premio gaste juegos de neumáticos.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

export default async function run({ server, assert, test }) {
  const c = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const costs = await server.ssrLoadModule('/src/simulation/Costs.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const { startManagement } = await server.ssrLoadModule('/src/simulation/Management.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const TEAM = Object.keys(TEAMS).find(id => /aston/i.test(id));

  await test('T4.21: retraso de un paquete de mejoras', () => {
    const management = startManagement(TEAM, 1, 7);
    const keys = Object.keys(dev.PROJECTS);
    const first = costs.buyProject(management, dev.emptyProgram(), TEAM, keys[0], 0, 7, 1);
    const one = first.program.teams[TEAM].projects[0];
    assert(first.ok && one.delay === undefined && one.readyRace === one.researchEndRace + dev.PROJECTS[keys[0]].productionRaces, 'T4.21: un proyecto solo sale con los plazos de siempre');
    // Otro proyecto cuya fabricación coincide con la del primero: espera a que la fábrica quede libre.
    const sameLength = keys.find(key => key !== keys[0] && dev.PROJECTS[key].researchRaces === dev.PROJECTS[keys[0]].researchRaces) ?? keys[1];
    const second = costs.buyProject(first.management, first.program, TEAM, sameLength, 0, 7, 1);
    const two = second.program.teams[TEAM].projects[1];
    const overlap = one.researchEndRace < two.researchEndRace + dev.PROJECTS[sameLength].productionRaces && two.researchEndRace < one.readyRace;
    assert(second.ok && overlap && two.delay >= 1 && two.readyRace === one.readyRace + dev.PROJECTS[sameLength].productionRaces && two.researchEndRace >= one.researchEndRace,
      'T4.21: si la fabricación coincide con la de otro paquete, espera a que termine y el retraso queda anotado', JSON.stringify({ one: [one.researchEndRace, one.readyRace], two: [two.researchEndRace, two.readyRace, two.delay] }));
    // Empezado más tarde, sin coincidir, no hay retraso.
    const later = costs.buyProject(first.management, first.program, TEAM, sameLength, one.readyRace, 7, 1);
    assert(later.ok && later.program.teams[TEAM].projects[1].delay === undefined, 'T4.21: sin coincidencia no hay retraso');
    assert(JSON.stringify(costs.withProductionQueue(dev.emptyProgram(), TEAM)) === JSON.stringify(dev.emptyProgram()), 'T4.21: sin proyectos no cambia nada');
  });

  await test('T4.21: el retraso y el historial se ven', async () => {
    const { DevelopmentPanel } = await server.ssrLoadModule('/src/components/DevelopmentPanel.tsx');
    const management = startManagement(TEAM, 1, 7), keys = Object.keys(dev.PROJECTS);
    const first = costs.buyProject(management, dev.emptyProgram(), TEAM, keys[0], 0, 7, 1);
    const sameLength = keys.find(key => key !== keys[0] && dev.PROJECTS[key].researchRaces === dev.PROJECTS[keys[0]].researchRaces) ?? keys[1];
    const second = costs.buyProject(first.management, first.program, TEAM, sameLength, 0, 7, 1);
    const html = renderToStaticMarkup(createElement(DevelopmentPanel, { program: second.program, teamId: TEAM, raceIndex: 0, constructorsPosition: 7, drivers: [] }));
    assert(/retraso de \d+ carrera/.test(html), 'T4.21: el panel de desarrollo avisa del retraso del paquete', html.slice(0, 160));
    assert(existsSync(new URL('../../src/components/SeasonHistory.tsx', import.meta.url)) && /SeasonHistory/.test(source('src/components/HomeScreen.tsx')), 'T4.21: la vista del historial de temporadas ya existe (R51) y está en el paddock');
  });

  await test('T4.22: escapes, unidad usada y dossier', async () => {
    assert(c.COMPONENT_TYPES.includes('EX') && c.ALLOCATION.EX === 8 && /Escape/.test(c.COMPONENT_LABEL.EX) && c.NOMINAL_RACES.EX > 0 && costs.COSTS?.COMPONENT?.EX !== undefined || source('src/simulation/Costs.ts').includes('EX: 150'),
      'T4.22: el escape entra en el cupo, con ocho unidades por temporada y su precio');
    let state = c.ensureDriver(c.emptyComponents(), 'alonso');
    assert(state.units.filter(unit => unit.type === 'EX').length === 1 && c.penaltyForNext(state, 'alonso', 'EX') === 0, 'T4.22: cada piloto empieza con su primer escape y cambiarlo dentro del cupo no sanciona');
    for (let i = 0; i < 8; i++) state = c.markRaceStart(c.fitNew(state, 'alonso', 'EX')).state;
    assert(c.unitsUsed(state, 'alonso', 'EX') === 8 && state.units.filter(unit => unit.type === 'EX').length === 9 && c.penaltyForNext(state, 'alonso', 'EX') > 0, 'T4.22: pasado el cupo de ocho, el siguiente escape sanciona', String(c.penaltyForNext(state, 'alonso', 'EX')));
    const old = c.ensureDriver({ version: 1, race: 3, history: [], units: c.COMPONENT_TYPES.filter(type => type !== 'EX').map(type => ({ serial: `${type}-alonso-1`, type, driverId: 'alonso', ordinal: 1, races: 3, km: 900, firstUsedRace: 0, fitted: true })) }, 'alonso');
    assert(old.units.filter(unit => unit.type === 'EX').length === 1 && old.units.length === 7, 'T4.22: una partida anterior recibe su escape al cargarla, sin tocar lo demás');

    // Volver a montar una unidad usada.
    let pool = c.markRaceStart(c.ensureDriver(c.emptyComponents(), 'alonso')).state;
    pool = c.completeRace(pool, 300);
    pool = c.completeRace(c.markRaceStart(c.fitNew(pool, 'alonso', 'ICE')).state, 300);
    const [firstIce, secondIce] = c.dossierOf(pool, 'alonso').filter(unit => unit.type === 'ICE');
    assert(firstIce.ordinal === 1 && !firstIce.fitted && firstIce.races === 1 && secondIce.fitted && secondIce.races === 1, 'T4.22 (preparación): el primer motor, usado, está en el pool y el segundo, montado');
    const used = c.unitsUsed(pool, 'alonso', 'ICE');
    const back = c.refitUsed(pool, 'alonso', firstIce.serial);
    assert(c.fittedUnit(back, 'alonso', 'ICE').serial === firstIce.serial && back.units.filter(unit => unit.type === 'ICE' && unit.fitted).length === 1 && c.unitsUsed(back, 'alonso', 'ICE') === used
      && c.pendingPenalties(back).length === 0 && back !== pool && pool.units.find(unit => unit.serial === firstIce.serial).fitted === false, 'T4.22: se vuelve a montar la unidad usada sin gastar cupo ni sancionar (y sin mutar el estado anterior)');
    const fresh = c.fitNew(pool, 'alonso', 'TC');
    const unused = c.fittedUnit(fresh, 'alonso', 'TC');
    assert(c.refitUsed(pool, 'stroll', firstIce.serial) === pool && c.refitUsed(pool, 'alonso', secondIce.serial) === pool && c.refitUsed(pool, 'alonso', 'no-existe') === pool
      && c.refitUsed(c.fitNew(fresh, 'alonso', 'TC'), 'alonso', unused.serial).units.find(unit => unit.serial === unused.serial).fitted === false,
      'T4.22: no se puede montar la unidad de otro piloto, la que ya está montada, una que no existe ni una sin estrenar');
    const dossier = c.dossierOf(pool, 'alonso');
    assert(dossier.length === pool.units.length && dossier.every((unit, i) => i === 0 || c.COMPONENT_TYPES.indexOf(unit.type) > c.COMPONENT_TYPES.indexOf(dossier[i - 1].type) || (unit.type === dossier[i - 1].type && unit.ordinal > dossier[i - 1].ordinal)),
      'T4.22: el dossier lista todas las unidades del piloto, por tipo y orden');

    const { ComponentsPanel } = await server.ssrLoadModule('/src/components/ComponentsPanel.tsx');
    const driver = { id: 'alonso', code: 'ALO', firstName: 'Fernando', lastName: 'Alonso' };
    const html = renderToStaticMarkup(createElement(ComponentsPanel, { state: pool, drivers: [driver], onRefit() {} }));
    assert(/Escape \(EX\)/.test(html) && /0\/8|1\/8/.test(html) && /Dossier de la unidad de potencia de ALO/.test(html) && (html.match(/data-unit="/g) ?? []).length === pool.units.length
      && (html.match(/Volver a montar/g) ?? []).length === 1 && /300 km/.test(html) && /en el pool/.test(html), 'T4.22: el panel enseña el escape con su cupo y el dossier, con el botón de volver a montar solo en la unidad usada del pool');
    assert(/refitUsed\(components, driverId, serial\)/.test(source('src/App.tsx')), 'T4.22: la aplicación vuelve a montar la unidad elegida');
  });

  await test('T4.22 y T4.23: lo que ya estaba cubierto sigue en su sitio', async () => {
    const season = source('src/simulation/Season.ts'), app = source('src/App.tsx');
    assert(/emptyComponents\(\)/.test(season) && /closeSeason/.test(season), 'T4.22: los cupos se renuevan al cerrar la temporada (T4.11)');
    assert(/aviso-sanciones/.test(app) && /gridPenaltyLines/.test(app), 'T4.22: las sanciones por componentes se avisan antes de la salida en GP directo (R51)');
    assert(/standIns|onStandIn/.test(app) && /raceDamages/.test(app), 'T4.22: el piloto sustituto (T4.8) y los daños de carrera (T4.2) siguen conectados');
    const q = await server.ssrLoadModule('/src/simulation/Qualifying.ts');
    assert(JSON.stringify(q.QUALIFYING.COMPOUNDS.sprint) === JSON.stringify({ q1: 'medium', q2: 'medium', q3: 'soft' }), 'T4.23: la clasificación sprint usa los neumáticos de S30.5 (R52)');
    assert(/<PracticePanel/.test(app) && /<QualifyingLive/.test(app), 'T4.23: los entrenamientos libres (T4.13) y la clasificación en directo (V7) están en la aplicación');
    const dashboard = source('DASHBOARD.md');
    assert(/T4\.23[^\n]*\n(?:[^\n]*\n){0,12}[^\n]*sesiones jugables en pista[^\n]*(descart|fuera|no se hace)/i.test(dashboard), 'T4.23: lo que queda fuera (sesiones jugables en pista) está anotado como decisión en el dashboard');
  });
}
