// [R55] Último paso tras exportar los modelos desde Blender: une las animaciones de las cuatro ruedas en un solo clip
// y deja en el propio archivo la atribución del autor original y los cambios hechos. Se puede repetir sin efectos.
// Uso: node scripts/finalize-models.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODELS = [
  // [CA2, 07/11/2026] El coche de 2025 sustituye al de 2026 (guardado en assets/epoca-2026/).
  {
    file: '../public/models/f1-car.glb',
    clip: 'WheelSpin',
    extras: {
      title: '2025 F1 CAR',
      author: 'Abu Saif (https://sketchfab.com/abuhossain844)',
      license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
      source: 'https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898',
      changes: 'Modificado para F1Sim: reducido de 3,1 millones a unos 94 000 triángulos, girado con el morro hacia +X y escalado a 5,7 m, sin luces LED; ruedas separadas con animación de giro, zonas de pintura por material (principal, secundaria y carbono), banda del compuesto y superficies para dorsal y patrocinadores.',
    },
  },
  {
    file: '../public/models/f1-car-lod.glb',
    clip: 'WheelSpin',
    extras: {
      title: '2025 F1 CAR',
      author: 'Abu Saif (https://sketchfab.com/abuhossain844)',
      license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
      source: 'https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898',
      changes: 'Versión lejana para F1Sim: unos 9 000 triángulos con las mismas zonas de pintura, banda del compuesto y superficies de rótulos.',
    },
  },
  {
    file: '../public/models/f1-car-piezas.glb',
    clip: 'WheelSpin',
    extras: {
      title: '2025 F1 CAR',
      author: 'Abu Saif (https://sketchfab.com/abuhossain844)',
      license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
      source: 'https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898',
      changes: 'Versión por piezas para el centro de temporada de F1Sim: ala_delantera, ala_trasera, suelo, pontones, tapa_motor y chasis, con las ruedas bajo ruedas y sin rótulos.',
    },
  },
  {
    file: '../public/models/safety-car.glb',
    clip: 'WheelSpin',
    extras: {
      title: '2019 Mercedes-Benz AMG GTR Safety Car',
      author: 'OUTPISTON (https://sketchfab.com/outpiston)',
      license: 'CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/)',
      source: 'https://sketchfab.com/3d-models/2019-mercedes-benz-amg-gtr-safety-car-5bfaf6b31d084dde80dae723b52998bc',
      changes: 'Modificado para F1Sim: sin texturas ni emblemas de marcas, materiales planos, ruedas y barra de luces como piezas aparte con animación de giro y superficies para rótulos. Esta versión se distribuye con la misma licencia CC BY-NC-SA 4.0.',
    },
  },
  // [CR3, 07/11/2026] Piezas del kit sacadas del modelo de Montreal.
  ...['guardarrail', 'valla_alta', 'pianos', 'muro_neumaticos', 'grava', 'escapatoria', 'grada_comun', 'arbol_a', 'arbol_b', 'arbol_c', 'marcas_suelo'].map(id => ({
    file: `../public/models/kit/${id}.glb`,
    extras: {
      title: 'Circuit Gilles Villeneuve Montreal 2019 layout',
      author: 'Dave Love (https://sketchfab.com/Tyler_Dave)',
      license: 'CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)',
      source: 'https://sketchfab.com/3d-models/circuit-gilles-villeneuve-montreal-2019-layout-5875d33d5ddb44f4a6c1188ed6776fa8',
      changes: 'F1Sim: pieza recortada, en metros, aligerada; textura de 512 px como mucho y sin marcas.',
    },
  })),
];

for (const model of MODELS) {
  const path = fileURLToPath(new URL(model.file, import.meta.url));
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  const rest = buffer.subarray(20 + jsonLength);          // bloque binario, sin tocar
  if (json.animations?.length) {
    const merged = { name: model.clip, channels: [], samplers: [] };
    for (const animation of json.animations) {
      const offset = merged.samplers.length;
      merged.samplers.push(...animation.samplers);
      merged.channels.push(...animation.channels.map(channel => ({ ...channel, sampler: channel.sampler + offset })));
    }
    json.animations = [merged];
  }
  json.asset = { ...json.asset, extras: model.extras };
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4) text += ' ';
  const jsonChunk = Buffer.from(text);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);                     // «glTF»
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + jsonChunk.length + rest.length, 8);
  header.writeUInt32LE(jsonChunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);                    // «JSON»
  writeFileSync(path, Buffer.concat([header, jsonChunk, rest]));
  console.log(`${model.file}: ${(buffer.length / 1e6).toFixed(2)} MB · clip «${model.clip}» con ${json.animations?.[0]?.channels.length ?? 0} canales`);
}
