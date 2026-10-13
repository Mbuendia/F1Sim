import { useEffect, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import { DEFAULT_CAREER_NAME, teamDifficulty } from '../simulation/Career';
import { initialLevel } from '../simulation/Facilities';
import { formatMoney, startBalance } from '../simulation/Finance';
import { SAVE_NAME_MAX } from '../simulation/SaveGame';
import { supportsWebGL } from './CarShowcase';
import { F1CarSilhouette } from './F1CarSilhouette';
import { Pips } from './FacilitiesPanel';
import s from './Screens.module.css';

/** Equipos ordenados del coche más rápido al más lento. */
const TEAM_ORDER = Object.values(TEAMS).sort((a, b) => b.carPerformance - a.carPerformance);

/**
 * [T4.19] Partida nueva: se elige equipo, no piloto. Diez tarjetas con el coche (el modelo 3D con su librea, de
 * perfil), sus dos pilotos, el saldo inicial, el nivel de sus instalaciones y la dificultad; nombre de la partida y
 * «Empezar».
 */
export function NewCareerScreen({ onStart, onBack }: { onStart: (teamId: string, name: string) => void; onBack: () => void }) {
  const [teamId, setTeamId] = useState('astonmartin');
  const [name, setName] = useState(DEFAULT_CAREER_NAME);
  // Retratos 3D de los diez coches: se generan una vez, bajo demanda; sin WebGL quedan las siluetas.
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!supportsWebGL()) return;
    let cancelled = false;
    import('../renderer/carPortraits3d').then(async ({ buildCarPortraits, carPortrait }) => {
      await buildCarPortraits(TEAM_ORDER.map(team => ({ id: team.id, number: DRIVERS[team.drivers[0]]?.number ?? 1 })), import.meta.env.BASE_URL);
      if (!cancelled) setPortraits(Object.fromEntries(TEAM_ORDER.map(team => [team.id, carPortrait(team.id) ?? ''])));
    }).catch(() => { /* sin modelo: se quedan las siluetas */ });
    return () => { cancelled = true; };
  }, []);
  const team = TEAMS[teamId];
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <button type="button" className={`${s.button} ${s.ghost}`} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Menú</button>
        <h1>Nueva carrera profesional · elige tu equipo</h1>
      </header>
      <div className={s.body}>
        <div className={s.teams}>
          {TEAM_ORDER.map(option => {
            const difficulty = teamDifficulty(option.id);
            return (
              <button key={option.id} type="button" className={s.team} data-team={option.id} style={{ ['--c' as string]: option.color }}
                aria-pressed={teamId === option.id} onClick={() => setTeamId(option.id)}>
                <span className={s.teamName}>{option.shortName}</span>
                <span className={s.car}>
                  {portraits[option.id]
                    ? <img src={portraits[option.id]} alt={`Monoplaza de ${option.shortName}`} />
                    : <F1CarSilhouette teamColor={option.color} width={200} label={`Monoplaza de ${option.shortName}`} />}
                </span>
                <span className={s.kv}><span>Pilotos</span><b>{option.drivers.map(id => DRIVERS[id]?.code ?? id).join(' · ')}</b></span>
                <span className={s.kv}><span>Saldo inicial</span><b>{formatMoney(startBalance(option.id))}</b></span>
                <span className={s.kv}><span>Instalaciones</span><Pips level={initialLevel(option.id)} /></span>
                <span className={s.kv}><span>Dificultad</span><b className={difficulty === 'Alta' ? s.warn : undefined}>{difficulty}</b></span>
              </button>
            );
          })}
        </div>
      </div>
      <footer className={s.foot}>
        <span className={s.muted}>Diriges a los dos pilotos de <b style={{ color: '#fff' }}>{team.shortName}</b>: {team.drivers.map(id => DRIVERS[id]?.lastName ?? id).join(' y ')}.</span>
        <span className={s.spacer} />
        <label className={s.row}>
          <span className={s.label}>Nombre de la partida</span>
          <input className={s.field} value={name} maxLength={SAVE_NAME_MAX} onChange={event => setName(event.target.value)} />
        </label>
        <button type="button" className={s.primary} onClick={() => onStart(teamId, name)}><Play size={16} fill="#fff" aria-hidden="true" />Empezar</button>
      </footer>
    </div>
  );
}
