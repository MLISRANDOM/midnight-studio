"""Install pinned open-weight models in a local cache, checking upstream object hashes."""
import hashlib
import json
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

ART = "SimianLuo/LCM_Dreamshaper_v7"
ART_REV = "a85df6a8bd976cdd08b4fd8f3b73f229c9e54df5"
TEXT = "bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF"
TEXT_REV = "ae44f08e1392f39c0e474af10c3ff8355c8b6688"
GGUF = "Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf"

RANKER = "Xenova/clip-vit-base-patch32"
RANKER_REV = "6b7c523703ae26e39be4b03774966f8571c7f523"
RANKER_FILES = {
    "onnx/model_quantized.onnx", "config.json", "preprocessor_config.json", "merges.txt",
    "special_tokens_map.json", "tokenizer.json", "tokenizer_config.json", "vocab.json",
}


def install(repo, revision, wanted, folder):
    meta = json.load(urlopen(f"https://huggingface.co/api/models/{repo}/revision/{revision}?blobs=true",timeout=45))
    if meta["sha"] != revision:
        raise ValueError("Unexpected model revision")
    items = [s for s in meta["siblings"] if wanted(s["rfilename"])]
    if not items:
        raise ValueError("No matching model files")
    def fetch(item):
        name = item["rfilename"]
        dest = folder / name
        dest.parent.mkdir(parents=True,exist_ok=True)
        size = item["size"]
        large = item.get("lfs",{})
        def checksum(path):
            h = hashlib.sha256() if large else hashlib.sha1()
            if not large:
                h.update(f"blob {size}\0".encode())
            with path.open("rb") as f:
                while chunk := f.read(1024*1024):
                    h.update(chunk)
            return h.hexdigest()
        expected = large.get("sha256") or item["blobId"]
        if dest.is_file() and dest.stat().st_size==size and checksum(dest)==expected:
            return
        for attempt in range(3):
            with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False) as tmp:
                temp=Path(tmp.name)
            try:
                with urlopen(f"https://huggingface.co/{repo}/resolve/{revision}/{name}?download=true&attempt={attempt}",timeout=180) as src,temp.open("wb") as out:
                    while chunk:=src.read(1024*1024):
                        out.write(chunk)
                if temp.stat().st_size!=size or checksum(temp)!=expected:
                    raise ValueError("Incomplete download of "+name)
                os.replace(temp,dest)
                print("Installed",name,size,flush=True)
                return
            except (OSError, ValueError):
                if attempt==2: raise
            finally:
                temp.unlink(missing_ok=True)
    with ThreadPoolExecutor(3) as pool:
        list(pool.map(fetch,items))

def art_file(name):
    return (name=="model_index.json" or "/" in name and name.split("/")[0] in
            {"unet","vae","scheduler","tokenizer","text_encoder","feature_extractor","safety_checker"} and
            name.endswith((".safetensors",".json","merges.txt")))

if __name__=="__main__":
    import sys
    install(ART,ART_REV,art_file,Path(sys.argv[1])/"art-model")
