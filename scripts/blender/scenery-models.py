# Modelos del escenario 3D de F1Sim (22/10/2026). Se ejecuta dentro de Blender (5.x):
#   exec(open(r"<repo>/scripts/blender/scenery-models.py", encoding="utf-8").read()); build_all(r"<repo>")
# Cada modelo se construye en una escena propia ("F1Sim_assets"), con el largo en +X, el ancho en Y, el alto en +Z y la
# base centrada en el origen. El juego los escala a la planta de cada objeto. Materiales con nombre:
#   "tint"  -> se tiñe con el color del objeto; "paint"/"accent" -> colores del equipo (coche).
# Estilo: low poly reconocible, sin texturas (solo colores), para que pesen poco.
import bpy, bmesh, math, os

SCENE = "F1Sim_assets"
_mats = {}


def scene():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = sc
    return sc


def clear():
    sc = scene()
    for o in list(sc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)
    # Cada modelo con sus propios colores: sin esto, "tint" y compañía heredarían el color del modelo anterior.
    _mats.clear()
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)


def mat(name, color, metallic=0.0, rough=0.7, emission=None):
    key = name
    if key in _mats and _mats[key].name in bpy.data.materials:
        return _mats[key]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nodes if n.type == "OUTPUT_MATERIAL"), None) or nodes.new("ShaderNodeOutputMaterial")
        m.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    r, g, b = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    bsdf.inputs["Base Color"].default_value = (r ** 2.2, g ** 2.2, b ** 2.2, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*[int(emission[i:i + 2], 16) / 255 for i in (1, 3, 5)], 1)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    _mats[key] = m
    return m


def _link(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def box(cx, cy, z0, lx, ly, lz, m, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, z0 + lz / 2), rotation=(0, 0, rot))
    o = bpy.context.active_object
    o.scale = (lx, ly, lz)
    return _link(o, m)


def cyl(cx, cy, z0, r, h, m, seg=8, r2=None, rot=(0, 0, 0)):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=(cx, cy, z0 + h / 2), rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r2, depth=h, location=(cx, cy, z0 + h / 2), rotation=rot)
    return _link(bpy.context.active_object, m)


def blob(cx, cy, cz, sx, sy, sz, m, seg=10, rings=6, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=(cx, cy, cz), rotation=rot)
    o = bpy.context.active_object
    o.scale = (sx, sy, sz)
    return _link(o, m)


def prism(points, z0, z1, m, name="prism"):
    """Polígono en planta (lista de (x, y)) extruido de z0 a z1."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in points]
    top = [bm.verts.new((x, y, z1)) for x, y in points]
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    k = len(points)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return _link(o, m)


def loft(sections, m, name="loft"):
    """Casco a partir de secciones: lista de (x, [(y, z), ...]) con el mismo número de puntos (cerrado)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = [[bm.verts.new((x, y, z)) for y, z in pts] for x, pts in sections]
    k = len(sections[0][1])
    for a, b in zip(rings, rings[1:]):
        for i in range(k):
            j = (i + 1) % k
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return _link(o, m)


def finish(name, out_dir):
    """Une todo, deja la base en z=0 centrada en XY, sombreado plano, y exporta a GLB."""
    sc = scene()
    objs = [o for o in sc.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    dx, dy, dz = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    for v in o.data.vertices:
        v.co.x -= dx
        v.co.y -= dy
        v.co.z -= dz
    for p in o.data.polygons:
        p.use_smooth = False
    path = os.path.join(out_dir, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, use_active_scene=True)
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    return {"name": name, "tris": tris, "size": [round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1), round(max(zs) - min(zs), 1)],
            "bytes": os.path.getsize(path)}


# ───────────────────────────── Kit común ─────────────────────────────

def grandstand():
    """Tribuna: gradas escalonadas que suben de +Y (delante, la pista) a −Y, con cubierta sobre pilares."""
    concrete, seat, roof, steel = mat("concrete", "#b9bcc2"), mat("tint", "#2a63b8"), mat("roof", "#e9ecef", 0.2, 0.4), mat("steel", "#5b6068", 0.6, 0.4)
    L, rows = 60, 9
    for i in range(rows):
        y = 6 - i * 1.35
        box(0, y, 0, L, 1.35, 1.2 + i * 1.15, concrete)
        box(0, y + 0.25, 1.2 + i * 1.15, L - 0.6, 0.55, 0.45, seat)
    box(0, -6.6, 0, L, 0.6, 13.5, concrete)
    for x in range(-27, 28, 9):
        cyl(x, -6.4, 0, 0.35, 15.5, steel, 6)
    roof_o = box(0, -1.0, 15.5, L + 2, 13.5, 0.5, roof)
    roof_o.rotation_euler = (math.radians(-6), 0, 0)
    for x in (-L / 2, L / 2):
        box(x, -0.3, 0, 0.6, 13, 9, concrete)


def vip_lounge():
    """Zona VIP: dos plantas acristaladas sobre los boxes, terraza con sombrillas."""
    glass, white, frame = mat("glass", "#3d5a78", 0.3, 0.15), mat("tint", "#f2f2f0"), mat("steel", "#5b6068", 0.6, 0.4)
    L, W = 50, 16
    box(0, 0, 0, L, W, 4, white)
    box(0, 0, 4, L - 1, W - 1, 3, glass)
    box(0, 0, 7, L + 1, W + 2, 0.5, white)
    box(0, -2, 7.5, L - 6, W - 6, 2.6, glass)
    box(0, -2, 10.1, L - 5, W - 5, 0.4, white)
    for x in range(-22, 23, 4):
        box(x, W / 2 + 0.6, 4, 0.2, 0.2, 3.5, frame)
    red = mat("parasol", "#d7263d")
    for x in (-18, -9, 0, 9, 18):
        cyl(x, W / 2 - 1.2, 7.5, 0.06, 2.4, frame, 6)
        cyl(x, W / 2 - 1.2, 9.6, 1.6, 0.6, red, 8, r2=0.05)


def paddock():
    """Paddock: explanada con los motorhomes de los equipos en fila y sus toldos."""
    ground, awn = mat("tint", "#9ca1a8"), mat("awning", "#f4f4f4")
    team = ["#ff8000", "#1e41ff", "#e8002d", "#27f4d2", "#229971", "#64c4ff", "#6692ff", "#b6babd", "#0093cc", "#52e252"]
    box(0, 0, 0, 80, 24, 0.3, ground)
    for k in range(10):
        x = -36 + k * 8
        y = 6 if k % 2 == 0 else -6
        box(x, y, 0.3, 7, 10, 6 if k % 3 == 0 else 4.5, mat(f"team{k}", team[k], 0.1, 0.4))
        box(x, y - 6 if y > 0 else y + 6, 3.2, 7, 2.5, 0.2, awn)


def tree():
    trunk, leaves = mat("trunk", "#5b4632"), mat("tint", "#2f6b2f", 0, 0.9)
    cyl(0, 0, 0, 0.25, 3, trunk, 6)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=2.6, location=(0, 0, 4.6))
    o = _link(bpy.context.active_object, leaves)
    o.scale = (1, 1, 1.15)


def building():
    """Bloque urbano con bandas de ventanas en las cuatro fachadas y máquinas en la azotea."""
    wall, win, top = mat("tint", "#d9c2a0"), mat("window", "#2b3a4a", 0.2, 0.2), mat("rooftop", "#7d7f84")
    L, W, H = 20, 14, 30
    box(0, 0, 0, L, W, H, wall)
    floors = 9
    for f in range(floors):
        z = 2 + f * 3.1
        box(0, W / 2 + 0.05, z, L - 2, 0.12, 1.4, win)
        box(0, -W / 2 - 0.05, z, L - 2, 0.12, 1.4, win)
        box(L / 2 + 0.05, 0, z, 0.12, W - 2, 1.4, win)
        box(-L / 2 - 0.05, 0, z, 0.12, W - 2, 1.4, win)
    box(3, 2, H, 5, 4, 2, top)
    box(-5, -3, H, 3, 3, 1.5, top)


# ───────────────────────────── Mónaco ─────────────────────────────

def _hull(L, W, H, m):
    """Casco de barco: popa recta (−X), proa afilada (+X), más estrecho abajo."""
    sections = []
    for i, x in enumerate([-L / 2, -L / 4, 0, L / 4, L * 0.42, L / 2]):
        taper = [1, 1, 1, 0.9, 0.6, 0.08][i]
        w, wb = W / 2 * taper, W / 2 * taper * 0.55
        sections.append((x, [(-wb, 0), (wb, 0), (w, H), (-w, H)]))
    return loft(sections, m, "hull")


def yacht():
    hull, white, win, deck = mat("tint", "#f4f4f2"), mat("white", "#ffffff"), mat("window", "#22303d", 0.3, 0.15), mat("teak", "#a57a4e")
    L, W = 22, 6
    _hull(L, W, 2.2, hull)
    box(-1, 0, 2.2, L * 0.75, W * 0.85, 0.2, deck)
    box(-2, 0, 2.4, L * 0.45, W * 0.7, 1.8, white)
    box(-1.5, 0, 3.0, L * 0.42, W * 0.72, 0.6, win)
    box(-3, 0, 4.2, L * 0.25, W * 0.55, 1.2, white)


def yacht_large():
    hull, white, win, deck = mat("tint", "#f4f4f2"), mat("white", "#ffffff"), mat("window", "#22303d", 0.3, 0.15), mat("teak", "#a57a4e")
    L, W = 45, 9
    _hull(L, W, 3.2, hull)
    box(-2, 0, 3.2, L * 0.8, W * 0.85, 0.25, deck)
    for k, (f, w) in enumerate([(0.62, 0.8), (0.45, 0.7), (0.28, 0.55)]):
        z = 3.45 + k * 2.4
        box(-4 - k * 2, 0, z, L * f, W * w, 2.0, white)
        box(-3.5 - k * 2, 0, z + 0.7, L * f * 0.95, W * w + 0.1, 0.7, win)
    cyl(-8, 0, 10.6, 0.25, 4, mat("steel", "#5b6068", 0.6, 0.4), 6)
    blob(-6, 0, 10.9, 1.2, 1.2, 0.6, white)


def casino():
    """Casino de Montecarlo: fachada ocre con dos torres de tejado verde cobre y cúpula central."""
    stone, copper, win, gold = mat("tint", "#e9dcc0"), mat("copper", "#5f9b80", 0.4, 0.5), mat("window", "#2b3a4a", 0.2, 0.2), mat("gold", "#c9a14a", 0.8, 0.3)
    L, W = 46, 30
    box(0, 0, 0, L, W, 13, stone)
    prism([(-L / 2, -W / 2), (L / 2, -W / 2), (L / 2 - 4, W / 2 - 4), (-L / 2 + 4, W / 2 - 4)], 13, 13.01, copper)
    roof = prism([(-L / 2 + 1, -W / 2 + 1), (L / 2 - 1, -W / 2 + 1), (L / 2 - 1, W / 2 - 1), (-L / 2 + 1, W / 2 - 1)], 13, 16, copper)
    for sx in (-1, 1):
        x = sx * (L / 2 - 4)
        box(x, W / 2 - 4, 0, 7, 7, 20, stone)
        cyl(x, W / 2 - 4, 20, 4.6, 6, copper, 4, r2=0.3, rot=(0, 0, math.pi / 4))
        cyl(x, W / 2 - 4, 26, 0.15, 2.2, gold, 6)
    box(0, W / 2 - 1, 0, 14, 4, 15, stone)
    blob(0, 2, 16, 6, 6, 5, copper, 12, 6)
    cyl(0, 2, 20.5, 0.6, 2.5, gold, 6)
    for x in range(-18, 19, 4):
        box(x, W / 2 + 0.05, 3, 1.6, 0.12, 4.5, win)
        box(x, W / 2 + 0.05, 8.5, 1.6, 0.12, 3, win)


# ───────────────────────────── Spielberg ─────────────────────────────

def red_bull():
    """El toro de Spielberg: toro de acero corten saltando sobre un arco, ~17 m en total."""
    corten = mat("tint", "#8a4b2a", 0.5, 0.6)
    horn = mat("horn", "#d8cfb8")
    # Arco de acero.
    R, seg = 6.5, 14
    for i in range(seg):
        a0, a1 = math.pi * i / seg, math.pi * (i + 1) / seg
        am = (a0 + a1) / 2
        x, z = math.cos(am) * R, math.sin(am) * R
        o = box(x, 0, z - 0.6, 2 * R * math.sin((a1 - a0) / 2) + 0.2, 2.2, 1.2, corten)
        o.rotation_euler = (0, -(am - math.pi / 2), 0)
    box(0, 0, 0, 16, 4, 0.6, mat("plinth", "#8c8f94"))
    # Toro (largo en +X), encabritado sobre el arco: cuerpo inclinado hacia arriba.
    lift = math.radians(18)
    cz = R + 3.4
    blob(0.5, 0, cz, 4.6, 1.9, 2.1, corten, 12, 8, rot=(0, -lift, 0))
    blob(3.3, 0, cz + 1.4, 2.3, 2.1, 2.4, corten, 10, 6, rot=(0, -lift, 0))      # morrillo
    blob(5.8, 0, cz + 1.0, 1.6, 1.1, 1.2, corten, 10, 6, rot=(0, math.radians(35), 0))  # cabeza baja
    for sy in (-1, 1):
        cyl(6.4, sy * 1.3, cz + 1.6, 0.35, 2.4, horn, 6, r2=0.05, rot=(math.radians(-sy * 70), math.radians(-20), 0))
        # Patas delanteras recogidas y traseras estiradas.
        cyl(3.6, sy * 1.0, cz - 3.2, 0.45, 3.2, corten, 6, r2=0.3, rot=(0, math.radians(-40), 0))
        cyl(-3.4, sy * 1.0, cz - 3.6, 0.55, 3.8, corten, 6, r2=0.3, rot=(0, math.radians(30), 0))
    cyl(-4.6, 0, cz + 0.6, 0.18, 3.2, corten, 6, rot=(0, math.radians(-60), 0))  # cola


# ───────────────────────────── Shanghái ─────────────────────────────

def shanghai_bridge():
    """Puente sobre la recta de meta (largo en X, cruzando la pista): tablero acristalado a 9 m y dos alas encima."""
    white, glass, steel = mat("tint", "#dfe3e8"), mat("glass", "#3d5a78", 0.3, 0.15), mat("steel", "#5b6068", 0.6, 0.4)
    L, W = 93.5, 22
    for sx in (-1, 1):
        box(sx * (L / 2 - 8), 0, 0, 16, W, 16, white)       # torres a cada lado (fuera de la pista)
    box(0, 0, 9, L, W, 1.2, white)                          # suelo del tablero (altura libre 9 m)
    box(0, 0, 10.2, L - 2, W - 2, 4.6, glass)
    box(0, 0, 14.8, L, W, 0.8, white)
    for sx in (-1, 1):                                      # alas curvas
        o = blob(sx * L * 0.24, 0, 18.5, L * 0.3, W * 0.7, 2.2, white, 16, 6)
        o.rotation_euler = (0, math.radians(sx * -8), 0)
    for x in range(-40, 41, 10):
        cyl(x, 0, 15.6, 0.3, 2.4, steel, 6)


def pavilion():
    """Pabellón de equipo de Shanghái: edificio sobre pilotes en el lago con una cubierta ancha."""
    white, glass, steel = mat("tint", "#d6d9de"), mat("glass", "#3d5a78", 0.3, 0.15), mat("steel", "#5b6068", 0.6, 0.4)
    for x in (-5, 5):
        for y in (-5, 5):
            cyl(x, y, 0, 0.4, 3, steel, 6)
    box(0, 0, 3, 14, 14, 4.5, glass)
    box(0, 0, 7.5, 18, 18, 0.6, white)
    box(0, 0, 8.1, 10, 10, 0.9, white)


MODELS = {
    "grandstand": grandstand, "vip-lounge": vip_lounge, "paddock": paddock, "tree": tree, "building": building,
    "yacht": yacht, "yacht-large": yacht_large, "casino": casino, "red-bull": red_bull,
    "shanghai-bridge": shanghai_bridge, "pavilion": pavilion,
}


def build_all(repo):
    out = os.path.join(repo, "public", "models", "scenery")
    os.makedirs(out, exist_ok=True)
    report = []
    for name, fn in MODELS.items():
        clear()
        fn()
        report.append(finish(name, out))
    return report
