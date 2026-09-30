import {raceFactory, fixedRandom} from '../support/race.mjs';

export default async function run({server, assert, test}) {
  const make = await raceFactory(server);
  await fixedRandom(.99, async () => {
    await test('Q12 rival en boxes', () => {
      const sim=make('barcelona',2), [car,rival]=sim.cars;
      rival.progress=car.progress+.01; car.carAheadId=rival.id;
      rival.pitStop.isPitting=true; rival.isInPitLane=true;
      sim.issuePaceOrder(car.id,'save'); sim.update(.001);
      assert(car.paceMode==='save' && car.engineMode==='low', 'Q12: rival entrando en boxes no sustituye Save por Push');
    });
    await test('Q12 órdenes válidas y rechazadas', () => {
      const sim=make(), car=sim.cars[0];
      sim.issuePaceOrder(car.id,'save');
      assert(sim.issuePaceOrder(car.id,'invalid')===false && car.paceMode==='save', 'Q12: ritmo desconocido se rechaza sin cambiar orden');
      car.status='out';
      assert(sim.issuePaceOrder(car.id,'push')===false && car.paceMode==='save', 'Q12: no se dan órdenes a un retirado');
      car.status='running'; sim.isFinished=true;
      assert(sim.issuePaceOrder(car.id,'push')===false && car.paceMode==='save', 'Q12: carrera terminada rechaza nuevas órdenes');
    });
    await test('Q12 neutralización y recuperación', () => {
      const sim=make(),car=sim.cars[0];sim.issuePaceOrder(car.id,'push');
      sim.raceFlagState='vsc';sim.vscActive=true;sim.vscDuration=100;
      sim.update(.001);
      assert(car.paceMode==='push' && car.engineMode==='low', 'Q12: VSC limita el ritmo efectivo conservando Push pedido');
      sim.vscActive=false;sim.raceFlagState='green';sim.update(.001);
      assert(car.paceMode==='push' && car.engineMode==='push', 'Q12: al volver a verde se recupera el ritmo pedido');
    });
  });
}
