// [TL7, 16/11/2026] Logotipos dibujados a mano de los patrocinadores principales (petición del usuario: «diséñalos a
// mano porque siguen pareciendo muy tristes»). Cada uno es un pequeño dibujo propio en un lienzo: emblema hecho con
// trazos y palabra con su letra, su inclinación y sus colores, pensado para leerse sobre cualquier pintura (los que lo
// necesitan llevan su placa). Son parodias: ningún emblema copia el de la marca real (Concha Oil lleva un caracol y no
// una vieira, Cuatro Anillos lleva anillos concéntricos, Mastercarta una tarjeta…).

type Ctx = CanvasRenderingContext2D;
/** Dibuja el logotipo en un lienzo de W × H; `dark` dice si lo de debajo es oscuro (para elegir blanco o negro). */
export type LogoDraw = (ctx: Ctx, W: number, H: number, dark: boolean) => void;

const FONT = {
  cond: '"Barlow Condensed", "Arial Narrow", sans-serif',
  round: '"Barlow", "Segoe UI", Arial, sans-serif',
  heavy: '"Arial Black", "Barlow", sans-serif',
};

interface WordOpts { font: string; weight: number; italic?: boolean; spacing?: number; stretch?: number; fill: string | CanvasGradient; stroke?: string; strokeW?: number }

/** Escribe `text` con su parte izquierda en `x` y su centro vertical en `cy`, de alto de letra `size`; devuelve el ancho. */
function word(ctx: Ctx, text: string, x: number, cy: number, size: number, o: WordOpts): number {
  ctx.save();
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight} ${size}px ${o.font}`;
  ctx.letterSpacing = `${Math.round((o.spacing ?? 0) * size)}px`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const w = ctx.measureText(text).width * (o.stretch ?? 1);
  ctx.translate(x, cy + size * 0.04);
  ctx.scale(o.stretch ?? 1, 1);
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW ?? size * 0.08; ctx.strokeStyle = o.stroke; ctx.strokeText(text, 0, 0); }
  ctx.fillStyle = o.fill; ctx.fillText(text, 0, 0);
  ctx.restore();
  return w;
}

/** Tamaño de letra para que `text` quepa en `maxW` sin pasar de `maxSize`. */
function fit(ctx: Ctx, text: string, maxW: number, maxSize: number, o: Omit<WordOpts, 'fill'>): number {
  let size = maxSize;
  for (let i = 0; i < 12; i++) {
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight} ${size}px ${o.font}`;
    ctx.letterSpacing = `${Math.round((o.spacing ?? 0) * size)}px`;
    const w = ctx.measureText(text).width * (o.stretch ?? 1);
    if (w <= maxW) break;
    size *= Math.max(0.7, maxW / w);
  }
  return size;
}

/** Emblema a la izquierda y palabra a la derecha, centrados juntos en el lienzo. */
function lockup(ctx: Ctx, W: number, H: number, emblemW: number, drawEmblem: (x: number) => void, text: string, o: WordOpts, sizeRatio = 0.62, gap = 0.12): void {
  // Superficies casi cuadradas (placas de los alerones): emblema encima y palabra debajo, para que la palabra se lea.
  if (W / H < 2.2) {
    const k = 0.52;
    ctx.save(); ctx.translate(W / 2, H * 0.29); ctx.scale(k, k); ctx.translate(-emblemW / 2, -H / 2); drawEmblem(0); ctx.restore();
    const s = fit(ctx, text, W * 0.92, H * 0.34, o);
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight} ${s}px ${o.font}`; ctx.letterSpacing = `${Math.round((o.spacing ?? 0) * s)}px`;
    word(ctx, text, (W - ctx.measureText(text).width * (o.stretch ?? 1)) / 2, H * 0.77, s, o);
    return;
  }
  const room = W * 0.94 - emblemW - H * gap;
  const size = fit(ctx, text, room, H * sizeRatio, o);
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight} ${size}px ${o.font}`;
  ctx.letterSpacing = `${Math.round((o.spacing ?? 0) * size)}px`;
  const tw = ctx.measureText(text).width * (o.stretch ?? 1);
  const total = emblemW + H * gap + tw, x0 = (W - total) / 2;
  drawEmblem(x0);
  word(ctx, text, x0 + emblemW + H * gap, H / 2, size, o);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function slanted(ctx: Ctx, x: number, y: number, w: number, h: number, s: number) { ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - s, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
function star(ctx: Ctx, cx: number, cy: number, r: number, inner: number, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) { const rr = i % 2 ? inner : r, a = rot + i * Math.PI / points; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
}
const ink = (dark: boolean) => (dark ? '#ffffff' : '#141414');

export const LOGOS: Record<string, LogoDraw> = {
  // Tarjeta naranja con su chip y la palabra en minúscula: «mastercarta».
  Mastercarta: (ctx, W, H, dark) => {
    const e = H * 0.95;
    lockup(ctx, W, H, e, x => {
      const cw = e, ch = H * 0.62, cy = (H - ch) / 2;
      roundRect(ctx, x, cy, cw, ch, ch * 0.16); ctx.fillStyle = '#f79e1b'; ctx.fill(); ctx.lineWidth = ch * 0.07; ctx.strokeStyle = '#7a4a00'; ctx.stroke();
      roundRect(ctx, x + cw * 0.14, cy + ch * 0.28, cw * 0.28, ch * 0.34, ch * 0.06); ctx.fillStyle = '#7a4a00'; ctx.fill();
      ctx.fillStyle = '#ffd38a'; for (let i = 0; i < 3; i++) ctx.fillRect(x + cw * 0.52, cy + ch * (0.66 + i * 0.0) - ch * 0.04 + i * ch * 0.1, cw * (0.34 - i * 0.08), ch * 0.06);
    }, 'mastercarta', { font: FONT.round, weight: 700, spacing: -0.04, fill: ink(dark) }, 0.66);
  },
  // OKEY con la X hecha de dos barras cruzadas en un cuadro.
  'Okey X': (ctx, W, H, dark) => {
    const fg = ink(dark), bg = dark ? '#141414' : '#ffffff';
    const size = fit(ctx, 'OKEY', W * 0.62, H * 0.74, { font: FONT.heavy, weight: 900, spacing: -0.05 });
    ctx.font = `900 ${size}px ${FONT.heavy}`; ctx.letterSpacing = `${Math.round(-0.05 * size)}px`;
    const tw = ctx.measureText('OKEY').width, box = H * 0.8, total = tw + H * 0.14 + box, x0 = (W - total) / 2;
    word(ctx, 'OKEY', x0, H / 2, size, { font: FONT.heavy, weight: 900, spacing: -0.05, fill: fg });
    const bx = x0 + tw + H * 0.14, by = (H - box) / 2;
    ctx.fillStyle = fg; ctx.fillRect(bx, by, box, box);
    ctx.fillStyle = bg; ctx.save(); ctx.translate(bx + box / 2, by + box / 2);
    for (const a of [Math.PI / 4, -Math.PI / 4]) { ctx.save(); ctx.rotate(a); ctx.fillRect(-box * 0.42, -box * 0.09, box * 0.84, box * 0.18); ctx.restore(); }
    ctx.restore();
  },
  // Letras muy anchas en rojo y la O convertida en un ojo.
  'Oráculo': (ctx, W, H) => {
    const o = { font: FONT.heavy, weight: 900, spacing: 0.04, stretch: 1.28, fill: '#ff1e1e' };
    const ring = H * 0.62;
    lockup(ctx, W, H, ring * 1.3, x => {
      ctx.save(); ctx.strokeStyle = '#ff1e1e'; ctx.lineWidth = H * 0.13;
      ctx.beginPath(); ctx.ellipse(x + ring * 0.65, H / 2, ring * 0.62, ring * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff1e1e'; ctx.beginPath(); ctx.arc(x + ring * 0.65, H / 2, ring * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }, 'RÁCULO', o, 0.6, 0.02);
  },
  // Mano que dice adiós y la palabra en dos tonos.
  Baibai: (ctx, W, H, dark) => {
    const e = H * 0.78;
    const size = fit(ctx, 'BAIBAI', W * 0.92 - e - H * 0.1, H * 0.7, { font: FONT.cond, weight: 800, italic: true, spacing: 0 });
    ctx.font = `italic 800 ${size}px ${FONT.cond}`; ctx.letterSpacing = '0px';
    const w1 = ctx.measureText('BAI').width, w2 = ctx.measureText('BAI').width, total = e + H * 0.1 + w1 + w2, x0 = (W - total) / 2;
    // Mano: palma y cuatro dedos, con dos trazos de movimiento.
    ctx.save(); ctx.fillStyle = '#f7a600'; const px = x0 + e * 0.5, py = H * 0.6;
    roundRect(ctx, px - e * 0.26, py - e * 0.1, e * 0.52, e * 0.42, e * 0.14); ctx.fill();
    for (let i = 0; i < 4; i++) { roundRect(ctx, px - e * 0.26 + i * e * 0.135, py - e * 0.48 + Math.abs(i - 1.5) * e * 0.06, e * 0.11, e * 0.44, e * 0.055); ctx.fill(); }
    ctx.strokeStyle = '#f7a600'; ctx.lineWidth = e * 0.05; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(px, py, e * (0.5 + i * 0.12), -Math.PI * 0.85, -Math.PI * 0.6); ctx.stroke(); }
    ctx.restore();
    const x = x0 + e + H * 0.1;
    word(ctx, 'BAI', x, H / 2, size, { font: FONT.cond, weight: 800, italic: true, fill: ink(dark) });
    word(ctx, 'BAI', x + w1, H / 2, size, { font: FONT.cond, weight: 800, italic: true, fill: '#f7a600' });
  },
  // Placa amarilla con un caracol rojo en espiral y la palabra en rojo.
  'Concha Oil': (ctx, W, H) => {
    const ph = H * 0.9, py = (H - ph) / 2;
    const size = fit(ctx, 'CONCHA OIL', W * 0.92 - ph * 1.1, ph * 0.56, { font: FONT.cond, weight: 800, spacing: 0.02 });
    ctx.font = `800 ${size}px ${FONT.cond}`; ctx.letterSpacing = `${Math.round(0.02 * size)}px`;
    const tw = ctx.measureText('CONCHA OIL').width, pw = Math.min(W * 0.98, tw + ph * 1.35), px = (W - pw) / 2;
    roundRect(ctx, px, py, pw, ph, ph * 0.5); ctx.fillStyle = '#ffd500'; ctx.fill();
    ctx.strokeStyle = '#dd1d21'; ctx.lineWidth = ph * 0.05; ctx.stroke();
    const cx = px + ph * 0.55, cy = H / 2, r = ph * 0.34;
    ctx.fillStyle = '#dd1d21'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd500'; ctx.lineWidth = ph * 0.045; ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.1) { const rr = r * 0.85 * (1 - a / (Math.PI * 5.4)); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.stroke();
    word(ctx, 'CONCHA OIL', px + ph * 1.05, H / 2, size, { font: FONT.cond, weight: 800, spacing: 0.02, fill: '#dd1d21' });
  },
  // Etiqueta de precio azul con agujero y «HPrecio» en cursiva.
  HPrecio: (ctx, W, H, dark) => {
    const e = H * 0.95;
    lockup(ctx, W, H, e, x => {
      const t = H * 0.18, h = H * 0.64, y = (H - h) / 2;
      ctx.beginPath(); ctx.moveTo(x, H / 2); ctx.lineTo(x + e * 0.32, y); ctx.lineTo(x + e, y); ctx.lineTo(x + e, y + h); ctx.lineTo(x + e * 0.32, y + h); ctx.closePath();
      ctx.fillStyle = '#0096d6'; ctx.fill();
      ctx.fillStyle = dark ? '#141414' : '#ffffff'; ctx.beginPath(); ctx.arc(x + e * 0.3, H / 2, t * 0.4, 0, Math.PI * 2); ctx.fill();
      word(ctx, 'H', x + e * 0.5, H / 2, h * 0.62, { font: FONT.round, weight: 700, italic: true, fill: '#ffffff' });
    }, 'Precio', { font: FONT.round, weight: 700, italic: true, spacing: -0.02, fill: ink(dark) }, 0.66, 0.06);
  },
  // Cinta turquesa que se enrosca y la palabra espaciada.
  Patronus: (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      const g = ctx.createLinearGradient(x, 0, x + e, H); g.addColorStop(0, '#00d2be'); g.addColorStop(1, '#00857a');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(x + e * 0.1, H * 0.86); ctx.bezierCurveTo(x + e * 0.1, H * 0.2, x + e * 0.95, H * 0.1, x + e * 0.9, H * 0.42);
      ctx.bezierCurveTo(x + e * 0.62, H * 0.32, x + e * 0.4, H * 0.5, x + e * 0.42, H * 0.86); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x + e * 0.78, H * 0.68, e * 0.13, 0, Math.PI * 2); ctx.fill();
    }, 'PATRONUS', { font: FONT.round, weight: 700, spacing: 0.18, fill: dark ? '#ffffff' : '#00857a' }, 0.5);
  },
  // Carambola (la fruta estrella) cortada, en lima, y la palabra en minúscula.
  Carambola: (ctx, W, H, dark) => {
    const e = H * 0.92;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2;
      star(ctx, cx, cy, e * 0.5, e * 0.3); ctx.fillStyle = '#cedc00'; ctx.fill();
      ctx.lineWidth = e * 0.05; ctx.strokeStyle = '#6b7a00'; ctx.stroke();
      star(ctx, cx, cy, e * 0.24, e * 0.1); ctx.fillStyle = '#f4ff8a'; ctx.fill();
      ctx.fillStyle = '#4a5500'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * e * 0.17, cy + Math.sin(a) * e * 0.17, e * 0.035, e * 0.06, a, 0, Math.PI * 2); ctx.fill(); }
    }, 'carambola', { font: FONT.round, weight: 700, spacing: -0.03, fill: ink(dark) }, 0.62);
  },
  // Montaña-triángulo azul con un meridiano y «atlasiano».
  Atlasiano: (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      const g = ctx.createLinearGradient(x, H, x + e, 0); g.addColorStop(0, '#0052cc'); g.addColorStop(1, '#2684ff');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, H * 0.88); ctx.lineTo(x + e * 0.5, H * 0.1); ctx.lineTo(x + e, H * 0.88); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e * 0.05; ctx.beginPath(); ctx.ellipse(x + e * 0.5, H * 0.62, e * 0.26, e * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
    }, 'atlasiano', { font: FONT.round, weight: 700, spacing: -0.02, fill: dark ? '#ffffff' : '#0052cc' }, 0.62);
  },
  // Pila con un copo de nieve y la palabra en dos tonos (DURA | CHILL).
  'Dura Chill': (ctx, W, H, dark) => {
    const o = { font: FONT.cond, weight: 800, italic: true, spacing: 0 };
    const bw = H * 0.46, gap = H * 0.12;
    const size = fit(ctx, 'DURACHILL', W * 0.92 - bw - gap, H * 0.72, o);
    ctx.font = `italic 800 ${size}px ${FONT.cond}`; ctx.letterSpacing = '0px';
    const w1 = ctx.measureText('DURA').width, w2 = ctx.measureText('CHILL').width, x0 = (W - bw - gap - w1 - w2) / 2;
    const bh = H * 0.74, by = (H - bh) / 2 + H * 0.05;
    roundRect(ctx, x0, by, bw, bh, bw * 0.14); ctx.fillStyle = '#1b1b1b'; ctx.fill();
    ctx.lineWidth = H * 0.025; ctx.strokeStyle = '#f6a800'; ctx.stroke();
    ctx.fillStyle = '#f6a800'; ctx.fillRect(x0, by, bw, bh * 0.36); ctx.fillRect(x0 + bw * 0.3, by - H * 0.07, bw * 0.4, H * 0.07);
    ctx.strokeStyle = '#7fd3ff'; ctx.lineWidth = bw * 0.08; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const an = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x0 + bw / 2 - Math.cos(an) * bw * 0.3, by + bh * 0.68 - Math.sin(an) * bw * 0.3); ctx.lineTo(x0 + bw / 2 + Math.cos(an) * bw * 0.3, by + bh * 0.68 + Math.sin(an) * bw * 0.3); ctx.stroke(); }
    const x = x0 + bw + gap;
    word(ctx, 'DURA', x, H / 2, size, { ...o, fill: ink(dark) });
    word(ctx, 'CHILL', x + w1, H / 2, size, { ...o, fill: '#f6a800' });
  },
  // Placa azul inclinada con letras doradas y un trazo bajo la V.
  Vizcash: (ctx, W, H) => {
    const ph = H * 0.86, py = (H - ph) / 2;
    const size = fit(ctx, 'VIZCASH', W * 0.82, ph * 0.66, { font: FONT.heavy, weight: 900, italic: true, spacing: -0.02 });
    ctx.font = `italic 900 ${size}px ${FONT.heavy}`; ctx.letterSpacing = `${Math.round(-0.02 * size)}px`;
    const tw = ctx.measureText('VIZCASH').width, pw = Math.min(W * 0.98, tw + ph * 0.9), px = (W - pw) / 2;
    slanted(ctx, px, py, pw, ph, ph * 0.3); ctx.fillStyle = '#1a1f71'; ctx.fill();
    word(ctx, 'VIZCASH', px + (pw - tw) / 2, H / 2 - ph * 0.04, size, { font: FONT.heavy, weight: 900, italic: true, spacing: -0.02, fill: '#f7b600' });
    ctx.fillStyle = '#f7b600'; ctx.beginPath(); ctx.moveTo(px + pw * 0.16, py + ph * 0.86); ctx.quadraticCurveTo(px + pw * 0.5, py + ph * 0.7, px + pw * 0.84, py + ph * 0.8); ctx.lineTo(px + pw * 0.82, py + ph * 0.86); ctx.quadraticCurveTo(px + pw * 0.5, py + ph * 0.8, px + pw * 0.16, py + ph * 0.92); ctx.closePath(); ctx.fill();
  },
  // Moneda roja con la M y la palabra.
  MonyGramo: (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2;
      ctx.fillStyle = '#da291c'; ctx.beginPath(); ctx.arc(cx, cy, e * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e * 0.04; ctx.beginPath(); ctx.arc(cx, cy, e * 0.38, 0, Math.PI * 2); ctx.stroke();
      ctx.font = `900 ${e * 0.5}px ${FONT.heavy}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '0px'; ctx.fillText('M', cx, cy + e * 0.03); ctx.textAlign = 'left';
    }, 'MonyGramo', { font: FONT.round, weight: 700, spacing: -0.02, fill: dark ? '#ffffff' : '#da291c' }, 0.62);
  },
  // Sol rojo detrás de la palabra ancha.
  Toyoda: (ctx, W, H, dark) => {
    const o = { font: FONT.heavy, weight: 900, spacing: 0.02, stretch: 1.15, fill: ink(dark) };
    const size = fit(ctx, 'TOYODA', W * 0.9, H * 0.6, o);
    ctx.font = `900 ${size}px ${FONT.heavy}`; ctx.letterSpacing = `${Math.round(0.02 * size)}px`;
    const tw = ctx.measureText('TOYODA').width * 1.15, x0 = (W - tw) / 2;
    ctx.fillStyle = '#eb0a1e'; ctx.beginPath(); ctx.arc(x0 + tw * 0.5, H / 2, H * 0.46, 0, Math.PI * 2); ctx.fill();
    word(ctx, 'TOYODA', x0, H / 2, size, { ...o, fill: '#ffffff', stroke: '#141414', strokeW: size * 0.1 });
  },
  // Gota con degradado rosa-azul y BTW muy pesado.
  BTW: (ctx, W, H, dark) => {
    const e = H * 0.86;
    lockup(ctx, W, H, e * 0.75, x => {
      const g = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.95); g.addColorStop(0, '#ff87bc'); g.addColorStop(1, '#0078c1');
      ctx.fillStyle = g; const cx = x + e * 0.37, r = e * 0.36;
      ctx.beginPath(); ctx.moveTo(cx, H * 0.06); ctx.bezierCurveTo(cx + r * 1.2, H * 0.45, cx + r, H * 0.92, cx, H * 0.92); ctx.bezierCurveTo(cx - r, H * 0.92, cx - r * 1.2, H * 0.45, cx, H * 0.06); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.35, H * 0.6, r * 0.12, r * 0.25, 0.3, 0, Math.PI * 2); ctx.fill();
    }, 'BTW', { font: FONT.heavy, weight: 900, spacing: -0.04, fill: dark ? '#ffffff' : '#003a8f' }, 0.8, 0.06);
  },
  // Chuletón (silueta con hueso en T) en lima y STEAK espaciado.
  Steak: (ctx, W, H) => {
    const e = H * 1.1;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#52e252'; ctx.beginPath();
      ctx.moveTo(x + e * 0.1, H * 0.5); ctx.bezierCurveTo(x + e * 0.05, H * 0.12, x + e * 0.75, H * 0.05, x + e * 0.92, H * 0.35);
      ctx.bezierCurveTo(x + e * 1.02, H * 0.6, x + e * 0.7, H * 0.95, x + e * 0.4, H * 0.86); ctx.bezierCurveTo(x + e * 0.2, H * 0.8, x + e * 0.14, H * 0.7, x + e * 0.1, H * 0.5); ctx.fill();
      ctx.strokeStyle = '#0b2a10'; ctx.lineWidth = H * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + e * 0.3, H * 0.34); ctx.lineTo(x + e * 0.72, H * 0.6); ctx.moveTo(x + e * 0.52, H * 0.47); ctx.lineTo(x + e * 0.4, H * 0.72); ctx.stroke();
    }, 'STEAK', { font: FONT.heavy, weight: 900, spacing: 0.14, fill: '#52e252' }, 0.62);
  },
  // Escudo crema con una rama de romero y la palabra.
  'Alfa Romero': (ctx, W, H, dark) => {
    const e = H * 0.86;
    lockup(ctx, W, H, e * 0.8, x => {
      const w = e * 0.8, top = H * 0.07, bot = H * 0.93;
      ctx.fillStyle = '#f2ead3'; ctx.strokeStyle = '#9b0000'; ctx.lineWidth = w * 0.07;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w, H * 0.55); ctx.quadraticCurveTo(x + w, bot, x + w / 2, bot); ctx.quadraticCurveTo(x, bot, x, H * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#2f6b2f'; ctx.lineWidth = w * 0.05; ctx.beginPath(); ctx.moveTo(x + w / 2, H * 0.84); ctx.lineTo(x + w / 2, H * 0.18); ctx.stroke();
      ctx.fillStyle = '#3f8a3f'; for (let i = 0; i < 6; i++) { const y = H * (0.24 + i * 0.1), s = i % 2 ? 1 : -1; ctx.beginPath(); ctx.ellipse(x + w / 2 + s * w * 0.16, y, w * 0.16, w * 0.05, s * 0.6, 0, Math.PI * 2); ctx.fill(); }
    }, 'Alfa Romero', { font: FONT.cond, weight: 800, italic: true, spacing: 0.02, fill: ink(dark) }, 0.62);
  },
  // Cuatro anillos concéntricos y la palabra espaciada.
  'Cuatro Anillos': (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2;
      ['#e30613', ink(dark), '#e30613', ink(dark)].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = e * 0.06; ctx.beginPath(); ctx.arc(cx, cy, e * (0.46 - i * 0.11), 0, Math.PI * 2); ctx.stroke(); });
    }, 'CUATRO ANILLOS', { font: FONT.round, weight: 700, spacing: 0.12, fill: ink(dark) }, 0.42);
  },
  // MÓVIL en cursiva pesada y el 1 dentro de un cuadro rojo redondeado.
  'Móvil Uno': (ctx, W, H, dark) => {
    const o = { font: FONT.heavy, weight: 900, italic: true, spacing: -0.03, fill: ink(dark) };
    const box = H * 0.8;
    const size = fit(ctx, 'MÓVIL', W * 0.9 - box - H * 0.1, H * 0.66, o);
    ctx.font = `italic 900 ${size}px ${FONT.heavy}`; ctx.letterSpacing = `${Math.round(-0.03 * size)}px`;
    const tw = ctx.measureText('MÓVIL').width, x0 = (W - tw - box - H * 0.1) / 2;
    word(ctx, 'MÓVIL', x0, H / 2, size, o);
    const bx = x0 + tw + H * 0.1, by = (H - box) / 2;
    slanted(ctx, bx, by, box, box, box * 0.2); ctx.fillStyle = '#e30613'; ctx.fill();
    ctx.font = `italic 900 ${box * 0.78}px ${FONT.heavy}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '0px';
    ctx.fillText('1', bx + box / 2, H / 2 + box * 0.04); ctx.textAlign = 'left';
  },
  // «gugle» con la segunda g convertida en lupa de colores.
  Gugle: (ctx, W, H, dark) => {
    const colors = ['#4285f4', '#ea4335', '#fbbc05', '#4285f4', '#34a853'];
    const o = { font: FONT.round, weight: 700, spacing: -0.03 };
    const size = fit(ctx, 'gugle', W * 0.8, H * 0.72, o);
    ctx.font = `700 ${size}px ${FONT.round}`; ctx.letterSpacing = `${Math.round(-0.03 * size)}px`;
    const letters = [...'gugle'], widths = letters.map(l => ctx.measureText(l).width), total = widths.reduce((a, b) => a + b, 0);
    let x = (W - total) / 2;
    letters.forEach((l, i) => { word(ctx, l, x, H * 0.4, size, { ...o, fill: colors[i], stroke: dark ? undefined : undefined }); x += widths[i]; });
  },
};

// [TL7, 16/11/2026] Patrocinadores secundarios de las libreas 2023-2026, también dibujados a mano («continúa el mismo
// estilo, me gusta»). Mismo método: emblema propio a la izquierda y palabra con su letra y colores.
const R = FONT.round, C = FONT.cond, K = FONT.heavy;
/** Placa a todo el lienzo (recta, redondeada o inclinada) con la palabra dentro y un emblema opcional delante. */
function plated(ctx: Ctx, W: number, H: number, bg: string, text: string, o: WordOpts, shape: 'recta' | 'redonda' | 'inclinada', emblem?: (x: number, ph: number) => number): void {
  const ph = H * 0.86, py = (H - ph) / 2;
  const ew = emblem ? ph * 0.9 : 0;
  const size = fit(ctx, text, W * 0.86 - ew, ph * 0.64, o);
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight} ${size}px ${o.font}`; ctx.letterSpacing = `${Math.round((o.spacing ?? 0) * size)}px`;
  const tw = ctx.measureText(text).width * (o.stretch ?? 1), pw = Math.min(W * 0.98, tw + ew + ph * 0.8), px = (W - pw) / 2;
  if (shape === 'inclinada') slanted(ctx, px, py, pw, ph, ph * 0.28); else roundRect(ctx, px, py, pw, ph, shape === 'redonda' ? ph * 0.5 : ph * 0.1);
  ctx.fillStyle = bg; ctx.fill();
  let x = px + (pw - tw - ew) / 2;
  if (emblem) { emblem(x, ph); x += ew; }
  word(ctx, text, x, H / 2, size, o);
}
const circle = (ctx: Ctx, cx: number, cy: number, r: number, fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
const line = (ctx: Ctx, pts: number[][], color: string, w: number) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };

Object.assign(LOGOS, {
  // —— McPapaya ——
  // Esfera cromada con su brillo y «cromo» en gris acero.
  Cromo: (ctx, W, H, dark) => {
    const e = H * 0.86;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2, g = ctx.createRadialGradient(cx - e * 0.15, cy - e * 0.18, e * 0.05, cx, cy, e * 0.5);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#b9c2cc'); g.addColorStop(1, '#4b5561');
      circle(ctx, cx, cy, e * 0.46, g as unknown as string);
      ctx.strokeStyle = '#4285f4'; ctx.lineWidth = e * 0.06; ctx.beginPath(); ctx.arc(cx, cy, e * 0.46, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    }, 'cromo', { font: R, weight: 700, spacing: -0.02, fill: dark ? '#dfe5ea' : '#4b5561' }, 0.7);
  },
  // Cuenco humeante y la palabra en cursiva roja.
  Delicioso: (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#e4002b'; ctx.beginPath(); ctx.moveTo(x, H * 0.5); ctx.lineTo(x + e, H * 0.5); ctx.quadraticCurveTo(x + e, H * 0.9, x + e / 2, H * 0.9); ctx.quadraticCurveTo(x, H * 0.9, x, H * 0.5); ctx.fill();
      for (let i = 0; i < 3; i++) { const sx = x + e * (0.3 + i * 0.2); line(ctx, [[sx, H * 0.42], [sx - e * 0.06, H * 0.3], [sx + e * 0.04, H * 0.2], [sx, H * 0.1]], '#e4002b', e * 0.05); }
    }, 'Delicioso', { font: R, weight: 700, italic: true, spacing: -0.02, fill: dark ? '#ffffff' : '#e4002b' }, 0.66);
  },
  // Arroba blanca en un círculo naranja y «arrobas».
  Arrobas: (ctx, W, H, dark) => {
    const e = H * 0.88;
    lockup(ctx, W, H, e, x => {
      circle(ctx, x + e / 2, H / 2, e * 0.48, '#ff8000');
      ctx.font = `800 ${e * 0.72}px ${R}`; ctx.letterSpacing = '0px'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('@', x + e / 2, H / 2 + e * 0.02); ctx.textAlign = 'left';
    }, 'arrobas', { font: R, weight: 700, spacing: -0.02, fill: ink(dark) }, 0.7);
  },

  // —— Red Bulla ——
  // Esfera de reloj y TAG en rojo con HOYER en blanco sobre placa negra.
  'TAG Hoyer': (ctx, W, H) => {
    plated(ctx, W, H, '#0d0d0d', 'TAG HOYER', { font: K, weight: 900, spacing: 0.04, fill: '#ffffff' }, 'recta', (x, ph) => {
      const cx = x + ph * 0.42, cy = H / 2, r = ph * 0.32;
      ctx.strokeStyle = '#e30613'; ctx.lineWidth = ph * 0.06; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      line(ctx, [[cx, cy - r * 0.7], [cx, cy], [cx + r * 0.5, cy + r * 0.3]], '#ffffff', ph * 0.05);
      return 0;
    });
    // TAG en rojo encima del blanco: se repinta la primera palabra.
    const ph = H * 0.86, o = { font: K, weight: 900, spacing: 0.04 };
    const size = fit(ctx, 'TAG HOYER', W * 0.86 - ph * 0.9, ph * 0.64, o);
    ctx.font = `900 ${size}px ${K}`; ctx.letterSpacing = `${Math.round(0.04 * size)}px`;
    const tw = ctx.measureText('TAG HOYER').width, pw = Math.min(W * 0.98, tw + ph * 0.9 + ph * 0.8), x = (W - pw) / 2 + (pw - tw - ph * 0.9) / 2 + ph * 0.9;
    word(ctx, 'TAG', x, H / 2, size, { ...o, fill: '#e30613' });
  },
  // Jabalí de perfil (cabeza, colmillo y oreja) y PUMBA pesado.
  Pumba: (ctx, W, H, dark) => {
    const e = H * 1.0;
    lockup(ctx, W, H, e, x => {
      const c = dark ? '#ffffff' : '#141414';
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + e * 0.95, H * 0.5); ctx.quadraticCurveTo(x + e * 0.8, H * 0.15, x + e * 0.35, H * 0.25); ctx.lineTo(x + e * 0.05, H * 0.5); ctx.lineTo(x + e * 0.1, H * 0.7); ctx.quadraticCurveTo(x + e * 0.5, H * 0.95, x + e * 0.95, H * 0.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + e * 0.7, H * 0.25); ctx.lineTo(x + e * 0.85, H * 0.06); ctx.lineTo(x + e * 0.9, H * 0.35); ctx.fill();
      line(ctx, [[x + e * 0.2, H * 0.62], [x + e * 0.16, H * 0.4]], '#f2e6c8', e * 0.07);
      circle(ctx, x + e * 0.45, H * 0.42, e * 0.05, dark ? '#141414' : '#ffffff');
    }, 'PUMBA', { font: K, weight: 900, italic: true, spacing: 0.02, fill: ink(dark) }, 0.66);
  },
  // Placa azul redondeada con un rayo y FORTITO en cursiva blanca.
  Fortito: (ctx, W, H) => {
    plated(ctx, W, H, '#003478', 'FORTITO', { font: C, weight: 800, italic: true, spacing: 0.04, fill: '#ffffff' }, 'redonda', (x, ph) => {
      ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); const y = (H - ph) / 2;
      ctx.moveTo(x + ph * 0.5, y + ph * 0.12); ctx.lineTo(x + ph * 0.2, y + ph * 0.56); ctx.lineTo(x + ph * 0.42, y + ph * 0.56); ctx.lineTo(x + ph * 0.3, y + ph * 0.9); ctx.lineTo(x + ph * 0.68, y + ph * 0.42); ctx.lineTo(x + ph * 0.46, y + ph * 0.42); ctx.closePath(); ctx.fill();
      return 0;
    });
  },

  // —— Errari ——
  // Círculo rojo con una ola blanca en S y la palabra en rojo.
  Santandreu: (ctx, W, H, dark) => {
    const e = H * 0.88;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2; circle(ctx, cx, cy, e * 0.48, '#ec0000');
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e * 0.09; ctx.lineCap = 'round'; for (const dy of [-0.13, 0.13]) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; ctx.lineTo(cx - e * 0.3 + u * e * 0.6, cy + e * dy + Math.sin(u * Math.PI * 2) * e * 0.08); } ctx.stroke(); }
    }, 'Santandreu', { font: R, weight: 700, spacing: -0.02, fill: dark ? '#ffffff' : '#ec0000' }, 0.64);
  },
  // Gafas de sol y RAY-BON en cursiva pesada.
  'Ray-Bon': (ctx, W, H, dark) => {
    const e = H * 1.2;
    lockup(ctx, W, H, e, x => {
      const c = dark ? '#ffffff' : '#141414', y = H * 0.38;
      ctx.fillStyle = '#c8102e';
      for (const dx of [0.05, 0.55]) { ctx.beginPath(); ctx.moveTo(x + e * dx, y); ctx.lineTo(x + e * (dx + 0.4), y); ctx.quadraticCurveTo(x + e * (dx + 0.38), H * 0.78, x + e * (dx + 0.2), H * 0.76); ctx.quadraticCurveTo(x + e * dx, H * 0.74, x + e * dx, y); ctx.fill(); }
      line(ctx, [[x, y], [x + e, y]], c, H * 0.06); line(ctx, [[x + e * 0.45, y + H * 0.05], [x + e * 0.55, y + H * 0.05]], c, H * 0.05);
    }, 'RAY-BON', { font: K, weight: 900, italic: true, spacing: -0.02, fill: ink(dark) }, 0.6, 0.08);
  },
  // Esfera de reloj en tonel y la palabra muy espaciada y fina.
  'Ricardo Mil': (ctx, W, H, dark) => {
    const e = H * 0.7;
    lockup(ctx, W, H, e, x => {
      const c = dark ? '#ffffff' : '#141414';
      ctx.strokeStyle = c; ctx.lineWidth = e * 0.09; ctx.beginPath(); ctx.moveTo(x + e * 0.15, H * 0.1); ctx.quadraticCurveTo(x - e * 0.05, H / 2, x + e * 0.15, H * 0.9); ctx.lineTo(x + e * 0.85, H * 0.9); ctx.quadraticCurveTo(x + e * 1.05, H / 2, x + e * 0.85, H * 0.1); ctx.closePath(); ctx.stroke();
      line(ctx, [[x + e / 2, H * 0.28], [x + e / 2, H / 2], [x + e * 0.7, H * 0.6]], '#c8102e', e * 0.08);
    }, 'RICARDO MIL', { font: R, weight: 600, spacing: 0.2, fill: ink(dark) }, 0.44);
  },

  // —— Totocedes ——
  // Tres galones apilados y la palabra espaciada.
  'Inéditos': (ctx, W, H, dark) => {
    const e = H * 0.8;
    lockup(ctx, W, H, e, x => {
      for (let i = 0; i < 3; i++) { const y = H * (0.22 + i * 0.22); line(ctx, [[x + e * 0.1, y + e * 0.18], [x + e / 2, y - e * 0.06], [x + e * 0.9, y + e * 0.18]], i === 1 ? '#c8102e' : ink(dark), e * 0.11); }
    }, 'INÉDITOS', { font: R, weight: 700, spacing: 0.22, fill: ink(dark) }, 0.5);
  },
  // Chip cuadrado con patitas y «cualcom» en azul.
  Cualcom: (ctx, W, H, dark) => {
    const e = H * 0.86;
    lockup(ctx, W, H, e, x => {
      const s = e * 0.62, sx = x + (e - s) / 2, sy = (H - s) / 2;
      ctx.fillStyle = '#3253dc'; roundRect(ctx, sx, sy, s, s, s * 0.12); ctx.fill(); if (dark) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.05; ctx.stroke(); ctx.fillStyle = '#3253dc'; }
      for (let i = 0; i < 4; i++) { const o = sx + s * (0.14 + i * 0.24); ctx.fillRect(o, sy - e * 0.12, s * 0.1, e * 0.1); ctx.fillRect(o, sy + s + e * 0.02, s * 0.1, e * 0.1); ctx.fillRect(sx - e * 0.12, sy + s * (0.14 + i * 0.24), e * 0.1, s * 0.1); ctx.fillRect(sx + s + e * 0.02, sy + s * (0.14 + i * 0.24), e * 0.1, s * 0.1); }
      circle(ctx, sx + s / 2, sy + s / 2, s * 0.18, '#ffffff');
    }, 'cualcom', { font: R, weight: 700, spacing: -0.02, fill: dark ? '#ffffff' : '#3253dc' }, 0.7);
  },
  // Pajarita roja y azul y la palabra espaciada.
  'Hilfígaro': (ctx, W, H, dark) => {
    const e = H * 1.0;
    lockup(ctx, W, H, e, x => {
      const cy = H / 2;
      ctx.fillStyle = '#0b2a5b'; ctx.beginPath(); ctx.moveTo(x + e / 2, cy); ctx.lineTo(x, cy - H * 0.3); ctx.lineTo(x, cy + H * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(x + e / 2, cy); ctx.lineTo(x + e, cy - H * 0.3); ctx.lineTo(x + e, cy + H * 0.3); ctx.closePath(); ctx.fill();
      roundRect(ctx, x + e * 0.4, cy - H * 0.12, e * 0.2, H * 0.24, e * 0.04); ctx.fillStyle = dark ? '#ffffff' : '#141414'; ctx.fill();
    }, 'HILFÍGARO', { font: R, weight: 700, spacing: 0.16, fill: dark ? '#ffffff' : '#0b2a5b' }, 0.5);
  },
  // Pluma azul y «Microsuave».
  Microsuave: (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#00a4ef'; ctx.beginPath(); ctx.moveTo(x + e * 0.1, H * 0.92); ctx.bezierCurveTo(x + e * 0.1, H * 0.4, x + e * 0.6, H * 0.06, x + e * 0.95, H * 0.08); ctx.bezierCurveTo(x + e * 0.9, H * 0.5, x + e * 0.5, H * 0.8, x + e * 0.1, H * 0.92); ctx.fill();
      line(ctx, [[x + e * 0.1, H * 0.92], [x + e * 0.7, H * 0.28]], dark ? '#141414' : '#ffffff', e * 0.04);
    }, 'Microsuave', { font: R, weight: 600, spacing: -0.02, fill: ink(dark) }, 0.62);
  },

  // —— Aston Papá ——
  // Antifaz y «incógnito».
  'Incógnito': (ctx, W, H, dark) => {
    const e = H * 1.2;
    lockup(ctx, W, H, e, x => {
      const cy = H / 2; ctx.fillStyle = dark ? '#ffffff' : '#141414';
      ctx.beginPath(); ctx.moveTo(x, cy - H * 0.12); ctx.quadraticCurveTo(x + e / 2, cy - H * 0.38, x + e, cy - H * 0.12); ctx.quadraticCurveTo(x + e * 0.95, cy + H * 0.3, x + e * 0.62, cy + H * 0.2); ctx.quadraticCurveTo(x + e / 2, cy + H * 0.05, x + e * 0.38, cy + H * 0.2); ctx.quadraticCurveTo(x + e * 0.05, cy + H * 0.3, x, cy - H * 0.12); ctx.fill();
      ctx.fillStyle = '#cedc00'; for (const dx of [0.28, 0.72]) { ctx.beginPath(); ctx.ellipse(x + e * dx, cy, e * 0.11, H * 0.08, 0, 0, Math.PI * 2); ctx.fill(); }
    }, 'incógnito', { font: R, weight: 700, spacing: -0.02, fill: ink(dark) }, 0.66, 0.08);
  },
  // Rueda dentada de válvula y VALVULINA ancha en cursiva.
  Valvulina: (ctx, W, H, dark) => {
    const e = H * 0.88;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2; star(ctx, cx, cy, e * 0.48, e * 0.38, 10, 0); ctx.fillStyle = '#cedc00'; ctx.fill();
      circle(ctx, cx, cy, e * 0.2, '#0a3d2c'); line(ctx, [[cx, cy - e * 0.3], [cx, cy + e * 0.3]], '#cedc00', e * 0.08);
    }, 'VALVULINA', { font: K, weight: 900, italic: true, spacing: -0.02, fill: ink(dark) }, 0.58);
  },
  // Piruleta en espiral roja y amarilla y PIRULÍ sobre placa negra.
  'Pirulí': (ctx, W, H) => {
    plated(ctx, W, H, '#0d0d0d', 'PIRULÍ', { font: K, weight: 900, spacing: 0.02, fill: '#ffd400' }, 'redonda', (x, ph) => {
      const cx = x + ph * 0.45, cy = H / 2 - ph * 0.08, r = ph * 0.3;
      circle(ctx, cx, cy, r, '#ffd400'); ctx.strokeStyle = '#e30613'; ctx.lineWidth = ph * 0.06; ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.1) { const rr = r * 0.9 * (a / (Math.PI * 4)); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.stroke();
      line(ctx, [[cx, cy + r], [cx, cy + ph * 0.5]], '#ffffff', ph * 0.06);
      return 0;
    });
  },
  // Cartera verde con una moneda y la palabra en dos tonos.
  'Papá Paga': (ctx, W, H, dark) => {
    const e = H * 0.95;
    const o = { font: C, weight: 800, italic: true, spacing: 0.02 };
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#0a5c3c'; roundRect(ctx, x, H * 0.25, e * 0.85, H * 0.6, e * 0.08); ctx.fill();
      ctx.fillStyle = '#cedc00'; roundRect(ctx, x + e * 0.5, H * 0.42, e * 0.4, H * 0.26, e * 0.06); ctx.fill();
      circle(ctx, x + e * 0.7, H * 0.2, e * 0.16, '#f7c600');
    }, 'PAPÁ PAGA', { ...o, fill: ink(dark) }, 0.68);
    const size = fit(ctx, 'PAPÁ PAGA', W * 0.94 - e - H * 0.12, H * 0.68, o);
    ctx.font = `italic 800 ${size}px ${C}`; ctx.letterSpacing = `${Math.round(0.02 * size)}px`;
    const full = ctx.measureText('PAPÁ PAGA').width, first = ctx.measureText('PAPÁ ').width;
    const x0 = (W - (e + H * 0.12 + full)) / 2 + e + H * 0.12;
    word(ctx, 'PAGA', x0 + first, H / 2, size, { ...o, fill: '#cedc00' });
  },

  // —— Vowlliams ——
  // Placa azul cielo con un vaso y su gota y GULPF en naranja.
  Gulpf: (ctx, W, H) => {
    plated(ctx, W, H, '#8fd3f4', 'GULPF', { font: K, weight: 900, spacing: 0.02, fill: '#f26b21', stroke: '#0a3a8c', strokeW: H * 0.03 }, 'redonda', (x, ph) => {
      const y = (H - ph) / 2; ctx.fillStyle = '#f26b21';
      ctx.beginPath(); ctx.moveTo(x + ph * 0.18, y + ph * 0.3); ctx.lineTo(x + ph * 0.72, y + ph * 0.3); ctx.lineTo(x + ph * 0.62, y + ph * 0.86); ctx.lineTo(x + ph * 0.28, y + ph * 0.86); ctx.closePath(); ctx.fill();
      circle(ctx, x + ph * 0.45, y + ph * 0.14, ph * 0.08, '#0a3a8c');
      return 0;
    });
  },
  // Tentáculo enroscado morado y KRAQUEN ancho.
  Kraquen: (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      ctx.strokeStyle = '#7b3fe4'; ctx.lineCap = 'round'; ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) { const a = t * Math.PI * 3, r = e * 0.45 * (1 - t * 0.85); ctx.lineTo(x + e / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); }
      ctx.lineWidth = e * 0.13; ctx.stroke();
      for (let i = 0; i < 4; i++) circle(ctx, x + e / 2 + Math.cos(i * 0.6) * e * 0.45 * 0.85, H / 2 + Math.sin(i * 0.6) * e * 0.38, e * 0.03, '#e5d6ff');
    }, 'KRAQUEN', { font: K, weight: 900, spacing: 0, stretch: 1.1, fill: ink(dark) }, 0.62);
  },
  // Rombo tallado en línea fina y «sofistica» elegante y espaciada.
  Sofistica: (ctx, W, H, dark) => {
    const e = H * 0.8;
    lockup(ctx, W, H, e, x => {
      const c = dark ? '#e8d9a8' : '#8a6d1f', cx = x + e / 2;
      line(ctx, [[x, H * 0.38], [x + e * 0.22, H * 0.16], [x + e * 0.78, H * 0.16], [x + e, H * 0.38], [cx, H * 0.88], [x, H * 0.38], [x + e, H * 0.38]], c, e * 0.06);
      line(ctx, [[x + e * 0.3, H * 0.38], [cx, H * 0.88], [x + e * 0.7, H * 0.38]], c, e * 0.04);
    }, 'SOFISTICA', { font: R, weight: 500, spacing: 0.3, fill: ink(dark) }, 0.46);
  },
  // Brazo de excavadora amarillo y KOMATSÚ azul.
  'Komatsú': (ctx, W, H, dark) => {
    const e = H * 1.0;
    lockup(ctx, W, H, e, x => {
      line(ctx, [[x + e * 0.1, H * 0.85], [x + e * 0.4, H * 0.18], [x + e * 0.85, H * 0.4]], '#ffc20e', e * 0.13);
      ctx.fillStyle = '#ffc20e'; ctx.beginPath(); ctx.moveTo(x + e * 0.75, H * 0.42); ctx.lineTo(x + e, H * 0.5); ctx.lineTo(x + e * 0.88, H * 0.82); ctx.lineTo(x + e * 0.7, H * 0.7); ctx.closePath(); ctx.fill();
      circle(ctx, x + e * 0.4, H * 0.18, e * 0.06, '#141414');
    }, 'KOMATSÚ', { font: K, weight: 900, spacing: 0.02, fill: dark ? '#ffffff' : '#0a3a8c' }, 0.6);
  },
  // Llave antigua azul y BARCLAUS.
  Barclaus: (ctx, W, H, dark) => {
    const e = H * 1.05;
    lockup(ctx, W, H, e, x => {
      ctx.strokeStyle = '#00aeef'; ctx.lineWidth = e * 0.09; ctx.beginPath(); ctx.arc(x + e * 0.24, H / 2, e * 0.2, 0, Math.PI * 2); ctx.stroke();
      line(ctx, [[x + e * 0.44, H / 2], [x + e, H / 2]], '#00aeef', e * 0.09);
      line(ctx, [[x + e * 0.78, H / 2], [x + e * 0.78, H * 0.72]], '#00aeef', e * 0.08); line(ctx, [[x + e * 0.94, H / 2], [x + e * 0.94, H * 0.66]], '#00aeef', e * 0.08);
    }, 'BARCLAUS', { font: R, weight: 700, spacing: 0.08, fill: dark ? '#ffffff' : '#00395d' }, 0.56);
  },

  // —— Racing Bueyes ——
  // Toalla a rayas colgada y la palabra.
  'Alfa Toalla': (ctx, W, H, dark) => {
    const e = H * 0.8;
    lockup(ctx, W, H, e, x => {
      line(ctx, [[x, H * 0.12], [x + e, H * 0.12]], ink(dark), e * 0.06);
      ctx.fillStyle = '#ffffff'; roundRect(ctx, x + e * 0.12, H * 0.16, e * 0.76, H * 0.72, e * 0.06); ctx.fill();
      ctx.fillStyle = '#1e5bc6'; ctx.fillRect(x + e * 0.12, H * 0.66, e * 0.76, H * 0.08); ctx.fillStyle = '#e30613'; ctx.fillRect(x + e * 0.12, H * 0.76, e * 0.76, H * 0.05);
    }, 'ALFA TOALLA', { font: C, weight: 800, spacing: 0.06, fill: ink(dark) }, 0.62);
  },
  // Sol rojo con rayos y ORLANDO.
  Orlando: (ctx, W, H, dark) => {
    const e = H * 0.92;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; line(ctx, [[cx + Math.cos(a) * e * 0.3, cy + Math.sin(a) * e * 0.3], [cx + Math.cos(a) * e * 0.48, cy + Math.sin(a) * e * 0.48]], '#e30613', e * 0.07); }
      circle(ctx, cx, cy, e * 0.24, '#e30613');
    }, 'ORLANDO', { font: K, weight: 900, spacing: 0.02, fill: dark ? '#ffffff' : '#e30613' }, 0.6);
  },
  // Mancha de tinta azul y «mancha azul».
  'Mancha Azul': (ctx, W, H, dark) => {
    const e = H * 0.92;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2; ctx.fillStyle = '#1e5bc6'; ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = i * Math.PI / 8, r = e * (i % 2 ? 0.32 : 0.46) * (1 + 0.12 * Math.sin(i * 2.3)); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.fill();
      circle(ctx, cx + e * 0.42, cy - e * 0.38, e * 0.06, '#1e5bc6'); circle(ctx, cx - e * 0.44, cy + e * 0.36, e * 0.05, '#1e5bc6');
    }, 'mancha azul', { font: R, weight: 700, spacing: -0.02, fill: dark ? '#ffffff' : '#1e5bc6' }, 0.62);
  },
  // Cuadro con rayas de cebra y ZEBRITA.
  Zebrita: (ctx, W, H, dark) => {
    const e = H * 0.86;
    lockup(ctx, W, H, e, x => {
      const y = (H - e) / 2; ctx.save(); roundRect(ctx, x, y, e, e, e * 0.18); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.clip();
      ctx.fillStyle = '#141414'; for (let i = -2; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + i * e * 0.26, y); ctx.lineTo(x + i * e * 0.26 + e * 0.12, y); ctx.lineTo(x + i * e * 0.26 + e * 0.52, y + e); ctx.lineTo(x + i * e * 0.26 + e * 0.4, y + e); ctx.fill(); }
      ctx.restore(); ctx.strokeStyle = ink(dark); ctx.lineWidth = e * 0.05; roundRect(ctx, x, y, e, e, e * 0.18); ctx.stroke();
    }, 'ZEBRITA', { font: K, weight: 900, italic: true, spacing: -0.02, fill: ink(dark) }, 0.62);
  },
  // Porción de bizcocho con su capa de nata y «bizcocho».
  Bizcocho: (ctx, W, H, dark) => {
    const e = H * 1.0;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#e0a458'; ctx.beginPath(); ctx.moveTo(x, H * 0.85); ctx.lineTo(x + e, H * 0.85); ctx.lineTo(x + e, H * 0.38); ctx.lineTo(x, H * 0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.moveTo(x, H * 0.62); ctx.lineTo(x + e, H * 0.38); ctx.lineTo(x + e, H * 0.28); ctx.lineTo(x, H * 0.52); ctx.closePath(); ctx.fill();
      circle(ctx, x + e * 0.8, H * 0.24, e * 0.09, '#e30613');
    }, 'bizcocho', { font: R, weight: 700, spacing: -0.02, fill: ink(dark) }, 0.66);
  },
  // Corona fina y HUGO JEFE espaciado.
  'Hugo Jefe': (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = dark ? '#ffffff' : '#141414'; ctx.beginPath();
      ctx.moveTo(x, H * 0.75); ctx.lineTo(x + e * 0.05, H * 0.3); ctx.lineTo(x + e * 0.3, H * 0.52); ctx.lineTo(x + e / 2, H * 0.2); ctx.lineTo(x + e * 0.7, H * 0.52); ctx.lineTo(x + e * 0.95, H * 0.3); ctx.lineTo(x + e, H * 0.75); ctx.closePath(); ctx.fill();
      ctx.fillRect(x, H * 0.8, e, H * 0.06);
    }, 'HUGO JEFE', { font: R, weight: 600, spacing: 0.22, fill: ink(dark) }, 0.5);
  },
  // Franja de cuadros de taxi y TAXÍMETRO en placa negra.
  'Taxímetro': (ctx, W, H) => {
    plated(ctx, W, H, '#0d0d0d', 'TAXÍMETRO', { font: C, weight: 800, italic: true, spacing: 0.04, fill: '#ffffff' }, 'inclinada', (x, ph) => {
      const y = (H - ph) / 2 + ph * 0.25, s = ph * 0.18;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) % 2 ? '#ffd400' : '#0d0d0d'; ctx.fillRect(x + c * s, y + r * s, s, s); }
      return 0;
    });
  },

  // —— Haasta Luego ——
  // Gancho de grúa y PALFÍNGUER.
  'Palfínguer': (ctx, W, H, dark) => {
    const e = H * 0.8;
    lockup(ctx, W, H, e, x => {
      line(ctx, [[x + e / 2, H * 0.06], [x + e / 2, H * 0.4]], ink(dark), e * 0.08);
      ctx.strokeStyle = '#e30613'; ctx.lineWidth = e * 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x + e * 0.4, H * 0.6, e * 0.24, -Math.PI * 0.5, Math.PI * 1.1); ctx.stroke();
    }, 'PALFÍNGUER', { font: K, weight: 900, spacing: -0.02, fill: ink(dark) }, 0.56);
  },
  // Guindilla roja con su rabito verde y «chipotlé».
  'Chipotlé': (ctx, W, H, dark) => {
    const e = H * 1.0;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(x + e * 0.75, H * 0.28); ctx.bezierCurveTo(x + e * 0.95, H * 0.5, x + e * 0.5, H * 0.95, x + e * 0.05, H * 0.85); ctx.bezierCurveTo(x + e * 0.45, H * 0.75, x + e * 0.55, H * 0.4, x + e * 0.75, H * 0.28); ctx.fill();
      line(ctx, [[x + e * 0.74, H * 0.3], [x + e * 0.8, H * 0.14], [x + e * 0.95, H * 0.1]], '#3a8a2a', e * 0.07);
    }, 'chipotlé', { font: R, weight: 700, italic: true, spacing: -0.02, fill: ink(dark) }, 0.66);
  },
  // Altavoz con ondas y BOSÉ espaciado.
  'Bosé': (ctx, W, H, dark) => {
    const e = H * 0.95;
    lockup(ctx, W, H, e, x => {
      const c = ink(dark); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, H * 0.38); ctx.lineTo(x + e * 0.2, H * 0.38); ctx.lineTo(x + e * 0.45, H * 0.15); ctx.lineTo(x + e * 0.45, H * 0.85); ctx.lineTo(x + e * 0.2, H * 0.62); ctx.lineTo(x, H * 0.62); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 2; i++) { ctx.strokeStyle = '#e30613'; ctx.lineWidth = e * 0.07; ctx.beginPath(); ctx.arc(x + e * 0.45, H / 2, e * (0.22 + i * 0.2), -0.8, 0.8); ctx.stroke(); }
    }, 'BOSÉ', { font: R, weight: 700, spacing: 0.3, fill: ink(dark) }, 0.56);
  },
  // Llama azul y naranja y GAZÚ en cursiva.
  'Gazú': (ctx, W, H, dark) => {
    const e = H * 0.8;
    lockup(ctx, W, H, e, x => {
      const flame = (s: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + e / 2, H * (0.92 - 0.82 * s)); ctx.bezierCurveTo(x + e * (0.5 + 0.55 * s), H * 0.5, x + e * (0.5 + 0.45 * s), H * 0.92, x + e / 2, H * 0.92); ctx.bezierCurveTo(x + e * (0.5 - 0.45 * s), H * 0.92, x + e * (0.5 - 0.55 * s), H * 0.55, x + e / 2, H * (0.92 - 0.82 * s)); ctx.fill(); };
      flame(1, '#1e5bc6'); flame(0.55, '#ff8000');
    }, 'GAZÚ', { font: K, weight: 900, italic: true, spacing: 0, fill: ink(dark) }, 0.66);
  },

  // —— Alpino Grigio ——
  // Placa verde con una gota de aceite y CASTORO.
  Castoro: (ctx, W, H) => {
    plated(ctx, W, H, '#007a3d', 'CASTORO', { font: K, weight: 900, italic: true, spacing: 0, fill: '#ffffff' }, 'inclinada', (x, ph) => {
      const cx = x + ph * 0.48, y = (H - ph) / 2; ctx.fillStyle = '#e30613';
      ctx.beginPath(); ctx.moveTo(cx, y + ph * 0.12); ctx.bezierCurveTo(cx + ph * 0.32, y + ph * 0.5, cx + ph * 0.26, y + ph * 0.86, cx, y + ph * 0.86); ctx.bezierCurveTo(cx - ph * 0.26, y + ph * 0.86, cx - ph * 0.32, y + ph * 0.5, cx, y + ph * 0.12); ctx.fill();
      return 0;
    });
  },
  // Copo de nieve rojo, MAPFRÍO y su trazo.
  'Mapfrío': (ctx, W, H, dark) => {
    const e = H * 0.86;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2;
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; line(ctx, [[cx - Math.cos(a) * e * 0.45, cy - Math.sin(a) * e * 0.45], [cx + Math.cos(a) * e * 0.45, cy + Math.sin(a) * e * 0.45]], '#d81e05', e * 0.09); }
      circle(ctx, cx, cy, e * 0.12, '#d81e05');
    }, 'MAPFRÍO', { font: C, weight: 800, italic: true, spacing: 0.02, fill: dark ? '#ffffff' : '#d81e05' }, 0.7);
  },
  // Placa roja partida como una tableta y KAT-KIT.
  'Kat-Kit': (ctx, W, H) => {
    plated(ctx, W, H, '#d2001e', 'KAT-KIT', { font: K, weight: 900, spacing: 0.02, fill: '#ffffff' }, 'recta');
  },
  // Rayo dentro de un círculo azul y «salesfuerza».
  Salesfuerza: (ctx, W, H, dark) => {
    const e = H * 0.88;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2; circle(ctx, cx, H / 2, e * 0.48, '#00a1e0');
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx + e * 0.06, H / 2 - e * 0.36); ctx.lineTo(cx - e * 0.2, H / 2 + e * 0.06); ctx.lineTo(cx - e * 0.02, H / 2 + e * 0.06); ctx.lineTo(cx - e * 0.08, H / 2 + e * 0.36); ctx.lineTo(cx + e * 0.2, H / 2 - e * 0.06); ctx.lineTo(cx + e * 0.02, H / 2 - e * 0.06); ctx.closePath(); ctx.fill();
    }, 'salesfuerza', { font: R, weight: 700, spacing: -0.02, fill: dark ? '#ffffff' : '#0070a8' }, 0.62);
  },

  // —— Steak Sauber / Audiencia ——
  // Cristal verde tallado y KRIPTÓN.
  'Kriptón': (ctx, W, H, dark) => {
    const e = H * 0.7;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.moveTo(x + e / 2, H * 0.06); ctx.lineTo(x + e, H * 0.38); ctx.lineTo(x + e * 0.75, H * 0.94); ctx.lineTo(x + e * 0.25, H * 0.94); ctx.lineTo(x, H * 0.38); ctx.closePath(); ctx.fill();
      line(ctx, [[x + e / 2, H * 0.06], [x + e / 2, H * 0.94]], '#0a5c3c', e * 0.06); line(ctx, [[x, H * 0.38], [x + e, H * 0.38]], '#0a5c3c', e * 0.06);
    }, 'KRIPTÓN', { font: K, weight: 900, spacing: 0.04, fill: ink(dark) }, 0.6);
  },
  // Placa verde musgo con tres hojitas y MUSGO OIL.
  'Musgo Oil': (ctx, W, H) => {
    plated(ctx, W, H, '#2d5016', 'MUSGO OIL', { font: C, weight: 800, spacing: 0.06, fill: '#ffffff' }, 'redonda', (x, ph) => {
      ctx.fillStyle = '#9ad35a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + ph * (0.25 + i * 0.2), H / 2 + (i % 2 ? -ph * 0.08 : ph * 0.08), ph * 0.09, ph * 0.22, (i - 1) * 0.5, 0, Math.PI * 2); ctx.fill(); }
      return 0;
    });
  },
  // Placa verde neón con una gota de salsa y KIK SALSA en negro.
  'Kik Salsa': (ctx, W, H) => {
    plated(ctx, W, H, '#53fc18', 'KIK SALSA', { font: K, weight: 900, italic: true, spacing: 0, fill: '#000000' }, 'inclinada', (x, ph) => {
      const cx = x + ph * 0.45, y = (H - ph) / 2; ctx.fillStyle = '#e30613';
      ctx.beginPath(); ctx.moveTo(cx, y + ph * 0.14); ctx.bezierCurveTo(cx + ph * 0.3, y + ph * 0.5, cx + ph * 0.24, y + ph * 0.86, cx, y + ph * 0.86); ctx.bezierCurveTo(cx - ph * 0.24, y + ph * 0.86, cx - ph * 0.3, y + ph * 0.5, cx, y + ph * 0.14); ctx.fill();
      return 0;
    });
  },
  // Nube naranja de contorno y «AWSome nube».
  'AWSome Nube': (ctx, W, H, dark) => {
    const e = H * 1.1;
    lockup(ctx, W, H, e, x => {
      ctx.fillStyle = '#ff9900'; ctx.beginPath(); ctx.arc(x + e * 0.3, H * 0.58, e * 0.2, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(x + e * 0.52, H * 0.4, e * 0.24, Math.PI, 0); ctx.arc(x + e * 0.76, H * 0.56, e * 0.2, Math.PI * 1.5, Math.PI * 0.5); ctx.closePath(); ctx.fill();
      line(ctx, [[x + e * 0.36, H * 0.62], [x + e * 0.52, H * 0.7], [x + e * 0.68, H * 0.62]], dark ? '#141414' : '#ffffff', e * 0.05);
    }, 'AWSome nube', { font: R, weight: 700, spacing: -0.02, fill: ink(dark) }, 0.7);
  },
  // Dos flechas en círculo y «revolución».
  'Revolución': (ctx, W, H, dark) => {
    const e = H * 0.86;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H / 2, r = e * 0.36;
      for (const s of [0, Math.PI]) {
        ctx.strokeStyle = '#7b3fe4'; ctx.lineWidth = e * 0.11; ctx.beginPath(); ctx.arc(cx, cy, r, s + 0.3, s + Math.PI - 0.5); ctx.stroke();
        const a = s + Math.PI - 0.5, tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r; ctx.fillStyle = '#7b3fe4'; ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * e * 0.14, ty + Math.sin(a) * e * 0.14); ctx.lineTo(tx - Math.cos(a) * e * 0.14, ty - Math.sin(a) * e * 0.14); ctx.lineTo(tx + Math.cos(a + Math.PI / 2) * e * 0.18, ty + Math.sin(a + Math.PI / 2) * e * 0.18); ctx.fill();
      }
    }, 'revolución', { font: R, weight: 700, spacing: -0.02, fill: ink(dark) }, 0.64);
  },
  // Dos eslabones naranjas y NEXOFIT.
  Nexofit: (ctx, W, H, dark) => {
    const e = H * 1.1;
    lockup(ctx, W, H, e, x => {
      ctx.lineWidth = e * 0.09;
      ctx.strokeStyle = '#ff4f00'; roundRect(ctx, x + e * 0.02, H * 0.32, e * 0.56, H * 0.36, H * 0.18); ctx.stroke();
      ctx.strokeStyle = ink(dark); roundRect(ctx, x + e * 0.42, H * 0.32, e * 0.56, H * 0.36, H * 0.18); ctx.stroke();
    }, 'NEXOFIT', { font: K, weight: 900, italic: true, spacing: 0, fill: ink(dark) }, 0.6);
  },
  // Cara de panda y «bitpandita».
  Bitpandita: (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => {
      const cx = x + e / 2, cy = H * 0.55;
      for (const s of [-1, 1]) { circle(ctx, cx + s * e * 0.32, cy - e * 0.34, e * 0.14, '#141414'); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e * 0.04; ctx.beginPath(); ctx.arc(cx + s * e * 0.32, cy - e * 0.34, e * 0.14, 0, Math.PI * 2); ctx.stroke(); }
      circle(ctx, cx, cy, e * 0.42, '#ffffff'); ctx.strokeStyle = '#141414'; ctx.lineWidth = e * 0.04; ctx.beginPath(); ctx.arc(cx, cy, e * 0.42, 0, Math.PI * 2); ctx.stroke();
      for (const s of [-1, 1]) { ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.ellipse(cx + s * e * 0.16, cy - e * 0.04, e * 0.1, e * 0.13, s * 0.5, 0, Math.PI * 2); ctx.fill(); }
      circle(ctx, cx, cy + e * 0.14, e * 0.06, '#141414');
    }, 'bitpandita', { font: R, weight: 700, spacing: -0.02, fill: dark ? '#ffffff' : '#141414' }, 0.62);
  },
} satisfies Record<string, LogoDraw>);

// [TL7, 16/11/2026] Patrocinadores de reserva (los que entran en las libreas después de 2026), también a mano: «haz los
// de reserva, nos vendrá bien tenerlos todos». Cada uno con su emblema; `mk` solo ahorra repetir el encaje.
type Ink = string | ((dark: boolean) => string);
function mk(text: string, o: Omit<WordOpts, 'fill'> & { fill: Ink }, ratio: number, ew: number, draw: (ctx: Ctx, x: number, e: number, H: number, dark: boolean) => void): LogoDraw {
  return (ctx, W, H, dark) => {
    const e = H * ew;
    lockup(ctx, W, H, e, x => draw(ctx, x, e, H, dark), text, { ...o, fill: typeof o.fill === 'function' ? o.fill(dark) : o.fill }, ratio);
  };
}
const inkOr = (light: string) => (dark: boolean) => (dark ? '#ffffff' : light);
const fruit = (ctx: Ctx, cx: number, cy: number, r: number, skin: string, flesh: string, segs: number) => {
  circle(ctx, cx, cy, r, skin); circle(ctx, cx, cy, r * 0.82, flesh);
  for (let i = 0; i < segs; i++) { const a = i * Math.PI * 2 / segs; line(ctx, [[cx, cy], [cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8]], skin, r * 0.08); }
};
const leaf = (ctx: Ctx, x: number, y: number, s: number, rot: number, color: string) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -s / 2, s * 0.28, s / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
const drop = (ctx: Ctx, cx: number, top: number, bottom: number, w: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(cx, top); ctx.bezierCurveTo(cx + w, top + (bottom - top) * 0.55, cx + w * 0.8, bottom, cx, bottom); ctx.bezierCurveTo(cx - w * 0.8, bottom, cx - w, top + (bottom - top) * 0.55, cx, top); ctx.fill(); };
const mountain = (ctx: Ctx, x: number, e: number, H: number, rock: string, snow: string) => {
  ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(x, H * 0.88); ctx.lineTo(x + e * 0.38, H * 0.14); ctx.lineTo(x + e * 0.62, H * 0.5); ctx.lineTo(x + e * 0.75, H * 0.34); ctx.lineTo(x + e, H * 0.88); ctx.closePath(); ctx.fill();
  ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(x + e * 0.25, H * 0.4); ctx.lineTo(x + e * 0.38, H * 0.14); ctx.lineTo(x + e * 0.52, H * 0.4); ctx.lineTo(x + e * 0.44, H * 0.34); ctx.lineTo(x + e * 0.38, H * 0.42); ctx.lineTo(x + e * 0.32, H * 0.34); ctx.closePath(); ctx.fill();
};
const horns = (ctx: Ctx, cx: number, cy: number, e: number, color: string) => {
  ctx.strokeStyle = color; ctx.lineWidth = e * 0.13; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * e * 0.12, cy + e * 0.15); ctx.quadraticCurveTo(cx + s * e * 0.5, cy + e * 0.1, cx + s * e * 0.42, cy - e * 0.35); ctx.stroke(); }
};
const cow = (ctx: Ctx, cx: number, cy: number, e: number, face: string, spot: string) => {
  ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(cx, cy, e * 0.3, e * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * e * 0.38, cy - e * 0.18, e * 0.14, e * 0.07, s * -0.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f2a1b5'; ctx.beginPath(); ctx.ellipse(cx, cy + e * 0.2, e * 0.22, e * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  circle(ctx, cx - e * 0.12, cy - e * 0.08, e * 0.045, spot); circle(ctx, cx + e * 0.12, cy - e * 0.08, e * 0.045, spot);
};

Object.assign(LOGOS, {
  // —— McPapaya (reserva) ——
  'Papayón': mk('PAPAYÓN', { font: K, weight: 900, italic: true, spacing: 0, fill: inkOr('#141414') }, 0.62, 0.9, (ctx, x, e, H) => {
    ctx.fillStyle = '#ff8000'; ctx.beginPath(); ctx.ellipse(x + e / 2, H / 2, e * 0.32, e * 0.48, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb35c'; ctx.beginPath(); ctx.ellipse(x + e / 2, H / 2, e * 0.2, e * 0.36, 0.5, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) circle(ctx, x + e / 2 + Math.sin(0.5) * (i - 2) * e * 0.08, H / 2 - Math.cos(0.5) * (i - 2) * e * 0.08, e * 0.04, '#1a1a1a');
  }),
  Naranjito: mk('naranjito', { font: R, weight: 700, spacing: -0.02, fill: inkOr('#141414') }, 0.68, 0.9, (ctx, x, e, H) => {
    circle(ctx, x + e / 2, H * 0.56, e * 0.38, '#ff8a00'); circle(ctx, x + e * 0.38, H * 0.46, e * 0.08, '#ffc27a');
    leaf(ctx, x + e * 0.58, H * 0.2, e * 0.34, 0.9, '#3a9a2a');
  }),
  'Zumo Total': mk('ZUMO TOTAL', { font: C, weight: 800, italic: true, spacing: 0.02, fill: inkOr('#141414') }, 0.66, 0.7, (ctx, x, e, H) => {
    ctx.fillStyle = '#ff8000'; ctx.beginPath(); ctx.moveTo(x + e * 0.1, H * 0.3); ctx.lineTo(x + e * 0.9, H * 0.3); ctx.lineTo(x + e * 0.78, H * 0.92); ctx.lineTo(x + e * 0.22, H * 0.92); ctx.closePath(); ctx.fill();
    line(ctx, [[x + e * 0.6, H * 0.5], [x + e * 0.75, H * 0.06], [x + e * 1.0, H * 0.06]], '#e30613', e * 0.08);
  }),
  'Gajo Uno': mk('GAJO 1', { font: K, weight: 900, spacing: 0, fill: inkOr('#141414') }, 0.66, 1.0, (ctx, x, e, H) => {
    ctx.fillStyle = '#ff8000'; ctx.beginPath(); ctx.arc(x + e / 2, H * 0.3, e * 0.5, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc27a'; ctx.beginPath(); ctx.arc(x + e / 2, H * 0.3, e * 0.4, 0.15, Math.PI - 0.15); ctx.closePath(); ctx.fill();
    for (let i = 1; i < 4; i++) { const a = i * Math.PI / 4; line(ctx, [[x + e / 2, H * 0.32], [x + e / 2 + Math.cos(a) * e * 0.38, H * 0.3 + Math.sin(a) * e * 0.38]], '#ff8000', e * 0.04); }
  }),
  'Mandarina X': (ctx, W, H, dark) => {
    const e = H * 0.9;
    lockup(ctx, W, H, e, x => { circle(ctx, x + e / 2, H * 0.55, e * 0.4, '#ff6a00'); leaf(ctx, x + e * 0.62, H * 0.2, e * 0.28, 0.8, '#2f8f2f'); line(ctx, [[x + e * 0.3, H * 0.36], [x + e * 0.7, H * 0.74]], '#ffffff', e * 0.1); line(ctx, [[x + e * 0.7, H * 0.36], [x + e * 0.3, H * 0.74]], '#ffffff', e * 0.1); },
      'MANDARINA', { font: K, weight: 900, spacing: -0.02, fill: ink(dark) }, 0.6);
  },
  'Pulpa Pro': mk('PULPA PRO', { font: C, weight: 800, spacing: 0.04, fill: inkOr('#e85d00') }, 0.68, 0.7, (ctx, x, e, H) => {
    drop(ctx, x + e / 2, H * 0.06, H * 0.92, e * 0.5, '#ff8000');
    for (let i = 0; i < 3; i++) circle(ctx, x + e * (0.38 + i * 0.12), H * (0.62 + (i % 2) * 0.1), e * 0.05, '#ffd29a');
  }),

  // —— Red Bulla (reserva) ——
  Alitas: mk('ALITAS', { font: K, weight: 900, italic: true, spacing: 0.02, fill: inkOr('#141414') }, 0.62, 1.2, (ctx, x, e, H) => {
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(x + e / 2, H * 0.6); ctx.scale(s, 1); ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(e * 0.2, -H * 0.45, e * 0.5, -H * 0.42); ctx.quadraticCurveTo(e * 0.42, -H * 0.2, e * 0.46, -H * 0.12); ctx.quadraticCurveTo(e * 0.32, -H * 0.1, e * 0.36, 0); ctx.quadraticCurveTo(e * 0.2, 0, 0, H * 0.12); ctx.fill(); ctx.restore(); }
  }),
  Bueyfuel: (ctx, W, H) => {
    plated(ctx, W, H, '#1e2a5a', 'BUEYFUEL', { font: K, weight: 900, italic: true, spacing: 0, fill: '#ffcc00' }, 'inclinada', (x, ph) => { horns(ctx, x + ph * 0.45, H / 2, ph * 0.8, '#e30613'); return 0; });
  },
  Cuernos: mk('CUERNOS', { font: K, weight: 900, spacing: 0.02, fill: inkOr('#141414') }, 0.62, 0.9, (ctx, x, e, H, dark) => { horns(ctx, x + e / 2, H * 0.55, e, '#e30613'); circle(ctx, x + e / 2, H * 0.72, e * 0.14, dark ? '#ffffff' : '#141414'); }),
  Taurina: mk('Taurina', { font: R, weight: 700, italic: true, spacing: -0.02, fill: inkOr('#1e2a5a') }, 0.66, 0.6, (ctx, x, e, H) => {
    ctx.fillStyle = '#c0c6cf'; roundRect(ctx, x + e * 0.1, H * 0.1, e * 0.8, H * 0.8, e * 0.16); ctx.fill();
    ctx.fillStyle = '#1e2a5a'; ctx.fillRect(x + e * 0.1, H * 0.36, e * 0.8, H * 0.3); circle(ctx, x + e / 2, H * 0.51, e * 0.12, '#ffcc00');
  }),
  Embestida: mk('EMBESTIDA', { font: K, weight: 900, italic: true, spacing: -0.02, fill: inkOr('#141414') }, 0.6, 1.1, (ctx, x, e, H) => {
    for (let i = 0; i < 3; i++) line(ctx, [[x, H * (0.3 + i * 0.2)], [x + e * (0.45 - i * 0.08), H * (0.3 + i * 0.2)]], '#e30613', H * 0.07);
    horns(ctx, x + e * 0.72, H * 0.55, e * 0.6, '#ffcc00');
  }),
  'Becerro Tech': mk('BECERRO TECH', { font: R, weight: 700, spacing: 0.08, fill: inkOr('#1e2a5a') }, 0.48, 0.9, (ctx, x, e, H) => {
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = e * 0.07; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(x + e / 2 + Math.cos(a) * e * 0.46, H / 2 + Math.sin(a) * e * 0.46); } ctx.stroke();
    horns(ctx, x + e / 2, H * 0.55, e * 0.6, '#e30613');
  }),

  // —— Errari (reserva) ——
  Cavallino: mk('Cavallino', { font: C, weight: 800, italic: true, spacing: 0.02, fill: inkOr('#141414') }, 0.7, 0.8, (ctx, x, e, H) => {
    ctx.fillStyle = '#ffd400'; roundRect(ctx, x, H * 0.08, e, H * 0.84, e * 0.12); ctx.fill();
    ctx.strokeStyle = '#141414'; ctx.lineWidth = e * 0.16; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(x + e / 2, H * 0.46, e * 0.26, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    for (let i = 0; i < 5; i++) { const an = Math.PI * (0.85 + i * 0.33); circle(ctx, x + e / 2 + Math.cos(an) * e * 0.26, H * 0.46 + Math.sin(an) * e * 0.26, e * 0.03, '#ffd400'); }
  }),
  'Rosso Pasta': mk('ROSSO PASTA', { font: C, weight: 800, spacing: 0.04, fill: inkOr('#c8102e') }, 0.62, 0.9, (ctx, x, e, H) => {
    ctx.strokeStyle = '#f4c542'; ctx.lineWidth = e * 0.07; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + e / 2, H / 2, e * (0.14 + i * 0.12), i, i + Math.PI * 1.6); ctx.stroke(); }
    circle(ctx, x + e * 0.78, H * 0.3, e * 0.1, '#c8102e');
  }),
  Maranelo: mk('MARANELO', { font: R, weight: 700, spacing: 0.18, fill: inkOr('#141414') }, 0.5, 0.9, (ctx, x, e, H) => {
    ctx.fillStyle = '#009246'; ctx.fillRect(x, H * 0.2, e / 3, H * 0.6); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + e / 3, H * 0.2, e / 3, H * 0.6); ctx.fillStyle = '#ce2b37'; ctx.fillRect(x + e * 2 / 3, H * 0.2, e / 3, H * 0.6);
    ctx.strokeStyle = '#141414'; ctx.lineWidth = e * 0.03; ctx.strokeRect(x, H * 0.2, e, H * 0.6);
  }),
  Tifosol: mk('TIFOSOL', { font: K, weight: 900, spacing: 0, fill: inkOr('#c8102e') }, 0.62, 0.9, (ctx, x, e, H) => {
    circle(ctx, x + e / 2, H / 2, e * 0.26, '#ffd400');
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(x + e / 2 + Math.cos(a - 0.2) * e * 0.3, H / 2 + Math.sin(a - 0.2) * e * 0.3); ctx.lineTo(x + e / 2 + Math.cos(a) * e * 0.5, H / 2 + Math.sin(a) * e * 0.5); ctx.lineTo(x + e / 2 + Math.cos(a + 0.2) * e * 0.3, H / 2 + Math.sin(a + 0.2) * e * 0.3); ctx.fill(); }
    circle(ctx, x + e / 2, H / 2, e * 0.12, '#c8102e');
  }),
  'Estrategia B': mk('ESTRATEGIA', { font: C, weight: 800, spacing: 0.04, fill: inkOr('#141414') }, 0.64, 0.85, (ctx, x, e, H) => {
    ctx.fillStyle = '#c8102e'; roundRect(ctx, x, H * 0.08, e, H * 0.84, e * 0.12); ctx.fill();
    ctx.font = `900 ${e * 0.7}px ${K}`; ctx.letterSpacing = '0px'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', x + e / 2, H / 2 + e * 0.04); ctx.textAlign = 'left';
  }),
  'Plan Z': mk('PLAN Z', { font: K, weight: 900, italic: true, spacing: 0.02, fill: inkOr('#141414') }, 0.64, 0.9, (ctx, x, e, H) => {
    line(ctx, [[x + e * 0.1, H * 0.22], [x + e * 0.9, H * 0.22], [x + e * 0.1, H * 0.78], [x + e * 0.9, H * 0.78]], '#c8102e', e * 0.14);
  }),

  // —— Totocedes (reserva) ——
  Plateado: mk('PLATEADO', { font: R, weight: 700, spacing: 0.16, fill: (d: boolean) => (d ? '#dfe5ea' : '#5b6670') }, 0.5, 0.9, (ctx, x, e, H) => {
    const g = ctx.createLinearGradient(x, 0, x + e, H); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9aa4ae'); g.addColorStop(1, '#e8edf1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + e / 2, H * 0.08); ctx.lineTo(x + e, H / 2); ctx.lineTo(x + e / 2, H * 0.92); ctx.lineTo(x, H / 2); ctx.closePath(); ctx.fill();
  }),
  Flechita: mk('flechita', { font: R, weight: 700, italic: true, spacing: -0.02, fill: inkOr('#141414') }, 0.66, 1.1, (ctx, x, e, H) => {
    ctx.fillStyle = '#00d2be'; ctx.beginPath(); ctx.moveTo(x, H * 0.4); ctx.lineTo(x + e * 0.6, H * 0.4); ctx.lineTo(x + e * 0.6, H * 0.2); ctx.lineTo(x + e, H / 2); ctx.lineTo(x + e * 0.6, H * 0.8); ctx.lineTo(x + e * 0.6, H * 0.6); ctx.lineTo(x, H * 0.6); ctx.closePath(); ctx.fill();
  }),
  'Turquesa Pro': (ctx, W, H) => { plated(ctx, W, H, '#00a19b', 'TURQUESA PRO', { font: C, weight: 800, spacing: 0.06, fill: '#ffffff' }, 'redonda'); },
  'Toto Tech': mk('TOTO TECH', { font: K, weight: 900, spacing: 0.02, fill: inkOr('#141414') }, 0.6, 0.9, (ctx, x, e, H) => {
    ctx.strokeStyle = '#00d2be'; ctx.lineWidth = e * 0.1; ctx.beginPath(); ctx.arc(x + e * 0.3, H / 2, e * 0.26, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x + e * 0.7, H / 2, e * 0.26, 0, Math.PI * 2); ctx.stroke();
  }),
  Eslalon: mk('ESLALON', { font: C, weight: 800, italic: true, spacing: 0.06, fill: inkOr('#141414') }, 0.66, 1.0, (ctx, x, e, H) => {
    ctx.strokeStyle = '#00a19b'; ctx.lineWidth = e * 0.1; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 30; i++) { const u = i / 30; ctx.lineTo(x + Math.sin(u * Math.PI * 2) * e * 0.3 + e / 2, H * (0.1 + u * 0.8)); } ctx.stroke();
    for (const [u, c] of [[0.25, '#e30613'], [0.75, '#1e5bc6']] as const) circle(ctx, x + e / 2 + Math.sin(u * Math.PI * 2) * e * 0.48, H * (0.1 + u * 0.8), e * 0.08, c);
  }),
  Silbato: mk('SILBATO', { font: K, weight: 900, spacing: 0.02, fill: inkOr('#141414') }, 0.6, 1.1, (ctx, x, e, H) => {
    ctx.fillStyle = '#c0c6cf'; ctx.beginPath(); ctx.arc(x + e * 0.36, H * 0.6, e * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + e * 0.36, H * 0.32, e * 0.6, H * 0.2);
    circle(ctx, x + e * 0.36, H * 0.6, e * 0.1, '#00a19b'); line(ctx, [[x + e * 0.8, H * 0.2], [x + e * 0.9, H * 0.08]], '#00a19b', e * 0.05);
  }),

  // —— Aston Papá (reserva) ——
  Verdolaga: mk('verdolaga', { font: R, weight: 700, spacing: -0.02, fill: inkOr('#0a5c3c') }, 0.66, 0.9, (ctx, x, e, H) => {
    for (let i = 0; i < 5; i++) leaf(ctx, x + e / 2, H * 0.88, e * 0.6, (i - 2) * 0.45, i % 2 ? '#3a9a2a' : '#5cc24a');
  }),
  'Limón Racing': mk('LIMÓN RACING', { font: C, weight: 800, italic: true, spacing: 0.02, fill: inkOr('#141414') }, 0.62, 1.0, (ctx, x, e, H) => {
    ctx.fillStyle = '#e8f000'; ctx.beginPath(); ctx.ellipse(x + e / 2, H / 2, e * 0.46, e * 0.32, -0.2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) line(ctx, [[x + e * (0.1 - i * 0.05), H * (0.4 + i * 0.12)], [x + e * (0.22 - i * 0.05), H * (0.4 + i * 0.12)]], '#0a5c3c', H * 0.04);
    leaf(ctx, x + e * 0.8, H * 0.24, e * 0.26, 1.2, '#0a5c3c');
  }),
  'Bandera Verde': mk('BANDERA VERDE', { font: C, weight: 800, spacing: 0.04, fill: inkOr('#141414') }, 0.62, 0.9, (ctx, x, e, H, dark) => {
    line(ctx, [[x + e * 0.12, H * 0.06], [x + e * 0.12, H * 0.94]], dark ? '#ffffff' : '#141414', e * 0.07);
    ctx.fillStyle = '#00a651'; ctx.beginPath(); ctx.moveTo(x + e * 0.15, H * 0.1); ctx.quadraticCurveTo(x + e * 0.5, H * 0.02, x + e * 0.95, H * 0.14); ctx.lineTo(x + e * 0.95, H * 0.56); ctx.quadraticCurveTo(x + e * 0.5, H * 0.46, x + e * 0.15, H * 0.54); ctx.closePath(); ctx.fill();
  }),
  'Espárrago': mk('ESPÁRRAGO', { font: K, weight: 900, italic: true, spacing: -0.02, fill: inkOr('#0a5c3c') }, 0.6, 0.6, (ctx, x, e, H) => {
    ctx.fillStyle = '#7cbf3c'; roundRect(ctx, x + e * 0.3, H * 0.2, e * 0.4, H * 0.75, e * 0.18); ctx.fill();
    ctx.fillStyle = '#4e8a24'; ctx.beginPath(); ctx.moveTo(x + e * 0.5, H * 0.04); ctx.lineTo(x + e * 0.78, H * 0.34); ctx.lineTo(x + e * 0.22, H * 0.34); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 3; i++) leaf(ctx, x + e * 0.5, H * (0.5 + i * 0.14), e * 0.22, (i % 2 ? 1 : -1) * 0.9, '#4e8a24');
  }),
  'Menta Fuel': (ctx, W, H) => {
    plated(ctx, W, H, '#00b388', 'MENTA FUEL', { font: K, weight: 900, italic: true, spacing: 0, fill: '#ffffff' }, 'inclinada', (x, ph) => { leaf(ctx, x + ph * 0.36, H / 2 + ph * 0.36, ph * 0.6, 0.4, '#d8ffe9'); leaf(ctx, x + ph * 0.36, H / 2 + ph * 0.36, ph * 0.5, -0.5, '#a6f2cf'); return 0; });
  },
  'Papá Invierte': mk('PAPÁ INVIERTE', { font: C, weight: 800, spacing: 0.02, fill: inkOr('#0a5c3c') }, 0.62, 0.9, (ctx, x, e, H) => {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 2 ? '#cedc00' : '#0a5c3c'; ctx.fillRect(x + e * (0.05 + i * 0.32), H * (0.62 - i * 0.18), e * 0.24, H * (0.26 + i * 0.18)); }
    line(ctx, [[x, H * 0.5], [x + e * 0.4, H * 0.3], [x + e * 0.95, H * 0.08]], '#cedc00', e * 0.06);
  }),

  // —— Vowlliams (reserva) ——
  'Azulón': mk('AZULÓN', { font: K, weight: 900, spacing: 0.02, fill: inkOr('#0047bb') }, 0.62, 0.9, (ctx, x, e, H) => {
    ctx.fillStyle = '#0047bb'; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; ctx.lineTo(x + e / 2 + Math.cos(a) * e * 0.48, H / 2 + Math.sin(a) * e * 0.48); } ctx.fill();
    circle(ctx, x + e / 2, H / 2, e * 0.18, '#62b5e5');
  }),
  'Grove Fresh': mk('Grove Fresh', { font: R, weight: 700, italic: true, spacing: -0.02, fill: inkOr('#0a5c3c') }, 0.64, 0.9, (ctx, x, e, H) => {
    circle(ctx, x + e / 2, H * 0.4, e * 0.34, '#3a9a2a'); circle(ctx, x + e * 0.3, H * 0.48, e * 0.22, '#5cc24a');
    ctx.fillStyle = '#7a4a1f'; ctx.fillRect(x + e * 0.44, H * 0.6, e * 0.12, H * 0.32);
  }),
  Cobalto: mk('COBALTO', { font: R, weight: 700, spacing: 0.2, fill: inkOr('#0047ab') }, 0.5, 0.9, (ctx, x, e, H) => {
    ctx.fillStyle = '#0047ab'; ctx.fillRect(x + e * 0.08, H * 0.08, e * 0.84, H * 0.84);
    ctx.font = `800 ${e * 0.36}px ${R}`; ctx.letterSpacing = '0px'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Co', x + e / 2, H * 0.56); ctx.font = `600 ${e * 0.14}px ${R}`; ctx.fillText('27', x + e * 0.24, H * 0.22); ctx.textAlign = 'left';
  }),
  'Marino Uno': mk('MARINO 1', { font: K, weight: 900, italic: true, spacing: 0, fill: inkOr('#0a2a5c') }, 0.62, 0.9, (ctx, x, e, H, dark) => {
    ctx.strokeStyle = dark ? '#62b5e5' : '#0a2a5c'; ctx.lineWidth = e * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x + e / 2, H * 0.28, e * 0.1, 0, Math.PI * 2); ctx.moveTo(x + e / 2, H * 0.38); ctx.lineTo(x + e / 2, H * 0.88); ctx.moveTo(x + e * 0.3, H * 0.48); ctx.lineTo(x + e * 0.7, H * 0.48); ctx.moveTo(x + e * 0.12, H * 0.62); ctx.quadraticCurveTo(x + e * 0.2, H * 0.88, x + e / 2, H * 0.88); ctx.quadraticCurveTo(x + e * 0.8, H * 0.88, x + e * 0.88, H * 0.62); ctx.stroke();
  }),
  Nostalgia: mk('Nostalgia', { font: C, weight: 800, italic: true, spacing: 0.02, fill: inkOr('#7a1f2b') }, 0.7, 0.9, (ctx, x, e, H) => {
    circle(ctx, x + e / 2, H / 2, e * 0.46, '#e8d9a8'); ctx.strokeStyle = '#7a1f2b'; ctx.lineWidth = e * 0.05; ctx.beginPath(); ctx.arc(x + e / 2, H / 2, e * 0.38, 0, Math.PI * 2); ctx.stroke();
    star(ctx, x + e / 2, H / 2, e * 0.24, e * 0.1); ctx.fillStyle = '#7a1f2b'; ctx.fill();
  }),
  'Garaje Viejo': mk('GARAJE VIEJO', { font: C, weight: 800, spacing: 0.04, fill: inkOr('#141414') }, 0.62, 0.9, (ctx, x, e, H, dark) => {
    const c = dark ? '#ffffff' : '#141414'; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, H * 0.4); ctx.lineTo(x + e / 2, H * 0.08); ctx.lineTo(x + e, H * 0.4); ctx.lineTo(x + e, H * 0.92); ctx.lineTo(x, H * 0.92); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6a800'; for (let i = 0; i < 3; i++) ctx.fillRect(x + e * 0.18, H * (0.48 + i * 0.14), e * 0.64, H * 0.09);
  }),

  // —— Racing Bueyes (reserva) ——
  'Toro Junior': mk('TORO JR.', { font: K, weight: 900, italic: true, spacing: 0, fill: inkOr('#1e41ff') }, 0.62, 0.9, (ctx, x, e, H, dark) => { horns(ctx, x + e / 2, H * 0.55, e * 0.9, '#e30613'); circle(ctx, x + e / 2, H * 0.68, e * 0.2, ink(dark)); }),
  'Ternero': mk('ternero', { font: R, weight: 700, spacing: -0.02, fill: inkOr('#141414') }, 0.66, 1.0, (ctx, x, e, H) => cow(ctx, x + e / 2, H / 2, e, '#ffffff', '#141414')),
  'Faenza Té': mk('FAENZA TÉ', { font: C, weight: 800, spacing: 0.04, fill: inkOr('#1e41ff') }, 0.64, 1.0, (ctx, x, e, H) => {
    ctx.fillStyle = '#1e41ff'; ctx.beginPath(); ctx.moveTo(x + e * 0.1, H * 0.3); ctx.lineTo(x + e * 0.72, H * 0.3); ctx.quadraticCurveTo(x + e * 0.72, H * 0.88, x + e * 0.41, H * 0.88); ctx.quadraticCurveTo(x + e * 0.1, H * 0.88, x + e * 0.1, H * 0.3); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e * 0.04; ctx.stroke();
    ctx.strokeStyle = '#1e41ff'; ctx.lineWidth = e * 0.06; ctx.beginPath(); ctx.arc(x + e * 0.76, H * 0.5, e * 0.12, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    line(ctx, [[x + e * 0.36, H * 0.22], [x + e * 0.3, H * 0.1]], '#e30613', e * 0.05); line(ctx, [[x + e * 0.5, H * 0.22], [x + e * 0.56, H * 0.08]], '#e30613', e * 0.05);
  }),
  'Rebaño': mk('REBAÑO', { font: K, weight: 900, spacing: 0.02, fill: inkOr('#141414') }, 0.62, 1.2, (ctx, x, e, H, dark) => { for (let i = 0; i < 3; i++) cow(ctx, x + e * (0.2 + i * 0.3), H * (0.55 - (i === 1 ? 0.06 : 0)), e * 0.5, i === 1 ? '#ffffff' : '#c8c8c8', '#141414'); void dark; }),
  'Pasto Azul': mk('pasto azul', { font: R, weight: 700, spacing: -0.02, fill: inkOr('#1e41ff') }, 0.64, 1.0, (ctx, x, e, H) => {
    for (let i = 0; i < 7; i++) { const bx = x + e * (0.08 + i * 0.14); ctx.fillStyle = i % 2 ? '#1e41ff' : '#62b5e5'; ctx.beginPath(); ctx.moveTo(bx - e * 0.06, H * 0.9); ctx.quadraticCurveTo(bx, H * 0.4, bx + e * (i % 2 ? 0.06 : -0.04), H * (0.1 + (i % 3) * 0.1)); ctx.quadraticCurveTo(bx + e * 0.02, H * 0.5, bx + e * 0.06, H * 0.9); ctx.fill(); }
  }),
  Mugido: mk('MUGIDO', { font: K, weight: 900, italic: true, spacing: 0, fill: inkOr('#141414') }, 0.62, 1.1, (ctx, x, e, H) => {
    cow(ctx, x + e * 0.32, H * 0.55, e * 0.62, '#ffffff', '#141414');
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#e30613'; ctx.lineWidth = e * 0.05; ctx.beginPath(); ctx.arc(x + e * 0.55, H * 0.6, e * (0.16 + i * 0.13), -0.6, 0.6); ctx.stroke(); }
  }),

  // —— Haasta Luego (reserva) ——
  'Hastío': mk('hastío', { font: R, weight: 700, spacing: -0.02, fill: inkOr('#141414') }, 0.68, 0.9, (ctx, x, e, H, dark) => {
    circle(ctx, x + e / 2, H / 2, e * 0.46, '#ffd400'); const c = '#141414';
    line(ctx, [[x + e * 0.28, H * 0.42], [x + e * 0.42, H * 0.42]], c, e * 0.06); line(ctx, [[x + e * 0.58, H * 0.42], [x + e * 0.72, H * 0.42]], c, e * 0.06); line(ctx, [[x + e * 0.32, H * 0.66], [x + e * 0.68, H * 0.66]], c, e * 0.06); void dark;
  }),
  'Gunther Dice': (ctx, W, H) => {
    plated(ctx, W, H, '#e30613', 'GUNTHER DICE', { font: K, weight: 900, italic: true, spacing: 0, fill: '#ffffff' }, 'recta', (x, ph) => {
      ctx.fillStyle = '#ffffff'; const y = H / 2 - ph * 0.3; ctx.beginPath(); ctx.roundRect(x + ph * 0.06, y, ph * 0.7, ph * 0.48, ph * 0.12); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + ph * 0.2, y + ph * 0.44); ctx.lineTo(x + ph * 0.12, y + ph * 0.68); ctx.lineTo(x + ph * 0.38, y + ph * 0.46); ctx.fill();
      ctx.fillStyle = '#e30613'; for (let i = 0; i < 3; i++) circle(ctx, x + ph * (0.24 + i * 0.17), y + ph * 0.24, ph * 0.05, '#e30613'); return 0;
    });
  },
  Presupuesto: mk('PRESUPUESTO', { font: C, weight: 800, spacing: 0.04, fill: inkOr('#141414') }, 0.62, 0.9, (ctx, x, e, H) => {
    ctx.fillStyle = '#e30613'; roundRect(ctx, x + e * 0.12, H * 0.06, e * 0.76, H * 0.88, e * 0.08); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + e * 0.22, H * 0.16, e * 0.56, H * 0.2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(x + e * (0.22 + c * 0.2), H * (0.44 + r * 0.16), e * 0.15, H * 0.11);
  }),
  Sobresueldo: mk('SOBRESUELDO', { font: C, weight: 800, italic: true, spacing: 0.02, fill: inkOr('#141414') }, 0.62, 1.0, (ctx, x, e, H) => {
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(x + e * 0.05, H * 0.24, e * 0.9, H * 0.6); ctx.strokeStyle = '#8a6d1f'; ctx.lineWidth = e * 0.04; ctx.strokeRect(x + e * 0.05, H * 0.24, e * 0.9, H * 0.6);
    line(ctx, [[x + e * 0.05, H * 0.24], [x + e / 2, H * 0.56], [x + e * 0.95, H * 0.24]], '#8a6d1f', e * 0.04);
    circle(ctx, x + e / 2, H * 0.56, e * 0.1, '#e30613');
  }),
  'Taller Kanna': mk('TALLER KANNA', { font: K, weight: 900, spacing: 0, fill: inkOr('#141414') }, 0.56, 0.9, (ctx, x, e, H) => {
    ctx.save(); ctx.translate(x + e / 2, H / 2); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#9aa4ae'; ctx.fillRect(-e * 0.08, -e * 0.2, e * 0.16, e * 0.62);
    ctx.beginPath(); ctx.arc(0, -e * 0.3, e * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e30613'; ctx.fillRect(-e * 0.07, -e * 0.52, e * 0.14, e * 0.22); ctx.restore();
  }),
  'Luego Más': mk('LUEGO MÁS', { font: C, weight: 800, italic: true, spacing: 0.04, fill: inkOr('#141414') }, 0.66, 0.9, (ctx, x, e, H) => {
    ctx.fillStyle = '#e30613'; for (let i = 0; i < 3; i++) { ctx.beginPath(); const bx = x + e * (0.02 + i * 0.3); ctx.moveTo(bx, H * 0.25); ctx.lineTo(bx + e * 0.3, H / 2); ctx.lineTo(bx, H * 0.75); ctx.lineTo(bx + e * 0.12, H / 2); ctx.closePath(); ctx.fill(); }
  }),

  // —— Alpino Grigio (reserva) ——
  'Montañero': mk('MONTAÑERO', { font: K, weight: 900, spacing: 0, fill: inkOr('#0a2a5c') }, 0.6, 1.0, (ctx, x, e, H) => mountain(ctx, x, e, H, '#0a2a5c', '#ffffff')),
  'Rosa Chicle': (ctx, W, H) => {
    plated(ctx, W, H, '#ff87bc', 'ROSA CHICLE', { font: R, weight: 700, spacing: 0.02, fill: '#ffffff', stroke: '#c2185b', strokeW: H * 0.03 }, 'redonda', (x, ph) => { circle(ctx, x + ph * 0.45, H / 2, ph * 0.32, '#ffd1e6'); circle(ctx, x + ph * 0.36, H / 2 - ph * 0.08, ph * 0.08, '#ffffff'); return 0; });
  },
  'Esquí Azul': mk('ESQUÍ AZUL', { font: C, weight: 800, italic: true, spacing: 0.04, fill: inkOr('#0078c1') }, 0.66, 1.0, (ctx, x, e, H) => {
    for (const d of [0, 0.18]) line(ctx, [[x + e * (0.05 + d), H * 0.86], [x + e * (0.9 + d * 0.5), H * 0.14]], '#0078c1', e * 0.08);
    line(ctx, [[x + e * 0.05, H * 0.86], [x, H * 0.76]], '#0078c1', e * 0.08);
    circle(ctx, x + e * 0.3, H * 0.28, e * 0.1, '#ff87bc');
  }),
  Cumbre: mk('CUMBRE', { font: R, weight: 700, spacing: 0.2, fill: inkOr('#0a2a5c') }, 0.52, 1.0, (ctx, x, e, H) => {
    mountain(ctx, x, e, H, '#0078c1', '#ffffff'); line(ctx, [[x + e * 0.38, H * 0.14], [x + e * 0.38, H * 0.0]], '#ff87bc', e * 0.04);
    ctx.fillStyle = '#ff87bc'; ctx.beginPath(); ctx.moveTo(x + e * 0.38, H * 0.0); ctx.lineTo(x + e * 0.56, H * 0.04); ctx.lineTo(x + e * 0.38, H * 0.09); ctx.fill();
  }),
  Fondue: mk('fondue', { font: R, weight: 700, italic: true, spacing: -0.02, fill: inkOr('#141414') }, 0.68, 1.0, (ctx, x, e, H) => {
    ctx.fillStyle = '#e30613'; ctx.beginPath(); ctx.moveTo(x + e * 0.1, H * 0.46); ctx.lineTo(x + e * 0.9, H * 0.46); ctx.quadraticCurveTo(x + e * 0.9, H * 0.9, x + e / 2, H * 0.9); ctx.quadraticCurveTo(x + e * 0.1, H * 0.9, x + e * 0.1, H * 0.46); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(x + e / 2, H * 0.46, e * 0.4, H * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    line(ctx, [[x + e * 0.4, H * 0.46], [x + e * 0.2, H * 0.06]], '#9aa4ae', e * 0.04); circle(ctx, x + e * 0.2, H * 0.08, e * 0.07, '#f2c26b');
  }),
  Glaciar: mk('GLACIAR', { font: R, weight: 700, spacing: 0.18, fill: inkOr('#0078c1') }, 0.52, 0.9, (ctx, x, e, H) => {
    ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(x, H * 0.9); ctx.lineTo(x + e * 0.2, H * 0.3); ctx.lineTo(x + e * 0.45, H * 0.1); ctx.lineTo(x + e * 0.7, H * 0.36); ctx.lineTo(x + e, H * 0.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#62b5e5'; ctx.beginPath(); ctx.moveTo(x + e * 0.45, H * 0.1); ctx.lineTo(x + e * 0.55, H * 0.9); ctx.lineTo(x + e, H * 0.9); ctx.lineTo(x + e * 0.7, H * 0.36); ctx.closePath(); ctx.fill();
  }),

  // —— Steak Sauber (reserva) ——
  Bisteque: mk('BISTEQUE', { font: K, weight: 900, italic: true, spacing: 0, fill: inkOr('#141414') }, 0.62, 1.0, (ctx, x, e, H) => {
    ctx.fillStyle = '#b5332e'; ctx.beginPath(); ctx.ellipse(x + e / 2, H / 2, e * 0.48, e * 0.34, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe0d6'; ctx.lineWidth = e * 0.05; ctx.beginPath(); ctx.ellipse(x + e / 2, H / 2, e * 0.36, e * 0.22, -0.3, 0.5, 4); ctx.stroke();
    for (let i = 0; i < 3; i++) line(ctx, [[x + e * (0.2 + i * 0.22), H * 0.7], [x + e * (0.38 + i * 0.22), H * 0.3]], '#3a1510', e * 0.04);
  }),
  'Hinwil Hot': mk('HINWIL HOT', { font: C, weight: 800, italic: true, spacing: 0.04, fill: inkOr('#141414') }, 0.66, 0.8, (ctx, x, e, H) => {
    const fl = (s: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + e / 2, H * (0.94 - 0.86 * s)); ctx.bezierCurveTo(x + e * (0.5 + 0.6 * s), H * 0.45, x + e * (0.5 + 0.45 * s), H * 0.94, x + e / 2, H * 0.94); ctx.bezierCurveTo(x + e * (0.5 - 0.45 * s), H * 0.94, x + e * (0.5 - 0.6 * s), H * 0.5, x + e / 2, H * (0.94 - 0.86 * s)); ctx.fill(); };
    fl(1, '#e30613'); fl(0.6, '#ff8000'); fl(0.3, '#ffd400');
  }),
  'Chuletón': mk('CHULETÓN', { font: K, weight: 900, spacing: 0.02, fill: inkOr('#52a822') }, 0.6, 1.1, (ctx, x, e, H) => {
    ctx.fillStyle = '#b5332e'; ctx.beginPath(); ctx.ellipse(x + e * 0.58, H / 2, e * 0.4, e * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    line(ctx, [[x + e * 0.28, H / 2], [x + e * 0.04, H / 2]], '#f2e6c8', e * 0.1); circle(ctx, x + e * 0.04, H * 0.42, e * 0.06, '#f2e6c8'); circle(ctx, x + e * 0.04, H * 0.58, e * 0.06, '#f2e6c8');
  }),
  'Verde Lima': (ctx, W, H) => { plated(ctx, W, H, '#52e252', 'VERDE LIMA', { font: K, weight: 900, italic: true, spacing: 0, fill: '#0b2a10' }, 'inclinada', (x, ph) => { fruit(ctx, x + ph * 0.45, H / 2, ph * 0.32, '#2f8f2f', '#c8f56a', 6); return 0; }); },
  'Suizo Seguro': mk('SUIZO SEGURO', { font: R, weight: 700, spacing: 0.06, fill: inkOr('#141414') }, 0.5, 0.86, (ctx, x, e, H) => {
    ctx.fillStyle = '#e30613'; ctx.beginPath(); ctx.moveTo(x, H * 0.08); ctx.lineTo(x + e, H * 0.08); ctx.lineTo(x + e, H * 0.5); ctx.quadraticCurveTo(x + e, H * 0.9, x + e / 2, H * 0.94); ctx.quadraticCurveTo(x, H * 0.9, x, H * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + e * 0.4, H * 0.22, e * 0.2, H * 0.52); ctx.fillRect(x + e * 0.22, H * 0.38, e * 0.56, H * 0.18);
  }),
  Relojito: mk('relojito', { font: R, weight: 700, italic: true, spacing: -0.02, fill: inkOr('#141414') }, 0.66, 0.9, (ctx, x, e, H, dark) => {
    circle(ctx, x + e / 2, H / 2, e * 0.46, '#52e252'); circle(ctx, x + e / 2, H / 2, e * 0.36, dark ? '#141414' : '#ffffff');
    line(ctx, [[x + e / 2, H * 0.28], [x + e / 2, H / 2], [x + e * 0.68, H * 0.58]], dark ? '#ffffff' : '#141414', e * 0.06);
  }),
} satisfies Record<string, LogoDraw>);


// [TL4, 19/11/2026] Emblemas propios de los equipos (de parodia, ninguno copia el real), en el costado del pontón.
export const EMBLEMS: Record<string, LogoDraw> = {
  // Toro amarillo embistiendo delante de un sol rojo. Silueta de «Bull-155411.svg» (Wikimedia Commons, CC0, dominio
  // público); no copia el emblema real (dos toros rojos sobre un sol amarillo).
  toro: (ctx, W, H) => {
    const bx = 35, by = 234, bw = 690, bh = 548;
    const s = Math.min(W / bw, H / bh) * 0.9, ox = (W - bw * s) / 2, oy = (H - bh * s) / 2;
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s); ctx.translate(-bx, -by);
    ctx.fillStyle = '#e30613'; ctx.beginPath(); ctx.arc(470, 500, 230, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc906'; ctx.fill(new Path2D(BULL));
    ctx.restore();
  },
};

/** Silueta del toro (Bull-155411.svg, Wikimedia Commons, CC0). */
const BULL = 'm36.1624,731.753c-6.9775-16.5937 21.7169-28.7174 32.8571-42.8571 7.9623-10.1061 17.2589-19.2224 24.2857-30 10.2358-15.6996 16.7772-33.5265 25.7143-50 9.5559-27.3902 11.9672-49.3606 34.2857-60-14.1025-29.2538 2.566-61.0557 5.7143-91.4286-7.0256-31.6946-6.025-60.2585 12.8572-88.5714-4.457-13.4215-35.412-16.9344-30-30 3.6446-8.7988 22.6498,7.4591 28.5714,0-49.2364-29.3826-57.8598-92.1737-24.2857-104.2857-16.8153,56.3196 12.9463,60.8333 37.1429,74.2857 8.2849-1.7373 17.0329-22.9027 77.1428-7.1429 18.083,1.6474 25.2268-13.846 58.5714,10 22.8283-13.8571 58.4563,14.6469 52.8571-74.2857 53.4778,89.8433-31.4908,64.635-20,95.7143 2.2217,6.0089 15.1894,6.5147 14.2857,12.8572-2.163,15.1812-35.86,5.7123-41.4286,20-11.7206,30.0724-2.9029,66.1325 35.7143,90 35.8971,8.326 49.3258,32.976 80,55.7143 42.6006-.6588 85.3826,23.525 108.5714,32.8571 146.0699-84.8465-56.5656-37.3761-48.5714-94.2857 4.1547-26.6151 41.0264-35.5585 57.1429-57.1429 11.3461-15.1955-25.1355-44.0457 27.1429-50-13.1512,26.7972 24.149,22.5866 14.2437,70.1015-48.8833,24.5331-83.4329,18.0782-71.8049,48.8165 42.6525,7.8687 158.0737,8.9842 42.3372,94.0109 12.5175,17.9569 38.863,19.1402 53.7955,54.2139 12.183,14.7807 22.5251,31.0139 32.8571,47.1429 12.6904,7.2452 29.9876,12.3599 38.5714,65.7143 9.2186,16.0938 35.6296,32.08 27.1429,48.5714-3.9463,7.6683-15.4812,3.5597-25.7143,2.8571-9.5614-6.2965-4.4398-22.8497-10-32.8571-21.5176-7.2137-17.4763-25.6968-30-34.2857-50.0257-14.9105-48.1921-30.9025-74.2857-27.1429 .8055,59.0851-22.5007,30.986-32.8571,24.2857-15.4674,27.4347-32.7313,7.7567-38.5714-5.7143-9.05-.4279-18.7811-2.0595-27.1428,1.4286-6.5334,2.7254-15.0067,7.2421-15.7143,14.2857-1.7706,17.6266 36.1816,25.7914 31.4286,42.8571-4.9827,17.8905-33.0675,18.6412-51.4286,21.4286-15.1316,2.2971-11.8576,4.5404-45.7143-4.2857-3.5262-14.7785 39.9873-9.1585 38.5714-24.2857-1.574-16.8162-33.0184-9.3108-47.1429-18.5714-6.195-4.0617-15.1033-8.3317-15.7143-15.7143-.6757-8.1648 17.5519-12.4865 14.2857-20-47.394,11.704-62.9362.3264-87.1429-11.4286-10.6619,2.5507-18.2096,12.2171-27.1429,18.5714-11.0981,7.8943-21.8988,16.1986-32.8571,24.2857-9.0427,6.6734-18.7271,12.5516-27.1429,20-8.8287,7.8139-12.7783,23.1489-24.2857,25.7143-16.485,3.675-45.1591-1.7987-47.1429-18.5714-2.7309-23.0896 41.9546-22.3958 57.1429-40 13.9114-16.1242 35.8963-37.1463 28.5714-57.1429-44.6272,12.4254-55.9656-4.9993-60-25.7143-7.8923,1.8631-9.8671,12.9527-15.7143,18.5714-21.7727,20.9223-47.5679,26.0304-61.4286,52.8571-4.8138,9.3169-3.4237,27.5108-11.4286,34.2857-12.0827,10.2262-41.0072,8.8775-47.1429-5.7143z';
