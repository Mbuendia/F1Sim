// G1 — Banco de medidas de los circuitos (Sprint 4.5). Contrato aprobado por el usuario el 13/10/2026.
// Por circuito, con los límites de `QUALITY_LIMITS` (`src/utils/circuitQuality.ts`):
//  1. Escala: una unidad del mundo es un metro (perímetro del eje = longitud oficial ± 0,5 %).
//  2. Eje: paso entre muestras de 2 m o menos y radio mínimo mayor que medio ancho de pista más 1 m.
//  3. Bordes: ningún tramo plegado y la línea blanca a menos de 0,1 m del borde del asfalto.
//  4. Trazada: sin zigzag en las rectas (como mucho los dos cruces que hay entre dos curvas de sentido contrario:
//     salida al exterior y vuelta al exterior de la siguiente), siempre dentro de los bordes y sin moverse de lado
//     más deprisa de lo que puede el coche (`MAX_LATERAL_SLOPE`).
//  5. Un coche solo durante una vuelta: avance por paso proporcional a su velocidad (±5 %) y giro acotado por la
//     curva. El motor mide la velocidad sobre el eje de la pista: por el interior
//     de una curva el coche recorre menos metros que el eje (factor 1 − curvatura × separación), y eso se descuenta.
//  6. Boxes: la zona de servicio separada del borde de la pista (muro incluido); ningún cajón ni muro sobre el asfalto.
//  7. Meta a menos de 30 m de su referencia (`tests/fixtures/finish-line-references.json`, distancia real de la meta a
//     la salida de boxes) y parrilla en recta.
// Nace en rojo: documenta el punto de partida del sprint y cada tarea (G2 a G7) pone en verde su parte.
import { existsSync, readFileSync } from 'node:fs';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const { measureCircuit, qualityChecks, QUALITY_LIMITS } = await server.ssrLoadModule('/src/utils/circuitQuality.ts');
  const { getTrackHalfWidth, getLateralDisplacement, worldUnitsPerMeter } = await server.ssrLoadModule('/src/utils/carPosition.ts');
  const make = await raceFactory(server);
  const fixture = new URL('../fixtures/finish-line-references.json', import.meta.url);
  const references = existsSync(fixture) ? JSON.parse(readFileSync(fixture, 'utf8')) : {};
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  assert(ids.length === 23, 'G1: se miden los 23 circuitos', String(ids.length));

  for (const id of ids) {
    await test(`G1 ${id}: geometría`, () => {
      const quality = measureCircuit(buildTrackFromSvg(OFFICIAL_CIRCUITS[id]));
      for (const check of qualityChecks(quality, references[id]?.lineToPitExitM)) {
        assert(check.pass, `G1 ${id}: ${check.label} (${check.limit})`, check.value);
      }
    });

    await test(`G1 ${id}: un coche solo durante una vuelta`, () => {
      const sim = make(id, 1), car = sim.cars[0], track = sim.activeTrack;
      const unit = worldUnitsPerMeter(track), quality = measureCircuit(track);
      car.pitStop.playerControlled = true;
      sim.setSeed(45); sim.setFixedStep(0.02);
      const dt = 0.02 / sim.getEffectiveTimeScale();
      // Giro máximo por metro: el del radio interior de la curva más cerrada, con holgura.
      const innerRadius = Math.max(4, quality.minRadiusM - getTrackHalfWidth(track.trackWidthMeters) / unit);
      const turnLimit = 1.5 / innerRadius;
      for (let i = 0; i < 100; i++) sim.update(dt);   // deja que el coche coja su ritmo
      const start = car.progress;
      const points = track.points, n = points.length, stepM = track.lapLengthMeters / n;
      const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
      const curvatureOf = i => wrap(points[(i + 1) % n].angle - points[(i - 1 + n) % n].angle) / (2 * stepM);
      const curvatureAt = t => { const x = (((t % 1) + 1) % 1) * n, i = Math.floor(x) % n, f = x - Math.floor(x); return curvatureOf(i) * (1 - f) + curvatureOf((i + 1) % n) * f; };
      const lateralOf = () => getLateralDisplacement(car.lateralOffset, track.trackWidthMeters) / unit;
      let last = null, worstAdvance = 0, worstTurn = 0, steps = 0;
      while (car.progress < start + 1 && steps < 20000) {
        const before = car.progress, lateralBefore = lateralOf();
        sim.update(dt);
        const pose = { x: car.worldX, y: car.worldY, angle: car.worldAngle };
        const meters = (car.progress - before) * track.lapLengthMeters;
        if (last && meters > 0.2) {
          const moved = Math.hypot(pose.x - last.x, pose.y - last.y) / unit;
          const lateral = (lateralBefore + lateralOf()) / 2;
          const expected = Math.hypot(meters * (1 - curvatureAt((before + car.progress) / 2) * lateral), lateralOf() - lateralBefore);
          worstAdvance = Math.max(worstAdvance, Math.abs(moved / expected - 1));

          worstTurn = Math.max(worstTurn, Math.abs(Math.atan2(Math.sin(pose.angle - last.angle), Math.cos(pose.angle - last.angle))) / meters);
        }
        last = pose; steps++;
      }
      assert(car.progress >= start + 1, `G1 ${id}: el coche completa la vuelta`, `${steps} pasos`);
      assert(worstAdvance <= 0.05, `G1 ${id}: avance por paso proporcional a la velocidad (±5 %)`, `${(worstAdvance * 100).toFixed(1)} %`);
      assert(worstTurn <= turnLimit, `G1 ${id}: giro por metro acotado por la curva más cerrada (≤ ${turnLimit.toFixed(3)} rad/m)`, `${worstTurn.toFixed(3)} rad/m`);
    });
  }
  assert(QUALITY_LIMITS.maxStepM === 2 && QUALITY_LIMITS.finishToleranceM === 30 && QUALITY_LIMITS.scaleTolerance === 0.005 && QUALITY_LIMITS.edgeGapM === 0.1,
    'G1: los límites son los del contrato');
}
