// Q18 — Ciclo de vida del modal D20 (auditoría 30/09/2026; tests estructurales sin dependencias nuevas, decisión del
// usuario). La suite no tiene DOM, así que se comprueba el código fuente:
//  - ningún efecto (onApplyReward/onDismiss) dentro de un actualizador de setState (StrictMode lo ejecuta dos veces);
//  - un único punto de cierre protegido, compartido por clic y temporizador;
//  - los temporizadores no dependen de callbacks del padre (App re-renderiza cada 66 ms y los reiniciaría);
//  - un evento nuevo reinicia la animación y la cuenta aunque repita la tirada (clave por event.id);
//  - los temporizadores se limpian al desmontar.
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');

// Bloques "setX(prev => { ... })" o "setX((prev) => ...)" con su cuerpo, contando llaves/paréntesis.
function stateUpdaters(source) {
  const blocks = [];
  const re = /\bset(?!Interval|Timeout)[A-Z]\w*\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>/g;
  let match;
  while ((match = re.exec(source))) {
    let depth = 1, i = source.indexOf('(', match.index) + 1;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') depth--;
    }
    blocks.push(source.slice(match.index, i));
  }
  return blocks;
}

// Arrays de dependencias de useEffect/useCallback/useMemo.
function dependencyArrays(source) {
  return [...source.matchAll(/\},\s*\[([^\]]*)\]\s*\)/g)].map(m => m[1]);
}

export default async function run({ assert, test }) {
  const modal = read('components/D20LuckModal.tsx');
  const app = read('App.tsx');

  await test('Q18: el modal no ejecuta efectos dentro de actualizadores de estado', () => {
    const updaters = stateUpdaters(modal);
    assert(updaters.length > 0, 'Q18: el analizador encuentra los actualizadores del modal');
    const impure = updaters.filter(block => /onApplyReward|onDismiss|applyLuckEventReward/.test(block));
    assert(impure.length === 0, 'Q18: onApplyReward/onDismiss fuera de los actualizadores de setState', impure[0]?.slice(0, 80));
  });

  await test('Q18: un único cierre protegido para clic y temporizador', () => {
    const calls = modal.match(/onApplyReward(?:Ref\.current)?\(/g) || [];
    assert(calls.length === 1, 'Q18: la recompensa se solicita desde un solo punto', `${calls.length} llamadas`);
    assert(/const (\w+) = useRef\(false\)/.test(modal) && /if \(\w+\.current\) return;/.test(modal),
      'Q18: una ref impide cerrar dos veces (clic simultáneo al fin de la cuenta)');
  });

  await test('Q18: los temporizadores no dependen de callbacks del padre', () => {
    const deps = dependencyArrays(modal);
    assert(deps.length > 0, 'Q18: el analizador encuentra dependencias de efectos');
    assert(deps.every(list => !/onApplyReward|onDismiss/.test(list)), 'Q18: ningún efecto se reinicia por callbacks nuevos del padre', deps.join(' | '));
    assert(/onApplyRewardRef|callbacksRef/.test(modal), 'Q18: el modal lee los callbacks vigentes desde una ref');
  });

  await test('Q18: evento nuevo con la misma tirada reinicia animación y cuenta', () => {
    assert(!dependencyArrays(modal).some(list => /^\s*event\.rollValue\s*$/.test(list)), 'Q18: la animación no depende solo de la tirada');
    assert(dependencyArrays(modal).some(list => /event\.id/.test(list)), 'Q18: la animación se reinicia por event.id');
    assert(/<D20LuckModal[\s\S]{0,120}key=\{activeLuckEvent\.id\}/.test(app), 'Q18: App monta un modal nuevo por evento (key = event.id)');
  });

  await test('Q18: temporizadores limpiados al desmontar', () => {
    const intervals = (modal.match(/setInterval\(/g) || []).length;
    const clears = (modal.match(/return \(\) => (?:window\.)?clearInterval\(/g) || []).length;
    assert(intervals > 0 && clears >= intervals, 'Q18: cada setInterval del modal tiene limpieza en el desmontaje', `${intervals} intervalos, ${clears} limpiezas`);
  });
}
