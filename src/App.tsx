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
import { StartLightState, CarState } from './types/f1';
import { RotateCw, Flag } from 'lucide-react';

export const App: React.FC = () => {
  const simulation = useMemo(() => new RaceSimulation(), []);
  const camera = useMemo(() => new Camera(), []);

  // Piloto seleccionado expresamente en pista/tabla (o null para ver vista general)
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  
  // Piloto protagonista favorito elegido al inicio (por defecto Fernando Alonso id=6)
  const [favoriteCarId, setFavoriteCarId] = useState<number>(6);

  const [lightState, setLightState] = useState<StartLightState>(simulation.lightState);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(simulation.speedMultiplier);
  const [isPaused, setIsPaused] = useState<boolean>(simulation.isPaused);
  const [leaderLap, setLeaderLap] = useState<number>(0);
  const [raceTimeSec, setRaceTimeSec] = useState<number>(0);
  const [cars, setCars] = useState<CarState[]>(simulation.cars);
  const [fastestLapDriver, setFastestLapDriver] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [podiumCars, setPodiumCars] = useState<CarState[]>([]);
  
  // Tiempos récord de sectores
  const [bestS1, setBestS1] = useState<number | null>(null);
  const [bestS2, setBestS2] = useState<number | null>(null);
  const [bestS3, setBestS3] = useState<number | null>(null);

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

      if (simulation.isFinished) {
        setPodiumCars(simulation.podiumCars);
      }
      if (simulation.fastestLap) {
        setFastestLapDriver(simulation.fastestLap.driverName);
      }
    }, 66);

    return () => clearInterval(interval);
  }, [simulation]);

  const handleSelectCar = useCallback((carId: number | null) => {
    setSelectedCarId(carId);
    if (carId !== null) {
      camera.followCar(carId);
    } else {
      camera.resetToFullTrack();
    }
  }, [camera]);

  const handleSelectFavoriteCar = useCallback((carId: number) => {
    setFavoriteCarId(carId);
  }, []);

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
  }, [simulation, camera]);

  const handleStartRace = useCallback(() => {
    simulation.startRaceSequence();
  }, [simulation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSelectCar(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleSpeedChange(isPaused ? 1 : 0);
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
  }, [handleSelectCar, handleSpeedChange, isPaused]);

  const formatRaceTime = (totalSec: number): string => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedCar = selectedCarId !== null ? simulation.getCarById(selectedCarId) || null : null;
  const favoriteCar = simulation.getCarById(favoriteCarId) || simulation.cars[0] || null;

  return (
    <div className={styles.appContainer}>
      {/* ── 1. TIMING TOWER / LEADERBOARD IZQUIERDA ── */}
      <div className={styles.leftSidebar}>
        <Leaderboard
          cars={cars}
          selectedCarId={selectedCarId}
          onSelectCar={handleSelectCar}
          fastestLapDriverName={fastestLapDriver}
          leaderLap={leaderLap}
        />
      </div>

      {/* ── 2. CANVAS DEL CIRCUITO + CONTROLES + DOCK INFERIOR ── */}
      <div className={styles.mainRaceView}>
        <RaceCanvas
          simulation={simulation}
          camera={camera}
          selectedCarId={selectedCarId}
          onSelectCar={handleSelectCar}
        />

        {/* Banner durante la vuelta de formación */}
        {lightState === 'formation-lap' && (
          <div className={styles.formationBanner}>
            <RotateCw size={14} className={styles.spinIcon} />
            <span>VUELTA DE FORMACIÓN · CALENTANDO NEUMÁTICOS EN TRETECITO</span>
          </div>
        )}

        {lightState === 'grid-parking' && (
          <div className={styles.formationBanner} style={{ borderColor: '#eab308', color: '#eab308' }}>
            <Flag size={14} />
            <span>PARRILLA FORMÁNDOSE · ESPERANDO A QUE APARQUE P20...</span>
          </div>
        )}

        {/* Header superior y Controles de velocidad */}
        <div className={styles.topBarOverlay}>
          <RaceHeader />
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

        {/* Dock inferior central */}
        <div className={styles.bottomDockWrapper}>
          <BottomTelemetryDock
            car={selectedCar || favoriteCar}
            onSelectCar={handleSelectCar}
          />
        </div>

        {/* Semáforo de salida con Selector de Piloto Protagonista */}
        <StartLights
          lightState={lightState}
          cars={cars}
          favoriteCarId={favoriteCarId}
          onSelectFavoriteCar={handleSelectFavoriteCar}
          onStartClick={handleStartRace}
        />

        {/* Modal de Podio al terminar */}
        {isFinished && podiumCars.length >= 3 && (
          <PodiumModal
            podiumCars={podiumCars}
            onRestart={handleResetRace}
          />
        )}
      </div>

      {/* ── 3. PANEL DERECHO: DASHBOARD AVANZADO (GRÁFICA PREVISIÓN + 66 VUELTAS) ── */}
      <div className={styles.rightSidebar}>
        <RightStatsPanel
          car={selectedCar}
          defaultCar={favoriteCar}
          totalLaps={simulation.totalLaps}
          overallBestS1={bestS1}
          overallBestS2={bestS2}
          overallBestS3={bestS3}
        />
      </div>
    </div>
  );
};

export default App;
