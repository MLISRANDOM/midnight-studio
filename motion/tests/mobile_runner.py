"""Exercise the app inside MobileSafari on an iPhone simulator or in a local browser."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import subprocess
import threading
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parents[2]
RESULTS = {"portrait.mp4", "neural.mp4", "scene.mp4", "result.json"}

def simulator():
    data = json.loads(subprocess.check_output(["xcrun","simctl","list","devices","available","-j"]))
    choices = []
    for runtime, devices in data["devices"].items():
        match = re.search(r"\.iOS-([0-9-]+)$",runtime)
        if match:
            version = tuple(int(n) for n in match[1].split("-"))
            choices.extend((version,device["name"],device["udid"],device["state"]) for device in devices
                           if device["isAvailable"] and device["name"].startswith("iPhone"))
    if not choices:
        raise RuntimeError("Runner has no installed iPhone simulator")
    version,name,udid,state = max(choices)
    print("Testing MobileSafari on",name,"iOS",".".join(map(str,version)),flush=True)
    if state != "Booted":
        subprocess.run(["xcrun","simctl","boot",udid],check=True,timeout=120)
    subprocess.run(["xcrun","simctl","bootstatus",udid,"-b"],check=True,timeout=360)
    return udid

def serve(out, runtime, done):
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self,fmt,*args):
            if self.command=="POST":
                print(fmt % args,flush=True)
        def translate_path(self,path):
            requested=urlsplit(path).path
            prefix="/motion/vendor/runtime/"
            if requested.startswith(prefix) and Path(requested).name==requested[len(prefix):]:
                return str(runtime/Path(requested).name)
            return super().translate_path(path)
        def do_POST(self):
            filename=self.path.removeprefix("/__motion_test/")
            length=int(self.headers.get("Content-Length",0))
            if filename not in RESULTS or not 0 < length <= 12*1024*1024:
                self.send_error(400);return
            (out/filename).write_bytes(self.rfile.read(length))
            self.send_response(204);self.end_headers()
            if filename=="result.json":
                done.set()
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Handler,directory=str(REPO)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    return server

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine",choices=["ios","chromium","webkit"],required=True)
    parser.add_argument("--out",type=Path,required=True)
    parser.add_argument("--runtime",type=Path,required=True)
    parser.add_argument("--public-model",action="store_true",help="Fetch the same pinned runtime and weights as the public page")
    parser.add_argument("--executable")
    args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    done=threading.Event()
    server=serve(args.out,args.runtime,done)
    url=f"http://127.0.0.1:{server.server_port}/motion/tests/mobile.html?collect=1"
    if not args.public_model:
        url+="&runtime=local"
    udid=None
    try:
        if args.engine=="ios":
            udid=simulator()
            # SpringBoard can report booted while Safari is still cold. Wait for
            # the page receipt even if simctl times out after delivering the URL.
            for attempt in range(2):
                try:
                    subprocess.run(["xcrun","simctl","openurl",udid,url],check=True,timeout=150)
                    break
                except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
                    if done.wait(25):
                        break
                    if attempt:
                        raise
            if not done.wait(350):
                raise TimeoutError("MobileSafari did not return a test receipt")
        else:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as api:
                options={}
                if args.executable: options["executable_path"]=args.executable
                if args.engine=="chromium" and os.environ.get("MIDNIGHT_SINGLE_PROCESS"):
                    options["args"]=["--no-sandbox","--no-zygote","--single-process","--disable-dev-shm-usage"]
                browser=getattr(api,args.engine).launch(**options)
                page=browser.new_page(viewport={"width":414,"height":896},has_touch=True,is_mobile=True)
                page.on("console",lambda msg: print("browser:",msg.text[:400],flush=True))
                page.on("pageerror",lambda err: print("browser error:",str(err)[:400],flush=True))
                page.goto(url);page.wait_for_function("document.querySelector('#log').textContent.match(/^(Passed|Failed)/)",timeout=340000)
                browser.close()
        result=json.loads((args.out/"result.json").read_text())
        print(json.dumps(result,indent=2))
        if not result.get("ok"): raise RuntimeError(result.get("error","Browser test failed"))
        if args.engine=="ios" and not all(x in result["userAgent"] for x in ("iPhone","Mobile","Safari")):
            raise RuntimeError("Test receipt is not from iPhone MobileSafari")
    finally:
        if udid: subprocess.run(["xcrun","simctl","shutdown",udid],timeout=75,check=False)
        server.shutdown();server.server_close()

if __name__=="__main__":
    main()
