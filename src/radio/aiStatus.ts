/**
 * [UX8] Estado de la IA de la radio en una línea y por piezas: si hablas con la IA o con la radio básica, y el estado
 * del modelo (con su versión), de la voz (realista o del sistema) y del micro (Chrome, sin red o ninguno). Lo enseña
 * el distintivo del panel de radio, del menú de carrera, de Ajustes y, en el móvil, el icono junto a la radio.
 * Sin dependencias del modelo (src/radio/model/ solo se carga con import(), IA4): los nombres de las versiones van aquí.
 */
export type AiTone = 'ia' | 'cargando' | 'basica';
export interface AiStatusInput {
  mode: 'basica' | 'ia';
  aiStatus: 'apagada' | 'descargando' | 'conectando' | 'lista' | 'basica';
  aiReason?: string;
  variant?: 'q0f16' | 'q4';
  voice?: 'piper' | 'sistema' | 'texto';
  mic?: 'web-speech' | 'whisper' | null;
  /** ¿Está el modelo en el dispositivo? (si se sabe) */
  downloaded?: boolean;
  offerDownload?: boolean;
}
export interface AiStatusItem { id: 'modelo' | 'voz' | 'micro'; label: string; value: string }
export interface AiStatusSummary { tone: AiTone; headline: string; short: string; items: AiStatusItem[] }

const VARIANT_LABEL = { q0f16: 'Completa', q4: 'Ligera' } as const;

function modelState(input: AiStatusInput): string {
  const version = input.variant ? `versión ${VARIANT_LABEL[input.variant].toLowerCase()}` : 'modelo propio';
  if (input.mode !== 'ia') return input.downloaded ? `Descargado (${version}), pero apagado` : 'Apagado';
  if (input.aiStatus === 'lista') return `Listo · ${version}`;
  if (input.aiStatus === 'conectando') return `Cargando · ${version}`;
  if (input.aiStatus === 'descargando') return `Descargándose · ${version}`;
  if (input.offerDownload || (input.aiReason && /no está en este dispositivo/i.test(input.aiReason))) return 'Sin descargar: se descarga en Ajustes';
  if (input.aiReason) return `No disponible en este dispositivo: ${input.aiReason.replace(/: radio básica$/i, '')}`;
  return 'No disponible';
}

const VOICE = { piper: 'Realista (Piper)', sistema: 'Del sistema', texto: 'Sin voz (solo texto)' } as const;
const MIC = { 'web-speech': 'Micro de Chrome (con red)', whisper: 'Micro sin red (Whisper)' } as const;

export function aiStatusSummary(input: AiStatusInput): AiStatusSummary {
  const loading = input.mode === 'ia' && (input.aiStatus === 'conectando' || input.aiStatus === 'descargando');
  const ready = input.mode === 'ia' && input.aiStatus === 'lista';
  const tone: AiTone = ready ? 'ia' : loading ? 'cargando' : 'basica';
  const headline = ready ? 'Hablas con la IA' : loading ? 'Cargando la IA…' : input.mode === 'ia' ? 'Radio básica: la IA no está disponible' : 'Radio básica (sin IA)';
  const short = ready ? 'IA' : loading ? 'IA…' : 'Básica';
  return {
    tone, headline, short,
    items: [
      { id: 'modelo', label: 'Modelo', value: modelState(input) },
      { id: 'voz', label: 'Voz', value: VOICE[input.voice ?? 'sistema'] },
      { id: 'micro', label: 'Micro', value: input.mic ? MIC[input.mic] : 'Ninguno' },
    ],
  };
}

/** El resumen en una frase, para lectores de pantalla. */
export function aiStatusText(summary: AiStatusSummary): string {
  return `${summary.headline}. ${summary.items.map(i => `${i.label}: ${i.value}`).join('. ')}.`;
}
