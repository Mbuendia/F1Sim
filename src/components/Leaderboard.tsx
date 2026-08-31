import React, { useEffect, useRef } from 'react';
import styles from './Leaderboard.module.css';
import { CarState } from '../types/f1';
import { Timer, AlertTriangle } from 'lucide-react';
import { animate, stagger } from 'animejs';

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      animate(`.${styles.row}`, {
        translateX: [-18, 0],
        opacity: [0, 1],
        delay: stagger(22),
        ease: 'outQuad',
        duration: 350
      });
    }
  }, []);

  const sortedCars = [...cars].sort((a, b) => a.currentPosition - b.currentPosition);
  const leader = sortedCars.find(c => c.status !== 'out') || sortedCars[0];
  const leaderProgress = leader ? leader.progress : 0;
  const leaderFloorLap = Math.max(0, Math.floor(leaderProgress));

  const formatGap = (car: CarState, index: number): string => {
    if (car.status === 'out') {
      if (car.dnfReason?.includes('MOTOR')) return '💥 DNF MOTOR';
      if (car.dnfReason?.includes('CAMBIOS')) return '⚙️ DNF CAMBIO';
      if (car.dnfReason?.includes('MGU-K') || car.dnfReason?.includes('HÍBRIDO')) return '🔌 DNF MGU-K';
      if (car.dnfReason?.includes('HIDRÁULICA')) return '💧 DNF HIDR.';
      return '❌ DNF';
    }
    if (car.hasPuncture) return 'PINCHAZO';
    if (index === 0) return 'LÍDER';
    if (car.pitStop.isPitting) return 'PIT';

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
    <div ref={containerRef} className={styles.towerContainer}>
      <div className={styles.header}>
        <div className={styles.f1Brand}>F1 TIMING</div>
        <span className={styles.headerTitle}>POSICIONES</span>
      </div>

      <div className={styles.tableList}>
        {sortedCars.map((car, idx) => {
          const isSelected = car.id === selectedCarId;
          const isFastest = fastestLapDriverName === `${car.driver.firstName} ${car.driver.lastName}`;
          const isLeader = idx === 0 && car.status !== 'out';
          const isOut = car.status === 'out';

          return (
            <div
              key={car.id}
              className={`${styles.row} ${isSelected ? styles.selected : ''} ${isLeader ? styles.leaderRow : ''} ${isOut ? styles.outRow : ''}`}
              onClick={() => onSelectCar(car.id)}
              style={{ borderLeftColor: isOut ? '#64748b' : car.team.color, opacity: isOut ? 0.6 : 1 }}
              title={isOut ? `ABANDONO: ${car.dnfReason || 'Fallo mecánico'}` : `Clic para seguir a ${car.driver.firstName} ${car.driver.lastName}`}
            >
              {/* Posición */}
              <div className={styles.posCell}>
                <span className={styles.posNum}>{isOut ? 'DNF' : car.currentPosition}</span>
              </div>

              {/* Barra color equipo */}
              <div className={styles.teamBar} style={{ backgroundColor: isOut ? '#ef4444' : car.team.color }} />

              {/* Piloto */}
              <div className={styles.driverCell}>
                <div className={styles.driverNameRow}>
                  <span className={styles.driverCode}>{car.driver.code}</span>
                  <span className={styles.driverLastName}>{car.driver.lastName}</span>
                  {isFastest && !isOut && (
                    <span className={styles.fastestLapBadge} title="Vuelta rápida de carrera">
                      <Timer size={9} color="#c084fc" />
                    </span>
                  )}
                  {car.hasPuncture && (
                    <span title="Pinchazo en neumático" style={{ color: '#ef4444' }}>
                      <AlertTriangle size={10} />
                    </span>
                  )}
                </div>
              </div>

              {/* Neumáticos y Boxes */}
              <div className={styles.tireCell}>
                {!isOut && (
                  <>
                    <span
                      className={styles.tireDot}
                      style={{ backgroundColor: getCompoundDotColor(car.tires.compound) }}
                      title={`Neumático ${car.tires.compound.toUpperCase()} - Salud: ${Math.round(car.tires.health)}%`}
                    />
                    {car.pitStop.totalPitStops > 0 && (
                      <span className={styles.pitCountBadge}>{car.pitStop.totalPitStops}P</span>
                    )}
                  </>
                )}
              </div>

              {/* Gap */}
              <div className={styles.gapCell}>
                <span className={`${styles.gapText} ${isLeader ? styles.leaderText : ''} ${isOut ? styles.outText : ''}`} style={{ color: isOut ? '#ef4444' : (car.hasPuncture ? '#f59e0b' : undefined) }}>
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
