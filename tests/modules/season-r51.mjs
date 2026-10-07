// R51 — Temporada visible (contrato aprobado por el usuario el 07/10/2026).
//  1. Calendario de 24 rondas en orden, cada una con un circuito del juego; la ronda que toca sale de las disputadas y
//     saltadas; disputar o saltar avanza a la siguiente; se guarda y se carga, también en partidas guardadas antiguas.
//  2. Cierre: tras la última ronda se archiva el resumen (campeones, puntos, podio y puesto del jugador), se reinician
//     campeonato, componentes y desarrollo como hasta ahora, y la pantalla de cierre y el historial lo muestran.
//  3. Sanciones: en GP directo la carrera no empieza hasta que el jugador ve quién pierde puestos, cuántos y por qué
//     componente; sin sanciones no aparece nada.
//  4. La ficha del paddock muestra los ocho atributos del piloto con su valor actual y lo ganado.
//  5. Un test de interfaz por pieza: calendario, cierre, historial, aviso de sanciones y ficha.
//  6. Revisión en el navegador (manual; se anota en el dashboard).
// Decisiones del usuario: Barcelona acoge dos rondas (la de Madrid, que el juego no tiene); elegir otro circuito es una
// carrera libre que no cuenta (ni puntos, ni componentes, ni desarrollo); saltar un Gran Premio es no disputarlo.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const driverDev = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const saves = await server.ssrLoadModule('/src/simulation/SaveGame.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { classify, constructorStandings, POINTS_2025 } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const alonso = DRIVERS.alonso;
  const rivals = Object.values(DRIVERS).filter(d => d.teamId !== alonso.teamId).slice(0, 2);
  /** Resultado final con los pilotos en ese orden de llegada. */
  const finalResult = (order, status = 'final') => {
    const rows = classify(order.map((driver, i) => ({
      carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name,
      laps: 66, timeSec: 6000 + i, penaltySec: 0, retired: false, dsq: false, progress: 66,
    })), { totalLaps: 66, suspended: false, greenLaps: 60 });
    return { status, endReason: 'distancia', rows, pointsTable: POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
  };
  const win = finalResult([alonso, ...rivals]);
  const circuitOf = round => SEASON_CALENDAR[round - 1].circuitId;
  /** Campeonato con las `count` primeras rondas no saltadas ya disputadas. */
  const played = (count, skipped = []) => {
    let championship = champ.emptyChampionship(), round = 1;
    for (let i = 0; i < count; i++) {
      while (skipped.includes(round)) round++;
      championship = champ.addRace(championship, `gp${i}`, circuitOf(round), win);
      round++;
    }
    return championship;
  };
  const skippedState = rounds => ({ version: 1, skipped: rounds });

  await test('R51: calendario de 24 rondas y avance', () => {
    assert(SEASON_CALENDAR.length === 24 && season.SEASON_RACES === 24, 'R51: 24 rondas');
    assert(SEASON_CALENDAR.every((entry, i) => entry.round === i + 1), 'R51: rondas numeradas en orden');
    assert(SEASON_CALENDAR.every(entry => OFFICIAL_CIRCUITS[entry.circuitId]), 'R51: cada ronda usa un circuito del juego');
    const uses = id => SEASON_CALENDAR.filter(entry => entry.circuitId === id);
    assert(Object.keys(OFFICIAL_CIRCUITS).every(id => uses(id).length >= 1), 'R51: todos los circuitos del juego están en el calendario');
    assert(uses('barcelona').length === 2 && Object.keys(OFFICIAL_CIRCUITS).filter(id => id !== 'barcelona').every(id => uses(id).length === 1),
      'R51: solo Barcelona acoge dos rondas (decisión del usuario)');
    const substitutes = SEASON_CALENDAR.filter(entry => entry.substitutes);
    assert(substitutes.length === 1 && substitutes[0] === uses('barcelona')[1] && /Madrid/.test(substitutes[0].substitutes), 'R51: la segunda ronda de Barcelona sustituye a Madrid y queda anotado');

    const start = champ.emptyChampionship(), none = season.emptySeason();
    assert(season.nextRound(start, none).round === 1 && season.seasonRaceNumber(start, none) === 1, 'R51: la temporada empieza en la ronda 1');
    const fresh = season.calendarView(start, none);
    assert(fresh.length === 24 && fresh[0].status === 'siguiente' && fresh.slice(1).every(r => r.status === 'pendiente'), 'R51: al empezar, la primera es la siguiente y el resto están pendientes');

    const one = played(1);
    assert(season.nextRound(one, none).round === 2, 'R51: disputar una ronda avanza a la siguiente');
    const afterRace = season.calendarView(one, none);
    assert(afterRace[0].status === 'disputada' && afterRace[0].winner?.driverCode === 'ALO' && afterRace[1].status === 'siguiente', 'R51: la ronda disputada guarda su ganador');

    const skipped = season.skipRound(one, none);
    assert(JSON.stringify(skipped.skipped) === '[2]' && none.skipped.length === 0, 'R51: saltar anota la ronda que tocaba (sin tocar el estado anterior)');
    assert(season.nextRound(one, skipped).round === 3 && season.seasonRaceNumber(one, skipped) === 3, 'R51: saltar avanza a la siguiente');
    const afterSkip = season.calendarView(one, skipped);
    assert(afterSkip[1].status === 'saltada' && afterSkip[2].status === 'siguiente' && afterSkip.filter(r => r.status === 'siguiente').length === 1, 'R51: la ronda saltada queda marcada');
    assert(JSON.stringify(champ.driverStandings(one)) === JSON.stringify(champ.driverStandings(played(1))), 'R51: saltar no da puntos a nadie');
    const second = champ.addRace(one, 'gp-x', circuitOf(3), win);
    const view = season.calendarView(second, skipped);
    assert(view[2].status === 'disputada' && view[3].status === 'siguiente', 'R51: tras una ronda saltada, la carrera siguiente ocupa su ronda');

    // Carrera libre: solo cuenta el circuito de la ronda que toca.
    assert(season.isSeasonRace(circuitOf(3), one, skipped) && !season.isSeasonRace(circuitOf(5), one, skipped), 'R51: solo el circuito de la ronda que toca cuenta para la temporada');
    const first = uses('barcelona')[0].round, again = uses('barcelona')[1].round;
    const upTo = round => skippedState(Array.from({ length: round - 1 }, (_, i) => i + 1));
    assert(!season.isSeasonRace('barcelona', start, none), 'R51: Barcelona fuera de su ronda es carrera libre');
    assert(season.isSeasonRace('barcelona', start, upTo(first)) && season.isSeasonRace('barcelona', start, upTo(again)), 'R51: Barcelona cuenta en sus dos rondas');

    const last = played(23);
    assert(!season.seasonComplete(last, none) && season.nextRound(last, none).round === 24, 'R51: con 23 rondas la temporada sigue');
    const closedBySkip = season.skipRound(last, none);
    assert(season.seasonComplete(last, closedBySkip) && season.nextRound(last, closedBySkip) === null, 'R51: saltar la última ronda completa la temporada');
    assert(season.skipRound(last, closedBySkip).skipped.length === 1 && !season.isSeasonRace('barcelona', last, closedBySkip), 'R51: con la temporada completa no hay más rondas que saltar ni correr');
    assert(season.seasonComplete(played(24)) && season.seasonComplete(played(24), none), 'R51: 24 rondas disputadas completan la temporada (también sin estado de saltos, como en R18)');
    assert(season.seasonComplete(played(20, [3, 7, 11, 19]), skippedState([3, 7, 11, 19])), 'R51: disputadas y saltadas suman las 24');
  });

  await test('R51: la temporada se guarda y se carga', () => {
    const state = skippedState([2, 3]);
    assert(JSON.stringify(season.parseSeason(JSON.stringify(state))) === JSON.stringify(state), 'R51: el estado de la temporada se guarda y se recupera');
    assert(season.parseSeason(null).skipped.length === 0 && season.parseSeason('x').skipped.length === 0 && season.parseSeason('{"version":9}').skipped.length === 0, 'R51: un guardado ilegible empieza sin saltos');
    assert(JSON.stringify(season.parseSeason('{"version":1,"skipped":[5,0,99,"a",2,2,3.5]}').skipped) === '[2,5]', 'R51: solo valen rondas del calendario, sin repetir y en orden');

    const career = {
      championship: played(1), development: driverDev.emptyDevelopment(), components: comps.ensureDriver(comps.emptyComponents(), 'alonso'),
      program: dev.emptyProgram(), archive: [], history: [],
    };
    const selection = { driverId: 'alonso', circuitId: 'monza', raceFormat: 'directo', weatherScenarioId: 'seco', luckVariant: false };
    const old = saves.createSave({ name: 'Antigua', savedAt: '2026-10-07T10:00:00.000Z', career, selection, race: null });
    assert(saves.validateSave(old).length === 0 && saves.savedSeason(old).skipped.length === 0 && saves.savedRaceCounts(old) === true,
      'R51: una partida anterior se lee sin saltos y con su carrera puntuable');
    const current = saves.createSave({ name: 'Nueva', savedAt: '2026-10-07T10:00:00.000Z', career: { ...career, season: state }, selection: { ...selection, counts: false }, race: null });
    assert(saves.validateSave(current).length === 0, 'R51: la partida con temporada es válida', saves.validateSave(current).join(' · '));
    const back = saves.importSave(saves.exportSave(current)).save;
    assert(back && JSON.stringify(saves.savedSeason(back)) === JSON.stringify(state) && saves.savedRaceCounts(back) === false, 'R51: la partida conserva las rondas saltadas y si la carrera cuenta');
    assert(saves.summarize(current, 'x', false, 10).raceNumber === 4 && saves.summarize(old, 'y', false, 10).raceNumber === 2, 'R51: la ranura enseña la ronda del calendario contando las saltadas');
    const broken = { ...current, career: { ...current.career, season: { version: 1, skipped: 'ninguna' } } };
    assert(saves.validateSave(broken).some(error => /temporada/i.test(error)), 'R51: una temporada mal formada se rechaza con su motivo');
  });

  await test('R51: carrera puntuable, carrera libre y Gran Premio saltado', () => {
    const components = comps.markRaceStart(comps.ensureDriver(comps.emptyComponents(), 'alonso')).state;
    const career = { championship: champ.emptyChampionship(), components, program: dev.emptyProgram(), season: season.emptySeason(), archive: [] };
    const race = { id: 'gp-a', circuitId: circuitOf(1), result: win, format: 'gp', raceKm: 300, playerCodes: ['ALO'] };

    const free = season.settleRace(career, { ...race, counts: false, circuitId: 'monza' });
    assert(free.championship === career.championship && free.components === career.components && free.program === career.program && free.season === career.season
      && free.archive === career.archive && free.closed === null, 'R51: la carrera libre no cambia campeonato, componentes, desarrollo ni temporada');

    const counted = season.settleRace(career, { ...race, counts: true });
    assert(counted.championship.races.length === 1 && counted.championship.races[0].circuitId === circuitOf(1) && counted.closed === null, 'R51: la carrera puntuable suma al campeonato');
    assert(comps.fittedUnit(counted.components, 'alonso', 'ICE').races === 1 && comps.fittedUnit(career.components, 'alonso', 'ICE').races === 0, 'R51: la carrera puntuable gasta los componentes montados');
    const provisional = season.settleRace(career, { ...race, counts: true, result: finalResult([alonso, ...rivals], 'provisional') });
    assert(provisional.championship === career.championship && provisional.components === career.components, 'R51: un resultado sin confirmar no se anota');

    const almost = { ...career, championship: played(23) };
    const closing = season.settleRace(almost, { ...race, id: 'gp-24', circuitId: circuitOf(24), counts: true });
    assert(closing.closed && closing.closed.races === 24 && closing.closed.champion === 'ALO', 'R51: la ronda 24 cierra la temporada');
    assert(closing.championship.races.length === 0 && closing.season.skipped.length === 0 && closing.archive.length === 1 && closing.archive[0] === closing.closed,
      'R51: al cerrar se archiva el resumen y empieza una temporada nueva');

    const skipped = season.settleSkip({ ...career, championship: played(22) }, ['ALO']);
    assert(skipped.closed === null && JSON.stringify(skipped.season.skipped) === '[23]' && skipped.championship.races.length === 22, 'R51: saltar una ronda intermedia no cierra la temporada');
    const skippedLast = season.settleSkip(almost, ['ALO']);
    assert(skippedLast.closed && skippedLast.closed.races === 23 && skippedLast.closed.skipped === 1 && skippedLast.season.skipped.length === 0 && skippedLast.archive.length === 1,
      'R51: saltar la última ronda cierra la temporada y lo anota');
  });

  await test('R51: cierre de temporada, pantalla e historial', async () => {
    let championship = champ.emptyChampionship();
    const order = [[alonso, ...rivals], [rivals[0], alonso, rivals[1]]];
    for (let i = 0; i < 24; i++) championship = champ.addRace(championship, `gp${i}`, circuitOf(i + 1), finalResult(order[i < 16 ? 0 : 1]));
    const standings = champ.driverStandings(championship), teams = champ.constructorsChampionship(championship);
    const legacy = { season: 1, races: 24, champion: 'VER', constructorsChampion: 'McLaren' };
    const components = comps.markRaceStart(comps.fitNew(comps.markRaceStart(comps.ensureDriver(comps.emptyComponents(), 'alonso')).state, 'alonso', 'ICE')).state;
    const program = dev.startProject(dev.emptyProgram(), alonso.teamId, 'suelo', 0, 7).program;
    const closed = season.closeSeason({ championship, components, program, archive: [legacy], season: skippedState([]), playerCodes: ['ALO', rivals[1].code] });
    const summary = closed.summary;

    assert(closed.archive.length === 2 && closed.archive[0] === legacy && closed.archive[1] === summary && summary.season === 2 && summary.races === 24, 'R51: el resumen se añade al historial');
    assert(summary.champion === 'ALO' && summary.championName === 'Fernando Alonso' && summary.championPoints === standings[0].points, 'R51: campeón de pilotos con sus puntos');
    assert(summary.constructorsChampion === teams[0].teamName && summary.constructorsPoints === teams[0].points, 'R51: campeón de constructores con sus puntos');
    assert(summary.drivers.length === standings.length && summary.drivers.slice(0, 3).map(d => d.driverCode).join() === standings.slice(0, 3).map(d => d.driverCode).join()
      && summary.drivers[1].points === standings[1].points, 'R51: clasificación final con el podio del campeonato');
    assert(summary.teams.length === teams.length && summary.teams[0].points === teams[0].points, 'R51: clasificación final de constructores');
    const mine = Object.fromEntries(summary.player.map(p => [p.driverCode, p]));
    assert(mine.ALO.position === 1 && mine.ALO.points === standings[0].points && mine[rivals[1].code].position === 3, 'R51: puesto final de los pilotos del jugador');
    assert(closed.championship.races.length === 0 && comps.unitsUsed(closed.components, 'alonso', 'ICE') === 0 && Object.keys(closed.program.teams).length === 0 && closed.season.skipped.length === 0,
      'R51: campeonato, componentes, desarrollo y saltos empiezan de cero, como hasta ahora');
    assert(JSON.stringify(season.parseArchive(JSON.stringify(closed.archive))) === JSON.stringify(closed.archive), 'R51: el historial con resúmenes nuevos y antiguos se guarda y se recupera');

    const screen = await render('/src/components/SeasonEndScreen.tsx', 'SeasonEndScreen', { summary, onContinue: () => {} });
    assert(/Fin de la temporada 2/.test(screen) && /Campeón de pilotos/.test(screen) && /Fernando Alonso/.test(screen) && screen.includes(`${summary.championPoints} puntos`),
      'R51: la pantalla de cierre muestra al campeón de pilotos con sus puntos');
    assert(/Campeón de constructores/.test(screen) && screen.includes(summary.constructorsChampion) && screen.includes(`${summary.constructorsPoints} puntos`), 'R51: y al de constructores');
    assert((screen.match(/<tr/g) ?? []).length >= standings.length && screen.includes(`${rivals[0].firstName} ${rivals[0].lastName}`), 'R51: con la clasificación final');
    assert(/Tus pilotos/.test(screen) && /P1/.test(screen) && /P3/.test(screen), 'R51: y el puesto de los pilotos del jugador');
    assert(/<button[^>]*>[^<]*Empezar la temporada 3/.test(screen), 'R51: desde el cierre se pasa a la temporada siguiente');
    const legacyScreen = await render('/src/components/SeasonEndScreen.tsx', 'SeasonEndScreen', { summary: legacy, onContinue: () => {} });
    assert(/Fin de la temporada 1/.test(legacyScreen) && /VER/.test(legacyScreen) && /McLaren/.test(legacyScreen), 'R51: un resumen antiguo (solo campeones) también se muestra');

    const history = await render('/src/components/SeasonHistory.tsx', 'SeasonHistory', { archive: closed.archive });
    assert(/Temporada 1/.test(history) && /Temporada 2/.test(history) && /VER/.test(history) && /McLaren/.test(history) && /Fernando Alonso/.test(history)
      && history.includes(summary.constructorsChampion), 'R51: el historial lista cada temporada con sus campeones');
    assert(history.indexOf('Temporada 2') < history.indexOf('Temporada 1'), 'R51: la temporada más reciente va primero');
    assert(await render('/src/components/SeasonHistory.tsx', 'SeasonHistory', { archive: [] }) === '', 'R51: sin temporadas cerradas no hay historial');

    const app = source('src/App.tsx');
    assert(/SeasonEndScreen/.test(app) && /settleRace\(/.test(app) && /settleSkip\(/.test(app) && /isSeasonRace\(/.test(app), 'R51: la aplicación cierra la temporada con su pantalla y distingue la carrera libre');
  });

  await test('R51: aviso de sanciones de componentes en GP directo', async () => {
    // Quinto motor de Alonso (cupo de 4): 10 puestos. Parrilla prefijada con Alonso primero.
    let state = comps.markRaceStart(comps.ensureDriver(comps.emptyComponents(), 'alonso')).state;
    for (let unit = 2; unit <= 4; unit++) state = comps.markRaceStart(comps.fitNew(state, 'alonso', 'ICE')).state;
    state = comps.fitNew(state, 'alonso', 'ICE');
    const penalties = comps.pendingPenalties(state);
    const grid = ['alonso', ...Object.keys(DRIVERS).filter(id => id !== 'alonso')];
    const moved = comps.applyGridPenalties(grid, penalties).moved;
    assert(penalties.length === 1 && moved.length === 1 && moved[0].places === comps.FIRST_EXCESS_PLACES, 'R51 (preparación): un motor fuera de cupo sanciona 10 puestos');

    assert(comps.raceStartGate(true, moved) === 'clasificacion' && comps.raceStartGate(true, []) === 'clasificacion', 'R51: con clasificación, las sanciones se ven en su pantalla (como hasta ahora)');
    assert(comps.raceStartGate(false, moved) === 'aviso-sanciones', 'R51: en GP directo con sanciones la salida espera al aviso');
    assert(comps.raceStartGate(false, []) === 'directo', 'R51: sin sanciones el GP directo empieza sin aviso');

    const driverOf = id => DRIVERS[id] && { name: `${DRIVERS[id].firstName} ${DRIVERS[id].lastName}`, code: DRIVERS[id].code };
    const lines = comps.gridPenaltyLines(moved, penalties, driverOf);
    assert(lines.length === 1 && lines[0].driverId === 'alonso' && lines[0].name === 'Fernando Alonso' && lines[0].places === 10 && lines[0].from === 1 && lines[0].to === 11 && !lines[0].backOfGrid,
      'R51: el aviso dice quién pierde puestos, cuántos y de dónde a dónde', JSON.stringify(lines));
    assert(lines[0].reasons.length === 1 && lines[0].reasons[0].includes(comps.COMPONENT_LABEL.ICE) && /5/.test(lines[0].reasons[0]), 'R51: y por qué componente', lines[0].reasons.join());

    // Además, su quinto turbo: otros 10 puestos (20 en total, más de 15).
    let two = state;
    for (let unit = 2; unit <= 5; unit++) two = comps.fitNew(two, 'alonso', 'TC');
    const both = comps.pendingPenalties(two);
    const back = comps.gridPenaltyLines(comps.applyGridPenalties(grid, both).moved, both, driverOf);
    assert(both.length === 2 && back.length === 1 && back[0].backOfGrid && back[0].reasons.length === 2 && back[0].to === grid.length, 'R51: con más de 15 puestos sale desde el fondo y se listan los dos componentes', JSON.stringify(back));
    assert(comps.gridPenaltyLines([], [], driverOf).length === 0, 'R51: sin sanciones no hay líneas de aviso');

    const notice = await render('/src/components/GridPenaltyNotice.tsx', 'GridPenaltyNotice', { lines, onContinue: () => {} });
    assert(/Sanciones de parrilla/.test(notice) && /Fernando Alonso/.test(notice) && /10 puestos/.test(notice) && /P1\b/.test(notice) && /P11/.test(notice) && notice.includes(lines[0].reasons[0]),
      'R51: el aviso se muestra con piloto, puestos, parrilla y motivo');
    assert(/<button[^>]*>[^<]*Continuar/.test(notice), 'R51: el jugador confirma el aviso para seguir');
    const backNotice = await render('/src/components/GridPenaltyNotice.tsx', 'GridPenaltyNotice', { lines: back, onContinue: () => {} });
    assert(/fondo de la parrilla/.test(backNotice), 'R51: la salida desde el fondo se dice expresamente');
    assert(await render('/src/components/GridPenaltyNotice.tsx', 'GridPenaltyNotice', { lines: [], onContinue: () => {} }) === '', 'R51: sin sanciones no aparece el aviso');

    const app = source('src/App.tsx');
    assert(/raceStartGate\(/.test(app) && /GridPenaltyNotice/.test(app), 'R51: la aplicación usa el aviso antes de la salida en GP directo');
  });

  await test('R51: atributos del piloto en la ficha del paddock', async () => {
    const base = driverDev.baseAttributes(alonso);
    const still = driverDev.attributeRows(alonso, base);
    assert(still.length === 8 && still.map(r => r.key).join() === driverDev.ATTRIBUTE_KEYS.join() && still.every(r => r.gain === 0 && r.value === base[r.key] && r.label === driverDev.ATTRIBUTE_LABEL[r.key]),
      'R51: los ocho atributos con su valor actual');
    const improved = { ...base, ritmo: base.ritmo + 3, lluvia: base.lluvia + 1.5 };
    const rows = driverDev.attributeRows(alonso, improved);
    const row = key => rows.find(r => r.key === key);
    assert(row('ritmo').gain === 3 && row('lluvia').gain === 1.5 && row('defensa').gain === 0, 'R51: lo ganado es la diferencia con el valor inicial del piloto');

    const card = await render('/src/components/DriverAttributesCard.tsx', 'DriverAttributesCard', { driver: alonso, attributes: improved });
    assert(driverDev.ATTRIBUTE_KEYS.every(key => card.includes(driverDev.ATTRIBUTE_LABEL[key])), 'R51: la ficha nombra los ocho atributos');
    assert(card.includes('+3') && card.includes('+1.5') && !card.includes('+0'), 'R51: la ficha marca solo lo ganado');
    assert(card.includes(String(Math.round(improved.ritmo * 10) / 10)), 'R51: la ficha muestra el valor actual');
    const home = source('src/components/HomeScreen.tsx');
    assert(/DriverAttributesCard/.test(home), 'R51: la ficha del paddock incluye los atributos');
  });

  await test('R51: calendario en el paddock', async () => {
    const one = played(1), skipped = season.skipRound(one, season.emptySeason());
    const rounds = season.calendarView(one, skipped), next = SEASON_CALENDAR[2];
    const props = { rounds, seasonNumber: 1, selectedCircuitId: next.circuitId, onSelectNext: () => {}, onSkip: () => {} };
    const calendar = await render('/src/components/SeasonCalendar.tsx', 'SeasonCalendar', props);
    assert(/Temporada 1/.test(calendar) && /Ronda 3 de 24/.test(calendar) && calendar.includes(OFFICIAL_CIRCUITS[next.circuitId].officialGpName), 'R51: el calendario dice qué Gran Premio toca');
    assert((calendar.match(/data-round="/g) ?? []).length === 24, 'R51: lista las 24 rondas');
    assert((calendar.match(/data-status="siguiente"/g) ?? []).length === 1 && (calendar.match(/data-status="disputada"/g) ?? []).length === 1
      && (calendar.match(/data-status="saltada"/g) ?? []).length === 1 && (calendar.match(/data-status="pendiente"/g) ?? []).length === 21, 'R51: cada ronda con su estado');
    assert(/ALO/.test(calendar) && /Saltada/.test(calendar) && /Madrid/.test(calendar), 'R51: muestra el ganador, la ronda saltada y la sustitución de Madrid');
    assert(/<button[^>]*>[^<]*Saltar este Gran Premio/.test(calendar), 'R51: el jugador puede saltar el Gran Premio');
    assert(!/Carrera libre/.test(calendar), 'R51: con el circuito de la ronda elegido no se habla de carrera libre');

    const free = await render('/src/components/SeasonCalendar.tsx', 'SeasonCalendar', { ...props, selectedCircuitId: SEASON_CALENDAR[10].circuitId });
    assert(/Carrera libre/.test(free) && /no cuenta/.test(free) && free.includes(OFFICIAL_CIRCUITS[SEASON_CALENDAR[10].circuitId].name), 'R51: con otro circuito elegido avisa de que es carrera libre y no cuenta');
    assert(/<button[^>]*>[^<]*Volver al Gran Premio que toca/.test(free), 'R51: y deja volver al Gran Premio que toca');

    const home = source('src/components/HomeScreen.tsx');
    assert(/SeasonCalendar/.test(home) && /SeasonHistory/.test(home), 'R51: el paddock incluye el calendario y el historial de temporadas');
  });
}
