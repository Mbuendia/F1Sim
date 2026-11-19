# [MD, maquetas del 16/11/2026] Escenas del modo Desafío para las maquetas: la sala de votación del reglamento, el
# periódico y la imagen del Desafío en el menú. Cada función crea su propia escena (no toca las demás) y deja la cámara
# lista; se renderizan con Eevee a 1920×1080. Se ejecuta dentro de Blender: exec(open(ruta).read()); build_voto() …
import bpy, math
from mathutils import Vector

TEAMS = [  # (id, color) en el orden de la parrilla del juego
    ('mclaren', '#FF8000'), ('redbull', '#2a4a9a'), ('ferrari', '#E8002D'), ('mercedes', '#27F4D2'),
    ('astonmartin', '#229971'), ('williams', '#005AFF'), ('racingbulls', '#1634CC'), ('haas', '#E8E8E8'),
    ('alpine', '#FF87BC'), ('sauber', '#52E252'),
]
RED = '#e10600'


def rgb(hexcode, a=1.0):
    h = hexcode.lstrip('#')
    lin = lambda c: (c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(int(h[0:2], 16) / 255), lin(int(h[2:4], 16) / 255), lin(int(h[4:6], 16) / 255), a)


def new_scene(name):
    old = bpy.data.scenes.get(name)
    if old:
        for ob in list(old.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.scenes.remove(old)
    sc = bpy.data.scenes.new(name)
    bpy.context.window.scene = sc
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    w = bpy.data.worlds.new(name + '_mundo')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground')
    out = nt.nodes.new('ShaderNodeOutputWorld'); out.is_active_output = True
    bg.inputs[0].default_value = rgb('#030303')
    bg.inputs[1].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs['Surface'])
    sc.world = w
    try:
        sc.eevee.use_raytracing = True
        sc.eevee.use_shadows = True
    except Exception:
        pass
    return sc


def mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    # Los nombres de los nodos van traducidos según el idioma de Blender: se rehace el árbol buscando por tipo.
    nt = m.node_tree
    nt.nodes.clear()
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.is_active_output = True
    nt.links.new(b.outputs[0], out.inputs['Surface'])
    b.inputs['Base Color'].default_value = rgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = rgb(emit)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def box(name, size, loc, material, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = ob.modifiers.new('bisel', 'BEVEL'); mod.width = bevel; mod.segments = 3
    ob.data.materials.append(material)
    return ob


def cyl(name, r, h, loc, material, verts=48, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=verts, rotation=rot)
    ob = bpy.context.active_object; ob.name = name
    ob.data.materials.append(material)
    return ob


def area_light(name, loc, rot, energy, size, color='#ffffff'):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size; d.color = rgb(color)[:3]
    ob = bpy.data.objects.new(name, d); ob.location = loc; ob.rotation_euler = rot
    bpy.context.scene.collection.objects.link(ob)
    return ob


def spot(name, loc, target, energy, angle=0.5, color='#ffffff', blend=0.4):
    d = bpy.data.lights.new(name, 'SPOT'); d.energy = energy; d.spot_size = angle; d.spot_blend = blend; d.color = rgb(color)[:3]
    ob = bpy.data.objects.new(name, d); ob.location = loc
    bpy.context.scene.collection.objects.link(ob)
    direction = Vector(target) - Vector(loc)
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return ob


def camera(loc, target, lens=35):
    d = bpy.data.cameras.new('Camara'); d.lens = lens
    ob = bpy.data.objects.new('Camara', d); ob.location = loc
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = ob
    return ob


def text(name, body, loc, size, material, rot=(math.radians(90), 0, 0), align='CENTER', extrude=0.0, font=None):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = align; cu.extrude = extrude
    if font:
        cu.font = font
    ob = bpy.data.objects.new(name, cu); ob.location = loc; ob.rotation_euler = rot
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(material)
    return ob


def load_font(path):
    try:
        return bpy.data.fonts.load(path, check_existing=True)
    except Exception:
        return None


# ---------------------------------------------------------------------------------------------------------------
# 1. Sala de votación: hemiciclo de diez pupitres con el color de cada equipo, estrado de la federación y pantalla.
# ---------------------------------------------------------------------------------------------------------------
def build_voto(font_path=None, votes=None):
    sc = new_scene('MD_VOTO')
    font = load_font(font_path) if font_path else None
    votes = votes or ['si', 'si', 'no', 'si', 'pend', 'no', 'si', 'pend', 'no', 'si']
    floor = mat('md_suelo', '#060606', rough=0.28, metal=0.2)
    dark = mat('md_negro', '#141414', rough=0.45)
    trim = mat('md_rojo', RED, rough=0.3, emit=RED, strength=3.5)
    glass = mat('md_pantalla', '#050505', rough=0.08, metal=0.0)
    voteMat = {'si': mat('md_si', '#57d9a3', emit='#57d9a3', strength=9), 'no': mat('md_no', RED, emit=RED, strength=9),
               'pend': mat('md_pend', '#3d3d3d', emit='#8f8f8f', strength=1.2)}

    # Suelo y gradas: anillos escalonados que suben hacia el fondo.
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(floor)
    for i, (r, h) in enumerate([(7.2, 0.25), (8.6, 0.55), (10.0, 0.85)]):
        ring = cyl(f'grada_{i}', r, h, (0, 0, h / 2), dark, verts=128)
        bpy.ops.mesh.primitive_torus_add(major_radius=r + 0.01, minor_radius=0.018, location=(0, 0, h - 0.03), major_segments=160, minor_segments=8)
        lip = bpy.context.active_object; lip.name = f'grada_luz_{i}'; lip.data.materials.append(trim)
    # Mitad delantera fuera: un cubo grande que corta y > 0.5 (las gradas quedan detrás del centro, mirando a -y).
    halfcut = box('corte', (40, 20, 6), (0, -10.5, 1.5), dark)
    hole = cyl('hueco2', 6.4, 4, (0, 0, 1.5), dark, verts=128)
    for ob in [o for o in sc.objects if o.name.startswith('grada')]:
        m1 = ob.modifiers.new('mitad', 'BOOLEAN'); m1.object = halfcut; m1.operation = 'DIFFERENCE'
        m2 = ob.modifiers.new('hueco', 'BOOLEAN'); m2.object = hole; m2.operation = 'DIFFERENCE'
    halfcut.hide_render = True; halfcut.hide_viewport = True
    hole.hide_render = True; hole.hide_viewport = True

    # Diez pupitres en semicírculo sobre la primera grada, cada uno con la franja de su equipo y su luz de voto.
    R = 7.9
    for i, (tid, color) in enumerate(TEAMS):
        a = math.radians(180 - (i + 0.5) * 18)
        x, y = R * math.cos(a), R * math.sin(a)
        rot = (0, 0, a + math.pi / 2)
        z0 = 0.55
        desk = box(f'pupitre_{tid}', (1.5, 0.6, 0.95), (x, y, z0 + 0.42), dark, rot=rot, bevel=0.02)
        inward = Vector((-math.cos(a), -math.sin(a), 0))
        stripe = box(f'franja_{tid}', (1.51, 0.02, 0.2), (x + inward.x * 0.31, y + inward.y * 0.31, z0 + 0.72), mat(f'md_eq_{tid}', color, emit=color, strength=5), rot=rot)
        light = box(f'voto_{tid}', (1.3, 0.1, 0.05), (x + inward.x * 0.22, y + inward.y * 0.22, z0 + 0.97), voteMat[votes[i]], rot=rot)
        screen = box(f'tablet_{tid}', (0.5, 0.32, 0.02), (x + inward.x * 0.1, y + inward.y * 0.1, z0 + 0.88), mat(f'md_tab_{tid}', '#050505', emit=color, strength=0.6), rot=(math.radians(-25) * 0, 0, a + math.pi / 2))
        chair = box(f'silla_{tid}', (0.5, 0.5, 1.05), (x - inward.x * 0.65, y - inward.y * 0.65, z0 + 0.52), mat('md_silla', '#1d1d1d', rough=0.6), rot=rot, bevel=0.06)

    # Estrado de la federación en el centro, con su disco rojo y el atril.
    base = cyl('estrado', 2.2, 0.35, (0, -0.6, 0.175), mat('md_estrado', '#0e0e0e', rough=0.35, metal=0.4), verts=96)
    bpy.ops.mesh.primitive_torus_add(major_radius=2.21, minor_radius=0.02, location=(0, -0.6, 0.33), major_segments=128, minor_segments=8)
    bpy.context.active_object.name = 'estrado_luz'; bpy.context.active_object.data.materials.append(trim)
    area_light('contra_presi', (0, 2.2, 2.6), (math.radians(-90), 0, 0), 300, 1.5, '#ffd9a8')
    lect = box('atril', (1.1, 0.6, 1.2), (0, -0.4, 0.95), dark, bevel=0.03)
    cyl('sello', 0.28, 0.03, (0, -0.72, 1.15), mat('md_sello', '#d9b23f', rough=0.25, metal=1.0), rot=(math.radians(90), 0, 0), verts=64)
    # El presidente: una silueta sencilla tras el atril (cabeza y tronco), a contraluz.
    pres = mat('md_presi', '#0d0d0d', rough=0.7)
    # (el presidente sale en la maqueta como retrato, no como figura 3D)

    # Pantalla gigante al fondo: barra de votos (sí y no) con huecos para el texto de la maqueta.
    scr = box('pantalla', (9.0, 0.15, 4.2), (0, 12.5, 4.2), glass)
    box('marco', (9.3, 0.1, 4.5), (0, 12.6, 4.2), trim)
    si = sum(v == 'si' for v in votes); no = sum(v == 'no' for v in votes)
    W = 7.6
    box('barra_fondo', (W, 0.05, 0.5), (0, 12.38, 3.2), mat('md_barra', '#202020', emit='#202020', strength=0.5))
    box('barra_si', (W * si / 10, 0.06, 0.5), (-W / 2 + W * si / 20, 12.36, 3.2), voteMat['si'])
    box('barra_no', (W * no / 10, 0.06, 0.5), (W / 2 - W * no / 20, 12.36, 3.2), voteMat['no'])
    box('linea_mayoria', (0.05, 0.07, 0.9), (W / 2 - W * 0.4 + 0.0, 12.35, 3.2), mat('md_blanco', '#ffffff', emit='#ffffff', strength=4))
    white = mat('md_letra', '#ffffff', emit='#ffffff', strength=3)
    text('pant_titulo', 'ARTÍCULO 5.2 · LÍMITE DE ENERGÍA', (0, 12.36, 5.3), 0.55, white, font=font)
    text('pant_si', f'SÍ {si}', (-W / 2, 12.36, 3.75), 0.42, voteMat['si'], align='LEFT', font=font)
    text('pant_no', f'{no} NO', (W / 2, 12.36, 3.75), 0.42, voteMat['no'], align='RIGHT', font=font)

    # Columnas de luz roja a los lados y cortinas de luz.
    for s in (-1, 1):
        for k in range(4):
            box(f'columna_{s}_{k}', (0.12, 0.12, 7), (s * (6 + k * 1.6), 9 + k * 0.6, 3.5), trim)

    # Luces: cenital sobre el estrado, perfiles rojos y relleno frío desde la cámara.
    spot('foco_estrado', (0, -3.5, 9), (0, -0.4, 1.2), 1400, angle=0.45, color='#fff2dc')
    spot('foco_pupitres', (0, -6, 10), (0, 6, 0.8), 6000, angle=1.2, color='#ffffff', blend=0.8)
    area_light('contra_roja', (0, 10, 6), (math.radians(-60), 0, 0), 700, 10, RED)
    area_light('relleno', (-6, -10, 4), (math.radians(70), 0, math.radians(-30)), 600, 6, '#9fc3ff')
    # Bruma para los haces de luz.
    w = sc.world
    vol = w.node_tree.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = 0.012
    wout = next(n for n in w.node_tree.nodes if n.bl_idname == 'ShaderNodeOutputWorld')
    w.node_tree.links.new(vol.outputs[0], wout.inputs['Volume'])

    camera((3.6, -6.6, 2.3), (0.2, 5.0, 1.8), lens=22)
    return {'scene': sc.name, 'objects': len(sc.objects)}


# ---------------------------------------------------------------------------------------------------------------
# 2. El coche del jugador en un plató negro con el símbolo del infinito en neón: imagen del Desafío en el menú y foto
#    de la portada del periódico. Usa el modelo del juego tal cual (no se toca su forma).
# ---------------------------------------------------------------------------------------------------------------
def build_coche(glb, lens=38, cam=(6.4, -5.6, 1.5), target=(0.0, 0.6, 0.6), infinity=True):
    sc = new_scene('MD_COCHE')
    floor = mat('md_suelo_coche', '#070707', rough=0.22, metal=0.25)
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(floor)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    car = [o for o in bpy.data.objects if o not in before]
    for o in car:
        if o.name not in sc.collection.objects and o.users_collection == ():
            sc.collection.objects.link(o)
    # Apoya el coche en el suelo.
    bpy.context.view_layer.update()
    zs = [ (o.matrix_world @ Vector(c)).z for o in car if o.type == 'MESH' for c in o.bound_box ]
    roots = [o for o in car if o.parent is None]
    for r in roots:
        r.location.z -= min(zs)
    if infinity:
        # Lazo de Bernoulli (∞) en neón rojo detrás del coche.
        pts = []
        for k in range(241):
            t = k / 240 * 2 * math.pi
            d = 1 + math.sin(t) ** 2
            pts.append((2.7 * math.cos(t) / d, 0, 1.75 + 2.7 * math.sin(t) * math.cos(t) / d))
        cu = bpy.data.curves.new('infinito', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.07; cu.bevel_resolution = 6
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for p, q in zip(sp.points, pts):
            p.co = (q[0], q[1], q[2], 1)
        sp.use_cyclic_u = True
        ob = bpy.data.objects.new('infinito', cu); ob.location = (-0.6, 5.6, 0); ob.rotation_euler = (0, 0, math.radians(-14))
        sc.collection.objects.link(ob)
        ob.data.materials.append(mat('md_neon', RED, emit=RED, strength=18))
    # Luces de estudio: caja suave cenital, contras frías y un perfil rojo bajo.
    area_light('cenital', (0, 0, 6), (0, 0, 0), 800, 9, '#ffffff')
    area_light('contra_izq', (-5, 3, 2.5), (math.radians(70), 0, math.radians(-120)), 900, 3, '#bcd6ff')
    area_light('perfil_rojo', (4, 4, 0.6), (math.radians(85), 0, math.radians(140)), 1400, 4, RED)
    area_light('relleno', (6, -6, 2), (math.radians(65), 0, math.radians(45)), 250, 5, '#ffffff')
    w = sc.world
    vol = w.node_tree.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = 0.01
    wout = next(n for n in w.node_tree.nodes if n.bl_idname == 'ShaderNodeOutputWorld')
    w.node_tree.links.new(vol.outputs[0], wout.inputs['Volume'])
    camera(cam, target, lens=lens)
    dims = [max(zs) - min(zs)]
    return {'scene': sc.name, 'car_objects': len(car), 'height': dims}


# ---------------------------------------------------------------------------------------------------------------
# 3. El periódico: una hoja doblada con la portada generada como textura, en el aire, con fondo transparente para que
#    la maqueta la haga entrar girando. `angle` es el giro sobre su eje en grados (0 = de frente).
# ---------------------------------------------------------------------------------------------------------------
def build_periodico(texture, angle=-14, tilt=8, name='MD_PERIODICO'):
    sc = new_scene(name)
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    W, H = 1.2, 1.7
    # Hoja de portada, subdividida para curvarla; detrás, el resto del periódico (hojas algo más oscuras).
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    front = bpy.context.active_object; front.name = 'portada'
    front.scale = (W, H, 1); bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=40); bpy.ops.object.mode_set(mode='OBJECT')
    m = bpy.data.materials.new('md_portada'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    b = nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value = 0.85
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.is_active_output = True
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(texture, check_existing=True)
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color']); nt.links.new(b.outputs[0], out.inputs['Surface'])
    front.data.materials.append(m)
    for k in range(3):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0.012 * (k + 1), -0.01 * (k + 1), -0.006 * (k + 1)))
        sheet = bpy.context.active_object; sheet.name = f'hoja_{k}'
        sheet.scale = (W, H, 1); bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=40); bpy.ops.object.mode_set(mode='OBJECT')
        sheet.data.materials.append(mat(f'md_hoja_{k}', ['#e6dfcf', '#dcd3c0', '#d2c8b3'][k], rough=0.9))
        sheet.parent = front
        # Curva suave solo en la portada: una onda pequeña en el borde libre, hecha moviendo los vértices.
    for v in front.data.vertices:
        v.co.z += 0.035 * math.sin((v.co.x / W + 0.5) * math.pi) + 0.004
    front.rotation_euler = (math.radians(90 - tilt), math.radians(4), math.radians(angle))
    front.location = (0, 0, 1.0)
    area_light('clave', (-2.5, -3.5, 3), (math.radians(55), 0, math.radians(-35)), 1400, 3, '#fff1dd')
    area_light('contra_roja', (2.5, 2.5, 2.2), (math.radians(-60), 0, math.radians(140)), 700, 2, RED)
    area_light('relleno', (2.5, -3, 0.5), (math.radians(80), 0, math.radians(40)), 200, 4, '#cfe0ff')
    camera((0, -3.6, 1.05), (0, 0, 1.0), lens=50)
    sc.render.resolution_x, sc.render.resolution_y = 1400, 1600
    return {'scene': sc.name}


# ---------------------------------------------------------------------------------------------------------------
# 4. Sala de prensa: photocall con logos de parodia, mesa con tres sitios (el del centro, vacío y con foco, es el tuyo),
#    un ramo de micrófonos de colores y siluetas de periodistas desenfocadas en primer plano.
# ---------------------------------------------------------------------------------------------------------------
def build_prensa(font_path=None):
    sc = new_scene('MD_PRENSA')
    font = load_font(font_path) if font_path else None
    floor = mat('md_moqueta', '#121212', rough=0.9)
    wall = mat('md_photocall', '#0e0e0e', rough=0.55)
    cloth = mat('md_mantel', '#0a0a0a', rough=0.95)
    white = mat('md_logo_blanco', '#8a8a8a', rough=0.5)
    redl = mat('md_logo_rojo', RED, rough=0.4, emit=RED, strength=0.6)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(floor)
    box('photocall', (9, 0.1, 4.2), (0, 2.2, 2.1), wall)
    # Logos repetidos en tresbolillo, como en las salas de prensa de verdad.
    names = ['EL PIT DIARIO', 'FEDERACIÓN', 'BRAVA RACING', 'GOMAS PERPETUAS', 'ACEITES EL MURO']
    k = 0
    for row in range(6):
        for col in range(6):
            x = -4 + col * 1.6 + (0.8 if row % 2 else 0)
            if x > 4.2:
                continue
            z = 0.55 + row * 0.62
            text(f'logo_{row}_{col}', names[k % len(names)], (x, 2.14, z), 0.17, redl if names[k % len(names)] == 'BRAVA RACING' else white, font=font)
            k += 1
    # Mesa con mantel, tres sillas y tres placas de nombre.
    box('mesa', (4.6, 0.9, 0.06), (0, 0.9, 0.78), cloth)
    box('faldon', (4.6, 0.04, 0.76), (0, 0.46, 0.39), cloth)
    box('faldon_luz', (4.6, 0.045, 0.04), (0, 0.455, 0.7), mat('md_rojo_mesa', RED, emit=RED, strength=4))
    for i, (x, color) in enumerate([(-1.5, '#2a4a9a'), (0, RED), (1.5, '#27F4D2')]):
        box(f'silla_{i}', (0.55, 0.5, 1.15), (x, 1.55, 0.6), mat('md_silla_prensa', '#202020', rough=0.5), bevel=0.05)
        box(f'placa_{i}', (0.6, 0.02, 0.16), (x, 0.55, 0.9), mat(f'md_placa_{i}', '#0d0d0d', emit=color, strength=0.35), rot=(math.radians(-12), 0, 0))
        cyl(f'agua_{i}', 0.035, 0.22, (x + 0.35, 0.75, 0.92), mat('md_agua', '#9fd2ff', rough=0.05, alpha=0.6), verts=24)
    # Ramo de micrófonos delante del sitio central: cada uno con su espuma de un color.
    foams = ['#e10600', '#ffd23f', '#5aa9ff', '#57d9a3', '#ffffff', '#ff87bc', '#ff8000', '#b678ff', '#e10600']
    for j, c in enumerate(foams):
        a = (j - 4) * 0.13
        base = Vector((0 + a * 0.35, 0.58, 0.81))
        tip = Vector((0 + a * 0.75, 1.02, 1.16 + 0.07 * math.cos(j * 1.7)))
        mid = (base + tip) / 2
        d = tip - base
        stem = cyl(f'mic_{j}', 0.016, d.length, mid, mat('md_mic', '#111111', rough=0.4, metal=0.6), verts=12)
        stem.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.065, location=tip); bpy.context.active_object.data.materials.append(mat(f'md_espuma_{j}', c, rough=0.95))
        box(f'cubo_{j}', (0.1, 0.1, 0.09), tip - d.normalized() * 0.13, mat(f'md_cubo_{j}', c, rough=0.6), rot=d.to_track_quat('Z', 'Y').to_euler())
    # Periodistas en primer plano: cabezas y hombros a contraluz, con una mano levantada.
    dark = mat('md_publico', '#050505', rough=0.8)
    for i, (x, y, h) in enumerate([(-1.9, -4.3, 0.98), (-0.6, -4.6, 1.02), (1.7, -4.2, 0.96), (2.9, -4.5, 1.04), (-3.0, -4.1, 1.0)]):
        cyl(f'hombros_{i}', 0.32, 0.5, (x, y, h - 0.35), dark, verts=24).scale = (1, 0.6, 1)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(x, y, h)); bpy.context.active_object.data.materials.append(dark)
    # Cámara de televisión a un lado y foco sobre tu silla.
    box('camara_tv', (0.35, 0.7, 0.35), (-3.6, -1.6, 1.6), mat('md_tv', '#151515', rough=0.4, metal=0.5), rot=(0, 0, math.radians(-25)))
    cyl('objetivo_tv', 0.1, 0.3, (-3.47, -1.25, 1.6), mat('md_lente', '#050505', rough=0.05, metal=0.9), rot=(math.radians(90), 0, math.radians(-25)), verts=24)
    spot('foco_tu_silla', (0, -1.0, 5.5), (0, 1.3, 0.9), 3200, angle=0.42, color='#fff4e0', blend=0.35)
    area_light('frontal_tv', (0, -5, 2.6), (math.radians(75), 0, 0), 160, 6, '#dfe8ff')
    # Flashes de los fotógrafos, muy cerca de la cámara: salen como bokeh.
    for i, (x, z) in enumerate([(-1.2, 1.2), (0.5, 0.9), (1.9, 1.35), (-2.4, 0.8)]):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(x, -5.2, z)); bpy.context.active_object.data.materials.append(mat('md_flash', '#ffffff', emit='#ffffff', strength=120))
    area_light('contra_roja', (0, 3.5, 4.2), (math.radians(-120), 0, 0), 600, 6, RED)
    area_light('banda_roja', (0, 1.6, 0.15), (math.radians(-100), 0, 0), 500, 9, RED)
    area_light('lateral', (5, -1, 2.5), (math.radians(80), 0, math.radians(75)), 250, 3, '#ffffff')
    w = sc.world
    vol = w.node_tree.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = 0.02
    wout = next(n for n in w.node_tree.nodes if n.bl_idname == 'ShaderNodeOutputWorld')
    w.node_tree.links.new(vol.outputs[0], wout.inputs['Volume'])
    cam = camera((0.5, -6.2, 1.22), (0, 1.0, 1.05), lens=58)
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 6.9
    cam.data.dof.aperture_fstop = 1.2
    return {'scene': sc.name, 'objects': len(sc.objects)}


# ---------------------------------------------------------------------------------------------------------------
# 5. Túnel de viento: el coche sobre la cinta, líneas de humo que pasan por encima y por los lados, y el borde del fondo
#    plano encendido en amarillo (el agujero del reglamento que han encontrado los ingenieros).
# ---------------------------------------------------------------------------------------------------------------
def build_tunel(glb):
    sc = new_scene('MD_TUNEL')
    dark = mat('md_tunel', '#0c0d10', rough=0.5, metal=0.4)
    belt = mat('md_cinta', '#16181c', rough=0.35, metal=0.2)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); fl = bpy.context.active_object; fl.scale = (30, 8, 1); fl.data.materials.append(dark)
    box('cinta', (9, 2.6, 0.02), (0.3, 0, 0.01), belt)
    for s in (-1, 1):
        box(f'linea_cinta_{s}', (9, 0.03, 0.025), (0.3, s * 1.3, 0.015), mat('md_cinta_luz', '#ffd23f', emit='#ffd23f', strength=3))
    # Paredes y techo del túnel con costillas de luz fría.
    box('pared_fondo', (30, 0.2, 6), (0, 4, 3), dark)
    box('techo', (30, 8, 0.2), (0, 0, 5), dark)
    for k in range(-6, 7):
        box(f'costilla_{k}', (0.12, 0.05, 5.0), (k * 2.0, 3.88, 2.5), mat('md_costilla', '#9fc3ff', emit='#9fc3ff', strength=2.5))
        box(f'costilla_techo_{k}', (0.12, 8, 0.05), (k * 2.0, 0, 4.88), mat('md_costilla', '#9fc3ff', emit='#9fc3ff', strength=2.5))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    car = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for o in car if o.type == 'MESH' for c in o.bound_box]
    for r in [o for o in car if o.parent is None]:
        r.location.z -= min(zs)
    # El agujero: una lámina amarilla que resigue el borde del fondo plano a cada lado.
    glow = mat('md_agujero', '#ffd23f', emit='#ffd23f', strength=14)
    for s in (-1, 1):
        box(f'agujero_{s}', (2.2, 0.03, 0.03), (0.0, s * 0.83, 0.07), glow)
    # Líneas de humo: curvas que vienen desde delante (+x), suben por encima del coche y siguen hacia atrás.
    smoke = mat('md_humo', '#e8f1ff', emit='#e8f1ff', strength=3.2)
    import random
    rnd = random.Random(7)
    for i in range(34):
        y = -1.65 + i * 0.1 + rnd.uniform(-0.02, 0.02)
        # Por encima del coche dentro de su anchura; a ras de suelo solo por fuera.
        z0 = (0.98 + (i % 3) * 0.13) if abs(y) < 1.0 else (0.12 + (i % 5) * 0.17)
        pts = []
        for k in range(121):
            x = 6.5 - k * 0.11
            over = math.exp(-((x - 0.4) / 1.9) ** 2) * max(0, 1 - abs(y) / 1.1)
            bump = 0.55 * over + 0.25 * math.exp(-((x + 1.9) / 0.7) ** 2) * max(0, 1 - abs(y) / 0.8)
            side = 0.18 * math.exp(-((x - 2.6) / 0.6) ** 2) * (1 if y > 0 else -1) * max(0, 1 - abs(abs(y) - 0.8) / 0.4)
            wob = 0.015 * math.sin(k * 0.6 + i) * (k / 120)
            pts.append((x, y + side, z0 + bump + wob))
        cu = bpy.data.curves.new(f'humo_{i}', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.0045; cu.bevel_resolution = 2
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for p, q in zip(sp.points, pts):
            p.co = (q[0], q[1], q[2], 1)
        ob = bpy.data.objects.new(f'humo_{i}', cu); sc.collection.objects.link(ob); ob.data.materials.append(smoke)
    area_light('cenital', (0, 0, 4.6), (0, 0, 0), 700, 5, '#cfe0ff')
    area_light('perfil_rojo', (-4, -3, 1), (math.radians(80), 0, math.radians(-55)), 900, 3, RED)
    area_light('relleno', (5, -5, 2), (math.radians(70), 0, math.radians(45)), 220, 4, '#ffffff')
    w = sc.world
    vol = w.node_tree.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = 0.025
    wout = next(n for n in w.node_tree.nodes if n.bl_idname == 'ShaderNodeOutputWorld')
    w.node_tree.links.new(vol.outputs[0], wout.inputs['Volume'])
    camera((4.6, -4.4, 0.75), (0.2, 0.3, 0.4), lens=30)
    return {'scene': sc.name, 'objects': len(sc.objects)}


# ---------------------------------------------------------------------------------------------------------------
# 6. Sala de juntas de la directiva: mesa larga de madera oscura, sillas de cuero, pantalla con la gráfica de
#    objetivos y un ventanal con la ciudad de noche. `despido=True` deja una carta y tu silla girada (fin de partida).
# ---------------------------------------------------------------------------------------------------------------
def silla_juntas(name, loc, rotz, material, tall=False):
    # Silla de despacho: asiento, respaldo y pie, unidos a un vacío para girarlos juntos.
    root = bpy.data.objects.new(name, None); root.location = loc; root.rotation_euler = (0, 0, rotz)
    bpy.context.scene.collection.objects.link(root)
    h = 0.95 if tall else 0.7
    parts = [box(name + '_asiento', (0.56, 0.56, 0.1), (0, 0, 0.5), material, bevel=0.04),
             box(name + '_respaldo', (0.54, 0.09, h), (0, 0.27, 0.55 + h / 2), material, bevel=0.04),
             cyl(name + '_pie', 0.04, 0.45, (0, 0, 0.23), mat('md_metal_oscuro', '#151515', rough=0.3, metal=0.8), verts=16),
             cyl(name + '_base', 0.28, 0.03, (0, 0, 0.02), mat('md_metal_oscuro', '#151515', rough=0.3, metal=0.8), verts=24)]
    for p in parts:
        p.parent = root
    return root


def build_juntas(despido=False):
    sc = new_scene('MD_JUNTAS_FIN' if despido else 'MD_JUNTAS')
    import random
    rnd = random.Random(3)
    floor = mat('md_parquet', '#3a2516', rough=0.3)
    wood = mat('md_madera', '#4a2c18', rough=0.2, metal=0.0)
    leather = mat('md_cuero', '#1c1c1c', rough=0.4)
    wallm = mat('md_pared_juntas', '#262422', rough=0.7)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(floor)
    box('pared_izq', (0.2, 20, 5), (-4.2, 0, 2.5), wallm)
    box('pared_fondo', (12, 0.2, 5), (0, 8, 2.5), wallm)
    # Ventanal a la derecha con la ciudad de noche: puntos de luz cálidos y fríos detrás del cristal.
    box('marco_ventana', (0.15, 14, 0.12), (4.0, 1, 0.6), wallm)
    box('marco_ventana_alto', (0.15, 14, 0.12), (4.0, 1, 4.4), wallm)
    for k in range(-6, 8, 2):
        box(f'montante_{k}', (0.15, 0.12, 3.8), (4.0, k, 2.5), wallm)
    city = bpy.data.materials.new('md_ciudad_base'); city = mat('md_ciudad', '#05070d', rough=1.0)
    box('ciudad_fondo', (0.1, 30, 6), (14, 1, 2.5), city)
    for i in range(160):
        c = rnd.choice(['#ffcf8a', '#ffe7c2', '#9fc3ff', '#ff8a5c'])
        y = rnd.uniform(-12, 14); z = rnd.uniform(0.3, 3.8) * (0.4 + 0.6 * rnd.random())
        box(f'luz_ciudad_{i}', (0.05, 0.08, 0.05), (13.8, y, z), mat(f'md_luzc_{c}', c, emit=c, strength=12))
    # Mesa y sillas.
    box('mesa_juntas', (2.0, 7.0, 0.08), (0, 1.5, 0.76), wood, bevel=0.02)
    box('pata_mesa', (1.2, 6.0, 0.7), (0, 1.5, 0.37), mat('md_metal_oscuro', '#151515', rough=0.3, metal=0.8))
    box('luz_mesa', (1.8, 6.8, 0.02), (0, 1.5, 0.71), mat('md_luz_mesa', RED, emit=RED, strength=2))
    for side in (-1, 1):
        for j in range(4):
            y = -0.6 + j * 1.5
            silla_juntas(f'silla_{side}_{j}', (side * 1.35, y, 0), math.radians(side * 90 + rnd.uniform(-10, 10)), leather)
    # Cabecera: tu silla (más alta) mirando a la pantalla; en el despido, girada hacia la ventana.
    silla_juntas('silla_cabecera', (0, -2.55, 0), math.radians(180 + (60 if despido else 0)), leather, tall=True)
    # Pantalla al fondo con barras de objetivos.
    box('pantalla_juntas', (3.6, 0.08, 2.0), (0, 7.85, 2.3), mat('md_pantalla_j', '#050505', rough=0.1))
    box('marco_pantalla', (3.75, 0.06, 2.15), (0, 7.9, 2.3), mat('md_marco_j', '#202020', rough=0.3, metal=0.6))
    for b, (h, c) in enumerate([(0.9, '#57d9a3'), (1.2, '#57d9a3'), (0.5, RED if despido else '#ffd23f'), (1.4, '#5aa9ff')]):
        box(f'barra_obj_{b}', (0.45, 0.02, h), (-1.2 + b * 0.8, 7.8, 1.45 + h / 2), mat(f'md_barra_obj_{b}', c, emit=c, strength=4))
    if despido:
        # La carta sobre la mesa, delante de tu sitio, con el sello rojo.
        box('carta', (0.32, 0.45, 0.004), (0.15, -1.5, 0.805), mat('md_papel', '#efe9dc', rough=0.9), rot=(0, 0, math.radians(12)))
        cyl('sello_carta', 0.04, 0.006, (0.2, -1.42, 0.81), mat('md_lacre', '#a10000', rough=0.4), verts=24)
        spot('foco_carta', (0.2, -1.5, 3.2), (0.15, -1.5, 0.8), 600, angle=0.25, color='#fff1dd', blend=0.3)
    # Luces: lámparas colgantes sobre la mesa, luz de la ciudad desde la derecha.
    for j in range(3):
        cyl(f'lampara_{j}', 0.25, 0.06, (0, -0.2 + j * 2.0, 2.6), mat('md_lampara', '#fff4e0', emit='#fff4e0', strength=8), verts=32)
        spot(f'foco_lampara_{j}', (0, -0.2 + j * 2.0, 2.55), (0, -0.2 + j * 2.0, 0.7), 900 if despido else 1500, angle=1.0, color='#ffe6c4', blend=0.6)
    area_light('ciudad_luz', (3.6, 1, 2.5), (0, math.radians(-90), 0), 700, 6, '#9fc3ff')
    area_light('relleno_juntas', (-2, -6, 2.5), (math.radians(75), 0, math.radians(-20)), 350, 5, '#ffffff')
    sc.view_settings.exposure = 0.8
    cam = camera((-2.6, -4.6, 1.75), (0.4, 3.5, 1.2), lens=28) if not despido else camera((2.2, -4.8, 1.3), (-0.2, -1.4, 0.9), lens=32)
    if despido:
        cam.data.dof.use_dof = True; cam.data.dof.focus_distance = 4.0; cam.data.dof.aperture_fstop = 2.0
    return {'scene': sc.name, 'objects': len(sc.objects)}


# ---------------------------------------------------------------------------------------------------------------
# 7. Recta de test de pretemporada de noche: asfalto con las líneas del pit, muro de boxes con su luz, focos altos y el
#    coche pasando con estelas de luz detrás (velocidad).
# ---------------------------------------------------------------------------------------------------------------
def build_pista(glb):
    sc = new_scene('MD_PISTA')
    asphalt = mat('md_asfalto', '#1a1b1e', rough=0.55)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); a = bpy.context.active_object; a.scale = (80, 30, 1); a.data.materials.append(asphalt)
    white = mat('md_linea_blanca', '#e8e8e8', rough=0.6)
    for s in (-1, 1):
        box(f'linea_borde_{s}', (80, 0.15, 0.005), (0, s * 3.2, 0.003), white)
    for k in range(-20, 21):
        box(f'linea_central_{k}', (1.5, 0.12, 0.005), (k * 3.5, 0, 0.003), white)
    # Muro de boxes con banda roja luminosa y vallas.
    box('muro_boxes', (80, 0.4, 1.1), (0, 4.4, 0.55), mat('md_muro', '#2a2a2a', rough=0.6))
    box('muro_banda', (80, 0.41, 0.12), (0, 4.4, 0.9), mat('md_muro_rojo', RED, emit=RED, strength=5))
    box('valla', (80, 0.05, 2.2), (0, 4.6, 2.2), mat('md_valla', '#3a3a3a', rough=0.4, metal=0.7, alpha=1))
    # Focos altos a lo largo de la recta.
    for k in range(-5, 6):
        x = k * 9
        cyl(f'poste_{k}', 0.08, 9, (x, 6.5, 4.5), mat('md_poste', '#1b1b1b', rough=0.4, metal=0.7), verts=12)
        box(f'foco_{k}', (1.2, 0.4, 0.35), (x, 6.2, 9), mat('md_foco', '#fffaf0', emit='#fffaf0', strength=30))
        spot(f'luz_foco_{k}', (x, 6.0, 8.8), (x, 0, 0), 3500, angle=1.1, color='#fff6e8', blend=0.7)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    car = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for o in car if o.type == 'MESH' for c in o.bound_box]
    for r in [o for o in car if o.parent is None]:
        r.location.z -= min(zs)
    # Estelas: líneas finas de luz roja (pilotos traseros) y blanca que salen de detrás del coche.
    for i, (y, z, c, L) in enumerate([(-0.25, 0.55, RED, 9), (0.25, 0.55, RED, 9), (-0.7, 0.2, '#ffffff', 6), (0.7, 0.2, '#ffffff', 6), (0, 0.95, '#ffffff', 5)]):
        bar = box(f'estela_{i}', (L, 0.02, 0.02), (-2.6 - L / 2, y, z), mat(f'md_estela_{i}', c, emit=c, strength=10 if c == RED else 3))
    area_light('relleno_pista', (6, -8, 3), (math.radians(65), 0, math.radians(35)), 500, 6, '#cfe0ff')
    w = sc.world
    vol = w.node_tree.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = 0.015
    wout = next(n for n in w.node_tree.nodes if n.bl_idname == 'ShaderNodeOutputWorld')
    w.node_tree.links.new(vol.outputs[0], wout.inputs['Volume'])
    cam = camera((7.5, -6.0, 1.1), (-0.5, 0.5, 0.6), lens=32)
    return {'scene': sc.name, 'objects': len(sc.objects)}


# ---------------------------------------------------------------------------------------------------------------
# 8. Garaje del equipo: el coche sobre caballetes, carro de herramientas, paredes con el color del equipo, tubos
#    fluorescentes y, en el banco, los dos cascos de los pilotos mirando cada uno a un lado (pelea en el equipo).
# ---------------------------------------------------------------------------------------------------------------
def build_garaje(glb):
    sc = new_scene('MD_GARAJE')
    floor = mat('md_suelo_garaje', '#6e6e6e', rough=0.3)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(floor)
    wall = mat('md_pared_garaje', '#141414', rough=0.6)
    box('pared_fondo_g', (16, 0.2, 5), (0, 5, 2.5), wall)
    box('pared_izq_g', (0.2, 12, 5), (-6, 0, 2.5), wall)
    box('franja_equipo', (16, 0.22, 0.6), (0, 4.98, 1.6), mat('md_franja_g', RED, emit=RED, strength=1.1))
    box('franja_blanca', (16, 0.22, 0.08), (0, 4.98, 1.25), mat('md_franja_b', '#f2f2f2', emit='#f2f2f2', strength=1.5))
    for k in range(-3, 4):
        box(f'tubo_{k}', (0.12, 2.2, 0.06), (k * 2.2, 0.5, 4.6), mat('md_tubo', '#f4f8ff', emit='#f4f8ff', strength=14))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    car = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for o in car if o.type == 'MESH' for c in o.bound_box]
    for r in [o for o in car if o.parent is None]:
        r.location.z -= min(zs) - 0.18
        r.location.y += 0.6
    stands = mat('md_caballete', '#e10600', rough=0.4, metal=0.3)
    for x in (-1.6, 2.2):
        box(f'caballete_{x}', (0.25, 0.9, 0.18), (x, 0.6, 0.09), stands)
    # Carro de herramientas y banco con los dos cascos.
    box('carro', (1.0, 0.55, 1.0), (-4.2, 3.6, 0.5), mat('md_carro', '#c40500', rough=0.35, metal=0.5), bevel=0.02)
    for d in range(4):
        box(f'cajon_{d}', (0.9, 0.02, 0.16), (-4.2, 3.32, 0.2 + d * 0.22), mat('md_cajon', '#8a0400', rough=0.4, metal=0.5))
    box('banco', (2.4, 0.7, 0.08), (3.6, 3.7, 0.9), mat('md_banco', '#2a2a2a', rough=0.4, metal=0.6))
    box('banco_pata', (2.2, 0.6, 0.86), (3.6, 3.7, 0.44), mat('md_banco_p', '#1a1a1a', rough=0.4, metal=0.6))
    for i, (x, rot, c) in enumerate([(3.0, -55, '#ffd23f'), (4.2, 55, '#5aa9ff')]):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(x, 3.65, 1.14), segments=32, ring_count=16)
        h = bpy.context.active_object; h.name = f'casco_{i}'; h.scale = (1, 1.15, 0.95); h.rotation_euler = (0, 0, math.radians(rot))
        h.data.materials.append(mat(f'md_casco_{i}', c, rough=0.15, metal=0.2))
        box(f'visera_{i}', (0.22, 0.05, 0.08), (x + 0.16 * math.sin(math.radians(rot)), 3.65 - 0.2 * math.cos(math.radians(rot)), 1.15), mat('md_visera', '#050505', rough=0.05, metal=0.8), rot=(0, 0, math.radians(rot)))
    area_light('relleno_garaje', (3, -6, 3), (math.radians(65), 0, math.radians(25)), 600, 6, '#ffffff')
    area_light('contra_g', (0, 4.6, 3.5), (math.radians(-110), 0, 0), 500, 8, RED)
    camera((5.6, -4.2, 1.7), (0.6, 1.8, 0.8), lens=30)
    return {'scene': sc.name}


# ---------------------------------------------------------------------------------------------------------------
# 9. Vitrina de ventajas: pared negra con huecos iluminados; en cada uno, un medallón con el canto del color de su
#    rareza (los bloqueados, apagados).
# ---------------------------------------------------------------------------------------------------------------
def build_vitrina():
    sc = new_scene('MD_VITRINA')
    wall = mat('md_vitrina_pared', '#0b0b0b', rough=0.5)
    box('pared_vitrina', (9, 0.3, 5), (0, 0.4, 2.5), wall)
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(mat('md_suelo_v', '#080808', rough=0.2, metal=0.4))
    rar = ['#e10600', '#ffd23f', '#5aa9ff', '#57d9a3', '#b678ff']
    import random
    rnd = random.Random(5)
    for r in range(3):
        for c in range(5):
            x = -3.2 + c * 1.6; z = 1.0 + r * 1.3
            box(f'hueco_{r}_{c}', (1.3, 0.1, 1.05), (x, 0.24, z), mat('md_hueco', '#161616', rough=0.4))
            for s in (-1, 1):
                box(f'marco_{r}_{c}_{s}', (0.06, 0.35, 1.05), (x + s * 0.68, 0.05, z), mat('md_marco_v', '#050505', rough=0.3, metal=0.6))
            lit = rnd.random() > 0.35
            color = rar[(r * 5 + c) % len(rar)]
            box(f'luz_hueco_{r}_{c}', (1.2, 0.02, 0.03), (x, -0.05, z + 0.5), mat(f'md_luz_h_{lit}', '#fff4e0' if lit else '#222222', emit='#fff4e0' if lit else '#222222', strength=6 if lit else 0.2))
            med = cyl(f'medallon_{r}_{c}', 0.34, 0.06, (x, 0.0, z), mat(f'md_med_{lit}', '#1c1c1c' if lit else '#101010', rough=0.25, metal=0.85), rot=(math.radians(90), 0, 0), verts=6)
            bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.02, location=(x, -0.035, z), rotation=(math.radians(90), math.radians(30), 0), major_segments=6, minor_segments=8)
            ring = bpy.context.active_object; ring.name = f'canto_{r}_{c}'
            ring.data.materials.append(mat(f'md_canto_{color}_{lit}', color if lit else '#2a2a2a', emit=color if lit else '#2a2a2a', strength=7 if lit else 0.2))
    area_light('frontal_v', (0, -6, 3), (math.radians(75), 0, 0), 250, 8, '#ffffff')
    camera((1.4, -9.5, 2.5), (0, 0.2, 2.3), lens=38)
    return {'scene': sc.name}
