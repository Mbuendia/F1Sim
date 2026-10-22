/**
 * [IA1] Panel de radio del muro: escribes la orden con tus palabras, sale por el `send` de siempre y el piloto contesta.
 * Flota sobre la pantalla (no cambia la altura del muro, regla de V3); en móvil ocupa todo el ancho abajo.
 * La tecla R lo abre y pone el cursor en el campo, salvo si ya se está escribiendo en otro.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Radio, Send, X } from 'lucide-react';
import type { CarState } from '../types/f1';
import type { EngineOrder } from '../engine/EngineHost';
import type { TeamView } from '../engine/RaceView';
import type { Ack } from '../engine/RaceSession';
import { contextFromRace } from '../radio/context';
import { keywordInterpreter } from '../radio/keywordInterpreter';
import { submitRadio } from '../radio/controller';
import { radioStore, useRadio, type RadioMessage } from '../state/radioStore';
import styles from './RadioPanel.module.css';

const VISIBLE = 6;
const STATUS_LABEL: Partial<Record<NonNullable<RadioMessage['status']>, string>> = {
  enviada: 'enviada', aceptada: 'aplicada', rechazada: 'rechazada', ambigua: 'no entendida', 'no-es-tuyo': 'no es tuyo',
  'sin-compuesto': 'falta la goma', 'no-disponible': 'no disponible',
};

export function RadioPanel({ cars, team, ordersAvailable, send, carId, onClose }: {
  cars: CarState[];
  team: TeamView | null | undefined;
  ordersAvailable: boolean;
  send: (order: EngineOrder) => Promise<Ack>;
  /** Coche al que se habla (el de la tarjeta desde la que se abrió). */
  carId: number;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(carId);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const messages = useRadio(state => state.conversations[selected]) ?? [];
  const visible = useMemo(() => messages.slice(-VISIBLE), [messages]);

  useEffect(() => { setSelected(carId); input.current?.focus(); }, [carId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    const said = text.trim();
    if (!said) return;
    setText('');
    const context = contextFromRace({ cars, team, selectedCarId: selected, ordersAvailable });
    void submitRadio({ text: said, context, send, store: radioStore, interpreter: keywordInterpreter });
  };

  const current = cars.find(c => c.id === selected) ?? cars[0];
  return (
    <section className={styles.panel} role="dialog" aria-label={`Radio con ${current?.driver.code ?? ''}`} data-radio-panel>
      <header className={styles.head}>
        <Radio size={16} aria-hidden="true" />
        <strong>RADIO</strong>
        <div className={styles.cars} role="tablist" aria-label="Piloto al que hablas">
          {cars.map(c => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === selected} className={c.id === selected ? styles.carOn : styles.car}
              style={{ ['--c' as string]: c.team.color }} onClick={() => { setSelected(c.id); input.current?.focus(); }}>
              {c.driver.code}
            </button>
          ))}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar la radio"><X size={16} aria-hidden="true" /></button>
      </header>
      <ol className={styles.log} aria-live="polite">
        {visible.length === 0 && <li className={styles.hint}>Prueba «box, duros», «ataca», «deja pasar a {cars.find(c => c.id !== selected)?.driver.firstName ?? 'tu compañero'}» o «decide tú».</li>}
        {visible.map(m => (
          <li key={m.id} className={m.author === 'muro' ? styles.wall : styles.driver}>
            <span className={styles.who}>{m.author === 'muro' ? 'MURO' : current?.driver.code}</span>
            <span className={styles.text}>{m.text}</span>
            {m.author === 'muro' && m.status && (
              <span className={styles.status} data-status={m.status} title={m.reason}>{STATUS_LABEL[m.status] ?? m.status}{m.status === 'rechazada' && m.reason ? `: ${m.reason}` : ''}</span>
            )}
          </li>
        ))}
      </ol>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); submit(); }}>
        <input ref={input} className={styles.input} value={text} onChange={e => setText(e.target.value)} placeholder={`Habla con ${current?.driver.firstName ?? 'tu piloto'}…`}
          aria-label="Mensaje de radio" maxLength={160} autoComplete="off" enterKeyHint="send" />
        <button type="submit" className={styles.send} disabled={!text.trim()} aria-label="Enviar por radio"><Send size={16} aria-hidden="true" /></button>
      </form>
    </section>
  );
}

/** Tecla R: abre la radio si no se está escribiendo en otro campo. */
export function useRadioHotkey(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      open();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}
