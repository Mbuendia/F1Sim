// [IA9] Revisión del banco de respuestas (solo en desarrollo: `?revision=respuestas`). Una muestra al azar de 20 frases
// por carácter, ya rellenas; cada una con un botón para marcarla como mala. «Otra muestra» saca otras 20. La lista de
// marcadas se copia y se pega en el chat para quitarlas del banco. `&todo` enseña todas las de un carácter (`&caracter=`).
import { useMemo, useState } from 'react';
import type { Temperament } from '../data/driverRadio';
import { fillTemplate, seededRandom } from '../radio/replies/chooser';
import { CALL_KINDS, REPLY_KINDS, TEMPERAMENTS } from '../radio/replies/templates';
import frio from '../radio/replies/bank/frio.json';
import competitivo from '../radio/replies/bank/competitivo.json';
import quejica from '../radio/replies/bank/quejica.json';
import bromista from '../radio/replies/bank/bromista.json';

const BANK = { frio, competitivo, quejica, bromista } as unknown as Record<Temperament, Record<string, string[]>>;
const KINDS: string[] = [...REPLY_KINDS, ...CALL_KINDS];
const VARS = { compuesto: 'duros', companero: 'Lance', vuelta: 23, motivo: 'no quedan juegos de ese compuesto' };
const NAMES: Record<Temperament, string> = { frio: 'Frío', competitivo: 'Competitivo', quejica: 'Quejica', bromista: 'Bromista' };
const KEY = 'f1_review_respuestas';
const params = new URLSearchParams(globalThis.location?.search ?? '');
const ALL = params.has('todo');
const ONLY = TEMPERAMENTS.find(t => t === params.get('caracter'));

interface Line { id: string; temperament: Temperament; kind: string; text: string }
const allLines = (t: Temperament): Line[] => KINDS.flatMap(k => (BANK[t][k] ?? []).map((s, i) => ({ id: `${t}/${k}/${i}`, temperament: t, kind: k, text: s })));

function sample(t: Temperament, seed: number): Line[] {
  const lines = allLines(t);
  const rnd = seededRandom(seed * 31 + TEMPERAMENTS.indexOf(t));
  for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
  return lines.slice(0, 20);
}
function readMarks(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export default function RepliesReview() {
  const [seed, setSeed] = useState(1);
  const [marked, setMarked] = useState<string[]>(readMarks);
  const shown = useMemo(() => (ONLY ? [ONLY] : TEMPERAMENTS).map(t => ({ t, lines: ALL ? allLines(t) : sample(t, seed) })), [seed]);
  const toggle = (id: string) => {
    const next = marked.includes(id) ? marked.filter(m => m !== id) : [...marked, id];
    setMarked(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
  };
  const total = TEMPERAMENTS.reduce((n, t) => n + allLines(t).length, 0);
  const report = marked.map(id => { const [t, k, i] = id.split('/'); return `${id} · ${BANK[t as Temperament]?.[k]?.[Number(i)] ?? '?'}`; }).join('\n');

  return (
    <main style={{ minHeight: '100vh', padding: 16, background: 'var(--bg, #0b0f19)', color: 'var(--text, #e8edf3)', fontFamily: 'var(--font-ui, sans-serif)', boxSizing: 'border-box' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 20 }}>Banco de respuestas de la radio</h1>
      <p style={{ margin: '0 0 12px', color: 'var(--text-2, #aeb9c8)', maxWidth: 760 }}>
        {total} frases en total. {ALL ? 'Todas' : 'Una muestra de 20 al azar'} por carácter, ya rellenas (compuesto «duros», compañero «Lance», vuelta 23).
        Marca las que no te gusten y pega la lista en el chat.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {!ALL && <button type="button" onClick={() => setSeed(s => s + 1)} style={btn}>Otra muestra</button>}
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(report); }} style={btn} disabled={!marked.length}>Copiar marcadas ({marked.length})</button>
        {marked.length > 0 && <button type="button" onClick={() => { setMarked([]); try { localStorage.removeItem(KEY); } catch { /* nada */ } }} style={btn}>Borrar marcas</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
        {shown.map(({ t, lines }) => (
          <section key={t} data-caracter={t} style={{ border: '1px solid var(--line-strong, #2a3346)', borderRadius: 12, padding: 10, background: 'var(--panel-2, #141a28)', minWidth: 0 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16, color: '#38bdf8' }}>{NAMES[t]}</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lines.map(l => {
                const bad = marked.includes(l.id);
                return (
                  <li key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, opacity: bad ? 0.55 : 1 }}>
                    <button type="button" aria-pressed={bad} aria-label={bad ? 'Quitar la marca' : 'Marcar como mala'} onClick={() => toggle(l.id)}
                      style={{ ...btn, minWidth: 44, padding: 0, borderColor: bad ? '#f87171' : 'var(--line-strong, #2a3346)', color: bad ? '#f87171' : 'inherit' }}>{bad ? '✕' : '·'}</button>
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      <span style={{ textDecoration: bad ? 'line-through' : 'none' }}>{fillTemplate(l.text, VARS)}</span>
                      <small style={{ display: 'block', color: 'var(--text-2, #9aa6b8)', fontSize: 12 }}>{l.kind}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

const btn = { minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid #38bdf8', background: '#0f172a', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' } as const;
