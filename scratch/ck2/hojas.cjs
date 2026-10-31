// Hojas de la maqueta de CK2: una fila por circuito (general, curva de frenada más fuerte, frenada con los carteles de
// metros y recta de meta), 6 por hoja. Mónaco queda aparte.
const sharp = require('C:/Users/Usuario/Documents/antigravity/brave-mendeleev/node_modules/sharp');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'capturas');
const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'circuitos', 'index.json'), 'utf8')).filter(c => c.id !== 'monaco');
const W = 420, H = 236, LABEL = 26, PER = 6, VIEWS = ['1_general', '2_curva', '3_frenada', '4_meta'];
(async () => {
  for (let s = 0; s * PER < index.length; s++) {
    const group = index.slice(s * PER, s * PER + PER), comps = [];
    for (const [r, c] of group.entries()) {
      const y = r * (H + LABEL);
      const label = `${c.name} (${c.id}) · ${c.type === 'street' ? 'urbano' : c.type === 'hybrid' ? 'mixto' : 'permanente'} · ${c.lap} m`;
      comps.push({ input: Buffer.from(`<svg width="${W * 4}" height="${LABEL}"><text x="6" y="19" font-size="16" font-family="Arial" font-weight="bold" fill="#fff">${label.replace(/&/g, '&amp;')}</text></svg>`), left: 0, top: y });
      for (const [k, v] of VIEWS.entries()) {
        const f = path.join(dir, `${c.id}_${v}.jpg`);
        if (!fs.existsSync(f)) continue;
        comps.push({ input: await sharp(f).resize(W - 4, H - 4).toBuffer(), left: k * W + 2, top: y + LABEL + 2 });
      }
    }
    const out = path.join(__dirname, `maqueta-${s + 1}.jpg`);
    await sharp({ create: { width: W * 4, height: group.length * (H + LABEL), channels: 3, background: '#151515' } }).composite(comps).jpeg({ quality: 82 }).toFile(out);
    console.log(out);
  }
})();
