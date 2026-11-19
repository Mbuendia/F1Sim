// TL2 — Los rivales evolucionan, ampliada con los datos de cada año (Sprint 12). Contrato propuesto el 16/11/2026 y
// aprobado ese día («Cierra tl1 y 2») con las tres recomendaciones: después del primer año la historia es propia (los
// pilotos se mueven con el mercado y los rivales con su desarrollo) y los motores de 2026 se aplican siempre; 2026 lleva
// su parrilla real sin Cadillac; la carrera libre, el multijugador y las partidas antiguas no cambian.
//  1. Cada año, 10 equipos y 20 pilotos, cada piloto en un solo equipo, todos con nombre de parodia.
//  2. Alineaciones concretas de cada año.
//  3. En 2023, 2024 y 2025 la fuerza ordena a los equipos como el campeonato real de constructores, y la ventaja del
//     primero es mayor en 2023 que en 2025.
//  4. Los motores de cada año, con los cambios de 2026.
//  5. La edad y el palmarés de cada piloto son los del año.
//  6. Una partida que empieza en un año corre con los pilotos y la fuerza de ese año.
//  7. Al cerrar la temporada los rivales cambian según su desarrollo y los pilotos según el mercado; al llegar a 2026 se
//     aplican los motores de 2026.
//  8. Lo de cada equipo ese año se guarda y se recupera.
//  9. La carrera libre, el multijugador y las partidas antiguas no cambian.
// 10. Al cambiar de año en la partida nueva cambian las tarjetas de los equipos.

const YEARS = [2023, 2024, 2025, 2026];
// Apellidos reales que no deben aparecer: los pilotos van con nombre de parodia.
const REAL = ['Verstappen', 'Perez', 'Pérez', 'Bottas', 'Zhou', 'Magnussen', 'Sargeant', 'De Vries', 'Ricciardo', 'Colapinto', 'Lindblad', 'Hamilton', 'Norris'];

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const seasons = await load('/src/data/seasons.ts');
  const { TEAMS } = await load('/src/data/teams.ts');
  const { DRIVERS } = await load('/src/data/drivers.ts');
  const career = await load('/src/simulation/Career.ts');
  const season = await load('/src/simulation/Season.ts');
  const contracts = await load('/src/simulation/Contracts.ts');
  const save = await load('/src/simulation/SaveGame.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const dev = await load('/src/simulation/Development.ts');
  const { createSnapshot } = await load('/src/simulation/Snapshot.ts');
  const teamIds = Object.keys(TEAMS);
  const sheet = id => DRIVERS[id] ?? seasons.EXTRA_DRIVERS[id];

  await test('TL2.1: 10 equipos y 20 pilotos cada año, con nombre de parodia', () => {
    for (const y of YEARS) {
      const lineup = seasons.lineupFor(y);
      const ids = Object.keys(lineup);
      assert(ids.length === 20 && ids.every(id => sheet(id)), `TL2: en ${y} hay 20 pilotos con ficha`, `${ids.length}`);
      assert(teamIds.every(t => ids.filter(id => lineup[id] === t).length === 2), `TL2: en ${y} cada uno de los 10 equipos lleva dos pilotos`);
      const real = ids.filter(id => REAL.some(name => sheet(id).lastName.includes(name)));
      assert(real.length === 0, `TL2: en ${y} ningún piloto lleva su apellido real`, real.join(', ') || 'ok');
    }
  });

  await test('TL2.2: alineaciones de cada año', () => {
    const pair = (y, t) => Object.entries(seasons.lineupFor(y)).filter(([, team]) => team === t).map(([id]) => id).sort().join('+');
    assert(pair(2023, 'mercedes') === 'hamilton+russell' && pair(2023, 'ferrari') === 'leclerc+sainz' && pair(2023, 'redbull') === 'perez+verstappen', 'TL2: en 2023 Hammertime va en Totocedes, Sainzoperator en Errari y Pérdiz con Verstoppen', `${pair(2023, 'mercedes')} · ${pair(2023, 'ferrari')} · ${pair(2023, 'redbull')}`);
    assert(pair(2023, 'racingbulls') === 'devries+tsunoda' && pair(2024, 'racingbulls') === 'ricciardo+tsunoda', 'TL2: el compañero de Tsunami es De Vries en 2023 y Ricciardo en 2024', `${pair(2023, 'racingbulls')} · ${pair(2024, 'racingbulls')}`);
    assert(pair(2025, 'ferrari') === 'hamilton+leclerc' && pair(2025, 'redbull') === 'lawson+verstappen', 'TL2: en 2025, la parrilla de siempre del juego');
    assert(pair(2026, 'redbull') === 'hadjar+verstappen' && pair(2026, 'racingbulls') === 'lawson+lindblad' && pair(2026, 'alpine') === 'colapinto+gasly', 'TL2: en 2026, Hadjhog sube a Red Bulla, Lindblad entra en Racing Bueyes y Colapinto va en Alpino', `${pair(2026, 'redbull')} · ${pair(2026, 'racingbulls')} · ${pair(2026, 'alpine')}`);
    assert(!seasons.lineupFor(2026).tsunoda && !seasons.lineupFor(2026).perez, 'TL2: en 2026 no hay asiento para Tsunami ni para Pérdiz (sin Cadillac)');
  });

  await test('TL2.3: la fuerza sigue al campeonato real de constructores', () => {
    const real = {
      2023: ['redbull', 'mercedes', 'ferrari', 'mclaren', 'astonmartin', 'alpine', 'williams', 'racingbulls', 'sauber', 'haas'],
      2024: ['mclaren', 'ferrari', 'redbull', 'mercedes', 'astonmartin', 'alpine', 'haas', 'racingbulls', 'williams', 'sauber'],
      2025: ['mclaren', 'mercedes', 'redbull', 'ferrari', 'williams', 'racingbulls', 'astonmartin', 'haas', 'sauber', 'alpine'],
    };
    for (const [y, order] of Object.entries(real)) {
      const form = seasons.teamFormFor(Number(y));
      const got = [...teamIds].sort((a, b) => form[b].carPerformance - form[a].carPerformance);
      assert(JSON.stringify(got) === JSON.stringify(order), `TL2: en ${y} los coches van en el orden del campeonato`, got.join(' > '));
    }
    const gap = y => { const v = Object.values(seasons.teamFormFor(y)).map(t => t.carPerformance).sort((a, b) => b - a); return v[0] - v[1]; };
    assert(gap(2023) > gap(2025) * 2, 'TL2: la ventaja del primero en 2023 es mucho mayor que en 2025', `${gap(2023).toFixed(4)} y ${gap(2025).toFixed(4)}`);
    const f26 = seasons.teamFormFor(2026);
    assert(teamIds.every(t => f26[t].carPerformance === TEAMS[t].carPerformance), 'TL2: en 2026 la fuerza de los coches es la que ya tenía el juego');
  });

  await test('TL2.4: motores de cada año', () => {
    const maker = (y, t) => seasons.teamFormFor(y)[t].engineManufacturer;
    assert(maker(2025, 'redbull') === TEAMS.redbull.engineManufacturer && maker(2025, 'astonmartin') === TEAMS.astonmartin.engineManufacturer, 'TL2: hasta 2025, los motores de siempre');
    assert(maker(2026, 'astonmartin').startsWith('Hondamental') && maker(2026, 'redbull') !== maker(2025, 'redbull'), 'TL2: en 2026 Aston Papá lleva el motor Hondamental que dejó Red Bulla', maker(2026, 'astonmartin'));
    assert(maker(2026, 'alpine') === maker(2026, 'mercedes'), 'TL2: en 2026 Alpino lleva motor Totocedes', maker(2026, 'alpine'));
    const fresh = ['redbull', 'sauber'].map(t => maker(2026, t));
    assert(fresh.every(m => !Object.values(TEAMS).some(t => t.engineManufacturer === m)) && fresh[0] !== fresh[1] && maker(2026, 'racingbulls') === fresh[0], 'TL2: en 2026 Red Bulla (con Racing Bueyes) y Steak Sauber estrenan motor propio', fresh.join(' · '));
  });

  await test('TL2.5: edad y palmarés del año', () => {
    const v23 = seasons.driverSheetFor('verstappen', 2023), v25 = seasons.driverSheetFor('verstappen', 2025);
    assert(v23.worldChampionships === 2 && v25.worldChampionships === 4 && v23.age === v25.age - 2, 'TL2: Verstoppen llega a 2023 con dos títulos y dos años menos', `${v23.worldChampionships} títulos, ${v23.age} años`);
    assert(seasons.driverSheetFor('norris', 2023).careerWins === 0 && seasons.driverSheetFor('norris', 2025).careerWins === DRIVERS.norris.careerWins, 'TL2: Nowins no ha ganado nada al empezar 2023');
    assert(JSON.stringify(seasons.driverSheetFor('alonso', 2025)) === JSON.stringify(DRIVERS.alonso), 'TL2: la ficha de 2025 es la de siempre');
    const started = career.newCareer('williams', 'Prueba', 3, 2023);
    assert(started.career.management.ages.hamilton === DRIVERS.hamilton.age - 2, 'TL2: en una partida de 2023 las edades son las de 2023', `${started.career.management.ages.hamilton}`);
  });

  await test('TL2.6: la partida corre con los pilotos y la fuerza de su año', () => {
    const started = career.newCareer('williams', 'Prueba', 3, 2023);
    const mgmt = started.career.management;
    const lineup = contracts.lineupOf(mgmt.contracts);
    assert(JSON.stringify(Object.entries(lineup).sort()) === JSON.stringify(Object.entries(seasons.lineupFor(2023)).sort()), 'TL2: los contratos de una partida de 2023 son la parrilla de 2023');
    assert(JSON.stringify(season.seasonForm(started.career.season)) === JSON.stringify(seasons.teamFormFor(2023)), 'TL2: la temporada de 2023 lleva la fuerza de 2023');
    assert(started.selection.driverId && seasons.lineupFor(2023)[started.selection.driverId] === 'williams', 'TL2: el piloto que sigue el jugador es uno de los suyos de ese año', started.selection.driverId);
    const sim = new RaceSimulation('barcelona');
    sim.setLineup(lineup, mgmt.contracts.extra ?? {});
    sim.setTeamForm(season.seasonForm(started.career.season));
    const car = id => sim.cars.find(c => c.driver.id === id);
    assert(car('perez')?.team.id === 'redbull' && car('devries'), 'TL2: en la carrera corren los pilotos de 2023', sim.cars.map(c => c.driver.id).join(','));
    assert(car('verstappen').technical.fastCornerGrip > car('norris').technical.fastCornerGrip, 'TL2: en 2023 el Red Bulla tiene más carga que el McPapaya');
    sim.setTeamForm(null);
    assert(car('verstappen').technical.fastCornerGrip < car('norris').technical.fastCornerGrip, 'TL2: sin fuerza del año, la de siempre (McPapaya delante)');
  });

  await test('TL2.7: al cerrar la temporada, desarrollo, mercado y motores', () => {
    const base = seasons.teamFormFor(2025);
    const program = dev.emptyProgram();
    const quiet = seasons.evolveForm(base, 2026, { legacy: {} }, 11);
    const busy = seasons.evolveForm(base, 2026, { legacy: { haas: [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }] } }, 11);
    assert(busy.haas.carPerformance > quiet.haas.carPerformance, 'TL2: el rival que más desarrolla mejora más el coche del año siguiente', `${quiet.haas.carPerformance.toFixed(4)} → ${busy.haas.carPerformance.toFixed(4)}`);
    assert(quiet.alpine.engineManufacturer === seasons.teamFormFor(2026).alpine.engineManufacturer && quiet.redbull.engineManufacturer === seasons.teamFormFor(2026).redbull.engineManufacturer, 'TL2: al pasar a 2026 se ponen los motores de 2026');
    const later = seasons.evolveForm(quiet, 2027, { legacy: {} }, 11);
    assert(later.redbull.engineManufacturer === quiet.redbull.engineManufacturer && teamIds.some(t => later[t].carPerformance !== quiet[t].carPerformance), 'TL2: después de 2026 los motores se quedan y los coches siguen cambiando');
    // Una temporada entera de 2025 saltada: la siguiente es 2026 con la fuerza evolucionada (no la real) y los motores nuevos.
    const started = career.newCareer('williams', 'Prueba', 5, 2025);
    let progress = { ...started.career }, closed = null, guard = 0;
    while (!closed && guard++ < 30) { const next = season.settleSkip(progress); closed = next.closed; progress = next; }
    const next = season.seasonForm(progress.season);
    assert(season.seasonYear(progress.season) === 2026 && next && next.alpine.engineManufacturer === seasons.teamFormFor(2026).alpine.engineManufacturer, 'TL2: tras 2025 llega 2026 con los motores de 2026');
    assert(teamIds.some(t => next[t].carPerformance !== seasons.teamFormFor(2026)[t].carPerformance), 'TL2: la fuerza de 2026 sale de la partida, no de la tabla real');
    assert(Object.keys(contracts.lineupOf(progress.management.contracts)).length === 20, 'TL2: el mercado deja 20 pilotos en la parrilla');
    void program;
  });

  await test('TL2.8: se guarda y se recupera', () => {
    const started = career.newCareer('haas', 'Prueba', 9, 2024);
    const game = save.createSave({ name: 'Prueba', savedAt: '2026-11-16T10:00:00.000Z', career: started.career, selection: started.selection, race: null });
    const back = save.importSave(save.exportSave(game));
    assert(back.save && JSON.stringify(season.seasonForm(save.savedSeason(back.save))) === JSON.stringify(seasons.teamFormFor(2024)), 'TL2: la fuerza del año se guarda y se recupera');
    assert(back.save && contracts.lineupOf(back.save.career.management.contracts).ricciardo === 'racingbulls', 'TL2: la parrilla del año (con sus pilotos de entonces) se guarda y se recupera');
  });

  await test('TL2.9: carrera libre, multijugador y partidas antiguas sin cambios', () => {
    assert(season.seasonForm(season.parseSeason(JSON.stringify({ version: 1, skipped: [] }))) === null, 'TL2: una temporada sin fuerza guardada corre con la de siempre');
    const sim = new RaceSimulation('barcelona');
    const before = sim.cars.map(c => `${c.driver.id}:${c.team.id}:${c.technical?.fastCornerGrip ?? ''}`).join(',');
    sim.setLineup({});
    sim.setTeamForm(null);
    const after = sim.cars.map(c => `${c.driver.id}:${c.team.id}:${c.technical?.fastCornerGrip ?? ''}`).join(',');
    assert(before === after, 'TL2: sin partida, la parrilla y los coches de siempre');
    assert(!JSON.stringify(createSnapshot(sim)).includes('teamForm'), 'TL2: el snapshot de una carrera sin fuerza del año no cambia');
  });

  await test('TL2.10: las tarjetas de la partida nueva cambian con el año', async () => {
    const { teamCard } = await load('/src/components/NewCareerScreen.tsx');
    const a = teamCard('redbull', 2023), b = teamCard('redbull', 2026);
    assert(a.drivers.join() !== b.drivers.join() && a.drivers.includes('PER'), 'TL2: los pilotos de la tarjeta son los del año', `${a.drivers} · ${b.drivers}`);
    assert(teamCard('mclaren', 2023).difficulty !== teamCard('mclaren', 2025).difficulty || teamCard('redbull', 2023).difficulty !== teamCard('redbull', 2025).difficulty, 'TL2: la dificultad de la tarjeta es la del año');
    assert(teamCard('redbull', 2026).engine === seasons.teamFormFor(2026).redbull.engineManufacturer, 'TL2: la tarjeta dice el motor del año');
  });
}
