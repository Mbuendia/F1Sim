# [CR5, 07/11/2026] Edificios emblemáticos de Shanghái y Yas Marina, modelados en Blender (5.x) con medidas reales.
# Uso (sin interfaz):
#   blender -b --factory-startup --python scripts/blender/cr5-models.py -- <repo>
# Usa las utilidades de scenery-models.py (box, cyl, prism, loft, mat, finish): largo en +X, ancho en Y, alto en +Z,
# frente hacia +Y (−Z en glTF, lo que el juego pone mirando a la pista).
# Referencias de forma (ver docs/design/emblematicos-cr5.md): el modelo de Shanghái de Dave Love (CC BY 4.0,
# shanghai_international_circuit_2018_layout.glb) para la tribuna en U con sus alas y los pabellones con techo a cuatro
# aguas; huellas de OpenStreetMap (ODbL) para las medidas; fotos de Wikimedia Commons para el hotel de Yas Marina.
# Estilo propio, sin marcas reales.
import bpy, bmesh, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
REPO = argv[0] if argv else os.getcwd()
exec(open(os.path.join(REPO, "scripts", "blender", "scenery-models.py"), encoding="utf-8").read())


def scene():  # sin ventana (blender -b): la escena activa
    return bpy.context.scene


def mesh_obj(name, verts, faces, m):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return _link(o, m)


def tube(points, r, m, name="tube", sides=4):
    """Barra de sección cuadrada (o de `sides` lados) a lo largo de una polilínea 3D."""
    from mathutils import Vector
    verts, faces = [], []
    P = [Vector(p) for p in points]
    for i, p in enumerate(P):
        d = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        a = d.cross(up).normalized(); b = d.cross(a).normalized()
        for k in range(sides):
            ang = 2 * math.pi * (k + 0.5) / sides
            verts.append(tuple(p + (a * math.cos(ang) + b * math.sin(ang)) * r))
    for i in range(len(P) - 1):
        for k in range(sides):
            j = (k + 1) % sides
            faces.append((i * sides + k, i * sides + j, (i + 1) * sides + j, (i + 1) * sides + k))
    return mesh_obj(name, verts, faces, m)


def slab_grid(x0, x1, y0, y1, z, t, cell, keep, m, name="slab"):
    """Losa de celdas cuadradas (sus caras de arriba, abajo y bordes) quitando las que `keep(x, y)` rechaza."""
    verts, faces = [], []
    nx, ny = int(round((x1 - x0) / cell)), int(round((y1 - y0) / cell))
    cells = {(i, j) for i in range(nx) for j in range(ny) if keep(x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell)}
    idx = {}
    def v(i, j, top):
        k = (i, j, top)
        if k not in idx:
            idx[k] = len(verts); verts.append((x0 + i * cell, y0 + j * cell, z + (t if top else 0)))
        return idx[k]
    for (i, j) in cells:
        faces.append((v(i, j, 1), v(i + 1, j, 1), v(i + 1, j + 1, 1), v(i, j + 1, 1)))
        faces.append((v(i, j + 1, 0), v(i + 1, j + 1, 0), v(i + 1, j, 0), v(i, j, 0)))
        for (di, dj, a, b) in ((1, 0, (i + 1, j), (i + 1, j + 1)), (-1, 0, (i, j + 1), (i, j)), (0, 1, (i + 1, j + 1), (i, j + 1)), (0, -1, (i, j), (i + 1, j))):
            if (i + di, j + dj) not in cells:
                faces.append((v(*a, 0), v(*b, 0), v(*b, 1), v(*a, 1)))
    return mesh_obj(name, verts, faces, m)


def anchor(x, y, m):
    """Triángulo diminuto en el suelo: así `finish` no baja a z = 0 las piezas que van en el aire (puentes sin pilares)
    y el juego las escala con su altura libre real."""
    return mesh_obj("ancla", [(x, y, 0), (x + 0.03, y, 0), (x, y + 0.03, 0)], [(0, 1, 2)], m)


# ───────────────────────────── Shanghái ─────────────────────────────

def shanghai_tribuna():
    """Tribuna principal (325 × 52 m): grada baja y alta enfrente de los boxes, edificio de accesos detrás y la
    cubierta plana con lucernarios redondos («nenúfares») del modelo de referencia."""
    concrete, seat_a, seat_b = mat("concrete", "#c4c7cc"), mat("seat_red", "#b5262e"), mat("seat_blue", "#22509e")
    glass, roof, steel, banner = mat("glass", "#2f4a63", 0.3, 0.15), mat("roof", "#4a5560", 0.3, 0.5), mat("steel", "#8a9099", 0.6, 0.35), mat("banner", "#e8e9ec")
    L, half = 325.0, 162.5
    block = 25.0
    # Grada baja: 16 filas de delante (+Y) hacia atrás, subiendo.
    for i in range(16):
        y = 23.5 - i * 1.75; z = 1.4 + i * 0.8
        box(0, y, 0, L, 1.75, z, concrete)
        for b in range(13):
            x = -half + block * (b + 0.5)
            box(x, y + 0.3, z, block - 1.6, 0.7, 0.42, seat_a if (b + (i // 8)) % 2 == 0 else seat_b)
    # Pasillo y edificio de accesos bajo la grada alta (cristal entre forjados).
    box(0, -12.5, 0, L, 23, 14.2, concrete)
    for zf in (3.6, 7.6, 11.6):
        box(0, -24.05, zf - 2.4, L - 2, 0.3, 2.2, glass)
    # Grada alta: 12 filas sobre el edificio, voladas hacia la pista.
    for i in range(12):
        y = -1.0 - i * 1.6; z = 15.2 + i * 0.95
        box(0, y, 14.2, L, 1.6, z - 14.2, concrete)
        for b in range(13):
            x = -half + block * (b + 0.5)
            box(x, y + 0.28, z, block - 1.6, 0.62, 0.42, seat_b if (b + (i // 6)) % 2 == 0 else seat_a)
    box(0, 0.8, 13.2, L, 3.2, 1.0, banner)          # antepecho de la grada alta (franja blanca)
    box(0, 25.3, 0, L, 0.4, 1.6, banner)            # antepecho delantero
    box(0, -25.5, 0, L, 1.0, 28.6, concrete)        # muro trasero
    for x in [-half + 9 * k for k in range(37)]:     # lamas verticales del muro trasero
        box(x, -26.2, 2, 0.5, 0.5, 26, steel)
    for x in (-half, half):
        box(x, -0.5, 0, 0.8, 52, 28.6, concrete)
    # Pilares y vigas de la cubierta (de atrás, voladas hacia delante).
    for k in range(13):
        x = -half + 12.5 + k * 25.0
        cyl(x, -21.0, 25.0, 0.45, 4.6, steel, 8)
        tube([(x, -26.0, 29.4), (x, 20.0, 29.0)], 0.45, steel, "viga")
        tube([(x, -24.0, 26.0), (x, 4.0, 29.1)], 0.3, steel, "tirante")
    # Cubierta con lucernarios redondos: dos filas de círculos de 5 m de radio; las primeras filas quedan al aire.
    holes = [(-half + 12.5 + k * 25.0, yc) for k in range(13) for yc in (-14.0, 7.0)]
    slab = box(0, -3.5, 29.6, L + 2, 47, 0.9, roof)
    cutters = []
    for hx, hy in holes:
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=5.3, depth=4, location=(hx, hy, 30.0))
        cutters.append(bpy.context.active_object)
    bpy.ops.object.select_all(action="DESELECT")
    for c in cutters: c.select_set(True)
    bpy.context.view_layer.objects.active = cutters[0]
    bpy.ops.object.join()
    cutter = bpy.context.active_object
    mod = slab.modifiers.new("huecos", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cutter; mod.solver = "EXACT"
    bpy.ops.object.select_all(action="DESELECT"); slab.select_set(True); bpy.context.view_layer.objects.active = slab
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    for hx, hy in holes:  # aro de cada lucernario (sin tapa: se ve el cielo)
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=5.4, depth=1.4, end_fill_type="NOTHING", location=(hx, hy, 30.1))
        _link(bpy.context.active_object, steel)


def shanghai_ala():
    """Ala de la tribuna (120 × 34 m): un edificio puente de tres plantas sobre la pista (18 m libres), con la
    cubierta curva en forma de ala que sube hacia los boxes; se apoya en su torre y, al otro lado, en un núcleo."""
    concrete, glass, white, steel, luz = mat("concrete", "#c4c7cc"), mat("glass", "#2f4a63", 0.3, 0.15), mat("roof", "#eef0f2", 0.2, 0.35), mat("steel", "#8a9099", 0.6, 0.35), mat("luz", "#fff1c8", emission="#fff1c8")
    L, W, C = 120.0, 34.0, 18.0
    box(0, 0, C, L, W, 0.8, concrete)                       # forjado inferior (techo de la pista)
    for z in (22.0, 26.0):
        box(0, 0, z - 0.25, L, W, 0.5, concrete)
    box(0, 0, C + 0.8, L - 1, W - 1.2, 11.2 - 0.8, glass)  # fachada de cristal
    for x in [-L / 2 + 4 * k for k in range(31)]:            # montantes
        for y in (-W / 2 + 0.3, W / 2 - 0.3):
            box(x, y, C + 0.8, 0.35, 0.6, 10.4, white)
    for y in (-13, -5, 5, 13):                                # vigas bajo el forjado (lo que se ve desde la pista)
        box(0, y, C - 1.4, L, 0.9, 1.4, steel)
        box(0, y, C - 1.55, L - 6, 0.25, 0.15, luz)
    for x in [-L / 2 + 10 * k for k in range(13)]:
        box(x, 0, C - 1.0, 0.6, W - 2, 1.0, steel)
    # Cubierta en ala: secciones transversales curvas que suben de 30 m (torre) a 36 m (lado de boxes).
    secs = []
    for k in range(13):
        x = -L / 2 - 1 + k * (L + 2) / 12
        lift = 30.0 + 6.0 * (k / 12) ** 1.6
        prof = []
        for j in range(9):
            y = -W / 2 - 3 + j * (W + 6) / 8
            prof.append((y, lift + 1.8 * (1 - (2 * j / 8 - 1) ** 2)))
        for j in reversed(range(9)):
            y = -W / 2 - 3 + j * (W + 6) / 8
            prof.append((y, lift + 1.8 * (1 - (2 * j / 8 - 1) ** 2) - 0.7))
        secs.append((x, prof))
    loft(secs, white, "ala")
    box(0, 0, 30.0, L - 2, W - 4, 0.4, concrete)
    # Núcleo y pilares inclinados del lado de los boxes.
    box(L / 2 - 4, 0, 0, 7, 9, C, concrete)
    for y in (-13, 13):
        tube([(L / 2 - 1.5, y * 1.15, 0), (L / 2 - 6, y, C)], 0.8, steel, "pilar", 8)


def shanghai_ala_torre():
    """Torre de cada extremo de la tribuna (36 × 42 m, 38 m): sostiene el ala por el lado de la grada."""
    concrete, glass, white, steel = mat("concrete", "#c4c7cc"), mat("glass", "#2f4a63", 0.3, 0.15), mat("roof", "#eef0f2", 0.2, 0.35), mat("steel", "#8a9099", 0.6, 0.35)
    L, W, H = 36.0, 42.0, 38.0
    box(0, 0, 0, L, W, H - 2, concrete)
    for z in range(2, int(H) - 4, 4):
        box(0, 0, z, L + 0.4, W + 0.4, 2.6, glass)
    for x in [-L / 2 + 3 * k for k in range(13)]:
        box(x, W / 2 + 0.4, 1, 0.4, 0.6, H - 4, white)
        box(x, -W / 2 - 0.4, 1, 0.4, 0.6, H - 4, white)
    for y in [-W / 2 + 3 * k for k in range(15)]:
        box(L / 2 + 0.4, y, 1, 0.6, 0.4, H - 4, white)
        box(-L / 2 - 0.4, y, 1, 0.6, 0.4, H - 4, white)
    box(0, 0, H - 2, L + 3, W + 3, 0.8, white)                # visera
    box(0, -6, H - 1.2, 12, 10, 1.2, steel)                   # máquinas
    box(0, W / 2 + 1.5, 0, 14, 3, 6, glass)                   # entrada


def shanghai_pabellon():
    """Pabellón de equipo sobre el lago (22 × 18 m): pilotes, dos plantas de cristal y techo a cuatro aguas con
    linterna, como los del modelo de referencia; la franja «tint» lleva el color del equipo."""
    glass, white, roof, steel, team = mat("glass", "#3a5b78", 0.3, 0.12), mat("frame", "#f1f2f3"), mat("roof", "#c9cdd3", 0.5, 0.35), mat("steel", "#8a9099", 0.6, 0.35), mat("tint", "#d0d4da")
    L, W = 22.0, 18.0
    for x in (-9, -3, 3, 9):
        for y in (-7, 0, 7):
            cyl(x, y, 0, 0.35, 2.6, steel, 8)
    box(0, 0, 2.6, L, W, 0.5, white)                           # plataforma
    box(0, 0, 3.1, L - 2, W - 2, 6.6, glass)
    box(0, 0, 6.3, L - 1.6, W - 1.6, 0.4, white)               # forjado intermedio
    box(0, 0, 9.7, L - 1.2, W - 1.2, 0.9, team)                # franja del equipo
    for x in [-L / 2 + 1 + 2.5 * k for k in range(9)]:
        for y in (-W / 2 + 1, W / 2 - 1):
            box(x, y, 3.1, 0.3, 0.3, 6.6, white)
    for y in [-W / 2 + 1 + 2.67 * k for k in range(7)]:
        for x in (-L / 2 + 1, L / 2 - 1):
            box(x, y, 3.1, 0.3, 0.3, 6.6, white)
    # Techo a cuatro aguas con vuelo y linterna.
    me = bpy.data.meshes.new("techo"); bm = bmesh.new()
    a, b, z0, z1 = L / 2 + 1.6, W / 2 + 1.6, 10.6, 13.2
    c = [bm.verts.new(p) for p in ((-a, -b, z0), (a, -b, z0), (a, b, z0), (-a, b, z0))]
    t = [bm.verts.new(p) for p in ((-3, -1.5, z1), (3, -1.5, z1), (3, 1.5, z1), (-3, 1.5, z1))]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((c[i], c[j], t[j], t[i]))
    bm.faces.new(list(reversed(c))); bm.faces.new(t)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("techo", me); bpy.context.scene.collection.objects.link(o); _link(o, roof)
    box(0, 0, 13.2, 5, 2, 0.9, glass)
    box(0, 0, 14.1, 5.4, 2.4, 0.2, roof)
    box(0, W / 2 + 0.8, 2.6, 4, 1.6, 0.5, white)              # embarcadero de la pasarela


def shanghai_pasarela():
    """Pasarela de madera y acero del pabellón al paddock (20 × 3 m), sobre pilotes."""
    deck, steel = mat("deck", "#9b8064"), mat("steel", "#8a9099", 0.6, 0.35)
    L, W = 20.0, 3.0
    box(0, 0, 0.7, L, W, 0.25, deck)
    for x in (-8, -3, 3, 8):
        for y in (-1.2, 1.2):
            cyl(x, y, 0, 0.18, 0.7, steel, 6)
    for y in (-W / 2 + 0.05, W / 2 - 0.05):
        box(0, y, 1.85, L, 0.08, 0.08, steel)
        for x in [-L / 2 + 2 * k for k in range(11)]:
            box(x, y, 0.95, 0.08, 0.08, 0.95, steel)


# ───────────────────────────── Yas Marina ─────────────────────────────

def _hotel_block(L, W, H, curve=0.0):
    """Bloque de hotel: forjados blancos, cristal retranqueado, lamas verticales y planta baja más alta."""
    white, glass, lobby, roof, lit = mat("frame", "#f4f4f2"), mat("glass", "#28465f", 0.35, 0.12), mat("lobby", "#6f8fa8", 0.2, 0.1), mat("roof", "#9aa1a9"), mat("ventana", "#ffd9a0", emission="#ffcf8a")
    floors = int((H - 6) // 3.6)
    box(0, 0, 0, L - 4, W - 4, 6, lobby)
    box(0, 0, 5.6, L + 1, W + 1, 0.6, white)
    for f in range(floors):
        z = 6.2 + f * 3.6
        box(0, 0, z, L - 1.2, W - 1.2, 3.0, glass)
        box(0, 0, z + 3.0, L + 0.6, W + 0.6, 0.6, white)
    top = 6.2 + floors * 3.6
    for x in [-L / 2 + 3 * k for k in range(int(L // 3) + 1)]:
        for y in (-W / 2, W / 2):
            box(x, y, 6.2, 0.3, 1.2, top - 6.2, white)
    for y in [-W / 2 + 3 * k for k in range(int(W // 3) + 1)]:
        for x in (-L / 2, L / 2):
            box(x, y, 6.2, 1.2, 0.3, top - 6.2, white)
    # Ventanas encendidas al azar (de noche brillan).
    import random
    rnd = random.Random(int(L * 10 + W))
    for f in range(floors):
        z = 6.6 + f * 3.6
        for k in range(int(L // 6)):
            if rnd.random() < 0.35:
                x = -L / 2 + 3 + k * 6
                box(x, W / 2 - 0.55, z, 2.4, 0.1, 2.2, lit)
            if rnd.random() < 0.35:
                x = -L / 2 + 3 + k * 6
                box(x, -W / 2 + 0.55, z, 2.4, 0.1, 2.2, lit)
    box(0, 0, top + 0.6, L - 8, W - 8, max(0.5, H - top - 0.6), roof)


def yas_hotel_a():
    """Edificio del hotel del lado del puerto (130 × 36 m, 38 m)."""
    _hotel_block(130.0, 36.0, 38.0)


def yas_hotel_b():
    """Edificio del hotel del lado del circuito (130 × 45 m, 38 m)."""
    _hotel_block(130.0, 45.0, 38.0)


def yas_hotel_puente():
    """Puente acristalado entre los dos edificios (40 × 14 m), a 14 m sobre la pista."""
    white, glass, steel, luz = mat("frame", "#f4f4f2"), mat("glass", "#28465f", 0.35, 0.12), mat("steel", "#8a9099", 0.6, 0.35), mat("luz", "#fff1c8", emission="#fff1c8")
    L, W, C, H = 40.0, 14.0, 14.0, 24.0
    box(0, 0, C, L, W, 0.9, white)
    box(0, 0, C + 0.9, L, W - 0.6, H - C - 1.8, glass)
    box(0, 0, H - 0.9, L + 0.6, W + 0.6, 0.9, white)
    for x in [-L / 2 + 2.5 * k for k in range(17)]:
        for y in (-W / 2, W / 2):
            box(x, y, C + 0.9, 0.3, 0.4, H - C - 1.8, white)
    for y in (-4.5, 0, 4.5):
        box(0, y, C - 0.9, L, 0.6, 0.9, steel)
        box(0, y, C - 1.0, L - 2, 0.2, 0.1, luz)
    anchor(L / 2 - 0.5, 0, steel)  # dentro del edificio A


def canopy_z(u, v):
    """Altura de la cubierta (misma fórmula que src/scene3d/yasCanopy.ts): de 38 m en el borde a 46 m en el centro."""
    rho = (abs(u) ** 4 + abs(v) ** 4) ** 0.25
    return 38.0 + 8.0 * max(0.0, 1 - rho * rho)


def yas_hotel_cubierta():
    """Cubierta de rejilla (240 × 130 m) sobre los dos edificios y la pista: malla de rombos de acero (los paneles de
    LED los pone el juego encima, uno a uno, en src/scene3d/yasCanopy.ts) y viga de borde."""
    steel, edge = mat("steel", "#c9ced4", 0.7, 0.3), mat("frame", "#f4f4f2")
    L, W, S = 240.0, 130.0, 8.0
    a, b = L / 2, W / 2
    inside = lambda x, y: (abs(x / a) ** 4 + abs(y / b) ** 4) <= 1.0
    # Dos familias de líneas en diagonal (x + y = c y x − y = c), cortadas por el borde superelíptico.
    for sign in (1, -1):
        c = -a - b
        while c <= a + b:
            pts = []
            run = []
            x = -a
            while x <= a + 0.01:
                y = sign * (c - x) if sign == 1 else (x - c)
                if inside(x, y):
                    run.append((x, y, canopy_z(x / a, y / b) + 0.35))
                elif len(run) > 1:
                    pts.append(run); run = []
                else:
                    run = []
                x += S / 4
            if len(run) > 1:
                pts.append(run)
            for r in pts:
                tube(r[::2] + ([r[-1]] if len(r) % 2 == 0 else []), 0.32, steel, "rombo")
            c += S
    ring = []
    for k in range(97):
        t = 2 * math.pi * k / 96
        cu, su = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(cu) ** 0.5, cu); y = b * math.copysign(abs(su) ** 0.5, su)
        ring.append((x, y, 38.4))
    tube(ring, 0.9, edge, "borde", 6)
    # Arcos principales (bajo la malla) que reparten el peso hacia los edificios.
    for y0 in (-b * 0.5, 0, b * 0.5):
        arc = [(x, y0, canopy_z(x / a, y0 / b) - 0.6) for x in [(-a + 6) + k * (2 * a - 12) / 30 for k in range(31)] if inside(x, y0)]
        tube(arc, 0.7, edge, "arco", 6)
    anchor(a * 0.55, -b * 0.6, steel)  # dentro del edificio del lado del circuito


def pasarela_pit():
    """Pasarela de peatones sobre el pit lane (24 × 4 m, 6 m libres): dos torres de escalera y tablero cubierto."""
    white, glass, steel, luz = mat("frame", "#f4f4f2"), mat("glass", "#28465f", 0.35, 0.12), mat("steel", "#8a9099", 0.6, 0.35), mat("luz", "#fff1c8", emission="#fff1c8")
    L, W, C = 24.0, 4.0, 6.0
    for x in (-L / 2 + 2, L / 2 - 2):
        box(x, 0, 0, 4, W, C + 3.2, glass)
        box(x, 0, C + 3.2, 4.4, W + 0.4, 0.4, white)
        for dx in (-1.9, 1.9):
            box(x + dx, 0, 0, 0.3, W + 0.1, C + 3.2, white)
    box(0, 0, C, L - 8, W, 0.5, white)
    box(0, 0, C + 0.5, L - 8, W - 0.3, 2.6, glass)
    box(0, 0, C + 3.1, L - 7.6, W + 0.4, 0.4, white)
    box(0, 0, C - 0.15, L - 9, 0.4, 0.1, luz)
    for x in [-L / 2 + 4 + 2 * k for k in range(9)]:
        for y in (-W / 2, W / 2):
            box(x, y, C + 0.5, 0.2, 0.25, 2.6, steel)


def pantalan():
    """Pantalán flotante del puerto (60 × 11 m): pasillo principal con fingers a un lado, bolardos y farolas."""
    deck, steel, white, luz = mat("deck", "#a8957c"), mat("steel", "#8a9099", 0.6, 0.35), mat("frame", "#f4f4f2"), mat("luz", "#fff1c8", emission="#fff1c8")
    L = 60.0
    box(0, -4, 0.25, L, 3, 0.35, deck)
    for k in range(6):
        x = -L / 2 + 5 + k * 10
        box(x, 1.5, 0.25, 1.2, 8, 0.3, deck)
        cyl(x + 0.9, 5.2, 0, 0.18, 1.2, white, 6)
    for k in range(7):
        x = -L / 2 + k * 10
        cyl(x, -5.3, 0, 0.12, 0.9, steel, 6)
        if k % 2 == 0:
            cyl(x, -2.7, 0.6, 0.06, 3.0, steel, 6)
            box(x, -2.7, 3.6, 0.4, 0.4, 0.25, luz)


MODELS_CR5 = {
    "shanghai-tribuna": shanghai_tribuna, "shanghai-ala": shanghai_ala, "shanghai-ala-torre": shanghai_ala_torre,
    "shanghai-pabellon": shanghai_pabellon, "shanghai-pasarela": shanghai_pasarela,
    "yas-hotel-a": yas_hotel_a, "yas-hotel-b": yas_hotel_b, "yas-hotel-puente": yas_hotel_puente,
    "yas-hotel-cubierta": yas_hotel_cubierta, "pasarela-pit": pasarela_pit, "pantalan": pantalan,
}

if __name__ == "__main__":
    out = os.path.join(REPO, "public", "models", "scenery")
    only = argv[1:]
    for name, fn in MODELS_CR5.items():
        if only and name not in only:
            continue
        clear()
        fn()
        info = finish(name, out)
        print("CR5", info)
