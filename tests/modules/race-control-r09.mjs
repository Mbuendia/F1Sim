// R09 (primera entrega) — Sectores de comisarios, servicio único de permisos y banderas amarillas locales (contrato
// aprobado por el usuario el 01/10/2026). Factores de velocidad bajo amarilla: calibración del juego, no baremo FIA.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const rc = await server.ssrLoadModule('/src/simulation/RaceControl.ts');
  const { IncidentModel } = await server.ssrLoadModule('/src/simulation/IncidentModel.ts');
  const make = await raceFactory(server);
  const { MARSHAL_SECTOR_COUNT, marshalSectorOf, marshalSectorRange, permissionsFor } = rc;

  // Incidente sintético (coche parado) en la fracción t.
  const incidentAt = (sim, t, type = 'crash') =>
    IncidentModel.registerIncident({ id: 99, driver: { code: 'INC' }, trackT: t }, type, sim.activeTrack);

  await test('R09: sectores de comisarios independientes del cronometraje', () => {
    assert(MARSHAL_SECTOR_COUNT === 18, 'R09: 18 sectores de comisarios');
    let covered = 0, contiguous = true;
    for (let i = 1; i <= MARSHAL_SECTOR_COUNT; i++) {
      const r = marshalSectorRange(i);
      covered += r.endT - r.startT;
      if (i > 1 && Math.abs(marshalSectorRange(i - 1).endT - r.startT) > 1e-12) contiguous = false;
    }
    assert(Math.abs(covered - 1) < 1e-9 && contiguous, 'R09: contiguos y cubren la vuelta');
    const bounds = Array.from({ length: MARSHAL_SECTOR_COUNT }, (_, k) => marshalSectorRange(k + 1).startT);
    assert(!bounds.some(b => Math.abs(b - 0.33) < 1e-6 || Math.abs(b - 0.66) < 1e-6), 'R09: sus límites no coinciden con los sectores cronometrados');
    const sim = make('barcelona', 1);
    const inc = incidentAt(sim, 0.5);
    assert(inc.marshalSector === marshalSectorOf(0.5), 'R09: el incidente se asigna a su sector de comisarios', String(inc.marshalSector));
  });

  await test('R09: prioridad de banderas en un único servicio', () => {
    const local = new Map([[5, 'yellow'], [9, 'double-yellow']]);
    const at = (sector, flag = 'green') => permissionsFor({ marshalSector: sector, globalFlag: flag, localFlags: local });
    const green = at(1);
    assert(green.overtake && green.drs && green.blueFlags && green.speedFactor === 1, 'R09: verde lo permite todo');
    const yellow = at(5), dbl = at(9);
    assert(!yellow.overtake && !yellow.drs && yellow.speedFactor < 1, 'R09: amarilla local prohíbe adelantar y DRS y reduce velocidad');
    assert(!dbl.overtake && dbl.speedFactor < yellow.speedFactor, 'R09: la doble amarilla es más estricta que la simple');
    assert(at(2).overtake && at(2).drs, 'R09: fuera del sector con bandera se permite todo');
    for (const flag of ['vsc', 'sc', 'red']) {
      assert(!at(1, flag).overtake && !at(1, flag).drs, `R09: ${flag} prohíbe adelantar en todo el circuito`);
    }
    assert(at(9, 'red').reason === at(1, 'red').reason && /roja/i.test(at(9, 'red').reason), 'R09: la roja manda sobre todo');
    assert(at(5, 'yellow').overtake === false && at(2, 'yellow').overtake === true, 'R09: la bandera global informativa no prohíbe fuera del sector');
  });

  // Coche lento delante (pinchazo) y coche rápido detrás, a 15 m, en t.
  const chase = (t, incidentT) => {
    const sim = make('barcelona', 2), [slow, fast] = sim.cars;
    const L = sim.activeTrack.lapLengthMeters;
    Object.assign(slow, { progress: 3 + t, trackT: t, currentLap: 3, currentSpeedKmh: 70, hasPuncture: true });
    // Un pinchazo real deja el neumático a 0 (fixture corregido con autorización del usuario el 01/10/2026).
    slow.tires.healthRR = 0; slow.tires.health = 75;
    const pf = 3 + t - 15 / L;
    Object.assign(fast, { progress: pf, trackT: pf % 1, currentLap: 3, currentSpeedKmh: 150 });
    if (incidentT !== undefined) sim.incidents.push(incidentAt(sim, incidentT));
    sim.setSeed(9); sim.setFixedStep(0.02);
    return { sim, slow, fast };
  };
  const zone = 0.93; // zona de adelantamiento permitida y recta final

  await test('R09: la amarilla local no se sobrescribe', () => {
    const { sim, slow, fast } = chase(zone, zone + 0.005);
    const sector = marshalSectorOf(zone);
    let overtook = false, drs = false;
    while (marshalSectorOf(fast.trackT) === sector && sim.raceTimeSec < 30) {
      sim.update(1 / 60);
      if (marshalSectorOf(fast.trackT) !== sector) break;
      if (fast.isOvertaking || fast.progress > slow.progress) overtook = true;
      if (fast.drsActive) drs = true;
    }
    assert(!overtook, 'R09: en el sector con amarilla un coche más rápido no adelanta');
    assert(!drs, 'R09: ni activa el DRS');
  });

  await test('R09: al salir del sector se restablecen los permisos', () => {
    const { sim, slow, fast } = chase(zone, zone + 0.005);
    const sector = marshalSectorOf(zone);
    while (sim.raceTimeSec < 60 && !(fast.progress > slow.progress)) sim.update(1 / 60);
    assert(fast.progress > slow.progress && marshalSectorOf(fast.trackT) !== sector, 'R09: adelanta una vez fuera del sector con bandera',
      `sector ${marshalSectorOf(fast.trackT)} / ${sector}`);
    assert(sim.permissionsForCar(fast).overtake, 'R09: fuera del sector vuelve el permiso de adelantar');
  });

  await test('R09: la amarilla es solo local', () => {
    const { sim, slow, fast } = chase(zone, 0.5);
    while (sim.raceTimeSec < 30 && !(fast.progress > slow.progress)) sim.update(1 / 60);
    assert(fast.progress > slow.progress, 'R09: con un incidente lejos, la pareja adelanta con normalidad');
  });

  await test('R09: registro del incidente y limpieza', () => {
    const sim = make('barcelona', 1);
    const crash = incidentAt(sim, 0.4, 'crash'), mech = incidentAt(sim, 0.6, 'dnf'), spin = incidentAt(sim, 0.7, 'spin');
    assert(crash.cause === 'accidente' && crash.responsibility === 'propio', 'R09: accidente de un coche: causa y responsabilidad propia');
    assert(mech.cause === 'mecanica' && mech.responsibility === 'ninguna', 'R09: avería mecánica sin responsabilidad');
    assert(spin.cause === 'trompo' && spin.responsibility === 'propio', 'R09: trompo propio');
    sim.incidents.push(crash);
    assert(sim.localFlags().get(crash.marshalSector) === 'yellow', 'R09: el sector del incidente muestra amarilla');
    crash.isCleared = true;
    assert(!sim.localFlags().has(crash.marshalSector), 'R09: al despejarse, el sector vuelve a verde');
  });

  await test('R09: el doblado no cede dentro de la amarilla', () => {
    const sim = make('barcelona', 2), [leader, lapped] = sim.cars;
    const L = sim.activeTrack.lapLengthMeters, t = 0.93;
    Object.assign(lapped, { progress: 2 + t, trackT: t, currentLap: 2, currentSpeedKmh: 200 });
    const pl = 3 + t - 40 / L;
    Object.assign(leader, { progress: pl, trackT: pl % 1, currentLap: 3, currentSpeedKmh: 280 });
    sim.incidents.push(incidentAt(sim, t + 0.01));
    sim.setSeed(9); sim.setFixedStep(0.02);
    const sector = marshalSectorOf(t);
    let yieldedInside = false, yieldedOutside = false;
    while (sim.raceTimeSec < 40) {
      sim.update(1 / 60);
      const inside = marshalSectorOf(lapped.trackT) === sector;
      if (inside && (lapped.blueFlagLevel ?? 0) > 0) yieldedInside = true;
      if (!inside && (lapped.blueFlagLevel ?? 0) > 0) { yieldedOutside = true; break; }
    }
    assert(!yieldedInside, 'R09: dentro de la amarilla el doblado no se aparta');
    assert(yieldedOutside, 'R09: al salir del sector cede');
  });
}
