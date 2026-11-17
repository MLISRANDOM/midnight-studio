#!/usr/bin/env python3
"""Free best-effort draft episode factory: AI Horde images + espeak-ng + FFmpeg.

No approvals are modified. Results are uploaded as GitHub Actions artifacts.
Usage: python factory/episode_factory.py --manifest factory/demo_episode.json --output factory-output
"""
import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image

API = "https://aihorde.net/api/v2"
AGENT = "MidnightStudioEpisodeFactory:0.1:github.com/MLISRANDOM/midnight-studio"
MAX_SHOTS = 6
MAX_RESPONSE_BYTES = 8 * 1024 * 1024


def request(method, path, payload=None):
    headers = {
        "apikey": os.getenv("AI_HORDE_API_KEY", "0000000000"),
        "Client-Agent": AGENT,
        "Accept": "application/json",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=35) as response:
        body = response.read(MAX_RESPONSE_BYTES + 1)
    if len(body) > MAX_RESPONSE_BYTES:
        raise ValueError("API JSON exceeded maximum response size")
    return json.loads(body)


def image_download(url, dest):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Unexpected image URL")
    # Prevent fetching internal or unrelated URLs via worker-supplied data.
    host = parsed.hostname.lower()
    if not (host == "aihorde.net" or host.endswith(".aihorde.net")
            or host == "stablehorde.net" or host.endswith(".stablehorde.net")
            or host.endswith(".r2.dev")):
        raise ValueError("Image host not on approved allowlist: " + host)
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=60) as response:
        image_data = response.read(16 * 1024 * 1024 + 1)
    if not image_data or len(image_data) > 16 * 1024 * 1024:
        raise ValueError("Image empty or too large")
    from io import BytesIO
    with Image.open(BytesIO(image_data)) as im:
        im.load()
        if im.width < 256 or im.height < 256:
            raise ValueError("Image unexpectedly small")
        im.convert("RGB").save(dest, "PNG")


def generate(shot, outdir, index, width, height, timeout):
    prompt = shot["prompt"].strip()
    negative = shot.get("negative", "text, caption, watermark, logo")
    if negative:
        prompt += " ### " + negative
    spec = {"prompt": prompt, "params": {"n": 1, "width": width, "height": height, "steps": 20},
            "nsfw": False, "censor_nsfw": True, "shared": False}
    print("Submitting", shot["id"], flush=True)
    job = request("POST", "/generate/async", spec)
    job_id = job.get("id")
    if not job_id:
        raise RuntimeError("AI Horde rejected job: " + str(job)[:350])
    print("Queued:", job_id, flush=True)
    end = time.monotonic() + timeout
    try:
        while time.monotonic() < end:
            time.sleep(8)
            status = request("GET", "/generate/check/" + urllib.parse.quote(job_id))
            print("Status", shot["id"], "wait", status.get("waiting"), "done", status.get("done"), flush=True)
            if status.get("faulted"):
                raise RuntimeError("AI Horde worker faulted")
            if status.get("done") or status.get("finished", 0) > 0:
                full = request("GET", "/generate/status/" + urllib.parse.quote(job_id))
                generations = full.get("generations") or []
                if generations and generations[0].get("img"):
                    path = outdir / (shot["id"] + ".png")
                    image_download(generations[0]["img"], path)
                    return {"shot": shot["id"], "job_id": job_id, "model": generations[0].get("model"),
                            "image": str(path), "status": "draft_needs_qa"}
                if full.get("done"):
                    raise RuntimeError("Finished without an image")
        raise TimeoutError("Generation timed out after %d seconds" % timeout)
    finally:
        # Cancel unfinished jobs to avoid consuming more volunteer resources.
        try:
            check = request("GET", "/generate/check/" + urllib.parse.quote(job_id))
            if not check.get("done"):
                request("DELETE", "/generate/status/" + urllib.parse.quote(job_id))
        except Exception as exc:
            print("Warning: unable to confirm job cleanup:", exc, flush=True)


def run(command):
    subprocess.run(command, check=True)


def video(shots, images, output, width, height):
    clips = output / "clips"
    clips.mkdir(exist_ok=True)
    rendered = []
    for i, (shot, image) in enumerate(zip(shots, images), 1):
        image_path = pathlib.Path(image["image"])
        duration = max(2, min(30, int(shot.get("seconds", 6))))
        audio = clips / ("%03d.wav" % i)
        text = shot.get("narration", "").strip()
        if text:
            run(["espeak-ng", "-v", "en-us", "-s", "145", "-w", str(audio), text[:2500]])
        else:
            run(["ffmpeg", "-nostdin", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                 "-t", str(duration), str(audio)])
        mp4 = clips / ("%03d.mp4" % i)
        run(["ffmpeg", "-nostdin", "-y", "-loop", "1", "-framerate", "24", "-i", str(image_path),
             "-i", str(audio), "-t", str(duration),
             "-vf", "scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,format=yuv420p" % (width, height, width, height),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-r", "24",
             "-c:a", "aac", "-ar", "44100", "-ac", "1", "-shortest", str(mp4)])
        rendered.append(mp4)
    listfile = clips / "concat.txt"
    listfile.write_text("".join("file '%s'\n" % p.name for p in rendered))
    final = output / "episode-draft.mp4"
    run(["ffmpeg", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
         "-c", "copy", str(final)])
    return final


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", default="factory-output")
    parser.add_argument("--generation-timeout", type=int, default=900)
    args = parser.parse_args()
    manifest_path = pathlib.Path(args.manifest)
    if not manifest_path.is_file() or manifest_path.suffix != ".json":
        raise ValueError("Manifest must be an existing JSON file")
    manifest = json.loads(manifest_path.read_text())
    shots = manifest.get("shots", [])
    if not (1 <= len(shots) <= MAX_SHOTS):
        raise ValueError("A test run requires 1-%d shots" % MAX_SHOTS)
    ids = [x.get("id", "") for x in shots]
    if len(set(ids)) != len(ids) or not all(re.fullmatch(r"[A-Za-z0-9_-]{1,40}", x) for x in ids):
        raise ValueError("Unique safe shot IDs required")
    if not all(isinstance(s.get("prompt"), str) and 8 <= len(s["prompt"]) <= 1800 for s in shots):
        raise ValueError("Each shot must include an 8-1800 character prompt")
    width, height = int(manifest.get("width", 512)), int(manifest.get("height", 288))
    if width % 64 or height % 64 or width * height > 512 * 512 or min(width, height) < 256:
        raise ValueError("Use 64-aligned dimensions of at least 256, within 512x512 pixels")
    output = pathlib.Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    assets = output / "draft-images"
    assets.mkdir(exist_ok=True)
    results = []
    for index, shot in enumerate(shots):
        try:
            results.append(generate(shot, assets, index, width, height, args.generation_timeout))
        except Exception as e:
            results.append({"shot": shot["id"], "status": "failed", "error": str(e)})
            print("Failed:", shot["id"], e, file=sys.stderr, flush=True)
            break
    (output / "report.json").write_text(json.dumps({
        "title": manifest.get("title"), "source_manifest": str(manifest_path),
        "results": results, "approved": False,
        "note": "Draft only; never overwrites approved production assets"
    }, indent=2))
    if len(results) == len(shots) and all(x["status"] == "draft_needs_qa" for x in results):
        final = video(shots, results, output, width, height)
        print("Draft video created:", final, flush=True)
    else:
        print("Episode incomplete. Draft outputs preserved for troubleshooting.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
