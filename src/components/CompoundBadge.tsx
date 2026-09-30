import React from 'react';
import type { TireCompound } from '../types/f1';
import { compoundStyle } from '../utils/compounds';

interface CompoundBadgeProps {
  compound: TireCompound;
  /** Diámetro en píxeles. */
  size?: number;
  /** Muestra el nombre junto a la rueda (además del nombre accesible). */
  showName?: boolean;
  /** Tooltip adicional (salud, vueltas...); el nombre del compuesto siempre se incluye. */
  detail?: string;
  className?: string;
}

/** Q21: rueda con la banda de color del compuesto, su inicial y nombre accesible (no depende solo del color). */
export function CompoundBadge({ compound, size = 18, showName = false, detail, className }: CompoundBadgeProps) {
  const style = compoundStyle(compound);
  const label = `Neumático ${style.label}${detail ? ` · ${detail}` : ''}`;
  return (
    <span
      className={`compound-badge${className ? ` ${className}` : ''}`}
      data-compound={compound}
      role="img"
      aria-label={label}
      title={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', lineHeight: 1 }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="11.5" fill="#111418" />
        <circle cx="12" cy="12" r="8.6" fill="none" stroke={style.color} strokeWidth="2.6" />
        <circle cx="12" cy="12" r="6" fill="#23272e" />
        <text x="12" y="15.2" textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily="Arial, sans-serif" fill={style.color}>{style.letter}</text>
      </svg>
      {showName && <span style={{ fontWeight: 700 }}>{style.name}</span>}
    </span>
  );
}

export default CompoundBadge;
