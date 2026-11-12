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
 const slides={};
 for(const name of ['card-slide-1','card-slide-4','card-slide-8']){const b=await readFile(path.join(DIR,`assets/soundcn/${name}.f32`));slides[name]=Float32Array.from({length:b.length/4},(_,i)=>b.readFloatLE(i*4));}
 const slideReport=[];
 let seed=7043;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1};
 const hz=m=>440*2**((m-69)/12),sin=(f,t)=>Math.sin(2*Math.PI*f*t);
 function put(stem,at,len,fn,pan=0){const start=Math.round(at*SR);for(let k=0;k<len*SR;k++){const i=start+k;if(i<0||i>=N)continue;const v=fn(k/SR,k),p=typeof pan==='function'?pan(k/(len*SR)):pan;stem[0][i]+=v*Math.sqrt((1-p)/2);stem[1][i]+=v*Math.sqrt((1+p)/2)}}
 function bell(at,m,amp,pan,stem=fx){const f=hz(m);put(stem,at,1.3,t=>amp*(1-Math.exp(-t*300))*Math.exp(-t*5.5)*(sin(f,t)+.22*sin(f*2.002,t)),pan)}
 const chords=[[54,61,66,69],[50,57,62,66],[57,64,69,73],[52,59,64,68]];
 for(let bar=0;bar<15;bar++){
  const notes=chords[Math.floor(bar/2)%4],at=bar*2;
  notes.forEach((m,j)=>put(music,at,3.1,t=>.027*Math.min(1,t/.35)*Math.min(1,(3.1-t)/.85)*(sin(hz(m),t)+.18*sin(hz(m)*1.002,t)),(j-1.5)*.4));
  if(at<28)for(let j=0;j<6;j++){
   const note=notes[[0,2,1,3,2,1][j]]+12,when=at+[0,.375,.75,1.125,1.5,1.75][j];
   const freq=hz(note),amp=.038*(j%3===0?1:.75);
   put(music,when,.8,t=>amp*(1-Math.exp(-t*350))*Math.exp(-t*7)*(sin(freq,t)+.3*sin(freq*2,t)+.08*sin(freq*3,t)),j%2?.35:-.35);
   bell(when+.1875,note,.008,j%2?-.45:.45,music);
  }
  // Syncopated harmonic bass is audible on small speakers, not just a sub tone.
  if(at<28)for(const [j,off] of [0,.75,1,1.625].entries()){
   const f=hz(notes[0]-12+(j===3?12:0));
   put(music,at+off,.32,t=>.085*(1-Math.exp(-t*300))*Math.exp(-t*10)*(sin(f,t)+.4*sin(f*2,t)+.17*sin(f*3,t)));
  }
  if(at>=4&&at<26)notes.forEach((m,j)=>put(music,at+.25,.45,t=>.012*(1-Math.exp(-t*170))*Math.exp(-t*8)*(sin(hz(m),t)+.25*sin(hz(m)*2,t)),(j-1.5)*.3));
 }
 // 120 BPM groove with offbeat hats, a soft backbeat, and subtle bar variations.
 for(let beat=1;beat<56;beat++){
  const at=beat*.5;put(music,at,.3,t=>.125*Math.sin(2*Math.PI*(49*t+1.1*(1-Math.exp(-t*40))))*Math.exp(-t*19));
  if(beat%2===1){let lp=0;put(music,at,.16,t=>{lp=.55*lp+.45*noise();return (lp*.062+.016*sin(175,t))*Math.exp(-t*28)*Math.min(1,t/.002)},.1)}
  for(const [off,amp] of [[.25,.018],[.375,beat%4===3?.012:.006]]){let prev=0;put(music,at+off,.07,t=>{const v=noise(),hp=v-prev;prev=v;return hp*amp*Math.exp(-t*66)*Math.min(1,t/.001)},beat%2?.45:-.45)}
 }
 for(const [index,e] of events.entries()){
  const at=e.time,pan=e.pan??Math.sin(index)*.3;
  if(['click','select','type','tap'].includes(e.type)){
   const gain={click:.65,select:.5,type:.2,tap:.35}[e.type];
   put(fx,at,click.length/SR,(t,k)=>click[k]*gain,pan);
   if(e.type!=='type')put(fx,at,.13,t=>.075*sin(180,t)*Math.exp(-t*42),pan);
  }
  if(['swoop','whip','paper','launch'].includes(e.type)){
   const name=e.type==='paper'?'card-slide-4':e.type==='whip'?'card-slide-8':index%2?'card-slide-1':'card-slide-4';
   const source=slides[name],len=e.type==='paper'?.24:e.type==='whip'?.64:.5,count=Math.round(len*SR),sample=new Float32Array(count);
   let low=0,dc=0,peak=0,energy=0,best=0,peakIndex=0;
   for(let k=0;k<count;k++){
    const pos=k*(source.length-1)/(count-1),a=Math.floor(pos),v=source[a]+((source[a+1]??source[a])-source[a])*(pos-a);
    low+=.26*(v-low);dc+=.01*(low-dc);
    sample[k]=(low-dc)*Math.min(1,k/(SR*.025),(count-1-k)/(SR*.045));peak=Math.max(peak,Math.abs(sample[k]));
   }
   // Align the strongest 10ms energy window with the existing visual cue.
   const win=480;for(let k=0;k<count;k++){energy+=sample[k]**2;if(k>=win)energy-=sample[k-win]**2;if(energy>best){best=energy;peakIndex=Math.max(0,k-win/2)}}
   const peakOffset=peakIndex/SR,amp=e.type==='paper'?.032:e.type==='whip'?.085:.07,gain=amp/Math.max(peak,.001);
   put(fx,at-peakOffset,len,(t,k)=>sample[k]*gain,p=>pan*.55*(1-2*p));
   slideReport.push({id:e.id,asset:name,time:at,start:at-peakOffset,energyPeak:at,duration:len,targetPeak:amp});
  }
  if(['bloom','pop'].includes(e.type))put(fx,at,.42,t=>.16*Math.sin(2*Math.PI*(62*t+2*(1-Math.exp(-t*30))))*Math.exp(-t*15),pan);
  if(e.type==='plink')bell(at,84+index%3*3,.045,pan);
  if(e.type==='glint'){bell(at,90,.04,-.4);bell(at+.055,97,.027,.4)}
  if(e.type==='chime')[78,85,90].forEach((m,j)=>bell(at+j*.055,m,.065,(j-1)*.4));
  if(e.type==='download')[90,85,81,78].forEach((m,j)=>bell(at+j*.04,m,.05,.45-j*.3));
 }
 // Short stereo early reflections add space without masking the attack.
 for(let c=0;c<2;c++)for(let i=N-1;i>=4800;i--)fx[c][i]+=.055*fx[1-c][i-3600]+.025*fx[c][i-4800];
 const mix=[new Float32Array(N),new Float32Array(N)];
 const priorities=events.filter(e=>['click','chime','download'].includes(e.type));
 for(let i=0;i<N;i++){const t=i/SR,duck=priorities.reduce((v,e)=>Math.max(v,Math.max(0,1-Math.abs(t-e.time)/.16)),0),fade=Math.min(1,t/.18,(DURATION-t)/1.15);for(let c=0;c<2;c++){music[c][i]*=(1.2-.08*duck)*fade;fx[c][i]*=.9*fade;mix[c][i]=music[c][i]+fx[c][i];}}
 let peak=0;for(let i=0;i<N;i++)peak=Math.max(peak,Math.abs(mix[0][i]),Math.abs(mix[1][i]));const gain=.8/peak;
 async function wav(name,stem){const b=Buffer.alloc(44+N*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);for(let i=0;i<N;i++)for(let c=0;c<2;c++)b.writeInt16LE(Math.round(clamp(stem[c][i]*gain,-.98,.98)*32767),44+i*4+c*2);await writeFile(path.join(out,name),b)}
 await wav('mix-v8.wav',mix);await wav('efeitos-v8.wav',fx);await wav('musica-v8.wav',music);
 await writeFile(path.join(out,'marcadores-sonoros.json'),JSON.stringify(events,null,2));
 await writeFile(path.join(out,'arrastes-v8.json'),JSON.stringify(slideReport,null,2));
 const rms=stem=>Math.sqrt(stem.reduce((sum,ch)=>sum+ch.reduce((s,v)=>s+v*v,0),0)/(N*2));
 const balance={musicRmsDb:20*Math.log10(rms(music)*gain),effectsRmsDb:20*Math.log10(rms(fx)*gain),musicToEffectsDb:20*Math.log10(rms(music)/rms(fx)),slideAssets:Object.keys(slides),voice:false};
 await writeFile(path.join(out,'balanco-audio.json'),JSON.stringify(balance,null,2));
 return {events:events.length,peak,gain,click:'soundcn/click-soft · Kenney · CC0'};
}
