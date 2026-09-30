import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  for(const roll of [1,10,20])await fixedRandom((roll-.5)/20,async()=>{
    await test(`Q17 tirada ${roll}`,()=>{
      const sim=make(),car=sim.cars[0];car.tires.health=41;
      const before=JSON.stringify(car.tires),fuel=car.fuelKg;
      const event=sim.triggerD20LuckRoll('sc',car.driver.id);
      assert(event.rollValue===roll,`Q17: fixture produce tirada ${roll}`);
      sim.applyLuckEventReward(event.id);
      assert(JSON.stringify(car.tires)===before,`Q17: tirada ${roll} no cambia neumáticos en pista`);
      assert(car.fuelKg===fuel,`Q17: tirada ${roll} no crea combustible`);
      const after=JSON.stringify(car);sim.applyLuckEventReward(event.id);
      assert(JSON.stringify(car)===after,`Q17: doble aplicación ${roll} es idempotente`);
    });
  });
  await test('Q17 retirado/ID ajeno',()=>{
    const sim=make(),car=sim.cars[0],event=sim.triggerD20LuckRoll('sc');
    car.status='out';const before=JSON.stringify(car);
    sim.applyLuckEventReward('otro-evento');sim.applyLuckEventReward(event.id);
    assert(JSON.stringify(car)===before,'Q17: ID ajeno y beneficiario retirado no reciben recursos');
  });
}
