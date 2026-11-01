"""Converte os renders e as imagens escolhidas para WEBP e lista a origem de cada imagem.

py -I assets-pipeline/export_images.py > assets-pipeline/image-sources.md
"""
import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIPE = ROOT / "assets-pipeline"
PASS1 = PIPE / "colab-out/out/maintenance"
PASS2 = PIPE / "colab-out2/out/maintenance2"
PASS3 = PIPE / "colab-out3/out/maintenance3"

PICKS = {
    "rolamento-gasto": PASS2 / "rolamento-gasto-2",
    "rolamento-novo": PASS2 / "rolamento-novo-6",
    "selo-gasto": PASS1 / "selo-gasto-1",
    "selo-novo": PASS1 / "selo-novo-0",
    "rotor-entupido": PASS1 / "rotor-entupido-2",
    "rotor-limpo": PASS3 / "rotor-limpo-6",
    "placa-gasta": PASS2 / "placa-gasta-1",
    "placa-nova": PASS1 / "placa-nova-0",
    "correia-gasta": PASS2 / "correia-gasta-6",
    "correia-nova": PASS2 / "correia-nova-0",
    "motor-sujo": PASS2 / "motor-sujo-0",
    "motor-limpo": PASS3 / "motor-limpo-0",
}

equipment = ROOT / "public/images/equipment"
maintenance = ROOT / "public/images/maintenance"
equipment.mkdir(parents=True, exist_ok=True)
maintenance.mkdir(parents=True, exist_ok=True)

for png in sorted((PIPE / "colab-out3/out/equipment").glob("*.png")):
    Image.open(png).save(equipment / f"{png.stem}.webp", quality=88, method=6)

print("| Imagem | Rodada | Seed | Prompt |\n|---|---|---|---|")
for name, source in PICKS.items():
    Image.open(source.with_suffix(".png")).convert("RGB").save(maintenance / f"{name}.webp", quality=84, method=6)
    meta = json.loads((source.parent / "prompts.json").read_text())["images"].get(source.name)
    seed, prompt = (meta["seed"], meta["prompt"]) if meta else ("não registrado", "não registrado")
    print(f"| `{name}.webp` | {source.parent.name} | {seed} | {prompt} |")
