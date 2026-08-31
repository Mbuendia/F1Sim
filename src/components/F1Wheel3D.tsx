import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import styles from './F1Wheel3D.module.css';

export type TireCompound = 'soft' | 'medium' | 'hard' | 'inter' | 'wet';

interface F1Wheel3DProps {
  onEnter?: () => void;
  isTransitioning?: boolean;
  className?: string;
}

const COMPOUND_COLORS: Record<TireCompound, { hex: string; num: number; label: string }> = {
  soft: { hex: '#e10600', num: 0xe10600, label: 'SOFT (P ZERO ROJO)' },
  medium: { hex: '#ffd700', num: 0xffd700, label: 'MEDIUM (P ZERO AMARILLO)' },
  hard: { hex: '#ffffff', num: 0xffffff, label: 'HARD (P ZERO BLANCO)' },
  inter: { hex: '#22c55e', num: 0x22c55e, label: 'INTERMEDIATE (CINTURATO VERDE)' },
  wet: { hex: '#0284c7', num: 0x0284c7, label: 'WET (CINTURATO AZUL)' },
};

/**
 * Creates transparent decal texture containing only the Pirelli branding and compound stripes.
 * Because the canvas is 100% transparent behind the text/stripes, the underlying rubber
 * material remains physically identical to the tire tread and shoulders with ZERO grey mismatch.
 */
function createSidewallDecalTexture(compound: TireCompound): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const compInfo = COMPOUND_COLORS[compound];

  ctx.clearRect(0, 0, size, size);

  // 1. Official Compound Colored Curved Stripes
  const stripeRadius = size * 0.418;
  const stripeWidth = 24;

  ctx.save();
  ctx.shadowColor = compInfo.hex;
  ctx.shadowBlur = 24;

  // Upper colored arc
  ctx.beginPath();
  ctx.arc(cx, cy, stripeRadius, -Math.PI * 0.84, -Math.PI * 0.16);
  ctx.strokeStyle = compInfo.hex;
  ctx.lineWidth = stripeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Lower colored arc
  ctx.beginPath();
  ctx.arc(cx, cy, stripeRadius, Math.PI * 0.16, Math.PI * 0.84);
  ctx.strokeStyle = compInfo.hex;
  ctx.lineWidth = stripeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // Thin inner accent ring
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.372, 0, Math.PI * 2);
  ctx.strokeStyle = compInfo.hex;
  ctx.lineWidth = 3.5;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // 2. Pirelli & P Zero Curved Typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textPirelli = compound === 'inter' || compound === 'wet' ? 'CINTURATO' : 'PIRELLI';
  const textRadius = size * 0.418;
  ctx.font = '900 46px "Orbitron", "Montserrat", sans-serif';
  ctx.fillStyle = '#ffffff';

  const drawCurvedTextTop = (text: string, radius: number) => {
    const letters = text.split('');
    const totalAngle = 0.52;
    const startAngle = -Math.PI / 2 - totalAngle / 2;
    const angleStep = totalAngle / (letters.length - 1);

    letters.forEach((char, i) => {
      const angle = startAngle + i * angleStep;
      ctx.save();
      ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });
  };

  const drawCurvedTextBottom = (text: string, radius: number) => {
    const letters = text.split('');
    const totalAngle = 0.38;
    const startAngle = Math.PI / 2 + totalAngle / 2;
    const angleStep = totalAngle / (letters.length - 1);

    letters.forEach((char, i) => {
      const angle = startAngle - i * angleStep;
      ctx.save();
      ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.rotate(angle - Math.PI / 2);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });
  };

  drawCurvedTextTop(textPirelli, textRadius);
  ctx.fillStyle = compInfo.hex;
  ctx.font = '900 42px "Orbitron", "Montserrat", sans-serif';
  drawCurvedTextBottom('P ZERO', textRadius);

  // 3. Official FIA Barcode & QR Code Hologram detail
  ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  for (let b = 0; b < 12; b++) {
    const barAngle = -Math.PI * 0.05 + b * 0.01;
    const bx = cx + Math.cos(barAngle) * (size * 0.315);
    const by = cy + Math.sin(barAngle) * (size * 0.315);
    ctx.fillRect(bx, by, 2.5, 12);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural Cross-Drilled Steel Brake Rotor Texture (Like Reference Porsche/F1 Photo)
 */
function createCrossDrilledBrakeRotorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // Brushed steel radial gradient
  const grad = ctx.createRadialGradient(cx, cy, size * 0.18, cx, cy, size * 0.5);
  grad.addColorStop(0, '#334155');
  grad.addColorStop(0.2, '#64748b');
  grad.addColorStop(0.5, '#cbd5e1');
  grad.addColorStop(0.8, '#94a3b8');
  grad.addColorStop(1, '#475569');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Concentric machining wear tracks
  for (let r = size * 0.2; r < size * 0.49; r += 2.5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 5 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Cross-drilled spiral ventilation holes (like reference photo)
  ctx.fillStyle = '#0f172a';
  for (let i = 0; i < 36; i++) {
    const baseAng = (i * 10 * Math.PI) / 180;
    // 5 holes along each curved cooling vane
    for (let h = 0; h < 5; h++) {
      const r = size * (0.24 + h * 0.048);
      const ang = baseAng + h * 0.055;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;

      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural Bump Texture for Tire Tread Rubber
 */
function createTreadBumpTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    imgData.data[i] = Math.min(255, Math.max(0, 128 + noise));
    imgData.data[i + 1] = Math.min(255, Math.max(0, 128 + noise));
    imgData.data[i + 2] = Math.min(255, Math.max(0, 128 + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.fillStyle = '#202020';
  for (let y = 0; y < size; y += 16) {
    ctx.fillRect(0, y, 45, 4);
    ctx.fillRect(size - 45, y, 45, 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 2);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Authentic Brembo F1 Monobloc 6-Piston Caliper (Matching Reference Photo on Left Side at ~10 O'Clock)
 */
function createBremboF1Caliper(): THREE.Group {
  const group = new THREE.Group();

  // Position on upper-left (~10 o'clock position, exactly like the reference Porsche photo)
  const innerR = 1.05;
  const outerR = 1.42;
  const startAng = Math.PI * 0.72; // ~130 deg
  const endAng = Math.PI * 1.16;   // ~208 deg
  const segments = 24;

  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = startAng + (endAng - startAng) * (i / segments);
    const x = Math.cos(a) * outerR;
    const y = Math.sin(a) * outerR;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const a = startAng + (endAng - startAng) * (i / segments);
    const x = Math.cos(a) * innerR;
    const y = Math.sin(a) * innerR;
    shape.lineTo(x, y);
  }
  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 4,
  };

  const caliperGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  caliperGeom.translate(0, 0, -0.14);

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xdd1111, // Glossy Brembo Racing Red
    roughness: 0.2,
    metalness: 0.45,
  });

  const caliperMesh = new THREE.Mesh(caliperGeom, caliperMat);
  group.add(caliperMesh);

  // 6 Piston Circular Bosses (3 pairs along the curved face)
  const pistonMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.95,
    roughness: 0.18,
  });
  const pistonGeom = new THREE.CylinderGeometry(0.048, 0.048, 0.04, 16);
  pistonGeom.rotateX(Math.PI / 2);

  const pistonAngles = [
    Math.PI * 0.80,
    Math.PI * 0.94,
    Math.PI * 1.08,
  ];
  pistonAngles.forEach((ang) => {
    const px = Math.cos(ang) * 1.24;
    const py = Math.sin(ang) * 1.24;
    const pMesh = new THREE.Mesh(pistonGeom, pistonMat);
    pMesh.position.set(px, py, 0.16);
    group.add(pMesh);
  });

  // White "BREMBO" logo text badge across the caliper face
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = 256;
  logoCanvas.height = 64;
  const lctx = logoCanvas.getContext('2d')!;
  lctx.fillStyle = '#ffffff';
  lctx.font = '900 32px "Orbitron", sans-serif';
  lctx.textAlign = 'center';
  lctx.textBaseline = 'middle';
  lctx.fillText('brembo', 128, 32);
  const logoTex = new THREE.CanvasTexture(logoCanvas);

  const logoMat = new THREE.MeshBasicMaterial({
    map: logoTex,
    transparent: true,
    opacity: 0.95,
  });
  const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.12), logoMat);
  const midAng = Math.PI * 0.94;
  logoPlane.position.set(Math.cos(midAng) * 1.24, Math.sin(midAng) * 1.24, 0.17);
  logoPlane.rotation.z = midAng - Math.PI / 2;
  group.add(logoPlane);

  // Gold bleeder valve
  const bleederMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.25,
  });
  const bleederGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12);
  const bleeder = new THREE.Mesh(bleederGeom, bleederMat);
  bleeder.position.set(Math.cos(Math.PI * 1.15) * 1.36, Math.sin(Math.PI * 1.15) * 1.36, 0.1);
  bleeder.rotation.z = Math.PI / 4;
  group.add(bleeder);

  group.position.z = 0.24;
  return group;
}

export const F1Wheel3D: React.FC<F1Wheel3DProps> = ({ onEnter, isTransitioning = false, className }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedCompound, setSelectedCompound] = useState<TireCompound>('soft');
  const sidewallDecalFrontRef = useRef<THREE.Mesh | null>(null);
  const sidewallDecalBackRef = useRef<THREE.Mesh | null>(null);
  const spinSpeedRef = useRef(1.8);
  const targetRotationRef = useRef({ x: 0.12, y: 0.32 });
  const wheelGroupRef = useRef<THREE.Group | null>(null);
  const isHoveredRef = useRef(false);

  // Update sidewall decal texture when compound changes
  const updateCompound = useCallback((comp: TireCompound) => {
    setSelectedCompound(comp);
    const newTex = createSidewallDecalTexture(comp);
    if (sidewallDecalFrontRef.current) {
      (sidewallDecalFrontRef.current.material as THREE.MeshBasicMaterial).map = newTex;
      (sidewallDecalFrontRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
    if (sidewallDecalBackRef.current) {
      (sidewallDecalBackRef.current.material as THREE.MeshBasicMaterial).map = newTex;
      (sidewallDecalBackRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 360;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ── STUDIO LIGHTING ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    // Key front light
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 5, 8);
    scene.add(keyLight);

    // Kicker red racing light
    const kickerLight = new THREE.DirectionalLight(0xe10600, 2.5);
    kickerLight.position.set(-4, -2, 4);
    scene.add(kickerLight);

    // Rim specular light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(0, 6, -4);
    scene.add(rimLight);

    // ── 3D F1 WHEEL HIERARCHY ──
    const rootWheelGroup = new THREE.Group();
    wheelGroupRef.current = rootWheelGroup;
    scene.add(rootWheelGroup);

    // Initial entrance transform
    rootWheelGroup.position.set(0, 0, -2);
    rootWheelGroup.scale.set(0.6, 0.6, 0.6);

    const spinningAssembly = new THREE.Group();
    rootWheelGroup.add(spinningAssembly);

    // 1. TIRE RUBBER (Deep Charcoal Racing Slick #111317)
    const tireOuterRadius = 2.45;
    const tireInnerRadius = 1.45;
    const tireWidth = 1.35;
    const treadBump = createTreadBumpTexture();

    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.85,
      metalness: 0.08,
      bumpMap: treadBump,
      bumpScale: 0.03,
    });

    // Outer cylindrical tread
    const treadGeom = new THREE.CylinderGeometry(
      tireOuterRadius,
      tireOuterRadius,
      tireWidth * 0.85,
      64,
      1,
      true
    );
    const treadMesh = new THREE.Mesh(treadGeom, rubberMat);
    treadMesh.rotation.x = Math.PI / 2;
    spinningAssembly.add(treadMesh);

    // Rounded shoulders (2 Torus bevels)
    const shoulderGeom = new THREE.TorusGeometry(
      tireOuterRadius - 0.18,
      0.18,
      20,
      64
    );
    const shoulderFront = new THREE.Mesh(shoulderGeom, rubberMat);
    shoulderFront.position.z = tireWidth * 0.42;
    spinningAssembly.add(shoulderFront);

    const shoulderBack = new THREE.Mesh(shoulderGeom, rubberMat);
    shoulderBack.position.z = -tireWidth * 0.42;
    spinningAssembly.add(shoulderBack);

    // 2. SOLID SIDEWALL BASE (100% exact same rubberMat and color as tread)
    const sidewallGeom = new THREE.RingGeometry(tireInnerRadius, tireOuterRadius - 0.02, 64);
    
    const sidewallBaseFront = new THREE.Mesh(sidewallGeom, rubberMat);
    sidewallBaseFront.position.z = tireWidth * 0.5;
    spinningAssembly.add(sidewallBaseFront);

    const sidewallBaseBack = new THREE.Mesh(sidewallGeom, rubberMat);
    sidewallBaseBack.position.z = -tireWidth * 0.5;
    sidewallBaseBack.rotation.y = Math.PI;
    spinningAssembly.add(sidewallBaseBack);

    // 3. PIRELLI TRANSPARENT DECAL OVERLAY (Zero grey background!)
    const decalTex = createSidewallDecalTexture(selectedCompound);
    const decalMat = new THREE.MeshBasicMaterial({
      map: decalTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const decalFront = new THREE.Mesh(sidewallGeom, decalMat);
    decalFront.position.z = tireWidth * 0.5 + 0.005;
    sidewallDecalFrontRef.current = decalFront;
    spinningAssembly.add(decalFront);

    const decalBack = new THREE.Mesh(sidewallGeom, decalMat);
    decalBack.position.z = -tireWidth * 0.5 - 0.005;
    decalBack.rotation.y = Math.PI;
    sidewallDecalBackRef.current = decalBack;
    spinningAssembly.add(decalBack);

    // 4. ALLOY WHEEL RIM (BBS / OZ Satin Black Forged Rim like Reference Photo)
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x181c24, // Satin Black
      roughness: 0.32,
      metalness: 0.85,
    });

    const rimLipMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.25,
      metalness: 0.9,
    });

    // Outer Rim Bed (Cylinder)
    const rimBedGeom = new THREE.CylinderGeometry(
      tireInnerRadius + 0.02,
      tireInnerRadius + 0.02,
      tireWidth * 0.9,
      48,
      1,
      true
    );
    const rimBed = new THREE.Mesh(rimBedGeom, rimMat);
    rimBed.rotation.x = Math.PI / 2;
    spinningAssembly.add(rimBed);

    // Outer Lip Ring
    const rimLipGeom = new THREE.TorusGeometry(tireInnerRadius + 0.02, 0.045, 16, 48);
    const rimLip = new THREE.Mesh(rimLipGeom, rimLipMat);
    rimLip.position.z = tireWidth * 0.44;
    spinningAssembly.add(rimLip);

    // 5. 5-TWIN FORGED SPOKES (RADIAL SYMMETRY AT 72°)
    const spokeGroup = new THREE.Group();
    spokeGroup.position.z = tireWidth * 0.32;
    spinningAssembly.add(spokeGroup);

    const spokeGeom = new THREE.BoxGeometry(0.13, 0.95, 0.15);
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 * Math.PI) / 180;

      // Twin Spoke A
      const spokeA = new THREE.Mesh(spokeGeom, rimMat);
      spokeA.position.set(Math.cos(angle - 0.09) * 0.88, Math.sin(angle - 0.09) * 0.88, 0);
      spokeA.rotation.z = angle - Math.PI / 2 - 0.08;
      spokeGroup.add(spokeA);

      // Twin Spoke B
      const spokeB = new THREE.Mesh(spokeGeom, rimMat);
      spokeB.position.set(Math.cos(angle + 0.09) * 0.88, Math.sin(angle + 0.09) * 0.88, 0);
      spokeB.rotation.z = angle - Math.PI / 2 + 0.08;
      spokeGroup.add(spokeB);
    }

    // 6. CROSS-DRILLED STEEL/CARBON BRAKE DISC ROTOR (Like Reference Photo)
    const rotorTex = createCrossDrilledBrakeRotorTexture();
    const brakeDiscMat = new THREE.MeshStandardMaterial({
      map: rotorTex,
      roughness: 0.35,
      metalness: 0.85,
    });
    const brakeDiscGeom = new THREE.RingGeometry(0.48, 1.42, 48);
    const brakeDisc = new THREE.Mesh(brakeDiscGeom, brakeDiscMat);
    brakeDisc.position.z = tireWidth * 0.14;
    rootWheelGroup.add(brakeDisc);

    // Central Rotor Hat (Inner Bell)
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8,
    });
    const bellGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32);
    const bellMesh = new THREE.Mesh(bellGeom, bellMat);
    bellMesh.rotation.x = Math.PI / 2;
    bellMesh.position.z = tireWidth * 0.14;
    rootWheelGroup.add(bellMesh);

    // Authentic Brembo F1 Curved Caliper at ~10 O'Clock
    const bremboCaliper = createBremboF1Caliper();
    rootWheelGroup.add(bremboCaliper);

    // 7. F1 ANODIZED RED CENTER LOCK NUT & HUB
    const centerNutMat = new THREE.MeshStandardMaterial({
      color: 0xe10600,
      roughness: 0.18,
      metalness: 0.88,
    });
    const centerHubGeom = new THREE.CylinderGeometry(0.38, 0.42, 0.28, 6);
    const centerHub = new THREE.Mesh(centerHubGeom, centerNutMat);
    centerHub.rotation.x = Math.PI / 2;
    centerHub.position.z = tireWidth * 0.46;
    spinningAssembly.add(centerHub);

    // Center Cap with Black Inset
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x090c10,
      roughness: 0.4,
      metalness: 0.6,
    });
    const capGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 32);
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = tireWidth * 0.46 + 0.15;
    spinningAssembly.add(cap);

    // ── MOUSE PARALLAX / TILT LISTENER ──
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetRotationRef.current.y = nx * 0.52;
      targetRotationRef.current.x = -ny * 0.42;
    };

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      targetRotationRef.current.x = 0.12;
      targetRotationRef.current.y = 0.28;
    };

    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    // ── ANIMATION LOOP ──
    let animId: number;
    let clock = new THREE.Clock();
    let entranceProgress = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Entrance animation smoothly interpolating to scale 1.0 and z: 0
      if (entranceProgress < 1) {
        entranceProgress = Math.min(1, entranceProgress + dt * 1.25);
        const ease = 1 - Math.pow(1 - entranceProgress, 3);
        rootWheelGroup.scale.setScalar(0.6 + ease * 0.4);
        rootWheelGroup.position.z = -2 + ease * 2;
      }

      // Transition acceleration on click
      if (isTransitioning) {
        spinSpeedRef.current = Math.min(30.0, spinSpeedRef.current + dt * 45);
        rootWheelGroup.position.z += dt * 14;
        rootWheelGroup.scale.multiplyScalar(1 + dt * 0.8);
      } else {
        // Idle gentle rotation speed
        spinSpeedRef.current = isHoveredRef.current ? 3.0 : 1.5;
      }

      // Spin tire around its rolling axis (Z axis of spinningAssembly)
      spinningAssembly.rotation.z += spinSpeedRef.current * dt;

      // Parallax Tilt Lerp on root group
      rootWheelGroup.rotation.x += (targetRotationRef.current.x - rootWheelGroup.rotation.x) * 0.08;
      rootWheelGroup.rotation.y += (targetRotationRef.current.y - rootWheelGroup.rotation.y) * 0.08;

      // Gentle floating hover oscillation on Y
      rootWheelGroup.position.y = Math.sin(elapsed * 2.2) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // ── RESIZE HANDLER ──
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [isTransitioning, selectedCompound]);

  return (
    <div className={`${styles.wheel3dWrapper} ${className || ''}`}>
      <div ref={mountRef} className={styles.canvasContainer} onClick={onEnter} />

      {/* Floating Compound Switcher Badges */}
      <div className={styles.compoundSelector}>
        {(['soft', 'medium', 'hard', 'inter', 'wet'] as TireCompound[]).map((comp) => (
          <button
            key={comp}
            type="button"
            className={`${styles.compoundBtn} ${selectedCompound === comp ? styles.compoundBtnActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              updateCompound(comp);
            }}
            style={{
              borderColor: selectedCompound === comp ? COMPOUND_COLORS[comp].hex : 'rgba(255,255,255,0.12)',
              color: selectedCompound === comp ? COMPOUND_COLORS[comp].hex : '#94a3b8',
              boxShadow: selectedCompound === comp ? `0 0 14px ${COMPOUND_COLORS[comp].hex}66` : 'none',
            }}
          >
            <span
              className={styles.compoundDot}
              style={{ backgroundColor: COMPOUND_COLORS[comp].hex }}
            />
            <span>{comp.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
