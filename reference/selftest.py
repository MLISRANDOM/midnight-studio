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
        # Synthetic footage with two hard cuts and no audio.
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
        assert report["audio_present"] is False
        # The last 1 fps picture is displayed for a second after its PTS.
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
             "color=yellow:size=96x64:rate=1:duration=3", "-c:v", "mpeg4", str(p / "slow.mp4")])
        prior = list(report["sampled_frames"])
        sparse = analyze(p / "slow.mp4", p / "out", max_frames=16)
        assert len(sparse["sampled_frames"]) == 16
        final = sparse["sampled_frames"][-1]
        assert final["requested_timestamp_seconds"] > 2 and final["timestamp_seconds"] == 2, final
        assert len({f["file"] for f in sparse["sampled_frames"]}) == 3
        assert set(f["file"] for f in sparse["sampled_frames"]).isdisjoint(f["file"] for f in prior)
        assert all((p / "out" / f["file"]).stat().st_size > 0 for f in prior)
        assert json.loads((p / "out" / "analysis.json").read_text()) == sparse
        print("PASS: sparse timestamps and safe repeat export")
        print("PASS: video measured, hard cuts detected, sampled full-duration frames")
        print(json.dumps({"duration":report["duration_seconds"],
                          "shots":report["shot_count_estimate"],"frames":len(report["sampled_frames"])}))
if __name__ == "__main__":
    main()
