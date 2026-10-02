// R26 — D20 como variante opcional identificada, compatible con gestión y reglas (contrato aprobado por el usuario el
// 02/10/2026). El dado no forma parte del reglamento FIA: el perfil FIA 2025 es determinista y sin tiradas; ningún
// beneficio crea neumáticos o combustible, ni cambia potencia, energía o aerodinámica.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { getRuleSet } = await server.ssrLoadModule('/src/rules/ruleSets.ts');

  const rollWith = (sim, roll, trigger = 'sc', car = sim.cars[0]) => {
    const original = Math.random;
    Math.random = () => (roll - 0.5) / 20;
    try { return sim.triggerD20LuckRoll(trigger, car.driver.id); } finally { Math.random = original; }
  };

  await test('R26: variante opcional; el perfil FIA no tira el dado', () => {
    const on = make('barcelona', 2);
    const event = rollWith(on, 15);
    assert(event && on.activeLuckEvent === event && /variante del juego/i.test(event.variant) && /FIA/.test(event.variant), 'R26: activada por defecto e identificada como variante', event?.variant);
    const off = make('barcelona', 2);
    off.luckVariantEnabled = false;
    assert(rollWith(off, 15) === null && off.activeLuckEvent === null && off.luckLog.length === 0, 'R26: desactivada no hay tirada ni evento');
    const fia = make('barcelona', 2);
    fia.setRuleSet(getRuleSet('fia-2025'));
    assert(rollWith(fia, 15) === null && fia.activeLuckEvent === null, 'R26: con el perfil FIA 2025 nunca hay tirada');
  });

  await test('R26: el dado no altera la carrera', () => {
    const state = enabled => {
      const sim = make('barcelona', 4);
      const L = sim.activeTrack.lapLengthMeters;
      sim.cars.forEach((c, i) => { const p = 3.3 - i * 60 / L; Object.assign(c, { progress: p, trackT: p % 1, currentLap: 3 }); c.pitStop.playerControlled = true; });
      sim.luckVariantEnabled = enabled;
      sim.setSeed(26); sim.setFixedStep(0.02);
      for (let i = 0; i < 300; i++) sim.update(1 / 60);
      sim.deploySafetyCar('Prueba');
      sim.triggerD20LuckRoll('sc', sim.cars[0].driver.id);
      for (let i = 0; i < 3000; i++) sim.update(1 / 60);
      return JSON.stringify(sim.cars.map(c => [c.progress, c.currentSpeedKmh, c.fuelKg, c.tires.health, c.status]));
    };
    assert(state(true) === state(false), 'R26: misma semilla, misma carrera con el D20 activado o desactivado');
  });

  await test('R26: tirar y aceptar no cambia el estado físico', () => {
    const physical = sim => JSON.stringify(sim.cars.map(c => ({
      tires: c.tires, sets: c.tireInventory, fuel: c.fuelKg, mass: c.massKg, energy: c.energy, technical: c.technical,
      speed: c.currentSpeedKmh, progress: c.progress, mode: c.engineMode, engineTemp: c.engineTempCelsius, brakeTemp: c.brakeTempCelsius,
    })));
    let changed = [];
    for (const trigger of ['sc', 'vsc', 'red']) {
      for (let roll = 1; roll <= 20; roll++) {
        const sim = make('barcelona', 3);
        sim.update(0.02);
        const before = physical(sim);
        const event = rollWith(sim, roll, trigger);
        sim.applyLuckEventReward(event.id);
        if (physical(sim) !== before) changed.push(`${trigger}:${roll}`);
      }
    }
    assert(changed.length === 0, 'R26: 60 combinaciones de disparo y tirada sin cambios en neumáticos, juegos, combustible, energía, perfil técnico ni velocidad', changed.join(' '));
  });

  await test('R26: categoría, causa, alcance y registro', () => {
    const sim = make('barcelona', 2);
    const expected = { 20: 'preparacion', 15: 'riesgo', 10: 'informacion', 3: 'ninguna' };
    for (const [roll, category] of Object.entries(expected)) {
      const event = rollWith(sim, Number(roll));
      assert(event.benefit.category === category, `R26 tirada ${roll}: categoría ${category}`, event.benefit.category);
      assert(event.cause.includes(String(roll)) && /Safety Car/i.test(event.cause) && event.scope.length > 10, `R26 tirada ${roll}: causa y alcance declarados`, `${event.cause} · ${event.scope}`);
    }
    assert(/roja/i.test(rollWith(sim, 10, 'red').cause) && /informacion/.test(sim.activeLuckEvent.benefit.category), 'R26: bajo roja, informe con su causa');
    assert(sim.luckLog.length === 5 && sim.luckLog.every(l => l.roll && l.category && l.scope && l.applied === false), 'R26: cada tirada queda registrada', String(sim.luckLog.length));
    sim.applyLuckEventReward(sim.activeLuckEvent.id);
    assert(sim.luckLog[4].applied === true && sim.luckLog.slice(0, 4).every(l => !l.applied), 'R26: el registro marca el beneficio aceptado');
    sim.initRace();
    assert(sim.luckLog.length === 0, 'R26: el reinicio vacía el registro');
  });

  await test('R26: la interfaz identifica la variante y permite desactivarla', async () => {
    const { D20LuckResult } = await server.ssrLoadModule('/src/components/D20LuckModal.tsx');
    const { RaceMenu } = await server.ssrLoadModule('/src/components/RaceMenu.tsx');
    const sim = make('barcelona', 2);
    const modal = renderToStaticMarkup(createElement(D20LuckResult, { event: rollWith(sim, 15) }));
    assert(/variante del juego/i.test(modal) && /no es reglamento FIA/i.test(modal) && modal.includes('data-d20-category="riesgo"'), 'R26 UI: el modal identifica la variante y la categoría');
    const menu = on => renderToStaticMarkup(createElement(RaceMenu, {
      safetyCarDeployed: false, onToggleSafetyCarTest: () => {}, onRedFlagTest: () => {}, defaultOpen: true, luckVariantEnabled: on, onToggleLuckVariant: () => {},
    }));
    assert(/D20/.test(menu(true)) && menu(true).includes('aria-checked="true"') && menu(false).includes('aria-checked="false"'), 'R26 UI: interruptor del D20 en el menú de carrera');
  });
}
