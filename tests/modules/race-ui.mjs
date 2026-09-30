import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {raceFactory} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server),sim=make('barcelona',2);
  await test('HUD banderas',async()=>{
    const {default:Hud}=await server.ssrLoadModule('/src/components/RaceFlagsHUD.tsx');
    for(const [flag,text] of [['yellow','YELLOW'],['sc','SAFETY CAR'],['vsc','VSC'],['red','RED FLAG']]){
      const html=renderToStaticMarkup(createElement(Hud,{raceFlagState:flag,sectorFlags:[flag,'green','green'],safetyCar:sim.safetyCar}));
      assert(html.includes(text),`HUD: muestra estado ${flag}`);
    }
  });
  await test('Clasificación',async()=>{
    const {Leaderboard}=await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const order=sim.cars.map(c=>c.id);sim.cars[1].status='out';
    const html=renderToStaticMarkup(createElement(Leaderboard,{cars:sim.cars,selectedCarId:null,onSelectCar:()=>{}}));
    assert(html.includes('DNF'),'Clasificación: retirada visible');
    assert(sim.cars.every((c,i)=>c.id===order[i]),'Clasificación: render no muta orden de coches');
  });
  await test('Telemetría',async()=>{
    const {TelemetryPanel}=await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const html=renderToStaticMarkup(createElement(TelemetryPanel,{car:sim.cars[0],onClose:()=>{}}));
    assert(!html.includes('NaN')&&!html.includes('undefined'),'Telemetría: valores iniciales legibles');
  });
}
