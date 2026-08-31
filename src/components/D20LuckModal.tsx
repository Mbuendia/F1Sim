import React, { useState, useEffect, useRef } from 'react';
import styles from './D20LuckModal.module.css';
import { D20LuckEvent } from '../types/f1';
import { Sparkles, Dices, ShieldAlert, CheckCircle2, Zap } from 'lucide-react';
import { FlagIcon } from './FlagIcon';
import { animate } from 'animejs';

interface D20LuckModalProps {
  event: D20LuckEvent;
  onApplyReward: (eventId: string) => void;
  onDismiss: () => void;
}

export const D20LuckModal: React.FC<D20LuckModalProps> = ({
  event,
  onApplyReward,
  onDismiss,
}) => {
  const [displayNumber, setDisplayNumber] = useState<number>(1);
  const [isRolling, setIsRolling] = useState<boolean>(true);
  const [hasLanded, setHasLanded] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(6);
  const modalRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<HTMLDivElement>(null);

  // Entrance animation
  useEffect(() => {
    if (modalRef.current) {
      animate(modalRef.current, {
        scale: [0.8, 1],
        opacity: [0, 1],
        ease: 'outElastic(1, .75)',
        duration: 700,
      });
    }

    // Dice rolling number animation
    let rollInterval: number;
    let iterations = 0;
    const maxIterations = 24;

    rollInterval = window.setInterval(() => {
      iterations++;
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);

      if (diceRef.current) {
        diceRef.current.style.transform = `rotate(${Math.sin(iterations) * 25}deg) scale(${1 + Math.sin(iterations * 2) * 0.15})`;
      }

      if (iterations >= maxIterations) {
        clearInterval(rollInterval);
        setDisplayNumber(event.rollValue);
        setIsRolling(false);
        setHasLanded(true);

        if (diceRef.current) {
          animate(diceRef.current, {
            scale: [1.4, 1],
            rotate: [360, 0],
            ease: 'outBack',
            duration: 600,
          });
        }
      }
    }, 60);

    return () => clearInterval(rollInterval);
  }, [event.rollValue]);

  // Auto-dismiss countdown after dice lands
  useEffect(() => {
    if (!hasLanded) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onApplyReward(event.id);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasLanded, event.id, onApplyReward, onDismiss]);

  const handleApply = () => {
    onApplyReward(event.id);
    onDismiss();
  };

  const isCrit = event.rollValue === 20;

  return (
    <div className={styles.overlay}>
      <div ref={modalRef} className={`${styles.modalContainer} ${isCrit ? styles.modalCrit : ''}`}>
        {/* Header Incident Banner */}
        <div className={styles.incidentBanner}>
          <ShieldAlert size={18} className={styles.alertIcon} />
          <span>
            {event.triggerType === 'sc'
              ? '🚨 SAFETY CAR DESPLEGADO · TIRADA TÁCTICA'
              : event.triggerType === 'red'
              ? '🔴 BANDERA ROJA EN PISTA · TIRADA TÁCTICA'
              : '🟡 VIRTUAL SAFETY CAR · TIRADA TÁCTICA'}
          </span>
        </div>

        <h2 className={styles.modalTitle}>
          <Dices size={24} color="#ffd700" />
          <span>GOLPE DE SUERTE · DADO D20</span>
        </h2>
        <p className={styles.modalSubtitle}>
          La neutralización de carrera abre una ventana estratégica. El azar decide qué monoplaza aprovecha la mejor oportunidad táctica.
        </p>

        {/* ── 3D D20 DICE HERO ── */}
        <div className={styles.diceContainer}>
          <div ref={diceRef} className={`${styles.d20Hexagon} ${isCrit ? styles.d20Crit : ''}`}>
            <div className={styles.d20Inner}>
              <span className={styles.d20Number}>{displayNumber}</span>
              <span className={styles.d20Label}>{isRolling ? 'RODANDO...' : isCrit ? 'NAT 20!' : 'DADO D20'}</span>
            </div>
          </div>
        </div>

        {/* ── DRIVER & REWARD RESULT (REVEALED AFTER LAND) ── */}
        {hasLanded && (
          <div className={styles.resultCard}>
            <div className={styles.rewardHeader}>
              <Sparkles size={16} color="#ffd700" />
              <span>{event.rewardTitle}</span>
            </div>

            {/* Lucky Driver Pill */}
            <div 
              className={styles.driverPill} 
              style={{ borderColor: event.luckyTeamColor, background: `${event.luckyTeamColor}18` }}
            >
              <FlagIcon emoji={event.luckyDriverFlag} size={20} />
              <span className={styles.driverName}>{event.luckyDriverName}</span>
              <span className={styles.teamTag} style={{ color: event.luckyTeamColor }}>
                {event.luckyTeamName}
              </span>
              {event.isPlayerCar && (
                <span className={styles.playerBadge}>
                  <Zap size={11} /> TU PILOTO
                </span>
              )}
            </div>

            <p className={styles.rewardDesc}>{event.rewardDescription}</p>

            <div className={styles.optimalTireRow}>
              <span className={styles.tiresLabel}>Compuesto Óptimo Equipado:</span>
              <span className={`${styles.compoundBadge} ${styles[event.optimalCompound]}`}>
                {event.optimalCompound.toUpperCase()} (100% SALUD)
              </span>
            </div>
          </div>
        )}

        {/* Actions & Auto-Countdown */}
        <div className={styles.actionsRow}>
          <button 
            type="button" 
            className={styles.applyBtn} 
            onClick={handleApply}
            disabled={isRolling}
          >
            <CheckCircle2 size={16} />
            <span>APLICAR Y CONTINUAR ({countdown}s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
