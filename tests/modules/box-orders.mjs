import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    console.log('\n--- TEST GROUP 15: Q9/Q10 — órdenes y cruces reales ---');
    {
      const originalRandom = Math.random;
      Math.random = () => 0.99; // Sin incidentes aleatorios: aislar el contrato de boxes.
      try {
        const setup = (progress = 1.87, commitment = 0.875, entry = 0.9, exit = 0.15) => {
          const sim = new RaceSimulation('barcelona');
          sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 30;
          sim.activeTrack = { ...sim.activeTrack, pitCommitmentT: commitment, pitEntryT: entry, pitExitT: exit };
          const car = sim.cars[0]; sim.cars = [car];
          car.progress = progress; car.trackT = ((progress % 1) + 1) % 1;
          car.currentLap = Math.floor(progress); car.currentSpeedKmh = 250;
          car.pitStop.scheduledLap = 0;
          return { sim, car };
        };
        const until = (sim, predicate, limit = 18000) => {
          for (let i = 0; i < limit && !predicate(); i++) sim.update(0.02);
          return predicate();
        };
        for (const compound of ['soft', 'medium', 'hard', 'intermediate', 'wet']) {
          const {sim, car} = setup();
          const before = car.tires;
          const order = sim.issueBoxOrder(car.id, compound);
          assert(order?.status === 'accepted' && car.tires === before,
            'Q9: Aceptar ' + compound + ' no cambia ruedas en pista');
          assert(sim.issueBoxOrder(car.id, 'soft', 'ai') === null && sim.getBoxOrder(car.id) === order,
            'Q9: IA no sustituye orden del jugador (' + compound + ')');
          const serviced = until(sim, () => order.status === 'consumed');
          assert(serviced && car.tires.compound === compound && car.pitStop.totalPitStops === 1 &&
            car.pitStop.stints.at(-1).compound === compound && order.consumedAt > order.createdAt,
            'Q9: Servicio real e historial montan ' + compound + ' una sola vez');
          assert(until(sim, () => !car.isInPitLane) && car.pitStop.totalPitStops === 1,
            'Q9: Salida no duplica servicio (' + compound + ')');
          const second = sim.issueBoxOrder(car.id, compound === 'hard' ? 'medium' : 'hard');
          assert(second && until(sim, () => second.status === 'consumed') && car.pitStop.totalPitStops === 2 &&
            car.pitStop.stints.length === 3 && car.pitStop.stints[1].endLap === car.pitStop.stints[2].startLap &&
            car.tires.compound === second.compound, 'Q9: Segunda parada vinculante (' + compound + ')');
        }
        for (const offset of [-0.000001, 0, 0.000001]) {
          const {sim, car} = setup(1.875 + offset);
          const order = sim.issueBoxOrder(car.id, 'hard');
          assert(Math.abs(order.entryProgress - (offset < 0 ? 1.9 : 2.9)) < 1e-8,
            'Q10: Llamada antes/sobre/después del compromiso (' + offset + ')');
        }
        {
          const {sim, car} = setup();
          car.pitStop.scheduledLap = car.currentLap;
          const order = sim.issueBoxOrder(car.id, 'wet');
          assert(sim.cancelBoxOrder(car.id) && order.status === 'cancelled' && car.pitStop.scheduledLap === 0,
            'Q10: Cancelar elimina programación residual y conserva acuse');
          until(sim, () => car.progress > 3.1);
          assert(car.pitStop.totalPitStops === 0 && !car.isInPitLane,
            'Q10: Orden cancelada no reaparece en la siguiente vuelta');
          car.tires.health = 50;
          assert(!PitStopModel.shouldEnterPit(car, 1, 'sc', 'leading'), 'Q9: SC no reactiva estrategia cancelada del jugador');
          car.hasPuncture = true;
          assert(PitStopModel.shouldEnterPit(car, .02), 'Q10: Cancelar conserva emergencia independiente por pinchazo');
          assert(until(sim, () => car.isInPitLane), 'Q10: Pinchazo entra realmente tras una cancelación');
        }
        {
          const {sim, car} = setup(); const order = sim.issueBoxOrder(car.id, 'hard');
          car.progress = order.commitmentProgress; car.trackT = .875;
          assert(!sim.cancelBoxOrder(car.id) && order.status === 'committed', 'Q10: Cancelar sobre la línea llega tarde');
          assert(sim.issueBoxOrder(car.id, 'soft') === null, 'Q9: Compuesto bloqueado tras compromiso');
        }
        for (const scale of [1,16,32]) {
          for (const [commit,entry,exit] of [[.875,.9,.15],[.999,.001,.2],[.3,.32,.5]]) {
            const {sim, car} = setup(1 + commit - .0001, commit, entry, exit);
            sim.setSpeed(scale);
            const order = sim.issueBoxOrder(car.id, 'intermediate');
            assert(until(sim, () => car.isInPitLane, 1000) && order.status === 'committed' && !sim.cancelBoxOrder(car.id),
              'Q10: Cruces integrados compromiso/entrada (' + scale + 'x, ' + commit + '→' + entry + ')');
            // Al acabar el frame externo quedan subpasos legales dentro de boxes.
            const maxFrameTravel = 500 / 3.6 / sim.activeTrack.lapLengthMeters * .02 * sim.getEffectiveTimeScale();
            assert(car.pitStop.entryProgress === order.entryProgress && car.progress >= order.entryProgress &&
              car.progress < order.entryProgress + maxFrameTravel,
              'Q10: Entrada sin reposicionar progress (' + scale + 'x, ' + entry + ')');
          }
        }
        {
          const {sim,car} = setup(1.89); const order = sim.issueBoxOrder(car.id, 'hard');
          until(sim, () => car.progress > 1.92);
          assert(!car.isInPitLane && order.status === 'accepted', 'Q10: Llamada tardía no usa la entrada inmediata');
          assert(until(sim, () => car.isInPitLane) && car.progress >= 2.9,
            'Q10: Llamada tardía espera realmente otra oportunidad');
        }
        {
          const {sim,car} = setup(); const order=sim.issueBoxOrder(car.id, 'soft');
          car.status='out'; sim.update(.02);
          assert(order.status === 'rejected' && sim.issueBoxOrder(car.id,'hard') === null, 'Q9: Retirada invalida orden');
          sim.initRace();
          assert(sim.cars.every(c=>!c.pitStop.activeBoxOrder && !c.pitStop.playerControlled), 'Q9: Reset limpia órdenes y control');
        }
        {
          const {sim,car} = setup(); sim.raceFlagState='sc'; sim.safetyCar.mode='leading';
          const order=sim.issueBoxOrder(car.id,'wet');
          assert(order?.compound==='wet', 'Q9: Se aceptan órdenes durante SC');
          sim.raceFlagState='red';
          assert(sim.issueBoxOrder(car.id,'soft') === null, 'Q9: Roja rechaza nuevas órdenes ordinarias');
        }
        {
          const {sim,car}=setup(); const ai=sim.issueBoxOrder(car.id,'soft','ai');
          const player=sim.issueBoxOrder(car.id,'hard');
          assert(player?.compound==='hard' && ai.status==='cancelled', 'Q9: Jugador sustituye una orden IA');
          car.status='pit'; car.isInPitLane=true; car.pitStop.isPitting=true;
          car.pitStop.pitLaneProgress=PitStopModel.getBoxProgress(car);
          assert(sim.issueBoxOrder(car.id,'wet')===null, 'Q9: Servicio de cualquier equipo no admite cambios');
        }
        for (const scale of [16, 32]) {
          const {sim,car}=setup(1.874999, .875, .87501, .15);
          sim.setSpeed(scale);
          const order=sim.issueBoxOrder(car.id,'hard');
          const previous=car.progress;
          sim.update(.02);
          assert(previous < order.commitmentProgress && car.progress > order.entryProgress && car.isInPitLane &&
            order.status==='committed', 'Q10: Un único frame cruza compromiso y entrada a x' + scale);
        }
        {
          const {sim,car}=setup(); const order=sim.issueBoxOrder(car.id,'hard');
          sim.isPaused=true; const previous=car.progress; sim.update(1);
          assert(car.progress===previous && order.status==='accepted', 'Q10: Pausa no compromete ni mueve el coche');
          sim.isPaused=false; sim.setCircuit('monaco');
          assert(sim.activeTrack.pitCommitmentT===.5567 && sim.activeTrack.pitCommitmentSource==='calibrated' &&
            sim.cars.every(c=>!c.pitStop.activeBoxOrder), 'Q10: Cambio de GP limpia orden y usa línea calibrada propia');
        }
      } finally { Math.random = originalRandom; }
    }

}
