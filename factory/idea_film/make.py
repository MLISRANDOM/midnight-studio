"""One original idea in, a narrated still-image MP4 out."""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave
from models import ART, ART_REV, TEXT, TEXT_REV, GGUF, art_file, install

FACTORY=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(FACTORY))
from episode_factory import video

VOICE="en/en_US/lessac/medium/en_US-lessac-medium.onnx"
VOICE_REV="42301ec547bc2939386cf0ae9f9050ca05b1d3af"
SHOT={"type":"object","properties":{k:{"type":"string"} for k in ("narration","picture")},"required":["narration","picture"],"additionalProperties":False}
SCHEMA={"type":"object","properties":{"title":{"type":"string"},"visual_design":{"type":"string"},
        "shots":{"type":"array","items":SHOT,"minItems":4,"maxItems":4}},"required":["title","visual_design","shots"],"additionalProperties":False}

def write_story(idea,model_path):
    from llama_cpp import Llama, LlamaGrammar
    instructions=("Return JSON with title, visual_design and exactly four shots with narration and picture. Write an original four-shot microfilm based on the user's idea. Invent one concrete discovery, a choice and its consequence. End on an image. "
        "Each narration is exactly one short, specific spoken sentence, under 22 words. Give each shot a different concrete picture description for an illustrator. "
        "Visual design names the recurring subject, colors and setting in one short phrase. No directions or shot numbers in narration.")
    with closing(Llama(model_path=str(model_path),n_ctx=3072,n_threads=4,verbose=False,chat_format="chatml")) as llm:
        for seed in (73,109,181):
            answer=llm.create_chat_completion(messages=[{"role":"system","content":instructions},
                {"role":"user","content":"A baker discovers a key inside her loaf."},
                {"role":"assistant","content":json.dumps({"title":"The Last Oven","visual_design":"Copper pans and a baker in a green apron",
                    "shots":[{"narration":"Ada cut the first loaf and heard her knife strike brass.","picture":"Close view of a brass key inside a sliced loaf on a floury board."},
                             {"narration":"The key fit the oven her father had kept locked for thirty years.","picture":"A green-aproned baker turns a key in a black iron oven."},
                             {"narration":"Inside lay a recipe folded around a single sunflower seed.","picture":"One sunflower seed on folded paper inside the open oven."},
                             {"narration":"By summer, strangers found the bakery by following the yellow flowers.","picture":"Wide view of tall sunflowers leading to a neighborhood bakery."}]})},
                {"role":"user","content":idea}],
                grammar=LlamaGrammar.from_json_schema(json.dumps(SCHEMA),verbose=False),temperature=.65,seed=seed,max_tokens=1000)
            try:
                plan=json.loads(answer["choices"][0]["message"]["content"])
                shots=plan["shots"]
                if (len(shots)==4 and len({s["narration"].strip().lower() for s in shots})==4 and len({s["picture"].strip().lower() for s in shots})==4 and
                    all(3<=len(s["narration"].split())<=40 and s["picture"].strip() for s in shots)):
                    return plan
            except (ValueError,KeyError,TypeError):
                pass
    raise RuntimeError("The language model did not produce a complete four-shot script.")

def make(idea,cache,destination):
    if not 1<=len(idea.strip())<=800:raise ValueError("Supply one idea of 1 to 800 characters.")
    if destination.exists():raise FileExistsError("Choose a new destination for this film.")
    cache.mkdir(parents=True,exist_ok=True)
    destination.parent.mkdir(parents=True,exist_ok=True)
    install(TEXT,TEXT_REV,lambda n:n==GGUF,cache)
    install("rhasspy/piper-voices",VOICE_REV,lambda n:n in (VOICE,VOICE+".json"),cache)
    install(ART,ART_REV,art_file,cache/"art-model")
    with tempfile.TemporaryDirectory(dir=destination.parent) as temp:
        work=Path(temp)/"film";work.mkdir()
        plan=write_story(idea,cache/GGUF)
        (work/"storyboard.json").write_text(json.dumps(plan,indent=2))
        print("Story written:",plan["title"],flush=True)
        subprocess.run([os.getenv("FILM_ART_PYTHON",sys.executable),str(Path(__file__).with_name("art.py")),str(cache/"art-model"),str(work)],check=True)
        from piper import PiperVoice
        voice=PiperVoice.load(str(cache/VOICE))
        audio=[];images=[]
        for i,shot in enumerate(plan["shots"],1):
            wav=work/f"line-{i}.wav"
            with wave.open(str(wav),"wb") as target:voice.synthesize_wav(shot["narration"],target)
            audio.append(wav);images.append({"image":str(work/f"shot-{i}.png")})
        shots=[{"seconds":2,"narration":s["narration"]} for s in plan["shots"]]
        mp4=video(shots,images,work,960,540,narration_files=audio)
        info=json.loads(subprocess.check_output(["ffprobe","-v","error","-count_frames","-show_streams","-show_format","-of","json",str(mp4)]))
        streams={s["codec_type"]:s for s in info["streams"]}
        if streams["video"]["codec_name"]!="h264" or streams["audio"]["codec_name"]!="aac":raise ValueError("Audio/video verification failed")
        lengths=[]
        for f in audio:
            with wave.open(str(f)) as w:lengths.append(w.getnframes()/w.getframerate())
        if float(info["format"]["duration"])<sum(lengths):raise ValueError("Narration was truncated")
        receipt={"idea":idea,"title":plan["title"],"duration":float(info["format"]["duration"]),"frames":int(streams["video"]["nb_read_frames"]),
                 "dimensions":[960,540],"images":len(images),"voice_seconds":lengths,"image_model":ART,"writer_model":TEXT,"voice":"Piper lessac medium",
                 "sha256":hashlib.sha256(mp4.read_bytes()).hexdigest()}
        (work/"receipt.json").write_text(json.dumps(receipt,indent=2))
        shutil.rmtree(work/"clips")
        for f in audio:f.unlink()
        os.replace(work,destination)
        return receipt

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("idea");p.add_argument("--cache",type=Path,default=Path.home()/".cache/midnight-film");p.add_argument("--output",type=Path,default=Path("finished-film"))
    a=p.parse_args();print(json.dumps(make(a.idea,a.cache.resolve(),a.output.resolve()),indent=2))
