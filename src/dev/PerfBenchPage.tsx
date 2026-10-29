import { useEffect, useMemo, useRef, useState } from 'react';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { createSnapshot } from '../simulation/Snapshot';
import { RaceSession, rosterOf } from '../engine/RaceSession';
import { LocalLink, WorkerLink } from '../engine/LocalLink';
import { RaceCanvas } from '../components/RaceCanvas';
import { Camera } from '../renderer/Camera';
import { raceStore } from '../state/raceStore';
import type { CameraMode3D } from '../scene3d/cameras';
import { loadTimes } from '../perf/loadMarks';
import { BENCH_SCENARIO, benchSummary, benchText, type BenchSummary } from './perfBench';
import { PerfPanel, EMPTY_SNAPSHOT, startPerfSampler, type PerfSnapshot, type PerfStageId } from './PerfOverlay';

/**
 * [PF1] Prueba de rendimiento repetible (`?rendimiento=prueba`): una carrera real con el motor en el Worker, como en el
 * juego, siempre con la escena de `BENCH_SCENARIO`. Calienta unos segundos, mide 30 s y enseña el resumen con «Copiar».
 */
type Phase = { kind: 'warmup'; left: number } | { kind: 'measuring'; left: number } | { kind: 'done'; summary: BenchSummary };

export default function PerfBench() {
  const sc = BENCH_SCENARIO;
  const data = useMemo(() => {
    const sim = new RaceSimulation(sc.circuitId);
    sim.setSeed(sc.seed); sim.setFixedStep(0.02); sim.lightState = 'racing';
    return { sim, roster: rosterOf(sim), snapshot: createSnapshot(sim), followed: sim.cars[0]?.id ?? null };
  }, [sc]);
  const [camera] = useState(() => new Camera());
  const [phase, setPhase] = useState<Phase>({ kind: 'warmup', left: sc.warmupS });
  const [live, setLive] = useState<PerfSnapshot>(EMPTY_SNAPSHOT);
  const [device, setDevice] = useState(() => (typeof navigator !== 'undefined' ? navigator.platform || 'Dispositivo' : 'Dispositivo'));
  const [copied, setCopied] = useState(false);
  const deviceRef = useRef(device);
  deviceRef.current = device;

  // Motor de la carrera, como en App: Worker si hay, enlace local si no.
  useEffect(() => {
    const link = typeof Worker !== 'undefined' ? new WorkerLink() : (() => { const local = new LocalLink(); local.run(); return local; })();
    const session = new RaceSession({ link, store: raceStore });
    void session.start({
      snapshot: data.snapshot, roster: data.roster,
      config: { fixedStepSec: 0.02, autoStartTyres: true, seededPreparation: true, autoTeamOrders: true, luckVariantEnabled: false, upgradeTradeoffs: {} },
    });
    return () => session.stop();
  }, [data]);

  // Calentamiento, 30 s de medida y resumen.
  useEffect(() => {
    let elapsed = 0;
    const frames: number[] = [];
    const seconds: PerfSnapshot[] = [];
    const stop = startPerfSampler((snapshot, frameMs) => {
      setLive(snapshot);
      elapsed++;
      if (elapsed <= sc.warmupS) { setPhase({ kind: 'warmup', left: sc.warmupS - elapsed }); return; }
      frames.push(...frameMs); seconds.push(snapshot);
      const measured = elapsed - sc.warmupS;
      if (measured < sc.durationS) { setPhase({ kind: 'measuring', left: sc.durationS - measured }); return; }
      stop();
      const mean = (pick: (s: PerfSnapshot) => number | null) => {
        const values = seconds.map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      };
      const stageIds = Object.keys(EMPTY_SNAPSHOT.stages) as PerfStageId[];
      const stages = Object.fromEntries(stageIds.map(id => [id, mean(s => s.stages[id]) ?? 0]));
      const last = seconds[seconds.length - 1];
      const load = loadTimes();
      setPhase({ kind: 'done', summary: benchSummary({
        device: deviceRef.current, userAgent: navigator.userAgent, frames, stages,
        gpuMs: mean(s => s.gpuMs), heapMb: last?.heapMb ?? null, gpuGeometries: last?.gpuGeometries ?? null, gpuTextures: last?.gpuTextures ?? null,
        menuMs: load.menuMs, firstFrameMs: load.firstFrameMs,
      }) });
    });
    return stop;
  }, [sc]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };

  const box = { position: 'absolute', left: 12, top: 12, maxWidth: 'min(520px, calc(100vw - 24px))', padding: '10px 12px', borderRadius: 8,
    background: 'rgba(0,0,0,0.78)', color: '#f3f4f6', font: '13px system-ui', lineHeight: 1.45, zIndex: 100000 } as const;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#14181f' }}>
      <RaceCanvas track={data.sim.activeTrack} circuitId={sc.circuitId} roster={data.roster} camera={camera}
        selectedCarId={data.followed} onSelectCar={() => {}} initialCameraMode={sc.camera as CameraMode3D} />
      <PerfPanel snapshot={live} />
      <div data-perf-bench style={box}>
        <strong>Prueba de rendimiento</strong> · {sc.circuitId} · semilla {sc.seed} · cámara {sc.camera}
        <div style={{ marginTop: 6 }}>
          <label>Dispositivo: <input value={device} onChange={e => setDevice(e.target.value)} style={{ width: 180 }} /></label>
        </div>
        {phase.kind === 'warmup' && <div style={{ marginTop: 6 }}>Calentando… {phase.left} s</div>}
        {phase.kind === 'measuring' && <div style={{ marginTop: 6 }}>Midiendo… quedan {phase.left} s. No toques la pantalla.</div>}
        {phase.kind === 'done' && (() => {
          const text = benchText({ ...phase.summary, device });
          return (
            <div style={{ marginTop: 6 }}>
              <pre data-perf-bench-result style={{ whiteSpace: 'pre-wrap', margin: '6px 0', font: '12px ui-monospace, monospace' }}>{text}</pre>
              <button type="button" onClick={() => copy(text)} style={{ padding: '6px 12px', borderRadius: 6, border: 0, background: '#e10600', color: '#fff', font: '600 13px system-ui' }}>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
