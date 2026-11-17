#!/usr/bin/env python3
"""Build review contact sheets and basic image diagnostics for autonomous episodes.

Designed to run on GitHub Actions after each generation batch. It does not claim
to measure identity, emotion, continuity, aesthetics or narrative accuracy.
"""
import argparse
import json
import pathlib
from PIL import Image, ImageDraw, ImageOps

COLUMNS = 4
ROWS = 5
THUMB_W = 260
THUMB_H = 158
GAP = 14
HEADER = 28

def make_one_episode(directory):
    src = directory / "draft-images"
    if not src.is_dir():
        return None
    files = sorted(src.glob("S*.png"))
    if not files:
        return None
    dest = directory / "contact-sheets"
    dest.mkdir(exist_ok=True)
    batches = [files[i:i+COLUMNS * ROWS] for i in range(0, len(files), COLUMNS * ROWS)]
    diagnostics = {"episode": directory.name, "draft_images": len(files), "pages": [],
                   "checks": {"all_files_decode": True,
                              "visual_identity_verified": False,
                              "storytelling_quality_verified": False,
                              "release_approved": False}}
    for page_n, batch in enumerate(batches, 1):
        canvas_w = COLUMNS * (THUMB_W + GAP) + GAP
        canvas_h = ROWS * (THUMB_H + HEADER + GAP) + GAP
        canvas = Image.new("RGB", (canvas_w, canvas_h), (12, 18, 28))
        draw = ImageDraw.Draw(canvas)
        page_notes = []
        for index, path in enumerate(batch):
            x = GAP + (index % COLUMNS) * (THUMB_W + GAP)
            y = GAP + (index // COLUMNS) * (THUMB_H + HEADER + GAP)
            try:
                with Image.open(path) as image:
                    image.load()
                    actual_size = image.size
                    tile = ImageOps.contain(image.convert("RGB"), (THUMB_W, THUMB_H))
                canvas.paste(tile, (x + (THUMB_W - tile.width)//2, y))
                page_notes.append({"shot": path.stem, "width": actual_size[0],
                                   "height": actual_size[1], "decodes": True})
            except Exception as error:
                diagnostics["checks"]["all_files_decode"] = False
                draw.rectangle((x, y, x + THUMB_W, y + THUMB_H), fill=(90, 22, 28))
                page_notes.append({"shot": path.stem, "decodes": False,
                                   "error": str(error)[:180]})
            draw.text((x + 4, y + THUMB_H + 5), path.stem,
                      fill=(218, 236, 248))
        out = dest / f"contact-{page_n:02d}.jpg"
        canvas.save(out, "JPEG", quality=84)
        diagnostics["pages"].append({"file": str(out.relative_to(directory)),
                                     "shots": page_notes})
    report = directory / "image-qa.json"
    report.write_text(json.dumps(diagnostics, indent=2))
    print("Contact sheets created:", directory.name, "images:", len(files),
          "pages:", len(batches), flush=True)
    return diagnostics

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="factory-output/autonomous-series")
    args = parser.parse_args()
    root = pathlib.Path(args.root)
    if not root.is_dir():
        print("No episode image output yet.")
        return
    for folder in sorted(x for x in root.iterdir() if x.is_dir()):
        make_one_episode(folder)

if __name__ == "__main__":
    main()
