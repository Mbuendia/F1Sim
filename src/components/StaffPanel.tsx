import { Clock, UserPlus } from 'lucide-react';
import { ROLE_EFFECT, ROLE_LABEL, STAFF, STAFF_ROLES, initials, roundStaffSalaries } from '../simulation/Staff';
import type { StaffMember, StaffRole, StaffState } from '../simulation/Staff';
import { formatMoney } from '../simulation/Finance';
import { Pips } from './FacilitiesPanel';
import { Chip } from './ui/Tile';
import m from './Management.module.css';

const roleName = (role: StaffRole, drivers: string[]) =>
  role === 'ingeniero-1' ? `Ingeniero de carrera · ${drivers[0] ?? 'primer piloto'}` : role === 'ingeniero-2' ? `Ingeniero de carrera · ${drivers[1] ?? 'segundo piloto'}` : ROLE_LABEL[role];

/**
 * [T4.5] Personal técnico en la pestaña «Equipo»: quién ocupa cada puesto (con una insignia de sus iniciales y su
 * nivel), los fichajes que están por llegar y el mercado de la temporada. Sin fotos ni nombres reales.
 */
export function StaffPanel({ state, teamId, round, drivers, onHire }: {
  state: StaffState;
  teamId: string;
  /** Ronda que toca: un fichaje llega unas rondas después. */
  round: number;
  /** Códigos de los dos pilotos, para nombrar a cada ingeniero de carrera. */
  drivers: string[];
  onHire: (memberId: string) => void;
}) {
  const team = state.teams[teamId] ?? { members: {}, incoming: [] };
  const pending = (role: StaffRole) => team.incoming.find(entry => entry.member.role === role);
  return (
    <section className={`${m.card} ${m.stack}`} aria-label="Personal técnico">
      <span className={m.label}>Plantilla · sueldos del personal fichado: {formatMoney(roundStaffSalaries(state, teamId))} por ronda</span>
      <div className={m.staffGrid}>
        {STAFF_ROLES.map(role => {
          const member = team.members[role], incoming = pending(role);
          return (
            <div key={role} className={m.staffCard} data-role={role} title={ROLE_EFFECT[role]}>
              <span className={m.staffBadge} aria-hidden="true">{member ? initials(member.name) : 'CA'}</span>
              <span className={m.staffBody}>
                <b>{roleName(role, drivers)}</b>
                <span className={m.muted}>{member ? `${member.name} · hasta la temporada ${member.until}` : 'Personal de la casa'}</span>
                <Pips level={member?.level ?? STAFF.HOUSE_LEVEL} />
                {incoming && <Chip tone="warn" icon={<Clock size={14} aria-hidden="true" />}>Llega {incoming.member.name} (nivel {incoming.member.level}) en la ronda {incoming.arrivesRound}</Chip>}
              </span>
            </div>
          );
        })}
      </div>
      <span className={m.label}>Mercado de la temporada · un fichaje se incorpora {STAFF.NOTICE_ROUNDS} rondas después</span>
      {state.market.length === 0 && <span className={m.dim}>No queda nadie en el mercado esta temporada.</span>}
      <div className={m.staffGrid}>
        {state.market.map((candidate: StaffMember) => (
          <div key={candidate.id} className={m.staffCard} data-candidate={candidate.id} title={ROLE_EFFECT[candidate.role]}>
            <span className={m.staffBadge} aria-hidden="true">{initials(candidate.name)}</span>
            <span className={m.staffBody}>
              <b>{candidate.name}</b>
              <span className={m.muted}>{roleName(candidate.role, drivers)} · {formatMoney(candidate.salary)} por temporada</span>
              <Pips level={candidate.level} />
              <button type="button" className={m.button} disabled={Boolean(pending(candidate.role))} onClick={() => onHire(candidate.id)}
                title={pending(candidate.role) ? 'Ya hay un fichaje en camino para ese puesto' : `Se incorpora en la ronda ${round + STAFF.NOTICE_ROUNDS}`}>
                <UserPlus size={15} aria-hidden="true" /> Fichar
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
