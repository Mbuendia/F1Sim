// Capturas de revisión de la interfaz con Chrome sin ventana (protocolo DevTools, sin dependencias).
// Uso: con el servidor de desarrollo en marcha, `node scripts/capture-screens.mjs [url] [carpeta]`.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:3010/F1Sim/';
const out = process.argv[3] ?? 'docs/revision-3.7';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9347;
mkdirSync(out, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'f1cap-'))}`,
  '--enable-unsafe-swiftshader', '--hide-scrollbars', '--run-all-compositor-stages-before-draw', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1440,900', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(page => page.type === 'page'); } catch { /* aún arrancando */ }
}
if (!target) { chrome.kill(); throw new Error('Chrome no arrancó'); }
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve));
let seq = 0;
const waiting = new Map();
socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); } });
const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; waiting.set(id, message => resolve(message.result ?? message.error)); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => {
  const reply = await send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  return reply?.result?.value;
};
await send('Page.enable'); await send('Runtime.enable');
process.on('exit', () => chrome.kill());
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(40000);
const VIEWS = JSON.parse(process.argv[4] ?? '[]'); const _old = [
  ['juego-1-recta', { x: 540, y: 720, distance: 520, azimuth: -0.35, elevation: 0.62 }],
  ['juego-2-boxes-lago', { x: 575, y: 700, distance: 260, azimuth: 3.3, elevation: 0.42 }],
  ['juego-3-tribuna', { x: 456, y: 840, distance: 150, azimuth: 0.15, elevation: 0.3 }],
  ['juego-4-paddock', { x: 600, y: 790, distance: 220, azimuth: -0.6, elevation: 0.7 }],
];
for (const [name, orbit] of VIEWS) {
  await evaluate(`const c = window.__camera3d; c.setMode && c.setMode("libre"); c.director.mode = "libre"; c.director.orbit = ${JSON.stringify(orbit)}; return 1`);
  await sleep(6000);
  await send('Page.bringToFront'); await send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', awaitPromise: true });
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  if (r?.data) { writeFileSync(join(out, name + '.jpg'), Buffer.from(r.data, 'base64')); console.log(name); }
}
console.log('errores:', await evaluate('return (window.__errores ?? []).length'));
process.exit(0);
