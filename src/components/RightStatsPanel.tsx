import React, { useEffect, useRef } from 'react';
import styles from './RightStatsPanel.module.css';
import { CarState } from '../types/f1';
import { 
  Flame, 
  Timer, 
  Wrench, 
  Award, 
  Activity,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { animate } from 'animejs';

export interface RightStatsPanelProps {
  car: CarState | null;
  totalLaps?: number;
  overallBestS1: number | null;
  overallBestS2: number | null;
  overallBestS3: number | null;
}

export const RightStatsPanel: React.FC<RightStatsPanelProps> = ({
  car,
  overallBestS1,
  overallBestS2,
  overallBestS3
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const pitBannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (car && panelRef.current) {
      animate(panelRef.current, {
        opacity: [0.85, 1],
        translateX: [12, 0],
        ease: 'outQuad',
        duration: 400
      });
    }
  }, [car?.id]);

  useEffect(() => {
    if (car?.pitStop.isPitting && pitBannerRef.current) {
      animate(pitBannerRef.current, {
        scale: [0.96, 1.03],
        alternate: true,
        loop: true,
        ease: 'inOutSine',
        duration: 500
      });
    }
  }, [car?.pitStop.isPitting]);

  if (!car) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyCard}>
          <Activity size={32} color="#475569" />
          <p>Selecciona un piloto para ver sectores en vivo, paradas y telemetría avanzada</p>
        </div>
      </div>
    );
  }

  const { sectors, pitStop, stats, driver, lastLapTime, bestLapTime } = car;

  const getSectorStyle = (
    currentSectorVal: number | null,
    personalBest: number | null,
    overallBest: number | null
  ) => {
    if (!currentSectorVal) return { color: '#94a3b8', bg: 'rgba(255,255,255,0.04)', status: '-' };

    if (overallBest && Math.abs(currentSectorVal - overallBest) < 0.005) {
      return { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.22)', border: '#c084fc', status: 'RÉCORD' };
    }
    if (personalBest && Math.abs(currentSectorVal - personalBest) < 0.005) {
      return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.22)', border: '#22c55e', status: 'MEJOR PERSONAL' };
    }
    return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', status: 'ESTÁNDAR' };
  };

  const s1Style = getSectorStyle(sectors.s1, sectors.personalBestS1, overallBestS1);
  const s2Style = getSectorStyle(sectors.s2, sectors.personalBestS2, overallBestS2);
  const s3Style = getSectorStyle(sectors.s3, sectors.personalBestS3, overallBestS3);

  return (
    <div ref={panelRef} className={styles.container}>
      {/* ── 1. SECTORES EN DIRECTO ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Timer size={15} color="#e10600" />
          <span>SECTORES EN DIRECTO (S1 / S2 / S3)</span>
        </div>

        <div className={styles.sectorsGrid}>
          <div 
            className={styles.sectorBox} 
            style={{ backgroundColor: s1Style.bg, borderColor: s1Style.border || 'transparent' }}
          >
            <span className={styles.sectorLabel}>SECTOR 1</span>
            <span className={styles.sectorTime} style={{ color: s1Style.color }}>
              {sectors.s1 ? `${sectors.s1.toFixed(3)}s` : '--.---'}
            </span>
            <span className={styles.sectorStatus} style={{ color: s1Style.color }}>
              {s1Style.status}
            </span>
          </div>

          <div 
            className={styles.sectorBox} 
            style={{ backgroundColor: s2Style.bg, borderColor: s2Style.border || 'transparent' }}
          >
            <span className={styles.sectorLabel}>SECTOR 2</span>
            <span className={styles.sectorTime} style={{ color: s2Style.color }}>
              {sectors.s2 ? `${sectors.s2.toFixed(3)}s` : '--.---'}
            </span>
            <span className={styles.sectorStatus} style={{ color: s2Style.color }}>
              {s2Style.status}
            </span>
          </div>

          <div 
            className={styles.sectorBox} 
            style={{ backgroundColor: s3Style.bg, borderColor: s3Style.border || 'transparent' }}
          >
            <span className={styles.sectorLabel}>SECTOR 3</span>
            <span className={styles.sectorTime} style={{ color: s3Style.color }}>
              {sectors.s3 ? `${sectors.s3.toFixed(3)}s` : '--.---'}
            </span>
            <span className={styles.sectorStatus} style={{ color: s3Style.color }}>
              {s3Style.status}
            </span>
          </div>
        </div>

        <div className={styles.lapTimesSummary}>
          <div className={styles.lapTimeRow}>
            <span className={styles.timeLabel}>Última Vuelta:</span>
            <span className={styles.timeVal}>{lastLapTime ? `${lastLapTime.toFixed(3)}s` : '--.---'}</span>
          </div>
          <div className={styles.lapTimeRow}>
            <span className={styles.timeLabel}>Mejor Vuelta:</span>
            <span className={styles.timeValBest}>{bestLapTime ? `${bestLapTime.toFixed(3)}s` : '--.---'}</span>
          </div>
        </div>
      </div>

      {/* ── 2. BOXES & PIT STOPS ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Wrench size={15} color="#eab308" />
          <span>ESTADO DE BOXES & PIT STOPS</span>
        </div>

        <div className={styles.pitDetailBox}>
          {pitStop.isPitting ? (
            <div ref={pitBannerRef} className={styles.pitActiveBanner}>
              <span className={styles.pitBlink}>🔴 EN BOXES AHORA MISMO</span>
              <span className={styles.pitCurrentTimer}>
                ⏱️ Tiempo parada: {pitStop.currentStopTimer.toFixed(2)}s / {pitStop.stopDuration}s
              </span>
            </div>
          ) : (
            <div className={styles.pitNormalStatus}>
              <div className={styles.pitStatRow}>
                <span>Paradas Realizadas:</span>
                <strong>{pitStop.totalPitStops}</strong>
              </div>
              <div className={styles.pitStatRow}>
                <span>Última Parada:</span>
                <strong>{pitStop.lastStopDuration ? `${pitStop.lastStopDuration.toFixed(2)}s` : 'Ninguna'}</strong>
              </div>
              <div className={styles.pitStatRow}>
                <span>Ventana Óptima:</span>
                <strong>Vuelta {stats.optimalPitLap}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. PREVISIÓN ESTRATÉGICA ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Activity size={15} color="#38bdf8" />
          <span>PREVISIÓN ESTRATÉGICA DE NEUMÁTICOS</span>
        </div>

        <div className={styles.forecastStatusBox}>
          {stats.willMakeToEndWithoutPit ? (
            <div className={styles.statusSuccess}>
              <CheckCircle2 size={16} color="#22c55e" />
              <div>
                <div className={styles.statusTitle}>LLEGA AL FINAL DE CARRERA</div>
                <div className={styles.statusSub}>El desgaste actual permite terminar sin más paradas.</div>
              </div>
            </div>
          ) : (
            <div className={styles.statusWarning}>
              <AlertTriangle size={16} color="#f59e0b" />
              <div>
                <div className={styles.statusTitle}>PARADA REQUERIDA</div>
                <div className={styles.statusSub}>Vida estimada de goma: ~{stats.projectedLapsRemainingOnTire} vueltas más.</div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.statsMiniGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>Vueltas a Tope (Push):</span>
            <span className={styles.miniValue}>{stats.pushLaps}</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>Vueltas Ahorro:</span>
            <span className={styles.miniValue}>{stats.savingLaps}</span>
          </div>
        </div>
      </div>

      {/* ── 4. TEMPERATURAS ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Flame size={15} color="#ef4444" />
          <span>TELEMETRÍA TÉRMICA & RENDIMIENTO</span>
        </div>

        <div className={styles.barsList}>
          <div className={styles.statBarItem}>
            <div className={styles.barHeader}>
              <span>Temp. Frenos:</span>
              <span className={styles.barVal}>{stats.brakeTempCelsius}°C</span>
            </div>
            <div className={styles.barTrack}>
              <div 
                className={styles.barFill} 
                style={{ 
                  width: `${Math.min(100, (stats.brakeTempCelsius / 800) * 100)}%`,
                  backgroundColor: stats.brakeTempCelsius > 600 ? '#ef4444' : '#22c55e'
                }} 
              />
            </div>
          </div>

          <div className={styles.statBarItem}>
            <div className={styles.barHeader}>
              <span>Temp. Motor:</span>
              <span className={styles.barVal}>{stats.engineTempCelsius}°C</span>
            </div>
            <div className={styles.barTrack}>
              <div 
                className={styles.barFill} 
                style={{ 
                  width: `${Math.min(100, (stats.engineTempCelsius / 130) * 100)}%`,
                  backgroundColor: stats.engineTempCelsius > 115 ? '#ef4444' : '#38bdf8'
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. HISTORIAL DEL PILOTO ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Award size={15} color="#ffd700" />
          <span>PALMARÉS & VALORACIÓN</span>
        </div>

        <div className={styles.palmaresList}>
          <div className={styles.palmaresItem}>
            <span>🏆 Campeonatos Mundiales:</span>
            <strong>{driver.worldChampionships}</strong>
          </div>
          <div className={styles.palmaresItem}>
            <span>🥇 Victorias en GP:</span>
            <strong>{driver.careerWins}</strong>
          </div>
          <div className={styles.palmaresItem}>
            <span>🍾 Podios:</span>
            <strong>{driver.careerPodiums}</strong>
          </div>
        </div>

        <div className={styles.ratingsMiniFooter}>
          <span>Talento: <strong>{Math.round(driver.talentRating * 100)}</strong></span>
          <span>Gestión Gomas: <strong>{Math.round(driver.tireManagement * 100)}</strong></span>
          <span>Consistencia: <strong>{Math.round(driver.consistency * 100)}</strong></span>
        </div>
      </div>
    </div>
  );
};
