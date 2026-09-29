// Q21: silueta en grande junto a la referencia del usuario, para compararlas visualmente.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
const car = (color, bg) => `<div style="background:${bg};padding:12px">${renderToStaticMarkup(h(F1CarSilhouette, { teamColor: color, width: 430 }))}</div>`;
writeFileSync('scratch/q21-car.html', `<!doctype html><meta charset="utf-8"><title>Q21 silueta</title><body style="margin:0">
<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8wUR_0dc9RoHUbjYE_9hC-TgxdSSKzd2psmCBGyzgQQ&s=10" width="430">
${car('#111111', '#f0f0f0')}${car('#ff8000', '#0b0f17')}</body>`);
await server.close();
