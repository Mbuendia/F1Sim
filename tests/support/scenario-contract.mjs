export async function scenarioContract({server,assert},circuit,task){
  const {getScenario}=await server.ssrLoadModule('/src/data/scenarioRegistry.ts');
  const {OFFICIAL_CIRCUITS}=await server.ssrLoadModule('/src/data/circuits.ts');
  const {buildTrackFromSvg}=await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
  const {buildScenarioGeometry}=await server.ssrLoadModule('/src/utils/scenarioGeometry.ts');
  const scenario=getScenario(circuit),fallback=getScenario('circuito-inexistente');
  assert(Boolean(OFFICIAL_CIRCUITS[circuit]),`${task}: circuito ${circuit} registrado`);
  assert(scenario!==fallback,`${task}: ${circuit} tiene escenario específico, no fallback`);
  const geometry=buildScenarioGeometry(buildTrackFromSvg(OFFICIAL_CIRCUITS[circuit]),scenario);
  assert(scenario.kerbs.length>0 && scenario.barriers.length>0 && geometry.kerbSegments.length>0 && geometry.barrierLines.length>0,
    `${task}: pianos y barreras propios generan geometría utilizable`);
}
