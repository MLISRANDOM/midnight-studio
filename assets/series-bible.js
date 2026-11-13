/* Midnight Studio Series Bible v0.4: local continuity tools (no cloud AI service). */
(()=>{
"use strict";
const $=id=>document.getElementById(id), KEY="midnight-studio-series-bible-v1";
const DEFAULT={series:"The Safe Room Rules",character:"Evan",appearance:"Adult man, short fade haircut, full beard, charcoal hoodie. Simplified 2D flat-color cartoon, bold clean black outlines.",style:"Thick outlines, flat muted colors, atmospheric horror lighting. Preserve character silhouette, face and outfit.",rules:"The emergency bunker has seven rules. Each night, one rule changes.",locations:"Emergency bunker beneath Evan's apartment.",events:"",threads:"Why do the rules change each night?",episodes:[]};
let bible;try{bible={...DEFAULT,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{bible={...DEFAULT}}
const header=document.querySelector(".tabs");
const tab=document.createElement("button");tab.type="button";tab.dataset.tab="bible";tab.textContent="Series Bible";header.appendChild(tab);
const panel=document.createElement("section");panel.className="panel wide hidden";panel.id="biblePanel";
panel.innerHTML=`<div class="headerline"><div><h2>Series Bible <span class="num">CHARACTER + CANON LOCK</span></h2><p class="muted">Save your approved character design and established story facts across episodes on this iPhone.</p></div><span class="badge">LOCAL MEMORY</span></div>
<label>Series name<input id="bSeries" maxlength="120"></label>
<label>Main character<input id="bCharacter" maxlength="100"></label>
<label>Approved character appearance<textarea id="bAppearance" rows="3"></textarea></label>
<label>Locked visual style<textarea id="bStyle" rows="3"></textarea></label>
<label>Established rules / canon<textarea id="bRules" rows="4"></textarea></label>
<label>Recurring places<textarea id="bLocations" rows="3"></textarea></label>
<label>Events already established<textarea id="bEvents" rows="4"></textarea></label>
<label>Open mysteries / continuity threads<textarea id="bThreads" rows="3"></textarea></label>
<div class="headerline"><h3>Approved character reference</h3><span class="hint">Saved only in this browser</span></div>
<input id="bRef" type="file" accept="image/png,image/jpeg,image/webp">
<div class="scene-preview"><img id="bRefPreview" alt="Approved character reference" class="asset hidden" style="max-width:170px;max-height:220px"><div><small id="bRefStatus">No reference image selected.</small><div class="actions"><button type="button" id="bDownloadRef">Download reference</button><button type="button" id="bRemoveRef">Remove image</button></div></div></div>
<div class="headerline"><h3>Episode ledger</h3><small id="bEpisodeCount"></small></div>
<p class="muted">Record what happened after finishing each episode, so future scripts do not contradict earlier events.</p>
<label>Episode title<input id="bEpisodeTitle" maxlength="120" placeholder="Episode 1: The Warning"></label>
<label>What happened and what changed<textarea id="bEpisodeSummary" rows="3" placeholder="Only record events actually established in the episode."></textarea></label>
<div class="actions"><button type="button" id="bAddEpisode" class="primary">Save episode to canon</button><button type="button" id="bCopyPrompt">Copy continuity prompt</button></div>
<div id="bEpisodeList" class="sceneList"></div>
<div class="actions"><button type="button" id="bDownload">Backup series bible JSON</button><button type="button" id="bImport">Restore bible JSON</button><input class="file" id="bImportFile" type="file" accept=".json,application/json"></div>
<div class="notice" id="bStatus">Local series memory is active. Reference images are saved in browser storage and are not included in JSON backups; separately save your source image in Files or Google Drive.</div>`;
document.querySelector("main.wrap").insertBefore(panel,document.getElementById("storyPanel"));
const fields={bSeries:"series",bCharacter:"character",bAppearance:"appearance",bStyle:"style",bRules:"rules",bLocations:"locations",bEvents:"events",bThreads:"threads"};
function persist(){try{localStorage.setItem(KEY,JSON.stringify(bible));$("bStatus").textContent="Series Bible saved on this iPhone. Back up the JSON regularly."}catch{$("bStatus").textContent="Local storage is full or blocked. Download a backup now."}}
for(const [id,key] of Object.entries(fields)){$(id).value=bible[key]||"";$(id).addEventListener("input",()=>{bible[key]=$(id).value;persist()})}
function renderEpisodes(){
 $("bEpisodeCount").textContent=bible.episodes.length+" saved";
 $("bEpisodeList").replaceChildren();
 bible.episodes.forEach((entry,i)=>{
  const article=document.createElement("article");article.className="scene";
  const title=document.createElement("strong");title.textContent=(i+1)+". "+entry.title;
  const summary=document.createElement("p");summary.className="muted";summary.textContent=entry.summary;
  const remove=document.createElement("button");remove.textContent="Remove record";remove.type="button";remove.onclick=()=>{if(confirm("Remove this episode record?")){bible.episodes.splice(i,1);persist();renderEpisodes()}};
  article.append(title,summary,remove);$("bEpisodeList").append(article);
 })
}
$("bAddEpisode").onclick=()=>{
 const title=$("bEpisodeTitle").value.trim(),summary=$("bEpisodeSummary").value.trim();
 if(!title||!summary)return $("bStatus").textContent="Add an episode title and summary first.";
 bible.episodes.push({title,summary});$("bEpisodeTitle").value="";$("bEpisodeSummary").value="";persist();renderEpisodes();
};
function continuityPrompt(){
 return [
  "MIDNIGHT STUDIO SERIES CONTINUITY. Treat these user-approved facts as canon, do not contradict them.",
  "SERIES: "+bible.series,
  "CHARACTER: "+bible.character,
  "LOCKED APPEARANCE: "+bible.appearance,
  "VISUAL STYLE: "+bible.style,
  "CANON RULES: "+bible.rules,
  "RECURRING LOCATIONS: "+bible.locations,
  "ESTABLISHED EVENTS: "+bible.events,
  "UNRESOLVED THREADS: "+bible.threads,
  "PREVIOUS EPISODES:\n"+bible.episodes.map((e,i)=>(i+1)+". "+e.title+": "+e.summary).join("\n"),
  "For all new scenes, keep continuity. If a proposed plot conflicts with canon, flag the conflict before writing. Approved reference imagery must be supplied separately with image-generation requests."
 ].join("\n\n")
}
$("bCopyPrompt").onclick=async()=>{const p=continuityPrompt();try{await navigator.clipboard.writeText(p);$("bStatus").textContent="Continuity prompt copied. Include the approved image when generating artwork."}catch{window.prompt("Copy:",p)}};
$("bDownload").onclick=()=>{
 const blob=new Blob([JSON.stringify({...bible,version:1},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="midnight-series-bible.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
};
$("bImport").onclick=()=>$("bImportFile").click();
$("bImportFile").onchange=async e=>{
 try{const file=e.target.files?.[0];if(!file)return;const parsed=JSON.parse(await file.text());if(typeof parsed.series!=="string"||!Array.isArray(parsed.episodes))throw Error("Not a Series Bible backup");if(!confirm("Replace existing Series Bible text and episode ledger?"))return;bible={...DEFAULT,...parsed};for(const [id,key] of Object.entries(fields))$(id).value=bible[key]||"";persist();renderEpisodes()}catch(err){$("bStatus").textContent="Restore failed: "+err.message}finally{e.target.value=""}
};
const DB="midnight-studio-reference-v1",STORE="assets";
function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function asset(action,data){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,action==="get"?"readonly":"readwrite"),store=tx.objectStore(STORE),req=action==="put"?store.put(data,"evan-approved"):action==="delete"?store.delete("evan-approved"):store.get("evan-approved");req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>d.close()})}
let currentUrl=null;
function preview(blob){if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=blob?URL.createObjectURL(blob):null;$("bRefPreview").classList.toggle("hidden",!blob);if(blob)$("bRefPreview").src=currentUrl;else $("bRefPreview").removeAttribute("src");$("bRefStatus").textContent=blob?"Approved reference saved locally ("+Math.round(blob.size/1024)+" KB).":"No reference image selected."}
$("bRef").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>6*1024*1024){$("bRefStatus").textContent="Use a PNG/JPG/WebP reference below 6 MB.";return}
 try{await asset("put",file);preview(file);updateArtReference()}catch{$("bRefStatus").textContent="Unable to save reference locally. Keep original in Files."}finally{e.target.value=""}
};
$("bDownloadRef").onclick=async()=>{try{const img=await asset("get");if(!img){$("bRefStatus").textContent="Upload Evan's approved image first.";return}const url=URL.createObjectURL(img),a=document.createElement("a");a.href=url;a.download="evan-approved-reference."+(img.type==="image/png"?"png":img.type==="image/webp"?"webp":"jpg");a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch{$("bRefStatus").textContent="Reference download unavailable. Keep your original saved in Files."}};
$("bRemoveRef").onclick=async()=>{if(!confirm("Delete locally stored character reference?"))return;try{await asset("delete");preview(null)}catch{$("bRefStatus").textContent="Cannot remove image from storage."}};
asset("get").then(blob=>preview(blob||null)).catch(()=>$("bRefStatus").textContent="Image storage unavailable in this browser.");
/* Art Lab approved-character reference viewer. This is a reference, not generated scene art. */
const artPanel=document.getElementById("artPanel");
const referenceCard=document.createElement("div");
referenceCard.className="scene";
referenceCard.id="artReferenceCard";
referenceCard.innerHTML='<div class="headerline"><h3>Approved Evan reference</h3><span class="badge" id="artRefBadge">CHECKING</span></div><p class="muted" id="artRefNote">Checking your Series Bible for the approved image.</p><img id="artReferenceImage" class="hidden" alt="Approved character design from Series Bible" style="display:block;max-height:300px;max-width:100%;object-fit:contain;border-radius:12px;border:1px solid #354965"><div class="actions"><button type="button" id="artReferenceDownload">Download approved reference</button><button type="button" id="artOpenBible">Open Series Bible</button></div><p class="hint">The built-in cartoon frame below is a procedural placeholder. It will not automatically look like Evan. True image consistency requires Gemini generation using this reference image.</p>';
const artDescription=artPanel.querySelector("p");
artDescription.insertAdjacentElement("afterend",referenceCard);
let artRefUrl=null;
async function updateArtReference(){
 try{
  const blob=await asset("get");
  if(artRefUrl){URL.revokeObjectURL(artRefUrl);artRefUrl=null}
  const img=document.getElementById("artReferenceImage");
  img.classList.toggle("hidden",!blob);
  if(blob){
   artRefUrl=URL.createObjectURL(blob);img.src=artRefUrl;
   document.getElementById("artRefBadge").textContent="REFERENCE SAVED";
   document.getElementById("artRefNote").textContent="This is Evan's approved design from your Series Bible. Use the same image for every Gemini image-generation request.";
  }else{
   img.removeAttribute("src");
   document.getElementById("artRefBadge").textContent="NO REFERENCE";
   document.getElementById("artRefNote").textContent="Upload Evan's approved character sheet in Series Bible first.";
  }
 }catch{
  document.getElementById("artRefBadge").textContent="UNAVAILABLE";
  document.getElementById("artRefNote").textContent="Could not access local reference storage in this browser.";
 }
}
document.getElementById("artOpenBible").onclick=()=>window.showTab("bible");
document.getElementById("artReferenceDownload").onclick=()=>document.getElementById("bDownloadRef").click();
renderEpisodes();
const prior=window.showTab;
window.showTab=function(name){
 if(name==="bible"){for(const b of document.querySelectorAll("[data-tab]"))b.classList.toggle("active",b.dataset.tab==="bible");for(const id of ["storyPanel","scenesPanel","artPanel","exportPanel"])$(id).classList.add("hidden");$("biblePanel").classList.remove("hidden");return}
 $("biblePanel").classList.add("hidden");prior(name);if(name==="art")updateArtReference()
};
tab.addEventListener("click",()=>window.showTab("bible"));
})();