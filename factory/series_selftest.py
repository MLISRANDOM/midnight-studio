"""Offline checks for deterministic episode planning and safe manifests."""
import json
import pathlib
import unittest
from series_runner import scene_manifest, slug, free_narration

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

    def test_volunteer_writer_fallback_offline(self):
        import os
        from unittest.mock import patch
        with patch.dict(os.environ, {"FACTORY_FREE_TEXT": "0"}):
            self.assertIsNone(free_narration({}, {}))
        plan = json.loads(pathlib.Path("factory/series_plan.json").read_text())
        lines = ["Narration sentence %s includes a spooky detail." % i for i in range(4)]
        manifest = scene_manifest(plan, plan["episodes"][0], lines)
        self.assertEqual(manifest["narration_source"], "volunteer_ai_text")
        self.assertEqual([x["narration"] for x in manifest["shots"]], lines)

    def test_disallow_unsafe_episode_ids(self):
        for value in ("../secrets", "", "/tmp/evil", "bad name"):
            with self.assertRaises(ValueError):
                slug(value)

if __name__ == "__main__":
    unittest.main()
