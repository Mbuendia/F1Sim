import React from 'react';
import type { TireCompound } from '../types/f1';
import { compoundStyle } from '../utils/compounds';
import { tireHealthColor, tireHealthLevel } from '../utils/tireHealth';

interface CarChassisSvgProps {
  tireHealthFL: number;
  tireHealthFR: number;
  tireHealthRL: number;
  tireHealthRR: number;
  compound: TireCompound;
  drsActive: boolean;
  teamColor: string;
  accentColor: string;
  /** Ancho en píxeles; el alto mantiene la proporción (120×248). */
  width?: number;
}

type WheelId = 'FL' | 'FR' | 'RL' | 'RR';
const WHEELS: Record<WheelId, { x: number; y: number; w: number; h: number; name: string }> = {
  FL: { x: 12, y: 36, w: 20, h: 34, name: 'delantera izquierda' },
  FR: { x: 88, y: 36, w: 20, h: 34, name: 'delantera derecha' },
  RL: { x: 8, y: 168, w: 24, h: 40, name: 'trasera izquierda' },
  RR: { x: 88, y: 168, w: 24, h: 40, name: 'trasera derecha' },
};
const CARBON = '#15181d';
const EDGE = '#6b7280';

/**
 * Q22: vista cenital del monoplaza (morro arriba) con el desgaste real de cada rueda, la banda del
 * compuesto montado y el estado del flap DRS. Las ruedas por debajo del 25 % pulsan (animación SVG).
 */
export function CarChassisSvg({
  tireHealthFL, tireHealthFR, tireHealthRL, tireHealthRR, compound, drsActive, teamColor, accentColor, width = 90,
}: CarChassisSvgProps) {
  const health: Record<WheelId, number> = { FL: tireHealthFL, FR: tireHealthFR, RL: tireHealthRL, RR: tireHealthRR };
  const band = compoundStyle(compound).color;
  const summary = (Object.keys(WHEELS) as WheelId[]).map(id => `${id} ${Math.round(health[id])}%`).join(', ');

  const wheel = (id: WheelId) => {
    const { x, y, w, h, name } = WHEELS[id];
    const value = Math.round(health[id]);
    const critical = tireHealthLevel(value) === 'critical';
    const color = tireHealthColor(value);
    return (
      <g key={id} data-wheel={id} data-health={value} {...(critical ? { 'data-warning': 'true' } : {})}>
        <title>{`Rueda ${name}: ${value}%`}</title>
        <rect x={x} y={y} width={w} height={h} rx="5" fill={CARBON} stroke={color} strokeWidth="3" />
        <rect x={x + 4} y={y + 5} width={w - 8} height={h - 10} rx="3" fill={color} opacity="0.85" />
        <line x1={x + w / 2} y1={y + 3} x2={x + w / 2} y2={y + h - 3} stroke={band} strokeWidth="2" opacity="0.9" />
        {critical && (
          <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx="7" fill="none" stroke={color} strokeWidth="2">
            <animate attributeName="opacity" values="1;0.15;1" dur="0.9s" repeatCount="indefinite" />
          </rect>
        )}
      </g>
    );
  };

  return (
    <svg
      className="car-chassis-svg"
      width={width}
      height={Math.round(width * 248 / 120)}
      viewBox="0 0 120 248"
      role="img"
      aria-label={`Chasis: ruedas ${summary}; DRS ${drsActive ? 'abierto' : 'cerrado'}`}
    >
      {/* Suspensiones */}
      <path d="M32 46 L54 52 M32 58 L54 66 M88 46 L66 52 M88 58 L66 66 M32 184 L50 182 M32 196 L50 194 M88 184 L70 182 M88 196 L70 194"
        stroke="#4b5563" strokeWidth="2.5" strokeLinecap="round" />
      {/* Fondo plano (asoma bajo los pontones) */}
      <path d="M24 104 H96 L94 170 L80 202 H40 L26 170 Z" fill={CARBON} stroke={EDGE} strokeWidth="1" />
      {/* Alerón delantero */}
      <path d="M8 10 H112 V20 H8 Z" fill={CARBON} stroke={EDGE} strokeWidth="1.2" />
      <path d="M12 20 H108 L102 27 H18 Z" fill={accentColor} opacity="0.85" />
      {/* Morro, monocasco, pontones en botella de Coca-Cola y caja de cambios */}
      <path d="M56 24 H64 L67 70 L70 96 L86 100 C92 102 93 108 92 118 L90 138 C88 156 80 168 72 180 L67 206 H53 L48 180 C40 168 32 156 30 138 L28 118 C27 108 28 102 34 100 L50 96 L53 70 Z"
        fill={teamColor} stroke={CARBON} strokeWidth="1.5" />
      {/* Entradas de los pontones y lomo de la cubierta del motor */}
      <path d="M31 102 H42 V113 H30 Z M78 102 H89 L90 113 H78 Z" fill={CARBON} />
      <path d="M60 116 V202" stroke={accentColor} strokeWidth="2" opacity="0.6" />
      {/* Cockpit, halo y casco */}
      <ellipse cx="60" cy="90" rx="8" ry="13" fill={CARBON} />
      <circle cx="60" cy="92" r="5.5" fill={accentColor} />
      <path d="M60 74 V80 M52 88 Q60 74 68 88" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" />
      {/* Alerón trasero: plano principal y flap DRS (abierto: separado con hueco visible) */}
      <g className={drsActive ? 'drs-open' : 'drs-closed'} data-drs={drsActive ? 'open' : 'closed'}>
        <path d="M22 226 H98 V234 H22 Z" fill={CARBON} stroke={EDGE} strokeWidth="1.2" />
        <path d={drsActive ? 'M22 211 H98 V217 H22 Z' : 'M22 219 H98 V225 H22 Z'} fill={drsActive ? '#22c55e' : accentColor} />
        <path d="M22 209 V236 M98 209 V236" stroke={EDGE} strokeWidth="2.5" strokeLinecap="round" />
        {drsActive && <text x="60" y="246" textAnchor="middle" fontSize="10" fontWeight="800" fill="#22c55e" fontFamily="Arial, sans-serif">DRS</text>}
      </g>
      {(Object.keys(WHEELS) as WheelId[]).map(wheel)}
    </svg>
  );
}

export default CarChassisSvg;
