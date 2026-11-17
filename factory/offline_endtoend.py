#!/usr/bin/env python3
"""Offline, zero-API-cost full-pipeline test with clearly labeled procedural art.
This is NOT an AI art generator and does not replace production artwork.
"""
import argparse
import hashlib
import json
import math
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter
from episode_factory import video, quality_report
from series_runner import scene_manifest


def draw_scene(shot, output, size=(576, 320)):
    width, height = size
    seed = int(hashlib.sha256(shot["id"].encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    im = Image.new("RGB", size)
    px = im.load()
    for y in range(height):
        for x in range(width):
            noise = rng.randint(-5, 5)
            base = 14 + int(15 * y / height) + noise
            px[x, y] = (max(0, base), max(0, base + 5), max(0, base + 16))
    draw = ImageDraw.Draw(im)
    vanishing_x, vanishing_y = width // 2, int(height * .42)
    draw.polygon([(0, 0), (width, 0), (vanishing_x + 52, vanishing_y),
                  (vanishing_x - 52, vanishing_y)], fill=(18, 25, 38))
    draw.polygon([(0, height), (width, height),
                  (vanishing_x + 52, vanishing_y),
                  (vanishing_x - 52, vanishing_y)], fill=(25, 31, 39))
    for side in (0, 1):
        for i, factor in enumerate((.0, .32, .6, .8)):
            x = int((0 if side == 0 else width) * (1 - factor) + vanishing_x * factor)
            top = int((vanishing_y - 10) * factor)
            bottom = int(height * (1-factor) + (vanishing_y + 25) * factor)
            door_w = max(10, int(74 * (1 - factor)))
            if side:
                draw.rectangle((x - door_w, top + 52*(1-factor), x-4, bottom),
                               fill=(34, 39, 48), outline=(68, 77, 90), width=2)
            else:
                draw.rectangle((x+4, top + 52*(1-factor), x+door_w, bottom),
                               fill=(34, 39, 48), outline=(68, 77, 90), width=2)
    for i in range(7):
        y = int(vanishing_y + (height - vanishing_y) * ((i + 1) / 7) ** 1.7)
        draw.line((0, y, width, y), fill=(42, 50, 63), width=1)
    # Emergency ceiling light, glow, and a consistent silhouetted protagonist.
    light_y = 28 + seed % 22
    draw.ellipse((vanishing_x-38, light_y-12, vanishing_x+38, light_y+12),
                 fill=(106, 57, 52))
    draw.ellipse((vanishing_x-22, light_y-5, vanishing_x+22, light_y+5),
                 fill=(246, 99, 75))
    cx = int(width * (0.58 if seed % 2 else 0.40))
    cy = int(height * .68)
    draw.ellipse((cx-12, cy-67, cx+12, cy-40), fill=(6, 9, 16))
    draw.polygon([(cx-15,cy-42),(cx+15,cy-42),(cx+21,cy+5),(cx-22,cy+5)],
                 fill=(7, 10, 16))
    draw.line((cx-11, cy, cx-17, cy+37), fill=(5, 7, 12), width=11)
    draw.line((cx+11, cy, cx+18, cy+37), fill=(5, 7, 12), width=11)
    # The foreground is intentionally text-free and recognizably procedural.
    im = im.filter(ImageFilter.GaussianBlur(radius=.45))
    im.save(output, "PNG")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="factory-output/offline-smoke")
    args = parser.parse_args()
    root = pathlib.Path(args.output)
    root.mkdir(parents=True, exist_ok=True)
    plan = json.loads(pathlib.Path("factory/series_plan.json").read_text())
    manifest = scene_manifest(plan, plan["episodes"][0])
    shots = manifest["shots"]
    image_dir = root / "draft-images"
    image_dir.mkdir(exist_ok=True)
    images = []
    for shot in shots:
        path = image_dir / (shot["id"] + ".png")
        draw_scene(shot, path)
        images.append({"shot":shot["id"],"image":str(path),
                       "status":"procedural_placeholder_not_ai"})
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2))
    final = video(shots, images, root, manifest["width"], manifest["height"])
    qa = [dict(s, _render_width=manifest["width"], _render_height=manifest["height"])
          for s in shots]
    report = quality_report(final, qa, images, root)
    (root / "render-report.json").write_text(json.dumps({
        "status": report["status"],
        "art": "procedural_placeholder_not_ai",
        "approved": False,
        "needs_visual_and_audio_qa": True,
        "episode_file": final.name,
        "note": "Full local pipeline test, not production-quality AI image generation",
    }, indent=2))
    print("Offline complete MP4:", final, "size:", final.stat().st_size)


if __name__ == "__main__":
    main()
