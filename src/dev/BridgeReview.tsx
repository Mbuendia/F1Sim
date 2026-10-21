// Puente y sombras (21/10/2026): el lienzo real de carrera con coches colocados por debajo y por encima del puente de
// Suzuka. Solo en desarrollo: `?revision=puente`, con `&circuito=` (suzuka), `&hora=` (segundos de carrera, 0),
// `&nubes=` (0 a 1), `&zoom=` (píxeles por metro, 4) y `&rot=` (giro de la cámara en grados, 0).
import { useEffect, useMemo, useState } from 'react';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { EngineHost } from '../engine/EngineHost';
import { rosterOf } from '../engine/RaceSession';
import { RaceCanvas } from '../components/RaceCanvas';
import { Camera } from '../renderer/Camera';
import { raceStore } from '../state/raceStore';
import { bridgeSide, findCrossings, overpassFor } from '../renderer/overpass';
import { START_HOUR, sunAt } from '../renderer/lighting';
import type { CameraMode3D } from '../scene3d/cameras';

const q = new URLSearchParams(location.search);
const circuitId = q.get('circuito') ?? 'suzuka';
const raceTimeSec = Number(q.get('hora') ?? 0);
const clouds = Number(q.get('nubes') ?? 0);
const zoom = Number(q.get('zoom') ?? 4);
const rotation = Number(q.get('rot') ?? 0) * Math.PI / 180;
const cameraMode = (q.get('camara') ?? undefined) as CameraMode3D | undefined;

export default function BridgeReview() {
  const data = useMemo(() => {
    const sim = new RaceSimulation(circuitId);
    sim.setSeed(42); sim.setFixedStep(0.02); sim.lightState = 'racing';
    const host = new EngineHost(sim);
    for (let i = 0; i < 50; i++) host.advance(0.1);
    const o = overpassFor(circuitId);
    const crossing = findCrossings(sim.activeTrack.points)[0];
    if (o) {
      // Dos coches por debajo y dos por encima, justo en el cruce.
      const place: [number, number, number][] = [[0, o.lowerT - 0.0004, 0], [1, o.lowerT + 0.0003, 0.6], [2, o.upperT - 0.0005, 0.5], [3, o.upperT + 0.0006, -0.5]];
      for (const [i, t, lateral] of place) {
        const car = sim.cars[i];
        car.progress = Math.floor(car.progress) + t;
        car.lateralOffset = car.targetLateralOffset = lateral;
      }
      host.advance(0.02);
    }
    const target = crossing ?? { x: sim.cars[0].worldX, y: sim.cars[0].worldY };
    const sides = sim.cars.map(c => ({ code: c.driver.code, side: bridgeSide(o, c.trackT, Boolean(c.isInPitLane)) })).filter(c => c.side);
    return { sim, host, roster: rosterOf(sim), target, sides };
  }, []);
  const [camera] = useState(() => new Camera());
  // La pantalla de carrera encuadra el circuito entero al montarse: la cámara se fija en el cruce justo después.
  useEffect(() => {
    const aim = () => {
      camera.currentMode = 'free'; camera.followingCarId = null;
      camera.x = camera.targetX = data.target.x; camera.y = camera.targetY = data.target.y;
      camera.zoom = camera.targetZoom = zoom; camera.rotation = camera.targetRotation = rotation;
    };
    aim();
    const timer = setInterval(aim, 100);
    const stop = setTimeout(() => clearInterval(timer), 1500);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [camera, data]);

  useEffect(() => {
    raceStore.getState().reset(data.roster);
    const fast = { ...data.host.fastView(), t: raceTimeSec };
    const base = data.host.slowView();
    const slow = { ...base, t: raceTimeSec, weatherScene: { ...base.weatherScene, cloudCover: clouds } };
    const now = performance.now();
    raceStore.getState().receive({ type: 'slow', view: slow }, now);
    raceStore.getState().receive({ type: 'fast', view: fast }, now - 100);
    raceStore.getState().receive({ type: 'fast', view: fast }, now);
  }, [data]);

  const sun = sunAt({ circuitId, raceTimeSec, cloudCover: clouds });
  const hour = (START_HOUR[circuitId] ?? 15) + raceTimeSec / 3600;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#14181f' }}>
      <RaceCanvas track={data.sim.activeTrack} circuitId={circuitId} roster={data.roster} camera={camera} selectedCarId={null} onSelectCar={() => {}} initialCameraMode={cameraMode} />
      <div data-bridge-review style={{ position: 'absolute', left: 12, bottom: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.6)', color: '#fff', font: '13px system-ui', borderRadius: 6 }}>
        {circuitId} · {Math.floor(hour)}:{String(Math.round((hour % 1) * 60)).padStart(2, '0')} · nubes {Math.round(clouds * 100)} % · {sun.mode} · sombra ×{sun.length.toFixed(2)} · {data.sides.map(c => `${c.code} ${c.side === 'under' ? 'abajo' : 'arriba'}`).join(', ')}
      </div>
    </div>
  );
}
