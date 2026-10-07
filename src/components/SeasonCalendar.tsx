import React, { useState } from 'react';
import styles from './Season.module.css';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { FlagIcon } from './FlagIcon';
import { SEASON_RACES } from '../simulation/Season';
import type { RoundView } from '../simulation/Season';

interface SeasonCalendarProps {
  rounds: RoundView[];
  /** Número de la temporada en curso (1 la primera). */
  seasonNumber: number;
  selectedCircuitId: string;
  /** Elige en el paddock el circuito del Gran Premio que toca. */
  onSelectNext: () => void;
  /** Salta el Gran Premio que toca: no se disputa y nadie puntúa. */
  onSkip: () => void;
}

/** [R51] Calendario de la temporada: qué Gran Premio toca, cuáles se han disputado o saltado y cuáles quedan. */
export const SeasonCalendar: React.FC<SeasonCalendarProps> = ({ rounds, seasonNumber, selectedCircuitId, onSelectNext, onSkip }) => {
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const next = rounds.find(round => round.status === 'siguiente');
  const nextCircuit = next && OFFICIAL_CIRCUITS[next.circuitId];
  const selected = OFFICIAL_CIRCUITS[selectedCircuitId];
  const freeRace = Boolean(next) && next?.circuitId !== selectedCircuitId;
  const stateOf = (round: RoundView) =>
    round.status === 'disputada' ? (round.winner ? `Ganó ${round.winner.driverCode}` : 'Disputada')
      : round.status === 'saltada' ? 'Saltada'
      : round.status === 'siguiente' ? 'Siguiente' : '';

  return (
    <section className={styles.calendar} aria-label="Calendario de la temporada">
      {next && nextCircuit && (
        <div className={styles.next}>
          <p className={styles.nextTitle}>
            Temporada {seasonNumber} · Ronda {next.round} de {SEASON_RACES}: <FlagIcon country={nextCircuit.country} emoji={nextCircuit.countryFlag} size={15} /> {nextCircuit.officialGpName}
            <span className={styles.nextSub}>{nextCircuit.name}{next.substitutes ? ` · sustituye a ${next.substitutes}` : ''}</span>
          </p>
          <div className={styles.actions}>
            {freeRace && <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onSelectNext}>Volver al Gran Premio que toca</button>}
            {confirmingSkip ? (
              <>
                <button type="button" className={`${styles.button} ${styles.danger}`} onClick={() => { setConfirmingSkip(false); onSkip(); }}>Sí, saltarlo</button>
                <button type="button" className={styles.button} onClick={() => setConfirmingSkip(false)}>Cancelar</button>
              </>
            ) : (
              <button type="button" className={styles.button} onClick={() => setConfirmingSkip(true)}>Saltar este Gran Premio</button>
            )}
          </div>
        </div>
      )}
      {confirmingSkip && <p className={styles.confirm}>Si lo saltas, este Gran Premio no se disputa: nadie puntúa y la temporada pasa a la ronda siguiente.</p>}
      {freeRace && (
        <p className={styles.free}>
          Carrera libre en {selected?.name ?? selectedCircuitId}: no cuenta para la temporada (no puntúa, no gasta componentes y no cambia el desarrollo ni los atributos de los pilotos).
        </p>
      )}
      <ol className={styles.rounds}>
        {rounds.map(round => {
          const circuit = OFFICIAL_CIRCUITS[round.circuitId];
          return (
            <li key={round.round} className={styles.round} data-round={round.round} data-status={round.status}>
              <span className={styles.number}>{round.round}</span>
              <span>
                {circuit && <FlagIcon country={circuit.country} emoji={circuit.countryFlag} size={13} />} {circuit?.officialGpName ?? round.circuitId}
                {round.substitutes && <span className={styles.note}> · sustituye a {round.substitutes}</span>}
              </span>
              <span className={styles.state}>{stateOf(round)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
