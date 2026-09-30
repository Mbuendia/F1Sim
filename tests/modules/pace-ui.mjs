import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {raceFactory, fixedRandom} from '../support/race.mjs';

export default async function run({server, assert, test}) {
  const make=await raceFactory(server);
  const {BoxControls}=await server.ssrLoadModule('/src/components/BoxControls.tsx');
  await fixedRandom(.99, async () => {
    await test('Q12 muro dual', () => {
      const sim=make('barcelona',2),[car,other]=sim.cars;
      other.driver.teamId=car.driver.teamId;other.team=structuredClone(car.team);
      const render=()=>renderToStaticMarkup(createElement(BoxControls,{car,simulation:sim,teamCars:sim.cars}));
      let html=render();
      assert(sim.cars.every(p=>html.includes(`Ritmo para ${p.driver.code}`)), 'Q12 UI: selector de ritmo accesible por cada piloto');
      assert(['push','balanced','save'].every(value=>html.includes(`value="${value}"`)), 'Q12 UI: ofrece Push, Balanced y Save');
      sim.issuePaceOrder(car.id,'push');sim.raceFlagState='sc';sim.update(.001);html=render();
      assert(/Pedido[^<]*Push/.test(html) && /Efectivo[^<]*Save/.test(html), 'Q12 UI: diferencia ritmo pedido de efectivo');
      assert(html.includes('Safety Car'), 'Q12 UI: explica limitación por Safety Car');
      car.status='out';html=render();
      assert(new RegExp(`<select[^>]*aria-label="Ritmo para ${car.driver.code}"[^>]*disabled`).test(html), 'Q12 UI: selector deshabilitado para retirado');
    });
  });
}
