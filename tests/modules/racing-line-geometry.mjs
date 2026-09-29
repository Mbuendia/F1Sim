import {raceFactory} from '../support/race.mjs';
import {recordingCanvas} from '../support/canvas.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  const {computeTrackSpline}=await server.ssrLoadModule('/src/utils/spline.ts');
  const {TrackRenderer}=await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
  const {calculateCarWorldPosition}=await server.ssrLoadModule('/src/utils/carPosition.ts');
  for(const reversed of [false,true])await test(`Q8 ápice ${reversed}`,()=>{
    const control=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}];
    const points=computeTrackSpline(reversed?control.reverse():control);
    const index=points.reduce((best,p,i)=>p.curvature>points[best].curvature?i:best,0);
    const a=points[(index-1+points.length)%points.length],b=points[index],c=points[(index+1)%points.length];
    const turn=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    assert(turn*b.idealLineOffset>0,`Q8: ápice al interior del giro ${reversed?'inverso':'directo'} (fixture sintético)`);
  });
  await test('Q8 dibujo/posición compartidos',()=>{
    const sim=make(),track=sim.activeTrack;
    track.points.forEach(p=>{p.idealLineOffset=.5;p.rubberGrip=.5;});
    const camera={zoom:1,rotation:0,screenWidth:2000,screenHeight:2000,worldToScreen:(x,y)=>({x,y})};
    const {ctx,strokes}=recordingCanvas();TrackRenderer.renderTrack(ctx,track,camera,1,sim.weather,'barcelona');
    const rubber=strokes.find(s=>String(s.color).startsWith('rgba(20, 22, 28,'));
    const car={...sim.cars[0],progress:0,lateralOffset:.5,isInPitLane:false};
    const position=calculateCarWorldPosition(car,track);
    assert(Boolean(rubber)&&Math.hypot(rubber.path[0].x-position.worldX,rubber.path[0].y-position.worldY)<1e-6,'Q8: centro de goma dibujada coincide con posición de coche en trazada ideal');
  });
}
