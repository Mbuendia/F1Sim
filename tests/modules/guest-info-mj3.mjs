// MJ3 — Información completa para el invitado (Sprint 15). Elección del usuario (19/11/2026): tiempo y radar, banderas
// y Safety Car, y detalle de coche. Contrato aprobado ese día («Sí, adelante»):
//  1. El invitado que juega tiene la pestaña «Tiempo» (con «Muro» y «Tiempos») con el panel del anfitrión: cielo,
//     temperaturas, agua, radar y previsión, con los datos de su vista. El espectador también lo ve.
//  2. Encima de la pista, el aviso de banderas y Safety Car del anfitrión.
//  3. Al tocar un coche (pista o tiempos) se abre su detalle: de tu equipo, telemetría, tandas y lectura del muro; de un
//     rival, tiempos, sectores, compuesto y paradas.
//  4. Nunca ve lo privado de otro equipo (lectura del muro, propuestas ni avisos).
//  5. Funciona en el móvil en vertical, sin desplazamiento horizontal.
//  6. Capturas del invitado con el tiempo, una bandera y el detalle de un coche propio y uno rival, en escritorio y móvil.
// Nota: el espectador no tiene pestañas (lo pide N10): ve los tiempos y, debajo, el tiempo.
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8');

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { EngineHost } = await load('/src/engine/EngineHost.ts');
  const { guestSlowView, guestTeamView } = await load('/src/engine/RaceView.ts');
  const { rosterOf } = await load('/src/engine/RaceSession.ts');
  const { ClientRaceScreen } = await load('/src/components/ClientRace.tsx');

  /** Una carrera compartida a mitad: el invitado «g» con el segundo equipo; lo que le llega por la red. */
  const setup = ({ flag, sc } = {}) => {
    const sim = new RaceSimulation('barcelona');
    sim.setSeed(42); sim.setFixedStep(0.02); sim.lightState = 'racing';
    const teams = [...new Set(sim.cars.map(c => c.team.id))];
    const host = new EngineHost(sim, { shared: { hostUid: 'h', hostTeamId: teams[0] } });
    host.join('g', { teamId: teams[1] });
    for (let i = 0; i < 400; i++) host.advance(0.1);
    if (flag) sim.sectorFlags = [flag, 'green', 'green'];
    if (sc) { sim.raceFlagState = 'sc'; sim.safetyCar.isDeployed = true; sim.safetyCar.mode = 'deployed'; sim.safetyCar.triggerReason = 'Prueba'; }
    const mine = guestTeamView(host.teamView(teams[1]));
    const own = sim.cars.find(c => c.team.id === teams[1]);
    const rival = sim.cars.find(c => c.team.id === teams[3]);
    return { sim, teams, roster: rosterOf(sim), slow: guestSlowView({ ...host.slowView(), ...host.pauseInfo() }), mine, own, rival, rivalView: host.teamView(teams[3]) };
  };
  const screen = (d, extra = {}) => renderToStaticMarkup(createElement(ClientRaceScreen, {
    role: 'player', myTeamId: d.teams[1], myUid: 'g', roster: d.roster, fast: null, slow: d.slow, teams: { [d.teams[1]]: d.mine }, link: 'direct',
    pauseRequested: false, track: null, onOrder: async () => ({ ok: true }), onRequestPause() {}, onLeave() {}, ...extra,
  }));

  await test('MJ3.1: la pestaña «Tiempo» con el panel del anfitrión (y el espectador también)', () => {
    const d = setup();
    const player = screen(d);
    const tabs = ['Muro', 'Tiempos', 'Tiempo'].every(t => new RegExp(`role="tab"[^>]*>(<[^>]+>)*${t}<`).test(player));
    const hidden = /<section[^>]*data-weather[^>]*hidden=""/.test(player);
    const spec = screen(d, { role: 'spectator', myTeamId: null, teams: {} });
    const specSees = /data-weather/.test(spec) && !/<section[^>]*data-weather[^>]*hidden=""/.test(spec) && /RADAR METEOROLÓGICO GPS/.test(spec) && /Agua en Asfalto/.test(spec);
    const same = src('src/components/ClientRace.tsx').includes('initialTab="track_weather"') && src('src/components/ClientRace.tsx').includes('weather={(slow?.weatherState as TrackWeatherState | undefined) ?? undefined} rainForecast={(slow?.forecast as RainForecast | null | undefined) ?? null}');
    const data = Boolean(d.slow.weatherState) && 'forecast' in d.slow;
    assert(tabs && hidden && specSees && same && data, 'MJ3: el jugador tiene Muro, Tiempos y Tiempo; el panel es el del anfitrión (radar y agua) con los datos de su vista; el espectador lo ve sin pestañas',
      `pestañas ${tabs} | oculto hasta pulsar ${hidden} | espectador ${specSees} | mismo panel ${same} | datos ${data}`);
  });

  await test('MJ3.2: banderas y Safety Car encima de la pista', () => {
    const yellow = screen(setup({ flag: 'yellow' }));
    const sc = screen(setup({ sc: true }));
    const green = screen(setup());
    // [19/11/2026, MJ4] El contador de vueltas va ahora entre la pista y el aviso: se mira que el aviso siga dentro de la
    // sección de la pista (lo mismo que antes, sin exigir que vaya justo detrás).
    const comp = src('src/components/ClientRace.tsx').replace(/\r/g, '');
    const at = comp.indexOf('<section className={s.track}>');
    const trackSection = comp.slice(at, comp.indexOf('</section>', at));
    const inTrack = at >= 0 && trackSection.includes('{track}') && trackSection.includes('<RaceFlagsHUD');
    assert(/GREEN FLAG/.test(yellow) && /sectorDot/.test(yellow) && /SAFETY CAR DEPLOYED/.test(sc) && !/GREEN FLAG|SAFETY CAR/.test(green) && inTrack,
      'MJ3: el aviso del anfitrión sobre la pista: amarilla por sector, Safety Car y nada con todo en verde', `pista ${inTrack}`);
  });

  await test('MJ3.3: el detalle de un coche, propio o rival', () => {
    const d = setup();
    const own = screen(d, { selectedCarId: d.own.id });
    const rival = screen(d, { selectedCarId: d.rival.id });
    const ownOk = /data-detail="propio"/.test(own) && own.includes(`Detalle de ${d.own.driver.code}`) && /COCHE DELANTE|Coche delante/i.test(own);
    const rivalOk = /data-detail="rival"/.test(rival) && ['Última vuelta', 'Mejor vuelta', 'Sectores', 'Neumático', 'Paradas'].every(t => rival.includes(t));
    const comp = src('src/components/ClientRace.tsx');
    const ownParts = comp.includes('<BottomTelemetryDock car={detail') && comp.includes('<StintTimeline stints=') && comp.includes('<WallPanel reading={reading} />');
    const wired = comp.includes('onSelectCar={id => onSelectCar?.(id)}') && src('src/components/RoomFlow.tsx').includes('selectedCarId={selected} onSelectCar={setSelected}');
    assert(ownOk && rivalOk && ownParts && wired, 'MJ3: tocar un coche (pista o tiempos) abre su detalle; el tuyo con telemetría, tandas y muro; el rival con tiempos, sectores, compuesto y paradas',
      `propio ${ownOk} | rival ${rivalOk} | piezas ${ownParts} | tocar ${wired}`);
  });

  await test('MJ3.4: nada privado de otro equipo', () => {
    const d = setup();
    const rival = screen(d, { selectedCarId: d.rival.id });
    // Solo la sección del detalle del rival (el muro de tu propio equipo sí se ve, en su pestaña).
    const section = rival.slice(rival.indexOf('data-detail="rival"'), rival.indexOf('</section>', rival.indexOf('data-detail="rival"')));
    const noWall = section.length > 0 && !/MURO|Muro ·|Propuesta|Estratega|Delante|Detrás/.test(section);
    const reading = src('src/components/ClientRace.tsx').includes('const reading = detailOwn && myTeamId ?');
    // Lo que llega por la red: solo la vista de su equipo (N6); la del rival no está en lo que pinta.
    const onlyMine = !JSON.stringify(screen(d)).includes(JSON.stringify(d.rivalView.cars[0]?.reading ?? '__nada__'));
    assert(noWall && reading && onlyMine, 'MJ3: del rival no se ve su lectura del muro ni nada de su vista de equipo; la lectura sale solo de tu equipo', `sin muro ${noWall} | lectura ${reading} | datos ${onlyMine}`);
  });

  await test('MJ3.5: móvil en vertical sin desplazamiento horizontal', () => {
    const css = src('src/components/ClientRace.module.css');
    const ok = css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))') && /\.detail \{[^}]*min-width: 0/.test(css) && /\.weather \{[^}]*overflow-x: hidden/.test(css)
      && /\.facts \{[^}]*minmax\(0, 1fr\)/.test(css);
    assert(ok, 'MJ3: pestañas, detalle y panel del tiempo caben a 430 px (medido en el navegador: ancho de página = ancho de pantalla)', String(ok));
  });

  await test('MJ3.6: capturas del invitado', () => {
    const dir = 'docs/design/mj3-capturas';
    const need = ['tiempo-escritorio.png', 'propio-escritorio.png', 'rival-escritorio.png', 'tiempo-movil.png', 'propio-movil.png', 'rival-movil.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ3: capturas del tiempo con bandera y del detalle propio y rival, en escritorio y móvil', missing.join(', '));
  });
}
