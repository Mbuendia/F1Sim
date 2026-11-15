# [VS5, 14/11/2026] Chispas de la portada, detrás del coche. Se ejecuta en Blender (5.x) con la escena «HERO» de la portada
# cargada (assets3d/portada/escena-portada-2026-11-09.blend): crea las chispas y renderiza su capa para el móvil y el
# escritorio, con el coche como máscara para que las tape donde toca. Después, `node scripts/encode-hero-sparks.mjs <carpeta>`
# las pasa a public/hero/.
#
# Las chispas son geometría, no una simulación: cada una es un trazo emisivo a lo largo del tramo de parábola que recorre
# durante el tiempo de obturación (como las pintaría el desenfoque de movimiento), con rebote en el suelo. Salen de debajo
# del difusor (x = -2,35 m; el coche acaba en x = -2,51 m) y se van hacia atrás, abiertas hacia el lado de la cámara para
# que se vean pasada la rueda trasera. Semilla fija: siempre salen las mismas.
#
# Uso (dentro de Blender, con la escena HERO abierta):
#   exec(open(r"<repo>/scripts/blender/hero-sparks.py", encoding="utf-8").read()); build_sparks(); render_sparks(r"<carpeta>")
import bpy, bmesh, math, os, random
from mathutils import Vector

SCENE = "HERO"
FX_COLLECTION = "COL_FX_Portada"
FX_OBJECT = "FX_Chispas_Portada"
SEED = 7
COUNT = 230                      # tope de chispas (no hay simulación que pueda desbocarse)
EMITTER_X = -2.35                # bajo el difusor, detrás del eje trasero (x = -1,71 m)
GRAVITY = -13.0
# Encuadres de la portada. El del móvil es el que guarda la escena; el de escritorio no estaba guardado y se dedujo el
# 14/11/2026 ajustando la cámara hasta que el coche cae en el mismo sitio que en el render original (desk-car.png).
CAMERAS = {
    "mob": {"res": (828, 1472), "lens": 34.5, "shift": (0.05, 0.15)},
    "desk": {"res": (1920, 1080), "lens": 39.06, "shift": (-0.13, 0.0229)},
}
# Del blanco amarillento recién saltada al rojo apagado cuando se enfría: (edad máxima en s, color, fuerza).
HEAT = [(0.10, (1.0, 0.80, 0.42), 9.0), (0.24, (1.0, 0.45, 0.10), 5.0), (9.0, (0.95, 0.20, 0.04), 2.6)]


def _material(i, color, strength):
    name = f"hero_em_chispa_{i}"
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


def _path(rng):
    """Posición de una chispa cada 4 ms desde que salta, con rebote en el suelo."""
    p = Vector((EMITTER_X + rng.uniform(-0.05, 0.2), rng.uniform(-0.5, 0.45), 0.05))
    # Hacia atrás (-X), abiertas hacia el lado de la cámara (-Y) y algo hacia arriba.
    v = Vector((-rng.uniform(20.0, 46.0), rng.gauss(-3.2, 4.6), rng.uniform(0.2, 3.4)))
    pts, dt = [p.copy()], 0.004
    for _ in range(150):
        v.z += GRAVITY * dt
        p = p + v * dt
        if p.z < 0.012:
            p.z = 0.012
            v = Vector((v.x * 0.78, v.y * 0.78, -v.z * 0.36))
        pts.append(p.copy())
    return pts


def build_sparks():
    """Crea (o rehace) el objeto de las chispas en la escena de la portada."""
    sc = bpy.data.scenes[SCENE]
    col = bpy.data.collections.get(FX_COLLECTION) or bpy.data.collections.new(FX_COLLECTION)
    if col.name not in sc.collection.children:
        sc.collection.children.link(col)
    old = bpy.data.objects.get(FX_OBJECT)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    rng = random.Random(SEED)
    bm = bmesh.new()
    for _ in range(COUNT):
        pts = _path(rng)
        age = 0.012 + (rng.random() ** 1.5) * 0.44          # más chispas jóvenes, cerca del coche
        shutter = rng.uniform(0.02, 0.046)
        a, b = int(age / 0.004), max(1, int((age - shutter) / 0.004))
        seg = pts[min(b, a - 1):a + 1]
        if len(seg) < 2:
            continue
        mat = next(i for i, (limit, _, _) in enumerate(HEAT) if age <= limit)
        radius = rng.uniform(0.011, 0.022) * (1.0 - 0.5 * min(1.0, age / 0.45))
        # Dos cintas cruzadas a lo largo del trazo: se ven desde cualquier lado.
        for axis in (Vector((0, 0, 1)), Vector((0, 1, 0))):
            rows = []
            for k, q in enumerate(seg):
                d = (seg[min(k + 1, len(seg) - 1)] - seg[max(k - 1, 0)]).normalized()
                side = d.cross(axis)
                side = side.normalized() * radius if side.length > 1e-6 else Vector((0, radius, 0))
                taper = 0.35 + 0.65 * (k / (len(seg) - 1))   # la cola, más fina
                rows.append((bm.verts.new(q + side * taper), bm.verts.new(q - side * taper)))
            for k in range(len(rows) - 1):
                f = bm.faces.new((rows[k][0], rows[k + 1][0], rows[k + 1][1], rows[k][1]))
                f.material_index = mat
    mesh = bpy.data.meshes.new(FX_OBJECT)
    bm.to_mesh(mesh)
    bm.free()
    for i, (_, color, strength) in enumerate(HEAT):
        mesh.materials.append(_material(i, color, strength))
    obj = bpy.data.objects.new(FX_OBJECT, mesh)
    obj.visible_shadow = False
    col.objects.link(obj)
    return obj


def render_sparks(out_dir, samples=64):
    """Renderiza solo las chispas (el coche hace de máscara) para los dos encuadres: <out_dir>/{mob,desk}-sparks.png."""
    sc = bpy.data.scenes[SCENE]
    cam, r = sc.camera.data, sc.render
    fx = bpy.data.objects[FX_OBJECT]
    car = {o.name for o in bpy.data.collections["HERO_coche"].all_objects}
    saved = {o.name: (o.hide_render, o.is_holdout) for o in sc.objects}
    keep = (r.resolution_x, r.resolution_y, r.resolution_percentage, cam.lens, cam.shift_x, cam.shift_y, r.filepath, sc.eevee.taa_render_samples, r.film_transparent)
    os.makedirs(out_dir, exist_ok=True)
    done = []
    try:
        for o in sc.objects:
            if o.type in {"MESH", "CURVE"}:
                o.hide_render = not (o.name in car or o == fx)
                o.is_holdout = o.name in car
        r.film_transparent = True
        sc.eevee.taa_render_samples = samples
        for name, c in CAMERAS.items():
            r.resolution_x, r.resolution_y, r.resolution_percentage = c["res"][0], c["res"][1], 100
            cam.lens, cam.shift_x, cam.shift_y = c["lens"], c["shift"][0], c["shift"][1]
            r.filepath = os.path.join(out_dir, f"{name}-sparks.png")
            bpy.ops.render.render(scene=sc.name, write_still=True)
            done.append(r.filepath)
    finally:
        for o in sc.objects:
            o.hide_render, o.is_holdout = saved[o.name]
        (r.resolution_x, r.resolution_y, r.resolution_percentage, cam.lens, cam.shift_x, cam.shift_y, r.filepath, sc.eevee.taa_render_samples, r.film_transparent) = keep
    return done
