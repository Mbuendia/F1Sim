# CK2: hornea las texturas de cada grupo de piezas (comunes y de Shanghái) en un atlas compartido. Las piezas se despliegan
# juntas en un mapa 'atlas' (proyección automática y empaquetado); se hornea el color de sus materiales originales y, en
# las piezas con transparencia (árboles, valla alta y barandillas), el canal alfa aparte. Deja los PNG en OUT y cambia
# cada pieza a un único material con el atlas. Se ejecuta con exec() dentro de Blender, después de piezas-ck2.py.
import bpy, os
import numpy as np
OUT = r'C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario-Documents-antigravity-brave-mendeleev\f474c708-6eb0-40dd-bce8-215b3a2452e4\scratchpad\ck2\atlas'
os.makedirs(OUT, exist_ok=True)
ALPHA = {'arbol_a', 'arbol_b', 'arbol_c', 'valla_alta', 'estructura_c'}
main = next(s for s in bpy.data.scenes if s.name not in ('MAQUETA', 'PREVIEW', 'TOP'))
bpy.context.window.scene = main
sc = main
sc.render.engine = 'CYCLES'
try:
    sc.cycles.device = 'GPU'
except Exception:
    pass
sc.cycles.samples = 1
sc.render.bake.margin = 6
sc.render.bake.use_clear = True

def objs(scope):
    return [o for o in bpy.data.collections['CK2'].objects if o.get('scope') == scope]

def select(obs):
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]

def unwrap(obs):
    for o in obs:
        me = o.data
        if not me.uv_layers: me.uv_layers.new(name='UVMap')
        orig = me.uv_layers[0]; orig.active_render = True
        at = me.uv_layers.get('atlas') or me.uv_layers.new(name='atlas')
        me.uv_layers.active = at
    select(obs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Reparto del atlas: el área de cada pieza crece con su superficie elevada a 0,3 (no proporcional), para que las
    # grandes no se lo coman; los árboles (imágenes de 256 px) con la mitad.
    for o in obs:
        me = o.data; uv = me.uv_layers['atlas']
        area = sum(p.area for p in me.polygons) or 1
        f = area ** -0.35 * (0.5 if o.name[3:].startswith('arbol_') else 1.0)
        for d in uv.data: d.uv = d.uv * f
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')

def target_node(m, img):
    nt = m.node_tree
    n = nt.nodes.get('ck_bake') or nt.nodes.new('ShaderNodeTexImage')
    n.name = 'ck_bake'; n.image = img
    nt.nodes.active = n
    return n

def mats_of(obs):
    seen = []
    for o in obs:
        for m in o.data.materials:
            if m and m not in seen: seen.append(m)
    return seen

def bake_group(scope, size):
    obs = objs(scope)
    unwrap(obs)
    col = bpy.data.images.get('ck_atlas_' + scope)
    if col: bpy.data.images.remove(col)
    col = bpy.data.images.new('ck_atlas_' + scope, size, size, alpha=True)
    for m in mats_of(obs): target_node(m, col)
    select(obs)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=6, use_clear=True)
    rgba = np.array(col.pixels[:], dtype=np.float32).reshape(size, size, 4)
    rgba[..., 3] = 1.0
    # Alfa: se hornea para todas las piezas (emisión blanca en las opacas, el alfa de su textura en las transparentes),
    # así el canal es correcto en todo el atlas sin máscaras.
    if any(o.name[3:] in ALPHA for o in obs):
        al = bpy.data.images.get('ck_alpha_' + scope)
        if al: bpy.data.images.remove(al)
        al = bpy.data.images.new('ck_alpha_' + scope, size, size)
        alpha_mats = set(m for o in obs if o.name[3:] in ALPHA for m in o.data.materials if m)
        saved = []
        for m in mats_of(obs):
            nt = m.node_tree
            out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
            tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.name != 'ck_bake'), None)
            old = [l.from_socket for l in out.inputs['Surface'].links]
            em = nt.nodes.new('ShaderNodeEmission'); em.name = 'ck_em'
            if m in alpha_mats and tex: nt.links.new(tex.outputs['Alpha'], em.inputs['Color'])
            else: em.inputs['Color'].default_value = (1, 1, 1, 1)
            nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
            saved.append((m, old)); target_node(m, al)
        select(obs)
        bpy.ops.object.bake(type='EMIT', margin=6, use_clear=True)
        a = np.array(al.pixels[:], dtype=np.float32).reshape(size, size, 4)
        rgba[..., 3] = a[..., 0]
        for m, old in saved:
            nt = m.node_tree; out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
            em = nt.nodes.get('ck_em')
            if em: nt.nodes.remove(em)
            for s_ in old: nt.links.new(s_, out.inputs['Surface'])
    col.pixels.foreach_set(rgba.ravel())
    col.filepath_raw = os.path.join(OUT, 'kit-%s.png' % ('comun' if scope == 'comun' else 'shanghai'))
    col.file_format = 'PNG'; col.save()
    # Material único por pieza con el atlas; el mapa 'atlas' pasa a ser el único.
    for o in obs:
        alpha = o.name[3:] in ALPHA
        name = 'kit-%s%s' % ('comun' if scope == 'comun' else 'shanghai', '-alfa' if alpha else '')
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
            bs = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None) or nt.nodes.new('ShaderNodeBsdfPrincipled')
            out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
            nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
            tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = col
            nt.links.new(tx.outputs['Color'], bs.inputs['Base Color'])
            if alpha: nt.links.new(tx.outputs['Alpha'], bs.inputs['Alpha'])
            bs.inputs['Roughness'].default_value = 0.8
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE': n.image = col              # siempre el atlas recién horneado
        me = o.data
        for uv in [u for u in me.uv_layers if u.name != 'atlas']: me.uv_layers.remove(uv)
        me.uv_layers['atlas'].name = 'UVMap'
        me.materials.clear(); me.materials.append(m)
        for p in me.polygons: p.material_index = 0
    return len(obs)

res = {'comun': bake_group('comun', 2048), 'shanghai': bake_group('shanghai', 2048)}
result = res
