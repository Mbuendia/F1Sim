// Q21: vista previa estática (SSR) de CompoundBadge y F1CarSilhouette sobre los fondos de la interfaz.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
const compounds = ['soft', 'medium', 'hard', 'intermediate', 'wet'];
const row = (bg, size) => `<div style="background:${bg};padding:10px;display:flex;gap:18px;align-items:center;color:#e2e8f0;font:12px sans-serif">`
  + compounds.map(c => renderToStaticMarkup(h(CompoundBadge, { compound: c, size, showName: true }))).join('') + `<span style="opacity:.6">${bg} · ${size}px</span></div>`;
const cars = Object.values(TEAMS).map(t => `<figure style="margin:0;color:#e2e8f0;font:11px sans-serif">${renderToStaticMarkup(h(F1CarSilhouette, { teamColor: t.color, width: 120 }))}<figcaption>${t.name}</figcaption></figure>`).join('');
writeFileSync('scratch/q21-preview.html', `<!doctype html><meta charset="utf-8"><title>Q21 vista previa</title><body style="margin:0;background:#0b0f17">
${row('#0b0f17', 14)}${row('#111827', 18)}${row('#1e293b', 24)}
<div style="display:flex;flex-wrap:wrap;gap:12px;padding:10px;background:#0b0f17">${cars}</div></body>`);
await server.close();
