# OCCUPANCY Episode 1 Image Factory

**Status:** No-cost preparation and QA dry run. This repo does NOT invoke image generators or spend credits.

## Canon and output
- Approved source storyboard: occupancy/episode01/storyboard.csv (80 shots, 600 seconds).
- Planning format: landscape 16:9, 1280x720. The final image/video framing must preserve this.
- Mara: high-bun braids, silver hoops, navy maintenance jacket with crossed-tools patch, gray cargo pants and olive pack.
- Jonah: older man, full gray beard, brown cap, olive work jacket and blue jeans.
- Leah: dark-skinned woman, low ponytail braids, navy paramedic jacket with medical insignia and medical bag.
- NO Evan. Cartoon: flat colors, large white eyes, bold black outlines, dramatic blue nighttime lighting.
- Vanished room 604: smooth seamless wall, no portal, outline, destroyed drywall or glowing rectangle.
- Text, signs, HUD values and clock digits added during editing, NEVER generated as image text.

## iPhone steps (ready now)
1. Visit GitHub Actions in this repo, select OCCUPANCY storyboard batch dry run.
2. Open a successful run and download artifact occupancy-e01-comfyui-batches.
3. Extract first8/shot_plan.json, first8/bulkprompt.csv and first8/review_checklist.md.
4. The first eight shots require 5 new generated images: shot 1 uses approved before/after images, shot 4 reuses the smooth-wall frame, and shot 8 is edited to black without image generation.
5. For the rest of the episode, full/ contains candidate prompts and QA metadata for all 80 storyboard shots. Some infographic shots need compositing review rather than finished AI lettering.

## GPU-hosted ComfyUI step (NOT yet configured)
- Install ComfyUI: https://github.com/Comfy-Org/ComfyUI
- Install BulkPrompt: https://github.com/sifatrads/comfyui-bulk-prompt (MIT). Place exported bulkprompt.csv in its csv_files folder, wire its positive/negative/text-tag outputs into a compatible workflow and keep the UI open during the auto-loop.
- Optional SceneQueue frontend: https://github.com/al4xdev/scenequeue (MIT, unmaintained, as-is). This is NOT deployed or integrated here yet.
- A compatible model, checkpoint, **GPU**, and an identity-preserving reference adapter/workflow are required for convincing character consistency. Text prompts alone DO NOT use the approved reference images. shot_plan.json lists which approved reference sheets must be provided to the workflow for each image.
- SceneQueue's default server has no authentication. Keep it private on a trusted network, not publicly accessible.
- Do not put access tokens, private keys, or personal reference photos in a public repo. GH Actions has no GPU for generation; it only prepares the CSV, JSON and checklist.

## First 8 shot plan
1. 604 exists, then vanished: reuse previously approved before/after pair.
2. Mara freezes with tape measure: generate.
3. Tape measure across shortened hallway: generate.
4. Smooth plaster where 604 stood: reuse approved after frame.
5. Mara holds maintenance key: generate.
6. Elevator opens behind Mara: generate.
7. Blank elevator indicator for typography added later: generate.
8. Hall lights cut to black: edit only.

Quality gate: Mara and Leah MUST have different hair and work clothes; no Evan, no gibberish signs, no missing-wall cracks or glowing portals.

Scripts: python occupancy/scripts/prepare_batch.py --limit 8 --out occupancy/out/first8

No paid generation has been submitted.

## Runway-to-MP4 cloud bridge (added)
- Workflow: [OCCUPANCY collect Runway stills and assemble YouTube episode](../../.github/workflows/occupancy-runway-assemble.yml)
- File collector: `scripts/collect_runway.py`
- 1080p widescreen assembler: `scripts/assemble_episode.py`
- The user does **not** need to download individual images. GitHub-hosted runners download generated Runway images by URL and assemble MP4.
- **Required secure setup:** A GitHub Actions repository secret named `RUNWAY_ASSETS_JSON` containing a JSON object with `assets`: entries having `shot` and the corresponding short-lived Runway signed media `url`. Only set secrets using GitHub's private Settings > Secrets and variables > Actions; NEVER commit temporary signed links to this public repo.
- The ChatGPT/GitHub connector here can write scripts but cannot create repository secrets or dispatch workflow runs. Accordingly collection has not been live-validated. An external authorized setup step is still required. Signed URLs expire, so collection should run soon after a new batch.
- The renderer has been locally tested using the existing apartment 604 before/after images. This verifies assembly only, not Runway image retrieval.
- Web-app Runway credits and Runway Developer API credits are separate. An API key is not assumed to give access to ChatGPT-connected workspace image tasks.
