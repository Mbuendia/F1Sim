import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import styles from './App.module.css';
import { RaceTabs, raceLayout } from './components/RaceTabs';
import { StintTimeline } from './components/StintTimeline';
import { QualifyingLive } from './components/QualifyingLive';
import { PracticePanel } from './components/PracticePanel';
import { SpyPanel } from './components/SpyPanel';
import { AUDIO_LEVELS, AUDIO_LEVEL_LABEL, AUDIO_STORAGE_KEY, AudioEngine, parseAudioLevel } from './audio/AudioEngine';
import { soundCredits, soundsBetween } from './audio/sounds';
import type { AudioSnapshot } from './audio/sounds';
import { connectRadioAudio } from './radio/voice/runtime';
import { engineerPoint, hireStaff, staffEffects } from './simulation/Staff';
import { canSpy, runSpy, settleSpy } from './simulation/Spy';
import type { SpyLevel } from './simulation/Spy';
import { allSetups, practiceTyres, runPractice } from './simulation/Practice';
import type { PracticeProgram } from './simulation/Practice';
import { advanceAutoRace, startAutoRace } from './simulation/AutoRace';

/** Paso fijo del motor en una carrera que se ve (s). */
const RACE_STEP_SEC = 0.02;
/** [V8] Milisegundos seguidos que el motor corre una carrera simulada antes de dejar respirar a la página. */
const AUTO_RACE_CHUNK_MS = 40;
const AUTO_RACE_HIDDEN_CHUNK_MS = 800;
import type { RaceTab } from './components/RaceTabs';
import { RaceSimulation } from './simulation/RaceSimulation';
// [N3] La carrera corre detrás de un enlace (Worker) y la pantalla lee sus vistas de los almacenes.
import { raceStore, useRace } from './state/raceStore';
import { roomStore } from './state/roomStore';
import { linkStore } from './state/linkStore';
import { RaceSession, rosterOf as raceRosterOf } from './engine/RaceSession';
import { LocalLink, WorkerLink } from './engine/LocalLink';
import { carViews } from './engine/raceCars';
import type { EngineOrder } from './engine/EngineHost';
import type { RaceConfig } from './engine/engineCore';
import type { FastView } from './engine/RaceView';
import type { RainForecast } from './simulation/WeatherForecast';
import type { WallProposal } from './simulation/Wall';
import { Camera } from './renderer/Camera';
import { RaceCanvas } from './components/RaceCanvas';
import { SpeedControls } from './components/SpeedControls';
import { StartLights } from './components/StartLights';
import { RaceHeader } from './components/RaceHeader';
import { Leaderboard } from './components/Leaderboard';
import { BottomTelemetryDock } from './components/BottomTelemetryDock';
// [UX1] Ajustes fuera del paquete principal.
const SettingsScreen = lazy(() => import('./components/SettingsScreen'));
import { BoxControls } from './components/BoxControls';
import { RightStatsPanel } from './components/RightStatsPanel';
import { PodiumModal } from './components/PodiumModal';
import { HomeScreen } from './components/HomeScreen';
import { LandingPage } from './components/LandingPage';
import { GameMenuScreen } from './components/GameMenuScreen';
import { RoomFlow } from './components/RoomFlow';
import type { HostStart } from './components/RoomFlow';
import { PauseRequestBanner, SharedRaceEnd } from './components/ClientRace';
import { publishQualifying, SharedRaceHost } from './net/SharedRace';
import { returnToLobby } from './net/Lobby';
import type { PauseRequest } from './net/SharedRace';
import { leaveRoom } from './net/RoomService';
import { codeFromLink } from './net/roomCode';
import { SavesScreen } from './components/SavesScreen';
import { NewCareerScreen } from './components/NewCareerScreen';
import { GameMenu } from './components/GameMenu';
import { HubHome } from './components/HubHome';
import { RoundReportScreen } from './components/RoundReportScreen';
import { ROUND_REPORT_KEY, buildRoundReport, parseRoundReport } from './simulation/RoundReport';
import { WinterScreen } from './components/WinterScreen';
import { WINTER_KEY, parseWinter } from './simulation/Winter';
import type { WinterReport } from './simulation/Winter';
import { ageAttributes } from './simulation/Aging';
import type { RoundReport } from './simulation/RoundReport';
import { ATTRIBUTE_LABEL } from './simulation/DriverDevelopment';
import type { AttributeKey } from './simulation/DriverDevelopment';
import { RaceWeekendPanel } from './components/RaceWeekendPanel';
import { RaceFormatSelect } from './components/RaceFormatSelect';
import managementStyles from './components/Management.module.css';
import { pendingDecisions, weekendSessions } from './simulation/Hub';
import type { HubSection } from './simulation/Hub';
import { DEFAULT_ACCENT, teamAccent } from './data/teamAccents';
import { CAREER_NAME_KEY, DEFAULT_CAREER_NAME, careerDriver, hasStoredCareer, newCareer } from './simulation/Career';
import RaceFlagsHUD from './components/RaceFlagsHUD';
import { DnfNotificationModal } from './components/DnfNotificationModal';
import { D20LuckModal } from './components/D20LuckModal';
import { RaceMenu } from './components/RaceMenu';
import { RaceNotices, RaceNotice, RaceNoticeTone } from './components/RaceNotices';
import { OFFICIAL_CIRCUITS } from './data/circuits';
import { buildWeatherScenario } from './data/weatherScenarios';
import { runQualifying } from './simulation/Qualifying';
import { activeProjects, emptyProgram, installFirst, parseProgram, upgradesFor, PROGRAM_STORAGE_KEY } from './simulation/Development';
import type { DevelopmentProgram } from './simulation/Development';
import { calendarView, emptySeason, grandsPrixRun, isSeasonRace, nextRound, parseArchive, parseSeason, roundWeather, settleRace, settleSkip, sprintPending, withWeatherSeed, practiceFor, withPractice, SEASONS_STORAGE_KEY, SEASON_RACES, SEASON_STATE_KEY } from './simulation/Season';
import { COMPOUND_LABEL } from './simulation/TireInventory';
import { carryTyres, isSprintVenue, podiumHomeLabel, sprintWeekendTyres } from './simulation/Weekend';
import type { SeasonState, SeasonSummary, SettledCareer } from './simulation/Season';
import { SeasonEndScreen } from './components/SeasonEndScreen';
import { GridPenaltyNotice } from './components/GridPenaltyNotice';
import { addRace, constructorsChampionship } from './simulation/Championship';
import { addDistance, refitUsed, applyGridPenalties, emptyComponents, ensureDriver, gridPenaltyLines, hazardFactor, markRaceStart, parseComponents, raceStartGate, COMPONENTS_STORAGE_KEY } from './simulation/ComponentPool';
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
import { AUTOSAVE_ID, AUTOSAVE_LABEL, SaveStore, createSave, exportSave, importSave, savedManagement, savedRaceCounts, savedSeason, summarize } from './simulation/SaveGame';
import { MANAGEMENT_STORAGE_KEY, parseManagement, startManagement } from './simulation/Management';
import type { ManagementState } from './simulation/Management';
import { aiDevelopPaying, aiReplaceComponents, buyComponent, buyProject, componentCost, projectCost, projectLeadTime, projectShortfall, raceDamages, refundComponent } from './simulation/Costs';
import { aiInvestFacilities, benchHazard, gainOf, levelOf, maxProjects, simulatorBonus, startWork } from './simulation/Facilities';
import { balanceOf, canSpend, formatMoney, roundForecast } from './simulation/Finance';
import { aiCrewPlans, crewEffect, setCrewPlan } from './simulation/PitCrew';
import { aiSignSponsors, carSponsors, signSponsor } from './simulation/Sponsors';
import type { SaveGame, SlotSummary } from './simulation/SaveGame';
import type { SaveGameMessage } from './components/SaveGamePanel';
import { SetupPanel } from './components/SetupPanel';
import { NEUTRAL_SETUP, normalizeSetup, parcFermeCheck, pitLaneReason, withPitLaneStarts } from './simulation/Setup';
import type { CarSetup } from './simulation/Setup';
import { DRIVERS } from './data/drivers';
import { lineupOf, offerContract, pairOf, rosterOf } from './simulation/Contracts';
import { agreePromotion, setStandIn, signReserve, standInDrivers } from './simulation/Academy';
import type { Driver } from './types/f1';
import { TEAMS } from './data/teams';
import { RaceResultHistory, StartLightState, CarState, RaceFlagState, SafetyCarState, DnfNotification, D20LuckEvent, TrackWeatherState, RejoinEstimate } from './types/f1';
import { RotateCw, ArrowLeft, Camera as CameraIcon, Maximize2, ListOrdered, PanelRight, ZoomIn, ZoomOut } from 'lucide-react';
import { WallPanel } from './components/WallPanel';
import { nextAlerts, wallAlerts } from './simulation/Wall';
import type { WallReading } from './simulation/Wall';
import { CAMERA_LABELS as CAMERA_LABELS_3D } from './scene3d/cameras';

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
/** [N3] Cada cuánto se pone al día la copia de la carrera en la pestaña con la del motor (ms reales). */
const MIRROR_SYNC_MS = 5000;
const SAVE_NAME_KEY = 'f1_save_name';
/** [T4.19] En la carrera libre el paddock no enseña nada de la partida: solo piloto, circuito, formato y tiempo. */
const FREE_RACE_PADDOCK: Partial<React.ComponentProps<typeof HomeScreen>> = {
  season: undefined, finance: undefined, facilities: undefined, sponsors: undefined, board: undefined, pitCrew: undefined, development: undefined,
  components: undefined, setup: undefined, saveGames: undefined, championship: undefined, raceHistory: [],
};
const SETUPS_KEY = 'f1_setups';
const newRaceSeed = () => (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
const TYRE_WORDS: Record<string, string> = { soft: 'blandos', medium: 'medios', hard: 'duros', intermediate: 'intermedios', wet: 'de lluvia' };
/** [R54] Pilotos que lleva el jugador: los dos del equipo del piloto elegido. */
/** [T4.7] Los dos pilotos del equipo de ese piloto, según la plantilla de la temporada. */
const playerDriverIds = (roster: Record<string, Driver>, driverId: string): string[] => {
  const teamId = (roster[driverId] ?? Object.values(roster)[0]).teamId;
  return Object.keys(roster).filter(id => roster[id].teamId === teamId);
};

// Vista 3D (22/10/2026): sus modos van en el mismo botón (las claves no coinciden con las de la vista 2D).
const CAMERA_LABELS: Record<string, string> = {
  ...CAMERA_LABELS_3D,
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
  // [T4.12] Con agua en la salida, cada coche elige su neumático (los del jugador reciben la propuesta en la parrilla).
  const simulation = useMemo(() => { const sim = new RaceSimulation(selectedCircuitId); sim.setFixedStep(RACE_STEP_SEC); sim.autoStartTyres = true; sim.seededPreparation = true; sim.autoTeamOrders = true; return sim; }, []);
  const camera = useMemo(() => new Camera(), []);

  // Vista actual: 'landing', 'home' o 'race'
  // [T4.19] Tras la portada va el menú de partidas; de él salen la carrera profesional y la carrera libre.
  // [N7] Un enlace de invitación (?sala=CÓDIGO) abre directamente la pantalla de unirse a esa sala.
  const [linkedRoom, setLinkedRoom] = useState<string | null>(() => (typeof location === 'undefined' ? null : codeFromLink(location.href)));
  const [currentView, setCurrentView] = useState<'landing' | 'menu' | 'settings' | 'saves' | 'new' | 'home' | 'race' | 'report' | 'room'>(() => (linkedRoom ? 'room' : 'landing'));
  const [roomIntent, setRoomIntent] = useState<'create' | 'join'>('join');
  // [N8] Carrera compartida del anfitrión: la sala y su transporte (desde «Empezar» hasta salir de la carrera).
  const sharedRef = useRef<HostStart | null>(null);
  const sharedHostRef = useRef<SharedRaceHost | null>(null);
  const [sharedPending, setSharedPending] = useState<HostStart | null>(null);
  const [pauseRequests, setPauseRequests] = useState<PauseRequest[]>([]);
  /** [N9] «Otra carrera»: la sala abierta a la que vuelve el anfitrión. */
  const [resumeRoom, setResumeRoom] = useState<HostStart | null>(null);
  // [T4.20] Informe de la última ronda: se guarda hasta que se pulsa «Continuar», así que al reabrir se ve de nuevo.
  const [roundReport, setRoundReport] = useState<RoundReport | null>(() => { try { return parseRoundReport(localStorage.getItem(ROUND_REPORT_KEY)); } catch { return null; } });
  const showRoundReport = useCallback((report: RoundReport | null) => {
    setRoundReport(report);
    try { if (report) localStorage.setItem(ROUND_REPORT_KEY, JSON.stringify(report)); else localStorage.removeItem(ROUND_REPORT_KEY); } catch (e) { console.error(e); }
  }, []);
  // [T4.11] Informe del invierno: se guarda hasta que se confirma, así que al reabrir el juego se vuelve a ver.
  const [winter, setWinter] = useState<WinterReport | null>(() => { try { return parseWinter(localStorage.getItem(WINTER_KEY)); } catch { return null; } });
  const showWinter = useCallback((report: WinterReport | null) => {
    setWinter(report);
    try { if (report) localStorage.setItem(WINTER_KEY, JSON.stringify(report)); else localStorage.removeItem(WINTER_KEY); } catch (e) { console.error(e); }
  }, []);
  /** Carrera profesional o carrera libre (que no toca ninguna partida). */
  const [mode, setMode] = useState<'career' | 'free'>('career');
  /** Hay una partida en curso en el navegador (también una anterior al menú de partidas). */
  const [careerActive, setCareerActive] = useState(() => { try { return hasStoredCareer(localStorage); } catch { return false; } });

  // [T4.14] Para avisar desde el bucle que lee el motor, definido antes que los avisos.
  const noticeRef = useRef<(tone: 'info' | 'warning' | 'danger', tag: string, text: string) => void>(() => {});
  // Coche seleccionado expresamente en pista
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);

  // Paneles: posiciones visibles; el detalle del coche se abre bajo demanda.
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  // [V2] En móvil la pista ocupa la pantalla y posiciones, muro y detalle van en pestañas inferiores.
  const [raceTab, setRaceTab] = useState<RaceTab>('pista');

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

  // [T4.1] Gestión del equipo (dinero), guardada en el navegador con la carrera profesional.
  const [management, setManagement] = useState<ManagementState>(() => {
    const teamId = (DRIVERS[selectedDriverId] ?? DRIVERS.alonso).teamId;
    try {
      return parseManagement(localStorage.getItem(MANAGEMENT_STORAGE_KEY), teamId, parseArchive(localStorage.getItem(SEASONS_STORAGE_KEY)).length + 1, newRaceSeed());
    } catch { return startManagement(teamId, 1, newRaceSeed()); }
  });
  const saveManagement = useCallback((next: ManagementState) => {
    setManagement(next);
    try { localStorage.setItem(MANAGEMENT_STORAGE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);
  // [T4.7] Plantilla de la temporada: cada piloto con el equipo de su contrato. La carrera libre usa la de partida.
  // [T4.8] Si un reserva sustituye a un titular en la próxima ronda, ese asiento lleva su nombre, su código y su nivel.
  const roster = useMemo(() => (mode === 'career' ? { ...rosterOf(management.contracts), ...standInDrivers(management.academy) } : DRIVERS), [mode, management.contracts, management.academy]);
  const [contractMessage, setContractMessage] = useState<string | null>(null);
  const [reserveMessage, setReserveMessage] = useState<string | null>(null);
  // [T4.19] En la carrera profesional el jugador lleva a los pilotos de su equipo: el piloto seguido es uno de ellos.
  useEffect(() => {
    if (mode === 'career') setSelectedDriverId(driverId => careerDriver(management.playerTeamId, driverId, pairOf(management.contracts, management.playerTeamId)));
  }, [mode, management.playerTeamId, management.contracts]);
  // [T4.3] El acento del equipo vale en toda la aplicación (también en carrera); en la carrera libre, el neutro.
  useEffect(() => {
    document.documentElement.style.setProperty('--equipo', mode === 'career' ? teamAccent(management.playerTeamId) : DEFAULT_ACCENT);
  }, [mode, management.playerTeamId]);
  // [R45] Atributos y enfoque de los pilotos, guardados en el navegador
  const [development, setDevelopment] = useState<DevelopmentState>(() => {
    try { return parseDevelopment(localStorage.getItem(DEVELOPMENT_STORAGE_KEY)); } catch { return emptyDevelopment(); }
  });
  const saveDevelopment = useCallback((next: DevelopmentState) => {
    setDevelopment(next);
    try { localStorage.setItem(DEVELOPMENT_STORAGE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);
  /** Mejora que dará la carrera terminada con el resultado actual (se guarda al volver al inicio). */
  const developmentAfter = useCallback((result: RaceResult) => developAfterRace(development, Object.values(mode === 'career' ? rosterOf(management.contracts) : DRIVERS).filter(driver => roster[driver.id]?.code === driver.code), driver => {
    const row = result.rows.find(r => r.driverCode === driver.code);
    return row ? { position: row.position, status: row.status, points: row.points } : undefined;
  }, simulation.totalLaps,
  // [T4.4] El simulador de cada equipo puede dar a sus pilotos un punto de mejora extra.
  // [T4.5] Y su ingeniero de carrera, otro (si es mejor que el de la casa).
  driver => simulatorBonus(gainOf(management.facilities, driver.teamId, 'simulador'), simulation.totalLaps + development.races, driver.id)
    + engineerPoint(staffEffects(management.staff, driver.teamId).engineerBonus[Math.max(0, pairOf(management.contracts, driver.teamId).indexOf(driver.id)) % 2], simulation.totalLaps + development.races, driver.id)),
  [development, simulation, management, roster, mode]);

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
  // [T4.8] Un piloto nuevo en la parrilla estrena los componentes de su coche.
  useEffect(() => {
    const next = Object.keys(roster).reduce((s, id) => ensureDriver(s, id), components);
    if (next !== components) saveComponents(next);
  }, [roster, components, saveComponents]);
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
  // [T4.7] El motor forma la parrilla con la alineación de la temporada (nunca con una carrera a medias).
  useEffect(() => {
    if (raceLive || currentView === 'race') return;
    if (mode === 'career') simulation.setLineup(lineupOf(management.contracts), management.contracts.extra ?? {}, standInDrivers(management.academy));
    else simulation.setLineup({});
  }, [simulation, raceLive, currentView, mode, management.contracts, management.academy]);
  // [T4.19] «Guardado hace X»: la partida se guarda sola con cada cambio; aquí queda cuándo fue el último.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    setSavedAt(Date.now()); setClock(Date.now());
  }, [championship, development, components, program, season, management]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
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
  // [T4.13] Programa de cada piloto en los entrenamientos libres (por defecto, buscar el setup).
  const [practicePrograms, setPracticePrograms] = useState<Record<string, PracticeProgram>>({});
  const playerSetups = useMemo(() => {
    return Object.fromEntries(playerDriverIds(roster, selectedDriverId).map(id => [id, normalizeSetup(setups[id])]));
  }, [setups, selectedDriverId, roster]);

  // [R20] Formato del Gran Premio y resultado de la clasificación pendiente de mostrar
  // [R52] En una ronda sprint con el sprint por correr, el paddock propone el fin de semana sprint.
  const [raceFormat, setRaceFormat] = useState<RaceFormatId>(() => {
    try {
      return sprintPending(parseChampionship(localStorage.getItem(CHAMPIONSHIP_STORAGE_KEY)), parseSeason(localStorage.getItem(SEASON_STATE_KEY))) ? 'sprint' : 'directo';
    } catch { return 'directo'; }
  });
  const [qualifying, setQualifying] = useState<QualifyingResult | null>(null);
  /** [N9] En una carrera compartida, la salida a pista se anuncia al acabar la clasificación (el motor arranca antes). */
  const qualifyingRef = useRef(qualifying);
  qualifyingRef.current = qualifying;
  // [V7] La clasificación recién corrida se ve primero en directo; después (o al saltarla), la tabla de siempre.
  const [qualifyingLive, setQualifyingLive] = useState(false);

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

  const [fastestLapDriver, setFastestLapDriver] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [podiumCars, setPodiumCars] = useState<CarState[]>([]);
  
  const [bestS1, setBestS1] = useState<number | null>(null);
  const [bestS2, setBestS2] = useState<number | null>(null);
  const [bestS3, setBestS3] = useState<number | null>(null);

  // [T4.16] Audio: apagado por defecto; el nivel elegido se guarda en el navegador. Sin una interacción previa no suena
  // nada, se calla con la página oculta o la carrera en pausa y se libera al salir de la carrera.
  const audio = useMemo(() => new AudioEngine(undefined, undefined, import.meta.env.BASE_URL), []);
  const [audioLevel, setAudioLevel] = useState(() => { try { return parseAudioLevel(localStorage.getItem(AUDIO_STORAGE_KEY)); } catch { return 0; } });
  const audioSeen = useRef<AudioSnapshot | null>(null);
  // [IA2] La voz de los pilotos sigue el nivel de sonido y calla cuando calla el audio (pausa, página oculta, fuera de carrera).
  const radioLevel = useRef(0);
  const radioQuiet = useRef(true);
  useEffect(() => connectRadioAudio(id => { audio.play(id); }, () => (radioQuiet.current ? 0 : radioLevel.current)), [audio]);
  useEffect(() => {
    audio.setVolume(AUDIO_LEVELS[audioLevel]);
    radioLevel.current = AUDIO_LEVELS[audioLevel];
    try { localStorage.setItem(AUDIO_STORAGE_KEY, String(audioLevel)); } catch { /* sin almacenamiento */ }
  }, [audio, audioLevel]);
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); audio.dispose(); };
  }, [audio]);

  // Race flags & Safety Car & DNF & Luck D20 state
  const [raceFlagState, setRaceFlagState] = useState<RaceFlagState>('green');
  const [sectorFlags, setSectorFlags] = useState<[RaceFlagState, RaceFlagState, RaceFlagState]>(['green', 'green', 'green']);
  const [safetyCar, setSafetyCar] = useState<SafetyCarState | null>(null);
  const [activeDnf, setActiveDnf] = useState<DnfNotification | null>(null);
  const [activeLuckEvent, setActiveLuckEvent] = useState<D20LuckEvent | null>(null);
  const [weather, setWeather] = useState<TrackWeatherState>(simulation.weather);

  // ── [N3] El motor corre en un Worker (o, sin Worker, en la propia pestaña) y la pantalla de carrera lee sus vistas
  // del almacén. `simulation` queda como copia en la pestaña: con ella se prepara la carrera (su snapshot arranca el
  // motor) y se cierra la ronda; se pone al día con el motor cada pocos segundos, al guardar y al terminar.
  const sessionRef = useRef<RaceSession | null>(null);
  const [engineEpoch, setEngineEpoch] = useState(0);
  /** Vuelve a arrancar el motor desde la copia de la pestaña (antes de la salida, tras cambiar algo en ella). */
  const restartEngine = useCallback(() => setEngineEpoch(n => n + 1), []);
  const raceConfig = useCallback((): RaceConfig => ({
    fixedStepSec: RACE_STEP_SEC, autoStartTyres: simulation.autoStartTyres, seededPreparation: simulation.seededPreparation,
    autoTeamOrders: simulation.autoTeamOrders, luckVariantEnabled: simulation.luckVariantEnabled,
    upgradeTradeoffs: { ...(simulation as unknown as { upgradeTradeoffs: Record<string, number> }).upgradeTradeoffs },
  }), [simulation]);
  /** Manda una orden al motor de la carrera en curso; se resuelve con su acuse. */
  const sendOrder = useCallback((order: EngineOrder) => sessionRef.current?.order(order) ?? Promise.resolve({ ok: false, reason: 'Sin carrera en marcha' }), []);
  /** Pone la copia de la pestaña al día con el motor (para guardar o cerrar la ronda). */
  const syncFromEngine = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    const snapshot = await session.save();
    if (snapshot && sessionRef.current === session) restoreSnapshot(simulation, snapshot);
  }, [simulation]);
  const syncFromEngineRef = useRef(syncFromEngine);
  useEffect(() => { syncFromEngineRef.current = syncFromEngine; }, [syncFromEngine]);

  // Lo que llega del motor: la vista lenta y las de los equipos al momento; la rápida, como mucho 10 veces por segundo
  // (la pista la lee aparte, a su ritmo).
  const slowView = useRace(state => state.slow);
  const teamViews = useRace(state => state.teams);
  const raceRoster = useRace(state => state.roster);
  const [fastSample, setFastSample] = useState<FastView | null>(null);
  useEffect(() => {
    let last = 0;
    return raceStore.subscribe(state => {
      const now = performance.now();
      if (state.fast && state.fast !== fastSample && now - last >= 100) { last = now; setFastSample(state.fast); }
    });
  }, []);
  const viewCars = useMemo(() => carViews({ roster: raceRoster, fast: fastSample, slow: slowView, teams: teamViews }), [raceRoster, fastSample, slowView, teamViews]);
  // Hasta que llega la primera vista se enseña la copia de la pestaña (la parrilla preparada).
  const cars = viewCars.length && slowView ? viewCars : simulation.cars;
  const ownView = useCallback((carId: number) => Object.values(teamViews).flatMap(team => team.cars).find(car => car.id === carId), [teamViews]);
  const dismissedDnf = useRef<string | null>(null);
  const dismissedLuck = useRef<string | null>(null);
  const podiumIdsRef = useRef('');

  useEffect(() => {
    const slow = slowView;
    if (!slow) return;
    setLightState(slow.light as StartLightState);
    setSpeedMultiplier(slow.speed);
    setIsPaused(slow.paused);
    setLeaderLap(slow.lap);
    setRaceTimeSec(slow.t);
    setIsFinished(slow.finished);
    // [N10] Tolerante a fotos incompletas (por el respaldo llegaban sin los campos vacíos y esto tiraba la aplicación).
    setBestS1(slow.bestSectors?.[0] ?? null);
    setBestS2(slow.bestSectors?.[1] ?? null);
    setBestS3(slow.bestSectors?.[2] ?? null);
    setCameraMode(camera.view3d ? camera.mode3d : camera.currentMode);
    setRaceFlagState(slow.flag as RaceFlagState);
    if (Array.isArray(slow.sectorFlags)) setSectorFlags(slow.sectorFlags as [RaceFlagState, RaceFlagState, RaceFlagState]);
    setSafetyCar(slow.safetyCar?.isDeployed ? {
      isDeployed: true, mode: slow.safetyCar.mode as SafetyCarState['mode'], phase: (slow.safetyCar.phase ?? undefined) as SafetyCarState['phase'],
      lapCount: slow.safetyCar.lapCount, targetLaps: slow.safetyCar.targetLaps, triggerReason: slow.safetyCar.reason,
      progress: 0, trackT: 0, currentSpeedKmh: 0, deployedAtRaceTime: 0,
    } : null);
    setActiveDnf(slow.dnf && slow.dnf.id !== dismissedDnf.current ? slow.dnf : null);
    const luck = slow.luck as D20LuckEvent | null;
    setActiveLuckEvent(luck && luck.id !== dismissedLuck.current ? luck : null);
    // [T4.14] Órdenes de equipo cumplidas (las propias y las de los rivales): cada una, un aviso.
    for (const text of raceStore.getState().takeNotices()) noticeRef.current('info', 'Órdenes', text);
    if (slow.weatherState) setWeather(slow.weatherState as TrackWeatherState);
    // [T4.16] Lo que ha cambiado desde la lectura anterior, en sonidos (solo los coches del jugador dan radio y pistola).
    const mine = Object.values(raceStore.getState().teams).flatMap(team => team.cars);
    const heard: AudioSnapshot = {
      lightState: slow.light as StartLightState, flag: slow.flag as RaceFlagState, finished: slow.finished,
      wallMessages: mine.reduce((sum, car) => sum + (car.proposals?.length ?? 0), 0),
      servicing: mine.filter(car => car.pit.isPitting && car.pit.currentStopTimer > 0 && car.pit.currentStopTimer < car.pit.stopDuration).length,
    };
    for (const sound of soundsBetween(audioSeen.current, heard)) audio.play(sound);
    audioSeen.current = heard;
    // El podio solo se repone si cambia (repintarlo cada segundo reiniciaría su animación).
    const podiumIds = slow.podiumIds ?? [];
    if (slow.finished && podiumIds.join(',') !== podiumIdsRef.current) {
      podiumIdsRef.current = podiumIds.join(',');
      const state = raceStore.getState();
      const built = carViews({ roster: state.roster, fast: state.fast, slow, teams: state.teams });
      setPodiumCars(podiumIds.map(id => built.find(car => car.id === id)).filter((car): car is CarState => Boolean(car)));
    }
    if (slow.fastestLap) setFastestLapDriver(slow.fastestLap.driverName);
  }, [slowView, camera, audio]);

  const handleSelectCar = useCallback((carId: number | null) => {
    setSelectedCarId(carId);
    if (carId !== null) {
      camera.followCar(carId);
      setDetailOpen(true);
      setRaceTab(tab => (tab === 'tiempos' ? 'detalle' : tab));
    } else {
      camera.resetToFullTrack();
      setDetailOpen(false);
    }
  }, [camera]);

  // R32: herramientas de prueba (menú de carrera). Conservan su efecto anterior.
  const handleSafetyCarTest = useCallback(() => {
    // [Q14] Sale de su garaje en el pit lane, como en carrera; si ya está fuera, se retira por el pit lane.
    void sendOrder({ kind: 'devSafetyCar' });
  }, [sendOrder]);

  const handleRedFlagTest = useCallback(() => {
    // Escoger coche al azar
    const runningCars = (raceStore.getState().slow?.cars ?? []).filter(c => c.status === 'running');
    if (runningCars.length === 0) return;
    const randomCar = runningCars[Math.floor(Math.random() * runningCars.length)];
    const failureTypes = ['💥 ACCIDENTE GRAVE', '🔥 INCENDIO MOTOR', '💥 CHOQUE MÚLTIPLE'];
    // [R26] Bandera roja por el procedimiento real de R12 (sin marcar paradas a mano). [N3] Lo hace el motor.
    void sendOrder({ kind: 'devRedFlag', crashCarId: randomCar.id, reason: failureTypes[Math.floor(Math.random() * failureTypes.length)] });
  }, [sendOrder]);

  const handleSpeedChange = useCallback((speed: number) => {
    // [N3] La velocidad la cambia el motor; el botón responde al momento y la vista lenta lo confirma.
    void sendOrder(speed === 0 ? { kind: 'pause', paused: true } : { kind: 'speed', value: speed });
    if (speed === 0) setIsPaused(true);
    else { setSpeedMultiplier(speed); setIsPaused(false); }
  }, [sendOrder]);

  // [Q18] Callbacks estables del modal D20; aplicar es idempotente en el motor por ID de evento.
  const handleApplyLuckReward = useCallback((eventId: string) => {
    void sendOrder({ kind: 'luckReward', eventId });
  }, [sendOrder]);
  // [R26] Variante D20: preferencia guardada en el navegador.
  const [luckVariantEnabled, setLuckVariantEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('f1_d20_variant') !== 'off'; } catch { return true; }
  });
  useEffect(() => {
    simulation.luckVariantEnabled = luckVariantEnabled;
    void sendOrder({ kind: 'luckVariant', enabled: luckVariantEnabled });
  }, [simulation, luckVariantEnabled, sendOrder]);
  const handleToggleLuckVariant = useCallback(() => {
    setLuckVariantEnabled(value => {
      try { localStorage.setItem('f1_d20_variant', value ? 'off' : 'on'); } catch (e) { console.error(e); }
      return !value;
    });
  }, []);

  const handleDismissLuckEvent = useCallback(() => {
    dismissedLuck.current = activeLuckEventRef.current?.id ?? null;
    void sendOrder({ kind: 'luckClear' });
    setActiveLuckEvent(null);
  }, [sendOrder]);

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
    // [N3] Carrera nueva: el motor arranca otra vez desde la copia preparada.
    restartEngine();
  }, [simulation, camera, restartEngine]);

  // [R52] El sprint solo se ofrece donde lo hay: en una carrera libre de un circuito sprint o en la ronda sprint de la
  // temporada mientras su sprint no se haya corrido.
  const sprintAvailable = isSprintVenue(selectedCircuitId) && (mode === 'free' || !isSeasonRace(selectedCircuitId, championship, season) || sprintPending(championship, season));
  const effectiveFormat: RaceFormatId = raceFormat === 'sprint' && !sprintAvailable ? 'clasificacion' : raceFormat;

  const handleStartRaceFromHome = useCallback(() => {
    // [R48] Cada carrera lleva su semilla (se guarda con ella): cargarla da siempre la misma continuación.
    simulation.setSeed(newRaceSeed());
    // [T4.19] Una carrera libre no es de ninguna partida: ni se autoguarda ni borra el autoguardado.
    setRaceLive(mode === 'career');
    setSaveMessage(null);
    autosaveWarned.current = false;
    if (saveStore && mode === 'career') { saveStore.remove(AUTOSAVE_ID); setSlots(saveStore.list()); }
    simulation.setDriverAttributes(development.attributes);
    // [R49] Setup del jugador antes de clasificar; nadie sale desde el pit lane hasta que lo decida el parc fermé.
    const practice = mode === 'career' && isSeasonRace(selectedCircuitId, championship, season) ? practiceFor(season, nextRound(championship, season)?.round) : null;
    simulation.setCarSetups({ ...practice?.rivalSetups, ...playerSetups });
    simulation.setPitLaneStarters([]);
    // [R52] Fin de semana sprint: primero la clasificación sprint y el sprint (100 km, sin paradas obligatorias);
    // el Gran Premio de esa ronda se corre después con los neumáticos que queden.
    const format = effectiveFormat, sprintRace = format === 'sprint';
    const seasonRace = mode === 'career' && isSeasonRace(selectedCircuitId, championship, season);
    simulation.setRaceFormat(sprintRace ? 'sprint' : 'gp');
    const weekendNow = season.weekend;
    // [T4.13] Tras los libres, cada piloto llega con los juegos que gastó ya usados.
    simulation.setWeekendTyres(!sprintRace && seasonRace && weekendNow && weekendNow.round === nextRound(championship, season)?.round ? weekendNow.tyres
      : practice && !sprintRace ? practiceTyres(selectedCircuitId, practice.tyreUse) : null);
    setQualifyingSetups(format !== 'directo' ? playerSetups : null);
    simulation.setStartingGrid(null);
    simulation.setCircuit(selectedCircuitId);
    // [R20] Con clasificación, la parrilla sale de Q1-Q3 y se enseña antes de formar; el GP directo usa la prefijada.
    const quali = format !== 'directo' ? runQualifying(simulation.qualifyingEntrants(), Date.now() % 2147483647, { format: sprintRace ? 'sprint' : 'gp' }) : null;
    if (sprintRace && quali) simulation.setWeekendTyres(sprintWeekendTyres(selectedCircuitId, practice
      ? Object.fromEntries(Object.entries(quali.tyreUse).map(([id, used]) => [id, { ...used, medium: used.medium + (practice.tyreUse[id]?.medium ?? 0), soft: used.soft + (practice.tyreUse[id]?.soft ?? 0) }]))
      : quali.tyreUse));
    // [R19] Antes de salir: la IA sustituye lo agotado, las unidades sin estrenar cuentan como usadas y sus sanciones
    // recolocan la parrilla (la de la clasificación o la prefijada).
    // [R51] Solo cuenta para la temporada la carrera del circuito que toca; una carrera libre no gasta componentes,
    // no sanciona y no mueve el desarrollo.
    const counts = seasonRace;
    setRaceCounts(counts);
    // Componentes, sanciones y desarrollo son cosa del Gran Premio: el sprint no los mueve.
    const careerRace = counts && !sprintRace;
    const playerTeam = (roster[selectedDriverId] ?? Object.values(roster)[0]).teamId;
    // [T4.2] Los rivales pagan sus componentes y sus proyectos: sin dinero dejan de montar fuera de cupo y de desarrollar.
    const ledgerRound = nextRound(championship, season)?.round ?? SEASON_RACES;
    const rivals = Object.values(roster).filter(d => d.teamId !== playerTeam).map(d => ({ id: d.id, teamId: d.teamId }));
    const replaced = careerRace ? aiReplaceComponents(management, components, rivals, ledgerRound) : { management, components };
    const prepared = replaced.components;
    const started = careerRace ? markRaceStart(prepared) : { state: components, penalties: [] };
    if (careerRace) saveComponents(started.state);
    // [T4.4] El banco de fiabilidad de cada equipo reduce el riesgo de avería por desgaste de sus componentes.
    simulation.setFailureFactors(Object.fromEntries(Object.keys(roster).map(id => [id, benchHazard(hazardFactor(started.state, id), gainOf(management.facilities, roster[id].teamId, 'banco'))])));
    // [R18] La IA desarrolla y monta sus mejoras; cada coche corre con las suyas.
    const raceIndex = grandsPrixRun(championship);
    const aiTeams = [...new Set(Object.values(roster).map(d => d.teamId))].filter(t => t !== playerTeam);
    const paying = careerRace ? aiDevelopPaying(replaced.management, program, aiTeams, raceIndex, Object.fromEntries(aiTeams.map(t => [t, constructorsPosition(t)])), raceIndex + 1,
      teamId => Object.values(roster).find(d => d.teamId === teamId)?.id ?? teamId, ledgerRound) : { management: replaced.management, program };
    const developed = paying.program;
    // [T4.4] Y amplían sus instalaciones si les queda reserva. [T4.6] Sus equipos de boxes eligen el plan de la semana.
    const invested = careerRace ? aiInvestFacilities(paying.management, aiTeams, ledgerRound) : paying.management;
    // [T4.9] Y firman la mejor oferta de patrocinio si tienen un hueco.
    const managed = careerRace ? { ...invested, pitCrews: aiCrewPlans(invested.pitCrews, aiTeams), sponsors: aiSignSponsors(invested.sponsors, aiTeams) } : invested;
    if (careerRace) { saveProgram(developed); saveManagement(managed); }
    // [T4.6] En una carrera de temporada (Gran Premio o sprint) cada coche para con el equipo de boxes de su equipo; en
    // una libre, como siempre.
    simulation.setPitCrews(counts ? Object.fromEntries(Object.entries(managed.pitCrews.teams).map(([teamId, crew]) => [teamId, crewEffect(crew)])) : {});
    simulation.setUpgradeTradeoffs(counts ? Object.fromEntries([...new Set(Object.values(roster).map(d => d.teamId))].map(teamId => [teamId, staffEffects(managed.staff, teamId).tradeoffFactor])) : {});
    simulation.setTechnicalUpgrades(Object.fromEntries(Object.values(roster).map(d => [d.id, upgradesFor(developed, d.teamId, d.id, raceIndex)])));
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
    // [N9] Carrera compartida con clasificación: todos ven la misma, que calcula el anfitrión.
    const sharedNow = sharedRef.current;
    if (quali && sharedNow) void publishQualifying(sharedNow.db, sharedNow.code, { result: quali, roster: raceRosterOf(simulation), circuitId: simulation.circuitId, weather: sharedNow.weather }).catch(() => {});
    setQualifyingLive(Boolean(quali));
    // [R44] Meteorología ajustada a la duración prevista de la carrera. [T4.12] En una carrera de temporada se sortea
    // con la probabilidad de lluvia del circuito y la semilla de la temporada (la misma ronda da siempre el mismo
    // tiempo); en carrera libre es la elegida en el paddock.
    const weatherRound = seasonRace ? nextRound(championship, season) : null;
    const seededSeason = weatherRound ? withWeatherSeed(season, newRaceSeed()) : season;
    if (seededSeason !== season) saveSeason(seededSeason);
    const scenarioId = weatherRound ? roundWeather(seededSeason, weatherRound, sprintRace ? 'sprint' : 'gp') : weatherScenarioId;
    simulation.setWeatherScenario(buildWeatherScenario(scenarioId, simulation.totalLaps * 90));
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setDetailOpen(false);
    clearNotices();
    setIsFinished(false);
    setCurrentView('race');
    if (gate === 'directo') simulation.startRaceSequence();
    // [N3] El motor arranca con la carrera ya preparada.
    restartEngine();
  }, [restartEngine, simulation, camera, selectedCircuitId, weatherScenarioId, development, raceFormat, components, saveComponents, selectedDriverId, program, saveProgram, championship, constructorsPosition, saveStore, playerSetups, season, saveSeason, effectiveFormat, management, saveManagement, mode, roster]);

  /**
   * [T4.13] Entrenamientos libres de la ronda que toca: se resuelven sin pista con las vueltas de referencia del motor en
   * ese circuito. Suman kilómetros a los componentes de todos y dejan anotados los juegos gastados y el setup de los rivales.
   */
  const handleRunPractice = useCallback(() => {
    const round = nextRound(championship, season);
    if (mode !== 'career' || !round || practiceFor(season, round.round)) return;
    simulation.setCircuit(round.circuitId);
    const raceIndex = grandsPrixRun(championship);
    simulation.setTechnicalUpgrades(Object.fromEntries(Object.values(roster).map(d => [d.id, upgradesFor(program, d.teamId, d.id, raceIndex)])));
    const setups = allSetups();
    const mine = playerDriverIds(roster, selectedDriverId);
    const result = runPractice({
      round: round.round, seed: newRaceSeed(), sprintWeekend: isSprintVenue(round.circuitId), lapLengthMeters: simulation.activeTrack.lapLengthMeters,
      programs: Object.fromEntries(mine.map(id => [id, practicePrograms[id] ?? 'setup'])),
      drivers: simulation.cars.map(car => ({
        driverId: car.driver.id, code: car.driver.code, teamId: car.driver.teamId, simulatorLevel: levelOf(management.facilities, car.driver.teamId, 'simulador'),
        lapTable: simulation.setupLapTable(car.driver.id, setups), tyreWear: car.technical?.tyreWear ?? 1,
        strategyBonus: staffEffects(management.staff, car.driver.teamId).practiceMargin,
      })),
    });
    saveSeason(withPractice(season, result));
    saveComponents(addDistance(components, Object.values(result.km)[0] ?? 0));
  }, [championship, season, mode, simulation, roster, program, selectedDriverId, practicePrograms, management, saveSeason, saveComponents, components]);

  /** [V9] Encarga un informe de espionaje de un equipo rival para la ronda que toca (hacen falta los libres hechos). */
  const handleSpy = useCallback((teamId: string, level: SpyLevel) => {
    const round = nextRound(championship, season)?.round;
    const practice = practiceFor(season, round);
    if (!practice || round === undefined || !canSpy(practice.spy ?? [], round, teamId)) return;
    const report = runSpy({
      round, seed: practice.seed, teamId, level,
      setups: Object.fromEntries(Object.values(roster).filter(driver => driver.teamId === teamId).map(driver => [driver.id, practice.rivalSetups[driver.id] ?? NEUTRAL_SETUP])),
    });
    const settled = settleSpy(management, report, TEAMS[teamId]?.shortName ?? teamId);
    if (!settled.ok) return;
    saveManagement(settled.management);
    saveSeason(withPractice(season, { ...practice, spy: [...(practice.spy ?? []), report] }));
  }, [championship, season, roster, management, saveManagement, saveSeason]);

  /** [R51] Visto el aviso de sanciones, empieza la carrera. */
  const handleContinueFromPenalties = useCallback(() => {
    setPenaltyNotice([]);
    simulation.startRaceSequence();
    // [N3] Antes de la salida el motor no ha avanzado: arranca otra vez desde la copia con la salida dada.
    if (sessionRef.current) restartEngine();
  }, [simulation, restartEngine]);

  /** [R51] Guarda la carrera profesional tras una carrera o un salto; si la temporada se ha cerrado, lo enseña. */
  const applyCareer = useCallback((settled: SettledCareer) => {
    saveChampionship(settled.championship);
    saveComponents(settled.components);
    saveProgram(settled.program);
    saveSeason(settled.season);
    if (settled.management) saveManagement(settled.management);
    setSeasonArchive(settled.archive);
    try { localStorage.setItem(SEASONS_STORAGE_KEY, JSON.stringify(settled.archive)); } catch (e) { console.error(e); }
    // [T4.11] Con gestión, el cierre se cuenta en el invierno por pasos; sin ella, la pantalla de cierre de siempre.
    if (settled.winter) showWinter(settled.winter);
    else if (settled.closed) setSeasonEnd(settled.closed);
    // La temporada elige el Gran Premio siguiente.
    const next = nextRound(settled.championship, settled.season);
    if (next) setSelectedCircuitId(next.circuitId);
    // [R52] En una ronda sprint se propone el sprint; corrido el sprint, la clasificación del Gran Premio.
    const proposeSprint = sprintPending(settled.championship, settled.season);
    setRaceFormat(current => (proposeSprint ? 'sprint' : current === 'sprint' ? 'clasificacion' : current));
  }, [saveChampionship, saveComponents, saveProgram, saveSeason, saveManagement, showWinter]);

  const playerCodes = useMemo(() => {
    const team = (roster[selectedDriverId] ?? Object.values(roster)[0]).teamId;
    return Object.values(roster).filter(d => d.teamId === team).map(d => d.code);
  }, [selectedDriverId, roster]);

  /** [R51] Salta el Gran Premio que toca: no se disputa y nadie puntúa. */
  const handleSkipRound = useCallback(() => {
    const settled = settleSkip({ championship, components, program, season, archive: seasonArchive, management }, playerCodes);
    // [T4.11] En el invierno los pilotos cumplen un año y sus atributos siguen la curva de edad.
    if (settled.winter && settled.management) saveDevelopment(ageAttributes(development, Object.values(rosterOf(settled.management.contracts)), settled.management.ages));
    applyCareer(settled);
  }, [applyCareer, championship, components, program, season, seasonArchive, management, playerCodes, development, saveDevelopment]);

  const handleStartFormationLap = useCallback(() => {
    void sendOrder({ kind: lightState === 'grid-ready' ? 'confirmStart' : 'startSequence' });
  }, [sendOrder, lightState]);

  const formatRaceTime = (totalSec: number): string => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // [N3] Antes de cerrar la ronda, la copia de la pestaña se pone al día con el motor: el cierre lee de ella.
  const handleGoHome = useCallback(() => { void syncFromEngineRef.current().then(() => goHomeRef.current()); }, []);
  const goHomeNow = useCallback(() => {
    let report: RoundReport | null = null;
    // [T4.19] El resultado de una carrera libre no se anota en ninguna parte.
    if (mode === 'career' && simulation.podiumCars.length >= 3) {
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
        const developed = raceCounts && simulation.raceFormat !== 'sprint' ? developmentAfter(finalResult) : null;
        if (developed) saveDevelopment(developed);
        const settled = settleRace({ championship, components, program, season, archive: seasonArchive, management }, {
          counts: raceCounts, id: newHistoryItem.id, circuitId: selectedCircuitId, result: finalResult, format: simulation.raceFormat,
          raceKm: simulation.leaderLap * simulation.activeTrack.lapLengthMeters / 1000, playerCodes,
          tyres: simulation.raceFormat === 'sprint' ? carryTyres(simulation.cars) : undefined,
          // [T4.2] Los accidentes y salidas de pista de la carrera se facturan a su equipo.
          damages: raceDamages(simulation.incidents, simulation.cars),
          // [T4.6] Y sus paradas cuentan para la estadística del equipo de boxes.
          stops: simulation.cars.flatMap(car => (car.pitStop.stopLog ?? []).filter(stop => stop.totalSec > 0).map(stop => ({ teamId: car.driver.teamId, serviceSec: stop.serviceSec }))),
        });
        // [T4.11] En el invierno los pilotos cumplen un año y sus atributos siguen la curva de edad.
        if (settled.winter && settled.management) saveDevelopment(ageAttributes(developed ?? development, Object.values(rosterOf(settled.management.contracts)), settled.management.ages));
        applyCareer(settled);
        // [T4.20] Informe de la ronda con la gestión de antes y de después de liquidarla.
        if (raceCounts && settled.management) {
          report = buildRoundReport({
            before: management, after: settled.management, championship: settled.closed ? addRace(championship, newHistoryItem.id, selectedCircuitId, finalResult, simulation.raceFormat) : settled.championship,
            round: nextRound(championship, season)?.round ?? SEASON_RACES, circuitName: circuit.name, format: simulation.raceFormat, rows: finalResult.rows,
            gains: developed ? Object.values(roster).filter(driver => driver.teamId === management.playerTeamId).flatMap(driver => {
              const keys = Object.keys(developed.lastGains[driver.id] ?? {}) as AttributeKey[];
              return keys.length ? [{ code: driver.code, text: keys.map(key => `+1 ${ATTRIBUTE_LABEL[key].toLowerCase()}`).join(', ') }] : [];
            }) : [],
          });
        }
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

    if (report) showRoundReport(report);
    setCurrentView(report ? 'report' : 'home');
  }, [development, showRoundReport, simulation, selectedDriverId, selectedCircuitId, raceHistory, championship, saveDevelopment, developmentAfter, components, program, seasonArchive, saveStore, season, management, raceCounts, applyCareer, playerCodes, mode, roster]);

  const handleCycleCameraMode = useCallback(() => {
    camera.cycleMode();
    setCameraMode(camera.view3d ? camera.mode3d : camera.currentMode);
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


  const goHomeRef = useRef(goHomeNow);
  useEffect(() => { goHomeRef.current = goHomeNow; }, [goHomeNow]);
  const activeLuckEventRef = useRef(activeLuckEvent);
  useEffect(() => { activeLuckEventRef.current = activeLuckEvent; }, [activeLuckEvent]);

  const favoriteCar = cars.find(c => c.driver.id === selectedDriverId) || cars[0];
  // [Q11] Resolve both team pilots for dual-panel BoxControls
  const teamCars = useMemo(() => {
    if (!roster[selectedDriverId]) return [favoriteCar];
    return playerDriverIds(roster, selectedDriverId)
      .map(dId => cars.find(c => c.driver.id === dId))
      .filter((c): c is CarState => c !== undefined);
  }, [cars, selectedDriverId, favoriteCar, roster]);
  // [R54] El motor sabe qué coches lleva el jugador: en ellos el estratega propone y no ejecuta nada sin confirmación.
  useEffect(() => {
    simulation.setPlayerCars(playerDriverIds(roster, selectedDriverId));
  }, [simulation, selectedDriverId, roster]);
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

  noticeRef.current = pushNotice;
  // [T4.16] El audio se calla fuera de la carrera, en pausa y con la página oculta; al salir de la carrera se libera.
  useEffect(() => {
    const sync = () => {
      radioQuiet.current = document.hidden || isPaused || currentView !== 'race';
      audio.setPaused(document.hidden || isPaused || currentView !== 'race');
    };
    sync();
    if (currentView !== 'race') { audio.dispose(); audioSeen.current = null; }
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [audio, isPaused, currentView]);

  // El golpe de suerte de un rival no interrumpe: se aplica solo y queda como aviso. La modal es para los pilotos propios.
  const ownLuckEvent = activeLuckEvent && teamCars.some(car => car.id === activeLuckEvent.luckyCarId) ? activeLuckEvent : null;
  const rivalLuckId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeLuckEvent || ownLuckEvent || rivalLuckId.current === activeLuckEvent.id) return;
    rivalLuckId.current = activeLuckEvent.id;
    pushNotice('info', 'Suerte', `${activeLuckEvent.luckyDriverName} (dado ${activeLuckEvent.rollValue}): ${activeLuckEvent.rewardTitle}`);
    dismissedLuck.current = activeLuckEvent.id;
    void sendOrder({ kind: 'luckReward', eventId: activeLuckEvent.id }).then(() => sendOrder({ kind: 'luckClear' }));
    setActiveLuckEvent(null);
  }, [activeLuckEvent, ownLuckEvent, pushNotice, sendOrder]);

  const clearNotices = useCallback(() => {
    setNotices([]);
    lastFlag.current = 'green';
    lastPitLane.current.clear();
    lastDnfId.current = null;
  }, []);

  // [R24] Avisos del muro para los coches del jugador: por prioridad, como mucho tres a la vez y sin repetirse
  // mientras dure la causa.
  const wallActive = useRef(new Set<string>());
  const wallProposed = useRef(new Set<string>());
  useEffect(() => {
    if (currentView !== 'race') { wallActive.current = new Set(); wallProposed.current = new Set(); return; }
    const timer = window.setInterval(() => {
      // [N3] Lo leen de las vistas del motor: la lenta (estado de cada coche) y la del equipo (muro y propuestas).
      const state = raceStore.getState();
      const slow = state.slow;
      if (!slow || slow.finished) return;
      const racing = slow.light === 'racing';
      const running = new Set(slow.cars.filter(car => car.status === 'running').map(car => car.id));
      const ownCars = Object.values(state.teams).flatMap(team => team.cars);
      if (racing) {
        const readings = ownCars.filter(car => running.has(car.id))
          .map(car => car.reading as WallReading | null).filter((reading): reading is WallReading => reading !== null);
        const next = nextAlerts(wallAlerts(readings), wallActive.current);
        wallActive.current = next.active;
        for (const alert of next.show) pushNotice(alert.tone, 'Muro', alert.text);
      }
      // [R54] Una propuesta de parada nueva se avisa una vez; las de ritmo, que hay casi cada vuelta, solo se ven en el muro.
      for (const own of ownCars) {
        const car = { driver: { code: own.code } };
        for (const proposal of own.proposals as WallProposal[]) {
          const seen = `${proposal.id}@${proposal.timeSec}`;
          // [T4.12] La de salida llega en la parrilla, antes del semáforo; las de parada, en carrera.
          if (proposal.kind === 'ritmo' || (proposal.kind === 'parada' && !racing) || wallProposed.current.has(seen)) continue;
          wallProposed.current.add(seen);
          pushNotice('info', 'Muro', proposal.kind === 'salida'
            ? `${car.driver.code}: el estratega propone salir con ${proposal.compound ? COMPOUND_LABEL[proposal.compound] : 'otro neumático'} · ${proposal.reason}`
            : `${car.driver.code}: el estratega propone parar · ${proposal.reason}`);
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentView, pushNotice]);

  // ── [R48] Partidas: ranuras con nombre, autoguardado y carga ──
  const refreshSlots = useCallback(() => setSlots(saveStore ? saveStore.list() : []), [saveStore]);

  const buildSave = useCallback((name: string): SaveGame => createSave({
    name,
    savedAt: new Date().toISOString(),
    career: { championship, development, components, program, archive: seasonArchive, history: raceHistory, season, management },
    selection: { driverId: selectedDriverId, circuitId: selectedCircuitId, raceFormat, weatherScenarioId, luckVariant: luckVariantEnabled, setups, counts: raceCounts },
    race: raceLive ? createSnapshot(simulation) : null,
  }), [setups, championship, development, components, program, seasonArchive, raceHistory, selectedDriverId, selectedCircuitId, raceFormat, weatherScenarioId, luckVariantEnabled, raceLive, simulation, season, management, raceCounts]);

  // [N3] Guardar durante la carrera pide antes el estado al motor.
  const handleSaveGame = useCallback((name: string) => { void syncFromEngineRef.current().then(() => saveGameRef.current(name)); }, []);
  const saveGameNow = useCallback((name: string) => {
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
  const saveGameRef = useRef(saveGameNow);
  useEffect(() => { saveGameRef.current = saveGameNow; }, [saveGameNow]);

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
    saveManagement(savedManagement(save));
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
    // [R54] Los guardados anteriores no dicen qué coches son del jugador.
    simulation.setPlayerCars(playerDriverIds(rosterOf(savedManagement(save).contracts), selection.driverId));
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
    // [N3] La carrera cargada arranca en el motor (si ya se estaba en carrera, se sustituye).
    if (save.race) restartEngine();
    return null;
  }, [restartEngine, simulation, camera, saveChampionship, saveDevelopment, saveComponents, saveProgram, saveManagement, clearNotices, saveSetups]);

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
  // [N3] Guarda la copia de la pestaña, que se pone al día con el motor cada pocos segundos (al cerrar no da tiempo a pedirlo).
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
    const timer = currentView === 'race' ? window.setInterval(() => { void syncFromEngineRef.current().then(() => autosaveRef.current()); }, AUTOSAVE_MS) : undefined;
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
    // [N3] Antes de la salida el motor no ha avanzado: los cambios de parc fermé van en la copia y el motor arranca de ella.
    simulation.setCarSetups({ ...(raceCounts ? practiceFor(season, nextRound(championship, season)?.round)?.rivalSetups : undefined), ...playerSetups });
    if (parcFermeStarts.length) simulation.setPitLaneStarters(parcFermeStarts.map(start => start.driverId));
    setQualifying(null);
    for (const start of parcFermeStarts) pushNotice('warning', 'Salida', `${DRIVERS[start.driverId]?.code ?? start.driverId} sale desde el pit lane: ${start.reason.toLowerCase()}`);
    simulation.startRaceSequence();
    if (sessionRef.current) restartEngine();
  }, [restartEngine, simulation, playerSetups, parcFermeStarts, pushNotice, raceCounts, season, championship]);

  // [V8] Simular el Gran Premio que toca: se prepara como una carrera normal y el motor la corre sin pintarla, a
  // trozos para no bloquear la página, con el estratega al mando de los coches del jugador. Al acabar se liquida por el
  // mismo camino que una carrera vista (puntos, dinero, componentes e informe de la ronda).
  const [autoRace, setAutoRace] = useState<{ lap: number; total: number } | null>(null);
  const autoRequested = useRef(false);
  const autoLatest = useRef({ goHome: () => {}, fromQualifying: () => {}, fromPenalties: () => {}, qualifying: false, penalties: false, playerIds: [] as string[] });
  // [N3] Motor de la carrera: arranca al entrar en carrera (y al recargar o reiniciar) con el snapshot de la copia de la
  // pestaña y se para al salir. Simular el Gran Premio (V8) corre en la propia pestaña, sin motor aparte.
  useEffect(() => {
    if (currentView !== 'race' || autoRace || autoRequested.current) return;
    const link = typeof Worker !== 'undefined' ? new WorkerLink() : (() => { const local = new LocalLink(); local.run(); return local; })();
    // [N8] En una carrera compartida, la pantalla habla con el motor a través del anfitrión que la reparte.
    const shared = sharedRef.current;
    const sharedHost = shared ? new SharedRaceHost({ link, transport: shared.transport, store: raceStore, linkStore, names: shared.names,
      onPauseRequest: () => setPauseRequests([...(sharedHostRef.current?.pauseRequests ?? [])]) }) : null;
    sharedHostRef.current = sharedHost;
    const session = sharedHost ? sharedHost.session : new RaceSession({ link, store: raceStore, linkStore });
    sessionRef.current = session;
    const teams = [...new Set(playerDriverIds(roster, selectedDriverId).map(id => roster[id]?.teamId).filter((id): id is string => Boolean(id)))];
    roomStore.getState().setTeams(shared ? [shared.hostTeamId] : teams);
    setFastSample(null);
    podiumIdsRef.current = '';
    void (sharedHost && shared
      ? sharedHost.start({ db: shared.db, code: shared.code, snapshot: createSnapshot(simulation), config: raceConfig(), roster: raceRosterOf(simulation),
        circuitId: simulation.circuitId, weather: shared.weather, format: shared.format, publish: !qualifyingRef.current,
        hostUid: shared.hostUid, hostTeamId: shared.hostTeamId, players: shared.players })
      : session.start({ snapshot: createSnapshot(simulation), config: raceConfig(), teams, roster: raceRosterOf(simulation) }))
      .then(outcome => { if (!outcome.ok) noticeRef.current('danger', 'Motor', `No se pudo arrancar la carrera: ${outcome.errors.slice(0, 2).join(' · ')}`); });
    const sync = window.setInterval(() => { void syncFromEngineRef.current(); }, MIRROR_SYNC_MS);
    return () => {
      window.clearInterval(sync);
      if (sessionRef.current === session) sessionRef.current = null;
      if (sharedHost) sharedHost.stop(); else session.stop();
    };
    // Solo al entrar o salir de la carrera, al rearrancarla y al empezar o acabar la simulación del Gran Premio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, engineEpoch, autoRace]);

  // [N8] «Empezar» en la sala: carrera libre con el circuito y el tiempo de la sala y el equipo del anfitrión; se arranca
  // cuando los ajustes ya están puestos (un render después).
  useEffect(() => {
    if (!sharedPending || mode !== 'free' || selectedCircuitId !== sharedPending.circuitId || weatherScenarioId !== sharedPending.weather) return;
    setSharedPending(null);
    handleStartRaceFromHome();
  }, [sharedPending, mode, selectedCircuitId, weatherScenarioId, handleStartRaceFromHome]);
  // Al salir de la carrera compartida, la sala se cierra (la siguiente carrera en la misma sala es N9).
  useEffect(() => {
    if (currentView === 'race' || currentView === 'room' || sharedPending) return;
    const shared = sharedRef.current;
    if (!shared) return;
    sharedRef.current = null;
    sharedHostRef.current = null;
    setPauseRequests([]);
    shared.transport.stop();
    void leaveRoom(shared.db, shared.code).catch(() => {});
  }, [currentView, sharedPending]);

  const handleSimulateRound = useCallback(() => {
    autoRequested.current = true;
    handleStartRaceFromHome();
  }, [handleStartRaceFromHome]);
  useEffect(() => {
    if (currentView !== 'race' || !autoRequested.current) return;
    autoRequested.current = false;
    const latest = autoLatest.current;
    setQualifyingLive(false);
    if (latest.qualifying) latest.fromQualifying();
    else if (latest.penalties) latest.fromPenalties();
    startAutoRace(simulation, simulation.cars.filter(car => latest.playerIds.includes(car.driver.id)).map(car => car.id));
    setAutoRace({ lap: 0, total: simulation.totalLaps });
    let timer = 0;
    const run = () => {
      // Con la pestaña en segundo plano el navegador solo deja un turno por segundo: se aprovecha entero.
      const done = advanceAutoRace(simulation, document.hidden ? AUTO_RACE_HIDDEN_CHUNK_MS : AUTO_RACE_CHUNK_MS);
      setAutoRace({ lap: Math.min(simulation.totalLaps, simulation.leaderLap), total: simulation.totalLaps });
      if (done) { simulation.setFixedStep(RACE_STEP_SEC); setAutoRace(null); timer = window.setTimeout(() => autoLatest.current.goHome(), 0); }
      else timer = window.setTimeout(run, 0);
    };
    timer = window.setTimeout(run, 0);
    return () => window.clearTimeout(timer);
  }, [currentView, simulation]);

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
    void syncFromEngineRef.current().then(() => {
      autosaveRef.current();
      setCurrentView('home');
    });
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
      // [N3] Entrada y salida con el mismo instante que las gomas (la vista del equipo), para no anunciar las de antes.
      const now = Boolean((ownView(car.id)?.state as { isInPitLane?: boolean } | undefined)?.isInPitLane ?? car.isInPitLane);
      if (was === now) continue;
      lastPitLane.current.set(car.id, now);
      if (was === undefined) continue;
      if (now) pushNotice('info', 'Box', `${car.driver.code} entra en boxes`);
      else pushNotice('ok', 'Box', `${car.driver.code} sale de boxes con ${TYRE_WORDS[car.tires.compound] ?? car.tires.compound}`);
    }
  }, [teamCars, currentView, pushNotice, ownView]);

  // [T3.1] Un coche del jugador se sale por una escapatoria de asfalto: pierde unos segundos y sigue.
  const lastOffTrack = useRef(new Map<number, boolean>());
  useEffect(() => {
    if (currentView !== 'race') { lastOffTrack.current.clear(); return; }
    for (const car of teamCars) {
      const now = Boolean(car.offTrack), was = lastOffTrack.current.get(car.id) ?? false;
      lastOffTrack.current.set(car.id, now);
      if (now && !was) pushNotice('warning', 'Pista', `${car.driver.code} se sale por la escapatoria: pierde unos ${Math.round(car.offTrack?.lossSec ?? 0)} s`);
    }
  }, [teamCars, currentView, pushNotice]);

  useEffect(() => {
    if (!activeDnf || activeDnf.id === lastDnfId.current) return;
    lastDnfId.current = activeDnf.id;
    pushNotice('danger', 'DNF', `${activeDnf.driverCode}: ${activeDnf.reason}`);
  }, [activeDnf, pushNotice]);

  const selectedCar = selectedCarId !== null ? cars.find(car => car.id === selectedCarId) || null : null;
  // [Q13] Reincorporación estimada del piloto objetivo (el mismo que muestra el dock). [N3] Solo de los coches propios:
  // la de un rival no se sabe.
  const rejoinTarget = (selectedCar || favoriteCar).id;
  const rejoinEstimate = (ownView(rejoinTarget)?.rejoin as RejoinEstimate | undefined)
    ?? { available: false as const, carId: rejoinTarget, reason: 'solo de tus coches' };
  const activeCircuitSpec = OFFICIAL_CIRCUITS[selectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];

  // ── [T4.19] Partida en curso, menú de partidas y menú «Partida» ──
  const namedSlots = slots.filter(slot => !slot.auto);
  const autoSlot = slots.find(slot => slot.auto);
  const careerName = saveName || DEFAULT_CAREER_NAME;
  const currentSummary = careerActive
    ? { ...summarize(buildSave(careerName), 'actual', false, 0), ...(raceLive ? {} : { raceInProgress: autoSlot?.raceInProgress ?? null }) }
    : null;
  /** Marca que hay una partida en curso con ese nombre. */
  const markCareer = (name: string) => {
    setCareerActive(true);
    setMode('career');
    setSaveName(name);
    try { localStorage.setItem(CAREER_NAME_KEY, name); localStorage.setItem(SAVE_NAME_KEY, name); } catch (e) { console.error(e); }
  };
  /** Antes de cambiar de partida, la que está en curso se guarda en su ranura: no se pierde nada sin avisar. */
  const keepCurrentCareer = () => {
    if (careerActive && saveStore) { saveStore.save(buildSave(careerName)); refreshSlots(); }
  };
  const handleContinueCareer = () => {
    setMode('career');
    // Si la partida se dejó en mitad de una carrera, se retoma ahí (en pausa).
    if (!raceLive && autoSlot?.raceInProgress && !autoSlot.raceInProgress.finished) { handleLoadGame(AUTOSAVE_ID); return; }
    if (!raceLive) { const next = nextRound(championship, season); if (next) setSelectedCircuitId(next.circuitId); }
    // [T4.20] Si quedó un informe sin cerrar, se enseña antes de volver al centro de gestión.
    setCurrentView(raceLive ? 'race' : roundReport ? 'report' : 'home');
  };
  const handleLoadCareer = (id: string) => {
    keepCurrentCareer();
    const loaded = saveStore?.load(id);
    handleLoadGame(id);
    if (loaded?.save) markCareer(loaded.save.name);
  };
  const handleNewCareer = (teamId: string, name: string) => {
    keepCurrentCareer();
    const fresh = newCareer(teamId, name, newRaceSeed());
    if (saveStore) { saveStore.remove(AUTOSAVE_ID); refreshSlots(); }
    showRoundReport(null);
    showWinter(null);
    if (applySave(createSave({ name: fresh.name, savedAt: new Date().toISOString(), career: fresh.career, selection: fresh.selection, race: null })) === null) markCareer(fresh.name);
  };
  const gameMenu = (
    <GameMenu savedAt={savedAt} now={clock} name={careerName}
      onSave={() => handleSaveGame(careerName)} onSaveAs={handleSaveGame}
      onExport={() => { handleSaveGame(careerName); handleExportGame(SaveStore.slotId(careerName)); }}
      onExit={() => { void syncFromEngineRef.current().then(() => { autosaveRef.current(); setCurrentView('menu'); }); }} />
  );

  // ── [T4.3] Centro de gestión de la carrera profesional ──
  const hubTeam = TEAMS[management.playerTeamId];
  const hubRound = nextRound(championship, season);
  const hubCircuit = hubRound ? OFFICIAL_CIRCUITS[hubRound.circuitId] : undefined;
  const hubNext = hubRound && hubCircuit
    ? { round: hubRound.round, circuitName: hubCircuit.name, laps: hubCircuit.totalLaps, rainPercent: hubCircuit.rainProbabilityPercent, sprint: Boolean(hubRound.sprint) }
    : null;
  const hubPending = pendingDecisions({ teamId: management.playerTeamId, management, program, components, raceIndex: grandsPrixRun(championship), round: hubRound?.round });
  const hubBadges: Partial<Record<HubSection, number>> = {};
  for (const item of hubPending) hubBadges[item.section] = (hubBadges[item.section] ?? 0) + 1;
  const teamStanding = constructorsChampionship(championship).findIndex(team => team.teamId === management.playerTeamId);
  const teamPoints = teamStanding >= 0 ? constructorsChampionship(championship)[teamStanding].points : 0;
  const hubBalance = balanceOf(management.finance, management.playerTeamId);
  const hubCrew = management.pitCrews.teams[management.playerTeamId];
  const hubWork = management.facilities.teams[management.playerTeamId]?.work;
  const sprintDone = Boolean(hubRound && season.weekend?.round === hubRound.round);
  const teamDrivers = pairOf(management.contracts, management.playerTeamId).map(id => roster[id]).filter(Boolean);
  const hub = mode === 'career' && hubTeam ? {
    teamName: hubTeam.shortName, accent: teamAccent(hubTeam.id), seasonNumber: seasonArchive.length + 1, round: hubRound?.round ?? null,
    kpis: [{ label: hubBalance < 0 ? 'deuda' : 'saldo', value: formatMoney(Math.abs(hubBalance)) }, { label: 'constructores', value: teamStanding >= 0 ? `P${teamStanding + 1}` : '—' }, { label: 'junta', value: String(Math.round(management.board.confidence)) }],
    badges: hubBadges,
    inicio: (go: (section: HubSection) => void) => (
      <HubHome next={hubNext} pending={hubPending} onGo={go} status={[
        { label: 'Campeonato', value: teamStanding >= 0 ? `P${teamStanding + 1} · ${teamPoints} pts` : 'Sin carreras', detail: `${grandsPrixRun(championship)} Grandes Premios disputados`, section: 'temporada' },
        { label: 'Finanzas', value: formatMoney(hubBalance), detail: `Próxima ronda: ${formatMoney(roundForecast(management.finance, management.playerTeamId).net, true)} sin contar puntos`, section: 'finanzas' },
        { label: 'Fábrica', value: `${activeProjects(program, management.playerTeamId).length} proyectos`, detail: hubWork ? `Obra en curso: quedan ${hubWork.remaining} rondas` : 'Sin obras en curso', section: 'fabrica' },
        { label: 'Junta', value: `${Math.round(management.board.confidence)} · objetivo ${management.board.objective}.º`, detail: `Equipo de boxes: nivel ${hubCrew?.level ?? 1}, fatiga ${Math.round(hubCrew?.fatigue ?? 0)} %`, section: 'finanzas' },
      ]} />
    ),
    correr: hubNext ? (
      <RaceWeekendPanel round={hubNext} sessions={weekendSessions(effectiveFormat, sprintDone, Boolean(practiceFor(season, hubNext.round)))}
        drivers={teamDrivers.map(driver => ({ id: driver.id, code: driver.code, name: driver.lastName, number: driver.number }))}
        followedId={selectedDriverId} onFollow={setSelectedDriverId}
        launchLabel={effectiveFormat === 'sprint' ? 'Clasificación sprint y sprint' : effectiveFormat === 'clasificacion' ? 'Clasificación y Gran Premio' : 'Entrar a pista'}
        onStart={handleStartRaceFromHome}>
        <section className={managementStyles.card}>
          <RaceFormatSelect value={effectiveFormat} onChange={setRaceFormat} sprintAvailable={sprintAvailable} />
        </section>
        <PracticePanel drivers={teamDrivers.map(driver => ({ id: driver.id, code: driver.code }))} programs={practicePrograms} result={practiceFor(season, hubNext.round)}
          sprintWeekend={isSprintVenue(selectedCircuitId)} onProgram={(id, value) => setPracticePrograms(current => ({ ...current, [id]: value }))} onRun={handleRunPractice} />
        <SpyPanel round={hubNext.round} available={Boolean(practiceFor(season, hubNext.round))} reports={practiceFor(season, hubNext.round)?.spy ?? []}
          teams={[...new Set(Object.values(roster).map(driver => driver.teamId))].filter(id => id !== management.playerTeamId).map(id => ({ id, name: TEAMS[id]?.shortName ?? id }))}
          canAfford={cost => canSpend(management.finance, management.playerTeamId, cost)} driverCode={id => roster[id]?.code ?? id} onSpy={handleSpy} />
        <SetupPanel drivers={teamDrivers} setups={setups} onChange={handleSetupChange} />
      </RaceWeekendPanel>
    ) : <p>La temporada está completa: no quedan rondas por correr.</p>,
  } : undefined;

  if (currentView === 'landing') {
    return <LandingPage onEnter={() => setCurrentView('menu')} />;
  }

  // [UX1] Ajustes desde la pantalla de juego (se carga aparte, con import()).
  if (currentView === 'settings') {
    return <Suspense fallback={null}><SettingsScreen onBack={() => setCurrentView('menu')}
      audio={{ level: audioLevel, labels: AUDIO_LEVEL_LABEL, onLevel: setAudioLevel, credits: soundCredits() }} /></Suspense>;
  }

  // ── [T4.19] Menú de partidas, partidas guardadas y partida nueva ──
  if (currentView === 'menu') {
    return (
      <GameMenuScreen current={currentSummary} slots={namedSlots}
        onContinue={handleContinueCareer} onNew={() => setCurrentView('new')} onLoad={() => { setSaveMessage(null); setCurrentView('saves'); }}
        onFree={() => { setMode('free'); setCurrentView('home'); }}
        onCreateRoom={() => { setRoomIntent('create'); setCurrentView('room'); }}
        onJoinRoom={() => { setRoomIntent('join'); setCurrentView('room'); }}
        onSettings={() => setCurrentView('settings')} />
    );
  }
  // [N7] Salas: crear (anfitrión) o unirse (invitado). La carrera compartida llega con N8.
  if (currentView === 'room') {
    return <RoomFlow intent={linkedRoom ? 'join' : roomIntent} initialCode={linkedRoom ?? undefined}
      onHostStart={start => {
        sharedRef.current = start;
        setMode('free');
        setSelectedCircuitId(start.circuitId);
        setWeatherScenarioId(start.weather);
        setRaceFormat('directo');
        const driver = Object.keys(DRIVERS).find(id => DRIVERS[id]?.teamId === start.hostTeamId);
        if (driver) setSelectedDriverId(driver);
        setRaceFormat(start.format);
        setResumeRoom(null);
        setSharedPending(start);
      }}
      resume={roomIntent === 'create' ? resumeRoom : null}
      onExit={() => { if (linkedRoom) { history.replaceState(null, '', location.pathname); setLinkedRoom(null); } setResumeRoom(null); setCurrentView('menu'); }} />;
  }
  if (currentView === 'saves') {
    return (
      <SavesScreen slots={namedSlots} message={saveMessage} onBack={() => setCurrentView('menu')}
        onLoad={handleLoadCareer} onExport={handleExportGame} onImport={handleImportGame} onDelete={handleDeleteGame} />
    );
  }
  // [T4.11] Tras la última ronda (y su informe), el invierno: cinco pasos antes de volver al centro de gestión.
  if (currentView === 'home' && mode === 'career' && winter) {
    return <WinterScreen report={winter} onConfirm={() => showWinter(null)} />;
  }
  if (currentView === 'report' && roundReport) {
    return <RoundReportScreen report={roundReport} onContinue={() => { showRoundReport(null); setCurrentView('home'); }} />;
  }
  if (currentView === 'new') {
    return <NewCareerScreen onBack={() => setCurrentView('menu')} onStart={handleNewCareer} />;
  }

  if (currentView === 'home') {
    return (
      <>
      <HomeScreen
        key={mode}
        hub={hub}
        mode={mode}
        headerExtra={mode === 'career' ? gameMenu : <button type="button" className={styles.barBtn} onClick={() => { setMode('career'); setCurrentView('menu'); }}>← Menú</button>}
        selectedDriverId={selectedDriverId}
        selectedCircuitId={selectedCircuitId}
        // En la carrera profesional solo se sigue a un piloto del equipo y se corre la ronda que toca.
        onSelectDriver={driverId => { if (mode === 'free' || roster[driverId]?.teamId === management.playerTeamId) setSelectedDriverId(driverId); }}
        onSelectCircuit={circuitId => { if (mode === 'free') setSelectedCircuitId(circuitId); }}
        onStartRace={handleStartRaceFromHome}
        raceHistory={raceHistory}
        championship={championship}
        onResetChampionship={() => {
          saveChampionship(emptyChampionship()); saveDevelopment(emptyDevelopment());
          saveComponents(Object.keys(DRIVERS).reduce((s, id) => ensureDriver(s, id), emptyComponents()));
          saveProgram(emptyProgram());
          saveSeason(emptySeason());
          saveManagement(startManagement(management.playerTeamId, seasonArchive.length + 1, newRaceSeed()));
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
          onSimulate: handleSimulateRound,
        }}
        driverAttributes={driver => attributesOf(development, driver)}
        finance={{ state: management.finance, teamId: management.playerTeamId }}
        board={management.board}
        sponsors={{
          team: management.sponsors.teams[management.playerTeamId],
          onSign: offerId => {
            const signed = signSponsor(management.sponsors, management.playerTeamId, offerId);
            if (signed.ok) saveManagement({ ...management, sponsors: signed.state });
          },
          carOf: teamId => carSponsors(management.sponsors, teamId),
        }}
        roster={roster}
        reserve={{
          academy: management.academy, message: reserveMessage,
          onStandIn: seatId => {
            const answer = setStandIn(management.academy, management.contracts, management.playerTeamId, seatId);
            if (answer.ok) saveManagement({ ...management, academy: answer.state });
            setReserveMessage(answer.reason);
          },
          onSignReserve: juniorId => {
            const answer = signReserve(management.academy, management.playerTeamId, juniorId);
            if (answer.ok) saveManagement({ ...management, academy: answer.state });
            setReserveMessage(answer.reason);
          },
          onPromote: () => {
            const answer = agreePromotion(management.academy, management.contracts, { season: management.finance.season, round: hubRound?.round ?? SEASON_RACES, teamId: management.playerTeamId });
            if (answer.ok) saveManagement({ ...management, contracts: answer.contracts });
            setReserveMessage(answer.reason);
          },
        }}
        contracts={{
          state: management.contracts, teamId: management.playerTeamId, season: management.finance.season, round: hubRound?.round ?? SEASON_RACES, message: contractMessage, ages: management.ages,
          onOffer: (driverId, salary, seasons) => {
            const answer = offerContract(management.contracts, { season: management.finance.season, round: hubRound?.round ?? SEASON_RACES, teamId: management.playerTeamId, driverId, salary, seasons });
            if (answer.state !== management.contracts) saveManagement({ ...management, contracts: answer.state });
            setContractMessage(`${DRIVERS[driverId]?.lastName ?? driverId}: ${answer.reason}`);
          },
        }}
        staff={management.staff ? {
          state: management.staff, teamId: management.playerTeamId, round: nextRound(championship, season)?.round ?? SEASON_RACES,
          drivers: pairOf(management.contracts, management.playerTeamId).map(id => roster[id]?.code ?? id),
          onHire: memberId => {
            const hired = hireStaff(management.staff!, management.playerTeamId, memberId, nextRound(championship, season)?.round ?? SEASON_RACES);
            if (hired.ok) saveManagement({ ...management, staff: hired.state });
          },
        } : undefined}
        pitCrew={{
          crew: management.pitCrews.teams[management.playerTeamId],
          onPlan: plan => saveManagement({ ...management, pitCrews: setCrewPlan(management.pitCrews, management.playerTeamId, plan) }),
        }}
        facilities={{
          state: management.facilities, teamId: management.playerTeamId,
          canAfford: cost => canSpend(management.finance, management.playerTeamId, cost),
          onUpgrade: facility => {
            const started = startWork(management, management.playerTeamId, facility, nextRound(championship, season)?.round ?? SEASON_RACES);
            if (started.ok) saveManagement(started.management);
          },
        }}
        components={components}
        development={{
          program, raceIndex: grandsPrixRun(championship),
          constructorsPosition: constructorsPosition((roster[selectedDriverId] ?? Object.values(roster)[0]).teamId),
          // [T4.2] El proyecto se paga al empezarlo; sin dinero no empieza.
          onStart: key => {
            const bought = buyProject(management, program, management.playerTeamId, key, grandsPrixRun(championship), constructorsPosition(management.playerTeamId), nextRound(championship, season)?.round ?? SEASON_RACES);
            if (bought.ok) { saveProgram(bought.program); saveManagement(bought.management); }
          },
          costs: {
            costOf: projectCost, shortfallOf: key => projectShortfall(management, management.playerTeamId, key),
            leadTimeOf: key => projectLeadTime(management, management.playerTeamId, key, constructorsPosition(management.playerTeamId)),
            maxActive: maxProjects(management.facilities, management.playerTeamId),
          },
          onInstall: (projectId, driverId) => saveProgram(installFirst(program, projectId, driverId, grandsPrixRun(championship)).program),
        }}
        onFitComponent={(driverId, type) => {
          // [T4.2] La unidad se paga al montarla; deshacerla sin estrenar devuelve su importe.
          const bought = buyComponent(management, components, management.playerTeamId, driverId, type, nextRound(championship, season)?.round ?? SEASON_RACES);
          if (bought.ok) { saveComponents(bought.components); saveManagement(bought.management); }
        }}
        onRefitComponent={(driverId, serial) => saveComponents(refitUsed(components, driverId, serial))}
        onUndoComponent={(driverId, type) => {
          const undone = refundComponent(management, components, management.playerTeamId, driverId, type, nextRound(championship, season)?.round ?? SEASON_RACES);
          if (undone.ok) { saveComponents(undone.components); saveManagement(undone.management); }
        }}
        componentCostOf={(driverId, type) => componentCost(components, driverId, type)}
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
        {...(mode === 'free' ? FREE_RACE_PADDOCK : {})}
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

  autoLatest.current = { goHome: handleGoHome, fromQualifying: handleContinueFromQualifying, fromPenalties: handleContinueFromPenalties,
    qualifying: Boolean(qualifying), penalties: penaltyNotice.length > 0, playerIds: playerDriverIds(roster, selectedDriverId) };

  // R30/R31: la vista de detalle sustituye a la clasificación en pantallas estrechas; en las anchas convive con ella.
  const isWide = viewportWidth >= 1600;
  const detailCar = selectedCar || favoriteCar;
  const detailIsRival = !teamCars.some(c => c.id === detailCar.id);
  // [V2] Tres composiciones: móvil (pestañas), tableta (pista arriba; posiciones y muro debajo) y escritorio.
  const layout = raceLayout(viewportWidth);
  const detailReplacesPositions = detailOpen && !isWide;
  const showPositions = layout === 'movil' ? raceTab === 'tiempos' : leftSidebarOpen && !detailReplacesPositions;
  const showDetail = layout === 'movil' ? raceTab === 'detalle' : detailOpen;
  const showWall = layout !== 'movil' || raceTab === 'muro';
  const columns: string[] = [];
  const areas: string[] = [];
  if (showPositions) { columns.push('var(--ancho-posiciones)'); areas.push('pos'); }
  if (detailReplacesPositions) { columns.push('var(--ancho-detalle)'); areas.push('detail'); }
  columns.push('minmax(0, 1fr)'); areas.push('center');
  if (detailOpen && isWide) { columns.push('var(--ancho-detalle)'); areas.push('detail'); }
  const shellLayout = layout === 'escritorio' ? { gridTemplateColumns: columns.join(' '), gridTemplateAreas: `"${areas.join(' ')}"` } : undefined;
  const shellSide = showPositions ? 'pos' : showDetail ? 'detail' : 'none';

  return (
    <div className={styles.appContainer}>
      {autoRace && (
        <div className={styles.autoRace} role="status" aria-live="polite">
          <strong>Simulando el Gran Premio</strong>
          <span>Vuelta {autoRace.lap} de {autoRace.total} · el estratega lleva tus dos coches</span>
          <div className={styles.autoRaceBar} role="progressbar" aria-valuemin={0} aria-valuemax={autoRace.total} aria-valuenow={autoRace.lap}>
            <span style={{ width: `${autoRace.total ? 100 * autoRace.lap / autoRace.total : 0}%` }} />
          </div>
        </div>
      )}
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

        <div className={`${styles.barGroup} ${styles.viewTools}`}>
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
        </div>
        <div className={styles.barGroup}>
          <button
            className={`${styles.barBtn} ${styles.panelToggle}`}
            aria-pressed={leftSidebarOpen}
            onClick={() => setLeftSidebarOpen(open => !open)}
            title={leftSidebarOpen ? 'Ocultar posiciones' : 'Mostrar posiciones'}
            aria-label="Posiciones"
          >
            <ListOrdered size={16} aria-hidden="true" />
            <span className={styles.barLabel}>Posiciones</span>
          </button>
          <button
            className={`${styles.barBtn} ${styles.panelToggle}`}
            aria-pressed={detailOpen}
            onClick={() => setDetailOpen(open => !open)}
            title={detailOpen ? 'Cerrar detalle del coche' : 'Abrir detalle del coche'}
            aria-label="Detalle"
          >
            <PanelRight size={16} aria-hidden="true" />
            <span className={styles.barLabel}>Detalle</span>
          </button>
          {mode === 'career' && <span className={styles.gameSlot}>{gameMenu}</span>}
          <RaceMenu
            safetyCarDeployed={safetyCar !== null}
            onToggleSafetyCarTest={handleSafetyCarTest}
            onRedFlagTest={handleRedFlagTest}
            luckVariantEnabled={luckVariantEnabled}
            onToggleLuckVariant={handleToggleLuckVariant}
            onSaveGame={saveStore ? handleSaveGame : undefined}
            saveName={saveName}
            audio={{ level: audioLevel, labels: AUDIO_LEVEL_LABEL, onLevel: setAudioLevel, credits: soundCredits() }}
            radioSettings
          />
        </div>
      </header>

      <div className={styles.raceShell} style={shellLayout} data-layout={layout} data-side={shellSide} data-tab={raceTab}>
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
          <div className={styles.canvasArea} data-formation={lightState === 'formation-lap' ? 'true' : undefined}>
            <RaceCanvas
              track={simulation.activeTrack}
              circuitId={simulation.circuitId}
              roster={raceRoster}
              camera={camera}
              selectedCarId={selectedCarId}
              onSelectCar={handleSelectCar}
              weatherTest={mode === 'free'}
              onWeatherTest={index => { void sendOrder({ kind: 'weatherTest', index }); }}
            />

            {/* HUD de Banderas y Safety Car en Directo */}
            <RaceFlagsHUD
              raceFlagState={raceFlagState}
              sectorFlags={sectorFlags}
              safetyCar={safetyCar}
              onEndRace={() => { void sendOrder({ kind: 'endSuspended' }); }}
            />

            <RaceNotices notices={notices} />
            {/* [N9] Final de la carrera compartida: otra carrera en la misma sala o cerrarla. */}
            {isFinished && sharedRef.current && (
              <div style={{ position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 60, padding: 8, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12 }}>
                <SharedRaceEnd isHost onLeave={() => setCurrentView('menu')} onClose={() => setCurrentView('menu')}
                  onAnother={() => {
                    const room = sharedRef.current;
                    if (!room) return;
                    sharedRef.current = null;
                    setPauseRequests([]);
                    void returnToLobby(room.db, room.code).catch(() => {});
                    setResumeRoom(room);
                    setRoomIntent('create');
                    setCurrentView('room');
                  }} />
              </div>
            )}
            <PauseRequestBanner requests={pauseRequests} onDismiss={uid => { sharedHostRef.current?.dismissPause(uid); setPauseRequests([...(sharedHostRef.current?.pauseRequests ?? [])]); }} />

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
                const c = cars.find(car => car.id === id);
                if (c) setSelectedDriverId(c.driver.id);
              }}
              onStartClick={handleStartFormationLap}
            />

            {qualifying && qualifyingLive && (
              <div className={qualifyingStyles.overlay}>
                <QualifyingLive result={qualifying} outline={simulation.activeTrack.points} playerIds={playerDriverIds(roster, selectedDriverId)} onDone={() => setQualifyingLive(false)} />
              </div>
            )}
            {qualifying && !qualifyingLive && (
              <div className={qualifyingStyles.overlay}>
                <QualifyingResults result={qualifying} gridChanges={gridChanges} pitLaneStarts={parcFermeStarts} onContinue={handleContinueFromQualifying}>
                  {qualifyingSetups && (
                    <details open={parcFermeStarts.length > 0 || undefined}>
                      <summary className={qualifyingStyles.extraTitle}>Setup en parc fermé</summary>
                      <SetupPanel drivers={Object.keys(qualifyingSetups).map(id => roster[id]).filter(Boolean)} setups={setups} parcFerme={qualifyingSetups} onChange={handleSetupChange} />
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
                result={(slowView?.result as RaceResult | null) ?? undefined}
                onConfirmResult={() => { void sendOrder({ kind: 'confirmResult' }); }}
                homeLabel={podiumHomeLabel(simulation.raceFormat, raceCounts)}
                progress={!raceCounts || simulation.raceFormat === 'sprint' || !slowView?.result ? [] : (() => {
                  const after = developmentAfter(slowView.result as RaceResult);
                  return teamCars.map(c => roster[c.driver.id]).filter(Boolean).map(driver => ({
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
                dismissedDnf.current = activeDnf?.id ?? null;
                void sendOrder({ kind: 'dnfClear' });
                setActiveDnf(null);
              }}
            />

            {/* ── MODAL DE SUERTE CON DADO D20 (SAFETY CAR & BANDERA ROJA) ── */}
            {ownLuckEvent && activeLuckEvent && (
              <D20LuckModal
                key={activeLuckEvent.id}
                event={ownLuckEvent}
                onApplyReward={handleApplyLuckReward}
                onDismiss={handleDismissLuckEvent}
              />
            )}
          </div>

          <section className={`${styles.wallArea} ${showWall ? '' : styles.isHidden}`}>
            <BoxControls key={teamCars.map(c => c.id).join(':') + ':' + selectedCircuitId} car={favoriteCar} teamCars={teamCars}
              team={teamViews[favoriteCar.team.id]} race={{ lightState, isFinished, raceFlagState }} send={sendOrder} slow={slowView} focusId={selectedCarId} />
          </section>
        </main>

        {/* ── 3. DETALLE DEL COCHE CONSULTADO (se conserva montado para no perder pestaña ni selección) ── */}
        <aside className={`${styles.detailArea} ${showDetail ? '' : styles.isHidden}`} aria-label="Detalle del coche">
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
          {/* [V4] La estrategia en una línea: tandas, vuelta actual y ventana de parada. */}
          <StintTimeline stints={detailCar.pitStop.stints ?? []} currentLap={detailCar.currentLap} totalLaps={simulation.totalLaps} />
          {/* [R24] Lectura del muro del coche en detalle. */}
          <WallPanel reading={detailCar ? ((ownView(detailCar.id)?.reading as WallReading | null | undefined) ?? null) : null} />
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
              rainForecast={(slowView?.forecast as RainForecast | null | undefined) ?? null}
            />
          </div>
        </aside>
      </div>
      {layout === 'movil' && <RaceTabs tab={raceTab} onChange={setRaceTab} />}
    </div>
  );
};

export default App;
