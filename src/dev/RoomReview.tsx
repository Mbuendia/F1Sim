// [N7] Página de revisión de las pantallas de sala con datos simulados, sin Firebase: solo en desarrollo
// (`?revision=sala&pantalla=anfitrion|unirse|espera|equipos|equipos-anfitrion`; `vivo`: anfitrión e invitado a la
// vez, ver RoomLive). Sirve para medirlas con `__uiAudit()` a cada ancho.
import { lazy, Suspense, useState } from 'react';
import { TEAMS } from '../data/teams';
import { DEFAULT_SETTINGS } from '../net/Lobby';
import type { LobbySettings } from '../net/Lobby';
import { qrSvg } from '../net/roomQr';
import { GuestWaiting, HostLobby, JoinRoomScreen, TeamSelection } from '../components/RoomScreens';
import type { RoomPlayer } from '../components/RoomScreens';

const teams = Object.values(TEAMS).map(t => ({ id: t.id, name: t.name, color: t.color }));
const ids = teams.map(t => t.id);
const players: RoomPlayer[] = [
  { uid: 'host', name: 'Anfitrión', role: 'host', teamId: ids[0], link: 'none' },
  { uid: 'g1', name: 'Bea', role: 'player', teamId: ids[1], link: 'direct' },
  { uid: 'g2', name: 'Carla Fernández de la Vega', role: 'player', teamId: ids[2], link: 'fallback' },
  { uid: 'g3', name: 'Dani', role: 'pending', teamId: null, link: 'connecting' },
  { uid: 'g4', name: 'Eva', role: 'spectator', teamId: null, link: 'down' },
];
const seats = { teams: { [ids[0]]: 'host', [ids[1]]: 'g1', [ids[2]]: 'g2' }, spectators: ['g4'], handled: {} };
const link = 'https://f1sim-d5085.web.app/?sala=ABC234';

const RoomLive = lazy(() => import('./RoomLive'));
const ClientRaceReview = lazy(() => import('./ClientRaceReview'));

function Screens({ screen }: { screen: string }) {
  const [settings, setSettings] = useState<LobbySettings>({ ...DEFAULT_SETTINGS, circuitId: 'monaco' });
  const noop = () => {};
  if (screen === 'unirse') return <JoinRoomScreen initialCode="ABC234" error="misma-sesion" busy={false} onJoin={noop} onBack={noop} />;
  if (screen === 'espera') return <GuestWaiting code="ABC234" players={players} settings={settings} status="lobby" onLeave={noop} />;
  if (screen === 'equipos' || screen === 'equipos-anfitrion') {
    const host = screen === 'equipos-anfitrion';
    return <TeamSelection code="ABC234" myUid={host ? 'host' : 'g3'} isHost={host} teams={teams} players={players} seats={seats} settings={settings}
      wants={null} status="lobby" onPick={noop} onStart={noop} onLeave={noop} />;
  }
  return <HostLobby code="ABC234" link={link} qr={qrSvg(link)} settings={settings} players={players} onSettings={setSettings} onOpenTeams={noop} onClose={noop} />;
}

export default function RoomReview() {
  const screen = new URLSearchParams(location.search).get('pantalla') ?? 'anfitrion';
  if (screen === 'vivo') return <Suspense fallback={null}><RoomLive /></Suspense>;
  if (screen === 'carrera') return <Suspense fallback={null}><ClientRaceReview /></Suspense>;
  return <Screens screen={screen} />;
}
