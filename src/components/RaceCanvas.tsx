import React, { useRef, useEffect, useState } from 'react';
import styles from './RaceCanvas.module.css';
import { Camera } from '../renderer/Camera';
import { TrackRenderer } from '../renderer/TrackRenderer';
import { CarRenderer } from '../renderer/CarRenderer';
import { renderLeftMinimap } from '../renderer/MinimapRenderer';
import { WeatherRenderer, skyCover } from '../renderer/WeatherRenderer';
import type { WeatherLayers } from '../renderer/WeatherRenderer';
import { SpraySystem } from '../renderer/SprayParticles';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { supportsWebGL } from './CarShowcase';
import type { TrackLayerGL } from '../renderer/TrackLayerGL';
import { frameCost, recordStage } from '../renderer/frameCost';
import { buildCarDraws, buildSafetyCarDraw } from '../renderer/carDraws';
import { WEATHER_TESTS } from '../data/weatherScenarios';
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { CarState, RejoinEstimate, SafetyCarState, TrackWeatherState } from '../types/f1';
import { raceStore } from '../state/raceStore';
import { carViews } from '../engine/raceCars';
import type { RosterEntry } from '../engine/raceCars';
import { ViewInterpolator } from '../engine/ViewInterpolator';

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __frameCost: typeof frameCost }).__frameCost = frameCost;
import { CloudSun, Compass, RotateCw } from 'lucide-react';

interface RaceCanvasProps {
  /** [N3] Geometría del circuito (fija durante la carrera) y lista de salida; el resto llega en las vistas del motor. */
  track: TrackDefinition;
  circuitId: string;
  roster: RosterEntry[];
  camera: Camera;
  selectedCarId: number | null;
  onSelectCar: (carId: number | null) => void;
  /** [G9] Carrera libre: enseña el botón que cambia el tiempo para probar lluvia y spray. */
  weatherTest?: boolean;
  /** [G9][N3] Pide al motor el tiempo de prueba elegido. */
  onWeatherTest?: (index: number) => void;
}

/** [N3] Lo que pinta un fotograma, montado con las vistas: coches con su pose interpolada, Safety Car y tiempo. */
interface PaintScene {
  cars: CarState[];
  safetyCar: SafetyCarState;
  raceTimeSec: number;
  weather: TrackWeatherState | undefined;
  layers: WeatherLayers | null;
  rain: number[];
  cloudCover: number;
  depthAt: (t: number) => number;
}

const segmentAt = (values: readonly number[], t: number) => values.length ? values[Math.floor((((t % 1) + 1) % 1) * values.length) % values.length] ?? 0 : 0;

export const RaceCanvas: React.FC<RaceCanvasProps> = ({
  track,
  circuitId,
  roster,
  camera,
  selectedCarId,
  onSelectCar,
  weatherTest = false,
  onWeatherTest,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackLayerRef = useRef<TrackLayerGL | null>(null);
  const layerLostRef = useRef(false);
  const [canvasFallback, setCanvasFallback] = useState(false);
  // [G9] Tiempo de prueba elegido (-1: el de la carrera).
  const [weatherTestIndex, setWeatherTestIndex] = useState(-1);
  const nextWeatherTest = () => {
    const next = (weatherTestIndex + 1) % WEATHER_TESTS.length;
    onWeatherTest?.(next);
    setWeatherTestIndex(next);
  };
  // [T3.4] Partículas de spray de esta vista.
  const spray = useRef(new SpraySystem());
  // [N3] Coches del último fotograma pintado (para elegir uno con el ratón).
  const paintedRef = useRef<CarState[]>([]);
  const isDraggingRef = useRef(false);
  const dragButtonRef = useRef<number>(0);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const totalDragDistanceRef = useRef(0);
  const [currentRotationDeg, setCurrentRotationDeg] = useState(0);

  // Sincronizar el seguimiento de la cámara cuando cambia selectedCarId
  useEffect(() => {
    if (selectedCarId !== null) {
      camera.followCar(selectedCarId);
    } else {
      camera.resetToFullTrack(track);
    }
  }, [selectedCarId, camera, track]);

  // [R56] Imágenes de los modelos 3D vistos desde arriba para los coches de pista. Se generan aparte al entrar en
  // carrera; hasta que están (o si no hay WebGL o falla la carga) la pista sigue con su dibujo vectorial.
  useEffect(() => {
    if (!supportsWebGL() || !roster.length) return;
    let cancelled = false;
    import('../renderer/carSprites3d')
      .then(sprites => sprites.buildCarSprites(roster as unknown as CarState[], import.meta.env.BASE_URL, () => cancelled))
      .catch(() => { /* sin imágenes: dibujo vectorial */ });
    return () => { cancelled = true; };
  }, [roster]);

  // [G8] Pista en WebGL: se carga al entrar en carrera. Sin WebGL (o si falla) la pinta el Canvas, con un aviso.
  useEffect(() => {
    // Con `?canvas` en la dirección se fuerza el respaldo, para probarlo en un navegador que sí tiene WebGL.
    if (!supportsWebGL() || new URLSearchParams(window.location.search).has('canvas')) { setCanvasFallback(true); return; }
    let cancelled = false;
    let layer: TrackLayerGL | null = null;
    import('../renderer/TrackLayerGL')
      .then(module => module.TrackLayerGL.create())
      .then(created => {
        if (cancelled) { created?.destroy(); return; }
        if (!created) { setCanvasFallback(true); return; }
        layer = created; trackLayerRef.current = created; setCanvasFallback(false);
      })
      .catch(() => { if (!cancelled) setCanvasFallback(true); });
    return () => { cancelled = true; trackLayerRef.current = null; layer?.destroy(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // [R56] La imagen del Safety Car se pide la primera vez que sale a pista.
    let safetyCarImageRequested = !supportsWebGL();

    let animationFrameId: number;
    let lastTime = performance.now();

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      camera.resize(rect.width, rect.height, track);
      // Cambiar el tamaño vacía el lienzo: se repinta en el acto para que no parpadee (pasa cada vez que el muro de
      // abajo cambia de alto, por ejemplo al llegar una propuesta).
      repaint?.();
    };
    let repaint: (() => void) | null = null;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    handleResize();
    if (selectedCarId === null) {
      camera.resetToFullTrack(track);
    }
    window.addEventListener('resize', handleResize);

    // [N3] La pose sale de las vistas rápidas que manda el motor: se interpola entre ellas al ritmo de la pantalla.
    const interpolator = new ViewInterpolator();
    let seenFastAt = -1;
    /** Fotograma montado con lo último del almacén. */
    const scene = (now: number): PaintScene => {
      const state = raceStore.getState();
      if (state.fast && state.fastAt !== seenFastAt) {
        if (state.prevFast && seenFastAt < state.prevFastAt) interpolator.push(state.prevFast, state.prevFastAt);
        interpolator.push(state.fast, state.fastAt);
        seenFastAt = state.fastAt;
      }
      const painted = interpolator.frame(now);
      const base = carViews({ roster, fast: state.fast, slow: state.slow, teams: state.teams, drsChangedAt: state.drsChangedAt });
      const poses = new Map(painted.cars.map(car => [car.id, car]));
      const cars = base.map(car => {
        const pose = poses.get(car.id);
        return pose ? Object.assign(car, { worldX: pose.worldX, worldY: pose.worldY, worldAngle: pose.worldAngle, progress: pose.progress, trackT: pose.trackT }) : car;
      });
      const slow = state.slow;
      const sc = painted.safetyCar;
      const safetyCar = {
        isDeployed: sc?.isDeployed ?? false, mode: sc?.mode ?? 'idle', progress: sc?.progress ?? 0, trackT: (((sc?.progress ?? 0) % 1) + 1) % 1,
        isInPitLane: sc?.isInPitLane ?? false, currentSpeedKmh: 0, lapCount: slow?.safetyCar.lapCount ?? 0, targetLaps: slow?.safetyCar.targetLaps ?? 0,
        triggerReason: slow?.safetyCar.reason ?? '', deployedAtRaceTime: 0,
      } as SafetyCarState;
      const sceneData = slow?.weatherScene;
      const water = sceneData?.water ?? [], waterOff = sceneData?.waterOff ?? [], rain = sceneData?.rain ?? [];
      const wet = rain.some(r => r > 0) || water.some(w => w > 0) || waterOff.some(w => w > 0);
      return {
        cars, safetyCar, raceTimeSec: painted.raceTimeSec || slow?.t || 0,
        weather: slow?.weatherState as TrackWeatherState | undefined,
        layers: wet ? { rain, water, waterOff } : null, rain, cloudCover: sceneData?.cloudCover ?? 0,
        depthAt: (t: number) => segmentAt(water, t),
      };
    };
    // Un fallo al pintar un fotograma no debe dejar la pista parada (y en negro al redimensionar): se anota una vez
    // y se sigue con el siguiente.
    let frameErrorLogged = false;
    const loop = (currentTime: number) => {
      try {
        paintFrame(currentTime);
      } catch (error) {
        if (!frameErrorLogged) { frameErrorLogged = true; console.error('Fallo al pintar un fotograma de la carrera', error); }
        ctx.restore();
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    const paintFrame = (currentTime: number, advance = true) => {
      const dtRaw = advance ? Math.min((currentTime - lastTime) / 1000, 0.1) : 0;
      if (advance) lastTime = currentTime;

      const frameStart = performance.now();
      // [N3] El motor corre aparte (Worker): aquí solo se monta el fotograma con las vistas que han llegado.
      const frame = scene(currentTime);
      paintedRef.current = frame.cars;
      const simulated = performance.now();
      camera.update(frame.cars, dtRaw, track);

      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fondo oscuro
      ctx.fillStyle = '#14181f';
      ctx.fillRect(0, 0, camera.screenWidth, camera.screenHeight);

      // [G8] Pista fija desde la GPU; si el contexto WebGL se pierde, se vuelve al Canvas.
      let gpu = false;
      const trackLayer = trackLayerRef.current;
      // Con el contexto WebGL retirado por el navegador se pinta con el Canvas hasta que vuelva.
      const layerLost = trackLayer !== null && !trackLayer.available;
      if (layerLost !== layerLostRef.current) { layerLostRef.current = layerLost; setCanvasFallback(layerLost); }
      if (trackLayer && !layerLost) {
        try {
          const view = trackLayer.render(track, circuitId, camera, dpr, (frame.weather?.waterPercentage || 0) > 10);
          ctx.drawImage(view, 0, 0, camera.screenWidth, camera.screenHeight);
          gpu = true;
        } catch {
          trackLayerRef.current = null;
          setCanvasFallback(true);
        }
      }
      TrackRenderer.renderTrack(ctx, track, camera, dpr, frame.weather as TrackWeatherState, circuitId, gpu);
      // [R04] Puntos de detección y tramos de activación del DRS.
      TrackRenderer.renderDrsMarkers(ctx, track, camera);
      const trackDone = performance.now();

      // [R44] Pista mojada por tramo, radar de lluvia y spray (antes de los coches y sus etiquetas).
      const weatherView = frame.layers;
      WeatherRenderer.render(ctx, track, camera, weatherView, frame.raceTimeSec);
      // [T3.4] Spray con partículas: se emite con el tiempo de carrera y se pinta antes que los coches.
      spray.current.update(frame.cars, frame.depthAt, frame.raceTimeSec);
      if (!gpu) spray.current.render(ctx, camera, frame.raceTimeSec);
      const weatherDone = performance.now();

      if (frame.safetyCar?.isDeployed && !safetyCarImageRequested) {
        safetyCarImageRequested = true;
        import('../renderer/carSprites3d')
          .then(sprites => sprites.buildSafetyCarSprite(import.meta.env.BASE_URL))
          .catch(() => { /* sin imagen: dibujo anterior del Safety Car */ });
      }

      const circuitSpec = OFFICIAL_CIRCUITS[circuitId];
      const trackWidthCarsCapacity = circuitSpec?.trackWidthCars ?? 3;
      const carEffects = { depthAt: frame.depthAt, timeSec: frame.raceTimeSec };
      // [G9] Spray, coches y Safety Car desde la GPU, compuestos sobre la pista y el agua; el Canvas pone encima humo,
      // etiquetas y rótulos, y pinta entero cualquier coche que todavía no tenga su imagen.
      let onGpu: { cars: ReadonlySet<number>; safetyCar: boolean } | undefined;
      if (gpu && trackLayerRef.current) {
        try {
          const draws = buildCarDraws(frame.cars, camera, selectedCarId, track, trackWidthCarsCapacity, carEffects);
          const safetyCarDraw = buildSafetyCarDraw(frame.safetyCar, track, camera, performance.now());
          const view = trackLayerRef.current.renderCars(camera, dpr, draws, safetyCarDraw, spray.current, frame.raceTimeSec);
          ctx.drawImage(view, 0, 0, camera.screenWidth, camera.screenHeight);
          onGpu = { cars: new Set(draws.map(draw => draw.id)), safetyCar: safetyCarDraw !== null };
        } catch {
          trackLayerRef.current = null;
          setCanvasFallback(true);
        }
      }
      CarRenderer.renderCars(ctx, frame.cars, camera, selectedCarId, track, trackWidthCarsCapacity, frame.safetyCar, carEffects, onGpu);
      const carsDone = performance.now();

      // [R53] Gotas en pantalla según la lluvia de la zona visible (por encima de pista y coches).
      // [G9] El cielo se cubre también donde llueve: con lluvia en el radar no puede verse despejado.
      WeatherRenderer.renderClouds(ctx, camera, skyCover(frame.cloudCover, frame.rain));
      if (weatherView) WeatherRenderer.renderDrops(ctx, track, camera, frame.rain, frame.raceTimeSec);

      // ── MINIMAPA A LA IZQUIERDA DEL TODO (visible al seguir un coche) ──
      if (camera.followingCarId !== null) {
        // [N3] Reincorporación estimada: solo de los coches propios (la trae la vista del equipo).
        const followed = camera.followingCarId;
        const ownCar = Object.values(raceStore.getState().teams).flatMap(team => team.cars).find(car => car.id === followed);
        renderLeftMinimap(ctx, { activeTrack: track, cars: frame.cars }, camera, (ownCar?.rejoin as RejoinEstimate | null | undefined) ?? null, weatherView);
      }

      ctx.restore();
      // [G8][G9] Coste de cada fase del fotograma.
      const frameEnd = performance.now();
      frameCost.simScale = 1;
      frameCost.gpu = gpu;
      recordStage('simulacion', simulated - frameStart); recordStage('pista', trackDone - simulated); recordStage('clima', weatherDone - trackDone);
      recordStage('coches', carsDone - weatherDone); recordStage('resto', frameEnd - carsDone); recordStage('total', frameEnd - frameStart);
      frameCost.frames++;
    };

    repaint = () => { try { paintFrame(performance.now(), false); } catch { ctx.restore(); } };
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [track, roster, camera, circuitId, selectedCarId]);

  // ── MANEJADORES DE RATÓN: ROTACIÓN 360°, PAN Y ZOOM ──
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragButtonRef.current = e.button;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    totalDragDistanceRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;
    totalDragDistanceRef.current += Math.hypot(dx, dy);
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (dragButtonRef.current === 0) {
      // Click izquierdo: Rotar 360° la pista
      camera.rotateBy(dx * 0.008);
      setCurrentRotationDeg(Math.round(((camera.targetRotation * 180) / Math.PI) % 360));
    } else if (dragButtonRef.current === 1 || dragButtonRef.current === 2) {
      // Click central o derecho: Desplazar la pista (Pan)
      camera.panBy(dx, dy);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Si fue un click rápido casi sin arrastrar (< 6px), seleccionar monoplaza
    if (totalDragDistanceRef.current < 6 && e.button === 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const clickedCarId = CarRenderer.pickCarAtScreen(paintedRef.current, camera, clickX, clickY);

      if (clickedCarId !== null) {
        onSelectCar(clickedCarId);
        camera.followCar(clickedCarId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    camera.zoomBy(factor);
  };

  const handleDoubleClick = () => {
    camera.resetToFullTrack(track);
    setCurrentRotationDeg(0);
    onSelectCar(null);
  };

  return (
    <div className={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {weatherTest && (
        <button type="button" onClick={nextWeatherTest} title="Cambia el tiempo de esta carrera libre para probar la lluvia y el spray"
          className={styles.weatherTest} data-default={weatherTestIndex < 0 ? 'true' : undefined}>
          <CloudSun size={18} aria-hidden="true" />
          <span className={styles.weatherTestText}><span className={styles.weatherTestLead}>Probar tiempo: </span>{weatherTestIndex < 0 ? 'el de la carrera' : WEATHER_TESTS[weatherTestIndex].label}</span>
        </button>
      )}

      {canvasFallback && (
        <div role="status" style={{ position: 'absolute', left: 12, bottom: 12, maxWidth: 420, padding: '6px 10px', borderRadius: 6,
          background: 'rgba(20, 24, 31, 0.9)', border: '1px solid rgba(234, 179, 8, 0.6)', color: '#eab308', font: "600 13px 'Rajdhani', sans-serif", pointerEvents: 'none' }}>
          Pista en modo de respaldo (Canvas). Para verla con toda su calidad, activa la aceleración por hardware (WebGL) del navegador.
        </div>
      )}

      {/* ── BRÚJULA & INDICADOR DE ROTACIÓN 360° ── */}
      <div className={styles.orbitBadge} onClick={handleDoubleClick} title="Haz doble click para resetear vista">
        <Compass size={13} style={{ transform: `rotate(${-currentRotationDeg}deg)`, transition: 'transform 0.1s' }} />
        <span>{currentRotationDeg}° {currentRotationDeg !== 0 ? '(Click para reset)' : 'NORTE'}</span>
      </div>

      {/* ── HINT DE CONTROLES DE CÁMARA & PISTA ── */}
      <div className={styles.cameraHint}>
        <strong>Arrastrar:</strong> girar · <strong>Botón derecho:</strong> mover · <strong>Rueda:</strong> zoom · <strong>Doble clic:</strong> restablecer
      </div>
    </div>
  );
};
