# [MJ11, 20/11/2026, el usuario pasa referencias de ingenieros de verdad: «úsalas para generar a los ingenieros… son un
# poco raros»] Ingeniero de muro hecho aquí, sin assets ajenos: cuerpo con el modificador Skin sobre un esqueleto de
# puntos en la pose que toca (proporciones de una persona de 1,78 m) y suavizado; camisa de manga corta del equipo,
# pantalón oscuro, brazos y cara de piel, zapatillas; gorra, cascos de radio con micro y cable rizado, y en una de las
# poses el cuaderno rojo contra el pecho. Sin marcas: colores lisos.
# Uso: exec(open(r'.../mj11-ingeniero.py').read()); make_engineer(coleccion, 'nombre', 'cuaderno'|'brazos', (x, y), grados)
import bpy
import math
from mathutils import Vector

# Partes: 'piel', 'camisa', 'pantalon', 'zapato'. Radios (x, y) del Skin en cada punto.
BASE = {
    'pelvis': ((0, 0, 0.95), (0.17, 0.115)), 'cintura': ((0, 0, 1.1), (0.165, 0.11)), 'pecho': ((0, 0, 1.33), (0.2, 0.125)),
    'cuello': ((0, 0, 1.53), (0.058, 0.058)), 'cabeza': ((0, -0.01, 1.66), (0.1, 0.115)), 'coronilla': ((0, 0, 1.76), (0.085, 0.095)),
    'cadera_l': ((0.095, 0, 0.9), (0.095, 0.095)), 'rodilla_l': ((0.1, 0.0, 0.5), (0.07, 0.07)), 'tobillo_l': ((0.1, 0.02, 0.09), (0.05, 0.05)), 'pie_l': ((0.1, -0.12, 0.04), (0.055, 0.04)),
    'cadera_r': ((-0.095, 0, 0.9), (0.095, 0.095)), 'rodilla_r': ((-0.1, 0.0, 0.5), (0.07, 0.07)), 'tobillo_r': ((-0.1, 0.02, 0.09), (0.05, 0.05)), 'pie_r': ((-0.1, -0.12, 0.04), (0.055, 0.04)),
    'hombro_l': ((0.2, 0, 1.44), (0.068, 0.068)), 'manga_l': ((0.22, 0, 1.3), (0.064, 0.064)), 'codo_l': ((0.23, 0.0, 1.17), (0.048, 0.048)), 'muneca_l': ((0.24, -0.02, 0.93), (0.037, 0.037)), 'mano_l': ((0.245, -0.03, 0.84), (0.045, 0.028)),
    'hombro_r': ((-0.2, 0, 1.44), (0.068, 0.068)), 'manga_r': ((-0.22, 0, 1.3), (0.064, 0.064)), 'codo_r': ((-0.23, 0.0, 1.17), (0.048, 0.048)), 'muneca_r': ((-0.24, -0.02, 0.93), (0.037, 0.037)), 'mano_r': ((-0.245, -0.03, 0.84), (0.045, 0.028)),
}
EDGES = [
    ('pelvis', 'cintura', 'camisa'), ('cintura', 'pecho', 'camisa'), ('pecho', 'cuello', 'piel'), ('cuello', 'cabeza', 'piel'), ('cabeza', 'coronilla', 'piel'),
    ('pelvis', 'cadera_l', 'pantalon'), ('cadera_l', 'rodilla_l', 'pantalon'), ('rodilla_l', 'tobillo_l', 'pantalon'), ('tobillo_l', 'pie_l', 'zapato'),
    ('pelvis', 'cadera_r', 'pantalon'), ('cadera_r', 'rodilla_r', 'pantalon'), ('rodilla_r', 'tobillo_r', 'pantalon'), ('tobillo_r', 'pie_r', 'zapato'),
    ('pecho', 'hombro_l', 'camisa'), ('hombro_l', 'manga_l', 'camisa'), ('manga_l', 'codo_l', 'piel'), ('codo_l', 'muneca_l', 'piel'), ('muneca_l', 'mano_l', 'piel'),
    ('pecho', 'hombro_r', 'camisa'), ('hombro_r', 'manga_r', 'camisa'), ('manga_r', 'codo_r', 'piel'), ('codo_r', 'muneca_r', 'piel'), ('muneca_r', 'mano_r', 'piel'),
]

# Poses: solo los puntos que cambian. «cuaderno»: el izquierdo sujeta el cuaderno contra el pecho (referencia del
# ingeniero que pasa con su cuaderno rojo); «brazos»: brazos cruzados, mirando las pantallas (referencia del muro).
POSES = {
    'cuaderno': {
        'codo_l': (0.25, -0.06, 1.16), 'muneca_l': (0.08, -0.2, 1.2), 'mano_l': (0.0, -0.215, 1.23),
        'codo_r': (-0.24, 0.02, 1.17), 'muneca_r': (-0.27, -0.06, 0.94), 'mano_r': (-0.27, -0.08, 0.85),
        'cabeza': (0.0, -0.02, 1.655), 'coronilla': (0.0, -0.01, 1.755),
        'rodilla_r': (-0.1, -0.06, 0.5), 'tobillo_r': (-0.1, -0.05, 0.09), 'pie_r': (-0.1, -0.19, 0.04),
    },
    'brazos': {
        'codo_l': (0.24, -0.1, 1.2), 'muneca_l': (-0.05, -0.2, 1.27), 'mano_l': (-0.13, -0.18, 1.3),
        'codo_r': (-0.24, -0.1, 1.18), 'muneca_r': (0.05, -0.22, 1.24), 'mano_r': (0.13, -0.2, 1.27),
        'cadera_l': (0.11, 0, 0.9), 'rodilla_l': (0.13, 0.0, 0.5), 'tobillo_l': (0.15, 0.02, 0.09), 'pie_l': (0.16, -0.1, 0.04),
        'cadera_r': (-0.11, 0, 0.9), 'rodilla_r': (-0.13, 0.0, 0.5), 'tobillo_r': (-0.15, 0.02, 0.09), 'pie_r': (-0.16, -0.1, 0.04),
    },
}


def _m(name, color, rough=0.6, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


def _link(coll, o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
    return o


def make_engineer(coll, name, pose, xy, heading, shirt=(0.012, 0.02, 0.07), skin=(0.62, 0.42, 0.32)):
    joints = {k: v[0] for k, v in BASE.items()}
    joints.update(POSES.get(pose, {}))
    names = list(BASE)
    me = bpy.data.meshes.new(f'mj11_{name}')
    me.from_pydata([joints[n] for n in names], [(names.index(a), names.index(b)) for a, b, _ in EDGES], [])
    body = _link(coll, bpy.data.objects.new(f'mj11_{name}', me))
    body.modifiers.new('skin', 'SKIN')
    for i, n in enumerate(names):
        sv = me.skin_vertices[0].data[i]
        sv.radius = BASE[n][1]
        sv.use_root = n == 'pelvis'
    sub = body.modifiers.new('suave', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    # Se aplican para poner los materiales por zonas (cara a cara, según el hueso más cercano).
    bpy.context.view_layer.objects.active = body
    with bpy.context.temp_override(object=body, active_object=body, selected_objects=[body]):
        bpy.ops.object.modifier_apply(modifier='skin')
        bpy.ops.object.modifier_apply(modifier='suave')
    mats = {'piel': _m('mj11_piel_ing', skin, 0.55), 'camisa': _m(f'mj11_camisa_{name}', shirt, 0.7), 'pantalon': _m('mj11_pantalon', (0.015, 0.017, 0.03), 0.75), 'zapato': _m('mj11_zapato', (0.85, 0.85, 0.87), 0.5), 'cinturon': _m('mj11_cinturon', (0.01, 0.01, 0.012), 0.35)}
    order = list(mats)
    for m in mats.values():
        body.data.materials.append(m)
    # El hueso más cercano en proporción a su grosor (si no, el antebrazo cruzado se quedaba con la cintura).
    rad = lambda n: max(BASE[n][1])
    segs = [(Vector(joints[a]), Vector(joints[b]), part, (rad(a) + rad(b)) / 2) for a, b, part in EDGES]
    for poly in body.data.polygons:
        c = poly.center
        best = min(segs, key=lambda s: _seg_dist(c, s[0], s[1]) / s[3])
        part = best[2]
        # El cuello de la camisa sube un poco por el cuello.
        if part == 'piel' and best[0].z > 1.3 and best[1].z < 1.56 and c.z < 1.52:
            part = 'camisa'
        # Camisa por dentro del pantalón: borde recto a la altura del cinturón, que va justo encima.
        if part in ('camisa', 'pantalon') and abs(c.x) < 0.24 and 0.9 < c.z < 1.2:
            part = 'cinturon' if 0.965 < c.z < 1.0 else ('camisa' if c.z >= 1.0 else 'pantalon')
        if part == 'camisa' and c.z < 0.965:
            part = 'pantalon'
        poly.material_index = order.index(part)
        poly.use_smooth = True

    # Cinturón de verdad sobre la costura entre camisa y pantalón (las caras quedan en zigzag).
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.045, location=(0, 0, 0.982), vertices=32)
    belt = _link(coll, bpy.context.active_object)
    belt.scale = (0.168, 0.118, 1.0)
    belt.data.materials.append(mats['cinturon'])
    for poly in belt.data.polygons:
        poly.use_smooth = True
    head = Vector(joints['cabeza'])
    parts = [body, belt]
    navy = _m('mj11_gorra', (0.02, 0.03, 0.09), 0.6)
    black = _m('mj11_cascos', (0.02, 0.02, 0.022), 0.35, 0.2)
    red = _m('mj11_rojo_ing', (0.6, 0.02, 0.03), 0.5)
    # Gorra: casquete y visera hacia delante (-y).
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.105, location=head + Vector((0, 0.0, 0.035)), segments=24, ring_count=12)
    cap = _link(coll, bpy.context.active_object)
    cap.scale = (1.0, 1.08, 0.75)
    bpy.ops.object.mode_set(mode='EDIT')
    import bmesh
    bm = bmesh.from_edit_mesh(cap.data)
    for v in [v for v in bm.verts if v.co.z < -0.01]:
        bm.verts.remove(v)
    bmesh.update_edit_mesh(cap.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    cap.data.materials.append(navy)
    parts.append(cap)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.075, depth=0.012, location=head + Vector((0, -0.125, 0.045)), vertices=24)
    brim = _link(coll, bpy.context.active_object)
    brim.scale = (1.0, 0.75, 1.0)
    brim.rotation_euler = (math.radians(-8), 0, 0)
    brim.data.materials.append(navy)
    parts.append(brim)
    # Cascos de radio: diadema sobre la gorra, orejeras y micro hacia la boca; cable rizado hasta la cintura.
    # [20/11/2026, el usuario: «¿Por qué los ingenieros tienen una barra que les cruza toda la cara?»] La diadema va de oreja a
    # oreja por encima de la cabeza (plano XZ) y solo la mitad de arriba; antes el aro entero pasaba por delante de la cara.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.118, minor_radius=0.012, location=head + Vector((0, 0.005, 0.0)), rotation=(math.radians(90), 0, 0))
    band = _link(coll, bpy.context.active_object)
    bm2 = bmesh.new()
    bm2.from_mesh(band.data)
    bm2.verts.ensure_lookup_table()
    rot = band.rotation_euler.to_matrix()
    bmesh.ops.delete(bm2, geom=[v for v in bm2.verts if (rot @ v.co).z < -0.005], context='VERTS')
    bm2.to_mesh(band.data)
    bm2.free()
    band.scale = (1, 1.12, 1)
    band.data.materials.append(black)
    parts.append(band)
    for side in (1, -1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.048, depth=0.04, location=head + Vector((side * 0.112, 0.0, -0.01)), rotation=(0, math.radians(90), 0), vertices=24)
        cup = _link(coll, bpy.context.active_object)
        cup.data.materials.append(black)
        parts.append(cup)
    boom_start = head + Vector((0.12, -0.02, -0.03))
    boom_end = head + Vector((0.06, -0.115, -0.07))   # a la comisura, sin cruzar la cara
    mid = (boom_start + boom_end) / 2
    d = boom_end - boom_start
    bpy.ops.mesh.primitive_cylinder_add(radius=0.004, depth=d.length, location=mid, vertices=8)
    boom = _link(coll, bpy.context.active_object)
    boom.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    boom.data.materials.append(black)
    parts.append(boom)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, location=boom_end)
    mic = _link(coll, bpy.context.active_object)
    mic.data.materials.append(black)
    parts.append(mic)
    cable = bpy.data.curves.new(f'mj11_cable_{name}', 'CURVE')
    cable.dimensions = '3D'
    cable.bevel_depth = 0.005
    sp = cable.splines.new('POLY')
    pts = []
    top, bottom = head + Vector((0.11, -0.01, -0.06)), Vector((0.16, -0.12, 1.0))
    for k in range(61):
        t = k / 60
        base = top.lerp(bottom, t)
        if 0.25 < t < 0.9:
            base += Vector((math.cos(t * 90) * 0.012, math.sin(t * 90) * 0.012, 0))
        pts.append(base)
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    cab = _link(coll, bpy.data.objects.new(f'mj11_cable_{name}', cable))
    cab.data.materials.append(black)
    parts.append(cab)
    if pose == 'cuaderno':
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.06, -0.19, 1.2), rotation=(math.radians(-12), math.radians(-18), 0))
        book = _link(coll, bpy.context.active_object)
        book.scale = (0.24, 0.025, 0.31)
        book.data.materials.append(red)
        parts.append(book)

    root = bpy.data.objects.new(f'mj11_{name}_raiz', None)
    coll.objects.link(root)
    for p in parts:
        p.parent = root
    root.location = (xy[0], xy[1], 0)
    root.rotation_euler = (0, 0, math.radians(heading))
    return root
