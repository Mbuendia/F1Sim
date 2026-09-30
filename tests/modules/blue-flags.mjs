import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  await fixedRandom(.99,async()=>{
    for(const [label,leaderProgress,lappedProgress,shouldYield] of [
      ['líder detrás',3.19,2.2,true],['meta',3.995,3.005,true],
      ['misma vuelta',2.19,2.2,false],['líder ya pasó',3.21,2.2,false],
    ]) await test(`Q15 ${label}`,()=>{
      const sim=make('barcelona',2),[leader,lapped]=sim.cars;
      for(const [c,p] of [[leader,leaderProgress],[lapped,lappedProgress]]){c.progress=p;c.trackT=p%1;c.currentLap=Math.floor(p);}
      leader.currentPosition=1;lapped.currentPosition=20;
      sim.update(.005);
      assert(lapped.isBlueFlagged===shouldYield,`Q15: señal correcta con ${label}`);
    });
    for(const excluded of ['out','pit']) await test(`Q15 excluir ${excluded}`,()=>{
      const sim=make('barcelona',2),[a,b]=sim.cars;
      a.progress=3.19;a.currentLap=3;b.progress=2.2;b.currentLap=2;
      a.status=excluded;a.isInPitLane=excluded==='pit';a.pitStop.isPitting=excluded==='pit';
      sim.update(.005);assert(!b.isBlueFlagged,`Q15: coche ${excluded} no provoca bandera azul`);
    });
    await test('Q15 apagar señal',()=>{
      const sim=make();sim.cars[0].isBlueFlagged=true;sim.update(.005);
      assert(!sim.cars[0].isBlueFlagged,'Q15: señal se apaga cuando desaparece la causa');
    });
    for(const flag of ['sc','vsc']) await test(`Q15 ${flag}`,()=>{
      const sim=make('barcelona',2),[a,b]=sim.cars;
      a.progress=3.19;b.progress=2.2;a.currentLap=3;b.currentLap=2;
      sim.raceFlagState=flag;sim.vscActive=flag==='vsc';sim.vscDuration=100;
      if(flag==='sc')Object.assign(sim.safetyCar,{isDeployed:true,mode:'leading',progress:3.3,currentSpeedKmh:100,targetLaps:10});
      sim.update(.005);assert(!b.isBlueFlagged,`Q15: neutralización ${flag} no exige ceder para adelantar`);
    });
  });
}
