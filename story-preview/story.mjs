// Descriptions of movements the current rig can perform. These are compared to
// the writer's words by a sentence encoder. No reference dialogue enters it.
export const repertoire = {
  listen: ["Listen closely to a distant sound.", "He hears a faint knock and strains his ears."],
  signal: ["Wave to get someone's attention.", "She raises her hand and signals to the operator."],
  recoil: ["Flinch backward in surprise.", "A sudden flash startles him and he recoils."],
  inspect: ["Lean in and examine a tiny marking.", "She looks closely and studies the label.", "He examines writing on an object and tries to read it."],
  cover: ["Cover your head with both arms for protection.", "He shields his face from falling debris."],
  knock: ["Rap your knuckles against a door.", "She knocks on the panel three times.", "He taps a hard surface with his fist."]
};
const framing={listen:"close",signal:"wide",recoil:"medium",inspect:"close",cover:"medium",knock:"medium"};
export function storyBeats(text){
  if(!text.trim() || text.length>800)throw Error("Enter an original idea of up to 800 characters.");
  const parts=text.split(/(?:[.!?;\n]+|,?\s*\b(?:and then|then|finally|after that)\b\s*)/i)
    .map(s=>s.replace(/^[\s,]+|[\s,]+$/g,"")).filter(Boolean);
  if(!parts.length||parts.length>3)throw Error("Use one to three story beats for a three-shot scene.");
  return parts;
}
export function direct(matches){
  const actions=matches.map(m=>m.action);
  if(actions.length===1)actions.unshift(actions[0]==="listen"?"inspect":"listen");
  if(actions.length===2)actions.push(actions[1]==="recoil"?"cover":"recoil");
  return actions.map(beat=>({beat,framing:framing[beat]}));
}
export function planIdea(text,signal){
  const clauses=storyBeats(text);
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const worker=new Worker(new URL("./story-worker.mjs",import.meta.url),{type:"module"});
    const finish=(error,value)=>{clearTimeout(timer);worker.terminate();signal.removeEventListener("abort",cancel);if(error)reject(error);else resolve(value);};
    const cancel=()=>finish(new DOMException("Canceled","AbortError"));
    const timer=setTimeout(()=>finish(Error("The story model timed out. Retry with this tab open.")),180000);
    signal.addEventListener("abort",cancel,{once:true});worker.onerror=e=>finish(Error(e.message||"Could not start the story model."));
    worker.onmessage=({data})=>data.error?finish(Error(data.error)):finish(null,{...data,shots:direct(data.matches)});
    worker.postMessage({clauses});
  });
}
