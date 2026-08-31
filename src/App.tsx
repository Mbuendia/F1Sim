import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './App.module.css';
import { RaceSimulation } from './simulation/RaceSimulation';
import { Camera } from './renderer/Camera';
import { RaceCanvas } from './components/RaceCanvas';
import { SpeedControls } from './components/SpeedControls';
import { StartLights } from './components/StartLights';
import { RaceHeader } from './components/RaceHeader';
import { Leaderboard } from './components/Leaderboard';
import { BottomTelemetryDock } from './components/BottomTelemetryDock';
import { RightStatsPanel } from './components/RightStatsPanel';
import { PodiumModal } from './components/PodiumModal';
import { HomeScreen } from './components/HomeScreen';
import { LandingPage } from './components/LandingPage';
import RaceFlagsHUD from './components/RaceFlagsHUD';
import { DnfNotificationModal } from './components/DnfNotificationModal';
import { D20LuckModal } from './components/D20LuckModal';
import { OFFICIAL_CIRCUITS } from './data/circuits';
import { RaceResultHistory, StartLightState, CarState, RaceFlagState, SafetyCarState, DnfNotification, D20LuckEvent, TrackWeatherState } from './types/f1';
import { RotateCw, Flag, ArrowLeft, ChevronLeft, ChevronRight, Camera as CameraIcon } from 'lucide-react';

export const App: React.FC = () => {
  // Piloto y Circuito seleccionados
  const [selectedDriverId, setSelectedDriverId] = useState<string>('alonso');
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('barcelona');

  const simulation = useMemo(() => new RaceSimulation(selectedCircuitId), []);
  const camera = useMemo(() => new Camera(), []);

  // Vista actual: 'landing', 'home' o 'race'
  const [currentView, setCurrentView] = useState<'landing' | 'home' | 'race'>('landing');

  // Coche seleccionado expresamente en pista
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);

  // Sidebar collapse state
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  // Camera mode
  const [cameraMode, setCameraMode] = useState<string>('overview');

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
    } else {
      camera.resetToFullTrack();
    }
  }, [camera]);

  const handleSpeedChange = useCallback((speed: number) => {
    simulation.setSpeed(speed);
    setSpeedMultiplier(simulation.speedMultiplier);
    setIsPaused(simulation.isPaused);
  }, [simulation]);

  const handleResetRace = useCallback(() => {
    simulation.initRace();
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setLightState('idle');
    setIsFinished(false);
    simulation.startRaceSequence();
  }, [simulation, camera]);

  const handleStartRaceFromHome = useCallback(() => {
    simulation.setCircuit(selectedCircuitId);
    camera.resetToFullTrack();
    setSelectedCarId(null);
    setIsFinished(false);
    setCurrentView('race');
    simulation.startRaceSequence();
  }, [simulation, camera, selectedCircuitId]);

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

      const updatedHistory = [newHistoryItem, ...raceHistory].slice(0, 10);
      setRaceHistory(updatedHistory);
      try {
        localStorage.setItem('f1_race_history', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error(e);
      }
    }

    setCurrentView('home');
  }, [simulation, selectedDriverId, selectedCircuitId, raceHistory]);

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
  const selectedCar = selectedCarId !== null ? simulation.getCarById(selectedCarId) || null : null;
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
      />
    );
  }

  return (
    <div className={styles.appContainer}>
      {/* ── 1. TIMING TOWER IZQUIERDA ── */}
      <div className={`${styles.leftSidebar} ${leftSidebarOpen ? '' : styles.sidebarCollapsed}`}>
        {leftSidebarOpen && (
          <Leaderboard
            cars={cars}
            selectedCarId={selectedCarId}
            onSelectCar={handleSelectCar}
            fastestLapDriverName={fastestLapDriver}
            leaderLap={leaderLap}
          />
        )}
        <button 
          className={`${styles.sidebarToggle} ${styles.sidebarToggleLeft}`} 
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          title={leftSidebarOpen ? "Ocultar Timing Tower" : "Mostrar Timing Tower"}
        >
          {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* ── 2. VISTA CENTRAL DE CARRERA (CANVAS + OVERLAYS) ── */}
      <div className={styles.mainRaceView}>
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
        />

        {lightState === 'formation-lap' && (
          <div className={styles.formationBanner}>
            <RotateCw size={16} className={styles.spinIcon} />
            <span>VUELTA DE FORMACIÓN EN CURSO</span>
          </div>
        )}

        <div className={styles.topBarOverlay}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className={styles.homeBtn} 
              onClick={() => setCurrentView('home')}
              title="Volver a la selección"
            >
              <ArrowLeft size={14} />
              <span>GPs</span>
            </button>
            <RaceHeader circuit={activeCircuitSpec} />
            <button
              className={styles.cameraBadge}
              onClick={handleCycleCameraMode}
              title="Pulsar 'C' para cambiar vista de cámara"
            >
              <CameraIcon size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              <span>{cameraMode.toUpperCase()}</span>
            </button>
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
        </div>

        {/* ── HUD INFERIOR: CENTRADO DINÁMICAMENTE ── */}
        <div className={styles.bottomDockWrapper}>
          <BottomTelemetryDock
            car={selectedCar || favoriteCar}
            onSelectCar={handleSelectCar}
          />
        </div>

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

        {isFinished && podiumCars.length >= 3 && (
          <PodiumModal
            podiumCars={podiumCars}
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
            event={activeLuckEvent}
            onApplyReward={(id) => {
              simulation.applyLuckEventReward(id);
              simulation.activeLuckEvent = null;
              setActiveLuckEvent(null);
            }}
            onDismiss={() => {
              simulation.activeLuckEvent = null;
              setActiveLuckEvent(null);
            }}
          />
        )}
      </div>

      {/* ── 3. PANEL DERECHO: DASHBOARD AVANZADO & ESTADO DE PISTA ── */}
      <div className={`${styles.rightSidebar} ${rightSidebarOpen ? '' : styles.sidebarCollapsed}`}>
        <button 
          className={`${styles.sidebarToggle} ${styles.sidebarToggleRight}`} 
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          title={rightSidebarOpen ? "Ocultar Panel de Telemetría" : "Mostrar Panel de Telemetría"}
        >
          {rightSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        {rightSidebarOpen && (
          <RightStatsPanel
            car={selectedCar}
            defaultCar={favoriteCar}
            totalLaps={simulation.totalLaps}
            overallBestS1={bestS1}
            overallBestS2={bestS2}
            overallBestS3={bestS3}
            weather={weather}
          />
        )}
      </div>
    </div>
  );
};

export default App;
