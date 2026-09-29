// Q19 — Puntos de detección y zonas DRS oficiales (FIA 2025) en todos los circuitos, y DRS operativo en carrera real.
// Contrato: cada circuito del juego declara sus detecciones con procedencia verificable (tests/fixtures/drs-references.json);
// ninguna zona queda sin detección; en una carrera real sin fixtures sintéticos el DRS se abre solo dentro de zonas.
import { readFileSync } from 'node:fs';

const references = JSON.parse(readFileSync(new URL('../fixtures/drs-references.json', import.meta.url), 'utf8'));
const CIRCUITS = Object.keys(references).filter(k => !k.startsWith('_'));

export default async function run({ server, assert, test }) {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');

  await test('Q19: todos los circuitos del juego tienen referencia DRS oficial', async () => {
    const missing = Object.keys(OFFICIAL_CIRCUITS).filter(id => !references[id]);
    assert(missing.length === 0, 'Q19: cada circuito del juego figura en la fixture DRS', missing.join(', '));
  });

  for (const circuit of CIRCUITS) {
    await test(`Q19 ${circuit}: detecciones y zonas oficiales con procedencia`, async () => {
      const ref = references[circuit], spec = OFFICIAL_CIRCUITS[circuit];
      assert(/^https:\/\/www\.fia\.com\/.+\.pdf$/.test(ref.document || '') && Number.isFinite(ref.circuitKey) && ref.fitMedianM <= 5,
        `${circuit}: documento FIA, circuito de cronometraje y ajuste <= 5 m registrados`, `ajuste ${ref.fitMedianM} m`);
      const detections = spec.drsDetections || [];
      assert(detections.length > 0, `${circuit}: al menos un punto de detección`);
      assert(detections.length === ref.drsDetections.length && detections.every((d, i) => {
        const r = ref.drsDetections[i];
        return d.id === r.id && Math.abs(d.t - r.t) < 1e-4 && d.source === r.source && JSON.stringify(d.zoneIds) === JSON.stringify(r.zoneIds);
      }), `${circuit}: detecciones del juego = referencia oficial`);
      assert(spec.drsZoneSpecs.length === ref.drsZoneSpecs.length && spec.drsZoneSpecs.every((z, i) =>
        z.id === ref.drsZoneSpecs[i].id && Math.abs(z.startT - ref.drsZoneSpecs[i].startT) < 1e-4),
        `${circuit}: zonas empiezan en la activación oficial`);
      const owned = new Set(detections.flatMap(d => d.zoneIds));
      assert(spec.drsZoneSpecs.every(z => owned.has(z.id)), `${circuit}: ninguna zona queda sin detección`);
      assert(detections.every(d => {
        const p = ref.points[d.id];
        return p && p.text && (d.source === 'verified' ? !p.approx : Boolean(p.approx));
      }), `${circuit}: cada detección conserva el texto FIA; las aproximadas declaran el motivo`);
    });
  }

  await test('Q19: en carrera real el DRS se abre y solo dentro de zonas autorizadas', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = new RaceSimulation('barcelona');
      sim.lightState = 'racing'; sim.isPaused = false;
      let openings = 0, outside = 0;
      for (let step = 0; step < 20000 && sim.cars[0].currentLap < 5; step++) {
        sim.update(0.05);
        for (const car of sim.cars) {
          if (!car.drsActive) continue;
          openings++;
          const n = sim.activeTrack.points.length, point = sim.activeTrack.points[Math.floor(car.trackT * n) % n];
          if (!point.isDrsZone) outside++;
        }
      }
      assert(openings > 0, 'Q19: el DRS se abre en carrera real con detecciones oficiales', `${openings} pasos abiertos`);
      assert(outside === 0, 'Q19: el DRS nunca está abierto fuera de una zona', `${outside} pasos fuera de zona`);
    } finally { Math.random = originalRandom; }
  });
}
