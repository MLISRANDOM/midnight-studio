import {Muxer, ArrayBufferTarget} from "./vendor/mp4-muxer.mjs";

export function canvasOf(w,h) {
  const c=document.createElement("canvas");c.width=w;c.height=h;return c;
}
export function fitImage(canvas,image) {
  const ctx=canvas.getContext("2d");
  const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
  const scale=Math.min(canvas.width/w,canvas.height/h);
  ctx.fillStyle="#11191c";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,(canvas.width-w*scale)/2,(canvas.height-h*scale)/2,w*scale,h*scale);
}
export async function readImage(blob) {
  const url=URL.createObjectURL(blob),img=new Image();img.src=url;
  try { await img.decode();return img; } finally { URL.revokeObjectURL(url); }
}
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));

async function codecConfig(canvas,fps) {
  if(!globalThis.VideoEncoder||!globalThis.VideoFrame)return null;
  const base={codec:"avc1.42001f",width:canvas.width,height:canvas.height,framerate:fps,
    bitrate:Math.max(400000,canvas.width*canvas.height*5),latencyMode:"realtime",avc:{format:"avc"}};
  try {return (await VideoEncoder.isConfigSupported(base)).supported?base:null;} catch{return null;}
}
async function recordInRealTime(canvas,fps,frames,paint,progress,signal) {
  const mime=["video/mp4;codecs=avc1.42E01E","video/mp4"].find(v=>globalThis.MediaRecorder?.isTypeSupported(v));
  if(!mime||!canvas.captureStream)throw Error("This browser has no MP4 encoder. Open this page in a current Safari or Chrome browser.");
  const stream=canvas.captureStream(fps),chunks=[];
  let timer,recorder;
  try {
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.max(450000,canvas.width*canvas.height*5)});
    return await new Promise((resolve,reject)=>{
      let failure;
      function stop(error) {
        clearTimeout(timer);failure=error;
        if(recorder.state!=="inactive")recorder.stop();
      }
      const cancel=()=>stop(new DOMException("Canceled","AbortError"));
      const hidden=()=>{if(document.hidden)stop(Error("Recording was interrupted when the tab went into the background. Try again with this tab visible."));};
      const cleanup=()=>{signal?.removeEventListener("abort",cancel);document.removeEventListener("visibilitychange",hidden);};
      recorder.onerror=e=>{cleanup();clearTimeout(timer);reject(e.error||Error("Recording failed."));};
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=()=>{cleanup();if(failure)reject(failure);else if(!chunks.length)reject(Error("Recorder returned an empty movie."));
        else resolve({blob:new Blob(chunks,{type:"video/mp4"}),encoder:"MediaRecorder (real time)"});};
      signal?.throwIfAborted();paint(0);recorder.start();const start=performance.now();
      signal?.addEventListener("abort",cancel,{once:true});document.addEventListener("visibilitychange",hidden);
      function tick() {
        try {
          const i=Math.floor((performance.now()-start)*fps/1000);
          if(i>=frames){stop();return;}
          paint(i);progress?.((i+1)/frames);
          timer=setTimeout(tick,Math.max(1,start+(i+1)*1000/fps-performance.now()));
        } catch(e){stop(e);}
      }
      tick();
    });
  } finally { clearTimeout(timer);stream.getTracks().forEach(t=>t.stop()); }
}
export async function encodeMP4(canvas,fps,frameCount,paint,progress,signal) {
  const config=await codecConfig(canvas,fps);
  if(!config)return recordInRealTime(canvas,fps,frameCount,paint,progress,signal);
  const target=new ArrayBufferTarget();
  const muxer=new Muxer({target,video:{codec:"avc",width:canvas.width,height:canvas.height},fastStart:"in-memory"});
  let failure;
  const encoder=new VideoEncoder({output:(chunk,meta)=>{try{muxer.addVideoChunk(chunk,meta);}catch(e){failure=e;}},error:e=>{failure=e;}});
  try {
    encoder.configure(config);
    for(let i=0;i<frameCount;i++) {
      signal?.throwIfAborted();if(failure)throw failure;
      paint(i);
      const start=Math.round(i*1e6/fps),duration=Math.round((i+1)*1e6/fps)-start;
      const frame=new VideoFrame(canvas,{timestamp:start,duration});
      try{encoder.encode(frame,{keyFrame:i%(2*fps)===0});}finally{frame.close();}
      if(encoder.encodeQueueSize>5)await encoder.flush();
      if(i%6===0){progress?.((i+1)/frameCount);await yieldFrame();}
    }
    await encoder.flush();if(failure)throw failure;
    muxer.finalize();progress?.(1);
    return {blob:new Blob([target.buffer],{type:"video/mp4"}),encoder:"WebCodecs AVC"};
  } finally {if(encoder.state!=="closed")encoder.close();}
}

export function neuralFrames(first,last,count,progress,signal) {
  const {width:w,height:h}=first;
  const pixels=c=>c.getContext("2d").getImageData(0,0,w,h).data;
  const a=pixels(first),b=pixels(last);
  return new Promise((resolve,reject)=>{
    signal?.throwIfAborted();
    const worker=new Worker(new URL("./neural-worker.mjs",import.meta.url),{type:"module"});
    const frames=[first];let timer;
    const clean=()=>{clearTimeout(timer);worker.terminate();signal?.removeEventListener("abort",cancel);};
    const fail=e=>{clean();reject(e);};
    const cancel=()=>fail(new DOMException("Canceled","AbortError"));
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>fail(Error("The model stopped responding. Retry with this tab open.")),180000);};
    arm();signal?.addEventListener("abort",cancel,{once:true});
    worker.onerror=e=>fail(Error(e.message||"The neural worker could not start."));
    worker.onmessage=({data})=>{
      arm();
      if(data.error){fail(Error(data.error));return;}
      if(data.status){progress?.(0,data.status);return;}
      if(data.frame){
        const c=canvasOf(w,h);c.getContext("2d").putImageData(new ImageData(data.frame,w,h),0,0);frames.push(c);
        progress?.(data.i/count,"Synthesized frame "+data.i+" of "+count+".");
      }
      if(data.done){clean();frames.push(last);resolve({frames,model:data.model,model_sha256:data.sha256,inference_ms:data.inference_ms});}
    };
    const localRuntime=new URLSearchParams(location.search).get("runtime")==="local";
    worker.postMessage({w,h,a,b,count,localRuntime},[a.buffer,b.buffer]);
  });
}
