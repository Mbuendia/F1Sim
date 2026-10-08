// R54 — Muro del jugador con sus dos pilotos (contrato aprobado por el usuario el 08/10/2026).
//  1. En los coches del jugador el estratega propone parada (con compuesto) y ritmo con su motivo, sin duplicar
//     propuestas, y las retira si dejan de tener sentido.
//  2. Nunca actúa sin confirmación: sin aceptar, esos coches no reciben orden de boxes ni cambian de ritmo, mientras
//     los de la IA sí.
//  3. Aceptar ejecuta la propuesta como una orden del jugador; descartar la quita y no se repite hasta la vuelta
//     siguiente.
//  4. Energía por vuelta: una propuesta de ritmo por vuelta como mucho (atacar con batería y un rival a menos de 1 s,
//     recargar con la batería baja, ahorrar si la gasolina no llega).
//  5. Solo información observable: las propuestas no cambian si cambia un futuro que el radar no ve.
//  6. Lo nuevo se guarda y se carga.
//  7. Test de interfaz de las propuestas con aceptar y descartar.
//  8. Revisión en el navegador (manual; en el dashboard).
// Decisión del usuario: cada coche tiene un interruptor «Delegar en el estratega», apagado al empezar; encendido, el
// estratega ejecuta como hasta ahora, y una orden del jugador lo apaga.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const wall = await server.ssrLoadModule('/src/simulation/Wall.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const { EnergyModel } = await server.ssrLoadModule('/src/simulation/EnergyModel.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const SLICKS = ['soft', 'medium', 'hard'];
  const rainCell = over => ({ startSec: 60, endSec: 9000, centerT: 0, widthT: 1, rateMmH: 20, driftTPerSec: 0, ...over });

  /** Un coche con el neumático gastado (el estratega quiere parar ya), del jugador o de la IA. */
  const worn = ({ player = true, scenario = null } = {}) => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    Object.assign(car, { progress: 2.3, trackT: 0.3, currentLap: 2, currentSpeedKmh: 220 });
    car.pitStop.scheduledLap = 0;
    Object.assign(car.tires, { health: 30, healthFL: 30, healthFR: 30, healthRL: 30, healthRR: 30, lapsOnTire: 20 });
    if (player) sim.setPlayerCars([car.driver.id]);
    if (scenario) sim.setWeatherScenario(scenario);
    sim.setSeed(54); sim.setFixedStep(0.02);
    return { sim, car };
  };
  const run = (sim, seconds) => { const end = sim.raceTimeSec + seconds; while (sim.raceTimeSec < end) sim.update(1 / 60); };
  const stops = (sim, car) => sim.getWallProposals(car.id).filter(p => p.kind === 'parada');
  const paces = (sim, car) => sim.getWallProposals(car.id).filter(p => p.kind === 'ritmo');

  const original = Math.random;
  Math.random = () => 0.99;
  try {
    await test('R54: el estratega propone y no actúa sin confirmación', () => {
      const ai = worn({ player: false });
      run(ai.sim, 5);
      assert(ai.car.pitStop.activeBoxOrder?.issuer === 'ai' && SLICKS.includes(ai.car.pitStop.activeBoxOrder.compound) && ai.sim.getWallProposals(ai.car.id).length === 0,
        'R54 (preparación): en un coche de la IA, el estratega ordena la parada él mismo', JSON.stringify(ai.car.pitStop.activeBoxOrder));

      const { sim, car } = worn();
      run(sim, 5);
      const pending = stops(sim, car);
      assert(pending.length === 1 && SLICKS.includes(pending[0].compound) && /desgaste/i.test(pending[0].reason) && pending[0].lap === car.currentLap && pending[0].id,
        'R54: en un coche del jugador, la misma decisión llega como propuesta de parada con compuesto y motivo', JSON.stringify(pending));
      assert(!car.pitStop.activeBoxOrder && car.tires.compound === 'medium' && car.pitStop.totalPitStops === 0, 'R54: sin aceptar, el coche no recibe orden de boxes');
      run(sim, 20);
      assert(stops(sim, car).length === 1 && stops(sim, car)[0].id === pending[0].id, 'R54: la propuesta no se duplica mientras sigue vigente');
      assert(car.paceMode === 'balanced' && !car.paceByPlayer, 'R54: tampoco se le cambia el ritmo');

      // Se retira si deja de tener sentido: con neumáticos nuevos ya no hay que parar.
      Object.assign(car.tires, { health: 95, healthFL: 95, healthFR: 95, healthRL: 95, healthRR: 95, lapsOnTire: 1 });
      run(sim, 5);
      assert(stops(sim, car).length === 0 && !car.pitStop.activeBoxOrder, 'R54: la propuesta se retira cuando deja de tener sentido');
    });

    await test('R54: aceptar y descartar', () => {
      const accepted = worn();
      run(accepted.sim, 5);
      const proposal = stops(accepted.sim, accepted.car)[0];
      assert(accepted.sim.acceptWallProposal(accepted.car.id, proposal.id) === true, 'R54: la propuesta se puede aceptar');
      const order = accepted.car.pitStop.activeBoxOrder;
      assert(order && order.issuer === 'player' && order.compound === proposal.compound && accepted.car.pitStop.playerControlled === true, 'R54: aceptar la ejecuta como una orden del jugador', JSON.stringify(order));
      assert(accepted.sim.getWallProposals(accepted.car.id).every(p => p.id !== proposal.id) && accepted.sim.acceptWallProposal(accepted.car.id, proposal.id) === false, 'R54: una propuesta aceptada deja de estar pendiente');
      run(accepted.sim, 5);
      assert(stops(accepted.sim, accepted.car).length === 0, 'R54: con la orden en marcha no se propone otra parada');

      const discarded = worn();
      run(discarded.sim, 5);
      const first = stops(discarded.sim, discarded.car)[0], lap = discarded.car.currentLap;
      assert(discarded.sim.discardWallProposal(discarded.car.id, first.id) === true && stops(discarded.sim, discarded.car).length === 0, 'R54: la propuesta se puede descartar');
      let repeatedSameLap = false;
      while (discarded.sim.raceTimeSec < 200) { discarded.sim.update(1 / 60); if (discarded.car.currentLap !== lap) break; repeatedSameLap ||= stops(discarded.sim, discarded.car).length > 0; }
      assert(!repeatedSameLap && !discarded.car.pitStop.activeBoxOrder, 'R54: descartada, no se repite en la misma vuelta ni se ejecuta');
      run(discarded.sim, 5);
      const again = stops(discarded.sim, discarded.car);
      assert(discarded.car.currentLap > lap && again.length === 1 && again[0].id !== first.id, 'R54: en la vuelta siguiente, si sigue haciendo falta, se vuelve a proponer');
      assert(discarded.sim.discardWallProposal(discarded.car.id, 'no-existe') === false && discarded.sim.acceptWallProposal(999, again[0].id) === false, 'R54: aceptar o descartar algo que no existe no hace nada');
    });

    await test('R54: el jugador decide; la IA sigue su estrategia', () => {
      // Lluvia: los coches de la IA piden intermedios; los del jugador solo reciben la propuesta.
      const sim = make('barcelona', 4);
      const L = sim.activeTrack.lapLengthMeters;
      sim.cars.forEach((c, i) => { const p = 2.6 - i * 80 / L; Object.assign(c, { progress: p, trackT: p % 1, currentLap: 2, currentSpeedKmh: 220 }); c.pitStop.scheduledLap = 0; });
      const [aiOne, mine, aiTwo, mineToo] = sim.cars;
      sim.setPlayerCars([mine.driver.id, mineToo.driver.id]);
      sim.setWeatherScenario({ id: 'lluvia', cells: [rainCell({})] });
      sim.setSeed(54); sim.setFixedStep(0.02);
      const aiOrders = new Set();
      while (sim.raceTimeSec < 260) {
        sim.update(1 / 60);
        for (const car of [aiOne, aiTwo]) if (['intermediate', 'wet'].includes(car.pitStop.activeBoxOrder?.compound) || ['intermediate', 'wet'].includes(car.tires.compound)) aiOrders.add(car.id);
      }
      assert(aiOrders.size === 2, 'R54 (preparación): con lluvia, los dos coches de la IA cambian a neumáticos de agua');
      for (const car of [mine, mineToo]) {
        const proposal = stops(sim, car)[0];
        assert(!car.pitStop.activeBoxOrder && car.tires.compound === 'medium' && car.pitStop.totalPitStops === 0 && car.paceMode === 'balanced',
          `R54: ${car.driver.code} (del jugador) no recibe órdenes ni cambia de ritmo sin confirmación`);
        assert(proposal && ['intermediate', 'wet'].includes(proposal.compound) && /lluvia/i.test(proposal.reason), `R54: ${car.driver.code} tiene la propuesta de montar neumáticos de agua, con su motivo`, JSON.stringify(proposal));
      }

      // Delegar: con el interruptor encendido el estratega ejecuta; una orden del jugador lo apaga.
      const delegated = worn();
      run(delegated.sim, 3);
      assert(stops(delegated.sim, delegated.car).length === 1, 'R54 (preparación): propuesta pendiente antes de delegar');
      delegated.sim.setWallDelegation(delegated.car.id, true);
      run(delegated.sim, 3);
      assert(delegated.car.wallDelegated === true && delegated.car.pitStop.activeBoxOrder?.issuer === 'ai' && delegated.sim.getWallProposals(delegated.car.id).length === 0,
        'R54: con «Delegar» encendido, el estratega ejecuta y no quedan propuestas', JSON.stringify(delegated.car.pitStop.activeBoxOrder));
      const manual = worn();
      manual.sim.setWallDelegation(manual.car.id, true);
      manual.sim.issuePaceOrder(manual.car.id, 'push');
      assert(manual.car.wallDelegated === false, 'R54: una orden del jugador apaga la delegación');
    });

    await test('R54: energía por vuelta', () => {
      const duel = ({ storedMJ = 4, gapM = 40 } = {}) => {
        const sim = make('barcelona', 2), [rival, mine] = sim.cars, L = sim.activeTrack.lapLengthMeters;
        Object.assign(rival, { progress: 2.3 + gapM / L, trackT: 0.3 + gapM / L, currentLap: 2, currentSpeedKmh: 220 });
        Object.assign(mine, { progress: 2.3, trackT: 0.3, currentLap: 2, currentSpeedKmh: 220 });
        mine.energy = { ...EnergyModel.create(), storedMJ };
        sim.setPlayerCars([mine.driver.id]);
        sim.setSeed(54); sim.setFixedStep(0.02);
        return { sim, rival, mine };
      };
      const attack = duel();
      run(attack.sim, 2);
      const push = paces(attack.sim, attack.mine);
      assert(push.length === 1 && push[0].paceMode === 'push' && push[0].reason.includes(attack.rival.driver.code) && /bater/i.test(push[0].reason) && attack.mine.paceMode === 'balanced',
        'R54: con batería y un rival a menos de 1 s, propone atacar esa vuelta (sin cambiar el ritmo)', JSON.stringify(push));
      const lap = attack.mine.currentLap;
      let extra = false;
      attack.sim.discardWallProposal(attack.mine.id, push[0].id);
      while (attack.sim.raceTimeSec < 200) { attack.sim.update(1 / 60); if (attack.mine.currentLap !== lap) break; extra ||= paces(attack.sim, attack.mine).length > 0; }
      assert(!extra && attack.mine.currentLap === lap + 1, 'R54: como mucho una propuesta de ritmo por vuelta');
      run(attack.sim, 2);
      const next = paces(attack.sim, attack.mine);
      assert(next.length <= 1 && next.every(p => p.lap === lap + 1), 'R54: en la vuelta siguiente se vuelve a valorar el ritmo');

      const accept = duel();
      run(accept.sim, 2);
      const proposal = paces(accept.sim, accept.mine)[0];
      assert(accept.sim.acceptWallProposal(accept.mine.id, proposal.id) && accept.mine.paceMode === 'push' && accept.mine.paceByPlayer === true && paces(accept.sim, accept.mine).length === 0,
        'R54: aceptar la propuesta de ritmo lo cambia como una orden del jugador');

      // Con la carrera neutralizada no se propone atacar (corrección del 08/10/2026, vista en la revisión de T3.1).
      const neutral = duel();
      neutral.sim.deploySafetyCar('Prueba');
      let attackProposed = false;
      while (neutral.sim.raceTimeSec < 5) { neutral.sim.update(1 / 60); attackProposed ||= paces(neutral.sim, neutral.mine).some(p => p.paceMode === 'push'); }
      assert(neutral.sim.raceFlagState === 'sc' && !attackProposed, 'R54: con Safety Car no se propone atacar');

      const alone = duel({ gapM: 900 });
      run(alone.sim, 2);
      assert(paces(alone.sim, alone.mine).length === 0, 'R54: sin rivales cerca y con el ritmo normal, no se propone nada');
      const empty = duel({ storedMJ: 0.3, gapM: 900 });
      run(empty.sim, 2);
      const recharge = paces(empty.sim, empty.mine);
      assert(recharge.length === 1 && recharge[0].paceMode === 'save' && /recarga/i.test(recharge[0].reason), 'R54: con la batería baja, propone una vuelta de recarga', JSON.stringify(recharge));

      // Gasolina que no llega: ahorro, con prioridad sobre atacar.
      const thirsty = duel();
      thirsty.sim.totalLaps = 10;
      thirsty.mine.fuelKg = RejoinModel.lapFuelKg(thirsty.sim.activeTrack, thirsty.mine) * (10 - thirsty.mine.progress);
      run(thirsty.sim, 2);
      const save = paces(thirsty.sim, thirsty.mine);
      assert(save.length === 1 && save[0].paceMode === 'save' && /combustible|gasolina/i.test(save[0].reason), 'R54: si la gasolina no llega, propone ahorrar', JSON.stringify(save));

      // La regla, sola.
      const rule = input => wall.paceProposal({ fuelShort: false, batteryPercent: 80, gapAheadSec: null, aheadCode: null, gapBehindSec: null, behindCode: null, current: 'balanced', ...input });
      assert(rule({}) === null && rule({ current: 'push' }).paceMode === 'balanced', 'R54: sin motivo para otro ritmo, propone volver al normal (o nada si ya lo lleva)');
      assert(rule({ gapBehindSec: 0.5, behindCode: 'SAI' }).paceMode === 'push' && /SAI/.test(rule({ gapBehindSec: 0.5, behindCode: 'SAI' }).reason), 'R54: también para defenderse del que viene detrás');
      assert(rule({ gapAheadSec: 0.5, aheadCode: 'RUS', batteryPercent: 30 }) === null, 'R54: sin batería suficiente no propone atacar');
    });

    await test('R54: solo información observable, y se guarda', () => {
      const trace = scenario => {
        const { sim, car } = worn({ scenario });
        const log = [];
        while (sim.raceTimeSec < 120) { sim.update(1 / 60); log.push(JSON.stringify(sim.getWallProposals(car.id).map(p => [p.kind, p.compound ?? p.paceMode, p.reason]))); }
        return log.join('|');
      };
      const dry = trace({ id: 'a', cells: [] });
      const farStorm = trace({ id: 'a', cells: [rainCell({ startSec: 120 + 1200 + 60, endSec: 4000, rateMmH: 40 })] });
      const nearStorm = trace({ id: 'a', cells: [rainCell({ startSec: 150, endSec: 4000, rateMmH: 40 })] });
      assert(dry === farStorm, 'R54: las propuestas no cambian si cambia un futuro que el radar no ve');
      assert(dry !== nearStorm, 'R54: y sí cambian con lo que el radar ve venir');

      const { sim, car } = worn();
      run(sim, 5);
      const before = JSON.stringify(sim.getWallProposals(car.id));
      const target = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(target, JSON.stringify(snap.createSnapshot(sim)));
      const restored = target.cars.find(c => c.id === car.id);
      assert(outcome.ok && JSON.stringify(target.getWallProposals(restored.id)) === before && before.length > 2, 'R54: las propuestas pendientes vuelven con la partida', outcome.errors?.join(' · '));
      run(target, 10);
      assert(!restored.pitStop.activeBoxOrder && target.getWallProposals(restored.id).some(p => p.kind === 'parada'), 'R54: tras cargar, el coche sigue siendo del jugador: se propone, no se ejecuta');
    });

    await test('R54: tampoco con pinchazo, neumático destrozado o bandera roja', () => {
      // Corrección del 08/10/2026: ni siquiera la entrada «forzada» se hace sin el jugador; se propone con urgencia.
      const urgent = ({ player, delegated = false, puncture }) => {
        const sim = make('barcelona', 1), car = sim.cars[0], entry = sim.activeTrack.pitEntryT;
        const t = ((entry - 0.04) % 1 + 1) % 1;
        Object.assign(car, { progress: 2 + t, trackT: t, currentLap: 2, currentSpeedKmh: 200 });
        if (puncture) { car.hasPuncture = true; Object.assign(car.tires, { healthFL: 0 }); }
        else Object.assign(car.tires, { health: 4, healthFL: 4, healthFR: 4, healthRL: 4, healthRR: 4, lapsOnTire: 30 });
        if (player) sim.setPlayerCars([car.driver.id]);
        sim.setSeed(54); sim.setFixedStep(0.02);
        if (delegated) sim.setWallDelegation(car.id, true);
        let entered = false;
        const end = car.progress + 0.12;
        while (car.progress < end && sim.raceTimeSec < 120) { sim.update(1 / 60); entered ||= car.isInPitLane; }
        return { sim, car, entered };
      };
      for (const puncture of [true, false]) {
        const what = puncture ? 'un pinchazo' : 'el neumático destrozado';
        const ai = urgent({ player: false, puncture }), mine = urgent({ player: true, puncture }), handed = urgent({ player: true, delegated: true, puncture });
        const proposal = stops(mine.sim, mine.car)[0];
        assert(ai.entered && handed.entered, `R54 (preparación): con ${what}, un coche de la IA o uno delegado entra en boxes por su cuenta`);
        assert(!mine.entered && mine.car.pitStop.totalPitStops === 0 && !mine.car.pitStop.activeBoxOrder, `R54: con ${what}, el coche del jugador no entra en boxes sin su confirmación`);
        assert(proposal && (puncture ? /pinchazo/i : /destrozado/i).test(proposal.reason) && proposal.compound, `R54: y recibe la propuesta urgente de parar`, JSON.stringify(proposal ?? null));
        // Aceptarla lo lleva a boxes en la siguiente entrada.
        mine.sim.acceptWallProposal(mine.car.id, proposal.id);
        let entered = false;
        while (!entered && mine.sim.raceTimeSec < 400) { mine.sim.update(1 / 60); entered = mine.car.isInPitLane; }
        assert(entered, `R54: al aceptarla, entra`);
      }

      // Si ya había una propuesta de parada por otro motivo, la urgente la sustituye: el jugador tiene que ver el pinchazo.
      const pending = worn();
      run(pending.sim, 3);
      const earlier = stops(pending.sim, pending.car)[0];
      pending.car.hasPuncture = true;
      run(pending.sim, 1);
      const replaced = stops(pending.sim, pending.car);
      assert(/desgaste/i.test(earlier.reason) && replaced.length === 1 && replaced[0].id !== earlier.id && /pinchazo/i.test(replaced[0].reason), 'R54: una propuesta de parada anterior se sustituye por la urgente', JSON.stringify(replaced));

      // Bandera roja: a los coches de la IA (y a los delegados) se les cambian los neumáticos gastados; a los del jugador, no.
      const sim = make('barcelona', 4), L = sim.activeTrack.lapLengthMeters;
      sim.cars.forEach((c, i) => {
        const p = 3.3 - i * 70 / L;
        Object.assign(c, { progress: p, trackT: p % 1, currentLap: 3, currentSpeedKmh: 220 });
        Object.assign(c.tires, { health: 50, healthFL: 50, healthFR: 50, healthRL: 50, healthRR: 50, lapsOnTire: 12 });
      });
      const [aiCar, mine, handed, otherAi] = sim.cars;
      sim.setPlayerCars([mine.driver.id, handed.driver.id]);
      sim.setSeed(54); sim.setFixedStep(0.02);
      sim.setWallDelegation(handed.id, true);
      run(sim, 2);
      sim.startRedFlag('Prueba');
      while (!['aviso', 'reanudacion'].includes(sim.redFlag.phase) && sim.raceTimeSec < 3000) sim.update(1 / 60);
      assert(aiCar.tires.health > 90 && otherAi.tires.health > 90 && handed.tires.health > 90, 'R54 (preparación): con bandera roja, la IA y el coche delegado cambian los neumáticos gastados',
        [aiCar, otherAi, handed].map(c => Math.round(c.tires.health)).join(', '));
      assert(mine.tires.health <= 50 && mine.tires.health > 40, 'R54: al coche del jugador sin delegar no se le cambian solos', String(Math.round(mine.tires.health)));
    });

    await test('R54: propuestas en el muro del jugador', async () => {
      const { WallProposals } = await server.ssrLoadModule('/src/components/WallProposals.tsx');
      const render = props => renderToStaticMarkup(createElement(WallProposals, { onAccept: () => {}, onDiscard: () => {}, onDelegate: () => {}, delegated: false, ...props }));
      const proposals = [
        { id: 'p1', key: 'parada:hard', kind: 'parada', compound: 'hard', reason: 'Desgaste: al neumático le quedan 1,4 vueltas', lap: 12, timeSec: 900 },
        { id: 'p2', key: 'ritmo:push', kind: 'ritmo', paceMode: 'push', reason: 'Batería al 90 % y SAI a 0,6 s: ataque esta vuelta', lap: 12, timeSec: 905 },
      ];
      const html = render({ proposals });
      assert(/Propuestas del muro/.test(html) && /DURO/.test(html) && /Desgaste: al neumático le quedan 1,4 vueltas/.test(html) && /Ataque/i.test(html) && /SAI a 0,6 s/.test(html), 'R54: cada propuesta se enseña con lo que propone y su motivo');
      assert((html.match(/<button[^>]*>[^<]*Aceptar/g) ?? []).length === 2 && (html.match(/<button[^>]*>[^<]*Descartar/g) ?? []).length === 2, 'R54: cada propuesta tiene sus botones de aceptar y descartar');
      assert(/Delegar en el estratega/.test(html) && /type="checkbox"/.test(html) && !/checked=""/.test(html), 'R54: interruptor de delegar, apagado');
      const none = render({ proposals: [] });
      assert(/Sin propuestas/.test(none) && !/Aceptar/.test(none), 'R54: sin propuestas, lo dice');
      const delegated = render({ proposals: [], delegated: true });
      assert(/checked=""/.test(delegated) && /estratega decide/i.test(delegated), 'R54: con la delegación encendida, se avisa de que decide el estratega');
      assert(/WallProposals/.test(source('src/components/BoxControls.tsx')) && /setPlayerCars\(/.test(source('src/App.tsx')), 'R54: el muro del jugador enseña las propuestas y la aplicación dice qué coches son suyos');
    });
  } finally { Math.random = original; }
}
