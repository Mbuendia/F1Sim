// [MJ5, 19/11/2026] Sonda de desbordes: se pega en la consola (o se evalúa con Chrome sin ventana) en la carrera y devuelve
// cuánto se sale la página, qué paneles tienen desplazamiento horizontal (y vertical) y qué controles quedan cortados.
(() => {
  const out = { w: innerWidth, h: innerHeight, page: document.documentElement.scrollWidth - innerWidth, scrollX: [], scrollY: [], cut: [] };
  const vis = e => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden'; };
  const nm = e => (e.className && typeof e.className === 'string' ? e.className.split(' ')[0].replace(/^_|_[a-z0-9]{5}_\d+$/g, '') : e.tagName) + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18);
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || e.closest('canvas,svg')) continue;
    const st = getComputedStyle(e);
    if (/(auto|scroll)/.test(st.overflowX) && e.scrollWidth > e.clientWidth + 2) out.scrollX.push(nm(e) + ' ' + e.scrollWidth + '>' + e.clientWidth);
    if (/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.clientHeight > 60) out.scrollY.push(nm(e) + ' ' + e.scrollHeight + '>' + e.clientHeight);
    if (/^(BUTTON|INPUT|SELECT)$/.test(e.tagName)) {
      const r = e.getBoundingClientRect();
      let p = e.parentElement; while (p && getComputedStyle(p).overflowX === 'visible' && p !== document.body) p = p.parentElement;
      const pr = (p || document.body).getBoundingClientRect();
      if (r.right > Math.min(innerWidth, pr.right) + 1 || r.left < Math.max(0, pr.left) - 1) out.cut.push(nm(e));
    }
  }
  out.scrollX = [...new Set(out.scrollX)].slice(0, 12); out.scrollY = [...new Set(out.scrollY)].slice(0, 12); out.cut = [...new Set(out.cut)].slice(0, 15);
  return JSON.stringify(out);
})()
