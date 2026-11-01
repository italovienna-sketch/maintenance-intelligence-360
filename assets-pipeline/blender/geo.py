"""Primitivas bmesh em milímetros."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def material(name, rgb, metallic=0.0, roughness=0.5):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    m.diffuse_color = (*rgb, 1.0)
    return m


def part(name, mat, build):
    """Cria um objeto: `build(bm)` escreve a geometria em coordenadas finais."""
    bm = bmesh.new()
    build(bm)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def place(bm, verts, axis=(1, 0, 0), origin=(0, 0, 0), spin_deg=0.0):
    """Orienta uma primitiva feita ao longo de +X: gira X -> axis e translada para origin (mm)."""
    rot = Vector((1, 0, 0)).rotation_difference(Vector(axis).normalized()).to_matrix().to_4x4()
    spin = Matrix.Rotation(math.radians(spin_deg), 4, "X")
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(origin) * MM) @ rot @ spin, verts=verts)
    return verts


def revolve(bm, profile, segs=64, smooth=True, sharp_deg=35.0, closed=False, phase=0.0):
    """Sólido de revolução em torno de X. profile = [(x, r), ...] em mm."""
    rings = []
    for x, r in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((x * MM, 0, 0))])
        else:
            rings.append([
                bm.verts.new((x * MM, r * math.cos(phase + 2 * math.pi * i / segs) * MM,
                              r * math.sin(phase + 2 * math.pi * i / segs) * MM))
                for i in range(segs)
            ])
    n = len(profile)
    for i in list(range(n - 1)) + ([n - 1] if closed else []):
        a, b = rings[i], rings[(i + 1) % n]
        if len(a) == 1 and len(b) == 1:
            continue
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(a) == 1:
                f = bm.faces.new((a[0], b[k2], b[k]))
            elif len(b) == 1:
                f = bm.faces.new((a[k], a[k2], b[0]))
            else:
                f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
            f.smooth = smooth
    if smooth:
        bm.edges.ensure_lookup_table()
        for i in range(n):
            if len(rings[i]) == 1:
                continue
            p0 = profile[i - 1] if (i > 0 or closed) else None
            p1 = profile[(i + 1) % n] if (i < n - 1 or closed) else None
            sharp = p0 is None or p1 is None
            if not sharp:
                d0 = Vector((profile[i][0] - p0[0], profile[i][1] - p0[1]))
                d1 = Vector((p1[0] - profile[i][0], p1[1] - profile[i][1]))
                sharp = d0.length < 1e-9 or d1.length < 1e-9 or math.degrees(d0.angle(d1)) > sharp_deg
            if sharp:
                for k in range(segs):
                    e = bm.edges.get((rings[i][k], rings[i][(k + 1) % segs]))
                    if e:
                        e.smooth = False
    return [v for r in rings for v in r]


def cylinder(bm, r, length, segs=48):
    return revolve(bm, [(0, 0), (0, r), (length, r), (length, 0)], segs=segs)


def tube(bm, r_in, r_out, length, segs=64):
    return revolve(bm, [(0, r_in), (0, r_out), (length, r_out), (length, r_in)], segs=segs, closed=True)


def hex_prism(bm, across_flats, length):
    rc = across_flats / 2 / math.cos(math.pi / 6)
    return revolve(bm, [(0, 0), (0, rc), (length, rc), (length, 0)], segs=6, smooth=False, phase=math.pi / 6)


def torus(bm, R, r, segs=64, tsegs=14):
    prof = [(r * math.cos(2 * math.pi * j / tsegs), R + r * math.sin(2 * math.pi * j / tsegs)) for j in range(tsegs)]
    return revolve(bm, prof, segs=segs, closed=True, sharp_deg=90)


def box(bm, x0, x1, y0, y1, z0, z1):
    vs = [bm.verts.new((x * MM, y * MM, z * MM)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    for q in [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]:
        bm.faces.new([vs[i] for i in q])
    return vs


def ring_extrude(bm, outer, inner, x0, x1):
    """Anel extrudado em X entre dois contornos YZ com o mesmo número de pontos."""
    layers = [[bm.verts.new((x * MM, y * MM, z * MM)) for y, z in c]
              for x, c in ((x0, outer), (x1, outer), (x1, inner), (x0, inner))]
    n = len(outer)
    for a in range(4):
        la, lb = layers[a], layers[(a + 1) % 4]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((la[i], la[j], lb[j], lb[i]))
    return [v for layer in layers for v in layer]
