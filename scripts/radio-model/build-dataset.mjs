// [IA7] Dataset para ajustar un modelo pequeño a la radio del juego: el muro (ingeniero de pista) da una orden y el
// piloto contesta qué ha entendido, en el JSON del esquema de IA5 (src/radio/llm/schema.ts), que el juego ya sabe leer.
//
// Uso:  node scripts/radio-model/build-dataset.mjs [carpeta de salida] [--correcciones archivo.json]
//        (por defecto C:/Users/Usuario/f1_dataset/radio). [IA7] Las correcciones son el archivo que exporta el juego
//        desde Ajustes («¿Era esto?»): entran en train, sin repetidas y nunca si coinciden con una frase de las reservas.
//
// De dónde salen los ejemplos:
//  - Las frases del banco del clasificador (src/radio/classifier/bank.json, con su clase), repartidas entre los 10 equipos
//    del juego: los nombres de Alonsoplán y Strollercoaster se cambian por los del equipo elegido (nombre, apellido de
//    parodia, siglas o apodo), con posiciones y propuestas pendientes al azar.
//  - Frases dirigidas a un piloto rival (el piloto contesta RIVAL).
//  - La respuesta la calcula el propio juego (reglas de IA1 con la clase ya decidida) y se comprueba con answerToParse:
//    un ejemplo cuyo JSON no da las mismas órdenes que el juego se descarta.
//  - La reserva (tests/fixtures/radio-reserva.json) va SOLO a test.jsonl; ninguna frase de la reserva entra en train/val.
// Versión 2 (23/10/2026), tras la primera evaluación (76,5 % en la reserva):
//  - Compuestos en femenino y otras formas («blandas», «duras», «gomas amarillas», «de agua»), que antes no se
//    reconocían y dejaban mal la respuesta esperada.
//  - Todos los nombres y apodos de cada piloto en el prompt (antes solo 5: «Nano» y «Magic» se quedaban fuera).
//  - Más datos donde fallaba: charla y órdenes dobles, ataque y ahorro coloquiales, dejar pasar con el favorecido
//    nombrado, libre frente a mantener, anular, paradas y delegar. Respuestas escritas directamente (favorecido = el
//    compañero nombrado), sin pasar por las reglas de palabras clave.
//  - Reserva v2 (scripts/radio-model/reserva-v2.json): 106 frases escritas antes de estas plantillas → test2.jsonl.
// Versión 3 (23/10/2026), tras la v2 (88,7 % en la reserva v2):
//  - El destinatario es el nombre usado como vocativo (al principio, en medio o al final de la frase), no el primer
//    piloto nombrado: «Quédate detrás de Fer, Lance» va a Lance. Al dejar pasar, el favorecido es el compañero del
//    destinatario (o el nombrado que no es el destinatario).
//  - Un 30 % de las frases con nombre lo llevan al final («Entra ya, Fer»).
//  - Más paradas sin compuesto, para que no se invente «soft».
//  - Pares opuestos (dejar de atacar = normal, «la estrategia es mía» = no delegar, «fuera esa idea» = descartar,
//    «aguanta detrás» = mantener) y más órdenes dobles.
//  - Reserva v3 (scripts/radio-model/reserva-v3.json): 101 frases escritas antes de estas plantillas → test3.jsonl.
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARGS = process.argv.slice(2);
const flag = name => { const i = ARGS.indexOf(name); return i >= 0 ? ARGS[i + 1] : undefined; };
const CORRECTIONS = flag('--correcciones');
const OUT = ARGS.find((a, i) => !a.startsWith('--') && ARGS[i - 1] !== '--correcciones') ?? 'C:/Users/Usuario/f1_dataset/radio';
const SEED = 20261023;
const VARIANTS_PER_PHRASE = 3;
const VAL_SHARE = 0.06;

// Azar reproducible (mulberry32).
let state = SEED >>> 0;
const rand = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = list => list[Math.floor(rand() * list.length)];

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
const load = p => server.ssrLoadModule(p);
const { DRIVERS } = await load('/src/data/drivers.ts');
const { driverRadio, radioNamesById } = await load('/src/data/driverRadio.ts');
const { contextFromSpec } = await load('/src/radio/context.ts');
const { interpretSync } = await load('/src/radio/keywordInterpreter.ts');
const { forcedOf, NO_ORDER } = await load('/src/radio/classifier/classes.ts');
const { answerToParse, buildIntentSchema, carCode } = await load('/src/radio/llm/schema.ts');
const { clean, tokens } = await load('/src/radio/normalize.ts');
const { COMPOUND_WORDS, GROUP_WORDS } = await load('/src/radio/catalog.ts');
const { radioSystemPrompt } = await load('/src/radio/llm/radioPrompt.ts');

const bank = JSON.parse(readFileSync('src/radio/classifier/bank.json', 'utf8')).frases;
const reserva = JSON.parse(readFileSync('tests/fixtures/radio-reserva.json', 'utf8')).frases;
const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
const reservaV2 = JSON.parse(readFileSync('scripts/radio-model/reserva-v2.json', 'utf8')).frases;
const reservaV3 = JSON.parse(readFileSync('scripts/radio-model/reserva-v3.json', 'utf8')).frases;
const reservaKeys = new Set([...reserva.map(f => clean(f.texto)), ...reservaV2.map(f => clean(f.t)), ...reservaV3.map(f => clean(f.t))]);

// ---------- Equipos y formas de nombrar a cada piloto ----------
const teams = {};
for (const d of Object.values(DRIVERS)) (teams[d.teamId] ??= []).push(d);
const TEAM_IDS = Object.keys(teams).filter(t => teams[t].length === 2);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
/** Formas de llamar a un piloto tal como las escribiría el muro (con mayúsculas y tildes). */
const callForms = d => [d.firstName, d.lastName, d.code, ...driverRadio(d.id).nicknames.map(cap)];

// Formas de Alonsoplán (A) y Strollercoaster (B) que aparecen en el banco; se cambian por las del equipo elegido.
const A_FORMS = ['Fernando', 'Fer', 'Nano', 'Magic', 'Alonsoplán', 'ALO'];
const B_FORMS = ['Lance', 'Lancito', 'Strollercoaster', 'STR'];
const nameRe = forms => new RegExp(`(?<![\\p{L}])(${forms.join('|')})(?![\\p{L}])`, 'gu');
const A_RE = nameRe(A_FORMS), B_RE = nameRe(B_FORMS);

const PROPOSALS = [null, { tipo: 'parada', compuesto: 'hard' }, { tipo: 'parada', compuesto: 'medium' }, { tipo: 'parada', compuesto: 'soft' }, { tipo: 'parada', compuesto: 'intermediate' }, { tipo: 'ritmo' }];

/** Un contexto de carrera al azar para un equipo: posiciones, propuestas pendientes y coche seleccionado. */
function teamContext(teamId) {
  const [a, b] = teams[teamId];
  const posA = 1 + Math.floor(rand() * 18);
  let posB = 1 + Math.floor(rand() * 20);
  if (posB === posA) posB = posA + 1;
  const prop = (d, i) => { const p = pick(PROPOSALS); return p ? [{ id: `prop-${d.code.toLowerCase()}-${i}`, ...p }] : []; };
  const spec = {
    equipo: teamId, seleccionado: 1, disponible: true,
    coches: [
      { piloto: a.id, id: 1, posicion: posA, estado: 'running', enBoxes: false, compuestos: ['soft', 'medium', 'hard', 'intermediate', 'wet'], propuestas: prop(a, 1) },
      { piloto: b.id, id: 2, posicion: posB, estado: 'running', enBoxes: false, compuestos: ['soft', 'medium', 'hard', 'intermediate', 'wet'], propuestas: prop(b, 2) },
    ],
  };
  if (rand() < 0.5) spec.seleccionado = 2;
  return { spec, a, b };
}

// ---------- El prompt del piloto ----------
// [IA10] Vive en src/radio/llm/radioPrompt.ts: el juego envía exactamente el mismo con el modelo ajustado.
const SYSTEM = radioSystemPrompt;

// ---------- La respuesta correcta, calculada por el juego ----------
const COMPOUND_SINGLE = new Set(COMPOUND_WORDS.filter(k => k.words.length === 1).map(k => k.words[0]));
/** [v2] Formas de cada compuesto en masculino, femenino y plural, colores y «de agua». */
const COMPOUND_FORMS = {
  soft: ['blando', 'blanda', 'blandos', 'blandas', 'rojo', 'roja', 'rojos', 'rojas', 'soft', 'softs'],
  medium: ['medio', 'media', 'medios', 'medias', 'amarillo', 'amarilla', 'amarillos', 'amarillas', 'medium', 'mediums'],
  hard: ['duro', 'dura', 'duros', 'duras', 'blanco', 'blanca', 'blancos', 'blancas', 'hard', 'hards'],
  intermediate: ['intermedio', 'intermedia', 'intermedios', 'intermedias', 'verde', 'verdes', 'inter', 'inters'],
  wet: ['lluvia', 'agua', 'extremo', 'extrema', 'extremos', 'extremas', 'wet', 'wets', 'azul', 'azules', 'mojado', 'mojados'],
};
const FORM_OF = new Map(Object.entries(COMPOUND_FORMS).flatMap(([k, forms]) => forms.map(f => [f, k])));
const compoundIn = words => { for (const w of words) if (FORM_OF.has(w)) return FORM_OF.get(w); return undefined; };
const GROUP_SEGMENTS = new Set(['chicos', 'los dos', 'equipo', 'ambos', 'vosotros dos', 'vosotros', 'chicas']);
/** [v3] El piloto al que se habla: un trozo de la frase entre comas que es solo su nombre (al principio, en medio o al
 * final); si no lo hay, un nombre al principio de la frase («Lance box, blandos»). Y si se habla a los dos. */
function addressee(text, context) {
  const parts = text.split(',').map(t => clean(t)).filter(Boolean);
  const carOf = seg => context.cars.find(c => c.names.includes(seg));
  for (const seg of parts) { const c = carOf(seg); if (c) return { car: c }; }
  if (parts.some(seg => GROUP_SEGMENTS.has(seg))) return { group: true };
  const words = tokens(text);
  const first = context.cars.find(c => c.names.includes(words[0]) || c.names.includes(`${words[0]} ${words[1]}`));
  return first ? { car: first } : {};
}
/** Los pilotos propios nombrados en la frase, en orden. */
function mentioned(text, context) {
  const words = tokens(text);
  return context.cars.map(c => ({ c, at: words.findIndex((w, i) => c.names.some(n => n === w || n === `${w} ${words[i + 1]}`)) })).filter(x => x.at >= 0).sort((x, y) => x.at - y.at).map(x => x.c);
}
function answerFor(text, clase, context, { rival = false } = {}) {
  const words = tokens(text);
  if (rival) return { json: { intent: forcedOf(clase)?.kind ?? 'ninguna', target: 'RIVAL', confianza: 'alta' }, parse: null };
  if (NO_ORDER.includes(clase)) return { json: { intent: 'ninguna', target: 'NADIE', confianza: 'baja' }, parse: null };
  const forced = forcedOf(clase);
  const parse = interpretSync(text, context, forced);
  // A quién se habla: el primer piloto propio nombrado; el grupo en ritmo; si no, NADIE (el juego usa el seleccionado).
  const named = context.cars.map(c => ({ c, at: words.findIndex((w, i) => c.names.some(n => n === w || n === `${w} ${words[i + 1]}`)) })).filter(x => x.at >= 0).sort((x, y) => x.at - y.at);
  const group = GROUP_WORDS.some(g => words.some((_, at) => g.every((x, k) => words[at + k] === x)));
  const who = addressee(text, context);
  const json = { intent: forced.kind, target: forced.kind === 'ritmo' && (group || who.group) ? 'LOS-DOS' : who.car ? carCode(who.car) : 'NADIE' };
  switch (forced.kind) {
    case 'boxes': { const c = compoundIn(words); if (c) json.compound = c; break; }
    case 'ritmo': json.paceMode = forced.value; break;
    case 'orden-equipo':
      json.teamMode = forced.value;
      if (forced.value === 'dejar-pasar') {
        // El favorecido: el compañero del destinatario; sin destinatario, el otro nombrado o el que va detrás.
        // Sin vocativo la orden va al seleccionado: el favorecido es el nombrado o, si no, el compañero del seleccionado.
        const other = who.car ? context.cars.find(c => c.id !== who.car.id) : mentioned(text, context)[0] ?? context.cars.find(c => c.id !== context.selectedCarId);
        const favoured = other ?? (parse.status === 'ok' ? context.cars.find(c => c.id === parse.intent.favouredCarId) : undefined) ?? [...context.cars].sort((x, y) => y.position - x.position)[0];
        json.favoured = carCode(favoured);
      }
      break;
    case 'propuesta': json.accept = forced.value; break;
    case 'delegar': json.delegated = forced.value; break;
  }
  json.confianza = 'alta';
  return { json, parse };
}

/** El JSON tiene que dar en el juego las mismas órdenes que las reglas (si las reglas dan orden). */
function consistent(json, parse, context) {
  if (json.intent === 'ninguna' || json.intent === 'orden-equipo' || json.target === 'RIVAL' || json.enVueltas !== undefined || json.vuelta !== undefined) return true;
  const back = answerToParse(JSON.stringify(json), context);
  if (json.intent === 'boxes') return back.status === 'ok' ? back.orders[0]?.kind === 'box' : back.status !== 'ok';
  if (parse.status !== 'ok') return back.status !== 'ok' || back.status === parse.status;
  // Mismo tipo de orden y mismo valor; el coche lo decide el vocativo (puede no ser el primer nombrado).
  const strip = orders => orders.map(({ carId, ...rest }) => rest);
  return back.status === 'ok' && JSON.stringify(strip(back.orders)) === JSON.stringify(strip(parse.orders));
}

/** [v3] Pone el nombre delante («Fer, entra») o, un 30 % de las veces, detrás («Entra, Fer»). */
const say = (prefix, body) => {
  if (!prefix) return cap(body);
  const name = prefix.replace(/, $/, '');
  return rand() < 0.3 ? `${cap(body)}, ${name}` : cap(prefix + body);
};
/** Igual para una frase del banco que ya empieza por «Nombre, …». */
const maybeMoveName = text => {
  const m = /^([^,]{1,24}), (.+)$/.exec(text);
  return m && rand() < 0.3 ? `${cap(m[2])}, ${m[1]}` : text;
};

const example = (context, text, json) => ({ messages: [
  { role: 'system', content: SYSTEM(context) },
  { role: 'user', content: text },
  { role: 'assistant', content: JSON.stringify(json) },
] });

// ---------- Generación ----------
const train = [], val = [], dropped = [];
const seen = new Set();
const stats = {};
// El reparto en train/val va por frase del banco, así sus variantes no caen a los dos lados.
const valPhrases = new Set(bank.filter(() => rand() < VAL_SHARE).map(e => e.texto));
for (const e of bank) {
  const target = valPhrases.has(e.texto) ? val : train;
  for (let v = 0; v < VARIANTS_PER_PHRASE; v++) {
    const teamId = v === 0 && rand() < 0.3 ? 'astonmartin' : pick(TEAM_IDS);
    const { spec, a, b } = teamContext(teamId);
    const text = maybeMoveName(e.texto.replace(A_RE, () => pick(callForms(a))).replace(B_RE, () => pick(callForms(b))));
    const key = `${teamId}|${clean(text)}`;
    if (seen.has(key) || reservaKeys.has(clean(text))) continue;
    seen.add(key);
    const context = contextFromSpec(spec);
    const { json, parse } = answerFor(text, e.clase, context);
    if (!consistent(json, parse, context)) { dropped.push(`${text} → ${JSON.stringify(json)}`); continue; }
    target.push(example(context, text, json));
    stats[json.intent] = (stats[json.intent] ?? 0) + 1;
  }
}
// Frases extra con más formas de las órdenes del juego (dejarse adelantar, paradas programadas…).
const EXTRA = {
  'equipo-dejar-pasar': ['déjate adelantar', 'déjate adelantar por {B}', 'déjate pasar por tu compañero', 'que te adelante {B}', 'no te defiendas de {B}, déjale pasar', 'levanta y deja que {B} te pase', 'cede la posición a {B} en la próxima recta', 'deja que {B} se ponga delante'],
  'equipo-mantener': ['no adelantes a {B}', 'quédate detrás de {B}', 'no ataques a {B}, posiciones congeladas', 'mantén el puesto respecto a {B}'],
  'equipo-libre': ['puedes atacar a {B}', 'tienes vía libre contra {B}', 'lucha con {B} si quieres'],
  'anular-boxes': ['ya no paras', 'olvida la parada programada', 'no entras en la próxima', 'cancela la parada de la vuelta que viene'],
  'propuesta-aceptar': ['haz lo que te ha propuesto el estratega', 'acepto la parada que propone el muro', 'sí a la propuesta'],
  'propuesta-descartar': ['no aceptes la propuesta', 'ignora lo que sugiere el estratega'],
  'delegar-si': ['que el estratega decida tus paradas', 'pon la estrategia en automático'],
  'delegar-no': ['las paradas las decido yo desde el muro', 'sin automático, mando yo'],
};
const N = ['una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'diez', 'doce'];
const NUM = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, diez: 10, doce: 12 };
const DELAYED = ['para en {n} vueltas', 'entra dentro de {n} vueltas', 'box en {n} vueltas', 'parada en {n} vueltas con {c}', 'en {n} vueltas entras a por {c}', 'aguanta {n} vueltas más y entra', 'te queremos dentro en {n} vueltas, {c}'];
const AT_LAP = ['para en la vuelta {l}', 'entra en la vuelta {l} con {c}', 'parada en la vuelta {l}', 'box en la vuelta {l}, {c}'];
const CWORD = { soft: ['blandos', 'rojos', 'blandas', 'rojas'], medium: ['medios', 'amarillos', 'medias', 'amarillas'], hard: ['duros', 'blancos', 'duras', 'blancas'], intermediate: ['intermedios', 'verdes', 'intermedias'], wet: ['de lluvia', 'azules', 'de agua', 'extremas'] };
for (let i = 0; i < 900; i++) {
  const teamId = pick(TEAM_IDS);
  const { spec, a, b } = teamContext(teamId);
  const context = contextFromSpec(spec);
  const [me, mate] = rand() < 0.5 ? [a, b] : [b, a];
  const meCar = context.cars.find(c => c.driverId === me.id);
  const prefix = rand() < 0.75 ? `${pick(callForms(me))}, ` : '';
  // Sin nombre, la orden va al seleccionado: que sea el piloto de la frase (si no, «deja que te pase X» se lo diría a X).
  if (!prefix) context.selectedCarId = meCar.id;
  const isVal = rand() < VAL_SHARE;
  if (i % 3 === 0) {
    // Parada programada: el JSON lleva enVueltas o vuelta (el juego todavía no la ejecuta).
    const comp = rand() < 0.6 ? pick(Object.keys(CWORD)) : null;
    let text, json;
    if (rand() < 0.65) {
      const nw = pick(N), n = NUM[nw];
      const body = pick(DELAYED.filter(t => comp || !t.includes('{c}'))).replace('{n}', rand() < 0.5 ? nw : String(n)).replace('{c}', comp ? pick(CWORD[comp]) : '');
      text = say(prefix, body); json = { intent: 'boxes', target: prefix ? carCode(meCar) : 'NADIE', enVueltas: n };
    } else {
      const l = 5 + Math.floor(rand() * 50);
      const body = pick(AT_LAP.filter(t => comp || !t.includes('{c}'))).replace('{l}', String(l)).replace('{c}', comp ? pick(CWORD[comp]) : '');
      text = say(prefix, body); json = { intent: 'boxes', target: prefix ? carCode(meCar) : 'NADIE', vuelta: l };
    }
    if (comp) json.compound = comp;
    json.confianza = 'alta';
    if (reservaKeys.has(clean(text))) continue;
    (isVal ? val : train).push(example(context, cap(text), json));
    stats['boxes-programada'] = (stats['boxes-programada'] ?? 0) + 1;
    continue;
  }
  const clase = pick(Object.keys(EXTRA));
  const text = say(prefix, pick(EXTRA[clase]).replace('{B}', pick(callForms(mate))));
  if (reservaKeys.has(clean(text))) continue;
  const { json, parse } = answerFor(text, clase, context);
  if (!consistent(json, parse, context)) { dropped.push(`${text} → ${JSON.stringify(json)}`); continue; }
  (isVal ? val : train).push(example(context, text, json));
  stats[json.intent] = (stats[json.intent] ?? 0) + 1;
}

// ---------- [v2] Datos donde fallaba la versión 1 (respuestas escritas directamente) ----------
const V2 = {
  ninguna: ['¿qué tal vas?', '¿cómo notas el coche?', 'buena vuelta', 'muy bien, sigue así', 'ánimo', '¿me oyes?', '¿me recibes?', 'radio check', 'el de detrás está a dos segundos',
    'tienes a {B} a medio segundo', 'vas sexto', 'hay bandera amarilla en el sector uno', 'cuidado, aceite en la curva cuatro', 'viene lluvia en diez minutos', 'hace mucho viento en la recta',
    '¿cómo van los frenos?', '¿qué tal el equilibrio?', '¿tienes subviraje?', 'buen adelantamiento', 'gran salida', 'tranquilo, todo controlado', 'estamos contigo', 'qué calor hace hoy',
    'el público está loco', 'te estamos mirando', '¿todo bien ahí dentro?', 'la temperatura de pista sube', 'vas mejor que {B}', 'el líder está a veinte segundos', 'última vuelta del líder',
    'gracias por el esfuerzo', 'perfecto', 'entendido', 'vale, copiado', '¿cómo estás?', 'respira hondo', 'buen trabajo con las gomas', 'el de delante tiene problemas', 'tráfico en el sector tres', 'te copio'],
  doble: ['entra y ataca', 'ahorra y aprieta', 'deja pasar a {B} y entra', 'quédate fuera y para', 'acepta la propuesta y decide tú', 'mantened posiciones pero pelead', 'cuida las gomas y dale caña',
    'para ahora y no entres', 'ritmo normal y a tope', 'entra con duras y ataca a {B}', 'delega pero mando yo', 'descarta la propuesta y entra', 'ataca a {B} pero no le adelantes', 've a tope y levanta'],
  ataque: ['enséñales lo que tienes', 'a por él sin piedad', 'sácale décimas', 'persíguelo sin descanso', 'no le dejes respirar', 'quiero tiempos de pole', 'dale todo lo que tengas', 'es la hora de la verdad, empuja',
    'acelera, que lo pillas', 'vuela', 'exprímelo', 'aprieta los dientes', 'a cazar al de delante', 'quiero tu mejor vuelta ahora', 'modo carrera al máximo', 'todo o nada', 'vamos, vamos, empuja', 'sube el ritmo ya',
    'que se note que vas rápido', 'a muerte hasta la bandera', 'pon el cuchillo entre los dientes', 'saca el máximo partido', 'tira, tira', 'rompe el crono'],
  ahorro: ['mima las ruedas', 'protege las traseras', 'cuida los neumáticos, quedan muchas vueltas', 'baja el ritmo, vamos justos', 'ahorra gasolina', 'gestiona el desgaste', 'no castigues las gomas',
    've con calma', 'levanta antes de la frenada', 'conserva combustible', 'llévalo suave', 'sin forzar el coche', 'cuida los frenos', 'hay que llegar con estas gomas', 'reserva neumáticos para el final', 'dosifica'],
  normal: ['vuelve a tu ritmo', 'ritmo normal otra vez', 'deja de atacar, normal', 'ya no hace falta ahorrar', 'ritmo de crucero', 'conduce normal', 'vuelve al ritmo de siempre', 'ni apretar ni guardar', 'ritmo estándar'],
  dejar: ['deja que te pase {B}', 'permite el adelantamiento de {B}', 'haz hueco a {B}', 'apártate para {B}', 'que {B} se ponga delante', 'deja pasar a {B}', '{B} tiene que ir por delante de ti',
    'cédele el puesto a {B}', 'no defiendas de {B}', 'levanta en la recta para que pase {B}', 'que te supere {B}', 'retírate un poco y que pase {B}', 'deja que {B} te adelante en la próxima recta',
    'tu compañero va más rápido, apártate', 'no le pongas difícil a tu compañero, que pase', 'deja que te adelante tu compañero', 'abre la puerta a {B}'],
  mantener: ['no ataques a {B}', 'quédate donde estás respecto a {B}', 'nada de pelear con {B}', 'nadie adelanta a nadie', 'posiciones congeladas', 'sin luchas internas', 'mantened el orden',
    'no te juegues el coche con {B}', 'nadie se mueve hasta la bandera', 'quietos los dos', 'respeta la posición de {B}', 'no adelantes a tu compañero'],
  libre: ['puedes pelear con {B}', 'tienes permiso para pasar a {B}', 'vía libre contra tu compañero', 'si puedes, adelanta a {B}', 'podéis atacaros', 'se acabó la orden de equipo', 'lucha con {B} limpio',
    'carrera abierta entre vosotros', 'compite con tu compañero', 'ya podéis pelear entre vosotros'],
  anular: ['al final no paras', 'falsa alarma, no hace falta cambiar ruedas', 'seguimos con estas gomas', 'pasa por recta sin entrar', 'retiramos la llamada a boxes', 'cancelada la parada', 'olvídate de boxes',
    'no entres, quédate en pista', 'nada de parar, sigue', 'abortamos la entrada', 'la parada se suspende', 'aguanta fuera'],
  boxes: ['vente a cambiar ruedas, {c}', 'te esperamos en el garaje, {c}', 'pasa por boxes, {c}', 'entra ya, montamos {c}', 'los mecánicos están listos, entra', 'tienes que pasar por el garaje',
    'cambio de gomas esta vuelta, {c}', 'te toca venir a cambiar, ruedas {c}', 'carril de boxes ahora, neumáticos {c}', 'para ya, que hay {c} esperando'],
  delegarSi: ['que lo gestione el estratega', 'activad el modo automático', 'deja que decida el muro', 'el estratega se encarga', 'estrategia en automático', 'que elija el estratega las paradas', 'os dejo la estrategia'],
  delegarNo: ['recupero las decisiones', 'llevo yo la estrategia', 'quita el piloto automático', 'decido yo las paradas', 'el estratega ya no manda', 'paso a manual', 'mando yo desde ahora'],
  aceptar: ['vale, lo que dice el estratega', 'me gusta el plan, adelante', 'aceptamos la recomendación', 'sí, hagámoslo', 'de acuerdo con la propuesta', 'ok, aplica el plan'],
  descartar: ['olvídalo', 'esa propuesta no', 'ni hablar de ese plan', 'no hagas caso al estratega', 'descártalo', 'rechazamos la idea'],
};
// [v3] Más paradas sin compuesto y pares opuestos.
Object.assign(V2, {
  boxesSin: ['entra esta vuelta', 'te queremos dentro', 'vente al garaje', 'pasa por boxes', 'hora de parar', 'toca cambiar ruedas', 'los mecánicos te esperan', 'a cambiar neumáticos',
    'esta vuelta paramos', 'entra cuando pases por meta', 'vente dentro ya', 'cambio de ruedas ahora', 'parada en esta vuelta', 'te toca entrar', 'carril de boxes ya'],
  normalOpuesto: ['deja de atacar, ritmo normal', 'se acabó el ataque, vuelve a lo normal', 'quita el modo ataque', 'ya no aprietes, ritmo de carrera', 'baja la intensidad, ritmo estándar', 'para de empujar, normal',
    'deja de ahorrar, ritmo normal', 'ya no hace falta cuidar tanto, normal'],
  descartarFuerte: ['fuera esa idea', 'esa propuesta a la basura', 'ni de broma', 'la idea del estratega, fuera', 'eso no lo hacemos', 'no, descártala', 'tira esa propuesta'],
  delegarNoMio: ['la estrategia es mía', 'las decisiones son mías', 'decido yo, no el estratega', 'el estratega fuera, mando yo', 'mía la decisión de parar', 'no decide nadie más que yo'],
  mantenerDetras: ['aguanta detrás de {B}', 'quédate detrás de {B} sin atacar', 'no pases a {B}', 'sigue detrás de tu compañero', 'nada de adelantar a {B}'],
  libreOpuesto: ['ya puedes atacar a {B}', 've a por {B} si puedes', 'puedes adelantar a tu compañero', 'tienes permiso para pelear con {B}'],
  doble2: ['quédate fuera y para', 'entra pero no pares', 'para y ataca', 'cuida las gomas y ataca a fondo', 'deja pasar a {B} y entra en boxes', 'acepta el plan y que decida el estratega',
    'mantened posiciones y pelead', 'entra con blandas y ahorra', 'ritmo normal y a tope', 'decido yo y que decida el muro'],
});
const V2_COUNT = { boxesSin: 400, normalOpuesto: 220, descartarFuerte: 160, delegarNoMio: 160, mantenerDetras: 180, libreOpuesto: 150, doble2: 300, ninguna: 700, doble: 300, ataque: 450, ahorro: 300, normal: 150, dejar: 450, mantener: 250, libre: 250, anular: 250, boxes: 300, delegarSi: 150, delegarNo: 150, aceptar: 120, descartar: 120 };
const GROUP_PREFIX = ['Chicos, ', 'Los dos, ', 'Equipo, ', 'Ambos, '];
for (const [kind, n] of Object.entries(V2_COUNT)) {
  for (let i = 0; i < n; i++) {
    const teamId = pick(TEAM_IDS);
    const { spec, a, b } = teamContext(teamId);
    const context = contextFromSpec(spec);
    const [me, mate] = rand() < 0.5 ? [a, b] : [b, a];
    const meCar = context.cars.find(c => c.driverId === me.id);
    const mateCar = context.cars.find(c => c.driverId === mate.id);
    const groupable = ['ataque', 'ahorro', 'normal', 'normalOpuesto'].includes(kind) && rand() < 0.15;
    const prefix = groupable ? pick(GROUP_PREFIX) : rand() < 0.8 ? `${pick(callForms(me))}, ` : '';
    // Sin nombre, la orden va al seleccionado: que sea el piloto de la frase (si no, «deja que te pase X» se lo diría a X).
    if (!prefix) context.selectedCarId = meCar.id;
    const comp = pick(Object.keys(CWORD));
    let body = pick(V2[kind]).replaceAll('{B}', pick(callForms(mate)));
    const usesComp = body.includes('{c}');
    body = body.replace('{c}', pick(CWORD[comp]));
    const text = say(prefix, body);
    if (reservaKeys.has(clean(text))) continue;
    const target = groupable ? 'LOS-DOS' : prefix ? carCode(meCar) : 'NADIE';
    const json = { ninguna: () => ({ intent: 'ninguna', target: 'NADIE' }), doble: () => ({ intent: 'ninguna', target: 'NADIE' }),
      ataque: () => ({ intent: 'ritmo', target, paceMode: 'push' }), ahorro: () => ({ intent: 'ritmo', target, paceMode: 'save' }), normal: () => ({ intent: 'ritmo', target, paceMode: 'balanced' }),
      dejar: () => ({ intent: 'orden-equipo', target, teamMode: 'dejar-pasar', favoured: carCode(mateCar) }),
      mantener: () => ({ intent: 'orden-equipo', target, teamMode: 'mantener' }), libre: () => ({ intent: 'orden-equipo', target, teamMode: 'libre' }),
      anular: () => ({ intent: 'anular-boxes', target }), boxes: () => ({ intent: 'boxes', target, ...(usesComp ? { compound: comp } : {}) }),
      delegarSi: () => ({ intent: 'delegar', target, delegated: true }), delegarNo: () => ({ intent: 'delegar', target, delegated: false }),
      boxesSin: () => ({ intent: 'boxes', target }), normalOpuesto: () => ({ intent: 'ritmo', target, paceMode: 'balanced' }),
      descartarFuerte: () => ({ intent: 'propuesta', target, accept: false }), delegarNoMio: () => ({ intent: 'delegar', target, delegated: false }),
      mantenerDetras: () => ({ intent: 'orden-equipo', target, teamMode: 'mantener' }), libreOpuesto: () => ({ intent: 'orden-equipo', target, teamMode: 'libre' }),
      doble2: () => ({ intent: 'ninguna', target: 'NADIE' }),
      aceptar: () => ({ intent: 'propuesta', target, accept: true }), descartar: () => ({ intent: 'propuesta', target, accept: false }) }[kind]();
    json.confianza = json.intent === 'ninguna' ? 'baja' : 'alta';
    const key = `v2|${teamId}|${clean(text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (rand() < VAL_SHARE ? val : train).push(example(context, text, json));
    stats[`v2-${kind}`] = (stats[`v2-${kind}`] ?? 0) + 1;
  }
}

// Órdenes a un piloto rival: el piloto contesta RIVAL y no se aplica nada.
const RIVAL_BODIES = ['entra esta vuelta', 'ataca ya', 'deja pasar a tu compañero', 'cuida las gomas', 'box, duros', 'quédate fuera'];
const RIVAL_CLASS = ['boxes', 'ritmo-ataque', 'equipo-dejar-pasar', 'ritmo-ahorro', 'boxes', 'anular-boxes'];
for (let i = 0; i < 240; i++) {
  const teamId = pick(TEAM_IDS);
  const { spec } = teamContext(teamId);
  const rivalDriver = pick(Object.values(DRIVERS).filter(d => d.teamId !== teamId));
  const k = i % RIVAL_BODIES.length;
  const text = `${pick(callForms(rivalDriver))}, ${RIVAL_BODIES[k]}`;
  const context = contextFromSpec(spec);
  (rand() < VAL_SHARE ? val : train).push(example(context, text, answerFor(text, RIVAL_CLASS[k], context, { rival: true }).json));
  stats.RIVAL = (stats.RIVAL ?? 0) + 1;
}
// Test: la reserva, en el contexto base de las pruebas del juego (nunca en train/val).
const base = contextFromSpec(structuredClone(phrases.contextos.base));
const test = [];
for (const f of reserva) {
  const { json } = answerFor(f.texto, f.clase, base);
  test.push({ ...example(base, f.texto, json), clase: f.clase, coche: f.coche, lote: f.lote });
}

// Test 2: la reserva v2, escrita antes de las plantillas de la versión 2.
const test2 = reservaV2.map(f => {
  const json = { ...f.j, confianza: f.j.intent === 'ninguna' ? 'baja' : 'alta' };
  const coche = f.j.target === 'STR' ? 10 : 9;
  return { ...example(base, f.t, json), clase: f.c, coche, lote: 'v2' };
});

// La reserva v2 tiene que quedar limpia: fuera de train/val cualquier ejemplo con la misma frase, aunque cambie el nombre.
const bodyOf = t => clean(t).replace(/^\S+ /, '');
/** Lo que dice la frase sin los trozos que son solo un nombre o un grupo, esté el nombre delante, en medio o detrás. */
const ALL_NAMES = new Set([...Object.keys(DRIVERS).flatMap(id => radioNamesById(id)), ...GROUP_SEGMENTS]);
const coreOf = t => { const kept = t.split(',').map(x => clean(x)).filter(x => x && !ALL_NAMES.has(x)); return kept.length ? [kept.join(' ')] : []; };
const v2Bodies = new Set([...reservaV2, ...reservaV3].flatMap(f => [clean(f.t), ...coreOf(f.t)]));
const leaks = x => [clean(x.messages[1].content), ...coreOf(x.messages[1].content)].some(k => v2Bodies.has(k));
for (const list of [train, val]) { const before = list.length; const kept = list.filter(x => !leaks(x)); list.length = 0; list.push(...kept); stats.quitadosPorReservaV2 = (stats.quitadosPorReservaV2 ?? 0) + before - kept.length; }

const test3 = reservaV3.map(f => {
  const json = { ...f.j, confianza: f.j.intent === 'ninguna' ? 'baja' : 'alta' };
  return { ...example(base, f.t, json), clase: f.c, coche: f.j.target === 'STR' ? 10 : 9, lote: 'v3' };
});

// [IA7] Correcciones del jugador (archivo exportado desde Ajustes): cada una con su contexto de carrera y su JSON.
if (CORRECTIONS) {
  const file = JSON.parse(readFileSync(CORRECTIONS, 'utf8'));
  if (file.formato !== 'radio-correcciones' || !Array.isArray(file.frases)) throw new Error('El archivo no es de correcciones de la radio');
  const c = { añadidas: 0, repetidas: 0, excluidasPorReserva: 0, descartadas: 0 };
  const already = new Set([...train, ...val].map(x => `${x.messages[0].content.split('\n').slice(6, 8).join('|')}|${clean(x.messages[1].content)}`));
  for (const f of file.frases) {
    const context = f.ctx;
    if (!context?.cars?.length || typeof f.t !== 'string' || !f.j?.intent) { c.descartadas++; continue; }
    const x = example(context, f.t, f.j);
    if (reservaKeys.has(clean(f.t)) || leaks(x)) { c.excluidasPorReserva++; continue; }
    const key = `${x.messages[0].content.split('\n').slice(6, 8).join('|')}|${clean(f.t)}`;
    if (already.has(key)) { c.repetidas++; continue; }
    already.add(key);
    train.push(x);
    c.añadidas++;
  }
  stats.correcciones = c;
  console.log(`correcciones: ${JSON.stringify(c)}`);
}

// Mezcla reproducible.
for (const list of [train, val]) for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
mkdirSync(OUT, { recursive: true });
const jsonl = list => list.map(x => JSON.stringify(x)).join('\n') + '\n';
writeFileSync(join(OUT, 'train.jsonl'), jsonl(train));
writeFileSync(join(OUT, 'val.jsonl'), jsonl(val));
writeFileSync(join(OUT, 'test.jsonl'), jsonl(test));
writeFileSync(join(OUT, 'test2.jsonl'), jsonl(test2));
writeFileSync(join(OUT, 'test3.jsonl'), jsonl(test3));
writeFileSync(join(OUT, 'schema.json'), JSON.stringify(JSON.parse(buildIntentSchema(base)), null, 2));
writeFileSync(join(OUT, 'stats.json'), JSON.stringify({ correcciones: stats.correcciones ?? null, seed: SEED, train: train.length, val: val.length, test: test.length, test2: test2.length, test3: test3.length, porIntencion: stats, descartados: dropped.length, ejemplosDescartados: dropped.slice(0, 20) }, null, 2));
console.log(`train ${train.length} · val ${val.length} · test ${test.length} · test2 ${test2.length} · test3 ${test3.length} · descartados ${dropped.length}`);
console.log(JSON.stringify(stats));
await server.close();
