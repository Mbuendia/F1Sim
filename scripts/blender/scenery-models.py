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

def limb(p0, p1, r0, r1, m, seg=8):
    """Tronco de cono de p0 a p1 (patas, cuello, cuernos, cola)."""
    import mathutils
    a, b = mathutils.Vector(p0), mathutils.Vector(p1)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return _link(o, m)


def red_bull():
    """El toro de Spielberg (referencia del usuario, 23/10/2026: «Cartoon Race Track Spielberg» de RCC Design): arco
    blanco y liso por encima y el toro encabritado casi en vertical sobre las patas traseras, con las delanteras al aire,
    la cabeza alta y los cuernos grandes; el cuerpo, una celosía de acero naranja (se ve a través). Largo en +X."""
    arch, corten, gold, plinth = (mat("arch", "#eceef0", 0.1, 0.35), mat("tint", "#c8541e", 0.45, 0.5),
                                  mat("horn", "#e2b84a", 0.7, 0.3), mat("plinth", "#9da1a6"))
    # Arco parabólico blanco y liso, algo más grueso abajo.
    span, top, seg = 28.0, 30.0, 32
    pts = [(-span / 2 + span * i / seg, top * (1 - (2 * i / seg - 1) ** 2)) for i in range(seg + 1)]
    for i in range(seg):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        mid = 1 - abs(2 * (i + 0.5) / seg - 1)
        thick = 2.0 - 0.8 * mid
        length = math.hypot(x1 - x0, z1 - z0) + 0.3
        o = box((x0 + x1) / 2, 0, (z0 + z1) / 2 - thick / 2, length, thick * 0.9, thick, arch)
        o.rotation_euler = (0, -math.atan2(z1 - z0, x1 - x0), 0)
    box(0, 0, 0, 32, 10, 0.5, plinth)
    S = 1.55
    P = lambda x, y, z: (x * S, y * S, z * S)
    body = []
    # Cuartos traseros, tronco y pecho subiendo casi en vertical.
    body.append(blob(*P(-2.6, 0, 5.8), 2.4 * S, 2.0 * S, 2.6 * S, corten, 12, 8, rot=(0, math.radians(-55), 0)))
    body.append(blob(*P(-1.1, 0, 8.2), 3.6 * S, 2.2 * S, 2.5 * S, corten, 12, 8, rot=(0, math.radians(-55), 0)))
    body.append(blob(*P(0.5, 0, 10.6), 2.6 * S, 2.5 * S, 2.8 * S, corten, 12, 8, rot=(0, math.radians(-40), 0)))
    # Cuello y cabeza alta, con el hocico hacia delante.
    body.append(limb(P(1.0, 0, 11.4), P(2.4, 0, 12.4), 1.7 * S, 1.2 * S, corten, 10))
    body.append(blob(*P(2.9, 0, 12.5), 1.6 * S, 1.1 * S, 1.2 * S, corten, 10, 6, rot=(0, math.radians(15), 0)))
    body.append(blob(*P(4.1, 0, 12.1), 0.7 * S, 0.8 * S, 0.6 * S, corten, 8, 6))
    for sy in (-1, 1):
        # Patas traseras apoyadas.
        body.append(limb(P(-2.8, sy * 1.0, 4.8), P(-2.0, sy * 1.1, 2.4), 0.9 * S, 0.5 * S, corten))
        body.append(limb(P(-2.0, sy * 1.1, 2.4), P(-2.5, sy * 1.0, 0.3), 0.5 * S, 0.35 * S, corten))
        # Patas delanteras al aire, dobladas.
        body.append(limb(P(1.2, sy * 1.1, 9.6), P(2.8, sy * 1.2, 9.0), 0.75 * S, 0.45 * S, corten))
        body.append(limb(P(2.8, sy * 1.2, 9.0), P(2.4, sy * 1.2, 7.2), 0.45 * S, 0.3 * S, corten))
    body.append(limb(P(-3.6, 0, 5.4), P(-4.4, 0, 2.8), 0.25 * S, 0.12 * S, corten, 6))
    # Celosía: el cuerpo unido, convertido en una malla de barras (Wireframe).
    bpy.ops.object.select_all(action="DESELECT")
    for o in body:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    lattice = bpy.context.active_object
    wf = lattice.modifiers.new("celosia", "WIREFRAME")
    wf.thickness = 0.32
    wf.use_even_offset = True
    wf.use_replace = True
    bpy.ops.object.modifier_apply(modifier=wf.name)
    # Cuernos dorados, macizos, abiertos hacia fuera y arriba; pezuñas.
    for sy in (-1, 1):
        limb(P(2.6, sy * 0.8, 13.0), P(2.9, sy * 2.3, 13.5), 0.42 * S, 0.3 * S, gold)
        limb(P(2.9, sy * 2.3, 13.5), P(3.7, sy * 3.0, 15.2), 0.3 * S, 0.03 * S, gold)
        blob(*P(-2.5, sy * 1.0, 0.25), 0.5 * S, 0.45 * S, 0.3 * S, corten, 8, 4)
        blob(*P(2.4, sy * 1.2, 7.1), 0.45 * S, 0.4 * S, 0.35 * S, corten, 8, 4)


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


# ───────────────────────────── Noche y Abu Dabi ─────────────────────────────

def floodlight():
    """Torre de luz: mástil con el cabezal de focos (cara luminosa "lamp" hacia +Y, la pista)."""
    steel, lamp, frame = mat("steel", "#8d9299", 0.7, 0.35), mat("lamp", "#fffbe8", 0, 0.2, emission="#fffbe8"), mat("frame", "#3b3f45", 0.5, 0.5)
    cyl(0, 0, 0, 0.45, 24, steel, 8, r2=0.25)
    head = box(0, 0.4, 23.5, 4.2, 0.7, 2.6, frame)
    head.rotation_euler = (math.radians(-25), 0, 0)
    face = box(0, 0.8, 23.65, 3.8, 0.12, 2.2, lamp)
    face.rotation_euler = (math.radians(-25), 0, 0)


def yas_hotel():
    """Hotel de Yas Marina: dos edificios a cada lado de la pista unidos por un puente (altura libre 10 m) y la gran
    cubierta ondulada de luces ("led", que el juego colorea). Largo en X cruzando la pista."""
    white, glass, led = mat("tint", "#e9ecef"), mat("glass", "#33475e", 0.3, 0.15), mat("led", "#8a3cff", 0.1, 0.4, emission="#8a3cff")
    for sx in (-1, 1):
        cx = sx * 57
        box(cx, 0, 0, 52, 40, 8, white)
        box(cx, 0, 8, 50, 36, 14, glass)
        box(cx, 0, 22, 52, 38, 1.0, white)
        o = blob(cx, 0, 24, 34, 26, 9, led, 18, 8)
        o.rotation_euler = (0, math.radians(sx * -5), 0)
    box(0, 0, 10, 66, 14, 1.2, white)           # puente sobre la pista
    box(0, 0, 11.2, 64, 12, 4.0, glass)
    box(0, 0, 15.2, 66, 14, 0.8, white)
    blob(0, 0, 18, 40, 12, 4.5, led, 16, 6)     # la cubierta sigue por encima del puente


def yas_tower():
    """Torre de control de Yas Marina: base en celosía blanca que se estrecha, cuerpo de cristal que se abre y tejado
    cónico (forma de reloj de arena)."""
    lattice, glass, roof = mat("tint", "#eef1f4"), mat("glass", "#1f2a36", 0.4, 0.15), mat("roof", "#d9dde2", 0.3, 0.4)
    cyl(0, 0, 0, 8, 24, lattice, 12, r2=4.5)
    cyl(0, 0, 24, 4.5, 12, glass, 12, r2=8.5)
    cyl(0, 0, 36, 8.6, 0.8, lattice, 12)
    cyl(0, 0, 36.8, 9.5, 7.5, roof, 12, r2=0.6)
    cyl(0, 0, 44.3, 0.2, 2.5, mat("steel", "#8d9299", 0.7, 0.35), 6)


# ───────────────────────────── Componentes del circuito (23/10/2026) ─────────────────────────────

def pit_building():
    """Edificio de boxes: bloque blanco con los portones de los garajes (con franjas de colores de equipo) mirando al
    pit lane (+Y), planta alta acristalada y cubierta que vuela."""
    white, glass, door, steel = mat("tint", "#e4e7eb"), mat("glass", "#2f455c", 0.3, 0.15), mat("door", "#2a2e35"), mat("steel", "#8d9299", 0.6, 0.4)
    team = ["#ff8000", "#1e41ff", "#e8002d", "#27f4d2", "#229971", "#64c4ff", "#6692ff", "#b6babd", "#0093cc", "#52e252"]
    L, W = 40, 16
    box(0, 0, 0, L, W, 6, white)
    for k in range(5):
        x = -L / 2 + 4 + k * 8
        box(x, W / 2 + 0.05, 0, 6.4, 0.15, 4.4, door)
        box(x, W / 2 + 0.1, 4.5, 6.4, 0.15, 0.6, mat(f"team{k}", team[k], 0.1, 0.4))
    box(0, 0, 6, L, W - 1, 4, glass)
    box(0, 1.5, 10, L + 1, W + 4, 0.6, white)
    for x in (-L / 2 + 1, 0, L / 2 - 1):
        cyl(x, W / 2 + 2.6, 6, 0.15, 4, steel, 6)


def start_gantry():
    """Pórtico de salida: dos pilares fuera de la pista, viga por encima (altura libre 6,5 m) con los semáforos de salida
    y un panel. Largo en X, cruzando la pista."""
    white, dark, lights = mat("tint", "#e9ecef"), mat("frame", "#24282e", 0.4, 0.5), mat("lights", "#ff2020", 0, 0.3, emission="#ff2020")
    L = 18.0
    for sx in (-1, 1):
        box(sx * (L / 2 - 0.6), 0, 0, 1.2, 1.6, 9.5, white)
    box(0, 0, 6.5, L, 1.8, 3.0, white)
    box(0, 1.0, 7.0, 6.5, 0.4, 1.6, dark)
    for k in range(5):
        x = -2.6 + k * 1.3
        for z in (7.3, 8.0):
            cyl(x, 1.25, z, 0.22, 0.12, lights, 10, rot=(math.pi / 2, 0, 0)).location = (x, 1.25, z)


def billboard():
    """Valla publicitaria: panel de 12 x 4,5 m sobre dos patas; la cara "panel" (+Y) lleva el patrocinador."""
    panel, back, steel = mat("panel", "#ffffff", 0, 0.5), mat("back", "#3a3f46"), mat("steel", "#8d9299", 0.6, 0.4)
    for x in (-4.5, 4.5):
        box(x, -0.2, 0, 0.3, 0.3, 2.0, steel)
    box(0, -0.2, 2.0, 12, 0.35, 2.5, back)
    box(0, 0.0, 2.05, 11.8, 0.05, 2.4, panel)


def pine():
    """Conífera: tronco y tres conos superpuestos."""
    trunk, leaves = mat("trunk", "#5b4632"), mat("tint", "#1f4d2c", 0, 0.9)
    cyl(0, 0, 0, 0.3, 3, trunk, 6)
    for k, (r, h, z) in enumerate(((3.2, 4.5, 2.2), (2.5, 4.0, 4.6), (1.7, 3.6, 6.9))):
        cyl(0, 0, z, r, h, leaves, 8, r2=0.1)


def palm():
    """Palmera: tronco curvo por tramos y siete hojas largas que caen."""
    trunk, leaves = mat("trunk", "#8a6a45"), mat("tint", "#3f7a2e", 0, 0.8)
    pts = [(0, 0), (0.3, 3), (0.8, 6), (1.4, 8.6)]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        limb((x0, 0, z0), (x1, 0, z1), 0.32, 0.26, trunk, 6)
    top = (1.4, 0, 8.6)
    for k in range(7):
        a = 2 * math.pi * k / 7
        tip = (top[0] + math.cos(a) * 3.6, math.sin(a) * 3.6, top[2] - 1.6)
        mid = (top[0] + math.cos(a) * 1.8, math.sin(a) * 1.8, top[2] + 0.4)
        limb(top, mid, 0.5, 0.35, leaves, 4)
        limb(mid, tip, 0.35, 0.05, leaves, 4)


MODELS = {
    "grandstand": grandstand, "vip-lounge": vip_lounge, "paddock": paddock, "tree": tree, "building": building,
    "yacht": yacht, "yacht-large": yacht_large, "casino": casino, "red-bull": red_bull,
    "shanghai-bridge": shanghai_bridge, "pavilion": pavilion,
    "floodlight": floodlight, "yas-hotel": yas_hotel, "yas-tower": yas_tower,
    "pit-building": pit_building, "start-gantry": start_gantry, "billboard": billboard, "pine": pine, "palm": palm,
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


# ───────────────────────────── Coche ligero (de lejos) ─────────────────────────────

def build_car_lod(repo, target_tris=6000):
    """Versión ligera del monoplaza del juego (public/models/f1-car.glb) para los coches lejanos: el mismo modelo con
    menos polígonos (Decimate), sus materiales de librea y sin animación. Se guarda en public/models/f1-car-lod.glb."""
    clear()
    src = os.path.join(repo, "public", "models", "f1-car.glb")
    bpy.ops.import_scene.gltf(filepath=src)
    sc = scene()
    meshes = [o for o in sc.objects if o.type == "MESH"]
    # El juego pinta el coche por el nombre de cada material: sin «.001» ni parecidos.
    import re
    for o in meshes:
        for m in o.data.materials:
            base = re.sub(r"\.\d{3}$", "", m.name)
            if base != m.name:
                old = bpy.data.materials.get(base)
                if old is not None:
                    old.name = base + "_previo"
                m.name = base
    total = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    # Reparto por piezas: la carrocería se lleva casi todo; las ruedas, unos 500 cada una (antes se aplanan las caras
    # coplanarias para que sigan siendo cilindros y no bolas); rótulos y bandas, lo justo.
    budget = {"body": target_tris, "wheel": 500, "decal": 220, "band": 60}
    for o in meshes:
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        kind = next((k for k in budget if o.name.startswith(k)), "body")
        bpy.context.view_layer.objects.active = o
        if kind == "wheel":
            flat = o.modifiers.new("flat", "DECIMATE")
            flat.decimate_type = "DISSOLVE"
            flat.angle_limit = math.radians(4)
            bpy.ops.object.modifier_apply(modifier=flat.name)
            tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        mod = o.modifiers.new("lod", "DECIMATE")
        mod.ratio = max(0.01, min(1.0, budget[kind] / max(1, tris)))
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(repo, "public", "models", "f1-car-lod.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                              use_active_scene=True, export_animations=False)
    after = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sc.objects if o.type == "MESH")
    return {"before": total, "after": after, "bytes": os.path.getsize(path)}
