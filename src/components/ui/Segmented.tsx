import type { ReactNode } from 'react';
import styles from './ui.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Contenido visible si no es el propio rótulo (un icono, una rueda de compuesto); el rótulo queda como nombre accesible. */
  content?: ReactNode;
  title?: string;
}

/**
 * [V1] Control segmentado: una elección entre pocas opciones, todas a la vista. Es un grupo de botones de radio (se
 * maneja con el teclado como tal) y sustituye a los selectores desplegables.
 */
export function Segmented<T extends string>({ label, name, value, options, disabled, compact, wrap, onChange }: {
  label: string;
  name: string;
  value: T;
  options: SegmentOption<T>[];
  disabled?: boolean;
  compact?: boolean;
  /** Con muchas opciones o poco ancho, las opciones saltan de línea en vez de apretarse. */
  wrap?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={`${styles.segmented} ${compact ? styles.compact : ''} ${wrap ? styles.wrap : ''}`} aria-label={label} disabled={disabled}>
      {options.map(option => (
        <label key={option.value} className={styles.segment} data-active={option.value === value ? 'true' : undefined} title={option.title ?? option.label}>
          <input type="radio" name={name} value={option.value} checked={option.value === value} aria-label={option.label}
            onChange={() => onChange(option.value)} />
          {option.content ?? option.label}
        </label>
      ))}
    </fieldset>
  );
}
