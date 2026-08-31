import React from 'react';

interface F1WheelSvgProps {
  className?: string;
  style?: React.CSSProperties;
}

export const F1WheelSvg: React.FC<F1WheelSvgProps> = ({ className, style }) => {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2000 2000"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        {/* Radial rubber shader */}
        <radialGradient id="tireRubberGradient" cx="50%" cy="50%" r="50%" fx="42%" fy="40%">
          <stop offset="0%" stopColor="#22272f" />
          <stop offset="65%" stopColor="#14171c" />
          <stop offset="88%" stopColor="#0d0f13" />
          <stop offset="100%" stopColor="#050608" />
        </radialGradient>

        {/* Sidewall bevel */}
        <radialGradient id="sidewallGradient" cx="50%" cy="50%" r="50%">
          <stop offset="68%" stopColor="#111317" />
          <stop offset="76%" stopColor="#1d222a" />
          <stop offset="85%" stopColor="#13161b" />
          <stop offset="100%" stopColor="#0a0b0e" />
        </radialGradient>

        {/* Rim Metallic Gradient */}
        <linearGradient id="rimMetalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="30%" stopColor="#1e293b" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* Spoke bevel highlight */}
        <linearGradient id="spokeHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Center Lock Anodized Red Nut */}
        <radialGradient id="centerNutGradient" cx="45%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="45%" stopColor="#e10600" />
          <stop offset="85%" stopColor="#990000" />
          <stop offset="100%" stopColor="#550000" />
        </radialGradient>

        {/* Brake Disc Carbon Matrix */}
        <radialGradient id="brakeDiscGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1d24" />
          <stop offset="70%" stopColor="#282d37" />
          <stop offset="90%" stopColor="#1f232b" />
          <stop offset="100%" stopColor="#121418" />
        </radialGradient>

        {/* Pirelli Red Glow */}
        <filter id="pirelliGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Arc Path for Upper Text: PIRELLI */}
        <path id="pirelliTextPath" d="M 400 1000 A 600 600 0 0 1 1600 1000" fill="none" />
        {/* Arc Path for Lower Text: P ZERO */}
        <path id="pzeroTextPath" d="M 1600 1000 A 600 600 0 0 1 400 1000" fill="none" />
      </defs>

      {/* ── 1. BASE TIRE TREAD (PERFECT CONCENTRIC CIRCLE) ── */}
      <circle cx="1000" cy="1000" r="950" fill="url(#tireRubberGradient)" stroke="#050608" strokeWidth="8" />

      {/* Outer tread edge shadow */}
      <circle cx="1000" cy="1000" r="920" fill="none" stroke="#090b0e" strokeWidth="12" />

      {/* 36 Diagonal shoulder grooves (Radial symmetry) */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = (i * 10 * Math.PI) / 180;
        const x1 = 1000 + Math.cos(angle) * 880;
        const y1 = 1000 + Math.sin(angle) * 880;
        const x2 = 1000 + Math.cos(angle + 0.05) * 945;
        const y2 = 1000 + Math.sin(angle + 0.05) * 945;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#07080a"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.8"
          />
        );
      })}

      {/* ── 2. SIDEWALL SECTION ── */}
      <circle cx="1000" cy="1000" r="840" fill="url(#sidewallGradient)" stroke="#1a1e26" strokeWidth="6" />
      <circle cx="1000" cy="1000" r="820" fill="none" stroke="#0d0f14" strokeWidth="4" />
      <circle cx="1000" cy="1000" r="660" fill="none" stroke="#0a0c10" strokeWidth="8" />

      {/* ── 3. PIRELLI P ZERO RED COMPOUND STRIPES (100% SYMMETRIC) ── */}
      {/* Upper Red Curved Stripe */}
      <path
        d="M 330 1000 A 670 670 0 0 1 1670 1000"
        fill="none"
        stroke="#e10600"
        strokeWidth="32"
        strokeLinecap="round"
        strokeDasharray="400 120 400 0"
        filter="url(#pirelliGlow)"
      />
      {/* Lower Red Curved Stripe */}
      <path
        d="M 1670 1000 A 670 670 0 0 1 330 1000"
        fill="none"
        stroke="#e10600"
        strokeWidth="32"
        strokeLinecap="round"
        strokeDasharray="400 120 400 0"
        filter="url(#pirelliGlow)"
      />

      {/* Pirelli Inner Thin Red Accent Line */}
      <circle
        cx="1000"
        cy="1000"
        r="630"
        fill="none"
        stroke="#e10600"
        strokeWidth="8"
        strokeDasharray="180 80"
        opacity="0.9"
      />

      {/* ── 4. OFFICIAL TYPOGRAPHY EMBOSSED ON RUBBER ── */}
      {/* Top: PIRELLI text */}
      <text
        fill="#e10600"
        fontSize="80"
        fontFamily="'Orbitron', 'Montserrat', sans-serif"
        fontWeight="900"
        letterSpacing="18"
      >
        <textPath href="#pirelliTextPath" startOffset="50%" textAnchor="middle">
          PIRELLI
        </textPath>
      </text>

      {/* Bottom: P ZERO text */}
      <text
        fill="#ffffff"
        fontSize="72"
        fontFamily="'Orbitron', 'Montserrat', sans-serif"
        fontWeight="900"
        letterSpacing="22"
      >
        <textPath href="#pzeroTextPath" startOffset="50%" textAnchor="middle">
          P ZERO
        </textPath>
      </text>

      {/* ── 5. WHEEL RIM BED & BRAKE DISC ── */}
      <circle cx="1000" cy="1000" r="550" fill="url(#brakeDiscGradient)" stroke="#334155" strokeWidth="18" />
      <circle cx="1000" cy="1000" r="530" fill="none" stroke="#0f172a" strokeWidth="12" />

      {/* Cross-Drilled Brake Disc Cooling Holes */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i * 18 * Math.PI) / 180;
        const x = 1000 + Math.cos(angle) * 470;
        const y = 1000 + Math.sin(angle) * 470;
        return <circle key={`hole-${i}`} cx={x} cy={y} r="12" fill="#0c0e12" stroke="#252a33" strokeWidth="3" />;
      })}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = ((i * 18 + 9) * Math.PI) / 180;
        const x = 1000 + Math.cos(angle) * 410;
        const y = 1000 + Math.sin(angle) * 410;
        return <circle key={`hole-in-${i}`} cx={x} cy={y} r="9" fill="#090b0e" stroke="#1f232b" strokeWidth="2" />;
      })}

      {/* ── 6. 5-TWIN SPOKE ALLOY WHEEL (72° RADIAL SYMMETRY) ── */}
      {Array.from({ length: 5 }).map((_, i) => {
        const baseAngleDeg = i * 72 - 90;
        return (
          <g key={`spoke-group-${i}`} transform={`rotate(${baseAngleDeg} 1000 1000)`}>
            {/* Left Spoke Wing */}
            <path
              d="M 975 880 L 935 550 L 965 540 L 995 860 Z"
              fill="url(#rimMetalGradient)"
              stroke="#475569"
              strokeWidth="4"
            />
            {/* Right Spoke Wing */}
            <path
              d="M 1025 880 L 1065 550 L 1035 540 L 1005 860 Z"
              fill="url(#rimMetalGradient)"
              stroke="#475569"
              strokeWidth="4"
            />
            {/* Center Spoke Spine Chamfer */}
            <polygon
              points="1000,535 970,545 985,870 1015,870 1030,545"
              fill="url(#spokeHighlight)"
              stroke="#64748b"
              strokeWidth="3"
            />
            {/* Spoke Structural Rim Pocket */}
            <path
              d="M 955 535 Q 1000 520 1045 535 L 1030 555 Q 1000 545 970 555 Z"
              fill="#0f172a"
            />
          </g>
        );
      })}

      {/* Inner spoke junction ring */}
      <circle cx="1000" cy="1000" r="230" fill="url(#rimMetalGradient)" stroke="#64748b" strokeWidth="10" />
      <circle cx="1000" cy="1000" r="200" fill="#0f172a" stroke="#334155" strokeWidth="6" />

      {/* ── 7. 5 DRIVE PINS AROUND CENTER HUB ── */}
      {Array.from({ length: 5 }).map((_, i) => {
        const pinAngle = (i * 72 - 90 + 36) * Math.PI / 180;
        const px = 1000 + Math.cos(pinAngle) * 155;
        const py = 1000 + Math.sin(pinAngle) * 155;
        return (
          <g key={`pin-${i}`}>
            <circle cx={px} cy={py} r="16" fill="#1e293b" stroke="#64748b" strokeWidth="4" />
            <circle cx={px} cy={py} r="8" fill="#cbd5e1" />
          </g>
        );
      })}

      {/* ── 8. CENTER LOCK F1 WHEEL NUT (ANODIZED RED) ── */}
      <circle
        cx="1000"
        cy="1000"
        r="115"
        fill="url(#centerNutGradient)"
        stroke="#ff6b6b"
        strokeWidth="8"
        filter="drop-shadow(0 0 15px rgba(225,6,0,0.6))"
      />

      {/* Center Nut Splines for Wheel Gun */}
      {Array.from({ length: 6 }).map((_, i) => {
        const splineAngle = (i * 60) * Math.PI / 180;
        const sx1 = 1000 + Math.cos(splineAngle) * 75;
        const sy1 = 1000 + Math.sin(splineAngle) * 75;
        const sx2 = 1000 + Math.cos(splineAngle) * 110;
        const sy2 = 1000 + Math.sin(splineAngle) * 110;
        return (
          <line
            key={`spline-${i}`}
            x1={sx1}
            y1={sy1}
            x2={sx2}
            y2={sy2}
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.85"
          />
        );
      })}

      {/* Center Cap Hub Core */}
      <circle cx="1000" cy="1000" r="65" fill="#090b0e" stroke="#e10600" strokeWidth="6" />
      <circle cx="1000" cy="1000" r="32" fill="#1e293b" stroke="#64748b" strokeWidth="4" />
      <circle cx="1000" cy="1000" r="12" fill="#ffffff" />
    </svg>
  );
};
