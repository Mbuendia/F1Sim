import { DRIVERS } from '../data/drivers';
import { ACADEMY, freeJuniors, isReady, reserveOf } from '../simulation/Academy';
import type { AcademyState, Junior } from '../simulation/Academy';
import { negotiationOpen, pairOf, rosterOf, seasonSalary, seatsTaken } from '../simulation/Contracts';
import type { ContractsState } from '../simulation/Contracts';
import { formatMoney } from '../simulation/Finance';
import { Helmet } from './DriverContractsPanel';
import m from './Management.module.css';

const hundred = (value: number) => Math.round(value * 100);

/** Lo que se sabe de un joven, en una línea: edad, perfil, ritmo de hoy y hasta dónde puede llegar. */
function Facts({ junior }: { junior: Junior }) {
  return (
    <span className={m.muted}>
      {junior.age} años · {junior.profile} · ritmo {hundred(junior.driver.talentRating)} (potencial {hundred(junior.potential)}) · {formatMoney(seasonSalary(junior.salary))} por temporada
    </span>
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
 * por si el director prefiere apoyar a otro.
 */
export function ReservePanel({ academy, contracts, teamId, season, round, onStandIn, onSignReserve, onPromote, message }: Props) {
  const reserve = reserveOf(academy, teamId);
  const roster = rosterOf(contracts);
  const seat = academy.standIns[teamId];
  const promoted = reserve ? contracts.agreed[reserve.driver.id] : undefined;
  const canPromote = Boolean(reserve) && !promoted && negotiationOpen(round) && seatsTaken(contracts, season, teamId) < 2;
  return (
    <section className={`${m.card} ${m.stack}`} aria-label="Reserva y cantera">
      <span className={m.label}>Reserva</span>
      {reserve && (
        <div className={`${m.row} ${m.between} ${m.wrap}`}>
          <div className={m.row}>
            <Helmet teamId={teamId} number={reserve.driver.number} size={40} />
            <div className={m.stack} style={{ gap: 2 }}>
              <span className={m.title}>{reserve.driver.firstName} {reserve.driver.lastName}</span>
              <Facts junior={reserve} />
              <span className={promoted || isReady(reserve) ? m.pos : m.dim}>
                {promoted ? `Será titular desde la temporada que viene, hasta la temporada ${promoted.until}`
                  : `${reserve.experience} ${reserve.experience === 1 ? 'carrera' : 'carreras'} como sustituto${isReady(reserve) ? ' · listo para un asiento' : ''}`}
              </span>
            </div>
          </div>
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
      <span className={m.dim}>La sustitución vale para una ronda (sprint incluido) y es el único cambio de piloto durante la temporada. Un reserva mejora poco a poco, y más cuando corre; a los {ACADEMY.MAX_AGE} años deja la cantera.</span>
      <span className={m.label}>Jóvenes libres</span>
      {freeJuniors(academy).map(junior => (
        <div key={junior.driver.id} className={m.facility}>
          <b>{junior.driver.firstName} {junior.driver.lastName}</b>
          <button type="button" className={m.button} onClick={() => onSignReserve(junior.driver.id)}>Fichar como reserva</button>
          <Facts junior={junior} />
        </div>
      ))}
    </section>
  );
}
