"""Small offline tests for the one-idea entry point and the narration-timed export."""
import json
import math
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
import wave

from PIL import Image
from make import sizes
from series import SERIES, identify
from episode_factory import video


class IdeaFilmTest(unittest.TestCase):
    def test_formats_and_series(self):
        for idea, series, size in [
            ("A ship crosses a desert.", None, (960, 540)),
            ("TikTok about a shop that sells echoes", None, (540, 960)),
            ("Evan hears a knock in his bunker.", "The Safe Room Rules", (540, 960)),
            ("A widescreen Safe Room Rules episode", "The Safe Room Rules", (960, 540)),
            ("OCCUPANCY: Mara finds a sealed room.", "OCCUPANCY", (960, 540)),
            ("An occupancy sensor falls in love.", None, (960, 540)),
            ("Marc Jenkins answers a call from a moth.", "The Reality Helpdesk", (540, 960)),
            ("SpawnedSomewhereBad at an ice rink.", "Spawned Somewhere Bad", (960, 540)),
        ]:
            with self.subTest(idea=idea):
                self.assertEqual(identify(idea), series)
                self.assertEqual(sizes(idea, SERIES.get(series))[1], size)

    def test_speech_timed_cuts_and_phone_streaming(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp)
            audio, images, shots = [], [], []
            lengths = (2.09, 2.45)
            colors = ("red", "blue")
            for index, length in enumerate(lengths):
                wav = out / f"line{index}.wav"
                rate = 16000
                with wave.open(str(wav), "wb") as stream:
                    stream.setparams((1, 2, rate, 0, "NONE", ""))
                    stream.writeframes(b"".join(struct.pack("<h", int(6000 * math.sin(2 * math.pi * 280 * k / rate)))
                                                for k in range(round(length * rate))))
                still = out / f"still{index}.png"
                Image.new("RGB", (90, 160), colors[index]).save(still)
                audio.append(wav)
                images.append({"image": str(still)})
                shots.append({"narration": "Supplied speech", "seconds": 2})
            mp4 = video(shots, images, out, 90, 160, narration_files=audio)
            probe = json.loads(subprocess.check_output([
                "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-of", "json", str(mp4)
            ]))
            streams = {s["codec_type"]: s for s in probe["streams"]}
            frames_per_shot = [math.ceil((length + .35) * 24) for length in lengths]
            self.assertEqual(int(streams["video"]["nb_read_frames"]), sum(frames_per_shot))
            self.assertEqual(streams["audio"]["codec_name"], "aac")
            self.assertLess(abs(float(streams["audio"]["duration"]) - sum(frames_per_shot) / 24), .05)
            atoms = mp4.read_bytes()
            self.assertLess(atoms.index(b"moov"), atoms.index(b"mdat"))
            pixels = subprocess.check_output([
                "ffmpeg", "-v", "error", "-i", str(mp4), "-map", "0:v:0", "-vf", "scale=1:1",
                "-pix_fmt", "rgb24", "-f", "rawvideo", "-"
            ])
            self.assertEqual(len(pixels), 3 * sum(frames_per_shot))
            for i in range(sum(frames_per_shot)):
                red, _, blue = pixels[i * 3:i * 3 + 3]
                self.assertGreater(red - blue if i < frames_per_shot[0] else blue - red, 160)


if __name__ == "__main__":
    unittest.main()
