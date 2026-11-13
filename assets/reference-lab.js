/* Midnight Studio v0.7: Reference Lab and original Episode Creator.
   Source links are never fetched by this static website. Users supply observations or
   paste an analysis from Gemini. Local idea suggestions are templates, not video analysis. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const bar=document.querySelector(".studio-dock");
const main=document.querySelector("main.wrap");
if(!bar||!main)return;
const KEY="midnight-reference-lab-v1";
const BASE={url:"",notes:"",hook:"",pacing:"",visuals:"",format:"short",ideas:[],selected:0};
let state;
try{state={...BASE,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{state={...BASE}}
const tab=document.createElement("button");
tab.type="button";tab.dataset.tab="reference";tab.textContent="Ideas";tab.setAttribute("aria-label","Reference Lab and episode ideas");
tab.dataset.icon="sparkles";bar.insertBefore(tab,bar.querySelector('[data-tab="story"]'));
const panel=document.createElement("section");panel.id="referencePanel";panel.className="panel wide hidden";
panel.innerHTML=`
<div class="headerline"><div><h2>Reference Lab</h2><p class="muted">Find a technique you like. Turn it into an original episode.</p></div><span class="badge">V0.7</span></div>
<div class="rl-stage"><span class="rl-stage-num">01</span><div><strong>Start with a video</strong><p class="muted">YouTube and TikTok links supported for organizing references.</p></div></div>
<label>Reference video link<input id="rlUrl" type="url" inputmode="url" placeholder="https://youtube.com/... or https://tiktok.com/..." autocapitalize="off" autocomplete="off"></label>
<div class="actions"><button type="button" id="rlOpen">Watch reference</button><button type="button" id="rlCopyAnalysis">Copy analysis request for Gemini</button></div>
<p class="studio-step-tip">Midnight Studio cannot watch or analyze a video from its URL alone. Use Gemini to analyze a supported video link, or watch it yourself. Paste the observations below. TikTok may require uploading the video file in Gemini.</p>
<div class="rl-stage"><span class="rl-stage-num">02</span><div><strong>What makes it work?</strong><p class="muted">A few notes are enough. Do not copy characters, dialogue, or the original story.</p></div></div>
<label>Your notes or Gemini breakdown<textarea id="rlNotes" rows="4" placeholder="What catches your attention? What happens in the video? Describe the hook, editing and visual style."></textarea></label>
<details class="studio-details"><summary>More specific breakdown <span>Optional</span></summary><div class="studio-detail-body">
<label>Opening hook<input id="rlHook" placeholder="Example: warning appears in the first 2 seconds"></label>
<label>Pacing and transitions<input id="rlPacing" placeholder="Example: short cuts, sudden reveal"></label>
<label>Camera and visual techniques<input id="rlVisuals" placeholder="Example: slow push-in, eerie purple light"></label></div></details>
<div class="rl-stage"><span class="rl-stage-num">03</span><div><strong>Make it original</strong><p class="muted">Choose a direction for The Safe Room Rules or start a fresh story.</p></div></div>
<label>Video format<select id="rlFormat"><option value="short">TikTok / YouTube Shorts (9:16)</option><option value="long">YouTube episode (16:9)</option></select></label>
<button type="button" class="primary" id="rlGenerate">Generate 3 original concepts</button>
<p id="rlStatus" class="hint" role="status" aria-live="polite">Your link and notes save on this device.</p>
<div id="rlIdeas" class="rl-ideas"></div>
`;
main.insertBefore(panel,$("storyPanel"));
const fields={rlUrl:"url",rlNotes:"notes",rlHook:"hook",rlPacing:"pacing",rlVisuals:"visuals",rlFormat:"format"};
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{$("rlStatus").textContent="Storage is full. Copy your concept to back it up."}}
for(const [id,key] of Object.entries(fields)){
 $(id).value=state[key]||"";
 $(id).addEventListener("input",()=>{state[key]=$(id).value;persist()});
 $(id).addEventListener("change",()=>{state[key]=$(id).value;persist()});
}
function safeURL(){
 try{const u=new URL($("rlUrl").value.trim());if(u.protocol!=="https:")return null;
 const host=u.hostname.toLowerCase();
 if(!["youtube.com","www.youtube.com","m.youtube.com","youtu.be","www.youtu.be","tiktok.com","www.tiktok.com","vm.tiktok.com","vt.tiktok.com","m.tiktok.com"].includes(host))return null;
 return u.href;
 }catch{return null}
}
$("rlOpen").onclick=()=>{const url=safeURL();if(!url)return $("rlStatus").textContent="Paste a valid YouTube or TikTok HTTPS link first.";window.open(url,"_blank","noopener,noreferrer")};
function analysisPrompt(){
 const u=safeURL();if(!u)throw Error("Paste a valid YouTube or TikTok video link first.");
 return `Analyze the following video, if the video content is actually accessible to you: ${u}

I am producing an ORIGINAL animated horror series called The Safe Room Rules, featuring recurring protagonist Evan. Please do not rewrite, reproduce, or copy this video's dialogue, plot, characters, distinctive scenes, or visual assets.

Identify only transferable high-level techniques:
1. Opening hook and why it holds attention
2. Pacing, cuts and scene duration
3. Shot types, framing, lighting and camera language
4. Sound and tension progression
5. Broad narrative structure and reveal placement

Return concise labeled observations I can paste into Midnight Studio's Reference Lab. Distinguish what you actually observed from anything inferred from the title or description. If the linked video is inaccessible, tell me directly and ask me to upload it. Do not invent details.`;
}
$("rlCopyAnalysis").onclick=async()=>{
 try{const p=analysisPrompt();try{await navigator.clipboard.writeText(p);$("rlStatus").textContent="Analysis request copied. Paste it in Gemini, then return with the breakdown."}catch{window.prompt("Copy to Gemini:",p)}}catch(e){$("rlStatus").textContent=e.message}
};
const formats={short:{count:8,tag:"Short-form",length:"45–75 seconds"},long:{count:12,tag:"YouTube",length:"Long-form episode outline"}};
function concepts(){
 const notes=$("rlNotes").value.trim();
 const hook=$("rlHook").value.trim()||"immediate unease";
 const pacing=$("rlPacing").value.trim()||"escalating reveals";
 const visuals=$("rlVisuals").value.trim()||"dramatic shadow and close-ups";
 const generic=!notes&&!$("rlHook").value.trim()&&!$("rlPacing").value.trim()&&!$("rlVisuals").value.trim();
 if(generic){$("rlStatus").textContent="Add what you noticed in the reference first. I won't pretend to have watched the video.";return null}
 const technique=[hook,pacing,visuals].filter(Boolean).join("; ");
 const shared={technique,notes,format:$("rlFormat").value};
 return [
  {...shared,title:"The Door That Knows Your Name",category:"Psychological mystery",hook:"Evan finds a bunker door displaying a warning written for him tomorrow.",premise:"Inside the safe room, a new door appears with Evan's name and a date that hasn't happened yet. Each attempt to avoid the warning causes the door to move closer. Evan must decide whether the message is a trap or a future memory.",twist:"The door opens only when he stops obeying a rule he never remembers reading.",difference:"Original central mystery built around shifting bunker rules, not the reference's characters or storyline."},
  {...shared,title:"Rule Eight Was Never Written",category:"Survival thriller",hook:"A warning interrupts Evan as he counts the seven rules.",premise:"One rule has vanished from the bunker wall, but the security recording shows Evan reciting eight rules yesterday. Strange evidence suggests someone has been editing the instructions while he sleeps.",twist:"Evan discovers that the missing rule was addressed to the person watching the camera.",difference:"Distinct rules-based mystery grounded in established Safe Room lore."},
  {...shared,title:"The Camera Shows an Empty Room",category:"Analog suspense",hook:"The security monitor shows an empty room while Evan hears footsteps inside it.",premise:"Evan tests a camera that shows no people, only the consequences of their next decisions. As the footage shifts, he must prevent something that the camera refuses to reveal.",twist:"When the feed finally shows a person, Evan recognizes an impossible version of himself.",difference:"Independent surveillance premise with an original reveal and new visual beats."}
 ];
}
function makeText(c){
 return `ORIGINAL CONCEPT: ${c.title}\nGenre: ${c.category}\nHook: ${c.hook}\nPremise: ${c.premise}\nReveal: ${c.twist}\nReference techniques to consider: ${c.technique}\nOriginality: ${c.difference}\nReference observations: ${c.notes||"User supplied technique fields."}`;
}
function render(){
 const root=$("rlIdeas");root.replaceChildren();
 state.ideas.forEach((c,i)=>{
  const card=document.createElement("article");card.className="scene rl-idea";
  const eyebrow=document.createElement("span");eyebrow.className="num";eyebrow.textContent="CONCEPT "+String(i+1).padStart(2,"0")+" · "+c.category;
  const heading=document.createElement("h3");heading.textContent=c.title;
  const hook=document.createElement("p");hook.className="rl-hook";hook.textContent=c.hook;
  const desc=document.createElement("p");desc.className="muted";desc.textContent=c.premise;
  const reveal=document.createElement("p");reveal.className="rl-twist";reveal.textContent="Original reveal: "+c.twist;
  const actions=document.createElement("div");actions.className="actions";
  const build=document.createElement("button");build.type="button";build.className="primary";build.textContent="Build episode";
  const copy=document.createElement("button");copy.type="button";copy.textContent="Copy concept";
  build.onclick=()=>buildEpisode(c);
  copy.onclick=async()=>{const t=makeText(c);try{await navigator.clipboard.writeText(t);$("rlStatus").textContent="Concept copied."}catch{window.prompt("Copy concept:",t)}};
  actions.append(build,copy);
  card.append(eyebrow,heading,hook,desc,reveal,actions);root.append(card);
 });
}
$("rlGenerate").onclick=()=>{
 const ideas=concepts();if(!ideas)return;
 state.ideas=ideas;persist();render();
 $("rlStatus").textContent="Three ORIGINAL concept templates created from your notes. This is not automatic video analysis or AI generation.";
 $("rlIdeas").scrollIntoView({behavior:"smooth",block:"start"});
};
function buildEpisode(c){
 const existingTitle=$("title").value.trim();
 if(!confirm("Replace the current episode outline with '"+c.title+"'? Export your current project first if you want to keep it."))return;
 const format=c.format||"short",config=formats[format]||formats.short;
 $("title").value=c.title;
 $("premise").value=c.premise+" Opening: "+c.hook+" Ending reveal: "+c.twist+". Inspired only by broad editing techniques: "+c.technique+". Keep the established series canon; do not invent past episode events.";
 $("genre").value="horror";
 $("count").value=String(config.count);
 $("character").value="Evan";
 $("look").value="Short fade haircut, full beard, charcoal hoodie; approved model from Series Bible";
 $("narration").value="cinematic";
 $("ratio").value=format==="long"?"16:9":"9:16";
 if($("geminiFormat"))$("geminiFormat").value=$("ratio").value;
 // Let the existing local generator assemble the editable scene outline.
 $("build").click();
 const btn=bar.querySelector('[data-tab="scenes"]');if(btn)btn.click();
 // Existing builder creates a template. User can edit all shots, narration and timing.
}
render();
const prev=window.showTab;
window.showTab=function(key){
 if(key==="reference"){
  prev("story");
  for(const id of ["storyPanel","scenesPanel","artPanel","exportPanel","biblePanel","viewer"])$(id)?.classList.add("hidden");
  panel.classList.remove("hidden");
  document.querySelectorAll(".studio-dock [data-tab]").forEach(b=>{const chosen=b.dataset.tab==="reference";b.classList.toggle("active",chosen);b.setAttribute("aria-current",chosen?"page":"false")});
  document.querySelector(".studio-welcome")?.classList.add("studio-welcome-compact");
  const launch=document.querySelector(".studio-launch");if(launch)launch.classList.add("hidden");
  window.scrollTo({top:0,behavior:"instant"});
  return;
 }
 panel.classList.add("hidden");
 prev(key);
};
tab.onclick=()=>window.showTab("reference");
})();