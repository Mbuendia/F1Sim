import {raceFactory,fixedRandom,advance} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  await fixedRandom(.99,async()=>{
    await test('Q12 cinco vueltas',()=>{
      const runs={};
      for(const mode of ['push','balanced','save']){
        const sim=make(),car=sim.cars[0];
        car.progress=2;car.trackT=0;car.currentLap=2;
        sim.issuePaceOrder(car.id,mode);
        let steps=0;
        while(car.progress<7&&steps++<30000)sim.update(.02);
        assert(car.progress>=7,`Q12: ${mode} completa cinco vueltas reales`);
        runs[mode]={health:car.tires.health,fuel:car.fuelKg,time:sim.raceTimeSec};
      }
      assert(runs.push.health<runs.save.health,'Q12: cinco vueltas idénticas Push gastan más neumático que Save');
      assert(runs.push.fuel<runs.save.fuel,'Q12: cinco vueltas idénticas Push consumen más combustible que Save');
      assert(runs.push.time<runs.balanced.time&&runs.balanced.time<runs.save.time,'Q12: orden de tiempos Push/Balanced/Save con el mismo piloto');
    });
    await test('Q12 aislamiento y pausa',()=>{
      const sim=make('barcelona',2),[a,b]=sim.cars;
      const other=b.paceMode;sim.issuePaceOrder(a.id,'save');
      assert(a.paceMode==='save'&&b.paceMode===other,'Q12: cambiar un piloto no cambia al compañero');
      sim.isPaused=true;const before=JSON.stringify(a);advance(sim,1);
      assert(a.progress===JSON.parse(before).progress&&a.paceMode==='save','Q12: pausa conserva posición y orden');
      sim.initRace();assert(sim.cars.every(c=>!c.paceMode||c.paceMode==='balanced'),'Q12: reset elimina las órdenes previas');
    });
  });
}
