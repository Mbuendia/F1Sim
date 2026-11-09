import React from 'react';
import type { TireCompound } from '../types/f1';
import { compoundStyle } from '../utils/compounds';

/** [CA4] Imagen de cada compuesto en public/img/compuestos/. */
const COMPOUND_ICON: Record<TireCompound, string> = {
  soft: 'rueda_blanda', medium: 'rueda_media', hard: 'rueda_dura', intermediate: 'rueda_intermedia', wet: 'rueda_lluvia',
};

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
        {/* [CA4] La rueda renderizada en Blender (CA3) con la banda de su compuesto; encima, la inicial en su color. */}
        <image href={`${import.meta.env.BASE_URL ?? '/'}img/compuestos/${COMPOUND_ICON[compound] ?? COMPOUND_ICON.hard}.webp`} x="0" y="0" width="24" height="24" />
        <circle cx="12" cy="12" r="4.6" fill="#111418" />
        <text x="12" y="14.6" textAnchor="middle" fontSize="7" fontWeight="800" fontFamily="Arial, sans-serif" fill={style.color}>{style.letter}</text>
      </svg>
      {showName && <span style={{ fontWeight: 700 }}>{style.name}</span>}
    </span>
  );
}

export default CompoundBadge;
