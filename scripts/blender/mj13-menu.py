# [MJ13, 20/11/2026] Imágenes nuevas del menú (el usuario: el coche del box de Temporada «tiene las ruedas que están
# mal… cambiarlo por algo que realmente parezca un coche de Fórmula 1»):
#  - temporada: el coche detallado de la landing (escena VS6, el que se desmonta) en un box, sin el morro, con el morro y
#    el alerón delantero en su carrito de morros, como en las fotos de garaje; un ingeniero con su cuaderno al lado.
#  - multijugador: ese coche y el de carbono, rivales en el pit lane de noche (la escena del muro de MJ10).
#  - desafio: el coche de carbono en un plató oscuro con el infinito en neón y «2023 →» (la idea de las maquetas del
#    Desafío, MD). Sin marcas reales. Todas a 1600 x 900, con el motivo en el centro (el menú recorta por la izquierda).
# Uso desde el MCP de Blender (con el .blend que tiene la escena VS6 abierto):
#   exec(open(r'.../mj13-menu.py').read()); setup(r'<raíz del repo>'); build_temporada(); render_scene('MJ13_TEMPORADA', carpeta)
import bpy
import math
import os
from mathutils import Vector

ROOT = None


def setup(root):
    """Carga los ayudantes de las otras escenas (materiales, cajas, ingenieros, coche de carbono)."""
    global ROOT
    ROOT = root
    sb = os.path.join(root, 'scripts', 'blender')
    for f in ('mj11-garaje.py', 'mj11-ingeniero.py', 'mj10-carbono.py'):
        exec(open(os.path.join(sb, f), encoding='utf-8').read(), globals())


def _new_scene(name):
    sc = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = sc
    for c in list(sc.collection.children):
        for o in list(c.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        sc.collection.children.unlink(c)
    for o in list(sc.collection.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 128
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1600, 900, 100
    return sc


def vs6_car(coll, name, loc, heading, skip=()):
    """Copia del coche de la landing (las mallas se comparten; la escena VS6 no se toca), en `loc` y girado `heading`."""
    root = bpy.data.objects.new(f'mj13_{name}', None)
    coll.objects.link(root)
    for o in bpy.data.collections['VS6_coche'].objects:
        if o.type != 'MESH' or o.name.replace('vs6_', '') in skip:
            continue
        c = o.copy()
        c.name = f'mj13_{name}_{o.name}'
        coll.objects.link(c)
        c.parent = root
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(heading))
    return root


# [20/11/2026, el usuario: el coche de la landing «está pintado… de negro y rojo… feísimo» y sus llantas no llevan
# tapacubos; «quiero ver el alerón de frente y… el coche de frente»] El coche es el del juego (el de 2025, con tapacubos),
# pintado con una livery de equipo, y el morro se separa de la carrocería para dejarlo en el carrito.
PAPAYA = ((1.0, 0.22, 0.0), (0.012, 0.02, 0.035))
NOSE_CUT_X = 2.15   # donde la landing separa el morro (y el alerón delantero) del monocasco


def _split_nose(body):
    """Corta la carrocería en x = NOSE_CUT_X, separa lo de delante (morro y alerón) y cierra los dos huecos."""
    import bmesh
    me = body.data
    bm = bmesh.new()
    bm.from_mesh(me)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(NOSE_CUT_X, 0, 0), plane_no=(1, 0, 0))
    front = [f for f in bm.faces if f.calc_center_median().x > NOSE_CUT_X]
    nose_bm = bmesh.new()
    # Copia de la parte delantera a otra malla.
    vmap = {}
    for f in front:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = nose_bm.verts.new(v.co)
            vs.append(vmap[v])
        try:
            nf = nose_bm.faces.new(vs)
            nf.material_index = f.material_index
            nf.smooth = f.smooth
        except ValueError:
            pass
    bmesh.ops.delete(bm, geom=front, context='FACES')
    for b in (bm, nose_bm):
        edges = [e for e in b.edges if e.is_boundary]
        if edges:
            bmesh.ops.holes_fill(b, edges=edges, sides=0)
    bm.to_mesh(me)
    bm.free()
    nose_me = bpy.data.meshes.new(body.name + '_morro')
    nose_bm.to_mesh(nose_me)
    nose_bm.free()
    for m in me.materials:
        nose_me.materials.append(m)
    nose = bpy.data.objects.new(body.name + '_morro', nose_me)
    return nose


def game_car(coll, name, loc, heading, livery=PAPAYA, split_nose=False, carbon=False):
    """El coche del juego con la livery (primario, secundario) y sin pegatinas; con split_nose, devuelve también el morro."""
    parts = _import(os.path.join(ROOT, 'public', 'models', 'f1-car.glb'), coll)
    root = bpy.data.objects.new(f'mj13_{name}', None)
    coll.objects.link(root)
    for o in parts:
        if o.parent is None:
            o.parent = root
    prim = _mat(f'mj13_{name}_primario', livery[0], rough=0.28, metal=0.15)
    sec = _mat(f'mj13_{name}_secundario', livery[1], rough=0.32, metal=0.2)
    body = None
    for o in parts:
        if o.type != 'MESH':
            continue
        if o.name.startswith('decal_'):
            o.hide_render = True
            continue
        if o.name.startswith('body'):
            body = o
        for slot in o.material_slots:
            base = slot.material.name.split('.')[0] if slot.material else ''
            if base == 'paint_primary':
                slot.material = prim
            elif base == 'paint_secondary':
                slot.material = sec
    # [20/11/2026, el usuario: «esos parches negros no tienen sentido. Son feos. Quítalos»] La carrocería que el modelo trae
    # en carbono (manchas negras por arriba) va con la livery; solo el suelo, por debajo de 18 cm, sigue de carbono.
    if body is not None:
        mats = body.data.materials
        for i, m in enumerate(list(mats)):
            if m and m.name.split('.')[0] == 'carbon':
                if prim.name not in [x.name for x in mats if x]:
                    mats.append(prim)
                pi = [x.name if x else '' for x in mats].index(prim.name)
                for p in body.data.polygons:
                    if p.material_index == i and p.center.z > 0.18:
                        p.material_index = pi
    # [20/11/2026, el usuario: «no pongas el McLaren… Pon el coche de fibra de carbono»] Con carbon, todo el coche de
    # carbono (antes de separar el morro, para que el morro lo sea también).
    if carbon:
        carbon_car(bpy.context.scene.name, os.path.join(ROOT, 'assets3d', 'maquetas', 'mj10-carbono.png'), car_name=root.name)
    nose = None
    if split_nose and body is not None:
        nose = _split_nose(body)
        coll.objects.link(nose)
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(heading))
    return root, nose


def nose_trolley(coll, loc, heading, nose=None):
    """Carrito de morros: bastidor de tubos con cuatro ruedas, dos cunas acolchadas y el morro con su alerón encima."""
    steel = _mat('mj13_carro', (0.55, 0.56, 0.6), rough=0.3, metal=0.9)
    pad = _mat('mj13_acolchado', (0.02, 0.02, 0.025), rough=0.8)
    caster = _mat('mj13_ruedecilla', (0.03, 0.03, 0.03), rough=0.6)
    root = bpy.data.objects.new('mj13_carro_morro', None)
    coll.objects.link(root)
    parts = []
    for x in (-0.7, 0.7):
        parts.append(_box(coll, f'mj13_carro_largo_{x}', (0.04, 1.1, 0.04), (x * 0.5, 0, 0.18), steel))
    for y in (-0.5, 0.5):
        parts.append(_box(coll, f'mj13_carro_ancho_{y}', (0.74, 0.04, 0.04), (0, y, 0.18), steel))
        for x in (-0.33, 0.33):
            parts.append(_box(coll, f'mj13_carro_poste_{x}_{y}', (0.035, 0.035, 0.42), (x, y, 0.39), steel))
            parts.append(_cyl(coll, f'mj13_carro_rueda_{x}_{y}', 0.06, 0.04, (x, y, 0.06), caster, rot=(0, math.radians(90), 0), verts=16))
        parts.append(_box(coll, f'mj13_carro_cuna_{y}', (0.8, 0.12, 0.06), (0, y * 0.8, 0.62), pad))
    for p in parts:
        p.parent = root
    # El morro con el alerón delantero, apoyado en las cunas, con el alerón a lo ancho (se ve de frente como en el coche).
    if nose is None:
        nose = bpy.data.objects['vs6_ala_delantera'].copy()
        coll.objects.link(nose)
    nose.name = 'mj13_morro'
    nose.parent = root
    # Malla en las coordenadas del coche (x de 2,15 a 3,16): girada 90° queda a lo largo del carrito, centrada en las cunas.
    nose.rotation_euler = (0, 0, math.radians(-90))
    nose.location = (0.0, 2.66, 0.56)
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(heading))
    return root


def build_temporada():
    sc = _new_scene('MJ13_TEMPORADA')
    fondo = _coll(sc, 'mj13_t_fondo')
    suelo = _mat('mj11_suelo', (0.11, 0.11, 0.12), rough=0.14)
    pared = _mat('mj11_pared', (0.035, 0.035, 0.04), rough=0.6)
    panel = _mat('mj11_panel', (0.03, 0.03, 0.035), rough=0.35, metal=0.4)
    rojo = _mat('mj11_rojo', (0.55, 0.0, 0.01), rough=0.4, emit=(1.0, 0.03, 0.02), strength=3.0)
    luz = _mat('mj11_luz', (1, 1, 1), emit=(1.0, 0.92, 0.82), strength=10.0)
    armario = _mat('mj11_armario', (0.12, 0.12, 0.13), rough=0.3, metal=0.7)
    goma = _mat('mj11_goma', (0.02, 0.02, 0.022), rough=0.7)
    manta = _mat('mj13_manta', (0.45, 0.02, 0.03), rough=0.85)
    _plane(fondo, 'mj13_suelo', (40, 30), (0, 0, 0), suelo)
    _box(fondo, 'mj13_fondo', (16, 0.3, 6), (0, 5.5, 3), pared)
    _box(fondo, 'mj13_lat_i', (0.3, 16, 6), (-7.0, 0, 3), pared)
    _box(fondo, 'mj13_lat_d', (0.3, 16, 6), (7.0, 0, 3), pared)
    _box(fondo, 'mj13_techo', (16, 16, 0.2), (0, 0, 5.2), pared)
    _box(fondo, 'mj13_franja', (14, 0.05, 0.18), (0, 5.33, 1.2), rojo)
    _box(fondo, 'mj13_panel_fondo', (5.2, 0.08, 2.3), (0, 5.3, 2.9), panel)
    _plane(fondo, 'mj13_tiempos', (4.9, 2.05), (0, 5.25, 2.9), _timing('mj11_tiempos'), rot=(math.radians(90), 0, 0))
    for i in range(4):
        _plane(fondo, f'mj13_tira_{i}', (9, 0.18), (0, -4 + i * 2.6, 5.09), luz, rot=(math.radians(180), 0, 0))
    for i in range(3):
        _box(fondo, f'mj13_armario_{i}', (1.2, 0.6, 1.0), (6.3, 3.6 - i * 1.4, 0.5), armario, rot=(0, 0, math.radians(90)))
        _box(fondo, f'mj13_cajon_{i}', (0.02, 1.1, 0.04), (5.98, 3.6 - i * 1.4, 0.75), rojo)
    # Juegos de neumáticos con su manta térmica, en pila, a la izquierda.
    for j, (x, y) in enumerate(((-5.9, 4.3), (-5.1, 4.3), (-5.9, 3.5))):
        for k in range(3):
            _cyl(fondo, f'mj13_neumatico_{j}_{k}', 0.36, 0.36, (x, y, 0.18 + k * 0.37), goma)
            _cyl(fondo, f'mj13_manta_{j}_{k}', 0.37, 0.3, (x, y, 0.18 + k * 0.37), manta)
    # El coche de carbono sin el morro, de frente a la cámara; el morro, de frente en su carrito, delante
    # a la izquierda; el ingeniero con su cuaderno, a la derecha.
    _root, nose = game_car(fondo, 'coche', (2.2, 1.6, 0.003), -100, split_nose=True, carbon=True)
    nose_trolley(fondo, (-0.2, -1.5, 0), -10, nose=nose)
    make_engineer(fondo, 'ing_temporada', 'cuaderno', (4.6, -0.6), 25)
    for name, kind, loc, target, energy, color, size in (
        ('mj13_t_cenital', 'AREA', (0, 0.5, 4.6), (0, 0.5, 0), 900, (1.0, 0.93, 0.85), 5),
        ('mj13_t_recorte', 'AREA', (-3, 5, 3.5), (0, 0.5, 0.5), 700, (0.75, 0.85, 1.0), 4),
        ('mj13_t_relleno', 'AREA', (5, -6, 2.5), (0, 0, 0.6), 500, (0.9, 0.92, 1.0), 5)):
        _light(fondo, name, kind, loc, target, energy, color, size)
    _world(sc, (0.01, 0.01, 0.014))
    _camera(sc, (1.2, -8.0, 1.75), (1.2, 0.0, 0.55), 34)
    return sc


def build_multijugador():
    """La escena del muro de MJ10 con dos coches: el de carbono y, por delante, el de la landing."""
    # Se carga aparte: el script del muro tiene ayudantes con los mismos nombres y otros argumentos.
    ns = {}
    exec(open(os.path.join(ROOT, 'scripts', 'blender', 'mj10-muro.py'), encoding='utf-8').read(), ns)
    ns['SCENE'] = SCENE = 'MJ13_MULTI'
    ns['build'](os.path.join(ROOT, 'public', 'models', 'f1-car.glb'))
    sc = bpy.data.scenes[SCENE]
    # El vacío del coche puede llamarse «mj10_coche.001» si la escena de MJ10 sigue en el archivo.
    car = next(o for o in sc.objects if o.name.startswith('mj10_coche') and o.type == 'EMPTY')
    carbon_car(SCENE, os.path.join(ROOT, 'assets3d', 'maquetas', 'mj10-carbono.png'), car_name=car.name)
    car.location = (0.4, 1.9, 0.003)
    coll = sc.collection
    game_car(coll, 'rival', (2.6, -1.3, 0.003), -28, carbon=True)
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1600, 900, 100
    sc.camera.data.lens = 38
    sc.camera.data.shift_x = sc.camera.data.shift_y = 0.0
    _aim(sc.camera, (12.0, -4.4, 1.4), (1.2, 0.2, 0.6))
    return sc


def _lemniscate(coll, name, center, size, mat, bevel=0.06):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = 4
    sp = cu.splines.new('POLY')
    pts = []
    for k in range(240):
        t = k / 240 * 2 * math.pi
        d = 1 + math.sin(t) ** 2
        pts.append((size * math.cos(t) / d, 0, size * math.sin(t) * math.cos(t) / d))
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (co[0], co[1], co[2], 1)
    sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    o.location = center
    o.data.materials.append(mat)
    return o


def build_desafio():
    sc = _new_scene('MJ13_DESAFIO')
    coll = _coll(sc, 'mj13_d')
    suelo = _mat('mj13_d_suelo', (0.015, 0.015, 0.02), rough=0.08, metal=0.2)
    pared = _mat('mj13_d_pared', (0.01, 0.01, 0.014), rough=0.7)
    neon = _mat('mj13_neon', (1, 0.1, 0.15), emit=(1.0, 0.06, 0.12), strength=40.0)
    neon2 = _mat('mj13_neon_blanco', (1, 1, 1), emit=(1.0, 0.95, 0.92), strength=14.0)
    _plane(coll, 'mj13_d_suelo', (40, 30), (0, 0, 0), suelo)
    _box(coll, 'mj13_d_fondo', (30, 0.3, 12), (0, 6.5, 6), pared)
    _lemniscate(coll, 'mj13_infinito', (0, 6.2, 3.4), 3.6, neon, bevel=0.07)
    # «2023 →» en neón blanco, abajo a la izquierda del infinito: el modo empieza en 2023 y no acaba.
    bpy.ops.object.text_add(location=(-7.0, 6.25, 3.05), rotation=(math.radians(90), 0, 0))
    txt = bpy.context.active_object
    for c in list(txt.users_collection):
        c.objects.unlink(txt)
    coll.objects.link(txt)
    txt.data.body = '2023 →'
    txt.data.size = 0.9
    txt.data.extrude = 0.02
    txt.data.materials.append(neon2)
    # Coche de carbono en el centro, con las cuatro ruedas en el suelo.
    parts = _import(os.path.join(ROOT, 'public', 'models', 'f1-car.glb'), coll)
    car = bpy.data.objects.new('mj13_d_coche', None)
    coll.objects.link(car)
    for o in parts:
        if o.parent is None:
            o.parent = car
    car.location = (0.0, -0.6, 0.003)
    car.rotation_euler = (0, 0, math.radians(-25))
    carbon_car(sc.name, os.path.join(ROOT, 'assets3d', 'maquetas', 'mj10-carbono.png'), car_name='mj13_d_coche')
    _light(coll, 'mj13_d_cenital', 'AREA', (0.4, 0.2, 5), (0.4, 0.2, 0), 600, (1.0, 0.95, 0.92), 4)
    _light(coll, 'mj13_d_recorte', 'AREA', (-4, 5, 2.5), (0.4, 0.2, 0.5), 500, (1.0, 0.3, 0.35), 4)
    _light(coll, 'mj13_d_relleno', 'AREA', (6, -6, 2), (0.4, 0.2, 0.5), 300, (0.85, 0.9, 1.0), 5)
    _world(sc, (0.004, 0.004, 0.006))
    _camera(sc, (3.2, -8.2, 1.35), (0.0, 1.5, 1.55), 30)
    return sc


def _light(coll, name, kind, loc, target, energy, color, size=1.0):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if kind == 'AREA':
        d.size = size
    o = bpy.data.objects.new(name, d)
    coll.objects.link(o)
    _aim(o, loc, target)
    return o


def _world(sc, color):
    w = bpy.data.worlds.get(f'{sc.name}_mundo') or bpy.data.worlds.new(f'{sc.name}_mundo')
    w.use_nodes = True
    nt = w.node_tree
    bg = next((n for n in nt.nodes if n.type == 'BACKGROUND'), None)
    if bg is None:
        bg = nt.nodes.new('ShaderNodeBackground')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_WORLD'), None) or nt.nodes.new('ShaderNodeOutputWorld')
        nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    bg.inputs['Color'].default_value = (*color, 1)
    sc.world = w


def _camera(sc, loc, target, lens):
    cd = bpy.data.cameras.new(f'{sc.name}_cam')
    cd.lens = lens
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 5.6
    cd.dof.focus_distance = (Vector(target) - Vector(loc)).length
    cam = bpy.data.objects.new(f'{sc.name}_cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    _aim(cam, loc, target)


def render_scene(name, folder, out_name, samples=128, percentage=100):
    sc = bpy.data.scenes[name]
    sc.cycles.samples = samples
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.resolution_percentage = percentage
    sc.render.filepath = os.path.join(folder, out_name)
    bpy.ops.render.render(write_still=True, scene=name)
    return sc.render.filepath
