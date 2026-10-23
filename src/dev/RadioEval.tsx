// [IA5/IA8] Evaluación de la radio con IA (solo en desarrollo: `?revision=radio-eval`). Al pulsar, carga el modelo (lo
// descarga si no está) y mide:
//  - las 500 frases de tests/fixtures/radio-phrases.json (las que se usaron para ajustar las palabras clave);
//  - la reserva de tests/fixtures/radio-reserva.json, aparte y por lote (ia5, nuevas, usuario): la cifra que cuenta;
//  - la latencia del paso del modelo (p50/p95) y los FPS de la página mientras trabaja.
// Motor por defecto: el clasificador por ejemplos de IA8. `&motor=webllm&modelo=<id>`: el modelo generativo de IA5.
// [IA10] `&motor=propio&version=q0f16|q4`: el modelo propio de la radio, tal como va en el juego (modelo primero,
// reglas y palabras clave de respaldo). Además mide la reserva v3 del dataset (scripts/radio-model/reserva-v3.json):
// el JSON del modelo frente al esperado y el resultado en el juego frente al del JSON esperado.
// El resumen final se puede copiar y pegar en el chat.
import { useRef, useState } from 'react';
import phrases from '../../tests/fixtures/radio-phrases.json';
import reservaData from '../../tests/fixtures/radio-reserva.json';
import reservaV3Data from '../../scripts/radio-model/reserva-v3.json';
import { contextFromSpec, type RadioContextSpec } from '../radio/context';
import { classOf, NO_ORDER, type RadioClass } from '../radio/classifier/classes';
import { MODEL_MANIFEST, RADIO_MODELS, WEBLLM_MANIFEST } from '../radio/model/manifest';
import type { ModelStore } from '../radio/model/ModelStore';
import type { RadioInterpreter, RadioParse } from '../radio/types';

interface Phrase { tareas: string[]; texto: string; contexto: string; esperado: { estado: string; intencion?: string; ordenes: unknown[] } }
interface Reserva { texto: string; clase: RadioClass; coche: number; autor: string; lote: string }
const FRASES = (phrases as unknown as { frases: Phrase[] }).frases;
const CONTEXTOS = (phrases as unknown as { contextos: Record<string, RadioContextSpec> }).contextos;
const RESERVA = (reservaData as unknown as { frases: Reserva[] }).frases;
const params = new URLSearchParams(globalThis.location?.search ?? '');
const MOTOR = params.get('motor') === 'webllm' ? 'webllm' : params.get('motor') === 'propio' ? 'propio' : 'clasificador';
const OWN = RADIO_MODELS[params.get('version') === 'q4' ? 'q4' : 'q0f16'];
const MODEL_ID = MOTOR === 'webllm' ? params.get('modelo') ?? WEBLLM_MANIFEST.modelId : MOTOR === 'propio' ? OWN.modelId : MODEL_MANIFEST.modelId;
const SIZE_MB = Math.round((MOTOR === 'webllm' ? WEBLLM_MANIFEST.bytes : MOTOR === 'propio' ? OWN.bytes : MODEL_MANIFEST.bytes) / 1048576);
interface ReservaV3 { t: string; c: string; j: Record<string, unknown> & { intent: string } }
const RESERVA_V3 = (reservaV3Data as unknown as { frases: ReservaV3[] }).frases;
const OWN_KEYS = ['intent', 'target', 'compound', 'paceMode', 'teamMode', 'favoured', 'accept', 'delegated', 'enVueltas', 'vuelta'];
const pct = (values: number[], p: number) => { const s = [...values].sort((a, b) => a - b); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : 0; };
const alwaysThere: ModelStore = { has: async () => true, download: async () => {}, remove: async () => {}, bytesOnDisk: async () => 0 };
const base = () => contextFromSpec(structuredClone(CONTEXTOS.base));

/** FPS de la página en ventanas de 250 ms mientras dura `work`. */
async function fpsDuring<T>(work: () => Promise<T>): Promise<{ result: T; minFps: number; avgFps: number }> {
  const windows: number[] = [];
  let frames = 0, start = performance.now(), running = true;
  const loop = (now: number) => {
    frames++;
    if (now - start >= 250) { windows.push((frames * 1000) / (now - start)); frames = 0; start = now; }
    if (running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const result = await work();
  running = false;
  return { result, minFps: windows.length ? Math.round(Math.min(...windows)) : 0, avgFps: windows.length ? Math.round(windows.reduce((a, b) => a + b, 0) / windows.length) : 0 };
}

/** Lo que sacó la radio para una frase de reserva, como clase. */
function outcome(parse: RadioParse): string {
  if (parse.status === 'ok' && parse.intent) return classOf(parse.intent as never);
  if (parse.status === 'ambigua') return 'repetir';
  return parse.status;
}

export default function RadioEval() {
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const started = useRef(false);
  const say = (line: string) => setLog(l => [...l, line]);

  /** Carga el motor elegido: el intérprete completo y el tiempo de cada llamada al modelo. */
  async function loadEngine(modelTimes: number[], answers: (string | null)[] = []): Promise<{ interp: RadioInterpreter; close: () => Promise<void> }> {
    if (MOTOR === 'propio') {
      const [{ createWebllmEngine }, { createRadioAi }, { createFinetunedInterpreter }, { radioRequest }] = await Promise.all([import('../radio/llm/webllmEngine'), import('../radio/llm/LlmEngine'), import('../radio/llm/FinetunedInterpreter'), import('../radio/llm/radioPrompt')]);
      const ai = createRadioAi({ request: radioRequest, factory: () => createWebllmEngine({ model: OWN, onProgress: r => setProgress(`${Math.round(r.progress * 100)} % · ${r.text}`) }) });
      await ai.enterRace({ mode: 'ia', store: alwaysThere });
      if (ai.state().status !== 'lista') throw new Error(ai.state().reason ?? ai.state().status);
      const timed = { interpret: async (text: string, c: Parameters<typeof ai.interpret>[1]) => { const t = performance.now(); const r = await ai.interpret(text, c); modelTimes.push(performance.now() - t); answers.push(r); return r; } };
      return { interp: createFinetunedInterpreter(timed), close: () => ai.leaveRace() };
    }
    if (MOTOR === 'webllm') {
      const [{ createWebllmEngine }, { createRadioAi }, { createLlmInterpreter }] = await Promise.all([import('../radio/llm/webllmEngine'), import('../radio/llm/LlmEngine'), import('../radio/llm/LlmInterpreter')]);
      const ai = createRadioAi({ factory: () => createWebllmEngine({ modelId: MODEL_ID, onProgress: r => setProgress(`${Math.round(r.progress * 100)} % · ${r.text}`) }) });
      await ai.enterRace({ mode: 'ia', store: alwaysThere });
      if (ai.state().status !== 'lista') throw new Error(ai.state().reason ?? ai.state().status);
      const timed = { interpret: async (text: string, c: Parameters<typeof ai.interpret>[1]) => { const t = performance.now(); const r = await ai.interpret(text, c); modelTimes.push(performance.now() - t); return r; } };
      return { interp: createLlmInterpreter(timed), close: () => ai.leaveRace() };
    }
    const [{ createWorkerEmbedder }, { createExampleInterpreter }, { bank }] = await Promise.all([import('../radio/classifier/embedder'), import('../radio/classifier/ExampleInterpreter'), import('../radio/classifier/runtime')]);
    const files = new Map<string, number>();
    const embedder = await createWorkerEmbedder({ onProgress: p => { if (p.file && typeof p.loaded === 'number') { files.set(p.file, p.loaded); setProgress(`${Math.round([...files.values()].reduce((a, b) => a + b, 0) / 1048576)} MB · ${p.file}`); } } });
    let preparing = true;
    const embed = async (texts: string[]) => { const t = performance.now(); const r = await embedder.embed(texts); if (!preparing) modelTimes.push(performance.now() - t); return r; };
    const ex = createExampleInterpreter({ embed, bank });
    const t0 = performance.now();
    await ex.prepare();
    preparing = false;
    say(`Vectores del banco (${bank.frases.length} frases) en ${Math.round((performance.now() - t0) / 1000)} s.`);
    return { interp: ex, close: () => embedder.dispose() };
  }

  async function run() {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    try {
      say(`Cargando ${MODEL_ID} (${MOTOR})…`);
      const t0 = performance.now();
      const modelTimes: number[] = [];
      const answers: (string | null)[] = [];
      const { interp, close } = await loadEngine(modelTimes, answers);
      say(`Modelo listo en ${Math.round((performance.now() - t0) / 1000)} s.`);
      const idle = await fpsDuring(() => new Promise(resolve => setTimeout(resolve, 3000)));
      say(`FPS sin trabajar: mínimo ${idle.minFps}, medio ${idle.avgFps}.`);

      // Las 500 frases (las usadas para ajustar las palabras clave).
      let ok500 = 0;
      const gen = await fpsDuring(async () => {
        for (const [i, f] of FRASES.entries()) {
          const parse = await interp.interpret(f.texto, contextFromSpec(structuredClone(CONTEXTOS[f.contexto])));
          if (parse.status === f.esperado.estado && (parse.intent?.kind ?? undefined) === f.esperado.intencion && JSON.stringify(parse.orders) === JSON.stringify(f.esperado.ordenes)) ok500++;
          if (i % 50 === 0) setProgress(`Frases: ${i + 1} de ${FRASES.length}`);
        }
      });

      // La reserva, por lote y por clase.
      const byLote: Record<string, { ok: number; total: number }> = {};
      const byClass: Record<string, { ok: number; total: number }> = {};
      let invented = 0, chat = 0;
      const misses: string[] = [];
      for (const f of RESERVA) {
        const parse = await interp.interpret(f.texto, base());
        const got = outcome(parse);
        const noOrder = NO_ORDER.includes(f.clase);
        const carOk = parse.carIds.includes(f.coche);
        const hit = noOrder ? got === 'repetir' : (got === f.clase || (f.clase === 'boxes' && got === 'sin-compuesto')) && carOk;
        if (noOrder) { chat++; if (parse.status === 'ok') invented++; }
        for (const [bucket, k] of [[byLote, f.lote], [byClass, f.clase]] as const) { const b = (bucket[k] ??= { ok: 0, total: 0 }); b.total++; if (hit) b.ok++; }
        if (!hit && misses.length < 50) misses.push(`[${f.lote}] «${f.texto}» → ${got}${carOk || noOrder ? '' : ' (otro coche)'} (esperado ${f.clase})`);
      }
      const resOk = Object.values(byLote).reduce((a, b) => a + b.ok, 0);

      // [IA10] La reserva v3 del dataset: JSON del modelo y resultado en el juego.
      const v3Lines: string[] = [];
      if (MOTOR === 'propio') {
        const { finetunedParse } = await import('../radio/llm/FinetunedInterpreter');
        const same = (a: RadioParse, b: RadioParse) => a.status === b.status && JSON.stringify(a.orders) === JSON.stringify(b.orders) && (a.status !== 'ok' || JSON.stringify(a.carIds) === JSON.stringify(b.carIds));
        let jsonOk = 0, gameOk = 0;
        const v3Misses: string[] = [];
        const v3 = await fpsDuring(async () => {
          for (const [i, f] of RESERVA_V3.entries()) {
            const expected = { ...f.j, confianza: f.j.intent === 'ninguna' ? 'baja' : 'alta' };
            const before = answers.length;
            const got = await interp.interpret(f.t, base());
            const raw = answers.length > before ? answers[answers.length - 1] : null;
            let parsed: Record<string, unknown> = {};
            try { parsed = JSON.parse(raw ?? ''); } catch { /* JSON roto */ }
            const jsonHit = f.j.intent === 'ninguna' ? parsed.intent === 'ninguna' : OWN_KEYS.every(k => parsed[k] === f.j[k]);
            const want = finetunedParse(JSON.stringify(expected), f.t, base());
            const gameHit = want !== null && same(got, want);
            if (jsonHit) jsonOk++;
            if (gameHit) gameOk++;
            if (!gameHit && v3Misses.length < 30) v3Misses.push(`«${f.t}» → ${got.status} ${JSON.stringify(got.orders)} · modelo ${raw}`);
            if (i % 10 === 0) setProgress(`Reserva v3: ${i + 1} de ${RESERVA_V3.length}`);
          }
        });
        v3Lines.push(
          `Reserva v3 (dataset), JSON del modelo igual al esperado: ${jsonOk}/${RESERVA_V3.length} (${((jsonOk / RESERVA_V3.length) * 100).toFixed(1)} %)`,
          `Reserva v3, resultado en el juego (con reglas y respaldo) igual al esperado: ${gameOk}/${RESERVA_V3.length} (${((gameOk / RESERVA_V3.length) * 100).toFixed(1)} %) · objetivo ${OWN.accuracy} %`,
          `FPS mínimos con la reserva v3: ${v3.minFps}`,
          'Fallos de la reserva v3 en el juego (hasta 30):', ...v3Misses.map(m => `  ${m}`),
        );
      }
      await close();

      const lines = [
        `Radio · ${MOTOR} · ${MODEL_ID} · ${new Date().toLocaleString('es-ES')}`,
        `Reserva: ${resOk}/${RESERVA.length} (${((resOk / RESERVA.length) * 100).toFixed(1)} %) · objetivo ≥ 95 %`,
        ...Object.entries(byLote).map(([k, v]) => `  lote ${k}: ${v.ok}/${v.total} (${((v.ok / v.total) * 100).toFixed(0)} %)`),
        `Órdenes inventadas en charla u órdenes dobles: ${invented}/${chat} · objetivo 0`,
        'Reserva por clase:', ...Object.entries(byClass).map(([k, v]) => `  ${k}: ${v.ok}/${v.total}`),
        `Las 500 frases (usadas para ajustar): ${ok500}/${FRASES.length} (${((ok500 / FRASES.length) * 100).toFixed(1)} %)`,
        `Paso del modelo: ${modelTimes.length} llamadas · p50 ${pct(modelTimes, 0.5)} ms · p95 ${pct(modelTimes, 0.95)} ms`,
        `FPS mínimos: sin trabajar ${idle.minFps} · interpretando ${gen.minFps} · objetivo ≥ 80 % (${Math.round(idle.minFps * 0.8)})`,
        'Fallos de la reserva (hasta 50):', ...misses.map(m => `  ${m}`),
        ...v3Lines,
      ];
      setSummary(lines.join('\n'));
    } catch (error) {
      say(`Error: ${String((error as Error)?.message ?? error)}`);
    } finally { setBusy(false); setProgress(''); }
  }

  return (
    <main style={{ minHeight: '100vh', padding: 16, background: 'var(--bg, #0b0f19)', color: 'var(--text, #e8edf3)', fontFamily: 'var(--font-ui, sans-serif)', boxSizing: 'border-box' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 20 }}>Evaluación de la radio con IA</h1>
      <p style={{ maxWidth: 720, color: 'var(--text-2, #aeb9c8)' }}>
        Al pulsar se carga {MODEL_ID}. Si no está en este navegador se descarga (≈ {SIZE_MB} MB desde Hugging Face).
        Después pasa las {FRASES.length} frases y las {RESERVA.length} de reserva.
      </p>
      <button type="button" onClick={() => void run()} disabled={busy || started.current} style={{ minHeight: 44, padding: '0 16px', fontSize: 16, fontWeight: 700, borderRadius: 8, border: '1px solid #38bdf8', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>
        Cargar el modelo y evaluar
      </button>
      {progress && <p aria-live="polite">{progress}</p>}
      <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {summary && <pre data-eval-summary style={{ whiteSpace: 'pre-wrap', padding: 12, borderRadius: 8, background: '#111827', fontSize: 14 }}>{summary}</pre>}
    </main>
  );
}
