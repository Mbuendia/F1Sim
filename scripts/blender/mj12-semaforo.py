# [MJ12, 20/11/2026] Pórtico del semáforo de salida, hecho en Blender: una viga de aluminio con cinco cajas negras, cada
# una con cuatro lentes rojas en columna, visera encima de cada lente y los soportes. Sin marcas. Dos renders con fondo
# transparente, iguales salvo las lentes: «apagado» (rojo muy oscuro) y «encendido» (rojo emisivo). El juego pone el
# encendido encima y enseña tantas columnas como luces diga el motor (de izquierda a derecha). Cámara ortográfica: las
# cinco columnas quedan a la misma distancia, en x = -2..2 m de un ancho de 6 m (las columnas de la imagen, a quintos).
# Uso: exec(open(r'.../mj12-semaforo.py').read()); build(); render(carpeta)
import bpy
import math

SCENE = 'MJ12_SEMAFORO'


def _mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Emission Strength'].default_value = strength
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
    return m


def _add(coll, op, name, mat, **kw):
    op(**kw)
    o = bpy.context.active_object
    o.name = name
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def build():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = sc
    for o in list(sc.collection.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    coll = sc.collection
    alu = _mat('mj12_aluminio', (0.55, 0.57, 0.6), rough=0.35, metal=0.9)
    caja = _mat('mj12_caja', (0.012, 0.012, 0.014), rough=0.45, metal=0.3)
    visera = _mat('mj12_visera', (0.02, 0.02, 0.022), rough=0.6)
    lente = _mat('mj12_lente', (0.08, 0.0, 0.0), rough=0.15, emit=(1.0, 0.0, 0.0), strength=0.0)
    # Viga y soportes.
    _add(coll, bpy.ops.mesh.primitive_cube_add, 'mj12_viga', alu, size=1, location=(0, 0.2, 1.55))
    sc.objects['mj12_viga'].scale = (5.4, 0.18, 0.1)
    for i in range(5):
        _add(coll, bpy.ops.mesh.primitive_cube_add, f'mj12_colgante_{i}', alu, size=1, location=(-2 + i, 0.2, 1.48))
        sc.objects[f'mj12_colgante_{i}'].scale = (0.08, 0.08, 0.12)
    for i in range(5):
        x = -2 + i
        b = _add(coll, bpy.ops.mesh.primitive_cube_add, f'mj12_caja_{i}', caja, size=1, location=(x, 0, 0))
        b.scale = (0.62, 0.32, 2.85)
        bpy.ops.object.select_all(action='DESELECT')
        b.select_set(True)
        bpy.context.view_layer.objects.active = b
        bpy.ops.object.transform_apply(scale=True)
        bev = b.modifiers.new('bisel', 'BEVEL')
        bev.width = 0.04
        bev.segments = 3
        for k in range(4):
            z = 1.0 - k * 0.66
            _add(coll, bpy.ops.mesh.primitive_cylinder_add, f'mj12_lente_{i}_{k}', lente, radius=0.21, depth=0.06, location=(x, -0.165, z), rotation=(math.radians(90), 0, 0), vertices=48)
            v = _add(coll, bpy.ops.mesh.primitive_cylinder_add, f'mj12_visera_{i}_{k}', visera, radius=0.25, depth=0.16, location=(x, -0.24, z + 0.05), rotation=(math.radians(90), 0, 0), vertices=48)
            # Media visera (solo la parte de arriba), como las de los semáforos de verdad.
            bpy.ops.object.select_all(action='DESELECT')
            v.select_set(True)
            bpy.context.view_layer.objects.active = v
            bpy.ops.object.mode_set(mode='EDIT')
            import bmesh
            bm = bmesh.from_edit_mesh(v.data)
            for vert in [vv for vv in bm.verts if vv.co.y > 0.02]:
                pass
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y > -0.02 or abs(f.normal.y) > 0.9], context='FACES')
            bmesh.update_edit_mesh(v.data)
            bpy.ops.object.mode_set(mode='OBJECT')
            sol = v.modifiers.new('grosor', 'SOLIDIFY')
            sol.thickness = 0.015
    # Luz: clave suave por delante y arriba, y un contraluz frío.
    for name, loc, rot, e, c in (('mj12_clave', (2, -6, 4), (math.radians(60), 0, math.radians(15)), 900, (1, 0.97, 0.94)), ('mj12_contra', (-3, 4, 4), (math.radians(-50), 0, math.radians(200)), 500, (0.7, 0.8, 1.0))):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy = e
        d.size = 6
        d.color = c
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        coll.objects.link(o)
    cd = bpy.data.cameras.new('mj12_cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = 6.0
    cam = bpy.data.objects.new('mj12_cam', cd)
    cam.location = (0, -10, 0.15)
    cam.rotation_euler = (math.radians(90), 0, 0)
    coll.objects.link(cam)
    sc.camera = cam
    w = bpy.data.worlds.get('mj12_mundo') or bpy.data.worlds.new('mj12_mundo')
    w.use_nodes = True
    bg = next((n for n in w.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if bg:
        bg.inputs['Color'].default_value = (0.02, 0.02, 0.025, 1)
    sc.world = w
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 128
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'   # rojo saturado (AgX lo blanquea)
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1500, 900, 100
    return sc


def render(folder, samples=128):
    sc = bpy.data.scenes[SCENE]
    sc.cycles.samples = samples
    lente = bpy.data.materials['mj12_lente']
    b = next(n for n in lente.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for name, strength, base in (('apagado', 0.0, (0.05, 0.0, 0.0)), ('encendido', 4.5, (0.9, 0.02, 0.01))):
        b.inputs['Emission Strength'].default_value = strength
        b.inputs['Base Color'].default_value = (*base, 1)
        sc.render.filepath = f'{folder}/semaforo-{name}.png'
        bpy.ops.render.render(write_still=True, scene=SCENE)
    return True
