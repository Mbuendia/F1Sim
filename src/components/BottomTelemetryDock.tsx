import React from 'react';
import styles from './BottomTelemetryDock.module.css';
import { CarState } from '../types/f1';
import { Gauge, Fuel, Wind, ChevronUp, ChevronDown, Trophy, Zap } from 'lucide-react';

interface BottomTelemetryDockProps {
  car: CarState | null;
  onSelectCar: (carId: number) => void;
}

export const BottomTelemetryDock: React.FC<BottomTelemetryDockProps> = ({
  car,
  onSelectCar
}) => {
  if (!car) {
    return (
      <div className={styles.dockEmpty}>
        <span className={styles.emptyHint}>
          💡 Selecciona un piloto en la tabla de tiempos o en el circuito para ver la telemetría en tiempo real
        </span>
      </div>
    );
  }

  const { driver, team, telemetry, tires, currentPosition, aheadInfo, behindInfo } = car;

  const getTireHealthColor = (health: number) => {
    if (health > 70) return '#22c55e';
    if (health > 40) return '#eab308';
    if (health > 20) return '#f97316';
    return '#ef4444';
  };

  const getCompoundBadge = (compound: string) => {
    switch (compound) {
      case 'soft': return { label: 'SOFT', color: '#e10600', text: '#ffffff' };
      case 'medium': return { label: 'MEDIUM', color: '#ffd700', text: '#000000' };
      case 'hard': return { label: 'HARD', color: '#ffffff', text: '#000000' };
      default: return { label: 'MEDIUM', color: '#ffd700', text: '#000000' };
    }
  };

  const compoundInfo = getCompoundBadge(tires.compound);

  return (
    <div className={styles.dockContainer}>
      {/* ── 1. COCHE DE DELANTE ── */}
      <div className={styles.relativeCarCard}>
        <div className={styles.relativeHeader}>
          <ChevronUp size={14} color="#38bdf8" />
          <span>COCHE DE DELANTE</span>
        </div>
        {aheadInfo ? (
          <div
            className={styles.relativeContent}
            onClick={() => onSelectCar(aheadInfo.id)}
            style={{ borderLeftColor: aheadInfo.teamColor }}
            title="Clic para enfocar a este piloto"
          >
            <div className={styles.relPosBadge}>P{aheadInfo.position}</div>
            <div className={styles.relDriverInfo}>
              <div className={styles.relDriverName}>{aheadInfo.driverName}</div>
              <div className={styles.relTeamName}>{aheadInfo.teamName}</div>
            </div>
            <div className={styles.relGap}>-{aheadInfo.gapSec}s</div>
          </div>
        ) : (
          <div className={styles.relativeEmptyLeader}>
            <Trophy size={14} color="#ffd700" />
            <span>NINGUNO · LÍDER DE CARRERA</span>
          </div>
        )}
      </div>

      {/* ── 2. TELEMETRÍA DEL PILOTO SELECCIONADO (CENTRAL) ── */}
      <div className={styles.mainPilotCard} style={{ borderTopColor: team.color }}>
        {/* Identidad del piloto */}
        <div className={styles.pilotIdentity}>
          <div className={styles.pilotPosBig}>P{currentPosition}</div>
          <div className={styles.pilotNameGroup}>
            <div className={styles.pilotNameTop}>
              <span className={styles.pilotFlag}>{driver.countryFlag}</span>
              <span className={styles.pilotName}>{driver.firstName} {driver.lastName}</span>
              <span className={styles.pilotNum} style={{ color: team.color }}>#{driver.number}</span>
            </div>
            <div className={styles.pilotTeam}>{team.name}</div>
          </div>
        </div>

        {/* Velocímetro, Marcha, RPM */}
        <div className={styles.speedCluster}>
          <div className={styles.speedDigits}>{telemetry.speedKmh} <span className={styles.kmhUnit}>KM/H</span></div>
          <div className={styles.gearPill}>
            <span className={styles.gearLabel}>GEAR</span>
            <span className={styles.gearVal}>{telemetry.gear}</span>
          </div>
          <div className={styles.rpmBar}>
            <div className={styles.rpmProgress} style={{ width: `${Math.min(100, (telemetry.rpm / 14000) * 100)}%` }} />
          </div>
        </div>

        {/* Neumáticos y Salud */}
        <div className={styles.tireCluster}>
          <div className={styles.tireTopRow}>
            <span
              className={styles.compoundPill}
              style={{ backgroundColor: compoundInfo.color, color: compoundInfo.text }}
            >
              {compoundInfo.label}
            </span>
            <span className={styles.tireHealthText} style={{ color: getTireHealthColor(telemetry.tireWear) }}>
              {telemetry.tireWear}% VIDA
            </span>
          </div>
          <div className={styles.fourWheelsRow}>
            <span style={{ color: getTireHealthColor(telemetry.tireHealthFL) }}>FL: {telemetry.tireHealthFL}%</span>
            <span style={{ color: getTireHealthColor(telemetry.tireHealthFR) }}>FR: {telemetry.tireHealthFR}%</span>
            <span style={{ color: getTireHealthColor(telemetry.tireHealthRL) }}>RL: {telemetry.tireHealthRL}%</span>
            <span style={{ color: getTireHealthColor(telemetry.tireHealthRR) }}>RR: {telemetry.tireHealthRR}%</span>
          </div>
        </div>

        {/* Combustible, Modo Motor, DRS */}
        <div className={styles.statusCluster}>
          <div className={styles.statItem}>
            <Fuel size={12} color="#94a3b8" />
            <span>{telemetry.fuelKg} kg</span>
          </div>
          <div className={styles.statItem}>
            <Zap size={12} color="#eab308" />
            <span>ESTÁNDAR</span>
          </div>
          <div className={`${styles.drsPill} ${telemetry.drsActive ? styles.drsOn : styles.drsOff}`}>
            <Wind size={11} />
            <span>{telemetry.drsActive ? 'DRS ON' : 'DRS OFF'}</span>
          </div>
        </div>
      </div>

      {/* ── 3. COCHE DE DETRÁS ── */}
      <div className={styles.relativeCarCard}>
        <div className={styles.relativeHeader}>
          <ChevronDown size={14} color="#f97316" />
          <span>COCHE DE DETRÁS</span>
        </div>
        {behindInfo ? (
          <div
            className={styles.relativeContent}
            onClick={() => onSelectCar(behindInfo.id)}
            style={{ borderLeftColor: behindInfo.teamColor }}
            title="Clic para enfocar a este piloto"
          >
            <div className={styles.relPosBadge}>P{behindInfo.position}</div>
            <div className={styles.relDriverInfo}>
              <div className={styles.relDriverName}>{behindInfo.driverName}</div>
              <div className={styles.relTeamName}>{behindInfo.teamName}</div>
            </div>
            <div className={styles.relGap}>+{behindInfo.gapSec}s</div>
          </div>
        ) : (
          <div className={styles.relativeEmptyLast}>
            <span>NINGUNO · ÚLTIMA POSICIÓN</span>
          </div>
        )}
      </div>
    </div>
  );
};
