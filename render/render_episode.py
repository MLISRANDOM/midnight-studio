#!/usr/bin/env python3
"""Midnight Studio cloud renderer. JSON scene manifest -> MP4 via Pillow/FFmpeg.

Only renders supplied scene stills and audio. Doesn't generate AI images or voices.
"""
import argparse
import json
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
W, H = 1280, 720
FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")


def font(size, bold=False):
    path = BOLD if bold else FONT
    return ImageFont.truetype(str(path), size)


def safe_file(value):
    if not value:
        return None
    p = (ROOT / value).resolve()
    if not p.is_relative_to(ROOT) or not p.is_file():
        raise ValueError("Asset not found inside the repository: " + str(value))
    return p


def wrap(draw, text, fnt, width):
    words = str(text or "").split()
    lines = []
    line = ""
    for word in words:
        candidate = (line + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=fnt)[2] > width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def multiline(draw, text, y, max_width, size, fill, bold=False, max_lines=6, center=False):
    fnt = font(size, bold)
    lines = wrap(draw, text, fnt, max_width)[:max_lines]
    step = size * 1.32
    for i, line in enumerate(lines):
        box = draw.textbbox((0, 0), line, font=fnt)
        x = (W - (box[2] - box[0])) / 2 if center else 74
        draw.text((x, y + i * step), line, font=fnt, fill=fill, stroke_width=1)
    return y + int(len(lines) * step)


def frame(scene, number, label):
    src = safe_file(scene.get("image"))
    if src:
        with Image.open(src) as original:
            im = ImageOps.fit(original.convert("RGB"), (W, H), method=Image.Resampling.LANCZOS)
    else:
        # Intentional placeholder so the sample can run without any paid AI generation.
        im = Image.new("RGB", (W, H), "#111824")
        d = ImageDraw.Draw(im)
        for y in range(H):
            shade = int(18 + 18 * y / H)
            d.line((0, y, W, y), fill=(shade, shade + 5, shade + 13))
        d.rectangle((400, 80, 940, 645), fill="#1a2636", outline="#526478", width=10)
        d.rectangle((495, 158, 848, 627), fill="#0a111b", outline="#46566a", width=8)
        d.ellipse((780, 380, 804, 404), fill="#d2ad7b")
    # A translucent dark panel gives exact, legible text, independent of image model accuracy.
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle((36, 27, W - 36, 106), 17, fill=(5, 12, 22, 205))
    d.text((73, 45), label.upper(), font=font(30, True), fill="#eed4ae")
    d.rounded_rectangle((40, 490, W - 40, H - 28), 19, fill=(3, 8, 17, 216))
    multiline(d, scene.get("title", "Scene " + str(number)), 510, 1100, 38, "#ffffff", bold=True, max_lines=1)
    multiline(d, scene.get("caption", ""), 569, 1090, 30, "#e9eff7", max_lines=3)
    # The readable "rule" is rendered in typography, not painted by an AI image model.
    if scene.get("text"):
        d.rounded_rectangle((116, 154, W - 116, 444), 19, fill=(10, 16, 24, 237), outline="#dbb478", width=5)
        multiline(d, scene["text"], 198, 925, 52, "#fff5e2", bold=True, max_lines=4, center=True)
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    return im


def render(manifest, output, work):
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg not found")
    title = str(manifest.get("title", "Midnight Studio Episode"))
    scenes = manifest.get("scenes", [])
    if not isinstance(scenes, list) or not scenes or len(scenes) > 250:
        raise ValueError("scenes must contain 1 to 250 entries")
    clips = []
    for i, scene in enumerate(scenes, 1):
        if not isinstance(scene, dict):
            raise ValueError("Each scene must be an object")
        seconds = float(scene.get("seconds", 5))
        if not math.isfinite(seconds) or not 1 <= seconds <= 30:
            raise ValueError("Each scene must last between 1 and 30 seconds")
        img = work / f"frame-{i:03}.png"
        frame(scene, i, title).save(img, optimize=True)
        clip = work / f"shot-{i:03}.mp4"
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
               "-loop", "1", "-framerate", "24", "-i", str(img)]
        audio = safe_file(scene.get("audio"))
        if audio and audio.suffix.lower() not in {".wav", ".mp3", ".m4a", ".aac", ".ogg"}:
            raise ValueError("Audio must be WAV, MP3, M4A, AAC, or OGG")
        if audio:
            cmd += ["-i", str(audio), "-map", "0:v:0", "-map", "1:a:0", "-af", "apad"]
        else:
            cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                    "-map", "0:v:0", "-map", "1:a:0"]
        cmd += ["-t", f"{seconds:.3f}",
                "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,format=yuv420p",
                "-r", "24", "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
                "-ac", "2", "-movflags", "+faststart", str(clip)]
        print(f"Rendering scene {i}/{len(scenes)}: {scene.get('title','Untitled')}", flush=True)
        subprocess.run(cmd, check=True)
        clips.append(clip)
    listing = work / "clips.txt"
    listing.write_text("".join("file '" + str(p) + "'\n" for p in clips), encoding="utf-8")
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "concat", "-safe", "0", "-i", str(listing),
                    "-c", "copy", "-movflags", "+faststart", str(output)], check=True)
    print(f"Rendered: {output} ({sum(float(s.get('seconds',5)) for s in scenes):.1f} seconds)", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="render/episode.json")
    parser.add_argument("--output", default="rendered/episode.mp4")
    args = parser.parse_args()
    manifest_file = safe_file(args.manifest)
    if not manifest_file:
        raise ValueError("Manifest path required")
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(prefix="midnight-render-") as tmp:
        render(manifest, ROOT / args.output, Path(tmp))


if __name__ == "__main__":
    main()
