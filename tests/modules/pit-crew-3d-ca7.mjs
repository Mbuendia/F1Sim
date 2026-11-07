// CA7 — Mecánicos en el box (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. Un mecánico humano hecho en Blender (`public/models/mecanico.glb`): cuerpo con esqueleto (cabeza, torso, brazos,
//     manos y piernas), mono, casco con visera y guantes como materiales con nombre, entre 1,70 y 1,90 m, 4.000 triángulos
//     como mucho.
//  2. Animaciones realistas con nombre, con movimiento de piernas y brazos: correr, esperar agachado, pistola, quitar rueda,
//     poner rueda, levantar con el gato y sujetar el coche; el paso de correr dura entre 0,5 y 0,8 s.
//  3. Equipo completo por coche, como en la F1 real: gato delantero, gato trasero, tres por rueda (pistola, quita y pone) y
//     dos que sujetan el coche por los lados, cada uno en su puesto respecto al cajón.
//  4. Coreografía con la parada del motor (el guion de CA5): cuando el coche entra en el pit lane camino de su box, salen
//     corriendo del garaje a sus puestos y esperan; durante la parada, los gatos levantan y bajan el coche, las pistolas
//     trabajan en cada rueda, el que quita se lleva en brazos la rueda vieja (con su compuesto) y el que pone trae en brazos
//     la nueva; con una rueda atascada, su pistola sigue peleándose con ella el tiempo de más; al salir el coche vuelven
//     corriendo al garaje.
//  5. Mono y casco con los colores del equipo, sin marcas reales.
//  6. Rendimiento: solo hay mecánicos en el box de un coche que para o va a parar, el modelo pesa 60 KB como mucho y
//     `budget-pf8` sigue en verde (aparte).
//  7. Capturas de la llegada con la gente corriendo, del cambio de ruedas, de una rueda atascada y de la salida, para el
//     visto bueno del usuario (en `docs/design/ca7-mecanicos/`).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';

const MODEL = 'public/models/mecanico.glb';
const BONES = ['cadera', 'torso', 'cabeza', 'brazo_l', 'brazo_r', 'antebrazo_l', 'antebrazo_r', 'mano_l', 'mano_r', 'muslo_l', 'muslo_r', 'pierna_l', 'pierna_r'];
const MATERIALS = ['mono', 'mono_secundario', 'casco', 'visera', 'guantes'];
const CLIPS = ['correr', 'esperar', 'pistola', 'quitar_rueda', 'poner_rueda', 'gato', 'sujetar'];
const WHEELS = ['FL', 'FR', 'RL', 'RR'];

function readGlb(path) {
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}

export default async function run({ server, assert, test }) {
  const g = readGlb(MODEL);
  const crew = await server.ssrLoadModule('/src/scene3d/pitCrew3d.ts').catch(() => ({}));
  const anim = await server.ssrLoadModule('/src/scene3d/pitStopAnimation.ts');

  await test('CA7: un mecánico humano con esqueleto, mono, casco y guantes', () => {
    const bad = [];
    if (!g) bad.push(`falta ${MODEL}`);
    else {
      const names = g.nodes.map(n => n.name);
      const joints = new Set((g.skins ?? []).flatMap(s => s.joints.map(j => g.nodes[j].name)));
      const missing = BONES.filter(b => !joints.has(b));
      if (!g.skins?.length) bad.push('sin esqueleto (skin)');
      if (missing.length) bad.push(`faltan huesos ${missing.join(', ')}`);
      const mats = (g.materials ?? []).map(m => m.name);
      const mm = MATERIALS.filter(m => !mats.includes(m));
      if (mm.length) bad.push(`faltan materiales ${mm.join(', ')}`);
      let tris = 0, minY = Infinity, maxY = -Infinity, skinned = true;
      for (const mesh of g.meshes) for (const p of mesh.primitives) {
        tris += (p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count) / 3;
        const a = g.accessors[p.attributes.POSITION]; minY = Math.min(minY, a.min[1]); maxY = Math.max(maxY, a.max[1]);
        if (p.attributes.JOINTS_0 === undefined || p.attributes.WEIGHTS_0 === undefined) skinned = false;
      }
      if (!skinned) bad.push('mallas sin pesos de esqueleto');
      if (tris > 4000) bad.push(`${tris} triángulos`);
      const h = maxY - minY;
      if (h < 1.7 || h > 1.9) bad.push(`mide ${h.toFixed(2)} m`);
      if (statSync(MODEL).size > 60 * 1024) bad.push(`pesa ${Math.round(statSync(MODEL).size / 1024)} KB`);
      void names;
    }
    assert(bad.length === 0, 'CA7: mecanico.glb humano (1,70-1,90 m, ≤4.000 triángulos, ≤60 KB) con esqueleto, mono, casco con visera y guantes', bad.join(' | '));
  });

  await test('CA7: animaciones con piernas y brazos', () => {
    const bad = [];
    for (const name of CLIPS) {
      const a = (g?.animations ?? []).find(x => x.name === name);
      if (!a) { bad.push(`falta ${name}`); continue; }
      const bones = new Set(a.channels.filter(c => c.target.path === 'rotation').map(c => g.nodes[c.target.node].name));
      if (![...bones].some(b => /muslo|pierna/.test(b)) || ![...bones].some(b => /brazo/.test(b))) bad.push(`${name}: no mueve piernas y brazos`);
      if (name === 'correr') {
        const dur = Math.max(...a.samplers.map(s => g.accessors[s.input].max[0]));
        if (dur < 0.5 || dur > 0.8) bad.push(`correr: paso de ${dur.toFixed(2)} s`);
      }
    }
    assert(g && bad.length === 0, 'CA7: correr, esperar, pistola, quitar rueda, poner rueda, gato y sujetar, moviendo piernas y brazos; paso de correr de 0,5-0,8 s', bad.join(' | '));
  });

  await test('CA7: equipo completo, cada uno en su puesto', () => {
    const bad = [];
    const roles = crew.PIT_CREW_ROLES ?? [];
    const want = ['gato_delantero', 'gato_trasero', 'sujeta_izq', 'sujeta_der', ...WHEELS.flatMap(w => [`pistola_${w}`, `quita_${w}`, `pone_${w}`])];
    const missing = want.filter(r => !roles.includes(r));
    if (missing.length || roles.length !== want.length) bad.push(`roles: faltan ${missing.join(', ')} (${roles.length})`);
    const hub = { FL: [1.71, -0.77], FR: [1.71, 0.77], RL: [-1.71, -0.72], RR: [-1.71, 0.72] };
    for (const r of roles) {
      const s = crew.crewSlot?.(r);
      if (!s) { bad.push(`${r}: sin puesto`); continue; }
      const w = r.match(/_(FL|FR|RL|RR)$/)?.[1];
      if (w) {
        if (Math.hypot(s.x - hub[w][0], s.z - hub[w][1]) > 1.6) bad.push(`${r}: lejos de su rueda`);
        if (Math.abs(s.z) < 1.0) bad.push(`${r}: dentro del coche`);
      }
      if (r === 'gato_delantero' && !(s.x > 3.0 && Math.abs(s.z) < 0.5)) bad.push('gato delantero fuera de sitio');
      if (r === 'gato_trasero' && !(s.x < -2.7 && Math.abs(s.z) < 0.5)) bad.push('gato trasero fuera de sitio');
    }
    assert(bad.length === 0, 'CA7: 16 mecánicos (dos gatos, dos que sujetan y tres por rueda), cada uno en su puesto respecto al coche parado', bad.slice(0, 8).join(' | '));
  });

  await test('CA7: coreografía con la parada del motor', () => {
    const bad = [];
    if (typeof crew.crewPose !== 'function') bad.push('sin crewPose');
    else {
      const tl = anim.pitStopTimeline({ duration: 4.6, cause: 'rueda-atascada', wheel: 1, timeFactor: 1 });
      const at = (role, phase, t) => crew.crewPose(role, { phase, t, timeline: tl, from: 'medium', to: 'hard' });
      const slot = r => crew.crewSlot(r);
      // Llegada: salen corriendo y luego esperan en su puesto
      const run0 = at('pistola_FL', 'llegando', 0.2), run9 = at('pistola_FL', 'llegando', 9);
      if (run0.clip !== 'correr' || Math.hypot(run0.x - slot('pistola_FL').x, run0.z - slot('pistola_FL').z) < 1) bad.push(`llegando: ${JSON.stringify(run0)}`);
      if (run9.clip !== 'esperar' || Math.hypot(run9.x - slot('pistola_FL').x, run9.z - slot('pistola_FL').z) > 0.05) bad.push(`esperando: ${JSON.stringify(run9)}`);
      if (!(at('pone_FL', 'llegando', 9).carrying?.compound === 'hard')) bad.push('el que pone no espera con la rueda nueva');
      // Parada
      const mid = (tl.wheels[0].out[0] + tl.wheels[0].out[1]) / 2;
      if (at('gato_delantero', 'parada', mid).clip !== 'gato' || at('gato_trasero', 'parada', mid).clip !== 'gato') bad.push('los gatos no levantan');
      if (at('pistola_FL', 'parada', mid).clip !== 'pistola') bad.push('la pistola no trabaja');
      if (at('sujeta_izq', 'parada', mid).clip !== 'sujetar') bad.push('nadie sujeta el coche');
      const off = at('quita_FL', 'parada', tl.wheels[0].in[0] + 0.05);
      if (off.carrying?.compound !== 'medium') bad.push(`el que quita no se lleva la vieja: ${JSON.stringify(off)}`);
      const on = at('pone_FL', 'parada', mid);
      if (on.carrying?.compound !== 'hard' || on.clip !== 'poner_rueda') bad.push(`el que pone no trae la nueva: ${JSON.stringify(on)}`);
      if (at('pone_FL', 'parada', tl.wheels[0].in[1] + 0.05).carrying) bad.push('la rueda nueva sigue en brazos tras montarla');
      // Rueda atascada (FR): su pistola sigue trabajando cuando las demás ya han acabado
      const late = tl.wheels[0].in[1] + 0.5;
      if (at('pistola_FR', 'parada', late).clip !== 'pistola' || at('pistola_FL', 'parada', late).clip === 'pistola') bad.push('la pistola de la rueda atascada no pelea el tiempo de más');
      // Salida: vuelven corriendo
      const back = at('pistola_FL', 'saliendo', 0.4);
      if (back.clip !== 'correr') bad.push('no vuelven corriendo al garaje');
    }
    assert(bad.length === 0, 'CA7: corren a su puesto al entrar el coche en el pit lane, esperan, trabajan con el guion de la parada (gatos, pistolas, ruedas en brazos, la atascada más tiempo) y vuelven corriendo', bad.join(' | '));
  });

  await test('CA7: colores del equipo y solo cuando hace falta', async () => {
    const bad = [];
    const material = name => ({ name, color: { value: null, set(v) { this.value = v; } } });
    const mats = MATERIALS.map(material);
    const root = { traverse: cb => mats.forEach(m => cb({ isMesh: true, material: m })) };
    if (typeof crew.dressCrew !== 'function') bad.push('sin dressCrew');
    else {
      crew.dressCrew(root, { primary: '#ff8000', secondary: '#1b2a4a', sponsors: [] });
      if (mats[0].color.value !== '#ff8000' || mats[1].color.value !== '#1b2a4a') bad.push('mono sin los colores del equipo');
      if (mats[2].color.value !== '#ff8000') bad.push('casco sin el color del equipo');
    }
    if (typeof crew.crewPhase !== 'function') bad.push('sin crewPhase');
    else {
      const base = { pitStop: { isPitting: false, serviceStop: null }, isInPitLane: false };
      if (crew.crewPhase(base, null) !== null) bad.push('hay mecánicos sin parada');
      if (crew.crewPhase({ ...base, pitStop: { isPitting: true, serviceStop: null }, isInPitLane: true }, null) !== 'llegando') bad.push('no salen al entrar el coche en el pit lane');
      if (crew.crewPhase({ ...base, pitStop: { isPitting: true, serviceStop: { start: 1 } }, isInPitLane: true }, 'llegando') !== 'parada') bad.push('no trabajan durante la parada');
      if (crew.crewPhase(base, 'parada') !== 'saliendo') bad.push('no vuelven al garaje');
    }
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    if (!/crewPhase\(/.test(scene) || !/mecanico\.glb/.test(scene + readFileSync('src/scene3d/pitCrew3d.ts', 'utf8'))) bad.push('la escena no pone los mecánicos');
    assert(bad.length === 0, 'CA7: mono y casco con los colores del equipo; mecánicos solo para el coche que entra, para o acaba de parar', bad.join(' | '));
  });

  await test('CA7: capturas', () => {
    const dir = 'docs/design/ca7-mecanicos';
    const files = existsSync(dir) ? readdirSync(dir).filter(f => /\.(png|jpg)$/.test(f)) : [];
    assert(files.length >= 4, 'CA7: capturas de la llegada, el cambio, la rueda atascada y la salida en docs/design/ca7-mecanicos/', files.join(', '));
  });
}
