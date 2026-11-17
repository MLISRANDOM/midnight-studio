"""No-network tests for full-length 80-shot storyboard planning."""
import json
import pathlib
import unittest
from longform_planner import longform_manifest

class LongformTests(unittest.TestCase):
    def test_eighty_shot_ten_minute_plan(self):
        series = json.loads(pathlib.Path("factory/series_plan.json").read_text())
        episode = dict(series["episodes"][0], shot_count=80, duration_seconds=600)
        a = longform_manifest(series, episode)
        b = longform_manifest(series, episode)
        self.assertEqual(a, b)
        self.assertEqual(len(a["shots"]), 80)
        self.assertEqual(sum(s["seconds"] for s in a["shots"]), 600)
        self.assertEqual(a["shots"][0]["id"], "S001")
        self.assertEqual(a["shots"][-1]["id"], "S080")
        self.assertEqual(len(set(s["prompt"] for s in a["shots"])), 80)
        self.assertTrue(all(8 <= len(s["prompt"]) <= 1800 for s in a["shots"]))
        self.assertTrue(a["draft_only"])
    def test_invalid_size_rejected(self):
        with self.assertRaises(ValueError):
            longform_manifest({}, {"shot_count": 121})
        with self.assertRaises(ValueError):
            longform_manifest({}, {"shot_count": 80, "duration_seconds": 100})

if __name__ == "__main__":
    unittest.main()
