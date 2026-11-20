// This page is served only during the automated test. It drives the production UI.
const frame=document.querySelector("iframe"), log=document.querySelector("#log");
const browserParams=new URLSearchParams(location.search);
const local=browserParams.get("runtime")==="local" ? "?runtime=local" : "";
const collect=location.hostname==="127.0.0.1" && browserParams.get("collect")==="1";
const checks=[],files={};
const status=text=>{log.textContent=text;console.log(text);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(value,explanation){if(!value)throw Error(explanation);}
async function until(f,what,ms=60000){
  const start=Date.now();
  while(!f()){if(Date.now()-start>ms)throw Error("Timed out: "+what);await sleep(50);}
}
const el=id=>frame.contentDocument.getElementById(id);
async function enter(hash=""){
  frame.src="../index.html"+(local ? local+"&" : "?")+"device-check=1&visit="+Date.now()+hash;
  await new Promise((resolve,reject)=>{let timer=setTimeout(()=>reject(Error("Navigation timed out")),20000);
    frame.onload=()=>{clearTimeout(timer);resolve();};});
  await until(()=>el("estimate")?.textContent.length>0,"Motion Lab startup");
}
function select(id,value){const e=el(id);e.value=value;e.dispatchEvent(new Event("change",{bubbles:true}));}
function typeValue(id,value){const e=el(id);e.value=value;e.dispatchEvent(new Event("input",{bubbles:true}));}
function upload(id,file){
  const data=new DataTransfer();data.items.add(file);el(id).files=data.files;
  el(id).dispatchEvent(new Event("change",{bubbles:true}));
}
async function action(id,timeout=90000){
  assert(!el(id).disabled,"Unexpected disabled control: "+id);el(id).click();
  await until(()=>el("cancel").hidden,id,timeout);
}
async function getBlob(id){return (await fetch(el(id).href)).blob();}
async function reportOutput(){
  assert(!el("result").hidden,el("status").textContent);
  return {blob:await getBlob("download"), receipt:await (await getBlob("saveReceipt")).text().then(JSON.parse)};
}
function mediaEvent(video,name,work) {
  return new Promise((resolve,reject)=>{
    const finish=error=>{
      clearTimeout(timer);video.removeEventListener(name,done);video.removeEventListener("error",failed);
      if(error)reject(error);else resolve();
    };
    const done=()=>finish(),failed=()=>finish(Error("Exported file did not decode."));
    const timer=setTimeout(()=>finish(Error("Timed out waiting for "+name+" during MP4 decode.")),20000);
    video.addEventListener(name,done,{once:true});video.addEventListener("error",failed,{once:true});
    try{work();}catch(e){finish(e);}
  });
}
async function decoded(blob, samples=[]){
  const v=document.createElement("video");v.playsInline=true;v.muted=true;v.preload="auto";
  const src=URL.createObjectURL(blob);
  try{
    await mediaEvent(v,"loadeddata",()=>{v.src=src;v.load();});
    const canvas=document.createElement("canvas");canvas.width=48;canvas.height=64;
    const ctx=canvas.getContext("2d",{willReadFrequently:true}),images=[];
    for(const time of samples){
      await mediaEvent(v,"seeked",()=>{v.currentTime=time;});
      ctx.drawImage(v,0,0,48,64);images.push(ctx.getImageData(0,0,48,64).data);
    }
    const differences=images.slice(1).map((image,i)=>image.reduce((sum,x,k)=>sum+Math.abs(x-images[i][k]),0)/(48*64*3));
    return {w:v.videoWidth,h:v.videoHeight,duration:v.duration,...(samples.length?{differences}:{})};
  }finally{v.removeAttribute("src");v.load();URL.revokeObjectURL(src);}
}
async function pose(raised){
  const c=document.createElement("canvas");c.width=180;c.height=320;const x=c.getContext("2d");
  x.fillStyle="#172932";x.fillRect(0,0,180,320);
  x.fillStyle="#dba450";x.fillRect(65,135,42,70);
  x.fillStyle="#eee7c9";x.fillRect(69,100,32,35);
  x.fillStyle="#536e72";x.fillRect(67,203,14,66);x.fillRect(91,203,14,66);
  x.lineCap="round";x.strokeStyle="#ea9a45";x.lineWidth=12;x.beginPath();x.moveTo(104,148);
  x.lineTo(raised?128:119,raised?141:165);x.lineTo(raised?140:125,raised?118:185);x.stroke();
  return new File([await new Promise(r=>c.toBlob(r,"image/png"))],raised?"signal.png":"rest.png",{type:"image/png"});
}
async function privatePost(path,body){
  if(collect){
    const response=await fetch("/__motion_test/"+path,{method:"POST",body});
    if(!response.ok)throw Error("Test server rejected "+path);
    return;
  }
  const blob=body instanceof Blob?body:new Blob([body],{type:"application/json"});
  const labels={"portrait.mp4":"Portrait MP4","scene.mp4":"Edited scene MP4","neural.mp4":"Neural MP4","result.json":"Save device report"};
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="midnight-device-"+path;a.className="button";a.textContent=labels[path];
  document.querySelector("#downloads").append(a);
  if(path==="scene.mp4"){
    const file=new File([blob],a.download,{type:"video/mp4"});
    if(navigator.canShare?.({files:[file]})){
      const button=document.createElement("button");button.textContent="Share scene to Drive";
      button.onclick=async()=>{
        try{await navigator.share({files:[file],title:"Midnight Studio device check"});
          document.querySelector("#shareStatus").textContent="Share sheet closed. Check the saved file in Drive.";}
        catch(e){if(e.name!=="AbortError")document.querySelector("#shareStatus").textContent=e.message;}
      };
      document.querySelector("#downloads").append(button);
    }
  }
}
async function suite(){
  // Use a separate database and a fresh fixture on every physical-device run.
  await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase("midnight-motion-verification-v1");req.onsuccess=resolve;req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error("Close other device checks, then reload."));});
  await enter();
  status("Rendering portrait articulation");select("ratio","tall");select("beat","recoil");
  await action("render");const rig=await reportOutput();const decodedRig=await decoded(rig.blob);
  assert(decodedRig.w===540&&decodedRig.h===960,"Wrong portrait dimensions");
  assert(Math.abs(decodedRig.duration-rig.receipt.planned_duration_seconds)<.55,"Unexpected recording duration");
  await privatePost("portrait.mp4",rig.blob);files.portrait={...decodedRig,encoder:rig.receipt.encoder};checks.push("portrait AVC and independent browser decode");
  status("Reopening locally measured reference");
  const id="abcdefghijk";typeValue("youtube","https://youtu.be/"+id);
  await action("measure");assert(el("refResult").hidden,"URL without source produced measurements");
  upload("referenceFile",new File([rig.blob],"original.mp4",{type:"video/mp4"}));
  await action("measure");assert(!el("refResult").hidden,el("refStatus").textContent);
  const measured=JSON.parse(await (await getBlob("saveReport")).text());
  assert(measured.sample_count>2&&measured.last_sample>decodedRig.duration-.08,"Reference did not cover the end");
  const portable=new URL(el("profileLink").href);
  const payload=JSON.parse(atob(portable.hash.slice(11).replace(/-/g,"+").replace(/_/g,"/")));
  assert(!portable.search&&payload.report.youtube_id===id&&!JSON.stringify(payload).includes("original.mp4")&&
    !("cut_times" in payload.report),"Portable link includes unrelated source details");
  await enter();typeValue("youtube","https://youtu.be/"+id);await action("measure");
  assert(el("refStatus").textContent.includes("Reused"),"Paired reference was not loaded from this device");checks.push("local source, whole-duration sampling, paired URL reopening");
  await enter(portable.hash);assert(!el("refResult").hidden&&el("youtube").value.endsWith(id),"Portable link did not reopen");
  assert(JSON.parse(await (await getBlob("saveReport")).text()).sample_count===measured.sample_count,"Portable sample count changed");
  checks.push("portable measurements from a local file, with no source media");
  el("clearRef").click();upload("referenceFile",new File([rig.blob],"cancel-me.mp4",{type:"video/mp4"}));
  el("measure").click();el("cancel").click();await until(()=>el("cancel").hidden,"cancel");
  assert(el("refResult").hidden&&el("refStatus").textContent.includes("Canceled"),"Cancelled work published results");checks.push("reference cancellation");
  const saved=await (await fetch("./evidence/sintel-job.json")).json();
  const encoded=btoa(JSON.stringify({id:saved.youtube_id,report:saved})).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
  frame.contentWindow.location.hash="reference="+encoded;
  await until(()=>el("refStatus").textContent.includes("Imported"),"same-tab job return");
  await enter("#reference="+encoded);
  assert(!el("refResult").hidden&&el("youtube").value.endsWith(saved.youtube_id),"Missing full-video job handoff");
  checks.push("GitHub analysis return link");
  status("Cutting a reference-paced original scene");
  await action("example");select("ratio","tall");select("beat","sequence");
  const actionChoice=el("shotEditor").querySelector("select");actionChoice.value="recoil";
  actionChoice.dispatchEvent(new Event("change",{bubbles:true}));
  await action("render");const edit=await reportOutput(), shots=edit.receipt.settings.shots;
  assert(shots.length===3&&shots[0].beat==="recoil"&&shots[0].start_frame===0,"Edited choices were lost");
  assert(shots[0].end_frame===shots[1].start_frame&&shots[1].end_frame===shots[2].start_frame,"Gaps in the edit");
  assert(new Set(shots.map(s=>s.end_frame-s.start_frame)).size>1,"Changing reference tempo did not affect the edit");
  const editSamples=[.5,Math.max(2,shots[0].end_frame*.45),shots[1].start_frame-.5,shots[1].start_frame+.5,
    shots[2].start_frame-.5,shots[2].start_frame+.5].map(n=>n/24);
  const decodedEdit=await decoded(edit.blob,editSamples);
  assert(decodedEdit.differences[0]>.3&&decodedEdit.differences[2]>2&&decodedEdit.differences[4]>2,"Expected articulation and two visible cuts in the decoded movie");
  assert(Math.abs(decodedEdit.duration-edit.receipt.planned_duration_seconds)<.55,"Wrong sequence duration");
  await privatePost("scene.mp4",edit.blob);files.scene={...decodedEdit,shots};checks.push("editable three-shot scene, varying measured tempo, decoded in-shot motion and two visible cuts");
  status("Directing an original idea on this device");
  typeValue("idea","She hears a faint sound. Then she knocks on the panel. Finally she shields her face.");
  await action("directIdea",180000);
  const choices=Array.from(el("shotEditor").querySelectorAll("select")).filter((v,i)=>i%2===0).map(v=>v.value);
  assert(choices.join(",")==="listen,knock,cover",el("ideaStatus").textContent);
  await action("render");const directed=await reportOutput(),direction=await decoded(directed.blob);
  assert(directed.receipt.story_direction.matches.length===3&&direction.w===540,"Missing directed scene");
  files.direction={choices,...direction};checks.push("local semantic story direction and decoded export");
  status("Running RIFE on two original poses");select("art","pair");select("ratio","tall");
  upload("firstPose",await pose(false));await until(()=>el("cancel").hidden,"first pose");
  upload("lastPose",await pose(true));await until(()=>!el("neural").disabled,"second pose");
  const started=performance.now();
  await action("neural",210000);const totalMs=Math.round(performance.now()-started);
  const neural=await reportOutput();const decodedNeural=await decoded(neural.blob);
  assert(neural.receipt.synthesized_frames===9&&decodedNeural.w===180&&decodedNeural.h===320,"Incorrect neural portrait output");
  await privatePost("neural.mp4",neural.blob);files.neural={...decodedNeural,encoder:neural.receipt.encoder,frames:neural.receipt.synthesized_frames,inference_ms:neural.receipt.inference_ms,total_render_ms:totalMs};
  checks.push("actual RIFE inference, two user poses, MP4 decode");
  const file=new File([edit.blob],"midnight-device-scene.mp4",{type:"video/mp4"});
  return {ok:true,checks,files,userAgent:navigator.userAgent,checked_at:new Date().toISOString(),
    can_share_mp4:Boolean(navigator.canShare?.({files:[file]}))};
}
async function start(){
  document.querySelector("#start").disabled=true;frame.hidden=false;
  try {
    const result=await suite();await privatePost("result.json",JSON.stringify(result,null,2));status("Passed "+checks.length+" checks.");
  }catch(e){
    const failure={ok:false,error:String(e?.message||e),stage:log.textContent,checks,files,userAgent:navigator.userAgent,
      appStatus:el("status")?.textContent,refStatus:el("refStatus")?.textContent};
    await privatePost("result.json",JSON.stringify(failure,null,2));status("Failed: "+failure.error);
  }
}
document.querySelector("#start").onclick=start;
if(collect)start();
