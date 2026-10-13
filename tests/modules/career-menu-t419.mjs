// T4.19 — Menú de partidas, partida nueva y carrera libre (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día, tras aprobar la maqueta (con iconos y los
// coches en 3D). Tests proporcionados: la lógica que protege una función (qué ofrece el menú, cómo nace una partida,
// qué resume una ranura, qué piloto lleva el jugador) y un renderizado por página; el recorrido se revisa en navegador.
//  1. Menú: sin partida en curso ni guardadas solo se ofrece empezar una o correr una carrera libre; con ellas, también
//     continuar y cargar.
//  2. Partida nueva: se elige equipo (no piloto); nace con el campeonato vacío, los saldos iniciales, ese equipo y uno
//     de sus pilotos, en la ronda 1, y es una partida válida.
//  3. El resumen de una ranura dice equipo, temporada, puesto en constructores y saldo; una partida anterior, sin
//     gestión, se resume con el equipo de su piloto y el saldo inicial.
//  4. Una partida anterior guardada en el navegador se reconoce como partida en curso.
//  5. En la carrera profesional el jugador lleva a los pilotos de su equipo.
//  6. Renderizado: menú, partidas, elegir equipo y menú «Partida».
//  7. La carrera libre no toca la partida ni el autoguardado, y el recorrido completo: revisión en el navegador.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const career = await server.ssrLoadModule('/src/simulation/Career.ts');
  const saves = await server.ssrLoadModule('/src/simulation/SaveGame.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const driverDev = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const TEAM_IDS = Object.keys(TEAMS);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const saveOf = (teamId, name = 'Mi carrera') => { const fresh = career.newCareer(teamId, name, 7); return saves.createSave({ name: fresh.name, savedAt: '2026-10-09T10:00:00.000Z', career: fresh.career, selection: fresh.selection, race: null }); };
  const summaryOf = save => saves.summarize(save, 'n:x', false, 1000);

  await test('T4.19: lo que ofrece el menú', () => {
    const slot = summaryOf(saveOf('williams'));
    assert(same(career.menuOptions(null, []), ['nueva', 'libre']), 'T4.19: sin partidas, el menú ofrece empezar una carrera profesional o correr una carrera libre', career.menuOptions(null, []).join());
    assert(same(career.menuOptions(slot, []), ['continuar', 'nueva', 'libre']) && same(career.menuOptions(null, [slot]), ['nueva', 'cargar', 'libre']) && same(career.menuOptions(slot, [slot]), ['continuar', 'nueva', 'cargar', 'libre']),
      'T4.19: con partida en curso se puede continuar y con partidas guardadas, cargar');
  });

  await test('T4.19: una partida nueva nace de un equipo', () => {
    for (const teamId of TEAM_IDS) {
      const fresh = career.newCareer(teamId, '  Mi carrera  ', 7);
      const ok = fresh.name === 'Mi carrera' && fresh.career.championship.races.length === 0 && fresh.career.archive.length === 0 && fresh.career.history.length === 0
        && fresh.career.management.playerTeamId === teamId && fresh.career.management.seed === 7 && finance.balanceOf(fresh.career.management.finance, teamId) === finance.startBalance(teamId)
        && TEAMS[teamId].drivers.includes(fresh.selection.driverId) && fresh.selection.circuitId === SEASON_CALENDAR[0].circuitId
        && Object.keys(DRIVERS).every(id => fresh.career.components.units.some(unit => unit.driverId === id));
      if (!ok) { assert(false, `T4.19: partida nueva con ${teamId}`, JSON.stringify(fresh.selection)); return; }
    }
    assert(true, 'T4.19: con cualquiera de los diez equipos la partida nace vacía, con los saldos iniciales, ese equipo, uno de sus pilotos y la ronda 1');
    assert(TEAM_IDS.every(teamId => saves.validateSave(saveOf(teamId)).length === 0), 'T4.19: la partida nueva es una partida válida para guardar');
    assert(career.newCareer('ferrari', '', 1).name.length > 0 && career.newCareer('no-existe', 'x', 1).career.management.playerTeamId in TEAMS, 'T4.19: sin nombre recibe uno, y un equipo desconocido no rompe la partida');
    const levels = TEAM_IDS.map(career.teamDifficulty);
    assert(levels.every(level => ['Baja', 'Media', 'Alta'].includes(level)) && career.teamDifficulty('mclaren') === 'Baja' && career.teamDifficulty('sauber') === 'Alta', 'T4.19: cada equipo tiene su dificultad: baja con los mejores coches y alta con los peores', levels.join());
  });

  await test('T4.19: el resumen de una ranura', () => {
    const fresh = summaryOf(saveOf('williams'));
    assert(fresh.team?.id === 'williams' && fresh.team.name === TEAMS.williams.shortName && fresh.season === 1 && fresh.position === null && fresh.balance === finance.startBalance('williams') && fresh.raceNumber === 1,
      'T4.19: el resumen dice equipo, temporada, ronda y saldo; sin carreras aún no hay puesto', JSON.stringify(fresh));
    // Una carrera en la que gana un piloto del equipo: primero en constructores.
    const save = saveOf('williams');
    const rows = Object.values(DRIVERS).sort((a, b) => Number(b.teamId === 'williams') - Number(a.teamId === 'williams')).map((driver, i) => ({ driverCode: driver.code, driverName: driver.lastName, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name, position: i + 1, points: Math.max(0, 25 - i * 3) }));
    const raced = summaryOf({ ...save, career: { ...save.career, championship: { version: 1, races: [{ id: 'gp1', circuitId: 'melbourne', format: 'gp', rows }] } } });
    assert(raced.position === 1 && raced.raceNumber === 2, 'T4.19: con carreras, el resumen dice el puesto del equipo en constructores', JSON.stringify(raced));
    const old = saves.createSave({ name: 'Anterior', savedAt: '2026-10-01T10:00:00.000Z', race: null,
      career: { championship: champ.emptyChampionship(), development: driverDev.emptyDevelopment(), components: comps.emptyComponents(), program: dev.emptyProgram(), archive: [], history: [] },
      selection: { driverId: 'alonso', circuitId: 'melbourne', raceFormat: 'directo', weatherScenarioId: 'seco', luckVariant: true } });
    const legacy = summaryOf(old);
    assert(legacy.team?.id === DRIVERS.alonso.teamId && legacy.balance === finance.startBalance(DRIVERS.alonso.teamId) && legacy.season === 1, 'T4.19: una partida anterior se resume con el equipo de su piloto y el saldo inicial');
  });

  await test('T4.19: partida en curso y pilotos del jugador', () => {
    const storage = values => ({ getItem: key => values[key] ?? null });
    assert(!career.hasStoredCareer(storage({})) && !career.hasStoredCareer(storage({ 'f1sim.landingCompound': 'soft', f1_d20_variant: 'on' })), 'T4.19: un navegador sin partida no tiene nada que continuar');
    assert(career.hasStoredCareer(storage({ [career.CAREER_NAME_KEY]: 'Mi carrera' })) && career.hasStoredCareer(storage({ f1_championship: JSON.stringify({ version: 1, races: [{ id: 'x' }] }) })) && career.hasStoredCareer(storage({ f1_management: '{}' })),
      'T4.19: una partida empezada, o una anterior guardada en el navegador, se reconoce como partida en curso');
    assert(!career.hasStoredCareer(storage({ f1_championship: JSON.stringify({ version: 1, races: [] }) })), 'T4.19: un campeonato vacío sin más no es una partida en curso');
    const pair = TEAMS.astonmartin.drivers;
    assert(career.careerDriver('astonmartin', pair[1]) === pair[1] && career.careerDriver('astonmartin', 'norris') === pair[0] && career.careerDriver('astonmartin', 'no-existe') === pair[0],
      'T4.19: en la carrera profesional el piloto seguido es de tu equipo; uno de otro equipo no se puede elegir');
  });

  await test('T4.19: páginas', async () => {
    const current = summaryOf(saveOf('astonmartin')), other = { ...summaryOf(saveOf('williams', 'Prueba lluvia')), id: 'n:prueba', raceInProgress: { circuitId: 'monaco', lap: 16, totalLaps: 78, finished: false } };
    const noop = () => {};
    const empty = await render('/src/components/GameMenuScreen.tsx', 'GameMenuScreen', { current: null, slots: [], onContinue: noop, onNew: noop, onLoad: noop, onFree: noop });
    assert(/Nueva carrera profesional/.test(empty) && /Carrera libre/.test(empty) && !/Continuar/.test(empty) && !/Cargar partida/.test(empty), 'T4.19: sin partidas, el menú no enseña «Continuar» ni «Cargar partida»');
    const menu = await render('/src/components/GameMenuScreen.tsx', 'GameMenuScreen', { current, slots: [current, other], onContinue: noop, onNew: noop, onLoad: noop, onFree: noop });
    assert(/Continuar/.test(menu) && menu.includes(TEAMS.astonmartin.shortName) && /Temporada 1/.test(menu) && /ronda 1 de 24/i.test(menu) && menu.includes(finance.formatMoney(current.balance)) && /Cargar partida/.test(menu) && /2 guardadas/.test(menu),
      'T4.19: con partida en curso, «Continuar» dice equipo, temporada, ronda y saldo, y «Cargar partida» cuántas hay', menu.slice(0, 200));
    const list = await render('/src/components/SavesScreen.tsx', 'SavesScreen', { slots: [current, other], onLoad: noop, onExport: noop, onImport: noop, onDelete: noop, onBack: noop });
    assert(list.includes('Mi carrera') && list.includes('Prueba lluvia') && list.includes(TEAMS.williams.shortName) && /vuelta 16 de 78/.test(list) && (list.match(/>Cargar</g) ?? []).length === 2 && /Exportar/.test(list) && /Borrar/.test(list) && /Importar/.test(list),
      'T4.19: cada partida es una tarjeta con su equipo, su estado, la carrera en curso y sus acciones', list.slice(0, 200));
    const pick = await render('/src/components/NewCareerScreen.tsx', 'NewCareerScreen', { onStart: noop, onBack: noop });
    assert(TEAM_IDS.every(teamId => pick.includes(TEAMS[teamId].shortName) && pick.includes(finance.formatMoney(finance.startBalance(teamId)))) && (pick.match(/data-team=/g) ?? []).length === 10 && (pick.match(/aria-pressed="true"/g) ?? []).length === 1 && /Empezar/.test(pick) && /Nombre de la partida/.test(pick),
      'T4.19: «Elegir equipo» enseña los diez equipos con su saldo inicial, uno elegido, el nombre de la partida y «Empezar»');
    assert(TEAM_IDS.every(teamId => TEAMS[teamId].drivers.every(id => pick.includes(DRIVERS[id].code))) && /Dificultad/.test(pick), 'T4.19: cada equipo enseña sus dos pilotos y su dificultad');
    const gameMenu = await render('/src/components/GameMenu.tsx', 'GameMenu', { savedAt: Date.now() - 12000, now: Date.now(), defaultOpen: true, onSave: noop, onSaveAs: noop, onExport: noop, onExit: noop });
    assert(/Guardado hace 12 s/.test(gameMenu) && /Partida/.test(gameMenu) && ['Guardar', 'Guardar como', 'Exportar', 'Salir al menú'].every(item => gameMenu.includes(item)), 'T4.19: el menú «Partida» dice cuándo se guardó y ofrece guardar, guardar como, exportar y salir al menú', gameMenu.slice(0, 200));
  });
}
