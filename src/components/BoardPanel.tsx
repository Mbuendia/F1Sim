import { BOARD } from '../simulation/Board';
import type { BoardState } from '../simulation/Board';
import m from './Management.module.css';

/**
 * [T4.10] Junta directiva: la confianza en el director (0 a 100), el objetivo de la temporada y los últimos
 * movimientos, cada uno con su motivo. Con la confianza baja avisa de que el puesto está en riesgo.
 */
export function BoardPanel({ board }: { board: BoardState }) {
  const risk = board.confidence < BOARD.WARNING;
  const recent = [...board.history].reverse().slice(0, 5);
  return (
    <section className={`${m.card} ${m.stack}`} aria-label="Junta directiva">
      <span className={m.label}>Junta</span>
      <div className={`${m.row} ${m.between}`}>
        <span className={`${m.big} ${risk ? m.neg : ''}`}>{Math.round(board.confidence)}</span>
        <span className={`${m.chip} ${risk ? m.chipWarn : ''}`}>{risk ? 'Tu puesto está en riesgo' : board.confidence >= 75 ? 'Confianza alta' : 'Estable'}</span>
      </div>
      <div className={m.bar}><i style={{ width: `${Math.round(board.confidence)}%` }} /></div>
      <span className={m.muted}>Objetivo de la temporada: {board.objective}.º en constructores</span>
      {recent.length > 0 && (
        <div className={m.lines}>
          {recent.map((move, i) => (
            <div key={`${move.round}-${i}`}><span>Ronda {move.round}: {move.reason}</span><span className={`${m.num} ${move.delta > 0 ? m.pos : m.neg}`}>{move.delta > 0 ? '+' : '−'}{Math.abs(move.delta)}</span></div>
          ))}
        </div>
      )}
      {board.lastOutcome && (
        <span className={m.dim}>
          Temporada {board.lastOutcome.season}: {board.lastOutcome.position}.º con objetivo {board.lastOutcome.objective}.º
          {board.lastOutcome.dismissed ? ' · la junta anterior te destituyó' : board.lastOutcome.lastChance ? ' · la junta te da otra temporada' : board.lastOutcome.met ? ' · objetivo cumplido' : ' · objetivo no cumplido'}
        </span>
      )}
    </section>
  );
}
