// UX7 — Velocímetro sin fallos (Sprint 7). Contrato acordado con el usuario el 24/10/2026 (punto 5 cambiado ese día por decisión del usuario).
// Reproducción del 24/10/2026: en Barcelona con Safety Car (semilla 7) varios coches pasan de 260 km/h a 0 y marcan
// velocidades negativas (113 muestras en 4 minutos); además, la animación del número se queda en NaN para siempre si le
// llega un valor no numérico, y al cambiar de coche barre desde la velocidad del anterior.
//  1. El motor nunca da una velocidad negativa ni no numérica: 5 circuitos, con Safety Car, semilla fija.
//  2. Fuera de un accidente o de entrar en boxes, la velocidad no salta más de 120 km/h en 0,1 s.
//  3. La animación del número se recupera de un valor no numérico y nunca enseña negativos.
//  4. Al cambiar de coche (entre los dos del jugador), el número muestra al momento la velocidad del coche nuevo.
//  5. Solo hay un velocímetro, en el Muro (decisión del usuario del 24/10/2026): enseña la velocidad del coche del
//     jugador al que se dan las órdenes. El Detalle deja de enseñarla y TelemetryPanel (sin uso desde T4.17) se borra.
//     El usuario autorizó ese día cambiar los tests aprobados que lo nombran (race-ui, visual-animations,
//     visual-chassis, visual-icons, polish-t417, race-session-n3): sus casos pasan al velocímetro del Muro o se quitan
//     si solo miraban ese panel. Se cambian al implementar UX7.
import { existsSync, readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { tweenStart, tweenValue, speedReadout } = await load('/src/utils/useTweenedNumber.ts');

  const race = (circuit, seconds, seed = 7) => {
    const sim = new RaceSimulation(circuit);
    sim.setSeed(seed); sim.setFixedStep(0.02); sim.totalLaps = 6;
    sim.lightState = 'racing'; sim.isPaused = false;
    const bad = [], jumps = [], last = new Map();
    for (let t = 0.1; t <= seconds && !sim.isFinished; t += 0.1) {
      sim.update(0.1);
      if (Math.abs(t - 150) < 0.05) sim.deploySafetyCar('prueba');
      for (const c of sim.cars) {
        const v = c.telemetry.speedKmh, prev = last.get(c.id);
        if (!Number.isFinite(v) || v < 0) bad.push(`${c.driver.code} ${t.toFixed(1)} s: ${v}`);
        // Un trompo o un accidente sí frenan en seco: ese coche no cuenta mientras su incidente siga abierto.
        const incident = sim.incidents.some(i => i.carId === c.id && !i.isCleared);
        const calm = c.status === 'running' && !c.isInPitLane && !c.pitStop?.isPitting && !c.offTrack && !incident;
        if (calm && prev !== undefined && Number.isFinite(v) && Math.abs(v - prev) > 120) jumps.push(`${c.driver.code} ${t.toFixed(1)} s: ${Math.round(prev)}→${Math.round(v)}`);
        last.set(c.id, v);
      }
    }
    return { bad, jumps };
  };

  await test('UX7: el motor da velocidades válidas', () => {
    for (const circuit of ['barcelona', 'monaco', 'monza', 'silverstone', 'spa']) {
      const { bad, jumps } = race(circuit, 240);
      assert(bad.length === 0, `UX7 (${circuit}): ninguna velocidad negativa ni no numérica, con Safety Car`, bad.slice(0, 4).join(' | '));
      assert(jumps.length === 0, `UX7 (${circuit}): sin saltos de más de 120 km/h en 0,1 s fuera de boxes y accidentes`, jumps.slice(0, 4).join(' | '));
    }
  });

  await test('UX7: la animación del número', () => {
    assert(tweenStart(NaN, 210) === 210 && tweenStart(Infinity, 210) === 210, 'UX7: tras un valor no numérico, la animación arranca del valor nuevo');
    assert(tweenStart(180, 210) === 180, 'UX7: con un valor válido, arranca de lo que se ve');
    assert(tweenValue(180, 210, 0) === 180 && tweenValue(180, 210, 1) === 210 && tweenValue(180, 210, 0.5) > 180 && tweenValue(180, 210, 0.5) < 210, 'UX7: va del valor de partida al nuevo');
    assert(speedReadout(-4) === 0 && speedReadout(NaN) === 0 && speedReadout(undefined) === 0 && speedReadout(259.6) === 260, 'UX7: la lectura es un entero y nunca negativa ni NaN');
  });

  await test('UX7: un solo velocímetro, en el Muro', () => {
    const wall = readFileSync('src/components/BoxControls.tsx', 'utf8'), dock = readFileSync('src/components/BottomTelemetryDock.tsx', 'utf8');
    assert(/data-odometer=["']speed["']/.test(wall) && /speedReadout\(/.test(wall), 'UX7: el velocímetro está en el Muro y usa la lectura común');
    assert(/useTweenedNumber\([^)]*\.id/.test(wall), 'UX7: el número se reinicia con el coche: el identificador del coche va a la animación');
    assert(!/speedKmh/.test(dock) && !/data-odometer=["']speed["']/.test(dock), 'UX7: el Detalle ya no enseña la velocidad');
    assert(!existsSync('src/components/TelemetryPanel.tsx'), 'UX7: TelemetryPanel, sin uso, se ha borrado');
  });
}
