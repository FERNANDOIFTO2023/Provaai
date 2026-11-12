// Audio-only revision. Anchors come from the unchanged V7 visual formulas/trace.
import {readFile} from 'node:fs/promises';
import {events as original,FPS,DURATION,action} from './timing-v7.mjs';
export {FPS,DURATION};
const quantize=t=>Math.round(t*FPS)/FPS,firstFrame=t=>Math.ceil((t-1e-9)*FPS)/FPS;
const ease=v=>v*v*v*(v*(v*6-15)+10);
function inverseEase(target){let lo=0,hi=1;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(ease(m)<target)lo=m;else hi=m;}return (lo+hi)/2;}
const camera=JSON.parse(await readFile(new URL('./output/v7/camera-120fps.json',import.meta.url),'utf8'));
const replacements={cada:4.4,aluno:4.62,importa:4.85,'select-aluno':5.3,
 'draft-ready':15.8,approved:firstFrame(16.8+action.approve+.26*inverseEase(.45)),
 'download-finish':firstFrame(20.2+action.downloadDone+.2*inverseEase(.4)),
 'brand-ready':27.75};
const anchorNotes={cada:'Word entrance finishes',aluno:'Word entrance finishes',importa:'Word entrance finishes','select-aluno':'Selection handles lock at local 1.3s','draft-ready':'Final checkmark completes at local 2.4s',approved:'Green approval button first visible frame','download-finish':'Tudo pronto label first visible frame','brand-ready':'CTA reaches full opacity'};
const settle80=1-Math.cbrt(.2);
for(let i=0;i<3;i++){
 replacements[`profile-${i}`]=10.4+.13+i*.12+.65*settle80;
 replacements[`draft-${i}`]=13.4+.5+i*.38+.5*settle80;
 replacements[`file-${i}`]=20.2+.2+i*.13+.6*settle80;
 for(const name of ['profile','draft','file'])anchorNotes[`${name}-${i}`]='Card reaches 80% of its entrance';
}
for(const event of original.filter(e=>e.id.startsWith('travel-'))){
 let best={speed:-1,time:event.time};
 for(let i=1;i<camera.length-1;i++){
  if(Math.abs(camera[i].time-event.time)>.15)continue;
  const speed=Math.hypot(camera[i+1].x-camera[i-1].x,camera[i+1].y-camera[i-1].y)*FPS/2;
  if(speed>best.speed)best={speed,time:camera[i].time};
 }
 replacements[event.id]=best.time;anchorNotes[event.id]='Maximum camera translation speed from 120Hz render trace';
}
export const events=original.filter(e=>e.type!=='type').map(e=>{
 const time=quantize(replacements[e.id]??e.time);return {...e,time,...(e.visualPeak!==undefined?{visualPeak:time}:{})};
});
const text='Matemática. Frações. 7º ano.';
for(let i=0;i<text.length;i++)if(i%2===0&&text[i]!==' ')events.push({id:`type-${i}`,time:firstFrame(7.5+1.1*(i+1)/text.length),type:'type',pan:-.25+.5*i/text.length});
// The center of the file descent previously had no directional sound.
events.push({id:'download-descent',time:quantize(20.2+action.download+.65/2),type:'paper',pan:.25,duration:.32});
events.sort((a,b)=>a.time-b.time);
export const anchors=Object.entries(replacements).map(([id,visual])=>({id,reason:anchorNotes[id],previous:original.find(e=>e.id===id).time,visualTarget:visual,audioCue:events.find(e=>e.id===id).time,quantizationMs:1000*(events.find(e=>e.id===id).time-visual)}));
export const dynamicSections=[
 [0,.62],[1.25,.88],[3.4,.98],[4.55,.78],[7.3,.94],[10.6,1.03],
 [13.65,1.11],[16.1,1.16],[17.15,.76],[18.6,.65],[replacements.approved+.12,1.04],
 [20.6,1.12],[22.7,1.06],[24,.9],[26.2,.75],[27.85,1.02],[29.3,.78],[30,.7]
];
export function musicEnergy(t){let i=0;while(i<dynamicSections.length-2&&t>dynamicSections[i+1][0])i++;const [a,x]=dynamicSections[i],[b,y]=dynamicSections[i+1],p=Math.max(0,Math.min(1,(t-a)/(b-a)));return x+(y-x)*ease(p);}
