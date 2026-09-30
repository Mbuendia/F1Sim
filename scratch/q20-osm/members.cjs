const fs = require('fs');
for (const rid of process.argv.slice(2)) {
  const x = fs.readFileSync(`rel/${rid}.xml`, 'utf8'); const i = x.indexOf(`<relation id="${rid}"`); const rel = x.slice(i, x.indexOf('</relation>', i));
  const ways = new Map([...x.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)].map(m => [m[1], m[2]]));
  const counts = {};
  for (const m of rel.matchAll(/<member type="(\w+)" ref="(\d+)" role="([^"]*)"\/>/g)) {
    const b = ways.get(m[2]) || ''; const t = Object.fromEntries([...b.matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g)].map(z => [z[1], z[2]]));
    const k = `${m[1]} role=${m[3] || '-'} ${t.highway || ''} ${t.name || t['name:en'] || ''} ${t.oneway || ''} ${t.fixme ? 'FIXME' : ''}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  console.log('== ', rid); for (const [k, v] of Object.entries(counts)) console.log(v, k);
}
