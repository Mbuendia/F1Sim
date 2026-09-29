import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  await fixedRandom(.99,async()=>{
    for(const scale of [1,16,32]) await test(`Q14 SC x${scale}`,()=>{
      const sim=make(),car=sim.cars[0];sim.setSpeed(scale);
      sim.raceFlagState='sc';Object.assign(sim.safetyCar,{isDeployed:true,mode:'leading',progress:car.progress+.002,currentSpeedKmh:100,targetLaps:10});
      const before=car.progress;
      let progress=before,backwards=false;
      // Observar todas las escrituras: un salto hacia atrás puede quedar oculto
      // por el avance de subpasos posteriores en un frame x16/x32.
      Object.defineProperty(car,'progress',{configurable:true,enumerable:true,
        get:()=>progress,set:value=>{backwards ||= value<progress-1e-12;progress=value;}});
      sim.update(.02);
      const traveled=(car.progress-before)*sim.activeTrack.lapLengthMeters;
      const maxDistance=400/3.6*.02*sim.getEffectiveTimeScale();
      assert(!backwards&&traveled>=-1e-9&&traveled<=maxDistance+1e-6,`Q14: SC no recoloca ni retrocede coche x${scale}`,`distancia=${traveled} m; retroceso interno=${backwards}`);
    });
    await test('Q14 roja',()=>{
      const sim=make(),car=sim.cars[0];sim.raceFlagState='red';sim.incidents=[];
      const before=car.progress,health=car.tires.health,fuel=car.fuelKg;
      sim.update(.02);
      assert(car.progress>=before,'Q14: reanudación de roja conserva distancia completada');
      assert(car.tires.health<=health&&car.fuelKg<=fuel,'Q14: reanudación no crea neumático ni combustible');
    });
  });
}
