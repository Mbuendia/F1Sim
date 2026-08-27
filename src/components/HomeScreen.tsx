import React, { useEffect, useRef, useState } from 'react';
import styles from './HomeScreen.module.css';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';
import { RaceResultHistory } from '../types/f1';
import { Play, MapPin, History, Sparkles, Wrench, Shield, Zap } from 'lucide-react';
import { animate, stagger } from 'animejs';

interface HomeScreenProps {
  selectedDriverId: string;
  onSelectDriver: (driverId: string) => void;
  onStartRace: () => void;
  raceHistory: RaceResultHistory[];
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  selectedDriverId,
  onSelectDriver,
  onStartRace,
  raceHistory
}) => {
  const [inspectedDriverId, setInspectedDriverId] = useState<string>(selectedDriverId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInspectedDriverId(selectedDriverId);
  }, [selectedDriverId]);

  useEffect(() => {
    if (containerRef.current) {
      animate(`.${styles.driverCard}`, {
        scale: [0.94, 1],
        opacity: [0, 1],
        delay: stagger(16),
        ease: 'outQuad',
        duration: 350
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 120;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const b = BARCELONA_CIRCUIT.bounds;
    const tW = b.maxX - b.minX;
    const tH = b.maxY - b.minY;
    const scale = Math.min((canvas.width - 24) / tW, (canvas.height - 24) / tH);
    const offX = 12 + (canvas.width - 24 - tW * scale) / 2;
    const offY = 12 + (canvas.height - 24 - tH * scale) / 2;

    const toScreen = (x: number, y: number) => ({
      x: (x - b.minX) * scale + offX,
      y: (y - b.minY) * scale + offY
    });

    const pts = BARCELONA_CIRCUIT.points;
    ctx.beginPath();
    const first = toScreen(pts[0].x, pts[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 2; i < pts.length; i += 2) {
      const p = toScreen(pts[i].x, pts[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#e10600';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(first.x, first.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const activeDriver = DRIVERS[inspectedDriverId] || DRIVERS[selectedDriverId] || DRIVERS['alonso'];
  const activeTeam = TEAMS[activeDriver.teamId];

  // Métricas calculadas para la ficha técnica
  const horsepower = Math.round(1015 + activeTeam.enginePower * 35);
  const maxKmhApprox = Math.round(335 + activeTeam.carPerformance * 18);
  const maxRpmApprox = 15000;
  const raceRpmApprox = 13500;
  const gears = '8 Marchas + R (Seamless)';
  const downforceKgf = Math.round(1450 + activeTeam.aerodynamics * 350);

  return (
    <div ref={containerRef} className={styles.homeContainer}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.f1Logo}>F1</div>
          <div className={styles.headerTitles}>
            <h1>F1 GRAND PRIX SIMULATOR</h1>
            <p>SELECCIÓN DE PILOTO, FICHA TÉCNICA DEL MONOPLAZA & CIRCUITO</p>
          </div>
        </div>
      </header>

      {/* ── HISTORIAL DE GRANDES PREMIOS DISPUTADOS ── */}
      {raceHistory.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.historyTitle}>
            <History size={14} />
            <span>HISTORIAL DE CARRERAS DISPUTADAS ({raceHistory.length})</span>
          </div>

          <div className={styles.historyCardsList}>
            {raceHistory.map((race) => (
              <div key={race.id} className={styles.historyCard} style={{ borderLeftColor: race.winnerTeamColor }}>
                <div className={styles.historyHeaderRow}>
                  <span>{race.trackName}</span>
                  <span>{race.dateFormatted}</span>
                </div>
                <div className={styles.historyWinner}>
                  🏆 1º {race.winnerName} ({race.winnerTeam})
                </div>
                <div className={styles.historyPodiumSub}>
                  🥈 {race.p2Name} · 🥉 {race.p3Name}
                </div>
                <div className={styles.historyStrategy}>
                  <span>Estrategia: {race.winnerStrategy}</span>
                </div>
                <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '2px' }}>
                  Tu piloto: <strong>{race.userDriverName} (P{race.userDriverPos})</strong> · Tiempo: {race.totalRaceTime}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3 COLUMNAS: GRID PILOTOS + FICHA TÉCNICA + CIRCUITO ── */}
      <div className={styles.selectionRow}>
        {/* 1. Grid de Pilotos */}
        <div>
          <div className={styles.sectionTitle}>
            <Sparkles size={15} color="#ffd700" />
            <span>PARRILLA DE PILOTOS ({STARTING_GRID_ORDER.length})</span>
          </div>

          <div className={styles.driversGrid}>
            {STARTING_GRID_ORDER.map((driverId) => {
              const driver = DRIVERS[driverId];
              const team = TEAMS[driver.teamId];
              const isSelected = selectedDriverId === driverId;

              return (
                <div
                  key={driver.id}
                  className={`${styles.driverCard} ${isSelected ? styles.driverCardSelected : ''}`}
                  style={{ borderLeftColor: team.color }}
                  onClick={() => {
                    onSelectDriver(driver.id);
                    setInspectedDriverId(driver.id);
                  }}
                  onMouseEnter={() => setInspectedDriverId(driver.id)}
                >
                  <div className={styles.cardTopRow}>
                    <div className={styles.driverFlagName}>
                      <span>{driver.countryFlag}</span>
                      <span className={styles.driverName}>{driver.firstName} {driver.lastName}</span>
                    </div>
                    <span className={styles.driverNum} style={{ color: team.color }}>#{driver.number}</span>
                  </div>

                  <div className={styles.driverTeam}>{team.shortName}</div>

                  <div className={styles.statsRow}>
                    <span>🏆 {driver.worldChampionships} Mundiales</span>
                    <span>🥇 {driver.careerWins} Wins</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Inspector Técnico del Piloto & Monoplaza */}
        <div>
          <div className={styles.sectionTitle}>
            <Wrench size={15} color="#38bdf8" />
            <span>FICHA TÉCNICA DEL MONOPLAZA & PILOTO</span>
          </div>

          <div className={styles.inspectorCard} style={{ borderTopColor: activeTeam.color }}>
            <div className={styles.inspectorHeader}>
              <div>
                <div className={styles.inspectorDriverTitle}>
                  {activeDriver.countryFlag} {activeDriver.firstName} {activeDriver.lastName}
                </div>
                <div className={styles.inspectorCarSubtitle}>
                  {activeTeam.name} · #{activeDriver.number}
                </div>
              </div>
              <span className={styles.driverNum} style={{ color: activeTeam.color, fontSize: '18px' }}>
                #{activeDriver.number}
              </span>
            </div>

            {/* Ficha técnica monoplaza */}
            <div className={styles.specsGrid}>
              <div className={styles.specBox}>
                <span className={styles.specLabel}>⚡ Potencia V6 Híbrida</span>
                <span className={styles.specValue}>{horsepower} CV</span>
              </div>

              <div className={styles.specBox}>
                <span className={styles.specLabel}>🚀 Velocidad Punta Estimada</span>
                <span className={styles.specValue}>{maxKmhApprox} km/h (DRS)</span>
              </div>

              <div className={styles.specBox}>
                <span className={styles.specLabel}>⚙️ Transmisión</span>
                <span className={styles.specValue}>{gears}</span>
              </div>

              <div className={styles.specBox}>
                <span className={styles.specLabel}>🌪️ Carga Aerodinámica</span>
                <span className={styles.specValue}>{downforceKgf} kgf (@250km/h)</span>
              </div>

              <div className={styles.specBox}>
                <span className={styles.specLabel}>🔴 RPM Máximas FIA</span>
                <span className={styles.specValue}>{maxRpmApprox.toLocaleString()} RPM</span>
              </div>

              <div className={styles.specBox}>
                <span className={styles.specLabel}>⏱️ Pit Stop Promedio</span>
                <span className={styles.specValue}>{activeTeam.pitStopAverageTime.toFixed(1)}s</span>
              </div>
            </div>

            {/* Radar y Atributos de Habilidad */}
            <div className={styles.driverRadarGrid}>
              <div className={styles.radarRow}>
                <span>🧠 Talento & Pace</span>
                <div className={styles.radarBarBg}>
                  <div className={styles.radarBarFill} style={{ width: `${activeDriver.talentRating * 100}%`, backgroundColor: '#38bdf8' }} />
                </div>
                <span>{Math.round(activeDriver.talentRating * 100)}%</span>
              </div>

              <div className={styles.radarRow}>
                <span>🛞 Gestión de Neumáticos</span>
                <div className={styles.radarBarBg}>
                  <div className={styles.radarBarFill} style={{ width: `${activeDriver.tireManagement * 100}%`, backgroundColor: '#22c55e' }} />
                </div>
                <span>{Math.round(activeDriver.tireManagement * 100)}%</span>
              </div>

              <div className={styles.radarRow}>
                <span>⚔️ Agresividad & Racecraft</span>
                <div className={styles.radarBarBg}>
                  <div className={styles.radarBarFill} style={{ width: `${activeDriver.raceCraft * 100}%`, backgroundColor: '#e10600' }} />
                </div>
                <span>{Math.round(activeDriver.raceCraft * 100)}%</span>
              </div>

              <div className={styles.radarRow}>
                <span>🍀 Factor Suerte & Clima</span>
                <div className={styles.radarBarBg}>
                  <div className={styles.radarBarFill} style={{ width: `${activeDriver.luckRating * 100}%`, backgroundColor: '#ffd700' }} />
                </div>
                <span>{Math.round(activeDriver.luckRating * 100)}%</span>
              </div>

              <div className={styles.radarRow}>
                <span>🎯 Consistencia de Vuelta</span>
                <div className={styles.radarBarBg}>
                  <div className={styles.radarBarFill} style={{ width: `${activeDriver.consistency * 100}%`, backgroundColor: '#c084fc' }} />
                </div>
                <span>{Math.round(activeDriver.consistency * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Circuito Preview */}
        <div>
          <div className={styles.sectionTitle}>
            <MapPin size={15} color="#e10600" />
            <span>CIRCUITO OFICIAL</span>
          </div>

          <div className={styles.trackCard}>
            <canvas ref={canvasRef} className={styles.trackPreviewCanvas} />

            <div className={styles.trackInfo}>
              <h3>{BARCELONA_CIRCUIT.name}</h3>
              <p>{BARCELONA_CIRCUIT.location} · {BARCELONA_CIRCUIT.country}</p>

              <div className={styles.trackSpecsList}>
                <div>📏 <strong>Longitud:</strong> {BARCELONA_CIRCUIT.lapLengthMeters} metros</div>
                <div>🔄 <strong>Vueltas totales:</strong> {BARCELONA_CIRCUIT.totalLaps} vueltas</div>
                <div>⚡ <strong>Curvas:</strong> 16 curvas oficiales</div>
                <div>🏁 <strong>Sentido:</strong> Horario</div>
                <div>🛑 <strong>Pit Lane:</strong> Límite 80 km/h</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTÓN INICIAR GRAN PREMIO ── */}
      <div className={styles.startSection}>
        <button className={styles.launchButton} onClick={onStartRace}>
          <Play size={18} fill="#ffffff" />
          <span>ENTRAR A PISTA & EMPEZAR GRAN PREMIO</span>
        </button>
      </div>
    </div>
  );
};
