import React, { useState, useEffect, useRef } from 'react';
import styles from './HomeScreen.module.css';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { OFFICIAL_CIRCUITS, CircuitSpec } from '../data/circuits';
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
  Zap
} from 'lucide-react';
import { animate, createMotionPath } from 'animejs';

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
  const [inspectedDriverId, setInspectedDriverId] = useState<string>(selectedDriverId);
  const [inspectedCircuitId, setInspectedCircuitId] = useState<string>(selectedCircuitId);
  const [extractedPathD, setExtractedPathD] = useState<string>('');

  const centerPanelRef = useRef<HTMLDivElement | null>(null);
  const sidePanelRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const glowTrailRef = useRef<SVGPathElement | null>(null);
  const runnerCarRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    setInspectedDriverId(selectedDriverId);
  }, [selectedDriverId]);

  useEffect(() => {
    setInspectedCircuitId(selectedCircuitId);
  }, [selectedCircuitId]);

  // Cargar el archivo SVG minimal oficial y extraer su <path d="...">
  useEffect(() => {
    const circuit = OFFICIAL_CIRCUITS[inspectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];
    const svgUrl = `/circuits/minimal/${circuit.svgFile}`;

    fetch(svgUrl)
      .then((res) => res.text())
      .then((svgText) => {
        const match = svgText.match(/<path[^>]*d="([^"]+)"/i);
        if (match && match[1]) {
          setExtractedPathD(match[1]);
        }
      })
      .catch((err) => {
        console.error('Error loading circuit SVG:', err);
      });
  }, [inspectedCircuitId]);

  // Animación del circuito con createMotionPath y estela de trazo en bucle continuo
  useEffect(() => {
    if (activeTab !== 'circuits' || !extractedPathD) return;

    let animInstance: any = null;
    let fallbackFrame: number | null = null;

    const timer = setTimeout(() => {
      const pathEl = pathRef.current;
      const carEl = runnerCarRef.current;
      const trailEl = glowTrailRef.current;

      if (!pathEl || !carEl) return;

      const totalLen = pathEl.getTotalLength();

      // Configurar estela brillante que va recorriendo el circuito
      if (trailEl) {
        trailEl.style.strokeDasharray = `${totalLen * 0.28} ${totalLen * 0.72}`;
        trailEl.style.strokeDashoffset = '0';

        try {
          animate(trailEl, {
            strokeDashoffset: [-totalLen, 0],
            duration: 4800,
            loop: true,
            ease: 'linear'
          });
        } catch (e) {
          // Ignore
        }
      }

      try {
        if (typeof createMotionPath === 'function') {
          const pathMotion = createMotionPath(pathEl);
          animInstance = animate(carEl, {
            ...pathMotion,
            duration: 4800,
            loop: true,
            ease: 'linear'
          });
        }
      } catch (err) {
        console.warn('Anime createMotionPath fallback to getPointAtLength:', err);
      }

      // Fallback robusto sincronizado al milímetro
      if (!animInstance && pathEl) {
        let startT = performance.now();

        const step = (now: number) => {
          const elapsed = (now - startT) % 4800;
          const progress = elapsed / 4800;
          const dist = progress * totalLen;
          const pt = pathEl.getPointAtLength(dist);
          const ptNext = pathEl.getPointAtLength(Math.min(totalLen, dist + 2));
          const angle = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x) * (180 / Math.PI);

          if (carEl) {
            carEl.setAttribute('transform', `translate(${pt.x}, ${pt.y}) rotate(${angle})`);
          }

          fallbackFrame = requestAnimationFrame(step);
        };

        fallbackFrame = requestAnimationFrame(step);
      }
    }, 60);

    return () => {
      clearTimeout(timer);
      if (animInstance && animInstance.pause) {
        animInstance.pause();
      }
      if (fallbackFrame) {
        cancelAnimationFrame(fallbackFrame);
      }
    };
  }, [extractedPathD, activeTab]);

  // Animación de entrada al cambiar de pestaña o elemento
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

  const inspectedDriver = DRIVERS[inspectedDriverId] || DRIVERS[selectedDriverId] || DRIVERS['alonso'];
  const inspectedTeam = TEAMS[inspectedDriver.teamId];
  const inspectedCircuit = OFFICIAL_CIRCUITS[inspectedCircuitId] || OFFICIAL_CIRCUITS[selectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];

  const selectedDriver = DRIVERS[selectedDriverId] || DRIVERS['alonso'];
  const selectedTeam = TEAMS[selectedDriver.teamId];
  const selectedCircuit = OFFICIAL_CIRCUITS[selectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];

  return (
    <div className={styles.homeContainer}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.f1Logo}>F1</div>
          <div className={styles.headerTitles}>
            <h1>F1 GRAND PRIX SIMULATOR</h1>
            <p>CENTRO DE CONTROL OFICIAL · SELECCIÓN DE PILOTO & CIRCUITO</p>
          </div>
        </div>
      </header>

      {/* ── HISTORIAL SUPERIOR ── */}
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

      {/* ════ LAYOUT 3 COLUMNAS ════ */}
      <div className={styles.mainLayout3Col}>
        {/* ── 1. COLUMNA IZQUIERDA (Lista de Selección con Scroll) ── */}
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
                    onMouseEnter={() => setInspectedDriverId(d.id)}
                  >
                    <div className={styles.driverListLeft}>
                      <span>{d.countryFlag}</span>
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
              Object.values(OFFICIAL_CIRCUITS).map((circuit: CircuitSpec) => {
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
                    onMouseEnter={() => setInspectedCircuitId(circuit.id)}
                  >
                    <div>
                      <div className={styles.circuitListName}>{circuit.countryFlag} {circuit.name}</div>
                      <div className={styles.circuitListSub}>{circuit.officialGpName} · {circuit.country}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'Orbitron', fontSize: '10px', color: '#38bdf8' }}>{circuit.totalLaps} V</span>
                      {isSelected && <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 800 }}>ACTIVO ✓</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 2. COLUMNA CENTRAL (Ficha Técnica / Circuito con createMotionPath) ── */}
        <div ref={centerPanelRef} className={styles.centerColumn}>
          {activeTab === 'drivers' ? (
            /* DETALLE COMPLETO DEL PILOTO Y MONOPLAZA */
            <div>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitleBig}>
                    <span>{inspectedDriver.countryFlag}</span>
                    <span>{inspectedDriver.firstName} {inspectedDriver.lastName}</span>
                  </div>
                  <div className={styles.detailSubtitle}>
                    {inspectedTeam.name} · Piloto Oficial F1 2026
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button 
                    className={styles.selectItemConfirmBtn}
                    onClick={() => onSelectDriver(inspectedDriver.id)}
                  >
                    <CheckCircle2 size={13} />
                    <span>{selectedDriverId === inspectedDriver.id ? 'PILOTO ACTIVO' : 'SELECCIONAR'}</span>
                  </button>
                  <span style={{ fontFamily: 'Orbitron', fontSize: '20px', fontWeight: 900, color: inspectedTeam.color }}>
                    #{inspectedDriver.number}
                  </span>
                </div>
              </div>

              <div className={styles.detailContentGrid}>
                {/* 1. Monoplaza & Motor */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Wrench size={12} />
                    <span>FICHA TÉCNICA DEL MONOPLAZA</span>
                  </div>

                  <div className={styles.specs2ColGrid}>
                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>⚡ Motor V6 Híbrido</span>
                      <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{inspectedTeam.engineManufacturer}</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🐎 Potencia Estimada</span>
                      <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>{inspectedTeam.horsepower} CV</span>
                    </div>

                    <div className={styles.specItem} style={{ gridColumn: 'span 2' }}>
                      <span className={styles.specItemLabel}>🔧 Modelo Motor</span>
                      <span className={styles.specItemVal} style={{ fontSize: '9.5px' }}>{inspectedTeam.engineModel}</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🚀 Velocidad Punta</span>
                      <span className={styles.specItemVal}>{Math.round(338 + inspectedTeam.carPerformance * 16)} km/h</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🌪️ Carga Aerodinámica</span>
                      <span className={styles.specItemVal}>{Math.round(1450 + inspectedTeam.aerodynamics * 350)} kgf</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>⚙️ Transmisión</span>
                      <span className={styles.specItemVal}>8 Vel. Seamless</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🔴 RPM Máximas FIA</span>
                      <span className={styles.specItemVal}>15.000 RPM</span>
                    </div>
                  </div>
                </div>

                {/* 2. Palmarés y Radar */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Sparkles size={12} color="#ffd700" />
                    <span>PALMARÉS & ATRIBUTOS</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <div className={styles.specItem} style={{ textAlign: 'center' }}>
                      <span className={styles.specItemLabel}>🏆 Mundiales</span>
                      <span className={styles.specItemVal} style={{ color: '#ffd700', fontSize: '14px' }}>{inspectedDriver.worldChampionships}</span>
                    </div>
                    <div className={styles.specItem} style={{ textAlign: 'center' }}>
                      <span className={styles.specItemLabel}>🥇 Victorias</span>
                      <span className={styles.specItemVal} style={{ fontSize: '14px' }}>{inspectedDriver.careerWins}</span>
                    </div>
                    <div className={styles.specItem} style={{ textAlign: 'center' }}>
                      <span className={styles.specItemLabel}>🥈 Podios</span>
                      <span className={styles.specItemVal} style={{ fontSize: '14px' }}>{inspectedDriver.careerPodiums}</span>
                    </div>
                  </div>

                  <div className={styles.radarList} style={{ marginTop: '2px' }}>
                    <div className={styles.radarRow}>
                      <span>🧠 Talento Puro</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.talentRating * 100}%`, backgroundColor: '#38bdf8' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '24px' }}>{Math.round(inspectedDriver.talentRating * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>🛞 Gestión Neumáticos</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.tireManagement * 100}%`, backgroundColor: '#22c55e' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '24px' }}>{Math.round(inspectedDriver.tireManagement * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>🎯 Consistencia Vuelta</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.consistency * 100}%`, backgroundColor: '#c084fc' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '24px' }}>{Math.round(inspectedDriver.consistency * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>⚔️ Agresividad Batalla</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.raceCraft * 100}%`, backgroundColor: '#e10600' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '24px' }}>{Math.round(inspectedDriver.raceCraft * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>🍀 Factor Suerte</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${inspectedDriver.luckRating * 100}%`, backgroundColor: '#ffd700' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '24px' }}>{Math.round(inspectedDriver.luckRating * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* DETALLE COMPLETO DEL CIRCUITO CON ESTELA ANIMADA & CREATEMOTIONPATH */
            <div>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitleBig}>
                    <span>{inspectedCircuit.countryFlag}</span>
                    <span>{inspectedCircuit.name}</span>
                  </div>
                  <div className={styles.detailSubtitle}>
                    {inspectedCircuit.officialGpName} · {inspectedCircuit.location}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    className={styles.selectItemConfirmBtn}
                    onClick={() => onSelectCircuit(inspectedCircuit.id)}
                  >
                    <CheckCircle2 size={13} />
                    <span>{selectedCircuitId === inspectedCircuit.id ? 'CIRCUITO ACTIVO' : 'SELECCIONAR'}</span>
                  </button>
                  <a
                    href={inspectedCircuit.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mapsLinkBtn}
                  >
                    <MapPin size={12} />
                    <span>MAPS</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Visor con Matriz de Puntos, Estela Luminosa en Bucle y Coche MotionPath */}
              <div className={styles.svgMotionPathContainer}>
                {extractedPathD ? (
                  <svg 
                    viewBox="0 0 500 500" 
                    preserveAspectRatio="xMidYMid meet" 
                    className={styles.svgMotionCanvas}
                  >
                    {/* Trazado base oscuro */}
                    <path 
                      d={extractedPathD} 
                      fill="none" 
                      stroke="#0f3b4c" 
                      strokeWidth="14" 
                      opacity="0.7" 
                    />
                    {/* Trazo guía cian */}
                    <path 
                      ref={pathRef}
                      id="active-circuit-path" 
                      d={extractedPathD} 
                      fill="none" 
                      stroke="#0891b2" 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                    {/* Estela luminosa cian brillante que recorre el circuito en bucle */}
                    <path 
                      ref={glowTrailRef}
                      d={extractedPathD} 
                      fill="none" 
                      stroke="#00f0ff" 
                      strokeWidth="5.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      filter="drop-shadow(0 0 10px #00f0ff)"
                    />
                    {/* Cursor / Monoplaza F1 estilizado con dirección de avance */}
                    <g ref={runnerCarRef} id="circuit-runner-car">
                      <polygon 
                        points="-10,-6 10,0 -10,6 -6,0" 
                        fill="#00f0ff" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                        filter="drop-shadow(0 0 6px #00f0ff)"
                      />
                    </g>
                  </svg>
                ) : (
                  <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '12px' }}>
                    Cargando trazado oficial del circuito...
                  </div>
                )}
              </div>

              <div className={styles.detailContentGrid}>
                {/* Datos del Evento */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Users size={12} />
                    <span>DATOS DEL EVENTO & AMBIENTE</span>
                  </div>

                  <div className={styles.specs2ColGrid}>
                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>👥 Espectadores</span>
                      <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{inspectedCircuit.spectators.toLocaleString()}</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🛑 Pérdida Pit Lane</span>
                      <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>{inspectedCircuit.pitLaneTimeLossSec}s</span>
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
                  </div>
                </div>

                {/* Especificaciones de Pista */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Flag size={12} color="#e10600" />
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
                      <span className={styles.specItemLabel}>🏎️ Zonas DRS</span>
                      <span className={styles.specItemVal} style={{ color: '#00ff66' }}>{inspectedCircuit.drsZones} Zonas</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. COLUMNA DERECHA (SIDE PANEL PERMANENTE DE SELECCIÓN ACTIVA) ── */}
        <div ref={sidePanelRef} className={styles.rightSidePanel}>
          <div>
            <div className={styles.sidePanelTitle}>
              <Zap size={13} color="#ffd700" />
              <span>SELECCIÓN ACTIVA DE CARRERA</span>
            </div>

            <div className={styles.sideSummaryCards}>
              {/* Tarjeta Piloto Seleccionado */}
              <div className={styles.selectedSummaryCard} style={{ borderLeft: `4px solid ${selectedTeam.color}` }}>
                <span className={styles.summaryCardBadge} style={{ color: selectedTeam.color }}>PILOTO SELECCIONADO</span>
                <div className={styles.summaryCardMain}>
                  <span>{selectedDriver.countryFlag}</span>
                  <span>{selectedDriver.firstName} {selectedDriver.lastName}</span>
                  <span style={{ color: selectedTeam.color, marginLeft: 'auto', fontFamily: 'Orbitron' }}>#{selectedDriver.number}</span>
                </div>
                <div className={styles.summaryCardSub}>{selectedTeam.name}</div>
                <div className={styles.summaryCardExtra}>
                  ⚡ {selectedTeam.engineManufacturer} ({selectedTeam.horsepower} CV)
                </div>
              </div>

              {/* Tarjeta Circuito Seleccionado */}
              <div className={styles.selectedSummaryCard} style={{ borderLeft: '4px solid #e10600' }}>
                <span className={styles.summaryCardBadge} style={{ color: '#e10600' }}>CIRCUITO SELECCIONADO</span>
                <div className={styles.summaryCardMain}>
                  <span>{selectedCircuit.countryFlag}</span>
                  <span>{selectedCircuit.name}</span>
                </div>
                <div className={styles.summaryCardSub}>{selectedCircuit.officialGpName} · {selectedCircuit.country}</div>
                <div className={styles.summaryCardExtra} style={{ color: '#ffd700', background: 'rgba(255,215,0,0.1)' }}>
                  🏁 {selectedCircuit.totalLaps} Vueltas · {selectedCircuit.lapLengthMeters}m
                </div>
                <div style={{ marginTop: '4px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img 
                    src={`/circuits/minimal/${selectedCircuit.svgFile}`} 
                    alt={selectedCircuit.name} 
                    style={{ maxHeight: '100%', maxWidth: '100%', filter: 'drop-shadow(0 0 6px rgba(225,6,0,0.5))' }} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Botón de Entrada a Pista */}
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