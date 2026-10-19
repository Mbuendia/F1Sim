// N4 — Reglas de acceso de las salas contra el emulador de Firebase (PROPUESTA DE CONTRATO, 19/10/2026).
// El módulo arranca el emulador de Realtime Database (firebase-tools, necesita Java 21) si no está ya en marcha,
// carga database.rules.json y prueba cada permiso con usuarios distintos:
//  - sin sesión no se lee ni escribe nada; la ruta temporal /n1 ya no existe;
//  - el anfitrión crea la sala con su uid; nadie puede crear una sala ya viva ni suplantar al anfitrión;
//  - un invitado lee la cabecera, entra con su presencia (rol «guest»), lee la foto y escribe solo en su buzón;
//  - un invitado no escribe la sala, la foto ni la presencia o el buzón de otro, ni lee buzones ajenos;
//  - el buzón de respuesta de cada invitado lo escribe el anfitrión y lo lee solo su dueño; solo el anfitrión borra la sala.
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
    const CODE = 'ABC234', OTHER = 'XYZ789';
    const room = (host, name = 'Ana') => ({ meta: { host, status: 'lobby', createdAt: 1 }, presence: { [host]: { name, role: 'host', joinedAt: 1 } } });

    await test('N4 reglas: sin sesión y ruta temporal', async () => {
      await env.clearDatabase();
      await no(db(null).ref(`rooms/${CODE}`).set(room('anon')), 'N4 reglas: sin sesión no se crea sala');
      await no(db(null).ref(`rooms/${CODE}/meta`).get(), 'N4 reglas: sin sesión no se lee');
      await no(db('ana').ref('n1').get(), 'N4 reglas: /n1 ya no se lee');
      await no(db('ana').ref('n1/x').set(1), 'N4 reglas: /n1 ya no se escribe');
      await no(db('ana').ref('otra').set(1), 'N4 reglas: fuera de /rooms todo cerrado');
      await no(db('ana').ref('rooms').get(), 'N4 reglas: no se puede listar las salas');
    });

    await test('N4 reglas: crear sala', async () => {
      await env.clearDatabase();
      await no(db('ana').ref(`rooms/${CODE}`).set(room('beto')), 'N4 reglas: no se crea una sala a nombre de otro');
      await no(db('ana').ref('rooms/abc').set(room('ana')), 'N4 reglas: código con formato inválido rechazado');
      await no(db('ana').ref(`rooms/${CODE}`).set({ meta: { host: 'ana', status: 'jugando', createdAt: 1 } }), 'N4 reglas: estado de sala inválido rechazado');
      await ok(db('ana').ref(`rooms/${CODE}`).set(room('ana')), 'N4 reglas: el anfitrión crea la sala');
      await no(db('beto').ref(`rooms/${CODE}`).set(room('beto')), 'N4 reglas: nadie pisa una sala viva');
      await no(db('beto').ref(`rooms/${CODE}`).get(), 'N4 reglas: un tercero no lee la sala entera');
      await ok(db('ana').ref(`rooms/${CODE}`).get(), 'N4 reglas: el anfitrión lee su sala');
      await no(db('ana').ref(`rooms/${CODE}/meta/host`).set('beto'), 'N4 reglas: el anfitrión no cambia de dueño la sala');
      await ok(db('ana').ref(`rooms/${CODE}/meta`).update({ status: 'race' }), 'N4 reglas: el anfitrión cambia el estado');
    });

    await test('N4 reglas: invitados', async () => {
      await env.clearDatabase();
      await ok(db('ana').ref(`rooms/${CODE}`).set(room('ana')), 'N4 reglas: sala de prueba');
      await ok(db('bea').ref(`rooms/${CODE}/meta`).get(), 'N4 reglas: un invitado lee la cabecera');
      await no(db('bea').ref(`rooms/${CODE}/state`).get(), 'N4 reglas: sin entrar no se lee la foto');
      await no(db('bea').ref(`rooms/${CODE}/presence`).get(), 'N4 reglas: sin entrar no se ve quién está');
      await no(db('bea').ref(`rooms/${OTHER}/presence/bea`).set({ name: 'Bea', role: 'guest' }), 'N4 reglas: no se entra en una sala que no existe');
      await no(db('bea').ref(`rooms/${CODE}/presence/bea`).set({ name: 'Bea', role: 'host' }), 'N4 reglas: un invitado no se pone de anfitrión');
      await no(db('bea').ref(`rooms/${CODE}/presence/carla`).set({ name: 'Carla', role: 'guest' }), 'N4 reglas: no se escribe la presencia de otro');
      await no(db('bea').ref(`rooms/${CODE}/presence/bea`).set({ name: 'x'.repeat(40), role: 'guest' }), 'N4 reglas: nombre demasiado largo rechazado');
      await ok(db('bea').ref(`rooms/${CODE}/presence/bea`).set({ name: 'Bea', role: 'guest', joinedAt: 2 }), 'N4 reglas: el invitado entra con su presencia');
      await ok(db('bea').ref(`rooms/${CODE}/presence`).get(), 'N4 reglas: dentro, ve quién está');
      await ok(db('ana').ref(`rooms/${CODE}/state`).set({ lap: 1, cars: [1, 2] }), 'N4 reglas: el anfitrión publica la foto');
      await ok(db('bea').ref(`rooms/${CODE}/state`).get(), 'N4 reglas: dentro, lee la foto');
      await no(db('bea').ref(`rooms/${CODE}/state`).set({ lap: 99 }), 'N4 reglas: un invitado no escribe la foto');
      await no(db('bea').ref(`rooms/${CODE}/meta/status`).set('race'), 'N4 reglas: un invitado no escribe la cabecera');
      await no(db('bea').ref(`rooms/${CODE}`).remove(), 'N4 reglas: un invitado no borra la sala');
      await ok(db('bea').ref(`rooms/${CODE}/inbox/bea/1`).set({ kind: 'box' }), 'N4 reglas: el invitado escribe en su buzón');
      await no(db('bea').ref(`rooms/${CODE}/inbox/carla/1`).set({ kind: 'box' }), 'N4 reglas: no escribe en el buzón de otro');
      await no(db('carla').ref(`rooms/${CODE}/inbox/carla/1`).set({ kind: 'box' }), 'N4 reglas: sin entrar en la sala no hay buzón');
      await ok(db('ana').ref(`rooms/${CODE}/inbox/bea`).get(), 'N4 reglas: el anfitrión lee los buzones');
      await ok(db('ana').ref(`rooms/${CODE}/outbox/bea/1`).set({ ack: 1 }), 'N4 reglas: el anfitrión responde en el buzón del invitado');
      await ok(db('bea').ref(`rooms/${CODE}/outbox/bea`).get(), 'N4 reglas: el invitado lee su respuesta');
      await no(db('bea').ref(`rooms/${CODE}/outbox/bea/2`).set({ ack: 2 }), 'N4 reglas: el invitado no escribe su buzón de respuesta');
      await ok(db('ana').ref(`rooms/${CODE}/presence/carla`).set({ name: 'Carla', role: 'guest' }), 'N4 reglas: segunda invitada (preparada por el anfitrión)');
      await no(db('bea').ref(`rooms/${CODE}/outbox/carla`).get(), 'N4 reglas: un invitado no lee la respuesta de otro');
      await no(db('bea').ref(`rooms/${CODE}/inbox/carla`).get(), 'N4 reglas: un invitado no lee el buzón de otro');
      await ok(db('bea').ref(`rooms/${CODE}/presence/bea`).remove(), 'N4 reglas: el invitado sale');
      await ok(db('ana').ref(`rooms/${CODE}`).remove(), 'N4 reglas: el anfitrión cierra la sala');
      await ok(db('beto').ref(`rooms/${CODE}`).set(room('beto', 'Beto')), 'N4 reglas: el código cerrado vuelve a estar libre');
    });
  } finally {
    await env.cleanup();
    stopEmulator(emulator);
  }
}
