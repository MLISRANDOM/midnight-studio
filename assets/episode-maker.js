/* Midnight Studio v0.9: one-screen guided full-episode art production.
 * Creates the storyboard locally and generates all scene images sequentially
 * using the user's already connected Cloudflare FLUX Worker.
 * A motion-comic preview is created; full AI video animation/voice are NOT provided.
 */
(()=>{
"use strict";
const $=id=>document.getElementById(id),stage=$("storyPanel"),flux=$("fluxStudio"),api=window.midnightStudioArt;
if(!stage||!flux||!api)return;
const ui=document.createElement("section");
ui.id="episodeMaker";ui.className="studio-episode-maker";
ui.innerHTML=`<div class="ep-heading"><span class="ep-kicker">MIDNIGHT STUDIO · EPISODE MAKER</span><h2>Make a full episode</h2><p>Tell us the story once. We'll build the shots and make the artwork for every scene automatically.</p></div>
<label>What's your episode about?<textarea id="epIdea" rows="4" placeholder="Example: Evan wakes in the bunker. Rule 3 has changed, and someone is knocking from inside the walls."></textarea></label>
<label>Where will you post it?<select id="epFormat"><option value="short">TikTok / Shorts · 6 scenes</option><option value="long">YouTube motion-comic · 12 scenes</option></select></label>
<div class="ep-setup-status"><span id="epConnection" class="ep-dot"></span><span id="epConnectionText">Checking free image generator…</span><button type="button" id="epSetupOpen">Setup</button></div>
<button id="epStart" type="button" class="primary ep-main-button">Create my episode</button>
<div id="epWork" class="hidden">
 <div class="ep-progress-line"><strong id="epProgressText">Preparing episode…</strong><span id="epProgressCount">0 / 0</span></div>
 <div class="meter"><div class="bar" id="epProgressBar"></div></div>
 <p id="epWorkStatus" class="hint" role="status" aria-live="polite"></p>
 <div class="actions"><button type="button" id="epStop">Stop after current scene</button><button type="button" id="epResume" class="hidden">Resume missing scenes</button></div>
</div>
<div id="epFinished" class="hidden ep-finished"><strong>Episode artwork ready</strong><p>All scene images are saved locally. Watch the motion-comic preview, then use Export for the available video or frame options.</p><div class="actions"><button id="epWatch" type="button" class="primary">Watch full preview</button><button id="epExport" type="button">Export options</button></div></div>
<details class="studio-details ep-about"><summary>What does “full episode” include? <span>Read</span></summary><div class="studio-detail-body"><p class="hint">One click generates an editable storyboard and sequential still artwork for all scenes, then combines them in a moving motion-comic preview. It does not produce fully animated AI video or automatically recorded narration. iPhone Safari might not support direct video export. Scene images live in this browser, so save backup copies.</p></div></details>`;
stage.insertBefore(ui,stage.firstChild);
const storyRest=document.createElement("details");
storyRest.className="studio-details ep-advanced";
storyRest.innerHTML='<summary>Manual episode editor <span>Optional</span></summary><div class="studio-detail-body"></div>';
const rest=storyRest.querySelector(".studio-detail-body");
for(const child of Array.from(stage.children)){if(child!==ui&&child!==storyRest)rest.append(child)}
stage.append(storyRest);
const msg=s=>$("epConnectionText").textContent=s;
const err=s=>{$("epWorkStatus").textContent=s;$("epWorkStatus").setAttribute("data-error","true")};
const existingSettings=()=>({url:$("fluxUrl")?.value?.trim()?.replace(/\/$/,"")||"",token:$("fluxToken")?.value?.trim()||""});
function connection(){
 const {url,token}=existingSettings();
 const ready=/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(url)&&!!token;
 $("epConnection").classList.toggle("ep-ready",ready);
 msg(ready?"Free AI generator configured":"Connect your free AI generator once");
 return ready;
}
$("epSetupOpen").onclick=()=>{window.showTab("art");$("fluxSetup").open=true;$("fluxStudio").scrollIntoView({behavior:"smooth",block:"start"})};
$("fluxToken")?.addEventListener("input",connection);$("fluxUrl")?.addEventListener("input",connection);
connection();
$("epIdea").value=$("premise").value||"";
$("epIdea").addEventListener("input",()=>{$("premise").value=$("epIdea").value;save()});
$("epFormat").value=$("ratio").value==="9:16"?"short":"long";
const formatSettings=()=>{
 const short=$("epFormat").value==="short";
 $("count").value=short?"6":"12";
 $("ratio").value=short?"9:16":"16:9";
 $("geminiFormat").value=$("ratio").value;
 $("fluxFormat").value=$("ratio").value;
};
$("epFormat").addEventListener("change",formatSettings);
let active=false,stopRequested=false;
const encode=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=()=>reject(Error("Could not read Evan's portrait"));r.readAsDataURL(blob)});
async function portrait(blob){
 const image=await createImageBitmap(blob);
 try{
  const ratio=image.width/image.height;
  const crop=ratio>1.45;
  const sx=crop?Math.round(image.width*.115):0,sy=crop?Math.round(image.height*.025):0;
  const sw=crop?Math.round(image.width*.315):image.width,sh=crop?Math.round(image.height*.545):image.height;
  const k=Math.min(1,480/Math.max(sw,sh));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(sw*k));canvas.height=Math.max(1,Math.round(sh*k));
  canvas.getContext("2d").drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  const out=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.83));
  if(!out)throw Error("Reference preprocessing failed");
  return {mimeType:"image/jpeg",data:await encode(out)};
 }finally{image.close()}
}
function db(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open("midnight-scene-art-v1",1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("images"))r.result.createObjectStore("images")};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
async function putArtwork(id,blob){
 const d=await db();
 await new Promise((resolve,reject)=>{
  const t=d.transaction("images","readwrite");
  t.objectStore("images").put(blob,id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)
 });d.close();
}
function loadArtwork(s,blob){
 return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(blob);
  img.onload=()=>{uploaded[s.id]=img;URL.revokeObjectURL(url);resolve()};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Artwork could not be decoded"))};
  img.src=url;
 });
}
function promptFor(scene,i,ref){
 let bible={};try{bible=JSON.parse(localStorage.getItem("midnight-studio-series-bible-v1")||"{}")}catch{}
 const detail=ref==="klein"?"Input image 0 is the official identity reference of Evan, not a mood board. Use the SAME illustrated character, not a reinterpretation.":"";
 return [
  "Create ONE finished frame from an ORIGINAL 2D cartoon psychological horror episode, "+$("ratio").value+" aspect ratio. No printed text, captions, watermarks, borders, lettering, or panels.",
  detail,
  "IDENTITY LOCK: Evan is an adult Black male cartoon protagonist with medium-dark brown skin, short curly high fade, heavy connected dark beard and mustache, thick expressive brows, rounded stylized face, charcoal gray hoodie with drawstrings, and olive backpack straps. Keep his face and silhouette consistent. NOT bald, NOT a different person. Preserve features from approved reference.",
  "STYLE: "+(bible.style||"bold clean thick outlines, flat muted colors, dramatic shadows")+". Clean cinematic composed storyboard frame.",
  "SERIES: "+(bible.series||"The Safe Room Rules")+". Rules: "+(bible.rules||"seven changing rules")+". Known locations: "+(bible.locations||"bunker")+".",
  "EPISODE PREMISE: "+$("premise").value+". SCENE "+(i+1)+"/"+scenes.length+": "+scene.title+". Location: "+scene.setting+". Camera: "+scene.shot+". Action: "+scene.description+".",
  "One coherent shot. Show the story beat with facial acting, atmospheric composition, and consistent wardrobe. Do not visually combine multiple scenes."
 ].filter(Boolean).join("\n\n");
}
function updateProgress(done,totalCount,detail){
 $("epProgressCount").textContent=done+" / "+totalCount+" scenes";
 $("epProgressBar").style.width=(totalCount?100*done/totalCount:0)+"%";
 $("epProgressText").textContent=done===totalCount?"All scenes generated":"Generating episode artwork";
 $("epWorkStatus").textContent=detail;
}
function prepareStoryboard(){
 const idea=$("epIdea").value.trim();
 if(idea.length<15)throw Error("Describe your episode in at least a sentence.");
 const count=$("epFormat").value==="short"?6:12;
 if(scenes.length){
  if(!confirm("Build a NEW "+count+"-scene episode? This will replace the current storyboard. Save a project backup first if needed."))return false;
 }
 $("premise").value=idea;
 formatSettings();
 generate();
 if($("epFormat").value==="long"){for(const sc of scenes)sc.seconds=14;update()}
 return true;
}
async function run(batchNew){
 if(active)return;
 if(!connection()){err("Connect your Cloudflare generator first using Setup.");$("epWork").classList.remove("hidden");return}
 if(batchNew){try{if(!prepareStoryboard())return}catch(e){err(String(e.message||e));$("epWork").classList.remove("hidden");return}}
 let ref;
 try{ref=await api.getReference()}catch(e){err(e.message);$("epWork").classList.remove("hidden");return}
 if(!ref){err("Upload Evan's approved picture in Series Bible first.");$("epWork").classList.remove("hidden");return}
 const {url,token}=existingSettings();
 let character;
 try{character=await portrait(ref)}catch(e){err("Could not prepare Evan reference: "+e.message);$("epWork").classList.remove("hidden");return}
 active=true;stopRequested=false;
 $("epStart").disabled=true;$("epResume").classList.add("hidden");$("epFinished").classList.add("hidden");
 $("epWork").classList.remove("hidden");$("epWorkStatus").removeAttribute("data-error");
 const totalCount=scenes.length;
 const complete=()=>scenes.filter(x=>x.imageData==="gemini-local"&&uploaded[x.id]).length;
 updateProgress(complete(),totalCount,"Starting scene artwork…");
 try{
  for(let i=0;i<scenes.length;i++){
   if(stopRequested)break;
   const sc=scenes[i];
   if(sc.imageData==="gemini-local"&&uploaded[sc.id])continue;
   updateProgress(complete(),totalCount,"Generating "+(i+1)+"/"+totalCount+": "+sc.title);
   const body={prompt:promptFor(sc,i,"klein"),aspectRatio:$("ratio").value,model:"klein",referenceImage:character};
   const resp=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-studio-token":token},body:JSON.stringify(body)});
   const data=await resp.json();
   if(!resp.ok||!data.ok||!data.data)throw Error("Scene "+(i+1)+": "+(data.error||"Generation failed"));
   const bin=atob(data.data),array=new Uint8Array(bin.length);
   for(let j=0;j<bin.length;j++)array[j]=bin.charCodeAt(j);
   const blob=new Blob([array],{type:data.mimeType||"image/png"});
   await putArtwork(sc.id,blob);
   await loadArtwork(sc,blob);
   sc.imageData="gemini-local";
   save();
   renderList();drawAt(0);
   updateProgress(complete(),totalCount,"Finished "+(i+1)+"/"+totalCount+": "+sc.title);
  }
  if(!stop&&complete()===totalCount){
   $("epFinished").classList.remove("hidden");
   updateProgress(totalCount,totalCount,"Episode artwork created. Preview the motion comic or review/export your project.");
  }else if(stopRequested){
   updateProgress(complete(),totalCount,"Stopped. Your completed scenes were saved. Resume when ready.");
   $("epResume").classList.remove("hidden");
  }
 }catch(e){
  err(String(e.message||e)+". Already generated scenes are saved. Use Resume missing scenes to continue.");
  $("epResume").classList.remove("hidden");
 }finally{
  active=false;$("epStart").disabled=false;
  if(!$("epFinished").classList.contains("hidden"))$("epResume").classList.add("hidden");
 }
}
$("epStart").onclick=()=>run(true);
$("epResume").onclick=()=>run(false);
$("epStop").onclick=()=>{stopRequested=true;$("epWorkStatus").textContent="Stopping after the current image finishes…"};
$("epWatch").onclick=()=>{document.body.classList.add("episode-preview-open");window.showTab("story");$("viewer").classList.remove("hidden");$("viewer").scrollIntoView({behavior:"smooth"});if(typeof stop==="function")stop();$("play").click()};
$("epExport").onclick=()=>window.showTab("export");
})();