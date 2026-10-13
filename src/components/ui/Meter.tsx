import type { ReactNode } from 'react';
import styles from './ui.module.css';

export type MeterTone = 'ok' | 'warn' | 'bad' | 'neutral';

/** Tono de un medidor según su valor: por debajo de `bad`, malo; por debajo de `warn`, aviso. */
export const meterTone = (value: number, warn: number, bad: number): MeterTone => (value < bad ? 'bad' : value < warn ? 'warn' : 'ok');

/**
 * [V1] Medidor: un dato que se lee de un vistazo, con icono, barra y cifra corta. El tono no depende solo del color:
 * la cifra siempre va escrita.
 */
export function Meter({ label, icon, percent, text, tone = 'neutral' }: {
  label: string;
  icon: ReactNode;
  /** Relleno de la barra, de 0 a 100. */
  percent: number;
  /** Cifra corta que se enseña junto a la barra. */
  text: string;
  tone?: MeterTone;
}) {
  const fill = Math.max(0, Math.min(100, percent));
  return (
    <span className={styles.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill)}
      aria-valuetext={text} title={`${label}: ${text}`} data-tone={tone}>
      <span className={styles.meterIcon} aria-hidden="true">{icon}</span>
      <span className={styles.meterBar}><span className={styles.meterFill} style={{ width: `${fill}%` }} /></span>
      <span className={styles.meterText}>{text}</span>
    </span>
  );
}
