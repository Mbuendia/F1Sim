import {raceFactory, fixedRandom} from '../support/race.mjs';

// Synthetic detection coordinates: these are not event maps.
export default async function run({server, assert, test}) {
  const {DrsPermissions} = await server.ssrLoadModule('/src/simulation/DRSModel.ts');
  const detection = {id:'synthetic', t:.2, zoneIds:[1,2], source:'calibrated'};
  const crossing = (id, time, service, point=detection, onTrack=true) =>
    service.record([{id, from:2+point.t-.01, to:2+point.t+.01, onTrack}], [point], time-.1, .2);

  for (const gap of [.8, 1, 1.3]) await test(`Q19 cruce interpolado ${gap}`, () => {
    const service = new DrsPermissions();
    crossing(1, 10, service); crossing(2, 10+gap, service);
    assert(service.eligible(2,1)===(gap<1), `Q19: permiso usa tiempo de detección ${gap}s`);
    assert(!service.eligible(1,1), 'Q19: primer coche sin rival observado no recibe permiso');
  });
  await test('Q19 detecciones compartidas e independientes', () => {
    const service=new DrsPermissions();
    crossing(1,10,service); crossing(2,10.8,service);
    assert(service.eligible(2,1)&&service.eligible(2,2), 'Q19: detección compartida autoriza sus dos zonas');
    assert(!service.eligible(2,3), 'Q19: permiso no se extiende a otra detección');
    crossing(1,80,service); crossing(2,81.3,service);
    assert(!service.eligible(2,1)&&!service.eligible(2,2), 'Q19: siguiente detección renueva y revoca permiso anterior');
    service.reset(); assert(!service.eligible(2,1), 'Q19: reset borra permisos de detección');
  });
  await test('Q19 ruta y orden temporal', () => {
    const service=new DrsPermissions();
    crossing(1,10,service,detection,false); crossing(2,10.8,service);
    assert(!service.eligible(2,1), 'Q19: coche en boxes no otorga permiso a coche en pista');
    service.reset();
    service.record([{id:2,from:2.1,to:2.25,onTrack:true},{id:1,from:2.19,to:2.3,onTrack:true}], [detection], 10, 1);
    assert(service.eligible(2,1)&&!service.eligible(1,1), 'Q19: cruces se ordenan por tiempo, no por orden del array');
  });

  const make=await raceFactory(server);
  await fixedRandom(.99, async () => {
    await test('Q19 detección real en motor y primera frenada', () => {
      const sim=make('barcelona',2), [leader, follower]=sim.cars;
      sim.activeTrack.drsDetections=[{...detection,t:.22,zoneIds:[1]}];
      sim.activeTrack.points.forEach(p=>Object.assign(p,{isDrsZone:true,drsZoneId:1,isBrakingZone:false,speedLimitFactor:1,idealLineOffset:0}));
      leader.progress=2.218; follower.progress=2.208;
      for(let i=0;i<200&&!follower.drsActive;i++) sim.update(.01);
      assert(follower.drsActive, 'Q19: cruzar detección a menos de un segundo permite abrir en su zona');
      follower.gapToCarAheadSec=1.3; sim.update(.001);
      assert(follower.drsActive, 'Q19: permiso persiste aunque el gap actual suba a 1.3s');
      sim.activeTrack.points.forEach(p=>{p.isBrakingZone=true;}); sim.update(.001);
      assert(!follower.drsActive, 'Q19: primera frenada cierra el flap');
      sim.activeTrack.points.forEach(p=>{p.isBrakingZone=false;}); sim.update(.001);
      assert(!follower.drsActive, 'Q19: soltar freno no reabre en la misma zona sin nueva pasada');
    });
  });
}
