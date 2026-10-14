// Móvil: las pantallas a toda altura miden la parte visible, no la que tapa la barra del navegador.
import { readFileSync } from 'node:fs';

const css = path => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
const SCREENS = [['App.module.css', '.appContainer'], ['components/HomeScreen.module.css', '.homeContainer'], ['components/LandingPage.module.css', '.landingContainer'], ['components/Screens.module.css', '.screen']];

export default async function run({ assert, test }) {
  await test('Móvil: altura visible en las pantallas completas', () => {
    const wrong = SCREENS.filter(([file, selector]) => {
      const rule = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css(file))?.[1] ?? '';
      const heights = [...rule.matchAll(/(?:^|[;\s])height:\s*([^;]+);/g)].map(match => match[1].trim());
      return !(heights.at(-1) === '100dvh' && heights.includes('100vh'));
    }).map(([file, selector]) => `${file} ${selector}`);
    assert(wrong.length === 0, 'Móvil: cada pantalla completa usa 100dvh (con 100vh de respaldo), para que la barra del navegador no tape los botones de abajo', wrong.join(', '));
  });
}
