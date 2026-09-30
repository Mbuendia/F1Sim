// Portada: la rueda muestra un compuesto al azar en cada carga, nunca el de la carga anterior.
export default async function run({ server, assert, test }) {
  const { chooseLandingCompound } = await server.ssrLoadModule('/src/components/F1Wheel3D.tsx');
  await test('Portada: compuesto aleatorio distinto del de la recarga anterior', () => {
    const data = new Map();
    const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const loads = Array.from({ length: 50 }, (_, i) => chooseLandingCompound(storage, () => (i * 0.37) % 1));
    const valid = loads.every(c => ['soft', 'medium', 'hard', 'inter', 'wet'].includes(c));
    const repeats = loads.filter((c, i) => i > 0 && c === loads[i - 1]).length;
    assert(valid && repeats === 0, 'Portada: compuesto válido y nunca repetido entre recargas seguidas', `${repeats} repeticiones`);
  });
}
