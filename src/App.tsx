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
import { aiDevelop, emptyProgram, installFirst, parseProgram, startProject, upgradesFor, PROGRAM_STORAGE_KEY } from './simulation/Development';
import type { DevelopmentProgram } from './simulation/Development';
import { calendarView, emptySeason, grandsPrixRun, isSeasonRace, nextRound, parseArchive, parseSeason, settleRace, settleSkip, sprintPending, SEASONS_STORAGE_KEY, SEASON_STATE_KEY } from './simulation/Season';
import { carryTyres, isSprintVenue, podiumHomeLabel, sprintWeekendTyres } from './simulation/Weekend';
import type { SeasonState, SeasonSummary, SettledCareer } from './simulation/Season';
import { SeasonEndScreen } from './components/SeasonEndScreen';
import { GridPenaltyNotice } from './components/GridPenaltyNotice';
import { constructorsChampionship } from './simulation/Championship';
import { aiReplace, applyGridPenalties, emptyComponents, ensureDriver, fitNew, gridPenaltyLines, hazardFactor, markRaceStart, parseComponents, raceStartGate, undoFit, COMPONENTS_STORAGE_KEY } from './simulation/ComponentPool';
import type { ComponentState, GridChange, PenaltyLine } from './simulation/ComponentPool';
import type { QualifyingResult } from './simulation/Qualifying';
import { QualifyingResults } from './components/QualifyingResults';
import qualifyingStyles from './components/QualifyingResults.module.css';
import type { RaceFormatId } from './components/RaceFormatSelect';
import { attributesOf, developAfterRace, emptyDevelopment, parseDevelopment, DEVELOPMENT_STORAGE_KEY } from './simulation/DriverDevelopment';
import type { DevelopmentState } from './simulation/DriverDevelopment';
import type { RaceResult } from './simulation/RaceResult';
import { emptyChampionship, parseChampionship, CHAMPIONSHIP_STORAGE_KEY } from './simulation/Championship';
import type { ChampionshipState } from './simulation/Championship';
import { createSnapshot, restoreSnapshot } from './simulation/Snapshot';
import { AUTOSAVE_ID, AUTOSAVE_LABEL, SaveStore, createSave, exportSave, importSave, savedRaceCounts, savedSeason } from './simulation/SaveGame';
import type { SaveGame, SlotSummary } from './simulation/SaveGame';
import type { SaveGameMessage } from './components/SaveGamePanel';
import { SetupPanel } from './components/SetupPanel';
import { normalizeSetup, parcFermeCheck, pitLaneReason, withPitLaneStarts } from './simulation/Setup';
import type { CarSetup } from './simulation/Setup';
import { DRIVERS } from './data/drivers';
import { TEAMS } from './data/teams';
import { RaceResultHistory, StartLightState, CarState, RaceFlagState, SafetyCarState, DnfNotification, D20LuckEvent, TrackWeatherState } from './types/f1';
import { RotateCw, ArrowLeft, Camera as CameraIcon, Maximize2, ListOrdered, PanelRight, ZoomIn, ZoomOut } from 'lucide-react';
import { WallPanel } from './components/WallPanel';
import { nextAlerts, wallAlerts } from './simulation/Wall';
import type { WallReading } from './simulation/Wall';

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
// [R48] Autoguardado de la carrera en curso (ms reales) y semilla propia de cada carrera.
const AUTOSAVE_MS = 30000;
const SAVE_NAME_KEY = 'f1_save_name';
const SETUPS_KEY = 'f1_setups';
const newRaceSeed = () => (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
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
  // [R51] El paddock abre con el circuito del Gran Premio que toca en la temporada.
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>(() => {
    try {
      return nextRound(parseChampionship(localStorage.getItem(CHAMPIONSHIP_STORAGE_KEY)), parseSeason(localStorage.getItem(SEASON_STATE_KEY)))?.circuitId ?? 'barcelona';
    } catch { return 'barcelona'; }
  });

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

  // [R19] Componentes de la unidad de potencia de todos los pilotos, guardados en el navegador
  const [components, setComponents] = useState<ComponentState>(() => {
    let state = emptyComponents();
    try { state = parseComponents(localStorage.getItem(COMPONENTS_STORAGE_KEY)); } catch { /* sin almacenamiento */ }
    return Object.keys(DRIVERS).reduce((s, id) => ensureDriver(s, id), state);
  });
  const saveComponents = useCallback((next: ComponentState) => {
    setComponents(next);
    try { localStorage.setItem(COMPONENTS_STORAGE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);
  const [gridChanges, setGridChanges] = useState<GridChange[]>([]);

  // [R18] Programa de desarrollo y temporadas archivadas, guardados en el navegador
  const [program, setProgram] = useState<DevelopmentProgram>(() => {
    try { return parseProgram(localStorage.getItem(PROGRAM_STORAGE_KEY)); } catch { return emptyProgram(); }
  });
  const saveProgram = useCallback((next: DevelopmentProgram) => {
    setProgram(next);
    try { localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);
  const [seasonArchive, setSeasonArchive] = useState<SeasonSummary[]>(() => {
    try { return parseArchive(localStorage.getItem(SEASONS_STORAGE_KEY)); } catch { return []; }
  });
  // [R51] Rondas saltadas de la temporada, si la carrera en curso cuenta para ella, el cierre pendiente de ver y el
  // aviso de sanciones previo a la salida en GP directo.
  const [season, setSeason] = useState<SeasonState>(() => {
    try { return parseSeason(localStorage.getItem(SEASON_STATE_KEY)); } catch { return emptySeason(); }
  });
  const saveSeason = useCallback((next: SeasonState) => {
    setSeason(next);
    try { localStorage.setItem(SEASON_STATE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);
  const [raceCounts, setRaceCounts] = useState(true);
  const [seasonEnd, setSeasonEnd] = useState<SeasonSummary | null>(null);
  const [penaltyNotice, setPenaltyNotice] = useState<PenaltyLine[]>([]);
  /** Posición del equipo en constructores (7 si aún no ha puntuado o no hay carreras). */
  const constructorsPosition = useCallback((teamId: string) => {
    const index = constructorsChampionship(championship).findIndex(t => t.teamId === teamId || t.teamName === TEAMS[teamId]?.name);
    return index >= 0 ? Math.min(10, index + 1) : 7;
  }, [championship]);

  // [R48] Partidas guardadas. `raceLive`: hay en el motor una carrera empezada cuyo resultado aún no se ha anotado.
  const saveStore = useMemo(() => {
    try { return new SaveStore(window.localStorage); } catch { return null; }
  }, []);
  const [slots, setSlots] = useState<SlotSummary[]>(() => {
    try { return saveStore ? saveStore.list() : []; } catch { return []; }
  });
  const [saveName, setSaveName] = useState<string>(() => {
    try { return localStorage.getItem(SAVE_NAME_KEY) ?? ''; } catch { return ''; }
  });
  const [saveMessage, setSaveMessage] = useState<SaveGameMessage | null>(null);
  const [raceLive, setRaceLive] = useState(false);
  const autosaveWarned = useRef(false);

  // [R49] Setup de los coches del jugador (por piloto) y el que llevaban en la clasificación (parc fermé).
  const [setups, setSetups] = useState<Record<string, CarSetup>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETUPS_KEY) ?? '{}');
      return saved && typeof saved === 'object' ? Object.fromEntries(Object.entries(saved).map(([id, value]) => [id, normalizeSetup(value as Partial<CarSetup>)])) : {};
    } catch { return {}; }
  });
  const saveSetups = useCallback((next: Record<string, CarSetup>) => {
    setSetups(next);
    try { localStorage.setItem(SETUPS_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);
  const [qualifyingSetups, setQualifyingSetups] = useState<Record<string, CarSetup> | null>(null);
  /** Setups de los pilotos del equipo del jugador (los rivales corren con el de referencia). */
  const playerSetups = useMemo(() => {
    const team = TEAMS[(DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId];
    return Object.fromEntries((team?.drivers ?? []).map(id => [id, normalizeSetup(setups[id])]));
  }, [setups, selectedDriverId]);

  // [R20] Formato del Gran Premio y resultado de la clasificación pendiente de mostrar
  // [R52] En una ronda sprint con el sprint por correr, el paddock propone el fin de semana sprint.
  const [raceFormat, setRaceFormat] = useState<RaceFormatId>(() => {
    try {
      return sprintPending(parseChampionship(localStorage.getItem(CHAMPIONSHIP_STORAGE_KEY)), parseSeason(localStorage.getItem(SEASON_STATE_KEY))) ? 'sprint' : 'directo';
    } catch { return 'directo'; }
  });
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
    // [R48] Carrera nueva, semilla nueva: reiniciar no repite la anterior.
    simulation.setSeed(newRaceSeed());
    simulation.initRace();
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setDetailOpen(false);
    clearNotices();
    setLightState('idle');
    setIsFinished(false);
    simulation.startRaceSequence();
  }, [simulation, camera]);

  // [R52] El sprint solo se ofrece donde lo hay: en una carrera libre de un circuito sprint o en la ronda sprint de la
  // temporada mientras su sprint no se haya corrido.
  const sprintAvailable = isSprintVenue(selectedCircuitId) && (!isSeasonRace(selectedCircuitId, championship, season) || sprintPending(championship, season));
  const effectiveFormat: RaceFormatId = raceFormat === 'sprint' && !sprintAvailable ? 'clasificacion' : raceFormat;

  const handleStartRaceFromHome = useCallback(() => {
    // [R48] Cada carrera lleva su semilla (se guarda con ella): cargarla da siempre la misma continuación.
    simulation.setSeed(newRaceSeed());
    setRaceLive(true);
    setSaveMessage(null);
    autosaveWarned.current = false;
    if (saveStore) { saveStore.remove(AUTOSAVE_ID); setSlots(saveStore.list()); }
    simulation.setDriverAttributes(development.attributes);
    // [R49] Setup del jugador antes de clasificar; nadie sale desde el pit lane hasta que lo decida el parc fermé.
    simulation.setCarSetups(playerSetups);
    simulation.setPitLaneStarters([]);
    // [R52] Fin de semana sprint: primero la clasificación sprint y el sprint (100 km, sin paradas obligatorias);
    // el Gran Premio de esa ronda se corre después con los neumáticos que queden.
    const format = effectiveFormat, sprintRace = format === 'sprint';
    const seasonRace = isSeasonRace(selectedCircuitId, championship, season);
    simulation.setRaceFormat(sprintRace ? 'sprint' : 'gp');
    const weekendNow = season.weekend;
    simulation.setWeekendTyres(!sprintRace && seasonRace && weekendNow && weekendNow.round === nextRound(championship, season)?.round ? weekendNow.tyres : null);
    setQualifyingSetups(format !== 'directo' ? playerSetups : null);
    simulation.setStartingGrid(null);
    simulation.setCircuit(selectedCircuitId);
    // [R20] Con clasificación, la parrilla sale de Q1-Q3 y se enseña antes de formar; el GP directo usa la prefijada.
    const quali = format !== 'directo' ? runQualifying(simulation.qualifyingEntrants(), Date.now() % 2147483647, { format: sprintRace ? 'sprint' : 'gp' }) : null;
    if (sprintRace && quali) simulation.setWeekendTyres(sprintWeekendTyres(selectedCircuitId, quali.tyreUse));
    // [R19] Antes de salir: la IA sustituye lo agotado, las unidades sin estrenar cuentan como usadas y sus sanciones
    // recolocan la parrilla (la de la clasificación o la prefijada).
    // [R51] Solo cuenta para la temporada la carrera del circuito que toca; una carrera libre no gasta componentes,
    // no sanciona y no mueve el desarrollo.
    const counts = seasonRace;
    setRaceCounts(counts);
    // Componentes, sanciones y desarrollo son cosa del Gran Premio: el sprint no los mueve.
    const careerRace = counts && !sprintRace;
    const playerTeam = (DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId;
    const prepared = careerRace ? aiReplace(components, Object.values(DRIVERS).filter(d => d.teamId !== playerTeam).map(d => d.id)) : components;
    const started = careerRace ? markRaceStart(prepared) : { state: components, penalties: [] };
    if (careerRace) saveComponents(started.state);
    simulation.setFailureFactors(Object.fromEntries(Object.keys(DRIVERS).map(id => [id, hazardFactor(started.state, id)])));
    // [R18] La IA desarrolla y monta sus mejoras; cada coche corre con las suyas.
    const raceIndex = grandsPrixRun(championship);
    const aiTeams = [...new Set(Object.values(DRIVERS).map(d => d.teamId))].filter(t => t !== playerTeam);
    const developed = careerRace ? aiDevelop(program, aiTeams, raceIndex, Object.fromEntries(aiTeams.map(t => [t, constructorsPosition(t)])), raceIndex + 1,
      teamId => Object.values(DRIVERS).find(d => d.teamId === teamId)?.id ?? teamId) : program;
    if (careerRace) saveProgram(developed);
    simulation.setTechnicalUpgrades(Object.fromEntries(Object.values(DRIVERS).map(d => [d.id, upgradesFor(developed, d.teamId, d.id, raceIndex)])));
    const baseGrid = quali ? quali.grid.map(slot => slot.driverId) : simulation.cars.map(c => c.driver.id);
    const penalized = applyGridPenalties(baseGrid, started.penalties);
    if (quali || penalized.moved.length) simulation.setStartingGrid(penalized.order);
    setGridChanges(penalized.moved);
    // [R51] En GP directo las sanciones se avisan antes de la salida (con clasificación ya se ven en su pantalla).
    const gate = raceStartGate(Boolean(quali), penalized.moved);
    setPenaltyNotice(gate === 'aviso-sanciones'
      ? gridPenaltyLines(penalized.moved, started.penalties, id => DRIVERS[id] && { name: `${DRIVERS[id].firstName} ${DRIVERS[id].lastName}`, code: DRIVERS[id].code })
      : []);
    setQualifying(quali);
    // [R44] Meteorología elegida en el paddock, ajustada a la duración prevista de la carrera.
    simulation.setWeatherScenario(buildWeatherScenario(weatherScenarioId, simulation.totalLaps * 90));
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setDetailOpen(false);
    clearNotices();
    setIsFinished(false);
    setCurrentView('race');
    if (gate === 'directo') simulation.startRaceSequence();
  }, [simulation, camera, selectedCircuitId, weatherScenarioId, development, raceFormat, components, saveComponents, selectedDriverId, program, saveProgram, championship, constructorsPosition, saveStore, playerSetups, season, effectiveFormat]);

  /** [R51] Visto el aviso de sanciones, empieza la carrera. */
  const handleContinueFromPenalties = useCallback(() => {
    setPenaltyNotice([]);
    simulation.startRaceSequence();
  }, [simulation]);

  /** [R51] Guarda la carrera profesional tras una carrera o un salto; si la temporada se ha cerrado, lo enseña. */
  const applyCareer = useCallback((settled: SettledCareer) => {
    saveChampionship(settled.championship);
    saveComponents(settled.components);
    saveProgram(settled.program);
    saveSeason(settled.season);
    setSeasonArchive(settled.archive);
    try { localStorage.setItem(SEASONS_STORAGE_KEY, JSON.stringify(settled.archive)); } catch (e) { console.error(e); }
    if (settled.closed) setSeasonEnd(settled.closed);
    // La temporada elige el Gran Premio siguiente.
    const next = nextRound(settled.championship, settled.season);
    if (next) setSelectedCircuitId(next.circuitId);
    // [R52] En una ronda sprint se propone el sprint; corrido el sprint, la clasificación del Gran Premio.
    const proposeSprint = sprintPending(settled.championship, settled.season);
    setRaceFormat(current => (proposeSprint ? 'sprint' : current === 'sprint' ? 'clasificacion' : current));
  }, [saveChampionship, saveComponents, saveProgram, saveSeason]);

  const playerCodes = useMemo(() => {
    const team = (DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId;
    return Object.values(DRIVERS).filter(d => d.teamId === team).map(d => d.code);
  }, [selectedDriverId]);

  /** [R51] Salta el Gran Premio que toca: no se disputa y nadie puntúa. */
  const handleSkipRound = useCallback(() => {
    applyCareer(settleSkip({ championship, components, program, season, archive: seasonArchive }, playerCodes));
  }, [applyCareer, championship, components, program, season, seasonArchive, playerCodes]);

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
        trackName: `${circuit.name}${simulation.raceFormat === 'sprint' ? ' · sprint' : ''}${raceCounts ? '' : ' · carrera libre'}`,
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

      // [R21] Al salir, el resultado queda confirmado. [R51] Si la carrera cuenta, suma al campeonato, mejora a los
      // pilotos (R45), gasta los componentes montados (R19) y, tras la última ronda, cierra la temporada (R18); una
      // carrera libre no cambia nada de eso.
      const finalResult = simulation.confirmResult();
      if (finalResult) {
        if (raceCounts && simulation.raceFormat !== 'sprint') saveDevelopment(developmentAfter(finalResult));
        applyCareer(settleRace({ championship, components, program, season, archive: seasonArchive }, {
          counts: raceCounts, id: newHistoryItem.id, circuitId: selectedCircuitId, result: finalResult, format: simulation.raceFormat,
          raceKm: simulation.leaderLap * simulation.activeTrack.lapLengthMeters / 1000, playerCodes,
          tyres: simulation.raceFormat === 'sprint' ? carryTyres(simulation.cars) : undefined,
        }));
      }

      // [R48] Resultado anotado: ya no hay carrera en curso que continuar.
      setRaceLive(false);
      if (saveStore) { saveStore.remove(AUTOSAVE_ID); setSlots(saveStore.list()); }

      const updatedHistory = [newHistoryItem, ...raceHistory].slice(0, 10);
      setRaceHistory(updatedHistory);
      try {
        localStorage.setItem('f1_race_history', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error(e);
      }
    }

    setCurrentView('home');
  }, [simulation, selectedDriverId, selectedCircuitId, raceHistory, championship, saveDevelopment, developmentAfter, components, program, seasonArchive, saveStore, season, raceCounts, applyCareer, playerCodes]);

  const handleCycleCameraMode = useCallback(() => {
    camera.cycleMode();
    setCameraMode(camera.currentMode);
  }, [camera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'race') return;
      // [R48] Al escribir (nombre de la partida) las teclas son texto, no atajos.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

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

  // [R24] Avisos del muro para los coches del jugador: por prioridad, como mucho tres a la vez y sin repetirse
  // mientras dure la causa.
  const wallActive = useRef(new Set<string>());
  useEffect(() => {
    if (currentView !== 'race') { wallActive.current = new Set(); return; }
    const timer = window.setInterval(() => {
      if (simulation.lightState !== 'racing' || simulation.isFinished) return;
      const team = (DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId;
      const readings = simulation.cars.filter(car => DRIVERS[car.driver.id]?.teamId === team && car.status === 'running')
        .map(car => simulation.getWallReading(car.id)).filter((reading): reading is WallReading => reading !== null);
      const next = nextAlerts(wallAlerts(readings), wallActive.current);
      wallActive.current = next.active;
      for (const alert of next.show) pushNotice(alert.tone, 'Muro', alert.text);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentView, simulation, selectedDriverId, pushNotice]);

  // ── [R48] Partidas: ranuras con nombre, autoguardado y carga ──
  const refreshSlots = useCallback(() => setSlots(saveStore ? saveStore.list() : []), [saveStore]);

  const buildSave = useCallback((name: string): SaveGame => createSave({
    name,
    savedAt: new Date().toISOString(),
    career: { championship, development, components, program, archive: seasonArchive, history: raceHistory, season },
    selection: { driverId: selectedDriverId, circuitId: selectedCircuitId, raceFormat, weatherScenarioId, luckVariant: luckVariantEnabled, setups, counts: raceCounts },
    race: raceLive ? createSnapshot(simulation) : null,
  }), [setups, championship, development, components, program, seasonArchive, raceHistory, selectedDriverId, selectedCircuitId, raceFormat, weatherScenarioId, luckVariantEnabled, raceLive, simulation, season, raceCounts]);

  const handleSaveGame = useCallback((name: string) => {
    if (!saveStore) { setSaveMessage({ tone: 'error', text: 'Este navegador no permite guardar partidas' }); return; }
    const save = buildSave(name);
    const outcome = saveStore.save(save);
    refreshSlots();
    if (outcome.ok) {
      setSaveName(save.name);
      try { localStorage.setItem(SAVE_NAME_KEY, save.name); } catch (e) { console.error(e); }
    }
    const text = outcome.ok ? `Partida guardada: ${save.name}` : outcome.error ?? 'No se pudo guardar la partida';
    setSaveMessage({ tone: outcome.ok ? 'ok' : 'error', text });
    if (currentView === 'race') pushNotice(outcome.ok ? 'ok' : 'danger', 'Partida', text);
  }, [saveStore, buildSave, refreshSlots, currentView, pushNotice]);

  /** Sustituye la partida actual por `save`. Si lleva carrera, se carga primero: si falla, no se toca nada. */
  const applySave = useCallback((save: SaveGame): string | null => {
    if (save.race) {
      const outcome = restoreSnapshot(simulation, save.race);
      if (!outcome.ok) return outcome.errors.slice(0, 3).join(' · ');
      simulation.setSpeed(0);
    } else {
      simulation.setStartingGrid(null);
      simulation.setCircuit(OFFICIAL_CIRCUITS[save.selection.circuitId] ? save.selection.circuitId : 'barcelona');
    }
    const career = save.career, selection = save.selection;
    saveChampionship(career.championship);
    saveDevelopment(career.development);
    saveComponents(Object.keys(DRIVERS).reduce((s, id) => ensureDriver(s, id), career.components));
    saveProgram(career.program);
    saveSeason(savedSeason(save));
    setRaceCounts(savedRaceCounts(save));
    setSeasonEnd(null);
    setPenaltyNotice([]);
    setSeasonArchive(career.archive);
    setRaceHistory(career.history);
    try {
      localStorage.setItem(SEASONS_STORAGE_KEY, JSON.stringify(career.archive));
      localStorage.setItem('f1_race_history', JSON.stringify(career.history));
      localStorage.setItem('f1_d20_variant', selection.luckVariant ? 'on' : 'off');
    } catch (e) { console.error(e); }
    setSelectedDriverId(DRIVERS[selection.driverId] ? selection.driverId : 'alonso');
    setSelectedCircuitId(save.race?.circuitId ?? (OFFICIAL_CIRCUITS[selection.circuitId] ? selection.circuitId : 'barcelona'));
    setRaceFormat(selection.raceFormat === 'clasificacion' || selection.raceFormat === 'sprint' ? selection.raceFormat : 'directo');
    setWeatherScenarioId(selection.weatherScenarioId);
    setLuckVariantEnabled(selection.luckVariant);
    saveSetups(Object.fromEntries(Object.entries(selection.setups ?? {}).map(([id, value]) => [id, normalizeSetup(value)])));
    setQualifyingSetups(null);
    setQualifying(null);
    setGridChanges([]);
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setDetailOpen(false);
    clearNotices();
    setIsFinished(simulation.isFinished);
    setPodiumCars(simulation.podiumCars);
    setLightState(simulation.lightState);
    setRaceLive(Boolean(save.race));
    autosaveWarned.current = false;
    setCurrentView(save.race ? 'race' : 'home');
    return null;
  }, [simulation, camera, saveChampionship, saveDevelopment, saveComponents, saveProgram, clearNotices, saveSetups]);

  const handleLoadGame = useCallback((id: string) => {
    if (!saveStore) return;
    const loaded = saveStore.load(id);
    if (!loaded.save) { setSaveMessage({ tone: 'error', text: `No se pudo cargar la partida: ${loaded.errors.slice(0, 3).join(' · ')}` }); return; }
    const failure = applySave(loaded.save);
    if (failure) { setSaveMessage({ tone: 'error', text: `No se pudo cargar la carrera en curso: ${failure}` }); return; }
    if (id !== AUTOSAVE_ID) {
      setSaveName(loaded.save.name);
      try { localStorage.setItem(SAVE_NAME_KEY, loaded.save.name); } catch (e) { console.error(e); }
    }
    const label = id === AUTOSAVE_ID ? AUTOSAVE_LABEL : loaded.save.name;
    setSaveMessage({ tone: loaded.diagnostics.length ? 'info' : 'ok', text: [`Partida cargada: ${label}.`, ...loaded.diagnostics].join(' ') });
    if (loaded.save.race) pushNotice('info', 'Partida', `${label}: carrera cargada en pausa`);
  }, [saveStore, applySave, pushNotice]);

  const handleExportGame = useCallback((id: string) => {
    if (!saveStore) return;
    const loaded = saveStore.load(id);
    if (!loaded.save) { setSaveMessage({ tone: 'error', text: `No se pudo exportar la partida: ${loaded.errors.slice(0, 3).join(' · ')}` }); return; }
    const label = id === AUTOSAVE_ID ? AUTOSAVE_LABEL : loaded.save.name;
    const url = URL.createObjectURL(new Blob([exportSave({ ...loaded.save, name: label })], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `f1sim-${label.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/g, '-').replace(/^-|-$/g, '') || 'partida'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSaveMessage({ tone: 'ok', text: `Partida exportada: ${link.download}` });
  }, [saveStore]);

  const handleImportGame = useCallback((text: string) => {
    if (!saveStore) return;
    const outcome = importSave(text);
    if (!outcome.save) { setSaveMessage({ tone: 'error', text: `No se pudo importar el archivo: ${outcome.errors.slice(0, 3).join(' · ')}` }); return; }
    // No pisa una ranura que ya exista con ese nombre.
    const taken = new Set(saveStore.list().map(slot => slot.id));
    const base = outcome.save.name.trim() || 'Partida importada';
    let name = base;
    for (let copy = 2; taken.has(SaveStore.slotId(name)); copy++) name = `${base.slice(0, 34)} (${copy})`;
    const stored = saveStore.save({ ...outcome.save, name });
    refreshSlots();
    setSaveMessage(stored.ok
      ? { tone: outcome.diagnostics.length ? 'info' : 'ok', text: [`Partida importada: ${name}. Pulsa «${outcome.save.race ? 'Continuar carrera' : 'Cargar'}» para usarla.`, ...outcome.diagnostics].join(' ') }
      : { tone: 'error', text: stored.error ?? 'No se pudo guardar la partida importada' });
  }, [saveStore, refreshSlots]);

  const handleDeleteGame = useCallback((id: string) => {
    if (!saveStore) return;
    saveStore.remove(id);
    refreshSlots();
    setSaveMessage({ tone: 'info', text: 'Partida borrada' });
  }, [saveStore, refreshSlots]);

  // Autoguardado: cada 30 s reales en carrera, al volver al paddock y al cerrar, recargar u ocultar la página.
  const autosave = useCallback(() => {
    if (!saveStore || !raceLive) return;
    const outcome = saveStore.save(buildSave(AUTOSAVE_LABEL), { auto: true });
    refreshSlots();
    if (!outcome.ok && !autosaveWarned.current) {
      autosaveWarned.current = true;
      pushNotice('warning', 'Partida', 'Autoguardado sin espacio: borra o exporta alguna partida');
    }
  }, [saveStore, raceLive, buildSave, refreshSlots, pushNotice]);
  const autosaveRef = useRef(autosave);
  useEffect(() => { autosaveRef.current = autosave; }, [autosave]);
  useEffect(() => {
    if (!raceLive) return;
    const onPageHide = () => autosaveRef.current();
    const onVisibility = () => { if (document.visibilityState === 'hidden') autosaveRef.current(); };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = currentView === 'race' ? window.setInterval(() => autosaveRef.current(), AUTOSAVE_MS) : undefined;
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [raceLive, currentView]);

  // ── [R49] Parc fermé: cambios de setup tras la clasificación y salida desde el pit lane ──
  const parcFermeStarts = useMemo(() => {
    if (!qualifying || !qualifyingSetups) return [];
    const starters = Object.keys(qualifyingSetups)
      .map(driverId => ({ driverId, check: parcFermeCheck(qualifyingSetups[driverId], setups[driverId]) }))
      .filter(entry => !entry.check.allowed)
      .map(entry => ({ driverId: entry.driverId, reason: pitLaneReason(entry.check) }));
    return withPitLaneStarts(simulation.cars.map(c => c.driver.id), starters).pitLane;
  }, [qualifying, qualifyingSetups, setups, simulation]);

  const handleSetupChange = useCallback((driverId: string, setup: CarSetup) => {
    saveSetups({ ...setups, [driverId]: setup });
  }, [setups, saveSetups]);

  const handleContinueFromQualifying = useCallback(() => {
    simulation.setCarSetups(playerSetups);
    if (parcFermeStarts.length) simulation.setPitLaneStarters(parcFermeStarts.map(start => start.driverId));
    setQualifying(null);
    for (const start of parcFermeStarts) pushNotice('warning', 'Salida', `${DRIVERS[start.driverId]?.code ?? start.driverId} sale desde el pit lane: ${start.reason.toLowerCase()}`);
    simulation.startRaceSequence();
  }, [simulation, playerSetups, parcFermeStarts, pushNotice]);

  // Aviso cuando el semáforo del pit lane se pone en verde para un coche del jugador.
  const lastPitStart = useRef(new Map<number, string | undefined>());
  useEffect(() => {
    if (currentView !== 'race') return;
    for (const car of teamCars) {
      const was = lastPitStart.current.get(car.id);
      lastPitStart.current.set(car.id, car.pitLaneStart);
      if (was === 'espera' && car.pitLaneStart === 'saliendo') pushNotice('ok', 'Salida', `${car.driver.code}: semáforo del pit lane en verde`);
    }
  }, [teamCars, currentView, pushNotice]);

  const handleLeaveRace = useCallback(() => {
    autosaveRef.current();
    setCurrentView('home');
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
      <>
      <HomeScreen
        selectedDriverId={selectedDriverId}
        selectedCircuitId={selectedCircuitId}
        onSelectDriver={setSelectedDriverId}
        onSelectCircuit={setSelectedCircuitId}
        onStartRace={handleStartRaceFromHome}
        raceHistory={raceHistory}
        championship={championship}
        onResetChampionship={() => {
          saveChampionship(emptyChampionship()); saveDevelopment(emptyDevelopment());
          saveComponents(Object.keys(DRIVERS).reduce((s, id) => ensureDriver(s, id), emptyComponents()));
          saveProgram(emptyProgram());
          saveSeason(emptySeason());
        }}
        season={{
          rounds: calendarView(championship, season), seasonNumber: seasonArchive.length + 1, archive: seasonArchive,
          onSelectNext: () => {
            const next = nextRound(championship, season);
            if (!next) return;
            setSelectedCircuitId(next.circuitId);
            if (sprintPending(championship, season)) setRaceFormat('sprint');
          },
          onSkip: handleSkipRound,
        }}
        driverAttributes={driver => attributesOf(development, driver)}
        components={components}
        development={{
          program, raceIndex: grandsPrixRun(championship),
          constructorsPosition: constructorsPosition((DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId),
          onStart: key => saveProgram(startProject(program, (DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId, key, grandsPrixRun(championship),
            constructorsPosition((DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId)).program),
          onInstall: (projectId, driverId) => saveProgram(installFirst(program, projectId, driverId, grandsPrixRun(championship)).program),
        }}
        onFitComponent={(driverId, type) => saveComponents(fitNew(components, driverId, type))}
        onUndoComponent={(driverId, type) => saveComponents(undoFit(components, driverId, type))}
        raceFormat={effectiveFormat}
        sprintAvailable={sprintAvailable}
        onSelectFormat={setRaceFormat}
        weatherScenarioId={weatherScenarioId}
        onSelectWeather={setWeatherScenarioId}
        setup={{ setups, onChange: handleSetupChange }}
        saveGames={saveStore ? {
          slots, currentName: saveName, message: saveMessage,
          onSave: handleSaveGame, onLoad: handleLoadGame, onExport: handleExportGame, onImport: handleImportGame, onDelete: handleDeleteGame,
        } : undefined}
      />
      {/* [R51] Cierre de temporada: se ve antes de empezar la siguiente (el resumen ya está archivado). */}
      {seasonEnd && (
        <div className={qualifyingStyles.overlay} style={{ position: 'fixed' }}>
          <SeasonEndScreen summary={seasonEnd} onContinue={() => setSeasonEnd(null)} />
        </div>
      )}
      </>
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
            onClick={handleLeaveRace}
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
            onSaveGame={saveStore ? handleSaveGame : undefined}
            saveName={saveName}
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
                <QualifyingResults result={qualifying} gridChanges={gridChanges} pitLaneStarts={parcFermeStarts} onContinue={handleContinueFromQualifying}>
                  {qualifyingSetups && (
                    <details open={parcFermeStarts.length > 0 || undefined}>
                      <summary className={qualifyingStyles.extraTitle}>Setup en parc fermé</summary>
                      <SetupPanel drivers={Object.keys(qualifyingSetups).map(id => DRIVERS[id]).filter(Boolean)} setups={setups} parcFerme={qualifyingSetups} onChange={handleSetupChange} />
                    </details>
                  )}
                </QualifyingResults>
              </div>
            )}

            {penaltyNotice.length > 0 && !qualifying && (
              <div className={qualifyingStyles.overlay}>
                <GridPenaltyNotice lines={penaltyNotice} onContinue={handleContinueFromPenalties} />
              </div>
            )}

            {isFinished && podiumCars.length >= 3 && (
              <PodiumModal
                podiumCars={podiumCars}
                result={simulation.getRaceResult()}
                onConfirmResult={() => { simulation.confirmResult(); setPodiumCars([...simulation.podiumCars]); }}
                homeLabel={podiumHomeLabel(simulation.raceFormat, raceCounts)}
                progress={!raceCounts || simulation.raceFormat === 'sprint' ? [] : (() => {
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
          {/* [R24] Lectura del muro del coche en detalle. */}
          <WallPanel reading={detailCar ? simulation.getWallReading(detailCar.id) : null} />
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
              rainForecast={simulation.getRainForecast()}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;
