# [TL7, 18/11/2026] AMR24 (coche de 2024, modelo propio del usuario) limpio para el juego. Se ejecuta dentro de Blender
# con assets3d/maquetas/tl7-coches.blend abierto (escena TL7_AMR24 con el modelo importado y TL7_2025 con la acción
# WheelSpin): exec(open(ruta).read()); build_amr24().
# Pasos: copia de las mallas visibles con su transformación aplicada; fuera las piezas y caras con marcas (calcas,
# dorsales, luces, pantallas) y el interior del volante; girado con el morro a +X, a 5,7 m y con las ruedas en el suelo;
# materiales del juego por material de origen y pieza (pintura → principal, carbono de los alerones → secundaria, el
# resto de carbono y detalles → carbono, llanta y neumático); ruedas unidas por neumático con origen en el eje, la
# acción WheelSpin y una banda del compuesto nueva (el modelo no la trae): anillo en el flanco de fuera.
import bpy, bmesh, math, re
from mathutils import Vector, Matrix

DROP_OBJ = re.compile(r'^(LED|LED_back|Rain_Lights|steering_wheel|left_paddle|right_paddle|mix_dial|tyre_dial|cockpit_chrome|LOD_A_INT|decal_all)')
DROP_MAT = re.compile(r'(decal|number|indicator|rear_light|LCD|vehicle_revs|^material$)')
WING = re.compile(r'^(frontwing|frontflap|frontspoiler|rearwing|wing$)')
WHEELPART = re.compile(r'^(TYRE_|wheel_|disc_|am_wheel)')


def _game_mat(name):
    """Material del juego (el mismo nombre que en el coche de 2025)."""
    return bpy.data.materials[name]


def build_amr24(scene_name='TL7_AMR24_JUEGO'):
    src = bpy.data.scenes['TL7_AMR24']
    sc = bpy.data.scenes.get(scene_name) or bpy.data.scenes.new(scene_name)
    for o in list(sc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.window.scene = sc
    vl = bpy.context.view_layer
    for o in src.objects:
        if o.type != 'MESH' or o.hide_render or o.hide_get():
            continue
        part = o.parent.name if o.parent else o.name
        if DROP_OBJ.match(part):
            continue
        me = o.data.copy(); me.transform(o.matrix_world)
        c = bpy.data.objects.new('amr_' + o.name, me); c['pieza'] = part
        sc.collection.objects.link(c)
        bad = [i for i, m in enumerate(me.materials) if m and DROP_MAT.search(m.name)]
        if bad:
            bm = bmesh.new(); bm.from_mesh(me)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in bad], context='FACES')
            bm.to_mesh(me); bm.free()
        if len(me.polygons) == 0:
            bpy.data.objects.remove(c, do_unlink=True)
    rot = Matrix.Rotation(math.radians(90), 4, 'Z')
    for o in sc.objects:
        o.data.transform(rot)
    pts = [v.co for o in sc.objects for v in o.data.vertices]
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    wz = min(v.co.z for o in sc.objects if o['pieza'].startswith(('TYRE', 'wheel_')) for v in o.data.vertices)
    s = 5.7 / (mx.x - mn.x)
    T = Matrix.Scale(s, 4) @ Matrix.Translation((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -wz))
    for o in sc.objects:
        o.data.transform(T)
    # Materiales del juego.
    for o in sc.objects:
        part = o['pieza']; olds = [m.name if m else '' for m in o.data.materials]
        new = []
        for n in olds:
            if n == 'force_india_paint': k = 'paint_primary'
            elif n == 'force_india_wheel': k = 'rim'
            elif n.startswith('TIRE_'): k = 'tyre'
            elif n == 'force_india_carbon1' and WING.match(part): k = 'paint_secondary'
            else: k = 'carbon'
            new.append(k)
        o.data.materials.clear()
        for k in new:
            o.data.materials.append(_game_mat(k))
    # Ruedas.
    spin = bpy.data.actions['WheelSpin']
    def sel(objs, act):
        for x in sc.objects: x.select_set(False)
        for x in objs: x.select_set(True)
        vl.objects.active = act
    tyres = {}
    for o in sc.objects:
        m = re.match(r'^TYRE_(LF|RF|LR|RR)', o['pieza'])
        if m: tyres.setdefault(m.group(1), []).append(o)
    centers = {}
    for k, objs in tyres.items():
        p2 = [v.co for o in objs for v in o.data.vertices]
        centers[k] = Vector([(min(p[i] for p in p2) + max(p[i] for p in p2)) / 2 for i in range(3)])
    groups = {k: [] for k in centers}
    for o in sc.objects:
        if WHEELPART.match(o['pieza']):
            c = sum((v.co for v in o.data.vertices), Vector()) / max(1, len(o.data.vertices))
            groups[min(centers, key=lambda kk: (centers[kk] - c).length)].append(o)
    report = {}
    for k, objs in groups.items():
        c = centers[k]
        name = ('F' if c.x > 0 else 'R') + ('L' if c.y > 0 else 'R')
        tv = [v.co for o in objs if o['pieza'].startswith('TYRE_') for v in o.data.vertices]
        R = max(math.hypot(p.x - c.x, p.z - c.z) for p in tv)
        side = 1 if c.y > 0 else -1
        yout = max(p.y * side for p in tv) * side
        sel(objs, objs[0]); bpy.ops.object.join(); w = vl.objects.active
        w.data.transform(Matrix.Translation(-c)); w.location = c
        w.name = 'wheel_' + name; w.data.name = 'wheel_' + name
        bm = bmesh.new(); seg = 64; r0, r1 = 0.70 * R, 0.755 * R
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring.append((bm.verts.new((r0 * math.cos(a), (yout - c.y) + side * 0.06, r0 * math.sin(a))),
                         bm.verts.new((r1 * math.cos(a), (yout - c.y) + side * 0.06, r1 * math.sin(a)))))
        for i in range(seg):
            a0, b0 = ring[i]; a1, b1 = ring[(i + 1) % seg]
            bm.faces.new((a0, a1, b1, b0))
        me = bpy.data.meshes.new('band_' + name); bm.to_mesh(me); bm.free()
        band = bpy.data.objects.new('band_' + name, me); sc.collection.objects.link(band)
        band.parent = w; me.materials.append(_game_mat('compound_band'))
        sel([band], band)
        sw = band.modifiers.new('ajuste', 'SHRINKWRAP'); sw.target = w; sw.wrap_method = 'PROJECT'; sw.use_project_y = True
        sw.use_negative_direction = side > 0; sw.use_positive_direction = side < 0; sw.offset = 0.003
        bpy.ops.object.modifier_apply(modifier='ajuste')
        w.rotation_mode = 'QUATERNION'; w.animation_data_create(); w.animation_data.action = spin
        try:
            if spin.slots: w.animation_data.action_slot = spin.slots[0]
        except Exception:
            pass
        report[name] = [round(v, 3) for v in c] + [round(R, 3)]
    rest = [o for o in sc.objects if o.type == 'MESH' and not o.name.startswith(('wheel_', 'band_'))]
    sel(rest, rest[0]); bpy.ops.object.join(); body = vl.objects.active; body.name = 'body'; body.data.name = 'body'
    return {'ruedas': report, 'body': len(body.data.polygons)}
