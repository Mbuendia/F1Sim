// TL1 — Carrera de varias temporadas (Sprint 12). Contrato propuesto el 16/11/2026; el usuario contesta «Sí, empieza»
// (con las recomendaciones: Imola se corre en Monza, que acoge dos rondas; el reglamento por año es solo el punto por
// vuelta rápida en 2023 y 2024; el DRS se queda en todos los años).
//  1. Calendarios por año: 2023 con 22 rondas y 2024, 2025 y 2026 con 24, solo con circuitos del juego, con las
//     sustituciones anotadas y seis sprints por año.
//  2. Una partida que empieza en un año arranca con su calendario; al cerrar la temporada pasa al año siguiente con el
//     suyo, y después de 2026 se repite el de 2026.
//  3. Una temporada de 22 rondas se cierra al acabar la 22 (las 24 rondas ya no están fijas).
//  4. El punto por vuelta rápida se da en 2023 y 2024, solo entre los diez primeros y nunca en el sprint; desde 2025, no.
//  5. El año de inicio se guarda y se recupera, y una partida antigua (sin año) se carga como iniciada en 2026.
//  6. El año se ve en el inicio, en el fin de temporada, en el historial y en las partidas guardadas.
//  7. Los tests que ya había siguen en verde sin tocarlos (se comprueban con la suite completa).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const YEARS = [2023, 2024, 2025, 2026];

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const cal = await load('/src/data/calendar.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const season = await load('/src/simulation/Season.ts');
  const career = await load('/src/simulation/Career.ts');
  const save = await load('/src/simulation/SaveGame.ts');
  const champ = await load('/src/simulation/Championship.ts');
  const comps = await load('/src/simulation/ComponentPool.ts');
  const dev = await load('/src/simulation/Development.ts');
  const { classify, constructorStandings, POINTS_2025, SPRINT_POINTS } = await load('/src/simulation/RaceResult.ts');
  const { DRIVERS } = await load('/src/data/drivers.ts');
  const { TEAMS } = await load('/src/data/teams.ts');

  const baseCareer = year => ({
    championship: champ.emptyChampionship(), program: dev.emptyProgram(), archive: [], season: season.emptySeason(year),
    components: Object.keys(DRIVERS).reduce((state, id) => comps.ensureDriver(state, id), comps.emptyComponents()),
  });

  await test('TL1.1: calendarios por año', () => {
    assert(JSON.stringify(cal.SEASON_YEARS) === JSON.stringify(YEARS), 'TL1: se puede empezar en 2023, 2024, 2025 o 2026', JSON.stringify(cal.SEASON_YEARS));
    const sizes = YEARS.map(y => cal.calendarFor(y).length);
    assert(JSON.stringify(sizes) === JSON.stringify([22, 24, 24, 24]), 'TL1: 2023 tiene 22 rondas y 2024, 2025 y 2026, 24', sizes.join(', '));
    for (const y of YEARS) {
      const rounds = cal.calendarFor(y);
      const unknown = rounds.filter(r => !OFFICIAL_CIRCUITS[r.circuitId]).map(r => r.circuitId);
      assert(unknown.length === 0, `TL1: en ${y} solo hay circuitos del juego`, unknown.join(', ') || 'ok');
      assert(rounds.every((r, i) => r.round === i + 1), `TL1: en ${y} las rondas van numeradas de 1 en adelante`);
      assert(rounds.filter(r => r.sprint).length === 6, `TL1: en ${y} hay seis sprints`, `${rounds.filter(r => r.sprint).length}`);
    }
    for (const y of [2024, 2025]) {
      const imola = cal.calendarFor(y).filter(r => r.substitutes === 'Imola');
      assert(imola.length === 1 && imola[0].circuitId === 'monza' && cal.calendarFor(y).filter(r => r.circuitId === 'monza').length === 2, `TL1: en ${y} la ronda de Imola se corre en Monza, que acoge dos`);
    }
    assert(cal.calendarFor(2026).some(r => r.substitutes === 'Madrid' && r.circuitId === 'barcelona'), 'TL1: en 2026 la ronda de Madrid sigue en Barcelona');
    assert(JSON.stringify(cal.calendarFor(2026)) === JSON.stringify(cal.SEASON_CALENDAR), 'TL1: el calendario de siempre es el de 2026');
  });

  await test('TL1.2 y 3: las temporadas se encadenan año a año', () => {
    const started = career.newCareer('williams', 'Prueba', 7, 2023);
    assert(season.seasonYear(started.career.season) === 2023 && started.selection.circuitId === cal.calendarFor(2023)[0].circuitId, 'TL1: una partida que empieza en 2023 arranca con la primera ronda de 2023', `${season.seasonYear(started.career.season)} · ${started.selection.circuitId}`);
    assert(season.seasonYear(career.newCareer('williams', 'Prueba', 7).career.season) === 2026, 'TL1: sin año, la partida empieza en 2026, como hasta ahora');
    let progress = baseCareer(2023);
    let closed = null, skips = 0;
    while (!closed && skips < 30) { const next = season.settleSkip(progress); closed = next.closed; progress = next; skips++; }
    assert(skips === 22 && closed, 'TL1: una temporada de 22 rondas se cierra al acabar la 22', `${skips} rondas`);
    assert(closed?.year === 2023 && season.seasonYear(progress.season) === 2024, 'TL1: la temporada cerrada es la de 2023 y la siguiente es 2024', `${closed?.year} → ${season.seasonYear(progress.season)}`);
    assert(season.seasonRounds(progress.season) === 24 && season.nextRound(progress.championship, progress.season)?.circuitId === cal.calendarFor(2024)[0].circuitId, 'TL1: 2024 tiene su calendario de 24 rondas');
    const after = season.emptySeason(2027);
    assert(season.seasonYear(after) === 2027 && JSON.stringify(season.seasonCalendar(after)) === JSON.stringify(cal.calendarFor(2026)), 'TL1: después de 2026 se repite el calendario de 2026');
  });

  await test('TL1.4: punto por vuelta rápida', () => {
    const drivers = Object.values(DRIVERS).slice(0, 20);
    const result = (fastestIndex, format = 'gp') => {
      const rows = classify(drivers.map((d, i) => ({ carId: i + 1, driverCode: d.code, driverName: `${d.firstName} ${d.lastName}`, teamId: d.teamId, teamName: TEAMS[d.teamId].name, laps: 50, timeSec: 5000 + i, penaltySec: 0, retired: false, dsq: false, progress: 50 })),
        { totalLaps: 50, suspended: false, greenLaps: 50, format });
      return { status: 'final', endReason: 'distancia', rows, pointsTable: format === 'sprint' ? SPRINT_POINTS : POINTS_2025, fastestLap: { driverName: rows[fastestIndex].driverName, timeSec: 80, lap: 40 }, constructors: constructorStandings(rows), differences: [] };
    };
    const pointsOf = (year, fastestIndex, format = 'gp') => {
      const base = baseCareer(year), r = result(fastestIndex, format);
      const settled = season.settleRace(base, { counts: true, id: 'r1', circuitId: cal.calendarFor(year)[0].circuitId, result: r, format, raceKm: 300 });
      const code = r.rows[fastestIndex].driverCode;
      return champ.driverStandings(settled.championship).find(row => row.driverCode === code)?.points ?? 0;
    };
    assert(pointsOf(2023, 4) === 11 && pointsOf(2024, 0) === 26, 'TL1: en 2023 y 2024 la vuelta rápida suma un punto a quien acaba entre los diez primeros', `${pointsOf(2023, 4)} y ${pointsOf(2024, 0)}`);
    assert(pointsOf(2024, 12) === 0, 'TL1: fuera de los diez primeros la vuelta rápida no puntúa', `${pointsOf(2024, 12)}`);
    assert(pointsOf(2025, 4) === 10 && pointsOf(2026, 0) === 25, 'TL1: desde 2025 no hay punto por vuelta rápida', `${pointsOf(2025, 4)} y ${pointsOf(2026, 0)}`);
    const sprintYear = 2024, sprintRound = cal.calendarFor(sprintYear).find(r => r.sprint);
    const base = baseCareer(sprintYear);
    const skipped = cal.calendarFor(sprintYear).slice(0, sprintRound.round - 1).reduce(progress => season.settleSkip(progress), base);
    const r = result(0, 'sprint');
    const sprint = season.settleRace(skipped, { counts: true, id: 's1', circuitId: sprintRound.circuitId, result: r, format: 'sprint', raceKm: 100 });
    assert(champ.driverStandings(sprint.championship).find(row => row.driverCode === r.rows[0].driverCode)?.points === 8, 'TL1: en el sprint la vuelta rápida no puntúa');
  });

  await test('TL1.5: guardado', () => {
    const started = career.newCareer('williams', 'Prueba', 7, 2024);
    const game = save.createSave({ name: 'Prueba', savedAt: '2026-11-16T10:00:00.000Z', career: started.career, selection: started.selection, race: null });
    const back = save.importSave(save.exportSave(game));
    assert(back.save && season.seasonYear(save.savedSeason(back.save)) === 2024, 'TL1: el año de la temporada se guarda y se recupera', back.save ? `${season.seasonYear(save.savedSeason(back.save))}` : back.errors?.join(', '));
    const legacy = JSON.parse(save.exportSave(game));
    delete legacy.career.season.year;
    legacy.career.archive = [{ season: 1, races: 24, champion: null, constructorsChampion: null }];
    const old = save.importSave(JSON.stringify(legacy));
    assert(old.save && season.seasonYear(save.savedSeasonWithYear(old.save)) === 2027, 'TL1: una partida antigua se carga como empezada en 2026 (con una temporada cerrada, va por 2027)', old.save ? `${season.seasonYear(save.savedSeasonWithYear(old.save))}` : old.errors?.join(', '));
    assert(season.seasonYear(season.parseSeason(JSON.stringify({ version: 1, skipped: [] }))) === 2026, 'TL1: un estado de temporada sin año se lee como 2026');
    assert(save.summarize(back.save, 'x', false, 100).year === 2024, 'TL1: la ficha de la partida guardada lleva el año');
  });

  await test('TL1.6: el año a la vista', async () => {
    const { SeasonEndScreen } = await load('/src/components/SeasonEndScreen.tsx');
    const { SeasonHistory } = await load('/src/components/SeasonHistory.tsx');
    const summary = { season: 1, year: 2023, races: 22, champion: 'VER', constructorsChampion: 'Red Bull', championName: 'Max', championPoints: 400, constructorsPoints: 700, skipped: 0 };
    const end = renderToStaticMarkup(createElement(SeasonEndScreen, { summary, onContinue: () => {} }));
    assert(end.includes('2023'), 'TL1: el fin de temporada dice el año');
    const history = renderToStaticMarkup(createElement(SeasonHistory, { archive: [summary] }));
    assert(history.includes('2023'), 'TL1: el historial dice el año de cada temporada');
    const { HubHeader } = await load('/src/components/HubHeader.tsx');
    const header = renderToStaticMarkup(createElement(HubHeader, { teamName: 'Williams', seasonNumber: 2, seasonYear: 2024, round: 3, totalRounds: 24, kpis: [], section: 'inicio', onSection: () => {} }));
    assert(header.includes('2024') && header.includes('ronda 3 de 24'), 'TL1: el inicio dice el año y la ronda sobre las de ese año');
    const { slotStatus } = await load('/src/components/GameMenuScreen.tsx');
    const line = slotStatus({ raceNumber: 5, year: 2023, totalRounds: 22 });
    assert(line.includes('2023') && line.includes('de 22'), 'TL1: la partida guardada dice el año y las rondas de ese año', line);
  });

}
