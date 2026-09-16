import React, { useRef, useEffect, useState } from 'react';
import styles from './RaceCanvas.module.css';
import { RaceSimulation } from '../simulation/RaceSimulation';
import { Camera } from '../renderer/Camera';
import { TrackRenderer } from '../renderer/TrackRenderer';
import { CarRenderer } from '../renderer/CarRenderer';
import { renderLeftMinimap } from '../renderer/MinimapRenderer';
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

      const clickedCarId = CarRenderer.pickCarAtScreen(simulation.cars, camera, clickX, clickY);

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
