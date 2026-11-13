/**
 * Midnight Studio private Gemini gateway.
 * Deploy this as a Cloudflare Worker, then set Secrets:
 *   GEMINI_API_KEY (Google AI Studio API key)
 *   STUDIO_ACCESS_TOKEN (long random token, separate from API key)
 * Do not put secrets into GitHub or Pages source.
 * This is intended for a single creator, not for public multi-user operation.
 */
const SITE_ORIGIN = "https://mlisrandom.github.io";
const MODELS = new Set(["gemini-3.1-flash-image","gemini-2.5-flash-image"]);
function cors() { return {
  "Access-Control-Allow-Origin":SITE_ORIGIN,
  "Vary":"Origin",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"content-type,x-studio-token",
  "Cache-Control":"no-store",
  "Content-Type":"application/json;charset=utf-8"
}; }
function result(obj,status=200) {return new Response(JSON.stringify(obj),{status,headers:cors()});}
export default {
 async fetch(request,env) {
  if(request.headers.get("Origin")!==SITE_ORIGIN)return result({ok:false,error:"Origin not authorized"},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
  if(request.method!=="POST")return result({ok:false,error:"POST required"},405);
  if(!env.GEMINI_API_KEY||!env.STUDIO_ACCESS_TOKEN)return result({ok:false,error:"Missing Worker secrets"},503);
  if(request.headers.get("x-studio-token")!==env.STUDIO_ACCESS_TOKEN)return result({ok:false,error:"Studio access token incorrect"},401);
  const len=Number(request.headers.get("content-length")||0);
  if(len>8500000)return result({ok:false,error:"Request too large"},413);
  let req;
  try{req=await request.json()}catch{return result({ok:false,error:"Invalid JSON"},400)}
  const {prompt,aspectRatio="9:16",model="gemini-3.1-flash-image",referenceImage}=req;
  if(typeof prompt!=="string"||prompt.length<10||prompt.length>18000)return result({ok:false,error:"Prompt length not valid"},400);
  if(!["9:16","16:9"].includes(aspectRatio)||!MODELS.has(model))return result({ok:false,error:"Invalid format or model"},400);
  if(!referenceImage||typeof referenceImage.data!=="string"||!["image/png","image/jpeg","image/webp"].includes(referenceImage.mimeType)||referenceImage.data.length>7500000)return result({ok:false,error:"An approved PNG, JPG or WebP reference is required (max 5.5 MB encoded)"},400);
  try {
   // Supported legacy generateContent image-generation endpoint. See Google's Gemini image docs.
   const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
    body:JSON.stringify({
     contents:[{role:"user",parts:[
      {text:prompt+"\nProduce one original image. Preserve the supplied character reference. No text, captions, borders, logos, or letter overlays."},
      {inline_data:{mime_type:referenceImage.mimeType,data:referenceImage.data}}
     ]}],
     generationConfig:{responseModalities:["TEXT","IMAGE"],imageConfig:{aspectRatio}}
    })
   });
   const payload=await upstream.json();
   if(!upstream.ok)return result({ok:false,error:payload.error?.message||"Google image request failed",status:upstream.status},upstream.status);
   const part=(payload.candidates||[]).flatMap(c=>c.content?.parts||[]).find(p=>p.inlineData?.data||p.inline_data?.data);
   const img=part?.inlineData||part?.inline_data;
   if(!img)return result({ok:false,error:"Gemini did not return an image. Try again with a simpler scene."},502);
   return result({ok:true,mimeType:img.mimeType||img.mime_type||"image/png",data:img.data});
  }catch(e){return result({ok:false,error:"Image gateway request failed: "+String(e.message||e)},502)}
 }
};