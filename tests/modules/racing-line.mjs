import {raceFactory, fixedRandom, advance} from '../support/race.mjs';
export default async function run({server, assert, test}) {
  const make = await raceFactory(server);
  const setup = (grip=0) => {
    const sim=make();
    sim.activeTrack.points.forEach(p=>{p.idealLineOffset=0;p.rubberGrip=grip;});
    return sim;
  };
  const sum=sim=>sim.activeTrack.points.reduce((s,p)=>s+p.rubberGrip,0);
  await fixedRandom(.99,async()=>{
    for(const circuit of ['barcelona','monaco']) await test(`Q8 datos ${circuit}`,()=>{
      const points=make(circuit).activeTrack.points;
      assert(points.every(p=>Number.isFinite(p.idealLineOffset)&&Math.abs(p.idealLineOffset)<1),`Q8: offsets finitos dentro de pista en ${circuit}`);
      assert(points.some(p=>p.idealLineOffset>0)&&points.some(p=>p.idealLineOffset<0),`Q8: trazada lateral en ambos sentidos en ${circuit}`);
    });
    await test('Q8 acumulación',()=>{
      const sim=setup(), car=sim.cars[0], health=car.tires.health, before=car.progress;
      advance(sim,2);
      assert(car.progress>before && sum(sim)>0,'Q8: paso real de un coche acumula goma en seco');
      assert(car.tires.health<=health,'Q8: engomado no regenera neumáticos');
      assert(sim.activeTrack.points.every(p=>p.rubberGrip>=0&&p.rubberGrip<=1),'Q8: engomado permanece acotado');
      sim.isPaused=true; const paused=sum(sim); advance(sim,2);
      assert(sum(sim)===paused,'Q8: pausa no acumula goma');
      sim.initRace();
      assert(sum(sim)===0,'Q8: reiniciar carrera limpia goma de todas las muestras');
    });
    await test('Q8 saturación y movimiento',()=>{
      const clean=setup(), rubber=setup(1);
      advance(clean,5); advance(rubber,5);
      assert(rubber.cars[0].progress>clean.cars[0].progress,'Q8: agarre acumulado mejora movimiento con idénticas condiciones');
      assert(rubber.activeTrack.points.every(p=>p.rubberGrip===1),'Q8: goma saturada no supera 1');
    });
    await test('Q8 no recorrido',()=>{
      const sim=setup();sim.cars=[];advance(sim,1);
      assert(sum(sim)===0,'Q8: sin coches no aparece goma');
    });
    await test('Q8 boxes y cambio de circuito',()=>{
      const sim=setup(),car=sim.cars[0];
      car.progress=2+sim.activeTrack.pitEntryT+.001;car.trackT=car.progress%1;
      car.isInPitLane=true;car.pitStop.isPitting=true;car.status='pit';
      advance(sim,.1);
      assert(sum(sim)===0,'Q8: coche en boxes no engoma la trazada principal');
      sim.activeTrack.points[0].rubberGrip=1;sim.setCircuit('monaco');
      assert(sum(sim)===0,'Q8: cambiar circuito no hereda goma del anterior');
    });
    await test('Q8 independencia temporal',()=>{
      const a=setup(),b=setup();advance(a,2,.01);advance(b,2,.02);
      const error=a.activeTrack.points.reduce((s,p,i)=>s+Math.abs(p.rubberGrip-b.activeTrack.points[i].rubberGrip),0);
      // 1% del depósito total: tolerancia del contrato, no de la implementación.
      assert(error<=Math.max(sum(a),sum(b))*.01+1e-12,'Q8: misma duración a distintos FPS conserva distribución de goma (1%)',`error=${error}`);
    });
  });
}
