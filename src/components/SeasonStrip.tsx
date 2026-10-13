import { OFFICIAL_CIRCUITS } from '../data/circuits';
import type { RoundView } from '../simulation/Season';
import m from './Management.module.css';

/**
 * [T4.3] Franja de la temporada: las 24 rondas de un vistazo, con su estado. La que toca va resaltada, las disputadas
 * llevan su ganador, las saltadas una raya y las de sprint una «S».
 */
export function SeasonStrip({ rounds }: { rounds: RoundView[] }) {
  return (
    <ol className={m.strip} aria-label="Rondas de la temporada">
      {rounds.map(round => {
        const circuit = OFFICIAL_CIRCUITS[round.circuitId];
        const result = round.status === 'disputada' ? round.winner?.driverCode ?? '✓' : round.status === 'saltada' ? '—' : round.status === 'siguiente' ? '▶' : '·';
        return (
          <li key={round.round} data-round={round.round} data-status={round.status} {...(round.sprint ? { 'data-sprint': '' } : {})}
            title={`Ronda ${round.round}: ${circuit?.name ?? round.circuitId}${round.substitutes ? ` (por ${round.substitutes})` : ''}`}>
            <span className={m.stripNumber}>{round.round}</span>
            <span className={m.stripFlag} aria-hidden="true">{circuit?.countryFlag ?? ''}</span>
            <span className={m.stripResult}>{result}</span>
            <span className={m.stripSprint}>{round.sprint ? 'S' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
