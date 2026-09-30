import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { generatePitLanePoints } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
    console.log('\n--- TEST GROUP 10: Q3 — carriles, barreras y cajones de equipo ---');
    {
      const { buildPitLaneGeometry } = await server.ssrLoadModule('/src/utils/pitLaneGeometry.ts');
      const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
      const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
      const teams = Object.values(TEAMS);
      const distanceToPath = (p, path, closed = false) => {
        let best = Infinity;
        for (let i = 1; i < path.length + (closed ? 1 : 0); i++) {
          const a = path[i - 1], b = path[i % path.length];
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
          best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
        }
        return best;
      };
      let referenceTrack;
      for (const direction of [-1, 1]) {
        for (const pitOffset of [-38, 38]) {
          const points = Array.from({ length: 750 }, (_, i) => {
            const a = direction * i / 750 * Math.PI * 2;
            return { x: 500 * Math.cos(a), y: 500 * Math.sin(a), angle: a + direction * Math.PI / 2,
              normal: { x: -direction * Math.cos(a), y: -direction * Math.sin(a) } };
          });
          const track = { points, trackWidthMeters: 24, corners: [], pitEntryT: 0.85, pitExitT: 0.1,
            pitLanePoints: generatePitLanePoints(points, 0.85, 0.1, pitOffset) };
          referenceTrack = track;
          const before = JSON.stringify(track);
          const geometry = buildPitLaneGeometry(track, teams);
          const label = `sentido ${direction}, offset ${pitOffset}`;
          assert(geometry.boxes.length === 10 && new Set(geometry.boxes.map(b => b.team.id)).size === 10, `Q3: Diez cajones, uno por equipo (${label})`);
          assert(geometry.walls.length > 0 && geometry.walls.every(segment => {
            const [a, b] = segment;
            return [0, 0.25, 0.5, 0.75, 1].every(t => {
              const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
              return distanceToPath(p, geometry.fastLane) > geometry.fastLaneWidth / 2 + geometry.wallWidth / 2 &&
                distanceToPath(p, points, true) > 24 * 1.75 / 2 + geometry.wallWidth / 2;
            });
          }), `Q3: Muro separado del carril rápido y del asfalto (${label})`);
          assert(geometry.boxes.every(box => box.corners.every(p => distanceToPath(p, geometry.fastLane) > geometry.fastLaneWidth / 2)),
            `Q3: Cajones fuera del carril rápido (${label})`);
          assert(geometry.boxes.every((box, i, boxes) => i === 0 || Math.hypot(box.center.x - boxes[i - 1].center.x, box.center.y - boxes[i - 1].center.y) > 12),
            `Q3: Cajones consecutivos sin solapamiento (${label})`);
          assert(geometry.walls.every(wall => wall.every(p => Math.hypot(p.x - track.pitLanePoints[0].x, p.y - track.pitLanePoints[0].y) > 20 &&
            Math.hypot(p.x - track.pitLanePoints.at(-1).x, p.y - track.pitLanePoints.at(-1).y) > 20)), `Q3: Entrada y salida abiertas (${label})`);
          assert(JSON.stringify(track) === before && geometry.fastLane[0] === track.pitLanePoints[0] && geometry.fastLane.at(-1) === track.pitLanePoints.at(-1),
            `Q3: Ruta Q2 y estado originales intactos (${label})`);
          assert(geometry.trackEdges.length === 2 && geometry.trackEdges.every(edge => edge.every((p, i) => Math.abs(Math.hypot(p.x - points[i].x, p.y - points[i].y) - 21) < 1e-7)),
            `Q3: Dos bordes blancos en los límites, sin línea central falsa (${label})`);
        }
      }
      for (const pitLanePoints of [[], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }]]) {
        const geometry = buildPitLaneGeometry({ ...referenceTrack, pitLanePoints }, teams);
        assert(geometry.walls.length === 0 && geometry.boxes.length === 0, 'Q3: Ruta vacía o degenerada no dibuja barreras/cajones inválidos');
      }
      for (const zoom of [0.25, 1, 4]) {
        const rotation = 0.7;
        let path = [];
        const strokes = [], fills = [];
        const ctx = new Proxy({
          beginPath: () => { path = []; }, moveTo: (x, y) => path.push({ x, y }), lineTo: (x, y) => path.push({ x, y }),
          stroke: () => strokes.push({ color: ctx.strokeStyle, width: ctx.lineWidth, points: [...path] }),
          fill: () => fills.push({ color: ctx.fillStyle, points: [...path] }),
        }, { get: (target, key) => target[key] ?? (() => {}) });
        const camera = { zoom, rotation, worldToScreen: (x, y) => ({ x: zoom * (x * Math.cos(rotation) - y * Math.sin(rotation)), y: zoom * (x * Math.sin(rotation) + y * Math.cos(rotation)) }) };
        TrackRenderer.renderTrack(ctx, referenceTrack, camera, 1);
        const fast = strokes.find(s => s.color === '#242c38');
        const wall = strokes.find(s => s.color === '#aeb9c8');
        assert(fast?.width === 10 * zoom && wall?.width === zoom && wall.points.length > 0, `Q3: Renderer separa rutas y escala anchuras una vez (zoom ${zoom})`);
        assert(teams.every(team => fills.filter(f => f.color === `${team.color}55`).length === 1), `Q3: Renderer dibuja los diez cajones de equipo (zoom ${zoom})`);
        assert(strokes.filter(s => s.color === 'rgba(255, 255, 255, 0.75)').length === 2, `Q3: Renderer dibuja ambos límites de pista (zoom ${zoom})`);
      }
    }

}
