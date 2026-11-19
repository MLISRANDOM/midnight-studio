from pathlib import Path
import base64, os, time
from playwright.sync_api import sync_playwright
# Reproduction harness used for the private Survivor proof. See CHECKPOINT.md.
root=Path(os.environ["MIDNIGHT_QA_DIR"]).resolve()
repo=Path(__file__).resolve().parents[2]
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
class Silent(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Silent,directory=str(repo)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as api:
    browser=api.chromium.launch(executable_path=os.environ.get('MIDNIGHT_CHROMIUM_BIN') or None,args=['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':414,'height':896},is_mobile=True,has_touch=True)
    page=context.new_page()
    page.on('pageerror',lambda err: print('ERROR',err,flush=True))
    page.on('console',lambda msg: print('CONSOLE',msg.text[:350],flush=True) if msg.type in ['error','warning'] else None)
    page.on('requestfailed',lambda req: print('FETCHFAIL',req.url.split('?')[0], req.failure,flush=True))
    def local_dep(route):
        name=route.request.url.split('?')[0].rsplit('/',1)[-1]
        if (root/'deps'/name).is_file():
            headers={'access-control-allow-origin':'*','content-type':'text/javascript' if name.endswith('mjs') else 'application/wasm' if name.endswith('wasm') else 'application/octet-stream'}
            route.fulfill(path=str(root/'deps'/name),headers=headers)
        else: route.continue_()
    context.route('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/**',local_dep)
    context.route('https://huggingface.co/edgetools/rife/resolve/**',local_dep)
    page.goto(f'http://127.0.0.1:{server.server_port}/motion/');page.wait_for_function("document.querySelector('#estimate').textContent.length > 0")
    print('READY',page.title(),page.evaluate("typeof VideoEncoder"),flush=True)
    ses=page.locator('#referenceFile')
    ses.set_input_files(str(root/'sintel-trailer.mp4'))
    page.locator('#measure').click();page.wait_for_function("!document.querySelector('#refResult').hidden || document.querySelector('#cancel').hidden",timeout=90000)
    print('REFERENCE',page.locator('#refStatus').inner_text(),page.locator('#stats').inner_text(),flush=True)
    def readlink(el,path):
        data=page.eval_on_selector(el,"async e=>{const blob=await(await fetch(e.href)).blob();return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});}")
        path.write_bytes(base64.b64decode(data))
    readlink('#saveReport',root/'sintel-technique.json')
    page.select_option('#art','survivor');page.locator('#sheet').set_input_files(str(root/'hero-sheet.jpg'));page.wait_for_function("!document.querySelector('#render').disabled", timeout=20000)
    print('SHEET',page.locator('#sheetStatus').inner_text(),flush=True)
    page.locator('#scrub').evaluate("(e)=>{e.value=470;e.dispatchEvent(new Event('input'));}")
    page.locator('#stage').screenshot(path=str(root/'rig.png'))
    for name,selector in [('survivor-articulated','#render'),('survivor-neural','#neural')]:
        start=time.monotonic();page.locator(selector).click();page.wait_for_function("document.querySelector('#cancel').hidden",timeout=260000)
        print('RENDER',name,time.monotonic()-start,page.locator('#status').inner_text(),flush=True)
        if page.locator('#result').is_visible():
            readlink('#download',root/(name+'.mp4'));readlink('#saveReceipt',root/(name+'.json'))
    browser.close()
