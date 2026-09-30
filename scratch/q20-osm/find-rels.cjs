const cs = require('./circuits.json'); const { execSync } = require('child_process'); const fs = require('fs');
const get = url => execSync(`curl -s -m 110 -A "F1Sim-research/1.0 (personal project)" "${url}"`, { maxBuffer: 1 << 28 }).toString();
const out = {};
for (const c of cs) {
  let xml = fs.existsSync(c.id + '.xml') && fs.statSync(c.id + '.xml').size > 1000 ? fs.readFileSync(c.id + '.xml', 'utf8') : null;
  let d = 0.004;
  while (!xml || !/v="raceway"/.test(xml)) {
    const dn = d / Math.cos(c.lat * Math.PI / 180);
    xml = get(`https://api.openstreetmap.org/api/0.6/map?bbox=${[c.lon - dn, c.lat - d, c.lon + dn, c.lat + d].map(v => v.toFixed(5))}`);
    if (!xml.startsWith('<?xml')) { d /= 2; xml = null; if (d < 0.0005) break; continue; }
    if (!/v="raceway"/.test(xml)) d *= 1.6;
    if (d > 0.02) break;
  }
  const rels = new Map();
  for (const m of (xml || '').matchAll(/<relation id="(\d+)"[^>]*>([\s\S]*?)<\/relation>/g))
    if (/k="type" v="circuit"/.test(m[2])) rels.set(m[1], (m[2].match(/k="name" v="([^"]*)"/) || [])[1]);
  if (!rels.size) { // relaciones no incluidas en el bbox: preguntar por las vías raceway
    const ways = [...(xml || '').matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)].filter(m => /v="raceway"/.test(m[2])).map(m => m[1]).slice(0, 6);
    for (const w of ways) for (const m of get(`https://api.openstreetmap.org/api/0.6/way/${w}/relations`).matchAll(/<relation id="(\d+)"[^>]*>([\s\S]*?)<\/relation>/g))
      if (/k="type" v="circuit"/.test(m[2])) rels.set(m[1], (m[2].match(/k="name" v="([^"]*)"/) || [])[1]);
  }
  out[c.id] = [...rels].map(([id, name]) => ({ id, name }));
  console.log(c.id.padEnd(12), JSON.stringify(out[c.id]));
}
fs.writeFileSync('relations.json', JSON.stringify(out, null, 1));
