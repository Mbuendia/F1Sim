import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  // [R04] La función antigua `evaluateDRS` ya no existe (cambio autorizado por el usuario el 07/10/2026): el umbral
  // estricto se comprueba sobre el motor, con el hueco medido al cruzar la detección.
  for(const gap of [.999,1,1.001])await test(`Q19 umbral ${gap}`,()=>{
    const sim=make('barcelona',2),[ahead,chaser]=sim.cars;
    sim.activeTrack.points.forEach(p=>Object.assign(p,{isDrsZone:true,drsZoneId:1,isBrakingZone:false,speedLimitFactor:1}));
    const detection=[{id:'UMBRAL',t:.25,zoneIds:[1],source:'calibrated'}];
    sim.drsPermissions.record([{id:ahead.id,from:.125,to:.375,onTrack:true}],detection,9.5,1);
    sim.drsPermissions.record([{id:chaser.id,from:.125,to:.375,onTrack:true}],detection,9.5+gap,1);
    Object.assign(chaser,{currentLap:3,progress:3.3,trackT:.3,currentSpeedKmh:300});
    sim.update(.001);
    assert(chaser.drsActive===(gap<1),`Q19: el motor aplica umbral estricto a ${gap}s medidos en la detección`);
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
