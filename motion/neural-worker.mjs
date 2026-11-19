/* A dedicated worker bounds inference to one frame at a time. Termination frees the WASM heap. */
const runtimeBase = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
const weightsUrl = "https://huggingface.co/edgetools/rife/resolve/321b593c5f36c26f5b08fa2838dcf5eece382fa0/rife49.onnx";
const weightsSha = "76e4cef9ab42fa7dd4e8f6e4aba47462051e3faa969e4bca6479784fbab0ac6f";

async function loadWeights() {
  let cache;
  try { cache = await caches.open("midnight-rife-4.9-v1"); } catch { /* Private browsing can disable caches. */ }
  let cached = await cache?.match(weightsUrl);
  for (let attempt=0; attempt<2; attempt++) {
    const response = cached || await fetch(weightsUrl, {credentials:"omit"});
    if (!response.ok) throw Error("The RIFE model download failed (HTTP " + response.status + ").");
    const data = await response.arrayBuffer();
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256",data));
    if (Array.from(hash,x=>x.toString(16).padStart(2,"0")).join("")===weightsSha) {
      if (!cached && cache) { try { await cache.put(weightsUrl,new Response(data)); } catch { /* Storage quota is optional. */ } }
      return data;
    }
    if (!cached) break;
    await cache.delete(weightsUrl); cached = null;
  }
  throw Error("Downloaded RIFE weights failed the checksum. Retry the model download.");
}

function tensorData(rgba,w,h,pw,ph) {
  const plane=pw*ph;
  const out=new Float32Array(plane*3);
  for(let y=0;y<ph;y++) for(let x=0;x<pw;x++) {
    const i=(Math.min(h-1,y)*w+Math.min(w-1,x))*4, j=y*pw+x;
    out[j]=rgba[i]/255;out[plane+j]=rgba[i+1]/255;out[plane*2+j]=rgba[i+2]/255;
  }
  return out;
}
function pixels(data,w,h,pw,ph) {
  const rgba=new Uint8ClampedArray(w*h*4),plane=pw*ph;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const j=y*pw+x,i=(y*w+x)*4;
    rgba[i]=data[j]*255;rgba[i+1]=data[plane+j]*255;rgba[i+2]=data[2*plane+j]*255;rgba[i+3]=255;
  }
  return rgba;
}

self.onmessage=async ({data})=>{
  const {w,h,a,b,count}=data;
  let session,left,right;
  try {
    self.postMessage({status:"Loading the local inference engine and model…"});
    const ort=await import(runtimeBase+"ort.wasm.min.mjs");
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=runtimeBase;
    const weights=await loadWeights();
    session=await ort.InferenceSession.create(weights,{executionProviders:["wasm"],graphOptimizationLevel:"all"});
    const pw=Math.ceil(w/32)*32,ph=Math.ceil(h/32)*32;
    left=new ort.Tensor("float32",tensorData(a,w,h,pw,ph),[1,3,ph,pw]);
    right=new ort.Tensor("float32",tensorData(b,w,h,pw,ph),[1,3,ph,pw]);
    const start=performance.now();
    for(let i=1;i<=count;i++){
      const time=new ort.Tensor("float32",Float32Array.of(i/(count+1)),[1]);
      let output;
      try {
        ({output}=await session.run({img0:left,img1:right,timestep:time}));
        const frame=pixels(output.data,w,h,pw,ph);
        self.postMessage({i,count,frame},[frame.buffer]);
      } finally { output?.dispose();time.dispose(); }
    }
    self.postMessage({done:true,model:"RIFE 4.9",sha256:weightsSha,inference_ms:Math.round(performance.now()-start)});
  } catch(e) {
    self.postMessage({error:"Neural rendering failed. "+(e?.message||String(e))});
  } finally {
    right?.dispose();left?.dispose();if(session) await session.release();
  }
};
