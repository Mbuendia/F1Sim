import React from 'react';
import styles from './StartLights.module.css';
import { StartLightState, CarState } from '../types/f1';
import { Play, Flag } from 'lucide-react';

interface StartLightsProps {
  lightState: StartLightState;
  cars: CarState[];
  favoriteCarId: number;
  onSelectFavoriteCar: (carId: number) => void;
  /** Sin esto (el invitado), el semáforo solo se mira: la salida la confirma el anfitrión. */
  onStartClick?: () => void;
}

/** [MJ12, 20/11/2026] Luces rojas encendidas en cada estado del semáforo del motor (en «lights-out», todas apagadas). */
export function litColumns(state: StartLightState): number {
  const m = /^lights-([1-5])$/.exec(state);
  return m ? Number(m[1]) : 0;
}

/**
 * [MJ12] Recorte de la capa encendida para enseñar las primeras `lit` columnas: el pórtico se renderizó con la cámara
 * ortográfica centrada y las cinco columnas a quintos de un ancho de 6 m (x = -2..2), así que la columna N acaba en
 * (N + 0,5) / 6 del ancho de la imagen (scripts/blender/mj12-semaforo.py).
 */
export function litClip(lit: number): string {
  if (lit <= 0) return 'inset(0 100% 0 0)';
  const right = 100 - ((Math.min(lit, 5) + 0.5) / 6) * 100;
  return `inset(0 ${right.toFixed(3)}% 0 0)`;
}

const ART = `${import.meta.env.BASE_URL ?? '/'}semaforo/`;

function Gantry({ layer, style }: { layer: 'apagado' | 'encendido'; style?: React.CSSProperties }) {
  return (
    <picture className={styles.layer} style={style}>
      <img src={`${ART}semaforo-${layer}.webp`} alt="" draggable={false} data-gantry={layer} />
    </picture>
  );
}

/**
 * Semáforo de salida. [MJ12, 20/11/2026] El pórtico está hecho en Blender (cinco cajas con cuatro luces cada una, sin
 * marcas) en dos capas, apagado y encendido; la encendida se recorta para enseñar tantas columnas como luces diga el
 * motor (lights-1 a lights-5) y se apagan todas a la vez en «lights-out». Antes era un recuadro de CSS con «FORMULA 1».
 */
export const StartLights: React.FC<StartLightsProps> = ({ lightState, onStartClick }) => {
  if (lightState === 'idle' || lightState === 'racing' || lightState === 'finished' || lightState === 'formation-lap' || lightState === 'grid-parking') {
    return null;
  }
  const isGridReady = lightState === 'grid-ready';
  const lit = litColumns(lightState);
  const out = lightState === 'lights-out';
  const title = out ? 'Se apagan los semáforos' : isGridReady ? 'Coches en parrilla' : 'Procedimiento de salida';

  return (
    <div className={styles.overlay} data-start-lights={lightState}>
      <div className={styles.gantryContainer}>
        <p className={styles.gantryTitle}>{title}</p>
        <div className={styles.gantry} role="img" aria-label={out ? 'Semáforo apagado: salida' : `Semáforo: ${lit} de 5 luces encendidas`}>
          <Gantry layer="apagado" />
          <Gantry layer="encendido" style={{ clipPath: litClip(lit) }} />
        </div>

        {isGridReady && onStartClick && (
          <button className={styles.startButton} onClick={onStartClick}>
            <Play size={18} fill="#ffffff" aria-hidden="true" />
            <span><Flag size={14} aria-hidden="true" /> Confirmar la salida</span>
          </button>
        )}
        {isGridReady && !onStartClick && <p className={styles.statusText}>El anfitrión da la salida</p>}

        {out && <p className={styles.lightsOutBanner} role="status">¡Arranca la carrera!</p>}
        {!out && !isGridReady && <p className={styles.statusText}>Motores a revoluciones de salida…</p>}
      </div>
    </div>
  );
};
