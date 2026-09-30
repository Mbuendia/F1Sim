import fs from 'fs';
const file = 'src/simulation/RaceSimulation.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `  issueBoxOrder(carId: number, compound: TireCompound): BoxOrder | null {`;

const replacement = `  issuePaceOrder(carId: number, paceMode: 'push' | 'balanced' | 'save'): boolean {
    const car = this.cars.find(c => c.id === carId);
    if (!car) return false;
    car.paceMode = paceMode;
    return true;
  }

  issueBoxOrder(carId: number, compound: TireCompound): BoxOrder | null {`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
