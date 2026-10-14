// N11: el juego puede publicarse en otra dirección (Firebase Hosting) sin tocar el código.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);

export default async function run({ assert, test }) {
  await test('N11: ninguna ruta de recursos fija a /F1Sim/', () => {
    const files = [...walk(join(root, 'src')).filter(file => /\.(ts|tsx|css|json)$/.test(file)), join(root, 'index.html')];
    const fixed = files.filter(file => /['"`(]\/F1Sim\//.test(readFileSync(file, 'utf8'))).map(file => file.slice(root.length));
    assert(fixed.length === 0, 'N11: el código y la página de entrada no llevan ninguna ruta fija a /F1Sim/', fixed.join(', '));
  });

  await test('N11: la ruta base sale del entorno', async () => {
    const { loadConfigFromFile } = await import('vite');
    const baseWith = async value => {
      const previous = process.env.BASE_PATH;
      if (value === undefined) delete process.env.BASE_PATH; else process.env.BASE_PATH = value;
      try { return (await loadConfigFromFile({ command: 'build', mode: 'production' }, join(root, 'vite.config.ts'), root, 'silent'))?.config.base; }
      finally { if (previous === undefined) delete process.env.BASE_PATH; else process.env.BASE_PATH = previous; }
    };
    const pages = await baseWith(undefined), firebase = await baseWith('/');
    assert(pages === '/F1Sim/' && firebase === '/', 'N11: sin BASE_PATH la base es /F1Sim/ (GitHub Pages) y con BASE_PATH=/ es la raíz (Firebase)', `sin variable «${pages}», con «/» «${firebase}»`);
  });

  await test('N11: firebase.json', () => {
    const path = join(root, 'firebase.json');
    const hosting = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).hosting : null;
    const spa = hosting?.rewrites?.some(rule => rule.source === '**' && rule.destination === '/index.html');
    const longCache = source => hosting?.headers?.some(rule => rule.source === source && rule.headers?.some(header => header.key === 'Cache-Control' && Number(/max-age=(\d+)/.exec(header.value)?.[1]) >= 86400 * 7));
    assert(hosting?.public === 'dist' && spa === true, 'N11: Firebase sirve la carpeta dist con la regla de aplicación de una sola página', JSON.stringify({ public: hosting?.public, spa }));
    const cached = ['/models/**', '/circuits/**', '/audio/**'].filter(longCache);
    assert(cached.length === 3, 'N11: modelos 3D, circuitos y audio llevan caché larga', cached.join(', '));
  });
}
