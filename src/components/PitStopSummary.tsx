import { Wrench } from 'lucide-react';
import type { PitStopLog } from '../types/f1';
import { Chip } from './ui/Tile';

const WHEEL = ['delantera izquierda', 'delantera derecha', 'trasera izquierda', 'trasera derecha'];
const seconds = (value: number) => value.toFixed(1).replace('.', ',');

/** [CA6] Motivo de una parada lenta, en palabras; null si no fue lenta. */
export function slowStopReason(log: Pick<PitStopLog, 'cause' | 'wheel'>): string | null {
  if (log.cause === 'rueda-atascada') return `rueda atascada${log.wheel !== undefined ? ` (${WHEEL[log.wheel]})` : ''}`;
  if (log.cause === 'error') return 'error del equipo';
  return null;
}

/** [CA6] Última parada de un coche: tiempo del servicio, diferencia con la media de la carrera y motivo si fue lenta. */
export function PitStopSummary({ log }: { log: PitStopLog | null | undefined }) {
  if (!log) return null;
  const delta = log.averageSec !== undefined ? log.serviceSec - log.averageSec : null;
  const reason = slowStopReason(log);
  const deltaText = delta === null ? '' : ` · ${delta >= 0 ? '+' : '−'}${seconds(Math.abs(delta))} s sobre la media`;
  return (
    <Chip tone={reason ? 'warn' : 'neutral'} icon={<Wrench size={15} aria-hidden="true" />} data-pit-stop-summary={log.cause ?? 'normal'}
      title={`Parada de la vuelta ${log.lap}: servicio de ${seconds(log.serviceSec)} s${log.averageSec !== undefined ? `; media de la carrera ${seconds(log.averageSec)} s` : ''}`}>
      Parada {seconds(log.serviceSec)} s{deltaText}{reason ? ` · lenta: ${reason}` : ''}
    </Chip>
  );
}

/** [CA6] La última parada terminada de un coche. */
export function lastStop(stopLog: PitStopLog[] | undefined): PitStopLog | null {
  const done = (stopLog ?? []).filter(s => s.totalSec > 0);
  return done.length ? done[done.length - 1] : null;
}
