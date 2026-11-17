"""Offline checks for deterministic episode planning and safe manifests."""
import json
import pathlib
import unittest
from series_runner import scene_manifest, slug

class AutoSeriesTests(unittest.TestCase):
    def test_valid_plan_and_distinct_episodes(self):
        plan = json.loads(pathlib.Path("factory/series_plan.json").read_text())
        ids = [slug(ep["id"]) for ep in plan["episodes"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(len(ids), 2)
        prompts = []
        for ep in plan["episodes"]:
            manifest = scene_manifest(plan, ep)
            self.assertEqual((manifest["width"], manifest["height"]), (576, 320))
            self.assertTrue(manifest["draft_only"])
            self.assertEqual(len(manifest["shots"]), 4)
            self.assertTrue(all(8 <= len(s["prompt"]) <= 1800 for s in manifest["shots"]))
            self.assertTrue(all(s["narration"] for s in manifest["shots"]))
            prompts.append(manifest["shots"][0]["prompt"])
        self.assertNotEqual(prompts[0], prompts[1])

    def test_disallow_unsafe_episode_ids(self):
        for value in ("../secrets", "", "/tmp/evil", "bad name"):
            with self.assertRaises(ValueError):
                slug(value)

if __name__ == "__main__":
    unittest.main()
