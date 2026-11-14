# The Safe Room Rules: cloud episode renderer

This folder is the video assembly stage of production. It combines **scene images**, **optional narration audio**, and **exact legible text** into a 1280x720 H.264/AAC MP4. It does not invent artwork, generate AI motion, or synthesize speech.

## Phone-only workflow

1. Open `render/episode.json` in GitHub and choose **Edit** to change the title, captions, exact warning/rule text, duration, or image/audio paths.
2. Upload your approved image files to `render/media/` using GitHub's **Add file > Upload files**, or ask ChatGPT to help manage the repository.
3. For an image, add `"image": "render/media/scene-01.png"` to that scene. Supported image formats are those Pillow can open (PNG/JPEG/WebP recommended).
4. For an optional voice track, upload WAV/MP3/M4A/AAC/OGG and add `"audio": "render/media/narration-01.mp3"`.
5. Saving `render/episode.json` on the `main` branch runs the cloud renderer. You may also open **Actions > Render Safe Room Episode > Run workflow**.
6. Open the finished Actions run and download **safe-room-episode-mp4** from the **Artifacts** section. Extract the ZIP to find the MP4 on your iPhone.

An image or audio property may be omitted. Without an image, the renderer makes an unmistakable dark placeholder illustration. Without audio, the scene is silent.

## Example scene

```json
{
  "title": "The warning",
  "caption": "Evan finds a new message bolted to the bunker wall.",
  "text": "RULE 3\nNEVER OPEN THE DOOR AFTER MIDNIGHT.",
  "seconds": 6,
  "image": "render/media/scene-01.png",
  "audio": "render/media/narration-01.mp3"
}
```

**Text is typeset by the video renderer.** It is not drawn by FLUX or another image model, so the final words match the manifest. With an existing image containing gibberish writing, the gibberish in the image will remain underneath; use a clean image with no baked-in letters for best results.

Each scene is 1 to 30 seconds. For a long episode, use more scenes and render in chapters. Audio longer than the scene is trimmed, and audio shorter than the scene is padded with silence. Scene images are static rather than fully AI-animated. This starter edition has straight cuts and simple captions; transitions, music mixing, lip-sync, and genuine motion generation can be added later.

The workflow uses GitHub-hosted Linux runners. GitHub Actions eligibility, available minutes, artifact storage and billing depend on your GitHub plan and repository settings. It uses no OpenAI API key and does not create paid AI images.

## Files

- `.github/workflows/render-episode.yml`: cloud build
- `render/render_episode.py`: FFmpeg/Pillow renderer
- `render/episode.json`: editable episode manifest
- `render/media/`: optional uploaded image/audio assets
