# [MJ10, 20/11/2026, el usuario: «Haz el coche que sea entero de fibra de carbono, pero con el mismo nivel de detalle»]
# Fibra de carbono para el coche de la escena del muro (mj10-muro.py): tejido sarga 2x2 generado aquí (textura que se
# repite, con el brillo de cada mecha), proyectado en caja sobre el coche y con barniz brillante encima. La forma del
# coche no cambia: solo los materiales de pintura, carbono y decoración; neumáticos, llantas y franja del compuesto, igual.
# Uso: exec(open(r'.../mj10-carbono.py').read()); carbon_car('MJ10_MURO', r'.../carbono.png')
import bpy
import math


def twill_image(path, size=512, cells=16):
    """Sarga 2x2: cada celda es una mecha por encima (en una dirección u otra) con brillo cilíndrico a lo ancho."""
    img = bpy.data.images.get('mj10_carbono') or bpy.data.images.new('mj10_carbono', size, size, alpha=False)
    if img.size[0] != size:
        img.scale(size, size)
    cell = size // cells
    px = [0.0] * (size * size * 4)
    for y in range(size):
        j, fy = divmod(y, cell)
        for x in range(size):
            i, fx = divmod(x, cell)
            warp = (i - j) % 4 in (0, 1)       # por encima la mecha vertical o la horizontal
            t = (fx if warp else fy) / cell    # posición a lo ancho de la mecha
            along = (fy if warp else fx) / cell
            shade = math.sin(math.pi * t) ** 1.6  # brillo de la mecha (cilindro)
            fibers = 0.85 + 0.15 * math.sin(along * math.pi * 14 + i * 1.7)  # hilos finos a lo largo
            v = (0.02 + 0.55 * shade * fibers) if warp else (0.008 + 0.16 * shade * fibers)
            k = (y * size + x) * 4
            px[k] = px[k + 1] = v
            px[k + 2] = v * 1.05
            px[k + 3] = 1.0
    img.pixels = px
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img


def carbon_material(img):
    m = bpy.data.materials.get('mj10_fibra') or bpy.data.materials.new('mj10_fibra')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (9.0, 9.0, 9.0)     # una celda ≈ 7 mm en el coche (20/11/2026: el usuario lo pide a la mitad, más real)
    mapping.inputs['Rotation'].default_value = (0, 0, math.radians(45))
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.projection = 'BOX'
    tex.projection_blend = 0.25
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.45
    bump.inputs['Distance'].default_value = 0.002
    nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Color'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Metallic'].default_value = 0.1
    bsdf.inputs['Roughness'].default_value = 0.42
    # Barniz encima, como la fibra de un coche de carreras: reflejos limpios sobre el tejido.
    bsdf.inputs['Coat Weight'].default_value = 1.0
    bsdf.inputs['Coat Roughness'].default_value = 0.03
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m


KEEP = ('tyre', 'rim', 'compound_band')


def carbon_car(scene_name, png_path, car_name='mj10_coche'):
    """[20/11/2026] El coche de carbono es el de todas las escenas de Blender (decisión del usuario); car_name: el vacío que lo agrupa."""
    img = twill_image(png_path)
    fibra = carbon_material(img)
    car = bpy.data.scenes[scene_name].objects[car_name]
    changed = 0
    for o in car.children_recursive:
        if o.type != 'MESH':
            continue
        # Las decoraciones (pegatinas sobre la carrocería) se ocultan: el coche entero es carbono, sin dibujos.
        if o.name.startswith('decal_'):
            o.hide_render = True
            continue
        for slot in o.material_slots:
            if slot.material and not slot.material.name.split('.')[0] in KEEP:
                slot.material = fibra
                changed += 1
    return changed
