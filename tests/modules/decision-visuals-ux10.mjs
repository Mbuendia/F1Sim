// UX10 — Imágenes 3D de lo que se cambia (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
// Opción recomendada (a confirmar): mixta. El coche del juego en 3D con la pieza resaltada y, para la sede, las
// instalaciones y el personal, imágenes hechas en Blender, con estilo propio y sin marcas reales.
//  1. Cada proyecto de desarrollo apunta a una pieza del coche: alerones → alerón delantero y trasero, suelo → fondo
//     plano, refrigeración → pontones, eficiencia → tapa motor, neumáticos → ruedas.
//  2. El modelo del coche del menú tiene esas piezas separadas y con nombre (se separan en Blender del coche actual;
//     el de 2025 llegará con los mismos nombres en CA2).
//  3. Cada instalación (túnel, simulador, producción, banco) y la sede tienen su imagen, ligera (≤ 200 KB) y presente.
//  4. Al tocar una mejora se ve la pieza resaltada; al tocar una instalación, su imagen.
//  5. El 3D del menú solo se carga en el centro de temporada (import()), no al arrancar.
import { readFileSync, existsSync, statSync } from 'node:fs';

/** Nombres de los nodos de un .glb (solo la cabecera JSON). */
const glbNodes = file => {
  const buf = readFileSync(file);
  const len = buf.readUInt32LE(12);
  return (JSON.parse(buf.subarray(20, 20 + len).toString('utf8')).nodes ?? []).map(n => n.name).filter(Boolean);
};

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { PROJECTS } = await load('/src/simulation/Development.ts');
  const { FACILITY_IDS } = await load('/src/simulation/Facilities.ts');
  const { PART_FOR_PROJECT, CAR_PARTS, FACILITY_IMAGE, MENU_CAR_MODEL } = await load('/src/scene3d/partVisuals.ts');

  await test('UX10: cada mejora apunta a su pieza', () => {
    assert(Object.keys(PROJECTS).every(k => Array.isArray(PART_FOR_PROJECT[k]) && PART_FOR_PROJECT[k].length > 0), 'UX10: todos los proyectos tienen pieza', Object.keys(PROJECTS).join(', '));
    assert(JSON.stringify(PART_FOR_PROJECT.alerones) === JSON.stringify(['ala_delantera', 'ala_trasera']) && PART_FOR_PROJECT.suelo[0] === 'suelo' && PART_FOR_PROJECT.refrigeracion[0] === 'pontones' && PART_FOR_PROJECT.eficiencia[0] === 'tapa_motor' && PART_FOR_PROJECT.neumaticos[0] === 'ruedas', 'UX10: la pieza que tiene sentido para cada mejora');
  });

  await test('UX10: el coche del menú, por piezas', () => {
    const file = `public/${MENU_CAR_MODEL}`;
    assert(existsSync(file), 'UX10: existe el modelo del coche del menú', file);
    const nodes = existsSync(file) ? glbNodes(file) : [];
    assert(CAR_PARTS.every(p => nodes.includes(p)), 'UX10: el modelo tiene cada pieza separada y con nombre', CAR_PARTS.filter(p => !nodes.includes(p)).join(', '));
    assert(existsSync(file) && statSync(file).size <= 4 * 1024 * 1024, 'UX10: pesa como mucho 4 MB');
  });

  await test('UX10: imágenes de la sede y las instalaciones', () => {
    for (const id of [...FACILITY_IDS, 'sede']) {
      const f = `public/${FACILITY_IMAGE[id] ?? ''}`;
      assert(FACILITY_IMAGE[id] && existsSync(f) && statSync(f).size <= 200 * 1024, `UX10: ${id} tiene su imagen ligera`, f);
    }
    const credits = readFileSync('public/models/ATTRIBUTION.md', 'utf8');
    assert(/temporada|Blender/i.test(credits), 'UX10: las imágenes constan en los créditos (hechas para el juego)');
  });

  await test('UX10: se ve al decidir y se carga aparte', () => {
    const home = readFileSync('src/components/HubHome.tsx', 'utf8');
    assert(/lazy\(\(\) => import\(['"]\.\/DecisionVisual['"]\)\)/.test(home), 'UX10: la imagen de la decisión se carga con import() en el centro de temporada');
    const visual = readFileSync('src/components/DecisionVisual.tsx', 'utf8');
    assert(/PART_FOR_PROJECT/.test(visual) && /FACILITY_IMAGE/.test(visual) && /highlight/i.test(visual), 'UX10: resalta la pieza de la mejora o enseña la imagen de la instalación');
  });
}
