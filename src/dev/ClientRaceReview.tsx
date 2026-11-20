// [N10] Pantalla de carrera del invitado con datos reales del motor, sin red: solo en desarrollo
// (`?revision=sala&pantalla=carrera`, y `&rol=espectador`). [MJ2] `&pausa=mia` o `&pausa=otro`: con una pausa de invitado.
// [MJ4] `&vuelta=ultima`: en la última vuelta.
// [MJ3] `&bandera=amarilla`: amarilla en el sector 1; `&detalle=propio` o `&detalle=rival`: con el detalle de un coche abierto. Sirve para medirla con `__uiAudit()` a cada ancho.
import { useMemo } from 'react';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { EngineHost } from '../engine/EngineHost';
import { guestSlowView, guestTeamView } from '../engine/RaceView';
import { rosterOf } from '../engine/RaceSession';
import { ClientRaceScreen } from '../components/ClientRace';

export default function ClientRaceReview() {
  const params = new URLSearchParams(location.search);
  const spectator = params.get('rol') === 'espectador';
  const pause = params.get('pausa');
  const flag = params.get('bandera');
  const detailOf = params.get('detalle');
  const lastLap = params.get('vuelta') === 'ultima';
  // [MJ11, 20/11/2026] Antes de la salida (luces apagadas): el invitado ve el plan de carrera.
  const beforeStart = params.get('salida') === 'antes';
  const data = useMemo(() => {
    const sim = new RaceSimulation('barcelona');
    sim.setSeed(42); sim.setFixedStep(0.02); sim.lightState = 'racing';
    const teams = [...new Set(sim.cars.map(c => c.team.id))];
    const host = new EngineHost(sim, { shared: { hostUid: 'h', hostTeamId: teams[0] } });
    host.join('g', { teamId: teams[1] });
    host.join('o', { teamId: teams[2] });
    host.setNames({ g: 'Tú', o: 'Bea' });
    for (let i = 0; i < 600; i++) host.advance(0.1);
    if (flag === 'amarilla') sim.sectorFlags = ['yellow', 'green', 'green'];
    // [MJ2] Una pausa de invitado en curso: la tuya o la de otro jugador, a mitad de la cuenta atrás.
    if (pause) { host.handle({ type: 'order', seq: 1, order: { kind: 'guestPause' } }, pause === 'mia' ? 'g' : 'o'); for (let i = 0; i < 130; i++) host.advance(0.1); }
    const ownCar = sim.cars.find(c => c.team.id === teams[1]);
    const rival = sim.cars.find(c => c.team.id === teams[3]);
    return { selected: detailOf === 'propio' ? ownCar?.id ?? null : detailOf === 'rival' ? rival?.id ?? null : null, teamId: teams[1], roster: rosterOf(sim), fast: host.fastView(), slow: (v => (lastLap ? { ...v, lap: v.totalLaps } : beforeStart ? { ...v, light: 'idle', lap: 0 } : v))(guestSlowView({ ...host.slowView(), ...host.pauseInfo() })), team: guestTeamView(host.teamView(teams[1])) };
  }, [pause, flag, detailOf, lastLap, beforeStart]);
  return (
    <ClientRaceScreen role={spectator ? 'spectator' : 'player'} myTeamId={spectator ? null : data.teamId} roster={data.roster} fast={data.fast} slow={data.slow}
      teams={spectator ? {} : { [data.teamId]: data.team }} link="direct" pauseRequested={false} myUid="g" onResumePause={() => {}} selectedCarId={data.selected} onSelectCar={() => {}}
      track={<div style={{ width: '100%', height: '100%', background: '#14181f' }} />}
      onOrder={async () => ({ ok: true })} onRequestPause={() => {}} onLeave={() => {}} />
  );
}
