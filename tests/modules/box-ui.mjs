import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  const {BoxControls}=await server.ssrLoadModule('/src/components/BoxControls.tsx');
  await fixedRandom(.99,async()=>{
    await test('Q9/Q10 UI',()=>{
      const sim=make(),car=sim.cars[0];
      const render=()=>renderToStaticMarkup(createElement(BoxControls,{car,simulation:sim}));
      let html=render();
      assert(['soft','medium','hard','intermediate','wet'].every(c=>html.includes(`value="${c}"`)),'Q9 UI: ofrece los cinco compuestos');
      sim.issueBoxOrder(car.id,'wet');html=render();
      assert(html.includes('WET')&&html.includes('ACEPTADA'),'Q9 UI: acuse muestra compuesto aceptado');
      car.progress=car.pitStop.activeBoxOrder.commitmentProgress;sim.cancelBoxOrder(car.id);html=render();
      const buttons=[...html.matchAll(/<button([^>]*)>/g)];
      assert(buttons.length===2&&buttons.every(m=>m[1].includes('disabled')),'Q10 UI: compromiso bloquea cambio y cancelación');
      assert(html.includes('CONFIRMADA'),'Q10 UI: muestra orden comprometida');
    });
    await test('Q11 UI dual',()=>{
      const sim=make('barcelona',2),[car,other]=sim.cars;
      // Fixture de dos coches del mismo equipo, copias aisladas.
      other.driver.teamId=car.driver.teamId;other.team=structuredClone(car.team);
      other.pitStop.waitingForBox=true;other.pitStop.boxWaitTimer=1.2;
      const html=renderToStaticMarkup(createElement(BoxControls,{car,simulation:sim,teamCars:sim.cars}));
      assert(html.includes(`Compuesto para ${car.driver.code}`)&&html.includes(`Compuesto para ${other.driver.code}`),'Q11 UI: controles independientes para ambos pilotos');
      assert(html.includes('ESPERANDO')&&html.includes('1.2'),'Q11 UI: muestra cola y tiempo real del segundo piloto');
    });
  });
}
