// T4.10 — Junta y objetivos de temporada (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Decisión del usuario: con la confianza a
// cero, destitución al acabar la temporada y oferta de un equipo de menor nivel; la partida no termina. Decidido aquí
// (quedaba para el contrato): si ya diriges el equipo de menos nivel, la junta te da otra temporada. Cifras: diseño
// del juego, leídas del módulo.
//  1. Objetivo de la temporada: un puesto en constructores acorde con el nivel del coche.
//  2. La confianza (0 a 100) se mueve tras cada Gran Premio según el resultado frente a lo esperado, con su motivo;
//     baja en una ronda saltada y cada ronda en el límite de deuda; el sprint no la mueve.
//  3. Cierre de temporada: objetivo cumplido, prima; no cumplido, recorte; queda el balance y sale el objetivo nuevo.
//  4. Confianza a cero al cierre: destitución; el jugador pasa al equipo siguiente de menor nivel con lo que ese
//     equipo tiene.
//  5. Se guarda y se carga; aviso con la confianza baja; test de interfaz.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const board = await server.ssrLoadModule('/src/simulation/Board.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const hub = await server.ssrLoadModule('/src/simulation/Hub.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const B = board.BOARD, PLAYER = 'astonmartin', TEAM_IDS = Object.keys(TEAMS);
  const byLevel = [...TEAM_IDS].sort((a, b) => TEAMS[b].carPerformance - TEAMS[a].carPerformance);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fresh = management.startManagement(PLAYER);
  const of = (state, kind) => finance.ledgerOf(state.finance, state.playerTeamId).filter(entry => entry.kind === kind);
  /** Resultado con los dos coches del jugador en esos puestos (null: no clasificado). */
  const result = (first, second, team = PLAYER) => [{ teamId: team, position: first, points: 0 }, { teamId: team, position: second, points: 0 }, { teamId: 'otro', position: 1, points: 25 }];
  const settle = (state, round, rows, format = 'gp') => management.settleManagementRound(state, { round, format, points: {}, result: rows });
  const withConfidence = (state, confidence) => ({ ...state, board: { ...state.board, confidence } });

  await test('T4.10: objetivo de la temporada', () => {
    assert(byLevel.every((team, i) => board.seasonObjective(team) === i + 1), 'T4.10: el objetivo de cada equipo es el puesto que corresponde al nivel de su coche', byLevel.map(team => `${team} ${board.seasonObjective(team)}.º`).join(' · '));
    assert(fresh.board.objective === board.seasonObjective(PLAYER) && fresh.board.confidence === B.START && fresh.board.history.length === 0 && B.START > 0 && B.START < 100, 'T4.10: la partida empieza con el objetivo del equipo del jugador y una confianza intermedia');
  });

  await test('T4.10: la confianza se mueve con cada Gran Premio', () => {
    const expected = board.expectedBest(fresh.board.objective);
    const better = settle(fresh, 1, result(1, 14)), worse = settle(fresh, 1, result(19, 20)), asExpected = settle(fresh, 1, result(expected, 20));
    assert(better.board.confidence > B.START && worse.board.confidence < B.START && asExpected.board.confidence === B.START, 'T4.10: sube con un resultado mejor de lo esperado, baja con uno peor y no se mueve con el esperado',
      `${worse.board.confidence} / ${asExpected.board.confidence} / ${better.board.confidence}`);
    const last = state => state.board.history[state.board.history.length - 1];
    assert(last(better).round === 1 && last(better).delta === better.board.confidence - B.START && /por encima/i.test(last(better).reason) && /por debajo/i.test(last(worse).reason) && asExpected.board.history.length === 0,
      'T4.10: cada movimiento queda anotado con su ronda y su motivo', JSON.stringify(last(better)));
    const out = settle(fresh, 1, result(null, null));
    assert(out.board.confidence < worse.board.confidence || out.board.confidence === B.START - B.MAX_STEP, 'T4.10: sin ningún coche clasificado baja lo máximo de una ronda', String(out.board.confidence));
    assert(Math.abs(better.board.confidence - B.START) <= B.MAX_STEP && Math.abs(worse.board.confidence - B.START) <= B.MAX_STEP, 'T4.10: una sola carrera no mueve la confianza más de un tope');
    assert(settle(fresh, 2, result(1, 2), 'sprint').board.confidence === B.START, 'T4.10: el sprint no mueve la confianza');
    const skipped = management.settleManagementRound(fresh, { round: 1, format: 'saltada', points: {} });
    assert(skipped.board.confidence === B.START - B.SKIP_PENALTY && /saltada/i.test(last(skipped).reason), 'T4.10: saltar una ronda la baja, y lo dice');
    assert(settle(better, 1, result(19, 20)) === better, 'T4.10: repetir la liquidación de una ronda no mueve la confianza otra vez');
    const broke = { ...fresh, finance: finance.spend(fresh.finance, PLAYER, { round: 1, kind: 'obra', label: 'x', amount: finance.balanceOf(fresh.finance, PLAYER) + finance.FINANCE.DEBT_LIMIT }).state };
    const debt = settle(broke, 1, result(expected, 20));
    assert(debt.board.confidence === B.START - B.DEBT_PENALTY && /deuda/i.test(last(debt).reason), 'T4.10: cada ronda en el límite de deuda baja la confianza');
    assert(settle(withConfidence(fresh, 2), 1, result(19, 20)).board.confidence === 0 && settle(withConfidence(fresh, 99), 1, result(1, 2)).board.confidence === 100, 'T4.10: la confianza no baja de 0 ni pasa de 100');
    // Solo cuenta el equipo del jugador.
    assert(settle(fresh, 1, result(1, 2, 'mclaren')).board.confidence < B.START, 'T4.10: el resultado de otro equipo no cuenta como propio');
  });

  await test('T4.10: balance al cerrar la temporada', () => {
    const objective = fresh.board.objective;
    const orderWith = place => { const others = TEAM_IDS.filter(team => team !== PLAYER); others.splice(place - 1, 0, PLAYER); return others; };
    const met = management.closeManagementSeason(fresh, orderWith(objective));
    assert(met.board.lastOutcome.met && met.board.lastOutcome.position === objective && met.board.lastOutcome.objective === objective && met.board.lastOutcome.season === 1 && !met.board.lastOutcome.dismissed, 'T4.10: con el objetivo cumplido el balance lo dice', JSON.stringify(met.board.lastOutcome));
    assert(of(met, 'junta').length === 1 && of(met, 'junta')[0].amount === B.BONUS && met.board.confidence === Math.min(100, B.START + B.CLOSE_STEP) && met.board.history.length === 0, 'T4.10: la junta paga una prima, sube la confianza y empieza la temporada con el historial limpio');
    const missed = management.closeManagementSeason(fresh, orderWith(Math.min(10, objective + 3)));
    assert(!missed.board.lastOutcome.met && of(missed, 'junta').length === 1 && of(missed, 'junta')[0].amount === -B.CUT_PER_PLACE * 3 && missed.board.confidence < B.START && !missed.board.lastOutcome.dismissed, 'T4.10: sin cumplirlo hay un recorte por cada puesto de diferencia y la confianza baja');
    assert(met.board.objective <= objective && missed.board.objective >= objective && missed.board.objective <= 10 && met.board.objective >= 1, 'T4.10: el objetivo nuevo se ajusta a cómo fue la temporada', `${met.board.objective} tras cumplir, ${missed.board.objective} tras fallar`);
  });

  await test('T4.10: destitución y oferta de otro equipo', () => {
    const last = TEAM_IDS.filter(team => team !== PLAYER).concat(PLAYER);
    const fired = management.closeManagementSeason(withConfidence(fresh, 0), last);
    const lower = byLevel[byLevel.indexOf(PLAYER) + 1];
    assert(fired.board.lastOutcome.dismissed && fired.board.lastOutcome.fromTeamId === PLAYER && fired.board.lastOutcome.toTeamId === lower && fired.playerTeamId === lower, 'T4.10: con la confianza a cero al cierre, el jugador pasa al equipo siguiente de menor nivel', `${PLAYER} → ${fired.playerTeamId}`);
    assert(fired.board.confidence === B.START && fired.board.objective >= board.seasonObjective(lower) - 1 && same(fired.facilities, fresh.facilities) && finance.balanceOf(fired.finance, lower) === finance.balanceOf(management.closeManagementSeason(fresh, last).finance, lower),
      'T4.10: en el equipo nuevo empieza con confianza intermedia y con el dinero y las instalaciones de ese equipo');
    assert(of({ ...fired, playerTeamId: PLAYER }, 'junta').length === 0 && of(fired, 'junta').length === 0, 'T4.10: en una destitución la junta no reparte prima ni recorte');
    const bottom = byLevel[9];
    const worst = management.startManagement(bottom);
    const kept = management.closeManagementSeason(withConfidence(worst, 0), byLevel);
    assert(kept.playerTeamId === bottom && kept.board.lastOutcome.dismissed === false && kept.board.confidence === B.LAST_CHANCE && kept.board.lastOutcome.lastChance === true, 'T4.10: quien dirige el equipo de menos nivel no tiene adónde ir: la junta le da otra temporada');
    const safe = management.closeManagementSeason(withConfidence(fresh, 5), last);
    assert(safe.playerTeamId === PLAYER, 'T4.10: con algo de confianza al cierre no hay destitución');
  });

  await test('T4.10: guardado, aviso e interfaz', async () => {
    const moved = settle(fresh, 1, result(1, 14));
    assert(same(management.parseManagement(JSON.stringify(moved), 'ferrari'), moved), 'T4.10: la junta vuelve igual tras guardar');
    const { board: saved, ...before } = fresh;
    assert(saved && same(management.parseManagement(JSON.stringify(before), PLAYER).board, fresh.board) && !management.isManagement({ ...fresh, board: { objective: 0, confidence: 500, history: 'x' } }), 'T4.10: una gestión guardada sin junta empieza con la inicial y una ilegible se rechaza');
    const allDrivers = comps.emptyComponents();
    const pendingOf = state => hub.pendingDecisions({ teamId: PLAYER, management: state, program: dev.emptyProgram(), components: allDrivers, raceIndex: 0 }).map(item => item.id);
    assert(pendingOf(withConfidence(fresh, B.WARNING - 1)).includes('junta-baja') && !pendingOf(fresh).includes('junta-baja'), 'T4.10: con la confianza baja, Inicio lo avisa');
    const html = await render('/src/components/BoardPanel.tsx', 'BoardPanel', { board: moved.board });
    assert(/Junta/.test(html) && html.includes(String(moved.board.confidence)) && new RegExp(`${moved.board.objective}\\.º`).test(html) && html.includes(moved.board.history[0].reason) && /\+\d/.test(html), 'T4.10: el panel enseña la confianza, el objetivo y el último movimiento con su motivo', html.slice(0, 240));
    const low = await render('/src/components/BoardPanel.tsx', 'BoardPanel', { board: withConfidence(fresh, 10).board });
    assert(/en riesgo/i.test(low) && !/en riesgo/i.test(html), 'T4.10: con la confianza baja el panel dice que el puesto está en riesgo');
  });
}
