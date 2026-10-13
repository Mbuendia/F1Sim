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
  if (reply?.exceptionDetails || reply?.message) console.log('ERROR JS:', JSON.stringify(reply.exceptionDetails?.exception?.description ?? reply).slice(0, 300));
  return reply?.result?.value;
};
const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: width < 500 ? 2 : 1, mobile: width < 800 });
const shot = async name => {
  await send('Page.bringToFront');
  await send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', awaitPromise: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    if (result?.data) { writeFileSync(join(out, `${name}.png`), Buffer.from(result.data, 'base64')); console.log(name); return; }
    if (attempt === 4) console.log(name, 'FALLO', JSON.stringify(result));
    await sleep(1200);
  }
};
const open = async () => { await send('Page.navigate', { url }); await sleep(1800); };
const HELPERS = `
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const click = text => { const el = [...document.querySelectorAll('button, [role=tab]')].find(b => (b.textContent + ' ' + (b.getAttribute('aria-label') ?? '')).includes(text)); if (el) el.click(); return Boolean(el); };
  const radio = (name, value) => { const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (el) el.click(); return Boolean(el); };
`;
const run = code => evaluate(HELPERS + code);

await send('Page.enable'); await send('Runtime.enable');
process.on('exit', () => chrome.kill());

// ── Portada, menú y paddock de carrera libre ──
await size(1440, 900); await open(); await shot('01-portada-1440');
await run(`click('Entrar al paddock'); await wait(900);`); await shot('02-menu-1440');
await run(`click('Carrera libre'); await wait(1800);`); await shot('03-paddock-libre-1440');
await size(375, 812); await sleep(900); await shot('04-paddock-libre-375');

// ── Carrera a los cuatro anchos ──
await size(1440, 900); await sleep(600);
await run(`click('ENTRAR A PISTA'); await wait(2500); click('32x'); for (let i = 0; i < 240; i++) { await wait(500); if (click('CONFIRMAR INICIO')) break; }`);
await shot('05a-carrera-semaforo-1440');
await run(`const lap = () => Number((document.querySelector('[class*=lapValue]')?.textContent ?? '0').trim().split(' ')[0]); for (let i = 0; i < 400; i++) { await wait(500); click('32x'); if (lap() >= 9) break; } click('1x'); await wait(1500);`);
await shot('05-carrera-1440');
await run(`click('Detalle'); await wait(1200);`); await shot('06-carrera-detalle-1440');
await run(`click('Menú de carrera'); await wait(500);`); await shot('07-carrera-menu-sonido-1440');
await run(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); click('Cerrar detalle'); await wait(500);`);
await size(1024, 768); await sleep(1200); await shot('08-carrera-1024');
await size(768, 1024); await sleep(1200); await shot('09-carrera-tableta-768');
await size(375, 812); await sleep(1400); await shot('10-carrera-movil-pista');
for (const [name, tab] of [['11-carrera-movil-tiempos', 'Tiempos'], ['12-carrera-movil-muro', 'Muro'], ['13-carrera-movil-detalle', 'Detalle']]) {
  await run(`[...document.querySelectorAll('[role=tab]')].find(b => b.textContent.includes('${tab}'))?.click(); await wait(900);`); await shot(name);
}

// ── Clasificación en directo ──
await size(1440, 900); await open();
await run(`click('Entrar al paddock'); await wait(900); click('Carrera libre'); await wait(1600); radio('formato-gp', 'clasificacion'); await wait(400); click('ENTRAR A PISTA'); await wait(6500);`);
await shot('14-clasificacion-directo-1440');
await run(`click('×1'); for (let i = 0; i < 60; i++) { await wait(500); if (document.body.innerText.includes('Final de Q1')) break; } await wait(400);`);
await shot('15-clasificacion-comentario-1440');
await size(375, 812); await sleep(1000); await shot('16-clasificacion-comentario-375');
await size(1440, 900); await run(`click('Saltar'); await wait(900);`); await shot('17-clasificacion-tabla-1440');

// ── Centro de gestión (carrera profesional nueva) ──
await open();
await run(`click('Entrar al paddock'); await wait(900); click('Nueva carrera profesional'); await wait(1000); click('Aston Martin'); await wait(300); click('Empezar'); await wait(2000);`);
await shot('18-gestion-inicio-1440');
await run(`click('Equipo'); await wait(900);`); await shot('19-gestion-equipo-personal-1440');
await run(`click('Fábrica'); await wait(900);`); await shot('20-gestion-fabrica-1440');
await run(`click('Temporada'); await wait(900);`); await shot('21-gestion-temporada-simular-1440');
await run(`click('Correr'); await wait(1000); click('Hacer los entrenamientos libres'); await wait(2000); click('Encargar el informe'); await wait(900);`);
await shot('22-gestion-correr-libres-espia-1440');
await run(`const s = document.querySelector('[aria-label="Entrenamientos libres"]'); s?.scrollIntoView({ block: 'start' }); await wait(500);`);
await shot('23-gestion-libres-espia-detalle-1440');
await size(375, 812); await sleep(1000);
await run(`document.querySelector('[class*=homeContainer]')?.scrollTo(0, 0); click('Inicio'); await wait(900);`); await shot('24-gestion-inicio-375');
await run(`click('Equipo'); await wait(900);`); await shot('25-gestion-equipo-375');
await run(`click('Correr'); await wait(900);`); await shot('26-gestion-correr-375');
await size(768, 1024); await sleep(900); await shot('27-gestion-correr-768');

socket.close(); chrome.kill();
