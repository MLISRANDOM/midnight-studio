/**
 * Midnight Studio: FLUX on Cloudflare Workers AI
 * Worker binding: AI (type Workers AI)
 * Worker secret: STUDIO_ACCESS_TOKEN (random private string)
 *
 * POST JSON: {prompt,model:"klein"|"draft",aspectRatio:"9:16"|"16:9",
 *             referenceImage:{mimeType:"image/png",data:"base64"}}
 */
const ORIGIN="https://mlisrandom.github.io";
const ALLOWED_MODELS={klein:"@cf/black-forest-labs/flux-2-klein-4b",draft:"@cf/black-forest-labs/flux-1-schnell"};
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-studio-token","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}})}
function decodeImage(base64,type){
 const binary=atob(base64),data=new Uint8Array(binary.length);
 for(let i=0;i<data.length;i++)data[i]=binary.charCodeAt(i);
 return new Blob([data],{type});
}
export default {
 async fetch(request,env){
  if(request.method==="GET")return json({ok:true,service:"Midnight Studio FLUX",status:"ready",models:Object.keys(ALLOWED_MODELS)});
  if(request.headers.get("Origin")!==ORIGIN)return json({ok:false,error:"Origin not permitted"},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST")return json({ok:false,error:"POST required"},405);
  if(!env.AI)return json({ok:false,error:"Add a Workers AI binding named AI"},503);
  if(!env.STUDIO_ACCESS_TOKEN)return json({ok:false,error:"Add STUDIO_ACCESS_TOKEN as a Worker secret"},503);
  if(request.headers.get("x-studio-token")!==env.STUDIO_ACCESS_TOKEN)return json({ok:false,error:"Incorrect studio token"},401);
  if(Number(request.headers.get("content-length")||0)>1800000)return json({ok:false,error:"Image reference too large"},413);
  let data;
  try{data=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400)}
  const {prompt,model="klein",aspectRatio="9:16",referenceImage}=data||{};
  if(typeof prompt!=="string"||prompt.length<10||prompt.length>10000)return json({ok:false,error:"Invalid prompt length"},400);
  if(!Object.hasOwn(ALLOWED_MODELS,model)||!["9:16","16:9"].includes(aspectRatio))return json({ok:false,error:"Invalid model or aspect ratio"},400);
  try{
   let image;
   if(model==="draft"){
    const result=await env.AI.run(ALLOWED_MODELS.draft,{prompt:prompt.slice(0,2000),steps:4});
    image=result.image;
   }else{
    const form=new FormData();
    form.append("prompt",prompt.slice(0,10000)+"\nCreate a clean illustration with no text.");
    form.append("width",aspectRatio==="9:16"?"576":"1024");
    form.append("height",aspectRatio==="9:16"?"1024":"576");
    if(referenceImage){
     if(!["image/png","image/jpeg","image/webp"].includes(referenceImage.mimeType)||typeof referenceImage.data!=="string"||referenceImage.data.length>1200000)return json({ok:false,error:"Reference must be a PNG/JPG/WebP under 900 KB, resized below 512x512"},400);
     const blob=decodeImage(referenceImage.data,referenceImage.mimeType);
     form.append("input_image_0",blob,"evan-reference.png");
    }
    const packed=new Response(form);
    const result=await env.AI.run(ALLOWED_MODELS.klein,{multipart:{body:packed.body,contentType:packed.headers.get("content-type")}});
    image=result.image;
   }
   if(typeof image!=="string"||!image)return json({ok:false,error:"Model returned no image"},502);
   return json({ok:true,data:image,mimeType:model==="draft"?"image/jpeg":"image/png",model});
  }catch(err){return json({ok:false,error:"Workers AI request failed. Check Cloudflare logs and model quota. "+String(err?.message||err).slice(0,250)},502)}
 }
};
