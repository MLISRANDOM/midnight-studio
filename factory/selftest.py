"""Offline render smoke test: never calls AI Horde or charges API credits."""
import json
import pathlib
import subprocess
import tempfile
import unittest
from PIL import Image
from episode_factory import video

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
            self.assertLess(length, 7.5)

if __name__ == "__main__":
    unittest.main()
