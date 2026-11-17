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

API = os.getenv("AI_HORDE_BASE_URL", "https://stablehorde.net/api/v2")
AGENT = "MidnightStudioEpisodeFactory:0.1:github.com/MLISRANDOM/midnight-studio"
MAX_SHOTS = 120
MAX_NEW_PER_RUN = 6
MAX_RESPONSE_BYTES = 8 * 1024 * 1024


def request(method, path, payload=None):
    headers = {
        "apikey": (os.getenv("AI_HORDE_API_KEY") or "0000000000"),
        "Client-Agent": AGENT,
        "Accept": "application/json",
        "User-Agent": "MidnightStudioEpisodeFactory/0.3 (+https://github.com/MLISRANDOM/midnight-studio)",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as error:
        # Decode the provider's documented error rc, without printing credentials.
        raw = error.read(2048).decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw)
            reason = str(detail.get("rc") or detail.get("message") or "no API reason")[:250]
        except (ValueError, AttributeError):
            reason = "non-JSON response: " + raw[:120].replace("\\n", " ")
        raise RuntimeError(f"AI Horde HTTP {error.code}, reason: {reason}") from error
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
            or host.endswith(".r2.dev")
            or re.fullmatch(r"[0-9a-f]{32}\.r2\.cloudflarestorage\.com", host)):
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


def generate_horde(shot, outdir, index, width, height, timeout):
    prompt = shot["prompt"].strip()
    negative = shot.get("negative", "text, caption, watermark, logo")
    if negative:
        prompt += " ### " + negative
    spec = {"prompt": prompt, "params": {"n": 1, "width": width, "height": height, "steps": 20},
            "nsfw": False, "censor_nsfw": True, "shared": False, "r2": True, "allow_downgrade": True}
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


def generate_ovh(shot, outdir, index, width, height, timeout):
    """Use OVHcloud's documented anonymous free SDXL API (subject to quotas)."""
    from ovh_probe import generate as ovh_request
    path = outdir / (shot["id"] + ".png")
    prompt = shot["prompt"].strip()
    negative = shot.get("negative", "")
    if negative:
        prompt += ". Avoid these artifacts: " + negative[:200]
    info = ovh_request(prompt, path)
    return {"shot": shot["id"], "image": str(path), "status": "draft_needs_qa",
            "provider": "OVHcloud free SDXL", "model": info.get("model")}


def generate(shot, outdir, index, width, height, timeout):
    """Try verified free providers without payment credentials or silent fake images."""
    preferred = os.getenv("FACTORY_IMAGE_PROVIDER", "ovh").lower()
    if preferred not in {"ovh", "horde", "auto"}:
        raise ValueError("FACTORY_IMAGE_PROVIDER must be ovh, horde, or auto")
    providers = [("ovh", generate_ovh), ("horde", generate_horde)]
    if preferred == "horde":
        providers.reverse()
    errors = []
    for name, provider in providers:
        try:
            print("Trying free image provider:", name, "shot:", shot["id"], flush=True)
            result = provider(shot, outdir, index, width, height, timeout)
            print("Free image received:", shot["id"], "provider:", name, flush=True)
            return result
        except Exception as exc:
            reason = str(exc)[:350]
            errors.append(name + ": " + reason)
            print("Provider unavailable:", name, reason, flush=True)
    raise RuntimeError("Both free image providers failed. " + " | ".join(errors))


def run(command):
    subprocess.run(command, check=True)


def audio_duration(file_path):
    """Read actual speech length so narration is never silently truncated."""
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(file_path)],
        check=True, text=True, capture_output=True)
    return float(result.stdout.strip())


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
            # Optional local neural TTS; no paid API. Fall back to eSpeak on failure.
            piper_model = os.getenv("PIPER_MODEL", "").strip()
            made_audio = False
            if piper_model and pathlib.Path(piper_model).is_file():
                try:
                    subprocess.run(
                        ["piper", "--model", piper_model, "--output_file", str(audio)],
                        input=text[:2500], text=True, check=True,
                        timeout=90, capture_output=True)
                    made_audio = audio.exists() and audio.stat().st_size > 1024
                except (OSError, subprocess.SubprocessError) as error:
                    print("Piper failed, using offline fallback:", error, flush=True)
            if not made_audio:
                run(["espeak-ng", "-v", "en-us", "-s", "145", "-w", str(audio), text[:2500]])
        else:
            run(["ffmpeg", "-nostdin", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                 "-t", str(duration), str(audio)])
        # Respect full narration instead of cutting off the final words.
        speech_seconds = audio_duration(audio)
        duration = min(90.0, max(float(duration), speech_seconds + 0.35))
        mp4 = clips / ("%03d.mp4" % i)
        run(["ffmpeg", "-nostdin", "-y", "-loop", "1", "-framerate", "24", "-i", str(image_path),
             "-i", str(audio), "-t", str(duration),
             "-vf", "scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,format=yuv420p" % (width, height, width, height),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-r", "24",
             "-af", "apad", "-c:a", "aac", "-ar", "44100", "-ac", "1", str(mp4)])
        rendered.append(mp4)
    listfile = clips / "concat.txt"
    listfile.write_text("".join("file '%s'\n" % p.name for p in rendered))
    final = output / "episode-draft.mp4"
    run(["ffmpeg", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
         "-c", "copy", str(final)])
    return final


def quality_report(video_file, shots, images, output):
    """Technical-only checks; cannot certify artwork/story quality."""
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration,size:stream=codec_type,codec_name,width,height",
         "-of", "json", str(video_file)],
        check=True, text=True, capture_output=True)
    probe = json.loads(result.stdout)
    streams = probe.get("streams", [])
    video_streams = [s for s in streams if s.get("codec_type") == "video"]
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    actual = float(probe["format"].get("duration", 0))
    expected_min = sum(max(2, min(30, int(s.get("seconds", 6)))) for s in shots)
    checks = {
        "has_video": bool(video_streams),
        "has_audio": bool(audio_streams),
        "duration_at_least_storyboard": actual + 0.1 >= expected_min,
        "valid_mp4_size": video_file.stat().st_size >= 5000,
        "all_draft_images_present": all(pathlib.Path(x["image"]).is_file() for x in images),
        "correct_dimensions": bool(video_streams and
            video_streams[0].get("width") == int(shots[0].get("_render_width", 0)) and
            video_streams[0].get("height") == int(shots[0].get("_render_height", 0))),
    }
    report = {
        "status": "technical_checks_passed" if all(checks.values()) else "technical_checks_failed",
        "not_a_visual_or_narrative_approval": True,
        "checks": checks,
        "duration_seconds": actual,
        "file_size_bytes": video_file.stat().st_size,
        "streams": streams,
    }
    (output / "technical-qa.json").write_text(json.dumps(report, indent=2))
    if not all(checks.values()):
        raise RuntimeError("Technical MP4 checks failed; see technical-qa.json")
    return report


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
    width, height = int(manifest.get("width", 576)), int(manifest.get("height", 320))
    if width % 64 or height % 64 or width * height > 512 * 512 or min(width, height) < 256:
        raise ValueError("Use 64-aligned dimensions of at least 256, within 512x512 pixels")
    output = pathlib.Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    assets = output / "draft-images"
    assets.mkdir(exist_ok=True)
    # Resume previously validated draft PNGs from the restored Actions cache.
    report_path = output / "report.json"
    previous = {}
    if report_path.exists():
        try:
            old = json.loads(report_path.read_text())
            if old.get("manifest_fingerprint") == manifest_path.read_text():
                previous = {item["shot"]: item for item in old.get("results", [])
                            if item.get("status") == "draft_needs_qa"}
        except (ValueError, KeyError, TypeError):
            pass
    results = []
    max_new = int(os.getenv("FACTORY_NEW_SHOTS_PER_RUN", "2"))
    if not (1 <= max_new <= MAX_NEW_PER_RUN):
        raise ValueError("FACTORY_NEW_SHOTS_PER_RUN must be 1-%d" % MAX_NEW_PER_RUN)
    new_count = 0
    for index, shot in enumerate(shots):
        image_path = assets / (shot["id"] + ".png")
        cached = previous.get(shot["id"])
        if cached and image_path.exists():
            try:
                with Image.open(image_path) as im:
                    im.verify()
                results.append({**cached, "image": str(image_path)})
                print("Resumed", shot["id"], "from verified cached image", flush=True)
                continue
            except Exception:
                print("Cached image invalid, regenerating", shot["id"], flush=True)
        if new_count >= max_new:
            results.append({"shot": shot["id"], "status": "pending_next_run"})
            continue
        new_count += 1
        try:
            results.append(generate(shot, assets, index, width, height, args.generation_timeout))
        except Exception as e:
            results.append({"shot": shot["id"], "status": "retry_next_run", "error": str(e)})
            print("Generation attempt failed:", shot["id"], e, file=sys.stderr, flush=True)
            # Continue with other previously generated images but don't start another request.
            new_count = max_new
        finally:
            report_path.write_text(json.dumps({
                "title": manifest.get("title"),
                "source_manifest": str(manifest_path),
                "manifest_fingerprint": manifest_path.read_text(),
                "results": results,
                "approved": False,
                "note": "Draft only; never overwrites approved production assets"
            }, indent=2))
    complete = len(results) == len(shots) and all(
        x["status"] == "draft_needs_qa" for x in results)
    if complete:
        final = video(shots, results, output, width, height)
        qa_shots = [dict(shot, _render_width=width, _render_height=height) for shot in shots]
        quality_report(final, qa_shots, results, output)
        print("Draft video created with technical QA:", final, flush=True)
    else:
        pending = [x["shot"] for x in results if x["status"] != "draft_needs_qa"]
        print("Episode pending future scheduled run:", pending, flush=True)


if __name__ == "__main__":
    main()
