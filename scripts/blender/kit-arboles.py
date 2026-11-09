# [CR6, 09/11/2026] Árboles del kit (arbol_a, arbol_b, arbol_c) rehechos en Blender a petición del usuario: con la misma
# foto de árbol del modelo de Montreal (montreal-arboles.webp, de Dave Love, CC BY 4.0), pero en lugar de una tarjeta
# doblada en V (que desde arriba se veía como una raya negra) llevan:
#   - tres tarjetas verticales con el árbol entero, cruzadas a 60°, para que tenga volumen desde cualquier lado;
#   - dos tarjetas de copa casi horizontales a distinta altura (y giradas entre sí), para que desde arriba se vea follaje;
#   - normales de copa (hacia fuera del centro del árbol y hacia arriba), para que el sol lo ilumine suave y no salga negro.
# Uso (sin interfaz):
#   blender -b --factory-startup --python scripts/blender/kit-arboles.py -- <repo> <carpeta de salida>
# Después: node scratch/cr56/arboles-post.mjs (textura externa y material del kit), compress-models y finalize-models.
import bpy, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
REPO = argv[0] if argv else os.getcwd()
OUT = argv[1] if len(argv) > 1 else os.path.join(REPO, "scratch", "cr56", "arboles")
TEX = os.path.join(REPO, "public", "models", "kit", "montreal-arboles.webp")

# Zona de cada árbol en la foto (u0, u1, v0, v1 en glTF: v hacia abajo desde arriba), su alto y el alto de copa.
TREES = {
    "arbol_a": dict(uv=(0.0019, 0.3540, 0.0000, 0.5081), h=18.0, crown=(0.62, 0.84), crown_v=0.72),
    "arbol_b": dict(uv=(0.0011, 0.5966, 0.4950, 0.9978), h=14.86, crown=(0.48, 0.74), crown_v=0.80),
    "arbol_c": dict(uv=(0.3614, 0.8304, 0.0125, 0.4933), h=15.97, crown=(0.60, 0.82), crown_v=0.74),
}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material():
    m = bpy.data.materials.new("montreal-arboles-alfa")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(TEX)
    nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(img.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.85
    m.use_backface_culling = False
    return m


def build(name, uv, h, crown, crown_v):
    u0, u1, v0, v1 = uv
    w = h * (u1 - u0) / (v1 - v0)            # la foto es cuadrada: ancho según la proporción de su zona
    B = lambda v: 1.0 - v                     # Blender cuenta v hacia arriba
    verts, faces, uvs = [], [], []

    def quad(corners, uvq):
        # Cara y revés por separado, con las mismas normales de copa: así las dos caras se iluminan igual
        # (con una sola cara de dos lados, el revés sale negro).
        for order in ((0, 1, 2, 3), (3, 2, 1, 0)):
            base = len(verts)
            verts.extend(corners[i] for i in order)
            faces.append((base, base + 1, base + 2, base + 3))
            uvs.extend(uvq[i] for i in order)

    # Tres tarjetas verticales con el árbol entero (abajo el tronco, arriba la copa).
    for k in range(3):
        a = math.radians(60 * k)
        dx, dy = math.cos(a) * w / 2, math.sin(a) * w / 2
        quad([(-dx, -dy, 0), (dx, dy, 0), (dx, dy, h), (-dx, -dy, h)],
             [(u0, B(v1)), (u1, B(v1)), (u1, B(v0)), (u0, B(v0))])
    # Dos tarjetas de copa casi horizontales: la parte de arriba de la foto (sin tronco), un poco abombadas.
    vc = v0 + (v1 - v0) * crown_v
    for k, (zf, sf, rot) in enumerate(((crown[0], 0.70, 30.0), (crown[1], 0.55, 75.0))):
        z, s, a = h * zf, w * sf / 2, math.radians(rot)
        ca, sa = math.cos(a), math.sin(a)
        pts = [(-s, -s), (s, -s), (s, s), (-s, s)]
        lift = [-0.06, -0.06, 0.06, 0.06]   # ligera inclinación para que no parezca un plato
        corners = [(x * ca - y * sa, x * sa + y * ca, z + l * s) for (x, y), l in zip(pts, lift)]
        quad(corners, [(u0, B(vc)), (u1, B(vc)), (u1, B(v0)), (u0, B(v0))])

    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    # Normales de copa: desde el centro de la copa hacia fuera, con un empujón hacia arriba.
    c = Vector((0, 0, h * 0.55))
    normals = []
    for v in me.vertices:
        d = (v.co - c)
        d = d.normalized() if d.length > 1e-6 else Vector((0, 0, 1))
        normals.append((d + Vector((0, 0, 0.6))).normalized())
    me.normals_split_custom_set_from_vertices(normals)
    ob = bpy.data.objects.new("G_" + name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(material())
    return ob, w


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, t in TREES.items():
        clear()
        ob, w = build(name, **t)
        path = os.path.join(OUT, name + ".glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_normals=True,
                                  export_texcoords=True, export_materials="EXPORT", export_image_format="WEBP",
                                  export_apply=True)
        print("ARBOL", name, "tris", 2 * len(ob.data.polygons), "ancho", round(w, 2), "alto", t["h"])
