/* Midnight Studio v0.6 - guided mobile workspace. Non-destructive layout layer. */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const tabbar=document.querySelector(".tabs");
 const story=$("storyPanel"),scenes=$("scenesPanel"),art=$("artPanel"),bible=$("biblePanel"),finish=$("exportPanel"),viewer=$("viewer");
 if(!tabbar||!story||!art||!bible||!finish||!viewer)return;
 document.body.classList.add("studio-v6");
 const header=tabbar.closest(".panel");
 if(header)header.classList.add("studio-welcome");
 const title=header?.querySelector("h1");
 if(title)title.textContent="Make your next episode";
 const intro=header?.querySelector("h1 + p");
 if(intro)intro.textContent="Write it. Build the shots. Make the art. Export when ready.";
 const saved=$("saved");if(saved)saved.setAttribute("aria-live","polite");
 // Move navigation outside the introductory card, preserving original event listeners.
 tabbar.setAttribute("aria-label","Studio workspace");
 tabbar.setAttribute("role","navigation");
 tabbar.classList.add("studio-dock");
 const ordered=[["story","Create","pencil"],["scenes","Shots","layers"],["art","Images","sparkles"],["bible","Series","book"],["export","Export","upload"]];
 for(const [key,text,icon] of ordered){
  const b=tabbar.querySelector('[data-tab="'+key+'"]');if(!b)continue;
  b.textContent=text;b.setAttribute("aria-label",text+" workspace");b.dataset.icon=icon;
  tabbar.append(b);
 }
 document.body.append(tabbar);
 // Top-level launch actions; real buttons use the app's existing tab navigation.
 const hero=document.createElement("div");hero.className="studio-launch";
 hero.innerHTML='<div class="studio-current"><span class="studio-eyebrow">YOUR PROJECT</span><strong id="uxProjectName">The Safe Room Rules</strong><small id="uxProjectMeta">Continue your episode below</small></div><div class="studio-launch-buttons"><button type="button" id="uxContinue" class="primary">Continue editing</button><button type="button" id="uxImages">Make scene art</button></div>';
 header?.append(hero);
 const openTab=key=>{const b=tabbar.querySelector('[data-tab="'+key+'"]');if(b)b.click()};
 $("uxContinue").onclick=()=>openTab("story");
 $("uxImages").onclick=()=>openTab("art");
 const name=$("title");
 const syncTitle=()=>{
  $("uxProjectName").textContent=name?.value?.trim()||"Untitled episode";
  const n=typeof scenes!=="undefined"?scenes.length:0;
  $("uxProjectMeta").textContent=n+" scene"+(n===1?"":"s")+" in this episode";
 };
 name?.addEventListener("input",syncTitle);syncTitle();
 $("build")?.addEventListener("click",()=>{setTimeout(syncTitle,30)});
 $("addScene")?.addEventListener("click",()=>{setTimeout(syncTitle,30)});
 // Focus story on essential inputs. Keep editable underlying fields intact.
 const storyTitle=story.querySelector("h2");
 if(storyTitle)storyTitle.textContent="1. Plan your episode";
 const extraStory=new Set(["genre","count","character","look","narration"]);
 const advanced=document.createElement("details");advanced.className="studio-details";advanced.innerHTML='<summary>Advanced story settings <span>Optional</span></summary><div class="studio-detail-body"></div>';
 const advBody=advanced.querySelector(".studio-detail-body");
 for(const id of extraStory){const field=$(id);const label=field?.closest("label");if(label)advBody.append(label)}
 const build=$("build");build.textContent="Create scene outline";
 story.insertBefore(advanced,build);
 const smallPrompt=document.createElement("p");smallPrompt.className="studio-step-tip";smallPrompt.textContent="Start with your episode idea. You can refine each shot on the next screen.";
 story.insertBefore(smallPrompt,build);
 const storyNotice=story.querySelector(".notice");
 if(storyNotice){const info=document.createElement("details");info.className="studio-details studio-quiet";info.innerHTML="<summary>How this works</summary>";storyNotice.before(info);info.append(storyNotice)}
 const sample=$("demo");if(sample){sample.textContent="Try sample";sample.classList.add("studio-minor")}
 // Scenes: orient people and remove page-length wall of labels until a scene is opened.
 const scenesHeading=scenes.querySelector("h2");if(scenesHeading)scenesHeading.textContent="2. Build your shots";
 const scenesIntro=scenes.querySelector("p.muted");if(scenesIntro)scenesIntro.textContent="Edit a shot, then tap Create scene art to move it into Gemini.";
 const sceneHelp=document.createElement("div");sceneHelp.className="studio-step-tip";sceneHelp.textContent="Tip: Tap Create scene art on any shot to use its details in Art Lab.";
 scenes.querySelector("#sceneList")?.before(sceneHelp);
 // Art: Gemini Pro as default path. Move relevant choices to top of Gemini controls.
 const heading=art.querySelector("h2");if(heading)heading.textContent="3. Make your scene art";
 const artIntro=art.querySelector("p.muted");if(artIntro)artIntro.textContent="Start with Gemini Pro. Your approved Evan image and continuity notes are ready to use.";
 const modes=$("geminiModes");
 if(modes){
  modes.classList.add("studio-primary-workflow");
  const h=modes.querySelector("h3");if(h)h.textContent="Create with Gemini Pro";
  const intro=modes.querySelector("p.muted");if(intro)intro.textContent="Follow these three steps to keep Evan consistent in every scene.";
  const selector=document.createElement("div");selector.className="studio-scene-pickers";
  modes.insertBefore(selector,modes.querySelector("#geminiPro"));
  for(const id of ["artScene","geminiFormat"]){
   const label=$(id)?.closest("label");if(label)selector.append(label);
  }
  const pro=$("geminiPro");
  if(pro){
   pro.classList.add("studio-pro-steps");
   const original=pro.querySelector("p.muted");if(original)original.textContent="Keep the same approved reference attached for every new scene.";
   const labels=[
    ["geminiCopy","1. Copy scene prompt"],
    ["geminiDownloadRef","2. Save Evan reference"],
    ["geminiOpen","Open Gemini Pro"],
    ["geminiPick","3. Import finished image"]
   ];
   for(const [id,text] of labels){const btn=$(id);if(btn)btn.textContent=text}
  }
  const modeLabel=$("geminiMode")?.closest("label");
  const auto=$("geminiAuto");
  const apiDetails=document.createElement("details");
  apiDetails.className="studio-details studio-api-options";
  apiDetails.innerHTML="<summary>Other generation options <span>API setup</span></summary><div class=\"studio-detail-body\"></div>";
  const body=apiDetails.querySelector(".studio-detail-body");
  if(modeLabel)body.append(modeLabel);
  if(auto)body.append(auto);
  modes.append(apiDetails);
  const modeSelect=$("geminiMode");
  if(modeSelect){
   modeSelect.addEventListener("change",()=>{const h=modes.querySelector("h3");if(h)h.textContent=modeSelect.value==="auto"?"Create with Gemini API":"Create with Gemini Pro"});
  }
 }
 // Reference visible but compact until asked for, with actual status visible.
 const reference=$("artReferenceCard");
 if(reference){
  const details=document.createElement("details");details.className="studio-details studio-reference-details";
  details.innerHTML='<summary>View approved Evan reference <span id="uxRefState">Character lock</span></summary>';
  reference.before(details);details.append(reference);
 }
 // Procedural art stays available as an optional tool.
 const offline=document.createElement("details");offline.className="studio-details studio-offline";
 offline.innerHTML='<summary>Offline cartoon tools <span>Optional</span></summary><div class="studio-detail-body"></div>';
 const offlineBody=offline.querySelector(".studio-detail-body");
 const grid=art.querySelector(".grid2");
 if(grid)offlineBody.append(grid);
 const artLook=$("artLook")?.closest("label");if(artLook)offlineBody.append(artLook);
 for(const id of ["artRender","artDownload","artUse","artPrompt","artCanvas","artStatus","artDemo"]){
  const el=$(id);if(!el)continue;
  const parent=el.parentElement;
  if(parent?.classList.contains("actions")||parent?.classList.contains("previewWrap")){
   if(!offlineBody.contains(parent))offlineBody.append(parent);
  }else offlineBody.append(el);
 }
 art.append(offline);
 // Export: primary button and backup actions separated.
 const eheading=finish.querySelector("h2");if(eheading)eheading.textContent="4. Export and share";
 const exportIntro=finish.querySelector("p.muted");if(exportIntro)exportIntro.textContent="Choose TikTok/Shorts or YouTube and prepare your episode.";
 const backup=document.createElement("details");backup.className="studio-details";
 backup.innerHTML='<summary>Backup and advanced exports <span>Optional</span></summary><div class="studio-detail-body"></div>';
 const backupBody=backup.querySelector(".studio-detail-body");
 for(const id of ["fps","json","prompts","import","importFile","linkImages","linkVideo"]){
  const el=$(id);if(!el)continue;const parent=el.closest("label")||el.closest(".tools");
  // Do not move shared action containers that also contain primary export.
  if(parent&&parent.tagName==="LABEL"){backupBody.append(parent)}
  else if(parent&&parent.classList.contains("tools")){backupBody.append(parent)}
  else{backupBody.append(el)}
 }
 finish.append(backup);
 // Compact scene cards: show the title, duration and quick actions by default.
 const sceneList=$("sceneList");
 if(sceneList){
  let observer;
  const decorate=()=>{
   observer.disconnect();
   for(const card of sceneList.querySelectorAll("article.scene[data-idx]")){
    if(card.querySelector(".ux-shot-details"))continue;
    const head=card.querySelector(".scene-head");
    if(!head)continue;
    const i=Number(card.dataset.idx),scene=typeof scenes!=="undefined"?scenes[i]:null;
    const quick=document.createElement("div");quick.className="ux-shot-quick";
    const info=document.createElement("span");info.className="ux-shot-info";
    info.textContent=(scene?.title||"Scene "+(i+1))+" · "+(scene?.seconds||7)+"s";
    const edit=document.createElement("button");edit.type="button";edit.textContent="Edit shot";edit.className="ux-shot-edit";
    const artBtn=document.createElement("button");artBtn.type="button";artBtn.textContent="Make art";artBtn.className="ux-shot-art";
    quick.append(info,edit,artBtn);head.after(quick);
    const detail=document.createElement("details");detail.className="ux-shot-details";detail.innerHTML="<summary>Shot details</summary>";
    const rest=Array.from(card.children).filter(el=>el!==head&&el!==quick);
    rest.forEach(el=>detail.append(el));card.append(detail);
    detail.open=card.classList.contains("sel");
    edit.onclick=()=>{detail.open=!detail.open;edit.textContent=detail.open?"Close details":"Edit shot"};
    artBtn.onclick=()=>{const target=detail.querySelector('[data-act="make-art"]');target?.click()};
    detail.addEventListener("toggle",()=>{edit.textContent=detail.open?"Close details":"Edit shot"});
    edit.textContent=detail.open?"Close details":"Edit shot";
   }
   observer.observe(sceneList,{childList:true});
  };
  observer=new MutationObserver(decorate);
  observer.observe(sceneList,{childList:true});
  decorate();
 }
 // The always-on preview is useful on Story and Shots, clutter elsewhere.
 const originalShow=window.showTab;
 function syncSection(key){
  viewer.classList.toggle("hidden",!["story","scenes"].includes(key));
  header?.classList.toggle("studio-welcome-compact",key!=="story");
  const welcomeActions=header?.querySelector(".studio-launch");
  if(welcomeActions)welcomeActions.classList.toggle("hidden",key!=="story");
  if(key==="scenes"||key==="story")syncTitle();
  document.querySelectorAll(".studio-dock [data-tab]").forEach(b=>{
   const selected=b.dataset.tab===key;b.classList.toggle("active",selected);b.setAttribute("aria-current",selected?"page":"false");
  });
  window.scrollTo({top:0,behavior:"instant"});
 }
 if(typeof originalShow==="function"){
  window.showTab=function(key){originalShow(key);syncSection(key)};
 }
 for(const b of tabbar.querySelectorAll("button[data-tab]"))b.addEventListener("click",()=>syncSection(b.dataset.tab));
 syncSection("story");
 // Safeguard: do not modify any localStorage or IndexedDB projects here.
})();