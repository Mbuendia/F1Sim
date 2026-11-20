// VS3 — Temperatura de pista en el agarre y el desgaste (Sprint 11). Contrato acordado con el usuario el 13/11/2026:
//  1. Cada circuito tiene su temperatura de salida, entre 15 y 55 °C; las carreras nocturnas salen más frías que las
//     diurnas calurosas.
//  2. La temperatura baja al caer el sol, con nubes y con lluvia, sin saltos bruscos.
//  3. A 38,5 °C (la de antes) los neumáticos se comportan exactamente igual: forzando la referencia, salen las huellas de
//     carrera que había antes de VS3.
//  4. Con pista caliente el blando se desgasta más por vuelta que a 38,5 °C, y proporcionalmente más que el duro.
//  5. Con pista fría el duro pierde agarre al salir de boxes y el blando, casi nada.
//  6. El efecto está acotado: entre la pista más fría y la más caliente, 0,6 s por vuelta y un 25 % de desgaste como mucho.
//  7. Misma semilla, misma carrera.
//  8. Los rivales no se quedan sin gomas más que antes: lo vigilan los tests de estrategia de neumáticos, sin tocarlos.
//  9. El jugador ve si la pista está fría, normal o caliente.
// 10. Tabla de antes y después en tres circuitos (docs/design/vs3-temperatura.md).
import { readFileSync, existsSync } from 'node:fs';
import { raceFingerprints } from '../support/race-fingerprint.mjs';

// Huellas de antes de VS3 (las que guardaba race-split-pf5 hasta el 13/11/2026): con la referencia forzada tienen que salir.
// [ES2, autorizado por el usuario el 20/11/2026 («Sí, cámbialos»)] Con el pit lane calibrado cambian, forzando 38,5 °C, las de Mónaco y Spa (antes 5ac23726… y cb8d7d78…):
// son las de antes de VS3 con el pit lane de ES2. Monza, sin paradas, sigue idéntica.
const BEFORE_VS3 = {
  'monza-seco': '3382658b1c9db1acd54b9eb48a29cc79c9ad99212858fcf0edae9e80bcdd05db',
  'monaco-lluvia-sc': '16a3bcf86a21171367ab72beb04822fd6c4b623ea1fa4a240334f71730c43b29',
  'spa-vsc-roja-ordenes': '9561b0909a04f29c418ffa336aee529eff232991c1f43e50ccd759f37b6b5730',
};
const LAP_S = 90, DT = 0.25;

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const tt = await load('/src/simulation/TrackTemperature.ts');
  const { TireModel } = await load('/src/simulation/TireModel.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const coldest = Math.min(...ids.map(tt.trackTempStart)) - tt.TRACK_TEMP_REFERENCE_C, hottest = Math.max(...ids.map(tt.trackTempStart)) - tt.TRACK_TEMP_REFERENCE_C;

  // Una tanda de `laps` vueltas con un perfil fijo (60 % de recta y 40 % de curvas, a izquierdas y a derechas).
  const stint = (compound, offset, laps) => {
    const tires = TireModel.createFreshTire(compound), driver = { tireManagement: 0.88 };
    let speed = 0, n = 0, firstLap = 0, firstN = 0;
    for (let s = 0; s < laps * LAP_S; s += DT) {
      const phase = (s % LAP_S) / LAP_S, corner = phase > 0.6, turn = corner ? (Math.floor(phase * 20) % 2 ? 0.7 : -0.7) : 0;
      const r = TireModel.updateTires(tires, driver, 'standard', 'normal', corner ? 0.6 : 1, corner, DT, LAP_S, { turn, speedKmh: corner ? 150 : 290, waterMm: 0, trackOffsetC: offset });
      speed += r.speedMultiplier; n++;
      if (s < LAP_S) { firstLap += r.speedMultiplier; firstN++; }
    }
    return { wear: 100 - tires.health, speed: speed / n, firstLap: firstLap / firstN, temp: tires.tempCelsius };
  };

  await test('VS3.1: cada circuito con su temperatura', () => {
    const out = ids.filter(id => !(tt.TRACK_TEMP_START_C[id] >= 15 && tt.TRACK_TEMP_START_C[id] <= 55));
    assert(ids.length >= 22 && out.length === 0, 'VS3: cada circuito tiene su temperatura de salida, entre 15 y 55 °C', out.join(', ') || `${ids.length} circuitos`);
    const night = ['las-vegas', 'bahrain', 'jeddah', 'marina-bay', 'lusail', 'yas-marina'].map(tt.trackTempStart);
    const hot = ids.map(tt.trackTempStart).sort((a, b) => b - a).slice(0, 5);
    assert(Math.max(...night) < Math.min(...hot), 'VS3: las carreras de noche salen más frías que las diurnas calurosas', `noche ≤ ${Math.max(...night)} °C, calurosas ≥ ${Math.min(...hot)} °C`);
    assert(new Set(ids.map(tt.trackTempStart)).size >= 10, 'VS3: los circuitos no comparten todos la misma temperatura');
  });

  await test('VS3.2: evolución de la temperatura', async () => {
    const at = (t, w = 0) => tt.trackTempOffset('barcelona', t, w);
    assert(at(3600) < at(0) && at(7200) < at(3600), 'VS3: la pista se enfría según avanza la tarde', `${at(0)} → ${at(3600)} → ${at(7200)}`);
    assert(at(0, 1) < at(0) && at(0, 5) >= at(0) - 8.01, 'VS3: el agua en pista la enfría, hasta 8 °C', `${at(0)} → ${at(0, 1)} → ${at(0, 5)}`);
    let jump = 0;
    for (let t = 0; t < 7200; t++) jump = Math.max(jump, Math.abs(at(t + 1) - at(t)));
    assert(jump <= 0.5, 'VS3: sin saltos bruscos de un segundo al siguiente', `${jump.toFixed(3)} °C como mucho`);
    const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
    const { updateWeather } = await load('/src/simulation/race/weather.ts');
    const temp = id => { const sim = new RaceSimulation(id); updateWeather(sim, 0.1); return sim.weather.trackTempCelsius; };
    const hungary = temp('hungaroring'), vegas = temp('las-vegas');
    assert(hungary > 45 && vegas < 25, 'VS3: el motor enseña la temperatura de cada circuito', `Hungaroring ${hungary} °C, Las Vegas ${vegas} °C`);
    const clouds = /CLOUD_TRACK_COOLING_C \* cloud \+ offset/.test(readFileSync('src/simulation/race/weather.ts', 'utf8'));
    assert(clouds, 'VS3: las nubes siguen enfriando el asfalto, como antes');
  });

  await test('VS3.3: a la temperatura de antes, la carrera de antes', async () => {
    tt.trackTempConfig.forceReference = true;
    try {
      const got = await raceFingerprints(server);
      for (const id of Object.keys(BEFORE_VS3)) assert(got[id]?.hash === BEFORE_VS3[id], `VS3: forzando 38,5 °C, ${id} deja el motor como antes de VS3`, got[id]?.hash?.slice(0, 16));
    } finally { tt.trackTempConfig.forceReference = false; }
    const a = stint('soft', 0, 3), b = stint('soft', undefined, 3);
    assert(a.wear === b.wear && a.speed === b.speed, 'VS3: sin diferencia de temperatura el neumático es el de antes');
  });

  await test('VS3.4 y 5: pista caliente y pista fría', () => {
    const softRef = stint('soft', 0, 8), softHot = stint('soft', hottest, 8), hardRef = stint('hard', 0, 8), hardHot = stint('hard', hottest, 8);
    const softUp = softHot.wear / softRef.wear, hardUp = hardHot.wear / hardRef.wear;
    assert(softUp > 1.02, 'VS3: con pista caliente el blando se desgasta más por vuelta', `×${softUp.toFixed(3)} a +${hottest} °C`);
    assert(softUp > hardUp, 'VS3: y proporcionalmente más que el duro', `blando ×${softUp.toFixed(3)}, duro ×${hardUp.toFixed(3)}`);
    const hardCold = stint('hard', coldest, 1), hardWarm = stint('hard', 0, 1), softCold = stint('soft', coldest, 1), softWarm = stint('soft', 0, 1);
    const hardLoss = 1 - hardCold.firstLap / hardWarm.firstLap, softLoss = 1 - softCold.firstLap / softWarm.firstLap;
    assert(hardLoss > 0.0005, 'VS3: con pista fría el duro pierde agarre en la vuelta de salida de boxes', `${(hardLoss * LAP_S).toFixed(2)} s en la vuelta, a ${coldest} °C`);
    assert(softLoss < hardLoss / 2, 'VS3: y el blando, casi nada', `blando ${(softLoss * LAP_S).toFixed(2)} s, duro ${(hardLoss * LAP_S).toFixed(2)} s`);
  });

  await test('VS3.6: efecto acotado', () => {
    let lap = 0, wear = 0;
    for (const c of ['soft', 'medium', 'hard']) {
      const cold = stint(c, coldest, 10), hot = stint(c, hottest, 10), ref = stint(c, 0, 10);
      lap = Math.max(lap, Math.abs(cold.speed - hot.speed) / ref.speed * LAP_S, Math.abs(cold.speed - ref.speed) / ref.speed * LAP_S, Math.abs(hot.speed - ref.speed) / ref.speed * LAP_S);
      wear = Math.max(wear, Math.abs(cold.wear - hot.wear) / ref.wear);
    }
    assert(lap <= 0.6, 'VS3: entre la pista más fría y la más caliente, 0,6 s por vuelta como mucho', `${lap.toFixed(2)} s`);
    assert(wear <= 0.25, 'VS3: y un 25 % de desgaste como mucho', `${(wear * 100).toFixed(1)} %`);
    assert(lap > 0.03 && wear > 0.03, 'VS3: el efecto existe: no es cero', `${lap.toFixed(2)} s, ${(wear * 100).toFixed(1)} %`);
  });

  await test('VS3.7: misma semilla, misma carrera', async () => {
    const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
    const auto = await load('/src/simulation/AutoRace.ts');
    const { createSnapshot } = await load('/src/simulation/Snapshot.ts');
    const short = () => { const sim = new RaceSimulation('hungaroring'); sim.seededPreparation = true; sim.setSeed(11); sim.setRaceFormat('sprint'); sim.setCircuit('hungaroring'); auto.startAutoRace(sim, []); for (let i = 0; i < 40; i++) auto.advanceAutoRace(sim, 1e9, 20); return JSON.stringify(createSnapshot(sim)); };
    assert(short() === short(), 'VS3: dos carreras con la misma semilla acaban igual');
    // Las huellas de hoy las guarda race-split-pf5 (regeneradas con VS3): ya no son las de antes.
    const now = readFileSync('tests/modules/race-split-pf5.mjs', 'utf8');
    assert(Object.values(BEFORE_VS3).every(h => !now.includes(h)), 'VS3: con la temperatura de cada circuito, las carreras ya no son las de antes');
  });

  await test('VS3.9 y 10: lo ve el jugador y hay tabla', () => {
    assert(tt.trackTempBand(20) === 'fria' && tt.trackTempBand(38.5) === 'normal' && tt.trackTempBand(50) === 'caliente', 'VS3: la pista es fría, normal o caliente según su temperatura');
    const panel = readFileSync('src/components/RightStatsPanel.tsx', 'utf8');
    assert(/trackTempBand\(/.test(panel) && /TRACK_TEMP_HINT/.test(panel), 'VS3: el panel del tiempo dice cómo está la pista y qué supone');
    const doc = existsSync('docs/design/vs3-temperatura.md') ? readFileSync('docs/design/vs3-temperatura.md', 'utf8') : '';
    assert(/\| *Antes *\|/i.test(doc) && /Las Vegas/.test(doc) && /Hungaroring/.test(doc), 'VS3: tabla de antes y después en un circuito frío, uno normal y uno caliente');
  });
}
