import React, { useRef, useEffect, useState } from 'react';
import styles from './RaceCanvas.module.css';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { Camera } from '../renderer/Camera';
import { TrackRenderer } from '../renderer/TrackRenderer';
import { CarRenderer } from '../renderer/CarRenderer';
import { renderLeftMinimap } from '../renderer/MinimapRenderer';
import { RenderInterpolator } from '../renderer/RenderPose';
import { WeatherRenderer, weatherLayers, skyCover } from '../renderer/WeatherRenderer';
import { SpraySystem } from '../renderer/SprayParticles';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { supportsWebGL } from './CarShowcase';
import type { TrackLayerGL } from '../renderer/TrackLayerGL';
import { frameCost, recordStage } from '../renderer/frameCost';
import { buildCarDraws, buildSafetyCarDraw } from '../renderer/carDraws';
import { WEATHER_TESTS } from '../data/weatherScenarios';

/** Milisegundos de simulación que caben en un fotograma sin que la imagen pierda fluidez. */
const SIM_BUDGET_MS = 8;

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __frameCost: typeof frameCost }).__frameCost = frameCost;
import { Compass, RotateCw } from 'lucide-react';

interface RaceCanvasProps {
  simulation: RaceSimulation;
  camera: Camera;
  selectedCarId: number | null;
  onSelectCar: (carId: number | null) => void;
  /** [G9] Carrera libre: enseña el botón que cambia el tiempo para probar lluvia y spray. */
  weatherTest?: boolean;
}

export const RaceCanvas: React.FC<RaceCanvasProps> = ({
  simulation,
  camera,
  selectedCarId,
  onSelectCar,
  weatherTest = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackLayerRef = useRef<TrackLayerGL | null>(null);
  const layerLostRef = useRef(false);
  const [canvasFallback, setCanvasFallback] = useState(false);
  // [G9] Tiempo de prueba elegido (-1: el de la carrera).
  const [weatherTestIndex, setWeatherTestIndex] = useState(-1);
  const nextWeatherTest = () => {
    const next = (weatherTestIndex + 1) % WEATHER_TESTS.length;
    simulation.setWeatherScenario(WEATHER_TESTS[next].scenario);
    setWeatherTestIndex(next);
  };
  // [T3.4] Partículas de spray de esta vista.
  const spray = useRef(new SpraySystem());
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
      camera.resetToFullTrack(simulation.activeTrack);
    }
  }, [selectedCarId, camera, simulation.activeTrack]);

  // [R56] Imágenes de los modelos 3D vistos desde arriba para los coches de pista. Se generan aparte al entrar en
  // carrera; hasta que están (o si no hay WebGL o falla la carga) la pista sigue con su dibujo vectorial.
  useEffect(() => {
    if (!supportsWebGL()) return;
    let cancelled = false;
    import('../renderer/carSprites3d')
      .then(sprites => sprites.buildCarSprites(simulation.cars, import.meta.env.BASE_URL, () => cancelled))
      .catch(() => { /* sin imágenes: dibujo vectorial */ });
    return () => { cancelled = true; };
  }, [simulation]);

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
      camera.resize(rect.width, rect.height, simulation.activeTrack);
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
      camera.resetToFullTrack(simulation.activeTrack);
    }
    window.addEventListener('resize', handleResize);

    const interpolator = new RenderInterpolator();
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
    // A velocidades altas (x16, x32) simular un fotograma puede costar más que el propio fotograma y la imagen va a
    // tirones. La simulación tiene un presupuesto de tiempo por fotograma: si lo pasa, el siguiente avanza menos tiempo
    // de carrera (la carrera va algo más lenta de lo pedido, pero fluida).
    let simScale = 1;
    const paintFrame = (currentTime: number, advance = true) => {
      const dtRaw = advance ? Math.min((currentTime - lastTime) / 1000, 0.1) * simScale : 0;
      if (advance) lastTime = currentTime;

      const frameStart = performance.now();
      simulation.update(dtRaw);
      const simulated = performance.now();
      // [R43] Coches y Safety Car con la pose interpolada de este fotograma (pintado y cámara).
      const frame = interpolator.frame(simulation, dtRaw);
      camera.update(frame.cars, dtRaw, simulation.activeTrack);

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
          const view = trackLayer.render(simulation.activeTrack, simulation.circuitId, camera, dpr, (simulation.weather?.waterPercentage || 0) > 10);
          ctx.drawImage(view, 0, 0, camera.screenWidth, camera.screenHeight);
          gpu = true;
        } catch {
          trackLayerRef.current = null;
          setCanvasFallback(true);
        }
      }
      TrackRenderer.renderTrack(ctx, simulation.activeTrack, camera, dpr, simulation.weather, simulation.circuitId, gpu);
      // [R04] Puntos de detección y tramos de activación del DRS.
      TrackRenderer.renderDrsMarkers(ctx, simulation.activeTrack, camera);
      const trackDone = performance.now();

      // [R44] Pista mojada por tramo, radar de lluvia y spray (antes de los coches y sus etiquetas).
      const weatherView = weatherLayers(simulation.weatherModel, simulation.raceTimeSec);
      WeatherRenderer.render(ctx, simulation.activeTrack, camera, weatherView, simulation.raceTimeSec);
      // [T3.4] Spray con partículas: se emite con el tiempo de carrera y se pinta antes que los coches.
      spray.current.update(frame.cars, t => simulation.weatherModel.depthAt(t), simulation.raceTimeSec);
      if (!gpu) spray.current.render(ctx, camera, simulation.raceTimeSec);
      const weatherDone = performance.now();

      if (frame.safetyCar?.isDeployed && !safetyCarImageRequested) {
        safetyCarImageRequested = true;
        import('../renderer/carSprites3d')
          .then(sprites => sprites.buildSafetyCarSprite(import.meta.env.BASE_URL))
          .catch(() => { /* sin imagen: dibujo anterior del Safety Car */ });
      }

      const circuitSpec = OFFICIAL_CIRCUITS[simulation.circuitId];
      const trackWidthCarsCapacity = circuitSpec?.trackWidthCars ?? 3;
      const carEffects = { depthAt: (t: number) => simulation.weatherModel.depthAt(t), timeSec: simulation.raceTimeSec };
      // [G9] Spray, coches y Safety Car desde la GPU, compuestos sobre la pista y el agua; el Canvas pone encima humo,
      // etiquetas y rótulos, y pinta entero cualquier coche que todavía no tenga su imagen.
      let onGpu: { cars: ReadonlySet<number>; safetyCar: boolean } | undefined;
      if (gpu && trackLayerRef.current) {
        try {
          const draws = buildCarDraws(frame.cars, camera, selectedCarId, simulation.activeTrack, trackWidthCarsCapacity, carEffects);
          const safetyCarDraw = buildSafetyCarDraw(frame.safetyCar, simulation.activeTrack, camera, performance.now());
          const view = trackLayerRef.current.renderCars(camera, dpr, draws, safetyCarDraw, spray.current, simulation.raceTimeSec);
          ctx.drawImage(view, 0, 0, camera.screenWidth, camera.screenHeight);
          onGpu = { cars: new Set(draws.map(draw => draw.id)), safetyCar: safetyCarDraw !== null };
        } catch {
          trackLayerRef.current = null;
          setCanvasFallback(true);
        }
      }
      CarRenderer.renderCars(ctx, frame.cars, camera, selectedCarId, simulation.activeTrack, trackWidthCarsCapacity, frame.safetyCar, carEffects, onGpu);
      const carsDone = performance.now();

      // [R53] Gotas en pantalla según la lluvia de la zona visible (por encima de pista y coches).
      // [G9] El cielo se cubre también donde llueve: con lluvia en el radar no puede verse despejado.
      const rainBySegment = simulation.weatherModel.rainBySegment(simulation.raceTimeSec);
      WeatherRenderer.renderClouds(ctx, camera, skyCover(simulation.weatherModel.cloudCoverAt(simulation.raceTimeSec), rainBySegment));
      if (weatherView) WeatherRenderer.renderDrops(ctx, simulation.activeTrack, camera, rainBySegment, simulation.raceTimeSec);

      // ── MINIMAPA A LA IZQUIERDA DEL TODO (visible al seguir un coche) ──
      if (camera.followingCarId !== null) {
        renderLeftMinimap(ctx, simulation, camera, simulation.getRejoinEstimate(camera.followingCarId), weatherView);
      }

      ctx.restore();
      // [G8][G9] Coste de cada fase del fotograma.
      const frameEnd = performance.now();
      if (advance) {
        const simMs = simulated - frameStart;
        simScale = simMs > SIM_BUDGET_MS ? Math.max(0.2, simScale * SIM_BUDGET_MS / simMs) : Math.min(1, simScale * 1.1);
        frameCost.simScale = simScale;
      }
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
  }, [simulation, camera, simulation.circuitId, selectedCarId]);

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

      const clickedCarId = CarRenderer.pickCarAtScreen(simulation.cars, camera, clickX, clickY);

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
    camera.resetToFullTrack(simulation.activeTrack);
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
          style={{ position: 'absolute', right: 12, bottom: 12, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(20, 24, 31, 0.92)', border: '1px solid rgba(56, 189, 248, 0.6)', color: '#e8e6df', font: "700 13px 'Rajdhani', sans-serif" }}>
          Probar tiempo: {weatherTestIndex < 0 ? 'el de la carrera' : WEATHER_TESTS[weatherTestIndex].label}
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
        🖱️ <strong>Click + Arrastrar:</strong> Rotar pista 360° | <strong>Click Dcho:</strong> Mover | <strong>Rueda:</strong> Zoom | <strong>Doble Click:</strong> Reset
      </div>
    </div>
  );
};
