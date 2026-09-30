import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  const {DRSModel}=await server.ssrLoadModule('/src/simulation/DRSModel.ts');
  for(const gap of [.999,1,1.001])await test(`Q19 umbral ${gap}`,()=>{
    const result=DRSModel.evaluateDRS({isDrsZone:true},gap,3);
    assert(result.isEligible===(gap<1),`Q19: helper aplica umbral estricto a ${gap}s`);
  });
  await fixedRandom(.99,async()=>{
    for(const gap of [.999,1,1.001])await test(`Q19 motor ${gap}`,()=>{
      const sim=make(),car=sim.cars[0];
      sim.activeTrack.points.forEach(p=>{p.isDrsZone=true;p.speedLimitFactor=1;});
      car.gapToCarAheadSec=gap;sim.update(.001);
      // Sin cruzar detección no se ha concedido permiso, aun estando en zona.
      assert(!car.drsActive,`Q19: entrar en activación sin detección previa no autoriza (${gap}s)`);
    });
    for(const flag of ['yellow','sc','vsc','red'])await test(`Q19 bandera ${flag}`,()=>{
      const sim=make(),car=sim.cars[0];sim.raceFlagState=flag;
      sim.activeTrack.points.forEach(p=>{p.isDrsZone=true;});
      car.gapToCarAheadSec=.5;car.drsActive=true;sim.update(.001);
      assert(!car.drsActive,`Q19: motor cierra DRS bajo ${flag}`);
    });
    await test('Q19 reset',()=>{
      const sim=make();sim.cars[0].drsActive=true;sim.initRace();
      assert(sim.cars.every(c=>!c.drsActive),'Q19: reinicio elimina aperturas anteriores');
    });
  });
}
