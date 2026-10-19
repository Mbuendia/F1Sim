// [N7] Sala en vivo sin Firebase: anfitrión e invitado lado a lado (`?revision=sala&pantalla=vivo`), con la base y la
// red simuladas de los tests y dentro de StrictMode, como la aplicación en desarrollo. Solo en desarrollo.
import { StrictMode, useEffect, useState } from 'react';
import { RoomFlow } from '../components/RoomFlow';
import type { RoomBackend } from '../components/RoomFlow';

type Fakes = { fake: any; net: any };

export default function RoomLive() {
  const [fakes, setFakes] = useState<Fakes | null>(null);
  const [round, setRound] = useState(0);
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
  useEffect(() => { const id = setInterval(() => fakes?.net.flush(), 100); return () => clearInterval(id); }, [fakes]);
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
        <div style={half} data-half="anfitrion"><RoomFlow intent="create" backend={backend('host')} onExit={() => setRound(r => r + 1)} /></div>
        <div style={half} data-half="invitado"><RoomFlow intent="join" backend={backend('g1')} onExit={() => setRound(r => r + 1)} /></div>
      </div>
    </StrictMode>
  );
}
