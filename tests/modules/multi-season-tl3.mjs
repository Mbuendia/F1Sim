// TL3 — Libreas por año (Sprint 12). Alcance elegido por el usuario el 16/11/2026 (las cuatro recomendaciones) y
// contrato aprobado ese día («Si sigue»):
//  1. Cada equipo tiene librea de 2023, 2024, 2025 y 2026, con dos colores y cuatro patrocinadores; cada año los diez
//     coches se distinguen y ningún patrocinador se repite en la parrilla.
//  2. Ningún patrocinador ni nombre de equipo lleva una marca real.
//  3. El nombre largo de cada equipo es el de su año y el corto no cambia.
//  4. Desde 2027 la librea cambia cada año (colores que se mueven poco, uno o dos patrocinadores nuevos) y con la misma
//     semilla sale la misma.
//  5. La librea sale del año y la semilla de la partida: al guardar y cargar es la misma.
//  6. En la carrera profesional se ve la del año: carrera 3D, resultados (nombre largo), retratos de la partida nueva e
//     inicio.
//  7. La carrera libre, el multijugador y las partidas antiguas siguen con la librea y los nombres de siempre.
import { readFileSync } from 'node:fs';

const YEARS = [2023, 2024, 2025, 2026];
const hex = /^#[0-9a-f]{6}$/i;
/** Marcas reales que no pueden aparecer en un patrocinador (como en R55, ampliada con las de 2023 a 2026). */
const REAL_SPONSORS = ['oracle', 'red bull', 'redbull', 'ferrari', 'hp', 'mercedes', 'amg', 'petronas', 'mclaren', 'aston', 'martin', 'aramco', 'williams', 'visa', 'cash app', 'moneygram', 'haas', 'bwt', 'alpine', 'stake', 'kick', 'sauber',
  'shell', 'santander', 'mobil', 'google', 'chrome', 'mastercard', 'ineos', 'pirelli', 'rolex', 'dhl', 'heineken', 'qatar', 'aws', 'amazon', 'lenovo', 'crypto', 'atlassian', 'cognizant', 'tag heuer', 'puma', 'castrol', 'okx', 'audi', 'cadillac', 'renault', 'honda', 'ford',
  'bybit', 'dell', 'arrow', 'ray-ban', 'richard mille', 'qualcomm', 'tommy hilfiger', 'microsoft', 'duracell', 'gulf', 'kraken', 'komatsu', 'barclays', 'alphatauri', 'alpha tauri', 'orlen', 'hugo boss', 'uber', 'palfinger', 'chipotle', 'mapfre', 'salesforce', 'kit kat', 'alfa romeo', 'revolut', 'bitpanda', 'toyota', 'adidas'];
/** Marcas que no pueden aparecer como palabra en el nombre de un equipo («Red Bulla» o «Haasta» no cuentan). */
const REAL_IN_NAMES = ['Oracle', 'Petronas', 'Aramco', 'Cognizant', 'BWT', 'Kick', 'Stake', 'MoneyGram', 'Visa', 'Cash App', 'Alfa Romeo', 'AlphaTauri', 'Alpha Tauri', 'Audi', 'Cadillac', 'Toyota', 'Ferrari', 'Mercedes', 'McLaren', 'Red Bull', 'Aston Martin', 'Williams', 'Haas', 'Alpine', 'Sauber', 'Honda', 'Ford'];
const word = term => new RegExp(`(?<![\\p{L}\\p{N}_-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u');
const realSponsor = s => { const v = s.toLowerCase(); return REAL_SPONSORS.some(b => v === b || v.split(/\s+/).includes(b) || (b.length > 3 && v.includes(b))); };

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const seasons = await load('/src/data/seasons.ts');
  const { TEAMS } = await load('/src/data/teams.ts');
  const { LIVERIES } = await load('/src/data/liveries.ts');
  const career = await load('/src/simulation/Career.ts');
  const season = await load('/src/simulation/Season.ts');
  const save = await load('/src/simulation/SaveGame.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const teamIds = Object.keys(TEAMS);

  await test('TL3.1: una librea por equipo y año', () => {
    for (const y of YEARS) {
      const form = seasons.teamFormFor(y);
      const liveries = teamIds.map(t => form[t].livery);
      assert(liveries.every(l => l && hex.test(l.primary) && hex.test(l.secondary) && l.primary.toLowerCase() !== l.secondary.toLowerCase() && l.sponsors.length === 4),
        `TL3: en ${y} cada equipo tiene dos colores distintos y cuatro patrocinadores`);
      assert(new Set(liveries.map(l => `${l.primary}|${l.secondary}`.toLowerCase())).size === 10, `TL3: en ${y} los diez coches se distinguen`);
      const sponsors = liveries.flatMap(l => l.sponsors.map(s => s.toLowerCase()));
      assert(new Set(sponsors).size === sponsors.length && liveries.every(l => l.sponsors.every(s => s.length >= 3 && s.length <= 14)), `TL3: en ${y} ningún patrocinador se repite en la parrilla`);
    }
    const changed = teamIds.filter(t => JSON.stringify(seasons.teamFormFor(2023)[t].livery) !== JSON.stringify(seasons.teamFormFor(2026)[t].livery));
    assert(changed.length === 10, 'TL3: la librea de cada equipo cambia de 2023 a 2026', `${changed.length} de 10`);
  });

  await test('TL3.2: ninguna marca real', () => {
    const sponsors = YEARS.flatMap(y => teamIds.flatMap(t => seasons.teamFormFor(y)[t].livery.sponsors));
    const late = [2027, 2030, 2040].flatMap(y => teamIds.flatMap(t => seasons.seasonLivery(t, y, 7).sponsors));
    const hits = [...new Set([...sponsors, ...late])].filter(realSponsor);
    assert(hits.length === 0, 'TL3: ningún patrocinador es una marca real', hits.join(', ') || 'ok');
    const names = [...new Set(YEARS.flatMap(y => teamIds.map(t => seasons.teamFormFor(y)[t].name)))];
    const bad = names.filter(n => REAL_IN_NAMES.some(b => word(b).test(n)));
    assert(bad.length === 0, 'TL3: ningún nombre de equipo lleva una marca real', bad.join(', ') || 'ok');
  });

  await test('TL3.3: el nombre de cada año', () => {
    const name = (y, t) => seasons.teamFormFor(y)[t].name;
    assert(/Alfa/.test(name(2023, 'sauber')) && name(2023, 'sauber') !== name(2026, 'sauber') && /Audiencia/.test(name(2026, 'sauber')), 'TL3: el Steak Sauber de 2023 es un Alfa de parodia y en 2026 lleva el nombre de Audiencia', `${name(2023, 'sauber')} · ${name(2026, 'sauber')}`);
    assert(/Alfa/.test(name(2023, 'racingbulls')) && name(2023, 'racingbulls') !== name(2024, 'racingbulls'), 'TL3: el Racing Bueyes de 2023 lleva el nombre de parodia de entonces', `${name(2023, 'racingbulls')} · ${name(2024, 'racingbulls')}`);
    assert(teamIds.every(t => YEARS.every(y => typeof name(y, t) === 'string' && name(y, t).length > 3)), 'TL3: cada equipo tiene nombre largo cada año');
    const sim = new RaceSimulation('barcelona');
    sim.setTeamForm(seasons.teamFormFor(2023));
    const car = sim.cars.find(c => c.team.id === 'sauber');
    assert(car.team.name === name(2023, 'sauber') && car.team.shortName === TEAMS.sauber.shortName, 'TL3: en carrera el coche lleva el nombre largo del año y el corto de siempre', `${car.team.name} · ${car.team.shortName}`);
  });

  await test('TL3.4: desde 2027 la librea evoluciona con la semilla', () => {
    const a = seasons.seasonLivery('mclaren', 2028, 5), b = seasons.seasonLivery('mclaren', 2028, 5), c = seasons.seasonLivery('mclaren', 2028, 6);
    assert(JSON.stringify(a) === JSON.stringify(b), 'TL3: con la misma semilla sale la misma librea');
    assert(JSON.stringify(a) !== JSON.stringify(c), 'TL3: con otra semilla sale otra');
    const base = seasons.teamFormFor(2026);
    const y27 = teamIds.map(t => [t, seasons.seasonLivery(t, 2027, 5)]);
    assert(y27.every(([t, l]) => l.sponsors.filter((s, i) => s !== base[t].livery.sponsors[i]).length >= 1 && l.sponsors.filter((s, i) => s !== base[t].livery.sponsors[i]).length <= 2), 'TL3: en 2027 cambian uno o dos patrocinadores de cada equipo');
    const dist = (p, q) => { const n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const [x, y] = [n(p), n(q)]; return Math.max(...x.map((v, i) => Math.abs(v - y[i]))); };
    const far = [2027, 2031, 2045].flatMap(y => teamIds.map(t => dist(seasons.seasonLivery(t, y, 5).primary, base[t].livery.primary)));
    assert(far.every(d => d <= 48) && far.some(d => d > 0), 'TL3: los colores se mueven poco: el equipo se sigue reconociendo', `máximo ${Math.max(...far)}`);
    const sponsors = teamIds.flatMap(t => seasons.seasonLivery(t, 2033, 5).sponsors.map(s => s.toLowerCase()));
    assert(new Set(sponsors).size === sponsors.length, 'TL3: tampoco se repiten patrocinadores en la parrilla de un año sin fin');
    const evolved = seasons.evolveForm(base, 2027, { legacy: {} }, 5);
    assert(JSON.stringify(evolved.mclaren.livery) === JSON.stringify(seasons.seasonLivery('mclaren', 2027, 5)) && evolved.mclaren.name === base.mclaren.name, 'TL3: el coche de 2027 lleva la librea de 2027 de la partida y el nombre de 2026');
  });

  await test('TL3.5: se guarda y se recupera', () => {
    const started = career.newCareer('alpine', 'Prueba', 4, 2023);
    const game = save.createSave({ name: 'Prueba', savedAt: '2026-11-16T10:00:00.000Z', career: started.career, selection: started.selection, race: null });
    const back = save.importSave(save.exportSave(game));
    assert(back.save && JSON.stringify(season.seasonForm(save.savedSeason(back.save)).alpine.livery) === JSON.stringify(seasons.teamFormFor(2023).alpine.livery), 'TL3: la librea del año se recupera al cargar');
  });

  await test('TL3.6: se ve en la carrera profesional', () => {
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(!/liveryFor\(car\.team\.id\)/.test(scene) && /carLivery\(car\.team\)/.test(scene), 'TL3: la carrera 3D viste cada coche con la librea de su equipo ese año');
    const { carLivery } = { carLivery: null, ...seasons };
    void carLivery;
    const sim = new RaceSimulation('barcelona');
    sim.setTeamForm(seasons.teamFormFor(2024));
    const car = sim.cars.find(c => c.team.id === 'ferrari');
    assert(JSON.stringify(car.team.livery) === JSON.stringify(seasons.teamFormFor(2024).ferrari.livery), 'TL3: el coche lleva la librea del año');
    const portraits = readFileSync('src/components/NewCareerScreen.tsx', 'utf8');
    assert(/buildCarPortraits\([^)]*startYear/.test(portraits) || /portraitsFor\(startYear\)/.test(portraits), 'TL3: los retratos de la partida nueva son los del año elegido');
    const hub = readFileSync('src/components/HomeScreen.tsx', 'utf8');
    assert(/inspectedTeam\.livery/.test(hub), 'TL3: el coche del inicio lleva la librea del año');
  });

  await test('TL3.7: carrera libre, multijugador y partidas antiguas sin cambios', () => {
    const sim = new RaceSimulation('barcelona');
    assert(sim.cars.every(c => c.team.livery === undefined && c.team.name === TEAMS[c.team.id].name), 'TL3: sin año, cada coche con el nombre de siempre y sin librea del año');
    assert(teamIds.every(t => LIVERIES[t].primary.toLowerCase() === TEAMS[t].color.toLowerCase()), 'TL3: la librea de siempre no cambia');
    const old = { ...seasons.teamFormFor(2025) };
    for (const t of teamIds) { const { livery, name, ...rest } = old[t]; old[t] = rest; void livery; void name; }
    sim.setTeamForm(old);
    assert(sim.cars.every(c => c.team.livery === undefined && c.team.name === TEAMS[c.team.id].name), 'TL3: una partida de TL2 (fuerza sin librea) corre con la librea y los nombres de siempre');
  });
}
