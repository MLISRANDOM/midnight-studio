"""Measure one public, authorized reference. Publish only a compact numeric profile."""
import argparse
import base64
import bisect
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen
from zipfile import ZipFile

MAX_BYTES = 128 * 1024 * 1024
MAX_SECONDS = 1200
CREATOR_MASTERS = {
    "HOfdboHvshg": ("https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4",
                    None, "b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254"),
    "YE7VzlLtp-4": ("https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4.zip",
                    "BigBuckBunny_320x180.mp4", "f78f39603e6774907f2faafabf26a667f4a6fc31769ec304a8a8f7c62d280508"),
}
LAB = "https://mlisrandom.github.io/midnight-studio/motion/"

def video_id(value):
    url = urlparse(value.strip())
    if url.scheme != "https" or url.username or url.password or url.port:
        raise ValueError("Use an HTTPS YouTube video link.")
    parts = [p for p in url.path.split("/") if p]
    found = ""
    if url.hostname in ("youtu.be", "www.youtu.be") and len(parts) == 1:
        found = parts[0]
    if url.hostname in ("www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com"):
        if url.path == "/watch":
            found = parse_qs(url.query).get("v", [""])[0]
        elif len(parts) == 2 and parts[0] in ("shorts", "live", "embed"):
            found = parts[1]
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", found):
        raise ValueError("Expected a single YouTube video ID.")
    return found

def valid_youtube_media(dest, expected, probe):
    if not dest.is_file() or not 0 < dest.stat().st_size <= MAX_BYTES:
        return False
    if not isinstance(expected, (int, float)) or not 0 < expected <= MAX_SECONDS:
        return False
    try:
        duration = probe(dest)["duration_seconds"]
    except (subprocess.CalledProcessError, ValueError, OSError, KeyError, subprocess.TimeoutExpired):
        return False
    return duration > 0 and abs(duration - expected) <= min(2, max(.5, expected * .02))

def copy_bounded(source, dest):
    digest = hashlib.sha256()
    size = 0
    with dest.open("wb") as out:
        while chunk := source.read(1024*1024):
            size += len(chunk)
            if size > MAX_BYTES:
                raise ValueError("Creator master exceeds the job size limit.")
            out.write(chunk)
            digest.update(chunk)
    return digest.hexdigest()

def creator_master(video, dest):
    url, member, expected = CREATOR_MASTERS[video]
    with ExitStack() as stack:
        source = stack.enter_context(urlopen(url,timeout=45))
        if member:
            archive = dest.with_suffix(".zip")
            copy_bounded(source,archive)
            package = stack.enter_context(ZipFile(archive))
            source = stack.enter_context(package.open(member))
        if copy_bounded(source,dest) != expected:
            raise ValueError("The creator master no longer matches its verified checksum.")

def download(video, work, probe):
    canonical = "https://www.youtube.com/watch?v=" + video
    dest = work / "input.mp4"
    command = [sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-playlist",
               "--write-info-json", "--no-progress", "--no-warnings", "--socket-timeout", "12", "--retries", "0",
               "--fragment-retries", "0", "--max-filesize", "128M", "--match-filters",
               f"duration > 0 & duration <= {MAX_SECONDS} & !is_live",
               "-f", "best[ext=mp4][height<=480]/bestvideo[ext=mp4][height<=480]",
               "-o", str(dest), "--", canonical]
    try:
        subprocess.run(command, check=True, timeout=240)
        info = json.loads((work / "input.info.json").read_text())
        if info.get("id") == video and valid_youtube_media(dest, info.get("duration"), probe):
            return dest, "YouTube public stream"
        print("YouTube did not return a valid matching full-length video.", flush=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, ValueError):
        pass
    if video not in CREATOR_MASTERS:
        raise RuntimeError("YouTube did not deliver a permitted MP4 within the job limits. "
                           "Open Motion Lab and select the authorized original from Files or Drive.")
    creator_master(video, dest)
    return dest, "Blender Foundation downloadable master"

def picture_statistics(video, duration, cuts):
    # FFmpeg returns an evenly spaced, low-resolution RGB stream across the full source.
    # Do not compare across detected hard cuts when estimating movement within a shot.
    rate = min(4.0, 1800 / duration)
    block = 64 * 36 * 3
    cmd = ["ffmpeg", "-v", "error", "-nostdin", "-i", str(video), "-map", "0:v:0",
           "-vf", f"fps={rate:.8f},scale=64:36", "-an", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True, timeout=300).stdout
    count = len(raw) // block
    if not count or count * block != len(raw) or abs(count - duration*rate) > 2:
        raise ValueError("Failed to decode complete color samples.")
    light = motion = kept = 0
    prior = None
    prior_shot = None
    for index in range(count):
        frame = raw[index*block:(index+1)*block]
        light += .2126*sum(frame[::3]) + .7152*sum(frame[1::3]) + .0722*sum(frame[2::3])
        shot = bisect.bisect_right(cuts, index/rate)
        if prior is not None and shot == prior_shot:
            motion += sum(abs(a-b) for a,b in zip(frame,prior))
            kept += 1
        prior, prior_shot = frame, shot
    return {"sample_count": count, "average_luminance": round(light/(count*64*36*255), 3),
            "within_shot_change": round(motion/(max(1,kept)*block*255),3)}

def handoff(video, report):
    payload = json.dumps({"id":video,"report":report}, separators=(",",":"), allow_nan=False).encode()
    fragment = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    return LAB + "#reference=" + fragment

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--authorized", action="store_true", required=True)
    parser.add_argument("--analyzer", type=Path, default=Path("reference"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    video = video_id(args.url)
    sys.path.insert(0, str(args.analyzer.resolve()))
    from video_analysis import analyze, probe
    with tempfile.TemporaryDirectory(prefix="motion-reference-") as folder:
        work = Path(folder)
        source, route = download(video, work, probe)
        seconds = probe(source)["duration_seconds"]
        if not 0 < seconds <= MAX_SECONDS:
            raise ValueError("This on-demand job accepts videos up to 20 minutes.")
        measured = analyze(source, work / "analysis", max_frames=4)
        cuts = [s["start_seconds"] for s in measured["shots"][1:]]
        report = {key:measured[key] for key in ("duration_seconds","median_shot_seconds","shot_count_estimate","cuts_first_10_seconds")}
        third = seconds/3
        spans = [round(third/(1+sum(third*i < t < third*(i+1) for t in cuts)),3) for i in range(3)]
        report.update(kind="ffmpeg-technique-v1", source_route=route, youtube_id=video,
                      shot_span_seconds_by_third=spans)
        report.update(picture_statistics(source,seconds,cuts))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    url = handoff(video,report)
    print(json.dumps(report,indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as out:
            out.write("### Measured reference\n\n")
            out.write(f"Source: {route}. Decoded the full {seconds:.2f} s video. ")
            out.write(f"Estimated {report['shot_count_estimate']} shots.\n\n[Open measurements in Motion Lab]({url})\n")
    else:
        print(url)

if __name__ == "__main__":
    main()
