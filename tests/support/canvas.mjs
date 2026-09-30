// Registra el Canvas realmente emitido; no sustituye la geometría de producción.
export function recordingCanvas(){
  let path=[];const strokes=[],fills=[];
  const ctx=new Proxy({
    beginPath:()=>{path=[];},moveTo:(x,y)=>path.push({x,y}),lineTo:(x,y)=>path.push({x,y}),
    stroke:()=>strokes.push({path:[...path],color:ctx.strokeStyle,width:ctx.lineWidth}),
    fill:()=>fills.push({path:[...path],color:ctx.fillStyle}),
    measureText:text=>({width:String(text).length*6}),
    createRadialGradient:()=>({addColorStop:()=>{}}),
  },{get:(target,key)=>target[key]??(()=>{})});
  return {ctx,strokes,fills};
}
