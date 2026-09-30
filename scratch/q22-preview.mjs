// Q22: vista previa estática (SSR) del chasis cenital en varios estados de desgaste y DRS.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { CarChassisSvg } = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');
const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
const cases = [
  ['Sano · DRS cerrado', [95, 92, 88, 85], false, 'soft', TEAMS.mclaren],
  ['Mixto · DRS abierto', [92, 55, 32, 18], true, 'medium', TEAMS.ferrari],
  ['Alerta', [60, 58, 52, 49], false, 'hard', TEAMS.mercedes],
  ['Crítico delantero', [15, 22, 64, 70], false, 'intermediate', TEAMS.redbull],
  ['Cliff trasero · DRS', [74, 71, 30, 26], true, 'wet', TEAMS.alpine],
];
const cell = ([title, [fl, fr, rl, rr], drs, compound, team]) => `<figure style="margin:0;color:#e2e8f0;font:11px sans-serif;text-align:center">`
  + renderToStaticMarkup(h(CarChassisSvg, { tireHealthFL: fl, tireHealthFR: fr, tireHealthRL: rl, tireHealthRR: rr, compound, drsActive: drs, teamColor: team.color, accentColor: team.accentColor, width: 120 }))
  + `<figcaption>${title}<br>${team.shortName} · ${compound} · ${fl}/${fr}/${rl}/${rr}</figcaption></figure>`;
const small = cases.map(([t, w, d, c, team]) => renderToStaticMarkup(h(CarChassisSvg, { tireHealthFL: w[0], tireHealthFR: w[1], tireHealthRL: w[2], tireHealthRR: w[3], compound: c, drsActive: d, teamColor: team.color, accentColor: team.accentColor, width: 64 }))).join('');
writeFileSync('scratch/q22-preview.html', `<!doctype html><meta charset="utf-8"><title>Q22 vista previa</title><body style="margin:0;background:#0b0f17">
<div style="display:flex;flex-wrap:wrap;gap:22px;padding:14px">${cases.map(cell).join('')}</div>
<div style="display:flex;gap:14px;padding:14px;background:#111827;color:#94a3b8;font:11px sans-serif;align-items:center">${small}<span>Tamaño del panel de telemetría (64 px)</span></div></body>`);
await server.close();
