"""Render de estúdio de um GLB. Mesmo script para prévia local e para o Cycles na A100.

blender -b -P render.py -- <entrada.glb> <saida.png> --engine CYCLES|WORKBENCH --width 1600
  --yaw 35 --pitch 18 --samples 256 [--tint r,g,b] [--up-y]
"""
import argparse
import math
import sys

import bpy
from mathutils import Vector


def args():
    p = argparse.ArgumentParser()
    p.add_argument("glb")
    p.add_argument("out")
    p.add_argument("--engine", default="CYCLES")
    p.add_argument("--width", type=int, default=1600)
    p.add_argument("--yaw", type=float, default=35)
    p.add_argument("--pitch", type=float, default=18)
    p.add_argument("--samples", type=int, default=256)
    p.add_argument("--tint", default=None)
    return p.parse_args(sys.argv[sys.argv.index("--") + 1:])


def enable_gpu(scene):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
        except TypeError:
            continue
        if gpus:
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            print("GPU:", kind, [d.name for d in gpus])
            return
    raise SystemExit("Nenhuma GPU NVIDIA disponível para o Cycles.")


def bounds(objects):
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for ob in objects:
        for corner in ob.bound_box:
            p = ob.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def area(name, loc, target, size, power, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.size, data.energy, data.color = size, power, color
    ob = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def floor(lo, center, radius):
    bpy.ops.mesh.primitive_plane_add(size=radius * 40, location=(center.x, center.y, lo.z))
    m = bpy.data.materials.new("fundo")
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.62, 0.64, 0.66, 1)
    bsdf.inputs["Roughness"].default_value = 0.55
    bpy.context.object.data.materials.append(m)
    bpy.context.object.is_shadow_catcher = True


def main():
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=a.glb)
    meshes = [o for o in scene.objects if o.type == "MESH"]
    bpy.context.view_layer.update()
    if a.tint:
        rgb = tuple(float(v) for v in a.tint.split(","))
        for m in bpy.data.materials:
            if m.name.startswith(("pintura_azul", "pintura_verde")):
                next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*rgb, 1)

    lo, hi = bounds(meshes)
    center = (lo + hi) / 2
    radius = (hi - lo).length / 2
    yaw, pitch = math.radians(a.yaw), math.radians(a.pitch)
    view = Vector((math.cos(pitch) * math.sin(yaw), -math.cos(pitch) * math.cos(yaw), math.sin(pitch)))

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 70
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = center + view * (radius * 4.7)
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()

    floor(lo, center, radius)
    side = view.cross(Vector((0, 0, 1))).normalized()
    power = 48 * (radius / 0.6) ** 2
    area("key", center + view * radius * 2 + side * radius * 2 + Vector((0, 0, radius * 3)), center, radius * 3, power * 1.6)
    area("fill", center + view * radius * 2 - side * radius * 3 + Vector((0, 0, radius)), center, radius * 4, power * .55, (.9, .95, 1))
    area("rim", center - view * radius * 3 + Vector((0, 0, radius * 2.5)), center, radius * 3, power * 1.3)

    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.64, 0.66, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.3
    scene.world = world
    scene.view_settings.view_transform = "Standard"

    scene.render.resolution_x = a.width
    scene.render.resolution_y = a.width * 3 // 4
    scene.render.filepath = a.out
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    if a.engine == "CYCLES":
        scene.render.engine = "CYCLES"
        scene.render.film_transparent = True
        enable_gpu(scene)
        scene.cycles.samples = a.samples
        scene.cycles.use_denoising = True
    else:
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.show_shadows = True
        scene.display.shading.color_type = "MATERIAL"
    bpy.ops.render.render(write_still=True)


main()
