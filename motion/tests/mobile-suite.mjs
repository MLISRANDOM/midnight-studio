// This page is served only during the automated test. It drives the production UI.
const frame=document.querySelector("iframe"), log=document.querySelector("#log");
const browserParams=new URLSearchParams(location.search);
const local=browserParams.get("runtime")==="local" ? "?runtime=local" : "";
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
  frame.src="../index.html"+(local ? local+"&" : "?")+"visit="+Date.now()+hash;
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
async function decoded(blob){
  const v=document.createElement("video");v.playsInline=true;v.muted=true;v.preload="auto";
  const src=URL.createObjectURL(blob);
  try{
    await new Promise((resolve,reject)=>{v.onloadedmetadata=resolve;v.onerror=()=>reject(Error("Exported file did not decode."));v.src=src;v.load();});
    return {w:v.videoWidth,h:v.videoHeight,duration:v.duration};
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
  const response=await fetch("/__motion_test/"+path,{method:"POST",body});
  if(!response.ok)throw Error("Test server rejected "+path);
}
async function suite(){
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
  await enter();typeValue("youtube","https://youtu.be/"+id);await action("measure");
  assert(el("refStatus").textContent.includes("Reused"),"Paired reference was not loaded from this device");checks.push("local source, whole-duration sampling, paired URL reopening");
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
  status("Running RIFE on two original poses");select("art","pair");select("ratio","tall");
  upload("firstPose",await pose(false));await until(()=>el("cancel").hidden,"first pose");
  upload("lastPose",await pose(true));await until(()=>!el("neural").disabled,"second pose");
  await action("neural",210000);const neural=await reportOutput();const decodedNeural=await decoded(neural.blob);
  assert(neural.receipt.synthesized_frames===9&&decodedNeural.w===180&&decodedNeural.h===320,"Incorrect neural portrait output");
  await privatePost("neural.mp4",neural.blob);files.neural={...decodedNeural,encoder:neural.receipt.encoder,frames:neural.receipt.synthesized_frames,inference_ms:neural.receipt.inference_ms};
  checks.push("actual RIFE inference, two user poses, MP4 decode");
  return {ok:true,checks,files,userAgent:navigator.userAgent};
}
try {
  const result=await suite();await privatePost("result.json",JSON.stringify(result));status("Passed "+checks.length+" checks.");
}catch(e){
  const failure={ok:false,error:String(e?.message||e),stage:log.textContent,checks,files,userAgent:navigator.userAgent,
    appStatus:el("status")?.textContent,refStatus:el("refStatus")?.textContent};
  await privatePost("result.json",JSON.stringify(failure));status("Failed: "+failure.error);
}
