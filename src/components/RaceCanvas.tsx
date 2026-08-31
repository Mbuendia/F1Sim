import React, { useRef, useEffect } from 'react';
import styles from './RaceCanvas.module.css';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { Camera } from '../renderer/Camera';
import { TrackRenderer } from '../renderer/TrackRenderer';
import { CarRenderer } from '../renderer/CarRenderer';
import { OFFICIAL_CIRCUITS } from '../data/circuits';

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

  // Sincronizar el seguimiento de la cámara cuando cambia selectedCarId
  useEffect(() => {
    if (selectedCarId !== null) {
      camera.followCar(selectedCarId);
    } else {
      camera.resetToFullTrack(simulation.activeTrack);
    }
  }, [selectedCarId, camera, simulation.activeTrack]);

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
      camera.resize(rect.width, rect.height, simulation.activeTrack);
    };

    handleResize();
    if (selectedCarId === null) {
      camera.resetToFullTrack(simulation.activeTrack);
    }
    window.addEventListener('resize', handleResize);

    const loop = (currentTime: number) => {
      const dtRaw = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      simulation.update(dtRaw);
      camera.update(simulation.cars, dtRaw, simulation.activeTrack);

      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fondo oscuro
      ctx.fillStyle = '#14181f';
      ctx.fillRect(0, 0, camera.screenWidth, camera.screenHeight);

      TrackRenderer.renderTrack(ctx, simulation.activeTrack, camera, dpr);

      const circuitSpec = OFFICIAL_CIRCUITS[simulation.circuitId];
      const trackWidthCarsCapacity = circuitSpec?.trackWidthCars ?? 3;
      CarRenderer.renderCars(ctx, simulation.cars, camera, selectedCarId, simulation.activeTrack, trackWidthCarsCapacity, simulation.safetyCar);

      // ── MINIMAPA A LA IZQUIERDA DEL TODO (visible al seguir un coche) ──
      if (camera.followingCarId !== null) {
        renderLeftMinimap(ctx, simulation, camera);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [simulation, camera, simulation.circuitId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let clickedCarId: number | null = null;
    let minDistance = 35;

    const points = simulation.activeTrack.points;
    const totalPts = points.length;

    for (const car of simulation.cars) {
      if (car.status === 'finished') continue;
      const normT = ((car.progress % 1) + 1) % 1;
      const ptIdx = Math.floor(normT * totalPts) % totalPts;
      const pt = points[ptIdx] || points[0];
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
          🎥 <strong>CÁMARA CINEMATOGRÁFICA DE SEGUIMIENTO</strong> · Pulsa <strong>ESC</strong> para vista general
        </div>
      )}
    </div>
  );
};

// ── RENDERIZADO DEL MINIMAPA A LA IZQUIERDA DEL TODO ──
function renderLeftMinimap(
  ctx: CanvasRenderingContext2D,
  simulation: RaceSimulation,
  camera: Camera
) {
  const mmW = 180;
  const mmH = 115;
  const mmX = 20;
  const mmY = camera.screenHeight - mmH - 24;
  const b = simulation.activeTrack.bounds;

  ctx.fillStyle = 'rgba(8, 12, 20, 0.92)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(mmX, mmY, mmW, mmH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 9px Orbitron, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText('MAPA PISTA', mmX + 8, mmY + 13);

  const padding = 12;
  const tW = b.maxX - b.minX;
  const tH = b.maxY - b.minY;
  const scale = Math.min((mmW - padding * 2) / tW, (mmH - padding * 2) / tH);
  const offX = mmX + padding + (mmW - padding * 2 - tW * scale) / 2;
  const offY = mmY + padding + 6 + (mmH - padding * 2 - tH * scale) / 2;

  const toMM = (wx: number, wy: number) => ({
    x: (wx - b.minX) * scale + offX,
    y: (wy - b.minY) * scale + offY
  });

  ctx.beginPath();
  const pts = simulation.activeTrack.points;
  const first = toMM(pts[0].x, pts[0].y);
  ctx.moveTo(first.x, first.y);
  for (let i = 2; i < pts.length; i += 3) {
    const p = toMM(pts[i].x, pts[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (const car of simulation.cars) {
    if (car.status === 'finished') continue;
    const normT = ((car.progress % 1) + 1) % 1;
    const ptIdx = Math.floor(normT * pts.length) % pts.length;
    const pt = pts[ptIdx] || pts[0];
    const sp = toMM(pt.x, pt.y);

    const isSelected = car.id === camera.followingCarId;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, isSelected ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffffff' : car.team.color;
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = car.team.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Safety Car en el minimapa
  if (simulation.safetyCar.isDeployed && simulation.safetyCar.mode !== 'idle' && simulation.safetyCar.mode !== 'in') {
    const normT = ((simulation.safetyCar.progress % 1) + 1) % 1;
    const ptIdx = Math.floor(normT * pts.length) % pts.length;
    const pt = pts[ptIdx] || pts[0];
    const sp = toMM(pt.x, pt.y);

    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}