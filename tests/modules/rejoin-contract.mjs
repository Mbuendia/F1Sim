import {raceFactory,fixedRandom} from '../support/race.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  await fixedRandom(.99,async()=>{
    await test('Q13 tráfico',()=>{
      const sim=make('barcelona',2),[a,b]=sim.cars;
      a.progress=3.4;a.currentPosition=1;b.progress=3.39;b.currentPosition=2;
      const before=sim.cars.map(c=>c.progress);
      const projection=sim.getRejoinProjection(a.id);
      assert(projection.projectedPos===2,'Q13: parada costosa pierde posición frente a un rival a menos de un segundo');
      assert(sim.cars.every((c,i)=>c.progress===before[i]),'Q13: consultar predictor no mueve coches');
      b.status='out';
      assert(sim.getRejoinProjection(a.id).projectedPos===1,'Q13: predictor excluye retirados');
    });
    await test('Q13 servicio real controlado',()=>{
      const sim=make('barcelona',2),[a,b]=sim.cars;
      a.progress=2.86;b.progress=2.85;
      for(const [i,c] of sim.cars.entries()){c.trackT=c.progress%1;c.currentPosition=i+1;c.currentLap=2;}
      const projected=sim.getRejoinProjection(a.id);
      const order=sim.issueBoxOrder(a.id,'hard');
      let entered=false,exited=false;
      for(let i=0;i<20000&&!exited;i++){sim.update(.02);entered ||= a.isInPitLane;exited=entered&&!a.isInPitLane;}
      assert(Boolean(order)&&exited&&a.pitStop.totalPitStops===1,'Q13: fixture completa parada real');
      const actual=1+sim.cars.filter(c=>c.id!==a.id&&c.status!=='out'&&c.progress>a.progress).length;
      assert(exited&&projected.projectedPos===actual,'Q13: posición prevista coincide con reincorporación controlada',`prevista=${projected.projectedPos}, real=${actual}`);
    });
  });
}
