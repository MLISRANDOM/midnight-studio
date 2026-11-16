# Secure Runway export | Episode 01

The workflow [Spawned Somewhere Bad export Runway candidates](../../.github/workflows/spawned-export-runway.yml) is ready in GitHub Actions. It does **not** run automatically.

## Why there is one setup step
The Runway ChatGPT connection can confirm completed tasks and return temporary signed media URLs, but its current tools cannot directly export their image bytes into Google Drive. Github must be given a **private** set of signed URLs for a one-time network-enabled collection. Never post signed URLs into public GitHub files or issues.

## iPhone-only activation
1. Open GitHub repository Settings > Secrets and variables > Actions > New repository secret.
2. Name it `SPAWNED_RUNWAY_ASSETS_JSON`.
3. Enter JSON of the form:
   ```json
   {"assets":[{"shot":"S120","url":"<Runway signed HTTPS media URL>"},{"shot":"S121","url":"<Runway signed HTTPS media URL>"}]}
   ```
   Replace placeholders with actual full links from the authenticated Runway task results. Keep the JSON private.
4. Open repository **Actions > Spawned Somewhere Bad export Runway candidates > Run workflow**.
5. When successful, download the `spawned-somewhere-bad-runway-candidates` artifact. Each frame is saved as `S###.png` with a candidate-only manifest.
6. Review images for continuity and upload approved ones into the Drive **Approved Images** folder. Rejected frames remain separate.

The image collector validates the origin, size, landscape ratio and duplicate shot numbers before producing a ZIP artifact. This does **not** amount to visual approval. If a signed URL expires, retrieve a fresh URL and rerun.

Do not alter original tracker records until approved images actually exist in Drive.

**Existing state:** 150 numbered images in Drive; 27 completed Runway jobs not yet copied to Drive; 228-shot storyboard.

[Approved Images](https://drive.google.com/drive/folders/1UwKyJyprsgdThoY4PhS4pK6tjrDylSJy)

[Episode root folder](https://drive.google.com/drive/folders/1Ho3zYLgs7RwF-4P6hM5Z6V5RXZPRc-wG)
