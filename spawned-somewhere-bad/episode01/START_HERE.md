# START HERE | Spawned Somewhere Bad E01

## Resume state
- Episode: **30 Days at Freddy's**
- Script/storyboard length: **228 shots**, narration approximately **11m 10s**.
- On the Drive audit, **150 individual numbered S###.png images existed**, not just 142 as the historical tracker filename suggests.
- **27 additional Runway jobs were completed** in the connected personal workspace **Montel**. They are **not automatically Drive-uploaded and not approved**.
- Conservative verified coverage remains **150/228 in Drive** until 27 candidates pass image QA and are uploaded.
- Do not regenerate shots that already exist in Drive. Do not overwrite existing source tracker or its status history.
- Distinguish candidate/Runway success, reviewed/approved, uploaded/verified, rejected, and missing.

## Sources (Google Drive)
1. [Original storyboard, tracker, approved character sheet and audio](https://drive.google.com/drive/folders/1qSdTcfg6WzOteNh18-JzgU3Zg4VLxll-)
2. [Approved full-resolution images](https://drive.google.com/drive/folders/1UwKyJyprsgdThoY4PhS4pK6tjrDylSJy)
3. The `SpawnedSomewhereBad_Runway_27_Shot_Manifest.json` links 27 shot numbers to their task IDs. Consult it instead of inventing shots or task IDs.
4. The `SpawnedSomewhereBad_Runway_27_Generation_Verified.json` records which generations succeeded; it is a completion status, **not image QA**.

## Canonical hero / style lock
Approved character sheet is authoritative: brown skin, compact curly black fade, shaped full black beard, slim long limbs and narrow torso, charcoal hoodie with orange inner hood lining and white drawstrings, black pants, black sneakers with white soles. Brown backpack when relevant. Bold black outlines, flat colors, expressive large white eyes, simple cel-shaded cinematic lighting. No headlamp or glasses. No captions, no collages. No unwanted tools/weapons. Individual 16:9 stills.

## Image QA per shot
Check (a) match storyboard action and timing, (b) hero identity and wardrobe, (c) scene continuity and props, (d) one composition, (e) frame dimensions and visibility, (f) no text artifacts. Any mismatch must be rejected and the reason recorded.

## Current audit
First numbered gaps: `S120, S121, S123, S138, S140` (all among 27 Runway candidate jobs). Drive also contains shots `S167` and `S222`. Missing list must be recomputed on every resume, not blindly copied from this document.

## Batch protocol
- Work in **3–5 shot batches**, review and verify each upload before next batch.
- Reconcile Drive images first, then Runway task results, then QA, then upload.
- Store updated manifest in production Drive; use this GitHub repo for checkpoint documents and scripts.
- Existing OCCUPANCY assembly examples are under `occupancy/scripts/`, but do not run those against this episode without changing paths and timing manifest.
- The public repository must never contain signed Runway media URLs, service keys, or private credentials.
- Do not silently change narration, title, continuity rules or existing approved files.
