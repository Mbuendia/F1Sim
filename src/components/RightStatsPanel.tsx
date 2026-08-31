import React, { useEffect, useRef } from 'react';
import styles from './RightStatsPanel.module.css';
import { CarState, TrackWeatherState } from '../types/f1';
import { 
  Timer, 
  History, 
  TrendingDown, 
  Gauge,
  Wind,
  CloudRain,
  Thermometer,
  Droplets
} from 'lucide-react';
import { animate } from 'animejs';

export interface RightStatsPanelProps {
  car: CarState | null;
  defaultCar: CarState | null;
  totalLaps: number;
  overallBestS1: number | null;
  overallBestS2: number | null;
  overallBestS3: number | null;
  weather?: TrackWeatherState;
}

export const RightStatsPanel: React.FC<RightStatsPanelProps> = ({
  car,
  defaultCar,
  totalLaps = 66,
  overallBestS1,
  overallBestS2,
  overallBestS3,
  weather,
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

  const { driver, team, sectors, pitStop, stats, tires, currentPosition, lapHistory, bestLapTime } = activeCar;

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

  // ── 2. GRÁFICA DE DEGRADACIÓN Y PREVISIÓN FIJA (1 a 66 vueltas) ──
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

  const stints = pitStop.stints && pitStop.stints.length > 0
    ? pitStop.stints
    : [{ stintNumber: 1, compound: tires.compound, startLap: 0, endLap: 24, expectedLaps: 24 }];

  const currentStint = stints[stints.length - 1];
  const expectedEndLap = currentStint.startLap + currentStint.expectedLaps;
  const stintStartPoint = { x: getX(currentStint.startLap), y: getY(100) };
  const stintExpectedEndPoint = { x: getX(expectedEndLap), y: getY(0) };

  const currentCompoundColor = tires.compound === 'soft' ? '#e10600' : (tires.compound === 'medium' ? '#ffd700' : '#ffffff');

  const historyPoints = lapHistory.map(h => ({
    x: getX(h.lap),
    y: getY(h.tireHealth !== undefined ? h.tireHealth : 100),
    compound: h.compound,
    health: h.tireHealth !== undefined ? h.tireHealth : 100
  }));

  const currentLapFloat = activeCar.currentLap + activeCar.trackT;
  const currentPoint = {
    x: getX(currentLapFloat),
    y: getY(tires.health)
  };

  const getBrakeStatus = (temp: number) => {
    if (temp > 650) return { label: 'SOBRECALENTADOS 🔴', className: styles.statusHot };
    if (temp < 250) return { label: 'FRÍOS 🟡', className: styles.statusCold };
    return { label: 'ÓPTIMOS 🟢', className: styles.statusOptimal };
  };
  const brakeStatus = getBrakeStatus(stats.brakeTempCelsius);

  const brakeBiasFront = 56.5;
  const tirePressurePsi = (22.5 + (tires.tempCelsius - 85) * 0.05).toFixed(1);
  const downforceLevel = team.aerodynamics > 0.90 ? 'ALTA (High Downforce)' : 'MEDIA (Medium DF)';

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

      {/* ── 1. ESTADO DE PISTA & CONDICIONES METEOROLÓGICAS ── */}
      {weather && (
        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <CloudRain size={14} color="#38bdf8" />
            <span>ESTADO DE PISTA & METEOROLOGÍA</span>
            <span className={styles.weatherConditionBadge}>
              {weather.condition === 'dry' ? '☀️ SECO' : '🌧️ MOJADO'}
            </span>
          </div>

          <div className={styles.weatherGrid}>
            {/* Nivel de agua */}
            <div className={styles.weatherMiniBox}>
              <div className={styles.weatherBoxHeader}>
                <Droplets size={11} color="#38bdf8" />
                <span>Nivel de Agua</span>
              </div>
              <span className={styles.weatherBoxVal}>{weather.waterDepthMm.toFixed(1)} mm</span>
              <div className={styles.waterProgressBar}>
                <div 
                  className={styles.waterProgressFill} 
                  style={{ width: `${Math.max(6, weather.waterPercentage)}%` }} 
                />
              </div>
              <span className={styles.weatherBoxSub}>
                {weather.waterPercentage === 0 ? 'Asfalto Seco (0%)' : `${weather.waterPercentage}% Mojado`}
              </span>
            </div>

            {/* Temperatura asfalto */}
            <div className={styles.weatherMiniBox}>
              <div className={styles.weatherBoxHeader}>
                <Thermometer size={11} color="#f97316" />
                <span>Temp. Pista</span>
              </div>
              <span className={styles.weatherBoxVal} style={{ color: '#f97316' }}>
                {weather.trackTempCelsius}°C
              </span>
              <span className={styles.weatherBoxSub}>Ambiente: {weather.airTempCelsius}°C</span>
              <span className={styles.weatherBoxSub}>Humedad: {weather.humidityPercentage}%</span>
            </div>

            {/* Grip */}
            <div className={styles.weatherMiniBox}>
              <div className={styles.weatherBoxHeader}>
                <Gauge size={11} color="#22c55e" />
                <span>Grip Pista</span>
              </div>
              <span className={styles.weatherBoxVal} style={{ color: '#22c55e' }}>
                {Math.round(weather.gripMultiplier * 100)}%
              </span>
              <span className={styles.weatherBoxSub}>
                {weather.gripMultiplier >= 0.95 ? 'Grip Óptimo 🟢' : 'Grip Reducido 🟡'}
              </span>
            </div>

            {/* Viento */}
            <div className={styles.weatherMiniBox}>
              <div className={styles.weatherBoxHeader}>
                <Wind size={11} color="#c084fc" />
                <span>Viento</span>
              </div>
              <span className={styles.weatherBoxVal} style={{ color: '#c084fc' }}>
                {weather.windSpeedKmh} km/h
              </span>
              <span className={styles.weatherBoxSub}>Dirección: {weather.windDirection}</span>
              <span className={styles.weatherBoxSub}>Lluvia: {weather.rainProbabilityPct}%</span>
            </div>
          </div>

          <div className={styles.weatherForecastBanner}>
            <span>📡 Previsión radar: <strong>{weather.forecast5Min}</strong> (15m: {weather.forecast15Min})</span>
          </div>
        </div>
      )}

      {/* ── 2. SECTORES EN DIRECTO ── */}
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

      {/* ── 3. GRÁFICA DINÁMICA DE PREVISIÓN FIJA & DEGRADACIÓN REAL ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <TrendingDown size={14} color="#ffd700" />
          <span>PREVISIÓN FIJA & DEGRADACIÓN REAL</span>
        </div>

        <div className={styles.chartContainer}>
          <svg className={styles.chartSvg} viewBox={`0 0 ${chartW} ${chartH}`}>
            <line x1={padLeft} y1={padTop} x2={padLeft} y2={chartH - padBottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <line x1={padLeft} y1={chartH - padBottom} x2={chartW - padRight} y2={chartH - padBottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {[0, 20, 40, 66].map(l => (
              <g key={l}>
                <line x1={getX(l)} y1={chartH - padBottom} x2={getX(l)} y2={chartH - padBottom + 4} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <text x={getX(l)} y={chartH - 4} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="middle">L{l}</text>
              </g>
            ))}

            <text x={padLeft - 4} y={getY(100) + 3} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="end">100%</text>
            <text x={padLeft - 4} y={getY(50) + 3} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="end">50%</text>
            <text x={padLeft - 4} y={getY(0) + 3} fill="#64748b" fontSize="8" fontFamily="Orbitron" textAnchor="end">0%</text>

            <line x1={padLeft} y1={getY(20)} x2={chartW - padRight} y2={getY(20)} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.5" />

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

            {historyPoints.map((p, i) => {
              if (i === 0) return null;
              const prev = historyPoints[i - 1];
              const strokeCol = prev.compound === 'soft' ? '#e10600' : (prev.compound === 'medium' ? '#ffd700' : '#ffffff');
              return (
                <line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={strokeCol} strokeWidth="2.6" strokeLinecap="round" />
              );
            })}

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

            <circle cx={currentPoint.x} cy={currentPoint.y} r="4.5" fill={currentCompoundColor} stroke="#000000" strokeWidth="1.5" />
          </svg>

          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: '#e10600' }} />
              <span>Blandos (~15v)</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: '#ffd700' }} />
              <span>Medios (~24v)</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: '#ffffff' }} />
              <span>Duros (~38v)</span>
            </div>
          </div>

          <div className={styles.forecastBanner}>
            <span>🎯 Previsión teórica: Neumático {tires.compound.toUpperCase()} rinde hasta <strong>Vuelta {Math.round(expectedEndLap)}</strong> ({currentStint.expectedLaps} vtas previstas)</span>
          </div>
        </div>
      </div>

      {/* ── 4. TELEMETRÍA AVANZADA (FRENADA, MOTOR & AERO) ── */}
      <div className={styles.sectionCard}>
        <div className={styles.cardHeader}>
          <Gauge size={14} color="#38bdf8" />
          <span>BALANCE MECÁNICO & DINÁMICA DE COCHE</span>
        </div>

        <div className={styles.telemetryGrid}>
          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Temp. Discos Freno</span>
            <span className={styles.miniBoxVal}>{stats.brakeTempCelsius}°C</span>
            <span className={brakeStatus.className}>{brakeStatus.label}</span>
          </div>

          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Brake Bias (Reparto)</span>
            <span className={styles.miniBoxVal}>{brakeBiasFront}% F</span>
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>{(100 - brakeBiasFront).toFixed(1)}% Trasero</span>
          </div>

          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Temp. Motor V6</span>
            <span className={styles.miniBoxVal}>{stats.engineTempCelsius}°C</span>
            <span className={stats.engineTempCelsius > 115 ? styles.statusHot : styles.statusOptimal}>
              {stats.engineTempCelsius > 115 ? 'ALERTA 🔴' : 'CORRECTA 🟢'}
            </span>
          </div>

          <div className={styles.telemetryMiniBox}>
            <span className={styles.miniBoxLabel}>Presión Neumáticos</span>
            <span className={styles.miniBoxVal}>{tirePressurePsi} PSI</span>
            <span style={{ fontSize: '9px', color: '#38bdf8' }}>Temp: {Math.round(tires.tempCelsius)}°C</span>
          </div>
        </div>

        {/* Aerodinámica */}
        <div style={{ marginTop: '4px' }}>
          <div className={styles.telemetryMiniBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wind size={11} color="#38bdf8" />
              <span className={styles.miniBoxLabel}>Carga Aerodinámica & Eficiencia</span>
            </div>
            <span className={styles.miniBoxVal} style={{ fontSize: '11.5px' }}>{downforceLevel}</span>
            <span style={{ fontSize: '8.5px', color: '#22c55e' }}>Aero Rating: {Math.round(team.aerodynamics * 100)}%</span>
          </div>
        </div>

        {pitStop.isPitting && (
          <div ref={pitBannerRef} className={styles.pitActiveBanner}>
            <span className={styles.pitBlink}>🔴 EN BOXES AHORA MISMO</span>
            <span className={styles.pitCurrentTimer}>⏱️ {pitStop.currentStopTimer.toFixed(2)}s / {pitStop.stopDuration}s</span>
          </div>
        )}
      </div>

      {/* ── 5. HISTORIAL COMPLETO DE TODAS LAS VUELTAS (1 A 66) ── */}
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
