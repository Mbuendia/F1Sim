import React from 'react';
import styles from './TelemetryPanel.module.css';
import { CarState } from '../types/f1';
import { X, Gauge, Zap, Flame, Wind, Fuel, Shield, Sparkles, Trophy } from 'lucide-react';

interface TelemetryPanelProps {
  car: CarState;
  onClose: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ car, onClose }) => {
  const { driver, team, telemetry, tires, currentPosition, gapToLeaderSec } = car;

  // Color de salud de neumáticos
  const getTireHealthColor = (health: number) => {
    if (health > 70) return '#22c55e'; // Verde óptimo (fase lineal)
    if (health > 40) return '#eab308'; // Amarillo alerta (fase no lineal)
    if (health > 20) return '#f97316'; // Naranja cliff
    return '#ef4444';                  // Rojo crítico
  };

  // Modo motor label
  const getEngineModeDisplay = () => {
    switch (telemetry.engineMode) {
      case 'low': return { label: 'SAVE / ECO', color: '#38bdf8', icon: <Zap size={13} /> };
      case 'standard': return { label: 'ESTÁNDAR', color: '#e2e8f0', icon: <Gauge size={13} /> };
      case 'push': return { label: 'PUSH (+0.3s)', color: '#f59e0b', icon: <Flame size={13} /> };
      case 'overtake': return { label: 'OVERTAKE / MAX', color: '#ef4444', icon: <Flame size={13} /> };
    }
  };

  // Agresividad label
  const getAggressionDisplay = () => {
    switch (telemetry.aggression) {
      case 'conservative': return { label: 'CONSERVADOR', color: '#38bdf8' };
      case 'balanced': return { label: 'EQUILIBRADO', color: '#10b981' };
      case 'aggressive': return { label: 'AGRESIVO', color: '#f59e0b' };
      case 'maximum': return { label: 'AL LÍMITE', color: '#ef4444' };
    }
  };

  const engineInfo = getEngineModeDisplay();
  const aggInfo = getAggressionDisplay();

  return (
    <div className={styles.panel}>
      {/* Header del piloto */}
      <div className={styles.driverHeader} style={{ borderLeftColor: team.color }}>
        <div className={styles.driverIdentity}>
          <div className={styles.flagAndNumber}>
            <span className={styles.flag}>{driver.countryFlag}</span>
            <span className={styles.driverNumber} style={{ color: team.color }}>#{driver.number}</span>
          </div>
          <div>
            <h2 className={styles.driverFullName}>{driver.firstName} {driver.lastName}</h2>
            <div className={styles.teamName} style={{ color: team.color }}>{team.name}</div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.positionBadge}>
            <span className={styles.posLabel}>P</span>
            <span className={styles.posValue}>{currentPosition}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Cerrar telemetría (ESC)">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* RATINGS DEL PILOTO (Talento, Suerte, Palmarés) */}
      <div className={styles.ratingsCard}>
        <div className={styles.ratingsHeader}>
          <Sparkles size={12} color="#ffd700" />
          <span>PERFIL Y RATINGS DEL PILOTO</span>
        </div>
        <div className={styles.ratingsGrid}>
          <div className={styles.ratingItem}>
            <div className={styles.ratingLabel}>TALENTO PURO</div>
            <div className={styles.ratingBar}>
              <div className={styles.ratingFill} style={{ width: `${driver.talentRating * 100}%`, backgroundColor: '#38bdf8' }} />
            </div>
            <span className={styles.ratingNum}>{(driver.talentRating * 100).toFixed(0)}</span>
          </div>

          <div className={styles.ratingItem}>
            <div className={styles.ratingLabel}>FACTOR SUERTE</div>
            <div className={styles.ratingBar}>
              <div className={styles.ratingFill} style={{ width: `${driver.luckRating * 100}%`, backgroundColor: '#a855f7' }} />
            </div>
            <span className={styles.ratingNum}>{(driver.luckRating * 100).toFixed(0)}</span>
          </div>

          <div className={styles.ratingItem}>
            <div className={styles.ratingLabel}>CUIDADO GOMAS</div>
            <div className={styles.ratingBar}>
              <div className={styles.ratingFill} style={{ width: `${driver.tireManagement * 100}%`, backgroundColor: '#22c55e' }} />
            </div>
            <span className={styles.ratingNum}>{(driver.tireManagement * 100).toFixed(0)}</span>
          </div>

          <div className={styles.ratingItem}>
            <div className={styles.ratingLabel}>PALMARÉS HISTÓRICO</div>
            <div className={styles.palmaresBadges}>
              {driver.worldChampionships > 0 && (
                <span className={styles.wdcBadge} title="Títulos Mundiales">
                  <Trophy size={10} /> {driver.worldChampionships} WDC
                </span>
              )}
              <span className={styles.winsBadge}>
                {driver.careerWins} Victorias
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD TELEMETRÍA EN TIEMPO REAL */}
      <div className={styles.telemetryGrid}>
        {/* Velocidad y Marcha */}
        <div className={styles.cardSpeed}>
          <div className={styles.speedValue}>{telemetry.speedKmh} <span className={styles.speedUnit}>KM/H</span></div>
          <div className={styles.gearDisplay}>
            <span className={styles.gearLabel}>MARCHA</span>
            <span className={styles.gearNum}>{telemetry.gear}</span>
          </div>
          <div className={styles.rpmContainer}>
            <div className={styles.rpmFill} style={{ width: `${Math.min(100, (telemetry.rpm / 14000) * 100)}%` }} />
            <span className={styles.rpmText}>{telemetry.rpm} RPM</span>
          </div>
        </div>

        {/* DRS & Modo Motor */}
        <div className={styles.cardStatus}>
          <div className={styles.statusRow}>
            <span className={styles.statusTitle}><Wind size={12} /> DRS</span>
            <span className={`${styles.drsBadge} ${telemetry.drsActive ? styles.drsActive : (telemetry.drsAvailable ? styles.drsReady : styles.drsOff)}`}>
              {telemetry.drsActive ? 'DRS ABIERTO' : (telemetry.drsAvailable ? 'DISPONIBLE' : 'CERRADO')}
            </span>
          </div>

          <div className={styles.statusRow}>
            <span className={styles.statusTitle}><Zap size={12} /> MOTOR</span>
            <span className={styles.engineBadge} style={{ color: engineInfo.color, borderColor: engineInfo.color }}>
              {engineInfo.icon} {engineInfo.label}
            </span>
          </div>

          <div className={styles.statusRow}>
            <span className={styles.statusTitle}><Shield size={12} /> AGRESIVIDAD</span>
            <span className={styles.aggBadge} style={{ color: aggInfo.color }}>
              {aggInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* MODELO DE NEUMÁTICOS AVANZADO */}
      <div className={styles.tireCard}>
        <div className={styles.tireHeader}>
          <div className={styles.tireTitle}>
            <span>ESTADO DE NEUMÁTICOS</span>
            <span className={styles.compoundTag}>COMPUESTO: {tires.compound.toUpperCase()}</span>
          </div>
          <span className={styles.tireGlobalPct} style={{ color: getTireHealthColor(telemetry.tireWear) }}>
            {telemetry.tireWear}%
          </span>
        </div>

        {/* Barra de degradación (100% -> 70% lineal, <70% exponencial) */}
        <div className={styles.tireHealthBar}>
          <div
            className={styles.tireHealthFill}
            style={{
              width: `${telemetry.tireWear}%`,
              backgroundColor: getTireHealthColor(telemetry.tireWear)
            }}
          />
        </div>
        <div className={styles.tirePhaseNote}>
          {telemetry.tireWear >= 70 ? (
            <span className={styles.linearPhase}>Fase 1: Degradación lineal y óptima</span>
          ) : (
            <span className={styles.cliffPhase}>Fase 2: Caída no lineal (Influenciada por maltrato de motor/agresividad)</span>
          )}
        </div>

        {/* Desglose de las 4 ruedas */}
        <div className={styles.fourTiresGrid}>
          <div className={styles.wheelBox}>
            <span className={styles.wheelName}>FL (Del. Izq)</span>
            <span className={styles.wheelPct} style={{ color: getTireHealthColor(telemetry.tireHealthFL) }}>{telemetry.tireHealthFL}%</span>
          </div>
          <div className={styles.wheelBox}>
            <span className={styles.wheelName}>FR (Del. Der)</span>
            <span className={styles.wheelPct} style={{ color: getTireHealthColor(telemetry.tireHealthFR) }}>{telemetry.tireHealthFR}%</span>
          </div>
          <div className={styles.wheelBox}>
            <span className={styles.wheelName}>RL (Tras. Izq)</span>
            <span className={styles.wheelPct} style={{ color: getTireHealthColor(telemetry.tireHealthRL) }}>{telemetry.tireHealthRL}%</span>
          </div>
          <div className={styles.wheelBox}>
            <span className={styles.wheelName}>RR (Tras. Der)</span>
            <span className={styles.wheelPct} style={{ color: getTireHealthColor(telemetry.tireHealthRR) }}>{telemetry.tireHealthRR}%</span>
          </div>
        </div>
      </div>

      {/* COMBUSTIBLE Y PARADA EN BOXES */}
      <div className={styles.footerGrid}>
        <div className={styles.fuelBox}>
          <div className={styles.boxHeader}>
            <Fuel size={12} />
            <span>COMBUSTIBLE</span>
          </div>
          <div className={styles.fuelValue}>{telemetry.fuelKg} <span className={styles.unit}>kg</span></div>
          <div className={styles.fuelSub}>Consumo: {telemetry.fuelPerLap} kg/lap</div>
        </div>

        <div className={styles.pitBox}>
          <div className={styles.boxHeader}>
            <Gauge size={12} />
            <span>ESTRATEGIA BOXES</span>
          </div>
          <div className={styles.pitValue}>
            {car.pitStop.isPitting ? (
              <span className={styles.inPitTag}>EN BOXES...</span>
            ) : (
              <span>VUELTA {car.pitStop.scheduledLap}</span>
            )}
          </div>
          <div className={styles.pitSub}>Paradas realizadas: {car.pitStop.totalPitStops}</div>
        </div>
      </div>
    </div>
  );
};
