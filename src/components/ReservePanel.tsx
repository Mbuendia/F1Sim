import { DRIVERS } from '../data/drivers';
import { ACADEMY, freeJuniors, isReady, reserveOf } from '../simulation/Academy';
import type { AcademyState, Junior } from '../simulation/Academy';
import { negotiationOpen, pairOf, rosterOf, seasonSalary, seatsTaken } from '../simulation/Contracts';
import type { ContractsState } from '../simulation/Contracts';
import { formatMoney } from '../simulation/Finance';
import { Helmet } from './DriverContractsPanel';
import m from './Management.module.css';

const hundred = (value: number) => Math.round(value * 100);

/** Ritmo que se enseña al principio y al final de la barra: por debajo no hay pilotos de cantera. */
const PACE_FROM = 60, PACE_TO = 100;
const paceAt = (value: number) => Math.max(0, Math.min(100, 100 * (value - PACE_FROM) / (PACE_TO - PACE_FROM)));

/**
 * Lo que se sabe de un joven, de un vistazo: edad y perfil como fichas, el ritmo de hoy como barra (con el tramo que le
 * queda hasta su potencial) y el sueldo.
 */
function Facts({ junior }: { junior: Junior }) {
  const pace = hundred(junior.driver.talentRating), potential = hundred(junior.potential);
  return (
    <>
      <span className={`${m.row} ${m.wrap}`} style={{ gap: 6 }}>
        <span className={m.chip}>{junior.age} años</span>
        <span className={m.chip}>{junior.profile}</span>
      </span>
      <span className={m.paceRow} title={`Ritmo ${pace}; puede llegar a ${potential}`}>
        <span className={m.paceTrack} role="img" aria-label={`Ritmo ${pace}, potencial ${potential}`}>
          <i className={m.pacePotential} style={{ width: `${paceAt(potential)}%` }} />
          <i className={m.paceNow} style={{ width: `${paceAt(pace)}%` }} />
        </span>
        <span className={m.num}><b>{pace}</b> → {potential}</span>
      </span>
      <span className={m.muted}>{formatMoney(seasonSalary(junior.salary))} por temporada</span>
    </>
  );
}

interface Props {
  academy: AcademyState;
  contracts: ContractsState;
  teamId: string;
  season: number;
  round: number;
  /** Asiento que ocupa el reserva en la próxima ronda, o null para que corran los dos titulares. */
  onStandIn: (seatId: string | null) => void;
  onSignReserve: (juniorId: string) => void;
  /** Sube al reserva a titular para la temporada siguiente. */
  onPromote: () => void;
  message?: string | null;
}

/**
 * [T4.8] Reserva del equipo y cantera: la tarjeta del reserva con su botón de sustitución (ocupa el asiento de un
 * titular en la próxima ronda, y solo en esa), el ascenso a titular cuando se abre la negociación, y los jóvenes libres
 * por si el director prefiere apoyar a otro. El reserva va a la izquierda y los jóvenes, como fichas, a su derecha.
 */
export function ReservePanel({ academy, contracts, teamId, season, round, onStandIn, onSignReserve, onPromote, message }: Props) {
  const reserve = reserveOf(academy, teamId);
  const roster = rosterOf(contracts);
  const seat = academy.standIns[teamId];
  const promoted = reserve ? contracts.agreed[reserve.driver.id] : undefined;
  const canPromote = Boolean(reserve) && !promoted && negotiationOpen(round) && seatsTaken(contracts, season, teamId) < 2;
  return (
    <section className={`${m.card} ${m.academy}`} aria-label="Reserva y cantera">
      <div className={m.stack}>
      <span className={m.label}>Reserva</span>
      {reserve && (
        <div className={m.stack}>
          <div className={m.row}>
            <Helmet teamId={teamId} number={reserve.driver.number} size={40} />
            <span className={m.juniorName}>{reserve.driver.firstName} {reserve.driver.lastName}</span>
          </div>
          <Facts junior={reserve} />
          <span className={promoted || isReady(reserve) ? m.pos : m.dim}>
            {promoted ? `Será titular desde la temporada que viene, hasta la temporada ${promoted.until}`
              : `${reserve.experience} ${reserve.experience === 1 ? 'carrera' : 'carreras'} como sustituto${isReady(reserve) ? ' · listo para un asiento' : ''}`}
          </span>
          <div className={`${m.row} ${m.wrap}`}>
            {seat
              ? <><span className={m.warn}>Sustituye a {(DRIVERS[seat] ?? roster[seat])?.lastName ?? seat} en la próxima ronda</span><button type="button" className={m.button} onClick={() => onStandIn(null)}>Deshacer</button></>
              : pairOf(contracts, teamId).map(id => (
                <button key={id} type="button" className={m.button} onClick={() => onStandIn(id)}>Sustituir a {roster[id]?.lastName ?? id}</button>
              ))}
            {canPromote && <button type="button" className={m.button} onClick={onPromote}>Subir a titular la temporada que viene</button>}
          </div>
        </div>
      )}
      {message && <span className={m.muted} role="status">{message}</span>}
      <details className={m.hint}>
        <summary>Cómo funciona el reserva</summary>
        La sustitución vale para una ronda (sprint incluido) y es el único cambio de piloto durante la temporada. Un reserva mejora poco a poco, y más cuando corre; a los {ACADEMY.MAX_AGE} años deja la cantera.
      </details>
      </div>
      <div className={m.stack}>
        <span className={m.label}>Jóvenes libres</span>
        <div className={m.juniorGrid}>
          {freeJuniors(academy).map(junior => (
            <div key={junior.driver.id} className={m.juniorCard}>
              <span className={m.juniorName}>{junior.driver.firstName} {junior.driver.lastName}</span>
              <Facts junior={junior} />
              <button type="button" className={m.button} onClick={() => onSignReserve(junior.driver.id)}>Fichar como reserva</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
