"""Modelos paramétricos fictícios para a demo. Formas genéricas de catálogo, sem cotas de fabricante.

Uso: blender -b -P build_families.py -- <pasta de saída>
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo  # noqa: E402
from geo import box, cylinder, hex_prism, part, place, revolve, torus, tube  # noqa: E402


def mats():
    return {
        "blue": geo.material("pintura_azul", (0.05, 0.16, 0.30), 0.0, 0.38),
        "green": geo.material("pintura_verde", (0.07, 0.20, 0.14), 0.0, 0.40),
        "grey": geo.material("pintura_cinza", (0.18, 0.20, 0.22), 0.0, 0.42),
        "iron": geo.material("ferro_fundido", (0.05, 0.055, 0.06), 0.3, 0.55),
        "steel": geo.material("aco", (0.62, 0.63, 0.65), 1.0, 0.28),
        "zinc": geo.material("zincado", (0.72, 0.72, 0.68), 1.0, 0.38),
        "rubber": geo.material("borracha", (0.012, 0.012, 0.014), 0.0, 0.62),
        "yellow": geo.material("seguranca_amarelo", (0.85, 0.55, 0.03), 0.0, 0.40),
    }


def bolt_circle(bm, count, R, x, af, length, axis=(1, 0, 0), origin=(0, 0, 0)):
    for i in range(count):
        a = 2 * math.pi * i / count
        vs = hex_prism(bm, af, length)
        place(bm, vs, origin=(x, R * math.cos(a), R * math.sin(a)))
        if axis != (1, 0, 0) or origin != (0, 0, 0):
            place(bm, vs, axis=axis, origin=origin)


def motor(prefix, m, paint, L=560, R=170, origin=(0, 0, 0), shaft=110, foot_z=None):
    """Motor TEFC horizontal. Ponta de eixo em -X, ventilador em +X."""
    ox, oy, oz = origin
    at = lambda bm, vs, **k: place(bm, vs, origin=(ox, oy, oz), **k)
    foot_z = foot_z if foot_z is not None else -(R + 46)

    def frame(bm):
        at(bm, revolve(bm, [(40, 0), (40, R * .98), (52, R), (L - 52, R), (L - 40, R * .98), (L - 40, 0)]))
        for i in range(40):  # aletas radiais
            a = 360 * i / 40
            if 245 < a % 360 < 295:
                continue
            vs = box(bm, 58, L - 58, -3.2, 3.2, R - 4, R + 15)
            at(bm, place(bm, vs, spin_deg=a))
    part(f"{prefix}_FRAME", paint, frame)

    def bells(bm):
        at(bm, revolve(bm, [(0, 0), (0, R * .34), (6, R * .36), (10, R * .62), (40, R * 1.03), (46, R * 1.03), (46, 0)]))
        at(bm, revolve(bm, [(L - 46, 0), (L - 46, R * 1.03), (L - 28, R * 1.03), (L - 18, R * .86), (L - 18, 0)]))
    part(f"{prefix}_END_SHIELDS", paint, bells)

    def fan_cover(bm):
        at(bm, revolve(bm, [(L - 28, R * .96), (L - 28, R * 1.02), (L + 110, R * 1.02), (L + 140, R * .84),
                            (L + 150, R * .62), (L + 150, 0)]))
    part(f"{prefix}_FAN_COVER", paint, fan_cover)

    def grille(bm):
        for r in (R * .15, R * .27, R * .39, R * .51):
            at(bm, place(bm, torus(bm, r, 3.5, segs=48, tsegs=8), origin=(L + 152, 0, 0)))
    part(f"{prefix}_FAN_GRILLE", m["rubber"], grille)

    def shaft_end(bm):
        at(bm, place(bm, cylinder(bm, R * .17, shaft + 30), axis=(-1, 0, 0), origin=(30, 0, 0)))
        at(bm, box(bm, -shaft + 12, -14, -5, 5, R * .17 - 2, R * .17 + 3))
    part(f"{prefix}_SHAFT", m["steel"], shaft_end)

    def terminal(bm):
        c = L * .48
        at(bm, box(bm, c - 65, c + 65, -62, 62, R + 8, R + 96))
        at(bm, box(bm, c - 72, c + 72, -68, 68, R + 96, R + 106))
        at(bm, place(bm, cylinder(bm, 19, 34), axis=(0, 1, 0), origin=(c, 62, R + 52)))
    part(f"{prefix}_TERMINAL_BOX", paint, terminal)

    def feet(bm):
        for x0, x1 in ((48, 170), (L - 170, L - 48)):
            at(bm, box(bm, x0, x1, -R * .96, R * .96, foot_z, foot_z + 18))
            at(bm, box(bm, x0 + 18, x1 - 18, -R * .72, R * .72, foot_z + 16, -R * .62))
    part(f"{prefix}_FEET", paint, feet)

    def eye(bm):
        at(bm, place(bm, torus(bm, 24, 7, segs=32, tsegs=8), axis=(0, 1, 0), origin=(L * .22, 0, R + 44)))
        at(bm, box(bm, L * .22 - 10, L * .22 + 10, -10, 10, R + 8, R + 22))
    part(f"{prefix}_LIFTING_EYE", m["zinc"], eye)


def submersible(m):
    """Bomba submersível vertical: motor em cima, voluta e pé de apoio embaixo. Eixo em Z."""
    up = (0, 0, 1)

    def housing(bm):
        place(bm, revolve(bm, [(250, 0), (250, 150), (262, 165), (640, 165), (660, 150), (700, 118), (712, 0)]), axis=up)
        for i in range(10):  # nervuras de refrigeração
            vs = box(bm, 290, 630, -5, 5, 160, 176)
            place(bm, place(bm, vs, spin_deg=i * 36), axis=up)
    part("BS_MOTOR_HOUSING", m["green"], housing)

    def flange(bm):
        place(bm, revolve(bm, [(236, 0), (236, 186), (262, 186), (262, 0)]), axis=up)
        place(bm, revolve(bm, [(640, 0), (640, 182), (662, 182), (662, 0)]), axis=up)
    part("BS_FLANGES", m["iron"], flange)

    def bolts(bm):
        for z, r in ((262, 172), (662, 170)):
            for i in range(12):
                a = 2 * math.pi * i / 12
                place(bm, hex_prism(bm, 21, 12), axis=up, origin=(r * math.cos(a), r * math.sin(a), z))
    part("BS_BOLTS", m["zinc"], bolts)

    def volute(bm):
        n = 72
        layers = []
        for z, scale in ((70, 0.86), (84, 1.0), (222, 1.0), (240, 0.86)):
            ring = []
            for i in range(n):
                a = 2 * math.pi * i / n
                r = (232 + 92 * (i / n) ** 1.3) * scale
                ring.append(bm.verts.new((r * math.cos(a) * geo.MM, r * math.sin(a) * geo.MM, z * geo.MM)))
            layers.append(ring)
        for la, lb in zip(layers, layers[1:]):
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((la[i], la[j], lb[j], lb[i])).smooth = True
        bm.faces.new(list(reversed(layers[0])))
        bm.faces.new(layers[-1])
    part("BS_VOLUTE", m["iron"], volute)

    def discharge(bm):
        place(bm, cylinder(bm, 76, 330), axis=(0.25, 1, 0), origin=(40, 180, 156))
        place(bm, tube(bm, 66, 118, 22), axis=(0.25, 1, 0), origin=(122, 500, 156))
    part("BS_DISCHARGE", m["iron"], discharge)

    def legs(bm):
        for i in range(3):
            a = math.radians(90 + 120 * i)
            place(bm, cylinder(bm, 30, 76), axis=up, origin=(190 * math.cos(a), 190 * math.sin(a), 0))
        place(bm, tube(bm, 150, 215, 14), axis=up, origin=(0, 0, 0))
    part("BS_STAND", m["iron"], legs)

    def handle(bm):
        for s in (-1, 1):
            place(bm, cylinder(bm, 12, 90), axis=up, origin=(s * 110, 0, 696))
        place(bm, cylinder(bm, 12, 220), axis=(1, 0, 0), origin=(-110, 0, 786))
        place(bm, torus(bm, 34, 10, segs=32, tsegs=8), axis=(0, 1, 0), origin=(0, 0, 824))
    part("BS_HANDLE", m["zinc"], handle)

    def cable_gland(bm):
        place(bm, cylinder(bm, 30, 44), axis=up, origin=(-82, 66, 696))
    part("BS_CABLE_GLAND", m["zinc"], cable_gland)

    def cable(bm):
        pts = [(-82 - 90 * (1 - math.cos(t * math.pi / 2)) - 260 * t ** 3,
                66 - 60 * t,
                735 + 190 * math.sin(t * math.pi * .72) - 460 * t ** 3) for t in (i / 36 for i in range(37))]
        for a, b in zip(pts, pts[1:]):
            d = tuple(q - p for p, q in zip(a, b))
            length = math.dist(a, b)
            place(bm, cylinder(bm, 11, length * 1.08, segs=14), axis=d, origin=a)
    part("BS_CABLE", m["rubber"], cable)


def base_plate(m, x0, x1, half_w, z_top, name):
    def build(bm):
        box(bm, x0, x1, -half_w, half_w, z_top - 16, z_top)
        for s in (-1, 1):
            box(bm, x0, x1, s * half_w - 34, s * half_w + 34, z_top - 130, z_top - 16)
        box(bm, x0, x1, -half_w - 34, half_w + 34, z_top - 146, z_top - 130)
    part(name, m["grey"], build)


def motopump(m):
    """Bomba horizontal em base comum com motor e acoplamento sob proteção."""
    center = 260
    base_plate(m, -760, 1000, 240, 0, "CM_BASE")
    motor("CM_MOTOR", m, m["blue"], L=470, R=140, origin=(250, 0, center), shaft=96, foot_z=-center)

    def bracket(bm):
        place(bm, revolve(bm, [(-330, 92), (-300, 100), (-130, 86), (-96, 96), (-60, 96), (-60, 0), (-330, 0)]),
              origin=(0, 0, center))
        box(bm, -320, -180, -86, 86, center - 170, center - 60)
        box(bm, -340, -160, -130, 130, 0, 20)
    part("CM_BEARING_BRACKET", m["green"], bracket)

    def casing(bm):
        place(bm, revolve(bm, [(-560, 0), (-560, 60), (-530, 90), (-470, 228), (-420, 250), (-352, 250), (-330, 212), (-330, 0)]),
              origin=(0, 0, center))
        box(bm, -500, -360, -150, 150, 0, 20)
        box(bm, -470, -390, -120, 120, 18, center - 190)
    part("CM_PUMP_CASING", m["green"], casing)

    def nozzles(bm):
        place(bm, cylinder(bm, 64, 220), axis=(-1, 0, 0), origin=(-540, 0, center))
        place(bm, tube(bm, 56, 112, 20), axis=(-1, 0, 0), origin=(-740, 0, center))
        place(bm, cylinder(bm, 52, 210), axis=(0, 0, 1), origin=(-430, 0, center + 200))
        place(bm, tube(bm, 44, 96, 20), axis=(0, 0, 1), origin=(-430, 0, center + 400))
    part("CM_NOZZLES", m["iron"], nozzles)

    def nozzle_bolts(bm):
        for i in range(8):
            a = 2 * math.pi * i / 8
            place(bm, hex_prism(bm, 20, 11), axis=(-1, 0, 0),
                  origin=(-760, 90 * math.cos(a), center + 90 * math.sin(a)))
            place(bm, hex_prism(bm, 18, 11), axis=(0, 0, 1),
                  origin=(-430 + 74 * math.cos(a), 74 * math.sin(a), center + 420))
    part("CM_NOZZLE_BOLTS", m["zinc"], nozzle_bolts)

    def guard(bm):
        place(bm, revolve(bm, [(-66, 0), (-66, 118), (168, 118), (168, 0)]), origin=(0, 0, center))
        box(bm, 10, 90, -118, 118, 0, center - 80)
    part("CM_COUPLING_GUARD", m["yellow"], guard)


def transmission(m):
    """Transmissão por correias em V, de eixos horizontais, com as polias à vista."""
    from geo import ring_extrude

    z1, r1 = 240, 150
    z2, r2 = 800, 104
    width = 92

    def pulley_profile(r):
        n = [(0, 0), (0, r), (5, r), (14, r - 34), (24, r - 34), (33, r), (46, r), (46 + 9, r - 34),
             (46 + 19, r - 34), (46 + 28, r), (92, r), (92, 0)]
        return n

    part("TR_DRIVE_PULLEY", m["iron"], lambda bm: place(bm, revolve(bm, pulley_profile(r1), segs=96, sharp_deg=20), origin=(-46, 0, z1)))
    part("TR_DRIVEN_PULLEY", m["iron"], lambda bm: place(bm, revolve(bm, pulley_profile(r2), segs=96, sharp_deg=20), origin=(-46, 0, z2)))

    def outline(r_a, r_b):
        d = z2 - z1
        beta = math.asin((r_a - r_b) / d)
        pts = []
        n = 56
        for i in range(n + 1):  # arco inferior, na polia maior
            a = math.pi - (-beta) + (math.pi + 2 * beta) * i / n
            pts.append((r_a * math.cos(a), z1 + r_a * math.sin(a)))
        for i in range(n + 1):  # arco superior, na polia menor
            a = beta + (math.pi - 2 * beta) * i / n
            pts.append((r_b * math.cos(a), z2 + r_b * math.sin(a)))
        return pts

    def belts(bm):
        for x in (-46 + 19 - 8 - 9, -46 + 19 + 37):
            ring_extrude(bm, outline(r1 - 4, r2 - 4), outline(r1 - 26, r2 - 26), x, x + 22)
    part("TR_BELTS", m["rubber"], belts)

    def shafts(bm):
        place(bm, cylinder(bm, 32, 660), origin=(-340, 0, z1))
        place(bm, cylinder(bm, 28, 560), origin=(-280, 0, z2))
    part("TR_SHAFTS", m["steel"], shafts)

    def bearings(bm):
        for x, z, r in ((-250, z1, 80), (230, z1, 80), (-210, z2, 72), (200, z2, 72)):
            place(bm, revolve(bm, [(-34, 0), (-34, r * .62), (-20, r), (20, r), (34, r * .62), (34, 0)]), origin=(x, 0, z))
    part("TR_BEARINGS", m["blue"], bearings)

    def frame(bm):
        for x in (-250, 230):
            box(bm, x - 22, x + 22, -66, 66, 16, z1 - 60)
            box(bm, x - 22, x + 22, 66, 110, 16, z2 + 30)
            box(bm, x - 90, x + 90, -130, 130, 0, 16)
        box(bm, -272, 252, 66, 110, z2 + 30, z2 + 74)
        for x in (-210, 200):
            box(bm, x - 22, x + 22, -60, 66, z2 - 90, z2 - 50)
    part("TR_FRAME", m["grey"], frame)

    def guard_back(bm):
        box(bm, -110, 110, 116, 124, 70, 950)
        box(bm, -110, 110, -130, 124, 942, 950)
    part("TR_GUARD", m["yellow"], guard_back)


def export(name, out):
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"{name}.glb"), export_format="GLB",
                              export_extras=False, export_apply=False)


def main():
    out = sys.argv[sys.argv.index("--") + 1]
    os.makedirs(out, exist_ok=True)
    jobs = {
        "mt-301": lambda m: motor("MT", m, m["blue"]),
        "bs-201": submersible,
        "cm-401": motopump,
        "tr-501": transmission,
    }
    for name, build in jobs.items():
        geo.reset_scene()
        build(mats())
        export(name, out)
        print("OK", name, len(bpy.data.objects))


main()
