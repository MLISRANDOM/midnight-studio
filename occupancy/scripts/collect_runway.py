#!/usr/bin/env python3
"""Collect already-generated Runway images using a private secret on a network-enabled runner."""
import io, os, json, pathlib, urllib.request, urllib.parse, time
from PIL import Image
raw=os.environ.get("RUNWAY_ASSETS_JSON")
if not raw: raise SystemExit("Missing RUNWAY_ASSETS_JSON secret; no downloads attempted")
obj=json.loads(raw)
assets=obj["assets"] if isinstance(obj,dict) else obj
out=pathlib.Path("occupancy/collected")
out.mkdir(parents=True,exist_ok=True)
seen=set()
for asset in assets:
    num=int(asset["shot"])
    if num<1 or num>80 or num in seen: raise SystemExit("Invalid or duplicate shot")
    seen.add(num)
    url=asset["url"]
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!="https" or parsed.hostname!="dnznrvs05pmza.cloudfront.net": raise SystemExit("Untrusted image URL")
    for attempt in range(3):
        try:
            request=urllib.request.Request(url,headers={"User-Agent":"MidnightStudio-Collector/1.0"})
            with urllib.request.urlopen(request,timeout=45) as response: data=response.read(25*1024*1024+1)
            if len(data)>25*1024*1024: raise ValueError("Image exceeds 25MB")
            with Image.open(io.BytesIO(data)) as img:
                img.load()
                w,h=img.size
                if w<h or abs(w/h-16/9)>.16: raise ValueError("Not landscape 16:9")
                img.convert("RGB").save(out/f"{num:03d}.png",optimize=True)
            print(f"Collected shot {num:03d}")
            break
        except Exception as e:
            if attempt==2: raise RuntimeError(f"Image {num:03d} failed: {e}") from e
            time.sleep(2**attempt)
print(f"Collected {len(seen)} shots; URLs were never logged")
