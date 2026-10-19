// N6 — Equipos con dueño (PROPUESTA DE CONTRATO, 19/10/2026).
// El motor pasa de «los coches del jugador» a un dueño por equipo. En una partida compartida EngineHost sabe qué
// sesión (uid de la cuenta anónima, que sobrevive a recargar la página) dirige qué equipo, y cada orden llega con quién
// la manda: handle(mensaje, uid); sin uid es el propio anfitrión. Decisiones del usuario del 19/10/2026 (tarea 7):
//  1. Diez jugadores (uno por equipo, el anfitrión incluido) y diez espectadores; quien tiene el código entra sin que
//     el anfitrión lo acepte; con invitados la velocidad no pasa de x4.
//  2. Un jugador solo manda sobre su equipo (boxes, ritmo, propuestas, delegar, órdenes de equipo y su tirada de
//     suerte); lo general (pausa, velocidad, salida, resultado, pruebas) es solo del anfitrión; un espectador no manda
//     nada. Toda orden rechazada no cambia nada y queda registrada.
//  3. Si un jugador se cae, su equipo pasa al estratega (delegado) y lo recupera al volver con la misma sesión, con la
//     delegación que tenía cada coche; el equipo queda reservado mientras tanto. Si se va, el equipo vuelve a la IA.
//  4. Se puede entrar a mitad de carrera como espectador o tomando un equipo que lleve la IA.
//  5. Cada jugador recibe en su foto solo el muro, las propuestas, los avisos y la tirada de suerte de su equipo; la
//     foto común no lleva avisos ni tiradas. La tirada la ve y la reclama solo el dueño del coche afortunado.
//  6. La carrera de un solo jugador es idéntica a la de hoy.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { EngineHost, MULTIPLAYER_LIMITS } = await server.ssrLoadModule('/src/engine/EngineHost.ts');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const cross = m => structuredClone(m);

  const seededRace = (cars = 20) => {
    const sim = make('barcelona', cars);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(42); sim.setFixedStep(0.02);
    return sim;
  };
  const teamsOf = sim => [...new Set(sim.cars.map(c => c.team.id))];
  const carsOf = (sim, teamId) => sim.cars.filter(c => c.team.id === teamId);
  /** Partida compartida: el anfitrión lleva el primer equipo. */
  const shared = () => {
    const sim = seededRace();
    const T = teamsOf(sim);
    const host = new EngineHost(sim, { shared: { hostUid: 'host', hostTeamId: T[0] } });
    return { sim, T, host };
  };
  const order = (host, o, uid) => host.handle(cross({ type: 'order', seq: 1, order: o }), uid).map(cross)[0];
  const advance = (host, steps) => { const out = []; const end = host.sim.fixedStepCount + steps; while (host.sim.fixedStepCount < end) out.push(...host.advance(1 / 60).map(cross)); return out; };
  const fingerprint = sim => JSON.stringify(sim.cars.map(c => [c.id, c.progress, c.currentPosition, c.tires, c.lapHistory.map(l => l.lapTime)]));

  await test('N6: valores por defecto', () => {
    assert(MULTIPLAYER_LIMITS?.players === 10 && MULTIPLAYER_LIMITS.spectators === 10 && MULTIPLAYER_LIMITS.guestSpeedCap === 4,
      'N6: diez jugadores, diez espectadores y x4 con invitados', JSON.stringify(MULTIPLAYER_LIMITS));
  });

  await test('N6: cada equipo tiene un dueño', () => {
    const { sim, T, host } = shared();
    assert(T.length === 10, 'N6: la parrilla de prueba tiene diez equipos', String(T.length));
    assert(host.ownerOf(T[0]) === 'host' && host.teamOf('host') === T[0] && host.roleOf('host') === 'player', 'N6: el anfitrión dirige su equipo');
    const a = host.join('g1', { teamId: T[1] });
    assert(a.ok && host.ownerOf(T[1]) === 'g1' && host.teamOf('g1') === T[1], 'N6: un invitado toma un equipo libre sin que el anfitrión lo acepte', JSON.stringify(a));
    assert(carsOf(sim, T[0]).concat(carsOf(sim, T[1])).every(c => sim.isPlayerCar(c.driver.id)) && carsOf(sim, T[2]).every(c => !sim.isPlayerCar(c.driver.id)),
      'N6: el motor trata como de jugador los coches de los equipos con dueño, y el resto los lleva la IA');
    const taken = host.join('g2', { teamId: T[1] });
    assert(!taken.ok && taken.reason === 'equipo-ocupado' && host.ownerOf(T[1]) === 'g1', 'N6: dos jugadores no pueden tener el mismo equipo', JSON.stringify(taken));
    assert(host.join('g2', { teamId: T[0] }).reason === 'equipo-ocupado', 'N6: tampoco el del anfitrión');
    assert(host.join('g2', { teamId: 'no-existe' }).reason === 'equipo-desconocido', 'N6: un equipo que no corre se rechaza');
    assert(host.join('g1', { teamId: T[2] }).reason === 'ya-dentro' && host.teamOf('g1') === T[1], 'N6: quien ya tiene equipo no toma otro');
    for (let i = 2; i < 10; i++) assert(host.join(`p${i}`, { teamId: T[i] }).ok, `N6: jugador ${i + 1} de 10`);
    const eleventh = host.join('p11', { teamId: T[3] });
    assert(!eleventh.ok && host.roleOf('p11') === null, 'N6: no caben más de diez jugadores', JSON.stringify(eleventh));
    for (let i = 1; i <= 10; i++) assert(host.join(`s${i}`, { spectator: true }).ok && host.roleOf(`s${i}`) === 'spectator', `N6: espectador ${i} de 10`);
    const full = host.join('s11', { spectator: true });
    assert(!full.ok && full.reason === 'sala-llena', 'N6: no caben más de diez espectadores', JSON.stringify(full));
  });

  await test('N6: una orden sobre un equipo ajeno no cambia nada', () => {
    const { sim, T, host } = shared();
    host.join('g1', { teamId: T[1] });
    host.join('s1', { spectator: true });
    advance(host, 300);
    const [own] = carsOf(sim, T[1]), [hostCar] = carsOf(sim, T[0]), [aiCar] = carsOf(sim, T[2]);
    const before = JSON.stringify([hostCar.pitStop.activeBoxOrder, hostCar.paceMode, hostCar.wallDelegated, aiCar.pitStop.activeBoxOrder, sim.getTeamOrder(T[0])]);
    const r1 = order(host, { kind: 'box', carId: hostCar.id, compound: 'hard' }, 'g1');
    const r2 = order(host, { kind: 'pace', carId: aiCar.id, mode: 'push' }, 'g1');
    const r3 = order(host, { kind: 'delegate', carId: hostCar.id, delegated: true }, 'g1');
    const r4 = order(host, { kind: 'teamOrder', teamId: T[0], mode: 'mantener' }, 'g1');
    assert([r1, r2, r3, r4].every(r => r?.type === 'ack' && r.ok === false && r.code === 'equipo-ajeno'), 'N6: boxes, ritmo, delegar y orden de equipo sobre otro equipo, rechazados', JSON.stringify([r1, r2, r3, r4]));
    const after = JSON.stringify([hostCar.pitStop.activeBoxOrder, hostCar.paceMode, hostCar.wallDelegated, aiCar.pitStop.activeBoxOrder, sim.getTeamOrder(T[0])]);
    assert(after === before, 'N6: y no cambian nada', `${before} → ${after}`);
    const log = host.rejections.filter(r => r.uid === 'g1');
    assert(log.length === 4 && log.every(r => r.code === 'equipo-ajeno') && log.map(r => r.kind).join(',') === 'box,pace,delegate,teamOrder', 'N6: cada rechazo queda registrado con quién y qué', JSON.stringify(log));

    const okBox = order(host, { kind: 'box', carId: own.id, compound: 'hard' }, 'g1');
    const okTeam = order(host, { kind: 'teamOrder', teamId: T[1], mode: 'mantener' }, 'g1');
    assert(okBox.ok && own.pitStop.activeBoxOrder && okTeam.ok, 'N6: sobre su propio equipo, sí', JSON.stringify([okBox, okTeam]));
    const fromHost = order(host, { kind: 'pace', carId: own.id, mode: 'save' });
    assert(!fromHost.ok && fromHost.code === 'equipo-ajeno' && own.paceMode !== 'save', 'N6: el anfitrión tampoco manda sobre el equipo de un invitado', JSON.stringify(fromHost));
    assert(order(host, { kind: 'pace', carId: hostCar.id, mode: 'save' }).ok, 'N6: sobre el suyo, sí');

    const speed = sim.speedMultiplier, paused = sim.isPaused;
    const general = [{ kind: 'speed', value: 2 }, { kind: 'pause', paused: true }, { kind: 'startSequence' }, { kind: 'confirmResult' },
      { kind: 'endSuspended' }, { kind: 'luckVariant', enabled: true }, { kind: 'weatherTest', index: 0 }, { kind: 'devSafetyCar' }, { kind: 'dnfClear' }];
    const gen = general.map(o => order(host, o, 'g1'));
    assert(gen.every(r => r.ok === false && r.code === 'solo-anfitrion'), 'N6: lo general es solo del anfitrión', JSON.stringify(gen.map(r => r.code)));
    assert(sim.speedMultiplier === speed && sim.isPaused === paused && !sim.safetyCar.isDeployed, 'N6: y el invitado no cambia nada de eso');
    assert(order(host, { kind: 'pause', paused: true }).ok && sim.isPaused, 'N6: el anfitrión sí pausa');
    const spec = order(host, { kind: 'box', carId: aiCar.id, compound: 'soft' }, 's1');
    assert(!spec.ok && spec.code === 'espectador', 'N6: un espectador no manda nada', JSON.stringify(spec));
    const stranger = order(host, { kind: 'box', carId: own.id, compound: 'soft' }, 'x9');
    assert(!stranger.ok && stranger.code === 'fuera-de-sala', 'N6: quien no está en la partida tampoco', JSON.stringify(stranger));
  });

  await test('N6: velocidad x4 con invitados', () => {
    const { sim, T, host } = shared();
    assert(order(host, { kind: 'speed', value: 8 }).ok && sim.speedMultiplier === 8, 'N6: solo, el anfitrión puede ir a x8');
    host.join('s1', { spectator: true });
    assert(sim.speedMultiplier === 4, 'N6: al entrar un invitado, la carrera baja a x4', String(sim.speedMultiplier));
    const fast = order(host, { kind: 'speed', value: 8 });
    assert(fast.ok && sim.speedMultiplier === 4, 'N6: con invitados no pasa de x4', String(sim.speedMultiplier));
    assert(order(host, { kind: 'speed', value: 2 }).ok && sim.speedMultiplier === 2, 'N6: por debajo, la que pida');
    host.leave('s1');
    assert(order(host, { kind: 'speed', value: 8 }).ok && sim.speedMultiplier === 8, 'N6: sin invitados, vuelve a poder ir a x8');
    host.join('g1', { teamId: T[1] });
    assert(sim.speedMultiplier === 4, 'N6: un jugador invitado también la limita');
  });

  await test('N6: caída y vuelta de un jugador', () => {
    const { sim, T, host } = shared();
    host.join('g1', { teamId: T[1] });
    const [a, b] = carsOf(sim, T[1]);
    order(host, { kind: 'delegate', carId: b.id, delegated: true }, 'g1');
    advance(host, 300);
    assert(!a.wallDelegated && b.wallDelegated, 'N6: antes de caerse, un coche delegado y otro no');
    host.dropped('g1');
    assert(a.wallDelegated && b.wallDelegated, 'N6: al caerse, su equipo pasa al estratega');
    assert(host.ownerOf(T[1]) === 'g1' && host.join('g2', { teamId: T[1] }).reason === 'equipo-ocupado', 'N6: el equipo queda reservado mientras vuelve');
    const t0 = sim.raceTimeSec;
    advance(host, 600);
    assert(sim.raceTimeSec > t0, 'N6: la carrera sigue sin él');
    assert(!host.returned('x9').ok, 'N6: otra sesión no recupera un equipo ajeno');
    const back = host.returned('g1');
    assert(back.ok && host.teamOf('g1') === T[1] && !a.wallDelegated && b.wallDelegated, 'N6: al volver con la misma sesión recupera el equipo y la delegación de cada coche', JSON.stringify(back));
    assert(order(host, { kind: 'pace', carId: a.id, mode: 'push' }, 'g1').ok, 'N6: y vuelve a mandar');
    host.leave('g1');
    assert(host.ownerOf(T[1]) === null && carsOf(sim, T[1]).every(c => !sim.isPlayerCar(c.driver.id)), 'N6: si se va, el equipo vuelve a la IA');
    assert(host.join('g2', { teamId: T[1] }).ok, 'N6: y otro lo puede tomar');
  });

  await test('N6: entrar a mitad de carrera', () => {
    const { sim, T, host } = shared();
    advance(host, 900);
    const t0 = sim.raceTimeSec, progress = sim.cars.map(c => c.progress);
    const spec = host.join('s1', { spectator: true });
    const player = host.join('g5', { teamId: T[5] });
    assert(spec.ok && player.ok, 'N6: a mitad de carrera se entra como espectador o tomando un equipo de la IA', JSON.stringify([spec, player]));
    assert(sim.raceTimeSec === t0 && sim.cars.every((c, i) => c.progress === progress[i]), 'N6: entrar no mueve la carrera');
    assert(carsOf(sim, T[5]).every(c => sim.isPlayerCar(c.driver.id)), 'N6: el equipo tomado deja de llevarlo la IA');
    const out = advance(host, 120);
    const teams = new Set(out.filter(m => m.type === 'team').map(m => m.teamId));
    assert(teams.has(T[0]) && teams.has(T[5]) && teams.size === 2, 'N6: hay vista de equipo para cada equipo con dueño y para ninguno más', JSON.stringify([...teams]));
    assert(order(host, { kind: 'box', carId: carsOf(sim, T[5])[0].id, compound: 'hard' }, 'g5').ok, 'N6: y el que entra ya manda sobre su equipo');
  });

  await test('N6: la foto de un jugador no trae datos de otro equipo', () => {
    const { sim, T, host } = shared();
    host.join('g1', { teamId: T[1] });
    advance(host, 300);
    sim.teamOrderNotices.push({ teamId: T[0], text: 'aviso-del-anfitrion' }, { teamId: T[1], text: 'aviso-del-invitado' }, { teamId: T[2], text: 'aviso-de-la-ia' });
    const out = advance(host, 2);
    const slow = out.filter(m => m.type === 'slow');
    const team = id => out.filter(m => m.type === 'team' && m.teamId === id).map(m => m.view);
    assert(slow.length > 0 && slow.every(m => m.view.notices.length === 0 && m.view.luck === null), 'N6: la foto común no lleva avisos ni tiradas', JSON.stringify(slow.map(m => m.view.notices)));
    const mine = team(T[1]), hosts = team(T[0]);
    assert(mine.length > 0 && JSON.stringify(mine.map(v => v.notices)) === JSON.stringify([['aviso-del-invitado']]), 'N6: el aviso de un equipo va solo en la foto de ese equipo', JSON.stringify(mine.map(v => v.notices)));
    assert(JSON.stringify(hosts.map(v => v.notices)) === JSON.stringify([['aviso-del-anfitrion']]), 'N6: y el del anfitrión, en la suya');
    assert(!JSON.stringify(out).includes('aviso-de-la-ia'), 'N6: el de un equipo de la IA no va a nadie');
    assert(mine.every(v => v.cars.every(c => c.id === carsOf(sim, T[1])[0].id || c.id === carsOf(sim, T[1])[1].id)), 'N6: el muro y las propuestas de la foto de un equipo son solo de sus coches');

    // Tirada de suerte: la ve y la reclama solo el dueño del coche afortunado.
    sim.luckVariantEnabled = true;
    const event = sim.triggerD20LuckRoll('sc');
    assert(event, 'N6: se provoca una tirada de suerte');
    const lucky = sim.getCarById(event.luckyCarId).team.id;
    let owner, other, otherTeam;
    if (lucky === T[0]) { owner = undefined; other = 'g1'; otherTeam = T[1]; }
    else { if (lucky !== T[1]) { host.leave('g1'); host.join('g1', { teamId: lucky }); } owner = 'g1'; other = undefined; otherTeam = T[0]; }
    const later = advance(host, 70);
    const lastTeam = id => later.filter(m => m.type === 'team' && m.teamId === id).at(-1)?.view;
    assert(later.filter(m => m.type === 'slow').every(m => m.view.luck === null), 'N6: la tirada no va en la foto común');
    assert(lastTeam(lucky)?.luck?.id === event.id && lastTeam(otherTeam)?.luck === null, 'N6: va en la foto del equipo afortunado y en ninguna otra', JSON.stringify([lastTeam(lucky)?.luck?.id, lastTeam(otherTeam)?.luck]));
    const theirs = order(host, { kind: 'luckReward', eventId: event.id }, other);
    assert(!theirs.ok && theirs.code === 'equipo-ajeno' && !sim.activeLuckEvent.applied, 'N6: otro jugador no puede reclamarla', JSON.stringify(theirs));
    assert(order(host, { kind: 'luckReward', eventId: event.id }, owner).ok && sim.activeLuckEvent.applied, 'N6: su dueño sí');
  });

  await test('N6: la carrera de un solo jugador es idéntica a la de hoy', () => {
    const single = new EngineHost(seededRace());
    const T = teamsOf(single.sim);
    single.sim.setPlayerCars(carsOf(single.sim, T[0]).map(c => c.driver.id));
    const one = new EngineHost(seededRace(), { shared: { hostUid: 'host', hostTeamId: T[0] } });
    for (const h of [single, one]) {
      advance(h, 800); order(h, { kind: 'pace', carId: carsOf(h.sim, T[0])[0].id, mode: 'push' });
      advance(h, 800); order(h, { kind: 'box', carId: carsOf(h.sim, T[0])[1].id, compound: 'hard' });
      advance(h, 1400);
    }
    assert(fingerprint(single.sim) === fingerprint(one.sim), 'N6: una partida compartida sin invitados corre igual que la de un jugador');
    const ai = carsOf(single.sim, T[3])[0];
    const r = order(single, { kind: 'box', carId: ai.id, compound: 'hard' });
    assert(r.ok && single.rejections.length === 0, 'N6: en la partida de un jugador no hay dueños: las órdenes se aceptan como hoy', JSON.stringify(r));
    single.sim.teamOrderNotices.push({ teamId: T[0], text: 'aviso' });
    const out = advance(single, 2);
    assert(out.some(m => m.type === 'slow' && m.view.notices.includes('aviso')), 'N6: y la foto común sigue llevando los avisos como hoy');
  });
}
