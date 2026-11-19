"""Prepare verified same-origin neural assets for a static build or an offline test."""
import argparse
import hashlib
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/"
MODEL = "https://huggingface.co/edgetools/rife/resolve/321b593c5f36c26f5b08fa2838dcf5eece382fa0/"
ASSETS = {
    "ort.wasm.min.mjs": (CDN, "6ef726f355b791129f7ddf3f62e7877a16b9b777abe87004b8ab306e6b9cf265"),
    "ort-wasm-simd-threaded.mjs": (CDN, "30dd851d9c00622940500f71ddd2ff8820c5cb65270816080175b958705385a8"),
    "ort-wasm-simd-threaded.wasm": (CDN, "71aef04959c5c1b6de461b6538e2058e306610034a85aad2742d0c7fd4533fe4"),
    "rife49.onnx": (MODEL, "76e4cef9ab42fa7dd4e8f6e4aba47462051e3faa969e4bca6479784fbab0ac6f"),
}

def prepare(path):
    path.mkdir(parents=True,exist_ok=True)
    def fetch(entry):
        name,(base,expected)=entry
        dest=path/name
        if dest.is_file() and hashlib.sha256(dest.read_bytes()).hexdigest()==expected:
            return name
        with urlopen(base+name,timeout=90) as response:
            data=response.read()
        if hashlib.sha256(data).hexdigest()!=expected:
            raise ValueError(f"Checksum failed for {name}")
        with tempfile.NamedTemporaryFile(dir=path,delete=False) as out:
            out.write(data)
        os.replace(out.name,dest)
        return name
    with ThreadPoolExecutor(4) as pool:
        for name in pool.map(fetch,ASSETS.items()):
            print("Verified",name)

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory",type=Path)
    prepare(parser.parse_args().directory)
