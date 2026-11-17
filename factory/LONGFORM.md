# Ten-minute Episode Factory blueprint

A ten-minute, 80-shot episode is now supported by `factory/longform_planner.py` and `factory/episode_factory.py`. Use `factory/longform_example.json` as the reference schema.

The longform planner deterministically creates 80 distinct visual prompts, shot IDs S001–S080, narration lines, eight story acts, and target timing of 600 seconds. Rendering may run longer than the target when narration cannot fit an individual shot without truncation.

The autonomous runner selects the longform planner automatically when `shot_count >= 12` in an episode entry. The active `factory/series_plan.json` is deliberately **unchanged** until the small AI image test finishes, to preserve its existing checkpoint cache. Every result is a **draft**, not a finished publishable episode.

Image generation is bounded to at most six new shots in one GitHub Actions run, even for 120-shot plans. The cloud workflow currently chooses two. More shots can be scheduled after verifying actual quotas and character consistency.

This is currently an 80-frame motion comic, **not 80 fully animated clips**. The deterministic longform writing is a structural fallback; it does not replace editorial storytelling, sustained character-reference guidance, licensed music, or full animation. GitHub Actions artifacts are temporary. Future episodes must not overwrite or regenerate approved `Spawned Somewhere Bad` shots.

## Scheduled production pacing (November 2026)
The autonomous production queue is configured for four checks daily at 03:43, 09:43, 15:43, and 21:43 UTC, generating at most four new candidate images per run with a minimum 35-second start-to-start spacing. These settings help avoid spiking anonymous free-generation services, but **do not guarantee quotas or availability**. GitHub may delay scheduled workflows. Episode images are cached and not regenerated when valid. The existing current shots remain draft-only, with visual character continuity still unverified. At most sixteen fresh shots per ordinary scheduled day are attempted, not necessarily completed.
