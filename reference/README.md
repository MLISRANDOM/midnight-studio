# Reference Video Analyzer v1

This is an **offline, deterministic analysis component** for Midnight Studio. It processes a video **file**, not a public URL, and requires FFmpeg and ffprobe. It provides an editable JSON report and sampled frames that can feed the existing Reference Lab after UI integration.

## Usage

```bash
python reference/video_analysis.py authorized_reference.mp4 --output reference-output --frames 16
```

Each run writes `reference-output/analysis.json` and a new set of JPEGs beneath `reference-output/frames/`. Use the relative paths from the report. Each sample records the requested time and the actual display timestamp. Several samples can reference the same picture in sparse footage.

Reports duration, dimensions, framerate, presence of audio, cut timestamps, shot-length distribution, first-ten-second cut count, and a time-spread frame index. Cut detection uses FFmpeg's scene-change threshold; it is heuristic, not human-level video comprehension.

## What is tested

```bash
python reference/selftest.py
```

Creates wholly synthetic hard-cut footage, measures it, and verifies extracted frames, with no video download, GPU, subscription, remote service, AI model or user data.

## iPhone integration plan

The current GitHub static web UI **cannot execute FFmpeg** from an iPhone browser. This module therefore needs a legal source-file upload and a bounded, separately triggered compute job, such as GitHub Actions or an appropriately provisioned service, then an authenticated return of the JSON and preview assets. GitHub Actions has usage limits, artifact retention limits and run-time policies. Do not treat it as unlimited hosted GPU inference.

A YouTube link requires a separate lawful ingestion layer with access controls, size/time limits, download failure handling and provenance metadata. This v1 component deliberately does not bypass YouTube restrictions, claim to watch an inaccessible URL, or copy a reference creator's characters/plot/dialogue.

## Integration boundaries

- **Measured now:** technical properties, video cuts and sampled images.
- **Not included:** semantic vision understanding, full audio transcription, narrative recommendations, YouTube fetching, video synthesis, character identity lock, Google Drive writeback.
- **Next:** import analysis.json into the Reference Lab; optionally connect licensed multimodal analysis after permitted ingestion.
- **Safety:** use only video you own or have permission to process.
