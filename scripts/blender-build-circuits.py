# [G11] Construye en Blender las mallas 3D de los circuitos a partir de scratch/g11/<circuito>.json
# (las genera `node scripts/export-circuit-meshes.mjs`). Por cada circuito crea una colección con un objeto por pieza
# (asfalto, bordes, pianos, boxes, meta...), exporta un .glb y guarda la colección en un .blend propio.
# No toca los objetos que ya haya en la escena: al terminar retira lo que ha creado.
# Uso dentro de Blender:  build_circuits(r"<raíz del repo>", ["barcelona", ...])  (sin lista: todos)
import bpy, json, os


def _linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _material(color, alpha):
    name = f"F1Sim {color} {alpha:g}"
    material = bpy.data.materials.get(name)
    if material:
        return material
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    rgb = [_linear(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    # Por tipo y no por nombre: el nombre del nodo depende del idioma de la interfaz.
    shader = next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if shader:
        shader.inputs[0].default_value = (*rgb, 1.0)
        for socket in shader.inputs:
            if socket.identifier == "Roughness":
                socket.default_value = 0.9
            elif socket.identifier == "Alpha":
                socket.default_value = alpha
    material.diffuse_color = (*rgb, alpha)
    return material


def build_circuits(root, ids=None):
    source = os.path.join(root, "scratch", "g11")
    target = os.path.join(root, "assets3d", "circuits")
    os.makedirs(target, exist_ok=True)
    ids = ids or sorted(f[:-5] for f in os.listdir(source) if f.endswith(".json"))
    scene = bpy.context.scene
    report = {}
    for circuit_id in ids:
        with open(os.path.join(source, circuit_id + ".json"), encoding="utf-8") as handle:
            data = json.load(handle)
        collection = bpy.data.collections.new(f"F1Sim {circuit_id}")
        scene.collection.children.link(collection)
        objects, materials = [], set()
        for index, piece in enumerate(data["pieces"]):
            mesh = bpy.data.meshes.new(f"{circuit_id}_{index:02d}")
            mesh.from_pydata([tuple(v) for v in piece["verts"]], [], [tuple(f) for f in piece["faces"]])
            mesh.update()
            # Todas las caras miran hacia arriba.
            for polygon in mesh.polygons:
                if polygon.normal.z < 0:
                    polygon.flip()
            mesh.update()
            material = _material(piece["color"], piece["alpha"])
            mesh.materials.append(material)
            materials.add(material)
            obj = bpy.data.objects.new(f"{circuit_id}_{index:02d}_{piece['color'][1:]}", mesh)
            obj["f1sim_layer"] = piece["layer"]
            collection.objects.link(obj)
            objects.append(obj)
        collection["f1sim_circuit"] = data["name"]
        collection["f1sim_lap_length_m"] = data["lapLengthMeters"]
        collection["f1sim_track_width_m"] = data["trackWidthMeters"]

        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        glb = os.path.join(target, circuit_id + ".glb")
        bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
                                  export_draco_mesh_compression_enable=True)
        blend = os.path.join(target, circuit_id + ".blend")
        bpy.data.libraries.write(blend, {collection}, fake_user=True)

        xs = [v.co.x for o in objects for v in o.data.vertices]
        ys = [v.co.y for o in objects for v in o.data.vertices]
        report[circuit_id] = {
            "objects": len(objects), "vertices": len(xs),
            "size_m": [round(max(xs) - min(xs)), round(max(ys) - min(ys))],
            "glb_kb": round(os.path.getsize(glb) / 1024), "blend_kb": round(os.path.getsize(blend) / 1024),
        }
        # Retirar lo creado: la escena del usuario queda como estaba.
        for obj in objects:
            mesh = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.meshes.remove(mesh)
        scene.collection.children.unlink(collection)
        bpy.data.collections.remove(collection)
    for material in [m for m in bpy.data.materials if m.name.startswith("F1Sim ") and m.users == 0]:
        bpy.data.materials.remove(material)
    return report
