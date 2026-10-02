// R06 (primera entrega) — Cuatro neumáticos con carga por sentido de curva y temperatura por rueda (contrato
// aprobado por el usuario el 01/10/2026). Ventanas de temperatura: calibración del juego, no tabla oficial.
//  1. Curva a derechas carga las ruedas izquierdas y viceversa; Barcelona (horario) gasta más la izquierda e
//     Interlagos (antihorario) la derecha.  2. Fuera de la ventana hay menos agarre; por encima, más desgaste.
//  3. Out-lap fría 0,3–2,0 s más lenta que la vuelta siguiente.  4. Push: más temperatura y desgaste.
//  5. Enfriar no repara.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { TireModel } = await server.ssrLoadModule('/src/simulation/TireModel.ts');
  const make = await raceFactory(server);
  const driver = { tireManagement: 0.88 };
  const left = t => t.healthFL + t.healthRL, right = t => t.healthFR + t.healthRR;
  const step = (tire, turn, { mode = 'standard', aggression = 'balanced', seconds = 30, speedKmh = 180, factor = 0.5 } = {}) => {
    for (let i = 0; i < seconds / 0.1; i++) {
      TireModel.updateTires(tire, driver, mode, aggression, factor, turn !== 0, 0.1, 80, { turn, speedKmh });
    }
  };

  await test('R06: la curva carga la rueda exterior correcta', () => {
    const rightHand = TireModel.createFreshTire('medium'), leftHand = TireModel.createFreshTire('medium');
    step(rightHand, 1); step(leftHand, -1);
    assert(left(rightHand) < right(rightHand), 'R06: a derechas se gastan más las ruedas izquierdas (exteriores)',
      `izq ${left(rightHand).toFixed(3)} · der ${right(rightHand).toFixed(3)}`);
    assert(right(leftHand) < left(leftHand), 'R06: a izquierdas se gastan más las ruedas derechas (exteriores)');
    assert(rightHand.tempFL > rightHand.tempFR && leftHand.tempFR > leftHand.tempFL, 'R06: la rueda exterior se calienta más');

    for (const [circuit, side] of [['barcelona', 'izquierdo'], ['interlagos', 'derecho']]) {
      const sim = make(circuit, 1);
      const car = sim.cars[0];
      Object.assign(car, { progress: 1, trackT: 0, currentLap: 1, currentSpeedKmh: 250 });
      sim.setSeed(5); sim.setFixedStep(0.02);
      while (car.currentLap < 2 && sim.raceTimeSec < 300) sim.update(1 / 60);
      const t = car.tires;
      const ok = side === 'izquierdo' ? left(t) < right(t) : right(t) < left(t);
      assert(ok, `R06: en una vuelta de ${circuit} se gasta más el lado ${side}`, `izq ${left(t).toFixed(3)} · der ${right(t).toFixed(3)}`);
    }
  });

  await test('R06: ventana de temperatura por compuesto', () => {
    for (const compound of ['soft', 'medium', 'hard']) {
      const { min, max } = TireModel.TEMP_WINDOW[compound];
      const inside = (min + max) / 2;
      assert(TireModel.tempGripFactor(compound, inside) === 1, `R06: ${compound} con agarre completo dentro de su ventana`);
      assert(TireModel.tempGripFactor(compound, min - 20) < 1, `R06: ${compound} frío tiene menos agarre`);
      assert(TireModel.tempGripFactor(compound, max + 15) < 1 && TireModel.tempWearFactor(compound, max + 15) > TireModel.tempWearFactor(compound, inside),
        `R06: ${compound} sobrecalentado tiene menos agarre y más desgaste`);
    }
    const windows = ['soft', 'medium', 'hard'].map(c => JSON.stringify(TireModel.TEMP_WINDOW[c]));
    assert(new Set(windows).size === 3, 'R06: cada compuesto tiene su propia ventana', windows.join(' '));
    assert(TireModel.BLANKET_TEMP_C < TireModel.TEMP_WINDOW.medium.min, 'R06: el juego nuevo sale por debajo de la ventana (mantas)');
    const fresh = TireModel.createFreshTire('medium');
    assert([fresh.tempFL, fresh.tempFR, fresh.tempRL, fresh.tempRR].every(t => t === TireModel.BLANKET_TEMP_C), 'R06: juego nuevo a temperatura de mantas');
  });

  await test('R06: la out-lap con neumático frío cuesta tiempo', () => {
    const sim = make('barcelona', 1);
    const car = sim.cars[0];
    car.tires = TireModel.createFreshTire('medium');
    Object.assign(car, { progress: 1.999, trackT: 0.999, currentLap: 1, currentSpeedKmh: 250 });
    sim.setSeed(5); sim.setFixedStep(0.02);
    while (car.lapHistory.length < 2 && sim.raceTimeSec < 600) sim.update(1 / 60);
    const [cold, warm] = car.lapHistory.map(l => l.lapTime);
    const cost = cold - warm;
    assert(cost >= 0.3 && cost <= 2.0, 'R06: la vuelta con el juego frío es 0,3–2,0 s más lenta que la siguiente', `${cost.toFixed(3)} s`);
  });

  await test('R06: Push exige más al neumático', () => {
    const balanced = TireModel.createFreshTire('medium'), push = TireModel.createFreshTire('medium');
    for (let lap = 0; lap < 3; lap++) {
      for (const turn of [1, 0, -1, 0]) {
        step(balanced, turn, { seconds: 20 });
        step(push, turn, { seconds: 20, mode: 'push', aggression: 'aggressive' });
      }
    }
    const meanTemp = t => (t.tempFL + t.tempFR + t.tempRL + t.tempRR) / 4;
    assert(meanTemp(push) > meanTemp(balanced), 'R06: Push calienta más', `${meanTemp(push).toFixed(1)} / ${meanTemp(balanced).toFixed(1)} °C`);
    assert(push.health < balanced.health, 'R06: Push desgasta más', `${push.health.toFixed(2)} / ${balanced.health.toFixed(2)} %`);
  });

  await test('R06: enfriar no repara el desgaste', () => {
    const tire = TireModel.createFreshTire('soft');
    step(tire, 1, { seconds: 60, mode: 'push', aggression: 'aggressive', factor: 0.4 });
    const hot = { ...tire };
    let repaired = false;
    for (let i = 0; i < 600; i++) {
      const before = [tire.healthFL, tire.healthFR, tire.healthRL, tire.healthRR];
      TireModel.updateTires(tire, driver, 'low', 'conservative', 1, false, 0.1, 80, { turn: 0, speedKmh: 320 });
      if ([tire.healthFL, tire.healthFR, tire.healthRL, tire.healthRR].some((h, k) => h > before[k])) repaired = true;
    }
    assert(tire.tempFL < hot.tempFL, 'R06: en recta larga el neumático se enfría', `${hot.tempFL.toFixed(1)} → ${tire.tempFL.toFixed(1)} °C`);
    assert(!repaired && tire.health <= hot.health, 'R06: ninguna rueda recupera salud al enfriarse');
  });
}
