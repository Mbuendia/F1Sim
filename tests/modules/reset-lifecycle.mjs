import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  const {IncidentModel}=await server.ssrLoadModule('/src/simulation/IncidentModel.ts');
  // Provoca avería por el camino real del motor; evita depender de campos privados.
  async function incident(sim){
    sim.lightState='racing';sim.isPaused=false;sim.cars=sim.cars.slice(0,1);
    const car=sim.cars[0];car.currentLap=4;car.progress=4.2;
    let calls=0;const old=Math.random;Math.random=()=>++calls===1?0:.5;
    try{sim.update(.001);}finally{Math.random=old;}
    return sim.incidents[0];
  }
  await test('Q18 reinicio de IDs integrado',async()=>{
    IncidentModel.reset();const sim=make();const first=await incident(sim);
    sim.initRace();const second=await incident(sim);
    assert(Boolean(first)&&Boolean(second),'Q18: motor registra incidentes antes y después de reiniciar');
    assert(first?.id===1&&second?.id===1,'Q18: initRace reinicia IDs de IncidentModel');
  });
  await test('Q18 SC urbano por incidente real',async()=>{
    IncidentModel.reset();const sim=make('monaco');const created=await incident(sim);
    assert(Boolean(created)&&sim.safetyCar.isDeployed,'Q18: incidente normal despliega SC urbano');
    assert(sim.safetyCar.targetLaps>=10,'Q18: política personalizada urbana exige al menos 10 vueltas');
  });
  await fixedRandom(.99,async()=>{
    await test('Q18 evento/reset',()=>{
      const sim=make();sim.triggerD20LuckRoll('sc');sim.initRace();
      assert(sim.activeLuckEvent===null,'Q18: reset elimina evento D20 anterior');
      sim.triggerD20LuckRoll('sc');sim.setCircuit('monaco');
      assert(sim.activeLuckEvent===null,'Q18: cambio de GP elimina evento D20 anterior');
    });
  });
}
