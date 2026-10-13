// [V8] Carrera simulada sin verla: el mismo motor, con el estratega al mando de los coches del jugador y sin esperar a
// nadie (salida, tiradas de suerte). No decide resultados: solo hace avanzar `RaceSimulation` hasta la bandera a cuadros.
import type { RaceSimulation } from './RaceSimulation';

export const AUTO_RACE = {
  /** Tiempo real que se le pasa al motor en cada llamada (s) y velocidad a la que corre. */
  FRAME_SEC: 0.1,
  SPEED: 32,
  /** Paso fijo del motor mientras se simula (s): el mayor que admite, porque aquí no hay nada que pintar entre pasos. */
  STEP_SEC: 0.05,
  /** Tope de llamadas: una carrera que no acaba (no debería pasar) no deja la página colgada. */
  MAX_FRAMES: 60000,
};

/** La carrera ha terminado y hay podio que anotar. */
export const autoRaceDone = (simulation: RaceSimulation): boolean => simulation.isFinished && simulation.podiumCars.length >= 3;

/** Deja la carrera lista para correr sola: los coches del jugador, delegados en el estratega, y la salida en marcha. */
export function startAutoRace(simulation: RaceSimulation, playerCarIds: number[]): void {
  simulation.setFixedStep(AUTO_RACE.STEP_SEC);
  for (const id of playerCarIds) simulation.setWallDelegation(id, true);
  if (simulation.lightState === 'idle') simulation.startRaceSequence();
  simulation.setSpeed(AUTO_RACE.SPEED);
}

/**
 * Hace avanzar la carrera hasta que acabe o se agote el presupuesto (`budgetMs` de tiempo real o `maxFrames` llamadas).
 * Devuelve true si la carrera ha terminado. Las tiradas de suerte se aplican solas y la salida no espera confirmación.
 */
export function advanceAutoRace(simulation: RaceSimulation, budgetMs: number, maxFrames = AUTO_RACE.MAX_FRAMES, now: () => number = () => performance.now()): boolean {
  const start = now();
  for (let frame = 0; frame < maxFrames && !autoRaceDone(simulation) && now() - start < budgetMs; frame++) {
    if (simulation.lightState === 'grid-ready') simulation.confirmRaceStart();
    // Apagado el semáforo, la carrera en directo espera 0,6 s de reloj real; aquí no hay nadie mirando.
    if (simulation.lightState === 'lights-out') simulation.lightState = 'racing';
    const luck = simulation.activeLuckEvent;
    if (luck) { simulation.applyLuckEventReward(luck.id); simulation.activeLuckEvent = null; }
    if (simulation.isPaused || simulation.speedMultiplier !== AUTO_RACE.SPEED) simulation.setSpeed(AUTO_RACE.SPEED);
    simulation.update(AUTO_RACE.FRAME_SEC);
  }
  return autoRaceDone(simulation);
}
