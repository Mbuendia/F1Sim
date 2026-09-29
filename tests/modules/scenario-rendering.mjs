import {raceFactory} from '../support/race.mjs';
import {recordingCanvas} from '../support/canvas.mjs';
export default async function run({server,assert,test}){
  const make=await raceFactory(server);
  const {TrackRenderer}=await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
  const {Camera}=await server.ssrLoadModule('/src/renderer/Camera.ts');
  for(const zoom of [.3,2])for(const rotation of [0,.8])await test(`Q6 Canvas ${zoom}/${rotation}`,()=>{
    // A→B→A recorre la invalidación de caché real del renderer.
    for(const circuit of ['barcelona','monaco','barcelona']){
      const sim=make(circuit),camera=new Camera();Object.assign(camera,{zoom,rotation});
      const {ctx,strokes,fills}=recordingCanvas();
      TrackRenderer.renderTrack(ctx,sim.activeTrack,camera,1,sim.weather,circuit);
      const gravel=[...strokes,...fills].filter(p=>p.color==='#5a4f3a');
      assert(circuit==='monaco'?gravel.length===0:gravel.length>0,`Q6: grava dibujada correcta en ${circuit} zoom=${zoom} giro=${rotation}`);
      assert([...strokes,...fills].every(s=>s.path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),`Q6: geometría dibujada finita en ${circuit}`);
    }
  });
}
