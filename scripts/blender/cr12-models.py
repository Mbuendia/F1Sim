# [CR12, 13/11/2026] Edificios con su aspecto real: la boca de paso bajo la pista (rehecha: una abertura en un talud de
# tierra, no un pórtico suelto), el centro deportivo y acuático de Albert Park (Melbourne) y el edificio de los atletas
# del canal olímpico de remo (Montreal). Modelados en Blender (5.x), estilo propio, sin marcas reales.
# Referencias (solo para la forma y los colores; no se copia geometría ni se usan las fotos):
#   - Wikimedia Commons, «Melbourne sports and aquatic centre from albert park lake.jpg» (categoría Melbourne Sports and
#     Aquatic Centre): naves bajas de chapa gris con cubiertas claras y, detrás, la nave alta gris oscuro de la piscina
#     de competición, con mástiles blancos y la cubierta de lona en picos.
#   - Parc Jean-Drapeau, ficha del Bassin olympique: barrio de los atletas, pabellón de administración, gradas, hangares
#     y torre de salida y llegada a lo largo del canal.
#   - Plantas y medidas: OpenStreetMap (© colaboradores de OpenStreetMap, ODbL).
# Uso (sin interfaz):
#   blender -b --factory-startup --python scripts/blender/cr12-models.py -- <repo> [nombres]
# Mismas reglas que scenery-models.py: largo en +X, ancho en Y, alto en +Z, frente en +Y.
import bpy, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
REPO = argv[0] if argv else os.getcwd()
exec(open(os.path.join(REPO, "scripts", "blender", "cr5-models.py"), encoding="utf-8").read().split("MODELS_CR5 = {")[0])


def boca_tunel():
    """Boca de un paso bajo la pista (12 × 8 m, 4,6 m libres): un muro de hormigón con la abertura, metido en un talud de
    tierra que baja hacia los lados y hacia atrás, con muros de acompañamiento, quitamiedos arriba y luces dentro. La
    abertura mira a +Y. La planta es la de antes, para que siga en su sitio."""
    concrete, dark, black = mat("concrete", "#b9bcbf"), mat("concrete_dark", "#7c8085"), mat("tunnel", "#101214")
    grass, steel, asphalt = mat("talud", "#3f6b33"), mat("steel", "#8a9099", 0.6, 0.35), mat("asphalt", "#33363b")
    luz = mat("luz", "#fff1c8", emission="#fff1c8")
    W, D, H = 12.0, 8.0, 5.8
    open_w, open_h = 8.4, 4.6
    side = (W - open_w) / 2
    face = D / 2 - 0.6
    # Talud: lleno entre los muros y bajando a cero a 4,5 m de cada lado; la espalda cae en rampa.
    ring = lambda h: [(-D / 2 - 0.1, 0.0), (face - 0.6, 0.0), (face - 0.6, h), (-D / 2 + 2.2, h)]
    loft([(-W / 2 - 4.5, ring(0.25)), (-W / 2, ring(H - 0.5)), (W / 2, ring(H - 0.5)), (W / 2 + 4.5, ring(0.25))], grass, "talud")
    for s in (-1, 1):
        box(s * (open_w / 2 + side / 2), face, 0, side, 1.2, H, concrete)                  # jambas
        # Muro de acompañamiento, que baja con el talud.
        prism([(s * W / 2, face - 0.6), (s * (W / 2 + 4.5), face - 0.6), (s * (W / 2 + 4.5), face), (s * W / 2, face)], 0, 1.1, dark)
        prism([(s * W / 2, face - 0.6), (s * (W / 2 + 2.2), face - 0.6), (s * (W / 2 + 2.2), face), (s * W / 2, face)], 1.1, 3.2, dark)
    box(0, face, open_h, open_w + 0.02, 1.2, H - open_h, concrete)                          # dintel
    box(0, face + 0.1, H, W + 0.6, 1.5, 0.35, dark)                                         # albardilla
    box(0, face - 0.2, H + 0.35, W, 0.12, 0.9, steel)                                       # quitamiedos
    box(0, -0.4, 0, open_w, D - 1.6, 0.05, asphalt)                                         # calzada del interior
    box(0, face + 2.6, 0, open_w, 4.0, 0.04, asphalt)                                       # calzada de la entrada
    for s in (-1, 1):
        box(s * (open_w / 2 - 0.1), -0.4, 0, 0.3, D - 1.6, open_h, black)                   # paredes del interior
    box(0, -0.4, open_h - 0.05, open_w, D - 1.6, 0.3, black)                                # techo del interior
    box(0, -D / 2 + 0.5, 0, open_w, 0.3, open_h, black)                                     # fondo
    for y in (-2.4, 0.4):
        box(0, y, open_h - 0.22, 1.4, 0.3, 0.1, luz)


def centro_acuatico_melbourne():
    """Centro deportivo y acuático de Albert Park (250 × 160 m): naves bajas de chapa gris con cubiertas claras en lomo,
    la nave alta gris oscuro de la piscina de competición con cinco mástiles blancos y la lona en picos, bandas de
    vidrio hacia el lago (+Y), marquesina de entrada y la piscina exterior con su cubierta ligera."""
    chapa, oscuro, claro = mat("chapa", "#aeb4ba", 0.4, 0.5), mat("chapa_oscura", "#5b6269", 0.4, 0.5), mat("cubierta", "#dfe3e6", 0.3, 0.45)
    lona, vidrio, hormigon = mat("lona", "#f4f5f3"), mat("vidrio", "#3f5564", 0.2, 0.2), mat("hormigon", "#c4c6c8")
    acero, agua = mat("acero_blanco", "#eef0f1", 0.5, 0.4), mat("agua", "#3aa0c8", 0.0, 0.2)
    # Nave principal (piscinas y pabellones), con la cubierta en lomo a lo largo.
    box(-40, 5, 0, 160, 110, 11, chapa)
    for y, h in ((-38, 1.0), (-19, 2.3), (0, 3.0), (19, 2.3), (38, 1.0)):
        box(-40, 5 + y * 1.25, 11, 160, 24, h, claro)
    box(-40, 60.3, 1.5, 150, 0.5, 6.5, vidrio)                                              # frente de vidrio al lago
    # Nave alta de la piscina de competición.
    box(78, 10, 0, 84, 96, 18, oscuro)
    box(78, 58.3, 2, 76, 0.5, 11, vidrio)
    for k in range(5):
        x = 78 - 32 + 16 * k
        cyl(x, 10, 18, 0.45, 13, acero, 6)                                                  # mástil
        cyl(x, 10, 18, 12.5, 6.5, lona, 8, r2=0.7)                                          # pico de la lona
    # Alas bajas (gimnasios, vestuarios) y cuerpo de entrada.
    box(-98, -52, 0, 54, 46, 8, chapa)
    box(-98, -52, 8, 54, 46, 0.8, claro)
    box(96, -52, 0, 48, 36, 7, chapa)
    box(96, -52, 7, 48, 36, 0.8, claro)
    box(18, 66, 0, 46, 10, 6, hormigon)
    box(18, 73, 5.2, 54, 14, 0.5, acero)                                                    # marquesina
    for x in (-6, 42):
        cyl(x, 79, 0, 0.3, 5.2, acero, 6)
    # Piscina exterior, bajo cubierta ligera.
    box(-98, 22, 0, 50, 70, 0.4, hormigon)
    box(-98, 22, 0.4, 26, 52, 0.15, agua)
    box(-98, 22, 9, 54, 74, 0.6, lona)
    for x in (-122, -74):
        for y in (-10, 54):
            cyl(x, y, 0, 0.35, 9, acero, 6)


def canal_olimpico_montreal():
    """Edificio de los atletas del canal olímpico de remo (120 × 26 m): un bloque largo de tres plantas de hormigón claro
    con bandas de ventanas, núcleos de escalera oscuros en los extremos, cubierta plana con casetones y, hacia el canal
    (+Y), la terraza escalonada de las gradas."""
    hormigon, oscuro, vidrio = mat("hormigon", "#d8d6cf"), mat("hormigon_oscuro", "#8c8a84"), mat("vidrio", "#3b4f5c", 0.2, 0.2)
    grada, cubierta, acero = mat("grada", "#b9b7b0"), mat("cubierta", "#9aa0a6", 0.3, 0.5), mat("acero", "#7f868d", 0.5, 0.4)
    L, B, H = 120.0, 14.0, 9.9
    y0 = -6.0                                                                               # el bloque, hacia atrás
    box(0, y0, 0, L, B, H, hormigon)
    for k in range(3):
        for s in (-1, 1):
            box(0, y0 + s * (B / 2 + 0.06), 1.1 + 3.3 * k, L - 14, 0.14, 1.5, vidrio)       # bandas de ventanas
    for s in (-1, 1):
        box(s * (L / 2 - 3.5), y0, 0, 7.4, B + 1.2, H + 1.6, oscuro)                        # núcleos de escalera
    box(0, y0, H, L - 15, B + 0.6, 0.35, cubierta)                                          # peto de la cubierta
    for x in (-36, -8, 22, 44):
        box(x, y0, H + 0.35, 7, 5, 1.6, cubierta)                                           # casetones
    # Gradas hacia el canal: cinco escalones de hormigón y la barandilla de arriba.
    for k in range(5):
        box(0, y0 + B / 2 + 1.3 + 2.4 * k, 0, L - 16, 2.4, 3.6 - 0.7 * k, grada)
    box(0, y0 + B / 2 + 0.2, 3.6, L - 16, 0.1, 1.0, acero)


MODELS_CR12 = {"boca-tunel": boca_tunel, "centro-acuatico-melbourne": centro_acuatico_melbourne,
               "canal-olimpico-montreal": canal_olimpico_montreal}

if __name__ == "__main__":
    out = os.path.join(REPO, "public", "models", "scenery")
    only = argv[1:]
    for name, fn in MODELS_CR12.items():
        if only and name not in only:
            continue
        clear()
        fn()
        print("CR12", finish(name, out))
