import React from 'react';
import styles from './Leaderboard.module.css';
import { CarState } from '../types/f1';
import { Timer } from 'lucide-react';

interface LeaderboardProps {
  cars: CarState[];
  selectedCarId: number | null;
  onSelectCar: (carId: number) => void;
  fastestLapDriverName: string | null;
  leaderLap: number;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  cars,
  selectedCarId,
  onSelectCar,
  fastestLapDriverName
}) => {
  const sortedCars = [...cars].sort((a, b) => a.currentPosition - b.currentPosition);
  const leader = sortedCars[0];
  const leaderProgress = leader ? leader.progress : 0;
  const leaderFloorLap = Math.max(0, Math.floor(leaderProgress));

  const formatGap = (car: CarState, index: number): string => {
    if (index === 0) return 'LÍDER';
    if (car.pitStop.isPitting) return 'PIT';

    // Doblados
    const carFloorLap = Math.max(0, Math.floor(car.progress));
    const lapsBehind = leaderFloorLap - carFloorLap;

    if (lapsBehind >= 1) {
      return lapsBehind === 1 ? '+1 LAP' : `+${lapsBehind} LAPS`;
    }

    if (car.gapToLeaderSec >= 60) {
      const mins = Math.floor(car.gapToLeaderSec / 60);
      const secs = car.gapToLeaderSec % 60;
      return `+${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(1)}`;
    }
    return `+${car.gapToLeaderSec.toFixed(1)}s`;
  };

  const getCompoundDotColor = (compound: string) => {
    switch (compound) {
      case 'soft': return '#e10600';
      case 'medium': return '#ffd700';
      case 'hard': return '#ffffff';
      default: return '#ffd700';
    }
  };

  return (
    <div className={styles.towerContainer}>
      <div className={styles.header}>
        <div className={styles.f1Brand}>F1 TIMING</div>
        <span className={styles.headerTitle}>POSICIONES</span>
      </div>

      <div className={styles.tableList}>
        {sortedCars.map((car, idx) => {
          const isSelected = car.id === selectedCarId;
          const isFastest = fastestLapDriverName === `${car.driver.firstName} ${car.driver.lastName}`;
          const isLeader = idx === 0;

          return (
            <div
              key={car.id}
              className={`${styles.row} ${isSelected ? styles.selected : ''} ${isLeader ? styles.leaderRow : ''}`}
              onClick={() => onSelectCar(car.id)}
              style={{ borderLeftColor: car.team.color }}
              title={`Clic para seguir a ${car.driver.firstName} ${car.driver.lastName}`}
            >
              {/* Posición */}
              <div className={styles.posCell}>
                <span className={styles.posNum}>{car.currentPosition}</span>
              </div>

              {/* Barra color equipo */}
              <div className={styles.teamBar} style={{ backgroundColor: car.team.color }} />

              {/* Piloto */}
              <div className={styles.driverCell}>
                <div className={styles.driverNameRow}>
                  <span className={styles.driverCode}>{car.driver.code}</span>
                  <span className={styles.driverLastName}>{car.driver.lastName}</span>
                  {isFastest && (
                    <span className={styles.fastestLapBadge} title="Vuelta rápida de carrera">
                      <Timer size={9} color="#c084fc" />
                    </span>
                  )}
                </div>
              </div>

              {/* Neumáticos y Boxes */}
              <div className={styles.tireCell}>
                <span
                  className={styles.tireDot}
                  style={{ backgroundColor: getCompoundDotColor(car.tires.compound) }}
                  title={`Neumático ${car.tires.compound.toUpperCase()} - Salud: ${Math.round(car.tires.health)}%`}
                />
                {car.pitStop.totalPitStops > 0 && (
                  <span className={styles.pitCountBadge}>{car.pitStop.totalPitStops}P</span>
                )}
              </div>

              {/* Gap */}
              <div className={styles.gapCell}>
                <span className={`${styles.gapText} ${isLeader ? styles.leaderText : ''}`}>
                  {formatGap(car, idx)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
