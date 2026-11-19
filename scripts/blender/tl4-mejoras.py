# [TL4, 18/11/2026] Piezas añadidas de las mejoras del coche, para los cuatro coches (escenas TL7_W14_JUEGO, TL7_AMR24_JUEGO,
# TL7_2025 y TL7_2026 de assets3d/maquetas/tl7-coches.blend). Alcance elegido por el usuario: piezas que encajan en el
# coche sin cambiarle la forma, tres niveles por pieza, cada uno sumado a los anteriores. Revisado el 18/11/2026 a petición
# del usuario: hendiduras en los pontones (2, 4 y 6), flaps que siguen la flecha del alerón delantero, mini alerones
# delante de las ruedas, el ala trasera pequeña unida a la carrocería y aletas del suelo alargadas.
#   alerones      1: gurney del alerón trasero y flap del delantero · 2: vallas sobre el alerón delantero · 3: ala sobre la estructura trasera
#   suelo         1-3: aletas en el borde del fondo plano (tres más por nivel y lado); en el 3, además, el borde con su labio
#   refrigeracion 1-3: lamas sobre los pontones (tres más por nivel y lado)
#   eficiencia    1: aleta de la tapa motor · 2: ala en T sobre la aleta · 3: cortes oscuros a los lados de la tapa motor
# Cada pieza se apoya en la carrocería buscando su superficie con rayos, y nada sale de la caja del coche.
# Uso dentro de Blender: exec(open(ruta).read()); build_upgrades('TL7_2025', 'salida.glb')
import bpy, bmesh, math, re
from mathutils import Vector, Matrix

strip_name = lambda n: re.sub(r'\.\d{3}$', '', n)


def _body(sc):
    return next(o for o in sc.objects if o.type == 'MESH' and strip_name(o.name) == 'body')


def _bounds(sc):
    objs = [o for o in sc.objects if o.type == 'MESH' and not strip_name(o.name).startswith(('decal_', 'mejora_'))]
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx


def _ray(body, origin, direction, dist=10.0):
    inv = body.matrix_world.inverted()
    o = inv @ Vector(origin); d = (inv.to_3x3() @ Vector(direction)).normalized()
    ok, loc, nor, _ = body.ray_cast(o, d, distance=dist)
    if not ok:
        return None, None
    return body.matrix_world @ loc, (body.matrix_world.to_3x3() @ nor).normalized()


def _box(bm, center, size, rot_z=0.0, tilt=0.0):
    """Caja de `size` (largo x, ancho y, alto z) con centro en `center`, girada `rot_z` y con inclinación `tilt` (en x)."""
    m = Matrix.Translation(center) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'Y') @ Matrix.Diagonal((size[0], size[1], size[2], 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def _fin(bm, base_x0, base_x1, y, z0, h0, h1, thick):
    """Aleta vertical (un trapecio con grosor): de base_x0 a base_x1, altura h0 delante y h1 detrás."""
    vs = []
    for dy in (-thick / 2, thick / 2):
        vs += [bm.verts.new((base_x0, y + dy, z0)), bm.verts.new((base_x1, y + dy, z0)), bm.verts.new((base_x1, y + dy, z0 + h1)), bm.verts.new((base_x0, y + dy, z0 + h0))]
    a, b = vs[:4], vs[4:]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    for i in range(4):
        bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))


def _object(sc, name, bm, material):
    """Objeto con un material, o con varios (lista): cada cara lleva el suyo en material_index."""
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = False
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for m in (material if isinstance(material, list) else [material]):
        me.materials.append(bpy.data.materials[m])
    return ob


def _slab(bm, a, b, thick, material=0):
    """Une dos filas de puntos (a delante, b detrás, la misma cantidad) en una placa con grosor hacia abajo."""
    down = Vector((0, 0, -thick))
    ta = [bm.verts.new(p) for p in a]; tb = [bm.verts.new(p) for p in b]
    ba = [bm.verts.new(p + down) for p in a]; bb = [bm.verts.new(p + down) for p in b]
    faces = []
    for i in range(len(a) - 1):
        faces += [bm.faces.new((ta[i], ta[i + 1], tb[i + 1], tb[i])), bm.faces.new((ba[i], bb[i], bb[i + 1], ba[i + 1])),
                  bm.faces.new((ta[i], ba[i], ba[i + 1], ta[i + 1])), bm.faces.new((tb[i], tb[i + 1], bb[i + 1], bb[i]))]
    for e in (0, len(a) - 1):
        faces.append(bm.faces.new((ta[e], tb[e], bb[e], ba[e])))
    for f in faces: f.material_index = material
    return faces


def _hstrip(bm, leads, chord, thick, rise):
    """Flap que sigue una línea de bordes de ataque: hacia atrás `chord` y subiendo `rise` hasta el borde de salida."""
    trails = [p + Vector((-chord, 0, rise)) for p in leads]
    _slab(bm, leads, trails, thick)


def _vstrip(bm, base, heights, thick):
    """Aleta vertical a lo largo de una línea de puntos de apoyo, con su altura en cada punto."""
    n = len(base)
    out = []
    for i, p in enumerate(base):
        q = base[min(i + 1, n - 1)] - base[max(i - 1, 0)]
        side = Vector((-q.y, q.x, 0)).normalized() * (thick / 2) if q.length > 1e-6 else Vector((0, thick / 2, 0))
        out.append((bm.verts.new(p + side), bm.verts.new(p - side), bm.verts.new(p - side + Vector((0, 0, heights[i]))), bm.verts.new(p + side + Vector((0, 0, heights[i])))))
    for i in range(n - 1):
        a, b = out[i], out[i + 1]
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    bm.faces.new(out[0]); bm.faces.new(list(reversed(out[-1])))


def _gill(bm, body, x, side, y0, y1, zlo, zhi, ztop, half=0.02):
    """
    Hendidura en el pontón: hueco oscuro (material 0) que sigue la superficie a lo ancho, y detrás un labio de carrocería
    (material 1) que sube desde la superficie, como la rejilla de salida de aire de un coche de verdad.
    """
    front, back = [], []
    for k in range(9):
        y = side * (y0 + (y1 - y0) * k / 8)
        f = _top(body, x + half, y, ztop); b = _top(body, x - half, y, ztop)
        if not f or not b or not (zlo < f.z < zhi) or not (zlo < b.z < zhi):
            continue
        front.append(f + Vector((0, 0, 0.0025))); back.append(b + Vector((0, 0, 0.0025)))
    if len(front) < 3:
        return
    if side < 0:
        front.reverse(); back.reverse()
    _slab(bm, front, back, 0.002, 0)
    lip = [p + Vector((0.008, 0, 0.018)) for p in back]
    _slab(bm, back, lip, 0.003, 1)


def _fit(us, vs, deg=2):
    """Ajuste por mínimos cuadrados de v(u) con un polinomio de grado 1 o 2 (sin numpy): suaviza líneas con saltos."""
    n = deg + 1
    A = Matrix([[sum(u ** (i + j) for u in us) for j in range(n)] for i in range(n)])
    b = Vector([sum(v * u ** i for u, v in zip(us, vs)) for i in range(n)])
    try:
        c = A.inverted() @ b
    except ValueError:
        return lambda u: sum(vs) / len(vs)
    return lambda u: sum(c[i] * u ** i for i in range(n))


def _smooth_line(pts, along, keep_outliers=False):
    """Quita los puntos que se salen mucho de la tendencia y devuelve la línea ajustada (along: 'y' o 'x')."""
    if len(pts) < 4:
        return pts
    ui = 1 if along == 'y' else 0
    ox = 0 if along == 'y' else 1
    us = [abs(p[ui]) if along == 'y' else p[ui] for p in pts]
    for _ in range(2):
        fo = _fit(us, [p[ox] for p in pts]); fz = _fit(us, [p.z for p in pts], 1)
        err = [abs(p[ox] - fo(u)) for p, u in zip(pts, us)]
        med = sorted(err)[len(err) // 2] + 0.005
        keep = [i for i, e in enumerate(err) if e <= 2.5 * med]
        if len(keep) < 4: break
        pts = [pts[i] for i in keep]; us = [us[i] for i in keep]
    fo = _fit(us, [p[ox] for p in pts]); fz = _fit(us, [p.z for p in pts], 1)
    out = []
    for p, u in zip(pts, us):
        q = p.copy(); q[ox] = fo(u); q.z = fz(u); out.append(q)
    return out


def _under_fence(bm, body, xs, y_of, depth, zmin):
    """Valla vertical bajo el suelo: sigue la cara de abajo del coche (rayos hacia arriba) y cuelga `depth`."""
    base, hs = [], []
    n = len(xs)
    for i, x in enumerate(xs):
        y = y_of(i / max(1, n - 1))
        hit, _ = _ray(body, (x, y, zmin - 0.5), (0, 0, 1))
        if not hit or hit.z > 0.25:
            continue
        d = min(depth, hit.z - zmin - 0.005)
        if d < 0.008:
            continue
        base.append(Vector((x, y, hit.z - d))); hs.append(d + 0.004)
    if len(base) > 2:
        _vstrip(bm, base, hs, 0.005)


def _top(body, x, y, zmax):
    hit, _ = _ray(body, (x, y, zmax + 0.5), (0, 0, -1))
    return hit


def build_upgrades(scene_name):
    sc = bpy.data.scenes[scene_name]
    bpy.context.window.scene = sc
    for o in [o for o in sc.objects if strip_name(o.name).startswith('mejora_')]:
        bpy.data.objects.remove(o, do_unlink=True)
    body = _body(sc)
    mn, mx = _bounds(sc)
    L, W, H = mx.x - mn.x, mx.y - mn.y, mx.z - mn.z
    X = lambda r: mn.x + r * L
    made = {}

    # —— alerones ——
    # Ala trasera: su borde de salida es lo más atrasado que da en lo alto (más del 70 % de la altura).
    # El centro del ala puede estar abierto (pilón, DRS): se busca a un lado, a 30 cm del centro, y se copia al otro.
    bm = bmesh.new()
    ys = (0.3, 0.2, 0.4)
    rear = []
    for y0 in ys:
        rear = [h for h in (_top(body, X(i * 0.0025), y0, mx.z) for i in range(60)) if h and h.z > mn.z + 0.75 * H]
        if rear: break
    if rear:
        te = min(rear, key=lambda p: p.x)
        inner = y0; outer = y0
        while inner > 0.02:
            h = _top(body, te.x + 0.01, inner - 0.02, mx.z)
            if not h or abs(h.z - te.z) > 0.05: break
            inner -= 0.02
        while outer < 0.6 * W:
            h = _top(body, te.x + 0.01, outer + 0.02, mx.z)
            if not h or abs(h.z - te.z) > 0.05: break
            outer += 0.02
        for side in (-1, 1):
            _box(bm, (te.x + 0.012, side * (inner + outer) / 2, te.z + 0.012), (0.008, outer - inner, 0.024))

    # [18/11/2026, revisión del usuario] Flaps del alerón delantero que siguen su forma en flecha: en cada punto del ala
    # (de dentro afuera) se busca su borde de salida y el flap se apoya encima, siguiendo esa línea.
    def wing_trail(y):
        hits = []
        for i in range(60):
            x = X(1.0) - i * 0.004 * L
            h = _top(body, x, y, mn.z + 0.40 * H)
            if h and h.z < mn.z + 0.38 * H:
                if hits and abs(h.z - hits[-1].z) > 0.10: break
                hits.append(h)
            elif hits:
                break
        return hits[-1] if len(hits) > 3 else None

    def flap_line(side, back, lift):
        """Flap nuevo detrás del último elemento del ala: empieza un poco por encima de su borde de salida."""
        line = []
        for k in range(15):
            y = side * (0.16 + k * 0.02) * W
            t = wing_trail(y)
            if not t: continue
            line.append(Vector((t.x + back, y, t.z + lift)))
        # Mediana de tres: quita un salto suelto sin mover la línea (un ajuste a una curva la bajaba bajo el ala).
        med = lambda a, b, c: sorted((a, b, c))[1]
        out = []
        for i, p in enumerate(line):
            a, c = line[max(0, i - 1)], line[min(len(line) - 1, i + 1)]
            out.append(Vector((med(a.x, p.x, c.x), p.y, med(a.z, p.z, c.z))))
        return out

    # [19/11/2026, tercera revisión del usuario: «lo que tiene encima del segundo flap está mal… frenaría el coche»] Nada
    # encima de los flaps. Como en las evoluciones reales, se añaden pequeños flaps en los laterales: placas horizontales
    # cortas pegadas por dentro a la placa del extremo del alerón (nivel 1, una por lado; nivel 2, otra más abajo).
    def endplate(side):
        """Placa del extremo del alerón delantero: lo más de fuera que aún es ala, a media cuerda; con su altura."""
        best = None
        for i in range(10, 40, 2):
            x = X(1.0) - i * 0.004 * L
            for k in range(60, 30, -1):
                y = side * k * 0.01 * W
                h = _top(body, x, y, mn.z + 0.40 * H)
                if h and h.z < mn.z + 0.38 * H:
                    if not best or abs(y) > abs(best.y): best = h
                    break
        return best
    plates = {side: endplate(side) for side in (-1, 1)}
    def side_flap(p, side, dz, chord):
        zc = p.z - dz
        # Por la cara de dentro de la placa: por fuera se saldría del ancho del coche.
        _box(bm, (p.x - 0.02, p.y - side * 0.03, zc), (chord, 0.05, 0.006), tilt=math.radians(-8))
    for side, p in plates.items():
        if p: side_flap(p, side, 0.02, 0.14)
    made['mejora_alerones_1'] = _object(sc, 'mejora_alerones_1', bm, 'paint_secondary')

    # Nivel 2: otro flap lateral más abajo en cada placa y mini alerones delante de las ruedas delanteras, apoyados en el
    # ala con su soporte.
    bm = bmesh.new()
    for side, p in plates.items():
        if p: side_flap(p, side, 0.06, 0.11)
    wheels = [o for o in sc.objects if strip_name(o.name) in ('wheel_FL', 'wheel_FR')]
    for w in wheels:
        c = w.matrix_world.translation
        R = max(w.dimensions) / 2
        side = 1 if c.y > 0 else -1
        # Lo más cerca de la rueda donde ya hay ala debajo (el ala puede empezar 20-30 cm por delante).
        hit = None; x = c.x; y = c.y
        for dx in (0.10, 0.15, 0.20, 0.25, 0.30):
            for k in range(12):
                x, y = c.x + R + dx, c.y - side * k * 0.03
                h = _top(body, x, y, mn.z + 0.32 * H)
                if h and h.z < mn.z + 0.30 * H: hit = h; break
            if hit: break
        if not hit: continue
        zw = min(hit.z + 0.12, c.z)
        _box(bm, (x, y, zw), (0.07, 0.16, 0.006), tilt=math.radians(-12))
        _box(bm, (x, y + side * 0.075, (hit.z + zw) / 2), (0.08, 0.006, zw - hit.z + 0.01))
    made['mejora_alerones_2'] = _object(sc, 'mejora_alerones_2', bm, 'paint_secondary')

    # Nivel 3: ala pequeña sobre la estructura trasera, unida a ella por un pilar central (antes flotaba).
    bm = bmesh.new()
    xw = X(0.035)
    below = [h for h in (_top(body, xw + d * 0.02, 0.0, mn.z + 0.5 * H) for d in (-1, 0, 1)) if h]
    base = max(below, key=lambda p: p.z) if below else None
    zc = (base.z + 0.09) if base else mn.z + 0.42 * H
    zc = min(zc, mn.z + 0.6 * H)
    _box(bm, (xw, 0.0, zc), (0.12, 0.42, 0.012), tilt=math.radians(-10))
    for side in (-1, 1):
        _box(bm, (xw, side * 0.21, zc - 0.03), (0.13, 0.008, 0.07))
    if base:
        _box(bm, (xw, 0.0, (base.z + zc) / 2 - 0.003), (0.06, 0.02, zc - base.z + 0.02))
    made['mejora_alerones_3'] = _object(sc, 'mejora_alerones_3', bm, 'paint_secondary')

    # —— suelo: aletas alargadas en el borde del fondo plano ——
    # [18/11/2026, revisión del usuario] A lo largo del borde, como las placas del alerón delantero: guían el aire hacia
    # atrás en vez de cortarlo. Más bajas delante y más altas detrás; cada nivel suma una, un poco más hacia dentro.
    def floor_edge(x, side):
        """Borde del fondo plano: el punto más de fuera, mirando desde arriba, que aún da en el suelo (menos de 20 cm)."""
        last = None
        for k in range(30, 56):
            y = side * k * 0.01 * W
            h = _top(body, x, y, mx.z)
            if h and h.z < 0.2: last = h
            elif last and (not h or h.z >= 0.2) and abs(y) > abs(last.y) + 0.05: break
        return last
    spans = {1: (0.34, 0.60), 2: (0.36, 0.58), 3: (0.38, 0.56)}
    for level in (1, 2, 3):
        bm = bmesh.new()
        r0, r1 = spans[level]
        for side in (-1, 1):
            pts, hs = [], []
            for i in range(13):
                r = r0 + (r1 - r0) * i / 12
                x = X(r)
                e = floor_edge(x, side)
                if not e: continue
                y = e.y - side * (0.025 + (level - 1) * 0.045)
                t = _top(body, x, y, mx.z)
                z0 = (t.z if t and t.z < 0.2 else e.z) - 0.005
                pts.append(Vector((x, y, z0)))
                hs.append(0.07 - 0.04 * i / 12)
            if len(pts) > 3:
                # [segunda revisión] Cortas, como las primeras, pero en fila seguida a lo largo del borde: cada aleta
                # va en el sentido del aire, algo abierta hacia fuera por detrás para empujarlo.
                pts = _smooth_line(pts, 'x')
                for i in range(0, len(pts) - 1, 2):
                    a = pts[i]; b = pts[i + 1]
                    b = b + Vector((0, side * 0.012, 0))
                    _vstrip(bm, [a, b], [0.035, 0.045], 0.005)
            # [19/11/2026, el usuario: «diferentes suelos que, aunque no se vean, den un aspecto diferente»] Por debajo:
            # nivel 1, dos vallas bajo la entrada del suelo, curvadas hacia fuera hacia atrás (llevan el aire a los
            # canales); nivel 2, dos más hacia dentro; nivel 3, aletas verticales bajo el difusor.
            if level in (1, 2):
                for j in ((0, 1) if level == 1 else (2, 3)):
                    _under_fence(bm, body, [X(0.64 - 0.012 * i) for i in range(12)],
                                 lambda u, j=j: side * ((0.30 - 0.05 * j) + 0.06 * u) * W, 0.035, mn.z)
            else:
                for k in range(3):
                    _under_fence(bm, body, [X(0.10 - 0.008 * i) for i in range(9)],
                                 lambda u, k=k: side * (0.10 + 0.08 * k) * W, 0.05, mn.z)
        made[f'mejora_suelo_{level}'] = _object(sc, f'mejora_suelo_{level}', bm, 'carbon')

    # —— refrigeracion: hendiduras en los pontones ——
    # [18/11/2026, revisión del usuario] Hendiduras de verdad: un hueco oscuro que sigue la curva del pontón, con el labio
    # de carrocería detrás, que se levanta. 2, 4 y 6 por lado según el nivel.
    # [segunda revisión] En el pontón, más cortas y más separadas (2, 4 y 6 por lado); en la tapa motor, detrás del motor,
    # más largas (una más por lado en cada nivel), que es donde más refrigeran.
    gills = [X(0.38) + k * 0.085 for k in range(6)]
    engine = [X(0.30) - k * 0.075 for k in range(3)]
    for level in (1, 2, 3):
        bm = bmesh.new()
        for side in (-1, 1):
            for x in gills[(level - 1) * 2: level * 2]:
                _gill(bm, body, x, side, 0.24 * W, 0.33 * W, mn.z + 0.25 * H, mn.z + 0.78 * H, mx.z)
            _gill(bm, body, engine[level - 1], side, 0.07 * W, 0.20 * W, mn.z + 0.45 * H, mn.z + 0.95 * H, mx.z, half=0.03)
        made[f'mejora_refrigeracion_{level}'] = _object(sc, f'mejora_refrigeracion_{level}', bm, ['carbon', 'paint_primary'])

    # —— eficiencia: aleta, ala en T y cortes de la tapa motor ——
    xs = [X(0.14 + i * 0.01) for i in range(16)]
    tops = [h for h in (_top(body, x, 0.0, mx.z) for x in xs) if h and h.z < mn.z + 0.85 * H]
    bm = bmesh.new()
    if tops:
        a, b = tops[0], tops[-1]
        hmax = min(0.09, (mn.z + 0.95 * H) - max(a.z, b.z))
        hmax = max(0.03, hmax)
        # Aleta que sigue la tapa motor: base sobre la superficie en cada punto, más alta detrás (a) que delante (b).
        vs = []
        for dy in (-0.003, 0.003):
            vs += [bm.verts.new((a.x, dy, a.z - 0.01)), bm.verts.new((b.x, dy, b.z - 0.01)), bm.verts.new((b.x, dy, b.z + 0.015)), bm.verts.new((a.x, dy, a.z + hmax))]
        q, r = vs[:4], vs[4:]
        bm.faces.new(q); bm.faces.new(list(reversed(r)))
        for i in range(4):
            bm.faces.new((q[i], q[(i + 1) % 4], r[(i + 1) % 4], r[i]))
    made['mejora_eficiencia_1'] = _object(sc, 'mejora_eficiencia_1', bm, 'paint_primary')
    bm = bmesh.new()
    if tops:
        # Ala en T apoyada en lo alto de la aleta, en su parte de atrás.
        zt = a.z + hmax - 0.004
        _box(bm, (a.x + 0.025, 0.0, zt), (0.05, 0.30, 0.008))
    made['mejora_eficiencia_2'] = _object(sc, 'mejora_eficiencia_2', bm, 'carbon')
    bm = bmesh.new()
    for side in (-1, 1):
        for i, r in enumerate((0.22, 0.26, 0.30)):
            x = X(r); hit, n = _ray(body, (x, side * (mx.y + 0.5), mn.z + 0.62 * H), (0, -side, 0))
            if not hit or abs(hit.y) > 0.45 * W: continue
            _box(bm, (hit.x, hit.y + side * 0.004, hit.z), (0.09, 0.006, 0.025))
    made['mejora_eficiencia_3'] = _object(sc, 'mejora_eficiencia_3', bm, 'carbon')

    # Nada fuera de la caja del coche.
    out = []
    for name, ob in made.items():
        for v in ob.data.vertices:
            p = ob.matrix_world @ v.co
            if any(p[i] < mn[i] - 0.005 or p[i] > mx[i] + 0.005 for i in range(3)):
                out.append(name); break
    return {k: len(v.data.polygons) for k, v in made.items()}, out


def export_upgrades(scene_name, path):
    sc = bpy.data.scenes[scene_name]
    bpy.context.window.scene = sc
    for s in bpy.data.scenes:
        for o in s.objects:
            try: o.select_set(False, view_layer=s.view_layers[0])
            except Exception: pass
    parts = [o for o in sc.objects if strip_name(o.name).startswith('mejora_')]
    for o in parts:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, use_active_scene=True, export_animations=False,
                              export_yup=True, export_texcoords=False, export_normals=True, export_materials='EXPORT')
    return [o.name for o in parts]
