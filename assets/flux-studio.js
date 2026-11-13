/* Cloudflare FLUX Image Generator: free-tier capable, requires deployed private Worker. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const host=$("geminiModes"),api=window.midnightStudioArt;
if(!host||!api)return;
const wrap=document.createElement("section");
wrap.id="fluxStudio";
wrap.className="scene flux-workflow";
wrap.innerHTML=`<div class="headerline"><h3>Free AI image generator</h3><span class="badge">FLUX · CLOUDFARE</span></div>
<p class="muted">Generate real artwork for the selected scene using Cloudflare's free Workers AI allowance. FLUX.2 Klein can use Evan's approved reference image.</p>
<div class="grid2"><label>Image quality<select id="fluxModel"><option value="klein">Character consistent · FLUX.2 Klein</option><option value="draft">Fast draft · FLUX.1 Schnell</option></select></label>
<label>Format<select id="fluxFormat"><option value="9:16">TikTok / Shorts (9:16)</option><option value="16:9">YouTube (16:9)</option></select></label></div>
<div class="actions"><button id="fluxGenerate" class="primary" type="button">Generate scene image</button></div>
<p id="fluxStatus" class="hint" role="status" aria-live="polite">Connect your Cloudflare Worker once to enable generation.</p>
<details class="studio-details" id="fluxSetup"><summary>Connect free image generator <span>One-time setup</span></summary>
<div class="studio-detail-body">
<label>Cloudflare Worker URL<input type="url" id="fluxUrl" autocapitalize="off" autocomplete="off" placeholder="https://midnight-studio-ai.example.workers.dev"></label>
<label>Private studio token<input type="password" id="fluxToken" autocomplete="off" placeholder="Your Worker access token"></label>
<p class="hint">Create a Cloudflare secret named STUDIO_ACCESS_TOKEN first, using a long random value. Enter the same token here. Never put it in GitHub. Token is stored only in this browser tab's session.</p>
</div></details>`;
host.before(wrap);
const settings=()=>{try{sessionStorage.setItem("midnight-flux-worker", $("fluxUrl").value.trim());sessionStorage.setItem("midnight-flux-token",$("fluxToken").value)}catch{}};
$("fluxUrl").value=sessionStorage.getItem("midnight-flux-worker")||"https://midnight-studio-ai.montel2093.workers.dev";
$("fluxToken").value=sessionStorage.getItem("midnight-flux-token")||"";
$("fluxUrl").onchange=settings;$("fluxToken").onchange=settings;
$("fluxFormat").value=$("geminiFormat").value||"9:16";
$("fluxFormat").onchange=()=>{$("geminiFormat").value=$("fluxFormat").value;const ratio=$("ratio");if(ratio)ratio.value=$("fluxFormat").value};
function message(s){$("fluxStatus").textContent=s}
const b64=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=()=>reject(Error("Could not read reference image"));r.readAsDataURL(blob)});
async function shrink(blob){
 const bitmap=await createImageBitmap(blob);
 try{
  const longest=Math.max(bitmap.width,bitmap.height);
  const factor=Math.min(1,480/longest);
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(bitmap.width*factor));
  c.height=Math.max(1,Math.round(bitmap.height*factor));
  c.getContext("2d").drawImage(bitmap,0,0,c.width,c.height);
  const output=await new Promise(resolve=>c.toBlob(resolve,"image/jpeg",.8));
  if(!output)throw Error("Could not prepare Evan's reference");
  return output;
 }finally{bitmap.close()}
}
let busy=false;
$("fluxGenerate").onclick=async()=>{
 if(busy)return;
 const url=$("fluxUrl").value.trim().replace(/\/$/,""),token=$("fluxToken").value.trim(),model=$("fluxModel").value;
 if(!/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(url)){message("Enter a valid HTTPS Worker URL in setup.");$("fluxSetup").open=true;return}
 if(!token){message("Add the private studio token in setup before generating.");$("fluxSetup").open=true;return}
 try{
  busy=true;$("fluxGenerate").disabled=true;$("fluxGenerate").textContent="Generating image…";
  message("Preparing selected shot and Evan's approved character reference…");
  let referenceImage;
  if(model==="klein"){
   const ref=await api.getReference();
   if(!ref)throw Error("Upload Evan's approved reference to Series Bible first.");
   const prepared=await shrink(ref);
   referenceImage={mimeType:prepared.type,data:await b64(prepared)};
  }
  const prompt=api.prompt();
  message("Generating with "+(model==="klein"?"FLUX.2 Klein":"FLUX.1 Schnell")+" through Cloudflare…");
  const resp=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-studio-token":token},body:JSON.stringify({prompt,aspectRatio:$("fluxFormat").value,model,referenceImage})});
  let result;
  try{result=await resp.json()}catch{throw Error("Worker returned an invalid response. Verify the Worker has been deployed.")}
  if(!resp.ok||!result.ok||!result.data)throw Error(result.error||"Cloudflare image generation failed");
  const decoded=atob(result.data),bytes=new Uint8Array(decoded.length);
  for(let i=0;i<bytes.length;i++)bytes[i]=decoded.charCodeAt(i);
  api.showImage(new Blob([bytes],{type:result.mimeType||"image/png"}));
  message("Image ready. Review it below, then tap Use image in selected scene.");
  $("geminiOutput")?.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){message("Could not generate: "+String(err?.message||err))}
 finally{busy=false;$("fluxGenerate").disabled=false;$("fluxGenerate").textContent="Generate scene image"}
};
})();