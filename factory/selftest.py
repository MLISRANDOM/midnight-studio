"""Offline render smoke test: never calls AI Horde or charges API credits."""
import json
import pathlib
import subprocess
import tempfile
import unittest
from PIL import Image
from episode_factory import video, quality_report

class EpisodeFactorySmokeTest(unittest.TestCase):
    def test_two_shot_mp4_with_narration(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            image_files = []
            shots = [
                {"id": "test001", "seconds": 3, "narration": "The lights went out."},
                {"id": "test002", "seconds": 3, "narration": "A second shadow appeared."},
            ]
            for i in range(2):
                image = out / ("frame-%d.png" % i)
                Image.new("RGB", (576, 320), (24 + i * 20, 34, 42)).save(image)
                image_files.append({"image": str(image)})
            path = video(shots, image_files, out, 576, 320)
            self.assertTrue(path.is_file())
            self.assertGreater(path.stat().st_size, 2000)
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                check=True, capture_output=True, text=True)
            length = float(probe.stdout.strip())
            self.assertGreater(length, 5)
            self.assertLess(length, 10)
            checked = quality_report(path, [
                dict(shot, _render_width=576, _render_height=320) for shot in shots],
                image_files, out)
            self.assertEqual(checked["status"], "technical_checks_passed")
            self.assertTrue((out / "technical-qa.json").is_file())

if __name__ == "__main__":
    unittest.main()
