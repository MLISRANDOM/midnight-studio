/* Bind positions use the approved 1000-unit-wide Survivor turnaround.
   Only geometry lives here. The artwork is opened from the user's own file. */
import {direction} from "./reference.mjs";

export const SHEET_SHA = "3ae49beade6013009bb6fae8a0f1394daf95461e2f40f8dc4264af001c2d510d";
export const beats = {
  inspect:"Examine a detail",cover:"Shield the face",knock:"Knock on the panel",
  signal: "The platform lamp answers",
  listen: "A bell behind the wall",
  recoil: "The floor switch clicks"
};
export const framings = {wide:"Wide", medium:"Medium", close:"Close-up"};
export const stationScene = [
  {beat:"listen", framing:"wide"},
  {beat:"signal", framing:"medium"},
  {beat:"recoil", framing:"close"}
];

const mirror = arr => arr.map(([x,y]) => [411-x,y]);
const leftUpper = [[172,172],[185,170],[180,200],[173,228],[154,227],[159,207]];
const leftLower = [[154,218],[175,219],[167,270],[174,284],[172,306],[144,307],[144,270]];
const leftThigh = [[181,258],[206,258],[201,292],[194,341],[171,341]];
const leftShin = [[172,331],[196,331],[191,388],[196,428],[146,428],[147,399],[168,388]];
const torso = [[173,162],[188,154],[223,154],[237,162],[244,179],[235,187],[236,261],[230,272],
  [181,272],[174,261],[176,193],[167,181]];
const rect = (x,y,w,h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const sourceParts = {torso, leftUpper, rightUpper:mirror(leftUpper), leftLower, rightLower:mirror(leftLower),
  leftThigh, rightThigh:mirror(leftThigh), leftShin, rightShin:mirror(leftShin),
  head:rect(148,41,114,118), startled:rect(297,477,130,141), alert:rect(433,476,131,143),
  curious:rect(160,477,131,142), glad:rect(569,477,133,142)};

function makeCanvas(w,h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
}
function shape(ctx, points) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
}

export function makeSheetRig(sheet) {
  const scale = sheet.naturalWidth / 1000;
  const base = makeCanvas(sheet.naturalWidth, sheet.naturalHeight);
  const ctx = base.getContext("2d", {willReadFrequently:true});
  ctx.drawImage(sheet,0,0);
  const image = ctx.getImageData(0,0,base.width,base.height);
  // Only remove paper connected to the sheet border. Enclosed eye whites,
  // drawstrings and shoe soles can have exactly the same RGB as the paper.
  const d=image.data, width=base.width, height=base.height;
  const queue=new Int32Array(width*height);
  let read=0,write=0;
  function visit(pixel) {
    const i=pixel*4;
    if(d[i+3]===0 || Math.max(Math.abs(d[i]-234),Math.abs(d[i+1]-226),Math.abs(d[i+2]-223))>60)return;
    d[i+3]=0;queue[write++]=pixel;
  }
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=1;y<height-1;y++){visit(y*width);visit((y+1)*width-1);}
  while(read<write){
    const p=queue[read++],x=p%width;
    if(x>0)visit(p-1);
    if(x+1<width)visit(p+1);
    if(p>=width)visit(p-width);
    if(p<(height-1)*width)visit(p+width);
  }
  ctx.putImageData(image,0,0);
  const parts = {};
  for (const [name,poly] of Object.entries(sourceParts)) {
    const xs=poly.map(p=>p[0]), ys=poly.map(p=>p[1]);
    const x=Math.min(...xs), y=Math.min(...ys), w=Math.max(...xs)-x, h=Math.max(...ys)-y;
    const piece=makeCanvas(Math.ceil(w*scale),Math.ceil(h*scale));
    const c=piece.getContext("2d");
    c.scale(scale,scale); c.translate(-x,-y); shape(c,poly); c.clip();
    c.drawImage(base,0,0,1000,base.height/scale);
    parts[name]={piece,x,y,w,h};
  }
  return parts;
}

function rounded(ctx,x,y,w,h,r,fill,stroke=null) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2.5;ctx.stroke();}
}
function disc(ctx,x,y,r,fill) {
  ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();
}
function pivot(ctx,x,y,degrees,fn) {
  ctx.save();ctx.translate(x,y);ctx.rotate(degrees*Math.PI/180);ctx.translate(-x,-y);fn();ctx.restore();
}
function originalSample(ctx,name) {
  // An original station maintenance robot provides a playable starter without a media download.
  const ink="#11252b", jacket="#e8a341", limb="#627a75";
  const poly=(v,color)=>{shape(ctx,v);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2.4;ctx.stroke();};
  const signs={leftUpper:[leftUpper,jacket],rightUpper:[mirror(leftUpper),jacket],
    leftLower:[leftLower,limb],rightLower:[mirror(leftLower),limb],leftThigh:[leftThigh,limb],
    rightThigh:[mirror(leftThigh),limb],leftShin:[leftShin,"#364c50"],rightShin:[mirror(leftShin),"#364c50"]};
  if(signs[name]){poly(...signs[name]);return;}
  if(name==="torso"){
    rounded(ctx,174,160,63,111,13,jacket,ink);
    rounded(ctx,184,177,41,34,6,ink); rounded(ctx,190,185,25,4,2,"#a3f6cd");
    rounded(ctx,187,225,36,16,3,"#9b672f",ink); return;
  }
  rounded(ctx,164,65,82,92,23,"#e3bd72",ink);
  rounded(ctx,169,83,72,45,13,ink);
  const height=name==="startled"?20:12;
  rounded(ctx,179,96,14,height,5,"#95fae6"); rounded(ctx,215,96,14,height,5,"#95fae6");
  rounded(ctx,191,138,26,name==="glad"?5:3,2,ink);
  rounded(ctx,201,47,5,19,2,limb); disc(ctx,204,45,6,jacket);
}
function drawPart(ctx,rig,name) {
  if(!rig){originalSample(ctx,name);return;}
  const {piece,x,y,w,h}=rig[name];
  if(["startled","alert","curious","glad"].includes(name))
    ctx.drawImage(piece,151,44,109,116);
  else ctx.drawImage(piece,x,y,w,h);
}

const neutral=[0,0,0,0,0,0,0,0,0,0,0];
/* head, shoulder L, elbow L, shoulder R, elbow R, hip L, knee L, hip R, knee R, lean, drop */
const actions={
  inspect:[[0,neutral,"head"],[.32,[13,3,-5,-15,-46,1,3,-2,4,8,4],"curious"],[.73,[18,8,-9,-23,-60,4,1,-5,8,13,8],"alert"],[1,neutral,"curious"]],
  cover:[[0,neutral,"head"],[.2,[-8,73,146,-75,-145,12,-14,-15,18,-5,10],"startled"],[.72,[-14,77,147,-79,-143,17,-18,-20,20,-9,14],"startled"],[1,neutral,"alert"]],
  knock:[[0,neutral,"head"],...[.18,.30,.41,.53,.64,.76].map((t,i)=>[t,[4,2,-3,-65,i%2?-16:-72,-3,4,3,-3,4,1],"alert"]),[1,neutral,"curious"]],
  signal:[[0,neutral,"head"],[.17,[5,3,-8,-5,8,0,0,0,0,1,0],"curious"],
    [.43,[-7,12,-12,-76,-38,-7,8,4,-4,2,-2],"alert"],
    [.60,[-4,10,-14,-60,-67,-5,7,6,-5,3,-2],"alert"],
    [.79,[4,4,-9,-14,-22,-2,4,2,-2,1,1],"curious"],[1,neutral,"glad"]],
  listen:[[0,neutral,"head"],[.22,[-10,7,-6,-10,-16,-3,1,2,-1,-2,1],"curious"],
    [.50,[9,10,-5,-96,-72,-7,9,8,-5,4,2],"curious"],
    [.74,[12,14,-4,-85,-76,-8,11,7,-4,5,1],"startled"],[1,neutral,"head"]],
  recoil:[[0,neutral,"head"],[.21,[6,1,-8,-2,9,-2,1,2,-1,1,0],"curious"],
    [.42,[-12,54,28,-66,-36,17,-23,-20,30,-8,10],"startled"],
    [.60,[-8,39,32,-52,-38,12,-20,-14,23,-5,8],"startled"],
    [.82,[4,11,-4,-14,-9,2,-4,-4,6,-1,1],"alert"],[1,neutral,"head"]]
};

export function poseAt(beat,t,energy=1) {
  const keys=actions[beat]||actions.signal;
  t=Math.min(1,Math.max(0,t));
  const end=keys.findIndex((k,i)=>i>0&&t<=k[0]);
  const [a,b]=[keys[end-1],keys[end]];
  let f=(t-a[0])/(b[0]-a[0]);f=f*f*(3-2*f);
  const values=a[1].map((v,i)=>(v+(b[1][i]-v)*f)*(i===0?1:energy));
  return {v:values,face:f<0.5?a[2]:b[2]};
}

function figure(ctx,rig,pose,beat) {
  const {v,face}=pose;
  const part=name=>drawPart(ctx,rig,name);
  ctx.save();ctx.translate(0,v[10]);
  for(const [side,hip,knee,x,kx] of [["left",v[5],v[6],194,183],["right",v[7],v[8],217,228]]) {
    pivot(ctx,x,265,hip,()=>{
      disc(ctx,x,268,9,"#201b18");part(side+"Thigh");
      pivot(ctx,kx,335,knee,()=>{disc(ctx,kx,335,8.5,"#211e1b");part(side+"Shin");});
    });
  }
  pivot(ctx,205,265,v[9],()=>{
    const body=()=>{part("torso");pivot(ctx,205,155,v[0],()=>part(face));};
    if(beat==="cover")body();
    for(const [side,angle,bend,sx,ex] of [["left",v[1],v[2],179,165],["right",v[3],v[4],232,246]]) {
      pivot(ctx,sx,178,angle,()=>{
        disc(ctx,sx,178,9.2,rig?"#302d2c":"#e8a341");part(side+"Upper");
        pivot(ctx,ex,223,bend,()=>{disc(ctx,ex,223,8.8,rig?"#302d2c":"#596f6e");part(side+"Lower");
          if(beat==="inspect"&&side==="right"){
            rounded(ctx,244,285,33,22,3,"#c39858","#372c23");
            for(let i=0;i<3;i++){ctx.fillStyle="#5b4631";ctx.fillRect(250+i*6,290,2,8-i);}
          }
        });
      });
    }
    if(beat!=="cover")body();
  });
  ctx.restore();
}

function polygon(ctx,points,fill) {shape(ctx,points);ctx.fillStyle=fill;ctx.fill();}
function station(ctx,w,h,light) {
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,"#182a31");g.addColorStop(1,"#0b181f");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  const wall=ctx.createLinearGradient(0,0,0,h*.78);wall.addColorStop(0,"#14252a");wall.addColorStop(1,"hsl(174 17% "+(15+light*12)+"%)");
  polygon(ctx,[[0,h*.17],[w*.74,h*.30],[w*.74,h*.68],[0,h*.80]],wall);
  polygon(ctx,[[w*.74,h*.30],[w,h*.16],[w,h*.79],[w*.74,h*.68]],"#233435");
  polygon(ctx,[[0,h*.80],[w*.74,h*.68],[w,h*.79],[w,h],[0,h]],"#394545");
  const seams="#3b5151";
  for(let j=0;j<4;j++){const x=(.035+j*.192)*w; const l=(1-x/(w*.85))*.10*h;
    rounded(ctx,x,.25*h-l*.42,w*.011,.46*h+l,1,"#18292c");
    ctx.fillStyle=seams;ctx.fillRect(x+w*.011,.25*h-l*.42,Math.max(1,w*.002),.46*h+l);}
  const doorX=.62*w,doorY=.33*h;
  rounded(ctx,doorX,doorY,.15*w,.37*h,3,"#101f23","#435452");
  rounded(ctx,doorX+.01*w,doorY+.01*h,.13*w,.345*h,2,"#263a3a");
  ctx.fillStyle="#11272a";ctx.fillRect(doorX+.072*w,doorY+.015*h,w*.003,h*.335);
  ctx.fillStyle="#bd9b5c";ctx.fillRect(0,h*.69,w*.615,Math.max(2,h*.008));
  for(let i=0;i<5;i++){
    polygon(ctx,[[w*(i*.24-.3),h],[w*(.53+i*.055),h*.72],[w*(.532+i*.055),h*.72],[w*(i*.24-.295),h]],"#485451");
  }
  const lx=.79*w,ly=.285*h;
  const glow=ctx.createRadialGradient(lx,ly,1,lx,ly,h*.28);
  glow.addColorStop(0,"rgba(255,189,102,0.22)");glow.addColorStop(1,"rgba(255,189,102,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  rounded(ctx,lx-w*.021,ly-h*.015,w*.042,h*.032,3,"#554838");
  rounded(ctx,lx-w*.016,ly-h*.009,w*.032,h*.016,2,"#f5c27f");
}

export function shotPlan(beat,report) {
  const d=direction(report);
  return {beat:actions[beat]?beat:"signal",duration:Math.round(d.beatSeconds*3*24)/24, ...d};
}

export function scenePlan(choices, report) {
  const d = direction(report);
  const globalSpan = report && report.duration_seconds / report.shot_count_estimate;
  const spans = report?.shot_span_seconds_by_third;
  let frame = 0;
  const shots = choices.map(({beat, framing}, index) => {
    const relative = spans ? Math.sqrt(spans[index] / globalSpan) : 1;
    const seconds = d.beatSeconds * Math.max(.65, Math.min(1.6, relative));
    const start_frame = frame;
    frame += Math.max(18, Math.round(seconds * 24));
    return {beat, framing, start_frame, end_frame:frame};
  });
  return {...d, shots, frame_count:frame, duration:frame / 24};
}

export function paintScene(canvas, rig, plan, frame) {
  const index = Math.max(0, Math.min(plan.frame_count-1, frame));
  const shot = plan.shots.find(s => index < s.end_frame);
  paintShot(canvas, rig, {...shot, light:plan.light, energy:plan.energy},
    (index-shot.start_frame)/(shot.end_frame-shot.start_frame-1));
}

export function paintShot(canvas,rig,plan,fraction) {
  const ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  const zoom = {wide:1,medium:1.40,close:plan.beat==="inspect"?1.52:2.14}[plan.framing] || 1;
  // The camera stays locked throughout the shot. Reframe only at an edit.
  ctx.translate((1-zoom)*w*.46,(1-zoom)*h*(h>w ? .24 : .16));
  ctx.scale(zoom,zoom);
  station(ctx,w,h,plan.light);
  const portrait=h>w, scale=Math.min(h*(portrait ? .67 : .79)/386,w*.65/180);
  // Leave room for the prop and the extended hand in the portrait crop.
  const propShot=plan.beat==="inspect"||plan.beat==="knock";
  const x=w*(portrait&&propShot ? .30 : portrait ? .48 : .45),y=h*(portrait ? .80 : .84);
  ctx.fillStyle="rgba(4,13,16,0.40)";ctx.beginPath();ctx.ellipse(x,y+2,scale*69,scale*9,0,0,2*Math.PI);ctx.fill();
  ctx.translate(x-205*scale,y-424*scale);ctx.scale(scale,scale);
  if(plan.beat==="knock"){
    rounded(ctx,335,112,69,200,5,"#496060","#182b2e");
    rounded(ctx,337,164,12,29,2,"#c79958","#332d22");
  }
  figure(ctx,rig,poseAt(plan.beat,fraction,plan.energy),plan.beat);ctx.restore();
}
