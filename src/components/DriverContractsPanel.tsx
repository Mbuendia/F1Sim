import { useState } from 'react';
import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import { teamAccent } from '../data/teamAccents';
import { CONTRACTS, candidates, demandFor, driverValue, negotiationOpen, pairOf, rosterOf, seasonSalary, seatsTaken } from '../simulation/Contracts';
import type { ContractsState } from '../simulation/Contracts';
import { formatMoney } from '../simulation/Finance';
import m from './Management.module.css';

/** Casco del piloto con los colores de su equipo y su dorsal. Sin fotos ni parecidos. */
export function Helmet({ teamId, number, size = 52 }: { teamId: string; number: number; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={`Casco con el dorsal ${number}`}>
      <path d="M5 30C5 17 14 8 26 8s18 8 18 19v7c0 3-2 5-5 5H13c-5 0-8-4-8-9z" fill={TEAMS[teamId]?.color ?? '#888'} stroke="rgba(255,255,255,.3)" />
      <path d="M5 30C7 18 15 10 27 8 18 12 13 19 12 30z" fill={teamAccent(teamId)} opacity=".9" />
      <path d="M25 21h19v8H29c-3 0-4-2-4-4z" fill="#0b0e13" stroke="rgba(255,255,255,.4)" />
      <text x="17" y="38" fontSize="9" fontFamily="Orbitron, sans-serif" fontWeight="700" textAnchor="middle" fill="#fff" stroke="#000" strokeWidth=".4" paintOrder="stroke">{number}</text>
    </svg>
  );
}

const perSeason = (salary: number) => `${formatMoney(seasonSalary(salary))} por temporada`;

interface Props {
  contracts: ContractsState;
  teamId: string;
  season: number;
  /** Ronda que toca: la negociación se abre a mitad de temporada. */
  round: number;
  onOffer: (driverId: string, salary: number, seasons: number) => void;
  /** Respuesta a la última oferta. */
  message?: string | null;
  /** [T4.11] Edad de cada piloto en esta temporada. */
  ages?: Record<string, number>;
}

/**
 * [T4.7] Pilotos del equipo y sus contratos: una tarjeta por piloto (casco, dorsal, sueldo y hasta cuándo dura) y,
 * desde la mitad de la temporada, la negociación de la siguiente: renovar a quien acaba contrato u ofrecer el asiento
 * a un piloto de otro equipo. Lo firmado vale desde la primera ronda de la temporada que viene.
 */
export function DriverContractsPanel({ contracts, teamId, season, round, onOffer, message, ages }: Props) {
  const [seasons, setSeasons] = useState(2);
  const open = negotiationOpen(round);
  const full = seatsTaken(contracts, season, teamId) >= 2;
  const arriving = Object.keys(contracts.agreed).filter(id => contracts.agreed[id].teamId === teamId && contracts.contracts[id].teamId !== teamId);
  // [T4.8] La ficha sale de la plantilla: en la parrilla puede haber pilotos que no están en drivers.ts.
  const roster = rosterOf(contracts);
  const market = candidates(contracts, season, teamId).sort((a, b) => driverValue(b, contracts) - driverValue(a, contracts));
  return (
    <section className={m.stack} aria-label="Pilotos y contratos">
      <div className={m.reportCars}>
        {pairOf(contracts, teamId).map(id => {
          const driver = roster[id], contract = contracts.contracts[id], renewed = contracts.agreed[id];
          const ends = contract.until <= season;
          const demand = demandFor(contracts, id, teamId);
          return (
            <div key={id} className={`${m.card} ${m.reportCar}`}>
              <div className={m.row}>
                <Helmet teamId={teamId} number={driver.number} />
                <div className={m.stack} style={{ gap: 2 }}>
                  <span className={m.title}>{driver.firstName} {driver.lastName}</span>
                  <span className={m.muted}>{ages?.[id] ? `${ages[id]} años · ` : ''}{perSeason(contract.salary)}</span>
                  <span className={renewed ? m.pos : ends ? m.warn : m.muted}>
                    {renewed ? (renewed.teamId === teamId ? `Renovado hasta la temporada ${renewed.until}` : `Se va a ${TEAMS[renewed.teamId]?.shortName ?? renewed.teamId}`)
                      : ends ? 'Vence esta temporada' : `Hasta la temporada ${contract.until}`}
                  </span>
                </div>
              </div>
              {open && ends && !renewed && !full && demand !== null && (
                <button type="button" className={m.button} onClick={() => onOffer(id, demand, seasons)}>Renovar · pide {perSeason(demand)}</button>
              )}
            </div>
          );
        })}
      </div>
      {arriving.map(id => (
        <span key={id} className={m.pos}>
          Fichado para la temporada que viene: {(roster[id] ?? DRIVERS[id])?.firstName} {(roster[id] ?? DRIVERS[id])?.lastName}, {perSeason(contracts.agreed[id].salary)}, hasta la temporada {contracts.agreed[id].until}.
        </span>
      ))}
      {message && <span className={m.muted} role="status">{message}</span>}
      {!open && <span className={m.dim}>La negociación de la temporada que viene se abre en la ronda {CONTRACTS.NEGOTIATION_ROUND}. Durante la temporada no hay fichajes entre equipos.</span>}
      {open && full && <span className={m.dim}>Los dos asientos de la temporada que viene están ocupados.</span>}
      {open && !full && (
        <div className={`${m.card} ${m.stack}`}>
          <div className={`${m.row} ${m.between} ${m.wrap}`}>
            <span className={m.label}>Mercado · pilotos que acaban contrato</span>
            <div className={m.segmented} role="group" aria-label="Duración del contrato que se propone">
              {Array.from({ length: CONTRACTS.MAX_SEASONS }, (_, i) => i + 1).map(count => (
                <button key={count} type="button" aria-pressed={seasons === count} onClick={() => setSeasons(count)}>{count} {count === 1 ? 'temporada' : 'temporadas'}</button>
              ))}
            </div>
          </div>
          <div className={m.ledger}>
            {market.map(id => {
              const driver = roster[id], demand = demandFor(contracts, id, teamId);
              return (
                <div key={id} className={m.facility}>
                  <div className={m.row}>
                    <Helmet teamId={contracts.contracts[id].teamId} number={driver.number} size={28} />
                    <b>{driver.firstName} {driver.lastName}</b>
                    <span className={m.muted}>{TEAMS[contracts.contracts[id].teamId]?.shortName}{ages?.[id] ? ` · ${ages[id]} años` : ''}</span>
                  </div>
                  {demand !== null
                    ? <button type="button" className={m.button} onClick={() => onOffer(id, demand, seasons)}>Ofrecer</button>
                    : <span className={m.dim}>No quiere venir</span>}
                  <span className={m.muted}>{demand !== null ? `Pide ${perSeason(demand)}` : 'No correría en un equipo de este nivel'}</span>
                </div>
              );
            })}
            {market.length === 0 && <span className={m.dim}>Ningún piloto de otro equipo acaba contrato esta temporada.</span>}
          </div>
        </div>
      )}
    </section>
  );
}
