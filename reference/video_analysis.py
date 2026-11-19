#!/usr/bin/env python3
"""Reference Lab video measurement engine.

Analyzes a LOCAL video file only. It does not interpret plot, identify people,
or reproduce another creator's story. FFmpeg and ffprobe are required.
"""
import argparse
import bisect
import json
import math
import pathlib
import re
import subprocess
import shutil
import tempfile

MAX_SECONDS = 7200
MAX_FRAMES = 32
PTS = re.compile(r"pts_time:\s*([0-9]+(?:\.[0-9]+)?)")

def command(args, timeout=180):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True)

def probe(video):
    data = json.loads(command(["ffprobe", "-v", "error", "-show_format", "-show_streams",
                               "-of", "json", str(video)]).stdout)
    streams = [s for s in data.get("streams", []) if s.get("codec_type") == "video"]
    if not streams:
        raise ValueError("Input has no video stream")
    video_stream = streams[0]
    duration = float(data.get("format", {}).get("duration") or video_stream.get("duration") or 0)
    if not math.isfinite(duration) or duration <= 0 or duration > MAX_SECONDS:
        raise ValueError("Unsupported duration (must be 0-120 minutes)")
    rate = video_stream.get("avg_frame_rate", "0/1").split("/")
    fps = (float(rate[0]) / float(rate[1])) if len(rate) == 2 and float(rate[1]) else 0.0
    return {"duration_seconds": round(duration, 3), "width": video_stream.get("width"),
            "height": video_stream.get("height"), "fps": round(fps, 3),
            "audio_present": any(s.get("codec_type") == "audio" for s in data.get("streams", []))}

def detect_cuts(video, duration, threshold):
    # showinfo timestamps come from actual decoded source frames, not filenames.
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(video), "-map", "0:v:0", "-an",
           "-vf", f"select=gt(scene\\,{threshold}),showinfo", "-vsync", "vfr",
           "-f", "null", "-"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if result.returncode:
        raise RuntimeError("FFmpeg scene detection failed: " + result.stderr[-600:])
    cuts = sorted({round(float(x), 3) for x in PTS.findall(result.stderr)
                   if 0.15 < float(x) < duration - 0.15})
    return cuts

def analyze(video, out, threshold=0.27, max_frames=16):
    video = pathlib.Path(video).expanduser().resolve()
    if not video.is_file():
        raise FileNotFoundError("Video file does not exist: " + str(video))
    if not 0.05 <= threshold <= 0.95:
        raise ValueError("Threshold must be between 0.05 and 0.95")
    if not 1 <= max_frames <= MAX_FRAMES:
        raise ValueError("Frame count must be 1-32")
    meta = probe(video)
    duration = meta["duration_seconds"]
    cuts = detect_cuts(video, duration, threshold)
    boundaries = [0.0] + cuts + [duration]
    shots = []
    for i in range(len(boundaries) - 1):
        start, end = boundaries[i:i+2]
        shots.append({"index": i + 1, "start_seconds": start, "end_seconds": end,
                      "duration_seconds": round(end-start, 3)})
    lengths = [s["duration_seconds"] for s in shots]
    # Sample the whole source, not just the beginning. Include detected cut-adjacent positions.
    samples = {(i + 0.5) * duration / max_frames for i in range(max_frames)}
    for s in sorted(shots, key=lambda s: s["duration_seconds"], reverse=True)[:max_frames // 2]:
        samples.add((s["start_seconds"]+s["end_seconds"])/2)
    sample_times = sorted(samples)
    if len(sample_times) > max_frames:
        sample_times = [sample_times[min(len(sample_times)-1, int((i+.5)*len(sample_times)/max_frames))]
                        for i in range(max_frames)]
    out = pathlib.Path(out)
    frames_dir = out / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    # A requested time can fall after the final presentation timestamp, even
    # though the last picture remains visible until the container ends.
    # Index actual decoded pictures and export unique picks together.
    timing = command(["ffprobe", "-v", "error", "-select_streams", "v:0",
                      "-show_frames", "-show_entries", "frame=best_effort_timestamp_time",
                      "-of", "json", str(video)], timeout=900)
    records = json.loads(timing.stdout).get("frames", [])
    known = [(float(r["best_effort_timestamp_time"]), i) for i, r in enumerate(records)
             if r.get("best_effort_timestamp_time") not in (None, "N/A")]
    if not known:
        raise ValueError("No timestamped video frames could be decoded")
    origin = known[0][0]
    timeline = sorted((stamp - origin, index) for stamp, index in known)
    stamps = [stamp for stamp, _ in timeline]
    picks = [timeline[max(0, bisect.bisect_right(stamps, t) - 1)] for t in sample_times]
    unique = sorted({index for _, index in picks})
    generation = pathlib.Path(tempfile.mkdtemp(prefix="set-", dir=frames_dir))
    try:
        select = "+".join(f"eq(n\\,{index})" for index in unique)
        command(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-i", str(video),
                 "-map", "0:v:0", "-an", "-vf", "select=" + select + ",scale=640:-2",
                 "-vsync", "0", str(generation / "frame_%03d.jpg")], timeout=900)
        paths = {index: generation / f"frame_{i:03d}.jpg" for i, index in enumerate(unique, 1)}
        if any(not path.is_file() or path.stat().st_size == 0 for path in paths.values()):
            raise RuntimeError("Failed to extract selected reference frames")
        frames = [{"timestamp_seconds": round(stamp, 3), "requested_timestamp_seconds": round(t, 3),
                   "file": str(paths[index].relative_to(out))}
                  for t, (stamp, index) in zip(sample_times, picks)]
    except BaseException:
        shutil.rmtree(generation)
        raise
    summary = {
        "schema_version": 1,
        "analysis_type": "measured_editing_properties_not_semantic_video_understanding",
        "source_filename": video.name,
        **meta,
        "cut_threshold": threshold,
        "detected_cuts": len(cuts),
        "shot_count_estimate": len(shots),
        "average_shot_seconds": round(sum(lengths)/len(lengths), 3),
        "median_shot_seconds": round(sorted(lengths)[len(lengths)//2] if len(lengths)%2
                                      else sum(sorted(lengths)[len(lengths)//2-1:len(lengths)//2+1])/2, 3),
        "cuts_first_10_seconds": sum(c <= 10 for c in cuts),
        "shots": shots,
        "sampled_frames": frames,
        "limitations": [
            "Scene cuts are heuristic and may miss dissolves or rapid movement",
            "Frames are sampled, not a complete semantic understanding of every frame",
            "No dialogue transcription, action recognition, or copyrighted scene reproduction",
            "Use only input footage you are authorized to access"
        ]
    }
    # Concurrent or interrupted runs cannot replace the pictures behind an existing report.
    with tempfile.NamedTemporaryFile(mode="w", dir=out, delete=False, encoding="utf-8") as tmp:
        json.dump(summary, tmp, indent=2)
        tmp.write("\n")
    pathlib.Path(tmp.name).replace(out / "analysis.json")
    return summary

def main():
    parser = argparse.ArgumentParser(description="Measure reference-video editing and extract preview frames")
    parser.add_argument("video", help="Local, legally obtained video file")
    parser.add_argument("--output", default="reference-output")
    parser.add_argument("--threshold", type=float, default=0.27)
    parser.add_argument("--frames", type=int, default=16)
    args = parser.parse_args()
    print(json.dumps(analyze(args.video, args.output, args.threshold, args.frames),
                     indent=2))

if __name__ == "__main__":
    main()
