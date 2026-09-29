// Q20 — Recorrido real y extremos de boxes en Barcelona, Mónaco y Suzuka.
// Contrato ejecutable: ruta continua, extremos enlazados con la pista, cajones conectados, una única fuente de
// posición (coche/cámara/minimapa/clic) y paradas completas sin saltos. La comparación con la geometría REAL usa
// tests/fixtures/pit-lane-references.json; sin referencia verificada esos casos fallan (no hay skip ni datos inventados).
import { readFileSync } from 'node:fs';
import { raceFactory } from '../support/race.mjs';

const CIRCUITS = ['barcelona', 'monaco', 'suzuka'];
const REFERENCE_TOLERANCE_T = 0.004;   // fracción de vuelta admitida entre referencia y extremo dibujado
const JOIN_TOLERANCE = 1.0;            // unidades de mundo entre extremo de boxes y línea central de pista
const references = JSON.parse(readFileSync(new URL('../fixtures/pit-lane-references.json', import.meta.url), 'utf8'));

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const centerAt = (points, t) => {
  const n = points.length, x = (((t % 1) + 1) % 1) * n, i = Math.floor(x) % n, f = x - Math.floor(x);
  const a = points[i], b = points[(i + 1) % n];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
};
const distanceToRoute = (p, path) => {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
};
const circularDelta = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { buildPitLaneGeometry } = await server.ssrLoadModule('/src/utils/pitLaneGeometry.ts');
  const { calculateCarWorldPosition } = await server.ssrLoadModule('/src/utils/carPosition.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const teams = Object.values(TEAMS);

  for (const circuit of CIRCUITS) {
    const track = make(circuit).activeTrack;

    await test(`Q20 ${circuit}: ruta de boxes finita, con extremos distintos y sin puntos duplicados`, async () => {
      const route = track.pitLanePoints;
      assert(Array.isArray(route) && route.length >= 10, `${circuit}: al menos 10 puntos de ruta`);
      assert(route.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), `${circuit}: coordenadas finitas`);
      assert(Number.isFinite(track.pitEntryT) && Number.isFinite(track.pitExitT) && track.pitEntryT !== track.pitExitT,
        `${circuit}: entrada y salida definidas y distintas`);
      assert(route.every((p, i) => i === 0 || dist(p, route[i - 1]) > 1e-6), `${circuit}: sin puntos consecutivos duplicados`);
    });

    await test(`Q20 ${circuit}: continuidad de la ruta sin saltos`, async () => {
      const route = track.pitLanePoints;
      const steps = route.slice(1).map((p, i) => dist(p, route[i]));
      const typical = median(steps);
      assert(Math.max(...steps) <= typical * 2.5, `${circuit}: ningún tramo supera 2.5x el tramo típico`, `máx ${Math.max(...steps)} típico ${typical}`);
      const headings = route.slice(1).map((p, i) => Math.atan2(p.y - route[i].y, p.x - route[i].x));
      const turns = headings.slice(1).map((h, i) => { let d = h - headings[i]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); });
      assert(Math.max(...turns) < Math.PI / 4, `${circuit}: sin giros bruscos (>45°) entre tramos consecutivos`);
    });

    await test(`Q20 ${circuit}: extremos de boxes enlazan con la línea central en entrada y salida`, async () => {
      const route = track.pitLanePoints;
      assert(dist(route[0], centerAt(track.points, track.pitEntryT)) <= JOIN_TOLERANCE, `${circuit}: entrada enlaza con pitEntryT`);
      assert(dist(route.at(-1), centerAt(track.points, track.pitExitT)) <= JOIN_TOLERANCE, `${circuit}: salida enlaza con pitExitT`);
    });

    await test(`Q20 ${circuit}: entrada, compromiso y salida siguen el orden de vuelta y son líneas separadas`, async () => {
      const span = ((track.pitExitT - track.pitEntryT) % 1 + 1) % 1;
      const commitment = ((track.pitCommitmentT - track.pitEntryT) % 1 + 1) % 1;
      assert(Number.isFinite(track.pitCommitmentT), `${circuit}: línea de compromiso definida`);
      assert(span > 0 && span < 0.5, `${circuit}: tramo de boxes < media vuelta`, `span ${span}`);
      assert(commitment > span,
        `${circuit}: compromiso antes de la entrada, no dentro del tramo`, `compromiso ${commitment} span ${span}`);
      assert(track.pitCommitmentT !== track.pitEntryT && track.pitCommitmentT !== track.pitExitT,
        `${circuit}: compromiso, entrada y salida son líneas independientes`);
    });

    await test(`Q20 ${circuit}: diez cajones conectados al carril, fuera de él y sin solaparse`, async () => {
      const geometry = buildPitLaneGeometry(track, teams);
      assert(geometry.boxes.length === 10 && new Set(geometry.boxes.map(b => b.team.id)).size === 10, `${circuit}: un cajón por equipo`);
      assert(geometry.boxes.every(b => {
        const d = distanceToRoute(b.center, geometry.fastLane);
        return d > geometry.fastLaneWidth / 2 && d <= geometry.fastLaneWidth * 3;
      }), `${circuit}: cada cajón toca la zona de servicio y queda fuera del carril rápido`);
      assert(geometry.boxes.every((b, i, all) => i === 0 || dist(b.center, all[i - 1].center) > 12), `${circuit}: cajones sin solaparse`);
      const along = geometry.boxes.map(b => geometry.fastLane.reduce((best, p, i) => dist(p, b.center) < dist(geometry.fastLane[best], b.center) ? i : best, 0));
      assert(along.every((v, i) => i === 0 || v >= along[i - 1]), `${circuit}: orden de cajones monótono a lo largo de la ruta`);
    });

    await test(`Q20 ${circuit}: posición en boxes con una única fuente (coche, cámara, minimapa y clic)`, async () => {
      const sim = make(circuit);
      const car = sim.cars[0];
      const n = 40;
      for (let k = 0; k <= n; k++) {
        const span = ((sim.activeTrack.pitExitT - sim.activeTrack.pitEntryT) % 1 + 1) % 1;
        car.progress = 2 + sim.activeTrack.pitEntryT + span * k / n;
        car.trackT = ((car.progress % 1) + 1) % 1;
        car.isInPitLane = true;
        const pos = calculateCarWorldPosition(car, sim.activeTrack);
        const onRoute = distanceToRoute({ x: pos.worldX, y: pos.worldY }, sim.activeTrack.pitLanePoints);
        assert(onRoute < 1e-6, `${circuit}: posición ${k}/${n} sobre la ruta de boxes`, `d ${onRoute}`);
      }
      const src = ['src/renderer/CarRenderer.ts', 'src/renderer/Camera.ts', 'src/renderer/MinimapRenderer.ts', 'src/renderer/CarLabels.ts']
        .map(f => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')).join('\n');
      assert(!/pitLanePoints/.test(src), `${circuit}: dibujo/cámara/minimapa no recalculan una ruta de boxes propia`);
    });

    await test(`Q20 ${circuit}: parada completa Q9-Q11 sin saltos y con extremos correctos`, async () => {
      const originalRandom = Math.random; Math.random = () => 0.99;
      try {
        const sim = make(circuit);
        const car = sim.cars[0]; sim.cars = [car];
        const t = sim.activeTrack, route = t.pitLanePoints;
        car.progress = 1 + ((t.pitCommitmentT - 0.03) % 1 + 1) % 1; car.trackT = car.progress % 1; car.currentLap = 1; car.currentSpeedKmh = 250;
        const order = sim.issueBoxOrder(car.id, 'hard');
        assert(order?.status === 'accepted', `${circuit}: orden aceptada`);
        let prev = { x: car.worldX, y: car.worldY }, prevStep = 0, wasIn = false, entryPos = null, exitPos = null, maxJump = 0, ratio = 0;
        for (let i = 0; i < 30000 && !(wasIn && !car.isInPitLane); i++) {
          sim.update(0.02);
          const cur = { x: car.worldX, y: car.worldY }, step = dist(cur, prev);
          if (prevStep > 0.05) ratio = Math.max(ratio, step / prevStep);
          maxJump = Math.max(maxJump, step);
          if (!wasIn && car.isInPitLane) entryPos = cur;
          if (wasIn && !car.isInPitLane) exitPos = cur;
          wasIn = wasIn || car.isInPitLane; prev = cur; prevStep = step;
        }
        assert(order.status === 'consumed' && car.pitStop.totalPitStops === 1 && car.tires.compound === 'hard', `${circuit}: parada servida una sola vez`);
        assert(entryPos && dist(entryPos, route[0]) <= dist(route[0], route[1]) * 4, `${circuit}: el coche entra a boxes en el extremo de entrada`);
        assert(exitPos && dist(exitPos, route.at(-1)) <= dist(route.at(-2), route.at(-1)) * 4, `${circuit}: el coche sale de boxes en el extremo de salida`);
        assert(ratio < 3, `${circuit}: sin teletransportes entre pasos consecutivos`, `ratio ${ratio}`);
      } finally { Math.random = originalRandom; }
    });

    await test(`Q20 ${circuit}: geometría real verificable registrada y coincidente`, async () => {
      const ref = references[circuit];
      assert(ref && ref.status === 'VERIFICADO', `${circuit}: referencia verificada aportada (estado ${ref?.status})`);
      assert(ref && ref.source && ref.edition && ref.direction && ref.svgTransform, `${circuit}: fuente, edición, sentido y transformación al SVG registrados`);
      assert(ref && Number.isFinite(ref.entryT) && Number.isFinite(ref.exitT), `${circuit}: entryT/exitT de referencia numéricos`);
      if (ref && Number.isFinite(ref.entryT) && Number.isFinite(ref.exitT)) {
        assert(circularDelta(track.pitEntryT, ref.entryT) <= REFERENCE_TOLERANCE_T, `${circuit}: entrada dentro de ${REFERENCE_TOLERANCE_T} vueltas de la referencia`,
          `dibujada ${track.pitEntryT} referencia ${ref.entryT}`);
        assert(circularDelta(track.pitExitT, ref.exitT) <= REFERENCE_TOLERANCE_T, `${circuit}: salida dentro de ${REFERENCE_TOLERANCE_T} vueltas de la referencia`,
          `dibujada ${track.pitExitT} referencia ${ref.exitT}`);
      }
    });
  }
}
