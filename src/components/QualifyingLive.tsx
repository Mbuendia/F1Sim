import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, SkipForward } from 'lucide-react';
import { formatLapTime } from '../simulation/Qualifying';
import type { QualifyingResult } from '../simulation/Qualifying';
import { dotsAt, qualifyingReplay, sessionComment, standingsAt } from '../simulation/QualifyingReplay';
import styles from './QualifyingLive.module.css';

export interface OutlinePoint { x: number; y: number }

const VIEW = 400, PAD = 22;

/** Contorno del circuito encajado en el recuadro del dibujo. */
function fitOutline(points: OutlinePoint[]): OutlinePoint[] {
  if (points.length < 3) return [];
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX || 1, height = Math.max(...ys) - minY || 1;
  const scale = (VIEW - 2 * PAD) / Math.max(width, height);
  const offsetX = (VIEW - width * scale) / 2, offsetY = (VIEW - height * scale) / 2;
  // Con unos 300 puntos el trazo ya es suave: no hace falta pintar los miles del eje real.
  const stride = Math.max(1, Math.floor(points.length / 300));
  return points.filter((_, index) => index % stride === 0).map(p => ({ x: offsetX + (p.x - minX) * scale, y: offsetY + (p.y - minY) * scale }));
}

/**
 * [V7] Clasificación en directo: los coches como puntos dando su vuelta, la tabla de tiempos al día con la zona de
 * eliminación marcada y, al acabar cada sesión, un comentario. Se puede saltar en cualquier momento; el resultado es el
 * de `result`, que ya está calculado: aquí solo se cuenta. El comentario sale dentro del recuadro del circuito (ya no
 * rueda nadie), así no tapa ni la tabla ni su leyenda y la ventana no cambia de tamaño.
 */
export function QualifyingLive({ result, outline, playerIds = [], onDone, startAt }: {
  result: QualifyingResult;
  /** Eje del circuito, en el orden en que se recorre. */
  outline: OutlinePoint[];
  playerIds?: string[];
  onDone: () => void;
  /** Para pruebas: sesión y segundo en los que empieza, y si arranca ya en el comentario. */
  startAt?: { session: number; timeSec: number; comment?: boolean };
}) {
  const sessions = useMemo(() => qualifyingReplay(result), [result]);
  const path = useMemo(() => fitOutline(outline), [outline]);
  const slots = useMemo(() => new Map(result.grid.map(slot => [slot.driverId, slot])), [result]);
  const [index, setIndex] = useState(startAt?.session ?? 0);
  const [time, setTime] = useState(startAt?.timeSec ?? 0);
  const [comment, setComment] = useState(Boolean(startAt?.comment));
  const [speed, setSpeed] = useState(1);
  const session = sessions[index];
  const frame = useRef(0);

  useEffect(() => {
    if (comment) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      setTime(current => {
        const next = current + dt;
        if (next >= session.durationSec) { setComment(true); return session.durationSec; }
        return next;
      });
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [comment, session, speed]);

  const standings = standingsAt(session, time), running = dotsAt(session, time);
  const onLap = new Set(running.map(dot => dot.driverId));
  const best = standings[0]?.bestSec ?? null;
  const at = (progress: number) => path[Math.min(path.length - 1, Math.floor(progress * path.length))] ?? { x: VIEW / 2, y: VIEW / 2 };
  const next = () => {
    if (index >= sessions.length - 1) { onDone(); return; }
    setIndex(index + 1); setTime(0); setComment(false);
  };

  return (
    <section className={styles.live} aria-label={`Clasificación en directo: ${session.label}`}>
      <header className={styles.header}>
        <h2 className={styles.title}>{result.format === 'sprint' ? 'Clasificación sprint' : 'Clasificación'}</h2>
        <ol className={styles.steps} aria-label="Sesiones">
          {sessions.map((item, order) => <li key={item.id} data-state={order < index ? 'hecha' : order === index ? 'actual' : 'pendiente'}>{item.label}</li>)}
        </ol>
        <div className={styles.tools}>
          {!comment && (
            <button type="button" className={styles.tool} aria-pressed={speed > 1} onClick={() => setSpeed(speed > 1 ? 1 : 4)} title="Cambiar la velocidad de la sesión">{speed > 1 ? '×4' : '×1'}</button>
          )}
          <button type="button" className={styles.tool} onClick={onDone}><SkipForward size={16} aria-hidden="true" />Saltar</button>
        </div>
      </header>
      <div className={styles.progress} role="progressbar" aria-label={`Avance de ${session.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 * time / session.durationSec)}>
        <span style={{ width: `${100 * time / session.durationSec}%` }} />
      </div>

      <div className={styles.body}>
        <div className={styles.stage}>
        <svg className={styles.map} data-dim={comment ? 'true' : undefined} viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label={`Circuito: ${running.length} ${running.length === 1 ? 'coche' : 'coches'} en vuelta lanzada`}>
          {path.length > 0 && <polygon className={styles.outline} points={path.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />}
          {running.map(dot => {
            const p = at(dot.progress), slot = slots.get(dot.driverId), mine = playerIds.includes(dot.driverId);
            return (
              <g key={dot.driverId} data-dot={dot.driverId} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
                <circle r={mine ? 7 : 5} fill={slot?.teamColor ?? '#fff'} stroke={mine ? '#fff' : '#0d1117'} strokeWidth={mine ? 2 : 1} />
                {mine && <text className={styles.dotLabel} y={-11} textAnchor="middle">{slot?.code}</text>}
              </g>
            );
          })}
        </svg>
        {comment && (
          <div className={styles.comment} role="status">
            <strong>Final de {session.label}</strong>
            <ul>{sessionComment(result, session.id, playerIds).map(line => <li key={line}>{line}</li>)}</ul>
            <button type="button" className={styles.next} onClick={next}>
              {index >= sessions.length - 1 ? 'Ver la parrilla' : `Empezar ${sessions[index + 1].label}`}<ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        </div>

        <ol className={styles.table} aria-label={`Tiempos de ${session.label}`}>
          {standings.map((row, position) => {
            const slot = slots.get(row.driverId), out = session.advance !== null && position >= session.advance;
            return (
              <li key={row.driverId} className={styles.row} data-out={out ? 'true' : undefined} data-mine={playerIds.includes(row.driverId) ? 'true' : undefined}
                data-cut={session.advance !== null && position === session.advance ? 'true' : undefined}>
                <span className={styles.pos}>{position + 1}</span>
                <span className={styles.dot} style={{ background: slot?.teamColor }} />
                <span className={styles.code}>{slot?.code ?? row.driverId}</span>
                <span className={styles.time}>{row.bestSec === null ? (onLap.has(row.driverId) ? 'en vuelta' : '—') : formatLapTime(row.bestSec)}</span>
                <span className={styles.gap}>{row.bestSec !== null && best !== null && position > 0 ? `+${(row.bestSec - best).toFixed(3).replace('.', ',')}` : onLap.has(row.driverId) && row.bestSec !== null ? 'en vuelta' : ''}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {session.advance !== null && <p className={styles.legend}>Por debajo de la línea roja, zona de eliminación: pasan {session.advance}.</p>}
    </section>
  );
}
