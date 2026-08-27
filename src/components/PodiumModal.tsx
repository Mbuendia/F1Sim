import React, { useEffect, useRef } from 'react';
import styles from './PodiumModal.module.css';
import { CarState } from '../types/f1';
import { Trophy, RotateCcw, Sparkles } from 'lucide-react';
import { animate, stagger } from 'animejs';

interface PodiumModalProps {
  podiumCars: CarState[];
  onRestart: () => void;
}

export const PodiumModal: React.FC<PodiumModalProps> = ({ podiumCars, onRestart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!podiumCars || podiumCars.length < 3) return;

    if (containerRef.current) {
      animate(containerRef.current, {
        scale: [0.85, 1],
        opacity: [0, 1],
        ease: 'outElastic(1, .7)',
        duration: 900
      });
    }

    animate(`.${styles.podiumStep}`, {
      translateY: [160, 0],
      opacity: [0, 1],
      delay: stagger(180, { start: 250 }),
      ease: 'outCubic',
      duration: 800
    });

    animate(`.${styles.trophyIcon}`, {
      translateY: [-6, 6],
      rotate: [-3, 3],
      alternate: true,
      loop: true,
      ease: 'inOutQuad',
      duration: 1800,
      delay: stagger(200)
    });

    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ffd700', '#e10600', '#38bdf8', '#22c55e', '#ffffff', '#c084fc', '#f97316'];
    const particles = Array.from({ length: 90 }).map(() => ({
      x: Math.random() * canvas.width,
      y: -30 - Math.random() * 200,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      speedY: 2 + Math.random() * 4,
      speedX: -1.5 + Math.random() * 3,
      rotSpeed: -5 + Math.random() * 10
    }));

    let animationFrameId: number;

    const renderConfetti = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotSpeed;

        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(renderConfetti);
    };

    renderConfetti();

    return () => cancelAnimationFrame(animationFrameId);
  }, [podiumCars]);

  if (!podiumCars || podiumCars.length < 3) return null;

  const [p1, p2, p3] = podiumCars;

  return (
    <div className={styles.overlay}>
      <canvas ref={confettiCanvasRef} className={styles.confettiCanvas} />

      <div ref={containerRef} className={styles.podiumContainer}>
        <div className={styles.header}>
          <div className={styles.f1Logo}>FORMULA 1</div>
          <h1 className={styles.title}>🏆 GRAN PREMIO DE ESPAÑA 🏆</h1>
          <p className={styles.subtitle}>CEREMONIA OFICIAL DEL PODIO · CIRCUIT DE BARCELONA-CATALUNYA</p>
        </div>

        <div className={styles.podiumStage}>
          {/* ── 2º LUGAR (PLATA) ── */}
          <div className={`${styles.podiumStep} ${styles.stepP2}`}>
            <div className={styles.driverCard} style={{ borderTopColor: p2.team.color }}>
              <div className={styles.trophyIcon}><Trophy size={32} color="#cbd5e1" /></div>
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

          {/* ── 1º LUGAR (ORO - GANADOR) ── */}
          <div className={`${styles.podiumStep} ${styles.stepP1}`}>
            <div className={styles.winnerCrown}><Sparkles size={22} color="#ffd700" /> GANADOR DEL GP <Sparkles size={22} color="#ffd700" /></div>
            <div className={`${styles.driverCard} ${styles.winnerCard}`} style={{ borderTopColor: p1.team.color }}>
              <div className={styles.trophyIcon}><Trophy size={46} color="#ffd700" /></div>
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
              <div className={styles.trophyIcon}><Trophy size={30} color="#cd7f32" /></div>
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

        <button className={styles.restartBtn} onClick={onRestart}>
          <RotateCcw size={18} />
          <span>REINICIAR GRAN PREMIO</span>
        </button>
      </div>
    </div>
  );
};
