// Extrae de OSM la nube de pista y la ruta del pit lane (metros locales, y hacia abajo como en SVG).
const fs = require('fs');
const cs = require('./circuits.json');
const CHOICE = { // relación F1 vigente elegida por circuito (null = sin relación, usar bbox)
  barcelona: '284540', monza: '284565', silverstone: '51160', spa: '284560', monaco: '148194', spielberg: '5309181',
  interlagos: '6781071', suzuka: '284570', zandvoort: '13545573', 'las-vegas': '16696508', bahrain: '284538', baku: '11266687',
  melbourne: '280443', miami: '20204222', shanghai: '2094941', jeddah: null, 'marina-bay': '421263', lusail: '21297662',
  'yas-marina': '11378665', hungaroring: '284557', 'mexico-city': '16251935', montreal: '284595', austin: '6537729',
};
function parse(xml, db) {
  const tags = b => Object.fromEntries([...b.matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g)].map(m => [m[1], m[2]]));
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"(?:\/>|>([\s\S]*?)<\/node>)/g)) db.nodes.set(m[1], { lat: +m[2], lon: +m[3], tags: m[4] ? tags(m[4]) : {} });
  for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) db.ways.set(m[1], { id: m[1], nds: [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)].map(x => x[1]), tags: tags(m[2]) });
  for (const m of xml.matchAll(/<relation id="(\d+)"[^>]*>([\s\S]*?)<\/relation>/g)) db.rels.set(m[1], { members: [...m[2].matchAll(/<member type="(\w+)" ref="(\d+)" role="([^"]*)"\/>/g)].map(x => ({ type: x[1], ref: x[2], role: x[3] })), tags: tags(m[2]) });
  return db;
}
const isPitRole = r => /pit/i.test(r);
const isPitWay = w => w.tags.raceway === 'pitlane' || w.tags.service === 'pit' || /pit ?lane|pitlane|pit entry|pit exit|pit (in|out)|boxes|boxenstra|pitstraat|entrada al pit|sortida del pit/i.test([w.tags.name, w.tags['name:en']].join(' '));
const out = {};
for (const c of cs) {
  const db = { nodes: new Map(), ways: new Map(), rels: new Map() };
  const rid = CHOICE[c.id];
  if (rid) parse(fs.readFileSync(`rel/${rid}.xml`, 'utf8'), db);
  if (fs.existsSync(`${c.id}.xml`) && fs.statSync(`${c.id}.xml`).size > 1000) parse(fs.readFileSync(`${c.id}.xml`, 'utf8'), db);
  for (const f of fs.readdirSync('.').filter(f => f.startsWith(`tile-${c.id}-`))) parse(fs.readFileSync(f, 'utf8'), db);
  const lat0 = c.lat, lon0 = c.lon, kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540;
  const xy = id => { const n = db.nodes.get(id); return n && [(n.lon - lon0) * kx, -(n.lat - lat0) * ky]; };
  const rel = rid && db.rels.get(rid);
  let trackWays = rel ? rel.members.filter(m => m.type === 'way' && !isPitRole(m.role) && !/alternative|penalty|joker/.test(m.role)).map(m => db.ways.get(m.ref)).filter(Boolean) : [];
  // La pista no incluye boxes, penalizaciones ni variantes de otras categorías
  trackWays = trackWays.filter(w => !isPitWay(w) && !/penalty|moto ?gp|chicane/i.test([w.tags.name, w.tags['name:en']].join(' ')));
  const BYNAME = { jeddah: w => w.tags['name:en'] === 'Jeddah Corniche Circuit' && !/Formula E|WTCR/.test(w.tags.fixme || ''), miami: w => w.tags.name === 'Miami International Autodrome' };
  if (!trackWays.length && BYNAME[c.id]) trackWays = [...db.ways.values()].filter(w => w.tags.highway === 'raceway' && BYNAME[c.id](w));
  const fixmes = [...new Set(trackWays.map(w => w.tags.fixme).filter(Boolean))];
  const dirSegs = [];
  for (const w of trackWays) if (w.tags.oneway === 'yes') for (let i = 1; i < w.nds.length; i += 2) { const a = xy(w.nds[i - 1]), b = xy(w.nds[i]); if (a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 3) dirSegs.push([a, b]); }
  let pitWays = rel ? rel.members.filter(m => m.type === 'way' && isPitRole(m.role)).map(m => db.ways.get(m.ref)).filter(Boolean) : [];
  let pitSource = pitWays.length ? `relation ${rid} role pit_lane` : null;
  if (!pitWays.length) { pitWays = [...db.ways.values()].filter(w => w.tags.highway === 'raceway' && isPitWay(w)); pitSource = pitWays.length ? 'ways etiquetadas pit (bbox)' : null; }
  // Densificar pista cada ~4 m
  const cloud = [];
  for (const w of trackWays) for (let i = 1; i < w.nds.length; i++) {
    const a = xy(w.nds[i - 1]), b = xy(w.nds[i]); if (!a || !b) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
    for (let k = 0; k < n; k++) cloud.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  // Encadenar vías del pit por extremos compartidos (respetando el sentido si es oneway)
  const chains = [];
  let pool = pitWays.map(w => ({ ...w, nds: [...w.nds] }));
  while (pool.length) {
    let chain = pool.shift(); let grown = true;
    while (grown) { grown = false;
      for (const w of pool) {
        const [h, t] = [chain.nds[0], chain.nds.at(-1)];
        if (w.nds[0] === t) chain.nds.push(...w.nds.slice(1));
        else if (w.nds.at(-1) === h) chain.nds = [...w.nds.slice(0, -1), ...chain.nds];
        else if (w.tags.oneway !== 'yes' && w.nds.at(-1) === t) chain.nds.push(...[...w.nds].reverse().slice(1));
        else if (w.tags.oneway !== 'yes' && w.nds[0] === h) chain.nds = [...[...w.nds].reverse().slice(0, -1), ...chain.nds];
        else continue;
        pool = pool.filter(x => x !== w); grown = true; break;
      }
    }
    chains.push(chain);
  }
  const trackNodeSet = new Set(trackWays.flatMap(w => w.nds));
  const pit = chains.map(ch => ({ oneway: pitWays.every(w => w.tags.oneway === 'yes'), path: ch.nds.map(xy).filter(Boolean),
    headOnTrack: trackNodeSet.has(ch.nds[0]), tailOnTrack: trackNodeSet.has(ch.nds.at(-1)), wayIds: pitWays.map(w => w.id) }))
    .sort((a, b) => b.path.length - a.path.length);
  const marks = [...db.nodes.entries()].filter(([, n]) => /start|finish/.test(n.tags.raceway || '')).map(([id, n]) => ({ id, kind: n.tags.raceway, xy: xy(id) }));
  out[c.id] = { fixmes, dirSegs, relation: rid, pitSource, trackWays: trackWays.length, cloud, pit, marks, timestamp: null };
  console.log(c.id.padEnd(12), 'rel', String(rid).padEnd(9), 'pista', String(cloud.length).padStart(5), 'pit', pitSource, pit.map(p => `${p.path.length}pts oneway=${p.oneway} head=${p.headOnTrack} tail=${p.tailOnTrack}`).join(' ; '));
}
fs.writeFileSync('../q20-data.json', JSON.stringify(out));
