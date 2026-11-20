import React, { useState, useEffect, useRef } from 'react';
import styles from './RightStatsPanel.module.css';
import { CarState, TrackWeatherState } from '../types/f1';
import { Timer, History, TrendingDown, Gauge, Wind, CloudRain, Thermometer, Droplets, Radio, Compass, Zap, Sun, CircleDot } from 'lucide-react';
import { StintTimeline } from './StintTimeline';
import { animate } from 'animejs';
import { CircuitSpec } from '../data/circuits';
import { RaceHeader } from './RaceHeader';
import { CompoundBadge } from './CompoundBadge';
import { COMPOUND_STYLES, compoundStyle } from '../utils/compounds';
import { RainForecastPanel } from './RainForecastPanel';
import type { RainForecast } from '../simulation/WeatherForecast';
import { TRACK_TEMP_HINT, trackTempBand } from '../simulation/TrackTemperature';
import { cssColor } from '../utils/cssColor';

export interface RightStatsPanelProps {
  car: CarState | null;
  defaultCar: CarState | null;
  totalLaps: number;
  overallBestS1: number | null;
  overallBestS2: number | null;
  overallBestS3: number | null;
  weather?: TrackWeatherState;
  /** [R53] Previsión del radar por tramos de tiempo y por sector. */
  rainForecast?: RainForecast | null;
  circuit?: CircuitSpec;
  /** [MJ3, 19/11/2026] Pestaña con la que se abre (la pantalla del invitado lo usa para el tiempo). */
  initialTab?: RightPanelTab;
}

export type RightPanelTab = 'car_telemetry' | 'track_weather';

export const RightStatsPanel: React.FC<RightStatsPanelProps> = ({
  car,
  defaultCar,
  totalLaps = 66,
  overallBestS1,
  overallBestS2,
  overallBestS3,
  weather,
  circuit,
  rainForecast,
  initialTab = 'car_telemetry',
}) => {
  const [activeTab, setActiveTab] = useState<RightPanelTab>(initialTab);
  const panelRef = useRef<HTMLDivElement>(null);
  const pitBannerRef = useRef<HTMLDivElement>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);

  const activeCar = car || defaultCar;

  useEffect(() => {
    if (activeCar && panelRef.current) {
      animate(panelRef.current, {
        opacity: [0.92, 1],
        translateX: [6, 0],
        ease: 'outQuad',
        duration: 250
      });
    }
  }, [activeCar?.id, activeTab]);

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

  // ── PROCEDURAL RADAR GPS CANVAS WITH ROTATING SWEEP & MOVING RAIN CLOUDS ──
  useEffect(() => {
    if (activeTab !== 'track_weather') return;
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    const size = 260;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;

    const clouds = [
      { x: cx + 35, y: cy - 40, r: 42, opacity: 0.35, speedX: -0.12, speedY: 0.08 },
      { x: cx - 50, y: cy + 30, r: 36, opacity: 0.25, speedX: -0.15, speedY: 0.05 },
      { x: cx + 20, y: cy + 50, r: 28, opacity: 0.20, speedX: -0.10, speedY: 0.09 },
    ];

    const renderRadar = () => {
      ctx.clearRect(0, 0, size, size);

      // Radar dark background
      ctx.fillStyle = cssColor('var(--panel)');
      ctx.fillRect(0, 0, size, size);

      // Distance range rings (5km, 10km, 20km)
      ctx.strokeStyle = cssColor('color-mix(in srgb, var(--info) 18%, transparent)');
      ctx.lineWidth = 1;
      [35, 70, 105].forEach((r, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = cssColor('color-mix(in srgb, var(--info) 45%, transparent)');
        ctx.font = '14px Barlow Condensed';
        ctx.fillText(`${(idx + 1) * 5}km`, cx + 3, cy - r + 9);
      });

      // Axis crosshairs
      ctx.beginPath();
      ctx.moveTo(cx, 15);
      ctx.lineTo(cx, size - 15);
      ctx.moveTo(15, cy);
      ctx.lineTo(size - 15, cy);
      ctx.strokeStyle = cssColor('color-mix(in srgb, var(--info) 12%, transparent)');
      ctx.stroke();

      // Draw moving weather clouds
      clouds.forEach((c) => {
        c.x += c.speedX;
        c.y += c.speedY;
        if (c.x < -20) c.x = size + 20;
        if (c.y > size + 20) c.y = -20;

        const isWet = (weather?.waterPercentage || 0) > 20;
        const grad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
        grad.addColorStop(0, isWet ? cssColor('color-mix(in srgb, var(--info) 65%, transparent)') : cssColor('color-mix(in srgb, var(--text-2) 35%, transparent)'));
        grad.addColorStop(0.6, isWet ? cssColor('color-mix(in srgb, var(--info) 35%, transparent)') : cssColor('color-mix(in srgb, var(--text-3) 15%, transparent)'));
        grad.addColorStop(1, cssColor('transparent'));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Rotating radar beam
      angle += 0.035;
      const sweepX = cx + Math.cos(angle) * 115;
      const sweepY = cy + Math.sin(angle) * 115;

      const beamGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 115);
      beamGrad.addColorStop(0, cssColor('color-mix(in srgb, var(--info) 50%, transparent)'));
      beamGrad.addColorStop(1, cssColor('transparent'));

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 115, angle - 0.45, angle);
      ctx.closePath();
      ctx.fillStyle = cssColor('color-mix(in srgb, var(--info) 15%, transparent)');
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.strokeStyle = cssColor('var(--info)');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Circuit Center Icon (GPS Beacon)
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = cssColor('var(--accion)');
      ctx.fill();
      ctx.strokeStyle = cssColor('var(--text)');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animId = requestAnimationFrame(renderRadar);
    };

    renderRadar();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, weather?.waterPercentage]);

  if (!activeCar) return null;

  const { team, sectors, pitStop, stats, tires, lapHistory, bestLapTime } = activeCar;
  // [N3] De un rival solo se ve lo público (sectores, vueltas y compuesto): su desgaste, sus frenos y su motor no.
  const known = typeof tires.health === 'number' && Boolean(stats);

  // ── ESTILOS DE SECTORES ──
  const getSectorStyle = (
    currentSectorVal: number | null,
    personalBest: number | null,
    overallBest: number | null
  ) => {
    if (!currentSectorVal) return { color: 'var(--text-2)', bg: 'color-mix(in srgb, var(--text) 4%, transparent)', status: '-' };

    if (overallBest && Math.abs(currentSectorVal - overallBest) < 0.005) {
      return { color: 'var(--morado)', bg: 'color-mix(in srgb, var(--morado) 22%, transparent)', border: 'var(--morado)', status: 'RÉCORD' };
    }
    if (personalBest && Math.abs(currentSectorVal - personalBest) < 0.005) {
      return { color: 'var(--positivo)', bg: 'color-mix(in srgb, var(--positivo) 22%, transparent)', border: 'var(--positivo)', status: 'MEJOR PERSONAL' };
    }
    return { color: 'var(--aviso)', bg: 'color-mix(in srgb, var(--aviso) 15%, transparent)', border: 'var(--aviso)', status: 'ESTÁNDAR' };
  };

  const s1Style = getSectorStyle(sectors.s1, sectors.personalBestS1, overallBestS1);
  const s2Style = getSectorStyle(sectors.s2, sectors.personalBestS2, overallBestS2);
  const s3Style = getSectorStyle(sectors.s3, sectors.personalBestS3, overallBestS3);

  // ── GRÁFICA DE DEGRADACIÓN Y PREVISIÓN FIJA ──
  const chartW = 320;
  const chartH = 132;
  const padLeft = 44;
  const padRight = 10;
  const padTop = 8;
  const padBottom = 26;

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

  // Q21: color del compuesto desde la paleta única (también Intermedio y Lluvia).
  const stintStroke = compoundStyle(tires.compound).color;

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
    if (temp > 650) return { label: 'SOBRECALENTADOS', className: styles.statusHot };
    if (temp < 250) return { label: 'FRÍOS', className: styles.statusCold };
    return { label: 'ÓPTIMOS', className: styles.statusOptimal };
  };
  const brakeStatus = getBrakeStatus(stats?.brakeTempCelsius ?? 0);

  const brakeBiasFront = 56.5;
  const tirePressurePsi = (22.5 + (tires.tempCelsius - 85) * 0.05).toFixed(1);
  const downforceLevel = team.aerodynamics > 0.90 ? 'ALTA (High Downforce)' : 'MEDIA (Medium DF)';

  // Rain Recommendation Strategy
  const getRainRecommendation = () => {
    const depth = weather?.waterDepthMm || 0;
    if (depth > 3.0) return { compound: 'WET (AZUL)', advice: 'Extrema acumulación de agua. Slicks no operativos.', col: COMPOUND_STYLES.wet.color };
    if (depth > 0.5) return { compound: 'INTERMEDIATE (VERDE)', advice: 'Pista húmeda / con spray. Ventana óptima de Inter.', col: COMPOUND_STYLES.intermediate.color };
    return { compound: 'SLICK (SECO)', advice: 'Asfalto seco. Máximo agarre en compuestos Soft/Med/Hard.', col: 'var(--aviso)' };
  };
  const rainRec = getRainRecommendation();

  return (
    <div ref={panelRef} className={styles.container}>
      {/* ── 1. SELECTOR DE PESTAÑAS (TABS) ── */}
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'car_telemetry' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('car_telemetry')}
        >
          <Gauge size={13} />
          <span>TELEMETRÍA COCHE</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'track_weather' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('track_weather')}
        >
          <CloudRain size={13} />
          <span>PISTA & RADAR GPS</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── PESTAÑA 1: TELEMETRÍA DEL MONOPLAZA ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'car_telemetry' && (
        <>
          {/* 1. SECTORES EN DIRECTO */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <div className={styles.titleRow}>
                <Timer size={14} color="var(--accion)" />
                <span>SECTORES EN DIRECTO</span>
              </div>
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

          {!known && (
            <div className={styles.sectionCard} data-private-telemetry="hidden">
              <div className={styles.cardHeader}>
                <span>DESGASTE Y MECÁNICA</span>
              </div>
              <span className={styles.note}>
                De un rival se ven el compuesto ({tires.compound.toUpperCase()}, {tires.lapsOnTire} vueltas), los sectores y las vueltas. Su desgaste, sus frenos y su motor solo los ve su equipo; el muro los estima.
              </span>
            </div>
          )}
          {/* 2. GRÁFICA DE DEGRADACIÓN Y PREVISIÓN */}
          {known && (<>
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <div className={styles.titleRow}>
                <TrendingDown size={14} color="var(--aviso)" />
                <span>PREVISIÓN FIJA & DEGRADACIÓN</span>
              </div>
            </div>

            <div className={styles.chartContainer}>
              <svg className={styles.chartSvg} viewBox={`0 0 ${chartW} ${chartH}`}>
                <line x1={padLeft} y1={padTop} x2={padLeft} y2={chartH - padBottom} stroke="color-mix(in srgb, var(--text) 15%, transparent)" strokeWidth="1" />
                <line x1={padLeft} y1={chartH - padBottom} x2={chartW - padRight} y2={chartH - padBottom} stroke="color-mix(in srgb, var(--text) 15%, transparent)" strokeWidth="1" />

                {[0, 20, 40, 66].map(l => (
                  <g key={l}>
                    <line x1={getX(l)} y1={chartH - padBottom} x2={getX(l)} y2={chartH - padBottom + 4} stroke="color-mix(in srgb, var(--text) 30%, transparent)" strokeWidth="1" />
                    <text x={getX(l)} y={chartH - 4} fill="var(--text-3)" fontSize="14" fontFamily="Barlow Condensed" textAnchor="middle">L{l}</text>
                  </g>
                ))}

                <text x={padLeft - 4} y={getY(100) + 3} fill="var(--text-3)" fontSize="14" fontFamily="Barlow Condensed" textAnchor="end">100%</text>
                <text x={padLeft - 4} y={getY(50) + 3} fill="var(--text-3)" fontSize="14" fontFamily="Barlow Condensed" textAnchor="end">50%</text>
                <text x={padLeft - 4} y={getY(0) + 3} fill="var(--text-3)" fontSize="14" fontFamily="Barlow Condensed" textAnchor="end">0%</text>

                <line x1={padLeft} y1={getY(20)} x2={chartW - padRight} y2={getY(20)} stroke="var(--accion)" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.5" />

                <line 
                  x1={stintStartPoint.x} 
                  y1={stintStartPoint.y} 
                  x2={stintExpectedEndPoint.x} 
                  y2={stintExpectedEndPoint.y} 
                  stroke={stintStroke} 
                  strokeWidth="2.0" 
                  strokeDasharray="4,4" 
                  opacity="0.85" 
                />

                {historyPoints.map((p, i) => {
                  if (i === 0) return null;
                  const prev = historyPoints[i - 1];
                  const strokeCol = compoundStyle(prev.compound).color;
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
                    stroke={stintStroke} 
                    strokeWidth="2.6" 
                  />
                )}

                <circle cx={currentPoint.x} cy={currentPoint.y} r="4.5" fill={stintStroke} stroke="var(--negro)" strokeWidth="1.5" />
              </svg>

              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: COMPOUND_STYLES.soft.color }} />
                  <span>Blandos (~15v)</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: COMPOUND_STYLES.medium.color }} />
                  <span>Medios (~24v)</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: COMPOUND_STYLES.hard.color }} />
                  <span>Duros (~38v)</span>
                </div>
              </div>

              {/* [V4] La previsión del neumático, en la línea de tandas en vez de en una frase. */}
              <StintTimeline stints={stints.map((stint, index) => (index === stints.length - 1 ? { ...stint, compound: tires.compound } : stint))} currentLap={activeCar.currentLap} totalLaps={totalLaps} />
            </div>
          </div>

          {/* 3. DINÁMICA & BALANCE MECÁNICO */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <div className={styles.titleRow}>
                <Gauge size={14} color="var(--info)" />
                <span>BALANCE MECÁNICO & DINÁMICA</span>
              </div>
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
                <span className={styles.note}>{(100 - brakeBiasFront).toFixed(1)}% Trasero</span>
              </div>

              <div className={styles.telemetryMiniBox}>
                <span className={styles.miniBoxLabel}>Temp. Motor V6</span>
                <span className={styles.miniBoxVal}>{stats.engineTempCelsius}°C</span>
                <span className={stats.engineTempCelsius > 115 ? styles.statusHot : styles.statusOptimal}>
                  {stats.engineTempCelsius > 115 ? 'ALERTA' : 'CORRECTA'}
                </span>
              </div>

              <div className={styles.telemetryMiniBox}>
                <span className={styles.miniBoxLabel}>Presión Neumáticos</span>
                <span className={styles.miniBoxVal}>{tirePressurePsi} PSI</span>
                <span className={styles.noteInfo}>Temp: {Math.round(tires.tempCelsius)}°C</span>
              </div>
            </div>

            <div className={styles.gapTop}>
              <div className={styles.telemetryMiniBox}>
                <div className={styles.titleRowTight}>
                  <Wind size={11} color="var(--info)" />
                  <span className={styles.miniBoxLabel}>Carga Aerodinámica & Eficiencia</span>
                </div>
                <span className={styles.miniBoxVal}>{downforceLevel}</span>
                <span className={styles.notePositive}>Aero Rating: {Math.round(team.aerodynamics * 100)}%</span>
              </div>
            </div>

            {pitStop.isPitting && (
              <div ref={pitBannerRef} className={styles.pitActiveBanner}>
                <span className={styles.pitBlink}><CircleDot size={14} aria-hidden="true" /> EN BOXES AHORA MISMO</span>
                <span className={styles.pitCurrentTimer}><Timer size={14} aria-hidden="true" /> {pitStop.currentStopTimer.toFixed(2)}s / {pitStop.stopDuration}s</span>
              </div>
            )}
          </div>
          </>)}

          {/* 4. HISTORIAL DE TODAS LAS VUELTAS */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <div className={styles.titleRow}>
                <History size={14} color="var(--morado)" />
                <span>HISTORIAL DE VUELTAS ({(lapHistory ?? []).length}/{totalLaps})</span>
              </div>
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
                  {(lapHistory ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyRow}>
                        Completando Vuelta 1 en pista...
                      </td>
                    </tr>
                  ) : (
                    [...(lapHistory ?? [])].reverse().map((h) => {
                      const isBestLap = bestLapTime && Math.abs(h.lapTime - bestLapTime) < 0.005;
                      return (
                        <tr key={h.lap}>
                          <td className={styles.lapNumCell}>L{h.lap}</td>
                          <td className={styles.lapTimeCell} style={{ color: isBestLap ? 'var(--morado)' : 'var(--text)' }}>
                            {h.lapTime.toFixed(3)}s
                          </td>
                          <td>{h.sector1 ? `${h.sector1.toFixed(2)}s` : '-'}</td>
                          <td>{h.sector2 ? `${h.sector2.toFixed(2)}s` : '-'}</td>
                          <td>{h.sector3 ? `${h.sector3.toFixed(2)}s` : '-'}</td>
                          <td>
                            <CompoundBadge compound={h.compound} size={14} detail={`vuelta ${h.lap}`} />
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── PESTAÑA 2: PISTA, CLIMA & RADAR GPS METEOROLÓGICO ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'track_weather' && weather && (
        <>
          {/* 1. RADAR GPS METEOROLÓGICO EN VIVO */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <div className={styles.titleRow}>
                <Radio size={14} color="var(--info)" />
                <span>RADAR METEOROLÓGICO GPS</span>
              </div>
              <span className={styles.radarLiveBadge}>● EN VIVO</span>
            </div>

            <div className={styles.radarContainer}>
              <canvas ref={radarCanvasRef} className={styles.radarCanvas} />
              <div className={styles.radarOverlayGps}>
                <Compass size={12} color="var(--info)" />
                <span>GPS: 41°34'12"N 2°15'27"E</span>
              </div>
            </div>

            <div className={styles.radarLegendRow}>
              <div className={styles.radarLegendItem}>
                <span className={styles.radarDot} style={{ background: 'var(--info)' }} />
                <span>Nube Densa</span>
              </div>
              <div className={styles.radarLegendItem}>
                <span className={styles.radarDot} style={{ background: 'var(--accion)' }} />
                <span>Baliza Circuito</span>
              </div>
              <div className={styles.radarLegendItem}>
                <span className={styles.radarDot} style={{ background: 'color-mix(in srgb, var(--info) 30%, transparent)' }} />
                <span>Barrido Doppler</span>
              </div>
            </div>
          </div>

          {/* 2. NIVEL DE AGUA Y PREVISIÓN DE CANTIDAD DE LLUVIA */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <div className={styles.titleRow}>
                <Droplets size={14} color="var(--info)" />
                <span>CANTIDAD DE AGUA & LLUVIA</span>
              </div>
              <span className={styles.weatherConditionBadge}>
                {weather.condition === 'dry' ? <><Sun size={14} aria-hidden="true" /> SECO</> : <><CloudRain size={14} aria-hidden="true" /> LLUVIA</>}
              </span>
            </div>

            <div className={styles.weatherGrid}>
              <div className={styles.weatherMiniBox}>
                <span className={styles.weatherBoxHeader}>Agua en Asfalto</span>
                <span className={styles.weatherBoxVal}>{weather.waterDepthMm.toFixed(1)} mm</span>
                <div className={styles.waterProgressBar}>
                  <div 
                    className={styles.waterProgressFill} 
                    style={{ width: `${Math.max(6, weather.waterPercentage)}%` }} 
                  />
                </div>
                <span className={styles.weatherBoxSub}>{weather.waterPercentage}% Humedad Pista</span>
              </div>

              <div className={styles.weatherMiniBox}>
                <span className={styles.weatherBoxHeader}>Probabilidad Lluvia</span>
                <span className={styles.weatherBoxVal} style={{ color: 'var(--info)' }}>
                  {weather.rainProbabilityPct}%
                </span>
                <span className={styles.weatherBoxSub}>5 min: {weather.forecast5Min}</span>
                <span className={styles.weatherBoxSub}>15 min: {weather.forecast15Min}</span>
              </div>
            </div>

            {/* [R53] Cuándo y dónde se espera la lluvia. */}
            <RainForecastPanel forecast={rainForecast} cloudCoverPct={weather.cloudCoverPct ?? 0} />

            {/* Tactical Tire Suggestion */}
            <div className={styles.strategyRecBox} style={{ borderColor: rainRec.col, background: `color-mix(in srgb, ${rainRec.col} 8%, transparent)` }}>
              <div className={styles.titleRow}>
                <Zap size={13} color={rainRec.col} />
                <span className={styles.recTitle} style={{ color: rainRec.col }}>NEUMÁTICO RECOMENDADO</span>
              </div>
              <span className={styles.recCompound} title={rainRec.advice}>{rainRec.compound}</span>
            </div>
          </div>

          {/* 3. ANEMÓMETRO, TEMPERATURA Y GRIP */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <div className={styles.titleRow}>
                <Wind size={14} color="var(--morado)" />
                <span>VIENTO & TERMOMETRÍA AMBIENTAL</span>
              </div>
            </div>

            <div className={styles.weatherGrid}>
              {/* Viento */}
              <div className={styles.weatherMiniBox}>
                <div className={styles.weatherBoxHeader}>
                  <Wind size={11} color="var(--morado)" />
                  <span>Anemómetro</span>
                </div>
                <span className={styles.weatherBoxVal} style={{ color: 'var(--morado)' }}>
                  {weather.windSpeedKmh} km/h
                </span>
                <span className={styles.weatherBoxSub}>Dirección: {weather.windDirection} (Ráfagas)</span>
                <span className={styles.weatherBoxSub}>Incidencia: Frontal T1</span>
              </div>

              {/* Radar de Lluvia Visual y GP Info */}
              <div className={styles.weatherCard}>
                <RaceHeader circuit={circuit} />
                
                <div className={styles.gapTopL}>
                  <span className={styles.cardTitle}>RADAR DOPPLER GPS</span>
                </div>
              </div>

              {/* Temp Pista */}
              <div className={styles.weatherMiniBox}>
                <div className={styles.weatherBoxHeader}>
                  <Thermometer size={11} color="var(--aviso)" />
                  <span>Temp. Pista</span>
                </div>
                <span className={styles.weatherBoxVal} style={{ color: 'var(--aviso)' }}>
                  {weather.trackTempCelsius}°C
                </span>
                {/* [VS3] Cómo está el asfalto y qué les supone a los neumáticos. */}
                <span className={styles.weatherBoxSub} title={TRACK_TEMP_HINT[trackTempBand(weather.trackTempCelsius)].effect}>{TRACK_TEMP_HINT[trackTempBand(weather.trackTempCelsius)].label}</span>
                <span className={styles.weatherBoxSub}>Ambiente: {weather.airTempCelsius}°C</span>
                <span className={styles.weatherBoxSub}>Humedad: {weather.humidityPercentage}%</span>
              </div>

              {/* Grip Pista */}
              <div className={`${styles.weatherMiniBox} ${styles.span2}`}>
                <div className={styles.weatherBoxHeader}>
                  <Gauge size={11} color="var(--positivo)" />
                  <span>Grip Efectivo en Pista</span>
                </div>
                <div className={styles.between}>
                  <span className={styles.weatherBoxVal} style={{ color: 'var(--positivo)' }}>
                    {Math.round(weather.gripMultiplier * 100)}% ADHERENCIA
                  </span>
                  <span className={styles.weatherBoxSub}>
                    {weather.gripMultiplier >= 0.95 ? 'Grip Máximo' : 'Pérdida de tracción'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
