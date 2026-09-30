import fs from 'fs';
const file = 'src/simulation/RaceSimulation.ts';
let content = fs.readFileSync(file, 'utf8');

// fix init paceMode
content = content.replace(
  '        raceDayLuckFactor,\r\n\r\n        tires: initialTires,',
  '        raceDayLuckFactor,\r\n\r\n        paceMode: \'balanced\',\r\n\r\n        tires: initialTires,'
);

// fix logic
const oldLogic = `      const carAhead = car.carAheadId !== null ? this.getCarById(car.carAheadId) : null;
      if (carAhead && carAhead.pitStop.isPitting && !car.pitStop.isPitting) {
        car.engineMode = 'push';
        car.aggression = 'aggressive';
      } else if (car.engineMode === 'push' && (!carAhead || !carAhead.pitStop.isPitting)) {
        car.engineMode = 'standard';
        car.aggression = 'balanced';
      }`;

const newLogic = `      const carAhead = car.carAheadId !== null ? this.getCarById(car.carAheadId) : null;

      let effectiveEngineMode = 'standard';
      let effectiveAggression = 'balanced';

      switch (car.paceMode) {
        case 'save':
          effectiveEngineMode = 'low';
          effectiveAggression = 'safe';
          break;
        case 'balanced':
        default:
          effectiveEngineMode = 'standard';
          effectiveAggression = 'balanced';
          break;
        case 'push':
          effectiveEngineMode = 'push';
          effectiveAggression = 'aggressive';
          break;
      }

      if (carAhead && carAhead.pitStop.isPitting && !car.pitStop.isPitting) {
        effectiveEngineMode = 'push';
        effectiveAggression = 'aggressive';
      }

      if (this.raceFlagState === 'sc' || this.vscActive) {
        effectiveEngineMode = 'low';
        effectiveAggression = 'safe';
      }

      car.engineMode = effectiveEngineMode as any;
      car.aggression = effectiveAggression as any;`;

content = content.replace(oldLogic.replace(/\n/g, '\r\n'), newLogic.replace(/\n/g, '\r\n'));

fs.writeFileSync(file, content);
