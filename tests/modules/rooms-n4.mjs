// N4 — Salas en Firebase (PROPUESTA DE CONTRATO, 19/10/2026).
// RoomService no importa Firebase: recibe un adaptador de base de datos (en la aplicación, el de Firebase; aquí, la
// base simulada de tests/support/fakeDb.mjs). Lo que se prueba:
//  1. Código de sala: seis caracteres de un alfabeto sin los que se confunden (0/O, 1/I/L); validar, normalizar lo
//     que escribe el jugador y sacarlo de un enlace.
//  2. Crear sala: el anfitrión la reclama con una transacción, así que el código no se repite entre salas vivas; si
//     está ocupado se sortea otro; si se agotan los intentos, error claro.
//  3. Unirse por código o enlace: código inválido, sala inexistente y sala ya en carrera se rechazan con motivo.
//  4. Presencia: quién está; si se va un invitado, desaparece de la lista (aviso al resto); si se va el anfitrión, la
//     sala entera se borra y los invitados reciben «sala cerrada».
//  5. La foto del estado se guarda como objeto, no como texto (N1), y solo la escribe el anfitrión.
//  6. Reglas de acceso en el repositorio (database.rules.json): todo cerrado salvo /rooms; la regla temporal /n1 ya
//     no está; el anfitrión escribe la sala, cada invitado solo su presencia y su buzón.
import { readFileSync, existsSync } from 'node:fs';
import { createFakeServer } from '../support/fakeDb.mjs';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { ROOM_ALPHABET, generateRoomCode, normalizeRoomCode, isValidRoomCode, roomLink, codeFromLink } = await load('/src/net/roomCode.ts');
  const { createRoom, joinRoom, leaveRoom, watchRoom, publishState, ROOM_PATHS } = await load('/src/net/RoomService.ts');
  /** Azar fijo: devuelve los valores en orden y repite el último. */
  const seq = (...values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };
  const tick = () => new Promise(r => setTimeout(r, 0));

  await test('N4: código de sala', async () => {
    assert(ROOM_ALPHABET.length >= 28 && !/[0O1IL]/.test(ROOM_ALPHABET) && new Set(ROOM_ALPHABET).size === ROOM_ALPHABET.length,
      'N4: alfabeto sin caracteres que se confunden ni repetidos', ROOM_ALPHABET);
    const codes = Array.from({ length: 500 }, () => generateRoomCode());
    assert(codes.every(c => c.length === 6 && [...c].every(ch => ROOM_ALPHABET.includes(ch))), 'N4: seis caracteres del alfabeto', codes[0]);
    assert(new Set(codes).size > 495, 'N4: los códigos sorteados casi nunca coinciden', String(new Set(codes).size));
    assert(generateRoomCode(seq(0)) === ROOM_ALPHABET[0].repeat(6) && generateRoomCode(seq(0.9999)) === ROOM_ALPHABET.at(-1).repeat(6),
      'N4: el código sale del azar que se le pasa');
    const sample = generateRoomCode(seq(0.1, 0.3, 0.5, 0.7, 0.2, 0.8));
    assert(isValidRoomCode(sample) && !isValidRoomCode('ABC12') && !isValidRoomCode('ABCDEFG') && !isValidRoomCode('ABCDE0') && !isValidRoomCode(''),
      'N4: validación (longitud y alfabeto)');
    assert(normalizeRoomCode(`  ${sample.slice(0, 3).toLowerCase()}-${sample.slice(3)} `) === sample,
      'N4: normaliza minúsculas, espacios y guion', normalizeRoomCode(` ${sample.toLowerCase()} `));
    const link = roomLink(sample, 'https://f1sim-d5085.web.app/');
    assert(link === `https://f1sim-d5085.web.app/?sala=${sample}`, 'N4: enlace de la sala', link);
    assert(codeFromLink(link) === sample && codeFromLink(`https://x.app/?a=1&sala=${sample.toLowerCase()}`) === sample
      && codeFromLink('https://x.app/') === null && codeFromLink(`https://x.app/?sala=ZZ`) === null,
      'N4: código desde el enlace (y null si falta o no vale)');
  });

  await test('N4: crear sala y códigos únicos', async () => {
    const fake = createFakeServer();
    const host = fake.client('host-a');
    const a = await createRoom(host, { name: 'Ana', random: seq(0.1) });
    const room = fake.read(`${ROOM_PATHS.rooms}/${a.code}`);
    assert(isValidRoomCode(a.code) && a.link.includes(`sala=${a.code}`), 'N4: crear devuelve código y enlace', JSON.stringify(a));
    assert(room?.meta?.host === 'host-a' && room.meta.status === 'lobby' && typeof room.meta.createdAt === 'number',
      'N4: la sala guarda anfitrión, estado «lobby» y fecha', JSON.stringify(room?.meta));
    assert(room?.presence?.['host-a']?.role === 'host' && room.presence['host-a'].name === 'Ana', 'N4: el anfitrión aparece en la presencia');
    assert(host.pendingOnDisconnect.includes(`${ROOM_PATHS.rooms}/${a.code}`), 'N4: el anfitrión deja programado borrar la sala al irse', JSON.stringify(host.pendingOnDisconnect));
    assert(fake.writes.some(w => w.op === 'transaction' && w.path === `${ROOM_PATHS.rooms}/${a.code}`), 'N4: la sala se reclama con una transacción');

    // Mismo azar → el primer código está ocupado: se sortea otro.
    const other = fake.client('host-b');
    const b = await createRoom(other, { name: 'Beto', random: seq(0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.6) });
    assert(b.code !== a.code && fake.read(`${ROOM_PATHS.rooms}/${a.code}/meta/host`) === 'host-a',
      'N4: un código vivo no se repite ni se pisa', `${a.code} / ${b.code}`);
    // Todos los intentos ocupados → error claro y nada escrito.
    let error = null;
    try { await createRoom(fake.client('host-c'), { name: 'Cris', random: seq(0.1), maxAttempts: 3 }); } catch (e) { error = e; }
    assert(error && /c[oó]digo/i.test(error.message), 'N4: sin código libre tras los intentos, error claro', String(error));
    // Al cerrarse la sala, su código vuelve a estar libre.
    host.disconnect();
    const c = await createRoom(fake.client('host-d'), { name: 'Dani', random: seq(0.1) });
    assert(c.code === a.code, 'N4: el código de una sala cerrada se puede volver a usar', c.code);
  });

  await test('N4: unirse, presencia y cierre', async () => {
    const fake = createFakeServer();
    const host = fake.client('host');
    const { code } = await createRoom(host, { name: 'Ana', random: seq(0.42) });
    const events = [];
    const stopHost = watchRoom(host, code, e => events.push(e));

    const bad = await joinRoom(fake.client('g0'), 'AB', { name: 'X' });
    const none = await joinRoom(fake.client('g0'), code === 'ZZZZZZ' ? 'YYYYYY' : 'ZZZZZZ', { name: 'X' });
    assert(bad.ok === false && bad.reason === 'codigo-invalido' && none.ok === false && none.reason === 'no-existe',
      'N4: código inválido y sala inexistente rechazados con motivo', JSON.stringify([bad, none]));

    const g1 = fake.client('g1'), g2 = fake.client('g2');
    const j1 = await joinRoom(g1, code.toLowerCase(), { name: 'Bea' });
    const j2 = await joinRoom(g2, roomLink(code, 'https://x.app/'), { name: 'Carlos' });
    assert(j1.ok && j2.ok && j1.code === code, 'N4: unirse por código (sin importar mayúsculas) o por enlace', JSON.stringify([j1, j2]));
    await tick();
    const last = () => events.at(-1);
    assert(last()?.closed === false && last().members.map(m => `${m.uid}:${m.role}`).sort().join(',') === 'g1:guest,g2:guest,host:host',
      'N4: el anfitrión ve quién está', JSON.stringify(last()));
    assert(g1.pendingOnDisconnect.includes(`${ROOM_PATHS.rooms}/${code}/presence/g1`), 'N4: cada invitado programa borrar su presencia al irse');
    assert(fake.read(`${ROOM_PATHS.rooms}/${code}/presence/g1`)?.name === 'Bea', 'N4: la presencia guarda el nombre');

    const guestEvents = [];
    watchRoom(g1, code, e => guestEvents.push(e));
    g2.disconnect(); await tick();
    assert(!last().members.some(m => m.uid === 'g2') && last().left?.includes('g2'), 'N4: si se cae un invitado, sale de la lista con aviso', JSON.stringify(last()));
    await leaveRoom(g1, code); await tick();
    assert(!fake.read(`${ROOM_PATHS.rooms}/${code}/presence/g1`) && !g1.pendingOnDisconnect.length, 'N4: salir borra la presencia y cancela el aviso');

    const g3 = fake.client('g3');
    await joinRoom(g3, code, { name: 'Dora' });
    const g3Events = [];
    watchRoom(g3, code, e => g3Events.push(e));
    host.disconnect(); await tick();
    assert(fake.read(`${ROOM_PATHS.rooms}/${code}`) === null, 'N4: sin anfitrión la sala desaparece');
    assert(g3Events.at(-1)?.closed === true, 'N4: los invitados reciben «sala cerrada»', JSON.stringify(g3Events.at(-1)));
    stopHost();

    // El anfitrión que sale a propósito también la cierra.
    const h2 = fake.client('h2');
    const r2 = await createRoom(h2, { name: 'Eva', random: seq(0.7) });
    await leaveRoom(h2, r2.code);
    assert(fake.read(`${ROOM_PATHS.rooms}/${r2.code}`) === null && !h2.pendingOnDisconnect.length, 'N4: el anfitrión que sale cierra la sala');

    // Sala ya en carrera: N4 solo admite entrar en el lobby (entrar a mitad de carrera llega con N6).
    const h3 = fake.client('h3');
    const r3 = await createRoom(h3, { name: 'Fran', random: seq(0.3) });
    await h3.update(`${ROOM_PATHS.rooms}/${r3.code}/meta`, { status: 'race' });
    const late = await joinRoom(fake.client('g9'), r3.code, { name: 'Gil' });
    assert(late.ok === false && late.reason === 'en-carrera', 'N4: no se entra a una sala en carrera (llega con N6)', JSON.stringify(late));
  });

  await test('N4: foto del estado', async () => {
    const fake = createFakeServer();
    const host = fake.client('host');
    const { code } = await createRoom(host, { name: 'Ana', random: seq(0.5) });
    const view = { t: 12.5, fast: [1, 2, 3], slow: { lap: 3, flag: 'green' } };
    await publishState(host, code, view);
    const stored = fake.read(`${ROOM_PATHS.rooms}/${code}/state`);
    assert(stored && typeof stored === 'object' && stored.slow?.lap === 3 && JSON.stringify(stored) === JSON.stringify(view),
      'N4: la foto se guarda como objeto, no como texto', typeof stored);
    const guest = fake.client('g1');
    await joinRoom(guest, code, { name: 'Bea' });
    let refused = null;
    try { await publishState(guest, code, view); } catch (e) { refused = e; }
    assert(refused, 'N4: un invitado no publica la foto (lo comprueba también la regla)');
  });

  await test('N4: reglas de acceso en el repositorio', async () => {
    assert(existsSync('database.rules.json') && existsSync('firebase.json'), 'N4: reglas y configuración de Firebase en el repositorio');
    const rules = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules;
    const text = JSON.stringify(rules);
    assert(rules['.read'] === false && rules['.write'] === false, 'N4: todo cerrado por defecto', JSON.stringify([rules['.read'], rules['.write']]));
    assert(!('n1' in rules) && !text.includes('n1'), 'N4: la regla temporal /n1 ya no está');
    const room = rules[ROOM_PATHS.rooms]?.$code;
    assert(room && /auth\.uid/.test(room['.write']) && /meta\/host|'meta'\)\.child\('host'\)/.test(room['.write']),
      'N4: la sala la escribe su anfitrión', room?.['.write']);
    assert(/auth\.uid\s*===?\s*\$uid/.test(room?.presence?.$uid?.['.write'] ?? ''), 'N4: cada uno escribe solo su presencia', room?.presence?.$uid?.['.write']);
    assert(/auth\.uid\s*===?\s*\$uid/.test(room?.inbox?.$uid?.['.write'] ?? ''), 'N4: cada invitado escribe solo su buzón', room?.inbox?.$uid?.['.write']);
    assert(/auth\.uid\s*===?\s*\$uid/.test(room?.outbox?.$uid?.['.read'] ?? '') && !room?.outbox?.$uid?.['.write'],
      'N4: el buzón de respuesta solo lo lee su dueño y solo lo escribe el anfitrión', JSON.stringify(room?.outbox));
    assert(/\.validate/.test(JSON.stringify(room?.meta ?? {})), 'N4: la cabecera de la sala se valida (anfitrión y estado)');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    assert(pkg.dependencies?.firebase, 'N4: dependencia firebase');
    const adapter = readFileSync('src/net/firebaseDb.ts', 'utf8');
    assert(/firebase\/database/.test(adapter) && /firebase\/auth/.test(adapter) && !/firebase\/(firestore|storage|analytics)/.test(adapter),
      'N4: solo los módulos de base de datos y sesión');
    assert(/signInAnonymously/.test(adapter) && /onDisconnect/.test(adapter), 'N4: sesión anónima y borrado al desconectar');
  });
}
