// [N10] Pantalla de carrera del invitado con datos reales del motor, sin red: solo en desarrollo
// (`?revision=sala&pantalla=carrera`, y `&rol=espectador`). Sirve para medirla con `__uiAudit()` a cada ancho.
import { useMemo } from 'react';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { EngineHost } from '../engine/EngineHost';
import { guestSlowView, guestTeamView } from '../engine/RaceView';
import { rosterOf } from '../engine/RaceSession';
import { ClientRaceScreen } from '../components/ClientRace';

export default function ClientRaceReview() {
  const spectator = new URLSearchParams(location.search).get('rol') === 'espectador';
  const data = useMemo(() => {
    const sim = new RaceSimulation('barcelona');
    sim.setSeed(42); sim.setFixedStep(0.02); sim.lightState = 'racing';
    const teams = [...new Set(sim.cars.map(c => c.team.id))];
    const host = new EngineHost(sim, { shared: { hostUid: 'h', hostTeamId: teams[0] } });
    host.join('g', { teamId: teams[1] });
    for (let i = 0; i < 600; i++) host.advance(0.1);
    return { teamId: teams[1], roster: rosterOf(sim), fast: host.fastView(), slow: guestSlowView(host.slowView()), team: guestTeamView(host.teamView(teams[1])) };
  }, []);
  return (
    <ClientRaceScreen role={spectator ? 'spectator' : 'player'} myTeamId={spectator ? null : data.teamId} roster={data.roster} fast={data.fast} slow={data.slow}
      teams={spectator ? {} : { [data.teamId]: data.team }} link="direct" pauseRequested={false}
      track={<div style={{ width: '100%', height: '100%', background: '#14181f' }} />}
      onOrder={async () => ({ ok: true })} onRequestPause={() => {}} onLeave={() => {}} />
  );
}
