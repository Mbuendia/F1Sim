# [VS6, 16/11/2026] Exporta el coche despiezado de la escena «VS6» a un .glb para la landing: un nodo por pieza del
# despiece, con su nombre, y el flap del DRS con su eje de giro en el origen. Después, `node scripts/compress-models.mjs
# <archivo>` lo comprime como los demás modelos del juego.
#
# Uso (dentro de Blender, con la escena VS6 montada por vs6-split.py y vs6-power-unit.py):
#   exec(open(r"<repo>/scripts/blender/vs6-export.py", encoding="utf-8").read()); export_landing(r"<salida.glb>")
import bpy, bmesh

# pieza del .glb: objetos de la escena que la forman (sin el prefijo vs6_)
GROUPS = {
    "ala_delantera": ["ala_delantera"],
    "ala_trasera": ["ala_trasera", "drs_puntas", "drs_actuador"],
    "drs_flap": ["drs_flap"],
    "chasis": ["chasis", "pedales", "hibrido"],   # la batería va bajo el depósito, dentro del chasis
    "carroceria_baja": ["carroceria_baja"],
    "pontones": ["pontones"],
    "tapa_motor": ["tapa_motor"],
    "suelo": ["suelo"],
    "suspension_del": ["suspension_del"],
    "suspension_tras": ["suspension_tras"],
    "motor": ["motor", "admision"],
    "turbo": ["turbo"],
    "escape": ["escape"],
    "caja_cambios": ["caja_cambios"],
    "radiadores": ["radiadores"],
}
WHEELS = ("FL", "FR", "RL", "RR")
# Para la web se aligeran las mallas más pesadas (solo en la copia que se exporta; la escena no cambia).
DECIMATE = {"suelo": 0.45, "chasis": 0.6, "carroceria_baja": 0.6, "pontones": 0.75, "tapa_motor": 0.8, "suspension_del": 0.6, "suspension_tras": 0.6, "ala_delantera": 0.75, "ala_trasera": 0.8}
EXPORT_COLLECTION = "VS6_export"


def _join(name, sources, origin=None):
    """Une copias de los objetos en uno nuevo (las mallas originales no se tocan)."""
    bm = bmesh.new()
    mats, slot_of = [], {}
    for src in sources:
        me = src.data.copy()
        me.transform(src.matrix_world)
        if origin is not None:
            me.transform(__import__("mathutils").Matrix.Translation(-origin))
        remap = []
        for m in src.data.materials:
            if m.name not in slot_of:
                slot_of[m.name] = len(mats)
                mats.append(m)
            remap.append(slot_of[m.name])
        for p in me.polygons:
            p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new("exp_" + name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    ob = bpy.data.objects.new(name, out)
    if origin is not None:
        ob.location = origin
    return ob


def export_landing(path):
    sc = bpy.data.scenes["VS6"]
    col = bpy.data.collections.get(EXPORT_COLLECTION)
    if col:
        for o in list(col.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        col = bpy.data.collections.new(EXPORT_COLLECTION)
        sc.collection.children.link(col)
    get = lambda n: bpy.data.objects["vs6_" + n]
    made = []
    for name, parts in GROUPS.items():
        srcs = [get(p) for p in parts if bpy.data.objects.get("vs6_" + p)]
        origin = get("drs_flap").location.copy() if name == "drs_flap" else None
        ob = _join(name, srcs, origin)
        if name in DECIMATE:
            mod = ob.modifiers.new("web", "DECIMATE")
            mod.ratio = DECIMATE[name]
            mod.use_collapse_triangulate = True
        made.append(ob)
    for w in WHEELS:
        hub = bpy.data.objects["hero_wheel_" + w].matrix_basis.translation.copy()
        srcs = [o for o in bpy.data.collections["VS6_coche"].objects if o.name.startswith("vs6_rueda_" + w + "_")]
        made.append(_join("rueda_" + w, srcs, hub))
    for ob in made:
        col.objects.link(ob)
    vl = sc.view_layers[0]
    layer = next(lc for lc in vl.layer_collection.children if lc.collection == col)
    with bpy.context.temp_override(scene=sc, view_layer=vl):
        vl.active_layer_collection = layer
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_active_collection=True, use_active_scene=True,
                                  export_apply=True, export_yup=True, export_texcoords=False, export_normals=True,
                                  export_materials="EXPORT", export_cameras=False, export_lights=False, export_animations=False)
    dg = bpy.context.evaluated_depsgraph_get()
    tris = {ob.name: sum(len(p.vertices) - 2 for p in ob.evaluated_get(dg).data.polygons) for ob in made}
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(col)
    return tris
