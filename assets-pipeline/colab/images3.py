"""Roda no Colab. Terceira rodada: só os "depois" que saíram sujos nas rodadas anteriores."""
import json
import os

import torch
from diffusers import DiffusionPipeline

OUT = "/content/mi360/out/maintenance3"
CANDIDATES = 10
STYLE = ("documentary photo taken in an industrial maintenance workshop, natural light, "
         "shallow depth of field, sharp focus")
NEGATIVE = ("text, letters, logo, watermark, brand, label, hands, people, face, cartoon, illustration, "
            "render, deformed, blurry, oversaturated, rust, dirt, dust, grime, corrosion, scratches")

PROMPTS = {
    "rotor-limpo": "freshly cleaned cast iron centrifugal pump impeller with curved vanes, smooth clean grey metal, lying on a clean steel workbench, close up",
    "motor-limpo": "side view of a clean blue painted industrial electric motor on a workshop bench, glossy intact paint, straight parallel horizontal cooling fins, spotless",
}

os.makedirs(OUT, exist_ok=True)
pipe = DiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
).to("cuda")
pipe.set_progress_bar_config(disable=True)

used = {}
for name, prompt in PROMPTS.items():
    for i in range(CANDIDATES):
        seed = 7200 + i * 101 + len(used)
        image = pipe(f"{prompt}, {STYLE}", negative_prompt=NEGATIVE, width=1152, height=864,
                     num_inference_steps=40, guidance_scale=6.5,
                     generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        image.save(f"{OUT}/{name}-{i}.png")
        used[f"{name}-{i}"] = {"prompt": prompt, "seed": seed}
        print(name, i, flush=True)

with open(f"{OUT}/prompts.json", "w") as f:
    json.dump({"style": STYLE, "negative": NEGATIVE, "images": used}, f, indent=2)
print("IMAGES_OK", flush=True)
