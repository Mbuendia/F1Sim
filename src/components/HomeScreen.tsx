import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './HomeScreen.module.css';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { OFFICIAL_CIRCUITS, CircuitSpec } from '../data/circuits';
import { buildTrackFromSvg } from '../utils/svgTrackParser';
import { RaceResultHistory } from '../types/f1';
import { 
  Play, 
  MapPin, 
  History, 
  Sparkles, 
  Wrench, 
  Users, 
  ExternalLink,
  Flag,
  CheckCircle2,
  Zap,
  RotateCw,
  RotateCcw,
  Globe,
  Disc,
  Gauge,
  Award,
  Flame,
  Target,
  Activity,
  TrendingUp,
  Compass,
  Layers,
  ShieldAlert
} from 'lucide-react';
import { animate } from 'animejs';

interface HomeScreenProps {
  selectedDriverId: string;
  selectedCircuitId: string;
  onSelectDriver: (driverId: string) => void;
  onSelectCircuit: (circuitId: string) => void;
  onStartRace: () => void;
  raceHistory: RaceResultHistory[];
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  selectedDriverId,
  selectedCircuitId,
  onSelectDriver,
  onSelectCircuit,
  onStartRace,
  raceHistory
}) => {
  const [activeTab, setActiveTab] = useState<'drivers' | 'circuits'>('drivers');
  const [driverSubTab, setDriverSubTab] = useState<'specs' | 'strategy' | 'records'>('specs');
  const [circuitSubTab, setCircuitSubTab] = useState<'overview' | 'drs' | 'telemetry'>('overview');
  const [inspectedDriverId, setInspectedDriverId] = useState<string>(selectedDriverId);
  const [inspectedCircuitId, setInspectedCircuitId] = useState<string>(selectedCircuitId);

  const centerPanelRef = useRef<HTMLDivElement | null>(null);
  const sidePanelRef = useRef<HTMLDivElement | null>(null);
  const trackPathRef = useRef<SVGPathElement | null>(null);
  const trailPathRef = useRef<SVGPathElement | null>(null);
  const runnerMarkerRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    setInspectedDriverId(selectedDriverId);
  }, [selectedDriverId]);

  useEffect(() => {
    setInspectedCircuitId(selectedCircuitId);
  }, [selectedCircuitId]);

  const inspectedDriver = DRIVERS[inspectedDriverId] || DRIVERS[selectedDriverId] || DRIVERS['alonso'];
  const inspectedTeam = TEAMS[inspectedDriver.teamId];
  const inspectedCircuit = OFFICIAL_CIRCUITS[inspectedCircuitId] || OFFICIAL_CIRCUITS[selectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];

  const selectedDriver = DRIVERS[selectedDriverId] || DRIVERS['alonso'];
  const selectedTeam = TEAMS[selectedDriver.teamId];
  const selectedCircuit = OFFICIAL_CIRCUITS[selectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];

  const trackDefinition = useMemo(() => {
    return buildTrackFromSvg(inspectedCircuit, 600);
  }, [inspectedCircuit]);

  const svgPathD = useMemo(() => {
    const pts = trackDefinition.points;
    if (pts.length === 0) return '';
    const b = trackDefinition.bounds;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;

    const padding = 35;
    const scale = Math.min((500 - padding * 2) / w, (500 - padding * 2) / h);
    const offX = padding + (500 - padding * 2 - w * scale) / 2;
    const offY = padding + (500 - padding * 2 - h * scale) / 2;

    const toSvgCoord = (x: number, y: number) => ({
      x: (x - b.minX) * scale + offX,
      y: (y - b.minY) * scale + offY
    });

    const p0 = toSvgCoord(pts[0].x, pts[0].y);
    let d = `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p = toSvgCoord(pts[i].x, pts[i].y);
      d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    d += ' Z';
    return d;
  }, [trackDefinition]);

  useEffect(() => {
    if (activeTab !== 'circuits' || !svgPathD) return;

    let animFrame: number;
    const startT = performance.now();
    const duration = 4800;

    const step = (now: number) => {
      const pathEl = trackPathRef.current;
      const trailEl = trailPathRef.current;
      const markerEl = runnerMarkerRef.current;

      if (pathEl && markerEl && trailEl) {
        const totalLen = pathEl.getTotalLength();
        if (totalLen > 0) {
          const elapsed = (now - startT) % duration;
          const progress = elapsed / duration;
          const currentDist = progress * totalLen;

          const pt = pathEl.getPointAtLength(currentDist);
          const ptNext = pathEl.getPointAtLength(Math.min(totalLen, (currentDist + 3) % totalLen));
          const angle = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x) * (180 / Math.PI);

          markerEl.setAttribute('transform', `translate(${pt.x}, ${pt.y}) rotate(${angle})`);

          const trailLength = totalLen * 0.32;
          trailEl.style.strokeDasharray = `${trailLength} ${totalLen}`;
          trailEl.style.strokeDashoffset = `${-currentDist + trailLength}`;
        }
      }

      animFrame = requestAnimationFrame(step);
    };

    animFrame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [svgPathD, activeTab]);

  useEffect(() => {
    if (centerPanelRef.current) {
      animate(centerPanelRef.current, {
        opacity: [0.85, 1],
        translateX: [6, 0],
        ease: 'outQuad',
        duration: 200
      });
    }
  }, [inspectedDriverId, inspectedCircuitId, activeTab]);

  return (
    <div className={styles.homeContainer}>
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.f1Logo}>F1</div>
          <div className={styles.headerTitles}>
            <h1>F1 GRAND PRIX SIMULATOR</h1>
            <p>CENTRO DE CONTROL OFICIAL · SELECCIÓN DE PILOTO & CIRCUITO</p>
          </div>
        </div>
      </header>

      {raceHistory.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.historyTitle}>
            <History size={11} />
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
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={styles.mainLayout3Col}>
        <div className={styles.leftColumn}>
          <div className={styles.tabButtonsRow}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'drivers' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('drivers')}
            >
              <Sparkles size={12} />
              <span>PILOTOS ({STARTING_GRID_ORDER.length})</span>
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'circuits' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('circuits')}
            >
              <Flag size={12} />
              <span>CIRCUITOS ({Object.keys(OFFICIAL_CIRCUITS).length})</span>
            </button>
          </div>

          <div className={styles.scrollableListWrapper}>
            {activeTab === 'drivers' ? (
              STARTING_GRID_ORDER.map((driverId) => {
                const d = DRIVERS[driverId];
                const t = TEAMS[d.teamId];
                const isSelected = selectedDriverId === driverId;
                const isInspected = inspectedDriverId === driverId;

                return (
                  <div
                    key={d.id}
                    className={`${styles.driverListItem} ${isSelected ? styles.driverListItemSelected : ''}`}
                    style={{ borderLeftColor: t.color, background: isInspected && !isSelected ? 'rgba(255,255,255,0.09)' : undefined }}
                    onClick={() => {
                      onSelectDriver(d.id);
                      setInspectedDriverId(d.id);
                    }}
                  >
                    <div className={styles.driverListLeft}>
                      <span style={{ fontSize: '15px' }}>{d.countryFlag}</span>
                      <div>
                        <div className={styles.driverListName}>{d.firstName} {d.lastName}</div>
                        <div className={styles.driverListTeam}>{t.shortName} · ⚡ {t.engineManufacturer}</div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className={styles.driverListNum} style={{ color: t.color }}>#{d.number}</span>
                      {isSelected && <div style={{ fontSize: '9px', color: '#22c55e', fontWeight: 800 }}>ACTIVO ✓</div>}
                    </div>
                  </div>
                );
              })
            ) : (
              Object.values(OFFICIAL_CIRCUITS).map((circuit) => {
                const isSelected = selectedCircuitId === circuit.id;
                const isInspected = inspectedCircuitId === circuit.id;

                return (
                  <div
                    key={circuit.id}
                    className={`${styles.circuitListItem} ${isSelected ? styles.circuitListItemSelected : ''}`}
                    style={{ background: isInspected && !isSelected ? 'rgba(255,255,255,0.09)' : undefined }}
                    onClick={() => {
                      onSelectCircuit(circuit.id);
                      setInspectedCircuitId(circuit.id);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{circuit.countryFlag}</span>
                      <div>
                        <div className={styles.circuitListName}>{circuit.name}</div>
                        <div className={styles.circuitListSub}>
                          {circuit.country} · {circuit.direction === 'clockwise' ? '🔄 Horario' : '🔄 Antihorario'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'Orbitron', fontSize: '10.5px', color: '#38bdf8' }}>{circuit.totalLaps} V</span>
                      {isSelected && <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 800 }}>ACTIVO ✓</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div ref={centerPanelRef} className={styles.centerColumn}>
          {activeTab === 'drivers' ? (
            <div>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitleBig}>
                    <span style={{ fontSize: '24px' }}>{inspectedDriver.countryFlag}</span>
                    <span>{inspectedDriver.firstName} {inspectedDriver.lastName}</span>
                  </div>
                  <div className={styles.detailSubtitle}>
                    {inspectedTeam.name} · Piloto Oficial F1 2026
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    className={styles.selectItemConfirmBtn}
                    onClick={() => onSelectDriver(inspectedDriver.id)}
                  >
                    <CheckCircle2 size={15} />
                    <span>{selectedDriverId === inspectedDriver.id ? 'PILOTO ACTIVO' : 'SELECCIONAR'}</span>
                  </button>
                  <span style={{ fontFamily: 'Orbitron', fontSize: '24px', fontWeight: 900, color: inspectedTeam.color }}>
                    #{inspectedDriver.number}
                  </span>
                </div>
              </div>

              {/* Sub-tab navigation for Drivers */}
              <div className={styles.subTabBar}>
                <button
                  className={`${styles.subTabBtn} ${driverSubTab === 'specs' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setDriverSubTab('specs')}
                >
                  <Wrench size={11} />
                  <span>ATRIBUTOS & FICHA</span>
                </button>
                <button
                  className={`${styles.subTabBtn} ${driverSubTab === 'strategy' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setDriverSubTab('strategy')}
                >
                  <TrendingUp size={11} />
                  <span>ESTRATEGIA & ESTILO</span>
                </button>
                <button
                  className={`${styles.subTabBtn} ${driverSubTab === 'records' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setDriverSubTab('records')}
                >
                  <Activity size={11} />
                  <span>RENDIMIENTO 2026</span>
                </button>
              </div>

              {driverSubTab === 'specs' && (
                <div className={styles.detailContentGrid}>
                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Wrench size={14} />
                      <span>FICHA TÉCNICA DEL MONOPLAZA</span>
                    </div>

                    <div className={styles.specs2ColGrid}>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>⚡ Motor V6 Turbo Híbrido</span>
                        <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{inspectedTeam.engineManufacturer}</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🐎 Potencia Estimada</span>
                        <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>{inspectedTeam.horsepower} CV</span>
                      </div>

                      <div className={styles.specItem} style={{ gridColumn: 'span 2' }}>
                        <span className={styles.specItemLabel}>🔧 Unidad de Potencia</span>
                        <span className={styles.specItemVal} style={{ fontSize: '11px' }}>{inspectedTeam.engineModel}</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🚀 Velocidad Punta Teórica</span>
                        <span className={styles.specItemVal}>{Math.round(338 + inspectedTeam.carPerformance * 16)} km/h</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🌪️ Carga Aerodinámica</span>
                        <span className={styles.specItemVal}>{Math.round(1450 + inspectedTeam.aerodynamics * 350)} kgf</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>⚙️ Transmisión</span>
                        <span className={styles.specItemVal}>8 Vel. Seamless Shift</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🔴 Límite RPM FIA</span>
                        <span className={styles.specItemVal}>15.000 RPM</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Sparkles size={14} color="#ffd700" />
                      <span>PALMARÉS & ATRIBUTOS DE COMPETICIÓN</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <div className={styles.specItem} style={{ textAlign: 'center', background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.25)' }}>
                        <span className={styles.specItemLabel}>🏆 Mundiales</span>
                        <span className={styles.specItemVal} style={{ color: '#ffd700', fontSize: '16px' }}>{inspectedDriver.worldChampionships}</span>
                      </div>
                      <div className={styles.specItem} style={{ textAlign: 'center', background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.25)' }}>
                        <span className={styles.specItemLabel}>🥇 Victorias</span>
                        <span className={styles.specItemVal} style={{ color: '#38bdf8', fontSize: '16px' }}>{inspectedDriver.careerWins}</span>
                      </div>
                      <div className={styles.specItem} style={{ textAlign: 'center', background: 'rgba(203,213,225,0.08)', borderColor: 'rgba(203,213,225,0.25)' }}>
                        <span className={styles.specItemLabel}>🥈 Podios</span>
                        <span className={styles.specItemVal} style={{ color: '#e2e8f0', fontSize: '16px' }}>{inspectedDriver.careerPodiums}</span>
                      </div>
                    </div>

                    <div className={styles.radarList}>
                      <div className={styles.radarRow}>
                        <div className={styles.radarLabelGroup}>
                          <Gauge size={13} color="#38bdf8" />
                          <span>Talento Puro</span>
                        </div>
                        <div className={styles.radarBarWrapper}>
                          <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.talentRating * 100}%`, backgroundColor: '#38bdf8' }} />
                        </div>
                        <span className={styles.radarValueBadge}>{Math.round(inspectedDriver.talentRating * 100)}%</span>
                      </div>

                      <div className={styles.radarRow}>
                        <div className={styles.radarLabelGroup}>
                          <Target size={13} color="#22c55e" />
                          <span>Gestión Neumáticos</span>
                        </div>
                        <div className={styles.radarBarWrapper}>
                          <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.tireManagement * 100}%`, backgroundColor: '#22c55e' }} />
                        </div>
                        <span className={styles.radarValueBadge}>{Math.round(inspectedDriver.tireManagement * 100)}%</span>
                      </div>

                      <div className={styles.radarRow}>
                        <div className={styles.radarLabelGroup}>
                          <Award size={13} color="#c084fc" />
                          <span>Consistencia Vuelta</span>
                        </div>
                        <div className={styles.radarBarWrapper}>
                          <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.consistency * 100}%`, backgroundColor: '#c084fc' }} />
                        </div>
                        <span className={styles.radarValueBadge}>{Math.round(inspectedDriver.consistency * 100)}%</span>
                      </div>

                      <div className={styles.radarRow}>
                        <div className={styles.radarLabelGroup}>
                          <Flame size={13} color="#e10600" />
                          <span>Agresividad Batalla</span>
                        </div>
                        <div className={styles.radarBarWrapper}>
                          <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.raceCraft * 100}%`, backgroundColor: '#e10600' }} />
                        </div>
                        <span className={styles.radarValueBadge}>{Math.round(inspectedDriver.raceCraft * 100)}%</span>
                      </div>

                      <div className={styles.radarRow}>
                        <div className={styles.radarLabelGroup}>
                          <Sparkles size={13} color="#ffd700" />
                          <span>Factor Suerte</span>
                        </div>
                        <div className={styles.radarBarWrapper}>
                          <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.luckRating * 100}%`, backgroundColor: '#ffd700' }} />
                        </div>
                        <span className={styles.radarValueBadge}>{Math.round(inspectedDriver.luckRating * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {driverSubTab === 'strategy' && (
                <div className={styles.detailContentGrid}>
                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Target size={14} color="#22c55e" />
                      <span>PERFIL DE GESTIÓN & DEGRADACIÓN</span>
                    </div>
                    <div className={styles.specs2ColGrid}>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>📉 Desgaste Estimado</span>
                        <span className={styles.specItemVal} style={{ color: '#22c55e' }}>
                          {(1.45 - inspectedDriver.tireManagement * 0.65).toFixed(2)}% / vta
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>⏱️ Ventana Overcut</span>
                        <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>
                          {inspectedDriver.tireManagement > 0.85 ? 'Excelente (+4 Vtas)' : inspectedDriver.tireManagement > 0.70 ? 'Favorable (+2 Vtas)' : 'Estándar'}
                        </span>
                      </div>
                      <div className={styles.specItem} style={{ gridColumn: 'span 2' }}>
                        <span className={styles.specItemLabel}>🌧️ Adaptabilidad a Lluvia & Clima Mixto</span>
                        <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>
                          {Math.round(inspectedDriver.talentRating * 70 + inspectedDriver.consistency * 30)}%
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🔥 Tasa de Éxito en Adelantamiento</span>
                        <span className={styles.specItemVal} style={{ color: '#ffd700' }}>
                          {Math.round(inspectedDriver.raceCraft * 75 + inspectedDriver.talentRating * 25)}%
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>⚠️ Riesgo de Incidente</span>
                        <span className={styles.specItemVal} style={{ color: inspectedDriver.raceCraft > 0.85 ? '#ef4444' : '#22c55e' }}>
                          {Math.round(inspectedDriver.raceCraft * 30 * (1.1 - inspectedDriver.luckRating * 0.3))}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Compass size={14} color="#38bdf8" />
                      <span>ESTILO DE PILOTAJE EN CARRERA</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className={styles.strategyHighlightBox}>
                        <span className={styles.strategyHighlightTitle}>FILOSOFÍA DE CARRERA</span>
                        <span className={styles.strategyHighlightVal}>
                          {inspectedDriver.raceCraft > 0.85 
                            ? '⚔️ Máxima Agresividad · Búsqueda constante de huecos y frenadas tardías' 
                            : inspectedDriver.tireManagement > 0.80 
                            ? '🧠 Estratega Conservador · Cuidado de neumáticos y ritmo constante' 
                            : '⚡ Piloto Equilibrado · Fuerte en ritmo de carrera y stint medio'}
                        </span>
                      </div>
                      <div className={styles.strategyHighlightBox} style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.3)' }}>
                        <span className={styles.strategyHighlightTitle} style={{ color: '#38bdf8' }}>ESTRATEGIA RECOMENDADA 2026</span>
                        <span className={styles.strategyHighlightVal}>
                          {inspectedDriver.tireManagement > 0.80 ? '1 Parada Óptima (Medio ➔ Duro)' : '2 Paradas Agresivas (Blando ➔ Medio ➔ Blando)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {driverSubTab === 'records' && (
                <div className={styles.detailContentGrid}>
                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Award size={14} color="#ffd700" />
                      <span>PALMARÉS HISTÓRICO FIA F1</span>
                    </div>
                    <div className={styles.specs2ColGrid}>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🏆 Campeonatos del Mundo</span>
                        <span className={styles.specItemVal} style={{ color: '#ffd700', fontSize: '15px' }}>{inspectedDriver.worldChampionships}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🥇 Grandes Premios Ganados</span>
                        <span className={styles.specItemVal} style={{ color: '#38bdf8', fontSize: '15px' }}>{inspectedDriver.careerWins}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🥈 Podios Totales</span>
                        <span className={styles.specItemVal} style={{ color: '#e2e8f0', fontSize: '15px' }}>{inspectedDriver.careerPodiums}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>⚡ Eficiencia Q3 Calificación</span>
                        <span className={styles.specItemVal} style={{ color: '#22c55e' }}>{Math.round(inspectedDriver.talentRating * 95)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Activity size={14} color="#c084fc" />
                      <span>RENDIMIENTO TEMPORADA 2026</span>
                    </div>
                    <div className={styles.specs2ColGrid}>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🏎️ Monoplaza 2026</span>
                        <span className={styles.specItemVal}>{inspectedTeam.name}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>⚡ Unidad de Potencia</span>
                        <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{inspectedTeam.engineManufacturer}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>📊 Puntuación Rating FIA</span>
                        <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>{Math.round((inspectedDriver.talentRating + inspectedDriver.consistency + inspectedDriver.tireManagement) / 3 * 100)} / 100</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🛡️ Fiabilidad Mecánica</span>
                        <span className={styles.specItemVal} style={{ color: '#22c55e' }}>{Math.round(inspectedTeam.reliability * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitleBig}>
                    <span style={{ fontSize: '24px' }}>{inspectedCircuit.countryFlag}</span>
                    <span>{inspectedCircuit.name}</span>
                  </div>
                  <div className={styles.detailSubtitle}>
                    {inspectedCircuit.officialGpName} · {inspectedCircuit.location}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button 
                    className={styles.selectItemConfirmBtn}
                    onClick={() => onSelectCircuit(inspectedCircuit.id)}
                  >
                    <CheckCircle2 size={15} />
                    <span>{selectedCircuitId === inspectedCircuit.id ? 'CIRCUITO ACTIVO' : 'SELECCIONAR'}</span>
                  </button>
                  <a
                    href={inspectedCircuit.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mapsLinkBtn}
                    title="Ver en Google Maps"
                  >
                    <MapPin size={12} />
                    <span>MAPS</span>
                    <ExternalLink size={10} />
                  </a>
                  {inspectedCircuit.officialWebsiteUrl && (
                    <a
                      href={inspectedCircuit.officialWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.mapsLinkBtn}
                      title="Sitio Web Oficial del Circuito"
                    >
                      <Globe size={12} />
                      <span>WEB</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>

              {/* Sub-tab navigation for Circuits */}
              <div className={styles.subTabBar}>
                <button
                  className={`${styles.subTabBtn} ${circuitSubTab === 'overview' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setCircuitSubTab('overview')}
                >
                  <Layers size={11} />
                  <span>TRAZADO & FICHA</span>
                </button>
                <button
                  className={`${styles.subTabBtn} ${circuitSubTab === 'drs' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setCircuitSubTab('drs')}
                >
                  <Zap size={11} />
                  <span>ZONAS DRS & ESTRATEGIA</span>
                </button>
                <button
                  className={`${styles.subTabBtn} ${circuitSubTab === 'telemetry' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setCircuitSubTab('telemetry')}
                >
                  <Users size={11} />
                  <span>METEOROLOGÍA & ASFALTO</span>
                </button>
              </div>

              {circuitSubTab === 'overview' && (
                <div>
                  <div className={styles.svgMotionPathContainer}>
                    {svgPathD ? (
                      <svg 
                        viewBox="0 0 500 500" 
                        preserveAspectRatio="xMidYMid meet" 
                        className={styles.svgMotionCanvas}
                      >
                        <path 
                          d={svgPathD} 
                          fill="none" 
                          stroke="#0f3b4c" 
                          strokeWidth="14" 
                          opacity="0.75" 
                        />
                        <path 
                          ref={trackPathRef}
                          id="active-circuit-path" 
                          d={svgPathD} 
                          fill="none" 
                          stroke="#0891b2" 
                          strokeWidth="3.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                        <path 
                          ref={trailPathRef}
                          d={svgPathD} 
                          fill="none" 
                          stroke="#00f0ff" 
                          strokeWidth="6" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          filter="drop-shadow(0 0 10px #00f0ff)"
                        />
                        <g ref={runnerMarkerRef} id="circuit-runner-marker">
                          <circle 
                            r="6.5" 
                            fill="#00f0ff" 
                            stroke="#ffffff" 
                            strokeWidth="2" 
                            filter="drop-shadow(0 0 8px #00f0ff)"
                          />
                          <circle 
                            r="2.5" 
                            fill="#ffffff" 
                          />
                        </g>
                      </svg>
                    ) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '12px' }}>
                        Cargando trazado oficial del circuito...
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '10px', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        {inspectedCircuit.direction === 'clockwise' ? <RotateCw size={11} /> : <RotateCcw size={11} />}
                        <span>{inspectedCircuit.direction === 'clockwise' ? 'Sentido Horario' : 'Sentido Antihorario'}</span>
                      </span>
                      <span style={{ fontSize: '10px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        <Zap size={11} />
                        <span>{inspectedCircuit.drsZones} Zonas DRS</span>
                      </span>
                      <span style={{ fontSize: '10px', background: 'rgba(234,179,8,0.12)', color: '#eab308', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        <Disc size={11} />
                        <span>Abrasión: {inspectedCircuit.asphaltAbrasion || 'Alta'}</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <a href={inspectedCircuit.racingCircuitsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapsLinkBtn} title="RacingCircuits.info">
                        <span>RacingCircuits</span>
                        <ExternalLink size={9} />
                      </a>
                      <a href={inspectedCircuit.statsF1Url} target="_blank" rel="noopener noreferrer" className={styles.mapsLinkBtn} title="StatsF1.com">
                        <span>StatsF1</span>
                        <ExternalLink size={9} />
                      </a>
                    </div>
                  </div>

                  <div className={styles.detailContentGrid}>
                    <div className={styles.detailCardBox}>
                      <div className={styles.detailCardTitle}>
                        <Flag size={14} color="#e10600" />
                        <span>FICHA TÉCNICA DE LA PISTA</span>
                      </div>
                      <div className={styles.specs2ColGrid}>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>📏 Longitud Oficial</span>
                          <span className={styles.specItemVal}>{inspectedCircuit.lapLengthMeters} m</span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>🔄 Vueltas de Carrera</span>
                          <span className={styles.specItemVal}>{inspectedCircuit.totalLaps} Vtas</span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>⚡ Curvas Totales</span>
                          <span className={styles.specItemVal}>{inspectedCircuit.turns} Curvas</span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>🏎️ Capacidad Paralelo</span>
                          <span className={styles.specItemVal} style={{ color: inspectedCircuit.trackWidthCars === 2 ? '#eab308' : '#22c55e' }}>
                            {inspectedCircuit.trackWidthCars === 2 ? '2 Coches (Urbano)' : '3 Coches (Permanente)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.detailCardBox}>
                      <div className={styles.detailCardTitle}>
                        <Compass size={14} color="#38bdf8" />
                        <span>RÉCORD & ESTRUCTURA DEL GP</span>
                      </div>
                      <div className={styles.specs2ColGrid}>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>⏱️ Pérdida en Pit Lane</span>
                          <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{inspectedCircuit.pitLaneTimeLossSec || 22.5}s</span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>🏁 Distancia Total</span>
                          <span className={styles.specItemVal}>{((inspectedCircuit.lapLengthMeters * inspectedCircuit.totalLaps) / 1000).toFixed(1)} km</span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>🚨 Probabilidad SC</span>
                          <span className={styles.specItemVal} style={{ color: '#f97316' }}>{inspectedCircuit.safetyCarProbabilityPercent || 50}%</span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specItemLabel}>👥 Espectadores</span>
                          <span className={styles.specItemVal}>{inspectedCircuit.spectators ? inspectedCircuit.spectators.toLocaleString('es-ES') : '140.000'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {circuitSubTab === 'drs' && (
                <div className={styles.detailContentGrid}>
                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Zap size={14} color="#00ff66" />
                      <span>DESGLOSE ZONAS DRS ACTIVAS ({inspectedCircuit.drsZoneSpecs?.length || inspectedCircuit.drsZones})</span>
                    </div>
                    <div className={styles.drsListGrid}>
                      {inspectedCircuit.drsZoneSpecs && inspectedCircuit.drsZoneSpecs.length > 0 ? (
                        inspectedCircuit.drsZoneSpecs.map((zone) => (
                          <div key={zone.id} className={styles.drsCardItem}>
                            <div className={styles.drsZoneName}>
                              <span>⚡ Zona {zone.id}: {zone.name}</span>
                            </div>
                            <span className={styles.drsZoneRange}>
                              {Math.round(zone.startT * 100)}% ➔ {Math.round(zone.endT * 100)}% de vuelta
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px', padding: '8px' }}>
                          {inspectedCircuit.drsZones} Zonas de DRS activas autorizadas por la FIA.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <TrendingUp size={14} color="#ffd700" />
                      <span>ESTRATEGIA RECOMENDADA DE PIT STOPS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className={styles.strategyHighlightBox}>
                        <span className={styles.strategyHighlightTitle}>ESTRATEGIA ÓPTIMA (PIRELLI)</span>
                        <span className={styles.strategyHighlightVal}>
                          {inspectedCircuit.asphaltAbrasion === 'Muy Alta' || inspectedCircuit.asphaltAbrasion === 'Alta'
                            ? '🔴 2 PARADAS (Blando ➔ Medio ➔ Duro)'
                            : '🟡 1 PARADA (Medio ➔ Duro)'}
                        </span>
                      </div>
                      <div className={styles.strategyHighlightBox} style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.3)' }}>
                        <span className={styles.strategyHighlightTitle} style={{ color: '#38bdf8' }}>PÉRDIDA ESTIMADA EN PIT LANE</span>
                        <span className={styles.strategyHighlightVal}>
                          ⏱️ ~{inspectedCircuit.pitLaneTimeLossSec || 22.5} segundos totales (Límite: 80 km/h)
                        </span>
                      </div>
                      <div className={styles.strategyHighlightBox} style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' }}>
                        <span className={styles.strategyHighlightTitle} style={{ color: '#22c55e' }}>FACILIDAD DE ADELANTAMIENTO</span>
                        <span className={styles.strategyHighlightVal}>
                          {inspectedCircuit.drsZones >= 3 ? '🟢 ALTA (Múltiples zonas DRS y rectas anchas)' : inspectedCircuit.trackWidthCars === 2 ? '🔴 MUY BAJA (Circuito urbano estrecho)' : '🟡 MEDIA (Dependiente del ritmo de carrera)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {circuitSubTab === 'telemetry' && (
                <div className={styles.detailContentGrid}>
                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Users size={14} />
                      <span>METEOROLOGÍA & ASFALTO (PIRELLI / STATSF1)</span>
                    </div>

                    <div className={styles.specs2ColGrid}>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🛞 Abrasión del Asfalto</span>
                        <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{inspectedCircuit.asphaltAbrasion || 'Alta'}</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🧪 Estrés Neumáticos</span>
                        <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>{inspectedCircuit.tireStressLevel || 'Alta'}</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🌧️ Prob. Lluvia</span>
                        <span className={styles.specItemVal} style={{ color: inspectedCircuit.rainProbabilityPercent > 30 ? '#38bdf8' : '#22c55e' }}>
                          {inspectedCircuit.rainProbabilityPercent}%
                        </span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>💨 Viento</span>
                        <span className={styles.specItemVal}>{inspectedCircuit.windSpeedKmh} km/h ({inspectedCircuit.windDirection})</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🚨 Prob. Safety Car</span>
                        <span className={styles.specItemVal} style={{ color: '#f97316' }}>{inspectedCircuit.safetyCarProbabilityPercent || 50}%</span>
                      </div>

                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>⛰️ Desnivel / Elevación</span>
                        <span className={styles.specItemVal}>{inspectedCircuit.elevationChangeMeters || 30} metros</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailCardBox}>
                    <div className={styles.detailCardTitle}>
                      <Globe size={14} color="#38bdf8" />
                      <span>ENLACES OFICIALES & COORDENADAS</span>
                    </div>
                    <div className={styles.specs2ColGrid}>
                      <div className={styles.specItem} style={{ gridColumn: 'span 2' }}>
                        <span className={styles.specItemLabel}>📍 Ubicación</span>
                        <span className={styles.specItemVal}>{inspectedCircuit.location}, {inspectedCircuit.country}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🌐 Latitud</span>
                        <span className={styles.specItemVal}>{inspectedCircuit.latitude || 0}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specItemLabel}>🌐 Longitud</span>
                        <span className={styles.specItemVal}>{inspectedCircuit.longitude || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={sidePanelRef} className={styles.rightSidePanel}>
          <div>
            <div className={styles.sidePanelTitle}>
              <Zap size={13} color="#ffd700" />
              <span>SELECCIÓN ACTIVA DE CARRERA</span>
            </div>

            <div className={styles.sideSummaryCards}>
              <div className={styles.selectedSummaryCard} style={{ borderLeft: `4px solid ${selectedTeam.color}` }}>
                <span className={styles.summaryCardBadge} style={{ color: selectedTeam.color }}>PILOTO SELECCIONADO</span>
                <div className={styles.summaryCardMain}>
                  <span style={{ fontSize: '18px' }}>{selectedDriver.countryFlag}</span>
                  <span>{selectedDriver.firstName} {selectedDriver.lastName}</span>
                  <span style={{ color: selectedTeam.color, marginLeft: 'auto', fontFamily: 'Orbitron' }}>#{selectedDriver.number}</span>
                </div>
                <div className={styles.summaryCardSub}>{selectedTeam.name}</div>
                <div className={styles.summaryCardExtra}>
                  ⚡ {selectedTeam.engineManufacturer} ({selectedTeam.horsepower} CV)
                </div>
              </div>

              <div className={styles.selectedSummaryCard} style={{ borderLeft: '4px solid #e10600' }}>
                <span className={styles.summaryCardBadge} style={{ color: '#e10600' }}>CIRCUITO SELECCIONADO</span>
                <div className={styles.summaryCardMain}>
                  <span style={{ fontSize: '18px' }}>{selectedCircuit.countryFlag}</span>
                  <span>{selectedCircuit.name}</span>
                </div>
                <div className={styles.summaryCardSub}>{selectedCircuit.officialGpName} · {selectedCircuit.country}</div>
                <div className={styles.summaryCardExtra} style={{ color: '#ffd700', background: 'rgba(255,215,0,0.1)' }}>
                  🏁 {selectedCircuit.totalLaps} Vueltas · {selectedCircuit.direction === 'clockwise' ? '🔄 Horario' : '🔄 Antihorario'}
                </div>
                <div style={{ marginTop: '4px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img 
                    src={`${import.meta.env.BASE_URL}circuits/minimal/${selectedCircuit.svgFile}`} 
                    alt={selectedCircuit.name} 
                    style={{ maxHeight: '100%', maxWidth: '100%', filter: 'drop-shadow(0 0 6px rgba(225,6,0,0.5))' }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <button className={styles.launchBigButton} onClick={onStartRace}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Play size={15} fill="#ffffff" />
              <span>ENTRAR A PISTA</span>
            </div>
            <span style={{ fontSize: '8.5px', opacity: 0.85, letterSpacing: '0.5px' }}>EMPEZAR GRAN PREMIO OFICIAL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
