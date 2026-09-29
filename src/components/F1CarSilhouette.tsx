import React from 'react';

interface F1CarSilhouetteProps {
  teamColor: string;
  /** Ancho en píxeles; el alto mantiene la proporción del perfil (430×90). */
  width?: number;
  label?: string;
  className?: string;
}

/**
 * Q21 (Q24 absorbida): icono de perfil lateral de un F1 actual, estilo línea (referencia aportada
 * por el usuario): morro a la derecha, alerón trasero escalonado, toma de aire sobre el piloto, halo,
 * pontón, fondo plano macizo entre ejes, alerón delantero bajo y ruedas de doble anillo.
 * El trazo y el fondo usan el color del equipo.
 */
export function F1CarSilhouette({ teamColor, width = 96, label = 'Monoplaza F1', className }: F1CarSilhouetteProps) {
  const height = Math.round(width * 90 / 430);
  // Colores de equipo muy oscuros: contorno claro sutil para que la silueta se lea sobre fondos oscuros.
  const rgb = /^#([0-9a-f]{6})$/i.exec(teamColor)?.[1];
  const luminance = rgb ? [0, 2, 4].map(i => parseInt(rgb.slice(i, i + 2), 16) / 255).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0) : 1;
  const outline = luminance < 0.2 ? { filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.75))' } : undefined;
  const line = { fill: 'none', stroke: teamColor, strokeWidth: 6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const wheel = (cx: number) => (
    <g>
      <circle cx={cx} cy="62" r="24" {...line} />
      <circle cx={cx} cy="62" r="13" {...line} strokeWidth={5} />
      <circle cx={cx} cy="62" r="4" fill={teamColor} />
    </g>
  );
  return (
    <svg
      className={`f1-car-silhouette${className ? ` ${className}` : ''}`}
      data-car-silhouette=""
      width={width}
      height={height}
      viewBox="0 0 430 90"
      role="img"
      aria-label={label}
      style={outline}
    >
      {/* Alerón trasero escalonado (placa lateral y soporte) */}
      <path d="M6 30 V8 H52 V20 H66 V34 M6 30 V50 L20 58" {...line} />
      {/* Cubierta del motor hasta la toma de aire, halo y morro descendente hasta el alerón delantero */}
      <path d="M66 34 L110 18 C120 14 128 12 140 12 H176 V24 H194 C206 16 232 13 246 18 L258 30 C296 32 330 38 358 46 L402 58" {...line} />
      {/* Línea inferior del pontón y del morro */}
      <path d="M76 46 C120 42 170 40 214 36 C228 40 226 50 218 56 M230 44 C262 46 292 48 320 52" {...line} strokeWidth={4.5} />
      {/* Fondo plano macizo entre ejes: arranca en la rueda trasera, recoge la curva del pontón y termina en el escalón delantero */}
      <path d="M70 70 C120 66 172 62 216 58 L236 56 L240 50 H298 V80 H70 Z" fill={teamColor} />
      {/* Parte inferior del morro hasta el alerón delantero */}
      <path d="M356 52 L368 58" {...line} />
      {/* Alerón delantero */}
      <path d="M366 58 H424 V76 H366 Z M366 67 H410" {...line} />
      {wheel(48)}
      {wheel(334)}
    </svg>
  );
}

export default F1CarSilhouette;
