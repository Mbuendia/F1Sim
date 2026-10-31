# Maqueta de CK2: un circuito del juego con las piezas comunes del kit colocadas según las reglas del análisis de
# Shanghái (docs/design/analisis-shanghai-circuito.md). Se ejecuta con exec() dentro de Blender; build(id) monta y
# renderiza. Coordenadas del juego (x, y) -> Blender (x, -y), metros. Mónaco queda aparte (circuito especial).
import bpy, bmesh, json, math, os, random
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

BASE = r'C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario-Documents-antigravity-brave-mendeleev\f474c708-6eb0-40dd-bce8-215b3a2452e4\scratchpad\ck2'
TEX = os.path.join(BASE, 'texturas')
SKIP = {'monaco'}
STEP = 4.0                      # remuestreo del eje (m)
RUNOFF = {                      # reglas del análisis: (asfalto, grava, antes de la curva, después)
    'fuerte': (30.0, 30.0, 110.0, 60.0),
    'media': (8.0, 12.0, 70.0, 50.0),
    'rapida': (0.0, 13.0, 50.0, 40.0),
}
STREET_ESCAPE = 14.0            # urbanos: vía de escape de asfalto en las frenadas fuertes, si hay sitio
VERGE = {'permanent': 10.0, 'hybrid': 6.0, 'street': 3.4}
TILE = {'kit_guardarrail': 8.0, 'kit_muro_neumaticos': 11.58, 'kit_valla_alta': 7.22, 'kit_valla_publi': 10.0, 'kit_bloque_hormigon': 2.02}
GRADA_DEPTH = 44.0

def braking(kmh):
    if kmh is None: return 'media'
    if kmh < 120: return 'fuerte'
    if kmh < 200: return 'media'
    if kmh < 270: return 'rapida'
    return None

# ---------------------------------------------------------------- materiales y variantes de parodia
def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.get('mq_' + name)
    if m: return m
    m = bpy.data.materials.new('mq_' + name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs.inputs['Base Color'].default_value = (*rgb, 1); bs.inputs['Roughness'].default_value = rough
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    return m

def mat_img(name, path):
    m = bpy.data.materials.get('mqi_' + name)
    if m: return m
    m = bpy.data.materials.new('mqi_' + name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); out = nt.nodes.new('ShaderNodeOutputMaterial'); tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(path, check_existing=True); bs.inputs['Roughness'].default_value = 0.6
    nt.links.new(tx.outputs['Color'], bs.inputs['Base Color']); nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    return m

def hexrgb(h):
    h = h.lstrip('#'); return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))

M = {}
def materials():
    M.update(asfalto=mat('asfalto', hexrgb('2a2c30'), 0.8), escap=mat('escapatoria', hexrgb('3b404b'), 0.85),
             grava=mat('grava', hexrgb('c2ad83')), hierba=mat('hierba', hexrgb('4d7536')), rojo=mat('piano_rojo', hexrgb('c8242b')),
             blanco=mat('piano_blanco', hexrgb('eeeeee')), hormigon=mat('hormigon', hexrgb('a3a29c')), agua=mat('agua', hexrgb('2c6a88'), 0.2),
             ciudad=mat('ciudad', hexrgb('8d8a84')), boxes=mat('boxes', hexrgb('d8dadc'), 0.6), linea=mat('linea', hexrgb('f2f2f2')),
             poste=mat('poste', hexrgb('6b6e72'), 0.5))

def remap(me, axes):
    """Coordenadas de textura por la caja del objeto (axes: ejes u, v) para que la imagen nueva cubra la cara entera."""
    uv = me.uv_layers.active or me.uv_layers.new()
    lo = [min(v.co[a] for v in me.vertices) for a in range(3)]; hi = [max(v.co[a] for v in me.vertices) for a in range(3)]
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co[axes[0]] - lo[axes[0]]) / ((hi[axes[0]] - lo[axes[0]]) or 1), (co[axes[1]] - lo[axes[1]]) / ((hi[axes[1]] - lo[axes[1]]) or 1))

SPONSORS = []
def variants(cid):
    """Piezas con texturas de parodia: vallas y pancartas por patrocinador, carteles de metros y la torre del circuito."""
    if not SPONSORS: SPONSORS.extend(json.load(open(os.path.join(TEX, 'patrocinadores.json'))))
    for s in SPONSORS:
        for kit, axes, pre in (('kit_valla_publi', (0, 2), 'valla'), ('kit_pancarta', (0, 1), 'pancarta')):
            name = '%s__%s' % (kit, s)
            if name in bpy.data.objects: continue
            me = bpy.data.objects[kit].data.copy(); me.name = name; remap(me, axes)
            me.materials.clear(); me.materials.append(mat_img(pre + '_' + s, os.path.join(TEX, '%s_%s.png' % (pre, s))))
            bpy.data.objects.new(name, me)
        for m in (200, 150, 100, 50):
            name = 'kit_metros_%d__%s' % (m, s)
            if name in bpy.data.objects: continue
            # Cartel de metros: tablero de 1 × 1,4 m sobre dos postes (pieza nueva del kit, cartel_metros).
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0, 0, 1.45)) @ Matrix.Diagonal((1.0, 0.1, 1.4, 1)))
            me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); remap(me, (0, 2))
            me.materials.append(mat_img('metros_%d_%s' % (m, s), os.path.join(TEX, 'metros_%d_%s.png' % (m, s))))
            postes = bpy.data.meshes.new(name + '_postes'); pb = bmesh.new()
            for x in (-0.35, 0.35): bmesh.ops.create_cube(pb, size=1.0, matrix=Matrix.Translation((x, 0, 0.38)) @ Matrix.Diagonal((0.08, 0.08, 0.76, 1)))
            pb.to_mesh(postes); pb.free()
            bm2 = bmesh.new(); bm2.from_mesh(me); bm2.from_mesh(postes)
            for f in list(bm2.faces)[6:]: f.material_index = 1
            bm2.to_mesh(me); bm2.free(); bpy.data.meshes.remove(postes); me.materials.append(M['poste'])
            bpy.data.objects.new(name, me)
    name = 'kit_torre_posiciones__' + cid
    if name not in bpy.data.objects and os.path.exists(os.path.join(TEX, 'torre_%s.png' % cid)):
        me = bpy.data.objects['kit_torre_posiciones'].data.copy(); me.name = name
        src = me.materials[0]; m2 = src.copy(); m2.name = 'mqi_torre_' + cid
        for nd in m2.node_tree.nodes:
            if nd.type == 'TEX_IMAGE': nd.image = bpy.data.images.load(os.path.join(TEX, 'torre_%s.png' % cid), check_existing=True)
        me.materials[0] = m2; bpy.data.objects.new(name, me)
    return name if name in bpy.data.objects else 'kit_torre_posiciones'

# ---------------------------------------------------------------- utilidades
def scene():
    sc = bpy.data.scenes.get('MAQUETA')
    if sc is None: sc = bpy.data.scenes.new('MAQUETA')
    for o in list(sc.collection.objects):
        if o.name.startswith('mq_cam') or o.name.startswith('mq_sol'): sc.collection.objects.unlink(o); continue
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(sc.collection.children): sc.collection.children.unlink(c)
    for me in [m for m in bpy.data.meshes if m.name.startswith('mq_') and m.users == 0]: bpy.data.meshes.remove(me)
    return sc

def mesh_obj(sc, name, verts, faces, mats, mat_idx=None):
    me = bpy.data.meshes.new('mq_' + name); me.from_pydata(verts, [], faces)
    for m in mats: me.materials.append(m)
    if mat_idx:
        for p, i in zip(me.polygons, mat_idx): p.material_index = i
    me.update(); ob = bpy.data.objects.new('mq_' + name, me); sc.collection.objects.link(ob); return ob

def instance(sc, kit, x, y, rot, z=0.0, scale=1.0):
    src = bpy.data.objects[kit]
    ob = bpy.data.objects.new(kit + '_i', src.data); ob.location = (x, y, z); ob.rotation_euler = (0, 0, rot)
    if scale != 1.0: ob.scale = (scale, scale, scale)
    sc.collection.objects.link(ob); return ob

def resample(pts, step):
    P = [Vector((x, -y)) for x, y in pts]
    if (P[0] - P[-1]).length < 1e-3: P = P[:-1]
    seg = [(P[i], P[(i + 1) % len(P)]) for i in range(len(P))]
    total = sum((b - a).length for a, b in seg)
    n = max(16, int(total / step)); out = []; i = 0; acc = 0.0
    for k in range(n):
        target = k * total / n
        while acc + (seg[i][1] - seg[i][0]).length < target: acc += (seg[i][1] - seg[i][0]).length; i = (i + 1) % len(seg)
        a, b = seg[i]; L = (b - a).length or 1
        out.append(a + (b - a) * ((target - acc) / L))
    return out, total

def polyfill(sc, name, pts, m, z):
    if len(pts) < 3: return
    bm = bmesh.new(); vs = [bm.verts.new((x, -y, z)) for x, y in pts]
    try: f = bm.faces.new(vs)
    except ValueError: bm.free(); return
    bmesh.ops.triangulate(bm, faces=[f])
    me = bpy.data.meshes.new('mq_' + name); bm.to_mesh(me); bm.free(); me.materials.append(m)
    ob = bpy.data.objects.new('mq_' + name, me); sc.collection.objects.link(ob)

def box(sc, name, cx, cy, rot, L, W, z0, z1, m):
    c, s = math.cos(rot), math.sin(rot)
    corners = [(-L / 2, -W / 2), (L / 2, -W / 2), (L / 2, W / 2), (-L / 2, W / 2)]
    v = [(cx + u * c - w * s, cy + u * s + w * c, z) for z in (z0, z1) for u, w in corners]
    f = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return mesh_obj(sc, name, v, f, [m])

def inside(p, poly):
    c = False; m = len(poly)
    for a in range(m):
        b = (a + 1) % m; pa, pb_ = poly[a], poly[b]
        if (pa.y > p.y) != (pb_.y > p.y) and p.x < (pb_.x - pa.x) * (p.y - pa.y) / ((pb_.y - pa.y) or 1e-9) + pa.x: c = not c
    return c

SCN = {}
def scenery_model(model, tint):
    """Modelo del escenario del juego, unido en una sola malla con sus transformaciones aplicadas; con su tinte."""
    key = (model, tint)
    if key in SCN: return SCN[key]
    path = os.path.join(r'C:\Users\Usuario\Documents\antigravity\brave-mendeleev\public\models\scenery', model + '.glb')
    if not os.path.exists(path): SCN[key] = None; return None
    base = SCN.get((model, None))
    if base is None:
        before = set(bpy.data.objects.keys())
        try: bpy.ops.import_scene.gltf(filepath=path)
        except Exception: SCN[key] = None; return None
        new = [bpy.data.objects[n] for n in set(bpy.data.objects.keys()) - before]
        bm = bmesh.new(); mats = []
        for o in new:
            if o.type != 'MESH': continue
            tmp = o.data.copy(); tmp.transform(o.matrix_world)
            off = len(mats); mats += list(tmp.materials)
            b2 = bmesh.new(); b2.from_mesh(tmp)
            for f in b2.faces: f.material_index += off
            me_t = bpy.data.meshes.new('t'); b2.to_mesh(me_t); b2.free(); bm.from_mesh(me_t); bpy.data.meshes.remove(me_t); bpy.data.meshes.remove(tmp)
        for o in new: bpy.data.objects.remove(o, do_unlink=True)
        me = bpy.data.meshes.new('scn_' + model); bm.to_mesh(me); bm.free()
        for m in mats: me.materials.append(m)
        xs = [v.co.x for v in me.vertices] or [0, 1]; ys = [v.co.y for v in me.vertices] or [0, 1]; zs = [v.co.z for v in me.vertices] or [0, 1]
        base = {'mesh': me, 'size': (max(xs) - min(xs) or 1, max(ys) - min(ys) or 1, max(zs) - min(zs) or 1)}
        SCN[(model, None)] = base
    if tint is None: SCN[key] = base; return base
    me = base['mesh'].copy(); me.name = 'scn_%s_%s' % (model, tint)
    for i, m in enumerate(me.materials):
        if m and m.name.split('.')[0] == 'tint':
            m2 = m.copy(); m2.name = 'tint_' + tint
            bs = next((nd for nd in m2.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None) if m2.node_tree else None
            if bs: bs.inputs['Base Color'].default_value = (*hexrgb(tint), 1)
            me.materials[i] = m2
    SCN[key] = {'mesh': me, 'size': base['size']}
    return SCN[key]

STADIUMS = {'foro-sol'}
PIT_PTS = []
def sweep(sc, name, run, C, N, side, base_of, prof, mats):
    """Barre un perfil (d, z, material) a lo largo de un tramo del eje, a la distancia base_of(i) por el lado side."""
    verts = []; faces = []; fm = []
    for i in run:
        b = base_of(i)
        for d, z, _ in prof:
            q = C[i] + N[i] * side * (b + d); verts.append((q.x, q.y, z))
    m = len(prof)
    for k in range(len(run) - 1):
        for j in range(m - 1):
            a0, a1, b0, b1 = k * m + j, k * m + j + 1, (k + 1) * m + j, (k + 1) * m + j + 1
            faces.append((a0, b0, b1, a1) if side > 0 else (a0, a1, b1, b0)); fm.append(prof[j + 1][2])
    me = bpy.data.meshes.new('mq_' + name); me.from_pydata(verts, [], faces)
    for mm in mats: me.materials.append(mm)
    for poly, mi in zip(me.polygons, fm): poly.material_index = mi
    me.update(); ob = bpy.data.objects.new('mq_' + name, me); sc.collection.objects.link(ob)

def stadium(sc, it, C, N, T, n, half, verge, walls, maxoff, asph, grav, out, zone):
    """Estadio de Hermanos Rodríguez según las fotos de referencia: por fuera de la curva, la grada grande de dos pisos con
    cubierta oscura en voladizo; por dentro, palcos de dos pisos y terrazas con sombrillas; a la entrada, el pórtico con el
    cartel. Todo detrás del muro de cada tramo y sin acercarse a otro tramo. Devuelve su huella."""
    conc = mat('hormigon_estadio', hexrgb('c9c6bd'), 0.8); sa = mat('asiento_a', hexrgb('9aa3ad'), 0.6)
    sb = mat('asiento_b', hexrgb('d2782f'), 0.6); roof = mat('cubierta_oscura', hexrgb('3a3d42'), 0.5)
    white = mat('palco_blanco', hexrgb('f1f1ee'), 0.5); green = mat('palco_verde', hexrgb('1f8a4c'), 0.5)
    glass = mat('palco_cristal', hexrgb('2b3440'), 0.2); umb = mat('sombrilla', hexrgb('fafafa'), 0.6)
    foot = []
    def base_of(side):
        return lambda i: max(walls[side][i] if walls[side][i] is not None else half + verge, half + asph[side][i] + grav[side][i]) + 3.0
    def runs_of(side, need):
        rr = []; cur = []
        for i in range(n + 1):
            ii = i % n
            ok = zone[ii] and maxoff[side][ii] - base_of(side)(ii) >= need
            if ok: cur.append(ii)
            else:
                if len(cur) > 4: rr.append(cur)
                cur = []
        if len(cur) > 4: rr.append(cur)
        return rr
    # Por fuera: dos pisos de 18 y 16 filas con pasillo entre medias y cubierta en voladizo sobre el piso de arriba.
    DD, DH = 0.85, 0.5
    prof = [(0, 0, 0), (0, 1.3, 0)]; z = 1.3
    for r in range(18): z += DH; prof += [(r * DD, z, 0), ((r + 1) * DD, z, 1 + (r // 3) % 2)]
    d = 18 * DD; prof += [(d, z, 0), (d + 3, z, 0), (d + 3, z + 2.5, 0)]; z += 2.5; d0 = d + 3
    for r in range(16): z += DH * 1.15; prof += [(d0 + r * DD, z, 0), (d0 + (r + 1) * DD, z, 1)]
    d = d0 + 16 * DD; prof += [(d, z + 3, 0), (d, 0, 0)]
    depth = d
    for run in runs_of(out, depth + 2):
        sweep(sc, 'estadio_grada', run, C, N, out, base_of(out), prof, [conc, sa, sb])
        zr = z + 6
        sweep(sc, 'estadio_cubierta', run, C, N, out, base_of(out), [(depth * 0.35, zr - 1.5, 0), (depth + 1, zr + 1.5, 0), (depth * 0.35, zr - 1.5, 0)], [roof])
        foot += [C[i] + N[i] * out * (base_of(out)(i) + f * depth) for i in run for f in (0, 0.5, 1)]
        # Focos sobre el borde de atrás de la grada (como en las fotos).
        for i in run[2::10]:
            q = C[i] + N[i] * out * (base_of(out)(i) + depth - 1)
            instance(sc, 'kit_poste_luz', q.x, q.y, 0, z + 2, 1.6)
    # Por dentro: terraza con sombrillas junto al muro y palcos de dos pisos detrás.
    ins = -out
    pprof = [(6, 0, 0), (6, 3.2, 2), (6, 3.6, 0), (6, 6.8, 2), (6, 7.6, 0), (16, 7.6, 1), (16, 0, 1)]
    for run in runs_of(ins, 18):
        sweep(sc, 'estadio_palcos', run, C, N, ins, base_of(ins), pprof, [white, green, glass])
        for k, i in enumerate(run[::3]):
            q = C[i] + N[i] * ins * (base_of(ins)(i) + 2.5)
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.6, radius2=0.05, depth=0.7, location=(q.x, q.y, 2.4))
            o = bpy.context.active_object; o.data.materials.append(umb); o.name = 'mq_sombrilla'
            for c_ in o.users_collection: c_.objects.unlink(o)
            sc.collection.objects.link(o)
        foot += [C[i] + N[i] * ins * (base_of(ins)(i) + f) for i in run for f in (0, 8, 16)]
    # «MÉXICO» pintado en el asfalto verde del lado de dentro, en el centro de la zona.
    zi = [i for i in range(n) if zone[i]]
    if zi:
        i = zi[len(zi) // 2]; w = asph[ins][i]
        if w > 8:
            q = C[i] + N[i] * ins * (half + 1.2 + w / 2); t = T[i]; L_ = 26.0; H_ = min(5.0, w * 0.6)
            c_, s_ = t.x, t.y; nx, ny = -s_ * ins, c_ * ins
            vs = [(q.x + u * c_ + v * nx, q.y + u * s_ + v * ny, 0.045) for u, v in ((-L_ / 2, -H_ / 2), (L_ / 2, -H_ / 2), (L_ / 2, H_ / 2), (-L_ / 2, H_ / 2))]
            me = bpy.data.meshes.new('mq_mexico_suelo'); me.from_pydata(vs, [], [(0, 1, 2, 3)]); me.uv_layers.new(); uv = me.uv_layers.active
            for li, uvv in enumerate(((1, 1), (0, 1), (0, 0), (1, 0))): uv.data[li].uv = uvv
            me.materials.append(mat_img('portico_mexico', os.path.join(TEX, 'portico_mexico.png'))); ob = bpy.data.objects.new('mq_mexico_suelo', me); sc.collection.objects.link(ob)
    # Pórtico con el cartel: en el extremo del estadio del lado del pit lane (29/10/2026, indicación del usuario).
    ends = [i for i in range(n) if zone[i] and (not zone[i - 1] or not zone[(i + 1) % n])]
    first = min(ends, key=lambda i: min(((C[i] - q).length for q in PIT_PTS), default=0)) if ends else None
    if first is not None:
        i = first; t = T[i]; nn = N[i]
        wl = base_of(1)(i) + 2; wr = base_of(-1)(i) + 2
        cen = C[i] + nn * ((wl - wr) / 2); span = wl + wr
        rot = math.atan2(nn.y, nn.x)
        box(sc, 'portico', cen.x, cen.y, rot, span, 4.0, 8.5, 11.5, conc)
        for sd, w in ((1, wl), (-1, wr)):
            q = C[i] + nn * sd * w; box(sc, 'portico_pilar', q.x, q.y, rot, 2.0, 2.0, 0, 11.5, conc)
        mt = mat_img('portico_mexico', os.path.join(TEX, 'portico_mexico.png'))
        for f in (-1, 1):
            c2 = cen - t * f * 2.05; c_, s_ = math.cos(rot), math.sin(rot)
            vs = [(c2.x + u * c_, c2.y + u * s_, z_) for z_ in (8.7, 11.3) for u in (-span * 0.35, span * 0.35)]
            me = bpy.data.meshes.new('mq_cartel_portico'); me.from_pydata(vs, [], [(0, 1, 3, 2) if f > 0 else (0, 2, 3, 1)])
            me.uv_layers.new(); uv = me.uv_layers.active
            for li, (uu, vv) in zip(range(4), ((1, 0), (0, 0), (0, 1), (1, 1)) if f > 0 else ((0, 0), (0, 1), (1, 1), (1, 0))): uv.data[li].uv = (uu, vv)
            me.materials.append(mt); ob = bpy.data.objects.new('mq_cartel_portico', me); sc.collection.objects.link(ob)
    return foot

# ---------------------------------------------------------------- montaje
def build(cid, render=True):
    D = json.load(open(os.path.join(BASE, 'circuitos', cid + '.json'), encoding='utf8'))
    random.seed(cid)
    materials(); sc = scene(); torre = variants(cid)
    PIT_PTS[:] = [Vector((x, -y)) for x, y in D['pit']['fastLane']]
    C, lap = resample(D['points'], STEP); n = len(C); half = D['width'] / 2
    T = [(C[(i + 1) % n] - C[i - 1]).normalized() for i in range(n)]
    N = [Vector((-t.y, t.x)) for t in T]                       # normal izquierda (lado +1)
    kd = KDTree(n)
    for i, p in enumerate(C): kd.insert(p.to_3d(), i)
    kd.balance()
    pitP = [Vector((x, -y)) for x, y in D['pit']['fastLane']] + [Vector((x, -y)) for w in D['pit']['walls'] for x, y in w]
    pb = D['pitBuilding']
    pbP = [Vector((x, -y)) for x, y in pb['points']] if pb else []
    obst = pitP + pbP
    kdp = KDTree(max(1, len(obst)))
    for i, p in enumerate(obst): kdp.insert(p.to_3d(), i)
    kdp.balance()
    items = [(Vector((it['x'], -it['y'])), max(it['length'], it['width']) / 2) for it in D['items']]
    wpolys = [[Vector((x, -y)) for x, y in poly] for poly in D['water']]
    # Huella de los modelos del escenario (menos los puentes): la escapatoria, el muro y las piezas no se meten debajo.
    ipts = []
    for it in D['items']:
        if it['kind'] == 'bridge' or it['model'] in STADIUMS: continue
        src = scenery_model(it['model'], it['tint'])
        if src is None: continue
        sz = src['size']; rot = -it['heading']; c_, s_ = math.cos(rot), math.sin(rot)
        vs = src['mesh'].vertices
        for k in range(0, len(vs), max(1, len(vs) // 500)):
            co = vs[k].co; u = co.x * it['length'] / sz[0]; v = co.y * it['width'] / sz[1]
            ipts.append(Vector((it['x'] + u * c_ - v * s_, -it['y'] + u * s_ + v * c_)))
    kdi = KDTree(max(1, len(ipts)))
    for k, q in enumerate(ipts): kdi.insert(q.to_3d(), k)
    kdi.balance()
    near = int(70 / STEP)
    def free(p, i, margin):                                    # sin pisar otra parte de la pista, el pit lane ni un monumento
        for (q, j, d) in kd.find_range(p.to_3d(), half + margin):
            if min(abs(j - i), n - abs(j - i)) > near: return False
        if obst and kdp.find(p.to_3d())[2] < 7: return False
        if ipts and kdi.find(p.to_3d())[2] < 4: return False
        return True
    maxoff = {}
    for side in (1, -1):
        arr = []
        for i in range(n):
            o = half + 1
            while o < half + 140 and free(C[i] + N[i] * side * (o + 2), i, 3): o += 2
            arr.append(o)
        maxoff[side] = arr
    ttype = D['trackType']; street = ttype == 'street'
    verge = VERGE.get(ttype, 10.0); scale_r = 0.6 if ttype == 'hybrid' else 1.0
    asph = {1: [0.0] * n, -1: [0.0] * n}; grav = {1: [0.0] * n, -1: [0.0] * n}
    tyre_front = {1: [False] * n, -1: [False] * n}             # urbanos: neumáticos delante del hormigón
    cornerinfo = []
    for c in D['corners']:
        kind = braking(c.get('kmh'))
        i0 = int(round(c['t'] * n)) % n
        a, b = C[(i0 - 8) % n], C[(i0 + 8) % n]
        turn = (C[i0] - a).normalized().cross((b - C[i0]).normalized())
        out = -1 if turn > 0 else 1
        cornerinfo.append((c, kind, i0, out))
        if kind is None: continue
        A, G, pre, post = RUNOFF[kind]
        if street:
            A, G = (STREET_ESCAPE, 0.0) if kind == 'fuerte' else (0.0, 0.0)
            for k in range(-int(pre / STEP), int(post / STEP) + 1):
                if kind in ('fuerte', 'media'): tyre_front[out][(i0 + k) % n] = True
        A *= scale_r; G *= scale_r
        for k in range(-int(pre / STEP), int(post / STEP) + 1):
            i = (i0 + k) % n; s = k * STEP
            w = min(1.0, (s + pre) / 25.0, (post - s) / 25.0); w = max(0.0, w); w = w * w * (3 - 2 * w)
            asph[out][i] = max(asph[out][i], A * w); grav[out][i] = max(grav[out][i], G * w)
    # Estadios (el Foro Sol): la pista pasa encajonada entre muros y gradas, sin escapatoria.
    stadium_zone = [False] * n; stadium_out = 1
    for it in D['items']:
        if it['model'] not in STADIUMS: continue
        center = Vector((it['x'], -it['y'])); R_ = max(it['length'], it['width']) / 2 + 15
        zi = [i for i in range(n) if (C[i] - center).length < R_]
        turn = sum(T[i].cross(T[(i + 2) % n]) for i in zi)
        stadium_out = -1 if turn > 0 else 1                     # lado de fuera de la curva del estadio
        for i in zi:
            stadium_zone[i] = True
            for sd in (1, -1): asph[sd][i] = 16.0 if sd == stadium_out else 11.0; grav[sd][i] = 0.0
    # Superficies: pista, pianos, escapatorias y suelo.
    def strip(name, o1, o2, side, m, z, mask=None):
        verts = []; faces = []
        for i in range(n):
            verts += [(C[i] + N[i] * side * o1[i]).to_3d() + Vector((0, 0, z)), (C[i] + N[i] * side * o2[i]).to_3d() + Vector((0, 0, z))]
        for i in range(n):
            j = (i + 1) % n
            if mask and not (mask[i] and mask[j]): continue
            faces.append((2 * i, 2 * i + 1, 2 * j + 1, 2 * j) if side > 0 else (2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
        if faces: mesh_obj(sc, name, verts, faces, [m])
    strip('pista', [-half] * n, [half] * n, 1, M['asfalto'], 0.05)
    kerb = [False] * n
    for c, kind, i0, out in cornerinfo:
        for k in range(-int(35 / STEP), int(35 / STEP) + 1): kerb[(i0 + k) % n] = True
    for side in (1, -1):
        lim = [min(maxoff[side][i], half + asph[side][i] + grav[side][i]) for i in range(n)]
        a_end = [min(lim[i], half + 1.2 + asph[side][i]) for i in range(n)]
        strip('escapatoria_%d' % side, [half + 1.2] * n, a_end, side, M['escap'], 0.03, [asph[side][i] > 0.5 for i in range(n)])
        strip('grava_%d' % side, a_end, lim, side, M['grava'], 0.025, [lim[i] - a_end[i] > 0.5 and grav[side][i] > 0.5 for i in range(n)])
        paint = mat('pintura_azul', hexrgb('1f4fb8'), 0.7) if side == stadium_out else mat('pintura_verde', hexrgb('2f9a44'), 0.7)
        strip('pintado_%d' % side, [half + 1.2] * n, a_end, side, paint, 0.035, [stadium_zone[i] and asph[side][i] > 0.5 for i in range(n)])
        vs = []; fs = []; idx = []
        for i in range(n):
            j = (i + 1) % n
            if not (kerb[i] and kerb[j]): continue
            q = len(vs); z = Vector((0, 0, 0.07))
            a0 = C[i] + N[i] * side * half; a1 = C[i] + N[i] * side * (half + 1.2)
            b0 = C[j] + N[j] * side * half; b1 = C[j] + N[j] * side * (half + 1.2)
            vs += [a0.to_3d() + z, a1.to_3d() + z, b1.to_3d() + z, b0.to_3d() + z]
            fs.append((q, q + 1, q + 2, q + 3) if side > 0 else (q, q + 3, q + 2, q + 1)); idx.append(i % 2)
        if fs: mesh_obj(sc, 'piano_%d' % side, vs, fs, [M['rojo'], M['blanco']], idx)
    a0 = C[0] - N[0] * half; a1 = C[0] + N[0] * half; z = Vector((0, 0, 0.08))
    mesh_obj(sc, 'meta', [(a0 - T[0]).to_3d() + z, (a1 - T[0]).to_3d() + z, (a1 + T[0]).to_3d() + z, (a0 + T[0]).to_3d() + z], [(0, 1, 2, 3)], [M['linea']])
    xs = [p.x for p in C]; ys = [p.y for p in C]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2; R = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 + 400; RG = R + 2500
    mesh_obj(sc, 'suelo', [(cx - RG, cy - RG, 0), (cx + RG, cy - RG, 0), (cx + RG, cy + RG, 0), (cx - RG, cy + RG, 0)], [(0, 1, 2, 3)], [M['ciudad'] if D['street'] else M['hierba']])
    for k, poly in enumerate(D['water']): polyfill(sc, 'agua%d' % k, poly, M['agua'], 0.02)
    if D['street']:
        for k, poly in enumerate(D['infield']): polyfill(sc, 'ciudad%d' % k, poly, M['ciudad'], 0.01)
    # Pit lane: carril rápido, zona de trabajo y muro.
    if len(D['pit']['fastLane']) > 1:
        fl = [Vector((x, -y)) for x, y in D['pit']['fastLane']]
        vs = []; fs = []
        for i in range(len(fl)):
            t = (fl[min(i + 1, len(fl) - 1)] - fl[max(i - 1, 0)]).normalized(); nn = Vector((-t.y, t.x))
            vs += [(fl[i] - nn * 2.5).to_3d() + Vector((0, 0, 0.05)), (fl[i] + nn * 2.5).to_3d() + Vector((0, 0, 0.05))]
            if i: fs.append((2 * i - 2, 2 * i - 1, 2 * i + 1, 2 * i))
        mesh_obj(sc, 'carril_rapido', vs, fs, [M['asfalto']])
        polyfill(sc, 'zona_trabajo', D['pit']['service'], M['hormigon'], 0.04)
        for w in D['pit']['walls']:
            P = [Vector((x, -y)) for x, y in w]
            for a, b in zip(P, P[1:]):
                mid = (a + b) / 2; L = (b - a).length
                if L > 0.3: box(sc, 'muro_pit', mid.x, mid.y, math.atan2((b - a).y, (b - a).x), L + 0.05, 0.6, 0, 1.1, M['hormigon'])
    placed = []                                                 # (centro, radio) de lo grande ya colocado
    extra = {'kd': None}                                        # huella de las gradas de estadio generadas
    def free_spot(p, r, track_gap):
        q, j, d = kd.find(p.to_3d())
        if d < half + track_gap: return False
        if obst and kdp.find(p.to_3d())[2] < r + 4: return False
        if any((p - c).length < r + rr for c, rr in placed) or any((p - c).length < r + rr for c, rr in items): return False
        if any(inside(p, w) for w in wpolys): return False
        if ipts and kdi.find(p.to_3d())[2] < r + 3: return False
        if extra['kd'] and extra['kd'].find(p.to_3d())[2] < r + 4: return False
        return True
    counts = {}
    def put(kit, p, rot, z=0.0, r=None, key=None):
        instance(sc, kit, p.x, p.y, rot, z); k = key or kit; counts[k] = counts.get(k, 0) + 1
        if r: placed.append((p, r))
    # Edificio de boxes: el genérico en todos; en Shanghái, sus piezas propias (CK4) y su paddock.
    pb_end = None
    if pb and len(pbP) > 1:
        segs = []
        for a, b in zip(pbP, pbP[1:]):
            t = (b - a); L = t.length
            if L < 0.5: continue
            t.normalize(); nn = Vector((-t.y, t.x)) * pb['front']   # al invertir y, el fondo del edificio queda hacia +front
            segs.append((a, b, t, nn, L))
        if cid == 'shanghai':
            # Boxes de Shanghái: la pieza de 87 m repetida a lo largo de todo el edificio.
            total = sum(sg[4] for sg in segs); s0 = 43.5
            while s0 + 43.5 <= total + 10:
                acc = 0.0
                for a, b, t, nn, L in segs:
                    if acc + L >= s0:
                        pos = a + t * (s0 - acc) + nn * 12.5
                        put('kit_edificio_boxes', pos, math.atan2(t.y, t.x), key='kit_edificio_boxes (Shanghái)'); break
                    acc += L
                s0 += 87
            a, b, t, nn, L = segs[len(segs) // 2]
            mid = a + t * (L / 2)
            for row in range(2):
                for col in range(-3, 4):
                    p = mid + t * (col * 34) + nn * (pb['depth'] + 40 + row * 34)
                    if free_spot(p, 12, 30): put('kit_pabellon' if (row + col) % 2 else 'kit_carpa', p, math.atan2(t.y, t.x), r=12, key='paddock (Shanghái)')
            p = mid + t * 150 + nn * (pb['depth'] + 40)
            if free_spot(p, 25, 30): put('kit_edificio_b', p, math.atan2(t.y, t.x), r=25, key='kit_edificio_b (Shanghái)')
        else:
            for a, b, t, nn, L in segs:
                mid = (a + b) / 2 + nn * (pb['depth'] / 2)
                box(sc, 'boxes', mid.x, mid.y, math.atan2(t.y, t.x), L + 0.1, pb['depth'], 0, pb['height'], M['boxes'])
        acc = 0
        for a, b, t, nn, L in segs:
            acc += L
            if acc >= 28: acc = 0; p = b + nn * (pb['depth'] + 12); put('kit_farola', p, 0)
        # Final de los boxes: el extremo más cercano a la salida del pit lane.
        if pitP:
            exitp = Vector((D['pit']['fastLane'][-1][0], -D['pit']['fastLane'][-1][1]))
            a0, b0, t0, n0, _ = segs[0]; a1, b1, t1, n1, _ = segs[-1]
            pb_end = (b1, t1, n1) if (b1 - exitp).length < (a0 - exitp).length else (a0, -t0, n0)
    # Monumentos y edificios del escenario actual (volúmenes con su color).
    # Barreras. Permanentes: muro de neumáticos al final de la escapatoria y guardarraíl en interiores y rectas.
    # Urbanos: muro de hormigón continuo (al final de la vía de escape si la hay) con valla alta encima y neumáticos
    # delante en las curvas de frenada fuerte y media.
    def barrier_runs(side):
        off = []; kind = []
        for i in range(n):
            r = asph[side][i] + grav[side][i]
            if stadium_zone[i]: o = half + r + 1.2; k = 'kit_bloque_hormigon'
            elif street: o = half + verge + r; k = 'kit_bloque_hormigon'
            elif r > 3: o = half + r + 1.5; k = 'kit_muro_neumaticos'
            else: o = half + verge; k = 'kit_guardarrail'
            o = min(o, maxoff[side][i] - 1)
            ok = o > half + 2.5 and not (obst and kdp.find((C[i] + N[i] * side * o).to_3d())[2] < 14)
            off.append(o if ok else None); kind.append(k)
        sm = []
        for i in range(n):
            if stadium_zone[i]: sm.append(off[i]); continue
            vals = [off[(i + k) % n] for k in range(-3, 4) if off[(i + k) % n] is not None]
            sm.append(sum(vals) / len(vals) if off[i] is not None and vals else None)
        return sm, kind
    def tiles(kit, pts_off, side, extra=0.0, z=0.0, mask=None, pick=None):
        L = TILE[kit]; run = []
        def flush():
            if len(run) < 2: run.clear(); return
            start = run[0]; k = 1
            while k < len(run):
                if (run[k] - start).length < L: k += 1; continue
                a, b = run[k - 1], run[k]
                lo, hi = 0.0, 1.0
                for _ in range(20):
                    m_ = (lo + hi) / 2
                    if ((a + (b - a) * m_) - start).length < L: lo = m_
                    else: hi = m_
                end = a + (b - a) * lo; mid = (start + end) / 2; d = end - start
                name = pick(counts.get(kit, 0)) if pick else kit
                instance(sc, name, mid.x, mid.y, math.atan2(d.y, d.x), z); counts[kit] = counts.get(kit, 0) + 1
                start = end; run[k - 1] = end
            run.clear()
        for i in range(n + 1):
            ii = i % n; o = pts_off[ii]
            if o is None or (mask and not mask[ii]): flush(); continue
            run.append(C[ii] + N[ii] * side * (o + extra))
        flush()
    walls = {}
    for side in (1, -1):
        off, kind = barrier_runs(side); walls[side] = off
        for k in set(kind): tiles(k, [off[i] if kind[i] == k else None for i in range(n)], side)
        if street:
            tiles('kit_valla_alta', off, side, 0.35, z=0.95)
            tiles('kit_muro_neumaticos', off, side, -1.3, mask=tyre_front[side])
        else:
            fence = [False] * n
            for c, kd_, i0, out in cornerinfo:
                if kd_ == 'fuerte' and out == side:
                    for k in range(-int(110 / STEP), int(60 / STEP) + 1): fence[(i0 + k) % n] = True
            tiles('kit_valla_alta', off, side, 1.5, mask=fence)
            tiles('kit_valla_alta', off, side, 0.35, z=0.95, mask=stadium_zone)
    def clear_cell(q, margin):
        # Fuera de la pista, de la escapatoria y del muro del tramo más cercano, con margen.
        _, j, d = kd.find(q.to_3d())
        sj = 1 if (q - C[j]).dot(N[j]) > 0 else -1
        lim = walls[sj][j] if walls[sj][j] is not None else half + verge
        return d >= max(lim, half + asph[sj][j] + grav[sj][j], half + 4) + margin
    # Monumentos y edificios del escenario: los modelos reales del juego (public/models/scenery), colocados como en
    # itemTransform (instancing.ts): escala a largo, alto y ancho, giro -heading y frente hacia la pista en los tipos que
    # lo tienen. Si un modelo no se puede cargar, volumen por celdas de 6 m sin tocar pista, escapatoria ni muro. Solo los
    # puentes pueden pasar por encima del asfalto; si un modelo del juego lo pisa, se apunta para revisarlo.
    carved = 0; touching = []
    FACE = {'grandstand', 'vip', 'building', 'landmark', 'floodlight', 'pit-building', 'billboard'}
    gpts = [Vector((x, y)) for x, y in D['points']]
    stadium_pts = []
    for it in D['items']:
        if it['model'] in STADIUMS:
            stadium_pts += stadium(sc, it, C, N, T, n, half, verge, walls, maxoff, asph, grav, stadium_out, stadium_zone)
            continue
        src = scenery_model(it['model'], it['tint'])
        if src is None:
            rot = -it['heading']; tint = mat('tinte_' + (it['tint'] or '#b9b4aa'), hexrgb(it['tint'] or '#b9b4aa'), 0.7)
            if it['kind'] == 'bridge': box(sc, 'puente', it['x'], -it['y'], rot, it['length'], it['width'], it['clearance'], it['height'], tint); continue
            cx_, cy_, L_, W_ = it['x'], -it['y'], it['length'], it['width']; c_, s_ = math.cos(rot), math.sin(rot)
            nu, nv = max(1, round(L_ / 6)), max(1, round(W_ / 6)); du, dv = L_ / nu, W_ / nv
            verts = []; faces = []
            for a_ in range(nu):
                for b_ in range(nv):
                    u = -L_ / 2 + du * (a_ + 0.5); v = -W_ / 2 + dv * (b_ + 0.5)
                    q = Vector((cx_ + u * c_ - v * s_, cy_ + u * s_ + v * c_))
                    if not clear_cell(q, max(du, dv) * 0.7 + 2): carved += 1; continue
                    k0 = len(verts)
                    for zz in (0, it['height']):
                        for uu, vv in ((-du / 2, -dv / 2), (du / 2, -dv / 2), (du / 2, dv / 2), (-du / 2, dv / 2)):
                            verts.append((q.x + uu * c_ - vv * s_, q.y + uu * s_ + vv * c_, zz))
                    faces += [(k0, k0 + 1, k0 + 2, k0 + 3), (k0 + 4, k0 + 7, k0 + 6, k0 + 5), (k0, k0 + 4, k0 + 5, k0 + 1), (k0 + 1, k0 + 5, k0 + 6, k0 + 2), (k0 + 2, k0 + 6, k0 + 7, k0 + 3), (k0 + 3, k0 + 7, k0 + 4, k0)]
            if faces: mesh_obj(sc, it['model'], verts, faces, [tint])
            continue
        heading = it['heading']
        if it['kind'] in FACE:
            near = min(gpts[::3], key=lambda q: (q.x - it['x']) ** 2 + (q.y - it['y']) ** 2)
            if math.sin(heading) * (near.x - it['x']) - math.cos(heading) * (near.y - it['y']) < 0: heading += math.pi
        size = src['size']
        ob = bpy.data.objects.new('scn_' + it['model'] + '_i', src['mesh']); sc.collection.objects.link(ob)
        ob.location = (it['x'], -it['y'], 0); ob.rotation_euler = (0, 0, -heading)
        ob.scale = (it['length'] / size[0], it['width'] / size[1], it['height'] / size[2])
        if it['kind'] != 'bridge':
            bpy.context.view_layer.update()
            # Vértices, centro de cada cara y puntos a lo largo de cada arista: las caras largas también cuentan.
            mw = ob.matrix_world; me_ = src['mesh']; hit = 0
            for poly in me_.polygons:
                vs_ = [mw @ me_.vertices[k].co for k in poly.vertices]
                cand = vs_ + [sum(vs_, Vector()) / len(vs_)]
                for a_, b_ in zip(vs_, vs_[1:] + vs_[:1]):
                    for f_ in (0.25, 0.5, 0.75): cand.append(a_ + (b_ - a_) * f_)
                if any(w.z < 2 and kd.find(Vector((w.x, w.y, 0)))[2] < half + 0.3 for w in cand): hit += 1; break
            if hit: touching.append(it['model'])
    if stadium_pts:
        kds = KDTree(len(stadium_pts))
        for k, q in enumerate(stadium_pts): kds.insert(q.to_3d(), k)
        kds.balance(); extra['kd'] = kds
    counts['celdas_quitadas_monumentos'] = carved
    if touching: counts['modelos_del_juego_tocando_pista'] = sorted(set(touching))
    # Rectas: la de meta y la segunda más larga.
    curv = [abs(T[i].angle_signed(T[(i + 3) % n])) for i in range(n)]
    straight = [cv < 0.02 for cv in curv]
    runs = []; i = 0
    while i < n:
        if straight[i]:
            j = i
            while j < i + n and straight[j % n]: j += 1
            runs.append((j - i, i)); i = j
        else: i += 1
    runs.sort(reverse=True)
    pit_side = 1
    if pitP:
        q = pitP[len(pitP) // 2]; _, j, _ = kd.find(q.to_3d()); pit_side = 1 if (q - C[j]).dot(N[j]) > 0 else -1
    main = next(((L, s) for L, s in runs if any((s + k) % n in range(0, 12) or (s + k) % n > n - 12 for k in range(L))), runs[0] if runs else None)
    # Gradas: mirando a la pista (su +Y hacia el eje), detrás de la barrera, sin pisar nada.
    # Torre de posiciones (29/10/2026, indicación del usuario): una por circuito, cerca de la línea de meta, entre la meta
    # y la salida del pit lane, en el lado de la recta contrario a los boxes y con el panel (el -Y de la pieza) mirando a
    # los coches que llegan, para que vean su posición al pasar.
    j_exit = kd.find(PIT_PTS[-1].to_3d())[1] if PIT_PTS else int(150 / STEP)
    ahead = (j_exit - 0) % n
    if ahead > n // 2 or ahead < int(40 / STEP): ahead = int(120 / STEP)
    side_t = -pit_side; done = False
    for frac in (0.6, 0.45, 0.75, 0.3, 0.9):
        i = int(ahead * frac) % n
        wall = walls[side_t][i] if walls[side_t][i] is not None else half + verge
        for extra_ in (6, 10, 16, 24):
            p = C[i] + N[i] * side_t * (wall + extra_)
            if not free_spot(p, 6, wall + extra_ - half - 2): continue
            want = (-T[i] * 0.85 + (-N[i] * side_t) * 0.5).normalized()          # hacia los coches que llegan
            rot = math.atan2(want.y, want.x) - math.atan2(-1.0, 0.0)            # el panel es el -Y de la pieza
            put(torre, p, rot, r=7, key='kit_torre_posiciones'); done = True; break
        if done: break
    # Grúas detrás del muro de neumáticos de las curvas de frenada (antes que las gradas, para que tengan su sitio).
    if not street:
        for c, kind, i0, out in cornerinfo:
            if kind not in ('fuerte', 'media'): continue
            ig = (i0 + int(20 / STEP)) % n
            p = C[ig] + N[ig] * out * (half + asph[out][ig] + grav[out][ig] + 9)
            if free_spot(p, 6, 6): put('kit_grua', p, math.atan2(T[ig].y, T[ig].x) + math.pi, r=8)
    # Gradas: dos piezas de Shanghái, ya orientadas con los asientos mirando a +Y (la subida hacia -Y): la blanca de
    # celosía (42 x 30 m) en las curvas y la roja (módulo de 37 x 21 m) encadenada en las rectas.
    # Grada pequeña (18 x 15 x 9 m): la roja reducida, para los huecos dentro de las curvas cerradas.
    if 'kit_grada_pequena' not in bpy.data.objects:
        me = bpy.data.objects['kit_grada_roja'].data.copy(); me.name = 'kit_grada_pequena'
        me.transform(Matrix.Diagonal((0.5, 0.7, 0.55, 1))); bpy.data.objects.new('kit_grada_pequena', me)
    GR = {'kit_grada_comun': (21.0, 15.0), 'kit_grada_roja': (18.6, 11.0), 'kit_grada_pequena': (9.3, 7.7)}
    def boxed_in(p):
        # Encajonada: pista a menos de 70 m por dos lados opuestos (dos tramos distintos de la vuelta).
        groups = []
        for q, j, d in sorted(kd.find_range(p.to_3d(), 70), key=lambda h: h[2]):
            if all(min(abs(j - g[0]), n - abs(j - g[0])) > int(70 / STEP) for g in groups): groups.append((j, (q.xy - p).normalized()))
        return any(groups[a][1].dot(groups[b][1]) < -0.5 for a in range(len(groups)) for b in range(a + 1, len(groups)))
    def clear_of_walls(q, margin):
        # Fuera de la pista, de la escapatoria y del muro del tramo más cercano.
        _, j, d = kd.find(q.to_3d())
        sj = 1 if (q - C[j]).dot(N[j]) > 0 else -1
        lim = walls[sj][j] if walls[sj][j] is not None else half + verge
        return d >= max(lim, half + asph[sj][j] + grav[sj][j]) + margin
    def grada(i, side, kit='kit_grada_comun', extra=0.0):
        if stadium_zone[i]: return False
        hl, hw = GR[kit]
        wall = walls[side][i] if walls[side][i] is not None else half + verge
        p = C[i] + N[i] * side * (wall + 6 + hw + extra)
        if kit != 'kit_grada_pequena' and boxed_in(p): return grada(i, side, 'kit_grada_pequena', extra)
        if not free_spot(p, hl * 0.9, 6 + hw): return False
        rot = math.atan2(T[i].y, T[i].x)
        if Vector((-math.sin(rot), math.cos(rot))).dot(-N[i] * side) < 0: rot += math.pi   # +Y hacia la pista
        c_, s_ = math.cos(rot), math.sin(rot)
        for u, v in ((-hl, -hw), (hl, -hw), (-hl, hw), (hl, hw), (0, hw), (0, -hw)):
            q = p + Vector((u * c_ - v * s_, u * s_ + v * c_))
            if not clear_of_walls(q, 2.0): return False
        put(kit, p, rot, r=hl, key='gradas' if kit != 'kit_grada_pequena' else 'gradas_pequenas'); return True
    if main:
        L, s = main
        for k in range(int(10 / STEP), L - int(20 / STEP), int(38 / STEP)): grada((s + k) % n, -pit_side, 'kit_grada_roja')
    if len(runs) > 1:
        L, s = [r for r in runs if r != main][0]
        side2 = 1 if (len(cornerinfo) % 2) else -1
        for k in range(L // 4, 3 * L // 4, int(38 / STEP)): grada((s + k) % n, side2, 'kit_grada_roja')
    # Curvas: la blanca en el vértice y módulos rojos siguiendo el arco por fuera (se prueban posiciones cada 8 m y se
    # deja hueco de un módulo entre una y otra; si en un punto no cabe, se sigue con el siguiente).
    for c, kind, i0, out in cornerinfo:
        if kind not in ('fuerte', 'media'): continue
        if not grada(i0, out): grada(i0, out, 'kit_grada_roja')
        pre, post = (120, 100) if kind == 'fuerte' else (60, 50)
        for sign, span in ((-1, pre), (1, post)):
            last = 0
            for d in range(16, span + 1, 8):
                if d - last < 38 and last: continue
                if grada((i0 + sign * int(d / STEP)) % n, out, 'kit_grada_roja'): last = d
    # Publicidad en la recta de meta (patrocinador cambiando cada dos vallas).
    sp = SPONSORS; base_s = sum(map(ord, cid)) % len(sp)
    if main:
        L, s = main
        mask = [False] * n
        for k in range(L): mask[(s + k) % n] = True
        off = [(walls[-pit_side][i] or half + verge) - 0.8 for i in range(n)]
        tiles('kit_valla_publi', off, -pit_side, mask=mask, pick=lambda k: 'kit_valla_publi__' + sp[(base_s + k // 2) % len(sp)])
    # Curvas: carteles de metros, pancarta, grúa y puesto de comisarios.
    for ci, (c, kind, i0, out) in enumerate(cornerinfo):
        if kind not in ('fuerte', 'media'): continue
        s_id = sp[(base_s + 3 + ci) % len(sp)]
        turn_in = i0 - int(45 / STEP)
        for m in (200, 150, 100, 50):
            ib = (turn_in - int(m / STEP)) % n
            if not straight[ib] and curv[ib] > 0.05: continue
            wall = walls[out][ib] or half + verge
            o = min(half + 3.0, wall - 0.7) if street else half + 4.0 + asph[out][ib] * 0.0
            p = C[ib] + N[ib] * out * o
            if obst and kdp.find(p.to_3d())[2] < 8: continue
            put('kit_metros_%d__%s' % (m, s_id), p, math.atan2(T[ib].y, T[ib].x) - math.pi / 2, key='cartel_metros')  # la cara con el número mira a los coches que llegan
        if street: continue
        if kind == 'fuerte':
            ib = (i0 - int(30 / STEP)) % n
            p = C[ib] + N[ib] * out * (half + 1.2 + asph[out][ib] * 0.5)
            if asph[out][ib] > 6: put('kit_pancarta__' + s_id, p, math.atan2(T[ib].y, T[ib].x), 0.04, key='kit_pancarta')
        ip = (i0 + int(10 / STEP)) % n
        p = C[ip] - N[ip] * out * (half + verge + 4)
        if free_spot(p, 4, verge): put('kit_refugio_comisarios', p, math.atan2(T[ip].y, T[ip].x), r=4)
    # Árboles fuera de la pista y de las escapatorias.
    trees = 0; tries = 0; want = 80 if D['street'] else 260
    while trees < want and tries < want * 30:
        tries += 1
        p = Vector((cx + (random.random() * 2 - 1) * (R - 380), cy + (random.random() * 2 - 1) * (R - 380)))
        q, j, d = kd.find(p.to_3d())
        if d < half + 45 + asph[1][j] + grav[1][j] or d < half + 45 + asph[-1][j] + grav[-1][j]: continue
        if not free_spot(p, 8, 45): continue
        instance(sc, random.choice(['kit_arbol_a', 'kit_arbol_b', 'kit_arbol_c']), p.x, p.y, random.random() * 6.28, 0, 0.8 + random.random() * 0.4); trees += 1
    # Comprobación final: ninguna pieza del kit toca el asfalto (las pancartas van pintadas en la escapatoria).
    removed = 0
    for o in list(sc.collection.objects):
        if not o.name.startswith('kit_') or o.name.startswith('kit_pancarta'): continue
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        xs_ = [v.x for v in bb]; ys_ = [v.y for v in bb]
        lo_ = [o.matrix_world @ Vector(o.bound_box[0]), o.matrix_world @ Vector(o.bound_box[4]), o.matrix_world @ Vector(o.bound_box[3])]
        a0, ax, ay = lo_[0].xy, lo_[1].xy - lo_[0].xy, lo_[2].xy - lo_[0].xy
        hit = False
        for fa in (0, 0.25, 0.5, 0.75, 1):
            for fb in (0, 0.25, 0.5, 0.75, 1):
                q = a0 + ax * fa + ay * fb
                if kd.find(q.to_3d())[2] < half + 0.3: hit = True; break
            if hit: break
        if hit: bpy.data.objects.remove(o, do_unlink=True); removed += 1
    counts['quitadas_por_tocar_pista'] = removed; counts['celdas_quitadas_monumentos'] = carved
    info = {'por_tipo': {k: sum(1 for c in cornerinfo if c[1] == k) for k in ('fuerte', 'media', 'rapida')}, 'piezas': counts, 'arboles': trees}
    if render: shots(sc, D, C, N, T, cornerinfo, asph, grav, half, (cx, cy, R), street, main)
    return info

# ---------------------------------------------------------------- render
def setup_render(sc):
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 88
    try: sc.eevee.taa_render_samples = 16
    except Exception: pass
    sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.get('mq_cielo') or bpy.data.worlds.new('mq_cielo'); w.use_nodes = True
    nt = w.node_tree
    bg = next((nd for nd in nt.nodes if nd.type == 'BACKGROUND'), None)
    if bg is None:
        bg = nt.nodes.new('ShaderNodeBackground'); wo = next((nd for nd in nt.nodes if nd.type == 'OUTPUT_WORLD'), None) or nt.nodes.new('ShaderNodeOutputWorld')
        nt.links.new(bg.outputs[0], wo.inputs[0])
    bg.inputs[0].default_value = (0.62, 0.74, 0.9, 1); bg.inputs[1].default_value = 0.9
    sc.world = w
    sun = bpy.data.objects.get('mq_sol')
    if sun is None:
        sun = bpy.data.objects.new('mq_sol', bpy.data.lights.new('mq_sol', 'SUN')); sun.data.energy = 3.5; sun.data.angle = 0.03
    if sun.name not in sc.collection.objects: sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(42), 0, math.radians(35))
    cam = bpy.data.objects.get('mq_cam') or bpy.data.objects.new('mq_cam', bpy.data.cameras.new('mq_cam'))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    sc.camera = cam; cam.data.clip_start = 0.5; cam.data.clip_end = 20000
    return cam

def look(cam, pos, target, lens):
    cam.location = pos; cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()

def shots(sc, D, C, N, T, cornerinfo, asph, grav, half, box_, street, main):
    cam = setup_render(sc); cx, cy, R = box_; n = len(C)
    out = os.path.join(BASE, 'capturas'); os.makedirs(out, exist_ok=True)
    def shot(tag):
        sc.render.filepath = os.path.join(out, '%s_%s.jpg' % (D['id'], tag)); bpy.ops.render.render(write_still=True, scene=sc.name)
    span = R - 400
    look(cam, (cx + span * 0.55, cy - span * 1.55, span * 1.25), (cx, cy, 0), 35); shot('1_general')
    cs = [c for c in cornerinfo if c[0].get('kmh') is not None]
    c, kind, i0, out_ = min(cs, key=lambda c: c[0]['kmh']) if cs else cornerinfo[0]
    p = C[i0]; nout = N[i0] * out_
    depth = half + asph[out_][i0] + grav[out_][i0]
    if street:
        tgt = p + nout * (depth + 2); pos = p - nout * 30 - T[i0] * 55
        look(cam, (pos.x, pos.y, 14), (tgt.x, tgt.y, 1), 24)
    else:
        tgt = p + nout * (depth * 0.6); pos = p - nout * 70 - T[i0] * 90
        look(cam, (pos.x, pos.y, 38), (tgt.x, tgt.y, 0), 28)
    shot('2_curva')
    # Frenada: desde la pista, mirando hacia la curva con los carteles de metros.
    ib = (i0 - int(300 / STEP)) % n
    pos = C[ib] + nout * (half * 0.5)
    tgt = C[(i0 - int(150 / STEP)) % n] + nout * (half + 4)
    look(cam, (pos.x, pos.y, 2.6), (tgt.x, tgt.y, 1.4), 38); shot('3_frenada')
    p = C[0]; t = T[0]
    pos = p - t * 160 + N[0] * 55
    look(cam, (pos.x, pos.y, 30), ((p + t * 60).x, (p + t * 60).y, 0), 30); shot('4_meta')
