// R45 — Atributos de piloto sobre 100 y mejora entre carreras (contrato aprobado por el usuario el 02/10/2026).
// Diseño del juego: 8 atributos derivados de los valores base; 1–3 puntos por carrera según el resultado, máximo +1 por
// atributo, repartidos según el enfoque. Con los atributos iniciales el motor no cambia.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const dev = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const driver = DRIVERS.stroll; // atributos lejos del tope: admite mejoras de varios puntos
  const base = dev.baseAttributes(driver);
  const plus = (key, n) => ({ ...base, [key]: base[key] + n });

  await test('R45: atributos iniciales sin efecto en el motor', () => {
    assert(dev.ATTRIBUTE_KEYS.length === 8 && dev.ATTRIBUTE_KEYS.every(k => Number.isInteger(base[k]) && base[k] >= 1 && base[k] <= 100), 'R45: ocho atributos enteros sobre 100', JSON.stringify(base));
    const same = dev.applyAttributes(driver, base);
    assert(['talentRating', 'consistency', 'tireManagement', 'palmaresScore', 'raceCraft', 'luckRating'].every(k => same[k] === driver[k]), 'R45: con los atributos iniciales los valores del motor son los de siempre');
    assert(Object.values(same.development).every(v => v === 0), 'R45: y los efectos nuevos valen cero');
    assert(dev.overtakeAdvantageNeeded(RaceSimulation.OVERTAKE.MIN_ADVANTAGE, 0, 0) === RaceSimulation.OVERTAKE.MIN_ADVANTAGE && dev.wetGripFactor(0.8, 0) === 0.8 && dev.fitnessNoiseFactor(0.9, 0) === 1,
      'R45: umbral de adelantamiento, agarre en mojado y variación idénticos sin mejoras');
    const run = attributes => {
      const sim = make('barcelona', 2);
      if (attributes) sim.setDriverAttributes(attributes);
      sim.setSeed(45); sim.setFixedStep(0.02);
      for (let i = 0; i < 3000; i++) sim.update(1 / 60);
      return JSON.stringify(sim.cars.map(c => [c.progress, c.currentSpeedKmh, c.tires.health, c.fuelKg]));
    };
    const initial = Object.fromEntries(Object.values(DRIVERS).map(d => [d.id, dev.baseAttributes(d)]));
    assert(run(null) === run(initial), 'R45: la carrera es idéntica con los atributos iniciales aplicados');
  });

  await test('R45: cada atributo cambia lo suyo y solo eso', () => {
    const fields = { ritmo: 'talentRating', consistencia: 'consistency', neumaticos: 'tireManagement', experiencia: 'palmaresScore' };
    const deltas = { adelantamiento: 'overtake', defensa: 'defence', lluvia: 'wet', forma: 'fitness' };
    const engineKeys = ['talentRating', 'consistency', 'tireManagement', 'palmaresScore', 'raceCraft', 'luckRating'];
    for (const key of dev.ATTRIBUTE_KEYS) {
      const improved = dev.applyAttributes(driver, plus(key, 3));
      const changedFields = engineKeys.filter(k => improved[k] !== driver[k]);
      const changedDeltas = Object.keys(improved.development).filter(k => improved.development[k] !== 0);
      const expectedField = fields[key] ? [fields[key]] : [], expectedDelta = deltas[key] ? [deltas[key]] : [];
      assert(JSON.stringify(changedFields) === JSON.stringify(expectedField) && JSON.stringify(changedDeltas) === JSON.stringify(expectedDelta),
        `R45: ${key} solo cambia ${fields[key] ?? deltas[key]}`, `${changedFields} ${changedDeltas}`);
    }
    assert(Math.abs(dev.applyAttributes(driver, plus('ritmo', 3)).talentRating - (driver.talentRating + 0.03)) < 1e-12, 'R45: un punto de ritmo es una centésima de talento');
    const min = RaceSimulation.OVERTAKE.MIN_ADVANTAGE;
    assert(dev.overtakeAdvantageNeeded(min, 5, 0) < min && dev.overtakeAdvantageNeeded(min, 0, 5) > min && dev.overtakeAdvantageNeeded(min, 500, 0) === dev.EFFECT.MIN_OVERTAKE_ADVANTAGE,
      'R45: adelantamiento baja la ventaja necesaria, defensa la sube, con suelo');
    assert(dev.wetGripFactor(0.8, 5) > 0.8 && dev.wetGripFactor(0.8, 5) < 1 && dev.wetGripFactor(1, 5) === 1 && dev.wetGripFactor(0.8, 500) === 0.9, 'R45: lluvia recupera parte de la pérdida de agarre, nunca más de la mitad');
    assert(dev.fitnessNoiseFactor(0.5, 5) === 1 && dev.fitnessNoiseFactor(0.8, 5) < 1 && dev.fitnessNoiseFactor(0.8, 500) === dev.EFFECT.FITNESS_MIN, 'R45: forma física solo actúa en el último tercio');
  });

  await test('R45: los efectos llegan al motor', () => {
    const lap = (attributes, wet) => {
      const sim = make('barcelona', 1), car = sim.cars[0];
      Object.assign(car, { progress: 3.0, trackT: 0, currentLap: 3 });
      car.pitStop.playerControlled = true;
      if (wet) sim.setWeatherScenario({ id: 'prueba', cells: [], initialWaterMm: 1 });
      sim.setDriverAttributes({ [car.driver.id]: attributes });
      sim.setSeed(45); sim.setFixedStep(0.02);
      while (car.currentLap < 5 && sim.raceTimeSec < 400) sim.update(1 / 60);
      return { time: sim.raceTimeSec, health: car.tires.health };
    };
    const id = make('barcelona', 1).cars[0].driver.id;
    const b = dev.baseAttributes(DRIVERS[id]);
    const dry = lap(b, false);
    assert(lap({ ...b, ritmo: b.ritmo + 5 }, false).time < dry.time, 'R45: más ritmo, vuelta más rápida');
    assert(lap({ ...b, neumaticos: b.neumaticos + 5 }, false).health > dry.health, 'R45: mejor gestión, menos desgaste');
    assert(lap({ ...b, lluvia: b.lluvia + 10 }, false).time === dry.time, 'R45: la lluvia no cambia nada en seco');
    assert(lap({ ...b, lluvia: b.lluvia + 10 }, true).time < lap(b, true).time, 'R45: en mojado, más lluvia es más rápido');
    const sim = make('barcelona', 2), [a, c] = sim.cars;
    const before = sim.overtakeAdvantageFor(c.id, a.id);
    sim.setDriverAttributes({ [c.driver.id]: { ...dev.baseAttributes(DRIVERS[c.driver.id]), adelantamiento: 100 } });
    const attacker = sim.overtakeAdvantageFor(c.id, a.id);
    sim.setDriverAttributes({ [a.driver.id]: { ...dev.baseAttributes(DRIVERS[a.driver.id]), defensa: 100 } });
    assert(before === RaceSimulation.OVERTAKE.MIN_ADVANTAGE && attacker < before && sim.overtakeAdvantageFor(c.id, a.id) > before, 'R45: el motor usa adelantamiento y defensa en la decisión',
      `${before} → ${attacker} → ${sim.overtakeAdvantageFor(c.id, a.id)}`);
  });

  await test('R45: progresión reproducible y acotada', () => {
    const podium = { position: 2, status: 'clasificado', points: 18 }, lapped = { position: 14, status: 'clasificado', points: 0 };
    assert(dev.improvementPoints(podium) === 3 && dev.improvementPoints({ position: 8, status: 'clasificado', points: 4 }) === 2 && dev.improvementPoints(lapped) === 1, 'R45: 3 en el podio, 2 en los puntos, 1 por clasificarse');
    assert(dev.improvementPoints({ position: null, status: 'DSQ', points: 0 }) === 0 && dev.improvementPoints({ position: null, status: 'NC', points: 0 }) === 0 && dev.improvementPoints(undefined) === 0, 'R45: sin clasificarse no hay mejora');
    const once = dev.progressAfterRace(base, podium, 'carrera', 7, driver.id);
    assert(JSON.stringify(once) === JSON.stringify(dev.progressAfterRace(base, podium, 'carrera', 7, driver.id)), 'R45: misma semilla, misma mejora');
    const gained = Object.keys(once.gains);
    assert(gained.length === 3 && gained.every(k => once.gains[k] === 1 && once.next[k] === base[k] + 1) && dev.ATTRIBUTE_KEYS.filter(k => !gained.includes(k)).every(k => once.next[k] === base[k]),
      'R45: como máximo +1 por atributo y nada más cambia', JSON.stringify(once.gains));
    let focused = 0;
    for (let seed = 0; seed < 200; seed++) focused += Object.keys(dev.progressAfterRace(base, lapped, 'carrera', seed, driver.id).gains).filter(k => k === 'adelantamiento' || k === 'defensa').length;
    assert(focused > 80, 'R45: el enfoque concentra la mejora en sus atributos', `${focused}/200`);
    const full = Object.fromEntries(dev.ATTRIBUTE_KEYS.map(k => [k, 100]));
    const capped = dev.progressAfterRace({ ...full, lluvia: 99 }, podium, 'equilibrado', 3, driver.id);
    assert(Object.values(capped.next).every(v => v <= 100) && capped.next.lluvia === 100 && Object.keys(capped.gains).length === 1, 'R45: nunca por encima de 100');
  });

  await test('R45: guardado, recuperación y reinicio', () => {
    const drivers = [DRIVERS.alonso, DRIVERS.verstappen];
    let state = dev.emptyDevelopment();
    state = { ...state, focus: { alonso: 'lluvia' } };
    const after = dev.developAfterRace(state, drivers, d => d.id === 'alonso' ? { position: 1, status: 'clasificado', points: 25 } : { position: null, status: 'DSQ', points: 0 }, 11);
    const total = id => dev.ATTRIBUTE_KEYS.reduce((s, k) => s + after.attributes[id][k], 0);
    const baseTotal = id => dev.ATTRIBUTE_KEYS.reduce((s, k) => s + dev.baseAttributes(DRIVERS[id])[k], 0);
    assert(total('alonso') === baseTotal('alonso') + 3 && total('verstappen') === baseTotal('verstappen') && after.races === 1, 'R45: cada piloto mejora según su resultado');
    assert(Object.keys(state.attributes).length === 0, 'R45: no modifica el estado anterior');
    const restored = dev.parseDevelopment(JSON.stringify(after));
    assert(JSON.stringify(restored) === JSON.stringify(after) && JSON.stringify(dev.attributesOf(restored, DRIVERS.alonso)) === JSON.stringify(after.attributes.alonso), 'R45: se guarda y se recupera');
    assert(JSON.stringify(dev.parseDevelopment('no es json')) === JSON.stringify(dev.emptyDevelopment()) && JSON.stringify(dev.attributesOf(dev.emptyDevelopment(), DRIVERS.alonso)) === JSON.stringify(dev.baseAttributes(DRIVERS.alonso)),
      'R45: un guardado ilegible o reiniciado vuelve a los atributos iniciales');
  });

  await test('R45: pantalla de mejora del piloto', async () => {
    const { DriverProgressPanel } = await server.ssrLoadModule('/src/components/DriverProgressPanel.tsx');
    const next = { ...base, lluvia: base.lluvia + 1, ritmo: base.ritmo + 1 };
    const html = renderToStaticMarkup(createElement(DriverProgressPanel, {
      entries: [{ driver, attributes: next, gains: { lluvia: 1, ritmo: 1 }, focus: 'lluvia' }], onFocusChange: () => {},
    }));
    assert(html.includes('Mejora del piloto') && html.includes(driver.lastName) && (html.match(/\+1/g) ?? []).length === 2, 'R45 UI: muestra los +1 del piloto', String((html.match(/\+1/g) ?? []).length));
    assert(html.includes(`>${next.lluvia}<`) && Object.values(dev.ATTRIBUTE_LABEL).every(label => html.includes(label)), 'R45 UI: los ocho atributos con su valor');
    assert(Object.keys(dev.FOCUS).every(id => html.includes(`value="${id}"`)) && /value="lluvia" selected/.test(html), 'R45 UI: selector de enfoque con el elegido');
  });
}
