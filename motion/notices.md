# Open-source credits

| Component | Use in this checkpoint | Terms and source |
| --- | --- | --- |
| Practical-RIFE 4.9 and the Edge Tools ONNX export | Nine learned frames between two original poses. The browser verifies the weight checksum. | [Practical-RIFE](https://github.com/hzwer/Practical-RIFE), [pinned model and provenance](https://huggingface.co/edgetools/rife/tree/321b593c5f36c26f5b08fa2838dcf5eece382fa0), [upstream MIT notice](vendor/Practical-RIFE.LICENSE), [export notice](vendor/rife-onnx.LICENSE) |
| ONNX Runtime Web 1.22.0 | Single-threaded WASM inference in a dedicated worker. Model inputs stay on the device. | [Microsoft source](https://github.com/microsoft/onnxruntime/tree/v1.22.0), [MIT notice](vendor/onnxruntime.LICENSE) |
| mp4-muxer 5.2.2 | Unmodified ESM build multiplexes AVC frames encoded by WebCodecs. | [upstream](https://github.com/Vanilagy/mp4-muxer), [MIT notice](vendor/mp4-muxer.LICENSE) |
| yt-dlp 2026.10.26 | Optional public, authorized YouTube source acquisition. The job verifies the decoded stream and expected duration. | [upstream license and dependency notes](https://github.com/yt-dlp/yt-dlp#license), [pinned wheel](youtube-requirements.txt) |
| FFmpeg and ffprobe | Existing CLI analyzer, full-stream cut detection, sampled color and movement, and independent decoding checks. Invoked as system tools. | [FFmpeg legal and licensing](https://ffmpeg.org/legal.html) |

The built-in reference measurements come from the **Sintel trailer**, © Blender Foundation / Durian Open Movie Team, released under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Only numeric measurements ship with the example. [Creator project](https://durian.blender.org/download/) · [YouTube trailer](https://www.youtube.com/watch?v=HOfdboHvshg) · [master MP4](https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4).

The second measured example is **Big Buck Bunny** (2008), © Blender Foundation / www.bigbuckbunny.org, CC BY 3.0. The full 320 × 180 creator master was decoded into editing statistics. [Creator license](https://peach.blender.org/about/) · [official upload](https://www.youtube.com/watch?v=YE7VzlLtp-4) · [original film downloads](https://download.blender.org/peach/bigbuckbunny_movies/).

The Survivor rig imports the existing approved project artwork from the owner's file. The public repository contains joint geometry and a separately authored demo robot. The licenses above cover their respective upstream components.
