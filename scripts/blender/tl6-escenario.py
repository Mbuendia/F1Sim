# [TL6, 19/11/2026] Escenario de la presentación de la temporada, hecho en Blender: suelo negro brillante, plataforma
# giratoria con un aro de luz, fondo curvo con tiras de luz, y un aro de focos encima. Sin marcas ni texturas: solo
# materiales lisos (los focos de verdad los pone three.js en las posiciones de tl6_foco_0..7; prefijo propio porque el .blend tiene otros «foco_N»).
# Uso desde el MCP de Blender: exec(open(r'.../scripts/blender/tl6-escenario.py').read()); build_stage(); export_stage(ruta)
import bpy
import math

SCENE = 'TL6_ESCENARIO'


def _mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None) or nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m


def _link(obj, scene, mat):
    scene.collection.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def build_stage():
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    for o in list(scene.collection.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    # Las mallas del escenario anterior se borran también (si no, las nuevas salen con «.001» y el juego no las encuentra).
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    suelo_m = _mat('esc_suelo', (0.012, 0.013, 0.018), rough=0.12, metal=0.3)
    plat_m = _mat('esc_plataforma', (0.05, 0.055, 0.065), rough=0.35, metal=0.6)
    luz_m = _mat('esc_luz', (1, 1, 1), rough=0.3, emit=(1.0, 0.97, 0.92), strength=6.0)
    fondo_m = _mat('esc_fondo', (0.008, 0.009, 0.012), rough=0.8)
    acero_m = _mat('esc_acero', (0.18, 0.19, 0.21), rough=0.4, metal=0.9)
    import bmesh

    def mesh_obj(name, build):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        build(bm)
        bm.to_mesh(me)
        bm.free()
        return bpy.data.objects.new(name, me)

    # Suelo: disco grande y brillante.
    suelo = mesh_obj('suelo', lambda bm: bmesh.ops.create_circle(bm, cap_ends=True, segments=96, radius=11))
    _link(suelo, scene, suelo_m)
    # Plataforma giratoria (se anima en el juego: sube y gira), con su aro de luz.
    plat = mesh_obj('plataforma', lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=96, radius1=3.4, radius2=3.4, depth=0.18))
    plat.location = (0, 0, 0.09)
    _link(plat, scene, plat_m)
    aro = mesh_obj('aro_luz', lambda bm: bmesh.ops.create_cone(bm, cap_ends=False, segments=96, radius1=3.43, radius2=3.43, depth=0.05))
    aro.location = (0, 0, 0.16)
    _link(aro, scene, luz_m)
    aro.parent = plat
    aro.location = (0, 0, 0.07)
    # Aros de luz en el suelo alrededor de la plataforma.
    for i, r in enumerate((4.2, 5.6)):
        ring = mesh_obj(f'anillo_suelo_{i}', lambda bm, r=r: bmesh.ops.create_cone(bm, cap_ends=False, segments=128, radius1=r, radius2=r, depth=0.012))
        ring.location = (0, 0, 0.006)
        _link(ring, scene, luz_m)

    # Fondo curvo (ciclorama) detrás, 200° alrededor, con tiras de luz verticales.
    def cyclo(bm):
        segs, ang0, ang1, R, H = 48, math.radians(-10), math.radians(190), 12.0, 7.5
        rows = []
        for k in range(segs + 1):
            a = ang0 + (ang1 - ang0) * k / segs
            x, y = R * math.cos(a), R * math.sin(a)
            rows.append((bm.verts.new((x, y, 0)), bm.verts.new((x, y, H))))
        for k in range(segs):
            bm.faces.new((rows[k][0], rows[k + 1][0], rows[k + 1][1], rows[k][1]))
    fondo = mesh_obj('fondo', cyclo)
    _link(fondo, scene, fondo_m)
    for i in range(13):
        a = math.radians(-5 + i * 15)
        tira = mesh_obj(f'tira_led_{i}', lambda bm: bmesh.ops.create_cube(bm, size=1.0))
        tira.scale = (0.06, 0.06, 6.4)
        tira.location = (11.85 * math.cos(a), 11.85 * math.sin(a), 3.6)
        tira.rotation_euler = (0, 0, a)
        _link(tira, scene, luz_m)

    # Aro de focos encima, con ocho focos que apuntan a la plataforma.
    truss = mesh_obj('aro_focos', lambda bm: bmesh.ops.create_cone(bm, cap_ends=False, segments=64, radius1=5.2, radius2=5.2, depth=0.22))
    truss.location = (0, 0, 6.6)
    _link(truss, scene, acero_m)
    for i in range(8):
        a = math.radians(i * 45 + 22.5)
        foco = mesh_obj(f'tl6_foco_{i}', lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.22, radius2=0.32, depth=0.55))
        x, y = 5.2 * math.cos(a), 5.2 * math.sin(a)
        foco.location = (x, y, 6.25)
        # Apunta al centro de la plataforma (el cono mira en -Z).
        direction = (-x, -y, 0.6 - 6.25)
        from mathutils import Vector
        foco.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
        _link(foco, scene, acero_m)
        lente = mesh_obj(f'tl6_lente_{i}', lambda bm: bmesh.ops.create_circle(bm, cap_ends=True, segments=20, radius=0.2))
        lente.parent = foco
        lente.location = (0, 0, -0.28)
        _link(lente, scene, luz_m)
    # Cada pieza con su nombre exacto (el juego busca «plataforma» y «tl6_foco_N»).
    for o in scene.collection.objects:
        base = o.name.split('.')[0]
        if o.name != base and base not in bpy.data.objects:
            o.name = base
    for o in scene.collection.objects:
        o.select_set(False)
    return {'objects': len(scene.collection.objects), 'tris': sum(len(o.data.polygons) for o in scene.collection.objects if o.type == 'MESH')}


def export_stage(path):
    scene = bpy.data.scenes[SCENE]
    window = bpy.context.window
    previous = window.scene
    window.scene = scene
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_active_scene=True, export_apply=True,
                                  export_yup=True, export_texcoords=False, export_normals=True, export_materials='EXPORT',
                                  export_cameras=False, export_lights=False, export_extras=True)
    finally:
        window.scene = previous
    return path
