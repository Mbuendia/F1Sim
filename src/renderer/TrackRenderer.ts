import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';

export class TrackRenderer {
  /**
   * Renderiza el circuito oficial FIA con pista ancha, asfalto bicapa, pit lane oficial y meta ajedrezada
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
    const trackWidth = (track.trackWidthMeters || 26) * 1.7 * zoom;

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

    // ── 1. ÁREA PERIMETRAL / ESCAPATORIAS / GRAVA ──
    buildPath();
    ctx.strokeStyle = '#181e1a'; // Hierba oscura exterior
    ctx.lineWidth = trackWidth + 40 * zoom;
    ctx.stroke();

    buildPath();
    ctx.strokeStyle = '#5a4f3a'; // Grava oficial
    ctx.lineWidth = trackWidth + 18 * zoom;
    ctx.stroke();

    // ── 2. PIANOS OFICIALES FIA (KERBS ROJOS Y BLANCOS) ──
    buildPath();
    ctx.strokeStyle = '#d90429'; // Rojo vibrante
    ctx.lineWidth = trackWidth + 8 * zoom;
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([12 * zoom, 12 * zoom]);
    ctx.strokeStyle = '#ffffff'; // Blanco
    ctx.lineWidth = trackWidth + 8 * zoom;
    buildPath();
    ctx.stroke();
    ctx.restore();

    // ── 3. ASFALTO BASE DEL CIRCUITO (BICAPA ANCHO) ──
    buildPath();
    ctx.strokeStyle = '#272b35';
    ctx.lineWidth = trackWidth;
    ctx.stroke();

    // ── 4. TRAZADA ENGOMADA (RACING LINE NEGRA) ──
    buildPath();
    ctx.strokeStyle = '#12141a';
    ctx.lineWidth = trackWidth * 0.52;
    ctx.stroke();

    // ── 5. LÍNEAS DE LÍMITES DE PISTA BLANCAS ──
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = Math.max(1.2, 1.8 * zoom);
    buildPath();
    ctx.stroke();
    ctx.restore();

    // ── 6. PIT LANE COMPLETO & MURO DE BOXES ──
    this.renderPitLane(ctx, track, camera);

    // ── 7. LÍNEA DE META OFICIAL AJEDREZADA & PÓRTICO FIA ──
    this.renderStartFinishLine(ctx, track, camera);

    // ── 8. ETIQUETAS DE CURVAS OFICIALES ──
    if (zoom >= 0.70) {
      this.renderCornerLabels(ctx, track, camera);
    }
  }

  private static renderPitLane(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const pitPts = track.pitLanePoints;
    if (!pitPts || pitPts.length < 2) return;

    const zoom = camera.zoom;
    const pitWidth = 16 * zoom;

    ctx.save();

    // Asfalto del carril de boxes
    ctx.beginPath();
    const first = camera.worldToScreen(pitPts[0].x, pitPts[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pitPts.length; i++) {
      const p = camera.worldToScreen(pitPts[i].x, pitPts[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = '#2d3340';
    ctx.lineWidth = pitWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Línea amarilla central discontinua de boxes
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.75)';
    ctx.lineWidth = 1.6 * zoom;
    ctx.setLineDash([6 * zoom, 6 * zoom]);
    ctx.stroke();

    // Muro de boxes / Pit Wall (línea blanca y roja sólida separadora)
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0 * zoom;
    ctx.stroke();

    // Señalética de Entrada a Boxes
    const entryPt = camera.worldToScreen(pitPts[0].x, pitPts[0].y);
    ctx.fillStyle = 'rgba(234, 179, 8, 0.95)';
    ctx.font = `bold ${Math.max(9, 9 * zoom)}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('PIT IN · 80 KM/H', entryPt.x, entryPt.y - 12 * zoom);

    // Señalética de Salida de Boxes
    const exitPt = camera.worldToScreen(pitPts[pitPts.length - 1].x, pitPts[pitPts.length - 1].y);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('PIT OUT', exitPt.x, exitPt.y - 12 * zoom);

    // Boxes de los equipos (puntos de parada)
    const midIdx = Math.floor(pitPts.length * 0.45);
    for (let b = -4; b <= 4; b++) {
      const idx = midIdx + b * 2;
      if (idx >= 0 && idx < pitPts.length) {
        const boxPt = camera.worldToScreen(pitPts[idx].x, pitPts[idx].y);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(boxPt.x - 3 * zoom, boxPt.y - 4 * zoom, 6 * zoom, 8 * zoom);
      }
    }

    ctx.restore();
  }

  private static renderStartFinishLine(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const startPoint = track.points[0];
    const zoom = camera.zoom;
    const trackWidth = (track.trackWidthMeters || 26) * 1.7 * zoom;
    const hw = trackWidth / 2;

    const nx = Math.cos(startPoint.angle + Math.PI / 2);
    const ny = Math.sin(startPoint.angle + Math.PI / 2);

    const p1 = camera.worldToScreen(startPoint.x + nx * hw, startPoint.y + ny * hw);
    const p2 = camera.worldToScreen(startPoint.x - nx * hw, startPoint.y - ny * hw);

    ctx.save();

    // 1. Línea de meta ajedrezada (Checkered Line)
    const segments = 10;
    for (let s = 0; s < segments; s++) {
      const t1 = s / segments;
      const t2 = (s + 1) / segments;
      const sx1 = p1.x + (p2.x - p1.x) * t1;
      const sy1 = p1.y + (p2.y - p1.y) * t1;
      const sx2 = p1.x + (p2.x - p1.x) * t2;
      const sy2 = p1.y + (p2.y - p1.y) * t2;

      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.strokeStyle = s % 2 === 0 ? '#ffffff' : '#000000';
      ctx.lineWidth = Math.max(3.5, 5 * zoom);
      ctx.stroke();
    }

    // 2. Líneas blancas de parrilla / bordes
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.0, 2.5 * zoom);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 3. Letrero de START / FINISH en el asfalto
    const centerScreen = camera.worldToScreen(startPoint.x, startPoint.y);
    ctx.font = `900 ${Math.max(9, 10 * zoom)}px 'Orbitron', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('FINISH / META', centerScreen.x, centerScreen.y - 8 * zoom);

    // 4. Faro/Baliza oficial roja en el lateral
    ctx.fillStyle = '#e10600';
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, Math.max(4, 5.5 * zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * zoom;
    ctx.stroke();

    ctx.restore();
  }

  private static renderCornerLabels(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const zoom = camera.zoom;
    ctx.save();

    for (const corner of track.corners) {
      const pointIdx = Math.floor(corner.t * track.points.length) % track.points.length;
      const pt = track.points[pointIdx];
      const hw = ((track.trackWidthMeters || 26) * 1.7 * zoom) / 2 + 18 * zoom;

      const nx = Math.cos(pt.angle + Math.PI / 2);
      const ny = Math.sin(pt.angle + Math.PI / 2);

      const labelPos = camera.worldToScreen(pt.x - nx * hw, pt.y - ny * hw);

      const fontSize = Math.max(8.5, Math.min(12, 10 * zoom));
      ctx.font = `800 ${fontSize}px 'Rajdhani', sans-serif`;
      
      const labelText = `T${corner.number}`;
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = 'rgba(10, 15, 25, 0.88)';
      ctx.beginPath();
      ctx.roundRect(labelPos.x - textWidth / 2 - 4, labelPos.y - fontSize / 2 - 2, textWidth + 8, fontSize + 4, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelPos.x, labelPos.y);
    }

    ctx.restore();
  }
}