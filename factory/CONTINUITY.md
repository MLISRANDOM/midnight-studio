# Image continuity policy

An episode should not mix unrelated model aesthetics. The factory records the first successful image provider and locks the rest of that episode to it. If the provider is temporarily unavailable, it preserves completed shots and tries again on a later scheduled run rather than switching mid-episode.

For AI Horde, the factory also stores the first successful model name and requests the same model for subsequent shots when the volunteer service supports it.

This **does not guarantee the same character face, costume, location, or drawing style** from text-to-image generations. Technical QA checks codec, duration and dimensions, not visual accuracy. Draft images require visual continuity review before being described as approved.

Earlier QA test run 44185370517 mixed S001-S002 from AI Horde and S003-S004 from OVHcloud; it remains a valid technical test but is NOT visually approved. The lock protects subsequent episodes.
