// T4.9 — Patrocinadores (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Importes, objetivos y duración de los
// contratos son diseño del juego: el test los lee del módulo.
//  1. Tres huecos por equipo (las superficies del coche); cada equipo empieza con dos contratos y un hueco libre con
//     ofertas: una de pago seguro y otras con menos fijo y una prima por objetivo.
//  2. Ninguna marca real: ni en los contratos iniciales ni en las ofertas.
//  3. Objetivos comprobables con el resultado oficial: los dos coches en los puntos, un podio o acabar por delante de
//     un equipo.
//  4. El pago fijo llega con cada Gran Premio y la prima cuando se cumple el objetivo; todo sale en el libro; el
//     sprint, la ronda saltada y la carrera libre no pagan patrocinio.
//  5. Firmar una oferta ocupa un hueco; sin hueco no se firma. Al cambiar de temporada vencen contratos y se renuevan
//     las ofertas.
//  6. Rivales: firman la mejor oferta cuando tienen un hueco.
//  7. El coche del paddock lleva los patrocinadores firmados; se guarda y se carga; test de interfaz.
//  8. Revisión en el navegador (manual; en el dashboard).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const sp = await server.ssrLoadModule('/src/simulation/Sponsors.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const { LIVERIES } = await server.ssrLoadModule('/src/data/liveries.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { classify, constructorStandings, POINTS_2025 } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const TEAM_IDS = Object.keys(TEAMS), PLAYER = 'astonmartin';
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fresh = management.startManagement(PLAYER);
  const mine = state => state.sponsors.teams[PLAYER];
  const of = (state, team, kind) => finance.ledgerOf(state.finance, team).filter(entry => entry.kind === kind);
  /** Resultado final con los pilotos en ese orden de llegada. */
  const resultOf = order => {
    const rows = classify(order.map((driver, i) => ({
      carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name,
      laps: 50, timeSec: 5000 + i, penaltySec: 0, retired: false, dsq: false, progress: 50,
    })), { totalLaps: 50, suspended: false, greenLaps: 50 });
    return { status: 'final', endReason: 'distancia', rows, pointsTable: POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
  };
  const drivers = Object.values(DRIVERS);
  const own = drivers.filter(driver => driver.teamId === PLAYER), rest = drivers.filter(driver => driver.teamId !== PLAYER);
  /** Orden de llegada con los dos coches del jugador en esos puestos (1 = primero). */
  const withOwnAt = (first, second) => { const order = [...rest]; order.splice(first - 1, 0, own[0]); order.splice(second - 1, 0, own[1]); return order; };

  await test('T4.9: tres huecos, dos contratos y ofertas', () => {
    assert(sp.SPONSOR_SLOTS === 3, 'T4.9: tres huecos por equipo');
    assert(TEAM_IDS.every(team => { const t = fresh.sponsors.teams[team]; return t.deals.length === 2 && same(t.deals.map(deal => deal.name), LIVERIES[team].sponsors.slice(0, 2)) && t.deals.every(deal => deal.goal === null && Number.isInteger(deal.perRound) && deal.perRound > 0 && deal.untilSeason >= 1); }),
      'T4.9: cada equipo empieza con dos contratos de pago seguro, los dos primeros patrocinadores de su coche');
    const offers = mine(fresh).offers;
    assert(offers.length >= 3 && new Set(offers.map(offer => offer.id)).size === offers.length && offers.some(offer => offer.goal === null) && offers.filter(offer => offer.goal !== null).length >= 2,
      'T4.9: el hueco libre tiene al menos tres ofertas: una de pago seguro y otras con objetivo', offers.map(offer => `${offer.name} ${offer.perRound}${offer.goal ? '+' + offer.bonus : ''}`).join(' · '));
    const safe = offers.find(offer => offer.goal === null);
    assert(offers.filter(offer => offer.goal !== null).every(offer => offer.perRound < safe.perRound && offer.bonus > 0 && offer.perRound + offer.bonus > safe.perRound), 'T4.9: una oferta con objetivo paga menos fijo que la segura y más si el objetivo se cumple');
    const value = team => fresh.sponsors.teams[team].deals[0].perRound;
    assert(value('mclaren') > value('sauber'), 'T4.9: los patrocinadores pagan más a los equipos de más nivel', `${value('mclaren')} frente a ${value('sauber')}`);
    assert(same(management.startManagement(PLAYER).sponsors, fresh.sponsors) && !same(management.startManagement(PLAYER, 1, 77).sponsors.teams[PLAYER].offers, mine(fresh).offers), 'T4.9: las ofertas salen de la semilla de la partida');
  });

  await test('T4.9: ninguna marca real', () => {
    // La misma lista que usa el test de R55 para los rótulos de los coches.
    const real = ['oracle', 'red bull', 'redbull', 'ferrari', 'hp', 'mercedes', 'amg', 'petronas', 'mclaren', 'aston', 'martin', 'aramco', 'williams', 'visa', 'cash app', 'moneygram', 'haas', 'bwt', 'alpine', 'stake', 'kick', 'sauber',
      'shell', 'santander', 'google', 'pirelli', 'rolex', 'heineken', 'dhl', 'emirates', 'qatar', 'lenovo', 'aws', 'salesforce', 'ineos', 'mobil', 'castrol', 'tag heuer', 'puma', 'adidas', 'coca', 'pepsi', 'monster', 'rokit', 'dell', 'cognizant', 'tiktok', 'crypto', 'binance'];
    const names = [...sp.SPONSOR_POOL, ...[1, 2, 3, 4, 5].flatMap(seed => TEAM_IDS.flatMap(team => { const t = management.startManagement(PLAYER, 1, seed).sponsors.teams[team]; return [...t.deals, ...t.offers].map(deal => deal.name); }))].map(name => name.toLowerCase());
    const hits = [...new Set(names)].filter(name => real.some(brand => name === brand || name.split(/\s+/).includes(brand) || (brand.length > 3 && name.includes(brand))));
    assert(sp.SPONSOR_POOL.length >= 12 && new Set(sp.SPONSOR_POOL).size === sp.SPONSOR_POOL.length && hits.length === 0, 'T4.9: ni los contratos ni las ofertas llevan marcas reales', hits.join());
    assert(TEAM_IDS.every(team => { const t = fresh.sponsors.teams[team]; const all = [...t.deals, ...t.offers].map(deal => deal.name); return new Set(all).size === all.length; }), 'T4.9: un equipo no recibe una oferta de un patrocinador que ya tiene');
  });

  await test('T4.9: objetivos con el resultado oficial', () => {
    const rows = order => resultOf(order).rows;
    const both = { kind: 'ambos-puntos' }, podium = { kind: 'podio' }, ahead = { kind: 'delante-de', rivalTeamId: 'williams' };
    assert(sp.goalMet(both, PLAYER, rows(withOwnAt(4, 10))) && !sp.goalMet(both, PLAYER, rows(withOwnAt(4, 11))), 'T4.9: «los dos coches en los puntos» se cumple con los dos entre los diez primeros');
    assert(sp.goalMet(podium, PLAYER, rows(withOwnAt(3, 18))) && !sp.goalMet(podium, PLAYER, rows(withOwnAt(4, 5))), 'T4.9: «un podio» se cumple con un coche entre los tres primeros');
    const williamsBest = order => Math.min(...rows(order).filter(row => row.teamId === 'williams' && row.position).map(row => row.position));
    const front = withOwnAt(1, 20), back = withOwnAt(19, 20);
    assert(sp.goalMet(ahead, PLAYER, rows(front)) && williamsBest(front) > 1 && !sp.goalMet(ahead, PLAYER, rows(back)) && williamsBest(back) < 19, 'T4.9: «acabar por delante de un equipo» compara el mejor coche de cada uno');
    // Un coche descalificado o no clasificado no cuenta.
    const dsq = rows(withOwnAt(2, 5)).map(row => (row.teamId === PLAYER && row.position === 2 ? { ...row, position: null, status: 'DSQ', points: 0 } : row));
    assert(!sp.goalMet(podium, PLAYER, dsq) && !sp.goalMet(both, PLAYER, dsq), 'T4.9: un coche descalificado no cumple objetivos');
    assert([both, podium, ahead].every(goal => sp.goalText(goal).length > 5) && sp.goalText(ahead).includes(TEAMS.williams.shortName), 'T4.9: cada objetivo se explica con su texto', [both, podium, ahead].map(sp.goalText).join(' · '));
  });

  await test('T4.9: pagos y primas en el libro', () => {
    const offer = mine(fresh).offers.find(candidate => candidate.goal?.kind === 'ambos-puntos') ?? mine(fresh).offers.find(candidate => candidate.goal !== null);
    const signed = sp.signSponsor(fresh.sponsors, PLAYER, offer.id);
    assert(signed.ok && signed.state.teams[PLAYER].deals.length === 3 && signed.state.teams[PLAYER].deals[2].name === offer.name && signed.state.teams[PLAYER].offers.length === 0, 'T4.9: firmar una oferta ocupa el tercer hueco y retira las demás');
    const full = sp.signSponsor(signed.state, PLAYER, offer.id);
    assert(!full.ok && full.state === signed.state && full.reason && !sp.signSponsor(fresh.sponsors, PLAYER, 'no-existe').ok, 'T4.9: sin hueco libre o con una oferta desconocida no se firma', full.reason ?? '');
    const state = { ...fresh, sponsors: signed.state };
    const fixed = signed.state.teams[PLAYER].deals.reduce((sum, deal) => sum + deal.perRound, 0);
    // Resultado que cumple el objetivo firmado, sea cual sea.
    const good = resultOf(withOwnAt(1, 2)), bad = resultOf(withOwnAt(19, 20));
    const base = { championship: champ.emptyChampionship(), components: comps.emptyComponents(), program: dev.emptyProgram(), season: season.emptySeason(), archive: [], management: state };
    const race = { counts: true, id: 'gp-1', circuitId: SEASON_CALENDAR[0].circuitId, result: good, format: 'gp', raceKm: 300 };
    const paid = season.settleRace(base, race).management;
    assert(of(paid, PLAYER, 'patrocinio').length === 1 && of(paid, PLAYER, 'patrocinio')[0].amount === fixed && of(paid, PLAYER, 'patrocinio')[0].round === 1, 'T4.9: con el Gran Premio llega el pago fijo de los contratos, en una línea del libro');
    assert(of(paid, PLAYER, 'prima').length === 1 && of(paid, PLAYER, 'prima')[0].amount === offer.bonus && of(paid, PLAYER, 'prima')[0].label.includes(offer.name), 'T4.9: si el objetivo se cumple llega la prima, con el nombre del patrocinador');
    const unpaid = season.settleRace(base, { ...race, result: bad }).management;
    assert(of(unpaid, PLAYER, 'prima').length === 0 && of(unpaid, PLAYER, 'patrocinio')[0].amount === fixed, 'T4.9: si no se cumple, solo llega el pago fijo');
    assert(TEAM_IDS.every(team => of(paid, team, 'patrocinio').length === 1), 'T4.9: los rivales también cobran sus contratos');
    assert(same(season.settleRace({ ...base, management: paid }, race).management, paid), 'T4.9: el patrocinio no se cobra dos veces por la misma ronda');
    const sprint = season.settleRace({ ...base, season: { version: 1, skipped: [1] } }, { ...race, id: 's', circuitId: SEASON_CALENDAR[1].circuitId, format: 'sprint', tyres: {} }).management;
    const skipped = season.settleSkip(base).management;
    assert(of(sprint, PLAYER, 'patrocinio').length === 0 && of(sprint, PLAYER, 'prima').length === 0 && of(skipped, PLAYER, 'patrocinio').length === 0 && season.settleRace(base, { ...race, counts: false }).management === state,
      'T4.9: el sprint, la ronda saltada y la carrera libre no pagan patrocinio');
  });

  await test('T4.9: cambio de temporada y rivales', () => {
    const signed = sp.signSponsor(fresh.sponsors, PLAYER, mine(fresh).offers[0].id).state;
    const ends = signed.teams[PLAYER].deals.map(deal => deal.untilSeason);
    const closed = management.closeManagementSeason({ ...fresh, sponsors: signed }, TEAM_IDS);
    const after = closed.sponsors.teams[PLAYER];
    assert(after.deals.length === ends.filter(until => until > 1).length && after.deals.every(deal => deal.untilSeason > 1), 'T4.9: al cerrar la temporada vencen los contratos que llegaban hasta ella', `quedan ${after.deals.length} de 3`);
    assert((after.deals.length < 3 ? after.offers.length >= 3 : after.offers.length === 0) && after.offers.every(offer => offer.untilSeason >= 2 && !after.deals.some(deal => deal.name === offer.name)), 'T4.9: la temporada nueva trae ofertas nuevas para los huecos libres');
    const ai = sp.aiSignSponsors(fresh.sponsors, ['haas', 'sauber']);
    const best = team => [...fresh.sponsors.teams[team].offers].sort((a, b) => sp.offerValue(b) - sp.offerValue(a))[0];
    assert(['haas', 'sauber'].every(team => ai.teams[team].deals.length === 3 && ai.teams[team].deals[2].name === best(team).name) && ai.teams[PLAYER].deals.length === 2 && same(sp.aiSignSponsors(fresh.sponsors, ['haas', 'sauber']), ai),
      'T4.9: un rival con un hueco libre firma su mejor oferta, y siempre la misma');
  });

  await test('T4.9: coche, guardado e interfaz', async () => {
    const offer = mine(fresh).offers[1];
    const signed = { ...fresh, sponsors: sp.signSponsor(fresh.sponsors, PLAYER, offer.id).state };
    assert(same(sp.carSponsors(fresh.sponsors, PLAYER), [...LIVERIES[PLAYER].sponsors.slice(0, 2), '']) && same(sp.carSponsors(signed.sponsors, PLAYER), [...LIVERIES[PLAYER].sponsors.slice(0, 2), offer.name]),
      'T4.9: el coche lleva en sus tres superficies los patrocinadores firmados, y el hueco libre va vacío');
    assert(/sponsors\?:/.test(source('src/components/Car3DViewer.tsx')), 'T4.9: el visor del coche acepta los patrocinadores de la partida');
    assert(same(management.parseManagement(JSON.stringify(signed), 'ferrari'), signed), 'T4.9: los contratos y las ofertas vuelven igual tras guardar');
    const { sponsors, ...before } = fresh;
    assert(sponsors && same(management.parseManagement(JSON.stringify(before), PLAYER).sponsors, fresh.sponsors) && !management.isManagement({ ...fresh, sponsors: { version: 1, teams: { [PLAYER]: { deals: 'x' } } } }),
      'T4.9: una gestión guardada sin patrocinio empieza con el inicial y uno ilegible se rechaza');

    const html = await render('/src/components/SponsorsPanel.tsx', 'SponsorsPanel', { sponsors: mine(fresh), onSign() {} });
    assert(/Patrocinio/.test(html) && /2 de 3/.test(html) && mine(fresh).deals.every(deal => html.includes(deal.name) && html.includes(finance.formatMoney(deal.perRound))), 'T4.9: el panel enseña los contratos con su pago por ronda y los huecos ocupados', html.slice(0, 200));
    assert(mine(fresh).offers.every(candidate => html.includes(candidate.name) && (candidate.goal === null || html.includes(sp.goalText(candidate.goal)))) && (html.match(/Firmar/g) ?? []).length === mine(fresh).offers.length && !/disabled=""/.test(html),
      'T4.9: cada oferta dice su objetivo y se puede firmar');
    const fullHtml = await render('/src/components/SponsorsPanel.tsx', 'SponsorsPanel', { sponsors: mine(signed), onSign() {} });
    assert(/3 de 3/.test(fullHtml) && !/Firmar/.test(fullHtml) && fullHtml.includes(offer.name), 'T4.9: con los tres huecos ocupados no quedan ofertas que firmar');
  });
}
