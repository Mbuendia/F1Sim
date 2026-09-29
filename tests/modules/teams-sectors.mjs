import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {

    console.log('\n--- TEST GROUP 6: Bloque C — Identidad de Equipos y Sectores (M6, M7, M8) ---');

    const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
    const { IncidentModel } = await server.ssrLoadModule('/src/simulation/IncidentModel.ts');

    // M6: Contraste accesible en Mercedes (WCAG AAA)
    {
      assert(TEAMS.mercedes.textColor === '#000000', `M6: Mercedes textColor es negro (#000000) para ratio WCAG AAA (obtenido: ${TEAMS.mercedes.textColor})`);
    }

    // M7: Diferenciación cromática Red Bull vs Racing Bulls
    {
      const rbColor = TEAMS.redbull.color.toUpperCase();
      const vcarbColor = TEAMS.racingbulls.color.toUpperCase();
      assert(rbColor === '#041E42', `M7: Red Bull utiliza azul marino mate oficial #041E42 (obtenido: ${rbColor})`);
      assert(vcarbColor === '#1634CC', `M7: Racing Bulls utiliza azul eléctrico VCARB #1634CC (obtenido: ${vcarbColor})`);
      assert(rbColor !== vcarbColor, 'M7: Colores de Red Bull y Racing Bulls están claramente diferenciados');
    }

    // M8: Consolidación de sectores desde activeTrack
    {
      const { computeTrackSpline } = await server.ssrLoadModule('/src/utils/spline.ts');
      const mockPoints = [
        { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 },
        { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 200, y: 200 }, { x: 0, y: 100 }
      ];
      // Probar con límites custom (0.20 y 0.60)
      const spline = computeTrackSpline(mockPoints, 10, 0.20, 0.60);
      const pS1 = spline[Math.floor(spline.length * 0.10)];
      const pS2 = spline[Math.floor(spline.length * 0.35)];
      const pS3 = spline[Math.floor(spline.length * 0.75)];
      assert(pS1.sector === 1, `M8: Punto al 10% corresponde a Sector 1 (obtenido: ${pS1.sector})`);
      assert(pS2.sector === 2, `M8: Punto al 35% corresponde a Sector 2 con límite 0.20 (obtenido: ${pS2.sector})`);
      assert(pS3.sector === 3, `M8: Punto al 75% corresponde a Sector 3 con límite 0.60 (obtenido: ${pS3.sector})`);

      const incidentS2 = IncidentModel.registerIncident({
        id: 1, driver: { code: 'VER' }, trackT: 0.30, dnfReason: 'Engine'
      }, 'dnf', { sector1EndT: 0.28, sector2EndT: 0.56 });
      assert(incidentS2.sector === 2, `M8: IncidentModel asigna Sector 2 para trackT 0.30 usando límites del circuito (obtenido: ${incidentS2.sector})`);
    }

}
