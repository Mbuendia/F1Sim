// N10 — Reglas de acceso con las rutas de N5 a N9, contra el emulador de Firebase (PROPUESTA, 19/10/2026).
// Pedido por el usuario al acordar N10: las reglas de N4 no se habían probado con lo que se añadió después. Mismo
// montaje que rooms-rules-n4 (arranca el emulador de Realtime Database si no está en marcha; necesita Java 21).
// Cada ruta es la que usa el código:
//  - sala (N7/N9): el invitado pide equipo en su presencia (`wants`); el anfitrión escribe en la ficha el reparto, los
//    ajustes, la fase y la carrera publicada (también al volver a la sala); el invitado lee la ficha y no la escribe;
//  - transporte (N5): el invitado escribe en su buzón su sesión, sus órdenes y su señal WebRTC; el anfitrión borra las
//    órdenes atendidas y escribe en el buzón de respuesta los acuses, la vista del equipo y su señal; nadie lee lo ajeno;
//  - caídas (N9): quien se cae puede volver a escribir su presencia con la sala en carrera.
import { readFileSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const HOST = '127.0.0.1', PORT = 9000, PROJECT = 'demo-f1sim';
const up = async () => { try { const r = await fetch(`http://${HOST}:${PORT}/.json?ns=${PROJECT}`); return r.status > 0; } catch { return false; } };

async function startEmulator() {
  if (await up()) return null;
  const child = spawn(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start', '--only', 'database', '--project', PROJECT],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 120; i++) {
    if (await up()) return child;
    if (child.exitCode !== null) break;
    await new Promise(r => setTimeout(r, 500));
  }
  stopEmulator(child);
  throw new Error(`No arranca el emulador de Firebase (¿Java 21 instalado?).\n${log.slice(-1500)}`);
}
function stopEmulator(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') { try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { /* ya parado */ } }
  else child.kill('SIGINT');
}

export default async function run({ assert, test }) {
  const emulator = await startEmulator();
  const env = await initializeTestEnvironment({
    projectId: PROJECT,
    database: { host: HOST, port: PORT, rules: readFileSync('database.rules.json', 'utf8') },
  });
  try {
    const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();
    const ok = async (promise, label) => { try { await assertSucceeds(promise); assert(true, label); } catch (e) { assert(false, label, String(e?.message ?? e)); } };
    const no = async (promise, label) => { try { await assertFails(promise); assert(true, label); } catch (e) { assert(false, label, String(e?.message ?? e)); } };
    const CODE = 'ABC234';
    const R = `rooms/${CODE}`;
    /** Sala con anfitrión (ana) e invitadas (bea y carla) dentro. */
    const setup = async () => {
      await env.clearDatabase();
      await db('ana').ref(R).set({ meta: { host: 'ana', status: 'lobby', createdAt: 1 }, presence: { ana: { name: 'Ana', role: 'host', joinedAt: 1 } } });
      await db('bea').ref(`${R}/presence/bea`).set({ name: 'Bea', role: 'guest', joinedAt: 2 });
      await db('carla').ref(`${R}/presence/carla`).set({ name: 'Carla', role: 'guest', joinedAt: 3 });
    };

    await test('N10 reglas: sala y elección de equipos (N7)', async () => {
      await setup();
      await ok(db('bea').ref(`${R}/presence/bea/wants`).set({ teamId: 'ferrari', at: 5 }), 'N10 reglas: el invitado pide equipo en su presencia');
      await no(db('bea').ref(`${R}/presence/carla/wants`).set({ teamId: 'ferrari', at: 5 }), 'N10 reglas: no pide en nombre de otro');
      await ok(db('ana').ref(`${R}/meta/seats`).set({ teams: { mclaren: 'ana', ferrari: 'bea' }, spectators: ['carla'], handled: { bea: 5 } }), 'N10 reglas: el anfitrión guarda el reparto');
      await ok(db('ana').ref(`${R}/meta/settings`).set({ circuitId: 'monaco', format: 'clasificacion', weather: 'seco' }), 'N10 reglas: y los ajustes');
      await ok(db('ana').ref(`${R}/meta/phase`).set('equipos'), 'N10 reglas: y la fase');
      await ok(db('bea').ref(`${R}/meta`).get(), 'N10 reglas: el invitado lee la ficha con todo eso');
      await no(db('bea').ref(`${R}/meta/seats/teams/mclaren`).set('bea'), 'N10 reglas: el invitado no toca el reparto');
      await no(db('bea').ref(`${R}/meta/settings/circuitId`).set('spa'), 'N10 reglas: ni los ajustes');
      await no(db('bea').ref(`${R}/meta/phase`).set('sala'), 'N10 reglas: ni la fase');
    });

    await test('N10 reglas: transporte (N5)', async () => {
      await setup();
      await ok(db('bea').ref(`${R}/inbox/bea`).update({ session: 's1', orders: null }), 'N10 reglas: el invitado anuncia su sesión');
      await ok(db('bea').ref(`${R}/inbox/bea/orders/1`).set({ kind: 'box', carId: 3, compound: 'hard' }), 'N10 reglas: deja sus órdenes');
      await ok(db('bea').ref(`${R}/inbox/bea/signal`).set({ id: 'x', offer: { type: 'offer', sdp: 'v=0' } }), 'N10 reglas: y su señal WebRTC');
      await ok(db('ana').ref(`${R}/inbox/bea/orders/1`).remove(), 'N10 reglas: el anfitrión borra la orden atendida');
      await ok(db('ana').ref(`${R}/outbox/bea/acks/1`).set({ sid: 's1', result: { ok: true } }), 'N10 reglas: responde con el acuse');
      await ok(db('ana').ref(`${R}/outbox/bea/team`).set({ at: 1, data: { teamId: 'ferrari' } }), 'N10 reglas: deja la vista de su equipo');
      await ok(db('ana').ref(`${R}/outbox/bea/signal`).set({ id: 'x', answer: { type: 'answer', sdp: 'v=0' } }), 'N10 reglas: y su respuesta WebRTC');
      await ok(db('bea').ref(`${R}/outbox/bea`).get(), 'N10 reglas: el invitado lee su buzón de respuesta');
      await ok(db('ana').ref(`${R}/state`).set({ at: 1, fast: [1, 2] }), 'N10 reglas: el anfitrión publica la foto del respaldo');
      await ok(db('bea').ref(`${R}/state`).get(), 'N10 reglas: el invitado la lee');
      await no(db('carla').ref(`${R}/outbox/bea/team`).get(), 'N10 reglas: nadie lee la vista del equipo de otro');
      await no(db('carla').ref(`${R}/inbox/bea/orders`).get(), 'N10 reglas: ni sus órdenes');
      await no(db('carla').ref(`${R}/inbox/bea/orders/9`).set({ kind: 'box' }), 'N10 reglas: ni manda órdenes en su nombre');
      await no(db('bea').ref(`${R}/outbox/bea/acks/2`).set({ sid: 's1', result: { ok: true } }), 'N10 reglas: el invitado no se escribe acuses');
    });

    await test('N10 reglas: carrera, final y caídas (N8 y N9)', async () => {
      await setup();
      await ok(db('ana').ref(`${R}/meta/race`).set({ circuitId: 'monaco', weather: 'seco', format: 'clasificacion', stage: 'clasificacion', roster: [{ id: 1 }], qualifying: { seed: 1 } }), 'N10 reglas: el anfitrión publica la clasificación');
      await ok(db('ana').ref(`${R}/meta`).update({ status: 'race' }), 'N10 reglas: y pone la sala en carrera');
      await ok(db('ana').ref(`${R}/meta/race`).update({ stage: 'carrera' }), 'N10 reglas: y anuncia la salida a pista');
      await ok(db('bea').ref(`${R}/meta/race`).get(), 'N10 reglas: el invitado lee la carrera publicada');
      await no(db('bea').ref(`${R}/meta/race/stage`).set('clasificacion'), 'N10 reglas: y no la cambia');
      await ok(db('bea').ref(`${R}/presence/bea`).remove(), 'N10 reglas: el invitado se cae (su presencia se borra)');
      await ok(db('bea').ref(`${R}/presence/bea`).set({ name: 'Bea', role: 'guest', joinedAt: 9 }), 'N10 reglas: y vuelve con la sala en carrera');
      await ok(db('ana').ref(`${R}/meta`).update({ status: 'lobby', phase: 'sala', race: null }), 'N10 reglas: «Otra carrera»: el anfitrión vuelve a la sala');
      await ok(db('bea').ref(`${R}/meta`).get(), 'N10 reglas: el invitado lo ve');
      await no(db('bea').ref(`${R}/meta`).update({ status: 'race' }), 'N10 reglas: y no puede poner la sala en carrera');
    });
  } finally {
    await env.cleanup();
    stopEmulator(emulator);
  }
}
