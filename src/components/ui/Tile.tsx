import type { ReactNode } from 'react';
import styles from './ui.module.css';
import type { MeterTone } from './Meter';

/** [V1] Ficha: un aviso corto con icono, en una línea. */
export function Chip({ icon, children, tone = 'neutral', title, ...rest }: {
  icon?: ReactNode; children: ReactNode; tone?: MeterTone; title?: string;
} & Record<`data-${string}`, string | undefined>) {
  return <span className={styles.chip} data-tone={tone} title={title} {...rest}>{icon}{children}</span>;
}

/** [V1] Tarjeta de dato: cifra grande con icono y un rótulo corto, en lugar de una frase. */
export function Tile({ icon, value, label, tone = 'neutral', title }: {
  icon: ReactNode; value: ReactNode; label: string; tone?: MeterTone; title?: string;
}) {
  return (
    <div className={styles.tile} data-tone={tone} title={title}>
      <span className={styles.tileIcon} aria-hidden="true">{icon}</span>
      <span className={styles.tileBody}>
        <span className={styles.tileValue}>{value}</span>
        <span className={styles.tileLabel}>{label}</span>
      </span>
    </div>
  );
}
