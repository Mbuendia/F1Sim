import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { generatePitLanePoints } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
    console.log('\n--- TEST GROUP 8: Bloque A — Escala, Geometría y Cinemática Espacial (Q1, Q2) ---');

    // Q1: Calibración de Escala de Monoplaza y Anchura Real de Pista (Anti-Solapamiento)
    {
      const trackWidthM = 24;
      const capacityWide = 3;
      const dispOvertakeRight = CarRenderer.getLateralDisplacement(0.55, trackWidthM, capacityWide);
      const dispOvertakeLeft = CarRenderer.getLateralDisplacement(-0.55, trackWidthM, capacityWide);

      // Medir la huella completa en unidades del mundo a zoom 1.
      const footprintWidth = CarRenderer.getCarDimensions(1, trackWidthM, capacityWide).footprintWidth;
      const marginRatio = Math.abs(dispOvertakeRight) / footprintWidth;
      assert(marginRatio >= 1.2, `Q1: Separación del coche centrado supera 1.2 veces la huella completa (obtenido: ${marginRatio.toFixed(2)}x)`);

      // Verificación estricta de no-intersección de bounding boxes en todos los niveles de zoom estándar
      const testZooms = [0.5, 1.0, 1.8, 2.75, 4.5];
      let allZoomsDisjoint = true;
      let minGap = Infinity;

      for (const z of testZooms) {
        const dims = CarRenderer.getCarDimensions(z);
        const boxRightMin = dispOvertakeRight * z - dims.footprintWidth / 2;
        const boxLeftMax = dispOvertakeLeft * z + dims.footprintWidth / 2;

        const gap = boxRightMin - boxLeftMax;
        if (gap <= 0) {
          allZoomsDisjoint = false;
        }
        if (gap < minGap) minGap = gap;
      }
      assert(allZoomsDisjoint, `Q1: Huellas transversales disjuntas en zoom 0.5–4.5 (gap mínimo: +${minGap.toFixed(1)}px)`);

      // Verificación en circuito estrecho (capacidad 2 coches, 16m)
      const dispNarrowRight = CarRenderer.getLateralDisplacement(0.55, 16, 2);
      const dispNarrowLeft = CarRenderer.getLateralDisplacement(-0.55, 16, 2);
      const narrowSep = Math.abs(dispNarrowRight - dispNarrowLeft);
      const narrowWidth = CarRenderer.getCarDimensions(1, 16, 2).footprintWidth;
      assert(narrowSep / narrowWidth >= 1.2, `Q1: Margen en pista estrecha sobre huella completa (obtenido: ${(narrowSep / narrowWidth).toFixed(2)}x)`);
    }

    // Q2: Carril de Boxes con Entrada/Salida Propias y Continuidad Física (C1 Tangencial)
    {
      // Crear spline de prueba sintético (circuito oval de 200 puntos)
      const testPoints = [];
      const numPts = 200;
      for (let i = 0; i < numPts; i++) {
        const angle = (i / numPts) * Math.PI * 2;
        const x = 500 + Math.cos(angle) * 300;
        const y = 400 + Math.sin(angle) * 200;
        const dx = -300 * Math.sin(angle);
        const dy = 200 * Math.cos(angle);
        const len = Math.hypot(dx, dy);
        testPoints.push({
          x,
          y,
          angle: Math.atan2(dy, dx),
          normal: { x: -dy / len, y: dx / len },
          distance: i * 10,
          curvature: 0.01,
          sector: 1,
          isDrsZone: false,
          isBrakingZone: false,
          speedLimitFactor: 1.0
        });
      }

      const pitEntryT = 0.90;
      const pitExitT = 0.10;
      const pitOffset = 38;
      const pitLanePoints = generatePitLanePoints(testPoints, pitEntryT, pitExitT, pitOffset);

      const entryIdx = Math.floor(numPts * pitEntryT);
      const exitIdx = Math.floor(numPts * pitExitT);
      const trackEntryPt = testPoints[entryIdx];
      const trackExitPt = testPoints[exitIdx];

      // Continuidad C0: la posición al inicio y al final coincide exactamente con la pista
      const distEntryC0 = Math.hypot(pitLanePoints[0].x - trackEntryPt.x, pitLanePoints[0].y - trackEntryPt.y);
      const distExitC0 = Math.hypot(pitLanePoints[pitLanePoints.length - 1].x - trackExitPt.x, pitLanePoints[pitLanePoints.length - 1].y - trackExitPt.y);

      assert(distEntryC0 < 0.001, `Q2: Continuidad C0 en entrada de boxes (desviación: ${distEntryC0.toFixed(4)} unidades del mundo)`);
      assert(distExitC0 < 0.001, `Q2: Continuidad C0 en salida de boxes (desviación: ${distExitC0.toFixed(4)} unidades del mundo)`);

      // Continuidad C1: el vector tangente en el empalme de entrada coincide con la pista
      const pitDxEntry = pitLanePoints[1].x - pitLanePoints[0].x;
      const pitDyEntry = pitLanePoints[1].y - pitLanePoints[0].y;
      const trkDxEntry = testPoints[(entryIdx + 1) % numPts].x - testPoints[entryIdx].x;
      const trkDyEntry = testPoints[(entryIdx + 1) % numPts].y - testPoints[entryIdx].y;
      const angleDiffEntry = Math.abs(Math.atan2(pitDyEntry, pitDxEntry) - Math.atan2(trkDyEntry, trkDxEntry));
      assert(angleDiffEntry < 0.05, `Q2: Continuidad C1 tangencial en entrada de boxes (diferencia angular: ${(angleDiffEntry * 180 / Math.PI).toFixed(2)}°)`);

      // Continuidad C1: el vector tangente en el empalme de salida coincide con la pista
      const pitDxExit = pitLanePoints[pitLanePoints.length - 1].x - pitLanePoints[pitLanePoints.length - 2].x;
      const pitDyExit = pitLanePoints[pitLanePoints.length - 1].y - pitLanePoints[pitLanePoints.length - 2].y;
      const trkDxExit = testPoints[exitIdx].x - testPoints[(exitIdx - 1 + numPts) % numPts].x;
      const trkDyExit = testPoints[exitIdx].y - testPoints[(exitIdx - 1 + numPts) % numPts].y;
      const angleDiffExit = Math.abs(Math.atan2(pitDyExit, pitDxExit) - Math.atan2(trkDyExit, trkDxExit));
      assert(angleDiffExit < 0.05, `Q2: Continuidad C1 tangencial en salida de boxes (diferencia angular: ${(angleDiffExit * 180 / Math.PI).toFixed(2)}°)`);

      // Zona central de garajes a ancho completo
      const midPitIdx = Math.floor(pitLanePoints.length * 0.5);
      const rawTrackPt = testPoints[Math.floor(numPts * 0.00)];
      const midDistFromTrack = Math.hypot(pitLanePoints[midPitIdx].x - rawTrackPt.x, pitLanePoints[midPitIdx].y - rawTrackPt.y);
      assert(Math.abs(midDistFromTrack - pitOffset) < 0.1, `Q2: Carril central de boxes mantiene separación nominal de ${pitOffset} unidades del mundo (obtenido: ${midDistFromTrack.toFixed(1)})`);
    }

}
