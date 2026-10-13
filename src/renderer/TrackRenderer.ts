import { drsMarkers } from './drsMarkers';
import { SIGNALS } from './signals';
import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';
import { TrackWeatherState } from '../types/f1';
import { getPitLaneGeometry, PitLaneGeometry } from '../utils/pitLaneGeometry';
import { getScenario } from '../data/scenarioRegistry';
import { buildScenarioGeometry, ScenarioGeometry } from '../utils/scenarioGeometry';
import type { Point2D } from '../utils/spline';
import { calculateCarWorldPosition, GRID_LATERAL_OFFSET, GRID_SLOT_M } from '../utils/carPosition';
import { KERB_WIDTH } from '../utils/scenarioGeometry';

/** [G7] Grosor de la línea de meta (m). */
export const FINISH_LINE_M = 1.5;
const racingLines = new WeakMap<TrackDefinition, { x: number; y: number }[]>();

export class TrackRenderer {
  private static scenarioCache = new WeakMap<TrackDefinition, ScenarioGeometry>();
  /** Último circuitId usado para invalidar la caché de escenario al cambiar de circuito */
  private static lastCircuitId: string = '';

  private static geometryFor(track: TrackDefinition): PitLaneGeometry {
    return getPitLaneGeometry(track);
  }

  private static scenarioFor(track: TrackDefinition, circuitId: string): ScenarioGeometry {
    // Invalidar la caché si cambiamos de circuito (evita herencia de escenario)
    if (circuitId !== this.lastCircuitId) {
      this.scenarioCache = new WeakMap<TrackDefinition, ScenarioGeometry>();
      this.lastCircuitId = circuitId;
    }
    let scenarioGeo = this.scenarioCache.get(track);
    if (!scenarioGeo) {
      const scenario = getScenario(circuitId);
      scenarioGeo = buildScenarioGeometry(track, scenario);
      this.scenarioCache.set(track, scenarioGeo);
    }
    return scenarioGeo;
  }

  private static path(ctx: CanvasRenderingContext2D, points: Point2D[], camera: Camera, closed = false, stride = 1) {
    ctx.beginPath();
    for (let index = 0; index < points.length; index += stride) {
      const screen = camera.worldToScreen(points[index].x, points[index].y);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    }
    if (closed) ctx.closePath();
  }

  /**
   * Renderiza el circuito con escenario por capas diferenciado según el tipo de circuito.
   * Barcelona (permanente): hierba + grava/asfalto localizado + pianos en curvas.
   * Mónaco (urbano): fondo urbano + barreras armco/hormigón + pianos mínimos.
   * Otros (fallback): bandas uniformes legacy (cero regresión visual).
   */
  static renderTrack(
    ctx: CanvasRenderingContext2D,
    track: TrackDefinition,
    camera: Camera,
    _dpr: number,
    weather?: TrackWeatherState,
    circuitId: string = 'barcelona'
  ) {
    const points = track.points;
    const n = points.length;
    const zoom = camera.zoom;
    const trackWidth = (track.trackWidthMeters || 12) * zoom;
    const isWet = (weather?.waterPercentage || 0) > 10;

    // [G4] Con la cámara lejos basta una muestra cada pocos metros: menos trabajo por fotograma y el mismo dibujo.
    const stride = TrackRenderer.strideFor(zoom, n, track.lapLengthMeters);
    const buildPath = () => {
      ctx.beginPath();
      const first = camera.worldToScreen(points[0].x, points[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = stride; i < n; i += stride) {
        const p = camera.worldToScreen(points[i].x, points[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const scenarioGeo = this.scenarioFor(track, circuitId);
    const isLegacy = scenarioGeo.runoffPolygons.length === 0
                  && scenarioGeo.kerbSegments.length === 0
                  && scenarioGeo.barrierLines.length === 0;

    if (isLegacy) {
      // ── RENDERIZADO LEGACY (fallback para circuitos sin escenario) ──
      // Reproduce exactamente el comportamiento original: bandas uniformes
      this.renderLegacyLayers(ctx, buildPath, trackWidth, zoom);
    } else {
      // ── RENDERIZADO POR CAPAS (Q6) ──
      this.renderScenarioLayers(ctx, track, camera, scenarioGeo, buildPath, trackWidth, zoom);
    }

    // ── ASFALTO BASE DEL CIRCUITO (común a ambos modos) ──
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // [G4] Asfalto al ancho real del circuito, en un solo trazo.
    buildPath();
    ctx.strokeStyle = isWet ? '#161922' : '#272b35';
    ctx.lineWidth = trackWidth;
    ctx.stroke();

    // ── TRAZADA ENGOMADA (RACING LINE) Q8 ──
    // [G5] La goma se pinta sobre la trazada ideal; los tramos con la misma opacidad van en un solo trazo.
    const line = this.racingLineFor(track);
    ctx.lineWidth = Math.max(1, 2.2 * zoom);
    let bucket = -1;
    for (let i = 0; i < n; i += stride) {
      const level = Math.round(Math.min(1.0, 0.15 + (points[i].rubberGrip || 0) * 0.7) * 20);
      if (level !== bucket) {
        if (bucket >= 0) ctx.stroke();
        bucket = level;
        const from = camera.worldToScreen(line[i].x, line[i].y);
        ctx.beginPath();
        ctx.strokeStyle = isWet ? `rgba(13, 16, 23, ${level / 20})` : `rgba(20, 22, 28, ${level / 20})`;
        ctx.moveTo(from.x, from.y);
      }
      const to = camera.worldToScreen(line[(i + stride) % n].x, line[(i + stride) % n].y);
      ctx.lineTo(to.x, to.y);
    }
    if (bucket >= 0) ctx.stroke();

    // [R44] El agua por tramo y el radar de lluvia los pinta WeatherRenderer con los datos del modelo.

    // ── BARRERAS (solo escenario Q6, se pintan encima del asfalto) ──
    if (!isLegacy) {
      this.renderBarriers(ctx, scenarioGeo, camera, zoom);
    }

    // ── LÍNEAS DE LÍMITES DE PISTA BLANCAS ──
    ctx.save();
    ctx.strokeStyle = isWet ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = Math.max(1, 0.25 * zoom);
    for (const edge of this.geometryFor(track).trackEdges) {
      this.path(ctx, edge, camera, true, stride);
      ctx.stroke();
    }
    ctx.restore();

    // ── PIT LANE COMPLETO & MURO DE BOXES ──
    this.renderPitLane(ctx, track, camera);

    // ── LÍNEA DE META OFICIAL AJEDREZADA & PÓRTICO FIA ──
    this.renderStartFinishLine(ctx, track, camera);
    if (zoom >= 1.5) this.renderGrid(ctx, track, camera);

    // ── ETIQUETAS DE CURVAS OFICIALES ──
    if (zoom >= 0.70) {
      this.renderCornerLabels(ctx, track, camera);
    }
  }

  /**
   * Renderizado legacy: bandas uniformes de hierba, grava y pianos
   * alrededor de todo el circuito. Idéntico al comportamiento pre-Q6.
   */
  private static renderLegacyLayers(
    ctx: CanvasRenderingContext2D,
    buildPath: () => void,
    trackWidth: number,
    zoom: number
  ) {
    // 1. Hierba exterior
    buildPath();
    ctx.strokeStyle = '#181e1a';
    ctx.lineWidth = trackWidth + 40 * zoom;
    ctx.stroke();

    // 2. Grava oficial
    buildPath();
    ctx.strokeStyle = '#5a4f3a';
    ctx.lineWidth = trackWidth + 18 * zoom;
    ctx.stroke();

    // 3. Pianos rojos
    buildPath();
    ctx.strokeStyle = '#d90429';
    ctx.lineWidth = trackWidth + 2 * KERB_WIDTH * zoom;
    ctx.stroke();

    // 4. Pianos blancos ajedrezados
    ctx.save();
    ctx.setLineDash([3 * zoom, 3 * zoom]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = trackWidth + 2 * KERB_WIDTH * zoom;
    buildPath();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renderizado por capas Q6: terreno base, escapatorias localizadas,
   * pianos solo en curvas. Cada zona es un polígono/path independiente.
   */
  private static renderScenarioLayers(
    ctx: CanvasRenderingContext2D,
    track: TrackDefinition,
    camera: Camera,
    scenarioGeo: ScenarioGeometry,
    buildPath: () => void,
    trackWidth: number,
    zoom: number
  ) {
    // ── 0. TERRENO BASE ──
    // Para circuitos con escenario, pintamos la banda perimetral con el color de terreno
    buildPath();
    ctx.strokeStyle = scenarioGeo.terrainColor;
    ctx.lineWidth = trackWidth + 40 * zoom;
    ctx.stroke();

    // ── 1. GRAVA GLOBAL (solo si el circuito tiene grava general) ──
    if (scenarioGeo.hasGravelGlobal) {
      buildPath();
      ctx.strokeStyle = '#5a4f3a';
      ctx.lineWidth = trackWidth + 18 * zoom;
      ctx.stroke();
    }

    // ── 2. ESCAPATORIAS LOCALIZADAS ──
    ctx.save();
    for (const runoff of scenarioGeo.runoffPolygons) {
      this.path(ctx, runoff.points, camera, true);
      ctx.fillStyle = runoff.color;
      ctx.fill();
    }
    ctx.restore();

    // ── 3. PIANOS LOCALIZADOS (solo en curvas) ──
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    const kerbWidth = KERB_WIDTH * zoom;

    for (const kerb of scenarioGeo.kerbSegments) {
      if (kerb.points.length < 2) continue;

      // Piano rojo base
      this.path(ctx, kerb.points, camera);
      ctx.strokeStyle = '#d90429';
      ctx.lineWidth = kerbWidth;
      ctx.stroke();

      // Patrón ajedrezado blanco encima
      ctx.save();
      ctx.setLineDash([3 * zoom, 3 * zoom]);
      this.path(ctx, kerb.points, camera);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = kerbWidth;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Renderiza barreras/muros de contención (armco, hormigón, tecpro).
   * Se pintan encima del asfalto para que sean visibles.
   */
  private static renderBarriers(
    ctx: CanvasRenderingContext2D,
    scenarioGeo: ScenarioGeometry,
    camera: Camera,
    zoom: number
  ) {
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    for (const barrier of scenarioGeo.barrierLines) {
      if (barrier.points.length < 2) continue;
      this.path(ctx, barrier.points, camera);
      ctx.strokeStyle = barrier.color;
      ctx.lineWidth = barrier.width * zoom;
      ctx.stroke();

      // Efecto de reflejo metálico para armco
      if (barrier.type === 'armco') {
        ctx.save();
        this.path(ctx, barrier.points, camera);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = barrier.width * 0.4 * zoom;
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private static renderPitLane(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const geometry = this.geometryFor(track);
    const pitPts = geometry.fastLane;
    if (pitPts.length < 2) return;
    const zoom = camera.zoom;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.setLineDash([]);

    // Plataforma de trabajo independiente, al lado de los garajes.
    this.path(ctx, geometry.serviceArea, camera, true);
    ctx.fillStyle = '#404753';
    ctx.fill();

    // El eje conservado de Q2 es exclusivamente el carril rápido.
    this.path(ctx, pitPts, camera);
    ctx.strokeStyle = '#242c38';
    ctx.lineWidth = geometry.fastLaneWidth * zoom;
    ctx.stroke();

    ctx.strokeStyle = '#d9dde5';
    ctx.lineWidth = Math.max(0.6, 0.2 * zoom);
    for (const edge of geometry.fastLaneEdges) {
      this.path(ctx, edge, camera);
      ctx.stroke();
    }

    // Barreras únicamente donde caben entre pista y carril, sin cerrar los accesos.
    ctx.beginPath();
    for (const [start, end] of geometry.walls) {
      const a = camera.worldToScreen(start.x, start.y);
      const b = camera.worldToScreen(end.x, end.y);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = '#aeb9c8';
    ctx.lineWidth = geometry.wallWidth * zoom;
    ctx.stroke();

    // Un cajón por equipo, orientado con la tangente de su zona de servicio.
    for (const box of geometry.boxes) {
      this.path(ctx, box.corners, camera, true);
      ctx.fillStyle = `${box.team.color}55`;
      ctx.fill();
      ctx.strokeStyle = box.team.color;
      ctx.lineWidth = Math.max(0.6, 0.25 * zoom);
      ctx.stroke();

      if (zoom >= 2.5) {
        const label = camera.worldToScreen(box.label.x, box.label.y);
        ctx.save();
        ctx.translate(label.x, label.y);
        const angle = box.angle + camera.rotation;
        ctx.rotate(Math.cos(angle) < 0 ? angle + Math.PI : angle);
        ctx.font = `700 ${2.6 * zoom}px 'Rajdhani', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = box.team.color;
        ctx.fillText(box.team.shortName.toUpperCase(), 0, 0);
        ctx.restore();
      }
    }

    const entryPt = camera.worldToScreen(pitPts[0].x, pitPts[0].y);
    ctx.fillStyle = 'rgba(234, 179, 8, 0.95)';
    ctx.font = `bold ${Math.max(9, 9 * zoom)}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('PIT IN · 80 KM/H', entryPt.x, entryPt.y - 12 * zoom);
    const exitPt = camera.worldToScreen(pitPts[pitPts.length - 1].x, pitPts[pitPts.length - 1].y);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('PIT OUT', exitPt.x, exitPt.y - 12 * zoom);
    ctx.restore();
  }

  /** [G4] Muestras que se saltan al pintar los trazos largos: unos 8 px de pantalla entre punto y punto. */
  static strideFor(zoom: number, samples: number, lapLengthMeters: number): number {
    const stepM = lapLengthMeters / Math.max(1, samples);
    const stride = Math.floor(8 / Math.max(1e-6, stepM * zoom));
    // Nunca menos de un vértice cada 4 m: en la curva más cerrada el trazo se aparta del arco unos 15 cm.
    const closest = Math.max(1, Math.floor(4 / Math.max(1e-6, stepM)));
    return Number.isFinite(stride) ? Math.max(closest, Math.min(8, stride)) : 1;
  }

  /** [G5] Trazada ideal en coordenadas del mundo, calculada una vez por pista. */
  private static racingLineFor(track: TrackDefinition): { x: number; y: number }[] {
    let line = racingLines.get(track);
    if (!line) {
      const n = track.points.length;
      line = track.points.map((p, i) => {
        const w = calculateCarWorldPosition({ progress: i / n, lateralOffset: p.idealLineOffset || 0, isInPitLane: false }, track);
        return { x: w.worldX, y: w.worldY };
      });
      racingLines.set(track, line);
    }
    return line;
  }

  /** [G7] Los 20 cajones de parrilla, a 8 m reales uno de otro: una marca en U delante de cada coche. */
  private static renderGrid(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    if (!(track.lapLengthMeters > 0) || track.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = Math.max(1, 0.15 * camera.zoom);
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (let slot = 0; slot < 20; slot++) {
      const pose = calculateCarWorldPosition({ progress: 1 - (slot + 1) * GRID_SLOT_M / track.lapLengthMeters,
        lateralOffset: slot % 2 === 0 ? GRID_LATERAL_OFFSET : -GRID_LATERAL_OFFSET, isInPitLane: false }, track);
      const tx = Math.cos(pose.worldAngle), ty = Math.sin(pose.worldAngle);
      // Frente del cajón 3 m por delante del centro del coche; 1,3 m a cada lado y 1,5 m hacia atrás.
      const fx = pose.worldX + tx * 3, fy = pose.worldY + ty * 3;
      const corner = (side: number, back: number) => camera.worldToScreen(fx - ty * 1.3 * side - tx * back, fy + tx * 1.3 * side - ty * back);
      const a = corner(1, 1.5), b = corner(1, 0), c = corner(-1, 0), d = corner(-1, 1.5);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private static renderStartFinishLine(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const startPoint = track.points[0];
    const zoom = camera.zoom;
    // Medidas del mundo: worldToScreen aplica el zoom a los extremos.
    const trackWidth = (track.trackWidthMeters || 12);
    const hw = trackWidth / 2;

    const nx = Math.cos(startPoint.angle + Math.PI / 2);
    const ny = Math.sin(startPoint.angle + Math.PI / 2);

    const p1 = camera.worldToScreen(startPoint.x + nx * hw, startPoint.y + ny * hw);
    const p2 = camera.worldToScreen(startPoint.x - nx * hw, startPoint.y - ny * hw);

    ctx.save();
    ctx.lineCap = 'butt';

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
      ctx.lineWidth = FINISH_LINE_M * zoom;
      ctx.stroke();
    }

    // Letrero de lectura: tipografía acotada en pantalla, independiente del asfalto.
    const centerScreen = camera.worldToScreen(startPoint.x, startPoint.y);
    ctx.font = `900 ${Math.max(9, Math.min(14, 10 * zoom))}px 'Orbitron', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('FINISH / META', centerScreen.x, centerScreen.y - 8 * zoom);

    // 4. Faro oficial rojo en el lateral
    ctx.fillStyle = '#e10600';
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 1.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * zoom;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * [R04] Marcas del DRS sobre la pista: el tramo de activación de cada zona (borde verde con su rótulo) y la línea
   * de cada punto de detección, que es donde se mide el hueco con el coche de delante.
   */
  static renderDrsMarkers(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const { zones, detections } = drsMarkers(track);
    if (!zones.length && !detections.length) return;
    const zoom = camera.zoom;
    const half = (track.trackWidthMeters || 12) / 2;
    const fontSize = Math.max(8.5, Math.min(12, 10 * zoom));
    // Lado contrario al de los rótulos de las curvas.
    const side = (p: { x: number; y: number; angle: number }, distance: number) =>
      camera.worldToScreen(p.x + Math.cos(p.angle + Math.PI / 2) * distance, p.y + Math.sin(p.angle + Math.PI / 2) * distance);
    const label = (text: string, x: number, y: number, color: string) => {
      ctx.font = `800 ${fontSize}px 'Rajdhani', sans-serif`;
      const width = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(10, 15, 25, 0.88)';
      ctx.beginPath();
      ctx.roundRect(x - width / 2 - 4, y - fontSize / 2 - 2, width + 8, fontSize + 4, 3);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    };

    ctx.save();
    ctx.lineCap = 'round';
    for (const zone of zones) {
      // [R23] Zona: línea continua. Detección: discontinua y de otro color. Las dos, con rótulo.
      ctx.strokeStyle = SIGNALS.drsZone.color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(2, Math.min(5, 2.2 * zoom));
      ctx.beginPath();
      zone.points.forEach((point, index) => {
        const edge = side(point, half + 2);
        if (index === 0) ctx.moveTo(edge.x, edge.y); else ctx.lineTo(edge.x, edge.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
      const at = side(zone.points[0], half + 16);
      label(`${SIGNALS.drsZone.label} ${zone.id}`, at.x, at.y, '#4ade80');
    }
    for (const detection of detections) {
      const from = side(detection, -half), to = side(detection, half);
      ctx.strokeStyle = SIGNALS.drsDetection.color;
      ctx.lineWidth = Math.max(1.5, Math.min(4, 1.6 * zoom));
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const at = side(detection, half + 16);
      label(`${SIGNALS.drsDetection.label} ${detection.zoneIds.join('+')}`, at.x, at.y, '#7dd3fc');
    }
    ctx.restore();
  }

  private static renderCornerLabels(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const zoom = camera.zoom;
    ctx.save();

    for (const corner of track.corners) {
      const pointIdx = Math.floor(corner.t * track.points.length) % track.points.length;
      const pt = track.points[pointIdx];
      const hw = (track.trackWidthMeters || 12) / 2 + 18;

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
