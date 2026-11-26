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

// [CA6, autorizado por el usuario el 07/11/2026] Cada parada guarda además su motivo, la media de la carrera y los mecánicos:
// cambian las huellas de Mónaco y Spa. Quitando esos campos salen bit a bit las de antes (f37fa7c0… y fa37c2c9…): las carreras son
// idénticas.
// [CR2/CR10, autorizado por el usuario el 12/11/2026] El trazado de Spa cambió a propósito (La Source abierta y dos tramos
// llevados al real en CR2; eje a paso uniforme en CR10): cambia la huella de Spa. Monza y Mónaco siguen idénticas.
// [VS3, autorizado por el usuario el 13/11/2026] Cada circuito sale con su temperatura de pista y el asfalto calienta o
// enfría los neumáticos: cambian las tres huellas. Forzando la temperatura de antes (38,5 °C) salen bit a bit las
// anteriores (3382658b…, 5ac23726… y cb8d7d78…): lo comprueba tests/modules/track-temp-vs3.mjs.
// [ES2, autorizado por el usuario el 20/11/2026 («Sí, cámbialos»)] El pit lane de cada circuito se calibra con la realidad (líneas del limitador propias y vía de entrada a
// fondo hasta la línea): cambian las huellas de Mónaco y Spa, que paran en boxes (antes b060bf36… y 567324ab…). Monza,
// sin paradas, sigue idéntica.
// [ES7, autorizado por el usuario el 26/11/2026 («Sí, cámbialas»)] En la carrera con lluvia el muro propone «Plan lluvia» a los coches del jugador y esas propuestas van en el
// estado: cambia la huella de Mónaco (antes b3afbbef…). Sin las propuestas la carrera sale idéntica (comprobado). Monza y Spa, igual.
const BEFORE = {
  'monza-seco': '465b6e28f76606f87867681b3f8f791afba70903750f0ef3b65a71a29c83c674',
  'monaco-lluvia-sc': 'b8c8c890ae6853296ec899701db7d2956b7c3f6600c75d42f77a174350809045',
  'spa-vsc-roja-ordenes': '51788a0cccfa0877a0c7e495e349ce67c42c4fa705c121a2315bffb0a6c414be',
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
