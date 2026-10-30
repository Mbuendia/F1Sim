# Rehace la grada común (la blanca de celosía de Shanghái, 7 iguales en el circuito) desde el modelo original:
# recorte, limpieza de lo que es de la grada vecina y giro para que los asientos miren a +Y. Se ejecuta con exec()
# dentro de Blender con el circuito cargado y kitlib.py de esta carpeta.
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix
exec(open(r'C:\Users\Usuario\Documents\antigravity\brave-mendeleev\scratch\ck2\kitlib.py', encoding='utf8').read())

def loose(bm):
    bm.faces.ensure_lookup_table(); seen = set(); out = []
    for f in bm.faces:
        if f.index in seen: continue
        st = [f]; seen.add(f.index); fs = []
        while st:
            g = st.pop(); fs.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen: seen.add(h.index); st.append(h)
        vs = [v.co for v in {v for x in fs for v in x.verts}]
        lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
        hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        out.append((fs, lo, hi))
    return out

def drop(bm, faces):
    bmesh.ops.delete(bm, geom=list(faces), context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')

p = rep_part('Object_122')
bm, mats = crop(p[1], (30, 30), only={'Object_122', 'Object_123', 'Object_22', 'Object_115'})
parts = loose(bm)
seats = max(parts, key=lambda q: (q[2] - q[1]).x * (q[2] - q[1]).y)
sl, sh = seats[1], seats[2]
kill = []
for fs, a, b in parts:
    touches = a.x <= sh.x + 2 and b.x >= sl.x - 2 and a.y <= sh.y + 2 and b.y >= sl.y - 2
    d = b - a
    mast = d.x < 4 and d.y < 4 and d.z > 6                      # mástil de la grada vecina
    outside = b.x < sl.x - 0.5 or a.x > sh.x + 0.5 or b.y < sl.y - 0.5 or a.y > sh.y + 0.5
    if not touches or mast or (outside and min(d.x, d.y) < 1.0 and d.z < 6): kill += fs
drop(bm, set(kill))
ob, info = finish(bm, mats, 'grada_comun', rot=0.0)
# Asientos mirando a +Y: la subida de la pieza más ancha (los asientos) hacia -Y.
me = ob.data; b2 = bmesh.new(); b2.from_mesh(me)
seats = max(loose(b2), key=lambda q: (q[2] - q[1]).x * (q[2] - q[1]).y)
vs = list({v.co.copy().freeze() for f in seats[0] for v in f.verts}); b2.free()
g = np.linalg.lstsq(np.array([[v.x, v.y, 1] for v in vs]), np.array([v.z for v in vs]), rcond=None)[0]
me.transform(Matrix.Rotation(-math.pi / 2 - math.atan2(g[1], g[0]), 4, 'Z'))
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
me.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs)))); me.update()
ob.hide_viewport = True; ob.hide_render = True
result = {'tris': sum(len(q.vertices) - 2 for q in me.polygons), 'dims': [round(x, 1) for x in ob.dimensions]}
