import React from 'react';
import styles from './RaceNotices.module.css';

export type RaceNoticeTone = 'info' | 'warning' | 'danger' | 'ok';

export interface RaceNotice {
  id: number;
  tone: RaceNoticeTone;
  tag: string;
  text: string;
}

// R32: zona estable de avisos breves sobre el circuito. No roba el foco ni bloquea clics en el Canvas;
// los avisos caducan solos (App los retira tras unos segundos).
export const RaceNotices: React.FC<{ notices: RaceNotice[] }> = ({ notices }) => (
  <div className={styles.zone} role="status" aria-live="polite" aria-label="Avisos de carrera">
    {notices.map(notice => (
      <div key={notice.id} className={`${styles.notice} ${styles[notice.tone]}`} data-notice-tone={notice.tone}>
        <span className={styles.tag}>{notice.tag}</span>
        <span className={styles.text}>{notice.text}</span>
      </div>
    ))}
  </div>
);
