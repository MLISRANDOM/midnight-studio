# Make a video from one idea

Send a sentence to the studio assistant from your iPhone to get a narrated four-shot film in the project’s Google Drive. The assistant can run the generator, review the output and file the MP4. To launch it yourself, open **Make a video from one idea** in Studio, tap **Run workflow** and enter the sentence. The **finished-video** download contains the MP4. Standalone GitHub runs use a public standard CPU runner and deliver through GitHub. Treat ideas entered there as public.

The writer turns the idea into four spoken lines and describes a still image for each. The illustrator generates alternatives. A separate model scores them against the specific shot, the setting and the original idea. The editor holds each selected image for the length of its voice recording and cuts straight to the next. The export uses H.264 video, AAC audio and an MP4 header at the front for streaming.

Mention TikTok or YouTube Shorts for portrait. Ordinary ideas default to widescreen. Naming The Safe Room Rules, The Reality Helpdesk, Spawned Somewhere Bad or OCCUPANCY applies the show’s written character and style defaults. An explicit format in the idea overrides the show default. See the existing [Safe Room character description](../../assets/episode-maker.js), [Spawned Somewhere Bad handoff](../../spawned-somewhere-bad/episode01/START_HERE.md) and [OCCUPANCY cast](../../occupancy/README.md). Drafts are separate from the series ledgers. Text descriptions and image-text scores cannot verify a face against approved reference art.

## Software and models

- [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) writes the script using the [pinned GGUF distribution](https://huggingface.co/bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF) and llama.cpp.
- [LCM DreamShaper v7](https://huggingface.co/SimianLuo/LCM_Dreamshaper_v7) draws with Diffusers and its upstream safety checker.
- [Quantized CLIP](https://huggingface.co/Xenova/clip-vit-base-patch32) compares generated pictures to their descriptions using ONNX Runtime.
- [Piper](https://github.com/OHF-Voice/piper1-gpl) reads the lines with the [Lessac medium voice](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/medium/MODEL_CARD). FFmpeg assembles the film using the existing episode factory.

## Local verification

Use Python 3.12, FFmpeg, CPU PyTorch and the dependencies in requirements.txt. The first run downloads several gigabytes on the rendering machine. The installer checks model revisions and file hashes. To test timing and render a new film, run these commands from the repository root.

```sh
python factory/idea_film/selftest.py
python factory/idea_film/make.py --output finished-film -- "Your original video premise"
```

The output directory includes the finished MP4, four selected stills, storyboard, selection scores and a receipt with durations and a checksum. The full pipeline also runs on a sample idea in pull requests. GitHub publishes verification files separately from the playable film.
