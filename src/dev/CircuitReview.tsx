// [G1] Página de revisión de circuitos (Sprint 4.5). Solo en desarrollo: `npm run dev` y abrir `?revision=circuitos`.
// Enseña cada circuito con eje, bordes, trazada, boxes, meta y parrilla superpuestos, sus medidas de calidad
// (`circuitQuality.ts`) y un coche de prueba dando vueltas con el motor real.
import { useEffect, useMemo, useRef, useState } from 'react';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { calculateCarWorldPosition, getTrackHalfWidth, worldUnitsPerMeter } from '../utils/carPosition';
import { measureCircuit, qualityChecks, QUALITY_LIMITS } from '../utils/circuitQuality';
import { getPitLaneGeometry } from '../utils/pitLaneGeometry';
import type { Point2D } from '../utils/spline';
import finishReferences from '../../tests/fixtures/finish-line-references.json';

const IDS = Object.keys(OFFICIAL_CIRCUITS);
const LAYERS = ['asfalto', 'bordes', 'eje', 'trazada', 'boxes', 'meta y parrilla', 'curvas', 'coche'] as const;
type Layer = typeof LAYERS[number];

function soloCar(circuitId: string): RaceSimulation {
  const sim = new RaceSimulation(circuitId);
  sim.cars = sim.cars.slice(0, 1);
  sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 999;
  const car = sim.cars[0];
  Object.assign(car, { progress: 1.9, trackT: 0.9, currentLap: 1, currentSpeedKmh: 200, lateralOffset: 0, targetLateralOffset: 0 });
  car.pitStop.playerControlled = true;
  return sim;
}

export default function CircuitReview() {
  const [index, setIndex] = useState(() => Math.max(0, IDS.indexOf(new URLSearchParams(location.search).get('circuito') ?? '')));
  const [layers, setLayers] = useState<Record<Layer, boolean>>(() => Object.fromEntries(LAYERS.map(l => [l, true])) as Record<Layer, boolean>);
  const [follow, setFollow] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, y: 0, zoom: 1, fitted: '' });
  const id = IDS[index];
  const sim = useMemo(() => soloCar(id), [id]);
  const track = sim.activeTrack;
  // La referencia de la meta es la misma que usa el test (distancia real de la meta a la salida de boxes).
  const checks = useMemo(() => qualityChecks(measureCircuit(track), (finishReferences as Record<string, { lineToPitExitM?: number }>)[id]?.lineToPitExitM), [track, id]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const unit = worldUnitsPerMeter(track);
    const geometry = getPitLaneGeometry(track);
    const points = track.points, n = points.length;
    const line: Point2D[] = points.map((p, i) => {
      const w = calculateCarWorldPosition({ progress: i / n, lateralOffset: p.idealLineOffset || 0, isInPitLane: false }, track);
      return { x: w.worldX, y: w.worldY };
    });
    const trail: Point2D[] = [];
    let frame = 0, last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      sim.update(dt);
      const car = sim.cars[0];
      trail.push({ x: car.worldX, y: car.worldY });
      if (trail.length > 600) trail.shift();

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; }
      const v = view.current;
      if (v.fitted !== id) {
        const b = track.bounds;
        v.zoom = Math.min(width / (b.maxX - b.minX), height / (b.maxY - b.minY));
        v.x = (b.minX + b.maxX) / 2; v.y = (b.minY + b.maxY) / 2; v.fitted = id;
      }
      if (follow) { v.x = car.worldX; v.y = car.worldY; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#12161b'; ctx.fillRect(0, 0, width, height);
      ctx.translate(width / 2, height / 2); ctx.scale(v.zoom, v.zoom); ctx.translate(-v.x, -v.y);
      const px = 1 / v.zoom;
      const path = (pts: Point2D[], closed = false) => {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        if (closed) ctx.closePath();
      };
      const stroke = (pts: Point2D[], color: string, w: number, closed = false) => { path(pts, closed); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); };

      const [left, right] = geometry.trackEdges;
      if (layers.asfalto && left && right) {
        // Asfalto por tramos con el ancho de cada muestra: es lo que hoy pinta la carrera.
        ctx.fillStyle = '#343a45';
        for (let i = 0; i < n; i++) {
          const a = points[i], b = points[(i + 1) % n];
          const hw = getTrackHalfWidth(a.trackWidthMeters ?? track.trackWidthMeters);
          path([{ x: a.x + a.normal.x * hw, y: a.y + a.normal.y * hw }, { x: b.x + b.normal.x * hw, y: b.y + b.normal.y * hw },
            { x: b.x - b.normal.x * hw, y: b.y - b.normal.y * hw }, { x: a.x - a.normal.x * hw, y: a.y - a.normal.y * hw }], true);
          ctx.fill();
        }
      }
      if (layers.boxes) {
        if (geometry.serviceArea.length) { path(geometry.serviceArea, true); ctx.fillStyle = 'rgba(120,130,150,0.35)'; ctx.fill(); }
        for (const edge of geometry.fastLaneEdges) stroke(edge, '#9aa3b2', px);
        for (const wall of geometry.walls) stroke(wall, '#ffb020', 2 * px);
        for (const box of geometry.boxes) { path(box.corners, true); ctx.fillStyle = box.team.color; ctx.fill(); }
        stroke(track.pitLanePoints, '#35c2ff', 1.5 * px);
      }
      if (layers.bordes) for (const edge of geometry.trackEdges) stroke(edge, '#ffffff', px, true);
      if (layers.eje) {
        stroke(points, '#6b7280', px, true);
        ctx.fillStyle = '#6b7280';
        if (v.zoom * unit > 3) for (const p of points) ctx.fillRect(p.x - px, p.y - px, 2 * px, 2 * px);
      }
      if (layers.trazada) stroke(line, '#ff4fd8', 1.5 * px, true);
      if (layers['meta y parrilla']) {
        const p = points[0], hw = getTrackHalfWidth(p.trackWidthMeters ?? track.trackWidthMeters);
        stroke([{ x: p.x + p.normal.x * hw, y: p.y + p.normal.y * hw }, { x: p.x - p.normal.x * hw, y: p.y - p.normal.y * hw }], '#39ff88', 3 * px);
        ctx.fillStyle = '#39ff88';
        for (let slot = 0; slot < 20; slot++) {
          const w = calculateCarWorldPosition({ progress: 1 - (slot + 1) * sim.gridSpacing(), lateralOffset: slot % 2 === 0 ? 0.65 : -0.65, isInPitLane: false }, track);
          ctx.beginPath(); ctx.arc(w.worldX, w.worldY, 3 * px, 0, Math.PI * 2); ctx.fill();
        }
        for (const [t, color] of [[track.pitEntryT, '#35c2ff'], [track.pitExitT, '#35c2ff'], [track.pitCommitmentT ?? -1, '#ffb020']] as const) {
          if (t < 0) continue;
          const q = points[Math.floor((((t % 1) + 1) % 1) * n) % n];
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(q.x, q.y, 4 * px, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (layers.curvas) {
        ctx.fillStyle = '#ffe14d'; ctx.font = `${12 * px}px sans-serif`;
        for (const corner of track.corners) {
          const q = points[Math.floor(corner.t * n) % n];
          ctx.fillText(String(corner.number), q.x + q.normal.x * 30 * px, q.y + q.normal.y * 30 * px);
        }
      }
      if (layers.coche) {
        stroke(trail, '#ff3b30', 1.5 * px);
        ctx.save(); ctx.translate(car.worldX, car.worldY); ctx.rotate(car.worldAngle);
        const length = Math.max(5.6 * unit, 10 * px), wide = Math.max(2 * unit, 4 * px);
        ctx.fillStyle = '#ff3b30'; ctx.fillRect(-length / 2, -wide / 2, length, wide);
        ctx.restore();
      }
      // Escala: 100 m.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#fff'; ctx.fillRect(16, height - 22, 100 * unit * v.zoom, 3);
      ctx.font = '12px sans-serif'; ctx.fillText(`100 m · ${Math.round(car.currentSpeedKmh)} km/h`, 16, height - 28);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const v = view.current, rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left - rect.width / 2, my = event.clientY - rect.top - rect.height / 2;
      const factor = Math.exp(-event.deltaY * 0.0015);
      v.x += mx / v.zoom - mx / (v.zoom * factor); v.y += my / v.zoom - my / (v.zoom * factor);
      v.zoom *= factor;
    };
    const move = (event: PointerEvent) => {
      if (!(event.buttons & 1)) return;
      view.current.x -= event.movementX / view.current.zoom; view.current.y -= event.movementY / view.current.zoom;
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('pointermove', move);
    return () => { cancelAnimationFrame(frame); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('pointermove', move); };
  }, [id, sim, track, layers, follow]);

  const failed = checks.filter(c => !c.pass).length;
  const go = (delta: number) => setIndex(i => (i + delta + IDS.length) % IDS.length);
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0c0f13', color: '#e8e6df', font: '14px/1.4 system-ui, sans-serif' }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }} />
      </div>
      <aside style={{ width: 340, flexShrink: 0, padding: 16, overflowY: 'auto', borderLeft: '1px solid #2a2f38' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => go(-1)}>◀</button>
          <select value={id} onChange={e => setIndex(IDS.indexOf(e.target.value))} style={{ flex: 1 }}>
            {IDS.map((c, i) => <option key={c} value={c}>{i + 1}. {OFFICIAL_CIRCUITS[c].name}</option>)}
          </select>
          <button onClick={() => go(1)}>▶</button>
        </div>
        <p style={{ margin: '12px 0 4px' }}>
          {track.lapLengthMeters} m · {track.points.length} muestras · {failed === 0 ? 'todas las medidas en verde' : `${failed} de ${checks.length} medidas fuera de límite`}
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {checks.map(check => (
              <tr key={check.id} style={{ borderTop: '1px solid #2a2f38', color: check.pass ? '#8fd694' : '#ff9d8a' }}>
                <td style={{ padding: '4px 6px 4px 0' }}>{check.pass ? '✔' : '✘'} {check.label}</td>
                <td style={{ padding: '4px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>{check.value}<br /><small style={{ opacity: 0.7 }}>{check.limit}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '16px 0 4px' }}>Capas</p>
        {LAYERS.map(layer => (
          <label key={layer} style={{ display: 'block' }}>
            <input type="checkbox" checked={layers[layer]} onChange={e => setLayers({ ...layers, [layer]: e.target.checked })} /> {layer}
          </label>
        ))}
        <label style={{ display: 'block', marginTop: 8 }}>
          <input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} /> seguir al coche
        </label>
        <p style={{ opacity: 0.7, marginTop: 16 }}>
          Rueda: zoom · arrastrar: mover. Blanco: bordes · gris: eje · rosa: trazada · azul: ruta de boxes · ámbar: muro y línea de
          decisión · verde: meta y parrilla · rojo: coche y su rastro. Recta: radio ≥ {QUALITY_LIMITS.straightRadiusM} m.
        </p>
      </aside>
    </div>
  );
}
