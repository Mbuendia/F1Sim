import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';

export class TrackRenderer {
  /**
   * Renderiza el circuito oficial FIA de Barcelona con sectores y asfalto bicapa
   */
  static renderTrack(
    ctx: CanvasRenderingContext2D,
    track: TrackDefinition,
    camera: Camera,
    dpr: number
  ) {
    const points = track.points;
    const n = points.length;
    const zoom = camera.zoom;
    const trackWidth = track.trackWidthMeters * 2.2 * zoom;

    const buildPath = () => {
      ctx.beginPath();
      const first = camera.worldToScreen(points[0].x, points[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < n; i++) {
        const p = camera.worldToScreen(points[i].x, points[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ── 1. ÁREA PERIMETRAL / GRAVA / ESCAPATORIAS ──
    buildPath();
    ctx.strokeStyle = '#181d16';
    ctx.lineWidth = trackWidth + 26 * zoom;
    ctx.stroke();

    buildPath();
    ctx.strokeStyle = '#615742'; // Grava oscura
    ctx.lineWidth = trackWidth + 10 * zoom;
    ctx.stroke();

    // ── 2. PIANOS (KERBS ROJO Y BLANCO) ──
    buildPath();
    ctx.strokeStyle = '#c51010';
    ctx.lineWidth = trackWidth + 5 * zoom;
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([10 * zoom, 10 * zoom]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = trackWidth + 5 * zoom;
    buildPath();
    ctx.stroke();
    ctx.restore();

    // ── 3. NIVEL 1: ASFALTO BASE DEL CIRCUITO ──
    buildPath();
    ctx.strokeStyle = '#2b2f38';
    ctx.lineWidth = trackWidth;
    ctx.stroke();

    // ── 4. NIVEL 2: TRAZADA ENGOMADA (RACING LINE NEGRA) ──
    buildPath();
    ctx.strokeStyle = '#13151b';
    ctx.lineWidth = trackWidth * 0.55;
    ctx.stroke();

    // ── 5. LÍNEAS DE LÍMITE DE PISTA ──
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = Math.max(1.0, 1.3 * zoom);
    buildPath();
    ctx.stroke();
    ctx.restore();

    // ── 6. PIT LANE LIMPIO Y CONTINUO ──
    this.renderPitLane(ctx, track, camera);

    // ── 7. LÍNEA DE META OFICIAL ──
    this.renderStartFinishLine(ctx, track, camera);

    // ── 8. ETIQUETAS DE CURVAS OFICIALES ──
    if (zoom >= 0.75) {
      this.renderCornerLabels(ctx, track, camera);
    }
  }

  private static renderPitLane(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const pitPts = track.pitLanePoints;
    if (!pitPts || pitPts.length === 0) return;

    const zoom = camera.zoom;
    ctx.save();
    ctx.beginPath();
    const first = camera.worldToScreen(pitPts[0].x, pitPts[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pitPts.length; i++) {
      const p = camera.worldToScreen(pitPts[i].x, pitPts[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = '#22252e';
    ctx.lineWidth = 10 * zoom;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Línea amarilla de velocidad
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.lineWidth = 1.5 * zoom;
    ctx.setLineDash([5 * zoom, 5 * zoom]);
    ctx.stroke();

    const entryPt = camera.worldToScreen(pitPts[0].x, pitPts[0].y);
    ctx.font = `bold ${Math.max(8, 8 * zoom)}px 'Orbitron', sans-serif`;
    ctx.fillStyle = '#eab308';
    ctx.textAlign = 'center';
    ctx.fillText('80 KM/H', entryPt.x, entryPt.y - 7 * zoom);

    ctx.restore();
  }

  private static renderStartFinishLine(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const startPoint = track.points[0];
    const zoom = camera.zoom;
    const hw = (track.trackWidthMeters * 2.2 * zoom) / 2;

    const nx = Math.cos(startPoint.angle + Math.PI / 2);
    const ny = Math.sin(startPoint.angle + Math.PI / 2);

    const p1 = camera.worldToScreen(startPoint.x + nx * hw, startPoint.y + ny * hw);
    const p2 = camera.worldToScreen(startPoint.x - nx * hw, startPoint.y - ny * hw);

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.5, 3.5 * zoom);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Punto rojo distintivo oficial en meta
    const centerScreen = camera.worldToScreen(startPoint.x, startPoint.y);
    ctx.fillStyle = '#e10600';
    ctx.beginPath();
    ctx.arc(centerScreen.x, centerScreen.y, Math.max(3, 4 * zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2 * zoom;
    ctx.stroke();

    ctx.restore();
  }

  private static renderCornerLabels(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const zoom = camera.zoom;
    ctx.save();

    for (const corner of track.corners) {
      const pointIdx = Math.floor(corner.t * track.points.length) % track.points.length;
      const pt = track.points[pointIdx];
      const hw = (track.trackWidthMeters * 2.2 * zoom) / 2 + 15 * zoom;

      const nx = Math.cos(pt.angle + Math.PI / 2);
      const ny = Math.sin(pt.angle + Math.PI / 2);

      const labelPos = camera.worldToScreen(pt.x - nx * hw, pt.y - ny * hw);

      const fontSize = Math.max(8, Math.min(11, 9 * zoom));
      ctx.font = `700 ${fontSize}px 'Rajdhani', sans-serif`;
      
      const labelText = `T${corner.number} ${corner.name}`;
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
      ctx.beginPath();
      ctx.roundRect(labelPos.x - textWidth / 2 - 3, labelPos.y - fontSize / 2 - 2, textWidth + 6, fontSize + 4, 3);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelPos.x, labelPos.y);
    }

    ctx.restore();
  }
}
