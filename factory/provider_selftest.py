"""Offline tests of provider selection and automatic no-cost failover."""
import os
import unittest
from unittest.mock import patch
from episode_factory import generate

class FreeProviderTest(unittest.TestCase):
    def test_primary_ovh(self):
        with patch.dict(os.environ, {"FACTORY_IMAGE_PROVIDER": "ovh"}), \
             patch("episode_factory.generate_ovh", return_value={"status": "draft_needs_qa", "provider": "ovh"}) as ovh, \
             patch("episode_factory.generate_horde") as horde:
            result = generate({"id": "S001"}, None, 0, 576, 320, 5)
            self.assertEqual(result["provider"], "ovh")
            ovh.assert_called_once()
            horde.assert_not_called()

    def test_fallback_to_horde(self):
        with patch.dict(os.environ, {"FACTORY_IMAGE_PROVIDER": "ovh"}), \
             patch("episode_factory.generate_ovh", side_effect=RuntimeError("no quota")), \
             patch("episode_factory.generate_horde", return_value={"status": "draft_needs_qa", "provider": "horde"}) as horde:
            result = generate({"id": "S001"}, None, 0, 576, 320, 5)
            self.assertEqual(result["provider"], "horde")
            horde.assert_called_once()

    def test_both_fail_loudly(self):
        with patch("episode_factory.generate_ovh", side_effect=RuntimeError("OVH unavailable")), \
             patch("episode_factory.generate_horde", side_effect=RuntimeError("Horde unavailable")):
            with self.assertRaisesRegex(RuntimeError, "Both free image providers failed"):
                generate({"id": "S001"}, None, 0, 576, 320, 5)

if __name__ == "__main__":
    unittest.main()
