// [N7] Página de revisión de las pantallas de sala con datos simulados, sin Firebase: solo en desarrollo
// (`?revision=sala&pantalla=anfitrion|unirse|invitado|equipo`). Sirve para medirlas con `__uiAudit()` a cada ancho.
import { useState } from 'react';
import { TEAMS } from '../data/teams';
import { DEFAULT_SETTINGS } from '../net/Lobby';
import type { LobbySettings } from '../net/Lobby';
import { qrSvg } from '../net/roomQr';
import { GuestLobby, HostLobby, JoinRoomScreen } from '../components/RoomScreens';
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

export default function RoomReview() {
  const screen = new URLSearchParams(location.search).get('pantalla') ?? 'anfitrion';
  const [settings, setSettings] = useState<LobbySettings>({ ...DEFAULT_SETTINGS, circuitId: 'monaco' });
  const noop = () => {};
  if (screen === 'unirse') return <JoinRoomScreen initialCode="ABC234" error="no-existe" busy={false} onJoin={noop} onBack={noop} />;
  if (screen === 'invitado' || screen === 'equipo') {
    return <GuestLobby code="ABC234" myUid={screen === 'equipo' ? 'g1' : 'g3'} teams={teams} players={players} seats={seats} settings={settings} wants={null} status="lobby" onPick={noop} onLeave={noop} />;
  }
  return <HostLobby code="ABC234" link={link} qr={qrSvg(link)} settings={settings} teams={teams} players={players} hostTeamId={ids[0]}
    onSettings={setSettings} onHostTeam={noop} onStart={noop} onClose={noop} />;
}
