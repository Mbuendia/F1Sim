// R50 — Zonas de adelantamiento por circuito (contrato aprobado por el usuario el 07/10/2026).
//  1. Zonas derivadas del trazado: recta a fondo + frenada hasta el vértice, con calidad según longitud, frenada, DRS
//     y anchura; si la curva solo admite un coche, pasada la estrechez solo sigue quien ya iba en paralelo.
//  2. Remontadas por circuito con ventaja de ritmo controlada: Mónaco muy difícil, Monza y Bahréin fáciles; todo
//     adelantamiento ocurre dentro de una zona.
//  3. Defensa básica: el coche atacado cubre una vez el interior; el atacante va por fuera y necesita más ventaja.
//  4. Banco R27 con la métrica por circuito y por zona (en tests/modules/bench.mjs).
// Decisiones del usuario: en Mónaco un coche un 5 % más rápido pasa con dificultad (como mucho una oportunidad por
// vuelta) y con un 3 % no pasa; defenderse exige al atacante un 30 % más de ventaja; si ya está en paralelo no se le
// puede cerrar. Todos los umbrales son calibración del juego.
// Cambios autorizados por el usuario durante la implementación (07/10/2026): (a) en las curvas donde solo cabe un coche
// la zona llega al vértice, pero la maniobra solo se lanza antes de la estrechez y después solo continúa quien ya iba
// en paralelo (con «la zona acaba al estrecharse», en Mónaco hacía falta un 6 % y con un 5 % no se pasaba); (b) con
// el trazado del juego Singapur empata con Mónaco, así que se comprueba que Mónaco está entre los dos más difíciles.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const zonesMod = await server.ssrLoadModule('/src/simulation/OvertakingZones.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const make = await raceFactory(server);
  const { computeOvertakingZones, overtakingIndex, ZONES } = zonesMod;
  const inZone = (z, t) => (z.startT <= z.endT ? t >= z.startT && t <= z.endT : t >= z.startT || t <= z.endT);

  // ── 1. Zonas por circuito ──
  await test('R50: cada circuito tiene sus zonas, derivadas del trazado', () => {
    const index = {};
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const sim = new RaceSimulation(id);
      const zones = sim.overtakingZones, pts = sim.activeTrack.points, n = pts.length;
      index[id] = overtakingIndex(zones);
      assert(zones.length >= 1 && zones.every((z, i) => z.id === i + 1), `R50: ${id} tiene al menos una zona, numeradas en orden`, String(zones.length));
      const at = t => pts[Math.floor((((t % 1) + 1) % 1) * n) % n];
      const span = (from, to) => { const list = []; for (let t = from, guard = 0; guard < n && inZone({ startT: from, endT: to }, t); t = (t + 1 / n) % 1, guard++) list.push(at(t + 1e-9)); return list; };
      for (const z of zones) {
        const label = `${id} zona ${z.id}`;
        const straight = span(z.startT, z.brakeT).slice(0, -1);
        assert(straight.length > 0 && straight.every(p => p.speedLimitFactor >= ZONES.FLAT_OUT && p.trackWidthCars >= 2), `R50: ${label} empieza en una recta a fondo con sitio para dos coches`);
        assert(z.straightM >= (z.drs ? ZONES.MIN_DRS_STRAIGHT_M : ZONES.MIN_STRAIGHT_M) && Math.abs(z.straightM - straight.length * sim.activeTrack.lapLengthMeters / n) <= 2 * sim.activeTrack.lapLengthMeters / n,
          `R50: ${label} tiene la recta mínima y su longitud es la del trazado`, `${z.straightM} m`);
        assert(z.widthCars >= 2 && z.quality >= 0 && z.quality <= 1 && z.difficulty >= 1 && (z.insideSign === 1 || z.insideSign === -1), `R50: ${label} con anchura, calidad, dificultad e interior válidos`);
        assert(z.drs === straight.some(p => p.isDrsZone), `R50: ${label} sabe si su recta tiene DRS`);
        const launch = span(z.brakeT, z.launchEndT);
        assert(launch.every(p => p.trackWidthCars >= 2), `R50: ${label} solo deja lanzar la maniobra donde caben dos coches`);
        assert(at(z.endT + 1e-9).speedLimitFactor < ZONES.FLAT_OUT && inZone({ startT: z.brakeT, endT: z.endT }, z.launchEndT), `R50: ${label} llega al vértice de la curva`);
        if (z.cornerWide) assert(z.launchEndT === z.endT, `R50: ${label} deja lanzar la maniobra hasta el vértice`);
        else assert((at(z.launchEndT + 1.5 / n).trackWidthCars < 2 || at(z.launchEndT + 2.5 / n).trackWidthCars < 2) && z.launchEndT !== z.endT,
          `R50: ${label} deja de admitir maniobras nuevas donde la pista se estrecha, antes del vértice`);
        assert(sim.overtakingZoneAt((z.startT + (z.brakeT >= z.startT ? z.brakeT : z.brakeT + 1)) / 2 % 1)?.id === z.id, `R50: ${label} se encuentra por posición`);
      }
      let overlaps = 0, mismatches = 0;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, inside = zones.filter(z => inZone(z, t)).length;
        if (inside > 1) overlaps++;
        if (sim.isOvertakingAllowedZone(t) !== (inside > 0)) mismatches++;
      }
      assert(overlaps === 0, `R50: ${id} sin zonas solapadas`, String(overlaps));
      assert(mismatches === 0, `R50: ${id} — se puede adelantar exactamente dentro de sus zonas`, String(mismatches));
    }
    const ranking = Object.entries(index).sort((a, b) => a[1] - b[1]);
    assert(ranking.slice(0, 2).some(([id]) => id === 'monaco') && index.monaco < 0.3, 'R50: Mónaco está entre los dos circuitos más difíciles para adelantar', ranking.slice(0, 4).map(([id, v]) => `${id} ${v.toFixed(2)}`).join(' · '));
    const zonesOf = id => new RaceSimulation(id).overtakingZones;
    assert(zonesOf('monaco').every(z => z.quality < 0.3 && !z.cornerWide), 'R50: en Mónaco todas las zonas son malas y sus curvas solo admiten un coche', zonesOf('monaco').map(z => z.quality.toFixed(2)).join());
    for (const id of ['monza', 'bahrain']) {
      const good = zonesOf(id).filter(z => z.quality >= 0.5).length;
      assert(good >= 2 && index[id] > 10 * index.monaco, `R50: ${id} tiene al menos dos zonas buenas`, `${good} buenas · índice ${index[id].toFixed(2)}`);
    }
  });

  await test('R50: más recta, más frenada, DRS y más anchura dan mejor zona', () => {
    // Trazado sintético de 4000 m (5 m por punto): curvas medias, una recta y su frenada hasta el vértice.
    const fake = ({ straightM = 500, apex = 0.3, cars = 3, drs = false, cornerCars = 2, inside = 1 } = {}) => {
      const n = 800, points = Array.from({ length: n }, () => ({ speedLimitFactor: 0.6, trackWidthCars: cornerCars, isDrsZone: false, idealLineOffset: 0.2, isBrakingZone: false }));
      const from = 100, straight = Math.round(straightM / 5), braking = 24;
      for (let i = 0; i < straight; i++) Object.assign(points[from + i], { speedLimitFactor: 1, trackWidthCars: cars, isDrsZone: drs, idealLineOffset: 0 });
      for (let i = 0; i < braking; i++) Object.assign(points[from + straight + i], { speedLimitFactor: 0.85 - (0.85 - apex) * (i + 1) / braking, isBrakingZone: true, idealLineOffset: inside * 0.7 * (i + 1) / braking });
      return { points, lapLengthMeters: 4000, from, straight, braking, n };
    };
    const only = options => { const zones = computeOvertakingZones(fake(options)); return zones.length === 1 ? zones[0] : null; };
    const base = only();
    assert(base && base.straightM === 500 && base.widthCars === 3 && base.cornerWide && !base.drs && base.insideSign === 1, 'R50: la zona sintética se calcula con su recta, anchura e interior', JSON.stringify(base));
    const track = fake();
    const apexT = (track.from + track.straight + track.braking - 1) / track.n;
    assert(Math.abs(base.startT - track.from / track.n) < 1e-9 && Math.abs(base.brakeT - (track.from + track.straight) / track.n) < 1e-9
      && Math.abs(base.endT - apexT) < 1e-9 && base.launchEndT === base.endT, 'R50: empieza en la recta, frena al acabar y termina en el vértice', `${base.startT} · ${base.brakeT} · ${base.endT}`);
    assert(only({ straightM: 300 }).quality < base.quality && base.quality < only({ straightM: 900 }).quality, 'R50: más recta, mejor zona');
    assert(only({ apex: 0.75 }).quality < base.quality && only({ apex: 0.75 }).brakingDropKmh < base.brakingDropKmh, 'R50: más frenada, mejor zona');
    assert(only({ drs: true }).quality > base.quality && only({ drs: true }).drs, 'R50: con DRS, mejor zona');
    assert(only({ cars: 2 }).quality < base.quality && only({ cars: 2 }).widthCars === 2, 'R50: con sitio para dos coches en vez de tres, peor zona');
    assert(computeOvertakingZones(fake({ cars: 1, cornerCars: 1 })).length === 0, 'R50: donde solo cabe un coche no hay zona');
    assert(computeOvertakingZones(fake({ straightM: 150 })).length === 0 && only({ straightM: 150, drs: true }) !== null, 'R50: una recta corta solo es zona si tiene DRS');
    const narrow = only({ cornerCars: 1 });
    assert(narrow && !narrow.cornerWide && Math.abs(narrow.launchEndT - narrow.brakeT) <= 1.5 / track.n && Math.abs(narrow.endT - apexT) < 1e-9 && narrow.quality < base.quality,
      'R50: si la curva solo admite un coche, la maniobra solo se lanza hasta la frenada, la zona llega al vértice y vale menos', JSON.stringify(narrow));
    assert(only({ inside: -1 }).insideSign === -1, 'R50: el interior es el lado del vértice');
    const best = only({ straightM: 1400, drs: true }), worst = only({ straightM: 220, apex: 0.8, cars: 2 });
    assert(best.quality === 1 && best.difficulty === 1 && worst.difficulty > 2 && worst.difficulty <= ZONES.MAX_DIFFICULTY, 'R50: la mejor zona no añade dificultad y la peor multiplica la ventaja necesaria, con tope',
      `${best.difficulty} · ${worst.difficulty.toFixed(2)}`);
    assert(only({ straightM: 300 }).difficulty > base.difficulty && base.difficulty > only({ straightM: 900 }).difficulty, 'R50: cuanto peor la zona, más ventaja hace falta');
  });

  // ── 2. Remontadas por circuito ──
  const clone = (car, model) => { car.team = structuredClone(model.team); car.driver = structuredClone(model.driver); car.technical = structuredClone(model.technical); car.pitStop.playerControlled = true; };
  /** Fila de coches idénticos separados 40 m; el último con ventaja de ritmo. Devuelve la carrera y sus dos extremos. */
  const train = (circuit, size, advantage, t0 = 0.3) => {
    const sim = make(circuit, size), L = sim.activeTrack.lapLengthMeters;
    sim.cars.forEach((car, i) => {
      clone(car, sim.cars[0]);
      const progress = 3 + t0 - i * 40 / L;
      Object.assign(car, { progress, trackT: ((progress % 1) + 1) % 1, currentLap: Math.floor(progress), raceDayLuckFactor: 0 });
    });
    const fast = sim.cars[size - 1];
    fast.raceDayLuckFactor = advantage;
    sim.setSeed(50); sim.setFixedStep(0.02);
    return { sim, L, leader: sim.cars[0], fast };
  };
  /** Corre `laps` vueltas del líder (o hasta `stop`) y anota adelantamientos del coche rápido y dónde maniobró. */
  const watch = ({ sim, leader, fast }, laps, stop = () => false, observe = () => {}) => {
    const passes = [], outside = [];
    const ahead = () => sim.cars.filter(c => c !== fast && c.progress > fast.progress).length;
    let before = ahead();
    const from = leader.progress;
    sim.onFixedStep = () => {
      observe();
      if (fast.isOvertaking && !sim.isOvertakingAllowedZone(fast.trackT)) outside.push(fast.trackT);
      const now = ahead();
      if (now < before) passes.push({ t: fast.trackT, laps: leader.progress - from, lap: Math.floor(fast.progress), zone: sim.overtakeZoneOf(fast.id) });
      before = now;
    };
    while (leader.progress < from + laps && !stop(passes)) sim.update(1 / 60);
    sim.onFixedStep = null;
    return { passes, outside, gained: passes.length };
  };
  const duel = (circuit, advantage, laps) => watch(train(circuit, 2, advantage), laps, passes => passes.length > 0);

  await test('R50: con el mismo ritmo no hay adelantamientos; con un 3 % depende del circuito', () => {
    for (const id of ['monaco', 'monza', 'bahrain']) {
      const equal = duel(id, 0, 5);
      assert(equal.gained === 0 && equal.outside.length === 0, `R50: ${id} — coches idénticos, 0 adelantamientos en 5 vueltas`, String(equal.gained));
    }
    const monaco = duel('monaco', 0.03, 6);
    assert(monaco.gained === 0, 'R50: en Mónaco un coche un 3 % más rápido no pasa en 6 vueltas', JSON.stringify(monaco.passes));
    for (const id of ['monza', 'bahrain']) {
      const result = duel(id, 0.03, 2);
      assert(result.gained === 1 && result.passes[0].zone !== null, `R50: en ${id} un coche un 3 % más rápido pasa en menos de 2 vueltas, dentro de una zona`, JSON.stringify(result.passes));
      assert(result.outside.length === 0, `R50: en ${id} la maniobra solo está activa dentro de zona`, String(result.outside[0] ?? ''));
    }
  });

  await test('R50: con un 5 % de ventaja, Mónaco da como mucho una oportunidad por vuelta y Monza muchas', () => {
    const scene = train('monaco', 5, 0.05);
    let lateAttacksFromBehind = 0, lastTargetId = null;
    const monaco = watch(scene, 3, () => false, () => {
      const { sim, fast } = scene, zone = sim.overtakingZoneAt(fast.trackT), target = sim.cars.find(c => c.id === fast.carAheadId);
      // El paso en que cambia el coche de delante (acaba de adelantar) no cuenta: la maniobra anterior aún figura activa.
      const sameTarget = target?.id === lastTargetId;
      lastTargetId = target?.id ?? null;
      if (!sameTarget || !fast.isOvertaking || !zone || zone.cornerWide || !target || target.progress <= fast.progress) return;
      const pastNarrowing = !inZone({ startT: zone.startT, endT: zone.launchEndT }, fast.trackT);
      if (pastNarrowing && (target.progress - fast.progress) * scene.L > RaceSimulation.OVERTAKE.ALONGSIDE_M + 0.5) lateAttacksFromBehind++;
    });
    assert(lateAttacksFromBehind === 0, 'R50: en Mónaco, pasada la estrechez solo sigue atacando quien ya iba en paralelo', String(lateAttacksFromBehind));
    assert(monaco.gained >= 1 && monaco.gained <= 3, 'R50: en Mónaco gana entre 1 y 3 puestos en 3 vueltas (pasa con dificultad)', JSON.stringify(monaco.passes.map(p => p.laps.toFixed(1))));
    assert(monaco.passes.every(p => p.zone !== null) && monaco.outside.length === 0, 'R50: en Mónaco todos los adelantamientos son dentro de zona');
    // Por vuelta del propio coche: la fila sale justo después de la mejor zona, así que cada vuelta la contiene una vez.
    const perLap = [...new Set(monaco.passes.map(p => p.lap))].map(lap => monaco.passes.filter(p => p.lap === lap).length);
    assert(Math.max(0, ...perLap) <= 1, 'R50: en Mónaco no hay más de un adelantamiento por vuelta', perLap.join());
    const monza = watch(train('monza', 5, 0.05), 3);
    assert(monza.gained === 4 && monza.passes[3].laps < 2, 'R50: en Monza pasa a los cuatro en menos de 2 vueltas', JSON.stringify(monza.passes.map(p => p.laps.toFixed(1))));
    assert(monza.passes.every(p => p.zone !== null) && monza.outside.length === 0, 'R50: en Monza todos los adelantamientos son dentro de zona');
    const bahrain = watch(train('bahrain', 5, 0.05), 3);
    assert(bahrain.gained === 4 && bahrain.gained > monaco.gained, 'R50: en Bahréin pasa a los cuatro en 3 vueltas', String(bahrain.gained));
  });

  // ── 3. Defensa básica ──
  await test('R50: el coche atacado cubre una vez el interior y el atacante va por fuera', () => {
    const scene = train('monza', 2, 0.03);
    const { sim, leader: defender, fast: attacker } = scene;
    const seen = { defended: 0, zones: new Set(), sideChanges: 0, wrongSide: 0, attackerSameSide: 0, attackerOutside: 0, outsideZone: 0, sideByZone: new Map() };
    const observe = () => {
      const defence = defender.defence;
      if (!defence) return;
      seen.defended++;
      const zone = sim.overtakingZoneAt(defender.trackT);
      if (!zone || zone.id !== defence.zoneId) { seen.outsideZone++; return; }
      seen.zones.add(zone.id);
      if (seen.sideByZone.has(zone.id) && seen.sideByZone.get(zone.id) !== defence.side) seen.sideChanges++;
      seen.sideByZone.set(zone.id, defence.side);
      if (defence.side !== zone.insideSign || Math.sign(defender.targetLateralOffset) !== zone.insideSign) seen.wrongSide++;
      if (attacker.isOvertaking && attacker.progress < defender.progress) {
        if (Math.sign(attacker.targetLateralOffset) === zone.insideSign) seen.attackerSameSide++; else seen.attackerOutside++;
      }
    };
    watch(scene, 2, passes => passes.length > 0, observe);
    assert(seen.defended > 0 && seen.zones.size >= 1, 'R50: el coche atacado se defiende dentro de una zona', String(seen.defended));
    assert(seen.wrongSide === 0, 'R50: se coloca en el interior de la curva que cierra la zona', String(seen.wrongSide));
    assert(seen.sideChanges === 0 && seen.outsideZone === 0, 'R50: un solo movimiento por zona y deja de defender al salir de ella', `${seen.sideChanges} cambios · ${seen.outsideZone} pasos fuera`);
    assert(seen.attackerOutside > 0 && seen.attackerSameSide <= 25, 'R50: el atacante toma el otro lado', `${seen.attackerOutside} pasos por fuera · ${seen.attackerSameSide} por el mismo lado`);
  });

  await test('R50: no se defiende sin ataque, al ser doblado ni bajo neutralización', () => {
    const defended = (build, steps = 6000) => {
      const scene = build();
      let count = 0;
      scene.sim.onFixedStep = () => { if (scene.leader.defence) count++; };
      const limit = scene.sim.fixedStepCount + steps;
      while (scene.sim.fixedStepCount < limit) scene.sim.update(1 / 60);
      return count;
    };
    assert(defended(() => train('monza', 1, 0)) === 0, 'R50: un coche solo no se defiende');
    assert(defended(() => train('monza', 2, 0)) === 0, 'R50: con un coche de su mismo ritmo detrás, que no ataca, no se defiende');
    // El de detrás le saca una vuelta: es un doblaje con bandera azul, no una lucha por la posición.
    const lapping = () => { const scene = train('monza', 2, 0.05); scene.fast.progress += 1; scene.fast.currentLap += 1; return scene; };
    assert(defended(lapping) === 0, 'R50: un doblado no se defiende de quien lo dobla');
    for (const flag of ['sc', 'vsc']) {
      const neutral = () => { const scene = train('monza', 2, 0.05); if (flag === 'sc') scene.sim.deploySafetyCar('Prueba'); else scene.sim.startVirtualSafetyCar(300); return scene; };
      assert(defended(neutral, 3000) === 0, `R50: bajo ${flag.toUpperCase()} nadie se defiende`);
    }
  });

  await test('R50: defenderse exige más ventaja al atacante, salvo que ya esté en paralelo', () => {
    const OT = RaceSimulation.OVERTAKE;
    assert(OT.DEFENCE_FACTOR === 1.3, 'R50: la defensa exige un 30 % más de ventaja', String(OT.DEFENCE_FACTOR));
    // En la mejor zona de Mónaco: ventaja suficiente sin defensa e insuficiente con ella.
    const best = new RaceSimulation('monaco').overtakingZones.reduce((a, b) => (b.difficulty < a.difficulty ? b : a));
    const undefended = OT.MIN_ADVANTAGE * best.difficulty;
    const advantage = undefended + 0.002;
    assert(advantage + OT.CLOSING_AID_MAX < undefended * OT.DEFENCE_FACTOR, 'R50: la ventaja de la prueba queda entre los dos umbrales', `${(undefended * 100).toFixed(2)} % / ${(undefended * OT.DEFENCE_FACTOR * 100).toFixed(2)} %`);
    const factor = OT.DEFENCE_FACTOR;
    let withoutDefence;
    try { OT.DEFENCE_FACTOR = 1; withoutDefence = duel('monaco', advantage, 4); } finally { OT.DEFENCE_FACTOR = factor; }
    const withDefence = duel('monaco', advantage, 4);
    assert(withoutDefence.gained === 1 && withoutDefence.passes[0].zone === best.id, 'R50: sin el efecto de la defensa, esa ventaja basta para pasar en la mejor zona', JSON.stringify(withoutDefence.passes));
    assert(withDefence.gained === 0, 'R50: con el interior cubierto, la misma ventaja no basta', JSON.stringify(withDefence.passes));

    // Atacante ya en paralelo (a 4 m) al empezar: el de delante no puede cerrarle.
    const scene = train('monza', 2, 0.03);
    const zone = scene.sim.overtakingZones.reduce((a, b) => (b.straightM > a.straightM ? b : a));
    const startT = (zone.startT + 100 / scene.L) % 1;
    Object.assign(scene.leader, { progress: 3 + startT, trackT: startT, currentSpeedKmh: 250 });
    const behind = 3 + startT - 4 / scene.L;
    Object.assign(scene.fast, { progress: behind, trackT: ((behind % 1) + 1) % 1, currentSpeedKmh: 262, isOvertaking: true, carAheadId: scene.leader.id });
    let closed = 0;
    scene.sim.onFixedStep = () => { if (scene.leader.defence && scene.fast.progress < scene.leader.progress) closed++; };
    for (let i = 0; i < 40; i++) scene.sim.update(1 / 60);
    assert(closed === 0, 'R50: con el atacante ya en paralelo no se le cierra', String(closed));
  });

  // Dos defectos que destapó la métrica al simular carreras completas (07/10/2026): sin maniobra nadie cambia de puesto.
  await test('R50: sin maniobra nadie cambia de puesto — ni el recién adelantado ni dos doblados con bandera azul', () => {
    const place = (car, progress, kmh, extra = {}) => Object.assign(car, { progress, trackT: ((progress % 1) + 1) % 1, currentLap: Math.floor(progress), currentSpeedKmh: kmh, ...extra });

    // (a) Stroll completa en paralelo el adelantamiento a Norris en la frenada de la primera chicane de Monza. Norris,
    // con mejor coche, queda solapado detrás: tiene que ceder y descolgarse, no recuperar el puesto en el acto sin atacar.
    const sim = new RaceSimulation('monza');
    sim.cars = sim.cars.filter(c => c.driver.id === 'norris' || c.driver.id === 'stroll');
    const passed = sim.cars.find(c => c.driver.id === 'norris'), passer = sim.cars.find(c => c.driver.id === 'stroll');
    sim.cars.forEach(c => { c.raceDayLuckFactor = 0; c.pitStop.playerControlled = true; });
    sim.setSeed(50); sim.setFixedStep(0.02); sim.lightState = 'racing';
    const L = sim.activeTrack.lapLengthMeters, braking = sim.overtakingZones.reduce((a, b) => (b.straightM > a.straightM ? b : a));
    const t = (braking.brakeT + ((((braking.endT - braking.brakeT) % 1) + 1) % 1) * 0.7) % 1;
    place(passed, 3 + t, 126, { lateralOffset: -0.62 });
    place(passer, 3 + t - 0.05 / L, 133, { lateralOffset: 0.45, isOvertaking: true, carAheadId: passed.id });
    let changes = 0, regainedWithoutAttack = 0, wasBehind = true;
    sim.onFixedStep = () => {
      const isBehind = passer.progress < passed.progress;
      if (isBehind !== wasBehind) { changes++; if (isBehind && !passed.isOvertaking) regainedWithoutAttack++; }
      wasBehind = isBehind;
    };
    for (let i = 0; i < 150; i++) sim.update(1 / 60);
    sim.onFixedStep = null;
    assert(changes === 1 && regainedWithoutAttack === 0, 'R50: el coche recién adelantado no recupera el puesto sin atacar', `${changes} cambios de orden`);
    assert((passer.progress - passed.progress) * L > 4, 'R50: el coche solapado que no ataca cede y se descuelga', `${((passer.progress - passed.progress) * L).toFixed(2)} m`);

    // (b) Dos coches iguales en fila (10 m) y un líder con vuelta de ventaja que se les acerca: a los dos les enseñan
    // bandera azul y levantan. Antes, el de detrás quedaba libre y pasaba al de delante por rebufo, una y otra vez.
    const lapping = train('monza', 3, 0);
    const [a, b, lapper] = lapping.sim.cars;
    const zone = lapping.sim.overtakingZones.reduce((x, y) => (y.straightM > x.straightM ? y : x));
    const from = (zone.startT + 60 / lapping.L) % 1;
    place(a, 3 + from, 240); place(b, 3 + from - 10 / lapping.L, 240); place(lapper, 4 + from - 130 / lapping.L, 240);
    let bothBlue = 0, freeChanges = 0, bBehind = b.progress < a.progress;
    lapping.sim.onFixedStep = () => {
      if (a.isBlueFlagged && b.isBlueFlagged) bothBlue++;
      const isBehind = b.progress < a.progress;
      if (isBehind !== bBehind && !(isBehind ? a : b).isOvertaking) freeChanges++;
      bBehind = isBehind;
    };
    for (let i = 0; i < 1500; i++) lapping.sim.update(1 / 60);
    lapping.sim.onFixedStep = null;
    assert(bothBlue > 100, 'R50: a los dos coches les enseñan bandera azul a la vez', String(bothBlue));
    assert(freeChanges === 0, 'R50: con bandera azul ninguno gana el puesto al otro sin maniobra', String(freeChanges));
  });
}
