// IA9 — Banco de respuestas escrito por un agente (Sprint 6).
// Contrato aprobado por el usuario el 23/10/2026 (ficha de IA9 en DASHBOARD.md), con 30 variantes por carácter y tipo:
// [IA3] El 23/10/2026 el usuario autoriza pasar de 22 a 24 tipos (tarde y desobedece).
//  1. Cada carácter × tipo tiene al menos 30 variantes distintas, y todas usan solo los huecos permitidos y se
//     rellenan sin llaves.
//  2. Ninguna contiene nombres reales ni palabras vetadas (filtro de IA5 y lista de parody-names), y ninguna pasa de 2
//     frases y 90 caracteres.
//  3. La elección sigue las reglas de IA2 (semilla reproducible, sin repetir seguida) con el banco.
//  4. El banco no va en el paquete principal; si no carga, se usan las plantillas de IA2 sin errores.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { TEMPERAMENTS, REPLY_KINDS, CALL_KINDS, TEMPLATES } = await load('/src/radio/replies/templates.ts');
  const { createChooser, seededRandom, fillTemplate, setReplyBank, activeBank } = await load('/src/radio/replies/chooser.ts');
  const { loadReplyBank, validateBank, ALLOWED_SLOTS, MIN_VARIANTS, MAX_CHARS } = await load('/src/radio/replies/bankLoader.ts');
  const { isBanned, filterReply } = await load('/src/radio/llm/replyFilter.ts');
  const KINDS = [...REPLY_KINDS, ...CALL_KINDS];
  const bank = Object.fromEntries(TEMPERAMENTS.map(t => [t, JSON.parse(readFileSync(`src/radio/replies/bank/${t}.json`, 'utf8'))]));
  const VARS = { compuesto: 'duros', companero: 'Lance', vuelta: 23, motivo: 'no quedan juegos de ese compuesto' };

  await test('Radio IA9: 30 variantes por carácter y tipo, con sus huecos', () => {
    assert(MIN_VARIANTS === 30 && KINDS.length === 24, 'Radio IA9: 30 variantes y 24 tipos de respuesta y llamada (IA3 añade tarde y desobedece)', `${MIN_VARIANTS} · ${KINDS.length}`);
    const short = [], slots = [], braces = [], extra = [];
    for (const t of TEMPERAMENTS) {
      extra.push(...Object.keys(bank[t]).filter(k => !KINDS.includes(k)).map(k => `${t}/${k}`));
      for (const k of KINDS) {
        const list = bank[t][k] ?? [];
        if (new Set(list.map(s => s.trim().toLowerCase())).size < 30) short.push(`${t}/${k}: ${new Set(list).size}`);
        for (const s of list) {
          const used = [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
          if (used.some(u => !(ALLOWED_SLOTS[k] ?? []).includes(u))) slots.push(`${t}/${k}: ${s}`);
          if (/[{}]/.test(fillTemplate(s, VARS)) || /[{}]/.test(fillTemplate(s, {}))) braces.push(`${t}/${k}: ${s}`);
        }
      }
    }
    assert(extra.length === 0, 'Radio IA9: solo los tipos de IA2', extra.join(', '));
    assert(short.length === 0, 'Radio IA9: al menos 30 variantes distintas en cada lista', short.slice(0, 8).join(' | '));
    assert(slots.length === 0, 'Radio IA9: solo los huecos de cada tipo', slots.slice(0, 5).join(' | '));
    assert(braces.length === 0, 'Radio IA9: se rellenan sin llaves (con y sin datos)', braces.slice(0, 5).join(' | '));
    assert(validateBank(bank) !== null, 'Radio IA9: el cargador da el banco por bueno');
  });

  await test('Radio IA9: sin nombres reales, palabras vetadas ni frases largas', () => {
    const banned = [], long = [], filtered = [];
    for (const t of TEMPERAMENTS) for (const k of KINDS) for (const s of bank[t][k] ?? []) {
      const text = fillTemplate(s, VARS);
      if (isBanned(text)) banned.push(`${t}/${k}: ${s}`);
      const sentences = text.match(/[^.!?…]+[.!?…]*/g)?.filter(x => x.trim()) ?? [];
      if (s.length > MAX_CHARS || sentences.length > 2) long.push(`${t}/${k}: ${s}`);
      if (filterReply(text, '\u0000') !== text) filtered.push(`${t}/${k}: ${s}`);
    }
    assert(MAX_CHARS === 90, 'Radio IA9: 90 caracteres como mucho');
    assert(banned.length === 0, 'Radio IA9: ningún nombre real ni palabra vetada', banned.slice(0, 5).join(' | '));
    assert(long.length === 0, 'Radio IA9: 2 frases y 90 caracteres como mucho', long.slice(0, 5).join(' | '));
    assert(filtered.length === 0, 'Radio IA9: todas pasan el filtro de IA5', filtered.slice(0, 5).join(' | '));
    const odd = TEMPERAMENTS.flatMap(t => KINDS.flatMap(k => bank[t][k] ?? [])).filter(x => /[\p{Extended_Pictographic}"'«»“”‘’]/u.test(x));
    assert(odd.length === 0, 'Radio IA9: sin emojis ni comillas dentro de las frases', odd.slice(0, 5).join(' | '));
  });

  await test('Radio IA9: la elección con el banco sigue las reglas de IA2', async () => {
    setReplyBank(validateBank(bank));
    try {
      const run = seed => { const c = createChooser(seededRandom(seed)); return Array.from({ length: 60 }, (_, i) => c.pick(i % 2 ? 'stroll' : 'alonso', 'bromista', 'ok-boxes', VARS)); };
      const a = run(7), b = run(7);
      assert(JSON.stringify(a) === JSON.stringify(b), 'Radio IA9: con la misma semilla, las mismas frases');
      const mine = a.filter((_, i) => i % 2 === 0);
      assert(mine.every((r, i) => i === 0 || r.variant !== mine[i - 1].variant), 'Radio IA9: nunca la misma seguida para un piloto');
      assert(mine.every((r, i) => !mine.slice(Math.max(0, i - 10), i).some(p => p.variant === r.variant)), 'Radio IA9: ni una de las 10 últimas del mismo piloto y tipo');
      assert(a.some(r => r.variant >= 3) && a.every(r => !/[{}]/.test(r.text) && bank.bromista['ok-boxes'].map(s => fillTemplate(s, VARS)).includes(r.text)), 'Radio IA9: las frases salen del banco, rellenas');
      const call = createChooser(seededRandom(3)).pick('alonso', 'quejica', 'desgaste', { vuelta: 12 });
      assert(bank.quejica.desgaste.map(s => fillTemplate(s, { vuelta: 12 })).includes(call.text), 'Radio IA9: también las llamadas del piloto', call.text);
    } finally { setReplyBank(null); }
  });

  await test('Radio IA9: sin banco, las plantillas de IA2', async () => {
    assert(activeBank() === null, 'Radio IA9: al arrancar no hay banco');
    const ia2 = createChooser(seededRandom(1)).pick('alonso', 'frio', 'ok-boxes', VARS);
    assert(TEMPLATES.frio['ok-boxes'].map(s => fillTemplate(s, VARS)).includes(ia2.text), 'Radio IA9: sin banco se usan las de IA2', ia2.text);
    const broken = await loadReplyBank(async () => { throw new Error('sin red'); });
    assert(broken === false && activeBank() === null, 'Radio IA9: si el banco no carga, siguen las de IA2');
    const bad = await loadReplyBank(async () => ({ frio: { 'ok-boxes': ['Solo una'] } }));
    assert(bad === false && activeBank() === null, 'Radio IA9: un banco incompleto se descarta');
    const after = createChooser(seededRandom(2)).pick('alonso', 'competitivo', 'repetir', {});
    assert(TEMPLATES.competitivo.repetir.includes(after.text), 'Radio IA9: y la radio sigue contestando sin errores', after.text);
    const ok = await loadReplyBank();
    assert(ok === true && activeBank() !== null, 'Radio IA9: el banco real carga con import()');
    setReplyBank(null);
    const src = readFileSync('src/radio/replies/bankLoader.ts', 'utf8');
    assert(/import\(\s*['"]\.\/bank\//.test(src) && !/^import[^(]*bank\/\w+\.json/m.test(src), 'Radio IA9: los archivos del banco se piden con import()');
  });

  await test('Radio IA9: el banco no va en el paquete principal', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'f1-ia9-build-'));
    const marker = bank.bromista.pinchazo.find(s => !TEMPLATES.bromista.pinchazo.includes(s) && !/[{}]/.test(s)) ?? bank.bromista.pinchazo[5];
    try {
      const { build } = await import('vite');
      await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true, reportCompressedSize: false } });
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const entry = [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.js)"/g)].map(m => m[1]);
      const assets = readdirSync(join(outDir, 'assets')).filter(f => f.endsWith('.js'));
      const json = s => JSON.stringify(s).slice(1, -1);
      const has = file => { const code = readFileSync(join(outDir, file), 'utf8'); return code.includes(marker) || code.includes(json(marker)); };
      assert(entry.length > 0 && !entry.some(has), 'Radio IA9: lo que carga index.html no contiene el banco', marker);
      assert(assets.some(f => has(join('assets', f))), 'Radio IA9: el banco va en un trozo aparte');
    } finally { rmSync(outDir, { recursive: true, force: true }); }
  });
}
