#!/usr/bin/env python3
"""Test the documented free anonymous OVHcloud SDXL image endpoint.

This is an independent, non-production probe. It never sends private prompts,
never requires an API token, and creates a draft image artifact on success.
"""
import base64
import io
import json
import pathlib
import sys
import urllib.error
import urllib.request
from PIL import Image, ImageOps

URL = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/images/generations"
MODEL = "stable-diffusion-xl-base-v10"


def generate(prompt, dest):
    body = {
        "model": MODEL,
        "prompt": prompt,
        "size": "1024x1024",
        "response_format": "b64_json",
        "n": 1,
    }
    req = urllib.request.Request(
        URL, data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json", "Accept": "application/json",
            "User-Agent": "MidnightStudioFreeProviderProbe/1.0 (+https://github.com/MLISRANDOM/midnight-studio)"
        }, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            data = response.read(15 * 1024 * 1024 + 1)
    except urllib.error.HTTPError as error:
        detail = error.read(1000).decode("utf-8", errors="replace")
        raise RuntimeError("OVH free API HTTP %s: %s" %
                           (error.code, detail[:350].replace("\n", " "))) from error
    if len(data) > 15 * 1024 * 1024:
        raise ValueError("Response too large")
    obj = json.loads(data)
    images = obj.get("data") or []
    if not images:
        raise RuntimeError("OVH returned no image data")
    entry = images[0]
    encoded = entry.get("b64_json")
    if not encoded:
        raise RuntimeError("OVH returned no b64_json field (keys: %s)" % list(entry.keys()))
    raw = base64.b64decode(encoded, validate=True)
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        result = ImageOps.pad(image.convert("RGB"), (576, 320), color=(10, 14, 22))
        pathlib.Path(dest).parent.mkdir(parents=True, exist_ok=True)
        result.save(dest, format="PNG")
    return {"provider": "OVHcloud anonymous SDXL", "model": MODEL,
            "width": result.width, "height": result.height, "saved_file": str(dest),
            "status": "draft_needs_qa", "free_tier_not_guaranteed": True}


if __name__ == "__main__":
    path = pathlib.Path("factory-output/ovh-probe/image.png")
    prompt = ("Original atmospheric 2D horror animation concept frame, thick black "
              "outlines, deserted vintage corridor, eerie fluorescent glow, flat "
              "navy colors, cinematic visual composition, no text or watermark")
    try:
        info = generate(prompt, path)
        (path.parent / "result.json").write_text(json.dumps(info, indent=2))
        print(json.dumps(info, indent=2))
    except Exception as exc:
        path.parent.mkdir(parents=True, exist_ok=True)
        (path.parent / "result.json").write_text(json.dumps({
            "status": "provider_unavailable", "error": str(exc),
            "charged_requests": 0,
            "note": "This probe does not supply payment credentials"
        }, indent=2))
        print("Free provider probe failed:", exc, file=sys.stderr)
        sys.exit(1)
