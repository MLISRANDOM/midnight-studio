#!/usr/bin/env python3
"""Secure export of Spawned Somewhere Bad Runway candidate frames.

Input: SPAWNED_RUNWAY_ASSETS_JSON GitHub Actions secret, JSON:
{"assets":[{"shot":"S120","url":"https://...cloudfront.net/...?_jwt=..."}]}

Never print, commit, or save signed URLs in a manifest or workflow logs.
This tool only exports candidate images. Visual QA and Drive upload are separate.
"""
import io
import json
import os
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
from PIL import Image

ALLOWED_HOSTS = {"dnznrvs05pmza.cloudfront.net", "d2jqrm6oza8nb6.cloudfront.net"}
MAX_BYTES = 25 * 1024 * 1024
DEST = pathlib.Path(os.environ.get("SPAWNED_EXPORT_DIR", "spawned-somewhere-bad/episode01/runway_candidates"))
SHOT_PATTERN = re.compile(r"^S(\d{3})$")

def normalize_shot(shot):
    if isinstance(shot, int):
        number = shot
    elif isinstance(shot, str):
        match = SHOT_PATTERN.fullmatch(shot) or re.fullmatch(r"(\d{1,3})", shot)
        if not match:
            raise ValueError("Shot format must be S### or a number")
        number = int(match.group(1))
    else:
        raise ValueError("Shot format invalid")
    if not 1 <= number <= 228:
        raise ValueError("Shot out of storyboard range")
    return f"S{number:03d}"

def validate_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError("Runway media origin not approved")
    if parsed.username or parsed.password or parsed.port:
        raise ValueError("Unexpected image origin")
    return url

def download_as_png(url, output):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "MidnightStudio-ImageCollector/1.0"})
            with urllib.request.urlopen(request, timeout=50) as response:
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError("Image exceeds maximum size")
            with Image.open(io.BytesIO(data)) as im:
                im.load()
                width, height = im.size
                if width < height or abs(width / height - 16 / 9) > 0.14:
                    raise ValueError(f"Unexpected aspect ratio: {width}x{height}")
                im.convert("RGB").save(output, "PNG", optimize=True)
            return {"width": width, "height": height, "size_bytes": output.stat().st_size}
        except Exception as err:
            if attempt == 2:
                # The URL could include credentials. Never interpolate err into logs.
                raise RuntimeError("Download failed after 3 tries; refresh the signed Runway link") from None
            time.sleep(2**attempt)

def main():
    raw = os.environ.get("SPAWNED_RUNWAY_ASSETS_JSON", "").strip()
    if not raw:
        raise SystemExit("Missing private SPAWNED_RUNWAY_ASSETS_JSON secret; no transfers attempted")
    payload = json.loads(raw)
    assets = payload["assets"] if isinstance(payload, dict) else payload
    if not isinstance(assets, list) or not assets:
        raise SystemExit("Expected a nonempty assets list")
    DEST.mkdir(parents=True, exist_ok=True)
    seen = set()
    records = []
    for entry in assets:
        shot = normalize_shot(entry["shot"])
        if shot in seen:
            raise SystemExit(f"Duplicate shot number: {shot}")
        seen.add(shot)
        url = validate_url(entry["url"])
        output = DEST / (shot + ".png")
        info = download_as_png(url, output)
        records.append({"shot": shot, "filename": output.name, "status": "candidate_unreviewed", **info})
        print(f"Exported candidate {shot}: {info['width']}x{info['height']}")
    (DEST / "CANDIDATE_MANIFEST.json").write_text(json.dumps({"source":"Runway", "qa_state":"unreviewed", "shots": records}, indent=2)+"\n", encoding="utf-8")
    print(f"Exported {len(records)} candidate frames; signed URLs kept private")

if __name__ == "__main__":
    main()
