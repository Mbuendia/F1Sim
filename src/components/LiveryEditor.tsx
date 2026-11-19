// [TL5, 19/11/2026] Editor de tu librea: el coche en 3D girando y, al lado, la plantilla, los tres colores, el color del
// dorsal y el patrocinador de cada hueco (de los que ha firmado tu equipo). Se abre al crear la carrera profesional (con
// un paso que se puede saltar) y en la pretemporada.
import { useEffect, useMemo, useState } from 'react';
import Car3DViewer from './Car3DViewer';
import { LIVERY_SLOTS, LIVERY_TEMPLATES, SLOT_LABEL, liveryWarnings, playerSeasonLivery, type LiverySlot, type PlayerLivery } from '../data/playerLivery';
import styles from './LiveryEditor.module.css';

interface Props {
  teamId: string;
  year: number;
  number: number;
  /** Patrocinadores firmados por el equipo (los únicos que se pueden poner). */
  sponsors: readonly string[];
  value: PlayerLivery;
  onSave: (livery: PlayerLivery) => void;
  /** Sin tocar nada (al crear la carrera: «Saltar»; en la pretemporada: «Cancelar»). */
  onSkip: () => void;
  skipLabel?: string;
}

const COLOR_NAMES = ['Principal', 'Secundario', 'Acento'] as const;

export default function LiveryEditor({ teamId, year, number, sponsors, value, onSave, onSkip, skipLabel = 'Saltar' }: Props) {
  const [draft, setDraft] = useState<PlayerLivery>(value);
  // El coche 3D se repinta un momento después del último cambio (los selectores de color mandan muchos).
  const [shown, setShown] = useState<PlayerLivery>(value);
  useEffect(() => { const t = setTimeout(() => setShown(draft), 220); return () => clearTimeout(t); }, [draft]);
  const livery = useMemo(() => playerSeasonLivery(shown, teamId, year), [shown, teamId, year]);
  const warnings = liveryWarnings(draft);
  const signed = sponsors.filter(Boolean);
  const setColor = (i: number, c: string) => setDraft(d => ({ ...d, colors: d.colors.map((x, k) => (k === i ? c : x)) as PlayerLivery['colors'] }));
  const setSlot = (slot: LiverySlot, name: string) => setDraft(d => {
    const slots = { ...d.slots };
    if (name) slots[slot] = name; else delete slots[slot];
    return { ...d, slots };
  });

  return (
    <section className={styles.editor} aria-label="Editor de tu librea">
      <div className={styles.preview}>
        <Car3DViewer teamColor={livery.primary} accentColor={livery.secondary} number={number} compound="medium" teamId={teamId}
          livery={livery} year={year} label="Tu coche con la librea elegida" />
      </div>
      <div className={styles.controls}>
        <fieldset className={styles.group}>
          <legend>Plantilla</legend>
          <div className={styles.templates} role="radiogroup" aria-label="Plantilla">
            {LIVERY_TEMPLATES.map(t => (
              <button key={t.id} type="button" role="radio" aria-checked={draft.template === t.id} className={styles.template}
                title={t.inspiredBy} onClick={() => setDraft(d => ({ ...d, template: t.id }))}>{t.name}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>Colores</legend>
          <div className={styles.colors}>
            {COLOR_NAMES.map((name, i) => (
              <label key={name} className={styles.color}>
                <input type="color" value={draft.colors[i]} onChange={e => setColor(i, e.target.value)} aria-label={`Color ${name.toLowerCase()}`} />
                {name}
              </label>
            ))}
            <label className={styles.color}>
              <input type="color" value={draft.numberColor} onChange={e => setDraft(d => ({ ...d, numberColor: e.target.value }))} aria-label="Color del dorsal" />
              Dorsal
            </label>
          </div>
          {warnings.length > 0 && <p className={styles.warning} role="status">{warnings.join(' · ')}</p>}
        </fieldset>
        <fieldset className={styles.group}>
          <legend>Patrocinadores</legend>
          {signed.length === 0 && <p className={styles.hint}>Tu equipo no tiene patrocinadores firmados: los huecos van vacíos.</p>}
          <div className={styles.slots}>
            {LIVERY_SLOTS.map(slot => (
              <label key={slot} className={styles.slot}>
                <span>{SLOT_LABEL[slot]}</span>
                <select value={draft.slots[slot] ?? ''} onChange={e => setSlot(slot, e.target.value)} disabled={signed.length === 0}>
                  <option value="">Vacío</option>
                  {signed.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.actions}>
          <button type="button" onClick={onSkip}>{skipLabel}</button>
          <button type="button" className={styles.primary} onClick={() => onSave(draft)}>Guardar librea</button>
        </div>
      </div>
    </section>
  );
}
