import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styles from './App.module.css';
import { RaceSimulation } from './simulation/RaceSimulation';
import { Camera } from './renderer/Camera';
import { RaceCanvas } from './components/RaceCanvas';
import { SpeedControls } from './components/SpeedControls';
import { StartLights } from './components/StartLights';
import { RaceHeader } from './components/RaceHeader';
import { Leaderboard } from './components/Leaderboard';
import { BottomTelemetryDock } from './components/BottomTelemetryDock';
import { BoxControls } from './components/BoxControls';
import { RightStatsPanel } from './components/RightStatsPanel';
import { PodiumModal } from './components/PodiumModal';
import { HomeScreen } from './components/HomeScreen';
import { LandingPage } from './components/LandingPage';
import RaceFlagsHUD from './components/RaceFlagsHUD';
import { DnfNotificationModal } from './components/DnfNotificationModal';
import { D20LuckModal } from './components/D20LuckModal';
import { RaceMenu } from './components/RaceMenu';
import { RaceNotices, RaceNotice, RaceNoticeTone } from './components/RaceNotices';
import { OFFICIAL_CIRCUITS } from './data/circuits';
import { buildWeatherScenario } from './data/weatherScenarios';
import { runQualifying } from './simulation/Qualifying';
import type { QualifyingResult } from './simulation/Qualifying';
import { QualifyingResults } from './components/QualifyingResults';
import qualifyingStyles from './components/QualifyingResults.module.css';
import type { RaceFormatId } from './components/RaceFormatSelect';
import { attributesOf, developAfterRace, emptyDevelopment, parseDevelopment, DEVELOPMENT_STORAGE_KEY } from './simulation/DriverDevelopment';
import type { DevelopmentState } from './simulation/DriverDevelopment';
import type { RaceResult } from './simulation/RaceResult';
import { addRace, emptyChampionship, parseChampionship, CHAMPIONSHIP_STORAGE_KEY } from './simulation/Championship';
import type { ChampionshipState } from './simulation/Championship';
import { DRIVERS } from './data/drivers';
import { TEAMS } from './data/teams';
import { RaceResultHistory, StartLightState, CarState, RaceFlagState, SafetyCarState, DnfNotification, D20LuckEvent, TrackWeatherState } from './types/f1';
import { RotateCw, ArrowLeft, Camera as CameraIcon, Maximize2, ListOrdered, PanelRight, ZoomIn, ZoomOut } from 'lucide-react';

// R32: estado de carrera siempre visible en la barra.
const FLAG_CHIPS: Record<RaceFlagState, { label: string; className: string }> = {
  'green': { label: 'VERDE', className: 'flagGreen' },
  'yellow': { label: 'AMARILLA', className: 'flagYellow' },
  'double-yellow': { label: 'DOBLE AMARILLA', className: 'flagYellow' },
  'vsc': { label: 'VSC', className: 'flagVsc' },
  'sc': { label: 'SAFETY CAR', className: 'flagSc' },
  'red': { label: 'BANDERA ROJA', className: 'flagRed' },
};

// R32: aviso breve al cambiar la bandera (la vuelta a verde solo se anuncia tras una neutralización).
const FLAG_NOTICES: Record<RaceFlagState, [RaceNoticeTone, string, string]> = {
  'green': ['ok', 'Verde', 'Pista libre: se puede adelantar'],
  'yellow': ['warning', 'Amarilla', 'Bandera amarilla en pista'],
  'double-yellow': ['warning', 'Amarilla', 'Doble amarilla: prepararse para parar'],
  'vsc': ['warning', 'VSC', 'Virtual Safety Car: mantener el delta'],
  'sc': ['warning', 'SC', 'Safety Car desplegado'],
  'red': ['danger', 'Roja', 'Bandera roja: carrera detenida'],
};
const NOTICE_MS = 8000;
const TYRE_WORDS: Record<string, string> = { soft: 'blandos', medium: 'medios', hard: 'duros', intermediate: 'intermedios', wet: 'de lluvia' };

const CAMERA_LABELS: Record<string, string> = {
  overview: 'General',
  follow: 'Seguimiento',
  cinematic: 'Cinemática',
  onboard: 'A bordo',
  helicopter: 'Helicóptero',
  free: 'Libre',
};

export const App: React.FC = () => {
  // Piloto y Circuito seleccionados
  const [selectedDriverId, setSelectedDriverId] = useState<string>('alonso');
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('barcelona');

  // [R02] Paso fijo de 20 ms simulados: mismo resultado sea cual sea el FPS o la velocidad.
  const simulation = useMemo(() => { const sim = new RaceSimulation(selectedCircuitId); sim.setFixedStep(0.02); return sim; }, []);
  const camera = useMemo(() => new Camera(), []);

  // Vista actual: 'landing', 'home' o 'race'
  const [currentView, setCurrentView] = useState<'landing' | 'home' | 'race'>('landing');

  // Coche seleccionado expresamente en pista
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);

  // Paneles: posiciones visibles; el detalle del coche se abre bajo demanda.
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Camera mode
  const [cameraMode, setCameraMode] = useState<string>('overview');

  // [R21] Campeonato acumulado (resultados finales), guardado en el navegador
  const [championship, setChampionship] = useState<ChampionshipState>(() => {
    try { return parseChampionship(localStorage.getItem(CHAMPIONSHIP_STORAGE_KEY)); } catch { return emptyChampionship(); }
  });
  const saveChampionship = useCallback((next: ChampionshipState) => {
    setChampionship(next);
    try { localStorage.setItem(CHAMPIONSHIP_STORAGE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);

  // [R45] Atributos y enfoque de los pilotos, guardados en el navegador
  const [development, setDevelopment] = useState<DevelopmentState>(() => {
    try { return parseDevelopment(localStorage.getItem(DEVELOPMENT_STORAGE_KEY)); } catch { return emptyDevelopment(); }
  });
  const saveDevelopment = useCallback((next: DevelopmentState) => {
    setDevelopment(next);
    try { localStorage.setItem(DEVELOPMENT_STORAGE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);
  /** Mejora que dará la carrera terminada con el resultado actual (se guarda al volver al inicio). */
  const developmentAfter = useCallback((result: RaceResult) => developAfterRace(development, Object.values(DRIVERS), driver => {
    const row = result.rows.find(r => r.driverCode === driver.code);
    return row ? { position: row.position, status: row.status, points: row.points } : undefined;
  }, simulation.totalLaps), [development, simulation]);

  // [R20] Formato del Gran Premio y resultado de la clasificación pendiente de mostrar
  const [raceFormat, setRaceFormat] = useState<RaceFormatId>('directo');
  const [qualifying, setQualifying] = useState<QualifyingResult | null>(null);

  // [R44] Meteorología de la próxima carrera
  const [weatherScenarioId, setWeatherScenarioId] = useState<string>('seco');

  // Historial de carreras guardadas
  const [raceHistory, setRaceHistory] = useState<RaceResultHistory[]>(() => {
    try {
      const saved = localStorage.getItem('f1_race_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lightState, setLightState] = useState<StartLightState>(simulation.lightState);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(simulation.speedMultiplier);
  const [isPaused, setIsPaused] = useState<boolean>(simulation.isPaused);
  const [leaderLap, setLeaderLap] = useState<number>(0);
  const [raceTimeSec, setRaceTimeSec] = useState<number>(0);
  const [cars, setCars] = useState<CarState[]>(simulation.cars);
  const [fastestLapDriver, setFastestLapDriver] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [podiumCars, setPodiumCars] = useState<CarState[]>([]);
  
  const [bestS1, setBestS1] = useState<number | null>(null);
  const [bestS2, setBestS2] = useState<number | null>(null);
  const [bestS3, setBestS3] = useState<number | null>(null);

  // Race flags & Safety Car & DNF & Luck D20 state
  const [raceFlagState, setRaceFlagState] = useState<RaceFlagState>('green');
  const [sectorFlags, setSectorFlags] = useState<[RaceFlagState, RaceFlagState, RaceFlagState]>(['green', 'green', 'green']);
  const [safetyCar, setSafetyCar] = useState<SafetyCarState | null>(null);
  const [activeDnf, setActiveDnf] = useState<DnfNotification | null>(null);
  const [activeLuckEvent, setActiveLuckEvent] = useState<D20LuckEvent | null>(null);
  const [weather, setWeather] = useState<TrackWeatherState>(simulation.weather);

  useEffect(() => {
    const interval = setInterval(() => {
      setLightState(simulation.lightState);
      setSpeedMultiplier(simulation.speedMultiplier);
      setIsPaused(simulation.isPaused);
      setLeaderLap(simulation.leaderLap);
      setRaceTimeSec(simulation.raceTimeSec);
      setCars([...simulation.cars]);
      setIsFinished(simulation.isFinished);
      setBestS1(simulation.overallBestS1);
      setBestS2(simulation.overallBestS2);
      setBestS3(simulation.overallBestS3);
      setCameraMode(camera.currentMode);
      setRaceFlagState(simulation.raceFlagState);
      setSectorFlags([...simulation.sectorFlags]);
      setSafetyCar(simulation.safetyCar.isDeployed ? { ...simulation.safetyCar } : null);
      setActiveDnf(simulation.latestDnf ? { ...simulation.latestDnf } : null);
      setActiveLuckEvent(simulation.activeLuckEvent ? { ...simulation.activeLuckEvent } : null);
      setWeather({ ...simulation.weather });

      if (simulation.isFinished) {
        setPodiumCars(simulation.podiumCars);
      }
      if (simulation.fastestLap) {
        setFastestLapDriver(simulation.fastestLap.driverName);
      }
    }, 66);

    return () => clearInterval(interval);
  }, [simulation, camera]);

  const handleSelectCar = useCallback((carId: number | null) => {
    setSelectedCarId(carId);
    if (carId !== null) {
      camera.followCar(carId);
      setDetailOpen(true);
    } else {
      camera.resetToFullTrack();
      setDetailOpen(false);
    }
  }, [camera]);

  // R32: herramientas de prueba (menú de carrera). Conservan su efecto anterior.
  const handleSafetyCarTest = useCallback(() => {
    if (!simulation.safetyCar.isDeployed) {
      // [Q14] Sale de su garaje en el pit lane, como en carrera.
      simulation.deploySafetyCar('PRUEBA MANUAL (DEV)', { targetLaps: 999 });
    } else {
      // Forzar que el SC se vaya por el pit lane
      simulation.recallSafetyCar();
      // Limpiamos los incidentes artificialmente si los hay
      simulation.incidents = [];
    }
  }, [simulation]);

  const handleRedFlagTest = useCallback(() => {
    // Escoger coche al azar
    const runningCars = simulation.cars.filter(c => c.status === 'running');
    if (runningCars.length === 0) return;
    const randomCar = runningCars[Math.floor(Math.random() * runningCars.length)];
    randomCar.status = 'out';
    const failureTypes = ['💥 ACCIDENTE GRAVE', '🔥 INCENDIO MOTOR', '💥 CHOQUE MÚLTIPLE'];
    randomCar.dnfReason = failureTypes[Math.floor(Math.random() * failureTypes.length)];
    randomCar.isRetiredVisible = true;
    randomCar.smokeOpacity = 1.0;
    randomCar.retireTimer = 60;

    // [R26] Bandera roja por el procedimiento real de R12 (sin marcar paradas a mano).
    simulation.startRedFlag('PRUEBA MANUAL (DEV)');
    simulation.triggerD20LuckRoll('red');
  }, [simulation]);

  const handleSpeedChange = useCallback((speed: number) => {
    simulation.setSpeed(speed);
    setSpeedMultiplier(simulation.speedMultiplier);
    setIsPaused(simulation.isPaused);
  }, [simulation]);

  // [Q18] Callbacks estables del modal D20; aplicar es idempotente en el motor por ID de evento.
  const handleApplyLuckReward = useCallback((eventId: string) => {
    simulation.applyLuckEventReward(eventId);
  }, [simulation]);
  // [R26] Variante D20: preferencia guardada en el navegador.
  const [luckVariantEnabled, setLuckVariantEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('f1_d20_variant') !== 'off'; } catch { return true; }
  });
  useEffect(() => { simulation.luckVariantEnabled = luckVariantEnabled; }, [simulation, luckVariantEnabled]);
  const handleToggleLuckVariant = useCallback(() => {
    setLuckVariantEnabled(value => {
      try { localStorage.setItem('f1_d20_variant', value ? 'off' : 'on'); } catch (e) { console.error(e); }
      return !value;
    });
  }, []);

  const handleDismissLuckEvent = useCallback(() => {
    simulation.activeLuckEvent = null;
    setActiveLuckEvent(null);
  }, [simulation]);

  const handleResetRace = useCallback(() => {
    simulation.initRace();
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setDetailOpen(false);
    clearNotices();
    setLightState('idle');
    setIsFinished(false);
    simulation.startRaceSequence();
  }, [simulation, camera]);

  const handleStartRaceFromHome = useCallback(() => {
    simulation.setDriverAttributes(development.attributes);
    simulation.setStartingGrid(null);
    simulation.setCircuit(selectedCircuitId);
    // [R20] Con clasificación, la parrilla sale de Q1-Q3 y se enseña antes de formar; el GP directo usa la prefijada.
    const quali = raceFormat === 'clasificacion' ? runQualifying(simulation.qualifyingEntrants(), Date.now() % 2147483647) : null;
    if (quali) simulation.setStartingGrid(quali.grid.map(slot => slot.driverId));
    setQualifying(quali);
    // [R44] Meteorología elegida en el paddock, ajustada a la duración prevista de la carrera.
    simulation.setWeatherScenario(buildWeatherScenario(weatherScenarioId, simulation.totalLaps * 90));
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setDetailOpen(false);
    clearNotices();
    setIsFinished(false);
    setCurrentView('race');
    if (!quali) simulation.startRaceSequence();
  }, [simulation, camera, selectedCircuitId, weatherScenarioId, development, raceFormat]);

  const handleStartFormationLap = useCallback(() => {
    if (simulation.lightState === 'grid-ready') {
      simulation.confirmRaceStart();
    } else {
      simulation.startRaceSequence();
    }
  }, [simulation]);

  const formatRaceTime = (totalSec: number): string => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGoHome = useCallback(() => {
    if (simulation.podiumCars.length >= 3) {
      const winner = simulation.podiumCars[0];
      const p2 = simulation.podiumCars[1];
      const p3 = simulation.podiumCars[2];
      const userCar = simulation.cars.find(c => c.driver.id === selectedDriverId) || winner;
      const circuit = OFFICIAL_CIRCUITS[selectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];

      const stintsDesc = winner.pitStop.stints && winner.pitStop.stints.length > 0
        ? winner.pitStop.stints.map(s => `${s.compound.toUpperCase()} (L${s.startLap}-${s.endLap})`).join(' ➔ ')
        : '1 PARADA (MEDIOS ➔ DUROS)';

      const newHistoryItem: RaceResultHistory = {
        id: `gp_${Date.now()}`,
        dateFormatted: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        trackName: circuit.name,
        winnerName: `${winner.driver.firstName} ${winner.driver.lastName}`,
        winnerTeam: winner.team.name,
        winnerTeamColor: winner.team.color,
        p2Name: `${p2.driver.firstName} ${p2.driver.lastName}`,
        p3Name: `${p3.driver.firstName} ${p3.driver.lastName}`,
        userDriverName: `${userCar.driver.firstName} ${userCar.driver.lastName}`,
        userDriverPos: userCar.currentPosition,
        winnerStrategy: stintsDesc,
        totalRaceTime: formatRaceTime(simulation.raceTimeSec)
      };

      // [R21] Al salir, el resultado queda confirmado y suma al campeonato.
      const finalResult = simulation.confirmResult();
      if (finalResult) {
        saveChampionship(addRace(championship, newHistoryItem.id, selectedCircuitId, finalResult, simulation.raceFormat));
        saveDevelopment(developmentAfter(finalResult));
      }

      const updatedHistory = [newHistoryItem, ...raceHistory].slice(0, 10);
      setRaceHistory(updatedHistory);
      try {
        localStorage.setItem('f1_race_history', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error(e);
      }
    }

    setCurrentView('home');
  }, [simulation, selectedDriverId, selectedCircuitId, raceHistory, championship, saveChampionship, saveDevelopment, developmentAfter]);

  const handleCycleCameraMode = useCallback(() => {
    camera.cycleMode();
    setCameraMode(camera.currentMode);
  }, [camera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'race') return;

      if (e.key === 'Escape') {
        handleSelectCar(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleSpeedChange(isPaused ? 1 : 0);
      } else if (e.key.toLowerCase() === 'c') {
        handleCycleCameraMode();
      } else if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const speedMap: Record<string, number> = {
          '1': 1,
          '2': 2,
          '3': 4,
          '4': 8,
          '5': 16,
          '6': 32
        };
        handleSpeedChange(speedMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, handleSelectCar, handleSpeedChange, isPaused, handleCycleCameraMode]);


  const favoriteCar = simulation.cars.find(c => c.driver.id === selectedDriverId) || simulation.cars[0];
  // [Q11] Resolve both team pilots for dual-panel BoxControls
  const teamCars = useMemo(() => {
    const driver = DRIVERS[selectedDriverId];
    if (!driver) return [favoriteCar];
    const team = TEAMS[driver.teamId];
    if (!team) return [favoriteCar];
    return team.drivers
      .map(dId => cars.find(c => c.driver.id === dId))
      .filter((c): c is CarState => c !== undefined);
  }, [cars, selectedDriverId, favoriteCar]);
  // ── R32: avisos breves (máx. 3 a la vez, caducan solos, sin robar el foco) ──
  const [notices, setNotices] = useState<RaceNotice[]>([]);
  const noticeSeq = useRef(0);
  const lastFlag = useRef<RaceFlagState>('green');
  const lastPitLane = useRef(new Map<number, boolean>());
  const lastDnfId = useRef<string | null>(null);

  const pushNotice = useCallback((tone: RaceNoticeTone, tag: string, text: string) => {
    const id = ++noticeSeq.current;
    setNotices(list => [...list, { id, tone, tag, text }].slice(-3));
    window.setTimeout(() => setNotices(list => list.filter(n => n.id !== id)), NOTICE_MS);
  }, []);

  const clearNotices = useCallback(() => {
    setNotices([]);
    lastFlag.current = 'green';
    lastPitLane.current.clear();
    lastDnfId.current = null;
  }, []);

  useEffect(() => {
    if (currentView !== 'race' || raceFlagState === lastFlag.current) return;
    lastFlag.current = raceFlagState;
    const [tone, tag, text] = FLAG_NOTICES[raceFlagState];
    pushNotice(tone, tag, text);
  }, [raceFlagState, currentView, pushNotice]);

  useEffect(() => {
    if (currentView !== 'race') return;
    for (const car of teamCars) {
      const was = lastPitLane.current.get(car.id);
      const now = car.isInPitLane;
      if (was === now) continue;
      lastPitLane.current.set(car.id, now);
      if (was === undefined) continue;
      if (now) pushNotice('info', 'Box', `${car.driver.code} entra en boxes`);
      else pushNotice('ok', 'Box', `${car.driver.code} sale de boxes con ${TYRE_WORDS[car.tires.compound] ?? car.tires.compound}`);
    }
  }, [teamCars, currentView, pushNotice]);

  useEffect(() => {
    if (!activeDnf || activeDnf.id === lastDnfId.current) return;
    lastDnfId.current = activeDnf.id;
    pushNotice('danger', 'DNF', `${activeDnf.driverCode}: ${activeDnf.reason}`);
  }, [activeDnf, pushNotice]);

  const selectedCar = selectedCarId !== null ? simulation.getCarById(selectedCarId) || null : null;
  // [Q13] Reincorporación estimada del piloto objetivo (el mismo que muestra el dock); se recalcula en cada refresco.
  const rejoinEstimate = simulation.getRejoinEstimate((selectedCar || favoriteCar).id);
  const activeCircuitSpec = OFFICIAL_CIRCUITS[selectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];

  if (currentView === 'landing') {
    return <LandingPage onEnter={() => setCurrentView('home')} />;
  }

  if (currentView === 'home') {
    return (
      <HomeScreen
        selectedDriverId={selectedDriverId}
        selectedCircuitId={selectedCircuitId}
        onSelectDriver={setSelectedDriverId}
        onSelectCircuit={setSelectedCircuitId}
        onStartRace={handleStartRaceFromHome}
        raceHistory={raceHistory}
        championship={championship}
        onResetChampionship={() => { saveChampionship(emptyChampionship()); saveDevelopment(emptyDevelopment()); }}
        raceFormat={raceFormat}
        onSelectFormat={setRaceFormat}
        weatherScenarioId={weatherScenarioId}
        onSelectWeather={setWeatherScenarioId}
      />
    );
  }

  // R30/R31: la vista de detalle sustituye a la clasificación en pantallas estrechas; en las anchas convive con ella.
  const isWide = viewportWidth >= 1600;
  const detailCar = selectedCar || favoriteCar;
  const detailIsRival = !teamCars.some(c => c.id === detailCar.id);
  const detailReplacesPositions = detailOpen && !isWide;
  const showPositions = leftSidebarOpen && !detailReplacesPositions;
  const columns: string[] = [];
  const areas: string[] = [];
  if (showPositions) { columns.push('var(--ancho-posiciones)'); areas.push('pos'); }
  if (detailReplacesPositions) { columns.push('var(--ancho-detalle)'); areas.push('detail'); }
  columns.push('minmax(0, 1fr)'); areas.push('center');
  if (detailOpen && isWide) { columns.push('var(--ancho-detalle)'); areas.push('detail'); }
  const shellLayout = { gridTemplateColumns: columns.join(' '), gridTemplateAreas: `"${areas.join(' ')}"` };

  return (
    <div className={styles.appContainer}>
      {/* ── R32: BARRA DE CARRERA (estado, tiempo, velocidad, cámara y menú) ── */}
      <header className={styles.raceBar}>
        <div className={styles.barGroup}>
          <button
            className={styles.homeBtn}
            onClick={() => setCurrentView('home')}
            title="Volver a la selección"
          >
            <ArrowLeft size={14} />
            <span>GPs</span>
          </button>
          <span className={`${styles.flagChip} ${styles[FLAG_CHIPS[raceFlagState].className]}`} role="status">
            {FLAG_CHIPS[raceFlagState].label}
          </span>
        </div>

        <SpeedControls
          currentSpeed={speedMultiplier}
          isPaused={isPaused}
          onSpeedChange={handleSpeedChange}
          onReset={handleResetRace}
          raceTimeFormatted={formatRaceTime(raceTimeSec)}
          leaderLap={leaderLap}
          totalLaps={simulation.totalLaps}
        />

        <div className={styles.barGroup}>
          <button
            className={styles.barBtn}
            onClick={handleCycleCameraMode}
            title="Pulsar 'C' para cambiar vista de cámara"
            aria-label={`Cámara: ${CAMERA_LABELS[cameraMode] ?? cameraMode}`}
          >
            <CameraIcon size={16} aria-hidden="true" />
            <span className={styles.barLabel}>Cámara: {CAMERA_LABELS[cameraMode] ?? cameraMode}</span>
          </button>
          <button className={styles.barBtn} onClick={() => camera.zoomBy(1 / 1.25)} title="Alejar (rueda del ratón)" aria-label="Alejar">
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <button className={styles.barBtn} onClick={() => camera.zoomBy(1.25)} title="Acercar (rueda del ratón)" aria-label="Acercar">
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button className={styles.barBtn} onClick={() => handleSelectCar(null)} title="Encuadrar todo el circuito (Esc)" aria-label="Vista general">
            <Maximize2 size={16} aria-hidden="true" />
            <span className={styles.barLabel}>Vista general</span>
          </button>
          <button
            className={styles.barBtn}
            aria-pressed={leftSidebarOpen}
            onClick={() => setLeftSidebarOpen(open => !open)}
            title={leftSidebarOpen ? 'Ocultar posiciones' : 'Mostrar posiciones'}
            aria-label="Posiciones"
          >
            <ListOrdered size={16} aria-hidden="true" />
            <span className={styles.barLabel}>Posiciones</span>
          </button>
          <button
            className={styles.barBtn}
            aria-pressed={detailOpen}
            onClick={() => setDetailOpen(open => !open)}
            title={detailOpen ? 'Cerrar detalle del coche' : 'Abrir detalle del coche'}
            aria-label="Detalle"
          >
            <PanelRight size={16} aria-hidden="true" />
            <span className={styles.barLabel}>Detalle</span>
          </button>
          <RaceMenu
            safetyCarDeployed={simulation.safetyCar.isDeployed}
            onToggleSafetyCarTest={handleSafetyCarTest}
            onRedFlagTest={handleRedFlagTest}
            luckVariantEnabled={luckVariantEnabled}
            onToggleLuckVariant={handleToggleLuckVariant}
          />
        </div>
      </header>

      <div className={styles.raceShell} style={shellLayout}>
        {/* ── 1. CLASIFICACIÓN COMPACTA ── */}
        <aside className={`${styles.positionsArea} ${showPositions ? '' : styles.isHidden}`} aria-label="Posiciones">
          <Leaderboard
            cars={cars}
            selectedCarId={selectedCarId}
            onSelectCar={handleSelectCar}
            fastestLapDriverName={fastestLapDriver}
            leaderLap={leaderLap}
            rejoin={rejoinEstimate}
          />
        </aside>

        {/* ── 2. CIRCUITO LIBRE + MURO EN SU FRANJA ── */}
        <main className={styles.centerArea}>
          <div className={styles.canvasArea}>
            <RaceCanvas
              simulation={simulation}
              camera={camera}
              selectedCarId={selectedCarId}
              onSelectCar={handleSelectCar}
            />

            {/* HUD de Banderas y Safety Car en Directo */}
            <RaceFlagsHUD
              raceFlagState={raceFlagState}
              sectorFlags={sectorFlags}
              safetyCar={safetyCar}
              onEndRace={() => { simulation.endRaceSuspended(); }}
            />

            <RaceNotices notices={notices} />

            {lightState === 'formation-lap' && (
              <div className={styles.formationBanner}>
                <RotateCw size={16} className={styles.spinIcon} />
                <span>VUELTA DE FORMACIÓN EN CURSO</span>
              </div>
            )}

            <StartLights
              lightState={lightState}
              cars={cars}
              favoriteCarId={favoriteCar.id}
              onSelectFavoriteCar={(id) => {
                const c = simulation.getCarById(id);
                if (c) setSelectedDriverId(c.driver.id);
              }}
              onStartClick={handleStartFormationLap}
            />

            {qualifying && (
              <div className={qualifyingStyles.overlay}>
                <QualifyingResults result={qualifying} onContinue={() => { setQualifying(null); simulation.startRaceSequence(); }} />
              </div>
            )}

            {isFinished && podiumCars.length >= 3 && (
              <PodiumModal
                podiumCars={podiumCars}
                result={simulation.getRaceResult()}
                onConfirmResult={() => { simulation.confirmResult(); setPodiumCars([...simulation.podiumCars]); }}
                progress={(() => {
                  const after = developmentAfter(simulation.getRaceResult());
                  return teamCars.map(c => DRIVERS[c.driver.id]).filter(Boolean).map(driver => ({
                    driver, attributes: attributesOf(after, driver), gains: after.lastGains[driver.id] ?? {}, focus: development.focus[driver.id] ?? 'equilibrado',
                  }));
                })()}
                onFocusChange={(driverId, focus) => saveDevelopment({ ...development, focus: { ...development.focus, [driverId]: focus } })}
                onRestart={handleResetRace}
                onGoHome={handleGoHome}
              />
            )}

            <DnfNotificationModal
              notification={activeDnf}
              onDismiss={() => {
                simulation.latestDnf = null;
                setActiveDnf(null);
              }}
            />

            {/* ── MODAL DE SUERTE CON DADO D20 (SAFETY CAR & BANDERA ROJA) ── */}
            {activeLuckEvent && (
              <D20LuckModal
                key={activeLuckEvent.id}
                event={activeLuckEvent}
                onApplyReward={handleApplyLuckReward}
                onDismiss={handleDismissLuckEvent}
              />
            )}
          </div>

          <section className={styles.wallArea}>
            <BoxControls key={teamCars.map(c => c.id).join(':') + ':' + selectedCircuitId} car={favoriteCar} simulation={simulation} teamCars={teamCars} />
          </section>
        </main>

        {/* ── 3. DETALLE DEL COCHE CONSULTADO (se conserva montado para no perder pestaña ni selección) ── */}
        <aside className={`${styles.detailArea} ${detailOpen ? '' : styles.isHidden}`} aria-label="Detalle del coche">
          <div className={styles.detailHeader}>
            {detailReplacesPositions ? (
              <button className={styles.barBtn} onClick={() => setDetailOpen(false)}>← Volver a posiciones</button>
            ) : (
              <span className={styles.detailTitle}>Detalle · {detailCar.driver.code}</span>
            )}
            {!detailReplacesPositions && (
              <button className={styles.barBtn} onClick={() => setDetailOpen(false)} aria-label="Cerrar detalle">✕</button>
            )}
          </div>
          {detailIsRival && (
            <div className={styles.rivalNote}>
              Solo consulta: las órdenes siguen siendo para {teamCars.map(c => c.driver.code).join(' y ')}.
            </div>
          )}
          <BottomTelemetryDock car={detailCar} onSelectCar={handleSelectCar} compact />
          <div className={styles.detailStats}>
            <RightStatsPanel
              car={selectedCar}
              defaultCar={favoriteCar}
              totalLaps={simulation.totalLaps}
              overallBestS1={bestS1}
              overallBestS2={bestS2}
              overallBestS3={bestS3}
              weather={weather}
              circuit={activeCircuitSpec}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;
