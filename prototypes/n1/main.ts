// N1 — prototipo desechable: anfitrión (motor en Worker + WebRTC + respaldo Firebase) e invitado.
// Abrir con `npm run dev` en /F1Sim/prototypes/n1/?rol=anfitrion y /F1Sim/prototypes/n1/?rol=invitado.
const params = new URLSearchParams(location.search);
const role = params.get('rol') === 'invitado' ? 'invitado' : 'anfitrion';
const room = params.get('sala') ?? 'n1';
const ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const bc = new BroadcastChannel('n1-signal-' + room);
const myId = role === 'anfitrion' ? 'host' : 'c' + Math.random().toString(36).slice(2, 8);

const $ = (id: string) => document.getElementById(id)!;
const rows: any[] = [];
(window as any).__n1 = { rows, summary };

function record(row: any) {
  row.vis = document.visibilityState;
  rows.push(row);
  console.log('[N1] ' + JSON.stringify(row));
  try { localStorage.setItem('n1-rows-' + role, JSON.stringify(rows.slice(-2000))); } catch { /* sin almacenamiento */ }
  const tr = document.createElement('tr');
  tr.textContent = '';
  for (const k of COLS[role]) { const td = document.createElement('td'); td.textContent = String(row[k] ?? ''); tr.appendChild(td); }
  const body = $('rows');
  body.insertBefore(tr, body.firstChild);
  while (body.childNodes.length > 40) body.removeChild(body.lastChild!);
  $('summary').textContent = JSON.stringify(summary(), null, 1);
}

const COLS: Record<string, string[]> = {
  anfitrion: ['vis', 'timeScale', 'engineStepsPerSec', 'simSecPerSec', 'updatesPerSec', 'maxGapMs', 'viewsPerSec', 'avgViewBytes', 'forwardedPerSec', 'forwardedKBps', 'mainMaxGapMs', 'fbWritesPerSec', 'fbKBps', 'lap'],
  invitado: ['vis', 'viewsPerSec', 'KBps', 'latMs', 'latMaxMs', 'orderRttMs', 'fbReadsPerSec', 'fbKBps', 'fbLatMs', 'fbLatMaxMs', 'link'],
};
function header() {
  const tr = document.createElement('tr');
  for (const k of COLS[role]) { const th = document.createElement('th'); th.textContent = k; tr.appendChild(th); }
  $('head').appendChild(tr);
}

/** Media de cada columna numérica, separada por pestaña visible / oculta. */
function summary() {
  const out: any = {};
  for (const vis of ['visible', 'hidden']) {
    const rs = rows.filter(r => r.vis === vis);
    if (!rs.length) continue;
    const agg: any = { segundos: rs.length };
    for (const k of COLS[role]) {
      const vals = rs.map(r => r[k]).filter(v => typeof v === 'number');
      if (vals.length) agg[k] = { media: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1), min: Math.min(...vals), max: Math.max(...vals) };
    }
    out[vis] = agg;
  }
  return out;
}

// ── Respaldo por Firebase (opcional: necesita la configuración web del proyecto) ──
const FB_VER = '10.14.1';
let fb: {
  set: (json: string) => void;
  listen: (cb: (json: string) => void) => void;
  write: (path: string, val: unknown) => void;
  on: (path: string, cb: (val: any) => void) => void;
} | null = null;
// Invitado sin enlace directo: todo por el respaldo (simula que WebRTC no conecta).
const onlyFallback = params.get('solo') === 'respaldo';
async function initFirebase() {
  const raw = localStorage.getItem('n1-fb');
  if (!raw) { $('fbstate').textContent = 'sin configuración'; return; }
  try {
    const cfg = JSON.parse(raw);
    const appMod: any = await import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`);
    const authMod: any = await import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`);
    const dbMod: any = await import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database.js`);
    const app = appMod.initializeApp(cfg, 'n1-' + role);
    await authMod.signInAnonymously(authMod.getAuth(app));
    const db = dbMod.getDatabase(app);
    const node = dbMod.ref(db, `n1/${room}/view`);
    const fail = (e: any) => ($('fbstate').textContent = 'error: ' + e.message);
    fb = {
      set: json => { dbMod.set(node, json).catch(fail); },
      listen: cb => dbMod.onValue(node, (snap: any) => { const v = snap.val(); if (typeof v === 'string') cb(v); }),
      write: (path, val) => { dbMod.set(dbMod.ref(db, `n1/${room}/${path}`), val).catch(fail); },
      on: (path, cb) => dbMod.onValue(dbMod.ref(db, `n1/${room}/${path}`), (snap: any) => { const v = snap.val(); if (v != null) cb(v); }),
    };
    $('fbstate').textContent = 'conectado';
  } catch (e: any) {
    $('fbstate').textContent = 'error: ' + e.message;
  }
}
($('fbsave') as HTMLButtonElement).onclick = () => {
  localStorage.setItem('n1-fb', ($('fbcfg') as HTMLTextAreaElement).value.trim());
  location.reload();
};

// ── Anfitrión ──
function runHost() {
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  type Peer = { pc: RTCPeerConnection; view: RTCDataChannel; orders: RTCDataChannel };
  const peers = new Map<string, Peer>();
  let forwarded = 0, forwardedBytes = 0, fbWrites = 0, fbBytes = 0, lastFb = 0, lastMsg = performance.now(), mainMaxGap = 0;
  const fbHz = Number(params.get('fbhz') ?? 2);
  const fbOn = params.get('respaldo') === '1';
  if (fb && fbOn) fb.on('order', o => worker.postMessage({ ...o, type: 'order', from: 'fb' }));

  worker.onmessage = e => {
    const m = e.data;
    const now = performance.now();
    mainMaxGap = Math.max(mainMaxGap, now - lastMsg);
    lastMsg = now;
    if (m.type === 'view') {
      const msg = m.sentAt + '|' + m.json;
      for (const p of peers.values()) {
        if (p.view.readyState === 'open' && p.view.bufferedAmount < 256 * 1024) {
          p.view.send(msg); forwarded++; forwardedBytes += msg.length;
        }
      }
      if (fb && fbOn && now - lastFb >= 1000 / fbHz) { lastFb = now; fb.set(msg); fbWrites++; fbBytes += msg.length; }
    } else if (m.type === 'stats') {
      record({ ...m, forwardedPerSec: forwarded, forwardedKBps: +(forwardedBytes / 1024).toFixed(1), mainMaxGapMs: Math.round(mainMaxGap), fbWritesPerSec: fbWrites, fbKBps: +(fbBytes / 1024).toFixed(2), peers: peers.size });
      forwarded = forwardedBytes = fbWrites = fbBytes = 0; mainMaxGap = 0;
    } else if (m.type === 'started') {
      $('status').textContent = `Motor en marcha: ${m.cars} coches; estado completo de los coches = ${(m.fullCarsBytes / 1024).toFixed(1)} KB en JSON`;
    } else if (m.type === 'orderAck') {
      if (m.from === 'fb') { fb?.write('ack', { ack: m.seq, sentAt: m.sentAt }); return; }
      const p = peers.get(m.from);
      if (p && p.orders.readyState === 'open') p.orders.send(JSON.stringify({ ack: m.seq, sentAt: m.sentAt }));
    }
  };

  bc.onmessage = async e => {
    const m = e.data;
    if (m.to && m.to !== 'host') return;
    if (m.kind === 'hello') {
      peers.get(m.from)?.pc.close();
      const pc = new RTCPeerConnection({ iceServers: ICE });
      const view = pc.createDataChannel('view', { ordered: false, maxRetransmits: 0 });
      const orders = pc.createDataChannel('orders', { ordered: true });
      orders.onmessage = ev => worker.postMessage({ ...JSON.parse(ev.data), type: 'order', from: m.from });
      pc.onicecandidate = ev => ev.candidate && bc.postMessage({ kind: 'ice', from: 'host', to: m.from, c: ev.candidate.toJSON() });
      pc.onconnectionstatechange = () => ($('status').dataset.link = pc.connectionState);
      peers.set(m.from, { pc, view, orders });
      await pc.setLocalDescription(await pc.createOffer());
      bc.postMessage({ kind: 'offer', from: 'host', to: m.from, sdp: pc.localDescription!.toJSON() });
    } else if (m.kind === 'answer') {
      await peers.get(m.from)?.pc.setRemoteDescription(m.sdp);
    } else if (m.kind === 'ice') {
      await peers.get(m.from)?.pc.addIceCandidate(m.c).catch(() => {});
    }
  };

  worker.postMessage({ type: 'start', circuitId: params.get('circuito') ?? 'barcelona', speed: Number(params.get('x') ?? 1), viewHz: Number(params.get('hz') ?? 15) });
}

// ── Invitado ──
function runClient() {
  let pc: RTCPeerConnection | null = null;
  let views = 0, bytes = 0, latSum = 0, latMax = 0, fbReads = 0, fbBytes = 0, fbLatSum = 0, fbLatMax = 0, rtt: number | null = null, seq = 0;
  let orders: RTCDataChannel | null = null;
  const hello = onlyFallback ? 0 : setInterval(() => { if (!pc || pc.connectionState !== 'connected') bc.postMessage({ kind: 'hello', from: myId }); }, 1500);
  if (!onlyFallback) bc.postMessage({ kind: 'hello', from: myId });
  if (onlyFallback) {
    const w = setInterval(() => { if (fb) { clearInterval(w); fb.on('ack', a => { const d = Date.now() - a.sentAt; if (d < 10000) rtt = d; }); } }, 500);
  }

  bc.onmessage = async e => {
    const m = e.data;
    if (m.to !== myId) return;
    if (m.kind === 'offer') {
      pc?.close();
      pc = new RTCPeerConnection({ iceServers: ICE });
      pc.onicecandidate = ev => ev.candidate && bc.postMessage({ kind: 'ice', from: myId, to: 'host', c: ev.candidate.toJSON() });
      pc.ondatachannel = ev => {
        const ch = ev.channel;
        if (ch.label === 'view') ch.onmessage = msg => {
          const s = String(msg.data); const sentAt = Number(s.slice(0, s.indexOf('|')));
          views++; bytes += s.length; const lat = Date.now() - sentAt; latSum += lat; latMax = Math.max(latMax, lat);
        };
        if (ch.label === 'orders') { orders = ch; ch.onmessage = msg => { const a = JSON.parse(msg.data); rtt = Date.now() - a.sentAt; }; }
      };
      await pc.setRemoteDescription(m.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      bc.postMessage({ kind: 'answer', from: myId, to: 'host', sdp: pc.localDescription!.toJSON() });
    } else if (m.kind === 'ice') {
      await pc?.addIceCandidate(m.c).catch(() => {});
    }
  };

  if (params.get('respaldo') === '1') {
    const wait = setInterval(() => { if (fb) { clearInterval(wait); fb.listen(s => { fbReads++; fbBytes += s.length; const l = Date.now() - Number(s.slice(0, s.indexOf('|'))); fbLatSum += l; fbLatMax = Math.max(fbLatMax, l); }); } }, 500);
  }

  let last = performance.now();
  setInterval(() => {
    if (onlyFallback && fb && (seq++ % 2 === 0)) fb.write('order', { seq, sentAt: Date.now(), carId: 1, pace: seq % 4 ? 'push' : 'balanced' });
    else if (orders?.readyState === 'open') orders.send(JSON.stringify({ seq: ++seq, sentAt: Date.now(), carId: 1, pace: seq % 2 ? 'push' : 'balanced' }));
    const now = performance.now(); const span = (now - last) / 1000; last = now;
    record({ at: Date.now(), viewsPerSec: +(views / span).toFixed(1), KBps: +(bytes / 1024 / span).toFixed(1), latMs: views ? Math.round(latSum / views) : null, latMaxMs: latMax, orderRttMs: rtt, fbReadsPerSec: +(fbReads / span).toFixed(1), fbKBps: +(fbBytes / 1024 / span).toFixed(2), fbLatMs: fbReads ? Math.round(fbLatSum / fbReads) : null, fbLatMaxMs: fbLatMax, link: pc?.connectionState ?? 'sin enlace' });
    views = bytes = latSum = latMax = fbReads = fbBytes = fbLatSum = fbLatMax = 0; rtt = null;
  }, 1000);
  void hello;
}

$('role').textContent = role === 'anfitrion' ? 'Anfitrión' : 'Invitado ' + myId;
header();
initFirebase().then(() => (role === 'anfitrion' ? runHost() : runClient()));
