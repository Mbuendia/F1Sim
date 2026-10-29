// PF5 — Partir el motor de carrera (Sprint 8). Contrato escrito el 29/10/2026 en el modo sin permisos que pide el usuario
// ese día (opción recomendada en cada decisión).
//  1. Misma semilla, misma carrera: tres sprints completos (seco en Monza; chubasco y Safety Car en Mónaco; VSC, roja,
//     orden de equipo y orden de boxes en Spa) dejan el motor exactamente en el mismo estado que antes (huella SHA-256
//     de createSnapshot, tomada el 29/10/2026 antes de tocar nada).
//  2. Partido en módulos en src/simulation/race/: el paso de cada coche (ritmo, adelantamientos, boxes en pista),
//     neutralizaciones (Safety Car, VSC, roja), clima, órdenes de equipo, muro (estratega y órdenes del jugador) y
//     salida y resultado; RaceSimulation los usa.
//  3. RaceSimulation.ts baja al menos un 40 % (de 4.064 líneas a 2.440 como mucho).
//  4. Nada cambia hacia fuera: los mismos métodos y propiedades en la clase (lista guardada antes de partirla).
import { readFileSync, existsSync } from 'node:fs';
import { raceFingerprints } from '../support/race-fingerprint.mjs';

const BEFORE = {
  'monza-seco': '3382658b1c9db1acd54b9eb48a29cc79c9ad99212858fcf0edae9e80bcdd05db',
  'monaco-lluvia-sc': 'f37fa7c0884063863b23835bed167fe41c5bee075beefde32dd15365227a3926',
  'spa-vsc-roja-ordenes': 'fa37c2c934a2a4995f0593f554cef4909fbc9829d260acb4308a613142d3e52a',
};
const MODULES = ['carStep', 'neutralization', 'weather', 'teamOrders', 'wall', 'startAndResult'];

export default async function run({ server, assert, test }) {
  await test('PF5.1: misma semilla, misma carrera', async () => {
    const now = await raceFingerprints(server);
    for (const [id, hash] of Object.entries(BEFORE)) {
      assert(now[id]?.finished === true, 'PF5: la carrera de prueba llega al final', id);
      assert(now[id]?.hash === hash, 'PF5: el motor acaba exactamente igual que antes de partirlo', `${id}: ${now[id]?.hash}`);
    }
    assert(Object.values(now['spa-vsc-roja-ordenes'].done).filter(Boolean).length === 4 && now['monaco-lluvia-sc'].done.sc, 'PF5: las carreras pasan por Safety Car, VSC, roja y órdenes');
  });

  await test('PF5.2: módulos', () => {
    const sim = readFileSync('src/simulation/RaceSimulation.ts', 'utf8');
    for (const m of MODULES) {
      assert(existsSync(`src/simulation/race/${m}.ts`), 'PF5: existe el módulo', m);
      assert(new RegExp(`from ['"][.]/race/${m}['"]`).test(sim), 'PF5: RaceSimulation usa el módulo', m);
    }
  });

  await test('PF5.3: RaceSimulation más corto', () => {
    const lines = readFileSync('src/simulation/RaceSimulation.ts', 'utf8').split(/\r?\n/).length;
    assert(lines <= 2440, 'PF5: RaceSimulation.ts baja al menos un 40 % (2.440 líneas como mucho)', String(lines));
  });

  await test('PF5.4: nada cambia hacia fuera', async () => {
    const api = JSON.parse(readFileSync('tests/fixtures/race-simulation-api.json', 'utf8'));
    const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    const proto = Object.getOwnPropertyNames(RaceSimulation.prototype).sort();
    const missing = api.prototype.filter(n => !proto.includes(n));
    assert(missing.length === 0, 'PF5: la clase conserva todos sus métodos y propiedades', missing.join(', '));
    const statics = Object.getOwnPropertyNames(RaceSimulation).sort();
    assert(api.static.every(n => statics.includes(n)), 'PF5: y sus constantes y funciones estáticas');
  });
}
