# [TL7, 16/11/2026] Superficies de rótulos de los coches del juego, en los sitios donde los llevan los coches reales de
# 2023 y 2024 (estudio en docs/design/tl7-zonas-rotulos.md). Cada zona es una placa rectangular subdividida que se coloca
# fuera del coche, se proyecta sobre la carrocería (Shrinkwrap) y queda separada unos milímetros, con coordenadas de
# textura que se leen bien desde fuera y un material propio (decal_<zona>) en el que el juego pinta el rótulo.
# Coordenadas relativas del coche: x de la cola (0) al morro (1), y de un lado (0) a otro (1), z del suelo (0) a lo más alto (1).
# Se ejecuta dentro de Blender: exec(open(ruta).read()); add_zones('ESCENA', 'body').
import bpy, math
from mathutils import Vector, Matrix

# zona: lista de placas (centro x, y, z relativos; largo y alto relativos al largo del coche; cara: 'izq', 'der' o 'arriba')
ZONES = {
    # Cara de fuera de las placas del alerón delantero: plana y continua (sobre los flaps el rótulo quedaba partido).
    'decal_frontwing': [((0.87, 0.0, 0.28), (0.055, 0.0145), 'izq'), ((0.87, 1.0, 0.28), (0.055, 0.0145), 'der')],
    # Lateral del monocasco, delante del pontón: plano (proyectado desde cerca para no chocar con la suspensión).
    'decal_noseside': [((0.64, 0.5, 0.46), (0.10, 0.02), 'izq', 0.35), ((0.64, 0.5, 0.46), (0.10, 0.02), 'der', 0.35)],
    # Costado del pontón: donde los dos coches de referencia llevan el patrocinador principal, enorme.
    'decal_sidepodside': [((0.41, 0.0, 0.45), (0.085, 0.022), 'izq'), ((0.41, 1.0, 0.45), (0.085, 0.022), 'der')],
    # Placas del alerón trasero (por dentro de las ruedas).
    'decal_endplate': [((0.05, 0.0, 0.68), (0.045, 0.022), 'izq'), ((0.05, 1.0, 0.68), (0.045, 0.022), 'der')],
    # Tapa motor entera, para el patrocinador principal en grande (como lo llevan los coches de hoy).
    'decal_enginebig': [((0.31, 0.5, 0.54), (0.10, 0.03), 'izq', 0.5, 0.09), ((0.31, 0.5, 0.54), (0.10, 0.03), 'der', 0.5, 0.09)],
    # Parte de arriba del morro, delante del dorsal (a lo largo, se lee desde el lado izquierdo).
    'decal_nosetop': [((0.875, 0.5, 0.40), (0.075, 0.02), 'arriba_largo')],
    # Travesaño delantero del halo, de lado a lado (se lee desde delante).
    'decal_halo': [((0.54, 0.5, 0.86), (0.045, 0.012), 'arriba')],
    # Costados del cono del morro.
    'decal_nosecone': [((0.85, 0.5, 0.34), (0.055, 0.012), 'izq', 0.25), ((0.85, 0.5, 0.34), (0.055, 0.012), 'der', 0.25)],
    # Dorsal en lo alto de la tapa motor, donde es plana.
    'decal_fin': [((0.35, 0.5, 0.95), (0.06, 0.028), 'arriba_largo')],
}

OFFSET = 0.004
MARGIN = 0.4


def _bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx - mn


def _plate(sc, body, name, center, dims, face, mn, size, i, margin=MARGIN, tolerance=None):
    length = size.x
    w, h = dims[0] * length, dims[1] * length
    c = Vector([mn[k] + center[k] * size[k] for k in range(3)])
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=8, size=1)
    ob = bpy.context.active_object
    ob.name = f'{name}_placa{i}'
    # La rejilla nace en XY mirando a +Z: X = largo del rótulo (u), Y = alto (v).
    ob.scale = (w, h, 1)
    if face == 'arriba_largo':
        # Visto desde arriba, el rótulo a lo largo del coche: se lee desde el lado izquierdo (u hacia el morro, +x).
        ob.rotation_euler = (0, 0, 0)
        ob.location = (c.x, c.y, mn.z + size.z + MARGIN)
        direction = (False, False, True)
    elif face == 'arriba':
        # Visto desde arriba con el morro hacia arriba de la textura: u hacia -y (derecha del que mira), v hacia +x.
        ob.rotation_euler = (0, 0, math.radians(90))
        ob.location = (c.x, c.y, mn.z + size.z + MARGIN)
        direction = (False, False, True)
    else:
        sign = -1 if face == 'izq' else 1
        # Cara lateral: la normal mira hacia fuera (±y) y v hacia arriba (+z); u hacia la derecha del que mira desde fuera.
        ob.rotation_euler = (math.radians(90), 0, 0 if sign < 0 else math.radians(180))
        y = mn.y - MARGIN if sign < 0 else mn.y + size.y + MARGIN
        if 0.2 < center[1] < 0.8:
            y = c.y + sign * margin
        ob.location = (c.x, y, c.z)
        direction = (False, True, False)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sw = ob.modifiers.new('ajuste', 'SHRINKWRAP')
    sw.target = body
    sw.wrap_method = 'PROJECT'
    sw.use_project_x, sw.use_project_y, sw.use_project_z = direction
    # Solo hacia el coche y con alcance limitado: sin esto, los bordes de la placa caen sobre piezas lejanas.
    toward_plus = face == 'izq'
    sw.use_positive_direction = toward_plus
    sw.use_negative_direction = not toward_plus
    sw.project_limit = margin + 0.25 if 0.2 < center[1] < 0.8 and not face.startswith('arriba') else 0.0
    sw.offset = OFFSET
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='ajuste')
    # Vértices que cayeron sobre otra pieza (mucho más hondos o altos que el resto de la placa): fuera, con sus caras.
    import bmesh, statistics
    axis = 2 if face.startswith('arriba') else 1
    bm = bmesh.new(); bm.from_mesh(ob.data)
    depth = statistics.median((ob.matrix_world @ v.co)[axis] for v in bm.verts)
    stray = [v for v in bm.verts if abs((ob.matrix_world @ v.co)[axis] - depth) > (tolerance if tolerance is not None else (0.08 if axis == 2 else 0.05))]
    bmesh.ops.delete(bm, geom=stray, context='VERTS')
    bm.to_mesh(ob.data); bm.free()
    if face == 'der':
        # Del lado derecho la rejilla queda girada: se invierte u para que el rótulo se lea desde fuera.
        uv = ob.data.uv_layers.active
        for loop in uv.data:
            loop.uv.x = 1 - loop.uv.x
    return ob


def _far(ob, body, limit=0.05):
    inv = body.matrix_world.inverted()
    far = 0
    for v in ob.data.vertices:
        world = ob.matrix_world @ v.co
        ok, loc, _n, _i = body.closest_point_on_mesh(inv @ world)
        if not ok or (body.matrix_world @ loc - world).length > limit:
            far += 1
    return far / max(1, len(ob.data.vertices))


def _fitted(sc, body, zone, center, dims, face, mn, size, i, margin=MARGIN, tolerance=None):
    """La placa más grande (hasta 5 intentos, cada uno un 20 % menor) que toca la carrocería casi entera."""
    scale = 1.0
    for attempt in range(6):
        ob = _plate(sc, body, zone, center, (dims[0] * scale, dims[1] * scale), face, mn, size, i, margin, tolerance)
        if _far(ob, body) <= 0.03 or attempt == 5:
            return ob
        bpy.data.objects.remove(ob, do_unlink=True)
        scale *= 0.8


def add_zones(scene_name, body_prefix='body', zones=ZONES):
    sc = bpy.data.scenes[scene_name]
    bpy.context.window.scene = sc
    objs = [o for o in sc.objects if o.type == 'MESH' and not o.name.startswith(tuple(zones))]
    body = next(o for o in objs if o.name.startswith(body_prefix))
    mn, size = _bounds(objs)
    report = {}
    for zone, plates in zones.items():
        for o in [o for o in list(sc.objects) if o.name.startswith(zone)]:
            bpy.data.objects.remove(o, do_unlink=True)
        parts = [_fitted(sc, body, zone, p[0], p[1], p[2], mn, size, i, *(p[3:])) for i, p in enumerate(plates)]
        bpy.ops.object.select_all(action='DESELECT')
        for p in parts:
            p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1:
            bpy.ops.object.join()
        ob = bpy.context.active_object
        ob.name = zone
        ob.data.name = zone
        mat = bpy.data.materials.get(zone) or bpy.data.materials.new(zone)
        mat.use_nodes = True
        ob.data.materials.clear()
        ob.data.materials.append(mat)
        # Vértices que no tocaron la carrocería (se quedaron en el aire): se quitan con sus caras.
        far = 0
        import bmesh
        bm = bmesh.new(); bm.from_mesh(ob.data)
        dead = []
        for v in bm.verts:
            world = ob.matrix_world @ v.co
            ok, loc, _n, _i = body.closest_point_on_mesh(body.matrix_world.inverted() @ world)
            if not ok or (body.matrix_world @ loc - world).length > 0.05:
                dead.append(v)
        far = len(dead)
        bmesh.ops.delete(bm, geom=dead, context='VERTS')
        bm.to_mesh(ob.data); bm.free()
        report[zone] = {'faces': len(ob.data.polygons), 'quitados': far}
    return report


DECALS = ['decal_engine', 'decal_nose', 'decal_rearwing', 'decal_sidepod', 'decal_sidepodside', 'decal_frontwing', 'decal_noseside', 'decal_endplate', 'decal_fin', 'decal_enginebig', 'decal_nosetop', 'decal_halo', 'decal_nosecone']


def export_car(scene_name, out):
    """Exporta la escena del coche a .glb: rótulos blancos y transparentes (el juego les pone la textura), solo esta escena."""
    sc = bpy.data.scenes[scene_name]
    bpy.context.window.scene = sc
    for k in DECALS:
        m = bpy.data.materials.get(k)
        if not m:
            continue
        nt = m.node_tree
        nt.nodes.clear()
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = (1, 1, 1, 1)
        b.inputs['Alpha'].default_value = 0.0
        o = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(b.outputs[0], o.inputs[0])
    for s in bpy.data.scenes:
        for vl in s.view_layers:
            for o in s.objects:
                try:
                    o.select_set(False, view_layer=vl)
                except Exception:
                    pass
    for o in sc.objects:
        if o.type in ('MESH', 'EMPTY'):
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, use_active_scene=True, export_animations=True,
                              export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT')


# [TL7, 16/11/2026] Coche de 2026 (assets/epoca-2026/f1-car-2026.glb): mismas zonas que el de 2025 con dos cambios, porque
# su forma es otra. Los rótulos de siempre del pontón y del alerón trasero caían en el costado del pontón (encima del nuevo)
# y en las placas del alerón (en espejo): se quitan y el alerón trasero lleva una placa nueva en el plano de arriba, con v
# invertida para que, con el giro que el juego aplica a ese rótulo, se lea desde detrás. El costado del pontón va más atrás.
# Uso: add_zones('TL7_2026', 'body'); quitar decal_sidepod y decal_rearwing; add_zones('TL7_2026', 'body', ZONES_2026);
# invertir v de decal_rearwing.
ZONES_2026 = {
    'decal_rearwing': [((0.045, 0.5, 0.97), (0.148, 0.0327), 'arriba')],
    'decal_sidepodside': [((0.475, 0.0, 0.42), (0.085, 0.022), 'izq'), ((0.475, 1.0, 0.42), (0.085, 0.022), 'der')],
}


# [TL7, 16/11/2026] W14 (2023), en la escena TL7_W14_JUEGO de assets3d/maquetas/tl7-coches.blend: copia de las mallas
# del modelo de Sketchfab sin las caras con texturas de imagen (todas son logotipos reales, también los del neumático),
# girado con el morro a +X, escalado a 5,7 m y con las ruedas en el suelo. Materiales del juego por pieza (el W14 es
# negro entero, así que no se puede por color): carrocería, pontones y tapa motor (Object_4, Object_32, Object_36),
# pintura principal; alerones delantero y trasero (Object_27, Object_74) y los filetes turquesa (Material.034),
# secundaria; el resto, carbono; en las ruedas, Material.001 neumático, Material.002 banda del compuesto y lo demás
# llanta. Ruedas unidas por grupo (wheel_FL…) con la banda como hija, origen en el eje y la acción WheelSpin del 2025;
# carrocería reducida al 60 % y ruedas al 12 % (unos 97 000 triángulos con los rótulos). Rótulos de siempre (dorsal del
# morro, tapa motor, pontón) copiados del 2025 y ajustados a esta carrocería; las nueve zonas nuevas, con ZONES; el
# alerón trasero, con la placa de arriba de ZONES_2026 (v invertida). Versión lejana en TL7_W14_LOD (8 500 triángulos).
# Salida: assets/epoca-2023/f1-car-2023.glb y f1-car-2023-lod.glb (comprimidos, atribución con scratch/set-extras).
