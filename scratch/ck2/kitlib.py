# Utilidades para trocear el circuito de Shanghái (se ejecuta con exec dentro de Blender).
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

ROOT = r'C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario-Documents-antigravity-brave-mendeleev\f474c708-6eb0-40dd-bce8-215b3a2452e4\scratchpad\shanghai'
GROUND = {'Object_29', 'Object_30', 'Object_31', 'Object_34', 'Object_39', 'Object_101', 'Object_103', 'Object_85',
          'Object_28', 'Object_32', 'Object_33', 'Object_35', 'Object_36', 'Object_105', 'Object_106', 'Object_121',
          'Object_89', 'Object_88', 'Object_40', 'Object_45', 'Object_102', 'Object_104', 'Object_83', 'Object_84',
          'Object_87', 'Object_41', 'Object_47', 'Object_124', 'Object_46', 'Object_38'}

_cache = {}

def world_bm(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.005)
    bm.faces.ensure_lookup_table()
    return bm

def parts_of(name):
    """Piezas sueltas de un objeto: lista de (caras, centro, dims)."""
    if name in _cache: return _cache[name]
    o = bpy.data.objects[name]; bm = world_bm(o)
    seen = set(); res = []
    for f in bm.faces:
        if f.index in seen: continue
        st = [f]; seen.add(f.index); fs = []
        while st:
            g = st.pop(); fs.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen: seen.add(h.index); st.append(h)
        vs = [v.co for v in {v for g in fs for v in g.verts}]
        lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
        hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        res.append((len(fs), (lo + hi) / 2, hi - lo, lo, hi))
    bm.free(); _cache[name] = res
    return res

def rep_part(name, i=0):
    ps = parts_of(name); sig = {}
    for p in ps:
        if p[0] >= 6: sig.setdefault(p[0], []).append(p)
    group = max(sig.values(), key=len)
    return group[i % len(group)]

def big_part(name):
    return max(parts_of(name), key=lambda p: p[0])

def crop(center, half, rot=0.0, skip_ground=True, only=None, zmin=-1e9, zmax=1e9):
    """Junta las caras de todos los objetos cuyo centro cae en la caja (en planta, girada rot) alrededor de center."""
    out = bmesh.new(); mats = []
    uv_out = out.loops.layers.uv.new('UVMap')
    R = Matrix.Rotation(-rot, 4, 'Z')
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.name.startswith('Object_'): continue
        if only and o.name not in only: continue
        if skip_ground and o.name in GROUND: continue
        me = o.data; mw = o.matrix_world
        uv = me.uv_layers.active
        idx = []
        for p in me.polygons:
            c = mw @ p.center; d = R @ (c - center)
            if abs(d.x) <= half[0] and abs(d.y) <= half[1] and zmin <= c.z - center.z <= zmax:
                idx.append(p)
        if not idx: continue
        mat = o.material_slots[0].material if o.material_slots else None
        if mat not in mats: mats.append(mat)
        mi = mats.index(mat)
        for p in idx:
            vs = [out.verts.new(mw @ me.vertices[v].co) for v in p.vertices]
            try: f = out.faces.new(vs)
            except ValueError: continue
            f.material_index = mi
            if uv:
                for l, li in zip(f.loops, p.loop_indices): l[uv_out].uv = uv.data[li].uv
    bmesh.ops.remove_doubles(out, verts=out.verts, dist=0.005)
    return out, mats

def finish(bm, mats, name, align=True, rot=None, col='KIT'):
    pts = [v.co for v in bm.verts]; n = len(pts)
    cx = sum(p.x for p in pts) / n; cy = sum(p.y for p in pts) / n
    if rot is None and align:
        sxx = sum((p.x - cx) ** 2 for p in pts); syy = sum((p.y - cy) ** 2 for p in pts); sxy = sum((p.x - cx) * (p.y - cy) for p in pts)
        rot = 0.5 * math.atan2(2 * sxy, sxx - syy)
    bm.transform(Matrix.Rotation(-(rot or 0.0), 4, 'Z') @ Matrix.Translation((-cx, -cy, 0)))
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    bm.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs))))
    old = bpy.data.objects.get('kit_' + name)
    if old: bpy.data.objects.remove(old)
    me = bpy.data.meshes.new('kit_' + name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new('kit_' + name, me)
    c = bpy.data.collections.get(col) or bpy.data.collections.new(col)
    if c.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(c)
    c.objects.link(ob); me.update()
    d = ob.dimensions
    return ob, {'tris': sum(len(p.vertices) - 2 for p in me.polygons), 'dims': [round(d.x, 2), round(d.y, 2), round(d.z, 2)]}

def render(ob, path, size=(400, 300), view=(1.0, -1.6, 0.8), dist=1.25):
    sc = bpy.data.scenes['PREVIEW']; cam = bpy.data.objects['PrevCam']
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.collection.objects.link(ob)
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    c = (lo + hi) / 2; r = max((hi - lo).length, 0.5)
    cam.location = c + Vector(view).normalized() * r * dist
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_start = r * 0.01; cam.data.clip_end = r * 10
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)
    sc.collection.objects.unlink(ob)
