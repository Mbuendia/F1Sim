// ES7 — Plan de lluvia (Sprint 16). Contrato aprobado por el usuario el 26/11/2026 («Sí, adelante»):
//  1. Los puntos de cruce coinciden con el motor: en el cruce los dos neumáticos van igual con la fórmula del motor, y con
//     más puntos de lluvia el cruce de seco a intermedio llega más tarde.
//  2. Con una previsión de prueba el plan cambia a intermedios en la vuelta en que el agua prevista pasa del cruce y vuelve
//     a seco cuando baja.
//  3. Con lluvia corta y ligera el plan dice no parar; con larga y fuerte, parar; un piloto con más puntos de lluvia aguanta
//     más antes de parar.
//  4. El plan de carrera enseña el plan de lluvia si hay lluvia prevista; en carrera el muro lo propone y al aceptarlo se
//     programan las paradas.
//  5. Documento con el cálculo.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const R = await server.ssrLoadModule('/src/simulation/RainPlan.ts');
  const { TireModel } = await server.ssrLoadModule('/src/simulation/TireModel.ts');
  const { tyreWaterGrip } = await server.ssrLoadModule('/src/simulation/WeatherModel.ts');
  const { wetGripFactor } = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const Wl = await server.ssrLoadModule('/src/simulation/race/wall.ts');
  // El ritmo del motor (carStep): multiplicador del compuesto × agarre con agua frente al suyo en seco, con los puntos de lluvia.
  const engine = (c, d, wp = 0) => TireModel.getCompoundProperties(c).baseSpeedMultiplier * (d > 0 ? wetGripFactor(tyreWaterGrip(c, d) / tyreWaterGrip(c, 0), wp) : 1);
  const forecast = (fromMin, toMin, mmh) => ({ issuedAtSec: 0, rainingNow: false, nextRainInSec: null, nextRainMarginSec: null, dryInSec: null, dryMarginSec: null,
    slots: [0, 1, 2, 3].map(k => { const on = k * 5 >= fromMin && k * 5 < toMin; return { fromMin: k * 5, toMin: k * 5 + 5, sectors: [], probability: on ? 0.9 : 0, rainMmH: on ? mmh : 0, uncertainty: 0.1 }; }) });

  await test('ES7.1: puntos de cruce como el motor', () => {
    const c = R.rainCrossovers('medium'), c10 = R.rainCrossovers('medium', 10);
    const eq = Math.abs(engine('medium', c.toIntermediate) - engine('intermediate', c.toIntermediate)) < 1e-6 && Math.abs(engine('intermediate', c.toWet) - engine('wet', c.toWet)) < 1e-6;
    const sides = engine('medium', c.toIntermediate - 0.05) > engine('intermediate', c.toIntermediate - 0.05) && engine('intermediate', c.toIntermediate + 0.05) > engine('medium', c.toIntermediate + 0.05);
    const same = ['soft', 'medium', 'intermediate', 'wet'].every(k => [0, 0.5, 2, 4].every(d => Math.abs(R.wetPace(k, d, 6) - engine(k, d, 6)) < 1e-12));
    const later = c10.toIntermediate > c.toIntermediate && c.toIntermediate < c.toWet;
    assert(eq && sides && same && later, 'ES7: en el cruce de seco a intermedio y de intermedio a lluvia los dos neumáticos van igual con la fórmula del motor; con más puntos de lluvia el cruce a intermedio llega más tarde',
      JSON.stringify({ eq, sides, same, later, c, c10 }));
  });

  await test('ES7.2: cambia cuando el agua pasa del cruce y vuelve a seco', () => {
    const f = forecast(5, 15, 10), lapSec = 80;
    const water = R.waterByLap(0, f, 30, lapSec);
    const p = R.rainPlan({ current: 'medium', depthNowMm: 0, forecast: f, lap: 10, lapsLeft: 40, lapSec, pitLossSec: 22 });
    const cross = R.rainCrossovers('medium').toIntermediate;
    const toInter = p.stops[0], back = p.stops[1];
    const firstWet = water.findIndex(d => d > cross);
    const okIn = toInter && toInter.compound === 'intermediate' && Math.abs((toInter.lap - 10 + 1) - firstWet) <= 2;
    const okBack = back && back.compound === 'medium' && back.lap > toInter.lap && water[back.lap - 10 + 1] < water[toInter.lap - 10 + 1 + 3];
    const rises = water[Math.floor(600 / lapSec)] > water[0] && water[29] < Math.max(...water);
    assert(okIn && okBack && rises, 'ES7: con lluvia de 10 mm/h de los minutos 5 a 15, el plan monta intermedios cuando el agua prevista pasa del cruce y vuelve a seco cuando baja',
      JSON.stringify({ stops: p.stops, firstWet, cross, water: water.map(w => +w.toFixed(2)) }));
  });

  await test('ES7.3: no parar con lluvia corta, parar con larga; el buen piloto aguanta más', () => {
    const base = { current: 'medium', depthNowMm: 0, lap: 10, lapsLeft: 40, lapSec: 80, pitLossSec: 22 };
    const light = R.rainPlan({ ...base, forecast: forecast(5, 10, 4) });
    const heavy = R.rainPlan({ ...base, forecast: forecast(5, 20, 25) });
    const okLight = light.stops.length === 0 && light.rainMatters && /no parar/.test(R.rainPlanText(light, 'medium'));
    const okHeavy = heavy.stops.length >= 1 && ['intermediate', 'wet'].includes(heavy.stops[0].compound);
    const m0 = R.rainPlan({ ...base, forecast: forecast(5, 15, 10) }), m10 = R.rainPlan({ ...base, forecast: forecast(5, 15, 10), wetPoints: 10 });
    const later = m0.stops.length && m10.stops.length && m10.stops[0].lap >= m0.stops[0].lap && (m10.stops[0].lap > m0.stops[0].lap || m10.staySec - m10.planSec < m0.staySec - m0.planSec);
    assert(okLight && okHeavy && later, 'ES7: con lluvia corta y ligera el plan dice no parar; con larga y fuerte, parar a intermedio o lluvia; con más puntos de lluvia se aguanta más (para más tarde o gana menos parando)',
      JSON.stringify({ light: light.stops, heavy: heavy.stops, m0: m0.stops, m10: m10.stops }));
  });

  await test('ES7.4: en el plan de carrera y en el muro', () => {
    const screen = src('src/components/RacePlanScreen.tsx');
    const inPlan = screen.includes('data-plan-rain') && screen.includes('rainPlanText(p, plan.compound)') && src('src/App.tsx').includes('weather={{ forecast: simulation.getRainForecast()');
    const sim = new RaceSimulation('barcelona');
    const car = sim.cars[0];
    sim.playerCars = [car.driver.id];
    sim.lightState = 'racing';
    car.currentLap = 10;
    car.pitStop.plannedStops = [{ lap: 30, compound: 'hard' }];
    sim.getRainForecast = () => forecast(5, 15, 10);
    Wl.proposeRainPlan(sim, car);
    const p = car.wallProposals?.find(x => x.key.startsWith('plan:L'));
    const proposed = Boolean(p && p.kind === 'plan' && p.stops[0].compound === 'intermediate' && p.stops.length === 2 && p.stops[1].compound === 'hard' && !p.stops.some(s => s.lap === 30) && /Plan lluvia/.test(p.reason));
    const accepted = p ? sim.acceptWallProposal(car.id, p.id) : false;
    const applied = accepted && car.pitStop.plannedStops[0].compound === 'intermediate';
    // Sin lluvia prevista, no se propone nada.
    const dry = new RaceSimulation('barcelona'), dc = dry.cars[0];
    dry.playerCars = [dc.driver.id]; dc.currentLap = 10;
    dry.getRainForecast = () => forecast(99, 99, 0);
    Wl.proposeRainPlan(dry, dc);
    const none = !dc.wallProposals?.some(x => x.key.startsWith('plan:L'));
    const wired = src('src/simulation/race/wall.ts').includes('if (proposing && lapChanged) proposeRainPlan(sim, car);');
    assert(inPlan && proposed && applied && none && wired, 'ES7: el plan de carrera enseña el plan de lluvia con la previsión; en carrera el muro propone «Plan lluvia» (intermedios y vuelta a seco con el compuesto de la siguiente parada, que sobra) y aceptarlo las programa; sin lluvia no propone nada',
      JSON.stringify({ inPlan, proposed, applied, none, wired, stops: p?.stops }));
  });

  await test('ES7.5: documento', () => {
    const doc = existsSync('docs/es7-lluvia.md') ? src('docs/es7-lluvia.md') : '';
    const ok = /cruce/.test(doc) && /intermedio/.test(doc) && /no parar/i.test(doc);
    assert(ok, 'ES7: docs/es7-lluvia.md explica los puntos de cruce y el plan de lluvia', String(ok));
  });
}
