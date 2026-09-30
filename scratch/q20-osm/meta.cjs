const fs = require('fs'); const m = require('../q20-meta.json');
for (const [id, v] of Object.entries(m)) if (v.relation) {
  const x = fs.readFileSync(`rel/${v.relation}.xml`, 'utf8'); const i = x.indexOf(`<relation id="${v.relation}"`); const head = x.slice(i, x.indexOf('>', i));
  v.relVersion = { version: +head.match(/version="(\d+)"/)[1], timestamp: head.match(/timestamp="([^"]+)"/)[1] };
}
fs.writeFileSync('../q20-meta.json', JSON.stringify(m, null, 1));
for (const [id, v] of Object.entries(m)) console.log(id.padEnd(12), v.relation, v.relVersion ? `v${v.relVersion.version} ${v.relVersion.timestamp.slice(0, 10)}` : '-');
