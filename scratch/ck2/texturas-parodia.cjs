// Texturas de parodia para las piezas del kit que llevaban marcas reales (CK2): vallas publicitarias, pancartas del
// suelo, carteles de metros antes de cada curva y la torre de posiciones con el nombre de cada circuito.
// Los 18 primeros nombres son los de src/scene3d/sponsors.ts; los 8 últimos son nuevos (29/10/2026, el usuario pide más).
// Uso: node scratch/ck2/texturas-parodia.cjs <carpeta de salida> <textura original de la torre (Image_54.png)>
const sharp = require('C:/Users/Usuario/Documents/antigravity/brave-mendeleev/node_modules/sharp');
const fs = require('fs'), path = require('path');
const out = process.argv[2], torre = process.argv[3];
fs.mkdirSync(out, { recursive: true });

const SPONSORS = [
  { id: 'rolax', name: 'ROLAX', bg: '#0b5d34', fg: '#d8b45a', tag: 'Relojes que adelantan' },
  { id: 'dhlento', name: 'DHLento', bg: '#ffcc00', fg: '#d40511', tag: 'Llega cuando llega' },
  { id: 'aramcorto', name: 'Aramcorto', bg: '#00843d', fg: '#ffffff', tag: 'Energía a medias' },
  { id: 'heinekeso', name: 'Heinekeso 0,0', bg: '#0a6b2a', fg: '#ffffff', tag: 'Si conduces, queso' },
  { id: 'lenobo', name: 'Lenobo', bg: '#e2231a', fg: '#ffffff', tag: 'Portátiles con alerón' },
  { id: 'kripto', name: 'Kripto.con', bg: '#0b1f4d', fg: '#3fe0c5', tag: 'Monedas que suben y bajan' },
  { id: 'etihaz', name: 'Etihaz', bg: '#bd8b13', fg: '#ffffff', tag: 'Alas doradas' },
  { id: 'emirratos', name: 'Emirratos', bg: '#c8102e', fg: '#ffffff', tag: 'Vuela un rato' },
  { id: 'salesfuerza', name: 'Salesfuerza', bg: '#00a1e0', fg: '#ffffff', tag: 'Ventas en la nube' },
  { id: 'awsome', name: 'AWSome Nube', bg: '#232f3e', fg: '#ff9900', tag: 'Datos a 300 km/h' },
  { id: 'piruli', name: 'Pirulí', bg: '#f5d000', fg: '#1a1a1a', tag: 'Neumáticos de caramelo' },
  { id: 'qatar', name: 'Qatar Aerovías', bg: '#5c0632', fg: '#ffffff', tag: 'Despega en la recta' },
  { id: 'luisviton', name: 'Luis Vitón', bg: '#4a2f1d', fg: '#e3c58d', tag: 'Maletas de boxes' },
  { id: 'taghoyer', name: 'TAG Hoyer', bg: '#111111', fg: '#e30613', tag: 'Cronos de bolsillo' },
  { id: 'paramoint', name: 'Paramoint+', bg: '#0064ff', fg: '#ffffff', tag: 'Series sin pausa' },
  { id: 'santandreu', name: 'Santandreu', bg: '#ec0000', fg: '#ffffff', tag: 'Banca de bolsillo' },
  { id: 'mastercarta', name: 'Mastercarta', bg: '#1a1a1a', fg: '#f79e1b', tag: 'Paga la vuelta rápida' },
  { id: 'allianza', name: 'Allianza', bg: '#003781', fg: '#ffffff', tag: 'Seguros de boxes' },
  { id: 'monstruo', name: 'Monstruo', bg: '#0d0d0d', fg: '#7ad000', tag: 'Energía de garra' },
  { id: 'shellfish', name: 'Shellfish', bg: '#ffd500', fg: '#dd1d21', tag: 'Gasolina con marisco' },
  { id: 'gulpf', name: 'Gulpf', bg: '#8fd3f4', fg: '#f26b21', tag: 'Aceite de toda la vida' },
  { id: 'visaje', name: 'Visaje', bg: '#1a1f71', fg: '#f7b600', tag: 'Paga con un gesto' },
  { id: 'castrolo', name: 'Castrolo', bg: '#007a3d', fg: '#ffffff', tag: 'Lubricante con carácter' },
  { id: 'uberto', name: 'Uberto', bg: '#000000', fg: '#ffffff', tag: 'Te lleva a boxes' },
  { id: 'bose', name: 'Bosé', bg: '#222222', fg: '#ffffff', tag: 'Sonido de recta' },
  { id: 'hilfigaro', name: 'Tommy Hilfígaro', bg: '#0b2a5b', fg: '#ffffff', tag: 'Moda de paddock' },
];
/** Nombre de cada circuito en el cartel de la torre de posiciones (lugares reales; no son marcas). */
const CIRCUITS = {
  barcelona: 'BARCELONA', monza: 'MONZA', silverstone: 'SILVERSTONE', spa: 'SPA', monaco: 'MÓNACO', spielberg: 'SPIELBERG',
  interlagos: 'INTERLAGOS', suzuka: 'SUZUKA', zandvoort: 'ZANDVOORT', 'las-vegas': 'LAS VEGAS', bahrain: 'SAKHIR', baku: 'BAKÚ',
  melbourne: 'MELBOURNE', miami: 'MIAMI', shanghai: 'SHANGHÁI', jeddah: 'YEDA', 'marina-bay': 'MARINA BAY', lusail: 'LUSAIL',
  'yas-marina': 'YAS MARINA', hungaroring: 'HUNGARORING', 'mexico-city': 'MÉXICO', montreal: 'MONTREAL', austin: 'AUSTIN',
};
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Tamaño de letra para que el texto quepa en maxW (ancho medio por letra: Arial Black ~0,86 em, Arial cursiva ~0,52). */
const size = (text, want, maxW, em = 0.86) => Math.min(want, maxW / (text.length * em));
const fit = () => '';

async function banner(s, w, h, file, withTag) {
  const f1 = Math.round(size(s.name, h * (withTag ? 0.5 : 0.62), w * 0.9)), f2 = Math.round(size(s.tag, h * 0.19, w * 0.9, 0.52));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${s.bg}"/>
    <rect y="${h * 0.94}" width="${w}" height="${h * 0.06}" fill="${s.fg}" opacity="0.85"/>
    <text x="${w / 2}" y="${withTag ? h * 0.55 : h * 0.66}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${f1}" fill="${s.fg}" ${fit(s.name, f1, w * 0.88)}>${esc(s.name)}</text>
    ${withTag ? `<text x="${w / 2}" y="${h * 0.83}" text-anchor="middle" font-family="Arial" font-style="italic" font-size="${f2}" fill="${s.fg}" ${fit(s.tag, f2 * 0.8, w * 0.9)}>${esc(s.tag)}</text>` : ''}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, file));
}

/** Cartel de metros antes de la curva: número grande sobre blanco y el patrocinador debajo. */
async function distance(s, m) {
  const w = 300, h = 420;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="#f4f4f2"/><rect x="6" y="6" width="${w - 12}" height="${h * 0.66 - 6}" fill="none" stroke="#111" stroke-width="8"/>
    <text x="${w / 2}" y="${h * 0.5}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${m >= 100 ? 150 : 190}" fill="#111" ${fit(String(m), m >= 100 ? 150 : 190, w * 0.86)}>${m}</text>
    <rect y="${h * 0.68}" width="${w}" height="${h * 0.32}" fill="${s.bg}"/>
    <text x="${w / 2}" y="${h * 0.9}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${size(s.name, 56, w * 0.9)}" fill="${s.fg}">${esc(s.name)}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, `metros_${m}_${s.id}.png`));
}

(async () => {
  for (const s of SPONSORS) {
    await banner(s, 1024, 256, `valla_${s.id}.png`, true);      // valla publicitaria (10 × 2,5 m)
    await banner(s, 1024, 200, `pancarta_${s.id}.png`, false);  // pancarta pintada en el suelo (26 × 5 m)
    for (const m of [200, 150, 100, 50]) await distance(s, m);
  }
  // Torre de posiciones: el cartel de arriba (logo del circuito real) pasa a llevar el nombre de cada circuito.
  const meta = await sharp(torre).metadata(); const W = meta.width, H = meta.height, K = 4;
  const x = Math.round(W * 0.565), y = Math.round(H * 0.44), w = Math.round(W * 0.19), h = H - y;
  const base = await sharp(torre).resize(W * K, H * K, { kernel: 'nearest' }).png().toBuffer();
  for (const [id, label] of Object.entries(CIRCUITS)) {
    const pw = w * K, ph = h * K, fs1 = size(label, pw * 0.5, ph * 0.9);
    const panel = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" fill="#b3121b"/>
      <rect x="${pw * 0.08}" y="${ph * 0.03}" width="${pw * 0.04}" height="${ph * 0.94}" fill="#fff"/>
      <text transform="translate(${pw * 0.66},${ph * 0.5}) rotate(90)" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${fs1}" fill="#fff" ${fit(label, fs1, ph * 0.9)}>${esc(label)}</text></svg>`;
    await sharp(base).composite([{ input: Buffer.from(panel), left: x * K, top: y * K }]).png().toFile(path.join(out, `torre_${id}.png`));
  }
  fs.writeFileSync(path.join(out, 'patrocinadores.json'), JSON.stringify(SPONSORS.map(s => s.id)));
  console.log('ok', SPONSORS.length, 'patrocinadores,', Object.keys(CIRCUITS).length, 'torres');
})();
