import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {events,DURATION} from './timing-v7.mjs';
const DIR=path.dirname(fileURLToPath(import.meta.url)),SR=48000;
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
export async function createAudio(out){
 const N=DURATION*SR,music=[new Float32Array(N),new Float32Array(N)],fx=[new Float32Array(N),new Float32Array(N)];
 const bytes=await readFile(path.join(DIR,'assets/soundcn/click-soft.f32'));
 const click=Float32Array.from({length:bytes.length/4},(_,i)=>bytes.readFloatLE(i*4));
 let seed=7043;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1};
 const hz=m=>440*2**((m-69)/12),sin=(f,t)=>Math.sin(2*Math.PI*f*t);
 function put(stem,at,len,fn,pan=0){const start=Math.round(at*SR);for(let k=0;k<len*SR;k++){const i=start+k;if(i<0||i>=N)continue;const v=fn(k/SR,k),p=typeof pan==='function'?pan(k/(len*SR)):pan;stem[0][i]+=v*Math.sqrt((1-p)/2);stem[1][i]+=v*Math.sqrt((1+p)/2)}}
 function bell(at,m,amp,pan,stem=fx){const f=hz(m);put(stem,at,1.3,t=>amp*(1-Math.exp(-t*300))*Math.exp(-t*5.5)*(sin(f,t)+.22*sin(f*2.002,t)),pan)}
 const chords=[[54,61,66,69],[50,57,62,66],[57,64,69,73],[52,59,64,68]];
 for(let bar=0;bar<15;bar++){
  const notes=chords[Math.floor(bar/2)%4],at=bar*2;
  notes.forEach((m,j)=>put(music,at,3.1,t=>.027*Math.min(1,t/.35)*Math.min(1,(3.1-t)/.85)*(sin(hz(m),t)+.18*sin(hz(m)*1.002,t)),(j-1.5)*.4));
  if(at<27)for(let j=0;j<4;j++)bell(at+[0,.625,1.125,1.75][j],notes[(j+bar)%4]+12,.026,j%2?.5:-.5,music);
 }
 // Sparse rounded groove, leaving the transient range to interface effects.
 for(let beat=2;beat<54;beat++){
  const at=beat*.5;if(beat%2===0)put(music,at,.35,t=>.14*Math.sin(2*Math.PI*(46*t+1.2*(1-Math.exp(-t*35))))*Math.exp(-t*18));
  if(beat%4===2){let lp=0;put(music,at,.14,t=>{lp=.7*lp+.3*noise();return lp*.035*Math.exp(-t*25)},.18)}
  let prev=0;put(music,at+.25,.045,t=>{const v=noise(),hp=v-prev;prev=v;return hp*.005*Math.exp(-t*95)},beat%2?.5:-.5);
 }
 for(const [index,e] of events.entries()){
  const at=e.time,pan=e.pan??Math.sin(index)*.3;
  if(['click','select','type','tap'].includes(e.type)){
   const gain={click:.65,select:.5,type:.2,tap:.35}[e.type];
   put(fx,at,click.length/SR,(t,k)=>click[k]*gain,pan);
   if(e.type!=='type')put(fx,at,.13,t=>.075*sin(180,t)*Math.exp(-t*42),pan);
  }
  if(['swoop','whip','paper','launch'].includes(e.type)){
   const len=e.duration??.55,hard=e.type==='whip',amp=e.type==='paper'?.07:hard?.33:.23;let low=0,slow=0;
   put(fx,at-len/2,len,t=>{const p=t/len,n=noise();low+=.16*(n-low);slow+=.028*(n-slow);const env=Math.sin(Math.PI*p)**2;return env*(amp*(low-slow)+.024*sin(85+80*p,t))},p=>pan*(1-2*p));
   if(e.type!=='paper')put(fx,at,.4,t=>.09*sin(55,t)*Math.exp(-t*12)*Math.min(1,t/.008),0);
  }
  if(['bloom','pop'].includes(e.type))put(fx,at,.42,t=>.16*Math.sin(2*Math.PI*(62*t+2*(1-Math.exp(-t*30))))*Math.exp(-t*15),pan);
  if(e.type==='plink')bell(at,84+index%3*3,.045,pan);
  if(e.type==='glint'){bell(at,90,.04,-.4);bell(at+.055,97,.027,.4)}
  if(e.type==='chime')[78,85,90].forEach((m,j)=>bell(at+j*.055,m,.065,(j-1)*.4));
  if(e.type==='download')[90,85,81,78].forEach((m,j)=>bell(at+j*.04,m,.05,.45-j*.3));
 }
 // Short stereo early reflections add space without masking the attack.
 for(let c=0;c<2;c++)for(let i=N-1;i>=4800;i--)fx[c][i]+=.1*fx[1-c][i-3600]+.04*fx[c][i-4800];
 const mix=[new Float32Array(N),new Float32Array(N)];
 for(let i=0;i<N;i++){const t=i/SR,duck=events.reduce((v,e)=>Math.max(v,Math.max(0,1-Math.abs(t-e.time)/.22)),0),fade=Math.min(1,t/.1,(DURATION-t)/1.0);for(let c=0;c<2;c++)mix[c][i]=(music[c][i]*(.8-.24*duck)+fx[c][i])*fade;}
 let peak=0;for(let i=0;i<N;i++)peak=Math.max(peak,Math.abs(mix[0][i]),Math.abs(mix[1][i]));const gain=.8/peak;
 async function wav(name,stem){const b=Buffer.alloc(44+N*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);for(let i=0;i<N;i++)for(let c=0;c<2;c++)b.writeInt16LE(Math.round(clamp(stem[c][i]*gain,-.98,.98)*32767),44+i*4+c*2);await writeFile(path.join(out,name),b)}
 await wav('mix-v7.wav',mix);await wav('efeitos-v7.wav',fx);await wav('musica-v7.wav',music);
 await writeFile(path.join(out,'marcadores-sonoros.json'),JSON.stringify(events,null,2));
 return {events:events.length,peak,gain,click:'soundcn/click-soft · Kenney · CC0'};
}
