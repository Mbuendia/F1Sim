# [VS6, 15/11/2026] Comprueba que lo que se añade dentro del coche (motor, radiadores, tubos, pedales) cabe dentro de la
# carrocería SIN tocar el coche: el coche es la referencia y lo de dentro es lo que se ajusta.
#
# Para cada vértice de las piezas de dentro se lanzan rayos hacia fuera (a los lados y hacia arriba; no hacia delante ni
# hacia atrás, donde el coche tiene bocas de verdad: las tomas de los pontones y la salida trasera; sí hacia abajo,
# por los túneles del suelo). Si varios rayos no chocan con la carrocería, ese vértice se ve desde fuera: asoma. Devuelve, por pieza, cuántos vértices asoman y dónde.
#
# Uso (dentro de Blender, con la escena «VS6»):
#   exec(open(r"<repo>/scripts/blender/vs6-fit-check.py", encoding="utf-8").read()); fit_check()
import bpy, bmesh, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

SHELL = ["chasis", "pontones", "carroceria_baja", "tapa_motor", "suelo", "ala_delantera", "ala_trasera"]
INSIDE = ["motor", "admision", "turbo", "escape", "hibrido", "caja_cambios", "radiadores", "pedales"]


def _directions():
    out = []
    for elev in (-90, -60, -30, -8, 12, 32, 52, 72, 90):
        for az in range(0, 360, 20):
            e, a = math.radians(elev), math.radians(az)
            d = Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
            if abs(d.x) < 0.72:                       # ni hacia delante ni hacia atrás: ahí hay bocas reales
                out.append(d)
    return out


def fit_check(inside=INSIDE, cell=0.05, leaks=3):
    bm = bmesh.new()
    for n in SHELL:
        bm.from_mesh(bpy.data.objects["vs6_" + n].data)
    tree = BVHTree.FromBMesh(bm)
    dirs = _directions()
    report = {}
    for n in inside:
        ob = bpy.data.objects["vs6_" + n]
        bad, cells = 0, {}
        for v in ob.data.vertices:
            p = ob.matrix_world @ v.co
            free = [d for d in dirs if tree.ray_cast(p + d * 0.0005, d, 6.0)[0] is None]
            if len(free) >= leaks:                    # un solo rayo suelto es una rendija entre piezas, no se ve
                bad += 1
                key = (round(round(p.x / cell) * cell, 2), round(round(p.y / cell) * cell, 2), round(round(p.z / cell) * cell, 2))
                cells[key] = cells.get(key, 0) + 1
        report[n] = {"vertices": len(ob.data.vertices), "asoman": bad, "donde": sorted(cells.items(), key=lambda kv: -kv[1])[:14]}
    bm.free()
    return report
