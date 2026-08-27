import React, { useRef, useEffect } from 'react';
import styles from './RaceCanvas.module.css';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { Camera } from '../renderer/Camera';
import { TrackRenderer } from '../renderer/TrackRenderer';
import { CarRenderer } from '../renderer/CarRenderer';
import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';

interface RaceCanvasProps {
  simulation: RaceSimulation;
  camera: Camera;
  selectedCarId: number | null;
  onSelectCar: (carId: number | null) => void;
}

export const RaceCanvas: React.FC<RaceCanvasProps> = ({
  simulation,
  camera,
  selectedCarId,
  onSelectCar
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      camera.resize(rect.width, rect.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // ── GAME LOOP PRINCIPAL DE RENDERIZADO ──
    const loop = (currentTime: number) => {
      const dtRaw = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // 1. Actualizar simulación
      simulation.update(dtRaw);

      // 2. Actualizar cámara
      camera.update(simulation.cars, dtRaw);

      // 3. Renderizar Canvas
      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fondo oscuro de circuito (asfalto/terreno nocturno F1)
      ctx.fillStyle = '#14181f';
      ctx.fillRect(0, 0, camera.screenWidth, camera.screenHeight);

      // Dibujar circuito
      TrackRenderer.renderTrack(ctx, BARCELONA_CIRCUIT, camera, dpr);

      // Dibujar monoplazas
      CarRenderer.renderCars(ctx, simulation.cars, camera, selectedCarId);

      // Minimapa si la cámara está en seguimiento
      if (camera.followingCarId !== null) {
        renderMinimap(ctx, simulation, camera);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [simulation, camera, selectedCarId]);

  // Manejar clic en el canvas para seleccionar monoplazas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let clickedCarId: number | null = null;
    let minDistance = 28; // Radio de clic en píxeles

    const totalPts = BARCELONA_CIRCUIT.points.length;

    for (const car of simulation.cars) {
      const normT = ((car.progress % 1) + 1) % 1;
      const ptIdx = Math.floor(normT * totalPts) % totalPts;
      const pt = BARCELONA_CIRCUIT.points[ptIdx];
      const screenPos = camera.worldToScreen(pt.x, pt.y);

      const dx = screenPos.x - clickX;
      const dy = screenPos.y - clickY;
      const dist = Math.hypot(dx, dy);

      if (dist < minDistance) {
        minDistance = dist;
        clickedCarId = car.id;
      }
    }

    if (clickedCarId !== null) {
      onSelectCar(clickedCarId);
      camera.followCar(clickedCarId);
    }
  };

  return (
    <div className={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onClick={handleCanvasClick}
      />
      {selectedCarId !== null && (
        <div className={styles.cameraHint}>
          Siguiendo monoplaza · Pulsa <strong>ESC</strong> para volver a vista general
        </div>
      )}
    </div>
  );
};

// Renderizado del minimapa en la esquina
function renderMinimap(
  ctx: CanvasRenderingContext2D,
  simulation: RaceSimulation,
  camera: Camera
) {
  const mmW = 190;
  const mmH = 120;
  const mmX = camera.screenWidth - mmW - 20;
  const mmY = camera.screenHeight - mmH - 20;
  const b = BARCELONA_CIRCUIT.bounds;

  // Caja minimapa
  ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(mmX, mmY, mmW, mmH, 8);
  ctx.fill();
  ctx.stroke();

  // Escala
  const padding = 12;
  const tW = b.maxX - b.minX;
  const tH = b.maxY - b.minY;
  const scale = Math.min((mmW - padding * 2) / tW, (mmH - padding * 2) / tH);
  const offX = mmX + padding + (mmW - padding * 2 - tW * scale) / 2;
  const offY = mmY + padding + (mmH - padding * 2 - tH * scale) / 2;

  const toMM = (wx: number, wy: number) => ({
    x: (wx - b.minX) * scale + offX,
    y: (wy - b.minY) * scale + offY
  });

  // Trazado minimapa
  ctx.beginPath();
  const pts = BARCELONA_CIRCUIT.points;
  const first = toMM(pts[0].x, pts[0].y);
  ctx.moveTo(first.x, first.y);
  for (let i = 2; i < pts.length; i += 3) {
    const p = toMM(pts[i].x, pts[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Coches en el minimapa
  for (const car of simulation.cars) {
    const normT = ((car.progress % 1) + 1) % 1;
    const ptIdx = Math.floor(normT * pts.length) % pts.length;
    const pt = pts[ptIdx];
    const sp = toMM(pt.x, pt.y);

    const isSelected = car.id === camera.followingCarId;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, isSelected ? 4 : 2, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffffff' : car.team.color;
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = car.team.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
