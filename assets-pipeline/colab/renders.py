"""Roda no Colab. Instala o Blender e renderiza os 8 equipamentos em Cycles."""
import os
import subprocess
import sys

WORK = "/content/mi360"
OUT = f"{WORK}/out/equipment"
URL = "https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz"
BLENDER = "/content/blender-5.2.2-linux-x64/blender"

# nome, modelo, yaw, pitch, cor opcional
SHOTS = [
    ("bc-101", "bc-101", 150, 16, None),
    ("bc-102", "bc-101", 215, 20, None),
    ("bs-201", "bs-201", 35, 16, None),
    ("bs-202", "bs-201", 300, 18, "0.09,0.12,0.22"),
    ("mt-301", "mt-301", 35, 16, None),
    ("mt-302", "mt-301", 320, 20, "0.05,0.16,0.09"),
    ("cm-401", "cm-401", 30, 18, None),
    ("tr-501", "tr-501", 28, 12, None),
]


def run(cmd):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


if not os.path.exists(BLENDER):
    run(["apt-get", "-qq", "install", "-y", "libxi6", "libxxf86vm1", "libxfixes3", "libxrender1",
         "libgl1", "libsm6", "libxkbcommon0"])
    run(["curl", "-sSfL", "-o", "/content/blender.tar.xz", URL])
    run(["tar", "-xf", "/content/blender.tar.xz", "-C", "/content"])

os.makedirs(OUT, exist_ok=True)
samples = sys.argv[1] if len(sys.argv) > 1 else "384"
for name, model, yaw, pitch, tint in SHOTS:
    target = f"{OUT}/{name}.png"
    if os.path.exists(target):
        continue
    cmd = [BLENDER, "-b", "-P", f"{WORK}/blender/render.py", "--", f"{WORK}/input/{model}.glb", target,
           "--engine", "CYCLES", "--width", "1600", "--samples", samples, "--yaw", str(yaw), "--pitch", str(pitch)]
    if tint:
        cmd += ["--tint", tint]
    run(cmd)
print("RENDERS_OK", flush=True)
