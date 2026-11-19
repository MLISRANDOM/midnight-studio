#!/usr/bin/env python3
"""Offline end-to-end reference analyzer test, using wholly synthetic footage."""
import json
import pathlib
import subprocess
import tempfile
from video_analysis import analyze

def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True, text=True)

def main():
    with tempfile.TemporaryDirectory() as d:
        p = pathlib.Path(d)
        # Hard cuts and a real audio track, not downloaded copyrighted video.
        for idx, color in enumerate(("red", "blue", "green")):
            run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi",
                 "-i", f"color=c={color}:s=320x180:r=12:d=1",
                 "-c:v", "mpeg4", "-q:v", "3", str(p / f"clip{idx}.mp4")])
        text = "".join(f"file 'clip{i}.mp4'\n" for i in range(3))
        (p / "list.txt").write_text(text)
        run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
             "-i", str(p / "list.txt"), "-c", "copy", str(p / "test.mp4")])
        report = analyze(p / "test.mp4", p / "out", threshold=0.12, max_frames=4)
        assert 2.7 <= report["duration_seconds"] <= 3.3, report
        assert report["width"] == 320
        assert report["shot_count_estimate"] >= 2, report
        assert len(report["sampled_frames"]) == 4, report
        assert (p / "out" / "analysis.json").is_file()
        assert all((p / "out" / f["file"]).stat().st_size > 0 for f in report["sampled_frames"])
        print("PASS: video measured, hard cuts detected, sampled full-duration frames")
        print(json.dumps({"duration":report["duration_seconds"],
                          "shots":report["shot_count_estimate"],"frames":len(report["sampled_frames"])}))
if __name__ == "__main__":
    main()
