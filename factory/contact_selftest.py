"""Offline test of the contact-sheet generator with synthesized images."""
import json
import pathlib
import tempfile
import unittest
from PIL import Image
from visual_contact_sheet import make_one_episode

class ContactSheetTests(unittest.TestCase):
    def test_contact_and_report(self):
        with tempfile.TemporaryDirectory() as base:
            episode = pathlib.Path(base) / "test-episode"
            draft = episode / "draft-images"
            draft.mkdir(parents=True)
            for i in range(1,4):
                Image.new("RGB", (576,320), (20*i,30,40)).save(draft/f"S{i:03}.png")
            report = make_one_episode(episode)
            self.assertEqual(report["draft_images"],3)
            self.assertEqual(len(report["pages"]),1)
            self.assertTrue(report["checks"]["all_files_decode"])
            self.assertFalse(report["checks"]["release_approved"])
            self.assertTrue((episode/"contact-sheets"/"contact-01.jpg").is_file())
            self.assertTrue((episode/"image-qa.json").is_file())

if __name__=="__main__":
    unittest.main()
