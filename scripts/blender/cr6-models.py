# [CR6, 07/11/2026] Piezas comunes de los circuitos sacadas de OpenStreetMap: puente de carretera, viga del monorraíl
# y boca de paso bajo la pista. Modeladas en Blender (5.x), estilo propio, sin marcas reales.
# Uso (sin interfaz):
#   blender -b --factory-startup --python scripts/blender/cr6-models.py -- <repo> [nombres]
# Mismas reglas que scenery-models.py: largo en +X (de lado a lado de la pista), ancho en Y, alto en +Z, frente en +Y.
import bpy, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
REPO = argv[0] if argv else os.getcwd()
exec(open(os.path.join(REPO, "scripts", "blender", "cr5-models.py"), encoding="utf-8").read().split("MODELS_CR5 = {")[0])


def puente_carretera():
    """Puente de carretera sobre la pista (40 × 14 m, 6,5 m libres): estribos de hormigón fuera de la pista, tablero
    con vigas, aceras, pretiles y farolas; un panel liso a cada lado para el rótulo de parodia."""
    concrete, dark, asphalt = mat("concrete", "#bfc2c6"), mat("concrete_dark", "#8e9297"), mat("asphalt", "#3a3d42")
    steel, panel, luz = mat("steel", "#8a9099", 0.6, 0.35), mat("panel", "#e8e9ec"), mat("luz", "#fff1c8", emission="#fff1c8")
    L, W, C = 40.0, 14.0, 6.5
    for s in (-1, 1):
        x = s * (L / 2 - 2.5)
        box(x, 0, 0, 5, W + 1, C, concrete)            # estribo
        box(x + s * 1.6, 0, 0, 1.8, W + 3, C + 0.6, dark)  # muro de cierre
        for y in (-W / 2 - 1.2, W / 2 + 1.2):            # aletas
            box(x + s * 2.6, y, 0, 3.2, 0.8, C - 1.0, dark)
    for y in (-4.5, -1.5, 1.5, 4.5):                     # vigas
        box(0, y, C, L - 6, 1.0, 1.1, dark)
    box(0, 0, C + 1.1, L, W, 0.5, concrete)              # losa
    box(0, 0, C + 1.6, L, W - 4.2, 0.08, asphalt)        # calzada
    for y in (-W / 2 + 1.05, W / 2 - 1.05):
        box(0, y, C + 1.6, L, 2.1, 0.22, concrete)       # aceras
    for y in (-W / 2 + 0.15, W / 2 - 0.15):
        box(0, y, C + 1.82, L, 0.3, 1.1, concrete)       # pretil
        box(0, y, C + 2.92, L, 0.18, 0.08, steel)        # barandilla
    for s in (-1, 1):
        box(0, s * (W / 2 + 0.06), C + 0.2, L - 8, 0.12, 1.5, panel)  # panel del rótulo
    for x in (-12, 0, 12):
        for y in (-W / 2 + 0.6, W / 2 - 0.6):
            cyl(x, y, C + 1.82, 0.09, 6.5, steel, 6)
            box(x, y * 0.86, C + 8.3, 1.2, 0.35, 0.18, luz)


def monorrail():
    """Viga del monorraíl sobre la pista (40 × 3,5 m, 7 m libres): dos pilares en T de hormigón fuera de la pista y la
    viga cajón con su carril de rodadura y la pasarela de mantenimiento."""
    concrete, dark, steel, panel = mat("concrete", "#d3d4d6"), mat("concrete_dark", "#9a9ea3"), mat("steel", "#8a9099", 0.6, 0.35), mat("panel", "#e8e9ec")
    L, C = 40.0, 7.0
    for s in (-1, 1):
        x = s * (L / 2 - 1.8)
        cyl(x, 0, 0, 1.25, C - 0.8, concrete, 16)        # pilar
        box(x, 0, C - 0.9, 3.4, 4.6, 0.9, dark)          # cabezal en T
    box(0, 0, C, L, 0.9, 1.9, concrete)                  # viga cajón
    box(0, 0, C + 1.9, L, 0.7, 0.12, steel)              # rodadura
    box(0, 1.15, C + 0.6, L - 4, 1.0, 0.12, steel)       # pasarela
    for x in [-L / 2 + 2 + 2.4 * k for k in range(16)]:
        box(x, 1.62, C + 0.6, 0.08, 0.08, 1.0, steel)
    box(0, 1.65, C + 1.55, L - 4, 0.06, 0.06, steel)
    box(0, -0.48, C + 0.25, L - 10, 0.06, 1.3, panel)    # panel del rótulo


def boca_tunel():
    """Boca de un paso bajo la pista (12 × 8 m, 5 m libres): muro frontal con arco rebajado, aletas inclinadas, interior
    oscuro y luces en el techo. La abertura mira a +Y."""
    concrete, dark, black, luz = mat("concrete", "#b9bcbf"), mat("concrete_dark", "#7c8085"), mat("tunnel", "#141619"), mat("luz", "#fff1c8", emission="#fff1c8")
    W, D, H = 12.0, 8.0, 7.0
    open_w, open_h = 8.4, 5.0
    side = (W - open_w) / 2
    for s in (-1, 1):
        box(s * (open_w / 2 + side / 2), D / 2 - 0.6, 0, side, 1.2, H, concrete)       # jambas
        prism([(s * W / 2, D / 2), (s * (W / 2 + 4.5), D / 2 + 3.5), (s * (W / 2 + 4.5), D / 2 + 4.1), (s * W / 2, D / 2 + 0.6)], 0, 2.2, dark)  # aleta
    # Arco rebajado: dovelas del muro frontal por encima de la abertura.
    seg = 10
    for k in range(seg):
        a0, a1 = math.pi * k / seg, math.pi * (k + 1) / seg
        x0, x1 = -math.cos(a0) * open_w / 2, -math.cos(a1) * open_w / 2
        z0 = open_h - 1.2 + math.sin((a0 + a1) / 2) * 1.2
        box((x0 + x1) / 2, D / 2 - 0.6, z0, abs(x1 - x0) + 0.02, 1.2, H - z0, concrete)
    box(0, D / 2 - 0.2, H, W + 0.6, 1.6, 0.5, dark)                                     # albardilla
    box(0, -D / 2 + 3.5, 0, open_w, D - 1, 0.05, black)                                 # suelo del interior
    for s in (-1, 1):
        box(s * open_w / 2, -0.5, 0, 0.3, D - 1.2, open_h, black)                       # paredes del interior
    box(0, -0.5, open_h - 0.1, open_w, D - 1.2, 0.4, black)                             # techo del interior
    box(0, -D / 2 + 0.2, 0, open_w, 0.3, open_h, black)                                 # fondo
    for y in (-2.5, 0.5):
        box(0, y, open_h - 0.25, 1.4, 0.3, 0.12, luz)


# ── Tanda 1 (08/11/2026): un modelo propio por circuito, colocado en su huella de OpenStreetMap. ──

def tilt(o, ax=0.0, ay=0.0):
    """Inclina una pieza ya colocada (rotación en X e Y, conservando su giro en Z)."""
    o.rotation_euler = (ax, ay, o.rotation_euler[2])
    return o


def casino_montreal():
    """Casino de la isla de Montreal (80 × 60 m, 30 m): el antiguo pabellón de Francia de la Expo 67, núcleo de cristal
    con forjados blancos y su piel de lamas de aluminio inclinadas hacia fuera; al lado, el cubo de cristal del pabellón
    vecino unido por una pasarela, y la plaza de acceso con su marquesina."""
    white, alu, glass = mat("white", "#eef0f2"), mat("alu", "#c9ced4", 0.75, 0.3), mat("glass", "#2c4a66", 0.3, 0.12)
    plaza, dark, luz = mat("plaza", "#a7aaae"), mat("dark", "#565b61"), mat("luz", "#ffe9b0", emission="#ffe9b0")
    box(0, 0, 0, 80, 60, 0.4, plaza)
    # Pabellón principal: núcleo y forjados.
    cx, L, W, H = -10, 52, 40, 27
    box(cx, 0, 0.4, L - 4, W - 4, H - 1, glass)
    for z in range(0, 26, 5):
        box(cx, 0, 0.4 + z, L, W, 0.6, white)
    box(cx, 0, H, L - 6, W - 6, 2.2, white)               # remate
    box(cx, 0, H + 2.2, 16, 12, 3.0, dark)                # casetón de máquinas
    # Lamas de aluminio en las cuatro fachadas, inclinadas hacia fuera.
    for k in range(17):
        x = cx - L / 2 + 1.5 + k * (L - 3) / 16
        for s in (-1, 1):
            tilt(box(x, s * (W / 2 + 1.6), 0.4, 0.5, 2.6, H + 1, alu), ax=-s * math.radians(9))
    for k in range(13):
        y = -W / 2 + 1.5 + k * (W - 3) / 12
        for s in (-1, 1):
            tilt(box(cx + s * (L / 2 + 1.6), y, 0.4, 2.6, 0.5, H + 1, alu), ay=s * math.radians(9))
    # Cubo de cristal vecino y pasarela.
    qx = 27
    box(qx, 4, 0.4, 22, 22, 18, glass)
    for z in (0.4, 6.4, 12.4, 18.0):
        box(qx, 4, z, 23, 23, 0.5, white)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(qx + sx * 11.2, 4 + sy * 11.2, 0.4, 0.8, 0.8, 18.4, white)
    box((cx + L / 2 + qx - 11) / 2 + 1, 4, 8, qx - 11 - (cx + L / 2) + 2, 5, 3.2, glass)
    box((cx + L / 2 + qx - 11) / 2 + 1, 4, 11.2, qx - 11 - (cx + L / 2) + 2, 5.4, 0.4, white)
    # Marquesina de la entrada y luces de la plaza.
    box(cx, -W / 2 - 9, 5, 20, 10, 0.5, white)
    for x in (cx - 8, cx + 8):
        cyl(x, -W / 2 - 12.5, 0.4, 0.25, 4.6, alu, 8)
    for x in range(-36, 40, 12):
        cyl(x, -28, 0.4, 0.12, 5, dark, 6)
        box(x, -28, 5.4, 0.8, 0.8, 0.3, luz)


def cobertizo_remo():
    """Cobertizo de remo del lago de Albert Park (30 × 14 m, 8 m): nave de madera con tejado a dos aguas de chapa,
    porche corrido mirando al lago, embarcadero sobre pilotes y los botes de remo en sus estantes."""
    wood, trim, roof = mat("wood", "#9b7653"), mat("trim", "#f0ece4"), mat("roof", "#5f6b73", 0.4, 0.45)
    deck, pile, boat, door = mat("deck", "#7a5b3e"), mat("pile", "#4b3a2a"), mat("boat", "#e9e2d0", 0.1, 0.4), mat("door", "#3f4a52")
    L, W, H = 22.0, 10.0, 4.2
    box(-4, 0, 0, L, W, 0.5, trim)                         # zócalo
    box(-4, 0, 0.5, L, W, H, wood)
    for k in range(6):                                      # portones de los botes (lado del lago, +Y)
        box(-4 - L / 2 + 2 + k * 3.6, W / 2 + 0.05, 0.5, 2.8, 0.1, 3.2, door)
    # Tejado a dos aguas: dos faldones inclinados y los hastiales.
    pitch = math.radians(24)
    for s in (-1, 1):
        o = box(-4, s * (W / 4 + 0.2), H + 0.5 + math.tan(pitch) * W / 4 - 0.1, L + 1.2, W / 2 / math.cos(pitch) + 0.6, 0.25, roof)
        tilt(o, ax=s * pitch)
    for s in (-1, 1):
        prism([(-W / 2, 0), (W / 2, 0), (0, math.tan(pitch) * W / 2)], 0, 0.3, trim, "hastial")
    gable = [o for o in bpy.context.scene.objects if o.name.startswith("hastial")]
    for o, s in zip(gable, (-1, 1)):
        o.rotation_euler = (math.pi / 2, 0, math.pi / 2)
        o.location = (-4 + s * (L / 2 + 0.15) - 0.15, 0, H + 0.5)
    # Porche y embarcadero.
    box(-4, W / 2 + 2, 0.8, L, 4, 0.25, deck)
    for k in range(7):
        cyl(-4 - L / 2 + 0.5 + k * (L - 1) / 6, W / 2 + 3.8, 0.0, 0.12, 3.6, trim, 6)
    box(-4, W / 2 + 2.2, 3.6, L + 0.6, 4.6, 0.2, roof)
    box(9, 2, 0.6, 8, 3, 0.25, deck)                       # rampa de botadura
    box(13, W / 2 + 2, 0.4, 3, 9, 0.25, deck)               # embarcadero
    for y in (W / 2 - 1.5, W / 2 + 2, W / 2 + 5.5):
        for x in (11.8, 14.2):
            cyl(x, y, 0.0, 0.14, 0.5, pile, 6)
    # Botes en su estante, junto a la nave.
    for z in (0.9, 1.8, 2.7):
        box(-4, -W / 2 - 1.2, z, L - 2, 0.25, 0.08, pile)
        loft([(-14, [(-0.2, z + 0.1), (0.2, z + 0.1), (0, z + 0.4)]), (-4, [(-0.35, z + 0.1), (0.35, z + 0.1), (0, z + 0.5)]),
              (6, [(-0.2, z + 0.1), (0.2, z + 0.1), (0, z + 0.4)])], boat, "bote")
    for o in [o for o in bpy.context.scene.objects if o.name.startswith("bote")]:
        o.location = (0, -W / 2 - 1.2, 0)


def esplanade_domo():
    """Una cúpula de la Esplanade (Teatros de la Bahía, 110 × 80 m, 35 m): cáscara de vidrio en forma de media fruta
    cubierta de parasoles de aluminio en punta (la «fruta con pinchos»), sobre un zócalo de piedra con la entrada."""
    glass, alu, stone, dark = mat("glass", "#3b5871", 0.35, 0.15), mat("alu", "#c3c8cd", 0.85, 0.3), mat("stone", "#cbbfae"), mat("dark", "#33383d")
    a, b, c = 55.0, 40.0, 35.0
    box(0, 0, 0, 2 * a + 6, 2 * b + 6, 1.2, stone)                     # zócalo
    box(0, -b - 1, 1.2, 30, 6, 6, dark)                                 # entrada
    # Cáscara: media esfera (sin la mitad de abajo, que bajaría la base) escalada a la planta y la altura.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=1, location=(0, 0, 0))
    shell = _link(bpy.context.active_object, glass)
    bm = bmesh.new(); bm.from_mesh(shell.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
    bm.to_mesh(shell.data); bm.free()
    shell.scale = (a, b, c - 1.2); shell.location = (0, 0, 1.2)
    # Parasoles: pirámides de tres caras en punta repartidas por la cáscara (anillos de latitud), mirando hacia fuera.
    for ring in range(1, 9):
        phi = math.pi / 2 * ring / 9.2
        n = max(6, int(40 * math.cos(phi)))
        for k in range(n):
            th = 2 * math.pi * (k + 0.5 * (ring % 2)) / n
            nx, ny, nz = math.cos(phi) * math.cos(th), math.cos(phi) * math.sin(th), math.sin(phi)
            x, y, z = a * nx, b * ny, 1.2 + (c - 1.2) * nz
            gx, gy, gz = nx / a, ny / b, nz / (c - 1.2)
            gl = math.sqrt(gx * gx + gy * gy + gz * gz)
            ux, uy, uz = gx / gl, gy / gl, gz / gl
            # El centro del cono, a media altura sobre la cáscara en la dirección de la normal.
            bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=2.6, radius2=0.05, depth=3.4, location=(x + ux * 1.5, y + uy * 1.5, z + uz * 1.5),
                                            rotation=(0, math.acos(max(-1, min(1, uz))), math.atan2(uy, ux)))
            _link(bpy.context.active_object, alu)
    cyl(0, 0, c - 0.4, 3, 1.2, alu, 12)                                  # remate


def estadio_miami():
    """Estadio de Miami (290 × 240 m, 46 m): cuenco ovalado de dos anfiteatros (asientos verde agua), fachada de
    vestíbulos, la gran marquesina blanca en anillo sostenida por cuatro mástiles de esquina con sus tirantes, los
    marcadores de los fondos y el campo."""
    seats, seats2, concrete, white = mat("seats", "#1aa3a8"), mat("seats_hi", "#f08a2b"), mat("concrete", "#c7c9cc"), mat("white", "#f4f5f6", 0.2, 0.4)
    field, lines_m, steel, screen = mat("field", "#3f8a3a", 0, 0.9), mat("lines", "#f4f4f4"), mat("steel", "#9aa1a9", 0.7, 0.3), mat("screen", "#14181c", 0.2, 0.3, emission="#2a3d52")
    box(0, 0, 0, 170, 120, 0.4, field)
    box(0, 0, 0.4, 110, 49, 0.1, lines_m)
    box(0, 0, 0.45, 108, 47, 0.1, field)
    n = 40
    for k in range(n):
        t0 = 2 * math.pi * k / n
        cx, cy = math.cos(t0), math.sin(t0)
        # Gradas escalonadas: anfiteatro bajo (3 escalones), alto (3 escalones, encima) y fachada de vestíbulos.
        for step in range(3):
            for r0, z0, m in ((86, 0.4, seats), (108, 15, seats2)):
                r = r0 + step * 6.5
                w = 2 * math.pi * r * 0.9 / n + 1.0
                box(r * cx, r * 0.81 * cy, z0, 6.7, w, 3.5 + step * 4.2, m, rot=t0)
        r = 130
        box(r * cx, r * 0.81 * cy, 0.4, 4, 2 * math.pi * r * 0.9 / n + 1.0, 30, concrete, rot=t0)
        # Marquesina: panel blanco en anillo sobre las gradas.
        r = 106
        box(r * cx, r * 0.81 * cy, 41, 46, 2 * math.pi * r * 0.9 / n + 1.5, 0.8, white, rot=t0)
    # Cuatro mástiles de esquina con tirantes hacia la marquesina.
    for sx in (-1, 1):
        for sy in (-1, 1):
            mx, my = sx * 135, sy * 112
            cyl(mx, my, 0, 1.8, 58, steel, 10)
            for tx, ty in ((sx * 95, sy * 40), (sx * 60, sy * 75)):
                tube([(mx, my, 56), (tx, ty, 41.5)], 0.25, steel, "tirante")
    for s in (-1, 1):
        o = box(s * 101, 0, 30, 2, 30, 10, screen)                 # marcadores de los fondos
        box(s * 101, 0, 22, 1.5, 4, 8, concrete)


# ── Tanda 2 (08/11/2026): Las Vegas, Suzuka, Bakú y Zandvoort. ──

def _cyl_y(x, y, z, r, depth, m, seg=16):
    """Cilindro con el eje en Y (centrado en x, y, z)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=(x, y, z), rotation=(math.pi / 2, 0, 0))
    return _link(bpy.context.active_object, m)


def _ring(cx, cz, r, y, n=36):
    return [(cx + r * math.cos(2 * math.pi * k / n), y, cz + r * math.sin(2 * math.pi * k / n)) for k in range(n + 1)]


def noria_suzuka():
    """Noria del parque de Suzuka (47 × 16 m, 52 m): dos llantas de acero blanco con radios en tensión, el eje sobre
    dos caballetes en A, 32 cabinas de colores colgadas entre las llantas, luces en la llanta y la estación de subida."""
    white, steel, base = mat("white", "#f2f3f5", 0.3, 0.35), mat("steel", "#9aa1a9", 0.7, 0.3), mat("concrete", "#c3c5c8")
    luz = mat("luz", "#ffe6a8", emission="#ffe6a8")
    cols = [mat(f"cabina{k}", c, 0.2, 0.4) for k, c in enumerate(("#e2463b", "#f2b631", "#3aa0db", "#4cb35a", "#f07fb0", "#8f5bd1"))]
    R, cz = 22.5, 27.5
    for y in (-2.6, 2.6):
        tube(_ring(0, cz, R, y, 48), 0.45, white, "llanta", 8)
        tube(_ring(0, cz, R - 1.8, y, 48), 0.22, white, "llanta2", 6)
        for k in range(24):
            a = 2 * math.pi * k / 24
            tube([(0, y * 0.4, cz), (R * math.cos(a), y, cz + R * math.sin(a))], 0.09, steel, "radio", 4)
    for k in range(48):
        a = 2 * math.pi * (k + 0.5) / 48
        box(R * math.cos(a), 0, cz + R * math.sin(a) - 0.2, 0.5, 5.6, 0.4, luz)
    _cyl_y(0, 0, cz, 1.6, 7.0, steel, 16)                                   # buje
    for s in (-1, 1):                                                       # caballetes en A
        for sx in (-1, 1):
            tube([(sx * 13, s * 7.2, 0.6), (0, s * 3.4, cz)], 0.55, white, "pata", 8)
        tube([(-6.5, s * 5.3, cz / 2), (6.5, s * 5.3, cz / 2)], 0.3, white, "riostra", 6)
    for k in range(32):                                                     # cabinas colgadas
        a = 2 * math.pi * k / 32
        x, z = R * math.cos(a), cz + R * math.sin(a)
        box(x, 0, z - 0.3, 0.25, 0.25, 0.6, steel)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=1.3, location=(x, 0, z - 2.0))
        g = _link(bpy.context.active_object, cols[k % len(cols)]); g.scale = (1.0, 1.25, 1.1)
    box(0, 0, 0, 30, 16, 0.6, base)                                         # estación
    box(0, -5, 0.6, 14, 5, 3.2, white)
    box(0, -5, 3.8, 15, 6, 0.3, steel)
    box(0, 0, 0.6, 6, 4, 1.2, base)


def globo_paris():
    """Globo del hotel parisino de Las Vegas (20 × 20 m, 46 m): marquesina de la entrada, la cesta y el globo de rayas
    con anillos y gajos de luces (el rótulo luminoso de la avenida)."""
    blue, gold, red, white = mat("blue", "#1e4fa3", 0.2, 0.35), mat("gold", "#f2c14e", 0.6, 0.3), mat("red", "#c8323a", 0.2, 0.4), mat("white", "#efe8da")
    luz, dark = mat("luz", "#fff0c0", emission="#fff0c0"), mat("dark", "#3a3f45")
    box(0, 0, 0, 20, 20, 1.0, dark)                                         # zócalo
    box(0, 0, 1.0, 17, 17, 5.0, white)                                      # marquesina
    box(0, 0, 6.0, 19, 19, 0.6, gold)
    for x in (-7, -3.5, 0, 3.5, 7):
        box(x, 8.6, 1.0, 1.2, 0.3, 4.6, luz)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=3.4, radius2=6.0, depth=8, location=(0, 0, 10.6))
    _link(bpy.context.active_object, red)                                   # cesta y cuello
    cyl(0, 0, 14.6, 4.2, 1.0, gold, 24)
    cz, r = 33.0, 10.0
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=(0, 0, cz))
    o = _link(bpy.context.active_object, blue); o.scale = (1.0, 1.0, 1.15)
    for lat in (-0.55, -0.2, 0.15, 0.5):                                    # anillos de luces
        rr = r * math.cos(math.asin(lat)) + 0.08
        bpy.ops.mesh.primitive_torus_add(major_radius=rr, minor_radius=0.22, major_segments=40, minor_segments=6, location=(0, 0, cz + lat * r * 1.15))
        _link(bpy.context.active_object, luz)
    for k in range(6):                                                      # gajos dorados
        bpy.ops.mesh.primitive_torus_add(major_radius=r + 0.06, minor_radius=0.16, major_segments=48, minor_segments=5, location=(0, 0, cz),
                                         rotation=(math.pi / 2, 0, math.pi * k / 6))
        t = _link(bpy.context.active_object, gold); t.scale = (1.0, 1.15, 1.0)  # el aro va de pie: su Y local es la altura
    for s in (-1, 1):                                                       # tirantes de la cesta
        for t2 in (-1, 1):
            tube([(s * 3.2, t2 * 3.2, 14.6), (s * 5.6, t2 * 5.6, 23.5)], 0.12, dark, "cuerda", 4)
    cyl(0, 0, cz + r * 1.15 - 0.4, 0.6, 2.4, gold, 8)                       # remate
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.8, location=(0, 0, cz + r * 1.15 + 2.4))
    _link(bpy.context.active_object, luz)


def hotel_lago():
    """Hotel del lago de Las Vegas (230 × 150 m, 156 m): torre curva de color crema mirando al lago, con el cuerpo
    central más alto y las alas escalonadas, cubiertas de teja, bandas de ventanas y el zócalo del casino detrás."""
    cream, cream2, roof = mat("cream", "#e9dcc4"), mat("cream_dark", "#cdbd9f"), mat("roof", "#b4583c")
    # Ventanas con luz cálida tenue: de noche la torre se ve encendida, como en la avenida.
    glass, luz, stone = mat("glass", "#4a5560", 0.3, 0.2, emission="#8a6a3a"), mat("luz", "#ffe1a0", emission="#ffe1a0"), mat("stone", "#bfb39d")
    box(0, -45, 0, 220, 58, 16, stone)                                      # casino y zócalo
    box(0, -45, 16, 200, 50, 1.2, cream2)
    R, cy = 135.0, 85.0
    n = 15
    for k in range(n):
        t = -0.82 + 1.64 * (k + 0.5) / n
        x, y = R * math.sin(t), cy - R * math.cos(t)
        dist = abs(k - (n - 1) / 2)
        h = 141 - dist * 7.0
        w = 2 * R * math.sin(1.64 / n / 2) + 0.6
        rot = t
        box(x, y, 0, w, 24, h, cream, rot=rot)
        box(x, y, h, w + 0.6, 25, 1.4, cream2, rot=rot)                     # cornisa
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=w * 0.75, radius2=w * 0.15, depth=4.5,
                                        location=(x, y, h + 1.4 + 2.25), rotation=(0, 0, rot + math.pi / 4))
        c = _link(bpy.context.active_object, roof); c.scale = (1.0, 0.9 * 25 / w, 1.0)
        for z in range(14, int(h) - 6, 9):                                  # bandas de ventanas (lago y espalda)
            for s in (-1, 1):
                ox, oy = -math.sin(rot) * s * 12.1, math.cos(rot) * s * 12.1
                box(x + ox, y + oy, z, w - 1.6, 0.3, 3.0, glass, rot=rot)
        if k == n // 2:                                                     # remate del cuerpo central
            box(x, y, h + 1.4, 14, 14, 8, cream2, rot=rot)
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=11, radius2=0.5, depth=6, location=(x, y, h + 12.4), rotation=(0, 0, rot + math.pi / 4))
            _link(bpy.context.active_object, roof)
    for x in range(-95, 100, 19):                                           # farolas del paseo del lago
        cyl(x, 68 if abs(x) < 60 else 60, 0, 0.2, 6, stone, 6)
        box(x, 68 if abs(x) < 60 else 60, 6, 0.9, 0.9, 0.6, luz)


def fuentes_lago():
    """Fuentes del lago de Las Vegas (260 × 30 m, 70 m): dos filas de surtidores en curva suave, con chorros altos y
    bajos alternos que forman una ola (el punto más alto, 70 m, en el centro), su bruma y la barandilla del paseo."""
    jet, jet2, mist = mat("chorro", "#eaf6ff", 0.0, 0.2, emission="#bfe3ff"), mat("chorro_bajo", "#f4fbff", 0.0, 0.2, emission="#d8efff"), mat("bruma", "#f2f8fc", 0.0, 0.6)
    stone, rail = mat("stone", "#c9bfae"), mat("rail", "#3b4047", 0.6, 0.4)
    n = 36
    for k in range(n):
        u = (k + 0.5) / n
        x = -125 + 250 * u
        y = -6 * math.cos((u - 0.5) * math.pi)
        h = 14 + 56 * math.sin(math.pi * u) ** 2 * (0.75 + 0.25 * math.cos(9 * math.pi * u))
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.5, radius2=0.25, depth=h, location=(x, y, h / 2))
        _link(bpy.context.active_object, jet)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=2.6, location=(x, y, h - 0.5))
        b = _link(bpy.context.active_object, mist); b.scale = (1.4, 1.4, 0.8)
        hb = 6 + 5 * (k % 2)                                                # fila baja
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=1.0, radius2=0.2, depth=hb, location=(x, y + 7, hb / 2))
        _link(bpy.context.active_object, jet2)
    for k in range(52):                                                     # barandilla en curva
        u0, u1 = k / 52, (k + 1) / 52
        x0, x1 = -130 + 260 * u0, -130 + 260 * u1
        y0, y1 = 14 - 2 * math.cos((u0 - 0.5) * math.pi), 14 - 2 * math.cos((u1 - 0.5) * math.pi)
        box((x0 + x1) / 2, (y0 + y1) / 2, 0, x1 - x0 + 0.1, 0.6, 1.0, stone, rot=math.atan2(y1 - y0, x1 - x0))
        box((x0 + x1) / 2, (y0 + y1) / 2, 1.0, x1 - x0 + 0.1, 0.12, 0.08, rail, rot=math.atan2(y1 - y0, x1 - x0))


def casa_gobierno():
    """Casa de Gobierno de Bakú (105 × 68 m, 52 m): palacio de piedra arenisca en torno a un patio, con el cuerpo
    central de la fachada más alto, su pórtico de columnas, la torre escalonada con aguja y las torres de esquina."""
    sand, sand2, dark = mat("sand", "#d9c49c"), mat("sand_dark", "#b9a27a"), mat("window", "#3f4650", 0.3, 0.3)
    green, luz = mat("roof", "#5e7a63", 0.3, 0.5), mat("luz", "#ffe2a6", emission="#ffe2a6")
    L, W, H = 105.0, 68.0, 26.0
    box(0, 0, 0, L + 4, W + 4, 1.5, sand2)                                  # escalinata y basamento
    for x, y, l, w in ((0, W / 2 - 7, L, 14), (0, -W / 2 + 7, L, 14), (-L / 2 + 7, 0, 14, W - 28), (L / 2 - 7, 0, 14, W - 28)):
        box(x, y, 1.5, l, w, H, sand)                                       # alas en torno al patio
        box(x, y, H + 1.5, l + 0.8, w + 0.8, 1.2, sand2)
    for z in range(5, int(H) - 2, 5):                                       # ventanas de las fachadas
        for s in (-1, 1):
            for x in range(-48, 49, 4):
                if abs(x) > 15 or s < 0:
                    box(x, s * (W / 2 + 0.05), z, 1.6, 0.2, 2.6, dark)
            for y in range(-30, 31, 4):
                box(s * (L / 2 + 0.05), y, z, 0.2, 1.6, 2.6, dark)
    # Cuerpo central con pórtico, torre escalonada y aguja.
    box(0, W / 2 - 9, 1.5, 32, 18, H + 8, sand)
    for x in range(-12, 13, 4):
        cyl(x, W / 2 + 1.2, 1.5, 0.8, 18, sand2, 12)
    box(0, W / 2 + 1.2, 19.5, 30, 3.4, 2.4, sand2)
    for k, (s, h) in enumerate(((20, 6), (15, 5), (10, 4))):
        z0 = H + 9.5 + sum(hh for _, hh in ((20, 6), (15, 5), (10, 4))[:k])
        box(0, W / 2 - 9, z0, s, s * 0.8, h, sand if k % 2 == 0 else sand2)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=3.2, radius2=0.2, depth=3.5, location=(0, W / 2 - 9, H + 24.5 + 1.75))
    _link(bpy.context.active_object, green)
    for sx in (-1, 1):                                                      # torres de esquina
        for sy in (-1, 1):
            x, y = sx * (L / 2 - 6), sy * (W / 2 - 6)
            box(x, y, 1.5, 13, 13, H + 6, sand)
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=8.5, radius2=0.5, depth=5, location=(x, y, H + 7.5 + 2.5), rotation=(0, 0, math.pi / 4))
            _link(bpy.context.active_object, green)
    for x in (-40, -20, 20, 40):
        cyl(x, W / 2 + 4, 0, 0.18, 5, dark, 6)
        box(x, W / 2 + 4, 5, 0.8, 0.8, 0.5, luz)


def museo_alfombra():
    """Museo de la alfombra de Bakú (124 × 50 m, 20 m): el edificio con forma de alfombra enrollada, un rollo de
    planta curva con bandas de dibujo de alfombra (rojo, crema y azul), la punta desenrollada y los testeros de cristal."""
    body, red, cream, blue = mat("carpet", "#9a3a2c", 0.0, 0.7), mat("carpet_red", "#c2412f"), mat("carpet_cream", "#e8d6b0"), mat("carpet_blue", "#2b4f7a")
    glass, plaza, luz = mat("glass", "#33505f", 0.35, 0.15), mat("plaza", "#bdb6a8"), mat("luz", "#ffe0a0", emission="#ffe0a0")
    R = 10.0
    def prof(r, yc):
        return [(yc + r * math.cos(2 * math.pi * k / 20), R + r * math.sin(2 * math.pi * k / 20) * 0.98) for k in range(20)]
    def bend(x):
        return 7.0 * math.sin(x / 62 * math.pi / 2) - 5.0 * (x / 62) ** 2
    xs = [-56 + 112 * k / 16 for k in range(17)]
    loft([(x, prof(R, bend(x))) for x in xs], body, "rollo")
    for k, x0 in enumerate(range(-52, 53, 8)):                              # bandas del dibujo
        m = (red, cream, blue)[k % 3]
        loft([(x0 - 1.2, prof(R + 0.12, bend(x0))), (x0 + 1.2, prof(R + 0.12, bend(x0)))], m, "banda")
    # Punta desenrollada: la alfombra baja en rampa hacia la plaza por el lado del mar (+Y).
    for k in range(10):
        x = -40 + k * 9
        box(x, bend(x) + R + 6, 0, 8.6, 12, 0.6 + 0.3 * (k % 2), (red, cream)[k % 2])
    for s in (-1, 1):                                                       # testeros de cristal
        x = s * 56.5
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=R - 0.3, depth=1.2, location=(x, bend(s * 56), R), rotation=(0, math.pi / 2, 0))
        _link(bpy.context.active_object, glass)
    box(0, 0, 0, 124, 50, 0.3, plaza)
    for x in range(-50, 51, 20):
        box(x, -22, 0.3, 0.6, 0.6, 0.4, luz)


def torre_radar():
    """Torre del radar de costa de Zandvoort (14 × 14 m, 50 m): celosía de acero en pirámide truncada, plataformas,
    escalera, la caseta del equipo y la antena de radar en lo alto con su luz de balizamiento."""
    steel, white, red, dark = mat("steel", "#c9cdd2", 0.6, 0.35), mat("white", "#f2f3f4"), mat("red", "#d23a32", 0.2, 0.4), mat("dark", "#3a3f45")
    luz, concrete = mat("luz", "#ff4a3a", emission="#ff4a3a"), mat("concrete", "#bfc2c5")
    box(0, 0, 0, 14, 14, 0.8, concrete)
    top, H = 2.6, 42.0
    def half(z):
        return 6.2 - (6.2 - top) * z / H
    for sx in (-1, 1):                                                      # patas
        for sy in (-1, 1):
            tube([(sx * 6.2, sy * 6.2, 0.8), (sx * top, sy * top, H)], 0.28, steel, "pata", 6)
    levels = [0.8 + k * 5.15 for k in range(9)]
    for z0, z1 in zip(levels, levels[1:]):                                  # aros y cruces de San Andrés
        a, b = half(z0), half(z1)
        for s in (-1, 1):
            for p, q in (((-a, s * a, z0), (b, s * b, z1)), ((a, s * a, z0), (-b, s * b, z1)),
                         ((s * a, -a, z0), (s * b, b, z1)), ((s * a, a, z0), (s * b, -b, z1))):
                tube([p, q], 0.09, steel, "cruz", 4)
        tube([(-b, -b, z1), (b, -b, z1), (b, b, z1), (-b, b, z1), (-b, -b, z1)], 0.11, steel, "aro", 4)
    for z in (15.0, 30.0):                                                  # plataformas
        h = half(z)
        box(0, 0, z, 2 * h + 1.2, 2 * h + 1.2, 0.2, dark)
    box(0, 0, H, 7.0, 7.0, 0.3, dark)
    box(0, 0, H + 0.3, 4.6, 4.6, 3.4, white)                                # caseta
    box(0, 0, H + 1.6, 4.7, 4.7, 0.9, red)
    box(0, 0, H + 3.7, 5.0, 5.0, 0.25, dark)
    for k in range(4):                                                      # barandilla de arriba
        a = k * math.pi / 2
        box(3.4 * math.cos(a), 3.4 * math.sin(a), H + 0.3, 0.1 if k % 2 == 0 else 7.0, 7.0 if k % 2 == 0 else 0.1, 1.1, steel)
    cyl(0, 0, H + 3.95, 0.35, 1.6, steel, 8)
    box(0, 0, H + 5.5, 9.0, 0.6, 1.2, white)                                # antena
    box(0, 0.45, H + 5.7, 9.0, 0.3, 0.8, dark)
    cyl(0, 0, H + 6.7, 0.12, 1.2, steel, 6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.35, location=(0, 0, H + 8.0))
    _link(bpy.context.active_object, luz)
    tube([(0.8, 6.2 - 0.3, 0.8), (0.8, top + 0.6, H)], 0.08, dark, "escalera", 4)
    tube([(-0.8, 6.2 - 0.3, 0.8), (-0.8, top + 0.6, H)], 0.08, dark, "escalera", 4)


# ── Tanda 3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
# Las gradas son módulos de 16 m de largo y 30 m de fondo que el juego repite y estira tramo a tramo sobre la planta de
# OpenStreetMap (scenery.ts, realStand): nada sobresale de x = ±8 para que los tramos empalmen; frente (la pista) en +Y.

GL, GW = 16.0, 30.0


def _tiers(n, z_top, seats, conc, y_front=12.5, y_back=-12.5):
    """Gradas escalonadas de delante (+Y, abajo) a atrás (arriba), con la fila de asientos de cada escalón; el pretil
    delantero, la losa y el muro de atrás."""
    d = (y_front - y_back) / n
    rise = (z_top - 1.2) / n
    box(0, 0, 0, GL, GW, 0.3, conc)
    box(0, y_front + 1.2, 0, GL, 0.4, 1.5, conc)                            # pretil
    for k in range(n):
        y, z = y_front - (k + 0.5) * d, 1.2 + k * rise
        box(0, y, 0, GL, d + 0.02, z, conc)                                 # escalón
        box(0, y + d * 0.12, z, GL - 0.3, d * 0.42, 0.45, seats[k % len(seats)])  # fila de asientos
    box(0, y_back - 0.5, 0, GL, 1.0, z_top + 1.4, conc)                     # muro de atrás
    for k in range(n):                                                      # pasillo de escalera en medio del tramo
        y, z = y_front - (k + 0.5) * d, 1.2 + k * rise
        box(0, y, z, 1.2, d * 0.9, 0.5, conc)
    return y_back - 1.0


def grada_cubierta_sh():
    """Módulo de las gradas de las curvas 1 y 2 de Shanghái (B1, B2, B3): 14 filas de asientos rojos y azules y la
    cubierta blanca en voladizo que se curva hacia arriba sobre la pista, con su cercha y su pilar, como en el modelo de
    referencia del circuito."""
    conc, red, blue = mat("concrete", "#c4c7cc"), mat("seat_red", "#b5262e"), mat("seat_blue", "#22509e")
    white, steel, luz = mat("roof", "#eef0f2", 0.2, 0.35), mat("steel", "#8a9099", 0.6, 0.35), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(14, 11.0, [red, red, blue, blue], conc)
    # Cubierta: ala delgada de atrás (17 m) hacia delante, levantando el borde sobre la pista.
    top = [(back + (13.8 - back) * t, 15.6 + 1.6 * math.sin(math.pi * t * 0.9) + 0.9 * t) for t in [k / 10 for k in range(11)]]
    prof = top + [(y, z - 0.45) for y, z in reversed(top)]
    loft([(-GL / 2, prof), (GL / 2, prof)], white, "cubierta")
    cyl(0, back + 0.4, 0, 0.55, top[0][1], steel, 10)                       # pilar
    tube([(0, y, z - 0.5) for y, z in top], 0.18, steel, "cercha", 6)       # cordón inferior de la cercha
    tube([(0, back + 0.4, 12.0), (0, top[5][0], top[5][1] - 0.5)], 0.16, steel, "tirante", 6)
    for k in (2, 4, 6, 8):
        y, z = top[k]
        tube([(0, y, z - 0.5), (0, y, z - 1.6 + 0.08 * k), (0, top[k + 1][0], top[k + 1][1] - 0.5)], 0.08, steel, "diagonal", 4)
    box(0, top[-1][0] - 0.3, top[-1][1] - 0.75, GL, 0.5, 0.3, white)        # canalón del borde
    box(0, top[6][0], top[6][1] - 0.62, GL - 1, 0.25, 0.12, luz)            # focos bajo la cubierta


def grada_sombrillas():
    """Módulo de las gradas de la horquilla de Shanghái (H, K): 9 filas y, en cada tramo, una sombrilla blanca en forma
    de flor de loto (embudo con pétalos) sobre su mástil, como las del modelo de referencia."""
    conc, a, b = mat("concrete", "#c4c7cc"), mat("seat_blue", "#22509e"), mat("seat_cyan", "#2c8fb8")
    white, steel = mat("canopy", "#f3f4f5", 0.0, 0.45), mat("steel", "#8a9099", 0.6, 0.35)
    _tiers(9, 7.0, [a, b, a], conc)
    cyl(0, -1.5, 0.3, 0.32, 12.2, steel, 10)                                # mástil
    cyl(0, -1.5, 12.0, 0.55, 2.0, white, 20, r2=7.4)                        # embudo
    for k in range(10):                                                     # pétalos
        ang = 2 * math.pi * k / 10
        blob(6.6 * math.cos(ang), -1.5 + 6.6 * math.sin(ang), 14.15, 1.25, 0.75, 0.16, white, 8, 4, rot=(0, -0.35, ang))
    for k in range(4):                                                      # tirantes del embudo
        ang = math.pi / 4 + k * math.pi / 2
        tube([(0, -1.5, 9.5), (4.8 * math.cos(ang), -1.5 + 4.8 * math.sin(ang), 13.2)], 0.07, steel, "tirante", 4)


def grada_vela():
    """Módulo de las gradas de Yas Marina: 12 filas de asientos y toldo blanco de vela tensada, alto atrás sobre su mástil
    y bajo en las esquinas de delante (un poste por tramo: el del tramo siguiente cierra la otra esquina); luces bajo la
    vela para la carrera de noche."""
    conc, a, b = mat("concrete", "#d4d2cc"), mat("seat_grey", "#5a6470"), mat("seat_sand", "#c9a86a")
    sail, steel, luz = mat("sail", "#f6f6f4", 0.0, 0.5), mat("steel", "#c9ced4", 0.6, 0.3), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(12, 9.0, [a, a, b], conc)
    top, fl, fr, bl, br = (0, back + 0.6, 17.5), (-GL / 2, 12.8, 11.2), (GL / 2, 12.8, 11.2), (-GL / 2, back + 0.6, 13.6), (GL / 2, back + 0.6, 13.6)
    V = [top, fl, fr, bl, br]
    up = [(x, y, z + 0.12) for x, y, z in V]
    mesh_obj("vela", V + up, [(0, 2, 1), (0, 1, 3), (0, 4, 2), (5, 6, 7), (5, 8, 6), (5, 7, 9)], sail)
    cyl(0, back + 0.6, 0.3, 0.38, 17.4, steel, 10)                          # mástil
    cyl(-GL / 2 + 0.1, 13.6, 0.3, 0.2, 11.0, steel, 8)                      # poste de la esquina de delante
    tube([top, (0, back - 3.0, 0.3)], 0.06, steel, "viento", 4)             # tirante de atrás
    for p in (fl, fr):
        tube([top, p], 0.05, steel, "borde", 4)
    box(0, 11.0, 10.4, GL - 1.5, 0.25, 0.12, luz)


def kartodromo():
    """Edificio de boxes del kartódromo de Interlagos (70 × 20 m, 11 m): planta baja de garajes con persianas, planta
    alta acristalada con balcón corrido sobre la calle de boxes, cubierta con alero, la torre de control en un extremo
    y una franja verde y amarilla."""
    white, conc, door, glass = mat("frame", "#f1f1ee"), mat("concrete", "#c4c7cc"), mat("door", "#8f979f", 0.4, 0.4), mat("glass", "#2f4a63", 0.3, 0.15)
    green, yellow, steel, luz = mat("green", "#1f8a4c"), mat("yellow", "#f2c230"), mat("steel", "#8a9099", 0.6, 0.35), mat("luz", "#fff1c8", emission="#fff1c8")
    L, W = 64.0, 16.0
    box(-3, 0, 0, L, W, 4.2, white)                                         # planta baja
    for k in range(12):                                                     # garajes
        box(-3 - L / 2 + 3 + k * 5.2, W / 2 + 0.05, 0.1, 4.2, 0.2, 3.3, door)
    box(-3, 0, 4.2, L, W, 0.4, conc)                                        # forjado
    box(-3, 2.0, 4.6, L, W - 4, 3.4, glass)                                 # planta alta acristalada
    box(-3, -W / 2 + 1, 4.6, L, 2.0, 3.4, white)
    for x in range(-34, 29, 4):
        box(x, W / 2 - 1.9, 4.6, 0.25, 0.25, 3.4, white)                    # montantes
    box(-3, W / 2 + 0.6, 4.2, L, 2.6, 0.3, conc)                            # balcón
    box(-3, W / 2 + 1.85, 4.5, L, 0.08, 1.0, steel)                         # barandilla
    box(-3, 0.8, 8.0, L + 1, W + 4.6, 0.5, white)                           # cubierta con alero
    box(-3, W / 2 + 3.05, 7.4, L + 1, 0.15, 0.6, green)                     # franja verde
    box(-3, W / 2 + 3.05, 7.1, L + 1, 0.15, 0.3, yellow)                    # franja amarilla
    for x in range(-30, 25, 9):
        cyl(x, W / 2 + 2.6, 4.5, 0.12, 3.5, steel, 6)                       # pilares del alero
        box(x, W / 2 + 2.2, 7.85, 1.0, 0.3, 0.12, luz)
    box(31, 0, 0, 6, 6, 8.6, white)                                         # torre de control
    box(31, 0, 8.6, 6.8, 6.8, 1.8, glass)
    box(31, 0, 10.4, 7.6, 7.6, 0.5, white)
    cyl(31, 0, 10.9, 0.06, 0.1, steel, 4)


def mezquita_rahma():
    """Mezquita flotante de Al-Rahmah en la cornisa de Yeda (62 × 36 m, 34 m): sobre pilotes en el mar, sala blanca con
    arcadas de arcos en todas sus fachadas, la cúpula central turquesa sobre su tambor, cúpulas pequeñas alrededor y el
    alminar blanco en una esquina. Luz cálida bajo los arcos (carrera de noche). Referencia: fotos de Wikimedia Commons
    (Category:Al-Rahmah_Mosque) y nodo de OpenStreetMap 539501874."""
    white, cream, conc = mat("white", "#f4f2ec"), mat("cream", "#e6dcc6"), mat("concrete", "#b9b4a8")
    dome, gold, dark, luz = mat("dome", "#3aa7a3", 0.25, 0.35), mat("gold", "#c9a24a", 0.8, 0.3), mat("arch", "#2a2f36"), mat("luz", "#ffd9a0", emission="#ffcf8a")
    for x in range(-28, 29, 7):                                             # pilotes
        for y in range(-15, 16, 6):
            cyl(x, y, 0, 0.55, 3.0, conc, 6)
    box(0, 0, 3.0, 62, 36, 0.9, conc)                                       # plataforma
    box(0, 0, 3.9, 61, 35, 0.2, cream)
    for s in (-1, 1):                                                       # barandilla del paseo
        box(0, s * 17.8, 4.1, 61, 0.15, 1.0, white)
        box(s * 30.8, 0, 4.1, 0.15, 35, 1.0, white)
    L, W, z0, H = 46.0, 24.0, 4.1, 9.0
    box(0, 0, z0, L, W, H, white)                                           # sala
    box(0, 0, z0 + H, L + 1, W + 1, 0.8, cream)                             # cornisa
    for s in (-1, 1):                                                       # arcadas de las fachadas largas
        for k in range(11):
            x = -20 + k * 4
            box(x, s * (W / 2 + 0.05), z0 + 0.4, 2.4, 0.3, 4.2, dark)
            _cyl_y(x, s * (W / 2 + 0.05), z0 + 4.6, 1.2, 0.3, dark, 8)
            box(x, s * (W / 2 + 0.25), z0 + 0.4, 2.0, 0.1, 0.3, luz)
            box(x, s * (W / 2 + 0.05), z0 + 6.6, 1.0, 0.3, 1.0, dark)      # ventanita alta
    for s in (-1, 1):                                                       # arcadas de los testeros
        for k in range(5):
            y = -8 + k * 4
            box(s * (L / 2 + 0.05), y, z0 + 0.4, 0.3, 2.4, 4.2, dark)
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=1.2, depth=0.3, location=(s * (L / 2 + 0.05), y, z0 + 4.6), rotation=(0, math.pi / 2, 0))
            _link(bpy.context.active_object, dark)
            box(s * (L / 2 + 0.25), y, z0 + 0.4, 0.1, 2.0, 0.3, luz)
    zr = z0 + H + 0.8
    cyl(0, 0, zr, 8.6, 3.0, white, 24)                                      # tambor
    for k in range(16):                                                     # ventanas del tambor
        a = 2 * math.pi * k / 16
        box(8.65 * math.cos(a), 8.65 * math.sin(a), zr + 0.8, 1.0, 0.2, 1.5, dark, rot=a + math.pi / 2)
    blob(0, 0, zr + 3.0, 8.4, 8.4, 7.6, dome, 20, 10)                       # cúpula central
    cyl(0, 0, zr + 10.4, 0.3, 1.6, gold, 8)
    blob(0, 0, zr + 12.3, 0.55, 0.55, 0.55, gold, 8, 6)
    for sx in (-1, 1):                                                      # cúpulas de las esquinas
        for sy in (-1, 1):
            x, y = sx * (L / 2 - 3.5), sy * (W / 2 - 3.5)
            cyl(x, y, zr, 2.6, 1.6, white, 12)
            blob(x, y, zr + 1.6, 2.5, 2.5, 2.3, white, 12, 6)
            cyl(x, y, zr + 3.8, 0.1, 0.9, gold, 6)
    for k in range(14):                                                     # cupulillas del pretil
        x = -19.5 + k * 3
        for s in (-1, 1):
            if abs(x) > 9:
                blob(x, s * (W / 2 - 0.2), zr, 0.9, 0.9, 0.9, white, 6, 3)
    mx, my = L / 2 + 4.5, W / 2 + 2.5                                       # alminar en la esquina, sobre el paseo
    cyl(mx, my, 4.1, 2.2, 1.6, cream, 8)
    cyl(mx, my, 5.7, 1.5, 19.0, white, 8)
    cyl(mx, my, 24.7, 2.4, 0.7, cream, 8)                                   # balcón
    for k in range(8):
        a = 2 * math.pi * k / 8
        box(mx + 2.3 * math.cos(a), my + 2.3 * math.sin(a), 25.4, 0.2, 1.8, 0.9, white, rot=a)
    cyl(mx, my, 25.4, 1.1, 4.4, white, 8)
    box(mx, my, 27.0, 2.3, 0.2, 1.4, dark)
    blob(mx, my, 29.8, 1.15, 1.15, 1.9, white, 10, 6)
    cyl(mx, my, 31.4, 0.12, 2.6, gold, 6)
    blob(mx, my, 33.4, 0.3, 0.3, 0.3, gold, 6, 4)
    box(mx, my + 1.55, 20.0, 0.6, 0.12, 1.6, luz)


# ── Tanda 4 (08/11/2026): Silverstone, Spa, Monza y Barcelona ─────────────────────────────────────────────────────────
# Gradas: mismos módulos de 16 × 30 m que en la tanda 3 (scenery.ts, realStand), cada circuito con las suyas.

def _rail(y, z, m, l=GL):
    """Barandilla delantera: pasamanos y montantes."""
    box(0, y, z + 1.0, l, 0.08, 0.08, m)
    for k in range(5):
        box(-l / 2 + 1.6 + k * 3.2, y, z, 0.08, 0.08, 1.0, m)


def grada_silverstone():
    """Módulo de las gradas de Silverstone (Becketts, Luffield, Woodcote, Abbey, Copse...): 12 filas de asientos azules
    y blancos, y la cubierta plana blanca en voladizo, inclinada hacia la pista, colgada de un mástil trasero con sus
    tirantes; revestimiento de chapa nervada detrás y luces bajo la cubierta."""
    conc, blue, white_s = mat("concrete", "#c4c7cc"), mat("seat_blue", "#1f3f8f"), mat("seat_white", "#e9ecef")
    roof, steel, clad, luz = mat("roof", "#f2f3f4", 0.2, 0.35), mat("steel", "#9aa1aa", 0.6, 0.35), mat("clad", "#7f8a96", 0.3, 0.5), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(12, 9.4, [blue, blue, white_s, blue], conc)
    _rail(13.9, 1.5, steel)
    for k in range(8):                                                      # chapa nervada del muro de atrás
        box(-GL / 2 + 1 + k * 2, back - 0.15, 0.3, 0.25, 0.3, 10.4, clad)
    # Cubierta: losa delgada que sube de atrás (13,4 m) hacia delante (15,0 m) y se adelgaza en el borde.
    loft([(-GL / 2, [(back, 13.4), (13.6, 15.0), (13.6, 14.75), (back, 12.9)]), (GL / 2, [(back, 13.4), (13.6, 15.0), (13.6, 14.75), (back, 12.9)])], roof, "cubierta")
    for s in (-1, 1):                                                       # mástil y tirantes a cada lado del tramo
        x = s * (GL / 2 - 0.4)
        cyl(x, back - 0.6, 0, 0.32, 18.0, steel, 8)
        tube([(x, back - 0.6, 17.6), (x, 5.0, 14.25)], 0.06, steel, "tirante", 4)
        tube([(x, back - 0.6, 17.6), (x, 12.8, 14.85)], 0.06, steel, "tirante", 4)
        tube([(x, back - 0.6, 17.0), (x, back - 4.5, 0.3)], 0.06, steel, "viento", 4)
    for y in (2.0, 8.0):                                                    # correas bajo la cubierta
        z = 13.4 + (y - back) / (13.6 - back) * 1.6 - 0.45
        box(0, y, z, GL, 0.3, 0.3, steel)
    box(0, 12.6, 14.2, GL - 1.2, 0.3, 0.12, luz)


def grada_spa():
    """Módulo de las gradas de Spa (Raidillon, la de la RX, las de Endurance...): 10 filas de asientos grises y rojos en
    la ladera, y tejadillo de chapa verde oscuro a dos aguas sobre pilares finos con sus cruces de San Andrés; la madera
    del muro de atrás, como en las gradas de las Ardenas."""
    conc, grey, red = mat("concrete", "#b7b9b4"), mat("seat_grey", "#4b5057"), mat("seat_red", "#a8232b")
    roof, steel, wood = mat("roof_green", "#2f4a3a", 0.3, 0.55), mat("steel", "#6f767f", 0.6, 0.4), mat("wood", "#7a5a3c", 0.0, 0.8)
    back = _tiers(10, 7.6, [grey, grey, red], conc)
    _rail(13.9, 1.5, steel)
    for k in range(6):                                                      # tablas del muro de atrás
        box(0, back - 0.2, 1.0 + k * 1.5, GL, 0.25, 1.2, wood)
    ridge_y, ridge_z = 3.0, 13.2
    loft([(-GL / 2, [(back - 1.0, 11.0), (ridge_y, ridge_z), (13.8, 11.4), (13.8, 11.2), (ridge_y, ridge_z - 0.25), (back - 1.0, 10.8)]),
          (GL / 2, [(back - 1.0, 11.0), (ridge_y, ridge_z), (13.8, 11.4), (13.8, 11.2), (ridge_y, ridge_z - 0.25), (back - 1.0, 10.8)])], roof, "tejado")
    for x in (-GL / 2 + 0.3, GL / 2 - 0.3):
        for y, top in ((13.2, 11.2), (back - 0.8, 10.8)):
            cyl(x, y, 0, 0.2, top, steel, 6)
        tube([(x, ridge_y, ridge_z - 0.3), (x, 13.2, 11.1)], 0.07, steel, "par", 4)
        tube([(x, ridge_y, ridge_z - 0.3), (x, back - 0.8, 10.7)], 0.07, steel, "par", 4)
    for s in (-1, 1):                                                       # cruz de San Andrés en la fila de pilares de atrás
        tube([(-GL / 2 + 0.3, back - 0.8, 1.0 if s > 0 else 9.5), (GL / 2 - 0.3, back - 0.8, 9.5 if s > 0 else 1.0)], 0.05, steel, "cruz", 4)
    box(0, 13.2, 10.9, GL, 0.25, 0.3, steel)                                # viga delantera


def grada_monza():
    """Módulo de las gradas de Monza (la central, las laterales, la Prima Variante, la Parabolica...): 11 filas de
    asientos rojos y grises sobre gradas de hormigón y la cubierta de losa fina de hormigón en voladizo, apoyada en
    pilares trasteros que se ensanchan arriba (como las tribunas antiguas del autódromo), con sus nervios."""
    conc, red, grey = mat("concrete", "#c9c4b8"), mat("seat_red", "#b3202a"), mat("seat_grey", "#8d939a")
    slab, rib, steel, green = mat("slab", "#d8d3c6", 0.0, 0.8), mat("rib", "#b2ab9c"), mat("steel", "#8a9099", 0.6, 0.35), mat("green", "#2c6a3f")
    back = _tiers(11, 8.4, [red, red, grey], conc)
    _rail(13.9, 1.5, steel)
    for k in range(4):                                                      # ventanas del muro de atrás
        box(-6 + k * 4, back - 1.05, 2.5, 2.0, 0.1, 3.0, steel)
    loft([(-GL / 2, [(back - 0.6, 14.0), (13.0, 13.4), (13.0, 13.1), (back - 0.6, 13.3)]), (GL / 2, [(back - 0.6, 14.0), (13.0, 13.4), (13.0, 13.1), (back - 0.6, 13.3)])], slab, "losa")
    for x in (-GL / 2 + 0.6, GL / 2 - 0.6):                                 # pilar con capitel y nervio de la losa
        box(x, back - 0.6, 0, 1.0, 1.4, 11.5, conc)
        prism([(x - 0.5, back - 1.3), (x + 0.5, back - 1.3), (x + 0.5, back + 4.5), (x - 0.5, back + 0.1)], 11.5, 13.3, conc)
        tube([(x, back + 4.0, 13.1), (x, 12.6, 13.0)], 0.25, rib, "nervio", 4)
    box(0, back - 0.4, 13.1, GL, 0.5, 0.9, green)                           # franja verde de la cornisa


def grada_principal_bcn():
    """Módulo del graderío principal de Barcelona, enfrente de los boxes: grada baja de 9 filas, fila de palcos
    acristalados, grada alta de 8 filas y la gran cubierta blanca en voladizo colgada de un pórtico de celosía por encima;
    asientos de colores (rojo, amarillo y azul) y luces bajo la cubierta."""
    conc, red, yellow, blue = mat("concrete", "#d0cfca"), mat("seat_red", "#b8262d"), mat("seat_yellow", "#e2b322"), mat("seat_blue", "#245aa8")
    roof, steel, glass, luz = mat("roof", "#f3f4f5", 0.2, 0.35), mat("steel", "#b9bfc6", 0.6, 0.3), mat("glass", "#2f455c", 0.3, 0.15), mat("luz", "#fff1c8", emission="#fff1c8")
    # Grada baja.
    box(0, 0, 0, GL, GW, 0.3, conc)
    box(0, 13.7, 0, GL, 0.4, 1.5, conc)
    for k in range(9):
        y, z = 12.5 - (k + 0.5) * 1.2, 1.2 + k * 0.55
        box(0, y, 0, GL, 1.22, z, conc)
        box(0, y + 0.15, z, GL - 0.3, 0.5, 0.45, [red, yellow, blue][k % 3])
    # Palcos.
    box(0, 0.3, 0, GL, 1.6, 9.5, conc)
    box(0, 1.2, 6.4, GL - 0.4, 0.2, 2.6, glass)
    for x in (-5.3, 0, 5.3):
        box(x, 1.3, 6.4, 0.2, 0.3, 2.6, steel)
    box(0, 2.0, 9.0, GL, 1.8, 0.4, conc)                                    # voladizo de los palcos
    _rail(2.85, 9.4, steel)
    # Grada alta.
    for k in range(8):
        y, z = -0.6 - (k + 0.5) * 1.35, 9.6 + k * 0.75
        box(0, y, 9.4, GL, 1.37, z - 9.4, conc)
        box(0, y + 0.15, z, GL - 0.3, 0.55, 0.45, [blue, red, yellow][k % 3])
    box(0, -12.2, 0, GL, 1.0, 17.0, conc)                                   # muro de atrás
    for k in range(4):
        box(-6 + k * 4, -12.75, 3.0, 2.4, 0.1, 9.0, glass)
    # Cubierta y pórtico de celosía.
    loft([(-GL / 2, [(-12.6, 19.0), (13.8, 21.0), (13.8, 20.7), (-12.6, 18.6)]), (GL / 2, [(-12.6, 19.0), (13.8, 21.0), (13.8, 20.7), (-12.6, 18.6)])], roof, "cubierta")
    for x in (-GL / 2 + 0.4, GL / 2 - 0.4):
        cyl(x, -12.4, 0, 0.45, 25.0, steel, 8)                              # pilar del pórtico
        top = [(x, -12.4, 24.6), (x, -2.0, 23.3), (x, 6.0, 22.4), (x, 13.4, 21.3)]
        tube(top, 0.14, steel, "cordon", 6)
        for (a, b) in ((-12.4, -2.0), (-2.0, 6.0), (6.0, 13.4)):
            za = 19.0 + (a + 12.6) / 26.4 * 2.0
            tube([(x, a, za + 0.2), (x, b, 24.6 - (b + 12.4) / 25.8 * 3.3)], 0.08, steel, "diagonal", 4)
    box(0, 13.0, 20.3, GL - 1.0, 0.3, 0.12, luz)
    box(0, 0.0, 19.4, GL - 1.0, 0.3, 0.12, luz)


def grada_bcn():
    """Módulo de las gradas con letra de Barcelona: 11 filas descubiertas con asientos de colores en franjas (rojo,
    amarillo, azul y blanco), escalera en medio, muro de atrás con su pasarela, una torre de megafonía y focos."""
    conc, red, yellow, blue, white = mat("concrete", "#d0cfca"), mat("seat_red", "#b8262d"), mat("seat_yellow", "#e2b322"), mat("seat_blue", "#245aa8"), mat("seat_white", "#e9ecef")
    steel, luz = mat("steel", "#9aa1aa", 0.6, 0.35), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(11, 8.2, [red, yellow, blue, white], conc)
    _rail(13.9, 1.5, steel)
    box(0, back - 0.4, 9.6, GL, 1.6, 0.3, conc)                             # pasarela de arriba
    _rail(back - 1.1, 9.9, steel)
    cyl(GL / 2 - 0.6, back - 0.6, 0, 0.18, 14.0, steel, 6)                  # torre de megafonía y focos
    box(GL / 2 - 0.6, back - 0.3, 12.8, 1.4, 0.5, 0.9, steel)
    box(GL / 2 - 0.6, back + 0.0, 13.0, 1.1, 0.1, 0.5, luz)


def peralte_tramo():
    """Tramo de 20 m del peralte del óvalo antiguo de Monza (24 m de ancho, 9 m de alto): losa de hormigón curvada que
    sube muy empinada hacia fuera, sobre pilares y vigas en la parte alta y sobre terraplén en la baja; el pretil y la
    valla de arriba, juntas de dilatación, manchas de musgo y hierba en el borde bajo. Lo bajo mira al frente (+Y)."""
    conc, dark, moss, grass = mat("concrete_old", "#b3ada0", 0.0, 0.9), mat("concrete_dark", "#8a857a", 0.0, 0.9), mat("moss", "#5d6b3e", 0.0, 0.95), mat("grass", "#55703a", 0.0, 0.95)
    steel = mat("steel_rust", "#6e5a48", 0.5, 0.6)
    L, W = 20.0, 24.0
    z = lambda y: 0.6 + 8.0 * ((W / 2 - y) / W) ** 1.9                       # perfil: llano delante, casi vertical atrás
    ys = [W / 2 - W * k / 14 for k in range(15)]
    top = [(y, z(y)) for y in ys]
    prof = top + [(y, max(0.05, zz - 0.6)) for y, zz in reversed(top)]
    loft([(-L / 2, prof), (L / 2, prof)], conc, "losa")
    for x in (-L / 2 + 0.15, 0.0):                                          # juntas de dilatación
        loft([(x - 0.08, [(y, zz + 0.02) for y, zz in top] + [(y, zz - 0.02) for y, zz in reversed(top)]),
              (x + 0.08, [(y, zz + 0.02) for y, zz in top] + [(y, zz - 0.02) for y, zz in reversed(top)])], dark, "junta")
    for x in (-6.0, 6.0):                                                   # pilares bajo la parte alta
        for y in (-3.0, -7.5, -11.0):
            cyl(x, y, 0, 0.45, z(y) - 0.6, dark, 8)
    for y in (-3.0, -7.5, -11.0):                                           # vigas bajo la losa
        box(0, y, z(y) - 1.2, L, 0.6, 0.6, dark)
    prism([(-L / 2, W / 2), (L / 2, W / 2), (L / 2, 1.0), (-L / 2, 1.0)], 0, 0.6, grass)  # terraplén bajo lo llano
    box(0, -W / 2 - 0.2, z(-W / 2) - 0.4, L, 0.5, 1.6, conc)               # pretil
    for k in range(6):                                                      # valla de arriba
        box(-L / 2 + 1.6 + k * 3.4, -W / 2 - 0.2, z(-W / 2) + 1.2, 0.1, 0.1, 1.8, steel)
    box(0, -W / 2 - 0.2, z(-W / 2) + 2.8, L, 0.06, 0.06, steel)
    box(0, -W / 2 - 0.2, z(-W / 2) + 2.2, L, 0.06, 0.06, steel)
    for (x, y, s) in ((-5.5, 7.0, 2.4), (4.0, 2.0, 1.6), (7.5, 9.5, 2.0), (-2.0, 10.6, 1.4)):  # musgo en la losa
        box(x, y, z(y) + 0.01, s * 1.6, s, 0.03, moss, rot=0.4 * x)
    box(0, W / 2 - 0.4, 0.6, L, 0.8, 0.12, grass)                           # hierba en el borde bajo


def ala_silverstone():
    """The Wing, el edificio de boxes de Silverstone (375 × 33 m, 22 m): tres plantas acristaladas con forjados blancos y
    lamas verticales en la fachada de la pista, el puente del centro de prensa más alto en medio y, encima, la cubierta
    en forma de ala (perfil aerodinámico, borde de ataque redondeado hacia la pista) que ondula a lo largo del edificio;
    luces bajo el borde. Referencia: huella de OpenStreetMap way/227332429."""
    white, glass, dark = mat("white", "#eef1f4", 0.1, 0.4), mat("glass", "#2b4258", 0.3, 0.12), mat("dark_glass", "#1c2733", 0.3, 0.15)
    steel, luz = mat("steel", "#aeb5bd", 0.6, 0.3), mat("luz", "#fff1c8", emission="#fff1c8")
    L, D = 375.0, 28.0
    box(0, -1.5, 0, L, D, 5.0, dark)                                        # planta baja (garajes y accesos)
    for k, z in enumerate((5.0, 9.6)):                                      # dos plantas acristaladas con su forjado
        box(0, -1.5, z, L, D + 0.6, 0.6, white)
        box(0, -1.5, z + 0.6, L - 1, D - 1.0, 4.0, glass)
    box(0, -1.5, 14.2, L, D + 1.0, 0.6, white)
    for k in range(int(L // 6)):                                            # lamas verticales de la fachada
        box(-L / 2 + 3 + k * 6, D / 2 - 1.2, 5.0, 0.35, 1.2, 9.8, white)
    box(0, D / 2 - 0.2, 14.8, L, 1.2, 0.12, steel)                          # barandilla de la terraza
    box(0, -1.5, 14.8, 50, D - 2, 6.0, glass)                               # puente del centro de prensa
    box(0, -1.5, 20.8, 52, D - 1, 0.5, white)
    # Cubierta en ala: perfil de 33 m de cuerda (de +16,5 a −16,5), grosor máximo 2,4 m a un tercio desde la pista.
    def wing_profile(zb):
        chord, up, lo = [], [], []
        for k in range(13):
            t = k / 12
            th = 2.4 * (2.97 * math.sqrt(max(t, 1e-6)) - 1.26 * t - 3.52 * t * t + 2.84 * t ** 3 - 1.02 * t ** 4) / 1.0
            y = 16.5 - 33.0 * t
            up.append((y, zb + 0.55 * th + 0.8 * t))
            lo.append((y, zb - 0.45 * th + 0.8 * t))
        return up + list(reversed(lo))
    stations = []
    for k in range(25):
        x = -L / 2 + L * k / 24
        zb = 16.4 + 3.4 * math.exp(-(x / 70) ** 2) + 0.9 * math.cos(2 * math.pi * x / 125)
        stations.append((x, wing_profile(zb)))
    loft(stations, white, "ala")
    for k in range(13):                                                     # soportes de la cubierta
        x = -L / 2 + 15 + k * (L - 30) / 12
        zb = 16.4 + 3.4 * math.exp(-(x / 70) ** 2) + 0.9 * math.cos(2 * math.pi * x / 125)
        for y in (6.0, -8.0):
            cyl(x, y, 14.8, 0.35, zb - 15.6, steel, 8)
    for k in range(24):                                                     # luces bajo el borde de ataque
        x = -L / 2 + L * (k + 0.5) / 24
        zb = 16.4 + 3.4 * math.exp(-(x / 70) ** 2) + 0.9 * math.cos(2 * math.pi * x / 125)
        box(x, 14.5, zb - 0.9, L / 24 - 2, 0.4, 0.12, luz)


# ── Tanda 5 (09/11/2026): Spielberg, Baréin, Lusail, Hungaroring, México y Austin ─────────────────────────────────────
# Gradas: mismos módulos de 16 × 30 m (scenery.ts, realStand). Las torres de Sakhir y de Austin se rehacen aquí (las de
# scenery-models.py eran un cilindro con anillos y un cono de alambre).

def grada_spielberg():
    """Módulo de las tribunas de Spielberg (la de salida, la de Estiria, las de las curvas 1 y 3...): 11 filas de
    asientos gris plata y azul en la ladera, muro de atrás de lamas de alerce, y cubierta de chapa gris a un agua sobre
    pórticos de acero en A, con el borde levantado hacia la pista y luces debajo."""
    conc, silver, blue = mat("concrete", "#bfc1bd"), mat("seat_silver", "#a9b0b8"), mat("seat_blue", "#203a78")
    roof, steel, larch, luz = mat("roof_grey", "#a3aab1", 0.4, 0.45), mat("steel", "#3b4148", 0.6, 0.4), mat("larch", "#9a6b3f", 0.0, 0.75), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(11, 8.6, [silver, silver, blue], conc)
    _rail(13.9, 1.5, steel)
    for k in range(20):                                                     # lamas verticales de alerce
        box(-GL / 2 + 0.4 + k * 0.8, back - 0.2, 0.3, 0.35, 0.3, 10.2, larch)
    prof = [(back - 1.0, 12.4), (13.9, 14.6), (13.9, 14.35), (back - 1.0, 12.15)]
    loft([(-GL / 2, prof), (GL / 2, prof)], roof, "cubierta")
    for x in (-GL / 2 + 0.3, GL / 2 - 0.3):                                 # pórtico en A
        tube([(x, back - 3.2, 0.3), (x, back - 0.8, 12.3), (x, back + 1.6, 0.3)], 0.2, steel, "pata", 6)
        tube([(x, back - 0.8, 12.3), (x, 13.6, 14.2)], 0.22, steel, "jabalcon", 6)
        tube([(x, back - 0.8, 12.3), (x, 7.0, 13.4), (x, 6.0, 10.6)], 0.08, steel, "tirante", 4)
    box(0, 13.6, 14.05, GL, 0.35, 0.35, steel)                              # viga del borde
    box(0, 12.9, 13.75, GL - 1.2, 0.3, 0.12, luz)


def grada_bahrain():
    """Módulo de las gradas de Sakhir (la principal, la de la primera curva, las de la Universidad y de la Victoria...):
    12 filas de asientos rojos y blancos sobre hormigón color arena, y en cada tramo un toldo blanco de carpa con su pico
    (como las carpas de la grada principal del circuito), sobre cuatro postes con sus vientos; luces de noche."""
    conc, red, white_s = mat("sand_concrete", "#d8c9a8"), mat("seat_red", "#b3202a"), mat("seat_white", "#eceae4")
    tent, steel, luz = mat("tent", "#f7f6f2", 0.0, 0.5), mat("steel", "#cfd3d8", 0.6, 0.3), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(12, 9.0, [red, red, white_s], conc)
    _rail(13.9, 1.5, steel)
    for k in range(4):                                                      # celosía del muro de atrás (mashrabiya)
        for j in range(3):
            box(-6 + k * 4, back - 1.05, 2.0 + j * 2.6, 2.6, 0.12, 1.8, conc, rot=0.0)
    cy, top = (back + 13.6) / 2, 19.5
    corners = [(-GL / 2, back - 0.4, 13.4), (GL / 2, back - 0.4, 13.4), (GL / 2, 13.6, 12.2), (-GL / 2, 13.6, 12.2)]
    # Carpa: cuatro faldones curvos del borde al pico (cada uno, un abanico de tiras).
    for a, b in zip(corners, corners[1:] + corners[:1]):
        V, F = [], []
        n = 6
        for i in range(n + 1):
            t = i / n
            ex, ey, ez = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t
            for j in range(5):
                s = j / 4
                sag = 1.2 * math.sin(math.pi * s) * (1 - s)
                V.append((ex + (0 - ex) * s, ey + (cy - ey) * s, ez + (top - ez) * s ** 0.7 - sag))
        for i in range(n):
            for j in range(4):
                p = i * 5 + j
                F.append((p, p + 5, p + 6, p + 1))
        mesh_obj("carpa", V, F, tent)
    cyl(0, cy, 9.0, 0.3, top - 9.0 + 0.8, steel, 8)                         # mástil del pico (sobre las gradas)
    for x, y, z in corners:                                                 # postes de las esquinas y vientos
        cyl(x * 0.97, y, 0.3 if y > 0 else 10.0, 0.18, z - (0.3 if y > 0 else 10.0), steel, 6)
    tube([(0, cy, top), (0, back - 4.0, 0.3)], 0.05, steel, "viento", 4)
    box(0, 12.6, 11.6, GL - 1.5, 0.25, 0.12, luz)


def grada_lusail():
    """Módulo de la tribuna principal de Lusail (418 m enfrente de los boxes): 13 filas de asientos granate y blancos y
    la cubierta blanca ondulada en voladizo, una onda por tramo para que la cubierta entera ondule como una hoja de
    palmera, sobre costillas curvas de acero; palcos acristalados detrás y la línea de luces de la carrera de noche."""
    conc, maroon, white_s = mat("concrete", "#d6d2c8"), mat("seat_maroon", "#7a1530"), mat("seat_white", "#ecebe6")
    roof, steel, glass, luz = mat("roof", "#f4f4f2", 0.2, 0.35), mat("steel", "#c3c8ce", 0.6, 0.3), mat("glass", "#2a4256", 0.3, 0.12), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(13, 9.4, [maroon, maroon, white_s], conc)
    _rail(13.9, 1.5, steel)
    box(0, back - 1.6, 0.3, GL, 2.4, 3.2, glass)                            # palcos detrás
    box(0, back - 1.6, 3.5, GL, 2.8, 0.4, conc)
    stations = []
    for k in range(9):                                                      # onda: alta en el centro del tramo, baja en los bordes
        x = -GL / 2 + GL * k / 8
        lift = 1.6 * (0.5 + 0.5 * math.cos(2 * math.pi * x / GL))
        prof = [(back - 2.5, 12.6 + lift * 0.4), (4.0, 14.6 + lift), (14.2, 14.2 + lift * 1.3), (14.2, 13.95 + lift * 1.3), (4.0, 14.3 + lift), (back - 2.5, 12.3 + lift * 0.4)]
        stations.append((x, prof))
    loft(stations, roof, "cubierta")
    for x in (-GL / 2 + 0.2,):                                              # costilla curva en el borde del tramo
        tube([(x, back - 2.5, 0.3), (x, back - 2.4, 12.2), (x, 4.0, 14.1), (x, 13.8, 13.7)], 0.28, steel, "costilla", 8)
        tube([(x, back - 2.4, 9.0), (x, 4.0, 13.9)], 0.1, steel, "tirante", 4)
    box(0, 13.2, 13.65, GL - 1.0, 0.3, 0.12, luz)


def grada_hungaroring():
    """Módulo de la tribuna principal del Hungaroring (enfrente de los boxes): 12 filas con los asientos en franjas
    rojas, blancas y verdes, la cubierta blanca plana algo inclinada sobre pilares en V, un pasillo con barandilla a media
    altura y el muro de atrás de bloque gris con ventanas de los accesos; luces bajo la cubierta."""
    conc, red, white_s, green = mat("concrete", "#c6c7c3"), mat("seat_red", "#b8262d"), mat("seat_white", "#eceae4"), mat("seat_green", "#2b7a3f")
    roof, steel, glass, luz = mat("roof", "#f2f3f4", 0.2, 0.35), mat("steel", "#9aa1aa", 0.6, 0.35), mat("glass", "#2f455c", 0.3, 0.15), mat("luz", "#fff1c8", emission="#fff1c8")
    back = _tiers(12, 9.2, [red, red, white_s, white_s, green, green], conc)
    _rail(13.9, 1.5, steel)
    box(0, 2.0, 5.0, GL, 1.2, 0.2, conc)                                    # pasillo a media altura
    _rail(2.6, 5.2, steel)
    for k in range(4):
        box(-6 + k * 4, back - 1.05, 3.0, 1.6, 0.1, 1.2, glass)
    prof = [(back - 1.0, 13.6), (13.8, 14.8), (13.8, 14.55), (back - 1.0, 13.35)]
    loft([(-GL / 2, prof), (GL / 2, prof)], roof, "cubierta")
    for x in (-GL / 2 + 0.3, GL / 2 - 0.3):                                 # pilar en V
        tube([(x, back - 0.6, 0.3), (x, back - 3.0, 13.4)], 0.22, steel, "v", 6)
        tube([(x, back - 0.6, 0.3), (x, back + 2.0, 13.6)], 0.22, steel, "v", 6)
        tube([(x, back + 2.0, 13.6), (x, 13.6, 14.6)], 0.16, steel, "viga", 6)
        tube([(x, back + 2.0, 13.6), (x, 8.0, 12.6), (x, 13.6, 14.5)], 0.06, steel, "tirante", 4)
    box(0, 13.0, 14.3, GL - 1.2, 0.3, 0.12, luz)


def grada_austin():
    """Módulo de las gradas de Austin (la de la curva 15 y las de alrededor): gradas de aluminio descubiertas, 14 filas de
    bancos plateados sobre una estructura de acero vista (pilares, vigas y cruces) en vez de hormigón, con la escalera
    en medio, la barandilla de atrás y una vela de sombra roja tensada en lo alto de cada tramo."""
    alu, steel, dark, sail = mat("alu", "#c9ced4", 0.7, 0.3), mat("steel", "#6a7178", 0.6, 0.4), mat("step", "#9aa0a6", 0.5, 0.45), mat("sail_red", "#b3202a", 0.0, 0.6)
    n, yf, yb, ztop = 14, 12.5, -12.5, 10.2
    d, rise = (yf - yb) / n, (ztop - 1.0) / n
    for k in range(n):
        y, z = yf - (k + 0.5) * d, 1.0 + k * rise
        box(0, y, z - 0.08, GL, d, 0.08, dark)                              # piso del escalón
        box(0, y + d * 0.15, z + 0.4, GL - 0.3, 0.32, 0.06, alu)            # banco
        for x in (-GL / 2 + 0.6, 0.0, GL / 2 - 0.6):
            box(x, y + d * 0.15, z, 0.08, 0.08, 0.4, steel)
    for x in (-GL / 2 + 0.4, GL / 2 - 0.4):                                 # pórticos de acero
        for y in (yf - 0.5, 4.0, -4.0, yb + 0.5):
            zc = 1.0 + (yf - y) / (yf - yb) * (ztop - 1.0)
            cyl(x, y, 0, 0.12, zc, steel, 6)
        tube([(x, yf - 0.5, 1.0), (x, yb + 0.5, ztop)], 0.12, steel, "zanca", 6)
        tube([(x, yf - 0.5, 0.2), (x, 4.0, 1.0 + (yf - 4.0) / 25 * (ztop - 1)), (x, -4.0, 0.2), (x, yb + 0.5, ztop - 0.2)], 0.05, steel, "cruz", 4)
    for k in range(n):                                                      # escalera en medio
        y, z = yf - (k + 0.5) * d, 1.0 + k * rise
        box(0, y - d * 0.25, z - 0.08 + rise / 2, 1.2, d / 2, 0.06, alu)
    _rail(yf + 0.2, 1.0, steel)
    _rail(yb + 0.3, ztop, steel)
    # Vela de sombra: triángulo alto atrás y dos esquinas bajas a media grada.
    V = [(-GL / 2, yb + 0.5, ztop + 6.5), (GL / 2, yb + 0.5, ztop + 4.5), (0, 2.0, ztop + 2.2)]
    mesh_obj("vela", V + [(x, y, z + 0.1) for x, y, z in V], [(0, 1, 2), (3, 5, 4)], sail)
    for x, y, z in V[:2]:
        cyl(x, y, ztop, 0.1, z - ztop, steel, 6)
    cyl(0, 2.0, 1.0 + (yf - 2.0) / 25 * (ztop - 1), 0.1, ztop + 2.2 - (1.0 + (yf - 2.0) / 25 * (ztop - 1)), steel, 6)


def torre_sakhir():
    """Torre de Sakhir (Baréin, unos 60 m): podio de dos plantas, fuste de hormigón color arena con aletas verticales y,
    arriba, siete plantas acristaladas que se abren hacia arriba como una copa, cada una con su forjado claro y su
    terraza; remate con la carpa blanca en pico sobre el mirador, y luces en los forjados. Referencia: huella de
    OpenStreetMap way/187123438."""
    sand, glass, white = mat("sand", "#e3d4b4", 0.0, 0.7), mat("glass", "#2c4a63", 0.3, 0.12), mat("white", "#f2f1ec", 0.1, 0.4)
    steel, luz = mat("steel", "#c3c8ce", 0.6, 0.3), mat("luz", "#fff1c8", emission="#fff1c8")
    cyl(0, 0, 0, 17.5, 7.0, sand, 18)                                       # podio
    cyl(0, 0, 2.0, 17.8, 3.4, glass, 18)
    cyl(0, 0, 7.0, 18.2, 0.6, white, 18)
    cyl(0, 0, 7.6, 6.5, 26.0, sand, 20)                                     # fuste
    for k in range(8):                                                      # aletas del fuste
        a = 2 * math.pi * k / 8
        box(6.6 * math.cos(a), 6.6 * math.sin(a), 7.6, 1.6, 0.8, 26.0, sand, rot=a)
    for k in range(7):                                                      # copa acristalada
        z, r = 33.6 + k * 3.4, 9.0 + k * 1.25
        cyl(0, 0, z, r, 2.9, glass, 18, r2=r + 1.2)
        cyl(0, 0, z + 2.9, r + 1.7, 0.5, white, 18)
        cyl(0, 0, z + 2.75, r + 1.5, 0.15, luz, 18)
    zt = 33.6 + 7 * 3.4
    cyl(0, 0, zt, 16.0, 1.1, white, 18)                                     # mirador
    for k in range(12):                                                     # barandilla y pilares de la carpa
        a = 2 * math.pi * k / 12
        cyl(15.0 * math.cos(a), 15.0 * math.sin(a), zt + 1.1, 0.18, 4.2, steel, 6)
    cyl(0, 0, zt + 5.2, 16.5, 4.5, white, 18, r2=1.0)                       # carpa en pico
    cyl(0, 0, zt + 9.6, 0.25, 4.0, steel, 6)                                # pináculo


def torre_cota():
    """Torre de observación de Austin (76,5 m): fuste blanco de hormigón con la caja del ascensor, el mirador circular
    acristalado arriba con su cubierta, y el velo rojo de 18 pares de cables que bajan en abanico del mirador a un anillo
    en el suelo (los pares se cruzan como en la torre real). Referencias: nodo de OpenStreetMap node/7911006730 y la
    categoría de Wikimedia Commons «Observation Tower (Circuit of the Americas)»."""
    white, glass, red = mat("white", "#eef0f2", 0.2, 0.4), mat("glass", "#2b4258", 0.3, 0.12), mat("cable_red", "#c4161c", 0.3, 0.45)
    steel, luz = mat("steel", "#b9bfc6", 0.6, 0.3), mat("luz", "#fff1c8", emission="#fff1c8")
    cyl(0, 0, 0, 3.2, 70.0, white, 16)                                      # fuste
    box(0, 3.2, 0, 2.4, 2.0, 70.0, glass)                                   # caja acristalada del ascensor
    cyl(0, 0, 0, 13.0, 0.8, white, 32)                                      # anillo del suelo
    cyl(0, 0, 65.0, 9.5, 1.0, white, 28)                                    # mirador: losa, cristal y cubierta
    cyl(0, 0, 66.0, 9.3, 3.6, glass, 28)
    cyl(0, 0, 69.6, 10.2, 0.9, white, 28)
    cyl(0, 0, 70.5, 6.0, 4.0, white, 20, r2=3.0)
    cyl(0, 0, 74.5, 0.2, 2.0, steel, 6)
    cyl(0, 0, 69.4, 10.0, 0.15, luz, 28)
    for k in range(18):                                                     # velo de cables
        a = 2 * math.pi * k / 18
        for s in (-1, 1):
            b = a + s * math.pi / 18
            tube([(9.6 * math.cos(a), 9.6 * math.sin(a), 65.0), (12.6 * math.cos(b), 12.6 * math.sin(b), 0.8)], 0.09, red, "cable", 4)


def palacio_deportes():
    """Palacio de los Deportes (México, 1968): cúpula de cobre de unos 160 m hecha de paraboloides hiperbólicos (aquí,
    facetas en dos tonos de cobre que se cruzan en rombos), sobre un anillo de hormigón blanco con sus accesos y un
    zócalo; la linterna arriba. Referencia: huella de OpenStreetMap relation/20951534."""
    cu1, cu2, white = mat("copper", "#b4643a", 0.6, 0.45), mat("copper_dark", "#8e4a2a", 0.6, 0.5), mat("white", "#ece9e2", 0.0, 0.7)
    glass, dark = mat("glass", "#2f455c", 0.3, 0.15), mat("dark", "#3a3d42", 0.2, 0.7)
    R, H0, H = 78.0, 9.0, 34.0
    cyl(0, 0, 0, R + 2, 1.2, dark, 48)                                      # zócalo
    cyl(0, 0, 1.2, R, H0 - 1.2, white, 48)                                  # anillo de hormigón
    for k in range(16):                                                     # accesos acristalados
        a = 2 * math.pi * k / 16
        box((R + 0.2) * math.cos(a), (R + 0.2) * math.sin(a), 1.2, 9.0, 0.6, 5.0, glass, rot=a + math.pi / 2)
    # Cúpula: anillos de facetas alternando los dos cobres (rombos), del borde a la linterna.
    rings, seg = 8, 32
    pt = lambda i, j: (R * math.cos(math.pi / 2 * i / rings) * math.cos(2 * math.pi * (j + 0.5 * (i % 2)) / seg),
                       R * math.cos(math.pi / 2 * i / rings) * math.sin(2 * math.pi * (j + 0.5 * (i % 2)) / seg),
                       H0 + (H - H0) * math.sin(math.pi / 2 * i / rings))
    for tone, m in ((0, cu1), (1, cu2)):
        V, F = [], []
        for i in range(rings - 1):
            for j in range(seg):
                if (i + j) % 2 != tone:
                    continue
                a, b, c = pt(i, j), pt(i, j + 1), pt(i + 1, j)
                d = pt(i + 1, j - 1) if i % 2 == 0 else pt(i + 1, j + 1)
                base = len(V)
                V += [a, b, c]
                F.append((base, base + 1, base + 2))
                V += [a, c, d] if i % 2 == 0 else [b, d, c]
                F.append((base + 3, base + 4, base + 5))
        mesh_obj("cupula", V, F, m)
    r_top = R * math.cos(math.pi / 2 * (rings - 1) / rings)
    cyl(0, 0, H0 + (H - H0) * math.sin(math.pi / 2 * (rings - 1) / rings), r_top, H - (H0 + (H - H0) * math.sin(math.pi / 2 * (rings - 1) / rings)), cu2, seg, r2=r_top * 0.55)
    cyl(0, 0, H, r_top * 0.55, 3.0, glass, 16)                              # linterna
    cyl(0, 0, H + 3.0, r_top * 0.6, 0.6, white, 16)


MODELS_CR6 = {"puente-carretera": puente_carretera, "monorrail": monorrail, "boca-tunel": boca_tunel,
              "casino-montreal": casino_montreal, "cobertizo-remo": cobertizo_remo, "esplanade-domo": esplanade_domo,
              "estadio-miami": estadio_miami,
              "noria-suzuka": noria_suzuka, "globo-paris": globo_paris, "hotel-lago": hotel_lago, "fuentes-lago": fuentes_lago,
              "casa-gobierno": casa_gobierno, "museo-alfombra": museo_alfombra, "torre-radar": torre_radar,
              "grada-cubierta-sh": grada_cubierta_sh, "grada-sombrillas": grada_sombrillas, "grada-vela": grada_vela,
              "kartodromo": kartodromo, "mezquita-rahma": mezquita_rahma,
              "grada-silverstone": grada_silverstone, "grada-spa": grada_spa, "grada-monza": grada_monza,
              "grada-principal-bcn": grada_principal_bcn, "grada-bcn": grada_bcn, "peralte-tramo": peralte_tramo,
              "ala-silverstone": ala_silverstone,
              "grada-spielberg": grada_spielberg, "grada-bahrain": grada_bahrain, "grada-lusail": grada_lusail,
              "grada-hungaroring": grada_hungaroring, "grada-austin": grada_austin, "torre-sakhir": torre_sakhir,
              "torre-cota": torre_cota, "palacio-deportes": palacio_deportes}

if __name__ == "__main__":
    out = os.path.join(REPO, "public", "models", "scenery")
    only = argv[1:]
    for name, fn in MODELS_CR6.items():
        if only and name not in only:
            continue
        clear()
        fn()
        print("CR6", finish(name, out))
