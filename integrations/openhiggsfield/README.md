# OpenHiggsfield integration for Midnight Studio

## Status
Integration preparation only. OpenHiggsfield has NOT been installed or deployed yet. This folder is a non-destructive handoff for deploying it alongside Midnight Studio.

## Upstream project
- Source: https://github.com/wide-trace/open-higgsfield
- Hosted studio: https://openhiggsfield.ai
- Technology: Next.js 16, React 19, pnpm
- Generation requires your own platform API key (id:secret). The interface being open-source does not make model inference free.
- Additional services may be required, including Vercel Blob for media uploads.

## Important license check
At inspection time, the upstream repository root did not contain a LICENSE file. A README describing a project as open-source is not by itself a reusable software license. Do not vendor, copy, or redistribute upstream source into Midnight Studio until permission or an explicit license is confirmed.

## Phone-friendly setup without overwriting Midnight Studio
1. Open https://github.com/wide-trace/open-higgsfield in Safari.
2. Review its usage terms and confirm permission to deploy it.
3. In Vercel, select **Add New Project** and import the upstream repository if the account and repository permissions allow it. If a fork is needed, use GitHub's Fork action only once permission is established.
4. Set the deployment's root to the upstream repository root. Framework: Next.js. Build command: `pnpm build`. Install command: `pnpm install`.
5. Configure environment variables on the hosting platform, not inside GitHub files:
   - `HF_API_BASE_URL`: your approved generation API origin
   - `OPEN_HIGGSFIELD_READ_WRITE_TOKEN`: Vercel Blob token when using uploads
6. Deploy the project independently from Midnight Studio.
7. Open the deployed studio and supply your own platform key through its Add key flow.
8. Verify generation, gallery, media upload and model availability before wiring production shots.

## Keeping Spawned Somewhere Bad safe
- Do not replace `index.html` or change GitHub Pages publishing settings.
- Do not move or overwrite `spawned-somewhere-bad/`, `occupancy/`, or production trackers.
- Keep approved images in their existing Google Drive folders.
- Do not inject API keys into public GitHub files, commits, or frontend JavaScript.

## Integration plan after deployment
Connect Midnight Studio's shot manifest and approved references to the independent OpenHiggsfield deployment through a reviewed, authenticated server-side adapter. Treat generated media as drafts until reviewed, then update the existing production tracker only after upload verification.

## Quick links
- [OpenHiggsfield hosted studio](https://openhiggsfield.ai)
- [OpenHiggsfield GitHub](https://github.com/wide-trace/open-higgsfield)
- [Midnight Studio](https://github.com/MLISRANDOM/midnight-studio)
