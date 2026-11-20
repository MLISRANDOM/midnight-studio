"""Illustrate storyboard shots and choose images against the requested scenes."""
import json
import re
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from diffusers import DiffusionPipeline
from transformers import CLIPImageProcessor, CLIPTokenizerFast

from series import SERIES


def illustration_prompt(tokenizer, clauses):
    # CLIP has a fixed text window. Reserve room for the setting, style and action.
    words = []
    for text, budget in clauses:
        tokens = tokenizer.encode(text, add_special_tokens=False, truncation=True, max_length=budget)
        if tokens:
            words.append(tokenizer.decode(tokens).strip(" .,"))
    return ". ".join(words)


def draw(cache, work):
    torch.set_num_threads(4)
    pipe = DiffusionPipeline.from_pretrained(
        str(cache / "art-model"), torch_dtype=torch.float32, local_files_only=True
    )
    pipe.enable_attention_slicing()
    ranker = cache / "ranker"
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    clip = ort.InferenceSession(
        str(ranker / "onnx/model_quantized.onnx"), options, providers=["CPUExecutionProvider"]
    )
    tokenizer = CLIPTokenizerFast.from_pretrained(ranker, local_files_only=True)
    processor = CLIPImageProcessor.from_pretrained(ranker, local_files_only=True)
    plan = json.loads((work / "storyboard.json").read_text())
    series = SERIES.get(plan.get("series"))
    chosen = []
    for index, shot in enumerate(plan["shots"], 1):
        texts = [shot["picture"], plan["setting"], plan["idea"]]
        encoded = tokenizer(texts, padding=True, truncation=True, max_length=77, return_tensors="np")
        # Keep long ideas from using up the illustrator's entire text window.
        premise = plan["idea"] if len(plan["idea"].split()) <= 26 else plan["setting"]
        style = series["style"] if series else "Cinematic ink illustration, flat colors"
        design = plan["visual_design"]
        if series:
            design = " ".join(
                appearance for name, appearance in series["cast"].items()
                if re.search(r"\b" + re.escape(name) + r"\b", shot["picture"], re.I)
            )
        detail = (shot["picture"], 24)
        setting = (plan["setting"], 15)
        look = (design, 15)
        subject = (premise, 10)
        style = (style, 6)
        prompts = [
            illustration_prompt(pipe.tokenizer, [detail, setting, look, style, subject]),
            illustration_prompt(pipe.tokenizer, [setting, detail, look, subject, style]),
        ]
        candidates, seeds = [], []
        for attempt in range(3):
            seed = 917 * index + attempt
            prompt = prompts[attempt % 2]
            with torch.inference_mode():
                result = pipe(
                    prompt=prompt, width=plan["image_size"][0], height=plan["image_size"][1],
                    num_inference_steps=4, guidance_scale=6.0,
                    generator=torch.Generator().manual_seed(seed),
                )
            if result.nsfw_content_detected == [False]:
                candidates.append(result.images[0].convert("RGB"))
                seeds.append(seed)
            if len(candidates) == 2:
                break
        if not candidates:
            raise RuntimeError(f"No usable illustration was returned for shot {index}.")
        pixels = processor(images=candidates, return_tensors="np")["pixel_values"]
        inputs = dict(encoded, pixel_values=pixels)
        feed = {item.name: inputs[item.name] for item in clip.get_inputs()}
        logits, = clip.run(["logits_per_image"], feed)
        # Rank the alternatives within this shot. Scores are not approval probabilities.
        scores = logits @ np.array([0.50, 0.30, 0.20], dtype=np.float32)
        best = int(np.argmax(scores))
        candidates[best].save(work / f"shot-{index}.png")
        chosen.append({"shot": index, "seeds": seeds, "scores": scores.tolist(), "selected": seeds[best]})
        print(f"Selected still {index} from {len(candidates)} candidates", flush=True)
    (work / "image-selection.json").write_text(json.dumps(chosen, indent=2))


if __name__ == "__main__":
    draw(Path(sys.argv[1]), Path(sys.argv[2]))
