// CA6 — Que la parada influya y se entienda (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. Cada parada guarda su tiempo, la media de la carrera y el motivo si fue lenta (rueda atascada o error del equipo),
//     y todo sale de los mecánicos y su estado.
//  2. Misma semilla, mismos tiempos; un equipo mejor tiene media más baja y uno con más errores más paradas lentas
//     (solo lo que no cubre `pit-crew-t46`: aquí, que el motivo sale de la misma tirada que el tiempo).
//  3. La interfaz muestra el tiempo de la parada, la diferencia con la media y el motivo.
//  4. `pit-stop`, `pit-crew-t46` y `box-orders` siguen en verde (se ejecutan aparte).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const crewMod = await server.ssrLoadModule('/src/simulation/PitCrew.ts');

  await test('CA6: el motivo sale de la misma tirada que el tiempo', () => {
    const crews = [undefined, { timeFactor: 0.9, errorFactor: 0.6 }, { timeFactor: 1.05, errorFactor: 1.8 }];
    const bad = [];
    for (const crew of crews) for (let i = 0; i < 400; i++) {
      const roll = i / 400, spread = ((i * 37) % 100) / 100;
      const out = typeof PitStopModel.serviceOutcome === 'function' ? PitStopModel.serviceOutcome(roll, spread, crew) : null;
      if (!out) { bad.push('sin serviceOutcome'); break; }
      if (out.seconds !== PitStopModel.serviceTime(roll, spread, crew)) bad.push(`tiempo distinto (${roll})`);
      const slow = out.cause === 'error' || out.cause === 'rueda-atascada';
      // Lenta (error o rueda atascada) siempre 3 s o más; rápida o normal, como mucho (2,2 + 0,8) s por el factor de tiempo de los mecánicos.
      if (slow ? out.seconds < 3 : out.seconds > 3 * (crew?.timeFactor ?? 1) + 1e-9) bad.push(`motivo ${out.cause} con ${out.seconds} s`);
      if (out.cause === 'rueda-atascada' && !(out.wheel >= 0 && out.wheel <= 3)) bad.push('rueda atascada sin rueda');
      if (!['rapida', 'normal', 'error', 'rueda-atascada'].includes(out.cause)) bad.push(`motivo desconocido ${out.cause}`);
    }
    const causes = new Set(Array.from({ length: 400 }, (_, i) => PitStopModel.serviceOutcome?.(i / 400, .5)?.cause));
    assert(bad.length === 0 && causes.size === 4, 'CA6: tiempo idéntico al de siempre y motivo de esa tirada (rápida, normal, error del equipo, rueda atascada)', bad.slice(0, 6).join(' | ') || [...causes].join(','));
  });

  const race = (seed) => {
    const original = Math.random; Math.random = seeded(seed);
    try {
      const sim = make('barcelona', 3);
      sim.cars.forEach((car, i) => { car.pitStop.crew = [undefined, { timeFactor: 0.9, errorFactor: 0.6 }, { timeFactor: 1.05, errorFactor: 1.8 }][i]; });
      let steps = 0;
      const done = () => sim.cars.every(c => (c.pitStop.stopLog ?? []).filter(s => s.totalSec > 0).length >= 2);
      while (!done() && steps++ < 60000) {
        for (const c of sim.cars) if (!c.pitStop.isPitting && !c.isInPitLane && c.pitStop.scheduledLap === 0) c.pitStop.scheduledLap = c.currentLap;
        sim.update(0.05);
      }
      return sim.cars.map(c => (c.pitStop.stopLog ?? []).filter(s => s.totalSec > 0));
    } finally { Math.random = original; }
  };

  await test('CA6: cada parada guarda tiempo, media, motivo y mecánicos', () => {
    const logs = race(7), all = logs.flat(), bad = [];
    const crews = [undefined, { timeFactor: 0.9, errorFactor: 0.6 }, { timeFactor: 1.05, errorFactor: 1.8 }];
    if (logs.some(l => l.length < 2)) bad.push(`paradas: ${logs.map(l => l.length).join('/')}`);
    logs.forEach((list, i) => list.forEach(s => {
      if (!['rapida', 'normal', 'error', 'rueda-atascada'].includes(s.cause)) bad.push(`coche ${i}: sin motivo`);
      if (typeof s.averageSec !== 'number') bad.push(`coche ${i}: sin media`);
      const c = crews[i] ?? { timeFactor: 1, errorFactor: 1 };
      if (!s.crew || Math.abs(s.crew.timeFactor - c.timeFactor) > 1e-9 || Math.abs(s.crew.errorFactor - c.errorFactor) > 1e-9) bad.push(`coche ${i}: mecánicos ${JSON.stringify(s.crew)}`);
      if ((s.cause === 'error' || s.cause === 'rueda-atascada') && s.serviceSec < 3) bad.push(`coche ${i}: ${s.cause} con ${s.serviceSec}`);
    }));
    // La media de cada parada es la del servicio de todas las paradas de la carrera hasta ella (incluida).
    const byTime = [...all].sort((a, b) => a.order - b.order);
    byTime.forEach((s, k) => {
      const prev = byTime.slice(0, k + 1), mean = prev.reduce((t, x) => t + x.serviceSec, 0) / prev.length;
      if (Math.abs(s.averageSec - mean) > 0.011) bad.push(`media ${s.averageSec} ≠ ${mean.toFixed(2)}`);
    });
    assert(bad.length === 0, 'CA6: cada parada guarda tiempo, media de la carrera hasta ella, motivo y efecto de los mecánicos', bad.slice(0, 8).join(' | '));
  });

  await test('CA6: misma semilla, mismas paradas', () => {
    const a = JSON.stringify(race(11)), b = JSON.stringify(race(11));
    assert(a === b, 'CA6: dos carreras con la misma semilla dan las mismas paradas y motivos');
  });

  await test('CA6: la interfaz lo enseña', async () => {
    const mod = await server.ssrLoadModule('/src/components/PitStopSummary.tsx').catch(() => ({}));
    const html = (log) => mod.PitStopSummary ? renderToStaticMarkup(createElement(mod.PitStopSummary, { log })) : '';
    const base = { lap: 20, setId: null, compound: 'hard', totalSec: 22, transitSec: 18, queueSec: 0, releaseHoldSec: 0 };
    const slow = html({ ...base, serviceSec: 5.4, averageSec: 2.6, cause: 'rueda-atascada', wheel: 2, crew: { timeFactor: 1, errorFactor: 1 } });
    const fast = html({ ...base, serviceSec: 2.1, averageSec: 2.6, cause: 'rapida', crew: { timeFactor: 1, errorFactor: 1 } });
    assert(/5,4\s*s/.test(slow) && /\+2,8\s*s/.test(slow) && /media/i.test(slow) && /rueda atascada/i.test(slow) && /trasera izquierda/i.test(slow),
      'CA6: parada lenta: tiempo, diferencia con la media y motivo (con la rueda)', slow.replace(/<[^>]+>/g, ' ').slice(0, 200));
    assert(/2,1\s*s/.test(fast) && /−0,5\s*s/.test(fast) && !/atascada|error/i.test(fast),
      'CA6: parada buena: tiempo y diferencia, sin motivo de lentitud', fast.replace(/<[^>]+>/g, ' ').slice(0, 200));
    const box = await server.ssrLoadModule('/src/components/BoxControls.tsx');
    const src = String(box.BoxControls);
    assert(/PitStopSummary/.test(src), 'CA6: el panel de boxes de cada coche muestra su última parada');
  });
}
