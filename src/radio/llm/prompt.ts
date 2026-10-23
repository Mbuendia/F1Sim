/**
 * [IA5] Lo que se le pregunta al modelo: un prompt corto y fijo, sin historial. Para interpretar, el catálogo compacto,
 * 8 ejemplos y el contexto (coches, compuestos, propuesta pendiente). Para responder, la ficha del piloto (nombre de
 * parodia y carácter), el resultado y la situación. Nunca nombres reales: los pilotos van por su nombre del juego.
 */
import type { Temperament } from '../../data/driverRadio';
import type { RadioContext } from '../types';
import { carCode, GROUP_TARGET, NO_TARGET, RIVAL_TARGET } from './schema';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

const CATALOG = `Intenciones (elige solo una):
- boxes: parar en boxes (compound: soft, medium, hard, intermediate, wet; si no lo dice, sin compound).
- anular-boxes: cancelar la parada, quedarse fuera.
- ritmo: paceMode push (atacar), balanced (normal) o save (ahorrar, cuidar gomas o combustible).
- orden-equipo: teamMode libre (podéis pelear), mantener (mantened posiciones) o dejar-pasar (favoured: a quién se deja pasar).
- propuesta: accept true (aceptar la propuesta del estratega) o false (descartarla).
- delegar: delegated true (que decida el estratega) o false (decido yo).
- ninguna: no es una orden.`;

const EXAMPLES: [string, string][] = [
  ['Mete los rojos esta vuelta, Fer', '{"intent":"boxes","target":"ALO","compound":"soft","confianza":"alta"}'],
  ['Lance, te esperamos en el garaje con gomas de seco duras', '{"intent":"boxes","target":"STR","compound":"hard","confianza":"alta"}'],
  ['Mejor sigue fuera, ya no hace falta venir', '{"intent":"anular-boxes","target":"NADIE","confianza":"alta"}'],
  ['Lance, cambio de idea, te quedas en pista', '{"intent":"anular-boxes","target":"STR","confianza":"alta"}'],
  ['Chicos, dadlo todo ahora', '{"intent":"ritmo","target":"LOS-DOS","paceMode":"push","confianza":"alta"}'],
  ['Lance, despacito con las gomas, que hay que llegar', '{"intent":"ritmo","target":"STR","paceMode":"save","confianza":"alta"}'],
  ['Fer, vuelve a lo de siempre, sin apretar ni guardar', '{"intent":"ritmo","target":"ALO","paceMode":"balanced","confianza":"alta"}'],
  ['Fer, permite que tu compañero se ponga delante', '{"intent":"orden-equipo","target":"ALO","teamMode":"dejar-pasar","favoured":"STR","confianza":"alta"}'],
  ['Chicos, nadie se mueve de su puesto', '{"intent":"orden-equipo","target":"NADIE","teamMode":"mantener","confianza":"alta"}'],
  ['Chicos, ya podéis competir entre vosotros', '{"intent":"orden-equipo","target":"NADIE","teamMode":"libre","confianza":"alta"}'],
  ['Me parece bien lo que dice el estratega', '{"intent":"propuesta","target":"NADIE","accept":true,"confianza":"alta"}'],
  ['Lance, lo del estratega no lo vemos, fuera', '{"intent":"propuesta","target":"STR","accept":false,"confianza":"alta"}'],
  ['Encargaos vosotros de la estrategia', '{"intent":"delegar","target":"NADIE","delegated":true,"confianza":"alta"}'],
  ['Fer, desde ya las paradas las elijo yo', '{"intent":"delegar","target":"ALO","delegated":false,"confianza":"alta"}'],
  ['¿Qué tal el tiempo por ahí?', '{"intent":"ninguna","target":"NADIE","confianza":"baja"}'],
  ['Entra y ahorra a la vez', '{"intent":"ninguna","target":"NADIE","confianza":"baja"}'],
];

export function interpretMessages(text: string, context: RadioContext): ChatMessage[] {
  const cars = context.cars.map(c => {
    const proposal = c.proposals[c.proposals.length - 1];
    return `${carCode(c)}: ${c.displayName ?? ''} (${c.names.slice(0, 4).join(', ')}), P${c.position}${c.inBoxes ? ', entrando en boxes' : ''}${proposal ? `, propuesta pendiente: ${proposal.kind}${proposal.compound ? ` ${proposal.compound}` : ''}` : ''}`;
  }).join('\n');
  const system = `Eres el traductor de la radio de un equipo de carreras. Conviertes lo que dice el muro en UNA orden en JSON.
${CATALOG}
target: el código del piloto al que se habla, ${GROUP_TARGET} (los dos, solo en ritmo), ${RIVAL_TARGET} (un piloto de otro equipo) o ${NO_TARGET} (no nombra a nadie).
Reglas: una sola orden; si hay dos órdenes distintas, una charla o no está claro, intent "ninguna" y confianza "baja". Ceder la posición, dejar que se ponga delante o abrir la puerta al compañero es dejar-pasar. Seguir lo que propone el estratega es propuesta; que el estratega o el muro decidan por su cuenta es delegar. Contesta solo con el JSON.
Coches del equipo:
${cars}
Seleccionado: ${context.cars.find(c => c.id === context.selectedCarId) ? carCode(context.cars.find(c => c.id === context.selectedCarId)!) : NO_TARGET}`;
  const shots = EXAMPLES.flatMap(([q, a]): ChatMessage[] => [{ role: 'user', content: q }, { role: 'assistant', content: a }]);
  return [{ role: 'system', content: system }, ...shots, { role: 'user', content: text }];
}

const TEMPERAMENT: Record<Temperament, string> = {
  frio: 'frío y escueto', competitivo: 'competitivo y con ganas', quejica: 'quejica, siempre protesta un poco', bromista: 'bromista y simpático',
};

export function replyMessages(args: { name: string; temperament: Temperament; situation: string; template: string }): ChatMessage[] {
  return [
    { role: 'system', content: `Eres ${args.name}, piloto de carreras, ${TEMPERAMENT[args.temperament]}. Contestas por radio a tu equipo en castellano, en una o dos frases cortas, sin comillas ni emojis.` },
    { role: 'user', content: `${args.situation}\nIdea de la respuesta: «${args.template}». Contesta tú con tus palabras.` },
  ];
}
