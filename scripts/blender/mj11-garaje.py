# [MJ11, 20/11/2026] Escena del plan de carrera, hecha en Blender: el coche del juego en el garaje, con dos ingenieros
# junto a las pantallas y el piloto concentrado al lado del coche. Las figuras salen del mecánico del juego
# (public/models/mecanico.glb, hecho para el juego): los ingenieros con cascos de radio y polo del equipo, el piloto con
# su casco. Sin marcas: materiales lisos, pantallas con franjas de datos y el rojo del equipo.
# Se renderiza en tres capas (fondo, coche y personas) para moverlas un poco con CSS, como la portada de PF9.
# Uso desde el MCP de Blender:
#   exec(open(r'.../mj11-garaje.py').read()); build(car_glb, crew_glb); render(carpeta)
import bpy
import math
from mathutils import Vector

SCENE = 'MJ11_GARAJE'


def _mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Emission Strength'].default_value = strength
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1)
    return m


def _screen(name, tint, scale, distortion=5.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Y'
    wave.inputs['Scale'].default_value = scale
    wave.inputs['Distortion'].default_value = distortion
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.4
    ramp.color_ramp.elements[0].color = (tint[0] * 0.06, tint[1] * 0.06, tint[2] * 0.06, 1)
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = (*tint, 1)
    nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], emit.inputs['Color'])
    emit.inputs['Strength'].default_value = 3.0
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return m


def _table(name):
    """Pantalla de tiempos: filas y columnas (ladrillo) en azul y blanco, emisiva."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.offset = 0.0
    brick.inputs['Scale'].default_value = 9.0
    brick.inputs['Mortar Size'].default_value = 0.012
    brick.inputs['Brick Width'].default_value = 1.6
    brick.inputs['Row Height'].default_value = 0.18
    brick.inputs['Color1'].default_value = (0.04, 0.12, 0.25, 1)
    brick.inputs['Color2'].default_value = (0.6, 0.75, 0.9, 1)
    brick.inputs['Mortar'].default_value = (0.0, 0.0, 0.0, 1)
    nt.links.new(brick.outputs['Color'], emit.inputs['Color'])
    emit.inputs['Strength'].default_value = 2.2
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return m


def _timing(name, w=1024, h=420, rows=20):
    """Tabla de tiempos inventada: por fila, posición, color de equipo y barras claras como texto y tiempos."""
    import random
    rnd = random.Random(7)
    img = bpy.data.images.get(name) or bpy.data.images.new(name, w, h, alpha=False)
    px = [0.0] * (w * h * 4)
    def rect(x0, y0, x1, y1, c):
        for y in range(max(0, y0), min(h, y1)):
            for x in range(max(0, x0), min(w, x1)):
                k = (y * w + x) * 4
                px[k], px[k + 1], px[k + 2], px[k + 3] = c[0], c[1], c[2], 1.0
    rect(0, 0, w, h, (0.01, 0.02, 0.04))
    rect(0, h - 26, w, h, (0.5, 0.0, 0.02))
    team = [(0.8, 0.02, 0.02), (0.05, 0.2, 0.8), (0.9, 0.45, 0.0), (0.0, 0.6, 0.5), (0.85, 0.85, 0.85), (0.4, 0.1, 0.7)]
    rh = (h - 34) // rows
    for r in range(rows):
        y0 = h - 34 - (r + 1) * rh + 3
        y1 = y0 + rh - 6
        if r % 2 == 0:
            rect(0, y0 - 2, w, y1 + 2, (0.025, 0.04, 0.07))
        rect(10, y0, 34, y1, (0.75, 0.8, 0.9))
        rect(44, y0, 52, y1, team[r % len(team)])
        rect(62, y0, 62 + rnd.randint(70, 110), y1, (0.8, 0.85, 0.95))
        for c in range(5):
            x = 260 + c * 150
            rect(x, y0, x + rnd.randint(70, 110), y1, (0.2, 0.9, 0.4) if rnd.random() < 0.12 else (0.75, 0.3, 0.95) if rnd.random() < 0.06 else (0.6, 0.68, 0.8))
    img.pixels = px
    img.pack()
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], emit.inputs['Color'])
    emit.inputs['Strength'].default_value = 1.6
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return m


def _put(scene, obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def _box(coll, name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    _put(None, o, coll)
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def _cyl(coll, name, r, h, loc, mat, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    _put(None, o, coll)
    o.data.materials.clear()
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def _plane(coll, name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    _put(None, o, coll)
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def _coll(scene, name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in scene.collection.children:
        scene.collection.children.link(c)
    return c


def _import(path, coll):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]
    for o in imported:
        _put(None, o, coll)
    return imported


def _aim(obj, loc, target):
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


def _pose(arm, bones):
    """Rotaciones (grados, XYZ) de los huesos del mecánico."""
    for name, (x, y, z) in bones.items():
        pb = arm.pose.bones.get(name)
        if pb:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))


def _person(coll, crew_glb, name, loc, heading, bones, mats):
    objs = _import(crew_glb, coll)
    for o in objs:
        if o.type == 'MESH' and o.parent is None and not o.vertex_groups:
            bpy.data.objects.remove(o, do_unlink=True)   # restos del archivo que no son la figura
    arm = next(o for o in coll.objects if o.type == 'ARMATURE' and o.name.startswith('mecanico') and o.get('mj11') is None)
    arm['mj11'] = name
    arm.name = f'mj11_{name}'
    arm.location = loc
    arm.rotation_mode = 'XYZ'   # el glTF la trae en cuaternión: sin esto el giro no se aplica
    arm.rotation_euler = (0, 0, math.radians(heading))
    # Sin las animaciones del mecánico (traía la de correr): pose de reposo y después la propia.
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    _pose(arm, bones)
    body = next(c for c in arm.children if c.type == 'MESH')
    body.name = f'mj11_{name}_cuerpo'
    for slot in body.material_slots:
        base = slot.material.name.split('.')[0] if slot.material else ''
        if base in mats:
            slot.material = mats[base]
    return arm


def build(car_glb, crew_glb, scripts_dir=None):
    """scripts_dir: carpeta de los scripts de Blender (para el coche de carbono y los ingenieros)."""
    import os
    here = scripts_dir or os.path.dirname(car_glb).replace('public/models', 'scripts/blender')
    exec(open(os.path.join(here, 'mj10-carbono.py'), encoding='utf-8').read(), globals())
    exec(open(os.path.join(here, 'mj11-ingeniero.py'), encoding='utf-8').read(), globals())
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = scene
    for c in list(scene.collection.children):
        for o in list(c.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        scene.collection.children.unlink(c)
    for o in list(scene.collection.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    fondo = _coll(scene, 'mj11_fondo')
    coche = _coll(scene, 'mj11_coche')
    gente = _coll(scene, 'mj11_personas')

    suelo = _mat('mj11_suelo', (0.11, 0.11, 0.12), rough=0.14)
    pared = _mat('mj11_pared', (0.035, 0.035, 0.04), rough=0.6)
    panel = _mat('mj11_panel', (0.03, 0.03, 0.035), rough=0.35, metal=0.4)
    rojo = _mat('mj11_rojo', (0.55, 0.0, 0.01), rough=0.4, emit=(1.0, 0.03, 0.02), strength=3.0)
    luz = _mat('mj11_luz', (1, 1, 1), emit=(1.0, 0.92, 0.82), strength=10.0)
    armario = _mat('mj11_armario', (0.12, 0.12, 0.13), rough=0.3, metal=0.7)
    goma = _mat('mj11_goma', (0.02, 0.02, 0.022), rough=0.7)
    bandas = {c: _mat(f'mj11_banda_{c}', col, rough=0.5) for c, col in (('s', (0.8, 0.02, 0.02)), ('m', (0.9, 0.75, 0.0)), ('h', (0.85, 0.85, 0.85)))}

    # El box: suelo de resina brillante, paredes oscuras, techo con tiras de luz y la pared del fondo con la franja roja
    # del equipo y la pantalla grande de tiempos.
    _plane(fondo, 'mj11_suelo', (40, 30), (0, 0, 0), suelo)
    _box(fondo, 'mj11_fondo_pared', (16, 0.3, 6), (0, 6.5, 3), pared)
    _box(fondo, 'mj11_lat_i', (0.3, 16, 6), (-7.5, 0, 3), pared)
    _box(fondo, 'mj11_lat_d', (0.3, 16, 6), (7.5, 0, 3), pared)
    _box(fondo, 'mj11_techo', (16, 16, 0.2), (0, 0, 5.2), pared)
    _box(fondo, 'mj11_franja', (15, 0.05, 0.18), (0, 6.33, 1.2), rojo)
    _box(fondo, 'mj11_panel_fondo', (6.0, 0.08, 2.6), (1.0, 6.3, 2.9), panel)
    _plane(fondo, 'mj11_pantalla_grande', (5.6, 2.3), (1.0, 6.25, 2.9), _timing('mj11_tiempos'), rot=(math.radians(90), 0, 0))
    for i in range(4):
        _plane(fondo, f'mj11_tira_{i}', (10, 0.18), (0, -4 + i * 2.8, 5.09), luz, rot=(math.radians(180), 0, 0))
    # Armarios de herramientas a la derecha y pilas de neumáticos (con la banda de su compuesto) a la izquierda.
    for i in range(3):
        _box(fondo, f'mj11_armario_{i}', (1.2, 0.6, 1.0), (6.6, 3.8 - i * 1.4, 0.5), armario, rot=(0, 0, math.radians(90)))
        _box(fondo, f'mj11_cajon_{i}', (0.02, 1.1, 0.04), (6.28, 3.8 - i * 1.4, 0.75), rojo)
    for j, (x, y, band) in enumerate(((-6.4, 4.6, 's'), (-5.6, 4.6, 'm'), (-6.4, 3.8, 'h'), (-5.6, 3.8, 's'))):
        for k in range(4):
            _cyl(fondo, f'mj11_neumatico_{j}_{k}', 0.36, 0.36, (x, y, 0.18 + k * 0.37), goma)
            _cyl(fondo, f'mj11_banda_{j}_{k}', 0.362, 0.05, (x, y, 0.18 + k * 0.37 + 0.13), bandas[band])
    # El puesto de los ingenieros: mesa con tres pantallas, a la izquierda del coche.
    _box(fondo, 'mj11_mesa', (2.4, 0.8, 0.08), (-3.6, 1.6, 0.95), armario)
    _box(fondo, 'mj11_mesa_pata', (2.2, 0.6, 0.9), (-3.6, 1.6, 0.45), panel)
    for i, tint in enumerate(((0.2, 0.8, 0.5), (0.25, 0.6, 1.0), (1.0, 0.5, 0.1))):
        x = -4.4 + i * 0.8
        _box(fondo, f'mj11_monitor_{i}', (0.72, 0.05, 0.46), (x, 1.85, 1.35), panel, rot=(math.radians(-8), 0, 0))
        _plane(fondo, f'mj11_monitor_luz_{i}', (0.66, 0.4), (x, 1.82, 1.35), _screen(f'mj11_mon_{i}', tint, 3 + i), rot=(math.radians(82), 0, 0))

    # El coche del juego, tal cual, con las cuatro ruedas en el suelo.
    parts = _import(car_glb, coche)
    car = bpy.data.objects.new('mj11_coche', None)
    coche.objects.link(car)
    for o in parts:
        if o.parent is None:
            o.parent = car
    car.location = (1.0, -0.2, 0.003)
    car.rotation_euler = (0, 0, math.radians(-32))
    # [20/11/2026, el usuario] El coche de carbono en todas las escenas de Blender, no el de la librea roja.
    carbon_car(SCENE, os.path.join(os.path.dirname(os.path.dirname(here)), 'assets3d', 'maquetas', 'mj10-carbono.png'), car_name='mj11_coche')

    # Las personas: dos ingenieros en la mesa (cascos de radio y polo) y el piloto, concentrado, junto al coche.
    polo = _mat('mj11_polo', (0.5, 0.0, 0.01), rough=0.7)
    polo2 = _mat('mj11_polo2', (0.04, 0.04, 0.045), rough=0.7)
    cascos = _mat('mj11_cascos_radio', (0.03, 0.03, 0.03), rough=0.4)
    piel = _mat('mj11_piel', (0.55, 0.36, 0.26), rough=0.6)
    casco_piloto = _mat('mj11_casco_piloto', (0.85, 0.85, 0.88), rough=0.2, metal=0.2)
    visera = _mat('mj11_visera', (0.01, 0.01, 0.015), rough=0.05, metal=0.6)
    mono = _mat('mj11_mono_piloto', (0.55, 0.0, 0.01), rough=0.55)
    ingeniero = {'mono': polo, 'mono_secundario': polo2, 'casco': cascos, 'visera': piel, 'guantes': piel}
    piloto = {'mono': mono, 'mono_secundario': polo2, 'casco': casco_piloto, 'visera': visera, 'guantes': polo2}
    # Poses: brazos hacia la mesa en uno, brazo señalando la pantalla en otro; el piloto con la cabeza algo baja.
    # [20/11/2026, con las referencias del usuario] Ingenieros de muro propios (mj11-ingeniero.py): uno con su cuaderno
    # rojo junto al coche, mirando a cámara; otro de brazos cruzados mirando las pantallas.
    make_engineer(gente, 'ingeniero_1', 'cuaderno', (3.6, 0.9), 15)
    make_engineer(gente, 'ingeniero_2', 'brazos', (-4.5, 0.75), 205, shirt=(0.85, 0.85, 0.87))
    _person(gente, crew_glb, 'piloto', (2.3, 2.9, 0), 250, {'cabeza': (-18, 0, 0), 'brazo_l': (0, 0, 8), 'brazo_r': (0, 0, -8)}, piloto)

    # Luces: tiras del techo (cálidas), una caja de luz sobre el coche, recorte desde el fondo y relleno frío.
    def light(name, kind, loc, target, energy, color, size=1.0):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == 'AREA':
            d.size = size
        o = bpy.data.objects.new(name, d)
        fondo.objects.link(o)
        _aim(o, loc, target)
        return o
    light('mj11_cenital', 'AREA', (1.0, -0.2, 4.6), (1.0, -0.2, 0), 900, (1.0, 0.93, 0.85), size=5)
    light('mj11_recorte', 'AREA', (-2, 5.5, 3.5), (1.0, -0.2, 0.5), 700, (0.75, 0.85, 1.0), size=4)
    light('mj11_relleno', 'AREA', (6, -6, 2.5), (1.0, -0.2, 0.6), 500, (0.9, 0.92, 1.0), size=5)

    world = bpy.data.worlds.get('mj11_mundo') or bpy.data.worlds.new('mj11_mundo')
    world.use_nodes = True
    nt = world.node_tree
    bg = next((n for n in nt.nodes if n.type == 'BACKGROUND'), None)
    if bg is None:
        bg = nt.nodes.new('ShaderNodeBackground')
        wout = next((n for n in nt.nodes if n.type == 'OUTPUT_WORLD'), None) or nt.nodes.new('ShaderNodeOutputWorld')
        nt.links.new(bg.outputs['Background'], wout.inputs['Surface'])
    bg.inputs['Color'].default_value = (0.01, 0.01, 0.014, 1)
    scene.world = world

    cam_d = bpy.data.cameras.new('mj11_cam')
    cam_d.dof.use_dof = True
    cam_d.dof.focus_object = car
    cam_d.dof.aperture_fstop = 4.0
    cam = bpy.data.objects.new('mj11_cam', cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    frame(scene, 'desk')

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 256
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    return {'objects': len(scene.objects)}


def frame(scene, which):
    cam = scene.camera
    if which == 'desk':
        scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
        cam.data.lens = 30
        cam.data.shift_x, cam.data.shift_y = -0.16, 0.02
        _aim(cam, (4.5, -8.0, 1.7), (0.2, 0.8, 1.0))
    else:
        scene.render.resolution_x, scene.render.resolution_y = 1080, 1920
        cam.data.lens = 26
        cam.data.shift_x, cam.data.shift_y = 0.0, -0.14
        _aim(cam, (3.5, -8.5, 1.8), (0.0, 0.8, 1.0))


def render(folder, which=('desk', 'mob'), samples=None, layers=True):
    """Tres capas por encuadre: fondo (todo menos coche y personas), coche y personas (con transparencia)."""
    scene = bpy.data.scenes[SCENE]
    if samples:
        scene.cycles.samples = samples
    out = {}
    colls = {c.name: c for c in scene.collection.children}
    for w in which:
        frame(scene, w)
        scene.render.resolution_percentage = 100
        passes = [('todo', None)] if not layers else [('fondo', 'mj11_fondo'), ('coche', 'mj11_coche'), ('personas', 'mj11_personas')]
        for name, only in passes:
            vl = scene.view_layers[0]
            for c in vl.layer_collection.children:
                c.holdout = only is not None and c.name != only and name != 'fondo'
                # [20/11/2026] En el fondo el coche no se ve, pero deja su sombra (el juego pone encima el coche con la
                # livery del jugador, en directo); las personas no salen.
                c.exclude = only is not None and name == 'fondo' and c.name == 'mj11_personas'
            for o in colls['mj11_coche'].all_objects:
                hide = name == 'fondo'
                o.visible_camera = not hide
                o.visible_glossy = not hide
                o.visible_diffuse = not hide
                o.visible_transmission = not hide
            scene.render.film_transparent = name != 'fondo' and only is not None
            scene.render.filepath = f'{folder}/mj11-{w}-{name}.png'
            bpy.ops.render.render(write_still=True, scene=scene.name)
            out[f'{w}-{name}'] = scene.render.filepath
        for c in scene.view_layers[0].layer_collection.children:
            c.holdout = False
            c.exclude = False
        for o in colls['mj11_coche'].all_objects:
            o.visible_camera = o.visible_glossy = o.visible_diffuse = o.visible_transmission = True
        scene.render.film_transparent = False
    return out
