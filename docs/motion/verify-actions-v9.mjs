// Inspect actual decoded button colors, independently of audio cue labels.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {events,anchors,FPS} from './timing-v9.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),ff=path.join(dir,'ffmpeg.exe'),out=path.join(dir,'output/v9');
const video=path.join(out,'Provaai-motion-v9-1080p-120fps.mp4');
const camera=JSON.parse(await readFile(path.join(dir,'output/v7/camera-120fps.json'),'utf8'));
const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};
const findings=[];
for(const [id,start,kind] of [['approved',18.8,'review'],['download-finish',22.45,'files']]){
 const first=Math.round(start*FPS),r=spawnSync(ff,['-v','error','-ss',String(start),'-i',video,'-frames:v','40','-vf','scale=480:270','-pix_fmt','rgb24','-f','rawvideo','-'],{windowsHide:true,maxBuffer:20*1024*1024});
 if(r.status!==0)throw new Error(r.stderr.toString());
 let found;
 for(let f=0;f<40;f++){
  const t=(first+f)/FPS,c=camera[first+f];let x,y;
  if(kind==='review'){const angle=-.018+ease((t-16.8)/3)*.03;x=10600-80-250*Math.cos(angle)-251*Math.sin(angle);y=1350+45-250*Math.sin(angle)+251*Math.cos(angle);}
  else{x=12650-175;y=-120+355;}
  const dx=x-c.x,dy=y-c.y,px=Math.round((960+c.z*(dx*Math.cos(c.r)-dy*Math.sin(c.r)))/4),py=Math.round((540+c.z*(dx*Math.sin(c.r)+dy*Math.cos(c.r)))/4);
  const k=f*480*270*3+(py*480+px)*3,[red,green,blue]=r.stdout.subarray(k,k+3);
  if(green>150&&red<100&&blue>100){found=t;break;}
 }
 const cue=events.find(e=>e.id===id).time,delta=found===undefined?Infinity:1000*(cue-found);
 findings.push({id,firstGreenFrameTime:found,audioCue:cue,offsetMs:delta});
 if(Math.abs(delta)>1000/FPS+.01)throw new Error(`Button/color sync failed: ${JSON.stringify(findings.at(-1))}`);
}
const hashes={};
for(const v of [8,9]){const r=spawnSync(ff,['-v','error','-i',path.join(dir,`output/v${v}/Provaai-motion-v${v}-1080p-120fps.mp4`),'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8',windowsHide:true});if(r.status)throw new Error(r.stderr);hashes[`v${v}`]=r.stdout.trim();}
if(hashes.v8!==hashes.v9)throw new Error('Video bitstream changed');
const report={decodedVisualChecks:findings,videoIdentical:true,hashes,maxAnchorQuantizationMs:Math.max(...anchors.map(a=>Math.abs(a.quantizationMs)))};
await writeFile(path.join(out,'verificacao-acoes.json'),JSON.stringify(report,null,2));console.log(report);
