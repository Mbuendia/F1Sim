// [R55] Último paso tras exportar los modelos desde Blender: une las animaciones de las cuatro ruedas en un solo clip
// y deja en el propio archivo la atribución del autor original y los cambios hechos. Se puede repetir sin efectos.
// Uso: node scripts/finalize-models.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODELS = [
  {
    file: '../public/models/f1-car.glb',
    clip: 'WheelSpin',
    extras: {
      title: 'F1 2026 concept (polygon model)',
      author: 'Qvist_designs (https://sketchfab.com/Qvist_Designs)',
      license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
      source: 'https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42',
      changes: 'Modificado para F1Sim: reducido de 1,16 millones a unos 127 000 triángulos, ruedas separadas con animación de giro, zonas de pintura por material, banda del compuesto y superficies para dorsal y patrocinadores.',
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
