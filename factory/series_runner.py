#!/usr/bin/env python3
"""Unattended series runner for *experimental* draft episodes.

A series plan is enough: no shot-by-shot manifest authoring is required.
Run from GitHub Actions with the cache restored to keep all outputs across runs.
"""
import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone

BEATS = [
    ("The wrong first impression", "wide establishing shot",
     "The building looked empty when the night began, but the silence was a warning."),
    ("The impossible clue", "medium shot of an unnatural clue",
     "Then something moved where nothing should have been able to move."),
    ("The consequence", "dramatic low-angle image with long shadows",
     "Every choice made the strange presence feel closer, even without footsteps."),
    ("The last revelation", "ominous final composition with an unresolved reveal",
     "By morning, the survivor understood that the escape had been the trap."),
]


def slug(value):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", value):
        raise ValueError("Episode id must use 1-40 alphanumeric, dash, underscore characters")
    return value


def free_narration(series, episode, timeout=100):
    """Best-effort volunteer text completion. Returns four short voiceover lines or None."""
    if os.getenv("FACTORY_FREE_TEXT", "1") != "1":
        return None
    lead = str(episode.get("lead", "the survivor"))[:160]
    setting = str(episode.get("setting", "an empty building"))[:160]
    threat = str(episode.get("threat", "an impossible threat"))[:160]
    hook = str(episode.get("hook", "a warning"))[:150]
    twist = str(episode.get("twist", "a hidden truth"))[:150]
    prompt = (
        "Write precisely four separate lines of original, concise, creepy narrator voiceover "
        "for an animated horror short. Each line 12 to 22 words. No labels, numbering, "
        "markdown or dialogue. Maintain plot continuity. These four story beats are: "
        f"1 introduction in {setting} involving {lead} and {hook}; "
        f"2 discovery of {threat}; 3 attempted escape; 4 revelation that {twist}. "
        "Write only four voiceover lines:\n"
    )
    key = os.getenv("AI_HORDE_API_KEY") or "0000000000"
    headers = {"apikey": key, "Client-Agent": "MidnightStudioEpisodeFactory:0.2:github.com/MLISRANDOM/midnight-studio",
               "Content-Type": "application/json", "Accept": "application/json"}
    def send(method, path, payload=None):
        req = urllib.request.Request(
            "https://aihorde.net/api/v2" + path,
            data=json.dumps(payload).encode("utf-8") if payload is not None else None,
            headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=22) as resp:
            return json.loads(resp.read(1024 * 1024))
    job_id = None
    try:
        job = send("POST", "/generate/text/async", {
            "prompt": prompt, "params": {"max_length": 300, "max_context_length": 2048,
                                         "temperature": 0.75}, "nsfw": False})
        job_id = job.get("id")
        if not job_id:
            return None
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            time.sleep(7)
            result = send("GET", "/generate/text/status/" + urllib.parse.quote(job_id))
            generations = result.get("generations") or []
            if generations:
                text_result = str(generations[0].get("text", "")).strip()
                lines = [re.sub(r"^\s*(?:[1-4][.): -]+|[-*]\s+)", "", x).strip()
                         for x in text_result.splitlines() if x.strip()]
                lines = [x for x in lines if 20 <= len(x) <= 300]
                if len(lines) >= 4:
                    return lines[:4]
                return None
            if result.get("done") or result.get("faulted"):
                return None
    except Exception as exc:
        print("Volunteer text writer unavailable, falling back to scripted beats:", exc, flush=True)
    finally:
        if job_id:
            try:
                send("DELETE", "/generate/text/status/" + urllib.parse.quote(job_id))
            except Exception:
                pass
    return None


def scene_manifest(series, episode, ai_lines=None):
    style = str(series.get("art_style", "original flat-color 2D cartoon horror"))[:280]
    title = str(episode.get("title", "Untitled Episode"))[:150]
    setting = str(episode.get("setting", "empty corridor"))[:240]
    threat = str(episode.get("threat", "an unseen presence"))[:240]
    lead = str(episode.get("lead", "a lone night watchman"))[:180]
    hook = str(episode.get("hook", "a strange signal"))[:200]
    twist = str(episode.get("twist", "the exit was never real"))[:220]
    direction = [
        f"{lead} enters {setting}, notices {hook}",
        f"{lead} discovers evidence of {threat} inside {setting}",
        f"{lead} attempts to escape {threat} through {setting}",
        f"{lead} discovers that {twist} inside {setting}",
    ]
    narration = [
        f"{lead} was only supposed to pass through {setting}. The first warning was {hook}.",
        f"The impossible clue left no doubt. Somewhere close by was {threat}.",
        f"There was only one direction left to run, and even that route seemed to change.",
        f"The truth was worse than being trapped. {twist}. And the night was not over.",
    ]
    if ai_lines and len(ai_lines) == 4:
        narration = ai_lines
    shots = []
    for i, ((beat, framing, _), visual, narration_text) in enumerate(
        zip(BEATS, direction, narration), start=1
    ):
        shots.append({
            "id": f"S{i:03d}",
            "seconds": 9,
            "prompt": (
                f"{style}. A cinematic 2D animation storyboard frame in 16:9. "
                f"Consistent design of {lead}. {beat}: {visual}. {framing}. "
                "Rich shadows, coherent architecture, no typography, no captions, no speech bubbles."
            ),
            "negative": "words, letters, watermark, logo, captions, low quality, duplicate faces",
            "narration": narration_text,
        })
    return {"title": title, "series": series.get("name", "Midnight Studio"),
            "width": 576, "height": 320, "shots": shots,
            "draft_only": True, "requires_qa": True,
            "narration_source": "volunteer_ai_text" if ai_lines else "scripted_fallback"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--series", default="factory/series_plan.json")
    parser.add_argument("--output", default="factory-output/autonomous-series")
    parser.add_argument("--max-runtime-per-shot", type=int, default=600)
    args = parser.parse_args()
    series_path = pathlib.Path(args.series)
    plan = json.loads(series_path.read_text())
    episodes = plan.get("episodes", [])
    if not isinstance(episodes, list) or not (1 <= len(episodes) <= 12):
        raise ValueError("A series plan must include 1-12 planned episodes")
    output = pathlib.Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    status = {"series": plan.get("name"), "updated_utc": None, "episodes": []}
    pending = None
    for item in episodes:
        identifier = slug(item["id"])
        episode_dir = output / identifier
        complete = (episode_dir / "episode-draft.mp4").is_file()
        status["episodes"].append({"id": identifier, "draft_render_complete": complete,
                                   "state": "rendered_draft" if complete else "pending"})
        if not complete and pending is None:
            pending = (item, episode_dir)
    if pending is not None:
        item, episode_dir = pending
        episode_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = episode_dir / "manifest.json"
        # Do not mutate an episode's prompts after the first generation.
        if not manifest_path.exists():
            ai_lines = free_narration(plan, item)
            manifest_path.write_text(json.dumps(scene_manifest(plan, item, ai_lines), indent=2))
        print("Processing episode:", item["id"], flush=True)
        cmd = [sys.executable, "factory/episode_factory.py",
               "--manifest", str(manifest_path), "--output", str(episode_dir),
               "--generation-timeout", str(args.max_runtime_per_shot)]
        result = subprocess.run(cmd, check=False)
        if result.returncode != 0:
            print("Generator reported an error; preserved partial files", flush=True)
    else:
        print("All planned draft episodes have been rendered. No new work.", flush=True)
    status["updated_utc"] = datetime.now(timezone.utc).isoformat()
    for entry in status["episodes"]:
        entry["draft_render_complete"] = (output / entry["id"] / "episode-draft.mp4").is_file()
        entry["state"] = "rendered_draft" if entry["draft_render_complete"] else "pending"
    (output / "series-status.json").write_text(json.dumps(status, indent=2))
    # Network / volunteer failure is non-fatal: next scheduled run resumes the queue.
    return 0


if __name__ == "__main__":
    sys.exit(main())
