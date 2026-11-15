# [VS6, 15/11/2026] Unidad de potencia de Fórmula 1 para el coche de la landing (lo que se ve al quitar la tapa motor y
# los pontones). El modelo del coche no trae nada debajo de la carrocería, así que se construye aquí con primitivas, a
# partir de las fotos de referencia del usuario (scratch/vs6-referencias/): bloque V6 a 90°, caja de admisión de carbono,
# turbo con una única salida de escape central, colectores envueltos en protección térmica, motor eléctrico con cables
# naranjas, batería plana, radiadores inclinados en los pontones, caja de cambios de carbono con la estructura de impacto
# y los amortiguadores traseros encima, y discos de freno con su pinza. Sin marcas ni rótulos.
#
# Ejes: +X hacia el morro, +Z arriba; eje trasero en x = -1,71 m y delantero en x = 1,71 m (los del coche del juego).
# Uso (dentro de Blender, con la escena «VS6» y la colección «VS6_coche»):
#   exec(open(r"<repo>/scripts/blender/vs6-power-unit.py", encoding="utf-8").read()); build_power_unit()
import bpy, bmesh, math
from mathutils import Vector, Matrix

COLLECTION = "VS6_coche"
# nombre: (color, metal, rugosidad)
MATERIALS = {
    "pu_aluminio": ((0.72, 0.73, 0.75), 1.0, 0.35),
    "pu_acero": ((0.42, 0.39, 0.36), 1.0, 0.42),
    "pu_carbono": ((0.035, 0.035, 0.04), 0.0, 0.32),
    "pu_termico_oro": ((0.60, 0.47, 0.22), 1.0, 0.55),
    "pu_termico_plata": ((0.80, 0.80, 0.82), 1.0, 0.62),
    "pu_naranja": ((1.0, 0.33, 0.02), 0.0, 0.5),
    "pu_goma": ((0.02, 0.02, 0.022), 0.0, 0.8),
    "pu_radiador": ((0.24, 0.25, 0.27), 0.8, 0.5),
    "pu_azul": ((0.04, 0.18, 0.75), 0.0, 0.45),
    "pu_amarillo": ((0.92, 0.74, 0.04), 0.0, 0.5),
    "pu_disco": ((0.07, 0.07, 0.075), 0.2, 0.5),
    "pu_pinza": ((0.50, 0.46, 0.38), 1.0, 0.45),
    "pu_magnesio": ((0.20, 0.205, 0.22), 0.9, 0.5),
    "pu_tornillo": ((0.55, 0.56, 0.58), 1.0, 0.3),
}
MAT_INDEX = {n: i for i, n in enumerate(MATERIALS)}
REAR_X, FRONT_X, AXLE_Z = -1.71, 1.71, 0.35


def _materials():
    out = []
    for name, (color, metal, rough) in MATERIALS.items():
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
        mo = nt.nodes.new("ShaderNodeOutputMaterial")
        bs.inputs["Base Color"].default_value = (*color, 1.0)
        bs.inputs["Metallic"].default_value = metal
        bs.inputs["Roughness"].default_value = rough
        nt.links.new(bs.outputs[0], mo.inputs[0])
        out.append(m)
    return out


class Part:
    """Una pieza: una malla que se va llenando de primitivas, cada una con su material."""

    def __init__(self, name):
        self.name, self.bm = name, bmesh.new()

    def _finish(self, geom, mat, smooth, matrix):
        verts = [g for g in geom if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = MAT_INDEX[mat]
            f.smooth = smooth and len(f.verts) == 4

    def box(self, c, size, mat, rot=None, bevel=0.0):
        g = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        if bevel:
            edges = list({e for v in g for e in v.link_edges})
            bmesh.ops.transform(self.bm, matrix=Matrix.Diagonal((*size, 1.0)), verts=g)
            r = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=2, affect="EDGES")
            g = list({v for f in r["faces"] for v in f.verts} | {v for v in g if v.is_valid})
            m = Matrix.Translation(c) @ (rot or Matrix.Identity(4))
        else:
            m = Matrix.Translation(c) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1.0))
        self._finish(g, mat, False, m)

    def cyl(self, c, axis, r, h, mat, segs=20, r2=None, smooth=True):
        g = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)["verts"]
        q = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized()).to_matrix().to_4x4()
        self._finish(g, mat, smooth, Matrix.Translation(c) @ q)

    def tube(self, pts, r, mat, segs=8, sub=6, caps=True):
        """Tubo a lo largo de una curva suave por los puntos. `r` es un radio o una lista (uno por punto)."""
        pts = [Vector(p) for p in pts]
        radii = r if isinstance(r, (list, tuple)) else [r] * len(pts)
        path, rad = [], []
        for i in range(len(pts) - 1):
            p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
            for k in range(sub):
                t = k / sub
                path.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
                rad.append(radii[i] + (radii[i + 1] - radii[i]) * t)
        path.append(pts[-1]); rad.append(radii[-1])
        normal, rings = None, []
        for i, p in enumerate(path):
            tan = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
            if normal is None:
                normal = tan.orthogonal().normalized()
            else:
                normal = (normal - tan * normal.dot(tan)).normalized()
            bi = tan.cross(normal)
            rings.append([self.bm.verts.new(p + (normal * math.cos(a) + bi * math.sin(a)) * rad[i]) for a in (2 * math.pi * s / segs for s in range(segs))])
        faces = []
        for a, b in zip(rings, rings[1:]):
            for s in range(segs):
                faces.append(self.bm.faces.new((a[s], a[(s + 1) % segs], b[(s + 1) % segs], b[s])))
        if caps:
            faces.append(self.bm.faces.new(list(reversed(rings[0]))))
            faces.append(self.bm.faces.new(rings[-1]))
        for f in faces:
            f.material_index = MAT_INDEX[mat]
            f.smooth = True

    def build(self, mats):
        col = bpy.data.collections[COLLECTION]
        old = bpy.data.objects.get(self.name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        col.objects.link(ob)
        return ob


def _slab(p, a, b, thick, mat):
    """Placa entre dos secciones verticales a = (x, y, z_abajo, z_arriba) y b, de grosor `thick` a lo ancho."""
    h = thick / 2
    vs = [p.bm.verts.new((x, y + dy, z)) for (x, y, z0, z1) in (a, b) for dy in (-h, h) for z in (z0, z1)]
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for q in quads:
        fc = p.bm.faces.new([vs[i] for i in q])
        fc.material_index, fc.smooth = MAT_INDEX[mat], False


def _rx(deg):
    return Matrix.Rotation(math.radians(deg), 4, "X")


# El vano motor de este coche es estrecho (31 cm de semiancho al fondo): el motor y su admisión se estrechan a lo
# ancho en esta proporción para que quepan dentro de la carrocería sin tocarla.
MOTOR_YS = 0.87
CRANK = Vector((-0.62, 0.0, 0.17))        # centro del cigüeñal
CYL_X = [-0.62 + (i - 1) * 0.155 for i in range(3)]


def _bank(s):
    """Ejes de una bancada (s = 1 izquierda, -1 derecha): d a lo largo del cilindro, e hacia fuera y abajo."""
    k = math.sin(math.radians(45))
    return Vector((0, s * k, k)), Vector((0, s * k, -k))


def _bolts(p, centers, axis, r=0.006, h=0.012, mat="pu_tornillo"):
    for c in centers:
        p.cyl(c, axis, r, h, mat, segs=6, smooth=False)


def _engine():
    """Bloque V6 a 90° con culatas, tapas, bobinas, rampas de inyección, distribución, bombas y su cableado."""
    p = Part("vs6_motor")
    p.box(CRANK, (0.52, 0.29, 0.19), "pu_aluminio", bevel=0.014)                           # cárter
    p.box(CRANK + Vector((0, 0, -0.105)), (0.50, 0.24, 0.035), "pu_magnesio", bevel=0.006)  # cárter seco
    for k in range(6):                                                                     # nervios del cárter
        p.box(CRANK + Vector((-0.22 + 0.088 * k, 0, -0.105)), (0.01, 0.25, 0.045), "pu_magnesio")
    for s in (1, -1):
        d, e = _bank(s)
        rot = _rx(-s * 45)
        p.box(CRANK + d * 0.19, (0.50, 0.15, 0.22), "pu_aluminio", rot=rot, bevel=0.008)        # bancada
        p.box(CRANK + d * 0.325, (0.52, 0.18, 0.07), "pu_aluminio", rot=rot, bevel=0.012)       # culata
        p.box(CRANK + d * 0.377, (0.50, 0.135, 0.035), "pu_magnesio", rot=rot, bevel=0.010)     # tapa de balancines
        for k in range(5):                                                                 # nervios de la tapa
            p.box(CRANK + Vector((-0.20 + 0.10 * k, 0, 0)) + d * 0.397, (0.012, 0.12, 0.008), "pu_magnesio", rot=rot)
        for x in CYL_X:
            base = Vector((x, 0, CRANK.z))
            p.cyl(base + d * 0.412, d, 0.019, 0.04, "pu_goma", segs=10)                    # bobina
            p.cyl(base + d * 0.436, d, 0.011, 0.012, "pu_naranja", segs=8)                 # su conector
            p.box(base + d * 0.19 + e * 0.078, (0.11, 0.008, 0.16), "pu_aluminio", rot=rot)   # refuerzo del cilindro
        _bolts(p, [Vector((-0.86 + 0.08 * k, 0, CRANK.z)) + d * 0.365 + e * side for k in range(7) for side in (0.078, -0.078)], d)
        _bolts(p, [Vector((-0.84 + 0.11 * k, 0, CRANK.z)) + d * 0.09 + e * 0.082 for k in range(5)], e, r=0.008)
        # Rampa de inyección por el lado de dentro de la culata, con un inyector por cilindro.
        rail = [Vector((x, 0, CRANK.z)) + d * 0.315 - e * 0.10 for x in (-0.38, -0.62, -0.86)]
        p.tube(rail, 0.009, "pu_tornillo", segs=6, sub=1)
        for x in CYL_X:
            p.cyl(Vector((x, 0, CRANK.z)) + d * 0.30 - e * 0.095, d, 0.008, 0.03, "pu_acero", segs=6)
        # Mazo de cables sobre las bobinas, que baja por delante hasta la centralita.
        loom = [Vector((x, 0, CRANK.z)) + d * 0.445 + e * 0.02 for x in (-0.84, -0.62, -0.40)]
        p.tube(loom + [Vector((-0.345, s * 0.20, 0.42)), Vector((-0.335, s * 0.24, 0.24))], 0.007, "pu_goma", segs=5, sub=3)
    # Tapa de distribución y accesorios, delante.
    p.box((-0.352, 0, 0.26), (0.025, 0.42, 0.36), "pu_aluminio", bevel=0.012)
    for y, z, r in ((0.0, 0.17, 0.065), (0.12, 0.31, 0.048), (-0.12, 0.31, 0.048), (0.0, 0.38, 0.036), (0.15, 0.14, 0.03), (-0.15, 0.14, 0.03)):
        p.cyl((-0.333, y, z), (1, 0, 0), r, 0.02, "pu_acero", segs=18)
        p.cyl((-0.322, y, z), (1, 0, 0), r * 0.45, 0.012, "pu_tornillo", segs=10)
    _bolts(p, [(-0.338, y, z) for y in (-0.19, -0.095, 0.095, 0.19) for z in (0.10, 0.42)] + [(-0.338, y, 0.26) for y in (-0.195, 0.195)], (1, 0, 0))
    p.cyl((-0.33, -0.19, 0.22), (1, 0, 0), 0.042, 0.07, "pu_aluminio", segs=14)             # bomba de agua
    p.cyl((-0.50, -0.205, 0.085), (1, 0, 0), 0.03, 0.30, "pu_magnesio", segs=12)            # bombas de aceite
    for x in (-0.40, -0.50, -0.60):
        p.cyl((x, -0.205, 0.085), (1, 0, 0), 0.034, 0.012, "pu_aluminio", segs=12)
    # Anclajes al chasis: dos triángulos de aluminio delante, como en la referencia.
    for s in (1, -1):
        p.tube([(-0.345, s * 0.07, 0.46), (-0.31, s * 0.22, 0.34), (-0.345, s * 0.27, 0.12)], 0.015, "pu_aluminio", segs=6, sub=1)
        p.tube([(-0.345, s * 0.27, 0.12), (-0.345, s * 0.07, 0.46)], 0.013, "pu_aluminio", segs=6, sub=1)
        _bolts(p, [(-0.33, s * 0.07, 0.46), (-0.33, s * 0.27, 0.12)], (1, 0, 0), r=0.012, h=0.02)
    # Campana trasera, donde se atornilla la caja de cambios.
    p.cyl((-0.888, 0, CRANK.z + 0.03), (1, 0, 0), 0.165, 0.03, "pu_aluminio", segs=28)
    return p


def _intake():
    """Caja de admisión de carbono sobre la V, con sus lomos y trompetas, y el conducto que baja el aire de la toma al compresor."""
    p = Part("vs6_admision")
    p.box((-0.62, 0, 0.585), (0.50, 0.33, 0.11), "pu_carbono", bevel=0.035)
    for s in (1, -1):
        p.tube([(-0.39, s * 0.088, 0.625), (-0.62, s * 0.088, 0.655), (-0.85, s * 0.088, 0.625)], [0.055, 0.068, 0.055], "pu_carbono", segs=12)
        d, e = _bank(s)
        for x in CYL_X:                                                                    # trompeta hacia cada cilindro
            a, b = Vector((x, s * 0.13, 0.545)), Vector((x, 0, CRANK.z)) + d * 0.335 - e * 0.045
            p.cyl((a + b) / 2, b - a, 0.034, (b - a).length, "pu_aluminio", segs=10, r2=0.027)
        for x in (-0.47, -0.77):                                                           # abrazaderas de la tapa
            p.box((x, s * 0.168, 0.585), (0.035, 0.012, 0.07), "pu_tornillo")
    _bolts(p, [(x, y, 0.642) for x in (-0.82, -0.62, -0.42) for y in (-0.15, 0.15)], (0, 0, 1), r=0.007)
    p.box((-0.40, 0, 0.61), (0.05, 0.06, 0.03), "pu_magnesio", bevel=0.005)                  # sensor de presión
    # Conducto de aire: de la toma sobre el piloto, por encima de la caja, hasta la boca del compresor.
    # Sale del centro del canal de la toma de aire del coche (en x = -0,42 m el canal va de z = 0,87 a 1,01 m) y baja al
    # compresor por dentro de la carrocería.
    p.tube([(-0.40, 0, 0.942), (-0.50, 0, 0.922), (-0.62, 0, 0.872), (-0.75, 0, 0.785), (-0.875, 0, 0.67), (-0.925, 0, 0.50)],
           [0.066, 0.066, 0.066, 0.064, 0.06, 0.052], "pu_carbono", segs=14)
    p.cyl((-0.405, 0, 0.942), (1, 0, -0.2), 0.069, 0.016, "pu_aluminio", segs=16)        # brida con la toma del coche
    for x, z, r in ((-0.55, 0.905, 0.069), (-0.75, 0.785, 0.067)):
        p.cyl((x, 0, z), (1, 0, -0.22), r, 0.016, "pu_tornillo", segs=14)                  # abrazaderas
    return p


def _turbo():
    """Turbo detrás del motor: compresor y turbina en el mismo eje, y el motor eléctrico del turbo dentro de la V."""
    p = Part("vs6_turbo")
    for x, r, mat in ((-0.985, 0.078, "pu_aluminio"), (-1.095, 0.082, "pu_acero")):
        p.cyl((x, 0, 0.40), (1, 0, 0), r, 0.06, mat, segs=24)
        ring = [(x, math.cos(a) * (r + 0.018), 0.40 + math.sin(a) * (r + 0.018)) for a in (math.radians(20 + 32 * k) for k in range(11))]
        p.tube(ring, [0.016 + 0.0028 * k for k in range(11)], mat, segs=10, sub=4)        # voluta: crece hacia la salida
        _bolts(p, [(x + 0.032, math.cos(a) * r * 0.82, 0.40 + math.sin(a) * r * 0.82) for a in (math.radians(36 * k) for k in range(10))], (1, 0, 0), r=0.005, h=0.008)
    p.cyl((-1.04, 0, 0.40), (1, 0, 0), 0.042, 0.055, "pu_acero", segs=16)                  # carcasa del eje
    p.cyl((-0.94, 0, 0.42), (1, 0, 0.5), 0.052, 0.05, "pu_aluminio", segs=16, r2=0.045)    # boca del compresor
    p.cyl((-0.70, 0, 0.375), (1, 0, 0), 0.047, 0.44, "pu_aluminio", segs=16)               # motor eléctrico del turbo
    for x in (-0.52, -0.64, -0.76, -0.88):
        p.cyl((x, 0, 0.375), (1, 0, 0), 0.051, 0.012, "pu_magnesio", segs=16)              # aletas
    p.tube([(-0.50, 0.03, 0.39), (-0.44, 0.05, 0.36), (-0.37, 0.07, 0.20)], 0.009, "pu_naranja", segs=6)   # su cable
    p.cyl((-1.06, 0.115, 0.505), (1, 0, 0), 0.03, 0.075, "pu_acero", segs=12)              # válvula de descarga
    p.cyl((-1.01, 0.115, 0.505), (1, 0, 0), 0.036, 0.02, "pu_aluminio", segs=12)
    p.tube([(-1.0, 0.115, 0.505), (-0.96, 0.10, 0.47), (-0.97, 0.07, 0.44)], 0.006, "pu_tornillo", segs=5)   # su varilla
    p.box((-1.045, 0, 0.495), (0.17, 0.15, 0.006), "pu_termico_plata")                     # pantalla térmica
    return p


def _exhaust():
    """Tres colectores por bancada, envueltos, que se juntan en la turbina. El tubo de salida acaba en x = -1,88 m, justo
    donde empieza el escape que ya trae el coche (centro a z = 0,508 m, radio 0,036 m): lo continúa, no lo duplica."""
    p = Part("vs6_escape")
    for s in (1, -1):
        d, e = _bank(s)
        for i, x in enumerate(CYL_X):
            port = Vector((x, 0, CRANK.z)) + d * 0.315 + e * 0.095
            port.y *= MOTOR_YS
            p.tube([port, (x - 0.02, s * 0.282, 0.252), (x - 0.10, s * 0.288, 0.20 + 0.02 * i),
                    (-0.90, s * (0.27 - 0.02 * i), 0.19 + 0.022 * i), (-1.0, s * 0.215, 0.27)], 0.025, "pu_termico_oro", segs=8)
            p.cyl(port, e, 0.034, 0.012, "pu_acero", segs=10)                              # brida en la culata
            _bolts(p, [port + Vector((dx, 0, 0)) for dx in (0.04, -0.04)], e, r=0.006, h=0.016)
        p.tube([(-0.985, s * 0.225, 0.265), (-1.06, s * 0.18, 0.32), (-1.095, s * 0.105, 0.385)], [0.042, 0.042, 0.04], "pu_termico_plata", segs=10)
        p.cyl((-1.02, s * 0.205, 0.29), (-0.8, -s * 0.7, 0.65), 0.046, 0.012, "pu_acero", segs=12)   # abrazadera del colector
    p.tube([(-1.125, 0, 0.40), (-1.30, 0, 0.43), (-1.50, 0, 0.458), (-1.68, 0, 0.476), (-1.80, 0, 0.495), (-1.88, 0, 0.508)],
           [0.05, 0.05, 0.046, 0.04, 0.036, 0.036], "pu_acero", segs=16, caps=False)
    for x, z, r in ((-1.22, 0.415, 0.054), (-1.60, 0.468, 0.047)):
        p.cyl((x, 0, z), (1, 0, 0.15), r, 0.014, "pu_tornillo", segs=16)                   # abrazaderas
    p.tube([(-1.09, 0.115, 0.505), (-1.22, 0.09, 0.50), (-1.34, 0.035, 0.468)], 0.02, "pu_acero", segs=8)   # descarga, se une al escape
    return p


def _hybrid():
    """Motor eléctrico en el lateral del bloque, batería plana delante y los cables naranjas que los unen."""
    p = Part("vs6_hibrido")
    p.cyl((-0.60, 0.225, 0.10), (1, 0, 0), 0.058, 0.24, "pu_aluminio", segs=18)
    for x in (-0.52, -0.56, -0.60, -0.64, -0.68):
        p.cyl((x, 0.225, 0.10), (1, 0, 0), 0.062, 0.01, "pu_magnesio", segs=18)            # aletas
    p.cyl((-0.47, 0.225, 0.10), (1, 0, 0), 0.064, 0.02, "pu_acero", segs=18)
    p.cyl((-0.74, 0.225, 0.10), (1, 0, 0), 0.04, 0.06, "pu_acero", segs=14)
    p.box((-0.08, 0, 0.085), (0.50, 0.44, 0.09), "pu_carbono", bevel=0.012)               # batería
    p.box((-0.08, 0, 0.133), (0.44, 0.38, 0.008), "pu_aluminio")
    for k in range(5):
        p.box((-0.24 + 0.08 * k, 0, 0.139), (0.012, 0.36, 0.008), "pu_magnesio")           # nervios de la tapa
    _bolts(p, [(-0.08 + sx * 0.21, sy * 0.18, 0.14) for sx in (-1, 0, 1) for sy in (-1, 1)], (0, 0, 1), r=0.007)
    p.box((0.10, -0.12, 0.139), (0.07, 0.07, 0.004), "pu_amarillo")                        # placa de aviso de alta tensión
    p.box((-0.335, 0.10, 0.10), (0.05, 0.15, 0.06), "pu_aluminio", bevel=0.006)            # caja de conexiones
    for k in range(3):
        y = 0.065 + 0.035 * k
        p.cyl((-0.365, y, 0.10), (1, 0, 0), 0.013, 0.02, "pu_naranja", segs=8)
        p.tube([(-0.375, y, 0.10), (-0.40, y + 0.06, 0.085), (-0.44, 0.205 + 0.014 * (k - 1), 0.088), (-0.475, 0.212 + 0.016 * (k - 1), 0.10)], 0.009, "pu_naranja", segs=6)
    # Centralita en el otro lateral, con su mazo y sus conectores.
    p.box((-0.60, -0.245, 0.14), (0.22, 0.03, 0.11), "pu_magnesio", bevel=0.006)
    for k in range(4):
        p.box((-0.68 + 0.053 * k, -0.262, 0.14), (0.03, 0.012, 0.06), "pu_goma")
    p.tube([(-0.50, -0.25, 0.19), (-0.42, -0.22, 0.30), (-0.36, -0.12, 0.44)], 0.009, "pu_goma", segs=6)
    return p


def _gearbox():
    """Caja de cambios de carbono que se estrecha hasta empalmar con la estructura trasera del coche (x = -1,88 m), el
    diferencial a la altura de los palieres del coche y los amortiguadores traseros encima. Los palieres, los tirantes y
    la estructura de impacto ya los trae el coche: aquí no se repiten."""
    p = Part("vs6_caja_cambios")
    sections = [(-0.905, 0.34, 0.30, 0.215), (-1.20, 0.28, 0.28, 0.24), (-1.40, 0.22, 0.26, 0.27), (-1.60, 0.18, 0.22, 0.33),
                (-1.75, 0.12, 0.12, 0.40), (-1.86, 0.11, 0.10, 0.413)]

    def ring_at(x, w, h, zc):
        out = []
        for k in range(16):                                                                # sección de esquinas redondeadas
            a = 2 * math.pi * (k + 0.5) / 16
            ca, sa = math.cos(a), math.sin(a)
            out.append(p.bm.verts.new((x, 0.5 * w * math.copysign(abs(ca) ** 0.55, ca), zc + 0.5 * h * math.copysign(abs(sa) ** 0.55, sa))))
        return out

    rings = [ring_at(*s) for s in sections]
    faces = [p.bm.faces.new((a[k], a[(k + 1) % 16], b[(k + 1) % 16], b[k])) for a, b in zip(rings, rings[1:]) for k in range(16)]
    faces += [p.bm.faces.new(list(reversed(rings[0]))), p.bm.faces.new(rings[-1])]
    for f in faces:
        f.material_index, f.smooth = MAT_INDEX["pu_carbono"], len(f.verts) == 4
    p.box((-0.905, 0, 0.215), (0.022, 0.37, 0.33), "pu_aluminio", bevel=0.008)             # brida con el motor
    _bolts(p, [(-0.918, math.cos(a) * 0.165, 0.215 + math.sin(a) * 0.145) for a in (math.radians(30 * k + 15) for k in range(12))], (1, 0, 0), r=0.007, h=0.014)
    for x, w, h, zc in ((-1.05, 0.32, 0.30, 0.226), (-1.40, 0.23, 0.27, 0.27)):           # nervios de la carcasa
        p.box((x, 0, zc), (0.014, w, h), "pu_carbono", bevel=0.004)
    p.box((-1.70, 0, 0.355), (0.07, 0.15, 0.10), "pu_aluminio", bevel=0.012)              # diferencial, a la altura de los palieres
    _bolts(p, [(-1.70 + dx, s * 0.076, 0.355 + dz) for s in (1, -1) for dx in (-0.02, 0.02) for dz in (-0.03, 0.03)], (0, 1, 0), r=0.005)
    p.box((-1.10, -0.11, 0.39), (0.11, 0.06, 0.03), "pu_aluminio", bevel=0.005)            # bloque hidráulico
    for dz in (-0.01, 0, 0.01):
        p.tube([(-1.045, -0.11, 0.39 + dz), (-0.98, -0.12, 0.385 + dz), (-0.935, -0.13, 0.36 + dz)], 0.006, "pu_tornillo", segs=5)
    p.cyl((-1.25, 0.11, 0.385), (1, 0, 0), 0.026, 0.12, "pu_aluminio", segs=12)            # actuador del cambio
    for s in (1, -1):
        a, b = Vector((-1.30, s * 0.115, 0.425)), Vector((-1.50, s * 0.125, 0.42))         # amortiguador con muelle
        p.cyl((a + b) / 2, b - a, 0.014, (b - a).length, "pu_acero", segs=10)
        p.cyl(a.lerp(b, 0.62), b - a, 0.026, 0.09, "pu_amarillo", segs=12)
        p.cyl(a.lerp(b, 0.25), b - a, 0.02, 0.05, "pu_aluminio", segs=10)
        p.cyl(a, (0, 1, 0), 0.013, 0.03, "pu_tornillo", segs=8)
        p.cyl(b + Vector((-0.025, 0, 0)), (0, 0, 1), 0.03, 0.025, "pu_aluminio", segs=12)   # balancín
    return p


def _cooling():
    """Radiador en la parte alta del pontón, inclinado hacia fuera (debajo hay un canal abierto y entre el pontón y la
    tapa motor otro: solo cabe ahí), un radiador pequeño detrás, los manguitos de agua por abajo y el aire del turbo:
    del compresor al radiador por encima de la culata y de vuelta a la caja de admisión."""
    p = Part("vs6_radiadores")
    for s in (1, -1):
        rot = _rx(-s * 46.5)
        r3 = rot.to_3x3()
        c = Vector((-0.09, s * 0.525, 0.46))
        p.box(c, (0.26, 0.035, 0.262), "pu_radiador", rot=rot)
        for dz in (0.118, -0.118):                                                         # depósitos arriba y abajo
            p.box(c + r3 @ Vector((0, 0, dz)), (0.27, 0.045, 0.026), "pu_aluminio", rot=rot, bevel=0.006)
        for k in range(8):                                                                 # tubos del panal, por las dos caras
            for side in (0.019, -0.019):
                p.box(c + r3 @ Vector((0, side, -0.09 + 0.026 * k)), (0.25, 0.003, 0.005), "pu_aluminio", rot=rot)
        for dx in (-0.135, 0.135):                                                         # marco
            p.box(c + r3 @ Vector((dx, 0, 0)), (0.012, 0.045, 0.265), "pu_aluminio", rot=rot)
        # Segundo radiador (aceite y electrónica del híbrido) a lo largo de la parte trasera del pontón, que se estrecha y
        # baja hacia la rueda: sigue esa forma, de delante (x = -0,33) a atrás (x = -0,86).
        front, rear = (-0.33, s * 0.588, 0.345, 0.50), (-0.86, s * 0.515, 0.255, 0.35)
        _slab(p, front, rear, 0.026, "pu_goma")
        for x0, y0, za, zb in (front, rear):
            _slab(p, (x0 + 0.01, y0, za - 0.01, zb + 0.01), (x0 - 0.01, y0, za - 0.01, zb + 0.01), 0.034, "pu_aluminio")
        for k in range(1, 6):                                                              # nervios del panal
            t_ = k / 6
            x_, y_ = front[0] + (rear[0] - front[0]) * t_, front[1] + (rear[1] - front[1]) * t_
            za, zb = front[2] + (rear[2] - front[2]) * t_, front[3] + (rear[3] - front[3]) * t_
            _slab(p, (x_ + 0.004, y_, za, zb), (x_ - 0.004, y_, za, zb), 0.03, "pu_aluminio")
        p.tube([(-0.36, s * 0.578, 0.35), (-0.42, s * 0.47, 0.22), (-0.50, s * 0.31, 0.19), (-0.53, s * 0.255, 0.215)], 0.016, "pu_goma", segs=8)
        p.cyl((-0.42, s * 0.47, 0.22), (1, -s * 1.5, -1.0), 0.02, 0.03, "pu_azul", segs=10)
        # Estructuras de impacto lateral: dos largueros de carbono del chasis al costado del pontón.
        p.tube([(0.05, s * 0.17, 0.47), (0.05, s * 0.40, 0.475), (0.05, s * 0.62, 0.47)], 0.022, "pu_carbono", segs=10, sub=2)
        p.tube([(0.0, s * 0.17, 0.33), (0.0, s * 0.33, 0.33), (0.0, s * 0.47, 0.33)], 0.02, "pu_carbono", segs=10, sub=2)
        p.cyl((0.05, s * 0.635, 0.47), (0, 1, 0), 0.03, 0.03, "pu_aluminio", segs=12)
        # Caja de la electrónica de control, abajo, sobre el suelo.
        p.box((-0.22, s * 0.43, 0.185), (0.30, 0.12, 0.055), "pu_magnesio", bevel=0.008)
        for k in range(4):
            p.box((-0.33 + 0.07 * k, s * 0.43, 0.215), (0.012, 0.11, 0.006), "pu_aluminio")
        for k in range(3):
            p.box((-0.075, s * (0.39 + 0.03 * k), 0.19), (0.012, 0.018, 0.03), "pu_goma")   # conectores
        p.tube([(-0.068, s * 0.42, 0.20), (-0.02, s * 0.36, 0.24), (0.02, s * 0.25, 0.30)], 0.008, "pu_goma", segs=6)
        low_rear, low_front, low_air = (c + r3 @ Vector((v, 0, -0.12)) for v in (-0.12, 0.11, -0.04))
        p.tube([low_rear, (-0.26, s * 0.40, 0.25), (-0.32, s * 0.30, 0.20), (-0.345, s * 0.20, 0.205)], 0.019, "pu_goma", segs=8)
        p.tube([low_front, (-0.10, s * 0.33, 0.27), (-0.28, s * 0.26, 0.17), (-0.345, s * 0.20, 0.135)], 0.019, "pu_goma", segs=8)
        for q in ((-0.26, s * 0.40, 0.25), (-0.10, s * 0.33, 0.27)):
            p.cyl(q, (1, 0, 0), 0.023, 0.035, "pu_azul", segs=10)
        # Aire del compresor: por encima de la culata, baja delante del motor y entra al radiador por su borde de abajo
        # (entre el pontón y la tapa motor hay un canal abierto: el tubo no puede cruzarlo por arriba).
        p.tube([(-0.955, s * 0.075, 0.43), (-0.94, s * 0.15, 0.475), (-0.86, s * 0.215, 0.555), (-0.62, s * 0.222, 0.562),
                (-0.40, s * 0.22, 0.55), (-0.38, s * 0.27, 0.44), (-0.30, s * 0.31, 0.34), (-0.17, s * 0.38, 0.32), low_air], 0.025, "pu_carbono", segs=10)
        p.cyl((-0.62, s * 0.222, 0.562), (1, 0, 0), 0.03, 0.03, "pu_azul", segs=10)
    return p


def _brakes():
    """En cada rueda: disco de carbono, campana con sus tornillos, pinza de dos mitades, mangueta y plato de carbono."""
    p = Part("vs6_frenos")
    for x in (FRONT_X, REAR_X):
        for s in (1, -1):
            y = s * (0.64 if x > 0 else 0.60)
            r = 0.165 if x > 0 else 0.14
            p.cyl((x, y, AXLE_Z), (0, 1, 0), r, 0.032, "pu_disco", segs=32)
            p.cyl((x, y, AXLE_Z), (0, 1, 0), r - 0.012, 0.034, "pu_goma", segs=32)          # canto ventilado, más oscuro
            p.cyl((x, y, AXLE_Z), (0, 1, 0), r * 0.62, 0.036, "pu_disco", segs=24)
            p.cyl((x, y + s * 0.022, AXLE_Z), (0, 1, 0), 0.072, 0.05, "pu_aluminio", segs=18)   # campana
            _bolts(p, [(x + math.cos(a) * 0.058, y + s * 0.048, AXLE_Z + math.sin(a) * 0.058) for a in (math.radians(36 * k) for k in range(10))], (0, 1, 0), r=0.006, h=0.01)
            p.cyl((x, y + s * 0.06, AXLE_Z), (0, 1, 0), 0.035, 0.05, "pu_acero", segs=12)        # buje
            p.cyl((x, y + s * 0.09, AXLE_Z), (0, 1, 0), 0.022, 0.03, "pu_tornillo", segs=6, smooth=False)   # tuerca
            p.cyl((x, y - s * 0.03, AXLE_Z), (0, 1, 0), r + 0.02, 0.006, "pu_carbono", segs=32)   # plato de carbono, por dentro
            p.box((x, y - s * 0.06, AXLE_Z), (0.09, 0.05, 0.22), "pu_aluminio", bevel=0.012)      # mangueta
            a0 = 180 if x > 0 else 0                                                         # pinza: delante del eje atrás, detrás delante
            for k in range(-3, 4):
                a = math.radians(a0 + 11 * k)
                rot = Matrix.Rotation(-a, 4, "Y")
                for side in (0.03, -0.03):
                    p.box(Vector((x + math.cos(a) * (r - 0.035), y + side, AXLE_Z + math.sin(a) * (r - 0.035))), (0.06, 0.026, 0.032), "pu_pinza", rot=rot)
                if k in (-3, 0, 3):
                    p.box(Vector((x + math.cos(a) * (r + 0.008), y, AXLE_Z + math.sin(a) * (r + 0.008))), (0.016, 0.086, 0.03), "pu_pinza", rot=rot)   # puente
            _bolts(p, [(x + math.cos(math.radians(a0 + 11 * k)) * (r - 0.035), y + s * 0.045, AXLE_Z + math.sin(math.radians(a0 + 11 * k)) * (r - 0.035)) for k in (-2, 0, 2)], (0, 1, 0), r=0.009, h=0.008)
    return p


def _pedals():
    """Lo que se ve dentro del chasis al quitar el morro: los dos pedales (freno y acelerador), sus bombas y el reposapiés."""
    p = Part("vs6_pedales")
    p.box((1.97, 0, 0.242), (0.28, 0.27, 0.008), "pu_carbono")                              # suelo de la pedalera
    p.box((1.87, 0, 0.258), (0.05, 0.25, 0.026), "pu_carbono", bevel=0.006)                  # reposatalones
    for y, w, mat in ((0.065, 0.085, "pu_aluminio"), (-0.075, 0.06, "pu_aluminio")):       # freno (ancho) y acelerador
        pivot, top = Vector((2.04, y, 0.245)), Vector((1.99, y, 0.425))
        p.cyl(pivot, (0, 1, 0), 0.012, w + 0.02, "pu_acero", segs=10)                       # eje
        p.box((pivot + top) / 2, (0.014, w * 0.45, (top - pivot).length), mat, rot=Matrix.Rotation(math.atan2(top.x - pivot.x, top.z - pivot.z), 4, "Y"))
        pad = top + Vector((0.006, 0, -0.035))
        rot = Matrix.Rotation(math.atan2(top.x - pivot.x, top.z - pivot.z), 4, "Y")
        p.box(pad, (0.008, w, 0.09), "pu_aluminio", rot=rot)                                # pisante
        for k in range(4):
            p.box(pad + Vector((-0.005, 0, -0.027 + 0.018 * k)), (0.004, w * 0.9, 0.004), "pu_tornillo", rot=rot)   # estrías
        p.box(top + Vector((0.0, (w / 2 + 0.006) * (1 if y > 0 else -1), -0.03)), (0.03, 0.006, 0.075), "pu_carbono", rot=rot)   # tope lateral
    for y in (0.035, 0.095):                                                               # dos bombas de freno con su depósito
        p.cyl((2.085, y, 0.275), (1, 0, 0), 0.015, 0.085, "pu_aluminio", segs=12)
        p.cyl((2.035, y, 0.275), (1, 0, 0), 0.006, 0.03, "pu_tornillo", segs=6)
        p.cyl((2.105, y + 0.045, 0.30), (0, 0, 1), 0.013, 0.03, "pu_goma", segs=10)
        p.cyl((2.105, y + 0.045, 0.318), (0, 0, 1), 0.015, 0.007, "pu_amarillo", segs=10)
    p.box((2.085, 0.065, 0.252), (0.07, 0.10, 0.012), "pu_aluminio", bevel=0.003)           # soporte de las bombas
    p.cyl((2.06, -0.075, 0.30), (1, 0, 0.25), 0.011, 0.09, "pu_acero", segs=8)              # muelle del acelerador
    p.cyl((2.06, -0.075, 0.30), (1, 0, 0.25), 0.017, 0.05, "pu_amarillo", segs=10)
    p.box((2.125, 0, 0.235), (0.012, 0.31, 0.012), "pu_aluminio")
    return p


def _drs_actuator():
    """Cápsula del actuador del DRS, en el centro del alerón trasero, sobre el plano principal."""
    p = Part("vs6_drs_actuador")
    p.tube([(-1.90, 0, 0.812), (-1.96, 0, 0.822), (-2.05, 0, 0.828), (-2.12, 0, 0.822)], [0.008, 0.024, 0.026, 0.012], "pu_carbono", segs=12)
    for x, z in ((-1.94, 0.795), (-2.05, 0.785)):
        p.box((x, 0, z), (0.035, 0.008, 0.06), "pu_carbono")                               # soportes al plano
    return p


def build_power_unit():
    """Crea (o rehace) todas las piezas de dentro del coche. Devuelve {pieza: triángulos}."""
    mats = _materials()
    out = {}
    for make in (_engine, _intake, _turbo, _exhaust, _hybrid, _gearbox, _cooling, _pedals, _drs_actuator):   # los frenos ya los trae el coche en cada rueda: _brakes() no se usa
        part = make()
        ob = part.build(mats)
        if ob.name in ("vs6_motor", "vs6_admision"):
            ob.data.transform(Matrix.Diagonal((1.0, MOTOR_YS, 1.0, 1.0)))
            ob.data.update()
        out[ob.name] = sum(len(f.vertices) - 2 for f in ob.data.polygons)
    return out


SHELL_PARTS = ["chasis", "pontones", "carroceria_baja", "tapa_motor", "suelo", "ala_delantera", "ala_trasera"]


def build_floor_top(lift=0.004):
    """Cara de arriba del suelo, en carbono: copia exacta de la lámina del suelo del coche (la que se ve desde abajo),
    subida unos milímetros y vuelta del revés. Solo se copian las caras que quedan dentro de la carrocería, así que el
    coche cerrado se ve igual; al quitar la tapa motor, el suelo se ve de carbono por arriba, como en uno real."""
    from mathutils.bvhtree import BVHTree
    bm = bmesh.new()
    for n in SHELL_PARTS:
        bm.from_mesh(bpy.data.objects["vs6_" + n].data)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    dirs = []
    for elev in (-60, -30, -8, 12, 32, 52, 72, 90):
        for az in range(0, 360, 30):
            e, a = math.radians(elev), math.radians(az)
            d = Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
            if abs(d.x) < 0.72:
                dirs.append(d)

    def hidden(p):
        leaks = 0
        for d in dirs:
            if tree.ray_cast(p + d * 0.004, d, 6.0)[0] is None:
                leaks += 1
                if leaks >= 3:
                    return False
        return True

    src = bpy.data.objects["vs6_suelo"].data
    top = bmesh.new()
    top.from_mesh(src)
    top.faces.ensure_lookup_table()
    drop = [f for f in top.faces if f.normal.z > -0.2 or not hidden(f.calc_center_median() + Vector((0, 0, lift + 0.003)))]
    bmesh.ops.delete(top, geom=drop, context="FACES")
    bmesh.ops.delete(top, geom=[v for v in top.verts if not v.link_faces], context="VERTS")
    bmesh.ops.translate(top, vec=(0, 0, lift), verts=top.verts[:])
    bmesh.ops.reverse_faces(top, faces=top.faces[:])
    for f in top.faces:
        f.material_index = MAT_INDEX["pu_carbono"]
    old = bpy.data.objects.get("vs6_suelo_placa")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new("vs6_suelo_placa")
    top.to_mesh(me)
    top.free()
    for m in _materials():
        me.materials.append(m)
    ob = bpy.data.objects.new("vs6_suelo_placa", me)
    bpy.data.collections[COLLECTION].objects.link(ob)
    return len(me.polygons)
