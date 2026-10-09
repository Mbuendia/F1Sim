import type { ReactNode } from 'react';
import { CalendarDays, Factory, Flag, Home, Users, Wallet } from 'lucide-react';
import { HUB_SECTIONS } from '../simulation/Hub';
import type { HubSection } from '../simulation/Hub';
import { SEASON_RACES } from '../simulation/Season';
import m from './Management.module.css';

const ICONS: Record<HubSection, typeof Home> = { inicio: Home, equipo: Users, fabrica: Factory, finanzas: Wallet, temporada: CalendarDays, correr: Flag };

/**
 * [T4.3] Cabecera del centro de gestión: equipo, temporada y ronda, cifras de estado, lo que vaya a la derecha (el
 * menú «Partida») y las pestañas en su orden, con «Correr» la última y en rojo. `badges` es el número de pendientes
 * de cada pestaña.
 */
export function HubHeader({ teamName, seasonNumber, round, kpis, section, onSection, badges = {}, children }: {
  teamName: string;
  seasonNumber: number;
  /** Ronda que toca, o null con la temporada completa. */
  round: number | null;
  kpis: { label: string; value: string }[];
  section: HubSection;
  onSection: (section: HubSection) => void;
  badges?: Partial<Record<HubSection, number>>;
  children?: ReactNode;
}) {
  return (
    <header className={m.hubHeader}>
      <div className={m.hubBar}>
        <span className={m.hubTeam}>{teamName}</span>
        <span className={m.chip}>Temporada {seasonNumber}{round ? ` · ronda ${round} de ${SEASON_RACES}` : ' · completa'}</span>
        <span className={m.hubSpacer} />
        {kpis.map(kpi => <span key={kpi.label} className={m.kpi}><b>{kpi.value}</b><span>{kpi.label}</span></span>)}
        {children}
      </div>
      <nav className={m.hubTabs} role="tablist" aria-label="Secciones del centro de gestión">
        {HUB_SECTIONS.map(([id, label]) => {
          const Icon = ICONS[id];
          return (
            <button key={id} type="button" role="tab" className={id === 'correr' ? m.hubTabRace : undefined} aria-selected={section === id} onClick={() => onSection(id)}>
              <Icon size={16} aria-hidden="true" />{label}{badges[id] ? <span className={m.badge} title={`${badges[id]} pendiente${badges[id] === 1 ? '' : 's'}`}>{badges[id]}</span> : null}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
