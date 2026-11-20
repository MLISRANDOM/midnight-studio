import {repertoire} from "./story.mjs";
const revision="751bff37182d3f1213fa05d7196b954e230abad9";
const files="https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/"+revision+"/";
const runtime="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
async function asset(name){
  const r=await fetch(files+name,{credentials:"omit"});if(!r.ok)throw Error("Could not download "+name+" (HTTP "+r.status+").");
  return r;
}
self.onmessage=async({data:{clauses}})=>{
  let session;
  try{
    const [ort,hf,config,tokenizer,weights]=await Promise.all([import(runtime+"ort.wasm.min.mjs"),
      import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.3/dist/transformers.min.js"),
      asset("tokenizer_config.json").then(r=>r.json()),asset("tokenizer.json").then(r=>r.json()),
      asset("onnx/model_quantized.onnx").then(r=>r.arrayBuffer())]);
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=runtime;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",weights)),b=>b.toString(16).padStart(2,"0")).join("");
    if(hash!=="afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1")throw Error("The story model checksum did not match.");
    const encode=new hf.BertTokenizer(tokenizer,config);
    session=await ort.InferenceSession.create(weights,{executionProviders:["wasm"]});
    async function vector(text){
      const tokens=encode(text,{truncation:true,max_length:96});
      const feeds={};
      for(const name of session.inputNames){
        const ids=tokens[name]||tokens.input_ids;
        const data=name==="token_type_ids"&&!tokens[name]?new BigInt64Array(ids.data.length):BigInt64Array.from(ids.data);
        feeds[name]=new ort.Tensor("int64",data,[1,data.length]);
      }
      let outputs;
      try{
        outputs=await session.run(feeds);
        const result=outputs.last_hidden_state||Object.values(outputs)[0];
        const width=result.dims.at(-1),v=new Float32Array(width);
        for(let i=0;i<result.data.length;i++)v[i%width]+=result.data[i];
        const norm=Math.hypot(...v);return v.map(n=>n/norm);
      }finally{Object.values(feeds).forEach(t=>t.dispose());if(outputs)Object.values(outputs).forEach(t=>t.dispose());}
    }
    const examples=[];
    for(const [action,strings] of Object.entries(repertoire))for(const description of strings)examples.push({action,v:await vector(description)});
    const matches=[];
    for(const clause of clauses){
      const v=await vector(clause),ranked=examples.map(e=>({action:e.action,score:e.v.reduce((sum,n,i)=>sum+n*v[i],0)})).sort((a,b)=>b.score-a.score);
      if(ranked[0].score<.29)throw Error('No supported movement matched “'+clause+'”. Try listening, signaling, reacting, inspecting, shielding or knocking.');
      matches.push({clause,action:ranked[0].action,similarity:+ranked[0].score.toFixed(3)});
    }
    self.postMessage({model:"all-MiniLM-L6-v2",revision,matches});
  }catch(e){self.postMessage({error:e.message||String(e)});}
  finally{if(session)await session.release();}
};
