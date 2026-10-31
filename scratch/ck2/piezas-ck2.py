# CK2: las 31 piezas finales del kit en la colección CK2 (23 comunes y 8 de Shanghái), a partir de las piezas sacadas del
# modelo de Shanghái (colección KIT de kit-shanghai.blend). Origen en el centro de la base y el largo en X.
# Se ejecuta con exec() dentro de Blender.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix
TEX = r'C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario-Documents-antigravity-brave-mendeleev\f474c708-6eb0-40dd-bce8-215b3a2452e4\scratchpad\ck2\texturas'
main = next(s for s in bpy.data.scenes if s.name not in ('MAQUETA', 'PREVIEW', 'TOP'))
bpy.context.window.scene = main
col = bpy.data.collections.get('CK2')
if col:
    for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)
else:
    col = bpy.data.collections.new('CK2')
if col.name not in main.collection.children: main.collection.children.link(col)

def bsdf(m):
    m.use_nodes = True; nt = m.node_tree
    bs = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bs is None:
        bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    return bs
def mat_img(name, path):
    m = bpy.data.materials.get('ckimg_' + name)
    if m: return m
    m = bpy.data.materials.new('ckimg_' + name); bs = bsdf(m)
    tx = m.node_tree.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(path, check_existing=True)
    m.node_tree.links.new(tx.outputs['Color'], bs.inputs['Base Color']); return m
def flat(name, rgb):
    m = bpy.data.materials.get('ckflat_' + name)
    if m: return m
    m = bpy.data.materials.new('ckflat_' + name); bsdf(m).inputs['Base Color'].default_value = (*rgb, 1); return m
def remap(me, axes):
    uv = me.uv_layers.active or me.uv_layers.new()
    lo = [min(v.co[a] for v in me.vertices) for a in range(3)]; hi = [max(v.co[a] for v in me.vertices) for a in range(3)]
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co[axes[0]] - lo[axes[0]]) / ((hi[axes[0]] - lo[axes[0]]) or 1), (co[axes[1]] - lo[axes[1]]) / ((hi[axes[1]] - lo[axes[1]]) or 1))
def normalize(me):
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    me.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs)))); me.update()
def add(id_, me, scope):
    me.name = 'ck_' + id_; ob = bpy.data.objects.new('ck_' + id_, me); col.objects.link(ob); ob['scope'] = scope; normalize(me); return ob

SRC = {'guardarrail': 'kit_guardarrail', 'muro_neumaticos': 'kit_muro_neumaticos', 'valla_alta': 'kit_valla_alta', 'bloque_hormigon': 'kit_bloque_hormigon',
       'poste_luz': 'kit_poste_luz', 'farola': 'kit_farola', 'marcador': 'kit_marcador', 'grada_comun': 'kit_grada_comun', 'grada_roja': 'kit_grada_roja',
       'grua': 'kit_grua', 'arbol_a': 'kit_arbol_a', 'arbol_b': 'kit_arbol_b', 'arbol_c': 'kit_arbol_c', 'coche_medico': 'kit_coche_medico',
       'coche_aparcado': 'kit_coche_aparcado', 'camion': 'kit_camion', 'refugio_comisarios': 'kit_refugio_comisarios',
       'valla_publi': 'kit_valla_publi__rolax', 'pancarta': 'kit_pancarta__emirratos', 'cartel_metros': 'kit_metros_100__rolax'}
SHANGHAI = ['edificio_boxes', 'edificio_b', 'pabellon', 'carpa', 'marquesina', 'techo_tribuna', 'estructura_b', 'estructura_c']
for id_, src in SRC.items(): add(id_, bpy.data.objects[src].data.copy(), 'comun')
for id_ in SHANGHAI: add(id_, bpy.data.objects['kit_' + id_].data.copy(), 'shanghai')
# Cartel pequeño con su patrocinador de parodia.
me = bpy.data.objects['kit_cartel_pequeno'].data.copy(); remap(me, (0, 2)); me.materials.clear()
me.materials.append(mat_img('cartel_santandreu', os.path.join(TEX, 'cartel_santandreu.png'))); add('cartel_pequeno', me, 'comun')
# Torre de posiciones con el cartel neutro (CK3 pone el nombre del circuito) y reducida a menos de 1.500 triángulos.
me = bpy.data.objects['kit_torre_posiciones'].data.copy()
m0 = me.materials[0].copy(); m0.name = 'ck_torre'
for nd in m0.node_tree.nodes:
    if nd.type == 'TEX_IMAGE': nd.image = bpy.data.images.load(os.path.join(TEX, 'torre_neutra.png'), check_existing=True)
me.materials[0] = m0
ob = add('torre_posiciones', me, 'comun')
md = ob.modifiers.new('reducir', 'DECIMATE'); md.ratio = 0.5
ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); nm = bpy.data.meshes.new_from_object(ev)
ob.modifiers.clear(); old = ob.data; ob.data = nm; nm.name = 'ck_torre_posiciones'; bpy.data.meshes.remove(old); normalize(nm)
# Grada pequeña modelada: 18 m, 10 filas, pretil, fondo y laterales cerrados; asientos mirando a +Y.
R, DD, DH, Z0, L = 10, 0.85, 0.5, 1.2, 18.0
d = R * DD; y0 = d / 2
prof = [(y0, 0, 0), (y0, Z0, 0)]
for r in range(R):
    z = Z0 + (r + 1) * DH; prof += [(y0 - r * DD, z, 0), (y0 - (r + 1) * DD, z, 1 + r % 2)]
prof += [(y0 - d, 0, 0)]
bm = bmesh.new(); rows = [[bm.verts.new((x, y, z)) for y, z, _ in prof] for x in (-L / 2, L / 2)]
for j in range(len(prof) - 1):
    f = bm.faces.new((rows[0][j], rows[0][j + 1], rows[1][j + 1], rows[1][j])); f.material_index = prof[j + 1][2]
bm.faces.new((rows[0][-1], rows[0][0], rows[1][0], rows[1][-1])).material_index = 0
for k, rw in enumerate(rows): bm.faces.new(rw if k else list(reversed(rw))).material_index = 0
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('ck_grada_pequena'); bm.to_mesh(me); bm.free()
for mm in (flat('hormigon', (0.55, 0.55, 0.52)), flat('asiento_rojo', (0.5, 0.05, 0.06)), flat('asiento_gris', (0.45, 0.47, 0.5))): me.materials.append(mm)
add('grada_pequena', me, 'comun')
# Grada roja: solo su módulo (fuera las alas de los módulos vecinos).
me = bpy.data.objects['ck_grada_roja'].data; bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(abs(v.co.x) > 19.5 for v in f.verts)], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(me); bm.free(); normalize(me)
for o in col.objects: o.hide_render = False; o.hide_viewport = False
result = {'n': len(col.objects), 'piezas': {o.name[3:]: [o.get('scope'), sum(len(p.vertices) - 2 for p in o.data.polygons), [round(x, 2) for x in o.dimensions]] for o in col.objects}}
