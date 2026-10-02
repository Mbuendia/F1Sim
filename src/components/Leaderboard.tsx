import React, { useEffect, useRef } from 'react';
import styles from './Leaderboard.module.css';
import { CarState, RejoinEstimate } from '../types/f1';
import { Timer, AlertTriangle } from 'lucide-react';
import { animate, stagger } from 'animejs';
import { detectPositionChanges } from './positionChanges';
import { FlagIcon } from './FlagIcon';
import { CompoundBadge } from './CompoundBadge';

interface LeaderboardProps {
  cars: CarState[];
  selectedCarId: number | null;
  onSelectCar: (carId: number | null) => void;
  fastestLapDriverName: string | null;
  leaderLap: number;
  // [Q13] Estimación de reincorporación del piloto objetivo (motor), o motivo por el que no hay.
  rejoin?: RejoinEstimate | null;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  cars,
  selectedCarId,
  onSelectCar,
  fastestLapDriverName,
  rejoin = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Q23: el motor solo conserva previousPosition durante el paso del adelantamiento; la torre recuerda
  // cada cambio unos segundos para que el indicador sea visible y anima su aparición.
  const lastPositions = useRef(new Map<number, number>());
  const recentChanges = useRef(new Map<number, { delta: number; at: number }>());
  const POSITION_CHANGE_MS = 4000;

  useEffect(() => {
    // [R38] Solo si ya hay filas en pantalla (sin avisos «No target found»).
    const rows = containerRef.current?.querySelectorAll(`.${styles.row}`);
    if (rows && rows.length) {
      animate(rows, {
        translateX: [-18, 0],
        opacity: [0, 1],
        delay: stagger(22),
        ease: 'outQuad',
        duration: 350
      });
    }
  }, []);

  // [R38] Los cambios se detectan antes de pintar (así la flecha sale en este mismo render) y se animan después,
  // cuando el elemento ya está en el DOM: una vez por cambio y sin avisos «No target found».
  const pendingArrows = useRef<number[]>([]);
  for (const change of detectPositionChanges(lastPositions.current, cars)) {
    recentChanges.current.set(change.carId, { delta: change.delta, at: Date.now() });
    pendingArrows.current.push(change.carId);
  }

  useEffect(() => {
    const ids = pendingArrows.current;
    pendingArrows.current = [];
    for (const id of ids) {
      const arrow = containerRef.current?.querySelector(`[data-pos-car="${id}"]`);
      if (arrow) animate(arrow, { scale: [1.8, 1], opacity: [0, 1], duration: 450, ease: 'outBack' });
    }
  });

  const positionDelta = (car: CarState): number => {
    const fromEngine = (car.previousPosition ?? car.currentPosition) - car.currentPosition;
    if (fromEngine !== 0) return fromEngine;
    const recent = recentChanges.current.get(car.id);
    return recent && Date.now() - recent.at < POSITION_CHANGE_MS ? recent.delta : 0;
  };

  const sortedCars = [...cars].sort((a, b) => a.currentPosition - b.currentPosition);
  const leader = sortedCars.find(c => c.status !== 'out') || sortedCars[0];
  const leaderProgress = leader ? leader.progress : 0;
  const leaderFloorLap = Math.max(0, Math.floor(leaderProgress));

  // [Q13] Fila fantasma: dónde saldría el piloto objetivo si parase ahora (tras el coche P-1 de los demás).
  const rejoinCar = rejoin ? cars.find(c => c.id === rejoin.carId) : undefined;
  const rivals = rejoin ? sortedCars.filter(c => c.id !== rejoin.carId && c.status !== 'out') : [];
  const ghostAfterId = rejoin?.available && rejoin.projectedPos > 1 ? rivals[rejoin.projectedPos - 2]?.id : undefined;
  const renderRejoinGhost = () => {
    if (!rejoin?.available) return null;
    const range = rejoin.bestPos === rejoin.worstPos ? `P${rejoin.projectedPos}` : `P${rejoin.bestPos}–P${rejoin.worstPos}`;
    return (
      <div
        className={styles.rejoinGhost}
        data-rejoin-projection={rejoin.projectedPos}
        data-rejoin-estimate="true"
        data-rejoin-car={rejoin.carId}
        data-rejoin-source={rejoin.source}
        title={`Estimación si para ahora (±${rejoin.uncertaintySec.toFixed(0)} s: ${range}). Fuente: ${rejoin.source}`}
        style={{ borderLeftColor: rejoinCar?.team.color }}
      >
        <span className={styles.rejoinPos}>{`≈P${rejoin.projectedPos}`}</span>
        <span className={styles.rejoinLabel}>{`${rejoinCar?.driver.code ?? ''} TRAS BOXES`}</span>
        <span className={styles.rejoinRange}>{`${range} · −${rejoin.timeLossSec.toFixed(1)}s`}</span>
      </div>
    );
  };

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
    if (car.pitStop.waitingForBox) return 'QUEUE';
    if (car.pitStop.isPitting) return 'PIT';

    // [R02] Doblado: el motor cuenta las vueltas completas perdidas respecto al líder.
    const lapsBehind = car.lapsBehindLeader ?? 0;
    if (lapsBehind >= 1) return lapsBehind === 1 ? '+1 VUELTA' : `+${lapsBehind} VUELTAS`;

    if (car.gapToLeaderSec >= 60) {
      const mins = Math.floor(car.gapToLeaderSec / 60);
      const secs = car.gapToLeaderSec % 60;
      return `+${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(1)}`;
    }
    return `+${car.gapToLeaderSec.toFixed(1)}s`;
  };

  return (
    <div ref={containerRef} className={styles.towerContainer}>
      <div className={styles.header}>
        <div className={styles.f1Brand}>F1 TIMING</div>
        <span className={styles.headerTitle}>POSICIONES</span>
      </div>

      <div className={styles.tableList}>
        {rejoin?.available && rejoin.projectedPos === 1 && renderRejoinGhost()}
        {sortedCars.map((car, idx) => {
          const isSelected = car.id === selectedCarId;
          const isFastest = fastestLapDriverName === `${car.driver.firstName} ${car.driver.lastName}`;
          const isLeader = idx === 0 && car.status !== 'out';
          const isOut = car.status === 'out';
          const delta = isOut ? 0 : positionDelta(car);
          const pitStatus = isOut ? null : car.pitStop.waitingForBox ? 'queue' : (car.pitStop.isPitting || car.isInPitLane) ? 'pitting' : null;

          return (
            <React.Fragment key={car.id}>
            <div
              className={`${styles.row} ${isSelected ? styles.selected : ''} ${isLeader ? styles.leaderRow : ''} ${isOut ? styles.outRow : ''}`}
              onClick={() => onSelectCar(isSelected ? null : car.id)}
              style={{ borderLeftColor: isOut ? '#64748b' : car.team.color, opacity: isOut ? 0.6 : 1 }}
              title={isOut ? `ABANDONO: ${car.dnfReason || 'Fallo mecánico'}` : isSelected ? `Clic para deseleccionar y volver a vista general (Overview)` : `Clic para seguir a ${car.driver.firstName} ${car.driver.lastName}`}
            >
              {/* Posición */}
              <div className={styles.posCell}>
                <span className={styles.posNum}>{isOut ? 'DNF' : car.currentPosition}</span>
                {delta !== 0 && (
                  <span
                    className={`position-change ${delta > 0 ? 'pos-up' : 'pos-down'} ${styles.posChange} ${delta > 0 ? styles.posUp : styles.posDown}`}
                    data-pos-change={delta > 0 ? 'up' : 'down'}
                    data-pos-delta={delta > 0 ? `+${delta}` : `${delta}`}
                    data-pos-car={car.id}
                    title={delta > 0 ? `Gana ${delta} ${delta === 1 ? 'puesto' : 'puestos'}` : `Pierde ${-delta} ${delta === -1 ? 'puesto' : 'puestos'}`}
                  >{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}</span>
                )}
              </div>

              {/* Barra color equipo */}
              <div className={styles.teamBar} style={{ backgroundColor: isOut ? '#ef4444' : car.team.color }} />

              {/* Piloto */}
              <div className={styles.driverCell}>
                <div className={styles.driverNameRow}>
                  <FlagIcon country={car.driver.country} emoji={car.driver.countryFlag} size={11} />
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
                    <CompoundBadge compound={car.tires.compound} size={16}
                      detail={`Salud ${Math.round(car.tires.health)}%`} />
                    {car.pitStop.totalPitStops > 0 && (
                      <span className={styles.pitCountBadge}>{car.pitStop.totalPitStops}P</span>
                    )}
                  </>
                )}
              </div>

              {/* Gap */}
              <div className={styles.gapCell}>
                {pitStatus ? (
                  <span className={`pit-pulse ${styles.pitPulse}`} data-pit-status={pitStatus}>
                    {pitStatus === 'queue' ? 'QUEUE' : 'PIT'}
                  </span>
                ) : (
                  <span className={`${styles.gapText} ${isLeader ? styles.leaderText : ''} ${isOut ? styles.outText : ''}`} style={{ color: isOut ? '#ef4444' : (car.hasPuncture ? '#f59e0b' : undefined) }}>
                    {formatGap(car, idx)}
                  </span>
                )}
              </div>
            </div>
            {car.id === ghostAfterId && renderRejoinGhost()}
            </React.Fragment>
          );
        })}
      </div>
      {rejoin && !rejoin.available && (
        <div
          className={styles.rejoinUnavailable}
          data-rejoin-projection="unavailable"
          data-rejoin-car={rejoin.carId}
          data-rejoin-reason={rejoin.reason}
        >
          {`Reincorporación ${rejoinCar?.driver.code ?? ''}: no disponible · ${rejoin.reason}`}
        </div>
      )}
    </div>
  );
};
