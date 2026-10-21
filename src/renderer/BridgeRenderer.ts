/**
 * Tablero del puente (21/10/2026): se pinta encima de la pista y de los coches que pasan por debajo, y debajo de los
 * que van por arriba (`bridgePaintOrder`). Lleva su sombra sobre el tramo de abajo, según el sol.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { Camera } from './Camera';
import type { Overpass } from './overpass';
import { shadowOffset, type Sun } from './lighting';
import { ASPHALT_DRY, ASPHALT_WET } from './trackLayers';

/** Media longitud del tablero a cada lado del cruce (m): cubre el tramo de abajo con sus pianos y escapatorias. */
const DECK_HALF_M = 30;
/** Altura del tablero sobre el tramo de abajo (m), para su sombra. */
const DECK_HEIGHT_M = 7;
/** Largo de cada rampa de acceso al tablero (m), donde no cae la sombra del puente. */
const RAMP_M = 60;
/** Ancho de cada lado de hormigón con su pretil (m). */
const SIDE_M = 1.6;

type Pt = { x: number; y: number };

export function renderBridge(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera, o: Overpass, sun: Sun, wet: boolean) {
  const points = track.points;
  const n = points.length;
  if (n < 4) return;
  const width = track.trackWidthMeters || 12;
  const spacing = (track.lapLengthMeters || n) / n;
  const center = Math.round(o.upperT * n);
  const half = Math.max(2, Math.round(DECK_HALF_M / spacing));
  const spanOf = (h: number) => Array.from({ length: 2 * h + 1 }, (_, k) => points[(((center - h + k) % n) + n) % n]);
  const span = spanOf(half);
  /** Las rampas a cada lado del tablero: la sombra del puente no cae sobre su propia carretera. */
  const ramps = spanOf(half + Math.round(RAMP_M / spacing));
  const offsetLine = (d: number, shift: Pt = { x: 0, y: 0 }, along = span): Pt[] => along.map(p => {
    const nx = Math.cos(p.angle + Math.PI / 2), ny = Math.sin(p.angle + Math.PI / 2);
    return camera.worldToScreen(p.x + nx * d + shift.x, p.y + ny * d + shift.y);
  });
  const zoom = camera.zoom;
  const band = (inner: number, outer: number, shift?: Pt, along = span, fresh = true) => {
    const a = offsetLine(inner, shift, along), b = offsetLine(outer, shift, along).reverse();
    if (fresh) ctx.beginPath();
    ctx.moveTo(a[0].x, a[0].y);
    for (const p of a) ctx.lineTo(p.x, p.y);
    for (const p of b) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  };
  const line = (d: number, w: number, color: string) => {
    const pts = offsetLine(d);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, w * zoom);
    ctx.stroke();
  };
  const outer = width / 2 + SIDE_M;

  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  // Sombra del tablero sobre lo de abajo (y sobre los coches que pasan por debajo).
  if (sun.alpha > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, 2e5);
    // Un poco más largo que las rampas, para que el borde del recorte no deje una raya sobre la pista.
    band(-outer - 0.5, outer + 0.5, undefined, spanOf(half + Math.round(RAMP_M / spacing) + 4), false);
    ctx.clip('evenodd');
    // La carretera sube desde el inicio de cada rampa hasta el tablero: su sombra crece con la altura.
    const rampPts = ramps.length, deckFrom = rampPts / 2 - half, deckTo = rampPts / 2 + half;
    const heightAt = (k: number) => k >= deckFrom && k <= deckTo ? DECK_HEIGHT_M
      : DECK_HEIGHT_M * Math.max(0, 1 - (k < deckFrom ? deckFrom - k : k - deckTo) / (deckFrom || 1));
    const edge = (d: number) => ramps.map((p, k) => {
      const nx = Math.cos(p.angle + Math.PI / 2), ny = Math.sin(p.angle + Math.PI / 2);
      const off = shadowOffset(sun, heightAt(k));
      return camera.worldToScreen(p.x + nx * d + off.x, p.y + ny * d + off.y);
    });
    const left = edge(-outer), right = edge(outer).reverse();
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (const q of left) ctx.lineTo(q.x, q.y);
    for (const q of right) ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.6, sun.alpha * 1.1).toFixed(3)})`;
    ctx.fill();
    ctx.restore();
  }
  // Canto del tablero, algo más oscuro que la pista, para que se lea el borde del puente.
  band(-outer - 0.4, outer + 0.4);
  ctx.fillStyle = '#1a1d24';
  ctx.fill();
  band(-outer, outer);
  ctx.fillStyle = '#5f6570';
  ctx.fill();
  band(-width / 2, width / 2);
  ctx.fillStyle = wet ? ASPHALT_WET : ASPHALT_DRY;
  ctx.fill();
  // Líneas blancas de los bordes de la pista y pretiles.
  ctx.globalAlpha = 0.75;
  line(-width / 2 + 0.2, 0.25, '#ffffff');
  line(width / 2 - 0.2, 0.25, '#ffffff');
  ctx.globalAlpha = 1;
  for (const side of [-1, 1]) {
    line(side * (outer - 0.45), 0.6, '#c9ced6');
    line(side * (outer - 0.15), 0.2, '#8a919c');
  }
  // Juntas de dilatación en los extremos.
  for (const p of [span[0], span[span.length - 1]]) {
    const nx = Math.cos(p.angle + Math.PI / 2), ny = Math.sin(p.angle + Math.PI / 2);
    const a = camera.worldToScreen(p.x - nx * outer, p.y - ny * outer), b = camera.worldToScreen(p.x + nx * outer, p.y + ny * outer);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(10, 12, 16, 0.85)';
    ctx.lineWidth = Math.max(1, 0.35 * zoom);
    ctx.stroke();
  }
  ctx.restore();
}
