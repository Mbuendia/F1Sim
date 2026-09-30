// Q20: escribe en src/data/circuits.ts las entradas/salidas VERIFICADAS de la fixture.
const fs = require('fs'); const p = '../src/data/circuits.ts'; let s = fs.readFileSync(p, 'utf8');
const refs = require('../tests/fixtures/pit-lane-references.json');
const commitment = { barcelona: -0.025, monaco: -0.03 }; // distancia calibrada previa a la entrada, conservada
const r4 = v => Math.round(v * 10000) / 10000;
for (const [id, ref] of Object.entries(refs)) {
  if (id === '_nota' || ref.status !== 'VERIFICADO') continue;
  const start = s.search(new RegExp('\n  \'?' + id + '\'?: \{'));
  if (start < 0) throw new Error('sin bloque ' + id);
  const next = s.slice(start + 5).search(/\n  '?[a-z-]+'?: \{/);
  const end = next < 0 ? s.length : start + 5 + next;
  let block = s.slice(start, end);
  const set = (key, value) => {
    const re = new RegExp('(' + key + ': )[0-9.]+');
    if (!re.test(block)) throw new Error(id + ' sin ' + key);
    block = block.replace(re, '$1' + value);
  };
  set('pitEntryT', ref.entryT); set('pitExitT', ref.exitT);
  const c = commitment[id] !== undefined ? r4(((ref.entryT + commitment[id]) % 1 + 1) % 1) : null;
  if (c !== null) set('pitCommitmentT', c);
  else if (/pitCommitmentT: /.test(block)) throw new Error(id + ' tiene compromiso explícito no previsto');
  s = s.slice(0, start) + block + s.slice(end);
  console.log(id.padEnd(12), ref.entryT, ref.exitT, c !== null ? 'compromiso ' + c : '');
}
fs.writeFileSync(p, s);
