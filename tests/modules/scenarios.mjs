import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {

    console.log('\n--- TEST GROUP 14: Q6 Scenario Layers ---');
    {
      const { getScenario } = await server.ssrLoadModule('/src/data/scenarioRegistry.ts');
      const { buildScenarioGeometry } = await server.ssrLoadModule('/src/utils/scenarioGeometry.ts');
      const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
      const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');

      // Q6-1: Monaco has no global gravel
      const monacoScenario = getScenario('monaco');
      assert(monacoScenario.hasGravelGlobal === false,
        'Q6-1: Monaco scenario has hasGravelGlobal === false');

      // Q6-2: Monaco has barriers
      assert(monacoScenario.barriers.length > 0,
        'Q6-2: Monaco scenario defines barrier zones');

      // Q6-3: Barcelona has global gravel
      const barcelonaScenario = getScenario('barcelona');
      assert(barcelonaScenario.hasGravelGlobal === true,
        'Q6-3: Barcelona scenario has hasGravelGlobal === true');

      // Q6-4: Barcelona has gravel runoff zones at T4, T5, T10 regions
      const gravelZones = barcelonaScenario.runoffZones.filter(z => z.surface === 'gravel');
      assert(gravelZones.length >= 3,
        'Q6-4: Barcelona has at least 3 gravel runoff zones',
        `found ${gravelZones.length}`);

      // Q6-5: Barcelona kerbs only in curve zones (not on straights)
      const kerbs = barcelonaScenario.kerbs;
      assert(kerbs.length > 0 && kerbs.every(k => (k.endT - k.startT) < 0.15),
        'Q6-5: Barcelona kerbs are localized segments (not spanning straights)');

      // Q6-6: buildScenarioGeometry produces non-empty polygons for Barcelona
      const barcelonaSpec = OFFICIAL_CIRCUITS['barcelona'];
      const barcelonaTrackDef = buildTrackFromSvg(barcelonaSpec);
      const barcelonaGeo = buildScenarioGeometry(barcelonaTrackDef, barcelonaScenario);
      assert(barcelonaGeo.runoffPolygons.length > 0 && barcelonaGeo.kerbSegments.length > 0,
        'Q6-6: Barcelona scenario geometry has runoff polygons and kerb segments',
        `runoffs: ${barcelonaGeo.runoffPolygons.length}, kerbs: ${barcelonaGeo.kerbSegments.length}`);

      // Q6-7: buildScenarioGeometry produces non-empty geometry for Monaco
      const monacoSpec = OFFICIAL_CIRCUITS['monaco'];
      const monacoTrackDef = buildTrackFromSvg(monacoSpec);
      const monacoGeo = buildScenarioGeometry(monacoTrackDef, monacoScenario);
      assert(monacoGeo.barrierLines.length > 0 && monacoGeo.kerbSegments.length > 0,
        'Q6-7: Monaco scenario geometry has barrier lines and kerb segments',
        `barriers: ${monacoGeo.barrierLines.length}, kerbs: ${monacoGeo.kerbSegments.length}`);

      // Q6-8: Circuito sin registrar; Monza dispone de escenario propio en Q6.1.
      const monzaScenario = getScenario('unmapped-test-circuit');
      assert(monzaScenario.runoffZones.length === 0 && monzaScenario.kerbs.length === 0 && monzaScenario.barriers.length === 0,
        'Q6-8: Unmapped circuit falls back to default scenario (empty localized zones)');

      // Q6-9: Default scenario preserves legacy behavior
      const defaultScenario = getScenario('nonexistent-circuit');
      assert(defaultScenario.hasGravelGlobal === true,
        'Q6-9: Default scenario has hasGravelGlobal === true (legacy compatibility)');

      // Q6-10: Monaco CircuitSpec has trackType 'street'
      assert(monacoSpec.trackType === 'street',
        'Q6-10: Monaco CircuitSpec.trackType === "street"');

      // Q6-11: Barcelona CircuitSpec has trackType 'permanent'
      assert(barcelonaSpec.trackType === 'permanent',
        'Q6-11: Barcelona CircuitSpec.trackType === "permanent"');

      // Q6-12: Circuit switching does not leak geometry
      const barcelonaGeo2 = buildScenarioGeometry(barcelonaTrackDef, barcelonaScenario);
      const monacoGeo2 = buildScenarioGeometry(monacoTrackDef, monacoScenario);
      assert(barcelonaGeo2.hasGravelGlobal === true && monacoGeo2.hasGravelGlobal === false,
        'Q6-12: Independent builds of Barcelona and Monaco have distinct hasGravelGlobal');

      // Q6-13: All Barcelona kerbs are in corner intervals
      // Each kerb zone should span a small fraction of the track (at curve locations)
      const allKerbsSmall = barcelonaScenario.kerbs.every(k => {
        const span = k.endT > k.startT ? k.endT - k.startT : (1 - k.startT + k.endT);
        return span <= 0.10;  // No more than 10% of track per kerb
      });
      assert(allKerbsSmall,
        'Q6-13: All Barcelona kerbs span ≤10% of track (localized at corners)');

      // Q6-14: Monaco has no gravel runoff zones
      const monacoGravelZones = monacoScenario.runoffZones.filter(z => z.surface === 'gravel');
      assert(monacoGravelZones.length === 0,
        'Q6-14: Monaco has zero gravel runoff zones');
    }

}
