import { useEffect, useRef, useState } from 'react';
import { Bot, Radio } from 'lucide-react';
import { aiStatusSummary, aiStatusText, type AiStatusSummary } from '../radio/aiStatus';
import { useRadio } from '../state/radioStore';
import styles from './AiStatusBadge.module.css';

/** [UX8] El resumen del estado de la IA a partir del almacén de la radio (se actualiza solo). */
export function useAiStatusSummary(): AiStatusSummary {
  const mode = useRadio(s => s.mode), aiStatus = useRadio(s => s.aiStatus), aiReason = useRadio(s => s.aiReason);
  const variant = useRadio(s => s.variant), voice = useRadio(s => s.voice), mic = useRadio(s => s.mic);
  const downloaded = useRadio(s => s.downloaded), offerDownload = useRadio(s => s.offerDownload);
  return aiStatusSummary({ mode, aiStatus, aiReason, variant, voice, mic, downloaded, offerDownload });
}

/**
 * [UX8] Distintivo del estado de la IA. Completo: la frase y el estado del modelo, la voz y el micro. Compacto (móvil):
 * un icono pulsable con solo el tono; al tocarlo se abre el resumen completo. Se lee con lector de pantalla.
 */
export function AiStatusBadge({ summary, compact = false, open, className }: { summary: AiStatusSummary; compact?: boolean; open?: boolean; className?: string }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!compact || !ownOpen) return;
    const close = (e: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOwnOpen(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [compact, ownOpen]);
  const Icon = summary.tone === 'basica' ? Radio : Bot;
  const details = (
    <ul className={styles.items}>
      {summary.items.map(item => <li key={item.id} data-ai-item={item.id}><b>{item.label}</b><span>{item.value}</span></li>)}
    </ul>
  );
  if (!compact) return (
    <div className={`${styles.badge} ${className ?? ''}`} data-ai-tone={summary.tone} role="status" aria-label={aiStatusText(summary)}>
      <p className={styles.headline}><Icon size={16} aria-hidden="true" /><span>{summary.headline}</span></p>
      {details}
    </div>
  );
  return (
    <span ref={rootRef} className={`${styles.compact} ${className ?? ''}`}>
      <button type="button" className={styles.chip} data-ai-tone={summary.tone} aria-expanded={isOpen}
        aria-label={`Estado de la radio: ${summary.headline}`} onClick={() => setOwnOpen(v => !v)}>
        <Icon size={16} aria-hidden="true" /><span>{summary.short}</span>
      </button>
      {isOpen && (
        <span className={styles.popover} role="dialog" aria-label="Estado de la IA de la radio">
          <span className={styles.headline}><Icon size={16} aria-hidden="true" />{summary.headline}</span>
          {details}
        </span>
      )}
    </span>
  );
}

/** Lo mismo leyendo el almacén (para colocarlo en cualquier sitio). */
export function LiveAiStatusBadge(props: { compact?: boolean; className?: string }) {
  return <AiStatusBadge summary={useAiStatusSummary()} {...props} />;
}

