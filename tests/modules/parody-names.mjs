// Nombres de parodia (PROPUESTA DE CONTRATO, 20/10/2026).
// Petición del usuario: cambiar los nombres y marcas reales del juego por nombres cómicos que se parezcan a los reales,
// sacados de memes y apodos de la afición. Lista aprobada por el usuario el 20/10/2026, con «F-UNO RACE MANAGER» como
// nombre del juego y solo el Red Bull Ring cambiado entre los circuitos. Los identificadores internos (`verstappen`,
// `ferrari`…) y las siglas de tres letras no cambian: las partidas guardadas y la lógica siguen igual.
//  1. Pilotos: nombre y apellido de la lista; siglas, dorsales y equipos como estaban.
//  2. Equipos y motores: nombre largo, corto, fabricante y modelo de la lista.
//  3. Marcas en pantalla: F-UNO RACE MANAGER y F-UNO TIMING, FAI en vez de FIA, Pirulí en vez de Pirelli, título de la
//     pestaña y el Red Bull Ring.
//  4. Ningún texto del juego conserva nombres reales de pilotos ni marcas de equipos, patrocinadores, neumáticos o de la
//     categoría. Excepción: la atribución de los modelos 3D, que su licencia obliga a citar con su título original.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DRIVER_NAMES = {
  verstappen: ['Max', 'Verstoppen', 'VER'], lawson: ['Liam', 'Lawdós', 'LAW'], norris: ['Lando', 'Nowins', 'NOR'], piastri: ['Oscar', 'Piastry', 'PIA'],
  hamilton: ['Lewis', 'Hammertime', 'HAM'], leclerc: ['Charles', 'Lecheking', 'LEC'], russell: ['George', 'Rusábado', 'RUS'], antonelli: ['Kimi', 'Antobambino', 'ANT'],
  alonso: ['Fernando', 'Alonsoplán', 'ALO'], stroll: ['Lance', 'Strollercoaster', 'STR'], gasly: ['Pierre', 'Gasolina', 'GAS'], doohan: ['Jack', 'Doomhan', 'DOO'],
  sainz: ['Carlos', 'Sainzoperator', 'SAI'], albon: ['Alex', 'Albonjour', 'ALB'], tsunoda: ['Yuki', 'Tsunami', 'TSU'], hadjar: ['Isack', 'Hadjhog', 'HAD'],
  hulkenberg: ['Nico', 'Hulksmash', 'HUL'], bortoleto: ['Gabriel', 'Bortolotería', 'BOR'], ocon: ['Esteban', 'Oconamatata', 'OCO'], bearman: ['Oliver', 'Bearmanía', 'BEA'],
};
const TEAM_NAMES = {
  mclaren: ['McPapaya Racing', 'McPapaya'], redbull: ['Oráculo Red Bulla Racing', 'Red Bulla'], ferrari: ['Scudería Errari Plan B', 'Errari'],
  mercedes: ['Totocedes-AMG Petrolas', 'Totocedes'], astonmartin: ['Aston Papá Stroll Team', 'Aston Papá'], williams: ['Vowlliams Racing', 'Vowlliams'],
  racingbulls: ['Bizum Cash App RB', 'Racing Bueyes'], haas: ['MoneyGramo Haasta Luego', 'Haasta Luego'], alpine: ['BWT Alpino Grigio', 'Alpino Grigio'],
  sauber: ['Steak Team Kick Salsa', 'Steak Sauber'],
};
const ENGINES = {
  'Totocedes-AMG': 'Totocedes-AMG F-Uno M15 E Performance 1.6L V6 Turbo', 'Hondamental RBPT': 'Hondamental RBPT RBPTH002 1.6L V6 Turbo',
  'Scudería Errari': 'Errari 066/12 1.6L V6 Turbo', Renol: 'Renol E-Tech RE24 1.6L V6 Turbo',
};
/** Lo que no puede quedar en ningún texto del juego (con límites de palabra: «Red Bulla» o «Haasta» no cuentan). */
const REAL_DRIVERS = ['Max Verstappen', 'Liam Lawson', 'Lando Norris', 'Oscar Piastri', 'Lewis Hamilton', 'Charles Leclerc', 'George Russell', 'Kimi Antonelli',
  'Fernando Alonso', 'Lance Stroll', 'Pierre Gasly', 'Jack Doohan', 'Carlos Sainz', 'Alex Albon', 'Yuki Tsunoda', 'Isack Hadjar', 'Nico Hülkenberg', 'Nico Hulkenberg',
  'Gabriel Bortoleto', 'Esteban Ocon', 'Oliver Bearman'];
const SURNAMES = ['Verstappen', 'Lawson', 'Norris', 'Piastri', 'Hamilton', 'Leclerc', 'Russell', 'Antonelli', 'Alonso', 'Gasly', 'Doohan', 'Sainz', 'Albon', 'Tsunoda',
  'Hadjar', 'Hülkenberg', 'Hulkenberg', 'Bortoleto', 'Ocon', 'Bearman'];
const BRANDS = ['McLaren', 'Ferrari', 'Mercedes', 'Red Bull', 'Aston Martin', 'Williams', 'Haas', 'Alpine', 'Oracle', 'Petronas', 'PETRONAS', 'Aramco', 'MoneyGram',
  'Visa Cash', 'Stake', 'Honda', 'Renault', 'Pirelli', 'FIA', 'Formula 1', 'Fórmula 1', 'F1 RACE MANAGER', 'F1 TIMING', 'F1'];
const word = term => new RegExp(`(?<![\\p{L}\\p{N}_-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u');

/** Código sin comentarios (lo que puede acabar en pantalla). */
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const files = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : []; });

export default async function run({ server, assert, test }) {
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');

  await test('Parodia: pilotos', () => {
    for (const [id, [first, last, code]] of Object.entries(DRIVER_NAMES)) {
      const d = DRIVERS[id];
      assert(d && d.firstName === first && d.lastName === last && d.code === code, `Parodia: ${id} → ${first} ${last} (${code})`, d && `${d.firstName} ${d.lastName} (${d.code})`);
    }
    assert(Object.keys(DRIVERS).length === Object.keys(DRIVER_NAMES).length, 'Parodia: los 20 pilotos, ni uno más', String(Object.keys(DRIVERS).length));
  });

  await test('Parodia: equipos y motores', () => {
    for (const [id, [name, short]] of Object.entries(TEAM_NAMES)) {
      const t = TEAMS[id];
      assert(t && t.name === name && t.shortName === short, `Parodia: ${id} → ${name} / ${short}`, t && `${t.name} / ${t.shortName}`);
      assert(t && ENGINES[t.engineManufacturer] === t.engineModel, `Parodia: motor de ${id} (${t?.engineManufacturer})`, t && t.engineModel);
    }
    assert(OFFICIAL_CIRCUITS.spielberg?.name === 'Red Bulla Ring', 'Parodia: el Red Bull Ring pasa a Red Bulla Ring', OFFICIAL_CIRCUITS.spielberg?.name);
  });

  await test('Parodia: marcas en pantalla', () => {
    const home = readFileSync('src/components/HomeScreen.tsx', 'utf8');
    assert(home.includes('F-UNO RACE MANAGER') && !home.includes('F1 RACE MANAGER'), 'Parodia: el juego se llama F-UNO RACE MANAGER');
    const board = readFileSync('src/components/Leaderboard.tsx', 'utf8');
    assert(board.includes('F-UNO TIMING') && !board.includes('F1 TIMING'), 'Parodia: la tabla es F-UNO TIMING');
    assert(/<title>F-Uno Sim/.test(readFileSync('index.html', 'utf8')), 'Parodia: la pestaña del navegador dice F-Uno Sim');
    const rules = readFileSync('src/rules/ruleSets.ts', 'utf8');
    assert(rules.includes("'FAI 2025 (reglas oficiales)'"), 'Parodia: el perfil de reglas es de la FAI');
    assert(readFileSync('src/simulation/Spy.ts', 'utf8').includes('Multa de la FAI por espionaje'), 'Parodia: la multa del espionaje la pone la FAI');
    const tyreText = files('src').map(f => stripComments(readFileSync(f, 'utf8'))).join('\n');
    assert(tyreText.includes('Pirulí') && !word('Pirelli').test(tyreText), 'Parodia: los neumáticos son Pirulí');
  });

  await test('Parodia: ningún nombre ni marca real en los textos del juego', () => {
    const allowed = new Set(['src/data/liveries.ts']); // atribución obligatoria de los modelos 3D (CC BY)
    const hits = [];
    for (const f of files('src')) {
      if (allowed.has(f.replace(/\\/g, '/'))) continue;
      const text = stripComments(readFileSync(f, 'utf8'));
      for (const term of [...REAL_DRIVERS, ...SURNAMES, ...BRANDS]) {
        const m = text.match(word(term));
        if (m) hits.push(`${f.replace(/\\/g, '/')}: ${term}`);
      }
    }
    // De index.html solo cuenta lo que se ve: el título de la pestaña (el índice de tareas del dashboard que lleva dentro no se pinta).
    const title = readFileSync('index.html', 'utf8').match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    for (const term of [...BRANDS, 'F1 Sim']) if (word(term).test(title)) hits.push(`index.html <title>: ${term}`);
    assert(hits.length === 0, 'Parodia: ni pilotos ni marcas reales en el código del juego (sin contar comentarios)', hits.slice(0, 25).join(' | '));
  });
}
