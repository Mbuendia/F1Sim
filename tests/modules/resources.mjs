import {raceFactory,fixedRandom,advance} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const {FuelModel}=await server.ssrLoadModule('/src/simulation/FuelModel.ts');
  const make=await raceFactory(server);
  for(const mode of ['low','standard','push','overtake']) await test(`Q16 combustible ${mode}`,()=>{
    const empty=FuelModel.updateFuel(0,mode,1).remainingFuelKg;
    const almostEmpty=FuelModel.updateFuel(.001,mode,100).remainingFuelKg;
    assert(empty===0,`Q16: depósito vacío no crea combustible (${mode})`);
    assert(almostEmpty===0,`Q16: combustible se agota sin reserva infinita (${mode})`);
    const once=FuelModel.updateFuel(50,mode,1).remainingFuelKg;
    let split=50;for(let i=0;i<10;i++)split=FuelModel.updateFuel(split,mode,.1).remainingFuelKg;
    assert(Math.abs(once-split)<1e-10,`Q16: consumo independiente de partición temporal (${mode})`);
  });
  await fixedRandom(.99,async()=>{
    await test('Q16 batería',()=>{
      const sim=make(),car=sim.cars[0];sim.issuePaceOrder(car.id,'push');
      advance(sim,.02);const initial=car.telemetry.batterySoc;advance(sim,5);
      assert(Number.isFinite(initial)&&Number.isFinite(car.telemetry.batterySoc)&&car.telemetry.batterySoc!==initial,'Q16: despliegue de ERS consume estado real, no SOC constante');
      assert(car.telemetry.batterySoc>=0&&car.telemetry.batterySoc<=100,'Q16: SOC dentro de límites');
    });
    await test('Q16 cero combustible',()=>{
      const sim=make(),car=sim.cars[0];car.fuelKg=0;car.currentSpeedKmh=0;
      const before=car.progress;sim.update(.02);
      assert(car.fuelKg===0&&car.progress===before,'Q16: coche parado sin combustible no crea recurso ni propulsión');
    });
    await test('Q16 rendimiento térmico antes del movimiento',()=>{
      const cold=make(),hot=make();
      for(const [sim,temperature] of [[cold,90],[hot,130]]){
        sim.activeTrack.points.forEach(p=>{p.speedLimitFactor=1;p.isBrakingZone=false;p.idealLineOffset=0;});
        sim.cars[0].currentSpeedKmh=300;
        // Dos bancos de ensayo con temperatura sostenida; mismo motor/piloto/recursos.
        Object.defineProperty(sim.cars[0],'engineTempCelsius',{configurable:true,enumerable:true,get:()=>temperature,set:()=>{}});
        advance(sim,5);
      }
      assert(hot.cars[0].progress<cold.cars[0].progress,'Q16: motor sobrecalentado pierde rendimiento físico antes de integrar distancia');
    });
  });
}
