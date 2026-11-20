"""Play a generated MP4 to its end in an iPhone simulator's MobileSafari."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "motion/tests"))
from mobile_runner import simulator

PAGE = """<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<video muted autoplay playsinline controls></video>
<script>
const video = document.querySelector("video");
const report = result => fetch("/receipt", {method:"POST",body:JSON.stringify(result)});
video.addEventListener("error", () => report({error:video.error?.message || "Playback failed"}));
video.addEventListener("ended", () => report({
  width:video.videoWidth, height:video.videoHeight, duration:video.duration,
  endTime:video.currentTime, userAgent:navigator.userAgent
}));
(async () => {
  const response = await fetch("/sample.mp4");
  if (!response.ok) throw Error("Could not fetch the sample");
  video.src = URL.createObjectURL(await response.blob());
  await video.play();
})().catch(err => report({error:err.message}));
</script>"""


def verify(movie, receipt):
    done = threading.Event()
    result = {}

    class Handler(SimpleHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            if self.path != "/receipt" or not 0 < length < 8192:
                self.send_error(400)
                return
            result.update(json.loads(self.rfile.read(length)))
            self.send_response(204)
            self.end_headers()
            done.set()

    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp)
        shutil.copyfile(movie, path / "sample.mp4")
        (path / "index.html").write_text(PAGE)
        device = simulator()
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=temp))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            subprocess.run(["xcrun", "simctl", "openurl", device, f"http://127.0.0.1:{server.server_port}/"],
                           check=True, timeout=60)
            if not done.wait(receipt["duration"] + 90):
                raise TimeoutError("MobileSafari did not finish the sample")
        finally:
            server.shutdown()
            server.server_close()
    print(json.dumps(result, indent=2), flush=True)
    if "error" in result or [result.get("width"), result.get("height")] != receipt["dimensions"]:
        raise RuntimeError("iPhone playback or dimensions failed")
    if (abs(result["duration"] - receipt["duration"]) > 0.10
            or abs(result["endTime"] - result["duration"]) > 0.15):
        raise RuntimeError("iPhone playback ended at the wrong time")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("movie", type=Path)
    parser.add_argument("receipt", type=Path)
    args = parser.parse_args()
    verify(args.movie, json.loads(args.receipt.read_text()))
