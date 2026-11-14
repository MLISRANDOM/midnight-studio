/* Midnight Studio v1.0: target-length story planner.
 * Saves a multi-part production plan locally and builds manageable chapters.
 * This is structured storyboard planning, not AI-written screenplay generation.
 */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
if(!$("epLength")||!window.midnightStudioArt)return;
const KEY="midnight-studio-story-length-v1";
const DURATIONS=new Set([30,60,180,300,600,900,1800,3600]);
let plan;
try{const v=JSON.parse(localStorage.getItem(KEY)||"null");if(v&&Array.isArray(v.parts))plan=v}catch{}
const label=n=>n>=60?Math.round(n/60)+" min":n+" sec";
const durations=n=>{const out=[];while(n>0){const v=Math.min(180,n);out.push(v);n-=v}return out};
const store=()=>{if(!plan)return;try{localStorage.setItem(KEY,JSON.stringify(plan))}catch(e){$("epLengthHint").textContent="Local storage full. Export the project to preserve your work."}};
function describe(){
 const secs=Number($("epLength").value),parts=durations(secs);
 const message=parts.length===1?
 "Target: "+label(secs)+", with a complete scene-art storyboard.":
 "Target: "+label(secs)+" split into "+parts.length+" parts (up to 3 minutes each). Generate one part at a time, then continue the story. Long productions use many free AI requests.";
 $("epLengthHint").textContent=message+" This produces a motion comic, not fully animated footage.";
 $("epStart").textContent=$("epMode").value==="standalone"?"Create my full story":"Create my episode";
}
function picker(){
 const wrap=$("epParts"),select=$("epPartPicker");select.replaceChildren();
 if(!plan){wrap.classList.add("hidden");return}
 wrap.classList.remove("hidden");
 plan.parts.forEach((part,i)=>{
  const option=document.createElement("option");option.value=String(i);
  const done=part.scenes?.filter(s=>s.imageData==="gemini-local").length||0;
  option.textContent="Part "+(i+1)+"/"+plan.parts.length+" · "+label(part.seconds)+(part.scenes?" · "+done+"/"+part.scenes.length+" images":"");
  select.append(option);
 });
 select.value=String(plan.active||0);
}
function snapshot(){
 if(!plan)return;
 const part=plan.parts[plan.active];if(!part)return;
 part.scenes=scenes.map(s=>({...s,imageData:s.imageData==="gemini-local"?"gemini-local":""}));
 part.title=$("title").value;
 store();picker();
}
function planChapter(index){
 const part=plan.parts[index];if(!part)throw Error("Chapter does not exist");
 plan.active=index;
 const count=part.seconds<=60?6:12;
 $("count").value=String(count);
 $("ratio").value=plan.format==="short"?"9:16":"16:9";
 $("fluxFormat").value=$("ratio").value;$("geminiFormat").value=$("ratio").value;
 $("title").value=plan.title+(plan.parts.length>1?" · Part "+(index+1):"");
 const isLast=index===plan.parts.length-1;
 const arc=plan.mode==="standalone"?
 (index===0?"Introduce the main conflict, protagonist and stakes":
 isLast?"Deliver climax, solution and a conclusive ending":
 index<plan.parts.length/2?"Develop the mystery, consequences and rising action":
 "Increase pressure and lead toward the final confrontation"):
 (index===0?"Set up a new chapter in the ongoing series":
 isLast?"Pay off this episode and leave one meaningful future thread":
 "Expand the established conflict and carry forward the consequences");
 $("premise").value=plan.idea+". PART "+(index+1)+"/"+plan.parts.length+". STORY ARC: "+arc+". Maintain previously established character and world canon.";
 generate();
 const base=Math.floor(part.seconds/count),rest=part.seconds%count;
 scenes.forEach((scene,i)=>{
  scene.seconds=Math.min(30,Math.max(2,base+(i<rest?1:0)));
  scene.description="Part "+(index+1)+" of "+plan.parts.length+". "+arc+". "+scene.description;
  scene.narration=scene.narration+" This scene advances the "+(plan.mode==="standalone"?"complete story":"series episode")+" toward its "+(plan.mode==="standalone"?"ending":"cliffhanger")+".";
 });
 update();
 snapshot();
 $("epFinished")?.classList.add("hidden");
 $("epWork")?.classList.add("hidden");
}
function prepare(){
 const idea=$("epIdea").value.trim(),seconds=Number($("epLength").value);
 if(idea.length<15)throw Error("Describe the episode or full story in at least one sentence.");
 if(!DURATIONS.has(seconds))throw Error("Select one of the available lengths.");
 if(scenes.length||plan){
  if(!confirm("This will replace the active storyboard and production plan. Existing work is NOT backed up automatically. Export important projects first. Continue?"))return false;
 }
 const parts=durations(seconds);
 plan={idea,mode:$("epMode").value,format:$("epFormat").value,total:seconds,created:new Date().toISOString(),title:($("title").value||"The Safe Room Rules").replace(/ · Part \d+$/,""),active:0,parts:parts.map(s=>({seconds:s,scenes:null}))};
 planChapter(0);picker();describe();
 return true;
}
async function load(index){
 if(!plan||!plan.parts[index])return;
 snapshot();
 const part=plan.parts[index];
 if(!part.scenes){planChapter(index);return}
 plan.active=index;
 updateFields({title:part.title||plan.title,premise:plan.idea,genre:"horror",character:"Evan",look:"Short fade, full beard, charcoal hoodie",narration:"cinematic",scenes:part.scenes});
 $("epMode").value=plan.mode;
 $("epLength").value=String(plan.total);
 $("epFormat").value=plan.format;
 $("ratio").value=plan.format==="short"?"9:16":"16:9";
 $("fluxFormat").value=$("ratio").value;
 await window.midnightStudioArt.hydrate();
 store();picker();describe();
 $("epWork").classList.remove("hidden");
 $("epResume").classList.remove("hidden");
 $("epFinished").classList.add("hidden");
 $("epWorkStatus").textContent="Loaded part "+(index+1)+". Review the scenes or choose Resume missing scenes.";
}
$("epOpenPart").onclick=()=>load(Number($("epPartPicker").value));
$("epNextPart").onclick=()=>{
 if(!plan)return;
 const next=plan.active+1;
 if(next>=plan.parts.length){$("epLengthHint").textContent="You are on the final part of this story.";return}
 load(next);
};
for(const id of ["epMode","epLength","epFormat"])$(id).addEventListener("change",describe);
if(plan){
 $("epIdea").value=plan.idea;
 $("epMode").value=plan.mode;
 $("epLength").value=String(plan.total);
 $("epFormat").value=plan.format;
 picker();
}
describe();
window.midnightStoryLength={prepare,snapshot};
})();