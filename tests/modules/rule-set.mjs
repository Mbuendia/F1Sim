// R01 — Perfil de reglas versionado y con procedencia. Contrato propuesto (pendiente de acuerdo con el usuario):
//  1. Dos perfiles: «fia-2025» (solo reglas FIA 2025 y decisiones de Dirección de Carrera) y «personalizado-2025»
//     (el comportamiento actual del juego). Cada valor lleva unidad, origen (fia | direccion | juego) y fuente.
//  2. El perfil por defecto es el personalizado y reproduce exactamente las constantes actuales (sin cambio de juego).
//  3. Perfil desconocido o campo que falta → error que nombra el perfil y su año.
//  4. El motor lee el perfil inyectado: con un umbral DRS distinto, el permiso cambia en una carrera real.
//  5. Nada de 2026 ni constantes del juego presentadas como reglas FIA.
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const rules = await server.ssrLoadModule('/src/rules/ruleSets.ts');
  const { RULE_SETS, DEFAULT_RULE_SET_ID, getRuleSet, validateRuleSet } = rules;

  await test('R01: dos perfiles válidos, con unidad, origen y fuente en cada valor', () => {
    assert(RULE_SETS['fia-2025'] && RULE_SETS['personalizado-2025'], 'R01: existen los perfiles fia-2025 y personalizado-2025');
    for (const [id, set] of Object.entries(RULE_SETS)) {
      const errors = validateRuleSet(set);
      assert(errors.length === 0, `R01: el perfil ${id} es válido`, errors.join(' | '));
      assert(set.edition === 2025 && /2025/.test(set.label), `R01: ${id} declara su edición 2025`, set.label);
    }
  });

  await test('R01: separación de origen y sin reglas inventadas', () => {
    const fia = RULE_SETS['fia-2025'];
    const values = set => Object.entries(set.values);
    assert(values(fia).every(([, v]) => v.origin !== 'juego'), 'R01: el perfil FIA no contiene ajustes del juego');
    assert(values(fia).filter(([, v]) => v.origin === 'fia').every(([, v]) => /Art\.|Artículo|T\d|S\d/.test(v.source)),
      'R01: cada regla FIA cita su artículo');
    for (const [id, set] of Object.entries(RULE_SETS)) {
      assert(!values(set).some(([, v]) => /2026/.test(v.source)), `R01: ${id} no importa reglas 2026`);
    }
    const custom = RULE_SETS['personalizado-2025'];
    assert(custom.values.initialFuelKg.origin === 'juego' && custom.values.blueFlagGapSec.origin === 'juego',
      'R01: combustible inicial y aviso azul figuran como ajustes del juego, no como FIA');
  });

  await test('R01: el perfil por defecto conserva el comportamiento actual', () => {
    const set = getRuleSet(DEFAULT_RULE_SET_ID);
    const v = set.values;
    assert(DEFAULT_RULE_SET_ID === 'personalizado-2025', 'R01: por defecto, el perfil personalizado');
    assert(v.drsGapSec.value === 1 && v.drsLapsAfterSafetyCar.value === 2 && v.drsLapsAfterVsc.value === 0 &&
      v.pitLaneSpeedKmh.value === 80 && v.mgukMaxPowerKw.value === 120 && v.esDeployMaxMjPerLap.value === 4 &&
      v.esRecoverMaxMjPerLap.value === 2 && v.esStorageMj.value === 4 && v.initialFuelKg.value === 110 &&
      v.blueFlagGapSec.value === 1.2, 'R01: valores idénticos a las constantes actuales del motor');
  });

  await test('R01: perfil desconocido o incompleto se rechaza con mensaje claro', () => {
    let message = '';
    try { getRuleSet('fia-2031'); } catch (error) { message = String(error.message); }
    assert(/fia-2031/.test(message) && /fia-2025/.test(message), 'R01: perfil desconocido nombra el pedido y los disponibles', message);
    const broken = structuredClone(RULE_SETS['fia-2025']);
    delete broken.values.drsGapSec;
    const errors = validateRuleSet(broken);
    assert(errors.some(e => /drsGapSec/.test(e) && /fia-2025/.test(e) && /2025/.test(e)), 'R01: campo que falta identificado con perfil y año', errors.join(' | '));
    const noUnit = structuredClone(RULE_SETS['fia-2025']);
    noUnit.values.mgukMaxPowerKw.unit = '';
    assert(validateRuleSet(noUnit).some(e => /mgukMaxPowerKw/.test(e) && /unidad/i.test(e)), 'R01: valor sin unidad rechazado');
  });

  const make = await raceFactory(server);
  await fixedRandom(0.99, async () => {
    await test('R01: el motor usa el perfil inyectado (umbral DRS)', () => {
      const run = threshold => {
        const sim = make('barcelona', 2);
        const custom = structuredClone(getRuleSet(DEFAULT_RULE_SET_ID));
        custom.values.drsGapSec.value = threshold;
        sim.setRuleSet(custom);
        const [leader, follower] = sim.cars;
        sim.activeTrack.drsDetections = [{ id: 'SYN', t: 0.22, zoneIds: [1], source: 'calibrated' }];
        sim.activeTrack.points.forEach(p => Object.assign(p, { isDrsZone: true, drsZoneId: 1, isBrakingZone: false, speedLimitFactor: 1, idealLineOffset: 0 }));
        leader.progress = 2.218; follower.progress = 2.208;
        let opened = false;
        for (let i = 0; i < 200 && !opened; i++) { sim.update(0.01); opened = follower.drsActive; }
        return { opened, label: sim.rules.label };
      };
      const normal = run(1), strict = run(0.1);
      assert(normal.opened && !strict.opened, 'R01: con umbral 1 s abre; con 0,1 s el mismo hueco no da DRS');
      assert(/2025/.test(normal.label), 'R01: la simulación expone el perfil activo con su año', normal.label);
    });
  });
}
