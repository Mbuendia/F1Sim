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
  Flag
} from 'lucide-react';
import { animate } from 'animejs';

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
  const [activeTab, setActiveTab] = useState<'drivers' | 'circuits'>('drivers');
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('barcelona');
  const [inspectedDriverId, setInspectedDriverId] = useState<string>(selectedDriverId);
  const [inspectedCircuitId, setInspectedCircuitId] = useState<string>('barcelona');

  const rightPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInspectedDriverId(selectedDriverId);
  }, [selectedDriverId]);

  useEffect(() => {
    if (rightPanelRef.current) {
      animate(rightPanelRef.current, {
        opacity: [0.85, 1],
        translateX: [8, 0],
        ease: 'outQuad',
        duration: 250
      });
    }
  }, [inspectedDriverId, inspectedCircuitId, activeTab]);

  const activeDriver = DRIVERS[inspectedDriverId] || DRIVERS[selectedDriverId] || DRIVERS['alonso'];
  const activeTeam = TEAMS[activeDriver.teamId];
  const activeCircuit = OFFICIAL_CIRCUITS[inspectedCircuitId] || OFFICIAL_CIRCUITS['barcelona'];
  const selectedDriver = DRIVERS[selectedDriverId];
  const selectedCircuit = OFFICIAL_CIRCUITS[selectedCircuitId];

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

      {/* ── HISTORIAL SUPERIOR DE CARRERAS DISPUTADAS ── */}
      {raceHistory.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.historyTitle}>
            <History size={12} />
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
                <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '1px' }}>
                  Tu piloto: <strong>{race.userDriverName} (P{race.userDriverPos})</strong> · Tiempo: {race.totalRaceTime}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ SPLIT-SCREEN LAYOUT (Izquierda Scrollable / Derecha Amplia) ════ */}
      <div className={styles.splitLayout}>
        {/* ── COLUMNA IZQUIERDA (Scroll de Pilotos o Circuitos) ── */}
        <div className={styles.leftColumn}>
          <div className={styles.tabButtonsRow}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'drivers' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('drivers')}
            >
              <Sparkles size={13} />
              <span>PILOTOS ({STARTING_GRID_ORDER.length})</span>
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'circuits' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('circuits')}
            >
              <Flag size={13} />
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
                    className={`${styles.driverListItem} ${isSelected || isInspected ? styles.driverListItemActive : ''}`}
                    style={{ borderLeftColor: t.color }}
                    onClick={() => {
                      onSelectDriver(d.id);
                      setInspectedDriverId(d.id);
                    }}
                    onMouseEnter={() => setInspectedDriverId(d.id)}
                  >
                    <div className={styles.driverListLeft}>
                      <span className={styles.driverListFlag}>{d.countryFlag}</span>
                      <div>
                        <div className={styles.driverListName}>{d.firstName} {d.lastName}</div>
                        <div className={styles.driverListTeam}>{t.name}</div>
                        <div className={styles.driverListEngine}>⚡ {t.engineManufacturer} ({t.horsepower} CV)</div>
                      </div>
                    </div>

                    <div className={styles.driverListRight}>
                      <span className={styles.driverListNum} style={{ color: t.color }}>#{d.number}</span>
                      <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>🏆 {d.worldChampionships} Tit. · 🥇 {d.careerWins}W</span>
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
                    className={`${styles.circuitListItem} ${isSelected || isInspected ? styles.circuitListItemActive : ''}`}
                    onClick={() => {
                      setSelectedCircuitId(circuit.id);
                      setInspectedCircuitId(circuit.id);
                    }}
                    onMouseEnter={() => setInspectedCircuitId(circuit.id)}
                  >
                    <div>
                      <div className={styles.circuitListName}>{circuit.countryFlag} {circuit.name}</div>
                      <div className={styles.circuitListSub}>{circuit.officialGpName} · {circuit.location}</div>
                    </div>
                    <span style={{ fontFamily: 'Orbitron', fontSize: '10.5px', color: '#38bdf8' }}>{circuit.totalLaps} Vtas</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── COLUMNA DERECHA (Panel Fijo Amplio con SVG Oficial Íntegro) ── */}
        <div ref={rightPanelRef} className={styles.rightColumn}>
          {activeTab === 'drivers' ? (
            /* DETALLE COMPLETO DEL PILOTO Y MONOPLAZA */
            <div>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitleBig}>
                    <span>{activeDriver.countryFlag}</span>
                    <span>{activeDriver.firstName} {activeDriver.lastName}</span>
                  </div>
                  <div className={styles.detailSubtitle}>
                    {activeTeam.name} · Piloto Oficial FIA Formula 1
                  </div>
                </div>
                <div className={styles.detailNumberBadge} style={{ color: activeTeam.color, border: `2px solid ${activeTeam.color}` }}>
                  #{activeDriver.number}
                </div>
              </div>

              <div className={styles.detailContentGrid}>
                {/* 1. Ficha Técnica del Monoplaza */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Wrench size={13} />
                    <span>FICHA TÉCNICA DEL MONOPLAZA</span>
                  </div>

                  <div className={styles.specs2ColGrid}>
                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>⚡ Motor V6 Híbrido</span>
                      <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{activeTeam.engineManufacturer}</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🐎 Potencia Real Estimada</span>
                      <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>{activeTeam.horsepower} CV</span>
                    </div>

                    <div className={styles.specItem} style={{ gridColumn: 'span 2' }}>
                      <span className={styles.specItemLabel}>🔧 Unidad de Potencia</span>
                      <span className={styles.specItemVal} style={{ fontSize: '10px' }}>{activeTeam.engineModel}</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🚀 Velocidad Punta Estimada</span>
                      <span className={styles.specItemVal}>{Math.round(338 + activeTeam.carPerformance * 16)} km/h (DRS)</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🌪️ Carga Aerodinámica</span>
                      <span className={styles.specItemVal}>{Math.round(1450 + activeTeam.aerodynamics * 350)} kgf</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>⚙️ Transmisión</span>
                      <span className={styles.specItemVal}>8 Marchas Seamless + R</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🔴 RPM Máximas FIA</span>
                      <span className={styles.specItemVal}>15.000 RPM (13.5k Race)</span>
                    </div>
                  </div>
                </div>

                {/* 2. Palmarés y Radar de Atributos */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Sparkles size={13} color="#ffd700" />
                    <span>PALMARÉS & ATRIBUTOS DE PILOTAJE</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                    <div className={styles.specItem} style={{ textAlign: 'center' }}>
                      <span className={styles.specItemLabel}>🏆 Mundiales</span>
                      <span className={styles.specItemVal} style={{ color: '#ffd700', fontSize: '15px' }}>{activeDriver.worldChampionships}</span>
                    </div>
                    <div className={styles.specItem} style={{ textAlign: 'center' }}>
                      <span className={styles.specItemLabel}>🥇 Victorias</span>
                      <span className={styles.specItemVal} style={{ fontSize: '15px' }}>{activeDriver.careerWins}</span>
                    </div>
                    <div className={styles.specItem} style={{ textAlign: 'center' }}>
                      <span className={styles.specItemLabel}>🥈 Podios</span>
                      <span className={styles.specItemVal} style={{ fontSize: '15px' }}>{activeDriver.careerPodiums}</span>
                    </div>
                  </div>

                  <div className={styles.radarList} style={{ marginTop: '3px' }}>
                    <div className={styles.radarRow}>
                      <span>🧠 Talento Puro & Pace</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${activeDriver.talentRating * 100}%`, backgroundColor: '#38bdf8' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '26px' }}>{Math.round(activeDriver.talentRating * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>🛞 Gestión Neumáticos (+Speed)</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${activeDriver.tireManagement * 100}%`, backgroundColor: '#22c55e' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '26px' }}>{Math.round(activeDriver.tireManagement * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>🎯 Consistencia de Vuelta</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${activeDriver.consistency * 100}%`, backgroundColor: '#c084fc' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '26px' }}>{Math.round(activeDriver.consistency * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>⚔️ Agresividad en Batalla</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${activeDriver.raceCraft * 100}%`, backgroundColor: '#e10600' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '26px' }}>{Math.round(activeDriver.raceCraft * 100)}%</span>
                    </div>

                    <div className={styles.radarRow}>
                      <span>🍀 Factor Suerte & Fiabilidad</span>
                      <div className={styles.radarBarBg}>
                        <div className={styles.radarBarFill} style={{ width: `${activeDriver.luckRating * 100}%`, backgroundColor: '#ffd700' }} />
                      </div>
                      <span style={{ fontFamily: 'Orbitron', minWidth: '26px' }}>{Math.round(activeDriver.luckRating * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* DETALLE COMPLETO DEL CIRCUITO CON SVG OFICIAL */
            <div>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitleBig}>
                    <span>{activeCircuit.countryFlag}</span>
                    <span>{activeCircuit.name}</span>
                  </div>
                  <div className={styles.detailSubtitle}>
                    {activeCircuit.officialGpName} · {activeCircuit.location}, {activeCircuit.country}
                  </div>
                </div>
                <a
                  href={activeCircuit.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mapsLinkBtn}
                  title="Abrir ubicación en Google Maps"
                >
                  <MapPin size={13} />
                  <span>VER EN GOOGLE MAPS</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              {/* Visor Vectorial Oficial SVG del Circuito */}
              <div className={styles.svgCircuitFrame}>
                <img 
                  key={activeCircuit.id}
                  src={`/circuits/${activeCircuit.svgFile}`} 
                  alt={activeCircuit.name} 
                  className={styles.svgCircuitImage} 
                />
              </div>

              <div className={styles.detailContentGrid}>
                {/* Métricas del Gran Premio */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Users size={13} />
                    <span>DATOS DEL EVENTO & AMBIENTE</span>
                  </div>

                  <div className={styles.specs2ColGrid}>
                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>👥 Espectadores en Tribuna</span>
                      <span className={styles.specItemVal} style={{ color: '#ffd700' }}>{activeCircuit.spectators.toLocaleString()}</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🛑 Tiempo Perdido Pit Lane</span>
                      <span className={styles.specItemVal} style={{ color: '#38bdf8' }}>{activeCircuit.pitLaneTimeLossSec}s</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🌧️ Probabilidad Lluvia</span>
                      <span className={styles.specItemVal} style={{ color: activeCircuit.rainProbabilityPercent > 30 ? '#38bdf8' : '#22c55e' }}>
                        {activeCircuit.rainProbabilityPercent}%
                      </span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>💨 Viento en Pista</span>
                      <span className={styles.specItemVal}>{activeCircuit.windSpeedKmh} km/h ({activeCircuit.windDirection})</span>
                    </div>
                  </div>
                </div>

                {/* Especificaciones del Trazado */}
                <div className={styles.detailCardBox}>
                  <div className={styles.detailCardTitle}>
                    <Flag size={13} color="#e10600" />
                    <span>FICHA TÉCNICA DE LA PISTA</span>
                  </div>

                  <div className={styles.specs2ColGrid}>
                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>📏 Longitud Oficial</span>
                      <span className={styles.specItemVal}>{activeCircuit.lapLengthMeters} metros</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🔄 Vueltas de Carrera</span>
                      <span className={styles.specItemVal}>{activeCircuit.totalLaps} vueltas</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>⚡ Curvas Totales</span>
                      <span className={styles.specItemVal}>{activeCircuit.turns} curvas</span>
                    </div>

                    <div className={styles.specItem}>
                      <span className={styles.specItemLabel}>🏎️ Zonas de DRS</span>
                      <span className={styles.specItemVal} style={{ color: '#00ff66' }}>{activeCircuit.drsZones} Zonas DRS</span>
                    </div>

                    <div className={styles.specItem} style={{ gridColumn: 'span 2' }}>
                      <span className={styles.specItemLabel}>📍 Coordenadas GPS</span>
                      <span className={styles.specItemVal} style={{ fontSize: '10.5px' }}>Lat: {activeCircuit.latitude} · Lon: {activeCircuit.longitude}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── FOOTER BAR DE INICIO ── */}
          <div className={styles.footerBar}>
            <div className={styles.selectionSummaryText}>
              Configuración: <strong>{selectedDriver.countryFlag} {selectedDriver.firstName} {selectedDriver.lastName} (#{selectedDriver.number})</strong> en <strong>{selectedCircuit.countryFlag} {selectedCircuit.name}</strong>
            </div>

            <button className={styles.launchButton} onClick={onStartRace}>
              <Play size={16} fill="#ffffff" />
              <span>ENTRAR A PISTA & EMPEZAR GRAN PREMIO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
