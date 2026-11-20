# [MJ10, 20/11/2026] Fondo de la primera configuración, hecho en Blender (el usuario pide «Escena nueva de Blender»): el
# muro de boxes de noche con el coche del juego en el pit lane, las pantallas del muro encendidas y el garaje iluminado
# detrás. Sin marcas: materiales lisos y pantallas con franjas de datos inventadas. El coche es el del juego tal cual.
# Uso desde el MCP de Blender:
#   exec(open(r'.../scripts/blender/mj10-muro.py').read()); build(r'.../public/models/f1-car.glb'); render(r'.../carpeta')
import bpy
import math

SCENE = 'MJ10_MURO'


def _mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
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


def _screen_mat(name, tint, seed):
    """Pantalla del muro: franjas de datos (ruido estirado) sobre un tono, emisivas."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    tex = nt.nodes.new('ShaderNodeTexWave')
    tex.wave_type = 'BANDS'
    tex.bands_direction = 'Y'
    tex.inputs['Scale'].default_value = 3.0 + seed
    tex.inputs['Distortion'].default_value = 6.0
    tex.inputs['Detail'].default_value = 2.0
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1.0, 1.0, 1.0)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = (tint[0] * 0.08, tint[1] * 0.08, tint[2] * 0.08, 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (*tint, 1)
    nt.links.new(coord.outputs['UV'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], emit.inputs['Color'])
    emit.inputs['Strength'].default_value = 3.5
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return m


def _box(scene, name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    for c in o.users_collection:
        c.objects.unlink(o)
    scene.collection.objects.link(o)
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def _plane(scene, name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    for c in o.users_collection:
        c.objects.unlink(o)
    scene.collection.objects.link(o)
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def build(car_glb):
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    for o in list(scene.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.window.scene = scene

    asfalto = _mat('mj10_asfalto', (0.025, 0.026, 0.03), rough=0.22, metal=0.0)
    hormigon = _mat('mj10_hormigon', (0.16, 0.16, 0.17), rough=0.75)
    acero = _mat('mj10_acero', (0.12, 0.125, 0.135), rough=0.35, metal=0.9)
    negro = _mat('mj10_negro', (0.01, 0.01, 0.012), rough=0.5)
    raya = _mat('mj10_raya', (0.85, 0.85, 0.85), rough=0.5)
    rojo = _mat('mj10_rojo', (0.6, 0.0, 0.01), rough=0.5, emit=(1.0, 0.02, 0.02), strength=4.0)
    garaje_luz = _mat('mj10_garaje_luz', (1, 1, 1), emit=(1.0, 0.82, 0.6), strength=30.0)
    garaje = _mat('mj10_garaje', (0.06, 0.06, 0.07), rough=0.6)
    tira = _mat('mj10_tira', (1, 1, 1), emit=(0.85, 0.92, 1.0), strength=14.0)

    # Suelo del pit lane, mojado (poca rugosidad): refleja las luces.
    _plane(scene, 'mj10_suelo', (240, 160), (0, 0, 0), asfalto)
    # Línea blanca del carril rápido y la del borde del box.
    _plane(scene, 'mj10_linea_a', (80, 0.18), (0, -2.6, 0.005), raya)
    _plane(scene, 'mj10_linea_b', (80, 0.18), (0, 3.4, 0.005), raya)

    # El muro de boxes (izquierda de la imagen, delante): hormigón, con su soporte de acero y las pantallas.
    _box(scene, 'mj10_muro', (28, 0.6, 1.1), (-6, -5.2, 0.55), hormigon)
    _box(scene, 'mj10_muro_borde', (28, 0.08, 0.06), (-6, -4.88, 1.05), rojo)
    for i in range(5):
        x = -14 + i * 3.2
        _box(scene, f'mj10_soporte_{i}', (0.08, 0.08, 1.4), (x, -5.0, 1.8), acero)
        _box(scene, f'mj10_marco_{i}', (1.5, 0.12, 0.9), (x, -4.92, 2.35), negro)
        tint = [(0.1, 0.55, 1.0), (0.0, 0.9, 0.55), (1.0, 0.45, 0.05), (0.1, 0.55, 1.0), (0.9, 0.1, 0.15)][i]
        _plane(scene, f'mj10_pantalla_{i}', (1.38, 0.78), (x, -4.855, 2.35), _screen_mat(f'mj10_pantalla_mat_{i}', tint, i * 1.7), rot=(math.radians(90), 0, 0))
    _box(scene, 'mj10_techo_muro', (17, 1.4, 0.06), (-8, -4.9, 3.0), acero)

    # Los garajes (al fondo): fachada con huecos de verdad; dentro, pared del fondo con su panel, techo con luces cálidas y
    # el suelo claro del box (así hay profundidad, no un plano blanco).
    interior = _mat('mj10_interior', (0.42, 0.36, 0.3), rough=0.55)
    panel = _mat('mj10_panel', (0.05, 0.05, 0.06), rough=0.4, metal=0.3)
    franja = _mat('mj10_franja', (0.7, 0.0, 0.02), rough=0.4, emit=(1.0, 0.04, 0.03), strength=2.5)
    suelo_box = _mat('mj10_suelo_box', (0.42, 0.42, 0.44), rough=0.18)
    _box(scene, 'mj10_fachada_alta', (64, 0.5, 3.4), (0, 9.5, 5.3), garaje)
    _box(scene, 'mj10_fondo', (64, 0.3, 7), (0, 15.5, 3.5), interior)
    _box(scene, 'mj10_techo_box', (64, 6.0, 0.2), (0, 12.5, 3.6), interior)
    _plane(scene, 'mj10_suelo_boxes', (64, 6.0), (0, 12.5, 0.004), suelo_box)
    for i in range(7):
        x = -19.5 + i * 6.5
        _box(scene, f'mj10_pilar_{i}', (1.3, 6.4, 3.6), (x, 12.5, 1.8), garaje)
    for i in range(6):
        x = -16.25 + i * 6.5
        _box(scene, f'mj10_panel_{i}', (4.4, 0.08, 2.2), (x, 15.3, 1.9), panel)
        _box(scene, f'mj10_franja_{i}', (4.4, 0.09, 0.12), (x, 15.28, 1.0), franja)
        for k in range(3):
            _plane(scene, f'mj10_luz_box_{i}_{k}', (4.2, 0.25), (x, 10.8 + k * 1.6, 3.49), garaje_luz, rot=(math.radians(180), 0, 0))
    _box(scene, 'mj10_marquesina', (60, 2.2, 0.15), (0, 8.4, 4.4), acero)
    for i in range(10):
        _plane(scene, f'mj10_tira_{i}', (2.4, 0.08), (-18 + i * 4, 7.6, 4.32), tira, rot=(math.radians(180), 0, 0))

    # El coche del juego, tal cual (sin cambiar su forma), en el pit lane, de tres cuartos.
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=car_glb)
    imported = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in imported if o.parent is None]
    for o in imported:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        scene.collection.objects.link(o)
    car = bpy.data.objects.new('mj10_coche', None)
    scene.collection.objects.link(car)
    for r in roots:
        r.parent = car
    # Las cuatro ruedas apoyadas: su punto más bajo queda a 7,6-8,3 cm del origen del coche (20/11/2026: la trasera volaba).
    car.location = (1.2, 0.4, 0.003)
    car.rotation_euler = (0, 0, math.radians(-28))

    # Luces: luna fría de contra, foco cálido del garaje y un relleno suave; cielo casi negro azulado.
    def light(name, kind, loc, rot, energy, color, size=1.0):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == 'AREA':
            d.size = size
        if kind == 'SPOT':
            d.spot_size = math.radians(60)
            d.spot_blend = 0.6
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        scene.collection.objects.link(o)
        return o
    from mathutils import Vector

    def aimed(name, kind, loc, target, energy, color, size=1.0):
        o = light(name, kind, loc, (0, 0, 0), energy, color, size)
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o
    # Clave: caja de luz delante y a la derecha del coche; cenital fría encima; recorte cálido desde los garajes; el rojo
    # del muro, que tiñe el suelo mojado.
    aimed('mj10_clave', 'AREA', (8.5, -5.5, 3.2), (1.5, 0.3, 0.5), 1400, (1.0, 0.96, 0.92), size=4)
    aimed('mj10_cenital', 'AREA', (1.5, 0.3, 6.5), (1.5, 0.3, 0), 450, (0.8, 0.88, 1.0), size=4)
    aimed('mj10_recorte', 'SPOT', (-1.5, 8.0, 3.2), (1.5, 0.0, 0.6), 2600, (1.0, 0.78, 0.55))
    aimed('mj10_contra', 'AREA', (-8, 4, 6), (1.5, 0.3, 0.5), 700, (0.6, 0.75, 1.0), size=6)
    light('mj10_rojo', 'POINT', (-4, -4.4, 1.3), (0, 0, 0), 350, (1.0, 0.05, 0.05))
    # Niebla ligera: los haces de luz y la profundidad.
    niebla = bpy.data.materials.get('mj10_niebla') or bpy.data.materials.new('mj10_niebla')
    niebla.use_nodes = True
    nn = niebla.node_tree
    nn.nodes.clear()
    vout = nn.nodes.new('ShaderNodeOutputMaterial')
    vol = nn.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = 0.0025
    vol.inputs['Color'].default_value = (0.75, 0.8, 0.9, 1)
    nn.links.new(vol.outputs['Volume'], vout.inputs['Volume'])
    caja = _box(scene, 'mj10_niebla', (90, 60, 10), (0, 2, 4.0), niebla)
    caja.visible_shadow = False

    world = bpy.data.worlds.get('mj10_mundo') or bpy.data.worlds.new('mj10_mundo')
    world.use_nodes = True
    nt = world.node_tree
    bg = next((n for n in nt.nodes if n.type == 'BACKGROUND'), None)
    if bg is None:
        bg = nt.nodes.new('ShaderNodeBackground')
        wout = next((n for n in nt.nodes if n.type == 'OUTPUT_WORLD'), None) or nt.nodes.new('ShaderNodeOutputWorld')
        nt.links.new(bg.outputs['Background'], wout.inputs['Surface'])
    bg.inputs['Color'].default_value = (0.004, 0.006, 0.012, 1)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world

    # Cámara baja, de tres cuartos, con el coche a la derecha y sitio a la izquierda para el panel.
    cam_d = bpy.data.cameras.new('mj10_cam')
    cam_d.lens = 35
    cam_d.dof.use_dof = True
    cam_d.dof.focus_object = car
    cam_d.dof.aperture_fstop = 4.0
    cam = bpy.data.objects.new('mj10_cam', cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    _aim(cam, (13, -2.6, 1.3), (1.5, 0.3, 0.6))

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 256
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.render.film_transparent = False
    return {'objects': len(scene.collection.all_objects), 'car_parts': len(imported)}


def _aim(cam, loc, target):
    from mathutils import Vector
    cam.location = loc
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def render(folder, which=('desk', 'mob'), samples=None):
    scene = bpy.data.scenes[SCENE]
    if samples:
        scene.cycles.samples = samples
    cam = scene.camera
    out = {}
    for w in which:
        # Escritorio: el coche a la derecha (el panel va a la izquierda). Móvil: el coche arriba (el panel va abajo).
        if w == 'desk':
            scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
            cam.data.lens = 35
            cam.data.shift_x, cam.data.shift_y = -0.2, 0.0
            _aim(cam, (13, -2.6, 1.3), (1.5, 0.3, 0.6))
        else:
            scene.render.resolution_x, scene.render.resolution_y = 1080, 1920
            cam.data.lens = 34
            cam.data.shift_x, cam.data.shift_y = 0.04, -0.16
            _aim(cam, (11, -1.8, 1.5), (1.5, 0.3, 0.6))
        scene.render.resolution_percentage = 100
        scene.render.filepath = f'{folder}/mj10-{w}.png'
        bpy.ops.render.render(write_still=True, scene=scene.name)
        out[w] = scene.render.filepath
    return out
