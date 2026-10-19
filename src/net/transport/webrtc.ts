// [N5] Conexión directa por WebRTC, con STUN público y la sala de N4 como buzón de señalización:
//   el invitado deja su oferta en rooms/{código}/inbox/{uid}/signal   { id, offer }
//   el anfitrión responde en  rooms/{código}/outbox/{uid}/signal       { id, answer }
// Sin «trickle»: cada lado espera a reunir sus candidatos (como mucho 3 s) y los manda dentro de la descripción, así
// la señalización son dos escrituras por intento. Dos canales: «fast», sin orden ni reenvíos (si se pierde una vista
// rápida vale la siguiente), y «rel», fiable y ordenado (órdenes, acuses, vistas lenta y de equipo).
// Solo en el navegador; la prueba real entre dos redes es revisión del usuario (N10).
import type { RoomDb } from '../RoomService';
import { roomPaths } from '../RoomService';
import type { DirectChannel, DirectConnector, DirectListener } from './Transport';

export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const GATHER_TIMEOUT_MS = 3000;

const signalIn = (code: string, uid: string) => `${roomPaths.inbox(code, uid)}/signal`;
const signalOut = (code: string, uid: string) => `${roomPaths.outbox(code, uid)}/signal`;

function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', check); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

const plain = (d: RTCSessionDescription | null) => (d ? { type: d.type, sdp: d.sdp } : null);

/** Envuelve una conexión y sus dos canales en un DirectChannel. */
function wrap(pc: RTCPeerConnection, onDispose: () => void) {
  const ls = { message: [] as ((m: unknown) => void)[], open: [] as (() => void)[], close: [] as (() => void)[] };
  let fast: RTCDataChannel | null = null;
  let rel: RTCDataChannel | null = null;
  let opened = false;
  let closed = false;
  const channel: DirectChannel & { attach(dc: RTCDataChannel): void } = {
    get isOpen() { return opened && !closed && fast?.readyState === 'open' && rel?.readyState === 'open'; },
    send(message) {
      const target = (message as { t?: string })?.t === 'fast' ? fast : rel;
      if (target?.readyState === 'open') target.send(JSON.stringify(message));
    },
    onMessage(cb) { ls.message.push(cb); },
    onOpen(cb) { ls.open.push(cb); },
    onClose(cb) { ls.close.push(cb); },
    close() {
      if (closed) return;
      closed = true;
      try { pc.close(); } catch { /* ya cerrada */ }
      onDispose();
      if (opened) ls.close.forEach(cb => cb());
    },
    attach(dc) {
      if (dc.label === 'fast') fast = dc; else rel = dc;
      dc.onmessage = event => { let m: unknown; try { m = JSON.parse(String(event.data)); } catch { return; } ls.message.forEach(cb => cb(m)); };
      dc.onopen = () => {
        if (!opened && !closed && fast?.readyState === 'open' && rel?.readyState === 'open') { opened = true; ls.open.forEach(cb => cb()); }
      };
      dc.onclose = () => channel.close();
    },
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') channel.close();
  };
  return channel;
}

/** Lado del invitado: cada connect() es un intento nuevo, con su id. */
export function createWebRtcConnector(db: RoomDb, code: string): DirectConnector {
  return {
    connect() {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      let off: () => void = () => {};
      const channel = wrap(pc, () => off());
      channel.attach(pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }));
      channel.attach(pc.createDataChannel('rel', { ordered: true }));
      (async () => {
        await pc.setLocalDescription(await pc.createOffer());
        await gathered(pc);
        off = db.onValue(signalOut(code, db.uid), async value => {
          if (value?.id !== id || !value.answer || pc.remoteDescription) return;
          try { await pc.setRemoteDescription(value.answer); } catch { channel.close(); }
        });
        await db.set(signalIn(code, db.uid), { id, offer: plain(pc.localDescription) });
      })().catch(() => channel.close());
      return channel;
    },
  };
}

/** Lado del anfitrión: atiende las ofertas de los invitados presentes en la sala. */
export function createWebRtcListener(db: RoomDb, code: string): DirectListener {
  return {
    listen(cb) {
      const watching = new Map<string, () => void>();
      const answered = new Map<string, string>(); // uid → id del último intento atendido
      const offPresence = db.onValue(roomPaths.presence(code), value => {
        const uids = Object.keys(value ?? {}).filter(uid => uid !== db.uid);
        for (const [uid, off] of watching) if (!uids.includes(uid)) { off(); watching.delete(uid); }
        for (const uid of uids) {
          if (watching.has(uid)) continue;
          watching.set(uid, db.onValue(signalIn(code, uid), async signal => {
            if (!signal?.id || !signal.offer || answered.get(uid) === signal.id) return;
            answered.set(uid, signal.id);
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const channel = wrap(pc, () => {});
            let handed = false;
            channel.onOpen(() => { if (!handed) { handed = true; cb(uid, channel); } });
            pc.ondatachannel = event => channel.attach(event.channel);
            try {
              await pc.setRemoteDescription(signal.offer);
              await pc.setLocalDescription(await pc.createAnswer());
              await gathered(pc);
              await db.set(signalOut(code, uid), { id: signal.id, answer: plain(pc.localDescription) });
            } catch { channel.close(); }
          }));
        }
      });
      return () => { offPresence(); for (const off of watching.values()) off(); watching.clear(); };
    },
  };
}
