const rels = require('./relations.json'); const { execSync } = require('child_process'); const fs = require('fs');
fs.mkdirSync('rel', { recursive: true });
for (const [cid, list] of Object.entries(rels)) for (const r of list) {
  const f = `rel/${r.id}.xml`;
  if (!fs.existsSync(f)) execSync(`curl -s -m 110 -A "F1Sim-research/1.0 (personal project)" -o ${f} "https://api.openstreetmap.org/api/0.6/relation/${r.id}/full"`);
  const x = fs.readFileSync(f, 'utf8');
  const i0 = x.indexOf(`<relation id="${r.id}"`); const rel = x.slice(i0, x.indexOf('</relation>', i0));
  const roles = {}; for (const m of rel.matchAll(/role="([^"]*)"/g)) roles[m[1] || '(track)'] = (roles[m[1] || '(track)'] || 0) + 1;
  const tags = Object.fromEntries([...rel.matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g)].filter(m => !/^name:|wiki|source|website|opening|url/.test(m[1]) || m[1] === 'name:en').map(m => [m[1], m[2]]));
  console.log(cid.padEnd(12), r.id.padEnd(9), JSON.stringify(roles), JSON.stringify(tags).slice(0, 230));
}
