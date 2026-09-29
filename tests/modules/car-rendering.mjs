import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
    console.log('\n--- TEST GROUP 4: Bloque A — Modelado Visual 2D (M1, M2, M3) ---');

    // M1, M2, M3: Inspección estructural del código fuente de CarRenderer.ts
    {
      const fs = await import('node:fs');
      const carRendererSrc = fs.readFileSync('src/renderer/CarRenderer.ts', 'utf-8');

      // M1: 5 capas en orden estricto (Floor -> Suspensions -> Wheels -> Bodywork -> Wings/Halo)
      const floorIdx = carRendererSrc.indexOf('// 1. SUELO / FONDO PLANO');
      const suspIdx = carRendererSrc.indexOf('// 2. SUSPENSIONES');
      const wheelIdx = carRendererSrc.indexOf('// 3. NEUMÁTICOS');
      const chassisIdx = carRendererSrc.indexOf('// 4. CHASIS PRINCIPAL');
      const aeroIdx = carRendererSrc.indexOf('// 5. DETALLES AERODINÁMICOS');

      const zOrderCorrect = (floorIdx !== -1 && suspIdx !== -1 && wheelIdx !== -1 && chassisIdx !== -1 && aeroIdx !== -1)
        && (floorIdx < suspIdx && suspIdx < wheelIdx && wheelIdx < chassisIdx && chassisIdx < aeroIdx);

      assert(zOrderCorrect, 'M1: Z-Order de capas vectorial correcto (Floor -> Suspensions -> Wheels -> Chassis -> Wings/Halo)');

      // M2: Sombra fija en pantalla (dibujada antes de ctx.rotate(angle))
      const shadowIdx = carRendererSrc.indexOf('// Sombra fija en pantalla');
      const rotateIdx = carRendererSrc.indexOf('ctx.rotate(angle);');
      const shadowBeforeRotate = shadowIdx !== -1 && rotateIdx !== -1 && shadowIdx < rotateIdx;
      assert(shadowBeforeRotate, 'M2: Sombra del coche proyectada en pantalla antes de rotar el monoplaza');

      // M3: Humo de retirada compensando camera.rotation
      const smokeOffsetHasCamRot = carRendererSrc.includes('angle + camera.rotation') && carRendererSrc.includes('smokeAngle');
      assert(smokeOffsetHasCamRot, 'M3: Humo de retirada utiliza ángulo compuesto (angle + camera.rotation)');
    }

}
