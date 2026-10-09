// T4.12 — Tiempo por circuito y neumático de salida (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día («empieza con los tests y después la
// implementación de todo el sprint»); sus decisiones están en la ficha del dashboard.
//  1. Sorteo: en una carrera de temporada el escenario sale de la probabilidad de lluvia del circuito y de una semilla;
//     en mil sorteos la frecuencia de lluvia queda a menos de 5 puntos de esa probabilidad en todos los circuitos.
//  2. La semilla del tiempo es de la temporada: la misma ronda da siempre el mismo tiempo (reiniciar la carrera no lo
//     cambia), cambia entre rondas y entre el sprint y el Gran Premio, y sobrevive a saltos, sprints y al guardado.
//  3. El paddock enseña la previsión (la probabilidad), no el resultado, y en una carrera de temporada no deja elegir;
//     en carrera libre se sigue eligiendo a mano.
//  4. Neumático de salida según el agua: la IA y los coches delegados montan el que elige el estratega; a los coches
//     del jugador se les propone en la parrilla y no cambia nada sin aceptar.
//  5. En seco no cambia nada, y sin activar la elección el motor sale como siempre.
//  6. En «Salida en mojado» ningún coche de la IA sale con slicks y las tres primeras vueltas acaban sin accidentes por
//     aquaplaning (con slicks los hay: es el defecto que se corrige).
//  7. Test de interfaz: previsión del paddock y propuesta de salida en el muro.
//  8. Revisión en el navegador (manual; en el dashboard).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const weather = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const inventory = await server.ssrLoadModule('/src/simulation/TireInventory.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { classify, constructorStandings, POINTS_2025 } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const SLICKS = ['soft', 'medium', 'hard'];
  const IDS = weather.WEATHER_SCENARIOS.map(s => s.id);
  const SEEDS = Array.from({ length: 1000 }, (_, i) => i * 7919 + 13);
  const rains = id => weather.isRainScenario(id);

  // El azar que el motor pide fuera de un paso con semilla (retardo del semáforo, suerte del día) sale de Math.random:
  // aquí es una secuencia fija, reiniciada en cada carrera, para que el módulo dé siempre lo mismo.
  const original = Math.random;
  let state = 1;
  const reseed = value => { state = value >>> 0; };
  Math.random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;

  try {
    await test('T4.12: el tiempo se sortea según la probabilidad de lluvia del circuito', () => {
      const circuits = Object.values(OFFICIAL_CIRCUITS);
      assert(circuits.length >= 23 && circuits.every(c => Number.isFinite(c.rainProbabilityPercent) && c.rainProbabilityPercent >= 0 && c.rainProbabilityPercent <= 100),
        'T4.12 (preparación): cada circuito tiene su probabilidad de lluvia');
      assert(IDS.every(id => rains(id) === ((weather.buildWeatherScenario(id, 6000).cells.length > 0) || (weather.buildWeatherScenario(id, 6000).initialWaterMm ?? 0) > 0)),
        'T4.12: un escenario cuenta como lluvia si llueve o empieza con agua en pista', IDS.filter(rains).join());
      let worst = { circuit: '', gap: 0 };
      const drawn = new Set();
      for (const circuit of circuits) {
        const ids = SEEDS.map(seed => weather.drawWeatherScenario(circuit.rainProbabilityPercent, seed));
        ids.forEach(id => drawn.add(id));
        const gap = Math.abs(ids.filter(rains).length / SEEDS.length * 100 - circuit.rainProbabilityPercent);
        if (gap > worst.gap) worst = { circuit: `${circuit.id ?? circuit.name} (${circuit.rainProbabilityPercent} %)`, gap };
      }
      assert(worst.gap < 5, 'T4.12: en mil sorteos la frecuencia de lluvia de cada circuito queda a menos de 5 puntos de su probabilidad', `peor caso ${worst.circuit}: ${worst.gap.toFixed(1)} puntos`);
      assert([...drawn].every(id => IDS.includes(id)) && IDS.every(id => drawn.has(id)), 'T4.12: salen todos los escenarios del juego y ninguno más', [...drawn].join());
      assert(SEEDS.every(seed => !rains(weather.drawWeatherScenario(0, seed))) && SEEDS.every(seed => rains(weather.drawWeatherScenario(100, seed))),
        'T4.12: con el 0 % nunca llueve y con el 100 % llueve siempre');
      assert(SEEDS.slice(0, 50).every(seed => weather.drawWeatherScenario(45, seed) === weather.drawWeatherScenario(45, seed)), 'T4.12: misma semilla, mismo tiempo');
    });

    await test('T4.12: la semilla del tiempo es de la temporada', () => {
      const round = number => SEASON_CALENDAR[number - 1];
      const seeded = season.withWeatherSeed(season.emptySeason(), 12345);
      assert(seeded.weatherSeed === 12345 && seeded.version === 1 && seeded.skipped.length === 0 && season.emptySeason().weatherSeed === undefined,
        'T4.12: la temporada guarda su semilla del tiempo', JSON.stringify(seeded));
      assert(season.withWeatherSeed(seeded, 999).weatherSeed === 12345, 'T4.12: una temporada que ya tiene semilla la conserva');
      assert(SEASON_CALENDAR.every(entry => IDS.includes(season.roundWeather(seeded, entry)) && season.roundWeather(seeded, entry) === season.roundWeather(seeded, entry)),
        'T4.12: la misma ronda da siempre el mismo tiempo (reiniciar la carrera no lo cambia)');
      const year = state => SEASON_CALENDAR.map(entry => season.roundWeather(state, entry)).join();
      const years = new Set(Array.from({ length: 30 }, (_, i) => year(season.withWeatherSeed(season.emptySeason(), 1000 + i))));
      assert(years.size >= 25, 'T4.12: cada temporada tiene su tiempo', `${years.size} temporadas distintas de 30`);
      const sprintRounds = SEASON_CALENDAR.filter(entry => entry.sprint);
      const differs = Array.from({ length: 200 }, (_, i) => season.withWeatherSeed(season.emptySeason(), 5000 + i))
        .filter(state => sprintRounds.some(entry => season.roundWeather(state, entry, 'sprint') !== season.roundWeather(state, entry, 'gp'))).length;
      assert(sprintRounds.length > 0 && differs >= 20, 'T4.12: el sprint y el Gran Premio de una ronda se sortean por separado', `${differs} temporadas de 200 con tiempo distinto`);
      // Con muchas temporadas, cada ronda llueve con la frecuencia de su circuito.
      const states = Array.from({ length: 600 }, (_, i) => season.withWeatherSeed(season.emptySeason(), i * 104729 + 7));
      const gaps = SEASON_CALENDAR.map(entry => Math.abs(states.filter(s => rains(season.roundWeather(s, entry))).length / states.length * 100 - OFFICIAL_CIRCUITS[entry.circuitId].rainProbabilityPercent));
      assert(Math.max(...gaps) < 7, 'T4.12: cada ronda llueve con la frecuencia de su circuito', `peor ronda: ${Math.max(...gaps).toFixed(1)} puntos`);
      assert(IDS.includes(season.roundWeather(season.emptySeason(), round(1))), 'T4.12: una temporada sin semilla (partida anterior) también da un tiempo válido');

      // La semilla sobrevive a guardar, saltar una ronda, correr el sprint y correr el Gran Premio; la temporada nueva no la hereda.
      assert(season.parseSeason(JSON.stringify(seeded)).weatherSeed === 12345 && season.parseSeason('{"version":1,"skipped":[2]}').weatherSeed === undefined
        && season.parseSeason('{"version":1,"skipped":[],"weatherSeed":"x"}').weatherSeed === undefined, 'T4.12: la semilla se guarda y se lee; una partida anterior no la tiene');
      const empty = champ.emptyChampionship();
      assert(season.skipRound(empty, seeded).weatherSeed === 12345 && season.skipRound(empty, seeded).skipped.join() === '1', 'T4.12: saltar una ronda conserva la semilla');
      const drivers = Object.values(DRIVERS);
      const result = () => {
        const rows = classify(drivers.map((driver, i) => ({
          carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name,
          laps: 50, timeSec: 5000 + i, penaltySec: 0, retired: false, dsq: false, progress: 50,
        })), { totalLaps: 50, suspended: false, greenLaps: 50 });
        return { status: 'final', endReason: 'distancia', rows, pointsTable: POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
      };
      const career = { championship: empty, components: comps.emptyComponents(), program: dev.emptyProgram(), season: seeded, archive: [] };
      const afterGp = season.settleRace(career, { counts: true, id: 'gp-1', circuitId: round(1).circuitId, result: result(), format: 'gp', raceKm: 300 });
      assert(afterGp.season.weatherSeed === 12345 && season.nextRound(afterGp.championship, afterGp.season).round === 2, 'T4.12: correr el Gran Premio conserva la semilla');
      const afterSprint = season.settleRace({ ...afterGp }, { counts: true, id: 'sprint-2', circuitId: round(2).circuitId, result: result(), format: 'sprint', raceKm: 100, tyres: {} });
      assert(afterSprint.season.weatherSeed === 12345 && afterSprint.season.weekend?.round === 2, 'T4.12: correr el sprint conserva la semilla');
      const closed = season.closeSeason({ championship: afterGp.championship, components: career.components, program: career.program, archive: [], season: seeded });
      assert(closed.season.weatherSeed === undefined, 'T4.12: la temporada siguiente no hereda la semilla (recibe la suya al empezar)');
    });

    const standing = mm => ({ id: 'prueba', cells: [], initialWaterMm: mm });
    /** Parrilla completa antes de la salida, con ese tiempo; `players` son los pilotos del jugador. */
    const grid = (scenario, players = []) => {
      reseed(412);
      const sim = new RaceSimulation('barcelona');
      sim.setSeed(412); sim.setFixedStep(0.02);
      sim.initRace();
      sim.setPlayerCars(players);
      sim.setWeatherScenario(scenario);
      return sim;
    };
    const mounted = car => car.tireInventory.sets.filter(set => set.state === 'montado');
    /** El inventario cuadra con lo montado: un solo juego montado, el de salida, y ningún otro gastado. */
    const consistent = car => {
      const sets = mounted(car), inv = car.tireInventory;
      return sets.length === 1 && sets[0].id === inv.mountedId && sets[0].compound === car.tires.compound && inv.usedIds.join() === inv.mountedId
        && inv.sets.every(set => set.state === 'montado' || set.state === 'nuevo') && car.tires.health === 100 && car.tires.lapsOnTire === 0
        && car.pitStop.stints[0].compound === car.tires.compound;
    };
    const starts = (sim, car) => sim.getWallProposals(car.id).filter(p => p.kind === 'salida');

    await test('T4.12: la IA sale con el neumático que pide el agua', () => {
      const damp = grid(standing(2));
      assert(damp.cars.length === 20 && damp.cars.every(car => car.tires.compound === 'medium'), 'T4.12 (preparación): antes de elegir, toda la parrilla lleva medios');
      damp.chooseStartTyres();
      assert(damp.cars.every(car => car.tires.compound === 'intermediate'), 'T4.12: con 2 mm de agua en pista toda la IA sale con intermedios', [...new Set(damp.cars.map(c => c.tires.compound))].join());
      assert(damp.cars.every(consistent), 'T4.12: el inventario cuadra: un juego montado, el medio vuelve a estar nuevo y la salida cuenta como primer stint',
        JSON.stringify(damp.cars.filter(car => !consistent(car)).slice(0, 1).map(car => ({ code: car.driver.code, inv: car.tireInventory.usedIds, mounted: mounted(car).map(s => s.id), stint: car.pitStop.stints[0] }))));
      const rule = inventory.tireCompliance(damp.cars[0].tireInventory, 'barcelona');
      assert(rule.usedWetWeather && rule.slickSpecs.length === 0, 'T4.12: el medio que no llegó a rodar no cuenta como compuesto usado', JSON.stringify(rule));
      assert(damp.cars.every(car => damp.getWallProposals(car.id).length === 0), 'T4.12: en los coches de la IA no queda ninguna propuesta');

      const flooded = grid(standing(5));
      flooded.chooseStartTyres();
      assert(flooded.cars.every(car => car.tires.compound === 'wet' && consistent(car)), 'T4.12: con 5 mm de agua salen con neumáticos de lluvia', [...new Set(flooded.cars.map(c => c.tires.compound))].join());

      for (const mm of [0, 0.2]) {
        const dry = grid(standing(mm));
        const before = JSON.stringify(dry.cars.map(car => [car.tires, car.tireInventory, car.pitStop.stints]));
        dry.chooseStartTyres();
        assert(before === JSON.stringify(dry.cars.map(car => [car.tires, car.tireInventory, car.pitStop.stints])) && dry.cars.every(car => dry.getWallProposals(car.id).length === 0),
          `T4.12: con ${String(mm).replace('.', ',')} mm de agua no cambia nada ni se propone nada`);
      }
    });

    await test('T4.12: a los coches del jugador se les propone en la parrilla', () => {
      const pair = TEAMS[DRIVERS.alonso.teamId].drivers;
      const sim = grid(standing(2), pair);
      const own = sim.cars.filter(car => pair.includes(car.driver.id)), rivals = sim.cars.filter(car => !pair.includes(car.driver.id));
      sim.chooseStartTyres();
      assert(own.length === 2 && own.every(car => car.tires.compound === 'medium') && rivals.every(car => car.tires.compound === 'intermediate'),
        'T4.12: sin aceptar, los coches del jugador siguen con su neumático y los de la IA cambian');
      assert(own.every(car => starts(sim, car).length === 1 && starts(sim, car)[0].compound === 'intermediate' && /agua/i.test(starts(sim, car)[0].reason) && /2,0 mm/.test(starts(sim, car)[0].reason) && starts(sim, car)[0].id),
        'T4.12: cada coche del jugador recibe una propuesta de salida con su compuesto y su motivo', JSON.stringify(own.map(car => starts(sim, car))));
      sim.chooseStartTyres();
      assert(own.every(car => starts(sim, car).length === 1), 'T4.12: la propuesta no se duplica');

      const [first, second] = own;
      assert(sim.acceptWallProposal(first.id, starts(sim, first)[0].id) === true && first.tires.compound === 'intermediate' && consistent(first) && starts(sim, first).length === 0,
        'T4.12: al aceptar, el coche sale con el neumático propuesto y la propuesta desaparece', first.tires.compound);
      assert(sim.discardWallProposal(second.id, starts(sim, second)[0].id) === true && second.tires.compound === 'medium' && starts(sim, second).length === 0, 'T4.12: al descartar, el coche conserva su neumático');
      sim.chooseStartTyres();
      assert(starts(sim, second).length === 0 && second.tires.compound === 'medium', 'T4.12: una propuesta de salida descartada no vuelve');

      const delegated = grid(standing(2), pair);
      const mine = delegated.cars.find(car => car.driver.id === pair[0]);
      delegated.setWallDelegation(mine.id, true);
      delegated.chooseStartTyres();
      assert(mine.tires.compound === 'intermediate' && consistent(mine) && delegated.getWallProposals(mine.id).length === 0, 'T4.12: en un coche delegado el estratega monta el neumático él mismo');

      // La propuesta vale mientras los coches están en la parrilla: al empezar el semáforo ya no se puede cambiar.
      const late = grid(standing(2), pair);
      late.chooseStartTyres();
      const waiting = late.cars.find(car => car.driver.id === pair[0]);
      const pending = starts(late, waiting)[0];
      late.lightState = 'grid-ready';
      assert(starts(late, waiting).length === 1, 'T4.12: la propuesta sigue pendiente con los coches en la parrilla');
      late.confirmRaceStart();
      assert(starts(late, waiting).length === 0 && late.acceptWallProposal(waiting.id, pending.id) === false && waiting.tires.compound === 'medium',
        'T4.12: con el semáforo en marcha la propuesta de salida se retira y ya no se puede aceptar');
    });

    await test('T4.12: la propuesta de salida se guarda y se carga', () => {
      const pair = TEAMS[DRIVERS.alonso.teamId].drivers;
      const sim = grid(standing(2), pair);
      sim.chooseStartTyres();
      const copy = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(copy, JSON.stringify(snap.createSnapshot(sim)));
      const car = copy.cars.find(c => c.driver.id === pair[0]);
      assert(outcome.ok && starts(copy, car).length === 1 && starts(copy, car)[0].compound === 'intermediate', 'T4.12: la propuesta de salida vuelve al cargar la carrera', JSON.stringify(outcome.errors));
      assert(copy.acceptWallProposal(car.id, starts(copy, car)[0].id) && car.tires.compound === 'intermediate' && consistent(car), 'T4.12: y se puede aceptar tras cargar');
    });

    await test('T4.12: la elección solo actúa cuando se activa', () => {
      const off = grid(standing(2));
      assert(off.autoStartTyres === false, 'T4.12: el motor no elige el neumático de salida si no se le pide');
      off.startRaceSequence();
      assert(off.lightState === 'formation-lap' && off.cars.every(car => car.tires.compound === 'medium'), 'T4.12: sin activarla, la salida es la de siempre (medios)');
      const on = grid(standing(2));
      on.autoStartTyres = true;
      on.startRaceSequence();
      assert(on.cars.every(car => car.tires.compound === 'intermediate'), 'T4.12: activada, la IA elige al empezar la secuencia de salida');
      on.initRace();
      assert(on.autoStartTyres === true && on.cars.every(car => car.tires.compound === 'medium'), 'T4.12: reiniciar la carrera conserva el ajuste y vuelve a formar con medios');
    });

    await test('T4.12: primeras vueltas en «Salida en mojado»', () => {
      /** Carrera real desde la parrilla hasta que el líder completa tres vueltas. */
      const firstLaps = (seed, auto) => {
        reseed(seed);
        const sim = new RaceSimulation('barcelona');
        sim.setSeed(seed); sim.setFixedStep(0.02);
        sim.autoStartTyres = auto;
        sim.initRace();
        sim.setWeatherScenario(weather.buildWeatherScenario('mojado-inicial', sim.totalLaps * 90));
        sim.startRaceSequence();
        const startCompounds = sim.cars.map(car => car.tires.compound);
        let steps = 0;
        while (sim.leaderLap < 4 && steps++ < 40000) {
          if (sim.lightState === 'grid-ready') sim.confirmRaceStart();
          // El paso de «semáforo apagado» a carrera va con reloj real en el motor.
          if (sim.lightState === 'lights-out') sim.lightState = 'racing';
          sim.update(0.02);
        }
        return {
          startCompounds, leaderLap: sim.leaderLap,
          aquaplaning: sim.incidents.filter(incident => /AQUAPLANING/i.test(incident.reason ?? '')).length + sim.cars.filter(car => car.status === 'out' && /AQUAPLANING/i.test(car.dnfReason ?? '')).length,
        };
      };
      const fixed = [1, 2, 3].map(seed => firstLaps(seed, true));
      assert(fixed.every(race => race.startCompounds.length === 20 && race.startCompounds.every(compound => !SLICKS.includes(compound))), 'T4.12: en «Salida en mojado» ningún coche de la IA sale con slicks',
        [...new Set(fixed.flatMap(race => race.startCompounds))].join());
      assert(fixed.every(race => race.leaderLap >= 4 && race.aquaplaning === 0), 'T4.12: las tres primeras vueltas acaban sin accidentes por aquaplaning', JSON.stringify(fixed.map(race => [race.leaderLap, race.aquaplaning])));
      const defect = [1, 2].map(seed => firstLaps(seed, false));
      assert(defect.every(race => race.startCompounds.every(compound => compound === 'medium')) && defect.reduce((sum, race) => sum + race.aquaplaning, 0) >= 1,
        'T4.12 (control): saliendo con slicks sí hay accidentes por aquaplaning en esas vueltas', JSON.stringify(defect.map(race => race.aquaplaning)));
    });

    await test('T4.12: interfaz', async () => {
      const outlook = await render('/src/components/WeatherOutlook.tsx', 'WeatherOutlook', { rainProbabilityPercent: 45 });
      assert(/Previsión/.test(outlook) && /45\s*%/.test(outlook) && !/<select/.test(outlook), 'T4.12: el paddock enseña la previsión con la probabilidad de lluvia, sin selector', outlook);
      assert(!IDS.some(id => outlook.includes(id)) && !weather.WEATHER_SCENARIOS.filter(s => s.id !== 'seco').some(s => outlook.includes(s.label)), 'T4.12: la previsión no dice qué escenario ha salido');
      const home = source('src/components/HomeScreen.tsx'), app = source('src/App.tsx');
      assert(/WeatherOutlook/.test(home) && /WeatherScenarioSelect/.test(home), 'T4.12: el paddock usa la previsión en la carrera de temporada y conserva el selector para la carrera libre');
      assert(/roundWeather\(/.test(app) && /withWeatherSeed\(/.test(app) && /autoStartTyres = true/.test(app), 'T4.12: la aplicación sortea el tiempo de la ronda, guarda la semilla y activa la elección del neumático de salida');

      const proposal = { id: 'prop_1_1', key: 'salida:intermediate', kind: 'salida', compound: 'intermediate', reason: 'Pista mojada: 2,0 mm de agua en la salida', lap: 0, timeSec: 0 };
      const html = await render('/src/components/WallProposals.tsx', 'WallProposals', { proposals: [proposal], delegated: false, onAccept() {}, onDiscard() {}, onDelegate() {} });
      assert(/Salida: INTERMEDIO/.test(html) && /2,0 mm de agua/.test(html) && /Aceptar/.test(html) && /Descartar/.test(html) && /data-proposal="salida"/.test(html),
        'T4.12: el muro enseña la propuesta de salida con su compuesto, su motivo y los botones de aceptar y descartar', html);
    });
  } finally {
    Math.random = original;
  }
}
