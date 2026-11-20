// MJ11 — Planificación antes de la carrera con una escena de Blender (Sprint 15). Contrato aprobado por el usuario el
// 20/11/2026 («Si»), con figuras propias a partir del mecánico del juego:
//  1. La pantalla sale entre la clasificación (o las sanciones) y la vuelta de formación; «A la parrilla» da la salida; en
//     una carrera rápida («Simular») no sale.
//  2. El compuesto de salida elegido se monta con la orden nueva, solo antes del semáforo y con juegos que queden.
//  3. Las paradas previstas se programan con su vuelta y su compuesto, el ritmo de salida se aplica y «Estratega» delega.
//  4. En multijugador, el invitado planifica solo sus coches; la salida la da el anfitrión.
//  5. La escena de Blender en capas, en escritorio y en el móvil, con capturas y la sonda sin desbordes a 1440, 430 y 375 px.
// Prueba en Chrome sin ventana del 20/11/2026 (carrera libre de Barcelona y la revisión de la sala con &salida=antes): el
// plan sale al entrar a pista (sin vuelta de formación todavía); «A la parrilla» lo cierra y empieza la vuelta de
// formación; el invitado envía su plan y lee «Esperando la salida del anfitrión». Sonda: page 0, scrollX y cut vacíos a
// 1440, 430 y 375 px (la lista de coches se desplaza en vertical).
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const { EngineHost } = await server.ssrLoadModule('/src/engine/EngineHost.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const P = await server.ssrLoadModule('/src/utils/racePlan.ts');
  const race = () => { const sim = new RaceSimulation('barcelona'); sim.setSeed(11); sim.setFixedStep(0.02); return sim; };
  let seq = 0;
  const order = (host, o, uid) => host.handle({ type: 'order', seq: ++seq, order: o }, uid).find(m => m.type === 'ack');

  await test('MJ11.1: el plan va antes de la salida y no al simular', () => {
    const app = src('src/App.tsx');
    const gates = app.includes("if (gate === 'directo') { if (autoRequested.current) simulation.startRaceSequence(); else setPlanOpen(true); }")
      && (app.match(/if \(autoStartingRef\.current\) simulation\.startRaceSequence\(\); else setPlanOpen\(true\);/g) ?? []).length === 2
      && /autoStartingRef\.current = true;\n\s*if \(latest\.qualifying\) latest\.fromQualifying\(\);\n\s*else if \(latest\.penalties\) latest\.fromPenalties\(\);\n\s*autoStartingRef\.current = false;/.test(app);
    const go = app.includes("await sendOrder({ kind: 'startSequence' });") && app.includes('{planOpen && !autoRace && (') && /A la parrilla/.test(src('src/components/RacePlanScreen.tsx'));
    assert(gates && go, 'MJ11: en GP directo, tras la clasificación y tras las sanciones se abre el plan (al simular, la salida va sola); «A la parrilla» manda el plan y da la salida', JSON.stringify({ gates, go }));
  });

  await test('MJ11.2: el neumático de salida, con la orden nueva y solo antes del semáforo', () => {
    const sim = race();
    const host = new EngineHost(sim);
    const car = sim.cars[0];
    const before = car.tires.compound;
    const ok = order(host, { kind: 'startTyre', carId: car.id, compound: 'soft' });
    const mounted = ok?.ok === true && car.tires.compound === 'soft' && before !== 'soft';
    const unknown = order(host, { kind: 'startTyre', carId: car.id, compound: 'super' })?.ok === false;
    order(host, { kind: 'startSequence' });
    for (let i = 0; i < 6000 && sim.beforeLights(); i++) { if (sim.lightState === 'grid-ready') order(host, { kind: 'confirmStart' }); host.advance(0.1); }
    const late = order(host, { kind: 'startTyre', carId: car.id, compound: 'hard' });
    const afterLights = !sim.beforeLights() && late?.ok === false && /antes del semáforo/.test(late.reason) && car.tires.compound === 'soft';
    assert(mounted && unknown && afterLights, 'MJ11: «startTyre» monta el compuesto elegido antes del semáforo; después (o con un compuesto que no existe) se rechaza',
      JSON.stringify({ before, now: car.tires.compound, mounted, unknown, afterLights, late }));
  });

  await test('MJ11.3: paradas, ritmo y estratega', () => {
    const sim = race();
    const host = new EngineHost(sim);
    const [a, b] = sim.cars;
    const plan = { compound: 'medium', stops: [{ lap: 20, compound: 'hard' }, { lap: 44, compound: 'soft' }], pace: 'push', delegated: false };
    const results = P.planOrders(a.id, plan).map(o => order(host, o)?.ok);
    const paced = a.paceMode === 'push';
    const stops = JSON.stringify(a.pitStop.plannedStops) === JSON.stringify([{ lap: 20, compound: 'hard' }, { lap: 44, compound: 'soft' }]) && a.pitStop.playerControlled === true;
    const shape = P.planOrders(a.id, plan).map(o => o.kind).join(',') === 'startTyre,planStops,pace';
    const delegated = P.planOrders(b.id, { ...plan, delegated: true });
    const del = delegated.length === 1 && delegated[0].kind === 'delegate' && order(host, delegated[0])?.ok === true && b.wallDelegated === true;
    const bad = order(host, { kind: 'planStops', carId: a.id, stops: [{ lap: 999, compound: 'hard' }] })?.ok === false;
    const helpers = P.stopLaps(1, 66).join() === '30' && P.stopLaps(2, 66).join() === '22,44' && P.moveStop({ ...plan }, 0, 50, 66).stops[0].lap === 43 && P.withStopCount(plan, 0, 66).stops.length === 0;
    assert(results.every(Boolean) && paced && stops && shape && del && bad && helpers, 'MJ11: el plan manda neumático, paradas (con su vuelta y compuesto) y ritmo de salida (antes del semáforo); «Estratega» solo delega; una parada fuera de la carrera se rechaza',
      JSON.stringify({ results, planned: a.pitStop.plannedStops, shape, del, bad, helpers }));
  });

  await test('MJ11.4: el invitado planifica solo sus coches; el anfitrión da la salida', () => {
    const sim = race();
    const teams = [...new Set(sim.cars.map(c => c.team.id))];
    const host = new EngineHost(sim, { shared: { hostUid: 'h', hostTeamId: teams[0] } });
    host.join('g', { teamId: teams[1] });
    const mine = sim.cars.find(c => c.team.id === teams[1]);
    const foreign = sim.cars.find(c => c.team.id === teams[2]);
    const own = order(host, { kind: 'startTyre', carId: mine.id, compound: 'soft' }, 'g')?.ok === true;
    const other = order(host, { kind: 'planStops', carId: foreign.id, stops: [{ lap: 20, compound: 'hard' }] }, 'g');
    const start = order(host, { kind: 'startSequence' }, 'g');
    const client = src('src/components/ClientRace.tsx');
    const screen = client.includes("{player && slow?.light === 'idle' && own.length > 0 && (") && client.includes('<RacePlanScreen role="invitado"') && /Esperando la salida del anfitrión/.test(src('src/components/RacePlanScreen.tsx'));
    assert(own && other?.ok === false && other.code === 'equipo-ajeno' && start?.ok === false && start.code === 'solo-anfitrion' && screen,
      'MJ11: el invitado planifica sus coches (no los de otro equipo) y no puede dar la salida; su pantalla le dice que espera al anfitrión', JSON.stringify({ own, other, start, screen }));
  });

  await test('MJ11.5: la escena de Blender en capas, capturas y sonda', async () => {
    const missing = [];
    for (const d of ['escritorio', 'movil']) for (const l of ['fondo', 'coche', 'personas']) for (const e of ['avif', 'webp']) if (!existsSync(`public/plan/garaje-${d}-${l}.${e}`)) missing.push(`garaje-${d}-${l}.${e}`);
    for (const f of ['escritorio.png', 'escritorio-dos-paradas.png', 'movil.png', 'invitado-escritorio.png', 'invitado-movil.png']) if (!existsSync(`docs/design/mj11-capturas/${f}`)) missing.push(f);
    const blender = src('scripts/blender/mj11-garaje.py');
    // [20/11/2026] Cambiado a petición del usuario (pasa referencias de ingenieros de verdad: «úsalas para generar a los
    // ingenieros… son un poco raros»): los ingenieros ya no salen del mecánico sino de mj11-ingeniero.py; el piloto, sí.
    const figures = blender.includes("make_engineer(gente, 'ingeniero_1', 'cuaderno'") && blender.includes("make_engineer(gente, 'ingeniero_2', 'brazos'")
      && blender.includes("_person(gente, crew_glb, 'piloto'") && /mecanico\.glb/.test(blender) && existsSync('scripts/blender/mj11-ingeniero.py');
    const layers = /data-plan-layer=\{layer\}/.test(src('src/components/RacePlanScreen.tsx')) && /prefers-reduced-motion/.test(src('src/components/RacePlanScreen.module.css'));
    const probe = [1440, 430, 375].every(w => src('tests/modules/plan-mj11.mjs').includes(String(w)));
    assert(missing.length === 0 && figures && layers && probe, 'MJ11: el garaje de Blender (coche de carbono, ingenieros propios según las referencias y piloto a partir del mecánico) en tres capas para escritorio y móvil, quietas con «reducir movimiento»; capturas y sonda anotadas',
      JSON.stringify({ missing, figures, layers, probe }));
    // [20/11/2026, el usuario: «el coche que tiene que aparecer es el de la livery… el que has seleccionado»] Añadido: el
    // coche del garaje es el del jugador, en directo con su livery, y la cámara en directo es la del render de Blender.
    const C = await server.ssrLoadModule('/src/scene3d/planCamera.ts');
    const py = n => blender.includes(n);
    const nums = a => a.map(n => (Number.isInteger(n) ? n.toFixed(1) : String(n))).join(', ');
    const d = C.PLAN_FRAMES.escritorio, m = C.PLAN_FRAMES.movil;
    const synced = py(`cam.data.lens = ${d.lens}`) && py(`cam.data.shift_x, cam.data.shift_y = ${d.shiftX}, ${d.shiftY}`) && py(`_aim(cam, (${nums(d.eye)}), (${nums(d.target)}))`)
      && py(`cam.data.lens = ${m.lens}`) && py(`cam.data.shift_x, cam.data.shift_y = ${m.shiftX.toFixed(1)}, ${m.shiftY}`) && py(`_aim(cam, (${nums(m.eye)}), (${nums(m.target)}))`)
      && py(`car.location = (${nums(C.PLAN_CAR.position)})`) && py(`math.radians(${C.PLAN_CAR.headingDeg})`);
    const fov = Math.abs(C.verticalFov(d) - 2 * Math.atan(18 * 1080 / 1920 / 30) * 180 / Math.PI) < 1e-9 && JSON.stringify(C.toThree([1, 2, 3])) === '[1,3,-2]';
    const car3d = src('src/components/PlanCar3D.tsx');
    const live = car3d.includes('models.dressCar(gltf.scene, liveries.carLivery(look.team), look.number') && car3d.includes('carModel.activeCarYear()')
      && src('src/App.tsx').includes('look={teamCars[0] ? { team: teamCars[0].team, number: teamCars[0].driver.number') && src('src/components/ClientRace.tsx').includes('look={{ team: own[0].team')
      && /c\.exclude = only is not None and name == 'fondo' and c\.name == 'mj11_personas'/.test(blender) && blender.includes('o.visible_camera = not hide');
    assert(synced && fov && live, 'MJ11: el coche del garaje es el del jugador (el modelo del año con su livery y su dorsal) dibujado en directo con la cámara del render; el fondo de Blender deja solo su sombra',
      JSON.stringify({ synced, fov, live }));
  });
}
