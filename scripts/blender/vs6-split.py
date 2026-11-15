# [VS6, 15/11/2026] Parte la carrocería del coche de la portada (objeto «hero_body», una sola malla) en las piezas del
# despiece de la landing: ala delantera, ala trasera, chasis, pontones, suelo, tapa motor, suspensión delantera y
# suspensión trasera. Deja las piezas en la escena «VS6», colección «VS6_coche», y copia las ruedas de la portada.
#
# El reparto es por sitio, con cortes rectos: antes de repartir, la malla se corta por los planos que separan las piezas
# (como las juntas de los paneles), y cada cara va a la pieza de su lado. El chasis es solo el morro, el monocasco, el
# halo y la toma de aire; detrás del habitáculo todo es carrocería (tapa motor arriba, pontones a los lados) o suelo.
# La suspensión se saca por islas de malla (los brazos son piezas sueltas en el modelo).
#
# Uso (dentro de Blender, con la escena HERO cargada):
#   exec(open(r"<repo>/scripts/blender/vs6-split.py", encoding="utf-8").read()); split_car()
import bpy, bmesh
from mathutils import Vector

SOURCE = "hero_body"
SCENE, COLLECTION = "VS6", "VS6_coche"
BODY_PARTS = ["ala_delantera", "ala_trasera", "chasis", "pontones", "carroceria_baja", "suelo", "tapa_motor", "suspension_del", "suspension_tras"]


X_WING_F, X_WING_R, X_COCKPIT, X_POD_FRONT = 2.15, -1.88, -0.42, 1.05   # cortes a lo largo
Y_TUB, Y_NOSE = 0.36, 0.21                                              # semianchos del monocasco y del morro
Z_FLOOR, Z_COVER, Z_NOSE, Z_WING_R = 0.125, 0.46, 0.20, 0.36            # alturas de corte
X_DIFF, DIFF_SLOPE = -1.2, 0.2                                          # el suelo sube hacia el difusor
# Planos por los que se corta la malla antes de repartir: (punto, normal).
CUTS = [((X_WING_F, 0, 0), (1, 0, 0)), ((X_WING_R, 0, 0), (1, 0, 0)), ((X_COCKPIT, 0, 0), (1, 0, 0)), ((X_POD_FRONT, 0, 0), (1, 0, 0)),
        ((0, Y_TUB, 0), (0, 1, 0)), ((0, -Y_TUB, 0), (0, 1, 0)), ((0, 0, Z_FLOOR), (0, 0, 1)), ((0, 0, Z_COVER), (0, 0, 1)),
        ((0, 0, Z_WING_R), (0, 0, 1)), ((X_DIFF, 0, Z_FLOOR), (DIFF_SLOPE, 0, 1)),
        ((0, 0.17, 0), (0, 1, 0)), ((0, -0.17, 0), (0, 1, 0)), ((0, 0, 0.62), (0, 0, 1)), ((0.0, 0, 0), (1, 0, 0)),
        ((0, 0, 0.07), (0, 0, 1)), ((-1.3, 0, 0), (1, 0, 0)), ((0.45, 0, 0), (1, 0, 0))]
# Bajo el pontón, lo que queda por encima de la placa del suelo es la carrocería del pontón que baja hasta él: se va
# con los pontones, para que al quitarlos quede el suelo plano y no una bañera roja.
POD_SKIN_X, POD_SKIN_Y, POD_SKIN_Z = (-1.3, 0.45), 0.36, 0.07
FLOOR_FRONT_X, FLOOR_TOP_Z = 1.25, 0.24                 # el suelo empieza detrás de las ruedas delanteras
# Juntas de las piezas que se quitan, como en un coche real: van a lo largo, nunca de arriba abajo, y no bajan hasta el
# suelo. La tapa motor y los pontones se cortan a Z_PANEL de altura; por debajo queda un faldón fijo de carrocería
# (carroceria_baja). Detrás del habitáculo, la tapa motor y el pontón se separan por el canal que ya hay entre ellos
# (Y_GULLY): la junta corre de delante a atrás por el fondo del canal.
Z_PANEL, Y_GULLY = 0.20, 0.40
CUTS += [((0, 0, Z_PANEL), (0, 0, 1)), ((0, Y_GULLY, 0), (0, 1, 0)), ((0, -Y_GULLY, 0), (0, 1, 0))]


def _place(c):
    """Pieza de una cara por el sitio de su centro (x hacia el morro, z arriba)."""
    ay = abs(c.y)
    floor = Z_FLOOR + max(0.0, X_DIFF - c.x) * DIFF_SLOPE
    if c.x > X_WING_F:
        return "ala_delantera"                            # el ala y la mitad delantera del morro son un solo conjunto
    if c.x < X_WING_R:
        if c.z > Z_WING_R or (ay < 0.16 and c.x < -2.24):
            return "ala_trasera"                          # alerón, sus soportes, estructura trasera y luz de lluvia
        return "suelo"
    if c.z < floor:
        if POD_SKIN_X[0] < c.x < POD_SKIN_X[1] and ay > POD_SKIN_Y and c.z > POD_SKIN_Z:
            return "carroceria_baja"
        return "suelo"
    if c.x > X_POD_FRONT:
        return "suelo" if (ay > 0.30 and c.z < 0.33) else "chasis"   # deflectores del borde del suelo
    panel = c.z > Z_PANEL
    if c.x > 0.55 and c.z < 0.30 and ay > 0.5:
        return "suelo"                                    # puntas bajas de los deflectores del borde del suelo
    if c.x > X_COCKPIT:
        if c.x < 0.0 and ay > 0.17 and c.z < 0.62:       # hombros de la carrocería, a los lados de la toma de aire
            if c.z > Z_COVER and ay < Y_TUB:
                return "tapa_motor"
            return "pontones" if panel else "carroceria_baja"
        if ay < Y_TUB:
            return "chasis"
        return "pontones" if panel else "carroceria_baja"
    # Detrás del habitáculo: por dentro del canal, la tapa motor (arriba y a los lados del motor, como en las fotos de
    # referencia); por fuera, la parte de atrás del pontón, que sigue siendo pontón de punta a punta.
    if not panel:
        return "carroceria_baja"
    return "pontones" if ay > Y_GULLY else "tapa_motor"


def _islands(bm):
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, vs = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop()
            vs.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index)
                    stack.append(b)
        out.append(vs)
    return out


DRS_LE, DRS_TE, DRS_SPAN, DRS_HINGE_T = (-2.105, 0.772), (-2.292, 0.893), 0.47, 0.86
DRS_OPEN_DEG = -30.0                                     # giro sobre Y del objeto para abrir el flap


def build_drs_flap(material):
    """Flap móvil del alerón trasero (DRS). El del modelo llegó deshecho por la reducción de triángulos, así que se
    rehace limpio: un perfil entre las derivas, con el origen del objeto en su eje de giro. Cerrado es rotación 0;
    abierto, DRS_OPEN_DEG grados sobre Y (el borde de ataque sube y el flap queda casi plano)."""
    import math
    le, te = Vector((DRS_LE[0], 0, DRS_LE[1])), Vector((DRS_TE[0], 0, DRS_TE[1]))
    chord = te - le
    up = Vector((chord.z, 0, -chord.x)).normalized()
    if up.z < 0:
        up = -up
    hinge = le + chord * DRS_HINGE_T
    stations = [0.0, 0.03, 0.09, 0.2, 0.35, 0.52, 0.7, 0.86, 1.0]
    # Perfil de ala invertida: la cara de arriba, cóncava; la de abajo, panzuda; borde de ataque redondo y salida fina.
    camber = lambda t: -0.014 * math.sin(math.pi * t)
    thick = lambda t: 0.030 * math.sqrt(t) * (1 - t) ** 0.8 + 0.0015
    upper = [le + chord * t + up * (camber(t) + thick(t) * 0.45) for t in stations]
    lower = [le + chord * t + up * (camber(t) - thick(t)) for t in stations]
    loop = upper + list(reversed(lower[1:-1]))
    bm = bmesh.new()
    rings = [[bm.verts.new(Vector((p.x, y, p.z)) - hinge) for p in loop] for y in (-DRS_SPAN, DRS_SPAN)]
    n = len(loop)
    for k in range(n):
        f = bm.faces.new((rings[0][k], rings[0][(k + 1) % n], rings[1][(k + 1) % n], rings[1][k]))
        f.smooth = True
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    # Orejeta central: donde empuja el actuador.
    lug = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, vec=(0.05, 0.012, 0.035), verts=lug)
    bmesh.ops.translate(bm, vec=(le + chord * 0.08 + up * 0.012) - hinge, verts=lug)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    old = bpy.data.objects.get("vs6_drs_flap")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new("vs6_drs_flap")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new("vs6_drs_flap", me)
    ob.location = hinge
    bpy.data.collections[COLLECTION].objects.link(ob)

    # Puntas fijas: en los alerones de 2022 en adelante el flap no acaba en la deriva, baja en curva hasta ella. Solo se
    # abre el tramo central; las puntas se quedan quietas.
    tb = bmesh.new()
    drop, reach, steps = 0.03, 0.045, 5          # acaban antes de la cara interior de la deriva (y ~ 0,53 m)
    for side in (1, -1):
        secs = []
        for k in range(steps + 1):
            a = 0.5 * math.pi * k / steps
            y = side * (DRS_SPAN + reach * math.sin(a))
            dz = -drop * (1 - math.cos(a))
            shrink = 1 - 0.35 * (k / steps)
            secs.append([tb.verts.new(Vector((te.x + (p.x - te.x) * shrink, y, p.z + dz))) for p in loop])
        for a_, b_ in zip(secs, secs[1:]):
            for k in range(n):
                tb.faces.new((a_[k], a_[(k + 1) % n], b_[(k + 1) % n], b_[k])).smooth = True
        tb.faces.new(secs[0])
        tb.faces.new(list(reversed(secs[-1])))
    bmesh.ops.recalc_face_normals(tb, faces=tb.faces[:])
    old = bpy.data.objects.get("vs6_drs_puntas")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    tm = bpy.data.meshes.new("vs6_drs_puntas")
    tb.to_mesh(tm)
    tb.free()
    tm.materials.append(material)
    bpy.data.collections[COLLECTION].objects.link(bpy.data.objects.new("vs6_drs_puntas", tm))
    return len(me.polygons)


def split_car():
    src = bpy.data.objects[SOURCE]
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    col = bpy.data.collections.get(COLLECTION) or bpy.data.collections.new(COLLECTION)
    if col.name not in sc.collection.children:
        sc.collection.children.link(col)

    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    for point, normal in CUTS:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=point, plane_no=normal)
    bm.verts.index_update()
    bm.faces.index_update()
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    part_of = {f.index: _place(f.calc_center_median()) for f in bm.faces}
    # El suelo es toda la superficie que se ve desde abajo: la tabla, los túneles (cuyo techo sube por debajo de los
    # pontones), los deflectores de la entrada, el borde y el difusor. Cortarlo por alturas lo partía y se llevaba los
    # túneles con los pontones; aquí se reconoce por lo que es: lo que no tiene nada debajo.
    from mathutils.bvhtree import BVHTree
    under = BVHTree.FromBMesh(bm)
    for f in bm.faces:
        c = f.calc_center_median()
        if not (X_WING_R < c.x < FLOOR_FRONT_X) or abs(c.y) > 0.8 or f.normal.z > 0.3:
            continue
        top = FLOOR_TOP_Z + max(0.0, X_DIFF - c.x) * 0.2         # el techo del difusor sube hacia atrás
        if c.z > top:
            continue
        hit = under.ray_cast(c - Vector((0, 0, 0.003)), Vector((0, 0, -1)), 2.0)
        if hit[0] is None:
            part_of[f.index] = "suelo"

    # Suspensión: islas enteras, por su caja.
    for vs in _islands(bm):
        xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
        x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
        ay, cx = max(abs(min(ys)), abs(max(ys))), sum(xs) / len(xs)
        faces = {f.index for v in vs for f in v.link_faces}
        if not faces:
            continue
        votes = {}
        for i in faces:
            votes[part_of[i]] = votes.get(part_of[i], 0) + 1
        main = max(votes, key=votes.get)
        target = None
        if main == "ala_trasera" and x1 < -2.14 and z0 > 0.80:
            target = "descartar"                          # restos del flap original: lo sustituye build_drs_flap()
        elif main == "ala_trasera" and ay < 0.04 and z0 > 0.70 and x0 > -2.25:
            target = "descartar"                          # restos del actuador del DRS: se rehace en vs6-power-unit.py
        elif x0 > 1.0 and x1 < 2.25 and ay > 0.3 and main != "ala_delantera":
            target = "suspension_del"
        elif -2.15 < cx < -1.3 and (x1 - x0) < 0.9 and ay > 0.33 and z1 < 0.72 and z0 > 0.08 and main != "suelo":
            target = "suspension_tras"
        if target:
            for i in faces:
                part_of[i] = target

    out = {}
    for name in BODY_PARTS:
        nb = bm.copy()
        nb.faces.ensure_lookup_table()
        bmesh.ops.delete(nb, geom=[f for f in nb.faces if part_of[f.index] != name], context="FACES")
        bmesh.ops.delete(nb, geom=[v for v in nb.verts if not v.link_faces], context="VERTS")
        old = bpy.data.objects.get("vs6_" + name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        me = bpy.data.meshes.new("vs6_" + name)
        nb.to_mesh(me)
        nb.free()
        for m in src.data.materials:
            me.materials.append(m)
        if name == "suelo":                               # el suelo, de carbono, sin pintar
            for p_ in me.polygons:
                p_.material_index = 0
        col.objects.link(bpy.data.objects.new("vs6_" + name, me))
        out[name] = len(me.polygons)
    bm.free()
    out["drs_flap"] = build_drs_flap(src.data.materials[0])

    # Ruedas: las mismas mallas de la portada, en objetos nuevos y en su sitio.
    for w in ("FL", "FR", "RL", "RR"):
        hub = bpy.data.objects["hero_wheel_" + w]
        for ch in hub.children:
            n = "vs6_rueda_" + w + "_" + ch.name.replace("hero_", "").replace("_" + w, "")
            old = bpy.data.objects.get(n)
            if old:
                bpy.data.objects.remove(old, do_unlink=True)
            o = bpy.data.objects.new(n, ch.data)
            o.matrix_world = hub.matrix_basis @ ch.matrix_parent_inverse @ ch.matrix_basis
            col.objects.link(o)
    return out
