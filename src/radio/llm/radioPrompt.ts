/**
 * [IA10] El prompt del modelo propio de la radio: exactamente el del entrenamiento (scripts/radio-model/build-dataset.mjs
 * lo importa de aquí), con los nombres y apodos de los dos coches. Sin historial: sistema y frase. Temperatura 0, 60
 * tokens y sin esquema forzado, como en la evaluación (la penalización por repetir va a 1 en mlc-chat-config.json).
 */
import type { RadioContext } from '../types';
import type { ChatOptions } from './LlmEngine';
import type { ChatMessage } from './prompt';
import { carCode } from './schema';

export function radioSystemPrompt(context: RadioContext): string {
  const cars = context.cars.map(c => {
    const p = c.proposals[c.proposals.length - 1];
    return `${carCode(c)}: ${c.displayName ?? ''} (${c.names.join(', ')}), P${c.position}${p ? `, propuesta pendiente: ${p.kind}${p.compound ? ` ${p.compound}` : ''}` : ''}`;
  }).join('\n');
  const sel = context.cars.find(c => c.id === context.selectedCarId);
  return `Eres piloto de un equipo de carreras. El ingeniero de pista te habla por radio. Contesta solo con un JSON que diga qué orden has entendido.
intent: boxes, anular-boxes, ritmo (paceMode push|balanced|save), orden-equipo (teamMode libre|mantener|dejar-pasar, favoured), propuesta (accept), delegar (delegated) o ninguna.
target: siglas del piloto al que se habla, LOS-DOS, RIVAL o NADIE. compound: soft|medium|hard|intermediate|wet solo si lo dice.
Parada programada: enVueltas (dentro de cuántas vueltas) o vuelta (en qué vuelta); sin ellos, la parada es ya.
Si no es una orden o hay dos, intent ninguna y confianza baja.
Coches:
${cars}
Seleccionado: ${sel ? carCode(sel) : 'NADIE'}`;
}

export function radioRequest(text: string, context: RadioContext): { messages: ChatMessage[]; opts: ChatOptions } {
  return {
    messages: [{ role: 'system', content: radioSystemPrompt(context) }, { role: 'user', content: text }],
    opts: { temperature: 0, max_tokens: 60 },
  };
}
