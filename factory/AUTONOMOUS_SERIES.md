# Midnight Studio Autonomous Series (experimental)

This is the **unattended draft generation** branch of Midnight Studio.

## Input and process
A one-time `factory/series_plan.json` supplies the series art direction and a list of episode ideas. The engine automatically:
1. Finds the next unfinished episode.
2. Constructs a four-shot story, narration, and image prompts from that episode's seed.
3. Uses free volunteer-hosted AI Horde image generation for up to two new shots in one run.
4. Reuses cached completed images on subsequent daily runs.
5. Synthesizes rough offline narration and produces a stitched MP4 draft.
6. Saves candidate images, manifests, reports, and videos in GitHub Actions artifacts.
7. Moves to the next episode the following scheduled run.

It is scheduled daily at **09:43 UTC** and can also run when the plan or workflow is changed. No button press is needed for the scheduled test plan.

## What autonomous currently means
Automated orchestration is real code, but there are **no guarantees** that volunteers will accept an anonymous AI Horde job. GitHub Actions must be enabled. GitHub-hosted runner/caching/artifact policies apply. The draft renderer uses **still frames** and **robotic espeak-ng speech**, not full animation or cinematic Foley. The deterministic outline writer is a placeholder for a real AI writer. No automatic social upload or monetization.

The default series plan is an original, isolated QA series. It deliberately does not overwrite Spawned Somewhere Bad or Safe Room Rules canon.

## Privacy and permanence
Anonymous AI Horde image requests may be publicly shared under the service's policies even if `shared=false` is requested. **Do not send private scripts, confidential images, or secrets** through an anonymous volunteer service.

Caches and Actions artifacts can expire. Approved series assets require permanent storage and actual QA verification, which is not yet automated. Generated assets are unapproved drafts and never copied over existing Google Drive originals.

## Read output
GitHub > Actions > **Autonomous Episode Draft Series** > a completed run > `autonomous-series-drafts` artifact. Within it, `series-status.json` reports which episodes were rendered. `factory/series_plan.json` can be edited to change the planned series.
