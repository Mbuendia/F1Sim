import React from 'react';
import styles from './RightStatsPanel.module.css';
import { CarState } from '../types/f1';
import { Activity, Flame, Sparkles, Thermometer, Trophy, AlertTriangle, CheckCircle2, Timer, Wrench } from 'lucide-react';

interface RightStatsPanelProps {
  car: CarState | null;
  totalLaps: number;
  overallBestS1: number | null;
  overallBestS2: number | null;
  overallBestS3: number | null;
}

export const RightStatsPanel: React.FC<RightStatsPanelProps> = ({
  car,
  totalLaps,
  overallBestS1,
  overallBestS2,
  overallBestS3
}) => {
  if (!car) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyCard}>
          <Activity size={24} color="#64748b" />
          <span>Selecciona un monoplaza para ver tiempos de sector, telemetría y estrategia</span>
        </div>
      </div>
    );
  }

  const { driver, tires, stats, currentLap, sectors, lastLapTime, bestLapTime, pitStop } = car;
  const lapsRemaining = totalLaps - currentLap;

  const getSectorColor = (sectorNum: 1 | 2 | 3, currentVal: number | null, pbVal: number | null, overallBest: number | null) => {
    if (!currentVal) return { color: '#64748b', bg: 'rgba(255,255,255,0.03)', status: '...' };
    if (overallBest && Math.abs(currentVal - overallBest) < 0.005) {
      return { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.18)', status: '🟣 RÉCORD' };
    }
    if (pbVal && Math.abs(currentVal - pbVal) < 0.005) {
      return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.18)', status: '🟢 PERSONAL' };
    }
    return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', status: '🟡 NORMAL' };
  };

  const s1Color = getSectorColor(1, sectors.s1, sectors.personalBestS1, overallBestS1);
  const s2Color = getSectorColor(2, sectors.s2, sectors.personalBestS2, overallBestS2);
  const s3Color = getSectorColor(3, sectors.s3, sectors.personalBestS3, overallBestS3);

  const formatLapTime = (sec: number | null) => {
    if (!sec || sec <= 0) return '--:--.---';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
  };

  return (
    <div className={styles.container}>
      {/* ── 1. TIEMPOS DE SECTOR (S1, S2, S3) ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Timer size={13} color="#c084fc" />
          <span>TIEMPOS DE SECTOR Y VUELTA</span>
        </div>

        <div className={styles.sectorsGrid}>
          <div className={styles.sectorBox} style={{ background: s1Color.bg, borderColor: s1Color.color }}>
            <div className={styles.sectorLabel}>SECTOR 1</div>
            <div className={styles.sectorTime} style={{ color: s1Color.color }}>
              {sectors.s1 ? `${sectors.s1.toFixed(3)}s` : '--.---'}
            </div>
            <div className={styles.sectorStatus}>{s1Color.status}</div>
          </div>

          <div className={styles.sectorBox} style={{ background: s2Color.bg, borderColor: s2Color.color }}>
            <div className={styles.sectorLabel}>SECTOR 2</div>
            <div className={styles.sectorTime} style={{ color: s2Color.color }}>
              {sectors.s2 ? `${sectors.s2.toFixed(3)}s` : '--.---'}
            </div>
            <div className={styles.sectorStatus}>{s2Color.status}</div>
          </div>

          <div className={styles.sectorBox} style={{ background: s3Color.bg, borderColor: s3Color.color }}>
            <div className={styles.sectorLabel}>SECTOR 3</div>
            <div className={styles.sectorTime} style={{ color: s3Color.color }}>
              {sectors.s3 ? `${sectors.s3.toFixed(3)}s` : '--.---'}
            </div>
            <div className={styles.sectorStatus}>{s3Color.status}</div>
          </div>
        </div>

        <div className={styles.lapTimesSummary}>
          <div className={styles.lapTimeRow}>
            <span className={styles.timeLabel}>ÚLTIMA VUELTA:</span>
            <span className={styles.timeVal}>{formatLapTime(lastLapTime)}</span>
          </div>
          <div className={styles.lapTimeRow}>
            <span className={styles.timeLabel}>MEJOR VUELTA:</span>
            <span className={styles.timeValBest}>{formatLapTime(bestLapTime)}</span>
          </div>
        </div>
      </div>

      {/* ── 2. INFORMACIÓN DETALLADA DE PIT STOP ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Wrench size={13} color="#eab308" />
          <span>ESTADO DE PARADAS EN BOXES</span>
        </div>

        <div className={styles.pitDetailBox}>
          {pitStop.isPitting ? (
            <div className={styles.pitActiveBanner}>
              <span className={styles.pitBlink}>🔴 EN BOXES AHORA MISMO</span>
              <span className={styles.pitCurrentTimer}>
                {pitStop.currentStopTimer > 0 ? `PARADA: ${pitStop.currentStopTimer.toFixed(2)}s / ${pitStop.stopDuration.toFixed(2)}s` : 'RODANDO A 80 KM/H'}
              </span>
            </div>
          ) : (
            <div className={styles.pitNormalStatus}>
              <div className={styles.pitStatRow}>
                <span>PARADAS REALIZADAS:</span>
                <strong>{pitStop.totalPitStops} {pitStop.totalPitStops === 1 ? 'PARADA' : 'PARADAS'}</strong>
              </div>
              <div className={styles.pitStatRow}>
                <span>ÚLTIMO TIEMPO EN BOX:</span>
                <strong style={{ color: pitStop.lastStopDuration && pitStop.lastStopDuration < 2.3 ? '#22c55e' : '#ffd700' }}>
                  {pitStop.lastStopDuration ? `${pitStop.lastStopDuration.toFixed(2)} seg` : 'NINGUNA'}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. PREVISIÓN DE NEUMÁTICOS Y ESTRATEGIA ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Activity size={13} color="#38bdf8" />
          <span>PREVISIÓN DE NEUMÁTICOS</span>
        </div>

        <div className={styles.forecastStatusBox}>
          {stats.willMakeToEndWithoutPit ? (
            <div className={styles.statusSuccess}>
              <CheckCircle2 size={15} color="#22c55e" />
              <div>
                <div className={styles.statusTitle}>LLEGA AL FINAL DE CARRERA</div>
                <div className={styles.statusSub}>Aguante estimado: {stats.projectedLapsRemainingOnTire} laps (Quedan {lapsRemaining})</div>
              </div>
            </div>
          ) : (
            <div className={styles.statusWarning}>
              <AlertTriangle size={15} color="#f59e0b" />
              <div>
                <div className={styles.statusTitle}>REQUIERE PARADA EN BOXES</div>
                <div className={styles.statusSub}>Goma útil: ~{stats.projectedLapsRemainingOnTire} laps (Quedan {lapsRemaining})</div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.statsMiniGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>VUELTAS CON ESTA GOMA</span>
            <span className={styles.miniValue}>{tires.lapsOnTire} laps</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>VENTANA ÓPTIMA PIT</span>
            <span className={styles.miniValue}>Vuelta {stats.optimalPitLap}</span>
          </div>
        </div>
      </div>

      {/* ── 4. ESTADÍSTICAS DE PILOTAJE EN CARRERA ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Flame size={13} color="#f97316" />
          <span>ESTADÍSTICAS DE PILOTAJE</span>
        </div>

        <div className={styles.barsList}>
          <div className={styles.statBarItem}>
            <div className={styles.barHeader}>
              <span>Vueltas al límite (Push)</span>
              <span className={styles.barVal}>{stats.pushLaps} laps</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${Math.min(100, (stats.pushLaps / Math.max(1, currentLap)) * 100)}%`, backgroundColor: '#ef4444' }} />
            </div>
          </div>

          <div className={styles.statBarItem}>
            <div className={styles.barHeader}>
              <span>Vueltas en gestión (Eco)</span>
              <span className={styles.barVal}>{stats.savingLaps} laps</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${Math.min(100, (stats.savingLaps / Math.max(1, currentLap)) * 100)}%`, backgroundColor: '#38bdf8' }} />
            </div>
          </div>
        </div>

        <div className={styles.statsMiniGrid} style={{ marginTop: '6px' }}>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>ZONAS DRS PASADAS</span>
            <span className={styles.miniValue}>{stats.drsZonesTraversed}</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>POSICIONES GANADAS</span>
            <span className={styles.miniValue} style={{ color: '#22c55e' }}>+{stats.overtakesMade}</span>
          </div>
        </div>
      </div>

      {/* ── 5. TELEMETRÍA TÉRMICA EN VIVO ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Thermometer size={13} color="#ef4444" />
          <span>TELEMETRÍA TÉRMICA</span>
        </div>

        <div className={styles.statsMiniGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>TEMPERATURA FRENOS</span>
            <span className={styles.miniValue} style={{ color: stats.brakeTempCelsius > 550 ? '#ef4444' : '#f59e0b' }}>
              {stats.brakeTempCelsius} °C
            </span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniLabel}>TEMPERATURA MOTOR</span>
            <span className={styles.miniValue} style={{ color: '#38bdf8' }}>
              {stats.engineTempCelsius} °C
            </span>
          </div>
        </div>
      </div>

      {/* ── 6. PALMARÉS Y RATINGS FIA ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Sparkles size={13} color="#ffd700" />
          <span>PALMARÉS Y RATINGS FIA</span>
        </div>

        <div className={styles.palmaresList}>
          {driver.worldChampionships > 0 ? (
            <div className={styles.palmaresItem}>
              <Trophy size={13} color="#ffd700" />
              <span>{driver.worldChampionships} Títulos Mundiales (WDC)</span>
            </div>
          ) : null}
          <div className={styles.palmaresItem}>
            <Trophy size={13} color="#cbd5e1" />
            <span>{driver.careerWins} Victorias en GP</span>
          </div>
        </div>

        <div className={styles.ratingsMiniFooter}>
          <span>Talento: <strong>{(driver.talentRating * 100).toFixed(0)}</strong></span>
          <span>Suerte: <strong>{(driver.luckRating * 100).toFixed(0)}</strong></span>
          <span>Gomas: <strong>{(driver.tireManagement * 100).toFixed(0)}</strong></span>
        </div>
      </div>
    </div>
  );
};
