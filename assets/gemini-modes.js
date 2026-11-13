/* Midnight Studio v0.5: Gemini Pro handoff + optional private API generation. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const art=$("artPanel");
if(!art)return;
const ui=document.createElement("section");
ui.className="scene";
ui.id="geminiModes";
ui.innerHTML=`<div class="headerline"><h3>Gemini image studio</h3><span class="badge">DUAL MODE</span></div>
<p class="muted">Use your Gemini Pro subscription manually, or connect a private API gateway for generation directly inside Midnight Studio.</p>
<label>Generation mode<select id="geminiMode"><option value="pro">Gemini Pro (existing subscription, manual transfer)</option><option value="auto">Gemini API (direct generation, separate usage charges)</option></select></label>
<div class="grid2">
<label>Video format<select id="geminiFormat"><option value="9:16">TikTok / Shorts (9:16)</option><option value="16:9">YouTube (16:9)</option></select></label>
<label>Output model<select id="geminiModel"><option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image</option><option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option></select></label>
</div>
<div id="geminiPro" class="scene">
<p class="muted">Prepare the selected shot with all established story facts. Copy the prompt and download Evan's reference; then generate the image in Gemini and import it below. This does not connect your subscription automatically.</p>
<div class="actions"><button id="geminiCopy" type="button" class="primary">Copy scene + continuity prompt</button><button id="geminiDownloadRef" type="button">Download Evan reference</button></div>
<div class="actions"><button id="geminiOpen" type="button">Open Gemini</button><button id="geminiPick" type="button">Import Gemini result</button><input id="geminiImageFile" class="file" type="file" accept="image/png,image/jpeg,image/webp"></div>
</div>
<div id="geminiAuto" class="scene hidden">
<p class="muted">Direct generation uses a separately deployed private Cloudflare Worker. Google API billing is separate from your Gemini Pro subscription.</p>
<label>Private Worker URL<input id="geminiEndpoint" type="url" autocomplete="off" placeholder="https://your-worker.your-subdomain.workers.dev"></label>
<label>Studio access token (not your Gemini API key)<input id="geminiToken" type="password" autocomplete="off" placeholder="Private Worker token"></label>
<div class="actions"><button id="geminiGenerate" type="button" class="primary">Generate with Gemini</button><button id="geminiRegenerate" type="button">Regenerate scene</button></div>
<p class="hint">The token is only kept in this tab session. Do not paste your Google API key here. This lightweight access-token approach is intended for one private creator; production use needs stronger authentication and server-side quotas.</p>
</div>
<div id="geminiOutput" class="hidden"><h3>Gemini image result</h3><img id="geminiResult" alt="Latest generated or imported scene artwork" style="display:block;width:100%;max-height:460px;object-fit:contain;border:1px solid #354965;border-radius:12px"><div class="actions"><button id="geminiApprove" type="button" class="primary">Use image in selected scene</button><button id="geminiSave" type="button">Download image PNG/JPG</button></div></div>
<div id="geminiStatus" class="notice" role="status" aria-live="polite">Ready. Choose Gemini Pro to use your subscription without additional API integration.</div>`;
const refCard=$("artReferenceCard");
if(refCard)refCard.insertAdjacentElement("afterend",ui);else art.querySelector("p")?.insertAdjacentElement("afterend",ui);
const state={blob:null,url:null,busy:false};
const status=msg=>$("geminiStatus").textContent=msg;
const currentScene=()=>scenes[Number($("artScene").value)||0];
const key="midnight-studio-gemini-mode-v1";
const getBible=()=>{try{return JSON.parse(localStorage.getItem("midnight-studio-series-bible-v1")||"{}")}catch{return {}}};
function prompt(){
 const s=currentScene(),b=getBible();
 if(!s)throw Error("Create a storyboard and select a scene first.");
 const episodes=Array.isArray(b.episodes)?b.episodes.map((x,i)=>(i+1)+". "+x.title+": "+x.summary).join("\n"):"None recorded";
 return [
 "Create exactly one original finished 2D animated horror scene frame, "+$("geminiFormat").value+" aspect ratio. Clean frame without text, titles, captions, logos, borders or watermarks.",
 "CHARACTER DESIGN LOCK: "+(b.character||"Evan")+". "+(b.appearance||"Short fade haircut, full beard, charcoal hoodie")+". Match the attached approved character reference with exceptional fidelity. Preserve the face, beard, hair, clothing and proportions; do not redesign.",
 "SERIES VISUAL STYLE: "+(b.style||"Bold thick black outlines, flat muted colors and dramatic horror lighting"),
 "SERIES CANON: "+(b.rules||"Not specified"),
 "RECURRING PLACES: "+(b.locations||"Not specified"),
 "PRIOR EVENTS: "+(b.events||"Not specified"),
 "EPISODE HISTORY: "+episodes,
 "UNRESOLVED THREADS: "+(b.threads||"Not specified"),
 "CURRENT EPISODE: "+$("title").value+". PREMISE: "+$("premise").value,
 "SCENE: "+s.title+". SETTING: "+s.setting+". SHOT: "+s.shot+". DIRECTION: "+s.description,
 "Maintain series continuity, atmosphere, wardrobe, and silhouette. Do not invent changes to existing canon."
 ].join("\n\n");
}
function switchMode(){
 const auto=$("geminiMode").value==="auto";
 $("geminiAuto").classList.toggle("hidden",!auto);
 $("geminiPro").classList.toggle("hidden",auto);
 $("geminiModel").disabled=!auto;
 try{localStorage.setItem(key,$("geminiMode").value)}catch{}
}
$("geminiMode").value=localStorage.getItem(key)==="auto"?"auto":"pro";
$("geminiMode").onchange=switchMode;
$("geminiFormat").value=$("ratio").value||"9:16";
$("geminiFormat").onchange=()=>{$("ratio").value=$("geminiFormat").value;status("Video format set to "+$("geminiFormat").value+". The scene-generation prompt will use this format.")};
$("geminiCopy").onclick=async()=>{try{const p=prompt();await navigator.clipboard.writeText(p);status("Scene prompt copied. Download Evan's approved image and attach it in Gemini.")}catch(e){try{window.prompt("Copy your prompt:",prompt())}catch{status(e.message)}}};
$("geminiDownloadRef").onclick=()=>$("bDownloadRef").click();
$("geminiOpen").onclick=()=>window.open("https://gemini.google.com/app","_blank","noopener,noreferrer");
$("geminiPick").onclick=()=>$("geminiImageFile").click();
function showImage(blob){
 if(state.url)URL.revokeObjectURL(state.url);
 state.blob=blob;
 state.url=URL.createObjectURL(blob);
 $("geminiResult").src=state.url;
 $("geminiOutput").classList.remove("hidden");
 status("Artwork loaded. Review it, then tap Use image in selected scene.");
}
$("geminiImageFile").onchange=e=>{
 const file=e.target.files?.[0];if(file){if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>16*1024*1024)status("Use PNG, JPG or WebP smaller than 16 MB.");else showImage(file)}
 e.target.value="";
};
async function getReference(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open("midnight-studio-reference-v1",1);
  req.onerror=()=>reject(Error("Reference image storage unavailable"));
  req.onsuccess=()=>{
   const db=req.result;const tx=db.transaction("assets","readonly");
   const get=tx.objectStore("assets").get("evan-approved");
   get.onsuccess=()=>{resolve(get.result||null);db.close()};
   get.onerror=()=>{reject(Error("Could not read approved Evan reference"));db.close()};
  };
  req.onupgradeneeded=()=>{req.result.createObjectStore("assets")};
 });
}
const readBase64=blob=>new Promise((resolve,reject)=>{
 const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=()=>reject(Error("Cannot read character reference"));r.readAsDataURL(blob)
});
async function generate(){
 if(state.busy)return;
 const button=$("geminiGenerate"),regenerate=$("geminiRegenerate");
 try{
  const endpoint=$("geminiEndpoint").value.trim(),token=$("geminiToken").value.trim();
  if(!/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(endpoint))throw Error("Enter the HTTPS address of your deployed private Worker first.");
  if(!token)throw Error("Enter your private Studio access token. Do not enter a Gemini API key.");
  const ref=await getReference();if(!ref)throw Error("Upload Evan's approved reference in Series Bible first.");
  const scenePrompt=prompt();
  state.busy=true;button.disabled=true;regenerate.disabled=true;button.textContent="Generating…";
  status("Sending this scene, series canon, and the approved Evan image to Gemini. This request may incur API charges.");
  const base64=await readBase64(ref);
  const response=await fetch(endpoint,{
   method:"POST",headers:{"Content-Type":"application/json","x-studio-token":token},
   body:JSON.stringify({prompt:scenePrompt,aspectRatio:$("geminiFormat").value,model:$("geminiModel").value,referenceImage:{mimeType:ref.type,data:base64}})
  });
  const json=await response.json();
  if(!response.ok||!json.ok||!json.data)throw Error(json.error||"Generation failed");
  const bin=atob(json.data),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  showImage(new Blob([bytes],{type:json.mimeType||"image/png"}));
 }catch(e){status("Gemini: "+String(e.message||e))}
 finally{state.busy=false;button.disabled=false;regenerate.disabled=false;button.textContent="Generate with Gemini"}
}
$("geminiGenerate").onclick=generate;
$("geminiRegenerate").onclick=generate;
$("geminiSave").onclick=()=>{if(!state.blob)return;const url=URL.createObjectURL(state.blob),a=document.createElement("a");a.href=url;a.download="midnight-scene-"+((Number($("artScene").value)||0)+1)+(state.blob.type==="image/jpeg"?".jpg":".png");a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)};
const DB="midnight-scene-art-v1";
async function db(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>req.result.createObjectStore("images");
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function saveBlob(id,blob){
 const d=await db();
 return new Promise((resolve,reject)=>{const tx=d.transaction("images","readwrite");tx.objectStore("images").put(blob,id);tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{d.close();reject(tx.error)}})
}
async function getBlob(id){
 const d=await db();
 return new Promise((resolve,reject)=>{const tx=d.transaction("images","readonly"),q=tx.objectStore("images").get(id);q.onsuccess=()=>{d.close();resolve(q.result)};q.onerror=()=>{d.close();reject(q.error)}})
}
async function hydrate(){
 for(const s of scenes){
  if(s.imageData!=="gemini-local")continue;
  try{const blob=await getBlob(s.id);if(!blob)continue;const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{uploaded[s.id]=img;drawAt(elapsed);URL.revokeObjectURL(url)};img.src=url}catch{}
 }
}
$("geminiApprove").onclick=async()=>{
 const s=currentScene();
 if(!s||!state.blob)return status("Select a scene and load artwork first.");
 try{
  await saveBlob(s.id,state.blob);
  const img=new Image(),url=URL.createObjectURL(state.blob);
  img.onload=()=>{uploaded[s.id]=img;URL.revokeObjectURL(url);selected=scenes.indexOf(s);s.imageData="gemini-local";renderList();drawAt(elapsed);save();status("Approved image assigned to scene "+(selected+1)+". Saved locally on this iPhone; back up your artwork separately.")};
  img.onerror=()=>{URL.revokeObjectURL(url);status("Unable to decode the image.")};
  img.src=url;
 }catch(e){status("Failed to save scene art: "+e.message)}
};
$("geminiEndpoint").value=sessionStorage.getItem("midnight-worker-endpoint")||"";
$("geminiEndpoint").addEventListener("change",()=>sessionStorage.setItem("midnight-worker-endpoint",$("geminiEndpoint").value));
$("geminiToken").value=sessionStorage.getItem("midnight-studio-token")||"";
$("geminiToken").addEventListener("change",()=>sessionStorage.setItem("midnight-studio-token",$("geminiToken").value));
switchMode();
hydrate();
})();