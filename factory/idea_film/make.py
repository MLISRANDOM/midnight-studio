"""One original idea in, a narrated still-image MP4 out."""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import wave

from series import SERIES, identify
from models import ART, ART_REV, GGUF, RANKER, RANKER_FILES, RANKER_REV, TEXT, TEXT_REV, art_file, install

FACTORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(FACTORY))
from episode_factory import video

VOICE = "en/en_US/lessac/medium/en_US-lessac-medium.onnx"
VOICE_REV = "42301ec547bc2939386cf0ae9f9050ca05b1d3af"
SHOT = {
    "type": "object",
    "properties": {key: {"type": "string"} for key in ("narration", "picture")},
    "required": ["narration", "picture"], "additionalProperties": False,
}
SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"}, "setting": {"type": "string"}, "visual_design": {"type": "string"},
        "shots": {"type": "array", "items": SHOT, "minItems": 4, "maxItems": 4},
    },
    "required": ["title", "setting", "visual_design", "shots"], "additionalProperties": False,
}
EXAMPLE = {
    "title": "The Last Oven", "setting": "Floury wooden counters, brick ovens, copper pans.",
    "visual_design": "A baker in a green apron, warm honey-colored light.",
    "shots": [
        {"narration": "Ada cut the first loaf and heard her knife strike brass.",
         "picture": "Close view of a brass key inside a sliced loaf on a floury board."},
        {"narration": "The key fit the oven her father had kept locked for thirty years.",
         "picture": "A green-aproned baker turns a key in a black iron oven."},
        {"narration": "Inside lay a recipe folded around a single sunflower seed.",
         "picture": "One sunflower seed on folded paper inside the open oven."},
        {"narration": "By summer, strangers found the bakery by following the yellow flowers.",
         "picture": "Wide view of tall sunflowers leading to a neighborhood bakery."},
    ],
}


def write_story(idea, model_path, series=None):
    from llama_cpp import Llama, LlamaGrammar

    instructions = (
        "Write an original four-shot microfilm from the user's idea. Keep its defining action and unusual "
        "setting visible and explicit in the opening line. Give the character a concrete choice, then show "
        "the consequence of that action. Make each picture literally show the same action, objects and materials "
        "as its spoken line. Keep those details consistent across all four shots. End on a visible detail. "
        "Return JSON. In setting, describe the actual surroundings "
        "briefly using literal visual details like terrain, materials and colors. In visual_design, describe "
        "the recurring character and art style in one short phrase. Each shot has one specific spoken sentence "
        "under 22 words and a picture description a still illustrator could draw. Vary framing and subjects. "
        "Each picture is one concise sentence with its subject first. Represent sounds with visible reactions. "
        "Keep the frame free of written words, numbers, overlays and speech bubbles. The narration is spoken."
    )
    if series:
        cast = " ".join(f"{name}: {look}" for name, look in series["cast"].items())
        instructions += (
            f" Follow these series details. {series['canon']} Art style: {series['style']} Cast: {cast} "
            "In each picture, name any visible cast member. Use object inserts when the story calls for them."
        )
    messages = [
        {"role": "system", "content": instructions},
        {"role": "user", "content": "A baker discovers a key inside her loaf."},
        {"role": "assistant", "content": json.dumps(EXAMPLE)},
        {"role": "user", "content": idea},
    ]
    with closing(Llama(model_path=str(model_path), n_ctx=3072, n_threads=4, verbose=False, chat_format="chatml")) as llm:
        grammar = LlamaGrammar.from_json_schema(json.dumps(SCHEMA), verbose=False)
        for seed in (73, 109, 181):
            answer = llm.create_chat_completion(
                messages=messages, grammar=grammar, temperature=0.65, seed=seed, max_tokens=1000
            )
            try:
                raw = answer["choices"][0]["message"]["content"]
                plan = json.loads(raw)
                for shot in plan["shots"]:
                    shot["narration"] = re.sub(r"\s*[\u2014;]\s*", ", ", shot["narration"])
                shots = plan["shots"]
                unique = all(len({s[key].strip().casefold() for s in shots}) == 4 for key in ("narration", "picture"))
                if (len(shots) == 4 and unique and plan["setting"].strip() and plan["visual_design"].strip()
                        and all(3 <= len(s["narration"].split()) <= 40 and s["picture"].strip() for s in shots)):
                    return plan
            except (ValueError, KeyError, TypeError, AttributeError):
                continue
    raise RuntimeError("The language model did not produce a complete four-shot script.")


def sizes(idea, series=None):
    aspect = re.search(r"\b(9\s*:\s*16|16\s*:\s*9|vertical(?: video)?|landscape video|widescreen|tiktok|youtube shorts?|instagram reel)\b", idea, re.I)
    portrait = bool(series and series["vertical"]) if aspect is None else not re.fullmatch(r"16\s*:\s*9|landscape video|widescreen", aspect[0], re.I)
    return ((320, 576), (540, 960)) if portrait else ((576, 320), (960, 540))


def make(idea, cache, destination):
    idea = idea.strip()
    if not 1 <= len(idea) <= 800:
        raise ValueError("Supply one idea of 1 to 800 characters.")
    if destination.exists():
        raise FileExistsError("Choose a new destination for this film.")
    cache.mkdir(parents=True, exist_ok=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    install(TEXT, TEXT_REV, lambda name: name == GGUF, cache)
    install("rhasspy/piper-voices", VOICE_REV, lambda name: name in (VOICE, VOICE + ".json"), cache)
    install(ART, ART_REV, art_file, cache / "art-model")
    install(RANKER, RANKER_REV, RANKER_FILES.__contains__, cache / "ranker")
    with tempfile.TemporaryDirectory(dir=destination.parent) as temp:
        work = Path(temp) / "film"
        work.mkdir()
        series_name = identify(idea)
        series = SERIES.get(series_name)
        plan = write_story(idea, cache / GGUF, series)
        image_size, video_size = sizes(idea, series)
        plan.update(idea=idea, image_size=image_size, series=series_name)
        (work / "storyboard.json").write_text(json.dumps(plan, indent=2))
        print("Story written:", plan["title"], flush=True)
        subprocess.run([
            os.getenv("FILM_ART_PYTHON", sys.executable), str(Path(__file__).with_name("art.py")),
            str(cache), str(work),
        ], check=True)
        from piper import PiperVoice

        voice = PiperVoice.load(str(cache / VOICE))
        audio, images, lengths = [], [], []
        for index, shot in enumerate(plan["shots"], 1):
            wav = work / f"line-{index}.wav"
            with wave.open(str(wav), "wb") as target:
                voice.synthesize_wav(shot["narration"], target)
            with wave.open(str(wav)) as recording:
                lengths.append(recording.getnframes() / recording.getframerate())
            audio.append(wav)
            images.append({"image": str(work / f"shot-{index}.png")})
        shots = [{"seconds": 2, "narration": shot["narration"]} for shot in plan["shots"]]
        mp4 = video(shots, images, work, *video_size, narration_files=audio)
        info = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(mp4)
        ]))
        streams = {stream["codec_type"]: stream for stream in info["streams"]}
        stream = streams["video"]
        duration = float(info["format"]["duration"])
        frames = int(stream["nb_read_frames"])
        if stream["codec_name"] != "h264" or streams["audio"]["codec_name"] != "aac":
            raise ValueError("Audio/video verification failed")
        if (stream["width"], stream["height"]) != video_size or frames <= 0:
            raise ValueError("Invalid video frames")
        if any(length <= 0 for length in lengths) or duration < sum(lengths):
            raise ValueError("Missing or truncated narration")
        receipt = {
            "idea": idea, "title": plan["title"], "series": series_name, "duration": duration, "frames": frames,
            "dimensions": video_size, "images": len(images), "voice_seconds": lengths,
            "image_model": ART, "selection_model": RANKER, "writer_model": TEXT, "voice": "Piper lessac medium",
            "sha256": hashlib.sha256(mp4.read_bytes()).hexdigest(),
        }
        (work / "receipt.json").write_text(json.dumps(receipt, indent=2))
        shutil.rmtree(work / "clips")
        for wav in audio:
            wav.unlink()
        os.replace(work, destination)
        return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("idea")
    parser.add_argument("--cache", type=Path, default=Path.home() / ".cache/midnight-film")
    parser.add_argument("--output", type=Path, default=Path("finished-film"))
    args = parser.parse_args()
    print(json.dumps(make(args.idea, args.cache.resolve(), args.output.resolve()), indent=2))
