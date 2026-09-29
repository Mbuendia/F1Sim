import React from 'react';

interface F1CarSilhouetteProps {
  teamColor: string;
  /** Ancho en píxeles; el alto mantiene la proporción lateral del monoplaza. */
  width?: number;
  label?: string;
  className?: string;
}

/** Q21 (Q24 absorbida): silueta lateral genérica de un monoplaza F1 con el color del equipo. */
export function F1CarSilhouette({ teamColor, width = 96, label = 'Monoplaza F1', className }: F1CarSilhouetteProps) {
  const height = Math.round(width * 0.28);
  return (
    <svg
      className={`f1-car-silhouette${className ? ` ${className}` : ''}`}
      data-car-silhouette=""
      width={width}
      height={height}
      viewBox="0 0 200 56"
      role="img"
      aria-label={label}
    >
      {/* Alerón trasero y delantero */}
      <path d="M8 14 H30 V32 H22 V20 H8 Z" fill="#1c1f24" />
      <path d="M170 38 H196 V44 H164 Z" fill="#1c1f24" />
      {/* Carrocería: pontones, cockpit y morro */}
      <path d="M26 34 L40 26 L78 24 L92 14 L110 12 L120 22 L150 28 L184 34 L186 40 L26 42 Z" fill={teamColor} />
      <path d="M94 16 L108 14 L114 22 L92 23 Z" fill="#0b0d10" opacity="0.85" />
      {/* Halo */}
      <path d="M96 13 Q106 6 118 20" fill="none" stroke="#2a2e35" strokeWidth="3" strokeLinecap="round" />
      {/* Ruedas */}
      <circle cx="46" cy="42" r="12" fill="#111418" />
      <circle cx="46" cy="42" r="5" fill="#3a3f47" />
      <circle cx="160" cy="43" r="11" fill="#111418" />
      <circle cx="160" cy="43" r="4.5" fill="#3a3f47" />
    </svg>
  );
}

export default F1CarSilhouette;
