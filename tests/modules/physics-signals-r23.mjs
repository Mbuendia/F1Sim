// R23 — Dibujos que explican la física (contrato reducido aprobado por el usuario el 08/10/2026: casi todo lo que
// pedía la tarea lo cubrieron R04, R43, R46 y R56).
//  1. Cada señal del coche en pista (flap, luz trasera, barra del Safety Car, marcas de DRS) coincide con el estado
//     del motor y respeta el nivel de detalle según el zoom, en Barcelona y Mónaco.
//  2. Las señales se distinguen sin depender solo de rojo y verde: forma o rótulo además del color, y contraste
//     mínimo sobre el asfalto.
//  3. Coste de dibujo medido y acotado con 20 coches, en seco y con lluvia, a tres zooms.
//  4. Revisión en el navegador (manual; en el dashboard).
// Fuera: daños y contacto con el suelo (el motor no los modela).
export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
  const { WeatherRenderer, weatherLayers } = await server.ssrLoadModule('/src/renderer/WeatherRenderer.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
  const { OVERVIEW_ZOOM } = await server.ssrLoadModule('/src/renderer/CarLabels.ts');
  const signals = await server.ssrLoadModule('/src/renderer/signals.ts');
  const sprites = await server.ssrLoadModule('/src/renderer/carSprites.ts');
  const { rearLight, safetyCarLightOn } = await server.ssrLoadModule('/src/renderer/carDetail.ts');
  const { drsMarkers } = await server.ssrLoadModule('/src/renderer/drsMarkers.ts');
  const { buildWeatherScenario } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const { SIGNALS, ASPHALT, DRS_SLOT_COLOR } = signals;

  /** Lienzo de prueba: anota cada operación con el color y la opacidad vigentes; `ops` cuenta todas las llamadas. */
  function recorder() {
    const calls = [], state = { fillStyle: '', strokeStyle: '', globalAlpha: 1, shadowBlur: 0 }, states = [];
    let ops = 0, dashed = false;
    const gradient = { addColorStop() {} };
    const target = {
      save: () => { ops++; states.push({ ...state, dashed }); },
      restore: () => { ops++; const previous = states.pop(); if (previous) { dashed = previous.dashed; delete previous.dashed; Object.assign(state, previous); } },
      measureText: text => ({ width: String(text).length * 6 }),
      createLinearGradient: () => gradient, createRadialGradient: () => gradient, createPattern: () => null,
      setLineDash: pattern => { ops++; dashed = pattern.length > 0; },
    };
    const ctx = new Proxy(target, {
      get: (object, key) => (key in state ? state[key] : object[key] ?? ((...args) => { ops++; calls.push({ op: key, args, dashed, ...state }); })),
      set: (_, key, value) => { state[key] = value; return true; },
    });
    return { ctx, calls, get ops() { return ops; } };
  }
  const wide = zoom => ({ zoom, rotation: 0, screenWidth: 20000, screenHeight: 20000, worldToScreen: (x, y) => ({ x: x * zoom + 10000, y: y * zoom + 10000 }) });
  const filled = (rec, color) => rec.calls.filter(call => ['fillRect', 'roundRect', 'fill'].includes(call.op) && call.fillStyle === color);
  const racing = circuit => {
    const sim = new RaceSimulation(circuit);
    sim.lightState = 'racing'; sim.isPaused = false;
    for (let i = 0; i < 40; i++) sim.update(0.05);
    for (const car of sim.cars) { car.drsActive = false; car.drsChangedAt = undefined; car.telemetry = { ...car.telemetry, brake: 0 }; }
    return sim;
  };
  const paint = (sim, zoom, { wetMm = 0, timeSec = 5, safetyCar = null } = {}) => {
    const rec = recorder();
    CarRenderer.renderCars(rec.ctx, sim.cars, wide(zoom), null, sim.activeTrack, 3, safetyCar, { depthAt: () => wetMm, timeSec });
    return rec;
  };

  await test('R23: las señales coinciden con el motor y respetan el nivel de detalle', () => {
    const original = Math.random;
    Math.random = () => 0.5;
    try {
      for (const circuit of ['barcelona', 'monaco']) {
        const sim = racing(circuit);
        const near = 3, far = OVERVIEW_ZOOM * 0.8;
        assert(filled(paint(sim, near), SIGNALS.drsOpen.color).length === 0 && filled(paint(sim, near), SIGNALS.rearLight.color).length === 0, `R23 ${circuit}: sin DRS abierto ni frenada, no se pinta ninguna señal`);

        sim.cars[3].drsActive = true;
        sim.cars[5].telemetry = { ...sim.cars[5].telemetry, brake: 80 };
        const close = paint(sim, near);
        assert(filled(close, SIGNALS.drsOpen.color).length > 0 && filled(close, DRS_SLOT_COLOR).length === 1, `R23 ${circuit}: el coche con el DRS abierto, y solo ese, lleva el alerón abierto con su ranura`);
        assert(filled(close, SIGNALS.rearLight.color).length === 1, `R23 ${circuit}: el coche que frena, y solo ese, enciende la luz trasera`);
        const overview = paint(sim, far);
        assert(filled(overview, SIGNALS.drsOpen.color).length === 0 && filled(overview, SIGNALS.rearLight.color).length === 0 && overview.calls.filter(call => call.op === 'arc').length >= sim.cars.length,
          `R23 ${circuit}: de lejos los coches son puntos y no llevan señales`);

        // Con agua, la luz trasera de todos parpadea como dice el motor de detalle.
        const running = sim.cars.filter(car => car.status === 'running').length;
        for (const timeSec of [0, 0.13, 0.26, 0.4]) {
          const lit = rearLight({ wetMm: 1, braking: false, timeSec }).lit;
          assert(filled(paint(sim, near, { wetMm: 1, timeSec }), SIGNALS.rearLight.color).length === (lit ? running : 0), `R23 ${circuit}: luz de lluvia ${lit ? 'encendida' : 'apagada'} en t = ${timeSec} s`);
        }

        // Safety Car: su barra alterna los dos colores con el reloj, a cualquier zoom.
        const safetyCar = { ...sim.safetyCar, isDeployed: true, mode: 'leading', progress: sim.cars[0].progress + 0.01, isInPitLane: false };
        for (const zoom of [far, near]) {
          const expected = safetyCarLightOn(performance.now()) ? SIGNALS.safetyCarLights.color : SIGNALS.safetyCarLights.alternate;
          const rec = paint(sim, zoom, { safetyCar });
          const bar = rec.calls.filter(call => call.op === 'fillRect' && call.shadowBlur > 0 && [SIGNALS.safetyCarLights.color, SIGNALS.safetyCarLights.alternate].includes(call.fillStyle));
          const now = safetyCarLightOn(performance.now()) ? SIGNALS.safetyCarLights.color : SIGNALS.safetyCarLights.alternate;
          assert(bar.length === 1 && [expected, now].includes(bar[0].fillStyle) && rec.calls.some(call => call.op === 'fillText' && /SAFETY CAR/.test(call.args[0])),
            `R23 ${circuit}: barra de luces y rótulo del Safety Car a zoom ${zoom.toFixed(2)}`);
        }

        // Marcas de DRS: una línea continua por zona y una discontinua por detección, con rótulo.
        const marks = recorder();
        TrackRenderer.renderDrsMarkers(marks.ctx, sim.activeTrack, wide(1));
        const data = drsMarkers(sim.activeTrack), strokes = marks.calls.filter(call => call.op === 'stroke');
        assert(strokes.filter(call => call.strokeStyle === SIGNALS.drsZone.color && !call.dashed).length === data.zones.length && data.zones.length >= 1, `R23 ${circuit}: una línea continua por zona de DRS`);
        assert(strokes.filter(call => call.strokeStyle === SIGNALS.drsDetection.color && call.dashed).length === data.detections.length && data.detections.length >= 1, `R23 ${circuit}: una línea discontinua por punto de detección`);
        const labels = marks.calls.filter(call => call.op === 'fillText').map(call => call.args[0]);
        assert(labels.filter(text => text.startsWith(`${SIGNALS.drsZone.label} `)).length === data.zones.length && labels.filter(text => text.startsWith(SIGNALS.drsDetection.label)).length === data.detections.length,
          `R23 ${circuit}: cada marca lleva su rótulo`, labels.join(' | '));
      }

      // El coche pintado con la imagen de su modelo lleva las mismas señales.
      const sim = racing('barcelona');
      const car = sim.cars[2];
      sprites.clearTrackSprites();
      sprites.setCarSprite(sprites.carSpriteKey(car), { levels: [{ width: 384, height: 140 }], lengthM: 5.5, widthM: 2, wheels: [], tyre: { lengthM: 0.72, widthM: 0.36 }, rearWing: { x0: -2.45, x1: -2, halfWidth: 0.55 } });
      car.drsActive = true;
      const rec = paint(sim, 3);
      assert(rec.calls.filter(call => call.op === 'drawImage').length === 1 && filled(rec, SIGNALS.drsOpen.color).length === 1 && filled(rec, DRS_SLOT_COLOR).length === 1, 'R23: con la imagen del modelo, el DRS abierto se pinta igual (verde y ranura)');
    } finally { Math.random = original; sprites.clearTrackSprites(); }
  });

  await test('R23: señales legibles sin depender solo de rojo y verde', () => {
    const list = Object.values(SIGNALS);
    assert(list.length === 5 && new Set(list.map(signal => signal.id)).size === 5, 'R23: cinco señales en la tabla');
    assert(new Set(list.map(signal => signal.shape)).size === list.length && list.every(signal => signal.shape.length > 10 && signal.label.length > 0), 'R23: cada señal tiene una forma propia y un nombre, además del color');
    for (const signal of list) {
      for (const [surface, asphalt] of Object.entries(ASPHALT)) {
        for (const color of [signal.color, signal.alternate].filter(Boolean)) {
          const ratio = signals.contrastRatio(color, asphalt);
          assert(ratio >= signals.MIN_SIGNAL_CONTRAST, `R23: ${signal.label} (${color}) contrasta con el asfalto ${surface === 'dry' ? 'seco' : 'mojado'}`, ratio.toFixed(2));
        }
      }
    }
    assert(Math.abs(signals.contrastRatio('#ffffff', '#000000') - 21) < 1e-9 && signals.contrastRatio('#777777', '#777777') === 1, 'R23: el contraste se calcula como en WCAG (21 entre blanco y negro)');
    // Las dos señales que comparten verde (flap abierto y zona de DRS) y las dos rojizas no se confunden por la forma.
    assert(/ranura/.test(SIGNALS.drsOpen.shape) && /rótulo/.test(SIGNALS.drsZone.shape) && /discontinua/.test(SIGNALS.drsDetection.shape) && /halo/.test(SIGNALS.rearLight.shape) && /parpadea/.test(SIGNALS.safetyCarLights.shape),
      'R23: ranura en el flap, rótulo en la zona, línea discontinua en la detección, halo en la luz y parpadeo en el Safety Car');
    assert(signals.contrastRatio(SIGNALS.drsOpen.color, DRS_SLOT_COLOR) >= signals.MIN_SIGNAL_CONTRAST, 'R23: la ranura del flap se ve sobre el verde');
    assert(SIGNALS.drsOpen.minZoom === OVERVIEW_ZOOM && SIGNALS.rearLight.minZoom === OVERVIEW_ZOOM && SIGNALS.drsZone.minZoom === 0 && SIGNALS.safetyCarLights.minZoom === 0,
      'R23: las señales del coche aparecen al dejar de ser un punto; las de la pista y el Safety Car, siempre');
  });

  await test('R23: coste de dibujo medido y acotado con 20 coches', () => {
    const original = Math.random;
    Math.random = () => 0.5;
    try {
      // Operaciones de lienzo por fotograma, medidas el 08/10/2026 (pista ≈ 12 900-13 400; lluvia ≈ 1 000; coches ≈ 160
      // de lejos y ≈ 1 470 con los 20 en detalle). Los límites dejan un 15 % de margen.
      const LIMIT = { track: 15500, weather: 1200, carsFar: 12, carsNear: 85, frame: 18000 };
      const report = [];
      for (const circuit of ['barcelona', 'monaco']) {
        for (const wet of [false, true]) {
          const sim = new RaceSimulation(circuit);
          sim.lightState = 'racing'; sim.isPaused = false;
          if (wet) {
            sim.setWeatherScenario(buildWeatherScenario('mojado-inicial', 3000));
            for (let i = 0; i < 6000 && !(sim.weatherModel.meanDepth() > 0.5); i++) sim.update(0.05);
          } else for (let i = 0; i < 100; i++) sim.update(0.05);
          assert(sim.cars.length === 20 && (sim.weatherModel.meanDepth() > 0.5) === wet, `R23 (preparación): ${circuit} ${wet ? 'mojado' : 'seco'} con 20 coches`);
          const costs = {};
          for (const zoom of [0.4, 1.5, 4]) {
            const camera = new Camera();
            camera.resize(1280, 720, sim.activeTrack);
            Object.assign(camera, { zoom, x: sim.cars[0].worldX, y: sim.cars[0].worldY });
            let rec = recorder();
            TrackRenderer.renderTrack(rec.ctx, sim.activeTrack, camera, 1, sim.weather, circuit);
            TrackRenderer.renderDrsMarkers(rec.ctx, sim.activeTrack, camera);
            const track = rec.ops;
            rec = recorder();
            const view = weatherLayers(sim.weatherModel, sim.raceTimeSec);
            WeatherRenderer.render(rec.ctx, sim.activeTrack, camera, view, sim.raceTimeSec);
            if (view) WeatherRenderer.renderSpray(rec.ctx, sim.cars, camera, t => sim.weatherModel.depthAt(t));
            const weather = rec.ops;
            rec = recorder();
            CarRenderer.renderCars(rec.ctx, sim.cars, wide(zoom), sim.cars[0].id, sim.activeTrack, 3, null, { depthAt: t => sim.weatherModel.depthAt(t), timeSec: sim.raceTimeSec });
            costs[zoom] = { track, weather, cars: rec.ops };
            const label = `${circuit} ${wet ? 'mojado' : 'seco'} zoom ${zoom}`;
            assert(track <= LIMIT.track, `R23: pista dentro del límite (${label})`, String(track));
            assert(weather <= (wet ? LIMIT.weather : 0), `R23: lluvia dentro del límite (${label})`, String(weather));
            assert(rec.ops <= sim.cars.length * (zoom <= OVERVIEW_ZOOM ? LIMIT.carsFar : LIMIT.carsNear), `R23: 20 coches dentro del límite (${label})`, String(rec.ops));
            assert(track + weather + rec.ops <= LIMIT.frame, `R23: fotograma completo dentro del límite (${label})`, String(track + weather + rec.ops));
          }
          assert(costs[0.4].cars < costs[1.5].cars / 4, `R23: de lejos los coches cuestan mucho menos que en detalle (${circuit})`, `${costs[0.4].cars} / ${costs[1.5].cars}`);
          report.push(`${circuit} ${wet ? 'mojado' : 'seco'}: ${Object.entries(costs).map(([zoom, c]) => `z${zoom} ${c.track}+${c.weather}+${c.cars}`).join(', ')}`);
        }
      }
      assert(report.length === 4, 'R23: coste medido en Barcelona y Mónaco, en seco y con lluvia, a tres zooms', report.join(' | '));
    } finally { Math.random = original; }
  });
}
