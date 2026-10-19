// [N3] Ayuda de los tests de interfaz: monta el muro (BoxControls) con las vistas del motor en lugar del objeto del
// motor, igual que lo hace la aplicación desde N3. Las órdenes se aplican al momento sobre la misma carrera.
export async function viewsFactory(server) {
  const { EngineHost } = await server.ssrLoadModule('/src/engine/EngineHost.ts');
  /** Props del muro para `car` (y su compañero en `teamCars`) leyendo la carrera `sim` a través de las vistas. */
  return (sim, car, teamCars) => {
    const host = new EngineHost(sim);
    const team = host.teamView(car.team.id);
    const race = { lightState: sim.lightState, isFinished: sim.isFinished, raceFlagState: sim.raceFlagState };
    const send = order => Promise.resolve(host.handle({ type: 'order', seq: 0, order })[0]);
    return teamCars ? { car, teamCars, team, race, send } : { car, team, race, send };
  };
}
