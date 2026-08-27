import React, { useEffect, useRef } from 'react';
import styles from './RightStatsPanel.module.css';
import { CarState } from '../types/f1';
import { 
  Timer, 
  History, 
  TrendingDown, 
  Gauge
} from 'lucide-react';
import { animate } from 'animejs';

export interface RightStatsPanelProps {
  car: CarState | null;
  defaultCar: CarState | null;
  totalLaps: number;
  overallBestS1: number | null;
  overallBestS2: number | null;
  overallBestS3: number | null;
}

export const RightStatsPanel: React.FC<RightStatsPanelProps> = ({
  car,
  defaultCar,
  totalLaps = 66,
  overallBestS1,
  overallBestS2,
  overallBestS3
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const pitBannerRef = useRef<HTMLDivElement>(null);

  const activeCar = car || defaultCar;

  useEffect(() => {
    if (activeCar && panelRef.current) {
      animate(panelRef.current, {
        opacity: [0.88, 1],
        translateX: [10, 0],
        ease: 'outQuad',
        duration: 350
      });
    }
  }, [activeCar?.id]);

  useEffect(() => {
    if (activeCar?.pitStop.isPitting && pitBannerRef.current) {
      animate(pitBannerRef.current, {
        scale: [0.96, 1.03],
        alternate: true,
        loop: true,
        ease: 'inOutSine',
        duration: 500
      });
    }
  }, [activeCar?.pitStop.isPitting]);

  if (!activeCar) return null;

  const { driver, team, sectors, pitStop, stats, telemetry, tires, currentPosition, lapHistory, lastLapTime, bestLapTime } = activeCar;

  // ── 1. ESTILOS DE SECTORES ──
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

  // ── 2. CÁLCULO DE GRÁFICA DE DEGRADACIÓN Y PREVISIÓN FIJA (1 a 66 vueltas) ──
  const chartW = 320;
  const chartH = 95;
  const padLeft = 26;
  const padRight = 10;
  const padTop = 8;
  const padBottom = 18;

  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;

  const getX = (lap: number) => padLeft + (Math.min(totalLaps, Math.max(0, lap)) / totalLaps) * innerW;
  const getY = (health: number) => padTop + (1 - Math.min(100, Math.max(0, health)) / 100) * innerH;

  // Stints del monoplaza
  const stints = pitStop.stints && pitStop.stints.length > 0
    ? pitStop.stints
    : [{ stintNumber: 1, compound: tires.compound, startLap: 0, endLap: 24, expectedLaps: 24 }];

  const currentStint = stints[stints.length - 1];

  // Línea fija teórica de previsión del stint actual (de startLap al 100% a startLap + expectedLaps al 0%)
  const expectedEndLap = currentStint.startLap + currentStint.expectedLaps;
  const stintStartPoint = { x: getX(currentStint.startLap), y: getY(100) };
  const stintExpectedEndPoint = { x: getX(expectedEndLap), y: getY(0) };

  const currentCompoundColor = tires.compound === 'soft' ? '#e10600' : (tires.compound === 'medium' ? '#ffd700' : '#ffffff');

  // Puntos reales históricos
  const historyPoints = lapHistory.map(h => ({
    x: getX(h.lap),
    y: getY(h.tireHealth !== undefined ? h.tireHealth : 100),
    compound: h.compound,
    health: h.tireHealth !== undefined ? h.tireHealth : 100
  }));

  // Punto actual en pista
  const currentLapFloat = activeCar.currentLap + activeCar.trackT;
  const currentPoint = {
    x: getX(currentLapFloat),
    y: getY(tires.health)
  };

  // Estado térmico de frenos
  const getBrakeStatus = (temp: number) => {
    if (temp > 650) return { label: 'SOBRECALENTADOS 🔴', className: styles.statusHot };
    if (temp < 250) return { label: 'FRÍOS 🟡', className: styles.statusCold };
    return { label: 'ÓPTIMOS 🟢', className: styles.statusOptimal };
  };
  const brakeStatus = getBrakeStatus(stats.brakeTempCelsius);

  return (
    <div ref={panelRef} className={styles.container}>
      {/* ── TARJETA HERO DEL PILOTO PROTAGONISTA ── */}
      <div className={styles.driverHeroCard} style={{ borderLeftColor: team.color }}>
        <div className={styles.driverHeroLeft}>
          <span className={styles.driverHeroPos}>P{currentPosition}</span>
          <div>
            <div className={styles.driverHeroName}>{driver.countryFlag} {driver.firstName} {driver.lastName}</div>
            <div className={styles.driverHeroTeam}>{team.name}</div>
          </div>
        </div>
        <div className={styles.driverHeroNum} style={{ color: team.color }}>#{driver.number}</div>
      </div>

      {/* ── 1. SECTORES EN DIRECTO ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Timer size={14} color="#e10600" />
          <span>SECTORES EN DIRECTO</span>
        </div>

        <div className={styles.sectorsGrid}>
          <div className={styles.sectorBox} style={{ backgroundColor: s1Style.bg, borderColor: s1Style.border || 'transparent' }}>
            <span className={styles.sectorLabel}>SECTOR 1</span>
            <span className={styles.sectorTime} style={{ color: s1Style.color }}>{sectors.s1 ? `${sectors.s1.toFixed(3)}s` : '--.---'}</span>
            <span className={styles.sectorStatus} style={{ color: s1Style.color }}>{s1Style.status}</span>
          </div>

          <div className={styles.sectorBox} style={{ backgroundColor: s2Style.bg, borderColor: s2Style.border || 'transparent' }}>
            <span className={styles.sectorLabel}>SECTOR 2</span>
            <span className={styles.sectorTime} style={{ color: s2Style.color }}>{sectors.s2 ? `${sectors.s2.toFixed(3)}s` : '--.---'}</span>
            <span className={styles.sectorStatus} style={{ color: s2Style.color }}>{s2Style.status}</span>
          </div>

          <div className={styles.sectorBox} style={{ backgroundColor: s3Style.bg, borderColor: s3Style.border || 'transparent' }}>
            <span className={styles.sectorLabel}>SECTOR 3</span>
            <span className={styles.sectorTime} style={{ color: s3Style.color }}>{sectors.s3 ? `${sectors.s3.toFixed(3)}s` : '--.---'}</span>
            <span className={styles.sectorStatus} style={{ color: s3Style.color }}>{s3Style.status}</span>
          </div>
        </div>
      </div>

      {/* ── 2. GRÁFICA DINÁMICA DE PREVISIÓN FIJA & DEGRADACIÓN REAL ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <TrendingDown size={14} color="#ffd700" />
          <span>PREVISIÓN FIJA & DEGRADACIÓN REAL</span>
        </div>

        <div className={styles.chartContainer}>
          <svg className={styles.chartSvg} viewBox={`0 0 ${chartW} ${chartH}`}>
            {/* Ejes */}
            <line x1={padLeft} y1={padTop} x2={padLeft} y2={chartH - padBottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <line x1={padLeft} y1={chartH - padBottom} x2={chartW - padRight} y2={chartH - padBottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Marcas de vuelta */}
            {[0, 20, 40, 66].map(l => (
              <g key={l}>
                <line x1={getX(l)} y1={chartH - padBottom} x2={getX(l)} y2={chartH - padBottom + 4} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <text x={getX(l)} y={chartH - 4} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="middle">L{l}</text>
              </g>
            ))}

            {/* Marcas de salud */}
            <text x={padLeft - 4} y={getY(100) + 3} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="end">100%</text>
            <text x={padLeft - 4} y={getY(50) + 3} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="end">50%</text>
            <text x={padLeft - 4} y={getY(0) + 3} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="end">0%</text>

            {/* Línea horizontal de desgaste crítico 20% */}
            <line x1={padLeft} y1={getY(20)} x2={chartW - padRight} y2={getY(20)} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.5" />

            {/* 1. LÍNEA FIJA DE PREVISIÓN TEÓRICA (PUNTITOS AMARILLOS/BLANCOS/ROJOS) */}
            <line 
              x1={stintStartPoint.x} 
              y1={stintStartPoint.y} 
              x2={stintExpectedEndPoint.x} 
              y2={stintExpectedEndPoint.y} 
              stroke={currentCompoundColor} 
              strokeWidth="2.0" 
              strokeDasharray="4,4" 
              opacity="0.85" 
            />

            {/* 2. LÍNEA SÓLIDA REAL DEGRADADA VUELTA A VUELTA */}
            {historyPoints.map((p, i) => {
              if (i === 0) return null;
              const prev = historyPoints[i - 1];
              const strokeCol = prev.compound === 'soft' ? '#e10600' : (prev.compound === 'medium' ? '#ffd700' : '#ffffff');
              return (
                <line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={strokeCol} strokeWidth="2.6" strokeLinecap="round" />
              );
            })}

            {/* Conexión con punto actual */}
            {historyPoints.length > 0 && (
              <line 
                x1={historyPoints[historyPoints.length - 1].x} 
                y1={historyPoints[historyPoints.length - 1].y} 
                x2={currentPoint.x} 
                y2={currentPoint.y} 
                stroke={currentCompoundColor} 
                strokeWidth="2.6" 
              />
            )}

            {/* Punto actual */}
            <circle cx={currentPoint.x} cy={currentPoint.y} r="4.5" fill={currentCompoundColor} stroke="#000000" strokeWidth="1.5" />
          </svg>

          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: '#e10600' }} />
              <span>Blandos (~16v)</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: '#ffd700' }} />
              <span>Medios (~24v)</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: '#ffffff' }} />
              <span>Duros (~36v)</span>
            </div>
          </div>

          <div className={styles.forecastBanner}>
            <span>🎯 Previsión teórica: Neumático {tires.compound.toUpperCase()} rinde hasta <strong>Vuelta {Math.round(expectedEndLap)}</strong> ({currentStint.expectedLaps} vtas previstas)</span>
          </div>
        </div>
      </div>

      {/* ── 3. TELEMETRÍA TÉRMICA & MECÁNICA ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Gauge size={14} color="#38bdf8" />
          <span>FRENOS, MOTOR & NEUMÁTICOS</span>
        </div>

        <div className={styles.telemetryGrid}>
          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Temp. Frenos</span>
            <span className={styles.miniBoxVal}>{stats.brakeTempCelsius}°C</span>
            <span className={brakeStatus.className}>{brakeStatus.label}</span>
          </div>

          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Temp. Motor</span>
            <span className={styles.miniBoxVal}>{stats.engineTempCelsius}°C</span>
            <span className={stats.engineTempCelsius > 115 ? styles.statusHot : styles.statusOptimal}>
              {stats.engineTempCelsius > 115 ? 'ALERTA 🔴' : 'CORRECTA 🟢'}
            </span>
          </div>

          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Vida Neumáticos</span>
            <span className={styles.miniBoxVal} style={{ color: tires.health < 25 ? '#ef4444' : '#22c55e' }}>
              {Math.round(tires.health)}%
            </span>
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>{tires.compound.toUpperCase()} ({tires.lapsOnTire} vtas)</span>
          </div>

          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Marcha & Velocidad</span>
            <span className={styles.miniBoxVal}>{telemetry.speedKmh} km/h</span>
            <span style={{ fontSize: '9px', color: '#38bdf8' }}>GEAR {telemetry.gear} ({telemetry.rpm.toLocaleString()} RPM)</span>
          </div>
        </div>

        {pitStop.isPitting && (
          <div ref={pitBannerRef} className={styles.pitActiveBanner}>
            <span className={styles.pitBlink}>🔴 EN BOXES AHORA MISMO</span>
            <span className={styles.pitCurrentTimer}>⏱️ {pitStop.currentStopTimer.toFixed(2)}s / {pitStop.stopDuration}s</span>
          </div>
        )}
      </div>

      {/* ── 4. HISTORIAL COMPLETO DE TODAS LAS VUELTAS (1 A 66) ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <History size={14} color="#c084fc" />
          <span>HISTORIAL DE TODAS LAS VUELTAS ({lapHistory.length}/{totalLaps})</span>
        </div>

        <div className={styles.historyTableWrapper}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>VTA</th>
                <th>TIEMPO</th>
                <th>S1</th>
                <th>S2</th>
                <th>S3</th>
                <th>GOMA</th>
                <th>VIDA</th>
              </tr>
            </thead>
            <tbody>
              {lapHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    Completando Vuelta 1 en pista...
                  </td>
                </tr>
              ) : (
                [...lapHistory].reverse().map((h) => {
                  const isBestLap = bestLapTime && Math.abs(h.lapTime - bestLapTime) < 0.005;
                  const dotColor = h.compound === 'soft' ? '#e10600' : (h.compound === 'medium' ? '#ffd700' : '#ffffff');
                  return (
                    <tr key={h.lap}>
                      <td className={styles.lapNumCell}>L{h.lap}</td>
                      <td className={styles.lapTimeCell} style={{ color: isBestLap ? '#c084fc' : '#ffffff' }}>
                        {h.lapTime.toFixed(3)}s
                      </td>
                      <td>{h.sector1 ? `${h.sector1.toFixed(2)}s` : '-'}</td>
                      <td>{h.sector2 ? `${h.sector2.toFixed(2)}s` : '-'}</td>
                      <td>{h.sector3 ? `${h.sector3.toFixed(2)}s` : '-'}</td>
                      <td>
                        <span style={{ color: dotColor, fontWeight: 900 }}>{h.compound[0].toUpperCase()}</span>
                      </td>
                      <td>{h.tireHealth !== undefined ? `${h.tireHealth}%` : '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
