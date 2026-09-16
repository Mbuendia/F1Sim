import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';
import { TrackWeatherState } from '../types/f1';
import { TEAMS } from '../data/teams';
import { buildPitLaneGeometry, PitLaneGeometry } from '../utils/pitLaneGeometry';
import { getScenario } from '../data/scenarioRegistry';
import { buildScenarioGeometry, ScenarioGeometry } from '../utils/scenarioGeometry';
import type { Point2D } from '../utils/spline';

export class TrackRenderer {
  private static geometryCache = new WeakMap<TrackDefinition, PitLaneGeometry>();
  private static scenarioCache = new WeakMap<TrackDefinition, ScenarioGeometry>();
  /** Último circuitId usado para invalidar la caché de escenario al cambiar de circuito */
  private static lastCircuitId: string = '';

  private static geometryFor(track: TrackDefinition): PitLaneGeometry {
    let geometry = this.geometryCache.get(track);
    if (!geometry) {
      geometry = buildPitLaneGeometry(track, Object.values(TEAMS));
      this.geometryCache.set(track, geometry);
    }
    return geometry;
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

  private static path(ctx: CanvasRenderingContext2D, points: Point2D[], camera: Camera, closed = false) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const screen = camera.worldToScreen(point.x, point.y);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
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
    const trackWidth = (track.trackWidthMeters || 26) * 1.75 * zoom;
    const isWet = (weather?.waterPercentage || 0) > 10;
    const waterDepth = weather?.waterDepthMm || 0;

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
    buildPath();
    ctx.strokeStyle = isWet ? '#161922' : '#272b35';
    ctx.lineWidth = trackWidth;
    ctx.stroke();

    // ── TRAZADA ENGOMADA (RACING LINE) ──
    buildPath();
    ctx.strokeStyle = isWet ? '#0d1017' : '#14161c';
    ctx.lineWidth = trackWidth * 0.54;
    ctx.stroke();

    // ── CHARCOS DE AGUA DINÁMICOS ──
    if (isWet && waterDepth > 0.2) {
      this.renderRainPuddles(ctx, track, camera, waterDepth);
    }

    // ── BARRERAS (solo escenario Q6, se pintan encima del asfalto) ──
    if (!isLegacy) {
      this.renderBarriers(ctx, scenarioGeo, camera, zoom);
    }

    // ── LÍNEAS DE LÍMITES DE PISTA BLANCAS ──
    ctx.save();
    ctx.strokeStyle = isWet ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 0.8 * zoom;
    for (const edge of this.geometryFor(track).trackEdges) {
      this.path(ctx, edge, camera, true);
      ctx.stroke();
    }
    ctx.restore();

    // ── PIT LANE COMPLETO & MURO DE BOXES ──
    this.renderPitLane(ctx, track, camera);

    // ── LÍNEA DE META OFICIAL AJEDREZADA & PÓRTICO FIA ──
    this.renderStartFinishLine(ctx, track, camera);

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
    ctx.lineWidth = trackWidth + 8 * zoom;
    ctx.stroke();

    // 4. Pianos blancos ajedrezados
    ctx.save();
    ctx.setLineDash([12 * zoom, 12 * zoom]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = trackWidth + 8 * zoom;
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
    const kerbWidth = 8 * zoom;

    for (const kerb of scenarioGeo.kerbSegments) {
      if (kerb.points.length < 2) continue;

      // Piano rojo base
      this.path(ctx, kerb.points, camera);
      ctx.strokeStyle = '#d90429';
      ctx.lineWidth = kerbWidth;
      ctx.stroke();

      // Patrón ajedrezado blanco encima
      ctx.save();
      ctx.setLineDash([12 * zoom, 12 * zoom]);
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

  /**
   * Renderiza charcos y acumulaciones de agua brillante en frenadas y curvas
   */
  private static renderRainPuddles(
    ctx: CanvasRenderingContext2D,
    track: TrackDefinition,
    camera: Camera,
    waterDepth: number
  ) {
    const zoom = camera.zoom;
    const puddleOpacity = Math.min(0.65, 0.15 + (waterDepth / 5.0) * 0.5);

    ctx.save();
    // Charcos en zonas estratégicas del circuito (curvas lentas y puntos bajos)
    const puddleLocations = [0.12, 0.24, 0.38, 0.52, 0.68, 0.85];
    const totalPts = track.points.length;

    puddleLocations.forEach((t) => {
      const idx = Math.floor(t * totalPts) % totalPts;
      const pt = track.points[idx];
      const screen = camera.worldToScreen(pt.x, pt.y);

      const rad = (18 + (t * 10) % 15) * zoom;
      const grad = ctx.createRadialGradient(screen.x, screen.y, 2, screen.x, screen.y, rad);
      grad.addColorStop(0, `rgba(56, 189, 248, ${puddleOpacity * 1.3})`);
      grad.addColorStop(0.5, `rgba(2, 132, 199, ${puddleOpacity * 0.8})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
      ctx.fill();

      // Reflejo brillante de superficie
      ctx.fillStyle = `rgba(255, 255, 255, ${puddleOpacity * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(screen.x - rad * 0.2, screen.y - rad * 0.2, rad * 0.35, rad * 0.18, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

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
    ctx.lineWidth = 0.45 * zoom;
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
      ctx.lineWidth = 0.65 * zoom;
      ctx.stroke();

      if (zoom >= 1.2) {
        const label = camera.worldToScreen(box.label.x, box.label.y);
        ctx.save();
        ctx.translate(label.x, label.y);
        const angle = box.angle + camera.rotation;
        ctx.rotate(Math.cos(angle) < 0 ? angle + Math.PI : angle);
        ctx.font = `700 ${5 * zoom}px 'Rajdhani', sans-serif`;
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

  private static renderStartFinishLine(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera) {
    const startPoint = track.points[0];
    const zoom = camera.zoom;
    // Medidas del mundo: worldToScreen aplica el zoom a los extremos.
    const trackWidth = (track.trackWidthMeters || 26) * 1.75;
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
      ctx.lineWidth = 5 * zoom;
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
    ctx.arc(p1.x, p1.y, 5.5 * zoom, 0, Math.PI * 2);
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
      const hw = ((track.trackWidthMeters || 26) * 1.75) / 2 + 18;

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
