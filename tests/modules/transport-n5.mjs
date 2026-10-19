// N5 — Transporte: WebRTC con respaldo por Firebase (PROPUESTA DE CONTRATO, 19/10/2026).
// Una sola interfaz con dos caminos: la conexión directa (WebRTC; aquí, la red simulada de tests/support/fakeDirect.mjs)
// y el respaldo por la base de datos (aquí, la base simulada de N4). El reloj se mueve a mano. Lo que se prueba:
//  1. Máquina de estados del enlace: conectando → directo si abre a tiempo; → respaldo si no abre en 5 s o se cae;
//     reintenta la directa cada 10 s y vuelve a ella; sin directa ni respaldo, caído; y se recupera.
//  2. Numeración de órdenes: cada orden lleva su número; el anfitrión la aplica una sola vez aunque llegue repetida
//     (por los dos caminos o dos veces por el mismo) o desordenada; las que no tienen acuse se reenvían al cambiar de
//     camino.
//  3. Frecuencia de envío: en directo, la vista rápida a 15 por segundo; en respaldo, la foto a 2 por segundo como
//     mucho, y solo si algún invitado está en respaldo; la vista de cada equipo solo a su dueño (en respaldo, en su
//     buzón y a 1 por segundo como mucho).
//  4. Con la directa bloqueada, el invitado recibe fotos y sus órdenes llegan; cada lado sabe en qué modo está el
//     enlace (el invitado lo deja en linkStore); al desbloquear, vuelve a la directa.
//  5. La realización WebRTC usa STUN público y la sala de N4 como buzón de señalización (su prueba real entre dos
//     redes es revisión del usuario en N10).
//  Añadidos tras la revisión del usuario (19/10/2026):
//  6. Un invitado que recarga la página sigue mandando órdenes y se aplican (la numeración nueva no choca con la vieja).
//  7. Una orden perdida en directo, sin que se caiga el canal, llega en menos de 2 s y se aplica una sola vez.
//  8. Modo mixto: un invitado en directo y otro en respaldo; cada uno recibe a su ritmo.
//  9. Un reintento de la directa que falla deja el enlace en respaldo, sin pasar por «conectando»; sin respaldo,
//     el invitado ve el enlace caído y se recupera.
import { readFileSync } from 'node:fs';
import { createFakeServer } from '../support/fakeDb.mjs';
import { createDirectNet } from '../support/fakeDirect.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { LinkMachine, LINK_TIMING } = await load('/src/net/transport/LinkMachine.ts');
  const { OrderOutbox, OrderInbox } = await load('/src/net/transport/orders.ts');
  const { GuestTransport, HostTransport, SEND_RATES } = await load('/src/net/transport/Transport.ts');
  const { createRoom, joinRoom, roomPaths } = await load('/src/net/RoomService.ts');
  const { createLinkStore } = await load('/src/state/linkStore.ts');
  const settle = () => new Promise(r => setTimeout(r, 0));

  await test('N5: máquina de estados del enlace', async () => {
    assert(LINK_TIMING.directTimeoutMs === 5000 && LINK_TIMING.retryDirectMs === 10000, 'N5: 5 s para abrir la directa y reintento cada 10 s', JSON.stringify(LINK_TIMING));
    const m = new LinkMachine();
    const a0 = m.start(0);
    assert(m.mode === 'connecting' && a0.some(a => a.type === 'tryDirect'), 'N5: empieza conectando e intenta la directa');
    m.fallbackUp(100);
    assert(m.mode === 'connecting', 'N5: con el respaldo listo sigue esperando a la directa');
    m.directOpen(1200);
    assert(m.mode === 'direct', 'N5: abre a tiempo → directo');
    m.directClosed(3000);
    assert(m.mode === 'fallback', 'N5: se cae la directa → respaldo al momento');
    assert(!m.tick(12999).some(a => a.type === 'tryDirect') && m.tick(13000).some(a => a.type === 'tryDirect'), 'N5: reintenta la directa a los 10 s');
    assert(m.tick(14000).length === 0 && m.tick(23000).some(a => a.type === 'tryDirect'), 'N5: y sigue reintentando cada 10 s');
    m.directOpen(23500);
    assert(m.mode === 'direct', 'N5: si la directa vuelve, se usa');

    const slow = new LinkMachine();
    slow.start(0); slow.fallbackUp(10);
    assert(slow.tick(4999).length === 0 && slow.mode === 'connecting', 'N5: antes de 5 s sigue conectando');
    const t = slow.tick(5000);
    assert(slow.mode === 'fallback' && t.some(a => a.type === 'closeDirect'), 'N5: sin directa en 5 s → respaldo (y se abandona el intento)', JSON.stringify(t));
    slow.fallbackDown(6000);
    assert(slow.mode === 'down', 'N5: sin directa ni respaldo → caído');
    slow.fallbackUp(7000);
    assert(slow.mode === 'fallback', 'N5: vuelve el respaldo → respaldo');
    slow.directOpen(16000); slow.fallbackDown(16500);
    assert(slow.mode === 'direct', 'N5: en directo, perder el respaldo no cambia nada');
    slow.directClosed(17000);
    assert(slow.mode === 'down', 'N5: sin ninguno de los dos → caído');
    assert(slow.history.map(h => h.mode).join('>') === 'connecting>fallback>down>fallback>direct>down', 'N5: el historial de modos queda registrado', slow.history.map(h => h.mode).join('>'));

    const retry = new LinkMachine();
    retry.start(0); retry.fallbackUp(10); retry.tick(5000);
    const r1 = retry.tick(15000);
    assert(r1.some(a => a.type === 'tryDirect') && retry.mode === 'fallback', 'N5: durante el reintento de la directa sigue en respaldo', retry.mode);
    const r2 = retry.tick(20000);
    assert(retry.mode === 'fallback' && r2.some(a => a.type === 'closeDirect'), 'N5: el reintento que no abre en 5 s se abandona y sigue en respaldo', JSON.stringify(r2));
    assert(retry.tick(25000).some(a => a.type === 'tryDirect'), 'N5: y se vuelve a intentar a los 10 s del anterior');
    assert(retry.history.map(h => h.mode).join('>') === 'connecting>fallback', 'N5: los reintentos no pasan por «conectando»', retry.history.map(h => h.mode).join('>'));

    const none = new LinkMachine();
    none.start(0); none.tick(5000);
    assert(none.mode === 'down', 'N5: sin respaldo y sin directa tras 5 s → caído');
  });

  await test('N5: numeración de órdenes', async () => {
    const out = new OrderOutbox();
    const a = out.next({ kind: 'box' }), b = out.next({ kind: 'pace', pace: 'push' }), c = out.next({ kind: 'box' });
    assert(a.seq === 1 && b.seq === 2 && c.seq === 3, 'N5: números consecutivos desde 1', JSON.stringify([a.seq, b.seq, c.seq]));
    out.ack(2);
    assert(out.pending().map(p => p.seq).join(',') === '1,3', 'N5: el acuse quita la orden de las pendientes');
    out.ack(2); out.ack(99);
    assert(out.pending().length === 2, 'N5: acuses repetidos o desconocidos no rompen nada');
    const inbox = new OrderInbox();
    const got = [3, 1, 1, 2, 3, 2, 5, 4, 5].map(seq => inbox.accept(seq));
    assert(JSON.stringify(got) === JSON.stringify([true, true, false, true, false, false, true, true, false]), 'N5: el anfitrión acepta cada número una sola vez, en cualquier orden', JSON.stringify(got));
    assert(!inbox.accept(0) && !inbox.accept(-1) && !inbox.accept(1.5), 'N5: números no válidos rechazados');
    const big = new OrderInbox();
    for (let i = 1; i <= 5000; i++) big.accept(i);
    assert(big.size() < 64 && !big.accept(10) && big.accept(5001), 'N5: la memoria de números vistos no crece sin límite', String(big.size()));
  });

  /** Sala de N4 con anfitrión e invitados sobre la base simulada y la red directa simulada. */
  const scenario = async (guestIds = ['g1'], { blocked = false } = {}) => {
    const fake = createFakeServer();
    const net = createDirectNet();
    if (blocked === true) net.block();
    else if (Array.isArray(blocked)) for (const uid of blocked) net.block(uid);
    const clock = { t: 0, now() { return this.t; } };
    const hostDb = fake.client('host');
    const { code } = await createRoom(hostDb, { name: 'Ana', random: () => 0.3 });
    const orders = [];
    const host = new HostTransport({
      db: hostDb, code, direct: net.listener, clock,
      onOrder: (uid, order, seq) => { orders.push({ uid, order, seq }); return { ok: true }; },
    });
    await host.start();
    const guests = {};
    /** Crea el transporte de un invitado (también el de la misma sesión tras recargar la página). */
    const makeGuest = (uid, db) => {
      // La conexión con la base se controla a mano (en Firebase, .info/connected).
      let up = true; const conn = new Set();
      const guestDb = { ...db, onConnection(cb) { conn.add(cb); cb(up); return () => conn.delete(cb); } };
      const setConnected = v => { up = v; for (const cb of [...conn]) cb(v); };
      const links = createLinkStore();
      const peers = [];
      links.subscribe(st => peers.push(st.peer));
      const guest = new GuestTransport({ db: guestDb, code, direct: net.connector(uid), clock, linkStore: links });
      const views = [];
      guest.onView(v => views.push(v));
      const acks = [];
      guest.onAck((seq, result) => acks.push({ seq, result }));
      return { db, guest, views, acks, links, peers, setConnected };
    };
    for (const [i, uid] of guestIds.entries()) {
      const db = fake.client(uid);
      await joinRoom(db, code, { name: uid });
      host.addGuest(uid, { teamId: `team${i + 1}` });
      guests[uid] = makeGuest(uid, db);
    }
    const all = () => [host, ...Object.values(guests).map(g => g.guest)];
    const step = async (ms = 0) => {
      clock.t += ms;
      for (const t of all()) t.tick();
      net.flush(); await settle(); net.flush(); await settle();
    };
    for (const g of Object.values(guests)) await g.guest.start();
    await step();
    /** Recarga la página del invitado: el transporte viejo deja de existir sin despedirse; misma sesión (uid). */
    const reload = async uid => {
      const { db } = guests[uid];
      await joinRoom(db, code, { name: uid });
      guests[uid] = makeGuest(uid, db);
      await guests[uid].guest.start();
      await step();
      return guests[uid];
    };
    return { fake, net, clock, code, host, guests, orders, step, hostDb, reload };
  };

  await test('N5: directo y frecuencia de envío', async () => {
    assert(SEND_RATES.direct.fast === 15 && SEND_RATES.fallback.state === 2 && SEND_RATES.fallback.team === 1, 'N5: frecuencias 15/s directo, 2/s y 1/s respaldo', JSON.stringify(SEND_RATES));
    const s = await scenario(['g1', 'g2']);
    const { g1, g2 } = s.guests;
    assert(g1.guest.mode === 'direct' && g2.guest.mode === 'direct' && s.host.modeOf('g1') === 'direct', 'N5: los dos invitados en directo', `${g1.guest.mode} ${g2.guest.mode}`);
    assert(g1.links.getState().peer === 'direct', 'N5: el invitado deja el modo en linkStore', JSON.stringify(g1.links.getState().peer));
    const writes0 = s.fake.writes.filter(w => w.path === roomPaths.state(s.code)).length;
    // 10 s: vista rápida a 60/s, lenta y de equipo a 1/s.
    for (let i = 1; i <= 600; i++) {
      s.host.publish({ fast: [i], ...(i % 60 === 0 ? { slow: { lap: i / 60 }, teams: { team1: { secret: 'g1' }, team2: { secret: 'g2' } } } : {}) });
      await s.step(1000 / 60);
    }
    const count = (views, kind) => views.filter(v => v.kind === kind).length;
    assert(count(g1.views, 'fast') >= 148 && count(g1.views, 'fast') <= 151, 'N5: en directo, vista rápida a 15/s', String(count(g1.views, 'fast')));
    assert(count(g1.views, 'slow') === 10, 'N5: la vista lenta llega entera', String(count(g1.views, 'slow')));
    assert(g1.views.filter(v => v.kind === 'team').every(v => v.data.secret === 'g1') && g2.views.filter(v => v.kind === 'team').every(v => v.data.secret === 'g2')
      && count(g1.views, 'team') === 10, 'N5: cada invitado recibe solo la vista de su equipo');
    assert(s.fake.writes.filter(w => w.path === roomPaths.state(s.code)).length === writes0, 'N5: con todos en directo no se escribe la foto en la base (cuota)');
    assert(g1.views.at(-1)?.kind && g1.views.filter(v => v.kind === 'fast').at(-1).data.at(-1) >= 596, 'N5: la última vista rápida es reciente');
  });

  await test('N5: respaldo con la directa bloqueada', async () => {
    const sc = await scenario(['g1'], { blocked: true });
    const s = { ...sc, ...sc.guests.g1 };
    assert(s.guest.mode === 'connecting', 'N5: con la directa bloqueada, primero conectando');
    await s.step(5000);
    assert(s.guest.mode === 'fallback' && s.links.getState().peer === 'fallback' && s.host.modeOf('g1') === 'fallback',
      'N5: a los 5 s, respaldo (y los dos lados lo saben)', `${s.guest.mode} ${s.host.modeOf('g1')}`);
    const before = s.fake.writes.filter(w => w.path === roomPaths.state(s.code)).length;
    for (let i = 1; i <= 600; i++) {
      s.host.publish({ fast: [i], ...(i % 60 === 0 ? { slow: { lap: i / 60 }, teams: { team1: { secret: 'g1' }, team9: { secret: 'otro' } } } : {}) });
      await s.step(1000 / 60);
    }
    const stateWrites = s.fake.writes.filter(w => w.path === roomPaths.state(s.code)).length - before;
    assert(stateWrites >= 19 && stateWrites <= 21, 'N5: en respaldo, la foto se escribe a 2/s', String(stateWrites));
    const stored = s.fake.read(roomPaths.state(s.code));
    assert(stored && typeof stored === 'object' && Array.isArray(stored.fast), 'N5: la foto del respaldo es un objeto con la vista rápida', JSON.stringify(stored)?.slice(0, 80));
    const fast = s.views.filter(v => v.kind === 'fast');
    assert(fast.length >= 18 && fast.length <= 22 && s.views.some(v => v.kind === 'slow'), 'N5: el invitado recibe las fotos por el respaldo', String(fast.length));
    const teamWrites = s.fake.writes.filter(w => w.path.startsWith(roomPaths.outbox(s.code, 'g1')) && /team/.test(w.path));
    assert(teamWrites.length >= 9 && teamWrites.length <= 11 && s.views.filter(v => v.kind === 'team').every(v => v.data.secret === 'g1'),
      'N5: la vista de su equipo, en su buzón y a 1/s; nunca la de otro', String(teamWrites.length));
    assert(!JSON.stringify(s.fake.read(roomPaths.room(s.code))).includes('otro'), 'N5: la vista de un equipo sin dueño conectado no se escribe en la base');

    const seq = s.guest.sendOrder({ kind: 'box', compound: 'hard' });
    await s.step(100); await s.step(100);
    assert(s.orders.length === 1 && s.orders[0].seq === seq && s.orders[0].order.compound === 'hard' && s.orders[0].uid === 'g1', 'N5: la orden llega por el respaldo', JSON.stringify(s.orders));
    assert(s.acks.some(a => a.seq === seq && a.result?.ok), 'N5: y su acuse vuelve', JSON.stringify(s.acks));
    assert(!s.fake.read(`${roomPaths.inbox(s.code, 'g1')}/orders/${seq}`), 'N5: el anfitrión limpia del buzón las órdenes ya aplicadas');

    // Se desbloquea la red: en el siguiente reintento vuelve a la directa.
    s.net.unblock();
    await s.step(10000);
    assert(s.guest.mode === 'direct' && s.host.modeOf('g1') === 'direct' && s.links.getState().peer === 'direct', 'N5: al desbloquear, vuelve a la directa', s.guest.mode);
    const w0 = s.fake.writes.filter(w => w.path === roomPaths.state(s.code)).length;
    for (let i = 0; i < 120; i++) { s.host.publish({ fast: [i] }); await s.step(1000 / 60); }
    assert(s.fake.writes.filter(w => w.path === roomPaths.state(s.code)).length === w0, 'N5: de vuelta en directo deja de escribir la foto en la base');
  });

  await test('N5: una orden no se aplica dos veces', async () => {
    const s = await scenario(['g1']);
    const { g1 } = s.guests;
    const first = g1.guest.sendOrder({ kind: 'pace', pace: 'push' });
    // La orden sale por la directa, pero se corta antes de que vuelva el acuse.
    s.net.drop('g1');
    await s.step(10); await s.step(10); await s.step(10);
    assert(g1.guest.mode === 'fallback', 'N5: cortada la directa, el invitado pasa al respaldo', g1.guest.mode);
    await s.step(200); await s.step(200);
    assert(s.orders.filter(o => o.seq === first).length === 1, 'N5: la orden reenviada por el respaldo no se aplica otra vez', JSON.stringify(s.orders));
    assert(g1.acks.some(a => a.seq === first), 'N5: el reenvío recibe su acuse y deja de estar pendiente', JSON.stringify(g1.acks));
    // Repetida a propósito por los dos caminos.
    const second = g1.guest.sendOrder({ kind: 'box' });
    // El test duplica la orden escribiéndola también en el buzón del respaldo.
    await g1.db.set(`${roomPaths.inbox(s.code, 'g1')}/orders/${second}`, { kind: 'box' });
    await s.step(200); await s.step(200);
    assert(s.orders.filter(o => o.seq === second).length === 1, 'N5: llegando dos veces, se aplica una', JSON.stringify(s.orders.map(o => o.seq)));
    assert(s.orders.every(o => o.uid === 'g1'), 'N5: cada orden lleva quién la envía');
  });

  await test('N5: el invitado recarga la página', async () => {
    const s = await scenario(['g1']);
    s.guests.g1.guest.sendOrder({ kind: 'pace', pace: 'push' });
    await s.step(100); await s.step(100);
    assert(s.orders.length === 1, 'N5: antes de recargar, la orden se aplica', JSON.stringify(s.orders));
    const g = await s.reload('g1');
    for (let i = 0; i < 10 && g.guest.mode !== 'direct'; i++) await s.step(100);
    assert(g.guest.mode === 'direct' && s.host.modeOf('g1') === 'direct', 'N5: tras recargar vuelve a conectar en directo', `${g.guest.mode} ${s.host.modeOf('g1')}`);
    g.guest.sendOrder({ kind: 'box', compound: 'medium' });
    await s.step(100); await s.step(100);
    assert(s.orders.length === 2 && s.orders[1].order.compound === 'medium' && s.orders[1].uid === 'g1', 'N5: la primera orden tras recargar se aplica', JSON.stringify(s.orders));
    assert(g.acks.length === 1 && g.acks[0].result?.ok, 'N5: y su acuse llega al transporte nuevo', JSON.stringify(g.acks));

    const b = await scenario(['g1'], { blocked: true });
    await b.step(5000);
    b.guests.g1.guest.sendOrder({ kind: 'pace', pace: 'save' });
    await b.step(200); await b.step(200);
    const gb = await b.reload('g1');
    await b.step(5000);
    assert(gb.guest.mode === 'fallback', 'N5: tras recargar con la directa bloqueada, respaldo', gb.guest.mode);
    gb.guest.sendOrder({ kind: 'box', compound: 'soft' });
    await b.step(200); await b.step(200);
    assert(b.orders.length === 2 && b.orders[1].order.compound === 'soft', 'N5: por el respaldo, la orden tras recargar también se aplica', JSON.stringify(b.orders));
  });

  await test('N5: orden perdida en directo', async () => {
    const s = await scenario(['g1']);
    const { g1 } = s.guests;
    s.net.mute('g1');
    const seq = g1.guest.sendOrder({ kind: 'box', compound: 'hard' });
    await s.step(10);
    s.net.unmute('g1');
    assert(s.net.stats.lost > 0 && s.orders.length === 0, 'N5: la orden se ha perdido por el camino', String(s.net.stats.lost));
    for (let t = 0; t < 2000 && !s.orders.length; t += 100) await s.step(100);
    assert(s.orders.length === 1 && s.orders[0].seq === seq, 'N5: la orden perdida llega en menos de 2 s', JSON.stringify(s.orders));
    assert(g1.guest.mode === 'direct', 'N5: sin cambiar de modo (el canal no se ha caído)', g1.guest.mode);
    for (let i = 0; i < 50; i++) await s.step(100);
    assert(s.orders.filter(o => o.seq === seq).length === 1 && g1.acks.some(a => a.seq === seq), 'N5: se aplica una sola vez y queda acusada', JSON.stringify(s.orders));
  });

  await test('N5: modo mixto', async () => {
    const s = await scenario(['g1', 'g2'], { blocked: ['g2'] });
    await s.step(5000);
    const { g1, g2 } = s.guests;
    assert(g1.guest.mode === 'direct' && g2.guest.mode === 'fallback' && s.host.modeOf('g1') === 'direct' && s.host.modeOf('g2') === 'fallback',
      'N5: uno en directo y otro en respaldo', `${g1.guest.mode} ${g2.guest.mode}`);
    const statePath = roomPaths.state(s.code);
    const w0 = s.fake.writes.length;
    const f1 = g1.views.length, f2 = g2.views.length;
    for (let i = 1; i <= 600; i++) {
      s.host.publish({ fast: [i], ...(i % 60 === 0 ? { slow: { lap: i / 60 }, teams: { team1: { secret: 'g1' }, team2: { secret: 'g2' } } } : {}) });
      await s.step(1000 / 60);
    }
    const writes = s.fake.writes.slice(w0);
    const stateWrites = writes.filter(w => w.path === statePath).length;
    assert(stateWrites >= 19 && stateWrites <= 21, 'N5: con un invitado en respaldo, la foto se escribe a 2/s', String(stateWrites));
    const fast1 = g1.views.slice(f1).filter(v => v.kind === 'fast').length, fast2 = g2.views.slice(f2).filter(v => v.kind === 'fast').length;
    assert(fast1 >= 148 && fast1 <= 151, 'N5: el que va en directo sigue recibiendo a 15/s', String(fast1));
    assert(fast2 >= 18 && fast2 <= 22, 'N5: el que va en respaldo, a 2/s', String(fast2));
    assert(!writes.some(w => w.path.startsWith(roomPaths.outbox(s.code, 'g1')) && /team/.test(w.path)), 'N5: la vista del equipo del que va en directo no se escribe en la base');
    const team2 = writes.filter(w => w.path.startsWith(roomPaths.outbox(s.code, 'g2')) && /team/.test(w.path)).length;
    assert(team2 >= 9 && team2 <= 11, 'N5: la del que va en respaldo, en su buzón a 1/s', String(team2));
  });

  await test('N5: reintento fallido y enlace caído', async () => {
    const sc = await scenario(['g1'], { blocked: true });
    const g = sc.guests.g1;
    await sc.step(5000);
    assert(g.guest.mode === 'fallback', 'N5: con la directa bloqueada, respaldo', g.guest.mode);
    const mark = g.peers.length, connects = sc.net.stats.connects;
    const modes = new Set();
    for (let i = 0; i < 25; i++) { await sc.step(1000); modes.add(g.guest.mode); }
    assert(sc.net.stats.connects - connects >= 2, 'N5: en 25 s reintenta la directa al menos dos veces', String(sc.net.stats.connects - connects));
    assert(modes.size === 1 && modes.has('fallback') && !g.peers.slice(mark).some(p => p !== 'fallback'),
      'N5: los reintentos fallidos no sacan el enlace del respaldo', JSON.stringify([...modes, ...g.peers.slice(mark)]));
    g.setConnected(false);
    await sc.step(100);
    assert(g.guest.mode === 'down' && g.links.getState().peer === 'down', 'N5: sin directa ni respaldo, el invitado ve el enlace caído', `${g.guest.mode} ${g.links.getState().peer}`);
    g.setConnected(true);
    await sc.step(100);
    assert(g.guest.mode === 'fallback' && g.links.getState().peer === 'fallback', 'N5: al volver la base, vuelve al respaldo', g.guest.mode);
  });

  await test('N5: realización WebRTC', async () => {
    const src = readFileSync('src/net/transport/webrtc.ts', 'utf8');
    assert(/RTCPeerConnection/.test(src) && /stun:stun\.l\.google\.com:19302/.test(src), 'N5: WebRTC con STUN público');
    assert(/createDataChannel/.test(src) && /ordered:\s*false/.test(src) && /maxRetransmits:\s*0/.test(src),
      'N5: un canal sin reenvíos para la vista rápida (si se pierde una, vale la siguiente)');
    assert(/inbox/.test(src) && /outbox/.test(src) && /signal/.test(src), 'N5: la señalización va por los buzones de la sala (N4)');
    assert(/export function createWebRtcConnector/.test(src) && /export function createWebRtcListener/.test(src), 'N5: lado del invitado y lado del anfitrión');
    const t = readFileSync('src/net/transport/Transport.ts', 'utf8');
    assert(!/RTCPeerConnection|firebase\//.test(t), 'N5: el transporte no depende de WebRTC ni de Firebase directamente (se prueban con simulados)');
  });
}
