# Make a video from one idea

Open **Make a video from one idea** in Studio, tap **Run workflow**, enter one original idea and run it. The finished-video artifact contains the narrated MP4. This runs on a standard public GitHub Actions runner. Workflow input and artifacts in a public repository should be treated as public. In a chat-assisted run, the finished MP4 can instead be delivered to the project’s Google Drive folder.

The CPU pipeline writes four narration lines and four image prompts using [Qwen2.5-1.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF). [LCM DreamShaper v7](https://huggingface.co/SimianLuo/LCM_Dreamshaper_v7) generates four new stills with its upstream safety checker enabled. [Piper](https://github.com/OHF-Voice/piper1-gpl) reads the script using the [Lessac medium voice](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/medium/MODEL_CARD). The existing episode factory holds each image for its measured narration and assembles a 16:9 AVC/AAC MP4. Image generation uses a shared written design description, which does not guarantee recurring-character identity. No production episode, approved art, or Drive media is modified.

Local execution requires Python 3.12, FFmpeg, CPU PyTorch and the pinned dependencies in requirements.txt. The model installer verifies the pinned revisions and file hashes. First use downloads several gigabytes on the runner. Run from the repository root:

```sh
python factory/idea_film/make.py --output finished-film -- "Your original video premise"
```
