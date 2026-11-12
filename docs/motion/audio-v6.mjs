import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {events} from './timing-v6.mjs';

// Original sound design: cues share timing-v6 with the animation.
export const cues=events;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export async function createAudio(out,duration=28){
 const sr=48000,N=Math.round(duration*sr),music=[new Float32Array(N),new Float32Array(N)],fx=[new Float32Array(N),new Float32Array(N)];
 let seed=16431;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1};
 function add(stem,at,len,fn,pan=0){const from=Math.round(at*sr),count=Math.round(len*sr);for(let k=0;k<count;k++){let idx=from+k;if(idx<0||idx>=N)continue;const v=fn(k/sr,k),p=typeof pan==='function'?pan(k/count):pan;stem[0][idx]+=v*Math.sqrt((1-p)/2);stem[1][idx]+=v*Math.sqrt((1+p)/2)}}
 const hz=m=>440*2**((m-69)/12);
 const sine=(f,t)=>Math.sin(2*Math.PI*f*t);
 function bell(at,m,amp=.1,pan=0,stem=music){const f=hz(m);add(stem,at,1.2,t=>amp*(1-Math.exp(-t*400))*Math.exp(-t*6)*(sine(f,t)+.24*sine(f*2.005,t)+.1*sine(f*3,t)),pan)}
 const chords=[[57,61,64,68],[54,57,61,64],[50,54,57,61],[52,56,59,64]];
 for(let bar=0;bar<14;bar++){
  const start=bar*2,notes=chords[Math.floor(bar/2)%4];
  for(let j=0;j<4;j++){const f=hz(notes[j]);add(music,start,2.6,t=>.035*Math.min(1,t/.24)*Math.min(1,(2.6-t)/.65)*(sine(f,t)+.22*sine(f*1.002,t)),(j-1.5)*.35)}
  if(start<25){for(const [j,b] of [0,.75,1.5,2.5,3.25].entries()){bell(start+b*.5,notes[(j+bar)%4]+12,.047,Math.sin(j*2+bar)*.6);bell(start+b*.5+.375,notes[(j+bar)%4]+12,.012,-Math.sin(j*2+bar)*.6)}}
 }
 // Restrained pulse under the foreground UI sounds, with space at the close.
 for(let beat=4;beat<50;beat++){
  const at=beat*.5,root=chords[Math.floor(beat/8)%4][0]-12;
  if(beat%2===0){add(music,at,.24,t=>.15*Math.sin(2*Math.PI*(49*t+1.6*(1-Math.exp(-t*45))))*Math.exp(-t*22));add(music,at,.38,t=>.07*sine(hz(root),t)*Math.min(1,t/.01)*Math.exp(-t*9))}
  for(const off of [0,.25]){let prev=0;add(music,at+off,.055,t=>{const n=noise(),v=n-prev;prev=n;return .009*v*Math.exp(-t*78)},off?.45:-.4)}
  if(beat%4===2){let low=0;add(music,at,.12,t=>{low=.6*low+.4*noise();return .024*low*Math.exp(-t*34)},.1)}
 }
 // Center the sound envelope on peak visual velocity, not before scene onset.
 function whoosh(at,len=.42,hard=false){let low=0,prev=0;add(fx,at-len/2,len,t=>{let n=noise();low=.82*low+.18*n;let hi=n-prev;prev=n;const e=Math.sin(Math.PI*t/len)**2;return e*((hard?.24:.15)*low+.018*hi)+(hard?.04:.025)*Math.sin(2*Math.PI*(110*t+360*t*t))*e},p=>-.75+1.5*p)}
 for(const [i,event] of cues.entries()){
  const {time:at,type,duration}=event;
  const pan=Math.sin(i*1.73)*.45;
  if(type==='plink')bell(at,88+i%3*3,.036,pan,fx);
  if(type==='glint'){bell(at,93,.035,-.45,fx);bell(at+.055,100,.022,.45,fx)}
  if(type==='whip'||type==='swoop'||type==='paper')whoosh(at,duration??(type==='paper'?.28:type==='whip'?.5:.55),type==='whip');
  if(['click','tick','type','tap','select'].includes(type)){
   const amp={click:.19,tick:.075,type:.045,tap:.09,select:.11}[type];
   let low=0;add(fx,at,.075,t=>{low=.45*low+.55*noise();return amp*(.38*low+.62*sine(type==='click'?1350:2100,t))*Math.exp(-t*(type==='type'?150:85))},pan);
   if(type==='click')add(fx,at+.015,.10,t=>.07*sine(210,t)*Math.exp(-t*50),pan);
  }
  if(['pop','bloom','impact'].includes(type)){
   const length=type==='bloom'?.6:.28,amp=type==='impact'?.32:.19;
   add(fx,at,length,t=>amp*Math.sin(2*Math.PI*(68*t+3.1*(1-Math.exp(-t*26))))*Math.exp(-t*(type==='bloom'?11:22)),pan);
   if(type==='bloom'){bell(at,81,.085,-.4,fx);bell(at+.08,88,.04,.4,fx)}
  }
  if(type==='chime'){[81,85,88].forEach((m,j)=>bell(at+j*.065,m,.075,j*.45-.45,fx))}
  if(type==='download'){[88,85,81,76].forEach((m,j)=>bell(at+j*.055,m,.055,.3-j*.2,fx))}
 }
 const mix=[new Float32Array(N),new Float32Array(N)];
 for(let i=0;i<N;i++){const t=i/sr,fade=Math.min(1,t/.06)*Math.min(1,(duration-t)/.9);for(let c=0;c<2;c++)mix[c][i]=(music[c][i]*.82+fx[c][i])*fade}
 let peak=0;for(let i=0;i<N;i++)peak=Math.max(peak,Math.abs(mix[0][i]),Math.abs(mix[1][i]));const gain=.82/peak;
 async function wav(name,stem){const pcm=Buffer.alloc(N*4),hdr=Buffer.alloc(44);for(let i=0;i<N;i++)for(let c=0;c<2;c++)pcm.writeInt16LE(Math.round(clamp(stem[c][i]*gain,-.98,.98)*32767),i*4+c*2);hdr.write('RIFF');hdr.writeUInt32LE(pcm.length+36,4);hdr.write('WAVEfmt ',8);hdr.writeUInt32LE(16,16);hdr.writeUInt16LE(1,20);hdr.writeUInt16LE(2,22);hdr.writeUInt32LE(sr,24);hdr.writeUInt32LE(sr*4,28);hdr.writeUInt16LE(4,32);hdr.writeUInt16LE(16,34);hdr.write('data',36);hdr.writeUInt32LE(pcm.length,40);await writeFile(path.join(out,name),Buffer.concat([hdr,pcm]))}
 await wav('mix-v6.wav',mix);await wav('efeitos-v6.wav',fx);await wav('musica-v6.wav',music);
 await writeFile(path.join(out,'marcadores-sonoros.json'),JSON.stringify(cues,null,2));
 return {peak,gain,cues:cues.length};
}
