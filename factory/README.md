# Midnight Studio Episode Factory v0.1

A **draft-only**, GitHub-hosted, best-effort, resumable pipeline for making an original short animated motion-comic with almost no user interaction.

## What this version actually does
1. Read a JSON episode manifest with 1-6 shots.
2. Generate candidate still images using AI Horde volunteer image workers (anonymous key by default).
3. Download and validate candidate images.
4. Narrate each shot using offline espeak-ng (robotic placeholder voice).
5. Assemble fixed-length 24fps video clips, then an MP4 using FFmpeg.
6. Upload the MP4, draft images and report as GitHub Actions artifacts.

**Does not:** generate sophisticated animation, guarantee character continuity, generate human-quality narration, upload to Google Drive or YouTube, keep running independently of a workflow trigger, create a full script autonomously, or mark anything approved. It never overwrites existing shot trackers, approved image folders or old episodes.

## Unattended test and checkpoint recovery

The workflow runs automatically on changes to factory files and is scheduled daily at 09:17 UTC. It processes at most **two new shots per run** to bound volunteer load. It restores the latest matching GitHub Actions cache, verifies previously completed PNGs, and continues unfinished shots; it does not regenerate successful cached shots. GitHub caches are temporary and may be evicted, so recovery is best-effort, not permanent storage. You can turn off the schedule by editing the workflow.

Before submitting any external generation, the workflow executes `python factory/selftest.py`: an offline two-shot test of the free espeak-ng/FFmpeg render path. Failed tests prevent an external generation request.

**No user prompt is created automatically from a title.** A manifest containing specific scene prompts and narration must exist. No automatic YouTube publishing. Generated frames remain drafts, never approved assets.

## Launch
Open GitHub > Actions > **Episode Factory (free draft test)** > Run workflow. The default manifest is `factory/demo_episode.json`. No API key is required for anonymous queue entry. The optional secret `AI_HORDE_API_KEY` gives access to an account's assigned kudos, not unlimited paid processing.

Each generation can take a long time or fail when volunteer workers are unavailable. GitHub Actions run time and storage are subject to GitHub's usage policies. If the workflow fails, its report and partial draft images should still be available as artifacts.

## Add a new episode
Commit a JSON manifest in `factory/` with the same shape as `demo_episode.json`. Each shot includes an ID, prompt, optional negative prompt, seconds and optional narration. Run the workflow with that file path. For the initial test, use no more than 6 shots; the script enforces this cap.

The output is a *review* artifact, not approved production footage. Image sizes are restricted to fit volunteer capacity. Final renders need higher-resolution art and higher-quality voice. Keep production assets in their existing Google Drive folders.

## Architectural next steps
- Source new episodes from a tracked script/storyboard with character reference assets.
- Add an AI text planner and voice provider only if credentials/free quotas permit.
- Store generation IDs and retryable checkpoints in a persistent queue.
- Add visual continuity review and human approval only for exceptions.
- Replace prototype espeak narration with licensed high-quality audio.
- Connect authenticated Drive upload and final delivery with verified IDs.
- Add a controller that queues batches across Actions runs and observes service quotas.

No background agent or free image service can honestly guarantee unlimited, uninterrupted generation.
