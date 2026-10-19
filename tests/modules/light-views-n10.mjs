// N10 — Foto ligera para los invitados (PROPUESTA DE CONTRATO, 19/10/2026).
// Al medir el consumo para N10 (20 coches, vuelta 55): la foto lenta ocupa 166 KB, 150 de ellos el historial de vueltas
// de todos los coches, y la de equipo 30 KB; por el respaldo, la lenta viajaba dentro de cada foto rápida (2/s). Decisión
// del usuario del 19/10/2026: a los invitados les llega el historial recortado a las últimas 3 vueltas de cada coche
// (en la foto lenta y en la de equipo) y, por el respaldo, la foto lenta se escribe aparte y solo cuando cambia (1/s como
// mucho). La pantalla del anfitrión sigue recibiendo las fotos enteras.
//  1. Recorte: las últimas 3 vueltas de cada coche, iguales a las de la foto entera; lo demás, igual.
//  2. Tamaño: con 20 coches y 55 vueltas, la foto lenta del invitado no pasa de 30 KB ni la de equipo de 12 KB.
//  3. En la carrera compartida: el anfitrión ve el historial entero y el invitado, el recortado.
//  4. Respaldo: la foto lenta va aparte (`state/slow`), como mucho una vez por segundo y nunca dentro de la rápida.
import { raceFactory } from '../support/race.mjs';
import { createFakeServer } from '../support/fakeDb.mjs';
import { createDirectNet } from '../support/fakeDirect.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { EngineHost } = await load('/src/engine/EngineHost.ts');
  const { guestSlowView, guestTeamView, GUEST_LAPS } = await load('/src/engine/RaceView.ts');
  const { LocalLink } = await load('/src/engine/LocalLink.ts');
  const { RaceSession, rosterOf } = await load('/src/engine/RaceSession.ts');
  const { createRaceStore } = await load('/src/state/raceStore.ts');
  const { createLinkStore } = await load('/src/state/linkStore.ts');
  const { createSnapshot } = await load('/src/simulation/Snapshot.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { createRoom, joinRoom, roomPaths } = await load('/src/net/RoomService.ts');
  const { HostTransport, GuestTransport } = await load('/src/net/transport/Transport.ts');
  const shared = await load('/src/net/SharedRace.ts');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const settle = () => new Promise(r => setTimeout(r, 0));
  const kb = v => JSON.stringify(v).length / 1024;
  const CONFIG = { fixedStepSec: 0.02, autoStartTyres: true, seededPreparation: true, autoTeamOrders: true, upgradeTradeoffs: {}, luckVariantEnabled: false };
  /** Historial de vueltas inventado (como el que lleva un coche en la vuelta `n`). */
  const history = n => Array.from({ length: n }, (_, i) => ({ lap: i + 1, lapTime: 80 + i * 0.01, sector1: 26, sector2: 27, sector3: 27, compound: i < 20 ? 'medium' : 'hard',
    position: 1, gapToLeader: 0, tireHealth: 90, fuelKg: 50, energyPercent: 60, flag: 'green', pitStop: false }));

  await test('N10: recorte del historial para los invitados', () => {
    assert(GUEST_LAPS === 3, 'N10: las 3 últimas vueltas', String(GUEST_LAPS));
    const sim = new RaceSimulation('barcelona');
    sim.setSeed(42); sim.setFixedStep(0.02);
    const T = [...new Set(sim.cars.map(c => c.team.id))];
    for (const car of sim.cars) car.lapHistory = history(55);
    const host = new EngineHost(sim, { teams: [T[1]] });
    const slow = host.slowView(), team = host.teamView(T[1]);
    const gs = guestSlowView(slow), gt = guestTeamView(team);
    assert(gs.cars.every(c => c.laps.length === 3) && gs.cars.every((c, i) => JSON.stringify(c.laps) === JSON.stringify(slow.cars[i].laps.slice(-3))),
      'N10: cada coche lleva sus 3 últimas vueltas, iguales a las de la foto entera');
    const strip = v => JSON.stringify({ ...v, cars: v.cars.map(c => ({ ...c, laps: [] })) });
    assert(strip(gs) === strip(slow), 'N10: el resto de la foto lenta no cambia');
    assert(gt.cars.every(c => c.state.lapHistory.length === 3) && gt.cars.every((c, i) => JSON.stringify(c.state.lapHistory) === JSON.stringify(team.cars[i].state.lapHistory.slice(-3))),
      'N10: en la de equipo, igual con el historial de sus coches');
    assert(slow.cars[0].laps.length === 55 && team.cars[0].state.lapHistory.length === 55, 'N10: el recorte no toca la foto entera (la del anfitrión)');
    assert(kb(slow) > 100 && kb(gs) <= 30, 'N10: con 20 coches y 55 vueltas, la foto lenta del invitado no pasa de 30 KB', `${kb(slow).toFixed(1)} KB → ${kb(gs).toFixed(1)} KB`);
    assert(kb(gt) <= 12, 'N10: ni la de equipo de 12 KB', `${kb(team).toFixed(1)} KB → ${kb(gt).toFixed(1)} KB`);
  });

  /** Carrera compartida como en N8: anfitrión con el primer equipo y «Bea» (g1) con el segundo. */
  const race = async ({ blocked = false } = {}) => {
    const sim = make('barcelona', 6);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); c.lapHistory = history(12); });
    sim.setSeed(42); sim.setFixedStep(0.02);
    const T = [...new Set(sim.cars.map(c => c.team.id))];
    const roster = rosterOf(sim);
    const fake = createFakeServer();
    const net = createDirectNet();
    if (blocked) net.block();
    const clock = { t: 0, now() { return this.t; } };
    const hostDb = fake.client('host');
    const { code } = await createRoom(hostDb, { name: 'Ana', random: () => 0.3 });
    const transport = new HostTransport({ db: hostDb, code, direct: net.listener, clock, onOrder: () => ({ ok: false }) });
    await transport.start();
    const link = new LocalLink();
    const hostStore = createRaceStore();
    const host = new shared.SharedRaceHost({ link, transport, store: hostStore, clock });
    const db = fake.client('g1');
    await joinRoom(db, code, { name: 'Bea' });
    transport.addGuest('g1', { teamId: T[1] });
    const linkStore = createLinkStore();
    const gt = new GuestTransport({ db, code, direct: net.connector('g1'), clock, linkStore });
    await gt.start();
    const guestStore = createRaceStore();
    const session = new RaceSession({ link: new shared.RemoteLink(gt), store: guestStore, linkStore });
    const started = host.start({ db: hostDb, code, snapshot: createSnapshot(sim), config: CONFIG, roster, circuitId: 'barcelona', weather: 'seco',
      hostUid: 'host', hostTeamId: T[0], players: [{ uid: 'g1', teamId: T[1] }] });
    link.flush();
    await started;
    await session.start({ snapshot: null, config: CONFIG, roster });
    const step = async (ms = 1000 / 60) => {
      clock.t += ms;
      link.tick(ms / 1000); link.flush();
      transport.tick(); gt.tick();
      net.flush(); await settle(); link.flush(); net.flush(); await settle();
    };
    for (let i = 0; i < 90; i++) await step();
    return { T, fake, code, hostStore, guestStore, gt, step };
  };

  await test('N10: en la carrera compartida, historial entero para el anfitrión y recortado para el invitado', async () => {
    const r = await race();
    const hostSlow = r.hostStore.getState().slow, guestSlow = r.guestStore.getState().slow;
    assert(hostSlow.cars.every(c => c.laps.length >= 12), 'N10: el anfitrión ve el historial entero', String(hostSlow.cars[0].laps.length));
    assert(guestSlow.cars.every(c => c.laps.length <= 3), 'N10: el invitado, las 3 últimas vueltas', String(guestSlow.cars[0].laps.length));
    const team = r.guestStore.getState().teams[r.T[1]];
    assert(team && team.cars.every(c => c.state.lapHistory.length <= 3), 'N10: también en la vista de su equipo');
    assert(JSON.stringify(guestSlow.cars.map(c => c.position)) === JSON.stringify(hostSlow.cars.map(c => c.position)), 'N10: con las mismas posiciones');
  });

  await test('N10: por el respaldo, la foto lenta va aparte', async () => {
    const r = await race({ blocked: true });
    for (let i = 0; i < 400; i++) await r.step();
    assert(r.gt.mode === 'fallback', 'N10: el invitado va por el respaldo', r.gt.mode);
    const statePath = roomPaths.state(r.code), slowPath = `${statePath}/slow`;
    const w0 = r.fake.writes.length;
    const slows0 = r.guestStore.getState().slow;
    for (let i = 0; i < 600; i++) await r.step();
    const writes = r.fake.writes.slice(w0);
    const fastWrites = writes.filter(w => w.path === statePath), slowWrites = writes.filter(w => w.path === slowPath);
    assert(fastWrites.length >= 19 && fastWrites.length <= 21, 'N10: la foto rápida sigue a 2/s', String(fastWrites.length));
    assert(fastWrites.every(w => !JSON.stringify(w.value).includes('"cars"')), 'N10: sin la lenta dentro');
    assert(slowWrites.length >= 5 && slowWrites.length <= 11, 'N10: la lenta, aparte y como mucho una vez por segundo', String(slowWrites.length));
    assert(slowWrites.every(w => (w.value?.view ?? w.value)?.cars?.every(c => c.laps.length <= 3)), 'N10: y recortada');
    const slow = r.guestStore.getState().slow;
    assert(slow && slow !== slows0 && slow.cars.length === 6, 'N10: el invitado la recibe');
  });
}
