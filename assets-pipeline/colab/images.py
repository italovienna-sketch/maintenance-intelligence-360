"""Roda no Colab. Gera as imagens ilustrativas de antes/depois com SDXL 1.0 (licença OpenRAIL++-M)."""
import json
import os

import torch
from diffusers import DiffusionPipeline

OUT = "/content/mi360/out/maintenance2"
CANDIDATES = 8
STYLE = ("documentary photo taken on a phone in an industrial maintenance workshop, natural light, "
         "shallow depth of field, realistic grime, sharp focus")
NEGATIVE = ("text, letters, logo, watermark, brand, label, hands, people, face, cartoon, illustration, "
            "render, deformed, blurry, oversaturated")

PROMPTS = {
    "rolamento-gasto": "single deep groove ball bearing lying on a workbench, visible steel balls and cage, rusty pitted raceway, black dirty grease, close up",
    "rolamento-novo": "single new deep groove ball bearing lying on a clean workbench, visible shiny steel balls and cage, close up",
    "placa-gasta": "flat round steel disc lying on a workbench, deep circular scratches and rust on its flat face, close up",
    "correia-gasta": "single frayed black rubber V-belt installed in the groove of a cast iron pulley, cracked rubber with loose cords, close up",
    "correia-nova": "two new black rubber V-belts running in the grooves of a cast iron pulley, close up",
    "motor-sujo": "side view of a blue painted industrial electric motor with parallel horizontal cooling fins, fins coated with thick grey dust and grime, in a factory",
    "motor-limpo": "side view of a blue painted industrial electric motor with parallel horizontal cooling fins, freshly cleaned, in a factory",
}

os.makedirs(OUT, exist_ok=True)
pipe = DiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
).to("cuda")
pipe.set_progress_bar_config(disable=True)

used = {}
for name, prompt in PROMPTS.items():
    for i in range(CANDIDATES):
        path = f"{OUT}/{name}-{i}.png"
        if os.path.exists(path):
            continue
        seed = 3600 + i * 101 + len(used)
        image = pipe(f"{prompt}, {STYLE}", negative_prompt=NEGATIVE, width=1152, height=864,
                     num_inference_steps=40, guidance_scale=6.5,
                     generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        image.save(path)
        used[f"{name}-{i}"] = {"prompt": prompt, "seed": seed}
        print(name, i, flush=True)

with open(f"{OUT}/prompts.json", "w") as f:
    json.dump({"style": STYLE, "negative": NEGATIVE, "images": used}, f, indent=2)
print("IMAGES_OK", flush=True)
