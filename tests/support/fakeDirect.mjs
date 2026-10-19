// N5: conexión directa simulada (lo que en la aplicación es WebRTC). Cada invitado se conecta solo al anfitrión
// (estrella). Se puede bloquear (como una red que no deja pasar WebRTC), para todos o para un invitado, cortar, y
// silenciar (se pierden los mensajes de un invitado sin que se cierre el canal). Nada se entrega hasta flush(), y cada
// mensaje cruza por structuredClone.
export function createDirectNet() {
  let blocked = false;
  const blockedUids = new Set();
  const muted = new Set();
  let listener = null;
  const queue = [];
  const live = new Map(); // uid -> { guestEnd, hostEnd }
  const stats = { connects: 0, sent: { toHost: 0, toGuest: 0 }, lost: 0 };
  const isBlocked = uid => blocked || blockedUids.has(uid);

  const end = () => {
    const ls = { message: [], open: [], close: [] };
    const ch = {
      isOpen: false, peer: null,
      send(msg) {
        if (!ch.isOpen) throw new Error('canal cerrado');
        const data = structuredClone(msg);
        stats.sent[ch.toHost ? 'toHost' : 'toGuest']++;
        if (ch.toHost && muted.has(ch.uid)) { stats.lost++; return; }
        queue.push(() => { if (ch.peer?.isOpen) ls.peerMessage(data); });
      },
      onMessage(cb) { ls.message.push(cb); }, onOpen(cb) { ls.open.push(cb); }, onClose(cb) { ls.close.push(cb); },
      close() { closePair(ch); },
      _ls: ls,
    };
    return ch;
  };
  const closePair = ch => {
    for (const c of [ch, ch.peer]) {
      if (!c || !c.isOpen) { if (c) c.closed = true; continue; }
      c.isOpen = false; c.closed = true;
      queue.push(() => c._ls.close.forEach(cb => cb()));
    }
  };

  return {
    stats,
    get blocked() { return blocked; },
    /** Sin uid bloquea a todos; con uid, solo a ese invitado. */
    block(uid) { if (uid) blockedUids.add(uid); else blocked = true; },
    unblock(uid) { if (uid) blockedUids.delete(uid); else { blocked = false; blockedUids.clear(); } },
    /** Se pierden los mensajes de ese invitado al anfitrión hasta unmute(), con el canal abierto. */
    mute(uid) { muted.add(uid); },
    unmute(uid) { muted.delete(uid); },
    /** Corta la conexión directa de un invitado (como si se cayera). */
    drop(uid) { const p = live.get(uid); if (p) { closePair(p.guestEnd); live.delete(uid); } },
    /** Entrega mensajes, aperturas y cierres pendientes. */
    flush() { for (let i = 0; i < 10000 && queue.length; i++) queue.shift()(); },
    /** Lado del anfitrión: recibe cada conexión entrante. */
    listener: { listen(cb) { listener = cb; return () => { if (listener === cb) listener = null; }; } },
    /** Lado de un invitado. */
    connector(uid) {
      return {
        connect() {
          stats.connects++;
          const guestEnd = end(), hostEnd = end();
          guestEnd.toHost = true; guestEnd.uid = uid;
          guestEnd.peer = hostEnd; hostEnd.peer = guestEnd;
          guestEnd._ls.peerMessage = d => hostEnd._ls.message.forEach(cb => cb(d));
          hostEnd._ls.peerMessage = d => guestEnd._ls.message.forEach(cb => cb(d));
          if (!isBlocked(uid)) {
            queue.push(() => {
              if (isBlocked(uid) || guestEnd.closed) return;
              live.get(uid)?.guestEnd.close();
              live.set(uid, { guestEnd, hostEnd });
              guestEnd.isOpen = hostEnd.isOpen = true;
              listener?.(uid, hostEnd);
              hostEnd._ls.open.forEach(cb => cb());
              guestEnd._ls.open.forEach(cb => cb());
            });
          }
          return guestEnd;
        },
      };
    },
  };
}
