import React, { useRef, useEffect, useMemo, useState } from 'react';
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
import { markLoad } from '../perf/loadMarks';
import { buildCarDraws, buildSafetyCarDraw } from '../renderer/carDraws';
import { bridgePaintOrder, bridgeSide, overpassFor } from '../renderer/overpass';
import { renderBridge } from '../renderer/BridgeRenderer';
import { sunAt } from '../renderer/lighting';
import type { RaceScene3D } from '../scene3d/RaceScene3D';
import { CameraDirector3D, drawLabels3D } from '../scene3d/director3d';
import type { CameraMode3D } from '../scene3d/cameras';
import { WEATHER_TESTS } from '../data/weatherScenarios';
import { browserSettingsStorage, readRaceView } from '../settings/graphics';
import { QUALITY_PROFILES, browserDevice, createQualityGovernor, effectiveQuality, readQuality, type QualityProfile } from '../settings/quality';
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
  /** Vista 3D (22/10/2026): modo de cámara con el que empieza. */
  initialCameraMode?: CameraMode3D;
  /** [UX16] Equipo del jugador: sus coches se resaltan cuando de lejos se ven como puntos. */
  playerTeamId?: string | null;
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
  initialCameraMode,
  playerTeamId = null,
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

  // ── Vista 3D (22/10/2026): pintor three.js con escenario, sombras y seis modos de cámara. Sin WebGL (o con `?2d`)
  // se queda la vista cenital de siempre.
  const scene3dRef = useRef<RaceScene3D | null>(null);
  // [PF4] Calidad en uso, vigilante de fotogramas y cuenta del segundo en curso.
  const qualityRef = useRef<{ profile: QualityProfile; governor: ReturnType<typeof createQualityGovernor>; frames: number; windowStart: number } | null>(null);
  const [view3d, setView3d] = useState(false);
  // El modo de la cámara 3D vive en `camera` (la compartida con la barra de arriba, cuyo botón lo cambia).
  const director = useMemo(() => {
    const d = new CameraDirector3D(track, circuitId, camera);
    d.mode = initialCameraMode ?? (selectedCarId !== null ? 'persecucion' : 'vista');
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, circuitId, camera]);
  const setMode3d = (mode: CameraMode3D) => {
    if (mode === 'libre') director.toFree(); else director.mode = mode;
  };
  useEffect(() => {
    // En desarrollo, las capturas de revisión colocan la cámara desde fuera.
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __camera3d?: unknown };
    w.__camera3d = { director, setMode: setMode3d };
    return () => { delete w.__camera3d; };
  });
  useEffect(() => {
    // Al elegir un coche desde la vista general, la cámara se va con él.
    if (selectedCarId !== null && director.mode === 'vista') director.mode = 'persecucion';
  }, [selectedCarId, director]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // [UX2] La vista 2D también se elige en Ajustes (se guarda en el dispositivo).
    if (!supportsWebGL() || params.has('2d') || params.has('canvas') || readRaceView(browserSettingsStorage()) === '2d') return;
    let cancelled = false;
    let created: RaceScene3D | null = null;
    // [PF4] Nivel de calidad: el de Ajustes o, en automático, el del dispositivo; el vigilante lo baja si caen los fps.
    const setting = readQuality(browserSettingsStorage());
    const level = effectiveQuality(setting, browserDevice());
    qualityRef.current = { profile: QUALITY_PROFILES[level], governor: createQualityGovernor({ start: level, auto: setting === 'auto' }), frames: 0, windowStart: performance.now() };
    import('../scene3d/RaceScene3D')
      .then(async module => {
        created = module.RaceScene3D.create(QUALITY_PROFILES[level].antialias);
        if (!created || cancelled) { created?.destroy(); created = null; return; }
        created.setQuality(QUALITY_PROFILES[level]);
        scene3dRef.current = created;
        camera.view3d = true;
        setView3d(true);
        await created.load(track, circuitId, import.meta.env.BASE_URL);
      })
      .catch(error => { console.error('Vista 3D no disponible', error); scene3dRef.current = null; setView3d(false); });
    return () => { cancelled = true; scene3dRef.current = null; camera.view3d = false; setView3d(false); created?.destroy(); };
  }, [track, circuitId, camera]);

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
    // Momento (reloj de verdad) en que se vio la bandera a cuadros: los fuegos artificiales de Abu Dabi cuentan desde ahí.
    let finishedAt: number | null = null;

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
      const base = carViews({ roster, fast: state.fast, slow: state.slow, teams: state.teams, drsChangedAt: state.drsChangedAt, circuitId });
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

      // ── Vista 3D: pista, escenario y coches en three.js; encima, etiquetas, nubes, gotas y minimapa. ──
      const scene3d = scene3dRef.current;
      if (scene3d) {
        const w = camera.screenWidth, h = camera.screenHeight;
        const sun3 = sunAt({ circuitId, raceTimeSec: frame.raceTimeSec, cloudCover: frame.cloudCover });
        const shot = director.view(frame.cars, selectedCarId, frame.raceTimeSec, dtRaw, w / h, car => scene3d.carHeight(car));
        const finished = Boolean(raceStore.getState().slow?.finished);
        if (finished && finishedAt === null) finishedAt = performance.now();
        if (!finished) finishedAt = null;
        const fireworksSec = finishedAt === null ? null : (performance.now() - finishedAt) / 1000;
        // [PF4] Fotogramas de cada segundo para el vigilante de calidad; si baja el nivel, la escena lo aplica.
        const q = qualityRef.current;
        if (q) {
          q.frames++;
          const now = performance.now();
          if (now - q.windowStart >= 1000) {
            const next = q.governor.second((q.frames * 1000) / (now - q.windowStart));
            q.frames = 0; q.windowStart = now;
            if (next) { q.profile = QUALITY_PROFILES[next]; scene3d.setQuality(q.profile); }
          }
        }
        const pixelRatioMax = q?.profile.pixelRatioMax ?? 1.5;
        const image = scene3d.render({ cars: frame.cars, safetyCar: frame.safetyCar, view: shot.view, sun: sun3, shadowRadius: shot.shadowRadius, fireworksSec, playerTeamId, followedCarId: selectedCarId }, w, h, Math.min(dpr, pixelRatioMax));
        ctx.drawImage(image, 0, 0, w, h);
        const eye = shot.view.position;
        drawLabels3D(ctx, frame.cars, selectedCarId, director.mode === 'vista', car => {
          const z = scene3d.carHeight(car) + 1.8;
          const p = scene3d.project(car.worldX, car.worldY, z, w, h);
          return { ...p, distance: Math.hypot(car.worldX - eye.x, car.worldY - eye.y, z - eye.z) };
        }, w, h);
        const rendered = performance.now();
        WeatherRenderer.renderClouds(ctx, camera, skyCover(frame.cloudCover, frame.rain));
        if (frame.layers) WeatherRenderer.renderDrops(ctx, track, camera, frame.rain, frame.raceTimeSec);
        if (camera.followingCarId !== null) {
          const followed = camera.followingCarId;
          const ownCar = Object.values(raceStore.getState().teams).flatMap(team => team.cars).find(car => car.id === followed);
          renderLeftMinimap(ctx, { activeTrack: track, cars: frame.cars }, camera, (ownCar?.rejoin as RejoinEstimate | null | undefined) ?? null, frame.layers);
        }
        ctx.restore();
        const frameEnd = performance.now();
        frameCost.simScale = 1; frameCost.gpu = true;
        // [PF1] En la vista 3D, pista, escenario y coches van juntos en la fase '3d'.
        recordStage('simulacion', simulated - frameStart); recordStage('pista', 0); recordStage('clima', 0);
        recordStage('coches', 0); recordStage('3d', rendered - simulated); recordStage('resto', frameEnd - rendered); recordStage('total', frameEnd - frameStart);
        frameCost.frames++;
        markLoad('firstFrame');
        return;
      }

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
      // Sol de la carrera (21/10/2026): dirección y largo de las sombras según la hora y las nubes.
      const sun = sunAt({ circuitId, raceTimeSec: frame.raceTimeSec, cloudCover: frame.cloudCover });
      TrackRenderer.renderBarrierShadows(ctx, track, camera, circuitId, sun);
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
      const carEffects = { depthAt: frame.depthAt, timeSec: frame.raceTimeSec, sun };
      // Puente (21/10/2026): primero los coches de abajo (y todos los demás), luego el tablero, luego los de arriba.
      const overpass = overpassFor(circuitId);
      const layers = bridgePaintOrder(frame.cars, overpass);
      const safetyCarOver = overpass !== null && frame.safetyCar != null
        && bridgeSide(overpass, ((frame.safetyCar.progress % 1) + 1) % 1, Boolean(frame.safetyCar.isInPitLane)) === 'over';
      // [G9] Spray, coches y Safety Car desde la GPU, compuestos sobre la pista y el agua; el Canvas pone encima humo,
      // etiquetas y rótulos, y pinta entero cualquier coche que todavía no tenga su imagen.
      const paintCars = (cars: CarState[], withSafetyCar: boolean, withSpray: boolean) => {
        let onGpu: { cars: ReadonlySet<number>; safetyCar: boolean } | undefined;
        if (gpu && trackLayerRef.current && (cars.length > 0 || withSafetyCar || withSpray)) {
          try {
            const draws = buildCarDraws(cars, camera, selectedCarId, track, trackWidthCarsCapacity, carEffects);
            const safetyCarDraw = withSafetyCar ? buildSafetyCarDraw(frame.safetyCar, track, camera, performance.now()) : null;
            const view = trackLayerRef.current.renderCars(camera, dpr, draws, safetyCarDraw, withSpray ? spray.current : null, frame.raceTimeSec, sun);
            ctx.drawImage(view, 0, 0, camera.screenWidth, camera.screenHeight);
            onGpu = { cars: new Set(draws.map(draw => draw.id)), safetyCar: safetyCarDraw !== null };
          } catch {
            trackLayerRef.current = null;
            setCanvasFallback(true);
          }
        }
        return onGpu;
      };
      if (!overpass) {
        CarRenderer.renderCars(ctx, frame.cars, camera, selectedCarId, track, trackWidthCarsCapacity, frame.safetyCar, carEffects, paintCars(frame.cars, true, true));
      } else {
        const below = paintCars(layers.below, !safetyCarOver, true);
        CarRenderer.renderCars(ctx, layers.below, camera, selectedCarId, track, trackWidthCarsCapacity, safetyCarOver ? null : frame.safetyCar, carEffects, below, { labelCars: [] });
        renderBridge(ctx, track, camera, overpass, sun, (frame.weather?.waterPercentage || 0) > 10);
        const above = paintCars(layers.above, safetyCarOver, false);
        // Las etiquetas de todos, encima del puente.
        CarRenderer.renderCars(ctx, layers.above, camera, selectedCarId, track, trackWidthCarsCapacity, safetyCarOver ? frame.safetyCar : null, carEffects, above, { labelCars: frame.cars });
      }
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
      recordStage('coches', carsDone - weatherDone); recordStage('3d', 0); recordStage('resto', frameEnd - carsDone); recordStage('total', frameEnd - frameStart);
      frameCost.frames++;
      markLoad('firstFrame');
    };

    repaint = () => { try { paintFrame(performance.now(), false); } catch { ctx.restore(); } };
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [track, roster, camera, circuitId, selectedCarId, director, playerTeamId]);

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

    if (scene3dRef.current) {
      // 3D: arrastrar pasa al modo libre; izquierdo gira alrededor, derecho desplaza.
      if (director.mode !== 'libre') director.toFree();
      const o = director.orbit;
      if (dragButtonRef.current === 0) {
        o.azimuth -= dx * 0.008;
        o.elevation = Math.max(0.12, Math.min(1.5, o.elevation + dy * 0.006));
      } else {
        const fx = -Math.cos(o.azimuth), fy = -Math.sin(o.azimuth), k = o.distance * 0.0016;
        o.x += (fy * dx + fx * dy) * k;
        o.y += (-fx * dx + fy * dy) * k;
      }
      return;
    }
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

      const scene3d = scene3dRef.current;
      let clickedCarId: number | null;
      if (scene3d) {
        // 3D: el coche más cercano al clic en pantalla (a menos de 28 px).
        let best: number | null = null, bestD = 28;
        for (const car of paintedRef.current) {
          const p = scene3d.project(car.worldX, car.worldY, scene3d.carHeight(car) + 0.6, rect.width, rect.height);
          const d = Math.hypot(p.x - clickX, p.y - clickY);
          if (p.visible && d < bestD) { bestD = d; best = car.id; }
        }
        clickedCarId = best;
      } else {
        clickedCarId = CarRenderer.pickCarAtScreen(paintedRef.current, camera, clickX, clickY);
      }

      if (clickedCarId !== null) {
        onSelectCar(clickedCarId);
        camera.followCar(clickedCarId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    if (scene3dRef.current) {
      // En las cenitales la rueda acerca o aleja (como siempre); en el resto pasa al modo libre.
      if (director.mode === 'cenital' || director.mode === 'cenital-giro') { director.zoom = Math.max(0.3, Math.min(6, director.zoom * factor)); return; }
      if (director.mode !== 'libre') director.toFree();
      director.orbit.distance = Math.max(12, Math.min(6000, director.orbit.distance / factor));
      return;
    }
    camera.zoomBy(factor);
  };

  const handleDoubleClick = () => {
    if (scene3dRef.current) setMode3d('vista');
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

      {/* En 3D los modos de cámara se cambian con el botón de la barra de arriba. */}
      {!view3d && (
        /* ── BRÚJULA & INDICADOR DE ROTACIÓN 360° ── */
        <div className={styles.orbitBadge} onClick={handleDoubleClick} title="Haz doble click para resetear vista">
          <Compass size={13} style={{ transform: `rotate(${-currentRotationDeg}deg)`, transition: 'transform 0.1s' }} />
          <span>{currentRotationDeg}° {currentRotationDeg !== 0 ? '(Click para reset)' : 'NORTE'}</span>
        </div>
      )}

      {/* ── HINT DE CONTROLES DE CÁMARA & PISTA ── */}
      <div className={styles.cameraHint}>
        <strong>Arrastrar:</strong> girar · <strong>Botón derecho:</strong> mover · <strong>Rueda:</strong> zoom · <strong>Doble clic:</strong> {view3d ? 'vista general' : 'restablecer'}
      </div>
    </div>
  );
};
