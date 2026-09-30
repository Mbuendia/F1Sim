// Q17 — El texto del D20 coincide con su efecto (auditoría 30/09/2026): la tirada es un consejo de estrategia;
// el modal no afirma montar neumáticos ni salud 100 % y presenta el compuesto como recomendación para la próxima parada.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { D20LuckResult, D20LuckModal } = await server.ssrLoadModule('/src/components/D20LuckModal.tsx');

  for (const roll of [1, 10, 14, 20]) {
    await fixedRandom((roll - 0.5) / 20, async () => {
      await test(`Q17 tirada ${roll}: el modal presenta un consejo, no un cambio de neumáticos`, () => {
        const sim = make(), car = sim.cars[0];
        const event = sim.triggerD20LuckRoll('sc', car.driver.id);
        const html = renderToStaticMarkup(createElement(D20LuckResult, { event }));
        const text = html.replace(/<[^>]+>/g, ' ');
        assert(!/equipad|montad|100\s*%\s*(de\s*)?salud/i.test(text), `Q17 ${roll}: no afirma equipar neumáticos ni salud 100 %`, text.match(/equipad\w*|montad\w*|100\s*%[^<]{0,12}/i)?.[0]);
        assert(html.includes(`data-d20-recommendation="${event.optimalCompound}"`) && /recomendad/i.test(text) && /pr[oó]xima parada/i.test(text),
          `Q17 ${roll}: el compuesto se presenta como recomendación para la próxima parada`);
        assert(/orden de boxes/i.test(text), `Q17 ${roll}: indica que el cambio requiere una orden de boxes`);
        assert(!/instant|ahora mismo|sin parar/i.test(event.rewardDescription), `Q17 ${roll}: la descripción no promete efectos inmediatos`);
      });
    });
  }

  await test('Q17: el botón no promete aplicar un efecto', () => {
    const sim = make(), event = sim.triggerD20LuckRoll('vsc');
    const html = renderToStaticMarkup(createElement(D20LuckModal, { event, onApplyReward: () => {}, onDismiss: () => {} }));
    assert(!/APLICAR/i.test(html) && /ACEPTAR CONSEJO/i.test(html), 'Q17: el botón acepta el consejo en lugar de "aplicar"');
  });
}
