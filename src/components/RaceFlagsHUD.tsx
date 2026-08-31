import React from 'react';
import { RaceFlagState, SafetyCarState } from '../types/f1';
import styles from './RaceFlagsHUD.module.css';

interface RaceFlagsHUDProps {
  raceFlagState: RaceFlagState;
  sectorFlags: [RaceFlagState, RaceFlagState, RaceFlagState];
  safetyCar: SafetyCarState | null;
}

const FLAG_CONFIG: Record<RaceFlagState, { icon: string; label: string; className: string; subtextClass: string }> = {
  'green':         { icon: '🟢', label: 'GREEN FLAG',             className: 'greenFlag',       subtextClass: '' },
  'yellow':        { icon: '🟡', label: 'YELLOW FLAG',            className: 'yellowFlag',      subtextClass: 'yellowSubtext' },
  'double-yellow': { icon: '🟡🟡', label: 'DOUBLE YELLOW',       className: 'doubleYellowFlag', subtextClass: 'yellowSubtext' },
  'vsc':           { icon: '⚡', label: 'VSC — DELTA TIME',       className: 'vscFlag',         subtextClass: 'scSubtext' },
  'sc':            { icon: '🚗', label: 'SAFETY CAR DEPLOYED',    className: 'scFlag',          subtextClass: 'scSubtext' },
  'red':           { icon: '🔴', label: 'RED FLAG — SUSPENDED',   className: 'redFlag',         subtextClass: 'redSubtext' },
};

function getSectorDotClass(flag: RaceFlagState): string {
  switch (flag) {
    case 'yellow': return styles.sectorYellow;
    case 'double-yellow': return styles.sectorDoubleYellow;
    default: return styles.sectorGreen;
  }
}

const RaceFlagsHUD: React.FC<RaceFlagsHUDProps> = ({ raceFlagState, sectorFlags, safetyCar }) => {
  const config = FLAG_CONFIG[raceFlagState];
  
  // No mostrar banner verde a menos que haya sectores con bandera
  const hasAnySectorFlag = sectorFlags.some(f => f !== 'green');
  if (raceFlagState === 'green' && !hasAnySectorFlag) return null;

  // Subtexto contextual
  let subtext = '';
  if (raceFlagState === 'sc' && safetyCar) {
    if (safetyCar.mode === 'deploying') {
      subtext = `Desplegando Safety Car — ${safetyCar.triggerReason}`;
    } else if (safetyCar.mode === 'leading') {
      subtext = `Vuelta ${safetyCar.lapCount + 1} de ${safetyCar.targetLaps} — ${safetyCar.triggerReason}`;
    } else if (safetyCar.mode === 'returning') {
      subtext = 'Safety Car entrando en boxes — Preparar restart';
    }
  } else if (raceFlagState === 'vsc') {
    subtext = 'Mantener delta positivo — Adelantamientos prohibidos';
  } else if (raceFlagState === 'red') {
    subtext = 'Carrera detenida — Esperando limpieza de pista';
  } else if (raceFlagState === 'yellow' || raceFlagState === 'double-yellow') {
    const yellowSectors = sectorFlags
      .map((f, i) => (f !== 'green' ? `S${i + 1}` : null))
      .filter(Boolean)
      .join(', ');
    subtext = yellowSectors ? `Sector${yellowSectors.includes(',') ? 'es' : ''}: ${yellowSectors}` : '';
  }

  return (
    <div className={styles.flagsContainer}>
      {/* Banner principal */}
      <div className={`${styles.flagBanner} ${styles[config.className]}`}>
        <span className={styles.flagIcon}>{config.icon}</span>
        <span>{config.label}</span>
      </div>

      {/* Subtexto */}
      {subtext && (
        <div className={`${styles.flagSubtext} ${config.subtextClass ? styles[config.subtextClass] : ''}`}>
          {subtext}
        </div>
      )}

      {/* Barra de sectores */}
      {hasAnySectorFlag && (
        <div className={styles.sectorBar}>
          {sectorFlags.map((flag, i) => (
            <div key={i} className={`${styles.sectorDot} ${getSectorDotClass(flag)}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RaceFlagsHUD;
