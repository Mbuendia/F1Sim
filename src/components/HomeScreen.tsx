import React, { useEffect, useRef, useState } from 'react';
import styles from './HomeScreen.module.css';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';
import { RaceResultHistory } from '../types/f1';
import { Play, MapPin, History, Sparkles, Wrench, Shield, Zap, Check, X, Flame } from 'lucide-react';
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
  const [modalDriverId, setModalDriverId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

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
    if (modalDriverId && modalRef.current) {
      animate(modalRef.current, {
        scale: [0.88, 1],
        opacity: [0, 1],
        ease: 'outElastic(1, .75)',
        duration: 450
      });
    }
  }, [modalDriverId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 130;

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

  const modalDriver = modalDriverId ? DRIVERS[modalDriverId] : null;
  const modalTeam = modalDriver ? TEAMS[modalDriver.teamId] : null;

  return (
    <div ref={containerRef} className={styles.homeContainer}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.f1Logo}>F1</div>
          <div className={styles.headerTitles}>
            <h1>F1 GRAND PRIX SIMULATOR</h1>
            <p>SELECCIÓN DE PILOTO, FICHA TÉCNICA OFICIAL & CIRCUITO</p>
          </div>
        </div>
      </header>

      {/* ── HISTORIAL SUPERIOR DE CARRERAS DISPUTADAS ── */}
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

      {/* ── LAYOUT DE 2 COLUMNAS (GRID PILOTOS + CIRCUITO) ── */}
      <div className={styles.selectionRow}>
        {/* 1. Grid de Pilotos */}
        <div>
          <div className={styles.sectionTitle}>
            <Sparkles size={15} color="#ffd700" />
            <span>PARRILLA DE PILOTOS 2026 (Haz clic o pasa el ratón para ver la ficha técnica)</span>
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
                    setModalDriverId(driver.id);
                  }}
                  onMouseEnter={() => {
                    setModalDriverId(driver.id);
                  }}
                >
                  <div className={styles.cardTopRow}>
                    <div className={styles.driverFlagName}>
                      <span>{driver.countryFlag}</span>
                      <span className={styles.driverName}>{driver.firstName} {driver.lastName}</span>
                    </div>
                    <span className={styles.driverNum} style={{ color: team.color }}>#{driver.number}</span>
                  </div>

                  <div className={styles.driverTeam}>{team.name}</div>
                  
                  <div className={styles.engineBadge}>
                    ⚡ {team.engineManufacturer} ({team.horsepower} CV)
                  </div>

                  <div className={styles.statsRow}>
                    <span>🏆 {driver.worldChampionships} Tit.</span>
                    <span>🥇 {driver.careerWins} Wins</span>
                    <span>🍀 {Math.round(driver.luckRating * 100)}% Suerte</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Circuito Oficial */}
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

      {/* ════ OVERLAY GIGANTE DE FICHA TÉCNICA A PANTALLA COMPLETA ════ */}
      {modalDriver && modalTeam && (
        <div 
          className={styles.overlayBackdrop} 
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalDriverId(null);
          }}
        >
          <div ref={modalRef} className={styles.overlayModal} style={{ borderTopColor: modalTeam.color }}>
            <button className={styles.modalCloseBtn} onClick={() => setModalDriverId(null)}>
              <X size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              CERRAR (ESC)
            </button>

            {/* Cabecera del Piloto */}
            <div className={styles.modalHeroRow}>
              <div>
                <div className={styles.modalDriverNameBig}>
                  <span>{modalDriver.countryFlag}</span>
                  <span>{modalDriver.firstName} {modalDriver.lastName}</span>
                </div>
                <div className={styles.modalTeamSubtitle}>
                  {modalTeam.name} · Piloto Oficial FIA Formula 1
                </div>
              </div>
              <div className={styles.modalNumberPill} style={{ color: modalTeam.color, border: `2px solid ${modalTeam.color}` }}>
                #{modalDriver.number}
              </div>
            </div>

            {/* Contenido en 2 Columnas Grandes */}
            <div className={styles.modalContentGrid}>
              {/* Columna Izquierda: Ficha Técnica del Monoplaza & Motor */}
              <div className={styles.modalSectionCard}>
                <div className={styles.modalSectionTitle}>
                  <Wrench size={16} color="#38bdf8" />
                  <span>ESPECIFICACIONES TÉCNICAS DEL MONOPLAZA</span>
                </div>

                <div className={styles.modalSpecs2Col}>
                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>⚡ Fabricante Unidad de Potencia</span>
                    <span className={styles.modalSpecVal} style={{ color: '#ffd700' }}>{modalTeam.engineManufacturer}</span>
                  </div>

                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>🐎 Potencia Estimada</span>
                    <span className={styles.modalSpecVal} style={{ color: '#38bdf8' }}>{modalTeam.horsepower} CV</span>
                  </div>

                  <div className={styles.modalSpecBox} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.modalSpecLabel}>🔧 Modelo de Motor V6 Turbo Híbrido</span>
                    <span className={styles.modalSpecVal} style={{ fontSize: '11px' }}>{modalTeam.engineModel}</span>
                  </div>

                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>🚀 Velocidad Punta Estimada</span>
                    <span className={styles.modalSpecVal}>{Math.round(338 + modalTeam.carPerformance * 16)} km/h (DRS)</span>
                  </div>

                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>🌪️ Carga Aerodinámica (Downforce)</span>
                    <span className={styles.modalSpecVal}>{Math.round(1450 + modalTeam.aerodynamics * 350)} kgf (@250km/h)</span>
                  </div>

                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>⚙️ Transmisión & Marchas</span>
                    <span className={styles.modalSpecVal}>8 Vel. Seamless + R</span>
                  </div>

                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>🔴 Límite de RPM FIA</span>
                    <span className={styles.modalSpecVal}>15.000 RPM (13.5k Race)</span>
                  </div>

                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>⏱️ Tiempo Medio Pit Stop</span>
                    <span className={styles.modalSpecVal}>{modalTeam.pitStopAverageTime.toFixed(1)}s</span>
                  </div>

                  <div className={styles.modalSpecBox}>
                    <span className={styles.modalSpecLabel}>🛡️ Fiabilidad Mecánica Base</span>
                    <span className={styles.modalSpecVal} style={{ color: modalTeam.reliability > 0.97 ? '#22c55e' : '#f59e0b' }}>
                      {Math.round(modalTeam.reliability * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Palmarés Oficial & Radar de Habilidades del Piloto */}
              <div className={styles.modalSectionCard}>
                <div className={styles.modalSectionTitle}>
                  <Sparkles size={16} color="#ffd700" />
                  <span>PALMARÉS Y ATRIBUTOS DE PILOTAJE</span>
                </div>

                {/* Palmarés */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div className={styles.modalSpecBox} style={{ textAlign: 'center' }}>
                    <span className={styles.modalSpecLabel}>🏆 Mundiales</span>
                    <span className={styles.modalSpecVal} style={{ color: '#ffd700', fontSize: '18px' }}>{modalDriver.worldChampionships}</span>
                  </div>
                  <div className={styles.modalSpecBox} style={{ textAlign: 'center' }}>
                    <span className={styles.modalSpecLabel}>🥇 Victorias</span>
                    <span className={styles.modalSpecVal} style={{ fontSize: '18px' }}>{modalDriver.careerWins}</span>
                  </div>
                  <div className={styles.modalSpecBox} style={{ textAlign: 'center' }}>
                    <span className={styles.modalSpecLabel}>🥈 Podios</span>
                    <span className={styles.modalSpecVal} style={{ fontSize: '18px' }}>{modalDriver.careerPodiums}</span>
                  </div>
                </div>

                {/* Radar con explicaciones */}
                <div className={styles.modalRadarList} style={{ marginTop: '8px' }}>
                  <div className={styles.modalRadarItem}>
                    <div>
                      <span>🧠 Talento Puro & Ritmo en Vuelta</span>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>Velocidad pura y tiempo por vuelta</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className={styles.modalRadarBarBg}>
                        <div className={styles.modalRadarBarFill} style={{ width: `${modalDriver.talentRating * 100}%`, backgroundColor: '#38bdf8' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '32px' }}>{Math.round(modalDriver.talentRating * 100)}%</span>
                    </div>
                  </div>

                  <div className={styles.modalRadarItem}>
                    <div>
                      <span>🛞 Gestión de Neumáticos (Tire Save)</span>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>Mayor duración y agarre prolongado de gomas</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className={styles.modalRadarBarBg}>
                        <div className={styles.modalRadarBarFill} style={{ width: `${modalDriver.tireManagement * 100}%`, backgroundColor: '#22c55e' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '32px' }}>{Math.round(modalDriver.tireManagement * 100)}%</span>
                    </div>
                  </div>

                  <div className={styles.modalRadarItem}>
                    <div>
                      <span>⚔️ Agresividad en Batalla (Racecraft)</span>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>Facilidad para defender y adelantar en pista</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className={styles.modalRadarBarBg}>
                        <div className={styles.modalRadarBarFill} style={{ width: `${modalDriver.raceCraft * 100}%`, backgroundColor: '#e10600' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '32px' }}>{Math.round(modalDriver.raceCraft * 100)}%</span>
                    </div>
                  </div>

                  <div className={styles.modalRadarItem}>
                    <div>
                      <span>🎯 Consistencia de Vueltas (Lap Precision)</span>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>Vueltas calcadas en milésimas sin errores</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className={styles.modalRadarBarBg}>
                        <div className={styles.modalRadarBarFill} style={{ width: `${modalDriver.consistency * 100}%`, backgroundColor: '#c084fc' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '32px' }}>{Math.round(modalDriver.consistency * 100)}%</span>
                    </div>
                  </div>

                  <div className={styles.modalRadarItem}>
                    <div>
                      <span>🍀 Factor Suerte & Resistencia a Averías</span>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>Inmunidad a pinchazos y roturas de motor V6</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className={styles.modalRadarBarBg}>
                        <div className={styles.modalRadarBarFill} style={{ width: `${modalDriver.luckRating * 100}%`, backgroundColor: '#ffd700' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '32px' }}>{Math.round(modalDriver.luckRating * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className={styles.modalActions}>
              <button 
                className={styles.selectDriverConfirmBtn} 
                onClick={() => {
                  onSelectDriver(modalDriver.id);
                  setModalDriverId(null);
                }}
              >
                <Check size={16} />
                <span>SELECCIONAR A {modalDriver.lastName.toUpperCase()} COMO PROTAGONISTA</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
