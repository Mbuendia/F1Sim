// [N7/N8] Sala en vivo sin Firebase: anfitrión e invitado lado a lado (`?revision=sala&pantalla=vivo`), con la base y
// la red simuladas de los tests y dentro de StrictMode, como la aplicación en desarrollo. Solo en desarrollo.
// Al pulsar «Empezar», el anfitrión arranca una carrera mínima (motor en la propia pestaña, sin la preparación de la
// aplicación) con el anfitrión que la reparte (N8), y el invitado entra en su pantalla de carrera.
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { RoomFlow } from '../components/RoomFlow';
import type { HostStart, RoomBackend } from '../components/RoomFlow';
import { PauseRequestBanner, SharedRaceEnd } from '../components/ClientRace';
import { runQualifying } from '../simulation/Qualifying';
import { returnToLobby } from '../net/Lobby';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { createSnapshot } from '../simulation/Snapshot';
import { buildWeatherScenario } from '../data/weatherScenarios';
import { LocalLink } from '../engine/LocalLink';
import { rosterOf } from '../engine/RaceSession';
import { createRaceStore } from '../state/raceStore';
import { publishQualifying, SharedRaceHost } from '../net/SharedRace';
import type { PauseRequest } from '../net/SharedRace';

type Fakes = { fake: any; net: any };
const CONFIG = { fixedStepSec: 0.02, autoStartTyres: true, seededPreparation: true, autoTeamOrders: true, upgradeTradeoffs: {}, luckVariantEnabled: false };

/** El anfitrión en carrera (versión mínima de lo que hace App): vuelta, peticiones de pausa y su pausa. */
function HostRace({ start, onAnother }: { start: HostStart; onAnother: () => void }) {
  const store = useMemo(() => createRaceStore(), []);
  const [host, setHost] = useState<SharedRaceHost | null>(null);
  const [pauses, setPauses] = useState<PauseRequest[]>([]);
  // [N9] Con clasificación: se calcula, se publica y el anfitrión decide cuándo se sale a pista.
  const [onTrack, setOnTrack] = useState(start.format !== 'clasificacion');
  const [qualified, setQualified] = useState(false);
  const slow = useStore(store, state => state.slow);
  const sim = useMemo(() => {
    const sim = new RaceSimulation(start.circuitId);
    sim.setWeatherScenario(buildWeatherScenario(start.weather, sim.totalLaps * 90));
    if (start.format === 'clasificacion') {
      const quali = runQualifying(sim.qualifyingEntrants(), 1234, { format: 'gp' });
      sim.setStartingGrid(quali.grid.slice().sort((a, b) => a.position - b.position).map(g => g.driverId));
      void publishQualifying(start.db, start.code, { result: quali, roster: rosterOf(sim), circuitId: start.circuitId, weather: start.weather }).then(() => setQualified(true));
    }
    sim.lightState = 'racing';
    return sim;
  }, [start]);
  useEffect(() => {
    if (!onTrack) return;
    const link = new LocalLink();
    link.run();
    const shared = new SharedRaceHost({ link, transport: start.transport, store, names: start.names, onPauseRequest: () => setPauses([...shared.pauseRequests]) });
    void shared.start({ db: start.db, code: start.code, snapshot: createSnapshot(sim), config: CONFIG, roster: rosterOf(sim), circuitId: start.circuitId,
      weather: start.weather, format: start.format, hostUid: start.hostUid, hostTeamId: start.hostTeamId, players: start.players });
    setHost(shared);
    (window as any).__roomLiveHost = shared;
    return () => shared.stop();
  }, [start, store, sim, onTrack]);
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text)', background: 'var(--bg)' }} data-host-race>
      <h2 style={{ margin: 0 }}>Anfitrión en carrera</h2>
      <p style={{ margin: 0 }}>Vuelta {slow?.lap ?? '–'} · velocidad x{slow?.speed ?? '–'} · {slow?.paused ? 'en pausa' : 'en marcha'}</p>
      <PauseRequestBanner requests={pauses} onDismiss={uid => { host?.dismissPause(uid); setPauses([...(host?.pauseRequests ?? [])]); }} />
      {!onTrack && <p style={{ margin: 0 }}>{qualified ? 'Clasificación publicada' : 'Calculando la clasificación…'}</p>}
      {!onTrack && <button type="button" disabled={!qualified} onClick={() => setOnTrack(true)}>Salir a pista</button>}
      {onTrack && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { void host?.order({ kind: 'pause', paused: !slow?.paused }); }}>{slow?.paused ? 'Seguir' : 'Parar'}</button>
          <button type="button" onClick={() => { void host?.order({ kind: 'speed', value: 8 }); }}>Pedir x8</button>
          <button type="button" onClick={() => { void host?.order({ kind: 'devRedFlag', reason: 'PRUEBA' }); }}>Bandera roja</button>
          <button type="button" onClick={() => { void host?.order({ kind: 'endSuspended' }); }}>Terminar</button>
        </div>
      )}
      {slow?.finished && <SharedRaceEnd isHost onLeave={() => {}} onClose={() => {}} onAnother={() => { void returnToLobby(start.db, start.code); onAnother(); }} />}
    </div>
  );
}

export default function RoomLive() {
  const [fakes, setFakes] = useState<Fakes | null>(null);
  const [round, setRound] = useState(0);
  const [hostStart, setHostStart] = useState<HostStart | null>(null);
  const [resume, setResume] = useState<HostStart | null>(null);
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    const db = `${base}tests/support/fakeDb.mjs`, direct = `${base}tests/support/fakeDirect.mjs`;
    Promise.all([import(/* @vite-ignore */ db), import(/* @vite-ignore */ direct)]).then(([a, b]) => {
      const fakes = { fake: a.createFakeServer(), net: b.createDirectNet() };
      (window as any).__roomLive = fakes;
      setFakes(fakes);
    });
  }, []);
  // La red simulada no entrega nada hasta flush().
  useEffect(() => { const id = setInterval(() => fakes?.net.flush(), 50); return () => clearInterval(id); }, [fakes]);
  if (!fakes) return <p>Cargando…</p>;
  const backend = (uid: string): RoomBackend => ({
    // Como Firebase: cada conexión tarda lo suyo (y StrictMode conecta dos veces).
    connect: async () => { await new Promise(r => setTimeout(r, 100 + Math.random() * 400)); return fakes.fake.client(uid); },
    listener: () => fakes.net.listener,
    connector: () => fakes.net.connector(uid),
  });
  const half = { flex: 1, minWidth: 0, height: '100dvh', overflow: 'hidden', borderRight: '2px solid #333' } as const;
  return (
    <StrictMode>
      <style>{'[data-half] > div { width: 100% !important; height: 100% !important; }'}</style>
      <div style={{ display: 'flex', width: '100vw' }} key={round}>
        <div style={half} data-half="anfitrion">
          {hostStart ? <HostRace start={hostStart} onAnother={() => { setResume(hostStart); setHostStart(null); }} />
            : <RoomFlow intent="create" backend={backend('host')} resume={resume} onExit={() => setRound(r => r + 1)} onHostStart={start => { setResume(null); setHostStart(start); }} />}
        </div>
        <div style={half} data-half="invitado"><RoomFlow intent="join" backend={backend('g1')} onExit={() => setRound(r => r + 1)} /></div>
      </div>
    </StrictMode>
  );
}
