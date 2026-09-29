// Q22 — CarChassisSvg: Chasis SVG cenital interactivo con neumáticos térmicos y DRS
// Contrato: componente React reutilizable con props de desgaste por rueda, estado DRS y color de equipo.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {

  await test('Q22: CarChassisSvg exporta un componente React', async () => {
    const mod = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');
    assert(typeof mod.CarChassisSvg === 'function' || typeof mod.default === 'function',
      'CarChassisSvg es un componente exportado');
  });

  await test('Q22: Renderiza SVG con las 4 ruedas identificadas', async () => {
    const { CarChassisSvg } = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');
    const html = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 95, tireHealthFR: 88, tireHealthRL: 72, tireHealthRR: 65,
      compound: 'soft', drsActive: false, teamColor: '#e10600', accentColor: '#ffffff'
    }));
    // Debe contener un SVG
    assert(html.includes('<svg'), 'Renderiza un elemento SVG');
    // Debe tener 4 elementos de rueda identificables (por data-wheel o id)
    for (const wheel of ['FL', 'FR', 'RL', 'RR']) {
      assert(html.includes(`data-wheel="${wheel}"`), `Contiene rueda identificada ${wheel}`);
    }
  });

  await test('Q22: Colores de rueda reflejan nivel de desgaste', async () => {
    const { CarChassisSvg } = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');

    // Ruedas sanas (>70%) deben usar verde #22c55e
    const htmlSana = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 95, tireHealthFR: 90, tireHealthRL: 85, tireHealthRR: 80,
      compound: 'medium', drsActive: false, teamColor: '#0600ef', accentColor: '#fff'
    }));
    assert(htmlSana.includes('#22c55e'), 'Ruedas sanas: usan verde (#22c55e)');

    // Rueda en zona crítica (<25%) debe usar rojo #ef4444
    const htmlCritica = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 10, tireHealthFR: 90, tireHealthRL: 85, tireHealthRR: 80,
      compound: 'hard', drsActive: false, teamColor: '#0600ef', accentColor: '#fff'
    }));
    assert(htmlCritica.includes('#ef4444'), 'Rueda crítica (<25%): usa rojo (#ef4444)');

    // Zona de alerta (40-70%) debe usar amarillo #eab308
    const htmlAlerta = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 55, tireHealthFR: 55, tireHealthRL: 55, tireHealthRR: 55,
      compound: 'medium', drsActive: false, teamColor: '#0600ef', accentColor: '#fff'
    }));
    assert(htmlAlerta.includes('#eab308'), 'Ruedas en alerta (40-70%): usan amarillo (#eab308)');

    // Zona cliff (25-40%) debe usar naranja #f97316
    const htmlCliff = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 30, tireHealthFR: 30, tireHealthRL: 30, tireHealthRR: 30,
      compound: 'soft', drsActive: false, teamColor: '#e10600', accentColor: '#fff'
    }));
    assert(htmlCliff.includes('#f97316'), 'Ruedas en cliff (25-40%): usan naranja (#f97316)');
  });

  await test('Q22: Alerón trasero refleja estado DRS', async () => {
    const { CarChassisSvg } = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');
    const base = { tireHealthFL: 80, tireHealthFR: 80, tireHealthRL: 80, tireHealthRR: 80,
      compound: 'medium', teamColor: '#0600ef', accentColor: '#fff' };

    const htmlClosed = renderToStaticMarkup(createElement(CarChassisSvg, { ...base, drsActive: false }));
    const htmlOpen = renderToStaticMarkup(createElement(CarChassisSvg, { ...base, drsActive: true }));

    // El alerón debe tener un atributo o clase que indique estado DRS
    assert(htmlOpen.includes('data-drs="open"') || htmlOpen.includes('drs-open'),
      'DRS abierto: marca visible en el SVG');
    assert(htmlClosed.includes('data-drs="closed"') || htmlClosed.includes('drs-closed') ||
      (!htmlClosed.includes('data-drs="open"') && !htmlClosed.includes('drs-open')),
      'DRS cerrado: sin marca de apertura');
  });

  await test('Q22: Pulso de advertencia para ruedas críticas (<25%)', async () => {
    const { CarChassisSvg } = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');
    const html = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 15, tireHealthFR: 90, tireHealthRL: 85, tireHealthRR: 20,
      compound: 'soft', drsActive: false, teamColor: '#e10600', accentColor: '#fff'
    }));
    // Las ruedas críticas deben tener un indicador de pulso/warning
    assert(html.includes('tire-warning') || html.includes('data-warning="true"'),
      'Ruedas FL y RR (<25%) tienen indicador de advertencia');
  });

  await test('Q22: Usa color del equipo en el chasis', async () => {
    const { CarChassisSvg } = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');
    const teamColor = '#ff8000'; // McLaren
    const html = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 80, tireHealthFR: 80, tireHealthRL: 80, tireHealthRR: 80,
      compound: 'medium', drsActive: false, teamColor, accentColor: '#0057b8'
    }));
    assert(html.includes(teamColor), 'El chasis utiliza el color del equipo');
  });

  await test('Q22: No renderiza NaN ni undefined', async () => {
    const { CarChassisSvg } = await server.ssrLoadModule('/src/components/CarChassisSvg.tsx');
    const html = renderToStaticMarkup(createElement(CarChassisSvg, {
      tireHealthFL: 80, tireHealthFR: 80, tireHealthRL: 80, tireHealthRR: 80,
      compound: 'hard', drsActive: false, teamColor: '#e10600', accentColor: '#fff'
    }));
    assert(!html.includes('NaN') && !html.includes('undefined'),
      'Sin valores NaN ni undefined en el markup');
  });
}
