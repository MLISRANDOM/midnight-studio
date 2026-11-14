#!/usr/bin/env python3
"""Assemble generated Runway scene images into a 1080p 16:9 MP4 with subtle pushes."""
import argparse,shutil,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument("--images",default="occupancy/collected")
p.add_argument("--output",default="occupancy/rendered/OCCUPANCY_S01E01.mp4")
p.add_argument("--audio",default=None)
p.add_argument("--seconds",type=float,default=7.5)
p.add_argument("--strict",action="store_true")
a=p.parse_args()
images=sorted(Path(a.images).glob("[0-9][0-9][0-9].png"))
if a.strict and [x.name for x in images]!=[f"{i:03d}.png" for i in range(1,81)]:
    raise SystemExit("Missing storyboard shots, refusing to create incomplete episode")
if not images: raise SystemExit("No numbered image files")
if not shutil.which("ffmpeg"): raise SystemExit("ffmpeg required")
def run(cmd):subprocess.run(cmd,check=True)
out=Path(a.output).resolve()
out.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    clips=[]
    for ix,img in enumerate(images,1):
        clip=Path(tmp)/f"shot_{ix:03d}.mp4"
        vf="scale=2048:1152:force_original_aspect_ratio=increase,crop=2048:1152,zoompan=z='min(zoom+0.00012,1.065)':d=1:s=1920x1080:fps=24,format=yuv420p"
        run(["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate","24","-i",str(img),"-t",str(a.seconds),"-vf",vf,"-c:v","libx264","-preset","veryfast","-crf","24","-r","24","-pix_fmt","yuv420p",str(clip)])
        clips.append(clip)
        print(f"Assembled {img.name}",flush=True)
    listing=Path(tmp)/"clips.txt"
    listing.write_text("".join("file '"+str(c)+"'\n" for c in clips))
    joined=Path(tmp)/"joined.mp4"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(listing),"-c","copy",str(joined)])
    if a.audio:
        run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(joined),"-i",str(a.audio),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-shortest","-movflags","+faststart",str(out)])
    else:shutil.copyfile(joined,out)
print(f"Created {out} from {len(images)} frames")
