import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Flag, FolderOpen, LogIn, Play, PlusCircle, Settings, Trophy, Users } from 'lucide-react';
import { TEAMS } from '../data/teams';
import { menuOptions } from '../simulation/Career';
import { formatMoney } from '../simulation/Finance';
import type { SlotSummary } from '../simulation/SaveGame';
import { SEASON_RACES } from '../simulation/Season';
import s from './Screens.module.css';

/** Estado de una partida en una línea: ronda, puesto en constructores y saldo. */
export function slotStatus(slot: SlotSummary): string {
  const parts = [`Ronda ${slot.raceNumber} de ${SEASON_RACES}`];
  if (slot.position) parts.push(`P${slot.position} en constructores`);
  if (slot.balance !== undefined) parts.push(`${slot.balance < 0 ? 'deuda' : 'saldo'} ${formatMoney(Math.abs(slot.balance))}`);
  return parts.join(' · ');
}

type Mode = 'continuar' | 'temporada' | 'libre' | 'multijugador';

/** Color de cada modo: tiñe la franja del corte, el brillo del panel y la tarjeta elegida. */
const ACCENT: Record<Exclude<Mode, 'continuar'>, string> = { temporada: '#e10600', libre: '#38bdf8', multijugador: '#a78bfa' };
const image = (mode: Mode) => `${import.meta.env.BASE_URL ?? '/'}menu/${mode}.webp`;

interface Panel {
  id: Mode;
  card: string;
  cardNote: string;
  icon: ReactNode;
  kicker: string;
  title: string;
  lines: ReactNode[];
  actions: ReactNode;
  accent: string;
}

/**
 * [UX1] Pantalla de juego, tras pulsar «Jugar» en la portada (opción B elegida por el usuario el 26/10/2026): un panel
 * grande con la imagen del modo cortada en diagonal y su información (en «Continuar», el equipo, la temporada y la
 * próxima ronda), y debajo una fila de tarjetas para elegir. La tarjeta elegida se ilumina y el panel cambia con una
 * cortinilla en diagonal; en el escritorio basta con pasar por encima. Sin partida en curso, el panel empieza en
 * «Temporada» con su botón principal enfocado. Antes ([T4.19]) era una lista de botones.
 */
export function GameMenuScreen({ current = null, slots = [], onContinue, onNew, onLoad, onFree, onCreateRoom, onJoinRoom, onSettings }: {
  current?: SlotSummary | null;
  slots?: SlotSummary[];
  onContinue: () => void;
  onNew: () => void;
  onLoad: () => void;
  onFree: () => void;
  onCreateRoom?: () => void;
  onJoinRoom?: () => void;
  onSettings?: () => void;
}) {
  const options = menuOptions(current, slots);
  const hasCurrent = Boolean(current && options.includes('continuar'));
  const multiplayer = Boolean(onCreateRoom || onJoinRoom);
  const teamColor = (current && TEAMS[current.team?.id ?? '']?.color) || '#e10600';
  const saves = `${slots.length} ${slots.length === 1 ? 'guardada' : 'guardadas'}`;
  const inRace = current?.raceInProgress && !current.raceInProgress.finished ? current.raceInProgress : null;

  const panels: Panel[] = [];
  if (hasCurrent && current) panels.push({
    id: 'continuar', card: 'Continuar', cardNote: current.team?.name ?? 'Partida en curso', icon: <Play size={18} aria-hidden="true" />,
    kicker: 'Partida en curso', title: current.team?.name ?? 'Tu equipo', accent: teamColor,
    lines: [
      `Temporada ${current.season ?? 1} · ${slotStatus(current)}`,
      `«${current.name}»${inRace ? ` · en carrera: vuelta ${inRace.lap} de ${inRace.totalLaps}` : ''}`,
    ],
    actions: (
      <>
        <button type="button" className={s.primary} onClick={onContinue} data-main><Play size={16} fill="#fff" aria-hidden="true" />Continuar</button>
        {options.includes('cargar') && <button type="button" className={s.heroSecondary} onClick={onLoad}><FolderOpen size={16} aria-hidden="true" />Cargar partida · {saves}</button>}
      </>
    ),
  });
  panels.push({
    id: 'temporada', card: 'Temporada', cardNote: hasCurrent ? 'nueva o guardada' : 'empieza aquí', icon: <Trophy size={18} aria-hidden="true" />,
    kicker: hasCurrent ? 'Carrera profesional' : 'Empieza aquí', title: 'Temporada', accent: ACCENT.temporada,
    lines: [
      `Eliges equipo y diriges ${SEASON_RACES} grandes premios: el coche, los pilotos, la sede y el dinero.`,
      hasCurrent ? 'Tu partida en curso sigue guardada.' : 'La carrera libre sirve para probar el muro sin jugarte nada.',
    ],
    actions: (
      <>
        <button type="button" className={s.primary} onClick={onNew} data-main><PlusCircle size={16} aria-hidden="true" />Nueva carrera profesional</button>
        {options.includes('cargar') && !hasCurrent && <button type="button" className={s.heroSecondary} onClick={onLoad}><FolderOpen size={16} aria-hidden="true" />Cargar partida · {saves}</button>}
      </>
    ),
  });
  panels.push({
    id: 'libre', card: 'Carrera libre', cardNote: 'una carrera suelta', icon: <Flag size={18} aria-hidden="true" />,
    kicker: 'Sin compromiso', title: 'Carrera libre', accent: ACCENT.libre,
    lines: ['Eliges circuito, formato y equipo, y corres una carrera.', 'No cuenta para ninguna partida.'],
    actions: <button type="button" className={s.primary} onClick={onFree} data-main><Flag size={16} aria-hidden="true" />Elegir circuito</button>,
  });
  if (multiplayer) panels.push({
    id: 'multijugador', card: 'Multijugador', cardNote: 'carrera con amigos', icon: <Users size={18} aria-hidden="true" />,
    kicker: 'Con amigos', title: 'Multijugador', accent: ACCENT.multijugador,
    lines: ['Cada uno lleva su equipo desde su dispositivo; tu ordenador hace de servidor.', 'Comparte el código o el enlace de la sala.'],
    actions: (
      <>
        {onCreateRoom && <button type="button" className={s.primary} onClick={onCreateRoom} data-main><Users size={16} aria-hidden="true" />Crear sala</button>}
        {onJoinRoom && <button type="button" className={s.heroSecondary} onClick={onJoinRoom}><LogIn size={16} aria-hidden="true" />Unirse a una sala</button>}
      </>
    ),
  });

  const ids = panels.map(p => p.id);
  const [selected, setSelected] = useState<Mode>(ids[0]);
  const [leaving, setLeaving] = useState<Mode | null>(null);
  const shown = ids.includes(selected) ? selected : ids[0];
  const hoverTimer = useRef<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);

  const select = (next: Mode) => {
    if (next === shown) return;
    setLeaving(shown);
    setSelected(next);
    // En el móvil, si el panel grande no se ve entero, se sube hasta él para que se vea el cambio.
    const hero = heroRef.current;
    if (hero && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches && hero.getBoundingClientRect().top < 0) {
      hero.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };
  // La cortinilla dura 600 ms: después, el panel que sale se esconde del todo.
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), 620);
    return () => window.clearTimeout(t);
  }, [leaving, shown]);
  useEffect(() => () => { if (hoverTimer.current) window.clearTimeout(hoverTimer.current); }, []);
  // Sin partida en curso, el botón principal del primer panel queda enfocado: «Enter» empieza a jugar.
  useEffect(() => {
    if (!hasCurrent) heroRef.current?.querySelector<HTMLButtonElement>('[data-state="active"] [data-main]')?.focus({ preventScroll: true });
  }, [hasCurrent]);

  const act = (mode: Mode) => heroRef.current?.querySelector<HTMLButtonElement>(`[data-panel="${mode}"] [data-main]`)?.click();
  const onCardKey = (event: KeyboardEvent<HTMLButtonElement>, mode: Mode) => {
    const index = ids.indexOf(mode);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = ids[(index + step + ids.length) % ids.length];
    select(next);
    (event.currentTarget.parentElement?.parentElement?.querySelector<HTMLButtonElement>(`[data-card="${next}"]`))?.focus();
  };
  const card = (p: Panel) => (
    <button key={p.id} type="button" className={s.modeCard} data-card={p.id} aria-pressed={p.id === shown}
      style={{ ['--acento' as string]: p.accent, ['--img' as string]: `url("${image(p.id)}")` } as CSSProperties}
      onClick={() => (p.id === shown ? act(p.id) : select(p.id))}
      // Con el teclado (Tab), enfocar ya elige; al tocar o hacer clic, no: el primer toque elige (y se ve el cambio) y el
      // segundo hace la acción. Antes el foco elegía y el mismo toque ejecutaba al momento, sin animación.
      onFocus={event => { if (event.currentTarget.matches(':focus-visible')) select(p.id); }}
      onPointerEnter={event => {
        if (event.pointerType !== 'mouse') return;
        if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => select(p.id), 90);
      }}
      onPointerLeave={() => { if (hoverTimer.current) window.clearTimeout(hoverTimer.current); }}
      onKeyDown={event => onCardKey(event, p.id)}>
      <span className={s.modeCardImage} aria-hidden="true" />
      <span className={s.modeCardText}>
        <span className={s.modeCardTitle}>{p.icon}<span>{p.card}</span></span>
        <small>{p.cardNote}</small>
      </span>
    </button>
  );
  const accent = panels.find(p => p.id === shown)?.accent ?? ACCENT.temporada;
  const jugar = panels.filter(p => p.id !== 'continuar');

  return (
    <div className={s.screen}>
      <div className={s.menu} style={{ ['--acento' as string]: accent } as CSSProperties} data-first-time={hasCurrent ? undefined : 'true'}>
        <header className={s.menuTop}>
          <div className={s.brand}>F-UNO <em>RACE</em> MANAGER</div>
          {onSettings && <button type="button" className={s.menuTopSettings} onClick={onSettings} aria-label="Ajustes"><Settings size={20} aria-hidden="true" /></button>}
        </header>

        <section ref={heroRef} className={s.hero} aria-label="Modo elegido" aria-live="polite">
          {panels.map(p => {
            const state = p.id === shown ? 'active' : p.id === leaving ? 'leaving' : 'idle';
            return (
              <article key={p.id} className={s.heroPanel} data-panel={p.id} data-state={state} aria-hidden={state !== 'active'}
                inert={state !== 'active' ? true : undefined} style={{ ['--acento' as string]: p.accent, ['--img' as string]: `url("${image(p.id)}")` } as CSSProperties}>
                <div className={s.heroImage} aria-hidden="true"><span /></div>
                <div className={s.heroStripe} aria-hidden="true" />
                <div className={s.heroWord} aria-hidden="true">{p.title}</div>
                <div className={s.heroText}>
                  <p className={s.heroKicker} style={{ ['--i' as string]: 0 } as CSSProperties}>{p.kicker}</p>
                  <h2 className={s.heroTitle} style={{ ['--i' as string]: 1 } as CSSProperties}>{p.title}</h2>
                  {p.lines.map((line, i) => <p key={i} className={s.heroLine} style={{ ['--i' as string]: 2 + i } as CSSProperties}>{line}</p>)}
                  <div className={s.heroActions} style={{ ['--i' as string]: 2 + p.lines.length } as CSSProperties}>{p.actions}</div>
                </div>
              </article>
            );
          })}
        </section>

        <nav className={s.modeCards} aria-label="Modos de juego" data-count={panels.length + (onSettings ? 1 : 0)}>
          {hasCurrent && <div className={s.modeBlock} data-block="continuar">{card(panels[0])}</div>}
          <div className={s.modeBlock} data-block="jugar">{jugar.map(card)}</div>
          <div className={s.modeBlock} data-block="ajustes">
            <button type="button" className={s.settingsCard} onClick={onSettings} disabled={!onSettings}>
              <Settings size={22} aria-hidden="true" /><span>Ajustes</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
