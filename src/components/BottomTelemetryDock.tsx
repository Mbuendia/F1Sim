import React, { useEffect, useRef } from 'react';
import styles from './BottomTelemetryDock.module.css';
import { CarState } from '../types/f1';
import { 
  Zap,
  Gauge, 
  ChevronUp, 
  ChevronDown
} from 'lucide-react';
import { animate } from 'animejs';

export interface BottomTelemetryDockProps {
  car: CarState | null;
  onSelectCar: (carId: number | null) => void;
}

export const BottomTelemetryDock: React.FC<BottomTelemetryDockProps> = ({
  car,
  onSelectCar
}) => {
  const dockRef = useRef<HTMLDivElement>(null);
  const prevCarIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (car && car.id !== prevCarIdRef.current && dockRef.current) {
      animate(dockRef.current, {
        translateY: [10, 0],
        opacity: [0.8, 1],
        scale: [0.98, 1],
        ease: 'outElastic(1, .8)',
        duration: 500
      });
      prevCarIdRef.current = car.id;
    }
  }, [car?.id]);

  if (!car) {
    return (
      <div className={styles.dockEmpty}>
        <span className={styles.emptyHint}>👈 SELECCIONA UN PILOTO EN LA TABLA O EN LA PISTA PARA VER SU TELEMETRÍA EN VIVO</span>
      </div>
    );
  }

  const { driver, team, telemetry, tires, currentPosition, aheadInfo, behindInfo } = car;
  const rpmPercent = Math.min(100, Math.max(0, ((telemetry.rpm - 8000) / (13500 - 8000)) * 100));

  const getCompoundColor = (compound: string) => {
    switch (compound) {
      case 'soft': return '#e10600';
      case 'medium': return '#ffd700';
      case 'hard': return '#ffffff';
      default: return '#cbd5e1';
    }
  };

  const compoundColor = getCompoundColor(tires.compound);

  return (
    <div ref={dockRef} className={styles.dockContainer}>
      {/* ── 1. COCHE DE DELANTE ── */}
      <div className={styles.relativeCarCard}>
        <div className={styles.relativeHeader}>
          <ChevronUp size={14} color="#38bdf8" />
          <span>COCHE DELANTE</span>
        </div>
        {aheadInfo ? (
          <div 
            className={styles.relativeContent} 
            style={{ borderLeftColor: aheadInfo.teamColor }}
            onClick={() => onSelectCar(aheadInfo.id)}
          >
            <div className={styles.relPosBadge}>P{aheadInfo.position}</div>
            <div className={styles.relDriverInfo}>
              <div className={styles.relDriverName}>{aheadInfo.driverName}</div>
              <div className={styles.relTeamName}>{aheadInfo.teamName}</div>
            </div>
            <div className={styles.relGap}>+{aheadInfo.gapSec.toFixed(1)}s</div>
          </div>
        ) : (
          <div className={styles.relativeEmptyLeader}>
            <span>👑 LÍDER DE CARRERA (P1)</span>
          </div>
        )}
      </div>

      {/* ── 2. PILOTO SELECCIONADO (CENTRO) ── */}
      <div className={styles.mainPilotCard} style={{ borderTopColor: team.color }}>
        <div className={styles.pilotIdentity}>
          <div className={styles.pilotPosBig}>P{currentPosition}</div>
          <div className={styles.pilotNameGroup}>
            <div className={styles.pilotNameTop}>
              <span className={styles.pilotFlag}>{driver.countryFlag}</span>
              <span className={styles.pilotName}>{driver.firstName} {driver.lastName}</span>
              <span className={styles.pilotNum} style={{ color: team.color }}>#{driver.number}</span>
            </div>
            <span className={styles.pilotTeam}>{team.name}</span>
          </div>
        </div>

        {/* Velocidad y Tacómetro */}
        <div className={styles.speedCluster}>
          <div className={styles.speedDigits}>
            {telemetry.speedKmh} <span className={styles.kmhUnit}>KM/H</span>
          </div>
          <div className={styles.gearPill}>
            <span className={styles.gearLabel}>GEAR</span>
            <span className={styles.gearVal}>{telemetry.gear}</span>
          </div>
          <div className={styles.rpmBar}>
            <div className={styles.rpmProgress} style={{ width: `${rpmPercent}%` }} />
          </div>
          <span style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px', fontFamily: 'Orbitron' }}>
            {telemetry.rpm.toLocaleString()} RPM
          </span>
        </div>

        {/* Neumáticos */}
        <div className={styles.tireCluster}>
          <div className={styles.tireTopRow}>
            <div 
              className={styles.compoundPill} 
              style={{ 
                backgroundColor: compoundColor, 
                color: tires.compound === 'hard' ? '#000000' : '#ffffff' 
              }}
            >
              {tires.compound.toUpperCase()} ({tires.lapsOnTire} VUELTAS)
            </div>
            <div className={styles.tireHealthText} style={{ color: tires.health < 25 ? '#ef4444' : '#22c55e' }}>
              {Math.round(tires.health)}% VIDA
            </div>
          </div>
          <div className={styles.fourWheelsRow}>
            <span style={{ color: telemetry.tireHealthFL < 30 ? '#ef4444' : '#94a3b8' }}>FL:{Math.round(telemetry.tireHealthFL)}%</span>
            <span style={{ color: telemetry.tireHealthFR < 30 ? '#ef4444' : '#94a3b8' }}>FR:{Math.round(telemetry.tireHealthFR)}%</span>
            <span style={{ color: telemetry.tireHealthRL < 30 ? '#ef4444' : '#94a3b8' }}>RL:{Math.round(telemetry.tireHealthRL)}%</span>
            <span style={{ color: telemetry.tireHealthRR < 30 ? '#ef4444' : '#94a3b8' }}>RR:{Math.round(telemetry.tireHealthRR)}%</span>
          </div>
        </div>

        {/* Estado / DRS / Motor */}
        <div className={styles.statusCluster}>
          <div className={styles.statItem}>
            <span className={`${styles.drsPill} ${telemetry.drsActive ? styles.drsOn : styles.drsOff}`}>
              <Zap size={13} /> DRS {telemetry.drsActive ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className={styles.statItem}>
            <Gauge size={13} color="#38bdf8" />
            <span>MODO: {telemetry.engineMode.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* ── 3. COCHE DE DETRÁS ── */}
      <div className={styles.relativeCarCard}>
        <div className={styles.relativeHeader}>
          <ChevronDown size={14} color="#f97316" />
          <span>COCHE DETRÁS</span>
        </div>
        {behindInfo ? (
          <div 
            className={styles.relativeContent} 
            style={{ borderLeftColor: behindInfo.teamColor }}
            onClick={() => onSelectCar(behindInfo.id)}
          >
            <div className={styles.relPosBadge}>P{behindInfo.position}</div>
            <div className={styles.relDriverInfo}>
              <div className={styles.relDriverName}>{behindInfo.driverName}</div>
              <div className={styles.relTeamName}>{behindInfo.teamName}</div>
            </div>
            <div className={styles.relGap}>+{behindInfo.gapSec.toFixed(1)}s</div>
          </div>
        ) : (
          <div className={styles.relativeEmptyLast}>
            <span>🏁 ÚLTIMO COCHE EN PISTA</span>
          </div>
        )}
      </div>
    </div>
  );
};
