import React from 'react';
import styles from './PodiumModal.module.css';
import { CarState } from '../types/f1';
import { Trophy, RotateCcw, Sparkles, Flag } from 'lucide-react';

interface PodiumModalProps {
  podiumCars: CarState[];
  onRestart: () => void;
}

export const PodiumModal: React.FC<PodiumModalProps> = ({ podiumCars, onRestart }) => {
  if (!podiumCars || podiumCars.length < 3) return null;

  const [p1, p2, p3] = podiumCars;

  return (
    <div className={styles.overlay}>
      <div className={styles.podiumContainer}>
        <div className={styles.header}>
          <div className={styles.f1Logo}>FORMULA 1</div>
          <h1 className={styles.title}>🏆 GRAN PREMIO DE ESPAÑA 🏆</h1>
          <p className={styles.subtitle}>CEREMONIA OFICIAL DEL PODIO · CIRCUIT DE BARCELONA-CATALUNYA</p>
        </div>

        {/* Los 3 escalones del podio: P2 (Izq), P1 (Centro alto), P3 (Der) */}
        <div className={styles.podiumStage}>
          {/* ── 2º LUGAR (PLATA) ── */}
          <div className={`${styles.podiumStep} ${styles.stepP2}`}>
            <div className={styles.driverCard} style={{ borderTopColor: p2.team.color }}>
              <div className={styles.trophyIcon}><Trophy size={28} color="#94a3b8" /></div>
              <div className={styles.carMini} style={{ backgroundColor: p2.team.color }} />
              <div className={styles.driverFlag}>{p2.driver.countryFlag}</div>
              <div className={styles.driverName}>{p2.driver.firstName} {p2.driver.lastName}</div>
              <div className={styles.teamName}>{p2.team.name}</div>
              <div className={styles.gapText}>+{(p2.gapToLeaderSec).toFixed(2)}s</div>
            </div>
            <div className={styles.pedestal} style={{ height: '140px' }}>
              <span className={styles.pedestalNumber}>2</span>
            </div>
          </div>

          {/* ── 1º LUGAR (ORO - CAMPEÓN) ── */}
          <div className={`${styles.podiumStep} ${styles.stepP1}`}>
            <div className={styles.winnerCrown}><Sparkles size={24} color="#ffd700" /> GANADOR DEL GP <Sparkles size={24} color="#ffd700" /></div>
            <div className={`${styles.driverCard} ${styles.winnerCard}`} style={{ borderTopColor: p1.team.color }}>
              <div className={styles.trophyIcon}><Trophy size={40} color="#ffd700" /></div>
              <div className={`${styles.carMini} ${styles.winnerCar}`} style={{ backgroundColor: p1.team.color }} />
              <div className={styles.driverFlag}>{p1.driver.countryFlag}</div>
              <div className={styles.winnerName}>{p1.driver.firstName} {p1.driver.lastName}</div>
              <div className={styles.teamName}>{p1.team.name}</div>
              <div className={styles.winnerTag}>1º CLASIFICADO</div>
            </div>
            <div className={styles.pedestal} style={{ height: '190px', background: 'linear-gradient(180deg, #ffd700 0%, #b8860b 100%)' }}>
              <span className={styles.pedestalNumber} style={{ color: '#000000' }}>1</span>
            </div>
          </div>

          {/* ── 3º LUGAR (BRONCE) ── */}
          <div className={`${styles.podiumStep} ${styles.stepP3}`}>
            <div className={styles.driverCard} style={{ borderTopColor: p3.team.color }}>
              <div className={styles.trophyIcon}><Trophy size={26} color="#cd7f32" /></div>
              <div className={styles.carMini} style={{ backgroundColor: p3.team.color }} />
              <div className={styles.driverFlag}>{p3.driver.countryFlag}</div>
              <div className={styles.driverName}>{p3.driver.firstName} {p3.driver.lastName}</div>
              <div className={styles.teamName}>{p3.team.name}</div>
              <div className={styles.gapText}>+{(p3.gapToLeaderSec).toFixed(2)}s</div>
            </div>
            <div className={styles.pedestal} style={{ height: '110px' }}>
              <span className={styles.pedestalNumber}>3</span>
            </div>
          </div>
        </div>

        {/* Botón de reinicio */}
        <button className={styles.restartBtn} onClick={onRestart}>
          <RotateCcw size={16} />
          <span>REINICIAR GRAN PREMIO</span>
        </button>
      </div>
    </div>
  );
};
