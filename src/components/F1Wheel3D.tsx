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
  inter: { hex: '#39b54a', num: 0x39b54a, label: 'INTERMEDIATE (CINTURATO VERDE)' },
  wet: { hex: '#0072bc', num: 0x0072bc, label: 'WET (CINTURATO AZUL)' },
};

/**
 * Creates an ultra-high resolution procedural Pirelli tire sidewall canvas texture
 */
function createSidewallTexture(compound: TireCompound): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const compInfo = COMPOUND_COLORS[compound];

  // 1. Background Rubber Gradient
  const bgGrad = ctx.createRadialGradient(cx, cy, size * 0.22, cx, cy, size * 0.5);
  bgGrad.addColorStop(0, '#101317');
  bgGrad.addColorStop(0.5, '#16191f');
  bgGrad.addColorStop(0.85, '#121418');
  bgGrad.addColorStop(1, '#090a0d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // 2. Concentric Rubber Ribs & Ridges
  for (let r = size * 0.25; r < size * 0.48; r += 6) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = (r % 12 === 0) ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 3. Official Compound Colored Curved Stripes
  const stripeRadius = size * 0.415;
  const stripeWidth = 26;

  // Outer glow for the stripe
  ctx.save();
  ctx.shadowColor = compInfo.hex;
  ctx.shadowBlur = 18;

  // Upper colored arc
  ctx.beginPath();
  ctx.arc(cx, cy, stripeRadius, -Math.PI * 0.82, -Math.PI * 0.18);
  ctx.strokeStyle = compInfo.hex;
  ctx.lineWidth = stripeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Lower colored arc
  ctx.beginPath();
  ctx.arc(cx, cy, stripeRadius, Math.PI * 0.18, Math.PI * 0.82);
  ctx.strokeStyle = compInfo.hex;
  ctx.lineWidth = stripeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // Thin inner accent ring
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.375, 0, Math.PI * 2);
  ctx.strokeStyle = compInfo.hex;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // 4. Pirelli & P Zero Curved Typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw PIRELLI on top arc
  const textPirelli = compound === 'inter' || compound === 'wet' ? 'CINTURATO' : 'PIRELLI';
  const textRadius = size * 0.415;
  ctx.font = '900 48px "Orbitron", "Montserrat", sans-serif';
  ctx.fillStyle = '#ffffff';

  const drawCurvedTextTop = (text: string, radius: number) => {
    const letters = text.split('');
    const totalAngle = 0.55; // radians
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
    const totalAngle = 0.42; // radians
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
  ctx.font = '900 44px "Orbitron", "Montserrat", sans-serif';
  drawCurvedTextBottom('P ZERO', textRadius);

  // 5. Official FIA Barcode & QR Code Hologram detail
  ctx.fillStyle = '#cbd5e1';
  for (let b = 0; b < 12; b++) {
    const barAngle = -Math.PI * 0.05 + b * 0.01;
    const bx = cx + Math.cos(barAngle) * (size * 0.32);
    const by = cy + Math.sin(barAngle) * (size * 0.32);
    ctx.fillRect(bx, by, 3, 14);
  }

  // 6. Transparent inner hole for rim
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural Normal/Bump Texture for Tire Tread Rubber
 */
function createTreadBumpTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Micro-texture noise
  const imgData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 35;
    imgData.data[i] = Math.min(255, Math.max(0, 128 + noise));
    imgData.data[i + 1] = Math.min(255, Math.max(0, 128 + noise));
    imgData.data[i + 2] = Math.min(255, Math.max(0, 128 + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Lateral shoulder grip grooves
  ctx.fillStyle = '#202020';
  for (let y = 0; y < size; y += 18) {
    ctx.fillRect(0, y, 60, 6);
    ctx.fillRect(size - 60, y, 60, 6);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 2);
  texture.needsUpdate = true;
  return texture;
}

export const F1Wheel3D: React.FC<F1Wheel3DProps> = ({ onEnter, isTransitioning = false, className }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedCompound, setSelectedCompound] = useState<TireCompound>('soft');
  const sidewallMeshFrontRef = useRef<THREE.Mesh | null>(null);
  const sidewallMeshBackRef = useRef<THREE.Mesh | null>(null);
  const spinSpeedRef = useRef(1.8);
  const targetRotationRef = useRef({ x: 0.15, y: 0.35 });
  const wheelGroupRef = useRef<THREE.Group | null>(null);
  const isHoveredRef = useRef(false);

  // Update sidewall texture when compound changes
  const updateCompound = useCallback((comp: TireCompound) => {
    setSelectedCompound(comp);
    const newTex = createSidewallTexture(comp);
    if (sidewallMeshFrontRef.current) {
      (sidewallMeshFrontRef.current.material as THREE.MeshStandardMaterial).map = newTex;
      (sidewallMeshFrontRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    if (sidewallMeshBackRef.current) {
      (sidewallMeshBackRef.current.material as THREE.MeshStandardMaterial).map = newTex;
      (sidewallMeshBackRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
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
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // ── LIGHTING SETUP ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    // Key front light
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 5, 8);
    scene.add(keyLight);

    // Kicker red racing light
    const kickerLight = new THREE.DirectionalLight(0xe10600, 3.8);
    kickerLight.position.set(-5, -3, 3);
    scene.add(kickerLight);

    // Rim specular light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
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

    // 1. TIRE RUBBER (18" F1 Low Profile Dimensions)
    const tireOuterRadius = 2.45;
    const tireInnerRadius = 1.45;
    const tireWidth = 1.35;
    const treadBump = createTreadBumpTexture();

    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x13161c,
      roughness: 0.82,
      metalness: 0.12,
      bumpMap: treadBump,
      bumpScale: 0.04,
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

    // 2. SIDEWALL DISCS WITH PIRELLI TEXTURE
    const sidewallGeom = new THREE.RingGeometry(tireInnerRadius, tireOuterRadius - 0.02, 64);
    const sidewallTex = createSidewallTexture(selectedCompound);

    const sidewallMatFront = new THREE.MeshStandardMaterial({
      map: sidewallTex,
      roughness: 0.55,
      metalness: 0.18,
      side: THREE.FrontSide,
      transparent: true,
    });

    const sidewallMeshFront = new THREE.Mesh(sidewallGeom, sidewallMatFront);
    sidewallMeshFront.position.z = tireWidth * 0.5 + 0.01;
    sidewallMeshFrontRef.current = sidewallMeshFront;
    spinningAssembly.add(sidewallMeshFront);

    const sidewallMatBack = new THREE.MeshStandardMaterial({
      map: sidewallTex,
      roughness: 0.55,
      metalness: 0.18,
      side: THREE.BackSide,
      transparent: true,
    });
    const sidewallMeshBack = new THREE.Mesh(sidewallGeom, sidewallMatBack);
    sidewallMeshBack.position.z = -tireWidth * 0.5 - 0.01;
    sidewallMeshBackRef.current = sidewallMeshBack;
    spinningAssembly.add(sidewallMeshBack);

    // 3. ALLOY WHEEL RIM (BBS / OZ 18" FORGED RIM)
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.28,
      metalness: 0.88,
    });

    const rimLipMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.22,
      metalness: 0.92,
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

    // Outer Polished Lip
    const rimLipGeom = new THREE.TorusGeometry(tireInnerRadius + 0.02, 0.045, 16, 48);
    const rimLip = new THREE.Mesh(rimLipGeom, rimLipMat);
    rimLip.position.z = tireWidth * 0.44;
    spinningAssembly.add(rimLip);

    // 4. 5-TWIN FORGED SPOKES (RADIAL SYMMETRY AT 72°)
    const spokeGroup = new THREE.Group();
    spokeGroup.position.z = tireWidth * 0.32;
    spinningAssembly.add(spokeGroup);

    const spokeGeom = new THREE.BoxGeometry(0.14, 0.95, 0.16);
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

    // 5. CARBON-CERAMIC BRAKE DISC & ROTOR (Static behind spinning rim)
    const brakeDiscMat = new THREE.MeshStandardMaterial({
      color: 0x272c36,
      roughness: 0.65,
      metalness: 0.5,
    });
    const brakeDiscGeom = new THREE.RingGeometry(0.5, 1.38, 48);
    const brakeDisc = new THREE.Mesh(brakeDiscGeom, brakeDiscMat);
    brakeDisc.position.z = tireWidth * 0.15;
    rootWheelGroup.add(brakeDisc); // Static relative to wheel tilt

    // Brembo Red Brake Caliper
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      roughness: 0.3,
      metalness: 0.7,
    });
    const caliperGeom = new THREE.BoxGeometry(0.55, 0.85, 0.45);
    const caliper = new THREE.Mesh(caliperGeom, caliperMat);
    caliper.position.set(0.95, 0.65, tireWidth * 0.22);
    caliper.rotation.z = Math.PI * 0.28;
    rootWheelGroup.add(caliper);

    // 6. F1 ANODIZED RED CENTER LOCK NUT & HUB
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
      targetRotationRef.current.y = nx * 0.55;
      targetRotationRef.current.x = -ny * 0.45;
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
        spinSpeedRef.current = isHoveredRef.current ? 3.2 : 1.6;
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
