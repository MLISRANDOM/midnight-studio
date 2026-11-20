"""Draw each storyboard shot as one original still with four CPU diffusion steps."""
import json
import sys
from pathlib import Path

import torch
from diffusers import DiffusionPipeline

def draw(model, work):
    torch.set_num_threads(4)
    pipe = DiffusionPipeline.from_pretrained(str(model),torch_dtype=torch.float32,local_files_only=True)
    pipe.enable_attention_slicing()
    plan=json.loads((work/"storyboard.json").read_text())
    for i,shot in enumerate(plan["shots"],1):
        prompt=f"Cinematic illustrated storybook still, detailed ink illustration, flat colors, dramatic lighting. {shot['picture']}. {plan['visual_design']}. No writing, no captions."
        for attempt in range(2):
            seed=917*i+attempt
            with torch.inference_mode():
                result=pipe(prompt=prompt,width=576,height=320,num_inference_steps=4,guidance_scale=6.0,
                            generator=torch.Generator().manual_seed(seed))
            if not any(result.nsfw_content_detected or []):
                result.images[0].convert("RGB").save(work/f"shot-{i}.png")
                print("Generated still",i,flush=True)
                break
        else:
            raise RuntimeError("Image generation did not return an approved still.")
if __name__=="__main__":
    draw(Path(sys.argv[1]),Path(sys.argv[2]))
