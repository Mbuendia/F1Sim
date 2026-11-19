import { useEffect, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { calendarFor, DEFAULT_SEASON_YEAR, fastestLapPoint, SEASON_YEARS } from '../data/calendar';
import { DRIVERS } from '../data/drivers';
import { driverSheetFor, lineupFor, teamFormFor } from '../data/seasons';
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

/** [TL3] Retrato de cada equipo un año: su primer piloto de entonces y la clave del retrato (equipo y año). */
function portraitsFor(year: number): { id: string; number: number; key: string }[] {
  const lineup = lineupFor(year);
  return TEAM_ORDER.map(team => {
    const first = Object.keys(lineup).find(id => lineup[id] === team.id);
    return { id: team.id, number: (first && driverSheetFor(first, year)?.number) || (DRIVERS[team.drivers[0]]?.number ?? 1), key: `${team.id}-${year}` };
  });
}

/** [TL2] Lo que dice la tarjeta de un equipo el año elegido: sus pilotos, su dificultad y su motor. */
export function teamCard(teamId: string, year: number): { drivers: string[]; names: string[]; difficulty: 'Baja' | 'Media' | 'Alta'; engine: string } {
  const lineup = lineupFor(year);
  const ids = Object.keys(lineup).filter(id => lineup[id] === teamId);
  return {
    drivers: ids.map(id => driverSheetFor(id, year)?.code ?? id), names: ids.map(id => driverSheetFor(id, year)?.lastName ?? id),
    difficulty: teamDifficulty(teamId, year), engine: teamFormFor(year)[teamId]?.engineManufacturer ?? TEAMS[teamId].engineManufacturer,
  };
}

/**
 * [T4.19] Partida nueva: se elige equipo, no piloto. Diez tarjetas con el coche (el modelo 3D con su librea, de
 * perfil), sus dos pilotos, el saldo inicial, el nivel de sus instalaciones y la dificultad; nombre de la partida y
 * «Empezar».
 */
export function NewCareerScreen({ onStart, onBack }: { onStart: (teamId: string, name: string, startYear: number) => void; onBack: () => void }) {
  const [teamId, setTeamId] = useState('astonmartin');
  // [TL1] Año en que empieza la carrera: cada temporada tiene el calendario de su año.
  const [startYear, setStartYear] = useState<number>(DEFAULT_SEASON_YEAR);
  const [name, setName] = useState(DEFAULT_CAREER_NAME);
  // Retratos 3D de los diez coches: se generan una vez por año, bajo demanda; sin WebGL quedan las siluetas.
  // [TL3] Cada año, con la librea de ese año.
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!supportsWebGL()) return;
    let cancelled = false;
    const form = teamFormFor(startYear);
    const jobs = portraitsFor(startYear).map(job => ({ ...job, livery: form[job.id]?.livery, year: startYear }));
    import('../renderer/carPortraits3d').then(async ({ buildCarPortraits, carPortrait }) => {
      await buildCarPortraits(jobs, import.meta.env.BASE_URL);
      if (!cancelled) setPortraits(Object.fromEntries(jobs.map(job => [job.id, carPortrait(job.id, job.key) ?? ''])));
    }).catch(() => { /* sin modelo: se quedan las siluetas */ });
    return () => { cancelled = true; };
  }, [startYear]);
  const team = TEAMS[teamId];
  return (
    <div className={s.screen} style={{ ['--c' as string]: team.color }}>
      <header className={s.head}>
        <button type="button" className={`${s.button} ${s.ghost}`} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Menú</button>
        <h1>Nueva carrera profesional · elige tu equipo</h1>
      </header>
      <div className={s.body}>
        <div className={s.teams}>
          {TEAM_ORDER.map(option => {
            const card = teamCard(option.id, startYear), difficulty = card.difficulty;
            return (
              <button key={option.id} type="button" className={s.team} data-team={option.id} style={{ ['--c' as string]: option.color }}
                aria-pressed={teamId === option.id} onClick={() => setTeamId(option.id)}>
                <span className={s.teamName}>{option.shortName}</span>
                <span className={s.car}>
                  {portraits[option.id]
                    ? <img src={portraits[option.id]} alt={`Monoplaza de ${option.shortName}`} />
                    : <F1CarSilhouette teamColor={option.color} width={200} label={`Monoplaza de ${option.shortName}`} />}
                </span>
                <span className={s.kv}><span>Pilotos</span><b>{card.drivers.join(' · ')}</b></span>
                <span className={s.kv}><span>Motor</span><b>{card.engine}</b></span>
                <span className={s.kv}><span>Saldo inicial</span><b>{formatMoney(startBalance(option.id))}</b></span>
                <span className={s.kv}><span>Instalaciones</span><Pips level={initialLevel(option.id)} /></span>
                <span className={s.kv}><span>Dificultad</span><b className={difficulty === 'Alta' ? s.warn : undefined}>{difficulty}</b></span>
              </button>
            );
          })}
        </div>
        {/* [TL1] Año de inicio: cuatro botones (sin desplegable), cada uno con sus rondas y su reglamento. */}
        <fieldset className={s.years} aria-label="Temporada de inicio">
          <legend className={s.label}>Temporada de inicio</legend>
          <div className={s.yearList}>
            {SEASON_YEARS.map(year => (
              <label key={year} className={s.year} data-year={year}>
                <input type="radio" name="start-year" value={year} checked={startYear === year} onChange={() => setStartYear(year)} />
                <span className={s.yearNumber}>{year}{year === DEFAULT_SEASON_YEAR && <small>actual</small>}</span>
                <span className={s.yearNote}>{calendarFor(year).length} rondas · 6 sprints</span>
                <span className={s.yearNote}>{fastestLapPoint(year) ? 'Vuelta rápida: +1 punto' : 'Vuelta rápida: sin punto'}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <footer className={s.foot}>
        <span className={s.muted}>Diriges a los dos pilotos de <b style={{ color: '#fff' }}>{team.shortName}</b>: {teamCard(teamId, startYear).names.join(' y ')}, desde {startYear}.</span>
        <span className={s.spacer} />
        <label className={`${s.row} ${s.nameRow}`}>
          <span className={s.label}>Nombre de la partida</span>
          <input className={s.field} value={name} maxLength={SAVE_NAME_MAX} onChange={event => setName(event.target.value)} />
        </label>
        <button type="button" className={s.primary} onClick={() => onStart(teamId, name, startYear)}><Play size={16} fill="#fff" aria-hidden="true" />Empezar</button>
      </footer>
    </div>
  );
}
