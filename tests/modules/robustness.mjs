import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { TireModel } = await server.ssrLoadModule('/src/simulation/TireModel.ts');
  const { IncidentModel } = await server.ssrLoadModule('/src/simulation/IncidentModel.ts');
    console.log('\n--- TEST GROUP 7: Bloque D — Limpieza y Robustez (B1, B3, B4, B5) ---');

    // B1: Retiro de SpriteManager no utilizado en CarRenderer.ts
    {
      const fs = await import('node:fs');
      const carRendererCode = fs.readFileSync('src/renderer/CarRenderer.ts', 'utf-8');
      assert(!carRendererCode.includes('class SpriteManager'), 'B1: SpriteManager obsoleto eliminado de CarRenderer.ts');
    }

    // B3: Fallback seguro en getCompoundProperties
    {
      const fallbackProps = TireModel.getCompoundProperties('super_hyper_soft_unknown');
      assert(fallbackProps && typeof fallbackProps.nominalLaps === 'number', 'B3: getCompoundProperties devuelve fallback seguro en caso de compuesto no registrado');
    }

    // B4: IncidentModel.reset()
    {
      IncidentModel.reset();
      const inc1 = IncidentModel.registerIncident({ id: 1, driver: { code: 'HAM' }, trackT: 0.1 }, 'dnf');
      assert(inc1.id === 1, `B4: IncidentModel.reset() reinicia el ID de incidentes a 1 (obtenido: ${inc1.id})`);
    }

    // B5: Soporte para incidentes de tipo 'spin'
    {
      const spinInc = IncidentModel.registerIncident({ id: 2, driver: { code: 'ALO' }, trackT: 0.5 }, 'spin');
      assert(spinInc.type === 'spin', 'B5: Tipo de incidente "spin" registrado correctamente');
      assert(spinInc.clearTimer >= 8 && spinInc.clearTimer <= 12, `B5: Temporizador de spin entre 8s y 12s (obtenido: ${spinInc.clearTimer.toFixed(1)}s)`);
    }

}
