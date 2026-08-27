import React, { useEffect, useRef } from 'react';
import styles from './HomeScreen.module.css';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';
import { RaceResultHistory } from '../types/f1';
import { Play, Trophy, MapPin, History, Sparkles } from 'lucide-react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Dibujar preview del circuito
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 140;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const b = BARCELONA_CIRCUIT.bounds;
    const tW = b.maxX - b.minX;
    const tH = b.maxY - b.minY;
    const scale = Math.min((canvas.width - 30) / tW, (canvas.height - 30) / tH);
    const offX = 15 + (canvas.width - 30 - tW * scale) / 2;
    const offY = 15 + (canvas.height - 30 - tH * scale) / 2;

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
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Línea de meta
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(first.x, first.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  return (
    <div ref={containerRef} className={styles.homeContainer}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.f1Logo}>F1</div>
          <div className={styles.headerTitles}>
            <h1>F1 GRAND PRIX SIMULATOR</h1>
            <p>SELECCIÓN DE PILOTO & CONFIGURACIÓN DE CARRERA</p>
          </div>
        </div>
      </header>

      {/* ── HISTORIAL DE GRANDES PREMIOS DISPUTADOS ── */}
      {raceHistory.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.historyTitle}>
            <History size={15} />
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
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Tu piloto: <strong>{race.userDriverName} (P{race.userDriverPos})</strong> · Tiempo: {race.totalRaceTime}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SELECCIÓN DE PILOTO Y CIRCUITO ── */}
      <div className={styles.selectionRow}>
        {/* Pilotos Grid */}
        <div>
          <div className={styles.sectionTitle}>
            <Sparkles size={16} color="#ffd700" />
            <span>ELIGE A TU PILOTO PROTAGONISTA (20 PILOTOS)</span>
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
                  onClick={() => onSelectDriver(driver.id)}
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

        {/* Circuito Preview */}
        <div>
          <div className={styles.sectionTitle}>
            <MapPin size={16} color="#e10600" />
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
                <div>⚡ <strong>Curvas:</strong> 16 curvas (Chicane RACC)</div>
                <div>🏁 <strong>Sentido:</strong> Horario (Clockwise)</div>
                <div>🛑 <strong>Pit Lane:</strong> Límite 80 km/h</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTÓN INICIAR GRAN PREMIO ── */}
      <div className={styles.startSection}>
        <button className={styles.launchButton} onClick={onStartRace}>
          <Play size={20} fill="#ffffff" />
          <span>ENTRAR A PISTA & EMPEZAR GRAN PREMIO</span>
        </button>
      </div>
    </div>
  );
};
