import {analyzeVideo,readReport,youtubeId} from "./reference.mjs";
import {makeSheetRig,paintShot,SHEET_SHA,shotPlan} from "./rig.mjs";
import {canvasOf,encodeMP4,fitImage,neuralFrames,readImage} from "./video.mjs";
import {stored} from "./storage.mjs";

const $=id=>document.getElementById(id), stage=$("stage");
const demoId="HOfdboHvshg";
let rig,report,reportSource="",controller,playback,position=0,result,referenceId=null,queuedHandoff=false;
const poses=[null,null],urls=new Map();
const controls=Array.from(document.querySelectorAll("select,input,button")).filter(e=>e.id!=="cancel");
const renderButtons=["render","neural"];
const pair=()=>$("art").value==="pair";
const useSheet=()=>$("art").value==="survivor";
const plan=()=>shotPlan($("beat").value,report);
const duration=()=>pair()?transitionSeconds():plan().duration;
function transitionSeconds(){return Math.max(.75,Math.min(2.8,plan().beatSeconds));}

function linkBlob(id,blob,name) {
  if(urls.has(id))URL.revokeObjectURL(urls.get(id));
  const url=URL.createObjectURL(blob);urls.set(id,url);$(id).href=url;$(id).download=name;return url;
}
function jsonFile(id,object,name){linkBlob(id,new Blob([JSON.stringify(object,null,2)+"\n"],{type:"application/json"}),name);}
function clearResult(){
  result=null;$("result").hidden=true;$("movie").removeAttribute("src");$("movie").load();
  for(const id of ["download","saveReceipt"]){if(urls.has(id))URL.revokeObjectURL(urls.get(id));urls.delete(id);$(id).removeAttribute("href");}
}
function syncButtons(){
  const ready=pair()?poses.every(Boolean):!useSheet()||Boolean(rig);
  $("render").hidden=pair();$("actionRow").hidden=pair();
  renderButtons.forEach(id=>$(id).disabled=!!controller||!ready);
  $("play").disabled=!!controller||pair()||!ready;$("scrub").disabled=!!controller||pair()||!ready;
  $("sheetPanel").hidden=!useSheet();$("pairPanel").hidden=!pair();
  $("estimate").textContent=pair()?"Neural transition: nine synthesized frames at 320 × 180 or 180 × 320. First use downloads about 33 MB.":"Articulated shots export at 960 × 540 or 540 × 960. Neural mode animates two poses from this shot at preview resolution.";
}
function preview(t) {
  position=Math.max(0,Math.min(1,t));$("scrub").value=Math.round(position*1000);$("time").value=(position*duration()).toFixed(1)+" s";
  if(pair()||useSheet()&&!rig){
    const image=pair()?poses[0]:null;
    if(image)fitImage(stage,image);else{const ctx=stage.getContext("2d");ctx.fillStyle="#14272b";ctx.fillRect(0,0,stage.width,stage.height);}
  }else paintShot(stage,useSheet()?rig:null,plan(),position);
}
function stop(){cancelAnimationFrame(playback);playback=0;$("play").textContent="Play shot";}
function refresh(){stop();clearResult();$("status").textContent="";const tall=$("ratio").value==="tall";
  stage.width=tall?540:960;stage.height=tall?960:540;$("formatLabel").textContent=(tall?"9:16":"16:9")+" · 24 fps";syncButtons();preview(0);}
$("play").onclick=()=>{if(playback){stop();return;}if(position>=1)position=0;
  const start=performance.now()-position*duration()*1000;$("play").textContent="Pause";
  function tick(now){preview((now-start)/(duration()*1000));if(position<1)playback=requestAnimationFrame(tick);else stop();}
  playback=requestAnimationFrame(tick);};
$("scrub").oninput=()=>{stop();preview(Number($("scrub").value)/1000);};
for(const id of ["art","beat","ratio"])$(id).onchange=refresh;

async function task(fn,where="status") {
  if(controller)return;
  controller=new AbortController();stop();controls.forEach(el=>el.disabled=true);
  $("workProgress").value=0;$("workProgress").hidden=false;$("cancel").hidden=false;
  try{await fn(controller.signal);}
  catch(e){$(where).textContent=e.name==="AbortError"?"Canceled.":e.message||String(e);}
  finally{controller=null;controls.forEach(el=>el.disabled=false);$("cancel").hidden=true;$("workProgress").hidden=true;syncButtons();if(queuedHandoff){queuedHandoff=false;applyHandoff();}}
}
$("cancel").onclick=()=>controller?.abort();
async function setSheet(file) {
  if(!file)throw Error("Select the approved Survivor sheet from Drive.");
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),v=>v.toString(16).padStart(2,"0")).join("");
  if(hash!==SHEET_SHA)throw Error("This rig needs the original Approved_Character_Sheet.jpeg. For other artwork, choose My original keyframes.");
  rig=makeSheetRig(await readImage(file));$("sheetStatus").textContent="Approved sheet matched.";
}
$("sheet").onchange=()=>task(async()=>{
  rig=null;clearResult();$("sheetStatus").textContent="";preview(0);const file=$("sheet").files[0];await setSheet(file);
  try{await stored("survivor-sheet",file);$("sheetStatus").textContent="Approved sheet matched and saved on this device.";}catch{}
  preview(0);$("status").textContent="Survivor is ready to animate.";
});
["firstPose","lastPose"].forEach((id,i)=>$(id).onchange=()=>task(async()=>{
  poses[i]=null;clearResult();const file=$(id).files[0];if(file)poses[i]=await readImage(file);preview(0);
}));
function removeReport() {
  report=null;reportSource="";referenceId=null;$("refResult").hidden=true;refresh();
}
function showReport(raw,source,id) {
  const profile=readReport(raw);report=profile;reportSource=source;referenceId=id||null;refresh();
  $("refResult").hidden=false;$("refStatus").textContent=source;
  const rows=[["Source duration",profile.duration_seconds.toFixed(2)+" s"],["Estimated shots",profile.shot_count_estimate],
    ["Median shot",profile.median_shot_seconds.toFixed(2)+" s"]];
  if(profile.sample_count)rows.push(["Decoded samples",profile.sample_count]);
  if(Number.isFinite(profile.last_sample))rows.push(["Time covered","0 to "+profile.last_sample.toFixed(2)+" s"]);
  else rows.push(["Coverage","Full FFmpeg scene pass"]);
  $("stats").replaceChildren(...rows.flatMap(([label,v])=>{const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=v;return [dt,dd];}));
  jsonFile("saveReport",raw,"reference-technique.json");
}
for(const id of ["youtube","referenceFile","master","reportFile"])$(id).addEventListener(id==="youtube"||id==="master"?"input":"change",()=>{
  removeReport();$("refStatus").textContent="";
});
$("clearRef").onclick=()=>{for(const id of ["youtube","referenceFile","master","reportFile"])$(id).value="";removeReport();$("refStatus").textContent="Reference cleared for this shot.";};
function authorizedURL(value){
  const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||u.port)throw Error("Use a direct creator-provided HTTPS media URL.");
  return u.href;
}
async function measure(signal) {
  const id=youtubeId($("youtube").value),file=$("referenceFile").files[0],url=$("master").value.trim(),imported=$("reportFile").files[0];
  if([Boolean(file),Boolean(url),Boolean(imported)].filter(Boolean).length>1)throw Error("Choose one source: a video file, direct media URL, or saved report.");
  let raw,source;
  if(imported){
    if(imported.size>8*1024*1024)throw Error("Choose an analysis report smaller than 8 MB.");
    raw=JSON.parse(await imported.text());source="Imported measurements from your selected report.";
  }else if(file||url){
    $("refStatus").textContent="Reading frames from the beginning to the end…";
    raw=await analyzeVideo(file||authorizedURL(url),n=>{$("workProgress").value=n;$("refStatus").textContent="Reading the source · "+Math.round(n*100)+"%";},signal);
    source="Measured the selected "+(file?"video file":"creator-provided video")+" on this device.";
  }else if(id){
    let known;try{known=await stored("youtube:"+id);}catch{}
    if(known){raw=known;source="Reused this device’s measured reference for the YouTube link.";}
    else if(id===demoId){
      const response=await fetch(new URL("./sintel-technique.json",import.meta.url),{signal});if(!response.ok)throw Error("Could not load the measured example.");
      raw=await response.json();source="Saved analysis of the full 52-second Sintel trailer, Blender Foundation. Source: the creator’s downloadable master.";
    }else throw Error("This YouTube link has no measured source yet. Run the linked GitHub YouTube job, or choose the authorized original from Files or Drive.");
  }else throw Error("Choose a reference video, paste a linked reference, or try the Sintel example.");
  signal.throwIfAborted();showReport(raw,source,id);
  if(id&&(file||url||imported)){try{await stored("youtube:"+id,raw);}catch{$("refStatus").textContent+=" Caching is unavailable on this device.";}}
}
$("measure").onclick=()=>task(measure,"refStatus");
$("example").onclick=()=>{for(const id of ["referenceFile","master","reportFile"])$(id).value="";$("youtube").value="https://youtu.be/"+demoId;removeReport();task(measure,"refStatus");};
$("sendIdeas").onclick=()=>{
  try{
    const key="midnight-reference-lab-v1",old=JSON.parse(localStorage.getItem(key)||"{}");
    if(referenceId)old.url="https://youtu.be/"+referenceId;
    old.pacing="Estimated "+report.shot_count_estimate+" shots across "+report.duration_seconds+" s. Median shot length "+report.median_shot_seconds+" s.";
    localStorage.setItem(key,JSON.stringify(old));location.href="../index.html#motion-ideas";
  }catch{$("refStatus").textContent="Could not save Studio Ideas on this device. Use Save measurements.";}
};
function resizeSource(image,w,h){const c=canvasOf(w,h);fitImage(c,image);return c;}
async function render(kind,signal) {
  clearResult();
  const tall=$("ratio").value==="tall",neural=kind==="neural";
  const w=tall?(neural?180:540):(neural?320:960),h=tall?(neural?320:960):(neural?180:540);
  const canvas=canvasOf(w,h),ctx=canvas.getContext("2d"),fps=24,shot=plan();
  const seconds=neural?transitionSeconds():shot.duration,frames=Math.round(seconds*fps);
  let stats={},draw=i=>paintShot(canvas,useSheet()?rig:null,shot,i/(frames-1));
  if(neural){
    let a,b;
    if(pair()){a=resizeSource(poses[0],w,h);b=resizeSource(poses[1],w,h);}
    else{a=canvasOf(w,h);b=canvasOf(w,h);paintShot(a,useSheet()?rig:null,shot,.15);paintShot(b,useSheet()?rig:null,shot,.43);}
    const generated=await neuralFrames(a,b,9,(v,msg)=>{$("workProgress").value=v*.82;$("status").textContent=msg;},signal);
    const timeline=generated.frames;
    stats={model:generated.model,model_sha256:generated.model_sha256,inference_ms:generated.inference_ms,synthesized_frames:timeline.length-2};
    draw=i=>ctx.drawImage(timeline[Math.round(i*(timeline.length-1)/(frames-1))],0,0);
  }
  $("status").textContent="Encoding the silent MP4…";
  const {blob,encoder}=await encodeMP4(canvas,fps,frames,draw,v=>{$("workProgress").value=neural ? .82+.18*v : v;},signal);
  signal.throwIfAborted();
  const name=[useSheet()?"survivor":pair()?"original-poses":"station-robot",neural?"neural":"articulated",$("ratio").value].join("-");
  const reportOut={mode:kind,artwork:$("art").value,action:pair()?null:shot.beat,dimensions:[w,h],requested_fps:fps,
    planned_frames:frames,planned_duration_seconds:frames/fps,encoder,bytes:blob.size,audio:false,reference:report,
    reference_source:reportSource||null,youtube_id:referenceId,settings:shot,...stats};
  result={blob,name};$("movie").src=linkBlob("download",blob,name+".mp4");
  jsonFile("saveReceipt",reportOut,name+".json");$("result").hidden=false;
  $("receipt").textContent=w+" × "+h+" · "+(frames/fps).toFixed(2)+" s planned · "+(blob.size/1024).toFixed(0)+" KB"+(neural?" · 9 neural in-betweens":"");
  $("status").textContent="MP4 ready.";
}
$("render").onclick=()=>task(sig=>render("articulated",sig));
$("neural").onclick=()=>task(sig=>render("neural",sig));
$("share").onclick=async()=>{
  if(!result)return;
  const file=new File([result.blob],result.name+".mp4",{type:"video/mp4"});
  try {
    if(!navigator.canShare?.({files:[file]})){ $("status").textContent="Tap Download MP4, then use Files to save it to your Google Drive folder.";return;}
    await navigator.share({files:[file],title:result.name});$("status").textContent="Share sheet closed. Check the destination you selected in Drive.";
  }catch(e){if(e.name!=="AbortError")$("status").textContent=e.message;}
};
const linked=new URLSearchParams(location.search).get("youtube");if(linked)$("youtube").value=linked;
refresh();
function applyHandoff(){
  if(!location.hash.startsWith("#reference="))return;
  if(controller){queuedHandoff=true;return;}
  try{
    const token=location.hash.slice(11);
    if(!/^[A-Za-z0-9_-]{1,4000}$/.test(token))throw Error("Invalid reference return link.");
    const payload=JSON.parse(atob(token.replace(/-/g,"+").replace(/_/g,"/")));
    if(!/^[A-Za-z0-9_-]{11}$/.test(payload.id)||payload.report?.youtube_id!==payload.id)throw Error("Invalid reference ID.");
    $("youtube").value="https://youtu.be/"+payload.id;
    showReport(payload.report,"Imported the GitHub job’s complete video measurements.",payload.id);
    stored("youtube:"+payload.id,payload.report).catch(()=>{});
  }catch(e){$("refStatus").textContent=e.message;}
}
window.addEventListener("hashchange",applyHandoff);
applyHandoff();
stored("survivor-sheet").then(async file=>{if(file&&!rig&&!controller){await setSheet(file);if(useSheet()){syncButtons();preview(0);}}}).catch(()=>{});
