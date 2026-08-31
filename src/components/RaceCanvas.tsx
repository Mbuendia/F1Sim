import React, { useRef, useEffect, useState } from 'react';
import styles from './RaceCanvas.module.css';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { Camera } from '../renderer/Camera';
import { TrackRenderer } from '../renderer/TrackRenderer';
import { CarRenderer } from '../renderer/CarRenderer';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { Compass, RotateCw } from 'lucide-react';

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
  const isDraggingRef = useRef(false);
  const dragButtonRef = useRef<number>(0);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const totalDragDistanceRef = useRef(0);
  const [currentRotationDeg, setCurrentRotationDeg] = useState(0);

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

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

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

      TrackRenderer.renderTrack(ctx, simulation.activeTrack, camera, dpr, simulation.weather);

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
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [simulation, camera, simulation.circuitId]);

  // ── MANEJADORES DE RATÓN: ROTACIÓN 360°, PAN Y ZOOM ──
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragButtonRef.current = e.button;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    totalDragDistanceRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;
    totalDragDistanceRef.current += Math.hypot(dx, dy);
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (dragButtonRef.current === 0) {
      // Click izquierdo: Rotar 360° la pista
      camera.rotateBy(dx * 0.008);
      setCurrentRotationDeg(Math.round(((camera.targetRotation * 180) / Math.PI) % 360));
    } else if (dragButtonRef.current === 1 || dragButtonRef.current === 2) {
      // Click central o derecho: Desplazar la pista (Pan)
      camera.panBy(dx, dy);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Si fue un click rápido casi sin arrastrar (< 6px), seleccionar monoplaza
    if (totalDragDistanceRef.current < 6 && e.button === 0) {
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

        const dist = Math.hypot(screenPos.x - clickX, screenPos.y - clickY);
        if (dist < minDistance) {
          minDistance = dist;
          clickedCarId = car.id;
        }
      }

      if (clickedCarId !== null) {
        onSelectCar(clickedCarId);
        camera.followCar(clickedCarId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    camera.zoomBy(factor);
  };

  const handleDoubleClick = () => {
    camera.resetToFullTrack(simulation.activeTrack);
    setCurrentRotationDeg(0);
    onSelectCar(null);
  };

  return (
    <div className={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* ── BRÚJULA & INDICADOR DE ROTACIÓN 360° ── */}
      <div className={styles.orbitBadge} onClick={handleDoubleClick} title="Haz doble click para resetear vista">
        <Compass size={13} style={{ transform: `rotate(${-currentRotationDeg}deg)`, transition: 'transform 0.1s' }} />
        <span>{currentRotationDeg}° {currentRotationDeg !== 0 ? '(Click para reset)' : 'NORTE'}</span>
      </div>

      {/* ── HINT DE CONTROLES DE CÁMARA & PISTA ── */}
      <div className={styles.cameraHint}>
        🖱️ <strong>Click + Arrastrar:</strong> Rotar pista 360° | <strong>Click Dcho:</strong> Mover | <strong>Rueda:</strong> Zoom | <strong>Doble Click:</strong> Reset
      </div>
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
  ctx.roundRect(mmX, mmY, mmW, mmH, 8);
  ctx.fill();
  ctx.stroke();

  const scaleX = (mmW - 30) / (b.maxX - b.minX);
  const scaleY = (mmH - 30) / (b.maxY - b.minY);
  const mmScale = Math.min(scaleX, scaleY);

  const mmOffsetX = mmX + (mmW - (b.maxX - b.minX) * mmScale) / 2;
  const mmOffsetY = mmY + (mmH - (b.maxY - b.minY) * mmScale) / 2;

  const points = simulation.activeTrack.points;
  if (points.length > 0) {
    ctx.beginPath();
    const firstX = mmOffsetX + (points[0].x - b.minX) * mmScale;
    const firstY = mmOffsetY + (points[0].y - b.minY) * mmScale;
    ctx.moveTo(firstX, firstY);

    for (let i = 1; i < points.length; i++) {
      const px = mmOffsetX + (points[i].x - b.minX) * mmScale;
      const py = mmOffsetY + (points[i].y - b.minY) * mmScale;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Puntos de los coches en el minimapa
  for (const car of simulation.cars) {
    if (car.status === 'finished') continue;
    const normT = ((car.progress % 1) + 1) % 1;
    const ptIdx = Math.floor(normT * points.length) % points.length;
    const pt = points[ptIdx] || points[0];

    const cx = mmOffsetX + (pt.x - b.minX) * mmScale;
    const cy = mmOffsetY + (pt.y - b.minY) * mmScale;

    ctx.fillStyle = car.team.color;
    ctx.beginPath();
    ctx.arc(cx, cy, car.id === camera.followingCarId ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}