// Portada — la rueda 3D muestra un compuesto aleatorio en cada carga, distinto del de la visita anterior, y ya no
// tiene selector de compuestos (petición del usuario, 30/09/2026).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const COMPOUNDS = ['soft', 'medium', 'hard', 'inter', 'wet'];

const memoryStorage = () => {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
};

export default async function run({ server, assert, test }) {
  const { chooseLandingCompound, F1Wheel3D } = await server.ssrLoadModule('/src/components/F1Wheel3D.tsx');

  await test('Portada: el compuesto sale al azar entre los cinco', () => {
    const seen = new Set();
    for (let i = 0; i < 5; i++) seen.add(chooseLandingCompound(memoryStorage(), () => (i + 0.5) / 5));
    assert([...seen].every(c => COMPOUNDS.includes(c)) && seen.size === 5, 'Portada: sin visita previa, cualquiera de los cinco compuestos', [...seen].join(', '));
  });

  await test('Portada: cada recarga muestra un compuesto distinto del anterior', () => {
    const storage = memoryStorage();
    let previous = chooseLandingCompound(storage, () => 0);
    let repeats = 0;
    const seen = new Set([previous]);
    for (let i = 0; i < 200; i++) {
      const next = chooseLandingCompound(storage, () => (i * 0.137) % 1);
      if (next === previous) repeats++;
      seen.add(next);
      previous = next;
    }
    assert(repeats === 0, 'Portada: nunca repite el compuesto de la recarga anterior', `${repeats} repeticiones`);
    assert(seen.size === 5, 'Portada: con el tiempo aparecen los cinco compuestos', [...seen].join(', '));
  });

  await test('Portada: sin almacenamiento disponible sigue eligiendo un compuesto válido', () => {
    const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    assert(COMPOUNDS.includes(chooseLandingCompound(broken, () => 0.7)), 'Portada: almacenamiento bloqueado no rompe la portada');
    assert(COMPOUNDS.includes(chooseLandingCompound(undefined, () => 0.2)), 'Portada: sin almacenamiento también funciona');
  });

  await test('Portada: la rueda ya no tiene selector de compuestos', () => {
    const html = renderToStaticMarkup(createElement(F1Wheel3D, {}));
    assert(!/<button/i.test(html) && !/SOFT|MEDIUM|HARD|INTER|WET/.test(html), 'Portada: sin botones de compuesto en la rueda');
    const source = readFileSync(new URL('../../src/components/F1Wheel3D.tsx', import.meta.url), 'utf8');
    assert(!/setSelectedCompound|updateCompound|compoundSelector/.test(source), 'Portada: sin estado ni manejadores para cambiar el compuesto');
  });
}
